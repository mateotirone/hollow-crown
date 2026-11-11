// Every raised building stands on the highest ground under it, never half buried: the floor goes on the highest
// ground block the footprint covers, and every lower column is filled with the region's foundation stone down to
// the ground (the build engine's column stage does the filling, so it rises with the rest of the animation).
//
//   levelSite(dim, plan, origin, forward) -> { origin, lift }   origin moved to the highest ground (lift = blocks up)
//   foundationColumns(plan) -> columns to add to a build job (every footprint column, filled down to ground)

import { frameFor, toWorld } from "../townhall/halls.js";

const NOT_GROUND = /(air|water|lava|grass(?!_block|_path)|fern|flower|snow_layer|leaves|vine|bush|sapling|tallgrass|seagrass|kelp|dandelion|poppy|mushroom|lily|_log$|_wood$|deadbush|torch|lantern|sign|banner|carpet|rail)/;
export const MAX_LIFT = 12; // a cliff in the corner of a plot doesn't put the building on stilts in the sky

// The top ground block of a column, or undefined when it isn't loaded
export function groundTop(dim, x, z, from) {
  try {
    let block = from === undefined ? dim.getTopmostBlock({ x, z }) : dim.getBlock({ x, y: from, z });
    for (let i = 0; block && i < 64 && NOT_GROUND.test(block.typeId); i++) block = block.below();
    return block ? block.location.y : undefined;
  } catch {
    return undefined;
  }
}

// Plan footprint columns in plan coordinates (x, z over its bounds)
function* footprint(plan) {
  const b = plan.bounds();
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) yield [x, z];
}

// The floor (plan y = 0, world origin.y - 1) goes on the highest ground block under the footprint
export function levelSite(dim, plan, origin, forward) {
  const frame = frameFor(forward);
  const ceiling = origin.y - 1 + MAX_LIFT;
  let high;
  for (const [x, z] of footprint(plan)) {
    const at = toWorld(frame, origin, x, 0, z);
    const top = groundTop(dim, at.x, at.z, ceiling + 1);
    if (top !== undefined && (high === undefined || top > high)) high = top;
  }
  if (high === undefined) return { origin, lift: 0 };
  high = Math.max(origin.y - 1 - MAX_LIFT, Math.min(ceiling, high));
  return { origin: { x: origin.x, y: high + 1, z: origin.z }, lift: high + 1 - origin.y };
}

// One foundation column per footprint cell, from the floor row down to the ground
export const foundationColumns = (plan) => [...footprint(plan)].map(([x, z]) => ({ x, z, top: 0, role: "foundation" }));
