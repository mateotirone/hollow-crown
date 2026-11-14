// Story Mode and Settlement Mode in the world (rules and Mateo's words: mode_rules.js).
//
// Each player has their own mode, saved on the player (a Realm can have one friend in the story and another just
// building). A first play is always Story Mode. Once the story has been finished on this world (Morvane fallen, by
// anyone), the welcome hall asks which mode when a player chooses a plot (plots/welcome.js calls askMode).
//
//   modeOf(player)    "story" | "settlement"
//   storyOn(player)   true in Story Mode: features that belong to the story check this before they lead anyone
//   modeChoiceOpen(player)
//   askMode(player)   -> Promise of the chosen mode, or undefined when they closed the form
//   setMode(player, mode)   saves it; on("modeSet", ({ player, mode, before }) => ...)
//
// Builder commands (operators):
//   /scriptevent siege:mode                  your mode, and whether the choice is open on this world
//   /scriptevent siege:mode story|settlement set your own mode now (Settlement Mode clears Old Elspeth's guide
//                                            flags so she starts you from the beginning)
//   /scriptevent siege:mode unlock|lock      open or close the choice on this world, for a world where the story
//                                            was finished somewhere else

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, emit } from "../core/events.js";
import { progressOf, saveProgress } from "../lore/player.js";
import { STORY, SETTLEMENT, MODES, MODE_NAMES, MODE_BLURB, modeFrom, isStory, choiceOpen, FINISHED_FLAG, guideFlagsToClear } from "./mode_rules.js";

const PROP = "hc:mode"; // on the player
const WORLD_DONE = "hc:story_finished"; // on the world: the story has been finished here (or a builder opened the choice)

export function modeOf(player) {
  try { return modeFrom(player.getDynamicProperty(PROP)); } catch { return STORY; }
}
export const storyOn = (player) => isStory(modeOf(player));

const worldDone = () => { try { return world.getDynamicProperty(WORLD_DONE) === true; } catch { return false; } };
const ownDone = (player) => { try { return progressOf(player).flags.includes(FINISHED_FLAG); } catch { return false; } };
export const modeChoiceOpen = (player) => choiceOpen({ ownDone: ownDone(player), worldDone: worldDone() });

// Starting over in Settlement Mode: Old Elspeth's guide starts from the first meeting (newplayer/act1.js clears
// its own per-player marks on "modeSet")
function clearGuide(player) {
  const p = progressOf(player);
  const drop = new Set(guideFlagsToClear(p.flags));
  if (!drop.size) return;
  p.flags = p.flags.filter((f) => !drop.has(f));
  saveProgress(player);
}

export function setMode(player, mode) {
  const before = modeOf(player);
  const now = modeFrom(mode);
  player.setDynamicProperty(PROP, now === STORY ? undefined : now);
  if (now === SETTLEMENT) clearGuide(player);
  emit("modeSet", { player, mode: now, before });
  return now;
}

// The choice, as the welcome hall shows it: Story Mode first, as the one a first play gets
export function askMode(player) {
  const form = new ActionFormData().title("How will you play?")
    .body(`The story has been seen through on this world, so you may choose.\n\n§6${MODE_NAMES[STORY]}§r\n${MODE_BLURB[STORY]}\n\n§6${MODE_NAMES[SETTLEMENT]}§r\n${MODE_BLURB[SETTLEMENT]}`);
  for (const m of MODES) form.button(MODE_NAMES[m]);
  return form.show(player).then((r) => (r.canceled ? undefined : MODES[r.selection])).catch(() => undefined);
}

// Morvane falls: the story is finished on this world, and the choice opens for every plot chosen after
on("loreFlag", ({ flag }) => {
  if (flag !== FINISHED_FLAG || worldDone()) return;
  try { world.setDynamicProperty(WORLD_DONE, true); } catch { /* world not ready */ }
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:mode") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const arg = (e.message ?? "").trim().toLowerCase();
  if (MODES.includes(arg)) {
    setMode(player, arg);
    return player.sendMessage(`§6You are in ${MODE_NAMES[arg]}.${arg === SETTLEMENT ? "§7 Old Elspeth will walk you through your settlement from the start." : ""}`);
  }
  if (arg === "unlock" || arg === "lock") {
    world.setDynamicProperty(WORLD_DONE, arg === "unlock" ? true : undefined);
    return player.sendMessage(`§6The mode choice is ${arg === "unlock" ? "open" : "closed"} on this world.§7 ${arg === "unlock" ? "The welcome hall asks which mode when a plot is chosen." : "A player who finished the story here still sees it."}`);
  }
  player.sendMessage(`§6${MODE_NAMES[modeOf(player)]}.§7 Choice ${modeChoiceOpen(player) ? "open" : "not open yet"} on this world (story finished here: ${worldDone() ? "yes" : "no"}, by you: ${ownDone(player) ? "yes" : "no"}).\n§8/scriptevent siege:mode story | settlement | unlock | lock`);
});
import "./mode_tests.js";
