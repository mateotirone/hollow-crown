// The siege drill: the army that comes up the road fights as one force, not as a crowd.
// Mateo 2026-11-16, watching a siege night in the Town Builder: "theres no coordination with the troops theyre just
// wandering". Before this, every raider was only nudged toward the keep and stood about under a shut gate.
//
// The force at the gate (GATE_TAG, warplan.js assaultSpot) goes through three stages:
//   form    each wave forms up in ranks on the road for a few seconds, out of the gateway: the line in front, shooters behind it,
//           the warlord at the back
//   breach  while the gateway is shut: rams and sappers go to the gate, the line closes up behind them, shooters hold
//           further back (their own aim does the rest). With no ram or sapper left, the front of the line batters the
//           gate itself, so a first siege on a gated wall is not a crowd that can never get in.
//   storm   the gateway is open (an open gap, a gate broken, opened or raised): everyone goes in along the road as a
//           column, and breaks up to fight when it nears the keep
// Between orders a raider in the ranks is rooted (slowness), or its own targeting walks it off to stand under the
// nearest archer on the wall; it still turns, shoots and is moved by its orders. One with someone to fight close by
// (a player, a soldier who sallied out) is left to fight. Raiders sent round to a weak side are not drilled.
//
// drillRole, rankSlot, drillStage and drillPoint are pure (tested in tests.js); the rest reads the world.

import { GATE_TAG, RAIDER_TAG, RAM_TAG, SAPPER_TAG, WARLORD_TAG, KING_TAG } from "./constants.js";
import { state } from "./state.js";
import { overworld, ownerOf } from "./util.js";
import { hitWall } from "./walls.js";
import { sfx } from "../core/sfx.js";

export const DRILL = {
  every: 5, // ticks between orders
  formTicks: 160, // a wave holds its ranks this long before it closes on a shut gate
  formOut: 16, // blocks out from the gateway to the front rank
  coverOut: 5, // the line waits this far out while the breachers work
  shootersBack: 6, // shooters stand this far behind the line's front rank
  across: 5, rankGap: 2, // ranks of five, two blocks apart each way
  push: 0.22, // the shove of one order (the march's is 0.3 every 40 ticks)
  rooted: 9, rootTicks: 12, // slowness that keeps a raider from walking off on its own between orders (it can still turn, shoot and be shoved)
  hold: 1.3, // close enough to a place in the ranks
  charge: 0.3, stride: 4, release: 16, // the storm: the shove, how far ahead each order points, and how near the keep the column breaks up to fight
  hop: 0.42, // a jump, for a raider an order didn't move
  batterReach: 2.6, batter: 0.25, batterers: 4, // how near the gate, damage a raider a second, how many count
  fightRange: 6, // someone to fight this close: left alone
};

const SHOOTER = /bow|caster|mage|pillager|skeleton|stray|sling|crossbow/;
// What a raider does in the drill: "breacher" | "shooter" | "lord" | "line"
export function drillRole(typeId, tags) {
  if (tags.includes(RAM_TAG) || tags.includes(SAPPER_TAG)) return "breacher";
  if (tags.includes(WARLORD_TAG) || tags.includes(KING_TAG)) return "lord";
  return SHOOTER.test(typeId) ? "shooter" : "line";
}

// Place n in ranks of DRILL.across: { back, across } blocks from the middle of the front rank
export function rankSlot(n, { across = DRILL.across, gap = DRILL.rankGap } = {}) {
  const col = n % across;
  // fill a rank from the middle out: 0, +1, -1, +2, -2
  const side = col === 0 ? 0 : (col % 2 ? 1 : -1) * Math.ceil(col / 2);
  return { back: Math.floor(n / across) * gap, across: side * gap };
}

// The stage one raider is in. open: the gateway can be walked through; age: ticks since it joined the force
export function drillStage({ open, age }) {
  if (age < DRILL.formTicks) return "form"; // every wave forms up first, even before an open gateway
  return open ? "storm" : "breach";
}

// Where a raider should be: { out, across } blocks from the gateway (out along the road), or "gate" (go at the gate),
// or undefined (storm: the march takes it through).
//   n: its number among its own kind in the force; lineRanks: ranks the line takes up; breachers: any still alive
export function drillPoint(role, stage, n, { lineRanks = 1, breachers = true } = {}) {
  if (stage === "storm") return undefined;
  const s = rankSlot(n);
  const behindLine = lineRanks * DRILL.rankGap;
  if (stage === "form") {
    if (role === "breacher") return { out: DRILL.formOut - 2, across: s.across }; // in front, ready to go
    if (role === "line") return { out: DRILL.formOut + s.back, across: s.across };
    if (role === "shooter") return { out: DRILL.formOut + behindLine + s.back, across: s.across };
    return { out: DRILL.formOut + behindLine + DRILL.shootersBack, across: 0 };
  }
  if (role === "breacher") return "gate";
  if (role === "line") return !breachers && n < DRILL.batterers ? "gate" : { out: DRILL.coverOut + s.back, across: s.across };
  if (role === "shooter") return { out: DRILL.coverOut + behindLine + DRILL.shootersBack + s.back, across: s.across };
  return { out: DRILL.coverOut + behindLine + DRILL.shootersBack + 4, across: 0 };
}

// The storm goes in as a column along the road: the next place to make for, from where a raider is ({ out, across }
// from the gateway, out < 0 is inside). Outside and off the road it first comes onto the road short of the wall, so
// nobody is shoved into the wall beside the gateway. Returns undefined once it is at stopOut: there the column breaks up.
export function stormPoint(out, across, stopOut) {
  if (out <= stopOut) return undefined;
  if (out > 1 && Math.abs(across) > 1.2) return { out: Math.max(out - DRILL.stride, 2.5), across: 0 };
  return { out: Math.max(out - DRILL.stride, stopOut), across: 0 };
}

// ---------- the world side ----------

// The blocks that bar the gateway, the outermost and lowest first (empty when it can be walked through; undefined when
// it isn't loaded). The gateway is three wide and as deep as the wall is thick: the gate hangs somewhere in that depth
// (the gate spot is the inner face), so each of its three lanes is looked along from inside the wall to outside it.
// It is open when one lane has two blocks of air to walk through all the way.
const GATE_DEPTH = [-2, 5];
function gatewayBars(dim, g) {
  const bars = [];
  for (const k of [0, 1, -1]) {
    const lane = [];
    for (let d = GATE_DEPTH[1]; d >= GATE_DEPTH[0]; d--) {
      const x = g.x + g.ox * d - g.oz * k, z = g.z + g.oz * d + g.ox * k;
      for (const y of [g.y + 1, g.y + 2]) {
        const b = dim.getBlock({ x, y, z });
        if (!b) return undefined;
        if (!b.isAir && !b.isLiquid && !SOFT.test(b.typeId)) lane.push(b);
      }
    }
    if (!lane.length) return [];
    bars.push(...lane);
  }
  return bars;
}
// what stands in a gateway without barring it (a step of ground counts as barring only if it is two high, which the
// two-block look already means; plants and snow never do)
const SOFT = /grass$|short_grass|fern|flower|snow_layer|carpet|torch|lantern|dandelion|poppy|deadbush|rail$|path$/;

const joined = new Map(); // raider id -> the tick it joined the force
const lastLeft = new Map(); // raider id -> how far it had left to go at its last order
const held = new Set(); // raiders the drill is holding in place this pass (the march leaves them alone, siege.js)
export const drillHolds = (raider) => held.has(raider.id);
let batterTurn = 0;

export function drillTick(now) {
  held.clear();
  if (!state?.active) { joined.clear(); lastLeft.clear(); return; }
  const dim = overworld();
  for (const [owner, plan] of Object.entries(state.plans ?? {})) {
    const g = plan?.gate;
    if (!g || !Number.isFinite(g.y)) continue;
    let force;
    try {
      force = dim.getEntities({ tags: [RAIDER_TAG, GATE_TAG] }).filter((r) => ownerOf(r) === owner);
    } catch { continue; }
    const outOf = (r) => (r.location.x - (g.x + 0.5)) * g.ox + (r.location.z - (g.z + 0.5)) * g.oz;
    const acrossOf = (r) => -(r.location.x - (g.x + 0.5)) * g.oz + (r.location.z - (g.z + 0.5)) * g.ox;
    // the road runs on from the gateway toward the keep: the column keeps to it until it is this near the keep
    const keep = state.keeps?.[owner];
    const keepOut = keep ? (keep.x - g.x) * g.ox + (keep.z - g.z) * g.oz : -20;
    const stopOut = Math.min(-2, keepOut + DRILL.release);
    if (!force.length) continue;
    let bars;
    try { bars = gatewayBars(dim, g); } catch { bars = undefined; }
    if (!bars) continue;
    const open = bars.length === 0;
    if (open && !plan.stormed) {
      plan.stormed = true;
      const lord = dim.getPlayers().find((p) => p.id === owner);
      lord?.onScreenDisplay.setActionBar("§cThe gateway is open. They are coming through!");
    }
    if (!open) plan.stormed = false;
    force.sort((a, b) => (a.id < b.id ? -1 : 1)); // the same raider keeps the same place
    // shut: only those still outside are drilled (one who got in another way fights on). Open: the whole column.
    // (inside, only those still on the road: one that has turned off it among the houses finds its own way)
    force = force.filter((r) => { const out = outOf(r); return out > 1 || (open && out > stopOut && Math.abs(acrossOf(r)) <= 6); });
    const members = force.map((r) => ({ r, role: drillRole(r.typeId, r.getTags()) }));
    const breachers = members.some((m) => m.role === "breacher");
    const lineRanks = Math.max(1, Math.ceil(members.filter((m) => m.role === "line").length / DRILL.across));
    const count = { breacher: 0, line: 0, shooter: 0, lord: 0 };
    const atGate = [];
    for (const { r, role } of members) {
      if (!joined.has(r.id)) joined.set(r.id, now);
      const stage = drillStage({ open, age: now - joined.get(r.id) });
      const want = drillPoint(role, stage, count[role]++, { lineRanks, breachers });
      let tx, tz, push = DRILL.push;
      if (want === undefined) { // storm: in along the road as a column
        const to = stormPoint(outOf(r), acrossOf(r), stopOut);
        if (!to) continue;
        tx = g.x + 0.5 + g.ox * to.out; tz = g.z + 0.5 + g.oz * to.out; push = DRILL.charge;
      } else if (want === "gate") {
        tx = g.x + 0.5 + g.ox * 1.2; tz = g.z + 0.5 + g.oz * 1.2;
        if (role === "line") atGate.push(r);
      } else {
        tx = g.x + 0.5 + g.ox * want.out - g.oz * want.across;
        tz = g.z + 0.5 + g.oz * want.out + g.ox * want.across;
      }
      held.add(r.id);
      try {
        // someone to fight right here (a player, a soldier who sallied out): it is left to fight
        if (dim.getPlayers({ location: r.location, maxDistance: DRILL.fightRange }).length) continue;
        if (dim.getEntities({ location: r.location, maxDistance: 4, type: "siege:man_at_arms" }).length) continue;
        // Its own wish to walk at the nearest defender (under the wall, out of the ranks) is held down; orders move it
        r.addEffect("slowness", DRILL.rootTicks, { amplifier: DRILL.rooted, showParticles: false });
        const dx = tx - r.location.x, dz = tz - r.location.z, d = Math.hypot(dx, dz);
        if (d < DRILL.hold && want !== undefined) { lastLeft.delete(r.id); continue; }
        const k = Math.min(push, d * 0.12) / d;
        // a rooted raider can't jump by itself: one that an order didn't move (a step in the ground, a comrade) hops
        const stuck = (lastLeft.get(r.id) ?? Infinity) - d < 0.08 && r.isOnGround;
        lastLeft.set(r.id, d);
        r.applyImpulse({ x: dx * k, y: stuck ? DRILL.hop : 0, z: dz * k });
      } catch { /* unloaded or gone */ }
    }
    // no ram, no sapper: the front of the line batters the gate, once a second
    if (!open && !breachers && atGate.length && now - batterTurn >= 20) {
      const near = atGate.filter((r) => Math.hypot(r.location.x - (g.x + 0.5), r.location.z - (g.z + 0.5)) <= DRILL.batterReach);
      if (near.length) {
        try {
          sfx(dim, "random.door_close", bars[0].location, { volume: 0.9, pitch: 0.5 });
          hitWall(bars[0], DRILL.batter * Math.min(near.length, DRILL.batterers));
        } catch { /* unloaded */ }
      }
    }
  }
  if (now - batterTurn >= 20) batterTurn = now;
  if (joined.size > 400) for (const id of [...joined.keys()].slice(0, 200)) joined.delete(id);
}
