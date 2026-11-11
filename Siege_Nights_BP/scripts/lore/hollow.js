// The Hollow's middle stretch: the scenes at each place between the Rift and the Choir, and the Carter's
// flags. Words are in data/hollow_story.js; the Carter's conversations are in data/dialogue.js.
//
// The Hollow feature (undertow/story.js) emits hollowBeat { player, beat } whenever a player walks into
// one of the story places (and "choir_silenced" once the Court is quiet). Each scene plays once per
// player and sets the flag hb_<beat>. Three of the five site beats set hb_ready, and the Carter then
// teaches the Cartsong (flag "cartsong"), which the Hollow feature reads to let that player into the Court.
// The Seams asks a choice (flags seams_wreck / seams_spare); the Hollow feature acts on them.
//
//   /scriptevent siege:hollow_beat <id>   play one scene now and set its flag (testing). Ids: see SCENES
//   /scriptevent siege:hollow_story       what you have heard in the Hollow, and what is left
//   /scriptevent siege:cartsong           give yourself the Cartsong (testing)

import { system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { progressOf, setFlag, grantTome, giveItem } from "./player.js";
import { sfx } from "../core/sfx.js";
import { SCENES, SITE_BEATS, SEAMS_CHOICE, SPARE_ORE, CARTER_NAMES, flagOf, siteBeatsHeard, readyForSong, BEATS_FOR_SONG } from "./data/hollow_story.js";
import { NPCS } from "./data/dialogue.js";
import { TOME } from "./logic.js";

const LINE_GAP = 70; // ticks between lines of a scene (3.5 s)
const playing = new Set(); // player ids in the middle of a scene
const offering = new Set(); // player ids looking at the Seams choice

const say = (player, text) => { try { player.sendMessage(text); } catch { /* left */ } };
const flagsOf = (player) => progressOf(player).flags;

function playScene(player, beat, then) {
  const scene = SCENES[beat];
  if (!scene) return;
  playing.add(player.id);
  try {
    player.onScreenDisplay.setTitle(" ", { subtitle: `§d${scene.title}`, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
    sfx(player, "siege.choir.hum", { volume: 0.6 });
  } catch { /* cosmetic */ }
  scene.lines.forEach((line, i) => system.runTimeout(() => say(player, line), 30 + i * LINE_GAP));
  system.runTimeout(() => {
    playing.delete(player.id);
    if (scene.give) grantTome(player, scene.give);
    then?.();
  }, 30 + scene.lines.length * LINE_GAP);
}

function afterSiteBeat(player) {
  const flags = flagsOf(player);
  if (!readyForSong(flags) || flags.includes("hb_ready")) return;
  setFlag(player, "hb_ready");
  say(player, "§7§oYou have seen enough of this country to know what the Court is. The Carter, back in Glimwade, will know it too.");
}

function offerSeams(player) {
  const flags = flagsOf(player);
  if (flags.includes(SEAMS_CHOICE.wreck.flag) || flags.includes(SEAMS_CHOICE.spare.flag) || offering.has(player.id)) return;
  offering.add(player.id);
  const form = new ActionFormData().title(SEAMS_CHOICE.title).body(SEAMS_CHOICE.body).button(SEAMS_CHOICE.wreck.label).button(SEAMS_CHOICE.spare.label);
  form.show(player).then((r) => {
    offering.delete(player.id);
    if (r.canceled || r.selection === undefined) {
      say(player, "§7§oThe miners will still be at the Seams if you come back.");
      return;
    }
    const pick = r.selection === 0 ? SEAMS_CHOICE.wreck : SEAMS_CHOICE.spare;
    if (!setFlag(player, pick.flag)) return;
    say(player, pick.after);
    if (pick === SEAMS_CHOICE.spare) giveItem(player, new ItemStack("siege:raw_choir_ore", SPARE_ORE));
  }).catch(() => offering.delete(player.id));
}

export function hearBeat(player, beat) {
  if (!SCENES[beat] || playing.has(player.id)) return false;
  const isNew = setFlag(player, flagOf(beat));
  const site = SITE_BEATS.includes(beat);
  if (!isNew) {
    if (beat === "seams") offerSeams(player); // walked away from the choice last time
    return false;
  }
  playScene(player, beat, () => {
    if (beat === "seams") offerSeams(player);
    if (site) afterSiteBeat(player);
  });
  return true;
}

on("hollowBeat", ({ player, beat }) => { if (player) hearBeat(player, beat); });

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const player = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  if (!player) return;
  if (e.id === "siege:hollow_beat") {
    const beat = e.message.trim();
    if (!SCENES[beat]) return say(player, `§7Scenes: ${Object.keys(SCENES).join(", ")}`);
    progressOf(player).flags = progressOf(player).flags.filter((f) => f !== flagOf(beat)); // replay it
    hearBeat(player, beat);
  } else if (e.id === "siege:hollow_story") {
    const flags = flagsOf(player);
    const heard = Object.keys(SCENES).map((b) => `${flags.includes(flagOf(b)) ? "§a" : "§8"}${b}`).join("§7, ");
    say(player, `§dThe Hollow's middle stretch§7: ${heard}§7. Places ${siteBeatsHeard(flags)}/${BEATS_FOR_SONG} for the Cartsong. Cartsong ${flags.includes("cartsong") ? "§ayes" : "§8no"}§7. Seams: ${flags.includes("seams_wreck") ? "wrecked" : flags.includes("seams_spare") ? "let go" : "undecided"}.`);
  } else if (e.id === "siege:cartsong") {
    setFlag(player, "hb_ready");
    setFlag(player, "cartsong");
    say(player, "§dYou have the Cartsong. The Court gate will take you for a cart.");
  }
});

addTests("hollow story", {
  "every beat has a scene": () => {
    for (const b of [...SITE_BEATS, "landing", "glimwade", "choir_silenced"]) assert(SCENES[b], `beat ${b} has no scene`);
    assert(SITE_BEATS.length >= BEATS_FOR_SONG, "not enough places for the Cartsong");
  },
  "three of five places make you ready for the Cartsong": () => {
    assertEqual(siteBeatsHeard(["hb_truce_hall", "hb_drift"]), 2);
    assert(!readyForSong(["hb_truce_hall", "hb_drift", "hb_glimwade"]), "Glimwade is not one of the five");
    assert(readyForSong(["hb_truce_hall", "hb_drift", "hb_seams"]), "three places should be enough");
  },
  "scene tomes exist": () => {
    for (const [b, s] of Object.entries(SCENES)) if (s.give) assert(TOME[s.give], `${b} gives unknown tome ${s.give}`);
  },
  "the Carter is written and keeps the secret": () => {
    const carter = NPCS.find((n) => n.id === "carter");
    assert(carter, "no Carter");
    for (const id of CARTER_NAMES) assert(carter.nodes[`named_${id}`], `no node for the name ${id}`);
    const words = JSON.stringify(carter) + JSON.stringify(SCENES) + JSON.stringify(SEAMS_CHOICE);
    assert(!/oswin|aldric|edda/i.test(words), "the middle stretch must not name the king");
    assert(!/mirror|upside/i.test(words), "the Hollow is not a mirror");
  },
});
