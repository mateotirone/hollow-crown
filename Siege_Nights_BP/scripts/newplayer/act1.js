// Act 1, "The Counted Nights", in the world (story-and-gameplay pass, Mateo 2026-11-14). The rules (which stage a
// player is on and the tracker's line for it) are in act1_rules.js; this file gathers the facts for them and makes
// the moments happen:
//   - Old Elspeth sits by the hearth in every hall (lore/places.js puts her there); her scene opens on your stage
//     (lore condition "act1:<stage>"), and she hands over the starting purse when you first meet her.
//   - The first siege waits on the first siege day until you are inside your walls and have sat down to supper
//     with her, or until midnight ("holdSiege"). If you are away at dusk a raven loops back toward home.
//   - The night you ride home from Sister Wren the Ember comes down just outside your gate, beside the road, in a
//     ring of scorched ground that stays. The Ember lies there glowing until you pick it up.
//   - A light pillar, seen only by you, stands over the story places (Millbrook while Wren is your step, the Ember).
//   - Sir Aldous rides in the morning after Elspeth reads the Ember (lore/places.js, "elspethEmber").
//
// Builder commands (creative / operators):
//   /scriptevent siege:act1           your Act 1 stage, its facts and the tracker's line
//   /scriptevent siege:act1 ember     bring the Ember down outside your gate now

import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { on, emit, addFilter } from "../core/events.js";
import { onTick, moduleStore, keepOf, keepCenter, homeOf, nextSiegeDay, getState, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode } from "../plots/api.js";
import { plotOf } from "../plots/claims.js";
import { progressOf } from "../lore/player.js";
import { addLoreContext } from "../lore/npcs.js";
import { elspethSpot, aldousAt } from "../lore/places.js";
import { heroOf, saveHero } from "../townhall/hero.js";
import { EMBER } from "../townhall/tree.js";
import { wallRing } from "../settle/walls.js";
import { RAVEN, yawToward } from "../bestiary/ravens.js";
import { WREN_ALTAR } from "../opening/millbrook.js";
import { allSites } from "../trains/station_sites.js";
import { stationById, hasFound } from "../rails/index.js";
import { STAGE_NAMES } from "../trains/stations.js";
import { farmerFacts, FARMER_TAG } from "../economy/hamlet.js";
import { givePurse } from "../starter/index.js";
import { firstFacts } from "./firstnights.js";
import { founderChest } from "./founder.js";
import { yardWorkshop } from "./workshop.js";
import { act1Stage, act1Step, inAct1, F, DUSK, MIDNIGHT, PILLAR } from "./act1_rules.js";

const OVERWORLD = "minecraft:overworld";
const FALLEN_EMBER = "siege:fallen_ember";
const CHEST_OPENED = "hc:act1_chest", WORKSHOP_OPENED = "hc:act1_workshop", BAKED = "hc:act1_bread", RAVEN_TOLD = "hc:act1_raven_day";
// raided / lost: settlement owner -> true. ember: owner -> where it lies (the scorch stays when it is picked up)
const store = moduleStore("hc:act1", () => ({ raided: {}, lost: {}, ember: {} }));

// The night: the Ember only comes down after dark, and never while a siege is on
const NIGHT_FROM = 13000, NIGHT_TO = 23000;
// The stages on the first siege day before supper: the siege waits on these (or on midnight)
export const HOLD = new Set(["talk_sundown", "home", "raven", "talk_supper"]);
export const holdsSiege = (stages, time) => time < MIDNIGHT && stages.some((s) => HOLD.has(s));

// ---------- facts ----------

const homeId = (player) => { try { return homeOf(player.id) ?? player.id; } catch { return player.id; } };

function carries(player, id) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it?.typeId === id) n += it.amount; }
  return n;
}

// Inside your own walls (or, with no wall yet, close by your banner)
export function insideRing(pos, ring, keepAt) {
  if (ring) return Math.hypot(pos.x - ring.x, pos.z - ring.z) <= ring.radius - 1;
  return !!keepAt && Math.hypot(pos.x - keepAt.x, pos.z - keepAt.z) <= 20;
}

function stationOf(player) {
  const site = allSites().find((s) => s.owner === player.id);
  const st = site && stationById(site.id);
  if (!st) return undefined;
  return { name: `${st.name} ${STAGE_NAMES[site.built ?? site.stage] ?? "Halt"}`, x: st.x, z: st.z, found: hasFound(player, st.id) };
}

function emberState(player) {
  const e = heroOf(player).ember;
  if (e === "taken" || e === "refused") return "held";
  if (e === "fallen") return carries(player, EMBER) > 0 ? "held" : "fallen";
  return "none";
}

// Everything act1Stage and act1Step need, and the places the tracker points at
export function act1Facts(player) {
  const p = progressOf(player);
  const home = homeId(player);
  const keep = keepOf(home);
  const raided = !!store.data.raided[home];
  const f = {
    flags: p.flags, morvane: p.flags.includes("morvane_fallen"), keep: !!keep,
    sieges: Math.max(keep?.sieges ?? 0, raided ? 1 : 0), lost: !keep && !!store.data.lost[home],
    chest: player.getDynamicProperty(CHEST_OPENED) === true, workshop: player.getDynamicProperty(WORKSHOP_OPENED) === true,
    bread: player.getDynamicProperty(BAKED) === true, time: world.getTimeOfDay(),
  };
  if (!inAct1(f)) return { f };
  const chestAt = founderChest(home);
  if (!chestAt) f.chest = true; // no founder's chest on this settlement: nothing to open
  try { f.first = firstFacts(player); } catch { /* not ready */ }
  let farmer;
  try { farmer = farmerFacts(player); } catch { /* not ready */ }
  f.sold = farmer?.sold ?? 0;
  try { f.station = stationOf(player); } catch { /* no rails */ }
  const keepAt = keep ? keepCenter(keep) : undefined;
  let ring;
  try { ring = wallRing(home); } catch { /* no wall */ }
  f.home = player.dimension.id === OVERWORLD && insideRing(player.location, ring, keepAt);
  try { f.siegeDay = !!keep && f.sieges === 0 && world.getDay() === nextSiegeDay(); } catch { f.siegeDay = false; }
  f.ember = emberState(player);
  const aldous = aldousAt(home);
  f.aldousHere = !!aldous;
  let stone;
  try { stone = plotOf(player.id); } catch { /* no plots */ }
  const places = {
    hearth: elspethSpot(home), stone: stone ? { x: stone.x, z: stone.z } : undefined, chest: chestAt,
    workshop: yardWorkshop(home), farmer: farmer?.at, farmerTag: farmer?.tag ?? `${FARMER_TAG}_${player.id}`,
    station: f.station, keep: keepAt ?? (ring ? { x: ring.x, z: ring.z } : undefined),
    millbrook: WREN_ALTAR, ember: store.data.ember[home], aldous,
  };
  return { f, places, ring, home };
}

// The player's stage and tracker line, worked out at most once every STAGE_EVERY ticks
const STAGE_EVERY = 40;
const cache = new Map(); // player id -> { at, stage, step, f, places, ring, home }
export function act1Of(player, fresh = false) {
  const now = system.currentTick;
  const had = cache.get(player.id);
  if (!fresh && had && now - had.at < STAGE_EVERY) return had;
  let out = { at: now };
  try {
    const facts = act1Facts(player);
    const stage = act1Stage(facts.f);
    out = { at: now, ...facts, stage, on: stage !== undefined, step: stage ? act1Step(stage, facts.f, facts.places ?? {}) : undefined };
  } catch (e) { console.warn(`[Act 1] ${player.name}: ${e}`); }
  cache.set(player.id, out);
  return out;
}
const forget = (player) => { if (player?.id) cache.delete(player.id); };
for (const name of ["loreFlag", "keepFounded", "keepFallen", "siegeEnd", "goodsSold", "emberFell"]) on(name, (d) => forget(d?.player));
world.afterEvents.playerLeave.subscribe(({ playerId }) => cache.delete(playerId));

// For the quest tracker (quests/index.js): { on, step } — on while Act 1 is this player's story
export const act1Quest = (player) => { const a = act1Of(player); return { on: !!a.on, step: a.step }; };

// Elspeth's scene and Wren's opening read the stage; "raided" is false only before your first raid
addLoreContext((player) => {
  const a = act1Of(player);
  if (!a.f) return {};
  return { act1: a.stage, raided: !inAct1(a.f) || (a.f.sieges ?? 0) > 0 || !!a.f.lost };
});

// ---------- what Elspeth hands over, what the player does ----------

on("elspethPurse", ({ player }) => { try { givePurse(player); } catch (e) { console.warn(`[Act 1] purse: ${e}`); } });

// The starting purse: on a map, Elspeth gives it when you first meet her (starter/index.js asks)
addFilter("joinPurse", (give, { player }) => {
  if (!give) return give;
  try { return !(mapMode() && act1Of(player, true).on); } catch { return give; }
});
// The Ember is the story's, for Act 1 players: it falls at the gate after Wren, not after a siege win
addFilter("emberByStory", (story, { player }) => story || (() => { try { return !!act1Of(player, true).on; } catch { return false; } })());
// Sir Aldous comes after Elspeth reads the Ember, not after the first win
addFilter("aldousByStory", (story, { player }) => story || (() => { try { return !!act1Of(player, true).on || progressOf(player).flags.includes(F.met); } catch { return false; } })());

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  try {
    if (block.typeId === "siege:workshop" && player.getDynamicProperty(WORKSHOP_OPENED) !== true) {
      player.setDynamicProperty(WORKSHOP_OPENED, true);
      forget(player);
    } else if (block.typeId === "minecraft:chest" && player.getDynamicProperty(CHEST_OPENED) !== true) {
      const at = founderChest(homeId(player));
      if (at && at.x === block.location.x && at.y === block.location.y && at.z === block.location.z) { player.setDynamicProperty(CHEST_OPENED, true); forget(player); }
    } else if (block.typeId === FALLEN_EMBER) {
      pickUpEmber(player, block);
    }
  } catch (e) { console.warn(`[Act 1] click: ${e}`); }
});

// Bread: Minecraft says nothing when something is crafted, so while "Bake bread" is the step, wheat going down
// while bread goes up counts as a loaf baked
const pantry = new Map(); // player id -> { wheat, bread }
function watchBread(player) {
  const now = { wheat: carries(player, "minecraft:wheat"), bread: carries(player, "minecraft:bread") };
  const was = pantry.get(player.id);
  pantry.set(player.id, now);
  if (was && now.bread > was.bread && now.wheat < was.wheat) { player.setDynamicProperty(BAKED, true); forget(player); }
}

// ---------- the first raid ----------

// No countdown to a raid nobody has warned you of: the keep menu says nothing about the next siege until the
// first one has come
addFilter("nextSiegeLine", (line, { owner, keep }) => ((keep?.sieges ?? 0) === 0 && !store.data.raided[owner] ? "" : line));

on("siegeEnd", ({ outcome, besieged }) => {
  if (outcome === "empty") return;
  for (const owner of besieged ?? []) store.data.raided[owner] = true;
  store.save();
  cache.clear();
});
on("keepFallen", ({ owner }) => {
  store.data.raided[owner] = true;
  store.data.lost[owner] = true;
  store.save();
  cache.clear();
});
on("keepFounded", ({ player }) => {
  if (!player || !store.data.lost[player.id]) return;
  delete store.data.lost[player.id];
  store.save();
});

// The first siege waits for you to be home and at supper (or for midnight)
addFilter("holdSiege", (hold) => {
  if (hold) return hold;
  const time = world.getTimeOfDay();
  if (time >= MIDNIGHT) return false;
  return holdsSiege(world.getAllPlayers().map((p) => act1Of(p).stage), time);
});

// Away at dusk: a raven loops back toward home, ahead of you
const ravenTag = (id) => `hc_act1_raven_${id}`;
function guideRaven(player, a, tick) {
  const home = a.places?.keep;
  const dim = player.dimension;
  let bird;
  try { bird = dim.getEntities({ type: RAVEN, tags: [ravenTag(player.id)] }); } catch { return; }
  if (a.stage !== "raven" || !home || dim.id !== OVERWORLD) {
    for (const b of bird) { try { b.remove(); } catch { /* gone */ } }
    return;
  }
  const l = player.location;
  const d = Math.hypot(home.x - l.x, home.z - l.z) || 1;
  const ux = (home.x - l.x) / d, uz = (home.z - l.z) / d;
  const t = tick * 0.12;
  const c = { x: l.x + ux * 9, z: l.z + uz * 9 };
  const at = { x: c.x + Math.cos(t) * 3, y: l.y + 5 + Math.sin(t * 2) * 0.6, z: c.z + Math.sin(t) * 3 };
  const ahead = { x: c.x + Math.cos(t + 0.3) * 3, z: c.z + Math.sin(t + 0.3) * 3 };
  try {
    if (!bird[0]) {
      const b = dim.spawnEntity(RAVEN, at);
      b.addTag(ravenTag(player.id));
      bird = [b];
    }
    for (const extra of bird.slice(1)) extra.remove();
    bird[0].teleport(at, { rotation: { x: 0, y: yawToward(at, ahead) } });
  } catch { /* not loaded */ }
  const day = world.getDay();
  if (player.getDynamicProperty(RAVEN_TOLD) !== day) {
    player.setDynamicProperty(RAVEN_TOLD, day);
    player.sendMessage("§7§oThat bird keeps looping back. It wants me home.");
  }
}

// ---------- the Ember, outside the gate ----------

const SOFT = /(air|short_grass|tall_grass|fern|flower|dandelion|poppy|bush|snow_layer|sapling|tallgrass|leaf_litter|pink_petals)/;
const SCORCH = ["minecraft:coarse_dirt", "minecraft:coarse_dirt", "minecraft:blackstone", "minecraft:tuff"];
const SCORCHABLE = /(grass_block|dirt|podzol|mycelium|sand|gravel|snow|mud|moss_block|clay|stone$|terracotta)/;
const NOT_SCORCHED = /(path|planks|slab|stairs|log|wood|brick|cobble|fence|wall|bell|chest|rail)/;

// Pure: where the Ember lands: six out from the gate and six to the side of the road, so it is beside the road
// you ride in on, not on it. ring = wallRing(); returns { x, z }
export function emberSpot(ring) {
  const g = ring.gate;
  const a = Math.atan2(g.z - ring.z, g.x - ring.x);
  return { x: Math.round(g.x + Math.cos(a) * 6 - Math.sin(a) * 6), z: Math.round(g.z + Math.sin(a) * 6 + Math.cos(a) * 6) };
}
// Pure: the scorch, a rough ring of 7 by 7 with its corners off, each cell's block picked from its place
export function scorchCells() {
  const cells = [];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    if (dx * dx + dz * dz > 11) continue;
    const pick = Math.abs((dx * 73856093) ^ (dz * 19349663)) % SCORCH.length;
    cells.push({ dx, dz, id: dx === 0 && dz === 0 ? "minecraft:blackstone" : SCORCH[pick] });
  }
  return cells;
}

function groundAt(dim, x, z) {
  let b = dim.getTopmostBlock({ x, z });
  for (let i = 0; b && i < 12 && SOFT.test(b.typeId); i++) b = b.below();
  return b;
}

function dropAtGate(player, a) {
  const dim = world.getDimension(OVERWORLD);
  const ring = a.ring;
  let spot;
  if (ring?.gate) spot = emberSpot(ring);
  else if (a.places?.keep) spot = { x: Math.round(a.places.keep.x) + 12, z: Math.round(a.places.keep.z) };
  if (!spot) return false;
  const ground = groundAt(dim, spot.x, spot.z);
  if (!ground) return false; // not loaded
  const y = ground.location.y;
  for (const c of scorchCells()) {
    try {
      const top = groundAt(dim, spot.x + c.dx, spot.z + c.dz);
      if (!top || Math.abs(top.location.y - y) > 2 || NOT_SCORCHED.test(top.typeId) || !SCORCHABLE.test(top.typeId)) continue;
      const above = top.above();
      if (above && SOFT.test(above.typeId) && !above.isAir) above.setType("minecraft:air");
      top.setPermutation(BlockPermutation.resolve(c.id));
    } catch { /* that column isn't loaded */ }
  }
  const at = { x: spot.x, y: y + 1, z: spot.z };
  try { dim.spawnEntity("minecraft:lightning_bolt", { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }); } catch { /* no lightning: it still falls */ }
  system.runTimeout(() => {
    try {
      const b = dim.getBlock(at);
      if (b && (b.isAir || SOFT.test(b.typeId) || b.typeId === "minecraft:fire")) b.setPermutation(BlockPermutation.resolve(FALLEN_EMBER));
    } catch { /* not loaded */ }
  }, 10);
  store.data.ember[a.home ?? player.id] = at;
  store.save();
  const hero = heroOf(player);
  hero.ember = "fallen";
  saveHero(player);
  player.sendMessage("§7§oSomething came down by the gate. It's still glowing.");
  emit("emberFell", { player, location: at });
  return true;
}

function pickUpEmber(player, block) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const left = inv ? inv.addItem(new ItemStack(EMBER, 1)) : new ItemStack(EMBER, 1);
  if (left) player.dimension.spawnItem(left, player.location);
  block.setType("minecraft:air");
  const hero = heroOf(player);
  if (hero.ember === "none") { hero.ember = "fallen"; saveHero(player); }
  player.sendMessage("§7You pick it up. It is warm, and it doesn't stop glowing.");
  forget(player);
}

// ---------- the loop ----------

function pillar(player, target) {
  if (!target || player.dimension.id !== OVERWORLD) return;
  const l = player.location;
  if (Math.hypot(target.x - l.x, target.z - l.z) > 192) return;
  const base = target.y ?? l.y - 8;
  for (let h = 0; h <= 60; h += 3) {
    try { player.spawnParticle("minecraft:end_rod", { x: target.x + 0.5, y: base + h, z: target.z + 0.5 }); } catch { /* not loaded */ }
  }
}

let tick = 0;
const flying = new Set(); // players with a raven out
onTick("act1", 4, () => {
  tick++;
  for (const player of world.getAllPlayers()) {
    try {
      const a = act1Of(player);
      if (a.stage === "raven" || flying.has(player.id)) {
        guideRaven(player, a, tick);
        if (a.stage === "raven") flying.add(player.id); else flying.delete(player.id);
      }
      if (!a.on) continue;
      if (tick % 5) continue; // the rest every 20 ticks
      if (PILLAR.has(a.stage)) {
        const t = a.stage === "find_ember" ? a.places?.ember : { ...WREN_ALTAR, y: WREN_ALTAR.y - 1 };
        pillar(player, t);
      }
      if (a.stage === "bread") watchBread(player);
      const time = world.getTimeOfDay();
      if (a.stage === "ride_home" && a.f.home && time >= NIGHT_FROM && time < NIGHT_TO && !getState().active && tick % 10 === 0) {
        if (dropAtGate(player, a)) forget(player);
      }
    } catch (e) { console.warn(`[Act 1] ${e}`); }
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:act1" || player?.typeId !== "minecraft:player") return;
  const a = act1Of(player, true);
  if (message.trim() === "ember") {
    const ok = a.f ? dropAtGate(player, a) : false;
    return player.sendMessage(ok ? "§6The Ember came down outside your gate." : "§cNo gate or keep loaded to bring it down by.");
  }
  if (!a.on) return player.sendMessage("§7Act 1 is not your story now (you have met Sir Aldous, or this keep held sieges before Act 1).");
  const f = a.f;
  player.sendMessage(`§6Act 1 stage:§f ${a.stage}\n§7keep ${f.keep} sieges ${f.sieges} lost ${f.lost} chest ${f.chest} workshop ${f.workshop} sold ${f.sold} bread ${f.bread} siegeDay ${f.siegeDay} home ${f.home} ember ${f.ember}`);
  if (a.step) player.sendMessage(`§6${a.step.title}§7 ${a.step.hint}`);
});

addTests("act1", {
  "Act 1: the founding days, in order, every step from someone": () => {
    const base = { flags: [], keep: false, sieges: 0, time: 1000 };
    assertEqual(act1Stage(base), "meet");
    const met = { ...base, flags: [F.met] };
    assertEqual(act1Stage(met), "banner");
    const up = { ...met, keep: true };
    assertEqual(act1Stage(up), "chest");
    assertEqual(act1Stage({ ...up, chest: true }), "talk_workshop");
    const ws = { ...up, chest: true, flags: [F.met, F.workshop] };
    assertEqual(act1Stage(ws), "workshop");
    assertEqual(act1Stage({ ...ws, workshop: true }), "talk_barracks");
    const bk = { ...ws, workshop: true, flags: [...ws.flags, F.barracks] };
    assertEqual(act1Stage(bk), "barracks");
    assertEqual(act1Stage({ ...bk, first: { barracks: true } }), "guards");
    const wh = { ...bk, first: { barracks: true, guards: 2 } };
    assertEqual(act1Stage(wh), "talk_wheat");
    const sell = { ...wh, flags: [...wh.flags, F.wheat] };
    assertEqual(act1Stage({ ...sell, sold: 3 }), "sell");
    assertEqual(act1Stage({ ...sell, sold: 16 }), "bread");
    const st = { ...sell, sold: 16, bread: true };
    assertEqual(act1Stage(st), "talk_station");
    const st2 = { ...st, flags: [...st.flags, F.station] };
    assertEqual(act1Stage({ ...st2, station: { found: false } }), "station");
    assertEqual(act1Stage({ ...st2, station: { found: true } }), "rest");
    for (const s of ["meet", "banner", "chest", "talk_workshop", "workshop", "talk_barracks", "talk_wheat", "sell", "bread", "talk_station", "station"]) {
      const step = act1Step(s, { flags: [] }, { hearth: { x: 1, z: 2 }, stone: { x: 3, z: 4 }, chest: { x: 5, z: 6 }, workshop: { x: 7, z: 8 }, farmer: { x: 9, z: 9 }, station: { x: 1, z: 1 } });
      assert(step?.title && step.hint, `${s} has a line`);
      if (s !== "bread") assert(step.target, `${s} pins a place (the minimap always shows where to go)`);
    }
  },
  "Act 1: the first siege day: home by sundown, the raven, supper, then the raid": () => {
    const day = { flags: [F.met], keep: true, sieges: 0, siegeDay: true };
    assertEqual(act1Stage({ ...day, time: 3000 }), "talk_sundown");
    assertEqual(act1Stage({ ...day, flags: [F.met, F.sundown], time: 3000 }), "home");
    assertEqual(act1Stage({ ...day, time: DUSK + 10, home: false }), "raven");
    assertEqual(act1Stage({ ...day, time: DUSK + 10, home: true }), "talk_supper");
    assertEqual(act1Stage({ ...day, flags: [F.met, F.ravens], time: DUSK + 10, home: true }), "defend");
    assert(holdsSiege(["talk_supper"], 14000) && holdsSiege(["raven", undefined], 17000), "the raid waits for supper");
    assert(!holdsSiege(["defend"], 14000) && !holdsSiege(["raven"], MIDNIGHT), "not once you're at the wall, nor past midnight");
    const step = act1Step("raven", {}, { keep: { x: 0, z: 0 } });
    assert(/raven/i.test(step.title) && step.target, "the raven step points home");
  },
  "Act 1: after the raid: Elspeth, the banner, Wren, home, the Ember, Aldous": () => {
    const won = { flags: [F.met], keep: true, sieges: 1 };
    assertEqual(act1Stage(won), "talk_raid_won");
    assertEqual(act1Stage({ ...won, keep: false, lost: true }), "talk_raid_lost");
    const told = { ...won, flags: [F.met, F.raid] };
    assertEqual(act1Stage({ ...told, keep: false, lost: true }), "rebanner");
    assertEqual(act1Stage(told), "wren");
    const lead = { ...told, flags: [...told.flags, F.wrenLead] };
    assertEqual(act1Stage({ ...lead, ember: "none" }), "ride_home");
    assertEqual(act1Stage({ ...lead, ember: "fallen" }), "find_ember");
    assertEqual(act1Stage({ ...lead, ember: "held" }), "ask_ember");
    const read = { ...lead, ember: "held", flags: [...lead.flags, F.ember] };
    assertEqual(act1Stage(read), "sleep");
    assertEqual(act1Stage({ ...read, aldousHere: true }), "aldous");
    assertEqual(act1Stage({ ...read, flags: [...read.flags, F.aldous] }), undefined, "Act 1 ends with Sir Aldous");
    assertEqual(act1Stage({ flags: [], keep: true, sieges: 4 }), undefined, "a keep from before Act 1 keeps its old story");
  },
  "Act 1: the tracker never warns of a raid before the ravens": () => {
    const said = ["meet", "banner", "chest", "talk_workshop", "workshop", "talk_barracks", "barracks", "guards", "talk_wheat", "sell", "bread", "talk_station", "station", "talk_sundown", "home", "raven", "talk_supper"]
      .map((s) => act1Step(s, { flags: [], first: s === "guards" ? { barracks: true, days: 1 } : { days: 1 } }, {})).filter(Boolean).map((s) => `${s.title} ${s.hint} ${s.note ?? ""}`).join(" ");
    assert(!/raid|siege|attack|third night/i.test(said), "no raid foreknowledge");
  },
  "the Ember lands beside the road outside the gate, in a 7 by 7 scorch": () => {
    const ring = { x: 0, z: 0, radius: 20, gate: { x: 0, z: 19 } };
    const s = emberSpot(ring);
    assert(s.z > 19 && Math.abs(s.x) >= 5, `outside the gate and off the road: ${JSON.stringify(s)}`);
    const cells = scorchCells();
    assert(cells.length >= 37 && cells.length <= 49 && cells.every((c) => Math.abs(c.dx) <= 3 && Math.abs(c.dz) <= 3), `${cells.length} cells`);
    assert(insideRing({ x: 3, z: 3 }, ring) && !insideRing({ x: 0, z: 25 }, ring), "inside the walls");
  },
});
