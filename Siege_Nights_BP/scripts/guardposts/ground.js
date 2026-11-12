// Finding the spot a guard stands on: looking down from a height for ground with two free blocks over it.

import { world, system } from "@minecraft/server";

const dim = () => world.getDimension("minecraft:overworld");

// The block a guard stands in at a post: looking down from p.from for ground with two free blocks over it.
// undefined while that ground isn't loaded.
const OPEN = /(air|grass$|short_grass|tall_grass|fern|flower|snow_layer|tallgrass|dandelion|poppy|sapling|torch|carpet|button|pressure_plate|rail|vine|bush|deadbush)/;
const standCache = new Map(); // "x,z,from" -> { y, tick }
export function standY(x, z, from) {
  const key = `${x},${z},${from}`;
  const hit = standCache.get(key);
  if (hit && system.currentTick - hit.tick < 200) return hit.y;
  let y;
  try {
    let freeAbove = 0;
    for (let at = from + 2; at >= from - 24; at--) {
      const block = dim().getBlock({ x, y: at, z });
      if (!block) return undefined;
      const open = block.isAir || OPEN.test(block.typeId);
      if (!open && !block.isLiquid && freeAbove >= 2) { y = at + 1; break; }
      freeAbove = open ? freeAbove + 1 : 0;
    }
  } catch {
    return undefined;
  }
  standCache.set(key, { y, tick: system.currentTick });
  return y;
}
