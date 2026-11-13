// Waking the Clockwork Reeve (Mateo approved the design 2026-11-12: https://claude.ai/artifact/KudPh2kcm6inC8H2jbrbNu).
//
//   1. Six clocks stand on posts round the Millbrook square, each with a keeper. Ask the keepers which clock the
//      Reeve stopped first: all six answer, one lies, and only one answer fits (keepers.js; new for each world).
//   2. Open the first clock and its key is still in the winding hole: the Stopped Clock Key. Open a wrong one and
//      it ticks once, a bell that isn't there tolls, and two Hollow footmen climb out of the well.
//   3. Use the key on the well's crank. The key turns three times, every clock ticks from 3:17 to 3:18, the bell
//      finishes its stroke, the well drains, and a spiral stair opens down to the clockwork chamber. "You're late."
//   4. Walk down and the fight starts in the chamber.
//   The key stays in the crank. Once a siege night has passed after he falls, anyone can wind it again for a rematch.
//   A fight lost (everyone dead or gone) leaves him waiting below for the next try, no siege night needed.
//
// The well, chamber, posts and keepers are built by script the first time a player comes near Millbrook (spread
// over ticks with system.runJob, never a long tick), so a freshly generated map needs nothing by hand.
//
// Builder commands (Creative):
//   /scriptevent siege:reeve_unlock status    built? the answer, the liar, the well's state
//   /scriptevent siege:reeve_unlock build     build (or rebuild and reset) it at Millbrook; you must be near it
//   /scriptevent siege:reeve_unlock here      build (or rebuild) it with the square's middle where you stand (test worlds)
//   /scriptevent siege:reeve_unlock tp        go to the Millbrook square
//   /scriptevent siege:reeve_unlock key       a Stopped Clock Key, for testing the crank

import { world, system, ItemStack, BlockPermutation, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, onTick, moduleStore, addMenuLabel } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { WARDS, OVERWORLD } from "../plots/config.js";
import { isBuilder } from "../plots/claims.js";
import { learnLeads } from "../lore/player.js";
import { startBoss, fightOf } from "../bestiary/bossCore.js";
import { markSocketed } from "../bestiary/relics.js";
import { LANDMARKS, stampOps } from "./landmarks.js";
import { bakedFor, bakedState } from "./baked.js";
import { approachWave, approachCount } from "./puzzles.js";
import { CLOCKS, KEEPERS, makePuzzle, TOWER_POST, statementText, clockAnswer } from "./keepers.js";
import { inShaft, stairSpotsBelow, SHAFT_ZONE, WELL, CHAMBER_CENTER, wellOps, chamberOps, postOps, stairSteps, spindleOps, drainLayers, plugOps, SIGN_TURN } from "./well_plan.js";
import { dressNpc, addNpcLook } from "../core/npc_skins.js";

export const KEY = "siege:stopped_clock_key";
export const CLOCK_BLOCK = "siege:stopped_clock";
export const CRANK_BLOCK = "siege:well_crank";
const KEEPER_TAG = "siege_clock_keeper";
const FOOTMAN = "siege:hollow_footman";
const ward = WARDS.find((w) => w.name === "Millbrook");
export const MILLBROOK_SQUARE = { x: ward.x, z: ward.z };
const BUILD_NEAR = 48;
const PER_STEP = 64;
const AREA = "hc_millbrook_well";
const HEARD = "hc:keepers_heard"; // player property: keepers this player has asked, as a JSON list of indexes

markSocketed(KEY);
addMenuLabel({ entity: "minecraft:npc", tag: KEEPER_TAG, hint: "Click to talk" });

const store = moduleStore("siege:unlocks_reeve", () => ({
  built: false, // the well, chamber, posts and keepers stand
  center: null, // { x, y, z }: the square's middle, y = its floor block
  seed: null, // the puzzle's seed, picked once per world
  clocks: [], // [{ x, y, z }] by clock index
  keepers: [], // [{ x, y, z }] by keeper index
  wound: false, // the key is in the crank
  open: false, // the stair is down
  pending: false, // he is waiting in the chamber for someone to come down
  fighting: false,
  wins: 0,
  siegesSinceWin: 0,
}));

const puzzle = () => {
  if (store.data.seed === null) {
    store.data.seed = Math.floor(Math.random() * 2 ** 31);
    store.save();
  }
  return makePuzzle(store.data.seed, { towerPost: store.data.towerPost }); // worlds built before the pin keep their layout
};
const at = (c, o) => ({ x: c.x + o.dx, y: c.y + o.dy, z: c.z + o.dz });
const say = (player, text) => { try { player.sendMessage(text); } catch { /* gone */ } };
const overworld = () => world.getDimension(OVERWORLD);
const nearby = (center, r = 48) => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - center.x, p.location.z - center.z) <= r);

// ---------- building ----------
const SOFT = /air|water|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|leaves|log|vine|sapling|mushroom|torch|sign/;
function isBottomSlab(b) {
  if (!/_slab$/.test(b.typeId) || /double/.test(b.typeId)) return false;
  try { return b.permutation.getState("minecraft:vertical_half") !== "top"; } catch { return true; }
}
function groundAt(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  for (let i = 0; b && i < 40; i++) {
    if (b.typeId === "minecraft:gold_block") { b.setType("minecraft:air"); b = b.below(); continue; } // genworld's square marker
    // a square paved in bottom slabs (sunk half a block): its floor block is the one under the slab, so the rim
    // (dy 1) replaces the slab instead of standing on it with a half-block gap (Mateo 2026-11-12: "the town well
    // is one block too high")
    if (!SOFT.test(b.typeId)) return isBottomSlab(b) ? b.location.y - 1 : b.location.y;
    b = b.below();
  }
  return undefined;
}

const perms = new Map();
function perm(o) {
  const k = o.block + JSON.stringify(o.states ?? {});
  if (!perms.has(k)) {
    let p;
    try { p = BlockPermutation.resolve(o.block, o.states); } catch { try { p = BlockPermutation.resolve(o.block); } catch { p = undefined; } }
    perms.set(k, p);
  }
  return perms.get(k);
}
function put(dim, c, o) {
  const p = perm(o);
  const where = at(c, o);
  if (p) dim.setBlockPermutation(where, p);
  else dim.setBlockType(where, o.block);
}

/** Every block of the set piece, and where the clocks, signs and keepers go, for a square centred on c. */
export function fullPlan(p) {
  const ops = [...chamberOps(), ...wellOps()];
  const posts = CLOCKS.map((clock, i) => postOps(p.layout[i], i === 0, `${clock.short} Clock\n§7kept by\n${KEEPERS[i].name}`, { clocktower: !!LANDMARKS.reeve }));
  for (const post of posts) ops.push(...post.ops);
  return { ops, posts };
}

/** After the blocks stand (built here, or baked into the map): signs on the posts, and where the clocks and keepers are. */
function finishWell(dim, c, plan) {
  const clocks = [], keepers = [];
  plan.posts.forEach((post, i) => {
    clocks.push(at(c, post.clock));
    keepers.push({ x: c.x + post.keeper.dx + 0.5, y: c.y + post.keeper.dy, z: c.z + post.keeper.dz + 0.5 });
    try {
      const sign = dim.getBlock(at(c, post.sign));
      sign?.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: SIGN_TURN[post.face] }));
      sign?.getComponent("minecraft:sign")?.setText(post.sign.text);
    } catch { /* a sign is only a label */ }
  });
  Object.assign(store.data, { built: true, center: c, clocks, keepers, wound: false, open: false, pending: false, fighting: false });
  store.save();
}

/** The well baked into the map (baked_sites.js, Mateo 2026-11-13): take its centre and puzzle, add signs and keepers. */
function adoptWell(dim, bake) {
  Object.assign(store.data, { seed: bake.seed, towerPost: bake.towerPost ?? TOWER_POST, baked: true });
  finishWell(dim, { ...bake.center }, fullPlan(puzzle()));
  placeKeepers(dim);
}

let busy = false;
export function buildWell(center, by) {
  if (busy) return { ok: false, why: "it is already being built" };
  const dim = overworld();
  const y = center.y ?? groundAt(dim, center.x, center.z);
  if (y === undefined) return { ok: false, why: "not loaded yet (stand closer)" };
  const c = { x: Math.floor(center.x), y, z: Math.floor(center.z) };
  busy = true;
  if (store.data.towerPost !== TOWER_POST) { store.data.towerPost = TOWER_POST; store.save(); } // a fresh build pins the Tower clock
  const plan = fullPlan(puzzle());
  plan.ops = [...stampOps(LANDMARKS.reeve), ...plan.ops]; // the square's landmark first (landmarks.js), the well on top
  let failed = 0;
  system.runJob((function* () {
    let n = 0;
    for (const o of plan.ops) {
      try { put(dim, c, o); } catch { failed++; }
      if (++n % PER_STEP === 0) yield;
    }
    if (failed > plan.ops.length * 0.02) {
      busy = false;
      if (by) say(by, `§cThe Millbrook well: ${failed} blocks were not loaded. It will try again when someone comes near.`);
      return;
    }
    finishWell(dim, c, plan);
    yield;
    placeKeepers(dim);
    busy = false;
    if (by) say(by, `§6The Millbrook well is built (${plan.ops.length} blocks), centred on ${c.x} ${c.y} ${c.z}.`);
  })());
  return { ok: true };
}

let holding = false, baked;
onTick("unlocks_reeve_build", 100, () => {
  if (store.data.built || busy) {
    if (holding && !busy) { try { overworld().runCommand(`tickingarea remove ${AREA}`); } catch { /* none */ } holding = false; }
    return;
  }
  const near = nearby(MILLBROOK_SQUARE, BUILD_NEAR);
  if (!near.length) return;
  const dim = overworld();
  const bake = baked === undefined ? bakedFor("reeve", MILLBROOK_SQUARE) : baked;
  if (bake) {
    const state = bakedState(bake, (x, y, z) => { try { return dim.getBlock({ x, y, z })?.typeId; } catch { return undefined; } });
    if (state === "wait") return;
    if (state === "yes") return adoptWell(dim, bake);
    baked = null; // not this world's: build it the old way
  }
  if (!holding) {
    const L = LANDMARKS.reeve, r = Math.max(Math.ceil(WELL.wallR) + 2, L?.size ? Math.ceil(Math.max(L.size[0], L.size[2]) / 2) + 2 : 0);
    try { dim.runCommand(`tickingarea add ${MILLBROOK_SQUARE.x - r} 0 ${MILLBROOK_SQUARE.z - r} ${MILLBROOK_SQUARE.x + r} 0 ${MILLBROOK_SQUARE.z + r} ${AREA} true`); } catch { /* full */ }
    holding = true;
  }
  buildWell(MILLBROOK_SQUARE); // waits quietly until the ground there can be read
});

// ---------- the keepers ----------
function keeperOf(entity) {
  const t = entity.getTags().find((x) => x.startsWith(`${KEEPER_TAG}_`));
  return t === undefined ? undefined : Number(t.slice(KEEPER_TAG.length + 1));
}

addNpcLook((e) => { const i = keeperOf(e); return KEEPERS[i] ? { key: `clock_${i}`, name: KEEPERS[i].name } : undefined; });

function placeKeepers(dim) {
  const spots = store.data.keepers;
  if (!spots?.length) return;
  let here;
  try { here = dim.getEntities({ type: "minecraft:npc", tags: [KEEPER_TAG], location: store.data.center, maxDistance: 32 }); } catch { return; }
  KEEPERS.forEach((k, i) => {
    const found = here.filter((e) => keeperOf(e) === i);
    for (const extra of found.slice(1)) extra.remove();
    const spot = spots[i];
    try {
      if (found[0]) {
        if (Math.hypot(found[0].location.x - spot.x, found[0].location.z - spot.z) > 2) found[0].teleport(spot);
        return;
      }
      const e = dim.spawnEntity("minecraft:npc", spot);
      e.addTag(KEEPER_TAG);
      e.addTag(`${KEEPER_TAG}_${i}`);
      e.nameTag = k.name;
      const npc = e.getComponent("minecraft:npc");
      if (npc) npc.name = k.name;
      dressNpc(e, `clock_${i}`);
    } catch { /* not loaded: next time */ }
  });
}

// Keepers go back to their clocks if moved or missing, whenever someone is near
onTick("unlocks_reeve_keepers", 200, () => {
  if (!store.data.built || !nearby(store.data.center, 40).length) return;
  placeKeepers(overworld());
});

const heardBy = (player) => { try { return JSON.parse(player.getDynamicProperty(HEARD) ?? "[]"); } catch { return []; } };

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== "minecraft:npc" || !target.hasTag(KEEPER_TAG)) return;
  if (player.isSneaking && isBuilder(player)) return; // builder: the normal NPC editor
  const k = keeperOf(target);
  if (KEEPERS[k] === undefined) return;
  event.cancel = true;
  system.run(() => showKeeper(player, k));
});

export function keeperBody(k, heard, statements) {
  let body = `§o${KEEPERS[k].hello}§r\n\nYou ask which clock the Reeve stopped first.\n\n"${statementText(statements[k])}"`;
  const others = heard.filter((i) => i !== k && KEEPERS[i]);
  if (others.length) body += `\n\n§7What the others told you:§r\n${others.map((i) => `§8${KEEPERS[i].name} (${CLOCKS[i].short}):§r ${statementText(statements[i])}`).join("\n")}`;
  body += `\n\n§8Sister Wren: one of the six is lying.`;
  return body;
}

function showKeeper(player, k) {
  const heard = heardBy(player);
  if (!heard.includes(k)) {
    heard.push(k);
    try { player.setDynamicProperty(HEARD, JSON.stringify(heard)); } catch { /* still shows */ }
  }
  new ActionFormData()
    .title(`${KEEPERS[k].name}, ${KEEPERS[k].role}`)
    .body(keeperBody(k, heard, puzzle().statements))
    .button("Thank you.")
    .show(player)
    .catch(() => {});
}

// ---------- the clocks ----------
const lastWrong = new Map(); // player id -> tick of their last wrong clock
const sameSpot = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
const clockIndexAt = (loc) => store.data.clocks.findIndex((c) => sameSpot(c, { x: loc.x, y: loc.y, z: loc.z }));

function inventoryHas(player, id) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === id) return true;
  return false;
}

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  if (block.typeId === CLOCK_BLOCK) return clickClock(player, block);
  if (block.typeId === CRANK_BLOCK) return clickCrank(player, block);
});

function clickClock(player, block) {
  const i = clockIndexAt(block.location);
  if (i < 0) return player.onScreenDisplay.setActionBar("§7A stopped clock. It reads 3:17.");
  const p = puzzle();
  const answer = clockAnswer({ clock: i, first: p.first, wound: store.data.wound, now: system.currentTick, lastWrong: lastWrong.get(player.id) });
  if (answer === "rest") return say(player, "§7The clocks won't let you near them again yet.");
  if (answer === "wrong") {
    lastWrong.set(player.id, system.currentTick);
    say(player, `§7You open ${CLOCKS[i].name}. It ticks once, forward, and stops again. Somewhere a bell that isn't there tolls.`);
    sfx(block.dimension, "block.bell.hit", block.location, { pitch: 0.45, volume: 3 });
    climbOut(block.dimension);
    return;
  }
  if (answer === "empty") return say(player, "§7The winding hole is empty. Its key is in the well now.");
  if (inventoryHas(player, KEY)) return say(player, "§7The winding hole is empty. You already have its key.");
  const left = player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(KEY, 1));
  if (left) player.dimension.spawnItem(left, player.location);
  say(player, `§6The case of ${CLOCKS[i].name} swings open. A brass key is still in the winding hole.§r You take the Stopped Clock Key.`);
  sfx(player, "random.click", { pitch: 0.7 });
  try { learnLeads(player, ["millbrook_well"]); } catch { /* the Ledger is optional */ }
}

// Two footmen climb out over the well's rim, on the side away from Wren's porch
function climbOut(dim) {
  const c = store.data.center;
  if (!c) return;
  for (const dx of [-1, 1]) {
    const spot = { x: c.x + dx + 0.5, y: c.y + 1, z: c.z + 3.5 };
    try {
      dim.spawnParticle("minecraft:water_splash_particle_manual", { x: c.x + 0.5, y: c.y + 1.2, z: c.z + 0.5 });
      dim.spawnEntity(FOOTMAN, spot);
    } catch { /* not loaded */ }
  }
}

function setClocks(struck) {
  const dim = overworld();
  for (const c of store.data.clocks) {
    try {
      const b = dim.getBlock(c);
      if (b?.typeId === CLOCK_BLOCK) b.setPermutation(b.permutation.withState("siege:struck", struck));
    } catch { /* not loaded */ }
  }
}

// ---------- the crank and the summon ----------
let scene = false;

function mainhand(player) {
  try { return player.getComponent("equippable").getEquipment(EquipmentSlot.Mainhand); } catch { return undefined; }
}
function takeOneFromHand(player) {
  if (isBuilder(player)) return;
  const eq = player.getComponent("equippable");
  const s = eq.getEquipment(EquipmentSlot.Mainhand);
  if (!s) return;
  if (s.amount > 1) { s.amount--; eq.setEquipment(EquipmentSlot.Mainhand, s); } else eq.setEquipment(EquipmentSlot.Mainhand);
}

export function crankAnswer({ wound, holdingKey, hasKey, scene: busyScene, fighting, pending, siegesSinceWin, wins }) {
  if (busyScene) return "busy";
  if (fighting) return "fighting";
  if (!wound) return holdingKey ? "summon" : hasKey ? "hold" : "keyhole";
  if (pending) return "waiting";
  if (wins > 0 && siegesSinceWin < 1) return "stiff";
  return "rematch";
}

function clickCrank(player, block) {
  const d = store.data;
  if (!d.built || !sameSpot(at(d.center, WELL.crank), block.location)) return player.onScreenDisplay.setActionBar("§7A well crank. It isn't on any well."); // a showcase copy
  const answer = crankAnswer({
    wound: d.wound, holdingKey: mainhand(player)?.typeId === KEY, hasKey: inventoryHas(player, KEY),
    scene, fighting: d.fighting || !!fightOf("reeve"), pending: d.pending, siegesSinceWin: d.siegesSinceWin, wins: d.wins,
  });
  switch (answer) {
    case "busy": return undefined;
    case "fighting": return player.onScreenDisplay.setActionBar("§7Something below is already awake.");
    case "keyhole": return say(player, "§7A brass plate on the crank, with a keyhole in it. Nothing in the hole.");
    case "hold": return player.onScreenDisplay.setActionBar("§7Hold the key to wind it.");
    case "waiting": return say(player, "§7The stair is open. He is waiting at the bottom.");
    case "stiff": return say(player, "§7The key won't turn. Not until another siege night has passed.");
    case "summon":
      takeOneFromHand(player);
      return summon(block, true);
    case "rematch": return summon(block, false);
    default: return undefined;
  }
}

// The summon, as [tick, step] pairs. First time: the whole thing. A rematch: the turns, the clocks fall back to
// 3:17, the bell, and his voice (the well is already open).
function summon(crank, first) {
  const d = store.data;
  const c = d.center;
  const dim = overworld();
  scene = true;
  const play = (name, where, opts) => sfx(dim, name, where ?? { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5 }, opts);
  const toAll = (fn) => { for (const p of nearby(c, 48)) { try { fn(p); } catch { /* gone */ } } };
  const steps = [];
  const cue = (tick, fn) => steps.push([tick, fn]);

  cue(0, () => {
    try { crank.setPermutation(crank.permutation.withState("siege:wound", 1)); } catch { /* not loaded */ }
    d.wound = true;
    store.save();
    play("random.click", crank.location, { pitch: 0.6 });
    toAll((p) => p.onScreenDisplay.setActionBar(first ? "§7The key slides into the crank." : "§7You wind the key in the crank again."));
  });
  for (let t = 0; t < 3; t++) cue(20 + t * 20, () => play("random.click", crank.location, { pitch: 0.7 + t * 0.2, volume: 2 + t }));
  cue(80, () => {
    setClocks(first ? 1 : 0);
    for (const k of d.clocks) play("random.anvil_land", k, { pitch: 0.5, volume: 1.5 });
    toAll((p) => p.onScreenDisplay.setTitle(first ? "§63:18" : "§63:17", { subtitle: first ? "§7The minute ends." : "§7The hands fall back a minute.", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 }));
  });
  cue(110, () => {
    play("block.bell.hit", undefined, { pitch: 0.35, volume: 5 });
    play("block.bell.resonate", undefined, { pitch: 0.5, volume: 3 });
    toAll((p) => p.addEffect("darkness", 100, { showParticles: false }));
  });
  for (let r = 2; r <= 12; r += 2) {
    cue(110 + r * 2, () => {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        try { dim.spawnParticle("minecraft:basic_smoke_particle", { x: c.x + 0.5 + Math.sin(ang) * r, y: c.y + 1.2, z: c.z + 0.5 + Math.cos(ang) * r }); } catch { /* unloaded */ }
      }
    });
  }
  let end = 150;
  if (first) {
    cue(140, () => play("random.anvil_use", undefined, { pitch: 0.4, volume: 2 }));
    drainLayers().forEach((layer, i) => cue(140 + i * 2, () => {
      for (const o of layer) { try { put(dim, c, o); } catch { /* unloaded */ } }
      if (i % 4 === 0) play("bucket.fill_water", { x: c.x + 0.5, y: c.y - i, z: c.z + 0.5 }, { pitch: 0.5 });
    }));
    cue(170, () => {
      for (const o of [...plugOps(), ...spindleOps()]) { try { put(dim, c, o); } catch { /* unloaded */ } }
      play("tile.piston.in", undefined, { pitch: 0.5, volume: 2 });
    });
    stairSteps().forEach((o, i) => cue(175 + i * 3, () => {
      try { put(dim, c, o); } catch { /* unloaded */ }
      if (i % 2 === 0) play("dig.stone", at2(c, o), { pitch: 0.8 });
    }));
    end = 175 + stairSteps().length * 3 + 10;
  }
  const bottom = { x: c.x + 0.5, y: c.y + CHAMBER_CENTER.dy + 2.6, z: c.z + 0.5 };
  for (let t = 0; t < 40; t += 4) {
    cue(end + t, () => {
      for (const dx of [-0.25, 0.25]) { try { dim.spawnParticle("minecraft:basic_flame_particle", { x: bottom.x + dx, y: bottom.y, z: bottom.z + 4 }); } catch { /* unloaded */ } }
    });
  }
  cue(end + 10, () => {
    toAll((p) => say(p, first ? '§6From the bottom of the well:§r "You\'re late."' : '§6From the bottom of the well:§r "Again? Then mind the time."'));
    play("block.bell.hit", bottom, { pitch: 0.3, volume: 1 });
    d.open = true;
    d.pending = true;
    store.save();
    scene = false;
  });
  for (const [tick, fn] of steps) system.runTimeout(() => { try { fn(); } catch (e) { console.warn(`[Hollow Crown] reeve summon: ${e}`); } }, Math.max(1, tick));
}
const at2 = (c, o) => ({ x: c.x + o.dx + 0.5, y: c.y + o.dy + 0.5, z: c.z + o.dz + 0.5 });

// ---------- the fight below ----------
export function inChamber(p, c) {
  const floor = c.y + WELL.floorY;
  return Math.hypot(p.x - (c.x + 0.5), p.z - (c.z + 0.5)) <= WELL.roomR && p.y > floor && p.y < c.y + WELL.plugY;
}

// The approach: while he waits below, footmen climb the stair to meet whoever comes down the shaft.
let lastStairWave;
function stairWave(d) {
  if (!d.open || !d.pending || d.fighting) return;
  const c = d.center;
  const inside = nearby(c, SHAFT_ZONE.r + 2).filter((p) => inShaft(c, p.location));
  const now = system.currentTick;
  if (!approachWave({ players: inside.length, fighting: !!scene, now, last: lastStairWave })) return;
  lastStairWave = now;
  const lowest = Math.min(...inside.map((p) => p.location.y)) - c.y;
  for (const p of inside) { say(p, "§7Below you the stair is ticking. No: it is footsteps, keeping time, coming up."); sfx(overworld(), "random.anvil_use", p.location, { pitch: 0.7, volume: 0.6 }); }
  for (const s of stairSpotsBelow(lowest, approachCount(inside.length, { base: 1, per: 1, max: 4 }))) {
    try { overworld().spawnEntity(FOOTMAN, { x: c.x + s.dx + 0.5, y: c.y + s.dy, z: c.z + s.dz + 0.5 }); } catch { /* unloaded */ }
  }
}

let missing = 0;
onTick("unlocks_reeve_fight", 10, () => {
  const d = store.data;
  if (!d.built) return;
  try { stairWave(d); } catch (e) { console.warn(`[Hollow Crown] reeve stair: ${e}`); }
  if (d.pending && !d.fighting) {
    const c = d.center;
    const down = world.getPlayers().some((p) => p.dimension.id === OVERWORLD && inChamber(p.location, c));
    if (!down) return;
    try {
      startBoss("reeve", overworld(), { x: c.x + 0.5, y: c.y + CHAMBER_CENTER.dy, z: c.z + 7.5 });
      d.pending = false;
      d.fighting = true;
      missing = 0;
      store.save();
    } catch (e) {
      console.warn(`[Hollow Crown] reeve: could not start the fight: ${e}`);
    }
    return;
  }
  if (d.fighting) {
    if (fightOf("reeve")) { missing = 0; return; }
    if (++missing < 3) return; // give a reloaded world a moment to find its fight again
    // over without a win (the win is heard below): he waits below for the next try
    d.fighting = false;
    d.pending = true;
    store.save();
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:boss_defeated") {
    let data;
    try { data = JSON.parse(event.message); } catch { return; }
    if (data?.boss !== "reeve" || !store.data.built) return;
    Object.assign(store.data, { fighting: false, pending: false, wins: store.data.wins + 1, siegesSinceWin: 0 });
    store.save();
    setClocks(1); // the minute ends for good
    return;
  }
  if (event.id === "siege:reeve_unlock") command(event.sourceEntity, event.message.trim());
});

// ---------- the held minute: Millbrook's long night ----------
// The story says it is always night in Millbrook ("It's been dark in Millbrook since before I was born"): the Reeve
// stopped the clocks at 3:17 and the night stopped with them. Minecraft has one sky for the world, so the night is a
// dark fog each player sees while they stand inside Millbrook's ward. It lifts for good when the Reeve falls and the
// minute ends (store.data.wins > 0). After dark Minecraft's own night does the job, so the fog is only pushed by day.
export const HELD_NIGHT = { fog: "siege:millbrook_night", layer: "hc_millbrook_night", radius: ward.r, dayEnds: 12500, dayStarts: 23500 };
/** Is a player standing here, at this time of day, in the night the Reeve is holding? (pure, for tests) */
export function inHeldNight(x, z, timeOfDay, wins) {
  if (wins > 0) return false;
  if (Math.hypot(x - MILLBROOK_SQUARE.x, z - MILLBROOK_SQUARE.z) > HELD_NIGHT.radius) return false;
  return timeOfDay < HELD_NIGHT.dayEnds || timeOfDay >= HELD_NIGHT.dayStarts;
}
const heldFor = new Set(); // ids of players whose fog stack has the held night on it
onTick("reeve held night", 40, () => {
  let time = 0;
  try { time = world.getTimeOfDay(); } catch { return; }
  for (const p of world.getAllPlayers()) {
    let want = false;
    try { want = p.dimension.id === OVERWORLD && inHeldNight(p.location.x, p.location.z, time, store.data.wins); } catch { continue; }
    if (want === heldFor.has(p.id)) continue;
    try {
      p.runCommand(want ? `fog @s push ${HELD_NIGHT.fog} ${HELD_NIGHT.layer}` : `fog @s remove ${HELD_NIGHT.layer}`);
      if (want) heldFor.add(p.id); else heldFor.delete(p.id);
    } catch { /* left */ }
  }
});
world.afterEvents.playerLeave.subscribe((event) => heldFor.delete(event.playerId));
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  heldFor.delete(event.player.id);
  try { event.player.runCommand(`fog @s remove ${HELD_NIGHT.layer}`); } catch { /* a fresh stack */ }
});

on("siegeEnd", () => {
  if (!store.data.built || store.data.wins === 0) return;
  store.data.siegesSinceWin++;
  store.save();
});

// ---------- builder commands ----------
function command(player, arg) {
  if (player?.typeId !== "minecraft:player" || !isBuilder(player)) return;
  const d = store.data;
  if (arg === "status" || arg === "") {
    const p = puzzle();
    return say(player, [
      `§6Millbrook well:§r ${d.built ? `built at ${d.center.x} ${d.center.y} ${d.center.z}` : "not built yet"}`,
      `§7First clock: §f${CLOCKS[p.first].name}§7, liar: §f${KEEPERS[p.liar].name}`,
      `§7Key in the crank: §f${d.wound}§7, stair open: §f${d.open}§7, waiting below: §f${d.pending}§7, fighting: §f${d.fighting}`,
      `§7Wins: §f${d.wins}§7, siege nights since: §f${d.siegesSinceWin}`,
    ].join("\n"));
  }
  if (arg === "build") {
    const r = buildWell(MILLBROOK_SQUARE, player);
    return say(player, r.ok ? "§7Building the Millbrook well..." : `§c${r.why}`);
  }
  if (arg === "here") {
    const l = player.location;
    const r = buildWell({ x: l.x, y: Math.floor(l.y) - 1, z: l.z }, player);
    return say(player, r.ok ? "§7Building the Millbrook well here..." : `§c${r.why}`);
  }
  if (arg === "tp") {
    const c = d.center ?? { ...MILLBROOK_SQUARE, y: 100 };
    player.teleport({ x: c.x + 0.5, y: c.y + 1, z: c.z + 6.5 }, { dimension: overworld(), facingLocation: { x: c.x + 0.5, y: c.y + 2, z: c.z + 0.5 } });
    return undefined;
  }
  if (arg === "key") {
    player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(KEY, 1));
    return undefined;
  }
  return say(player, "§7Use: status, build, here, tp, key");
}

// The test world (/scriptevent siege:showcase): a clock (struck and not) and the crank, with a sign on how to build the rest
on("showcase", ({ dim, nextSpot, label }) => {
  const show = [
    ["siege:stopped_clock", { "siege:struck": 0 }, "Stopped Clock\n3:17"],
    ["siege:stopped_clock", { "siege:struck": 1 }, "Stopped Clock\n3:18, after"],
    ["siege:well_crank", { "siege:wound": 0 }, "Well Crank\nsiege:reeve_unlock\nhere: the whole well"],
  ];
  for (const [block, states, text] of show) {
    const spot = nextSpot();
    try { dim.setBlockPermutation(spot, BlockPermutation.resolve(block, { ...states, "minecraft:cardinal_direction": "south" })); label(spot, text); } catch { /* the showcase carries on */ }
  }
});

export const reeveState = () => store.data;
