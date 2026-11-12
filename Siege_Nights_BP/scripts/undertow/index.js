// The Undertow: the final-quest dimension of The Hollow Crown.
//
//   source.js   the secret Source pick, the 7 cave seams, the Tuning Fork
//   rift.js     the crack that tears open in a cave wall
//   terrain.js  the land, generated from a fixed seed (custom dimensions are void only)
//   builder.js  builds terrain and set pieces near players, a little each tick
//   layout.js   fixed numbers and places (other threads import COURT and UNDERTOW_ID from here)
//
// Needs Bedrock 26.30+ and @minecraft/server 2.8.0 (custom dimensions became stable there).
// Commands (creative/op):
//   /scriptevent hc:mark_source_site <id>   record a candidate shrine by hand (look at the wall)
//   /scriptevent hc:thin_status             which of the seven thin-place caves are built (thinplaces.js)
//   /scriptevent hc:thin_tp <id>            go to a thin place;  hc:thin_build <id>  build it now
//   /scriptevent hc:seep_status             how far the seep has spread;  hc:seep_days <n>  pretend the Rift has been open n days (seep.js)
//   /scriptevent hc:open_rift               open the Rift at the picked site without a fork
//   /scriptevent hc:reveal_source           tell only you which site was picked (spoils it!)
//   /scriptevent hc:undertow_go             go to the Undertow now (testing)
//   /scriptevent hc:undertow_status         build progress
//   /scriptevent hc:slip [seconds]          a Slip: a few seconds in the Hollow, then back where you stood
//   /scriptevent hc:flicker [seconds]       a Flicker: Hollow fog and shapes, no teleport

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick } from "../core/loop.js";
import { addTests, assert } from "../core/tests.js";
import "./arenas_tests.js";
import { on, isNight } from "../siege/api.js";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, COURT, HEART, TEXT, stageAt, pathX } from "./layout.js";
import { getSourceSite, getSites, markSite, openRift, riftExit, sourceSignsTick, SITE_NAMES, SOURCE_SITE_IDS } from "./source.js";
import { VEIL, planCrack, tearBand, TEAR_STEPS, TEAR_CLIMB } from "./rift.js";
import { buildTick, piecesTick, flush, pieces, openCourtGate, openRiverGate, rebuildHeart, waystoneSpot, WAYSTONE, isBuilt, siteOutdated, withClearing } from "./builder.js";
import { heightAt, planChunk, isRiver, regionAt, columnAt } from "./terrain.js";
import { RIVER_NODES, riverSegments, riverDistance, RIVER_HALF_WIDTH } from "./rivers.js";
import { SITES, ROADS, roadLines, signposts, signRot } from "./roads.js";
import { STRUCTURE_IDS, planStructure } from "./structures.js";
import { SITE_DESIGNS, TOWER_DESIGNS } from "./sites_data.js";
import { DROWNED_SPOTS, spotGround } from "./drowned.js";
import { stampCells, stateTries } from "./stamp.js";
import { POCKETS, planPocket, pocketTick, requestPockets, REVEAL_LOOKS, ROOM_LOOKS } from "./pockets.js";
import { overworldStage } from "./finale.js";
import { ItemStack } from "@minecraft/server";
import { load, save, say, runCmd, upgradeSteps, DATA_VERSION, FACING } from "./data.js";
import { choirTick, singerSpot, CHOIR } from "./choir.js";
import { slipSeconds, slipLanding, isSlipping } from "./slips.js";
import { shouldAlarm, oreOutcome, noteEntry, crownTick, crownVerdict, CLAIM_SECONDS, WARDEN } from "./warden.js";
import { crownFate, needsRefresh, standHeight, KEEP } from "./crownkeep.js";
import { oreChance, roofAt, ROOF, groundAt, GROUND, ambientLightAt, AMBIENT, pickTree, treeKind } from "./terrain.js";
import { HOLLOW_TREES } from "./trees_data.js";
import { clearOps } from "./builder.js";
import { shouldRise, regentOutcome, REGENT, TEMPERS, JOBS } from "./regent.js";
import { sfx } from "../core/sfx.js";
import { thinTick, thinCommand, planThinPlace, hillHeight, caveGeometry, setHills, toWorld, THIN_PLACES, CAMP_TOME, CAVES, MOUTH_V } from "./thinplaces.js";
import { SITE_FEATURES } from "../lore/data/world.js";
import { canOpen, getRift, dullLeft, BOSSES_TO_OPEN, FORK_DULL_DAYS } from "./source.js";
import { fallenCount, REGIONAL_BOSSES } from "../lore/data/spine.js";
import { seepTick, seepCommand, planVeins, mouthSeeds, reachOn, hollowOf, takesMoss, heldGround, MAX_REACH } from "./seep.js";
import { progressOf } from "../lore/player.js";
import { CRACK_HEIGHT, CRACK_DEPTH, OPENING } from "./rift.js";
import "./story.js";
import "./forge.js";
import "./finds.js";

const IN_TAG = "siege_undertow_in";
const FOG_ID = "siege:undertow_fog";
const FOG_LAYER = "hc_undertow";
const FLOW = "siege:glimmerflow";
const K_PLAYERS = "hc:undertow_players"; // { playerId: { lit: [waystone indexes], stage } }
const K_PROGRESS = "hc:undertow_progress"; // { oswin: bool, choir: bool }

// ---- the dimension ------------------------------------------------------------------------
system.beforeEvents.startup.subscribe((e) => {
  e.dimensionRegistry.registerCustomDimension(UNDERTOW_ID);
});

const undertow = () => world.getDimension(UNDERTOW_ID);
const inUndertow = (p) => p.dimension.id === UNDERTOW_ID;
const isBuilder = (p) => p.getGameMode() === GameMode.Creative;
const progress = () => load(K_PROGRESS, { oswin: false, choir: false });

on("ready", () => {
  getSourceSite(); // make the secret pick now if nobody has yet
  // Keep the arrival area loaded so it gets built before anyone arrives.
  runCmd(undertow(), "tickingarea add -32 60 -48 31 130 47 hc_undertow_wound true");
});

// ---- going in and out ---------------------------------------------------------------------
const cooldown = new Map();

function enter(player) {
  cooldown.set(player.id, system.currentTick + 60);
  if (!isBuilt(0, 0) || !isBuilt(-1, -1)) {
    say(player, "§5The Rift shudders but will not take you yet. Try again in a moment.");
    return;
  }
  player.addEffect("slow_falling", 300, { amplifier: 0, showParticles: false });
  player.addEffect("resistance", 300, { amplifier: 4, showParticles: false });
  player.addEffect("darkness", 60, { amplifier: 0, showParticles: false });
  player.teleport(L.arrival, { dimension: undertow(), facingLocation: { x: 0, y: 95, z: 60 } });
  noteEntry(player, "rift");
  system.runTimeout(() => {
    player.onScreenDisplay.setTitle("§5" + cap(TEXT.name), { subtitle: "§7The Wound", fadeInDuration: 20, stayDuration: 60, fadeOutDuration: 30 });
    sfx(player, "sig.rift_cross");
  }, 20);
}

// The veil only takes those who earned the way (Mateo 2026-11-12): a player crosses from our side only once all
// five regional bosses have fallen by their own hand. Standing beside someone who has does not count. Anyone
// else finds the veil hard as glass: it pushes them back a step, hums, and says why. Coming back out is free.
export const mayCrossWith = (fallen, creative) => creative || canOpen(fallen);
const mayCross = (p) => mayCrossWith(fallenCount(progressOf(p).flags), isBuilder(p));
export const REFUSALS = [
  "The veil does not know you yet.",
  "It holds. Whatever waits beyond has not finished weighing you.",
  "Not yet. The road here is longer than the one you walked.",
  "The veil lets others through and closes behind them. Your own work is not done.",
];
const NUMBER = ["None", "One", "Two", "Three", "Four", "Five"];
export const refusalLine = (n, fallen, total) => `§5${REFUSALS[n % REFUSALS.length]} §7${NUMBER[fallen] ?? fallen} of ${NUMBER[total]?.toLowerCase() ?? total} have fallen by your hand.`;
const refusedTimes = new Map();
export function refuse(player) {
  cooldown.set(player.id, system.currentTick + 50);
  const n = refusedTimes.get(player.id) ?? 0;
  refusedTimes.set(player.id, n + 1);
  const r = getRift(), [fx, fz] = FACING[r?.facing] ?? [0, 0];
  try { player.applyKnockback({ x: fx * 1.2, z: fz * 1.2 }, 0.25); } catch { try { player.applyKnockback(fx, fz, 1.2, 0.25); } catch {} }
  try { sfx(player, "sig.rift_refuse"); } catch {}
  say(player, refusalLine(n, fallenCount(progressOf(player).flags), REGIONAL_BOSSES.length));
}

function leave(player) {
  cooldown.set(player.id, system.currentTick + 60);
  const exit = riftExit();
  const ow = world.getDimension("minecraft:overworld");
  player.addEffect("resistance", 100, { amplifier: 4, showParticles: false });
  if (exit) player.teleport(exit, { dimension: ow });
  else player.teleport(world.getDefaultSpawnLocation(), { dimension: ow });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function blockAt(p, dy) {
  try {
    const l = p.location;
    return p.dimension.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y + dy), z: Math.floor(l.z) });
  } catch {
    return undefined;
  }
}

// Every 5 ticks: veil contact, glimmerflow slowing.
onTick("undertow:contact", 5, () => {
  for (const p of world.getAllPlayers()) {
    const feet = blockAt(p, 0.1), head = blockAt(p, 1.2);
    const touching = feet?.typeId === VEIL || head?.typeId === VEIL;
    if (touching && !isSlipping(p) && (cooldown.get(p.id) ?? 0) < system.currentTick) {
      if (inUndertow(p)) leave(p);
      else if (p.dimension.id === "minecraft:overworld") { if (mayCross(p)) enter(p); else refuse(p); }
    }
    if (inUndertow(p) && (feet?.typeId === FLOW || head?.typeId === FLOW)) {
      p.addEffect("slowness", 30, { amplifier: 1, showParticles: false });
    }
  }
});

// Every 2 seconds: fog on/off (catches deaths and any other teleport), beds, stage titles.
onTick("undertow:fog", 40, () => {
  const players = load(K_PLAYERS, {});
  let changed = false;
  for (const p of world.getAllPlayers()) {
    const inside = inUndertow(p), tagged = p.hasTag(IN_TAG);
    if (inside && !tagged) {
      p.addTag(IN_TAG);
      runCmd(p, `fog @s push ${FOG_ID} ${FOG_LAYER}`);
    } else if (!inside && tagged) {
      p.removeTag(IN_TAG);
      runCmd(p, `fog @s remove ${FOG_LAYER}`);
    }
    if (!inside) continue;
    if (isSlipping(p)) continue; // no place names during a Slip: they shouldn't know where they are
    const st = stageAt(Math.floor(p.location.z));
    const rec = (players[p.id] ??= { lit: [], stage: "" });
    if (st && rec.stage !== st.id) {
      rec.stage = st.id;
      changed = true;
      p.onScreenDisplay.setTitle(" ", { subtitle: "§d" + st.name, fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 20 });
    }
  }
  if (changed) save(K_PLAYERS, players);
});

// No sleeping or setting spawn below reality.
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.player.dimension.id !== UNDERTOW_ID) return;
  const id = e.block.typeId;
  if (id.endsWith("_bed") || id === "minecraft:bed" || id === "minecraft:respawn_anchor") {
    e.cancel = true;
    system.run(() => say(e.player, "§7Nothing sleeps down here. Not safely."));
  }
});

// ---- building -----------------------------------------------------------------------------
onTick("undertow:build", 1, () => {
  const players = world.getAllPlayers().filter(inUndertow);
  buildTick(players);
});
onTick("undertow:pieces", 40, () => piecesTick());
// The river's water gate in the sealed wall may be generated long after the Court falls: open it then.
let riverGateOpen = false;
onTick("undertow:rivergate", 100, () => {
  if (!progress().oswin) return;
  if (!riverGateOpen) riverGateOpen = openRiverGate();
  // A world updated after the Court fell builds its land again (new generator), sealing the wall anew: open it.
  if (!courtGateOpen && pieces().court && isBuilt(0, Math.floor(COURT.gateZ / 16))) { openCourtGate(true); courtGateOpen = true; }
});
let courtGateOpen = false;
onTick("undertow:save", 200, () => flush());

// ---- atmosphere: lightning in the fog above, blue motes along the rivers --------------------
const nextFlash = new Map();
onTick("undertow:sky", 20, () => {
  for (const p of world.getAllPlayers()) {
    if (!inUndertow(p)) continue;
    const l = p.location, d = p.dimension;
    // Blue energy motes drifting up from the land
    for (let i = 0; i < 4; i++) {
      const x = l.x + (Math.random() - 0.5) * 40, z = l.z + (Math.random() - 0.5) * 40;
      const h = heightAt(Math.floor(x), Math.floor(z));
      if (h === null) continue;
      try { d.spawnParticle(isRiver(Math.floor(x), Math.floor(z)) ? "minecraft:soul_particle" : "minecraft:end_rod", { x, y: h + 1.5 + Math.random() * 6, z }); } catch {}
    }
    // Lightning in the fog above: thunder, and now and then a real bolt striking the land far off.
    const due = nextFlash.get(p.id) ?? system.currentTick + 200;
    if (system.currentTick < due) { nextFlash.set(p.id, due); continue; }
    nextFlash.set(p.id, system.currentTick + 160 + Math.floor(Math.random() * 340));
    if (columnAt(Math.floor(l.x), Math.floor(l.z))?.site === "standing_ranks") continue; // the Standing Ranks are silent
    sfx(p, "ambient.weather.thunder", { volume: 0.5, pitch: 0.6 + Math.random() * 0.3 });
    if (Math.random() < 0.4) {
      const ang = Math.random() * Math.PI * 2, far = 24 + Math.random() * 20;
      const x = Math.floor(l.x + Math.cos(ang) * far), z = Math.floor(l.z + Math.sin(ang) * far);
      const h = heightAt(x, z);
      if (h !== null) {
        try { d.spawnEntity("minecraft:lightning_bolt", { x: x + 0.5, y: h + 1, z: z + 0.5 }); } catch {}
      }
    }
  }
});

// ---- waystones ----------------------------------------------------------------------------
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== WAYSTONE || !e.isFirstEvent) return;
  e.cancel = true;
  const player = e.player, loc = e.block.location;
  system.run(() => useWaystone(player, loc));
});

function waystoneIndexAt(loc) {
  return L.waystoneZ.findIndex((_, i) => {
    const s = waystoneSpot(i);
    return s.x === loc.x && s.y === loc.y && s.z === loc.z;
  });
}

function useWaystone(player, loc) {
  const i = waystoneIndexAt(loc);
  if (i < 0) return;
  const players = load(K_PLAYERS, {});
  const fresh = [];
  for (const p of player.dimension.getPlayers({ location: loc, maxDistance: 8 })) {
    const rec = (players[p.id] ??= { lit: [], stage: "" });
    if (!rec.lit.includes(i)) { rec.lit.push(i); fresh.push(p); }
  }
  save(K_PLAYERS, players);
  try {
    sfx(player.dimension, "block.amethyst_block.chime", loc, { volume: 1.5, pitch: 0.6 });
    player.dimension.spawnParticle("minecraft:totem_particle", { x: loc.x + 0.5, y: loc.y + 1.2, z: loc.z + 0.5 });
  } catch {}
  for (const p of fresh) say(p, "§dThe waystone takes your light. You can return here from the Wound.");
  if (fresh.length) return;
  // Already lit: offer travel to your other lit waystones.
  const lit = (players[player.id]?.lit ?? []).filter((n) => n !== i).sort((a, b) => a - b);
  if (!lit.length) return say(player, "§7No other waystone holds your light yet.");
  const form = new ActionFormData().title("Waystones").body("Step to a waystone you have lit.");
  for (const n of lit) form.button(`${stageAt(L.waystoneZ[n])?.name ?? "Waystone"} (${n + 1})`);
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const s = waystoneSpot(lit[r.selection]);
    player.teleport({ x: s.x + 0.5, y: s.y, z: s.z + 1.5 }, { dimension: undertow() });
  });
}

// ---- the Court (the Choir) and the Seat (the last fight) -----------------------------------
let seatOccupied = false, seatEmptySince = 0;
onTick("undertow:arenas", 20, () => {
  const prog = progress();
  choirTick(); // the Choir wakes when someone walks into the Court
  // After the Choir: tell the boss code when someone steps onto the Seat.
  if (prog.choir && !prog.morvane && pieces().heart) {
    const there = world.getAllPlayers().some((p) => inUndertow(p) && dist2(p.location, HEART.center) < HEART.outerRadius ** 2);
    if (there && !seatOccupied) {
      seatOccupied = true;
      requestPockets();
      sendEvent("siege:undertow_arena_ready", "morvane");
    } else if (!there && seatOccupied) {
      if (!seatEmptySince) seatEmptySince = system.currentTick;
      if (system.currentTick - seatEmptySince > 1200) { seatOccupied = false; seatEmptySince = 0; } // re-arm after 60 s empty
    } else seatEmptySince = 0;
  }
  crownTick(); // the Hollow Crown: a Sorcerer who wears it rules, anyone else dies
});
onTick("undertow:pockets", 2, () => pocketTick());

// The Crown thread tells us when the throne below is empty again: the last fight can be fought again.
on("crownVacant", () => {
  const prog = progress();
  prog.morvane = false;
  save(K_PROGRESS, prog);
  world.sendMessage("§5Far below, something takes its seat again.");
});

// The Hollow Crown falls from its wearer into a chest at the middle of the Seat. Once, unless it is
// lost (crownkeep.js): then it goes back into that chest.
function leaveCrown() {
  const prog = progress();
  if (prog.crownOut && !prog.crownReturning) return;
  const d = undertow(), at = { x: HEART.center.x, y: HEART.center.y, z: HEART.center.z };
  try {
    const crown = new ItemStack("siege:hollow_crown", 1);
    try { crown.setLore(["§5It hums with many voices.", "§4It will not suffer the unworthy."]); } catch { /* plain crown */ }
    d.setBlockType(at, "minecraft:chest");
    const box = d.getBlock(at)?.getComponent("inventory")?.container;
    if (box) box.setItem(13, crown); else d.spawnItem(crown, { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 });
    const back = prog.crownReturning;
    prog.crownOut = true;
    prog.crownReturning = false;
    save(K_PROGRESS, prog);
    if (back) world.sendMessage("§5Far below, the Hollow Crown is back in its chest at the Seat.");
  } catch { /* the Seat is not loaded: the tick below tries again when someone is there */ }
}
onTick("undertow:crownfall", 100, () => { const p = progress(); if ((p.morvane && !p.crownOut) || p.crownReturning) leaveCrown(); });

// The Crown was lying somewhere and is gone (lava, the void, an explosion) with nobody holding it.
// There is only one, so it goes home. A creative test Crown lost before the real one is out changes nothing.
on("crownLost", () => {
  const prog = progress();
  if (!prog.crownOut) return;
  prog.crownReturning = true;
  save(K_PROGRESS, prog);
  world.sendMessage("§5The Hollow Crown is gone from where it lay. Something below calls it home.");
  leaveCrown();
});

function sendEvent(id, message) {
  try { system.sendScriptEvent(id, message); } catch { runCmd(undertow(), `scriptevent ${id} ${message}`); }
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

// ---- script events --------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const player = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  switch (e.id) {
    case "siege:boss_defeated": {
      let boss;
      try { boss = JSON.parse(e.message).boss; } catch { boss = e.message.trim(); }
      if (boss === "choir" || boss === COURT.bossId) {
        const prog = progress();
        if (!prog.choir || !prog.oswin) {
          prog.choir = true;
          prog.oswin = true; // "the Court is cleared": the gate and the river's water gate stay open
          save(K_PROGRESS, prog);
          openCourtGate();
          requestPockets(); // get the last fight's places built while players make the Long Climb
          world.sendMessage("§5The Court falls silent. Behind the throne, the sealed gate cracks open. The way on is south, up the Long Climb, to the Seat.");
        }
      }
      if (boss === "morvane") {
        const prog = progress();
        if (!prog.morvane) {
          prog.morvane = true;
          save(K_PROGRESS, prog);
          rebuildHeart(); // so nobody is left standing on a falling floor
          leaveCrown();
          world.sendMessage("§5The singing stops. For the first time in living memory, the land above is quiet.");
        }
      }
      break;
    }
    case "hc:seep_status":
    case "hc:seep_days":
      if (player && isBuilder(player)) seepCommand(e.id, player, e.message);
      break;
    case "hc:thin_status":
    case "hc:thin_tp":
    case "hc:thin_build":
      if (player && isBuilder(player)) thinCommand(e.id, player, e.message);
      break;
    case "hc:mark_source_site":
      if (player && isBuilder(player)) markSite(player, e.message.trim());
      break;
    case "hc:open_rift": {
      if (!player || !isBuilder(player)) break;
      const r = openRift(player);
      if (!r.ok) say(player, `§cCan't open the Rift: ${r.why}.`);
      break;
    }
    case "hc:reveal_source":
      if (player && isBuilder(player)) {
        const id = getSourceSite(), s = getSites()[id];
        say(player, `§dThe Source is at ${SITE_NAMES[id]} (${id})` + (s ? ` ${s.x} ${s.y} ${s.z}` : ", not marked yet") + ". Keep it secret.");
      }
      break;
    case "hc:undertow_go":
      if (player && isBuilder(player)) enter(player);
      break;
    case "hc:undertow_status":
      if (player) {
        const p = pieces(), marked = Object.keys(getSites()).length;
        say(player, `§dThe Hollow: wound ${p.wound ? "built" : "pending"}, court ${p.court ? "built" : "pending"}, heart ${p.heart ? "built" : "pending"}, waystones ${p.waystones.length}/${L.waystoneZ.length}. Source sites marked ${marked}/7. Choir ${progress().choir ? "silenced" : "singing"}, the Seat ${progress().morvane ? "empty" : "held"}.`);
      }
      break;
  }
});

// ---- showcase exhibits (/scriptevent siege:showcase) ------------------------------------------
on("showcase", ({ player, dim, nextSpot, label }) => {
  const at = nextSpot();
  try {
    const singer = dim.spawnEntity("siege:choir_singer", { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    singer.addTag("siege_showcase");
    singer.addTag("siege_boss_shielded");
  } catch { /* entity missing */ }
  label(at, "Singer\n(the Choir)");
  say(player, "§dThe Hollow: step into the Rift Veil block, or type §f/scriptevent hc:undertow_go§d, to visit it. §f/scriptevent hc:slip§d gives you a Slip. The Choir wakes when you walk into the Court (z 1600); the Seat is at the far end (z 2400).");
});

// ---- signs at the real Source -----------------------------------------------------------
onTick("undertow:source", 600, () => sourceSignsTick(isNight()));
// ---- the seven thin-place caves build themselves when someone first comes near -------------
onTick("undertow:thin", 40, () => thinTick());
onTick("undertow:seep", 100, () => seepTick());

// ---- self-tests ---------------------------------------------------------------------------
addTests("undertow", {
  "saved data: old worlds get every upgrade step, in order, once": () => {
    const steps = [{ to: 3 }, { to: 2 }, { to: 4 }];
    assert(upgradeSteps(1, 3, steps).map((s) => s.to).join() === "2,3" && upgradeSteps(3, 3, steps).length === 0 && upgradeSteps(2, 4, steps).map((s) => s.to).join() === "3,4");
    assert(upgradeSteps(1).every((s) => s.to <= DATA_VERSION) && upgradeSteps(DATA_VERSION).length === 0);
  },
  "site ids match the lore list": () => assert(SOURCE_SITE_IDS.length === 7),
  "thin places: all seven are on the map, one per lore site, each with its own Field Note": () => {
    assert(THIN_PLACES.length === 7, `${THIN_PLACES.length} thin places`);
    assert(new Set(THIN_PLACES.map((t) => t.id)).size === 7 && THIN_PLACES.every((t) => SOURCE_SITE_IDS.includes(t.id) && SITE_FEATURES[t.id]));
    assert(new Set(Object.values(CAMP_TOME)).size === 7 && THIN_PLACES.every((t) => CAMP_TOME[t.id]));
  },
  "thin places: each cave shows exactly Fennick's features for it": () => {
    for (const t of THIN_PLACES) {
      const plan = planThinPlace(t.id, 0, 0, 64);
      const has = (b) => plan.ops.some((o) => o.block === b);
      const [water, bell, worked, cold, salt, roots] = SITE_FEATURES[t.id];
      assert(has("minecraft:water") === water, `${t.id} water`);
      assert(has("minecraft:bell") === bell, `${t.id} bell`);
      assert(plan.ops.some((o) => /bricks|cut_|polished|chiseled/.test(o.block)) === worked, `${t.id} worked stone`);
      assert((has("minecraft:packed_ice") || has("minecraft:snow_layer")) === cold, `${t.id} cold`);
      assert(has("minecraft:calcite") === salt, `${t.id} salt`);
      assert(has("minecraft:hanging_roots") === roots, `${t.id} roots`);
    }
  },
  "thin places: the seam has room to tear open and the camp holds the Field Note": () => {
    for (const t of THIN_PLACES) {
      const plan = planThinPlace(t.id, 100, 200, 64, { facing: t.facing, ground: (dx, dz) => Math.round((dx + dz) / 8) });
      const last = new Map();
      for (const o of plan.ops) last.set(`${o.x},${o.y},${o.z}`, o.block);
      const s = plan.seam, [fx, fz] = FACING[t.facing];
      assert(s.facing === t.facing && last.get(`${s.x},${s.y},${s.z}`) === "siege:rift_seam", `${t.id} seam`);
      assert(plan.crackH >= 7 && plan.crackH <= 30, `${t.id}: crack ${plan.crackH} tall`);
      for (let row = 0; row < plan.crackH; row++) {
        assert(last.get(`${s.x + fx},${s.y + row},${s.z + fz}`) === "minecraft:air", `${t.id}: crack row ${row} opens onto the chamber`);
        const back = `${s.x - fx * 4},${s.y + row},${s.z - fz * 4}`;
        assert(last.get(back) !== "minecraft:air" && last.has(back), `${t.id}: rock behind the crack at row ${row}`);
      }
      // the crack runs floor to ceiling: the chamber's roof is right above its top row
      const over = `${s.x + fx},${s.y + plan.crackH},${s.z + fz}`;
      assert(last.has(over) && last.get(over) !== "minecraft:air", `${t.id}: the crack stops short of the ceiling`);
      // every cell of the deep crack (the void behind the veil) has rock to sit in, and land over it
      for (const c of planCrack(s, t.facing, { height: plan.crackH, deep: true })) {
        if (c.depth < 1) continue;
        const k = `${c.x},${c.y},${c.z}`;
        assert(c.depth > 4 || (last.has(k) && last.get(k) !== "minecraft:air"), `${t.id}: the void breaks into the open at depth ${c.depth}`);
      }
      assert(last.get(`${plan.tome.x},${plan.tome.y},${plan.tome.z}`) === "minecraft:air" && plan.tome.id, `${t.id} tent`);
      assert(plan.ops.length < 90000, `${t.id}: ${plan.ops.length} blocks`);
    }
  },
  "thin places: every cave is walkable from the mouth down to its chamber, one step at a time": () => {
    for (const t of THIN_PLACES) {
      const plan = planThinPlace(t.id, 0, 0, 64);
      const last = new Map();
      for (const o of plan.ops) last.set(`${o.x},${o.y},${o.z}`, o.block);
      let prev;
      for (const [u, fy, v, , sump] of plan.route) {
        const y = 64 + fy;
        if (sump) { assert(SITE_FEATURES[t.id][0], `${t.id}: a drowned stretch in a dry cave`); prev = fy; continue; }
        assert(last.get(`${u},${y},${v}`) === "minecraft:air" && last.get(`${u},${y + 1},${v}`) === "minecraft:air", `${t.id}: blocked at ${u},${v}`);
        assert(last.get(`${u},${y - 1},${v}`) !== "minecraft:air", `${t.id}: hole in the floor at ${u},${v}`);
        assert(prev === undefined || Math.abs(prev - fy) <= 1, `${t.id}: step too high at ${u},${v}`);
        prev = fy;
      }
      assert(Math.abs(prev - plan.chamber.F) <= 1, `${t.id}: the way in does not meet the chamber floor`);
    }
  },
  "thin places: nothing the planner builds stands in front of a cave mouth": () => {
    // on flat ground and in a gorge (high ground on both sides of a lane across the mouth): the twelve blocks
    // straight out of every mouth stay clear, two blocks high (the cave's cover once walled Frostvein Gap and the quarry)
    const SOFT = /air$|snow_layer|short_grass|fern|flower|carpet|dead_bush|rail$/;
    for (const t of THIN_PLACES) for (const gorge of [false, true]) {
      const plan = planThinPlace(t.id, 0, 0, 64, gorge ? { ground: (dx, dz) => (dz < 2 || dz > 16 ? 30 : 0) } : {});
      const last = new Map();
      for (const o of plan.ops) last.set(`${o.x},${o.y},${o.z}`, o.block);
      for (let v = MOUTH_V + 1; v <= MOUTH_V + 12; v++) for (const y of [65, 66]) {
        const b = last.get(`0,${y},${v}`);
        if (gorge && v > 16) continue; // the far wall of the gorge is the land's, not ours
        assert(b === undefined || SOFT.test(b), `${t.id}${gorge ? " (gorge)" : ""}: ${b} in front of the mouth at v ${v}, y ${y - 64}`);
      }
    }
  },
  "thin places: no two caves are the same, and the land covers every one": () => {
    const shapes = new Set(THIN_PLACES.map((t) => JSON.stringify(CAVES[t.id])));
    assert(shapes.size === 7, "two caves share a layout");
    for (const t of THIN_PLACES) {
      setHills(false); // judge the cover on its own, without the outcrop's cliffs
      let plan;
      try { plan = planThinPlace(t.id, 0, 0, 64); } finally { setHills(true); }
      const g = caveGeometry(t.id), top = new Map();
      for (const o of plan.ops) if (o.block !== "minecraft:air" && !/leaves|_log|snow_layer|grass$|fern|bush|wool|fence|lantern/.test(o.block)) { const k = `${o.x},${o.z}`; top.set(k, Math.max(top.get(k) ?? -999, o.y)); }
      for (const k of g.air) {
        const [u, y, v] = k.split(",").map(Number);
        if (v > 0) continue; // the first stretch is an open cut
        assert(Math.max(top.get(`${u},${v}`) ?? -999, 64) >= 64 + y + 2, `${t.id}: cave open to the sky at ${u},${v}`);
      }
      // a hill, not a box: beside the highest cover the land steps down no more than 3 at a time
      for (const [k, h] of top) { const [x, z] = k.split(",").map(Number); if (h < 64 + 6 || z > -2) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = top.get(`${x + a},${z + b}`); assert(n === undefined ? h <= 64 + 3 : h - n <= 4, `${t.id}: a wall of rock ${h - (n ?? 64)} high at ${x},${z}`); } }
    }
  },
  "thin places: low, wide hills, never taller than they are wide": () => {
    for (const t of THIN_PLACES) {
      let top = 0, w = 0;
      for (let u = -40; u <= 40; u++) for (let v = -50; v <= 30; v++) { const h = hillHeight(t.id, u, v); if (h > 0) { top = Math.max(top, h); w = Math.max(w, Math.abs(u)); } }
      assert(top <= 30 && top * 1.6 < w * 2, `${t.id}: ${top} tall, ${w * 2} wide`);
    }
  },
  "thin places: every facing is a proper turn, and each site faces the way the map picked": () => {
    for (const f of ["south", "north", "east", "west"]) {
      const [ax, az] = toWorld(1, 0, f), [bx, bz] = toWorld(0, 1, f);
      assert(ax * bz - az * bx === 1 && bx === FACING[f][0] && bz === FACING[f][1], f);
    }
    assert(THIN_PLACES.every((t) => FACING[t.facing]));
  },
  "the fork: five bosses open it, a dead seam dulls it for days": () => {
    assert(BOSSES_TO_OPEN === 5 && !canOpen(3) && !canOpen(4) && canOpen(5));
    assert(dullLeft(10 + FORK_DULL_DAYS, 10) === FORK_DULL_DAYS && dullLeft(12, 15) === 0 && dullLeft(undefined, 4) === 0);
  },
  "terrain is deterministic": () => assert(JSON.stringify(planChunk(2, 5)) === JSON.stringify(planChunk(2, 5))),
  "arrival ledge is solid": () => assert(heightAt(0, 0) === L.woundLedgeY),
  "path is walkable (no step over 1)": () => {
    for (let z = 41; z < 2328; z++) {
      const a = heightAt(pathX(z), z), b = heightAt(pathX(z + 1), z + 1);
      assert(Math.abs(a - b) <= 1, `step of ${Math.abs(a - b)} at z ${z}`);
    }
  },
  "open country has all four kinds of land": () => {
    const seen = new Set();
    for (let x = -680; x <= 680; x += 40) for (let z = 0; z < 2280; z += 40) if (Math.abs(x) > 200) seen.add(regionAt(x, z));
    for (const k of ["wood", "high", "fen", "waste"]) assert(seen.has(k), `no ${k} land`);
  },
  "light rivers are one boatable network": () => {
    // Every stretch of river is water at one level, unless the story path bridges over it.
    for (const [x1, z1, x2, z2] of riverSegments()) for (let t = 0; t <= 1; t += 0.1) {
      const x = Math.round(x1 + (x2 - x1) * t), z = Math.round(z1 + (z2 - z1) * t);
      const c = columnAt(x, z);
      assert(c !== null, `river over the void at ${x},${z}`);
      assert((c.under ?? c.h) <= L.seaY - 2, `river blocked at ${x},${z} (ground ${c.h})`);
    }
    // Every landing can be reached from the Wound landing.
    const segs = riverSegments(), key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
    const reached = new Set([key(RIVER_NODES[0].x, RIVER_NODES[0].z)]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const [x1, z1, x2, z2] of segs) {
        const a = key(x1, z1), b = key(x2, z2);
        if (reached.has(a) !== reached.has(b)) { reached.add(a); reached.add(b); grew = true; }
      }
    }
    for (const n of RIVER_NODES) assert(reached.has(key(n.x, n.z)) && riverDistance(n.x, n.z) < 1, `${n.id} is cut off`);
  },
  "roads are dry and gentle, and cross rivers on bridges a boat fits under": () => {
    let bridges = 0;
    for (const pts of roadLines()) {
      let last, onBridge = false;
      for (const [fx, fz] of pts) {
        const x = Math.round(fx), z = Math.round(fz), c = columnAt(x, z);
        assert(c !== null && c.h > L.seaY, `road under water or over the void at ${x},${z}`);
        if (c.river <= 3.5) {
          assert(c.under !== undefined && c.under < L.seaY, `road blocks the river at ${x},${z}`);
          assert(c.h - 1 - L.seaY >= 4, `bridge too low for a boat at ${x},${z}`);
          if (!onBridge) bridges++;
          onBridge = true;
        } else if (c.river > 12) onBridge = false;
        if (last !== undefined && !c.site) assert(Math.abs(c.h - last) <= 3, `road too steep at ${x},${z}`);
        last = c.h;
      }
    }
    assert(bridges >= 5, `only ${bridges} road bridges`);
  },
  "every road has a signpost at both ends, turned and lettered": () => {
    const posts = signposts();
    assert(posts.length === ROADS.length * 2, `${posts.length} signposts for ${ROADS.length} roads`);
    for (const r of ROADS) assert(posts.filter((p) => p.road === r.id).length === 2, `${r.id} lacks a signpost`);
    for (const p of posts) assert(Number.isInteger(p.rot) && p.rot >= 0 && p.rot < 16 && p.text.length > 0 && p.text.length < 60, `bad signpost on ${p.road}`);
    assert(signRot(0, 1) === 0 && signRot(-1, 0) === 4 && signRot(0, -1) === 8 && signRot(1, 0) === 12);
  },
  "every centre structure stays on its site": () => {
    for (const id of STRUCTURE_IDS) {
      const s = SITES.find((x) => x.id === id), ops = planStructure(id);
      assert(s && ops.length > 0, `${id} has no site or no plan`);
      for (const op of ops) for (const c of [op.a, op.b]) assert(Math.hypot(c[0] - s.x, c[2] - s.z) <= s.r + 4, `${id} builds outside its site`);
    }
  },
  "every designed site stays on its site, the Truce Hall keeps its lectern, and the stamp knows every block": () => {
    for (const [id, d] of Object.entries(SITE_DESIGNS)) {
      const s = SITES.find((x) => x.id === id);
      assert(s, `${id} has no site`);
      for (const [x, , z] of stampCells(d)) assert(Math.hypot(x, z) <= Math.max(s.r + 4, d.reach ?? 0), `${id} builds outside its site`);
      for (const t of stateTries(d)) assert(JSON.stringify(t[t.length - 1]) === "{}");
    }
    const t = SITE_DESIGNS.truce_hall;
    assert(stampCells(t).some(([x, y, z, i]) => x === 0 && y === 1 && z === 12 && t.palette[i][0] === "minecraft:lectern"), "the tome's lectern moved");
  },
  "rebuilt sites stamp again over the old look, clearing only inside their site, and keep the Carter's spot clear": () => {
    for (const [id, d] of Object.entries(SITE_DESIGNS)) {
      if (!d.v) continue;
      const s = SITES.find((x) => x.id === id);
      assert(siteOutdated({ sites: [id] }, id) && !siteOutdated({ sites: [id], siteV: { [id]: d.v } }, id), `${id} version check`);
      const full = withClearing(d), own = new Set(stampCells(d).map(([x, y, z]) => `${x},${y},${z}`));
      for (const [x, y, z, i] of stampCells(full)) {
        assert(Math.hypot(x, z) <= Math.max(s.r + 4, d.reach ?? 0), `${id} clears outside its site`);
        if (i === full.palette.length - 1 && d.clear.length) assert(y >= 1 && !own.has(`${x},${y},${z}`), `${id} clears a block it also builds`);
      }
    }
    const dock = SITE_DESIGNS.wound_dock, at = (x, y, z) => stampCells(dock).find((c) => c[0] === x && c[1] === y && c[2] === z);
    assert(at(0, 0, -4) && !at(0, 1, -4) && !at(0, 2, -4), "the Carter's place on the landing stage is blocked or has no deck");
    // the landing stage sits one block above the river: its deck over water, so a boat can come alongside
    const w = SITES.find((x) => x.id === "wound_dock");
    const stage = stampCells(dock).filter(([x, y, z]) => y === -3 && z <= -19 && Math.abs(x) <= 2);
    assert(stage.length > 0 && w.y - 3 === L.seaY + 1, "the landing stage is not one above the water");
    assert(stage.some(([x, , z]) => riverDistance(w.x + x, w.z + z) <= RIVER_HALF_WIDTH), "the landing stage does not reach the river");
  },
  "the drowned towers stand off the water and the roads, each a different design": () => {
    assert(new Set(DROWNED_SPOTS.map((t) => t.design)).size === DROWNED_SPOTS.length);
    for (const t of DROWNED_SPOTS) {
      assert(TOWER_DESIGNS[t.design], `no tower design ${t.design}`);
      assert(spotGround(t.x, t.z) === t.y, `the tower at ${t.x},${t.z} no longer fits its spot`);
    }
  },
  "village sites are flat": () => {
    for (const s of SITES) if (s.y !== undefined) for (const [dx, dz] of [[0, 0], [s.r - 2, 0], [0, 2 - s.r], [-Math.floor(s.r / 2), Math.floor(s.r / 2)]]) {
      assert(heightAt(s.x + dx, s.z + dz) === s.y, `${s.id} is not flat at ${s.x + dx},${s.z + dz}`);
    }
  },
  "pockets are outside the world and small enough to build": () => {
    for (const look of Object.values(REVEAL_LOOKS)) assert(ROOM_LOOKS[look], `no room look ${look}`);
    assert(POCKETS.length === 13 && overworldStage() === undefined);
    for (const p of POCKETS) {
      assert(p.min.x > L.reach + 200, `${p.id} is too close to the world`);
      for (const op of planPocket(p.id)) {
        const v = (Math.abs(op.b[0] - op.a[0]) + 1) * (Math.abs(op.b[1] - op.a[1]) + 1) * (Math.abs(op.b[2] - op.a[2]) + 1);
        assert(v <= 32768, `${p.id}: fill of ${v} blocks`);
        for (const k of [0, 1, 2]) for (const c of [op.a, op.b]) assert(c[k] >= [p.min.x, p.min.y, p.min.z][k] && c[k] <= [p.max.x, p.max.y, p.max.z][k], `${p.id}: fill outside its bounds`);
      }
    }
  },
  "no fill is too big": () => {
    for (let cx = -44; cx < 44; cx += 5) for (let cz = -3; cz < 154; cz += 11)
      for (const op of planChunk(cx, cz)) {
        const v = (Math.abs(op.b[0] - op.a[0]) + 1) * (Math.abs(op.b[1] - op.a[1]) + 1) * (Math.abs(op.b[2] - op.a[2]) + 1);
        assert(v <= 32768, `fill of ${v} blocks`);
      }
  },
  "slips grow, and land on the ledge": () => {
    assert(slipSeconds(0) === 10 && slipSeconds(1) === 14 && slipSeconds(99) === 30);
    for (const n of [0, 0.2, 0.49, 0.5, 0.77, 0.999]) {
      const s = slipLanding(n);
      assert(heightAt(Math.floor(s.x), Math.floor(s.z)) === L.woundLedgeY, `landing ${s.x},${s.z} is not on the ledge`);
    }
  },
  "the ore alarm spares the Warden and permit holders": () => {
    const w = { id: "w", permits: { friend: "Friend" }, tithe: 25 };
    assert(shouldAlarm("thief", w, 1000, undefined) && !shouldAlarm("w", w, 1000, undefined) && !shouldAlarm("friend", w, 1000, undefined));
    assert(!shouldAlarm("thief", w, 1000, 900), "one alarm per miner at a time");
    assert(!shouldAlarm("thief", { id: undefined, permits: {} }, 1000, undefined), "no Warden, no alarm");
  },
  "the Hollow Crown only suffers a Sorcerer": () => {
    assert(crownVerdict(true, false, 0) === "claims" && crownVerdict(true, true, 99) === "rules");
    assert(CLAIM_SECONDS >= 10, "taking the Crown must be slow enough to contest");
    assert(crownVerdict(false, false, 0) === "warned" && crownVerdict(false, false, 4) === "warned" && crownVerdict(false, false, 5) === "dies");
  },
  "a dropped Hollow Crown rests on a stand where it fell, and goes home only when truly lost": () => {
    assert(crownFate({ found: true, held: false, loaded: true, misses: 3 }) === "lying");
    assert(crownFate({ found: false, held: true, loaded: true, misses: 0 }) === "held", "picked up is not lost");
    assert(crownFate({ found: false, held: false, loaded: false, misses: 9 }) === "waiting", "out of sight is not lost");
    assert(crownFate({ found: false, held: false, loaded: true, misses: 0 }) === "missing", "one miss is not enough");
    assert(crownFate({ found: false, held: false, loaded: true, misses: KEEP.missesToLose - 1 }) === "lost");
    assert(!needsRefresh(KEEP.refreshSeconds - KEEP.checkSeconds) && needsRefresh(KEEP.refreshSeconds));
    assert(KEEP.refreshSeconds + KEEP.checkSeconds < 300, "swapped before Minecraft's 5 minute item clean-up");
    assert(standHeight({ y: 64, typeId: "minecraft:grass_block" }) > 65, "the stand floats above the ground it fell on");
    assert(standHeight({ y: 30, typeId: "minecraft:lava" }) === undefined, "over lava it goes home");
    assert(standHeight(undefined) === undefined, "over the void it goes home");
  },
  "an NPC ruler rises when no player rules, and returns after being killed": () => {
    const none = { active: false, fellOn: undefined };
    assert(!shouldRise({ choirDead: false, playerRules: false, regent: none, day: 99 }), "not while the Choir lives");
    assert(!shouldRise({ choirDead: true, choirFellOn: 10, playerRules: false, regent: none, day: 11 }) && shouldRise({ choirDead: true, choirFellOn: 10, playerRules: false, regent: none, day: 12 }));
    assert(!shouldRise({ choirDead: true, choirFellOn: 10, playerRules: true, regent: none, day: 50 }), "never over a player ruler");
    assert(!shouldRise({ choirDead: true, choirFellOn: 10, playerRules: false, regent: { active: false, fellOn: 20 }, day: 26 }) && shouldRise({ choirDead: true, choirFellOn: 10, playerRules: false, regent: { active: false, fellOn: 20 }, day: 27 }));
    assert(REGENT.permitDays > 0 && JOBS.length >= 3 && !TEMPERS.zealot.sells);
    assert(regentOutcome(true, "greedy", 0.4) === "tithe" && regentOutcome(true, "fair", 0.4) === "ore" && regentOutcome(false, "greedy", 0.01) === "ore");
  },
  "the tithe and the offline yield": () => {
    const w = { id: "w", permits: { friend: "Friend" }, tithe: 25 };
    assert(oreOutcome(w, "friend", true, 0.1) === "tithe" && oreOutcome(w, "friend", true, 0.9) === "ore");
    assert(oreOutcome(w, "thief", false, 0.9) === "nothing" && oreOutcome(w, "thief", false, 0.1) === "nothing" && oreOutcome(w, "thief", true, 0.9) === "ore");
    assert(oreOutcome(w, "w", false, 0.99) === "ore" && WARDEN.offlineYield === 0);
  },
  "ore is in the cliffs, more of it deeper in": () => {
    assert(oreChance(0) === 0 && oreChance(2000) > oreChance(200));
    let n = 0;
    for (let cx = -10; cx < 10; cx++) for (let cz = 30; cz < 60; cz++) n += planChunk(cx, cz).filter((o) => o.block === "siege:choir_ore").length;
    assert(n > 20 && n < 2000, `${n} ore in 600 chunks`);
  },
  "seven singers stand on the ring": () => {
    for (let i = 0; i < 7; i++) {
      const s = singerSpot(i), r = Math.hypot(s.x - 0.5 - COURT.center.x, s.z - 0.5 - COURT.center.z);
      assert(r > HEART.innerRadius + 4 && r < CHOIR.fallBands[1], `singer ${i} at radius ${r}`);
    }
  },
  "the rift tears from the floor up, then outward, in every burst": () => {
    const cells = planCrack({ x: 0, y: 0, z: 0 }, "east");
    const line = cells.filter((c) => !c.side);
    for (const a of line) for (const b of line) if (a.row < b.row) assert(tearBand(a) <= tearBand(b), `row ${a.row} after row ${b.row}`);
    assert(cells.filter((c) => c.side).every((c) => tearBand(c) >= TEAR_CLIMB), "it widens only after the split reaches the top");
    for (let s = 0; s <= TEAR_STEPS; s++) assert(cells.some((c) => tearBand(c) === s), `burst ${s} is empty`);
  },
  "a deep crack: full height, veil sheets with air between, black behind, and it still tears floor to top": () => {
    for (const H of [7, 12, 26]) {
      const cells = planCrack({ x: 0, y: 0, z: 0 }, "south", { height: H, deep: true });
      const veil = cells.filter((c) => c.block === VEIL);
      assert(Math.min(...veil.map((c) => c.y)) === 0 && Math.max(...cells.filter((c) => c.block === "minecraft:air" && c.depth === 0).map((c) => c.y)) === H - 1, `height ${H}`);
      assert(veil.every((c) => c.depth % 2 === 1) && Math.max(...veil.map((c) => c.depth)) >= Math.min(CRACK_DEPTH - 2, H - 1), "sheets of veil every other block, far back");
      assert(cells.some((c) => c.block === "minecraft:black_concrete") && cells.filter((c) => c.depth === 0 && c.block !== "minecraft:air").every((c) => c.block === "siege:rift_edge"), "rim at the face, black behind");
      assert(new Set(cells.map((c) => `${c.x},${c.y},${c.z}`)).size === cells.length, "a cell placed twice");
      for (let s2 = 0; s2 <= TEAR_STEPS; s2++) assert(cells.some((c) => tearBand(c, H) === s2), `height ${H}: burst ${s2} is empty`);
    }
  },
  "the opening takes 40 seconds and the tear waits for the hush": () => {
    assert(OPENING.done === 40 && OPENING.answer < OPENING.stir && OPENING.stir < OPENING.hush && OPENING.hush < OPENING.tear && OPENING.tear < OPENING.widen && OPENING.widen < OPENING.breath && OPENING.breath < OPENING.look && OPENING.look < OPENING.done);
  },
  "the seep: nothing for a week, the agreed reach at days 14, 21 and 28, then it never stops": () => {
    assert(reachOn(0) === 0 && reachOn(6) === 0 && reachOn(14) === 16 && reachOn(21) === 30 && reachOn(28) === 48);
    for (let d = 28; d < 200; d++) assert(reachOn(d + 1) > reachOn(d), `stalls on day ${d}`);
  },
  "the seep: veins are connected, reach out from the mouth, and growing never moves them": () => {
    for (const f of ["south", "north", "east", "west"]) {
      const near = planVeins(mouthSeeds(f), 48, 601), far = planVeins(mouthSeeds(f), 128, 601);
      for (const [k, d] of near) if (d <= 48) assert(far.get(k) === d, `${f}: a vein moved when the seep grew`);
      // connected: every cell touches another cell that is nearer the source (or is at the source)
      for (const [k, d] of near) {
        if (d <= 1) continue;
        const [x, z] = k.split(",").map(Number);
        let ok = false;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const n = near.get(`${x + a},${z + b}`); if ((a || b) && n !== undefined && n <= d) ok = true; }
        assert(ok, `${f}: a loose patch at ${k}`);
      }
      // veins, not a blanket: well under a third of the ground inside the reach is taken
      const [fx, fz] = FACING[f];
      const inReach = [...near].filter(([, d]) => d <= 48).map(([k]) => k.split(",").map(Number));
      const ahead = inReach.filter(([x, z]) => x * fx + z * fz > 4).length;
      assert(inReach.length < 48 * 48 * 3.14 * 0.3 && ahead > inReach.length * 0.5, `${f}: ${inReach.length} cells, ${ahead} ahead of the mouth`);
    }
    assert(planVeins(mouthSeeds("south"), MAX_REACH, 601).size < 400000, "the full plan is small enough to hold");
  },
  "the seep: takes wild ground and wild buildings, never what people use, never held ground": () => {
    assert(takesMoss("minecraft:grass_block") && takesMoss("minecraft:snow") && !takesMoss("minecraft:oak_planks") && !takesMoss("siege:undertow_moss"));
    assert(hollowOf("minecraft:stone_bricks").includes("veinstone") && hollowOf("minecraft:oak_planks") === "siege:pale_ash" && hollowOf("minecraft:spruce_log") === "minecraft:dark_oak_log");
    assert(hollowOf("minecraft:glass_pane") === "minecraft:air" && hollowOf("minecraft:lantern") === "minecraft:soul_lantern");
    for (const keep of ["minecraft:chest", "minecraft:oak_door", "minecraft:bell", "siege:regal_safe", "minecraft:dark_oak_log", "minecraft:grass_block"]) assert(hollowOf(keep) === undefined, keep);
    assert(heldGround(-150, -150, []) && !heldGround(115, 510, []), "Kingsrest is held; a thin place is not");
    assert(heldGround(2000, 2000, [{ x: 2000, y: 70, z: 2000 }]) && !heldGround(2000, 2000, []), "a held plot is held");
  },
  "turning a player back at the veil never throws": () => {
    // everything refuse() names must be imported (it once called getRift without importing it)
    let pushed = 0, told = 0;
    refuse({ id: "veil-test", name: "t", dimension: { id: "minecraft:overworld" }, location: { x: 0, y: 64, z: 0 }, getDynamicProperty: () => undefined, setDynamicProperty: () => {}, hasTag: () => false, getTags: () => [], applyKnockback: () => { pushed++; }, playSound: () => {}, sendMessage: () => { told++; }, onScreenDisplay: { setActionBar: () => { told++; } } });
    assert(pushed === 1 && told >= 1, `pushed ${pushed}, told ${told}`);
  },
  "the veil only takes players who beat all five bosses themselves": () => {
    assert(!mayCrossWith(0, false) && !mayCrossWith(4, false) && mayCrossWith(5, false) && mayCrossWith(0, true));
    assert(refusalLine(0, 3, 5).includes("Three of five") && refusalLine(0, 3, 5) !== refusalLine(1, 3, 5) && REFUSALS.length >= 4);
  },
  "rift crack is 14 tall": () => {
    const ys = planCrack({ x: 0, y: 0, z: 0 }, "south").filter((c) => c.block === VEIL).map((c) => c.y);
    assert(Math.min(...ys) === 0 && Math.max(...ys) === 13);
  },
});

// The roof, the ground, the light and the trees (Mateo, 2026-11-11: darker, no sun, boxed in; the roof
// and the ground not one flat solid block; the tree update in the Hollow too).
addTests("undertow", {
  "the roof covers the land everywhere, 30 or more blocks up, under its unbreakable shell": () => {
    for (let x = -680; x <= 680; x += 85) for (let z = -40; z <= 2440; z += 155) {
      const h = heightAt(x, z), r = roofAt(x, z);
      assert(r.bottom <= ROOF.maxBottom && r.bottom < ROOF.shell, `roof at ${x},${z} reaches the shell`);
      if (h !== null) assert(r.bottom - h >= 28, `roof only ${r.bottom - h} over the land at ${x},${z}`);
    }
    assert(roofAt(0, 2400).bottom >= HEART.center.y + 25, "room over the Choir's Heart");
  },
  "the roof is never flat: domes, sags and mixed rock": () => {
    const ys = new Set(), rock = new Set();
    for (let x = 200; x < 400; x += 2) { const r = roofAt(x, 600); ys.add(r.bottom); rock.add(r.block); }
    assert(ys.size >= 12, `only ${ys.size} roof heights`);
    assert(rock.size >= 4, `only ${rock.size} kinds of roof rock`);
  },
  "the ground mixes several blocks in every kind of land": () => {
    for (const kind of Object.keys(GROUND)) {
      const n = new Map();
      for (let x = 0; x < 120; x += 3) for (let z = 0; z < 120; z += 3) { const b = groundAt(x + 1000, z + 300, kind); n.set(b, (n.get(b) ?? 0) + 1); }
      const top = Math.max(...n.values()), all = [...n.values()].reduce((a, b) => a + b, 0);
      assert(n.size >= 4 && top / all < 0.7, `${kind}: ${n.size} blocks, the commonest is ${Math.round((100 * top) / all)}%`);
    }
  },
  "a faint light is never more than 3 blocks away across the land": () => {
    for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) {
      let best = 99;
      for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (ambientLightAt(x + a, z + b)) best = Math.min(best, Math.abs(a) + Math.abs(b));
      assert(best <= 3, `${best} from a light at ${x},${z}`);
    }
    assert(/^minecraft:light_block_\d+$/.test(AMBIENT.block));
  },
  "the Hollow's trees: three species, every shape stands on its trunk, all from the tree blocks": () => {
    assert(Object.keys(HOLLOW_TREES).length === 3);
    for (const [sid, sizes] of Object.entries(HOLLOW_TREES)) for (const [size, list] of Object.entries(sizes)) for (const t of list) {
      const trunk = new Set();
      for (const [x, z, y0, y1] of t.runs) if (x === 0 && z === 0) for (let y = y0; y <= y1; y++) trunk.add(y);
      assert(trunk.has(1) && trunk.has(2) && trunk.has(3), `${sid} ${size}: no trunk`);
      assert(t.palette.every(([id]) => /^(siege|minecraft):/.test(id) && !id.includes("structure_void")), `${sid} ${size}: odd block`);
      assert(t.runs.every((r) => r[4] < t.palette.length && r[2] >= 0 && r[3] >= r[2]));
    }
    const seen = new Set();
    for (let i = 0; i < 200; i++) { const p = pickTree(treeKind(0, 0, "wood"), (i + 0.5) / 200); seen.add(p.species); assert(HOLLOW_TREES[p.species][p.size][p.variant]); }
    assert(seen.size === 2, "groves mix Latticewood and Veilmoss Trees");
    assert(treeKind(330, 250, "wood") === "forest" && treeKind(0, 1200, "bells") === "waste");
  },
  "clearing an old chunk stays under the fill limit and reaches the roof": () => {
    const ops = clearOps(3, 7, 50);
    for (const op of ops) assert((op.b[0] - op.a[0] + 1) * (op.b[1] - op.a[1] + 1) * (op.b[2] - op.a[2] + 1) <= 32768);
    assert(ops[0].a[1] === 50 && ops[1].b[1] === ROOF.top);
  },
});

