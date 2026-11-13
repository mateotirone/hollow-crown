// The march to war (Mateo, 2026-11-12).
//
// On declaring, the army slider picks what share of your soldiers marches (Men-at-Arms first, then the others);
// the rest keep guarding home. The marchers mount horses at once and follow you "no matter what":
//   - they ride along your own trail (so a gate you rode through is the gate they take), a few blocks behind you,
//     two abreast, moved by the script so nothing gets stuck;
//   - where your trail crosses water they plan a way round (route.js findPath: water costs a lot, cliffs and walls
//     can't be crossed) and swim only if there is no other way;
//   - more than CATCH_UP blocks behind (a fast horse, a train, a teleport) they regroup a little way behind you;
//   - within DISMOUNT blocks of the enemy's land they get off their horses and fight on foot (Knights, once they
//     exist, stay mounted). During the muster they wait there; at nightfall they go for the enemy.
// When the siege ends they go home: back on their posts, horses gone.
//
// Teams: in the assault each side is tagged for the writ's slot (siege_w<slot>_a attackers, _b defenders) and the
// guards' targeting (tools/build_guard_war.py) makes each side attack the other.

import { world, system } from "@minecraft/server";
import { MARCHING_TAG, guardTag } from "../siege/guards.js";
import { landRadius } from "../siege/territory.js";
import { keepOf } from "../siege/api.js";
import { walkTo, cancelWalk, isWalking } from "../guardposts/walk.js";
import { gateOutside, gateInside } from "./gates.js";
import { ROUTE, findPath, wetRuns, behind } from "./route.js";
import { crewTick, crewBusy, packUp, sweepEngines, CREW_TYPES } from "./crews.js";

export const WAR_SLOTS = 4; // keep in step with tools/build_guard_war.py
export const teamTag = (slot, side) => `siege_w${slot}_${side}`;
export const ARMY = {
  shares: [0, 25, 50, 75, 100],
  catchUp: 48,       // further than this behind the leader: regroup behind them
  spacing: 3,        // blocks between ranks
  firstRank: 5,      // the first rank rides this far behind the leader
  speed: 0.7,        // blocks per 2 ticks at most (about 7 blocks a second)
  dismount: 40,      // blocks outside the enemy's land edge where they get off their horses
  trailMax: 400,     // crumbs kept
};
const HORSE = "minecraft:horse";
const WAR_HORSE = "siege_war_horse";
const OVERWORLD = "minecraft:overworld";
const dim = () => world.getDimension(OVERWORLD);
const entity = (id) => { try { return world.getEntity(id); } catch { return undefined; } };
const RIDER = new Set(["siege:knight"]); // stays mounted in battle

// Which soldiers march: share% of the owner's loaded soldiers, Men-at-Arms first
export function pickMarchers(guards, share) {
  const order = { "siege:man_at_arms": 0, "siege:knight": 0, "siege:pikeman": 1, "siege:shieldbearer": 1, "siege:crossbowman": 2, "siege:archer": 3, "siege:trebuchet_crew": 1, "siege:ram_crew": 1, "siege:sapper": 1 };
  const sorted = [...guards].sort((a, b) => (order[a.typeId] ?? 4) - (order[b.typeId] ?? 4));
  return sorted.slice(0, Math.round((sorted.length * share) / 100));
}

// ---------- ground for route finding ----------
// The first thing under (x, z) looking down from `from`: { y (feet), water } or undefined
function groundAt(x, z, from) {
  try {
    for (let y = from + 6; y >= from - 24; y--) {
      const b = dim().getBlock({ x, y, z });
      if (!b) return undefined;
      if (b.isAir || /grass$|short_grass|tall_grass|fern|flower|snow_layer|sapling|torch|carpet|vine|bush/.test(b.typeId)) continue;
      if (b.isLiquid || b.typeId.includes("water")) return { y: y + 1, water: true };
      return { y: y + 1, water: false };
    }
  } catch { /* unloaded */ }
  return undefined;
}

// ---------- the march state, kept in memory (a restart sends everyone home, see raise/endMarch) ----------
const marches = new Map(); // defender -> { attacker, slot, trail: [{x,y,z,wet}], soldiers: [{ id, horse, rank, home, n }], dismounted, planning }

function mount(g, attacker) {
  try {
    const horse = dim().spawnEntity(HORSE, g.location);
    horse.addTag(WAR_HORSE);
    try { horse.getComponent("minecraft:tameable")?.tame?.(world.getPlayers().find((p) => p.id === attacker)); } catch { /* fine */ }
    horse.getComponent("minecraft:rideable")?.addRider(g);
    return horse.id;
  } catch { return undefined; }
}

// dismounted: the soldiers start where they stand, already off their horses (Knights keep theirs), and walk to the
// enemy gate at once (a Rival Lord's or a test army with no leader on the road, battletest/)
export function startMarch(writ, defender, share, { dismounted = false } = {}) {
  const attacker = writ.attacker;
  let guards = [];
  try { guards = dim().getEntities({ tags: [guardTag(attacker)] }).filter((g) => !g.hasTag(MARCHING_TAG)); } catch { /* fine */ }
  const soldiers = [];
  pickMarchers(guards, share).forEach((g) => {
    try {
      cancelWalk(g.id);
      g.addTag(MARCHING_TAG);
      soldiers.push({ id: g.id, horse: dismounted && !RIDER.has(g.typeId) ? undefined : mount(g, attacker), rank: soldiers.length, home: g.getDynamicProperty("siege:post") });
    } catch { /* gone */ }
  });
  const m = { attacker, slot: writ.slot ?? 0, trail: [], soldiers, dismounted: false };
  marches.set(defender, m);
  if (dismounted) dismount(m, defender);
  return soldiers.length;
}

// After a restart the march (kept in memory) is gone but the soldiers still carry the marching tag: pick them up
// again where they stand. Returns true once there is a march for this writ.
export function resumeMarch(writ, defender) {
  if (marches.has(defender)) return true;
  let guards = [];
  try { guards = dim().getEntities({ tags: [guardTag(writ.attacker), MARCHING_TAG] }); } catch { return false; }
  if (!guards.length) return false;
  const k = keepOf(defender), lead = world.getPlayers().find((p) => p.id === writ.attacker);
  const near = k && lead && Math.hypot(lead.location.x - k.x, lead.location.z - k.z) <= landRadius(k, defender) + ARMY.dismount;
  const soldiers = guards.map((g, rank) => ({ id: g.id, horse: near ? undefined : mount(g, writ.attacker), rank, home: g.getDynamicProperty("siege:post") }));
  marches.set(defender, { attacker: writ.attacker, slot: writ.slot ?? 0, trail: [], soldiers, dismounted: !!near });
  return true;
}

// Marching soldiers with no war left to fight (an ended writ, a lost march) go home; riderless war horses go
export function sweepStragglers(atWar) {
  const ours = new Set(), horses = new Set();
  for (const m of marches.values()) for (const s of m.soldiers) { ours.add(s.id); if (s.horse) horses.add(s.horse); }
  sweepEngines(new Set([...marches.values()].flatMap((m) => m.engines ?? [])));
  try {
    for (const g of dim().getEntities({ tags: [MARCHING_TAG] })) {
      if (ours.has(g.id)) continue;
      const owner = g.getTags().find((t) => t.startsWith("siege_guard_of_"))?.slice("siege_guard_of_".length);
      if (owner && atWar(owner)) continue; // their march is being picked up again
      g.removeTag(MARCHING_TAG);
      goHome(g, g.getDynamicProperty("siege:post"));
    }
    for (const h of dim().getEntities({ tags: [WAR_HORSE] })) if (!horses.has(h.id)) h.remove();
  } catch { /* fine */ }
}

function goHome(g, post) {
  try {
    const home = JSON.parse(post ?? "null");
    if (home) g.teleport(home.stand ? { x: home.x, y: home.y, z: home.z } : { x: home.x + 0.5, y: home.y + 1, z: home.z + 0.5 }, { dimension: dim() });
  } catch { /* fine */ }
}

// Everyone home: off the horses, back to their posts, tags off
export function endMarch(defender) {
  const m = marches.get(defender);
  marches.delete(defender);
  if (!m) return;
  packUp(m);
  for (const s of m.soldiers) {
    const g = entity(s.id), h = s.horse && entity(s.horse);
    try { h?.remove(); } catch { /* gone */ }
    if (!g) continue;
    try { g.removeTag(MARCHING_TAG); } catch { /* fine */ }
    goHome(g, s.home);
  }
}

// Soldiers of this owner away at war (for the retrain hold and menus)
export const marching = (owner) => [...marches.values()].some((m) => m.attacker === owner);

// ---------- following ----------

function addCrumb(m, leader) {
  const p = leader.location, t = m.trail, last = t[t.length - 1];
  if (last && Math.hypot(p.x - last.x, p.z - last.z) < ROUTE.crumb) return;
  if (last && Math.hypot(p.x - last.x, p.z - last.z) > 24) t.length = 0; // a teleport or a train ride: start afresh
  let wet = false;
  try { wet = !!leader.isInWater; } catch { /* fine */ }
  t.push({ x: p.x, y: p.y, z: p.z, wet });
  if (t.length > ARMY.trailMax) { t.splice(0, t.length - ARMY.trailMax); for (const s of m.soldiers) s.n = Math.max(0, (s.n ?? 0) - (t.length - ARMY.trailMax)); }
  if (wet) return;
  // a wet stretch just ended behind the leader: plan a dry way round it, spread over ticks
  const runs = wetRuns(t);
  const run = runs[runs.length - 1];
  if (run && run[1] === t.length - 2 && run[0] > 0 && !m.planning) planDetour(m, run);
}

function planDetour(m, [a, b]) {
  const t = m.trail, start = t[a - 1], goal = t[b + 1];
  m.planning = true;
  const from = Math.round((start.y + goal.y) / 2);
  const job = (function* () {
    const path = yield* findPath(start, goal, (x, z) => groundAt(Math.floor(x), Math.floor(z), from));
    m.planning = false;
    if (!path || path.length < 2) return; // no way round: they swim after all
    const wetCells = path.filter((p) => groundAt(Math.floor(p.x), Math.floor(p.z), from)?.water).length;
    if (wetCells >= b - a + 1) return; // no better than swimming the trail
    // swap the wet crumbs for the dry way round (soldiers past `a` keep their place by index shift)
    const dry = path.slice(1, -1).map((p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5, wet: false }));
    const removed = b - a + 1, shift = dry.length - removed;
    t.splice(a, removed, ...dry);
    for (const s of m.soldiers) if ((s.n ?? 0) > b) s.n += shift; else if ((s.n ?? 0) >= a) s.n = a;
  })();
  try { system.runJob(job); } catch { m.planning = false; }
}

function placeOnTrail(rider, horse, point, facing) {
  const yaw = Math.atan2(-facing.x, facing.z) * 180 / Math.PI;
  const g = groundAt(Math.floor(point.x), Math.floor(point.z), Math.round(point.y));
  const at = { x: point.x, y: g && !g.water ? g.y : point.y, z: point.z };
  try {
    if (horse) {
      horse.teleport(at, { rotation: { x: 0, y: yaw } });
      const riders = horse.getComponent("minecraft:rideable")?.getRiders?.() ?? [];
      if (rider && !riders.some((r) => r.id === rider.id)) horse.getComponent("minecraft:rideable")?.addRider(rider);
    } else if (rider) rider.teleport(at, { rotation: { x: 0, y: yaw } });
  } catch { /* unloaded */ }
}

// Every 2 ticks: crumbs from the leader, soldiers ride up the trail behind them
system.runInterval(() => {
  for (const [defender, m] of marches) {
    if (m.dismounted) { chargeKnights(m); continue; }
    const leader = world.getPlayers().find((p) => p.id === m.attacker);
    if (!leader || leader.dimension.id !== OVERWORLD) continue; // away: the army waits where it is
    addCrumb(m, leader);
    const t = m.trail;
    if (t.length < 2) continue;
    // close enough to the enemy: off the horses
    const k = keepOf(defender);
    if (k && Math.hypot(leader.location.x - k.x, leader.location.z - k.z) <= landRadius(k, defender) + ARMY.dismount) { dismount(m, defender); continue; }
    m.soldiers.forEach((s) => {
      const rider = entity(s.id), horse = s.horse && entity(s.horse);
      if (!rider) return;
      const back = ARMY.firstRank + ARMY.spacing * Math.floor(s.rank / 2);
      const spot = behind(t, t.length - 1, back);
      const here = (horse ?? rider).location;
      s.n ??= Math.max(0, spot.n - 1);
      // far behind, or lost the trail: regroup at their spot behind the leader
      if (Math.hypot(here.x - spot.x, here.z - spot.z) > ARMY.catchUp) { s.n = spot.n; placeOnTrail(rider, horse, spot, { x: leader.location.x - spot.x, z: leader.location.z - spot.z }); return; }
      if (s.n >= spot.n) return; // in place: wait
      // ride towards the next crumb, at most ARMY.speed this step
      const target = t[Math.min(s.n + 1, t.length - 1)];
      const dx = target.x - here.x, dz = target.z - here.z, d = Math.hypot(dx, dz);
      if (d < 1) { s.n += 1; return; }
      const step = Math.min(ARMY.speed, d);
      const side = s.rank % 2 ? 1.2 : -1.2; // two abreast
      const nx = -dz / d, nz = dx / d;
      placeOnTrail(rider, horse, { x: here.x + (dx / d) * step + nx * side * 0.05, y: target.y, z: here.z + (dz / d) * step + nz * side * 0.05 }, { x: dx, z: dz });
    });
  }
}, 2);

function dismount(m, defender) {
  m.dismounted = true;
  const out = gateOutside(defender, m.trail[m.trail.length - 1]);
  for (const s of m.soldiers) {
    const rider = entity(s.id), horse = s.horse && entity(s.horse);
    if (!rider) continue;
    if (RIDER.has(rider.typeId)) continue;
    try { horse?.getComponent("minecraft:rideable")?.ejectRiders(); } catch { /* fine */ }
    try { horse?.remove(); } catch { /* gone */ }
    s.horse = undefined;
    // gather outside their gate, then the battle takes over at nightfall
    if (out) try { walkTo(rider, m.attacker, { x: out.x + (s.rank % 4) - 1.5, y: out.y, z: out.z + Math.floor(s.rank / 4) }, { noJump: true }); } catch { /* fine */ }
  }
}

// ---------- the assault: send them at the enemy, and keep the sides tagged ----------

export function assaultTick(defender, writ, sideOf) {
  const slot = writ.slot ?? 0, a = teamTag(slot, "a"), b = teamTag(slot, "b");
  for (const p of world.getPlayers()) {
    try {
      if (sideOf(writ.attacker, p.id) && !sideOf(defender, p.id)) p.addTag(a);
      else if (sideOf(defender, p.id)) p.addTag(b);
    } catch { /* left */ }
  }
  let defenders = [];
  try { defenders = dim().getEntities({ tags: [guardTag(defender)] }); for (const g of defenders) g.addTag(b); } catch { /* fine */ }
  const m = marches.get(defender);
  const breach = m ? breachOf(m) : undefined;
  braceDefenders(defenders, defender, m?.attacker, breach);
  if (!m) return;
  m.teamA = a; m.teamB = b;
  if (!m.dismounted) dismount(m, defender);
  crewTick(m, defender, true);
  const k = keepOf(defender);
  const crewmen = m.soldiers.map((s) => entity(s.id)).filter((g) => g && CREW_TYPES.has(g.typeId) && crewBusy(m, g.id));
  for (const s of m.soldiers) {
    const g = entity(s.id);
    if (!g) continue;
    try {
      g.addTag(a);
      if (CREW_TYPES.has(g.typeId) && crewBusy(m, g.id)) continue; // at his engine (crews.js)
      if (RIDER.has(g.typeId)) continue; // Knights ride at the enemy (chargeKnights)
      const near = dim().getEntities({ location: g.location, maxDistance: 20, tags: [b] }).length;
      // Shieldbearers walk in front of the crews, between them and the wall
      if (g.typeId === "siege:shieldbearer" && crewmen.length) {
        const c = crewmen.reduce((x, y) => (dist(y.location, g.location) < dist(x.location, g.location) ? y : x));
        const w = gateOutside(defender, c.location) ?? k;
        const dx = (w?.x ?? c.location.x) - c.location.x, dz = (w?.z ?? c.location.z) - c.location.z, d = Math.hypot(dx, dz) || 1;
        const cover = { x: c.location.x + (dx / d) * 2, y: c.location.y, z: c.location.z + (dz / d) * 2 };
        if (dist(g.location, cover) > 2 && !isWalking(g)) walkTo(g, m.attacker, cover, { noJump: true });
        continue;
      }
      if (near) { if (isWalking(g)) cancelWalk(g.id); continue; } // enemies close: fight them where they are
      // Crossbowmen keep back and shoot over the others
      if (g.typeId === "siege:crossbowman" || g.typeId === "siege:archer") {
        const out = gateOutside(defender, g.location);
        if (out && k && !isWalking(g)) {
          const dx = out.x - k.x, dz = out.z - k.z, d = Math.hypot(dx, dz) || 1;
          const line = { x: out.x + (dx / d) * 6 + ((s.rank % 5) - 2) * 2, y: out.y, z: out.z + (dz / d) * 6 };
          if (dist(g.location, line) > 3) walkTo(g, m.attacker, line, { noJump: true });
        }
        continue;
      }
      // everyone else: through the breach once there is one, otherwise at the gate
      if (!isWalking(g) && k) {
        const out = gateOutside(defender, g.location), gate = gateInside(defender);
        const dest = breach ?? (out && dist(g.location, out) > 6 ? out : (gate ?? k));
        if (dest) walkTo(g, m.attacker, { x: dest.x + 0.5, y: dest.y, z: dest.z + 0.5 }, { noJump: true });
      }
    } catch { /* fine */ }
  }
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

// The first opened hole in the wall (a trebuchet crew's first block, once it's gone): { x, y, z } or undefined
function breachOf(m) {
  for (const c of Object.values(m.crews ?? {})) {
    if (!c.base) continue;
    try { const b = dim().getBlock(c.base); if (b?.isAir) return { ...c.base }; } catch { /* unloaded */ }
  }
  return undefined;
}

// Knights stay on their horses and ride down the nearest enemy, archers first
function chargeKnights(m) {
  if (!m.teamB) return;
  for (const s of m.soldiers) {
    const g = entity(s.id), h = s.horse && entity(s.horse);
    if (!g || !h || !RIDER.has(g.typeId)) continue;
    try {
      const foes = dim().getEntities({ location: h.location, maxDistance: 32, tags: [m.teamB] });
      if (!foes.length) continue;
      const pick = foes.find((f) => /archer|crossbowman/.test(f.typeId)) ?? foes[0];
      const dx = pick.location.x - h.location.x, dz = pick.location.z - h.location.z, d = Math.hypot(dx, dz);
      if (d < 2.2) continue; // close enough: the Knight strikes
      const step = Math.min(0.9, d);
      placeOnTrail(g, h, { x: h.location.x + (dx / d) * step, y: h.location.y, z: h.location.z + (dz / d) * step }, { x: dx, z: dz });
    } catch { /* fine */ }
  }
}

// Defending Pikemen and Shieldbearers brace across the gate and any breach (from the inside); the rest fight as
// their posts say. "siege:brace" keeps siege/guards.js from calling them back while they hold.
const BRACERS = new Set(["siege:pikeman", "siege:shieldbearer"]);
function braceDefenders(guards, defender, attacker, breach) {
  const gate = gateInside(defender);
  const spots = [gate, breach].filter(Boolean);
  if (!spots.length) return;
  let n = 0;
  for (const g of guards) {
    if (!BRACERS.has(g.typeId)) continue;
    const at = spots[n % spots.length], k = Math.floor(n / spots.length);
    n++;
    const dest = { x: at.x + 0.5 + ((k % 3) - 1), y: at.y, z: at.z + 0.5 + Math.floor(k / 3) };
    try {
      g.setDynamicProperty("siege:brace", 1);
      if (dist(g.location, dest) > 1.5 && !isWalking(g)) walkTo(g, defender, dest, { noJump: true });
    } catch { /* fine */ }
  }
  void attacker;
}

// Muster (before nightfall): the crews already dismounted walk out and set up
export function musterTick(defender) {
  const m = marches.get(defender);
  if (m?.dismounted) crewTick(m, defender, false);
}

export function clearTeams(slot) {
  try { for (const e of dim().getEntities({ families: ["siege_guard"] })) if (e.getDynamicProperty("siege:brace")) { e.setDynamicProperty("siege:brace", undefined); cancelWalk(e.id); } } catch { /* fine */ }
  for (const side of ["a", "b"]) {
    const tag = teamTag(slot, side);
    try { for (const e of dim().getEntities({ tags: [tag] })) e.removeTag(tag); } catch { /* fine */ }
    for (const p of world.getPlayers()) try { p.removeTag(tag); } catch { /* fine */ }
  }
}

export const freeSlot = (writs) => {
  const used = new Set(Object.values(writs).map((w) => w.slot));
  for (let n = 0; n < WAR_SLOTS; n++) if (!used.has(n)) return n;
  return undefined;
};

