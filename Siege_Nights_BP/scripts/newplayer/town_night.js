// Act 2, part 7: the Town night. On the first full siege night after the herald (reach/index.js stages the 3:17
// toll and the army stopping), a settlement at this step gets no Hollow soldiers. One tall one walks up the gate
// road, stands outside the gate and looks at the wall for a while, then walks back the way it came. It does not
// fight. Walk up to it and it is not there any more. In the morning Old Elspeth says "Build higher" (act2.js).
//   walkTall(owner) -> true when it set out (the settlement needs a wall with a gate)

import { world, system } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { wallRing } from "../settle/walls.js";
import { roadFrom, roadPoint, yawToward, groundY, playersNear } from "./family.js";

const OVERWORLD = "minecraft:overworld";
export const TALL_TAG = "hc_town_night_tall";
// t is blocks out from the gate along the road: it comes from FROM, stops at TO, looks for LOOK ticks, goes back
export const WALK = { from: 34, to: 8, speed: 0.12, look: 200, flees: 6 };

const walkers = new Map(); // owner -> { road, t, phase: "in" | "look" | "out", left }
const dimension = () => world.getDimension(OVERWORLD);

// One step of the walk: where it is next, and what it is doing. Pure, for the tests.
export function stepWalk(w) {
  if (w.phase === "in") {
    const t = Math.max(WALK.to, w.t - WALK.speed);
    return t === WALK.to ? { ...w, t, phase: "look", left: WALK.look } : { ...w, t };
  }
  if (w.phase === "look") return w.left > 1 ? { ...w, left: w.left - 1 } : { ...w, phase: "out" };
  const t = w.t + WALK.speed;
  return t >= WALK.from ? { ...w, t, phase: "gone" } : { ...w, t };
}

function entityOf(owner) {
  try { return dimension().getEntities({ tags: [TALL_TAG, `${TALL_TAG}_${owner}`] })[0]; } catch { return undefined; }
}
function vanish(owner) {
  const e = entityOf(owner);
  walkers.delete(owner);
  if (!e) return;
  try {
    for (let i = 0; i < 6; i++) dimension().spawnParticle("minecraft:large_smoke_particle", { x: e.location.x + (Math.random() - 0.5), y: e.location.y + 1 + i * 0.5, z: e.location.z + (Math.random() - 0.5) });
  } catch { /* not loaded */ }
  try { e.remove(); } catch { /* gone */ }
}

export function walkTall(owner) {
  const ring = wallRing(owner);
  if (!ring?.gate) return false;
  vanish(owner);
  const road = roadFrom(ring.gate);
  const at = roadPoint(road, WALK.from);
  const y = groundY(dimension(), at.x, at.z, road.y);
  if (y === undefined) return false;
  try {
    const e = dimension().spawnEntity("siege:veinsworn", { x: at.x, y, z: at.z });
    e.addTag(TALL_TAG);
    e.addTag(`${TALL_TAG}_${owner}`);
    try { e.triggerEvent("siege:make_tall"); } catch { /* an older pack: an ordinary-sized one */ }
    for (const fx of ["slowness", "weakness", "resistance"]) e.addEffect(fx, 20 * 600, { amplifier: 255, showParticles: false });
    e.teleport({ x: at.x, y, z: at.z }, { rotation: { x: 0, y: road.yaw } });
  } catch (err) { console.warn(`[Act 2] Town night: ${err}`); return false; }
  walkers.set(owner, { road, t: WALK.from, phase: "in", left: 0 });
  return true;
}

onTick("act2_town_night", 1, () => {
  for (const [owner, w] of walkers) {
    try {
      const e = entityOf(owner);
      if (!e) { walkers.delete(owner); continue; }
      if (playersNear(e.location, WALK.flees).length) { vanish(owner); continue; } // seen up close: gone
      const next = stepWalk(w);
      if (next.phase === "gone") { vanish(owner); continue; }
      walkers.set(owner, next);
      const at = roadPoint(w.road, next.t);
      const y = groundY(dimension(), at.x, at.z, e.location.y) ?? e.location.y;
      const yaw = next.phase === "out" ? yawToward(w.road.dx, w.road.dz) : w.road.yaw;
      e.teleport({ x: at.x, y, z: at.z }, { rotation: { x: 0, y: yaw } });
    } catch (err) { console.warn(`[Act 2] Town night walk: ${err}`); vanish(owner); }
  }
});
// After a reload nothing is walking: anything left standing goes
system.runTimeout(() => {
  try { for (const e of dimension().getEntities({ tags: [TALL_TAG] })) e.remove(); } catch { /* not loaded */ }
}, 100);

addTests("act2_town_night", {
  "Act 2: the tall one walks up, looks at the wall, and walks back": () => {
    let w = { road: {}, t: WALK.from, phase: "in", left: 0 };
    let n = 0;
    while (w.phase === "in" && n++ < 1000) w = stepWalk(w);
    assertEqual(w.phase, "look", "it stops at the gate");
    assertEqual(w.t, WALK.to);
    while (w.phase === "look" && n++ < 2000) w = stepWalk(w);
    assertEqual(w.phase, "out");
    while (w.phase === "out" && n++ < 3000) w = stepWalk(w);
    assertEqual(w.phase, "gone", "and goes back the way it came");
    assert(n < 3000, "in a finite walk");
  },
});
