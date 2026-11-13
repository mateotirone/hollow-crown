// The quest tracker: a small panel on the HUD, always up, with the story step each player is on and which way
// to go for it (Mateo 2026-11-13: "active quests show up on the screen ... so you can see where to go next and
// it's up all the time"). It sits under the minimap, or in its place when the minimap is hidden.
//
// Rules (which step, what it points at) are in rules.js. The HUD panel is in Siege_Nights_RP/ui/hud_screen.json
// (made by tools/minimap_ui.py) and is fed by hidden titles that start with "hcq:" (core/hudtitle.js).
// Every player sees their own steps, in single player and on a Realm alike.
//
// Each player can hide it: /siege:quests (any player, no cheats needed), or /scriptevent siege:quests on|off.
// Test: /scriptevent siege:quests show          says your current steps in chat
//       /scriptevent siege:quests flag <flag>   gives you a story flag (wren_met, fell_reeve ... fell_mother), then says your steps

import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { on } from "../core/events.js";
import { sendHidden, titleBusy } from "../core/hudtitle.js";
import { keepOf } from "../siege/api.js";
import { plotOf, plotAt } from "../plots/api.js";
import { progressOf, setFlag } from "../lore/player.js";
import { LOCAL_THREADS, slugOf } from "../lore/data/plots.js";
import { reachData } from "../reach/index.js";
import { getRift, getSites, getSourceSite, SITE_NAMES } from "../undertow/source.js";
import { load } from "../undertow/data.js";
import { hasCartsong, carterStation, stationSpot } from "../undertow/story.js";
import { WARDS } from "../plots/config.js";
import { firstFacts } from "../newplayer/firstnights.js";
import { questsFor, panelText, hudString, SPOT, BOSS_STEPS, UNDERTOW } from "./rules.js";
import "./tests.js";

const OFF = "siege:quests_off";
const MINIMAP_OFF = "siege:minimap_off"; // minimap/index.js: the panel moves up into the map's place
const STEP_EVERY = 40; // ticks between working out each player's steps (reads their pack)
const POINT_EVERY = 10; // ticks between redrawing the heading as they walk and turn
const RESEND = 200; // ticks: send the same text again now and then, in case the HUD was rebuilt

const steps = new Map(); // player id -> { quests, at }
const lastSent = new Map(); // player id -> { text, at }
const ITEMS = [...new Set([...Object.values(BOSS_STEPS).map((s) => s.key), "siege:tuning_fork", "siege:choir_shard"])];

const isOff = (player) => player.getDynamicProperty(OFF) === true;

function plotName(player) {
  try {
    const held = plotOf(player.id)?.name;
    if (held) return held;
    const keep = keepOf(player.id);
    if (keep) return plotAt(keep)?.name;
  } catch { /* plots not ready */ }
  return undefined;
}

function itemsOf(player) {
  const counts = {};
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return counts;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && ITEMS.includes(it.typeId)) counts[it.typeId] = (counts[it.typeId] ?? 0) + it.amount;
  }
  return counts;
}

// The source site, once this player has named it: its cave, where the seam was built (or its ward)
function namedSite(p) {
  if (!p.solved.includes("source")) return undefined;
  const id = getSourceSite();
  const seam = getSites()[id];
  const ward = WARDS.find((w) => w.site === id);
  const spot = seam ?? ward;
  return spot ? { id, name: SITE_NAMES[id] ?? ward?.name ?? "the thin place", x: spot.x, z: spot.z } : undefined;
}

function factsOf(player) {
  const p = progressOf(player);
  const plot = plotName(player);
  const mystery = plot ? LOCAL_THREADS.find((t) => t.id === `local_${slugOf(plot)}`) : undefined;
  let reach = {};
  try { reach = reachData() ?? {}; } catch { /* not ready */ }
  const rift = getRift();
  const prog = load("hc:undertow_progress", {});
  const inHollow = player.dimension.id === UNDERTOW;
  let carter;
  if (inHollow) { try { carter = stationSpot(carterStation()); } catch { /* the Hollow isn't laid out yet */ } }
  let keep = false;
  try { keep = !!keepOf(player.id); } catch { /* siege state not ready */ }
  return {
    flags: p.flags, solved: p.solved, got: p.got, plot, mystery, keep,
    items: itemsOf(player),
    dim: player.dimension.id, pos: player.location,
    site: namedSite(p),
    rift: rift?.open ? { x: rift.x, z: rift.z, name: SITE_NAMES[rift.site] ?? "the Rift" } : undefined,
    hollow: { choir: !!prog.choir || !!reach.choir, cartsong: inHollow && hasCartsong(player.id), carter },
    morvane: !!reach.source || !!prog.morvane,
    first: (() => { try { return firstFacts(player); } catch { return undefined; } })(),
  };
}

function work(player) {
  const quests = questsFor(factsOf(player));
  steps.set(player.id, { quests, at: system.currentTick });
  return quests;
}

function send(player, force = false) {
  if (titleBusy(player)) return;
  const now = system.currentTick;
  const mine = steps.get(player.id);
  const quests = mine && now - mine.at < STEP_EVERY ? mine.quests : work(player);
  const off = isOff(player);
  const spot = off || !quests.length ? SPOT.hidden : player.getDynamicProperty(MINIMAP_OFF) === true ? SPOT.top : SPOT.below;
  const text = hudString(spot === SPOT.hidden ? "" : panelText(quests, player.location, player.getRotation().y, player.dimension.id), spot);
  const last = lastSent.get(player.id);
  if (!force && last && last.text === text && now - last.at < RESEND) return;
  sendHidden(player, text);
  lastSent.set(player.id, { text, at: now });
}

onTick("quests", POINT_EVERY, () => {
  for (const player of world.getAllPlayers()) {
    try { send(player); } catch (e) { /* a player mid-respawn or leaving */ }
  }
});

// Something in the story moved: work the steps out again at once, not at the next look.
const refresh = (player) => { if (player?.id) steps.delete(player.id); };
for (const name of ["loreFlag", "loreThreadSolved", "keepFounded", "siegeReward"]) on(name, (d) => refresh(d?.player));
on("minimapToggled", ({ player }) => { if (player) { lastSent.delete(player.id); try { send(player, true); } catch { /* left */ } } });

world.afterEvents.playerSpawn.subscribe(({ player }) => lastSent.delete(player.id));
world.afterEvents.playerDimensionChange?.subscribe?.(({ player }) => { steps.delete(player.id); lastSent.delete(player.id); });
world.afterEvents.playerLeave.subscribe(({ playerId }) => { lastSent.delete(playerId); steps.delete(playerId); });

export function setTracker(player, show) {
  player.setDynamicProperty(OFF, show ? undefined : true);
  lastSent.delete(player.id);
  player.sendMessage(show ? "§7Quest tracker shown. §8/siege:quests hides it." : "§7Quest tracker hidden. §8/siege:quests shows it again.");
  send(player, true);
}

function tellSteps(player) {
  const quests = work(player);
  if (!quests.length) return player.sendMessage("§7No story step to show. §8(The tracker goes quiet once the story is done.)");
  player.sendMessage(panelText(quests, player.location, player.getRotation().y, player.dimension.id));
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:quests") return;
  const player = e.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const arg = (e.message ?? "").trim().toLowerCase();
  if (arg === "show") return tellSteps(player);
  const [cmd, what] = arg.split(/\s+/);
  if (cmd === "flag" && what) { // test: give yourself a story flag, e.g. wren_met or fell_reeve
    setFlag(player, what);
    steps.delete(player.id);
    return tellSteps(player);
  }
  setTracker(player, arg === "on" ? true : arg === "off" ? false : isOff(player));
});

// A slash command any player can use on a Realm, cheats off.
system.beforeEvents.startup.subscribe((e) => {
  const registry = e.customCommandRegistry;
  if (!registry?.registerCommand) return;
  registry.registerCommand(
    { name: "siege:quests", description: "Show or hide your quest tracker", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only a player has a quest tracker." };
      system.run(() => { try { setTracker(player, isOff(player)); } catch { /* left meanwhile */ } });
      return { status: CustomCommandStatus.Success };
    },
  );
});
