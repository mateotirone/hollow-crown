// Siege crews at work in a War Writ siege (Mateo, 2026-11-12). Each crew soldier brings his own engine: a Trebuchet
// crew its trebuchet (folded on the march, unfolded at the setup spot), a Ram crew its ram, a Sapper his charges.
// The plans (where, what, in which order) are in crewplan.js; this file moves them and fires.
//
//   Trebuchet crew: once the army has dismounted, walks to a spot about 40 blocks out from the wall with a clear
//     line, unfolds the trebuchet (15 s, can't fire before), and in the assault throws a boulder about every 45 s,
//     always at the same block: the wall nearest the vault on their side, never by the gate. When it breaks, the
//     block beside it or above it, until the hole is 3 wide and 2 high. Holds fire while friends stand at the wall
//     there; stops after 12 boulders. If the crew dies the trebuchet stands idle.
//   Ram crew: walks the ram up to the gate and swings it every 6 s until the gate is down.
//   Sapper: walks up to the wall away from the gate, plants a Breaching Charge, runs, and comes back a minute later
//     with the next (three in all).
// Everything is taken away when the siege ends.

import { world, system } from "@minecraft/server";
import { TREBUCHET, RAM_ENGINE, CHARGE } from "../siege/constants.js";
import { launchBoulder } from "../siege/machines.js";
import { blockAhead, facing } from "../siege/breachers.js";
import { hitWall, DAMAGE, lightCharge } from "../siege/walls.js";
import { keepOf } from "../siege/api.js";
import { wallRing } from "../settle/walls.js";
import { vaultOf } from "../vault/index.js";
import { walkTo, isWalking, cancelWalk } from "../guardposts/walk.js";
import { standY } from "../guardposts/ground.js";
import { sfx } from "../core/sfx.js";
import { CREW, nextBreach, breachBlock, setupSpot, nearGate, aimFor, velocityOf } from "./crewplan.js";

const OVERWORLD = "minecraft:overworld";
const dim = () => world.getDimension(OVERWORLD);
const entity = (id) => { try { return id ? world.getEntity(id) : undefined; } catch { return undefined; } };
const ENGINE_TAG = "siege_crew_engine";
export const CREW_TYPES = new Set(["siege:trebuchet_crew", "siege:ram_crew", "siege:sapper"]);
const SOLID = (b) => b && !b.isAir && !b.isLiquid && !/grass$|short_grass|tall_grass|fern|flower|snow_layer|sapling|torch|carpet|vine|bush|leaves/.test(b.typeId);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const go = (g, owner, p) => { try { if (!isWalking(g)) walkTo(g, owner, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { noJump: true }); } catch { /* fine */ } };
const groundY = (x, z, near) => standY(Math.floor(x), Math.floor(z), Math.floor(near) + 12) ?? near;

// The settlement: centre, wall radius, the gate, the vault (or Keep) as the thing to break towards
function targetOf(defender) {
  const k = keepOf(defender);
  if (!k) return undefined;
  let ring;
  try { ring = wallRing(defender); } catch { /* no walls */ }
  const vault = applyVault(defender) ?? { x: k.x, y: k.y, z: k.z };
  return { center: ring ? { x: ring.x, y: ring.y, z: ring.z } : { x: k.x, y: k.y, z: k.z }, radius: ring?.radius ?? 24, gate: ring?.gate, vault };
}
const applyVault = (owner) => { try { return vaultOf(owner)?.lock; } catch { return undefined; } };

// The first wall block on the line from `from` toward `to`, at about head height: { x, y, z } or undefined
function wallOnLine(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;
  try {
    const hit = dim().getBlockFromRay({ x: from.x, y: from.y + 1.5, z: from.z }, { x: dx / d, y: 0, z: dz / d }, { maxDistance: d, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit) return undefined;
    // down to the foot of the wall
    let b = hit.block.location;
    for (let n = 0; n < 4; n++) { const below = dim().getBlock({ x: b.x, y: b.y - 1, z: b.z }); if (!SOLID(below) || /dirt|grass_block|sand|gravel|stone$|deepslate$|mud$/.test(below.typeId)) break; b = below.location; }
    return { x: b.x, y: b.y, z: b.z, dist: hit.block.location ? Math.hypot(hit.block.location.x - from.x, hit.block.location.z - from.z) : d };
  } catch { return undefined; }
}

// ---------- the trebuchet crew ----------
function trebuchetCrew(c, g, m, defender, assault, now) {
  const T = targetOf(defender);
  if (!T) return;
  if (c.stage === undefined) {
    // pick the spot: out of bow range, a clear line to the wall on the vault's side
    const from = g.location;
    const spot = setupSpot(T.center, T.radius, from, (s) => {
      const y = groundY(s.x, s.z, from.y), hit = wallOnLine({ x: s.x, y, z: s.z }, T.vault);
      return hit && hit.dist > CREW.trebuchet.standOff - 12 && !nearGate(hit, T.gate);
    });
    if (!spot) { c.stage = "done"; return; }
    c.spot = { x: Math.floor(spot.x), y: groundY(spot.x, spot.z, from.y), z: Math.floor(spot.z) };
    c.stage = "walk";
  }
  if (c.stage === "walk") {
    if (flat(g.location, c.spot) > 3) return go(g, m.attacker, c.spot);
    cancelWalk(g.id);
    // unfold: the trebuchet comes off the cart beside him and is raised (15 s)
    try {
      const e = dim().spawnEntity(TREBUCHET, { x: c.spot.x + 0.5, y: c.spot.y, z: c.spot.z + 0.5 });
      e.addTag(ENGINE_TAG);
      e.setDynamicProperty("siege:owner", m.attacker);
      const dx = T.vault.x - c.spot.x, dz = T.vault.z - c.spot.z;
      e.setRotation({ x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
      e.playAnimation("animation.siege_trebuchet.unfold");
      c.engine = e.id;
      (m.engines ??= []).push(e.id);
    } catch { return; }
    sfx(dim(), "random.door_open", c.spot, { pitch: 0.6 });
    c.ready = now + CREW.trebuchet.setupTicks;
    c.stage = "setup";
    return;
  }
  const e = entity(c.engine);
  if (!e) { c.stage = "done"; return; }
  if (c.stage === "setup") { if (now >= c.ready) c.stage = "aim"; return; }
  if (c.stage === "aim") {
    const hit = wallOnLine({ x: c.spot.x + 0.5, y: c.spot.y, z: c.spot.z + 0.5 }, T.vault);
    if (!hit) return;
    const dx = hit.x - c.spot.x, dz = hit.z - c.spot.z, d = Math.hypot(dx, dz) || 1;
    c.base = { x: hit.x, y: hit.y, z: hit.z };
    c.along = { x: -dz / d, z: dx / d };
    c.shots = 0; c.next = now;
    c.stage = "fire";
    return;
  }
  if (c.stage !== "fire" || !assault || now < c.next) return;
  if (flat(g.location, c.spot) > 8) return go(g, m.attacker, c.spot); // the crew has to be at the machine
  const i = nextBreach((k) => SOLID(dim().getBlock(breachBlock(c.base, c.along, k))));
  if (i === undefined || c.shots >= CREW.trebuchet.maxShots) { c.stage = "done"; return; }
  const target = breachBlock(c.base, c.along, i);
  // hold fire while our own soldiers are at the wall there
  try {
    const near = dim().getEntities({ location: { x: target.x + 0.5, y: target.y, z: target.z + 0.5 }, maxDistance: CREW.trebuchet.friendlyClear, tags: [m.teamA ?? "none"] });
    if (near.length) { c.next = now + 100; return; }
  } catch { /* fine */ }
  const at = e.location;
  const dx = target.x + 0.5 - at.x, dz = target.z + 0.5 - at.z, d = Math.hypot(dx, dz) || 1;
  const start = { x: at.x + (dx / d) * 1.2, y: at.y + 6, z: at.z + (dz / d) * 1.2 };
  // aim at the face of the block toward them
  const aim = aimFor(start, { x: target.x + 0.5 - (dx / d) * 0.45, y: target.y + 0.5, z: target.z + 0.5 - (dz / d) * 0.45 });
  if (!aim) { c.stage = "done"; return; }
  c.next = now + CREW.trebuchet.shotTicks;
  c.shots++;
  try { e.setRotation({ x: 0, y: aim.yaw }); e.playAnimation("animation.siege_trebuchet.fire"); } catch { /* fine */ }
  try { g.playAnimation("animation.hc.trebuchet_crew.load_trebuchet"); } catch { /* fine */ }
  sfx(dim(), "random.door_open", at, { volume: 1, pitch: 0.5 });
  system.runTimeout(() => { try { launchBoulder(dim(), start, velocityOf(aim), m.attacker); } catch { /* unloaded */ } }, 9);
}

// ---------- the ram crew ----------
function ramCrew(c, g, m, defender, assault, now) {
  const T = targetOf(defender);
  if (!T?.gate) { c.stage = "done"; return; }
  const gate = T.gate, out = gate.outside;
  const dx = gate.x - out.x, dz = gate.z - out.z, d = Math.hypot(dx, dz) || 1;
  const spot = { x: Math.round(gate.x - (dx / d) * 3), y: groundY(gate.x - (dx / d) * 3, gate.z - (dz / d) * 3, gate.y), z: Math.round(gate.z - (dz / d) * 3) };
  if (c.stage === undefined) c.stage = "walk";
  if (c.stage === "walk") {
    if (!assault) return go(g, m.attacker, { x: out.x, y: out.y + 1, z: out.z }); // wait outside the gate
    if (flat(g.location, spot) > 2.5) return go(g, m.attacker, spot);
    cancelWalk(g.id);
    try {
      const e = dim().spawnEntity(RAM_ENGINE, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 });
      e.addTag(ENGINE_TAG);
      e.setDynamicProperty("siege:owner", m.attacker);
      e.setRotation({ x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
      c.engine = e.id; (m.engines ??= []).push(e.id);
    } catch { return; }
    c.next = now + 40; c.misses = 0; c.stage = "ram";
    return;
  }
  if (c.stage !== "ram" || now < c.next) return;
  const e = entity(c.engine);
  if (!e) { c.stage = "done"; return; }
  if (flat(g.location, e.location) > 4) return go(g, m.attacker, spot);
  c.next = now + CREW.ram.swingTicks;
  try { e.playAnimation("animation.siege_ram.strike"); g.playAnimation("animation.hc.ram_crew.swing_ram"); } catch { /* fine */ }
  const block = blockAhead(e, CREW.ram.reach, facing(e));
  if (!block) { if (++c.misses >= 3) c.stage = "done"; return; } // the gate is down: the crew joins the fight
  c.misses = 0;
  system.runTimeout(() => { try { sfx(dim(), "random.anvil_land", block.location, { volume: 1, pitch: 0.4 }); hitWall(block, DAMAGE.playerRam); } catch { /* unloaded */ } }, 11);
}

// ---------- the sapper ----------
function sapper(c, g, m, defender, assault, now) {
  const T = targetOf(defender);
  if (!T) return;
  if (c.stage === undefined) { c.stage = "wait"; c.left = CREW.sapper.charges; c.next = now; }
  if (!assault || now < c.next) return;
  if (c.left <= 0) { c.stage = "done"; return; }
  if (c.stage === "wait") {
    // a spot on the wall toward the vault from where he stands, but well away from the gate
    let hit = wallOnLine(g.location, T.vault);
    if (hit && nearGate(hit, T.gate)) { const off = { x: g.location.x + 8, y: g.location.y, z: g.location.z }; hit = wallOnLine(off, T.vault); }
    if (!hit || nearGate(hit, T.gate)) { c.next = now + 200; return; }
    c.wall = hit; c.home = { x: Math.floor(g.location.x), y: Math.floor(g.location.y), z: Math.floor(g.location.z) };
    c.stage = "go";
  }
  if (c.stage === "go") {
    const dx = c.wall.x - g.location.x, dz = c.wall.z - g.location.z, d = Math.hypot(dx, dz) || 1;
    if (d > 2.6) return go(g, m.attacker, { x: Math.round(c.wall.x - (dx / d) * 1.5), y: groundY(c.wall.x - (dx / d) * 1.5, c.wall.z - (dz / d) * 1.5, c.wall.y), z: Math.round(c.wall.z - (dz / d) * 1.5) });
    cancelWalk(g.id);
    // plant it against the wall on his side, then run
    const spot = { x: Math.floor(g.location.x + (dx / d) * 0.9), y: Math.floor(g.location.y), z: Math.floor(g.location.z + (dz / d) * 0.9) };
    try {
      const b = dim().getBlock(spot);
      if (b && (b.isAir || !SOLID(b))) { b.setType(CHARGE); g.playAnimation("animation.hc.sapper.plant_charge"); lightCharge(b, { x: dx / d, y: 0, z: dz / d }); }
    } catch { /* fine */ }
    c.left--;
    const back = { x: Math.round(g.location.x - (dx / d) * CREW.sapper.run), z: Math.round(g.location.z - (dz / d) * CREW.sapper.run) };
    try { cancelWalk(g.id); walkTo(g, m.attacker, { x: back.x + 0.5, y: groundY(back.x, back.z, g.location.y), z: back.z + 0.5 }, { noJump: true }); } catch { /* fine */ }
    c.next = now + CREW.sapper.cooldown;
    c.stage = "wait";
  }
}

const JOBS = { "siege:trebuchet_crew": trebuchetCrew, "siege:ram_crew": ramCrew, "siege:sapper": sapper };

// Once a second for each march that has dismounted (army.js): every crew soldier does his job
export function crewTick(m, defender, assault) {
  const now = system.currentTick;
  m.crews ??= {};
  for (const s of m.soldiers) {
    const g = entity(s.id);
    if (!g || !CREW_TYPES.has(g.typeId)) continue;
    const c = (m.crews[s.id] ??= {});
    if (c.stage === "done") continue;
    try { JOBS[g.typeId](c, g, m, defender, assault, now); } catch (e) { console.warn(`[Hollow Crown] crew: ${e}`); }
  }
}

// Is this soldier busy with a crew job (so the army leaves him to it)?
export const crewBusy = (m, id) => !!m.crews?.[id] && m.crews[id].stage !== "done";

// The siege is over: engines packed away
export function packUp(m) {
  for (const id of m.engines ?? []) try { entity(id)?.remove(); } catch { /* gone */ }
  m.engines = [];
}

// Engines left from before a restart (their march is gone)
export function sweepEngines(live) {
  try { for (const e of dim().getEntities({ tags: [ENGINE_TAG] })) if (!live.has(e.id)) e.remove(); } catch { /* fine */ }
}
