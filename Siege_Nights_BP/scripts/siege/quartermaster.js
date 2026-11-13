// The Quartermaster: a villager who takes the desk as their job.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world } from "@minecraft/server";
import { DESK, QUARTERMASTER } from "./constants.js";
import { forEachMachine } from "./placement.js";
import { sfx } from "../core/sfx.js";

// ---------- Quartermaster: a villager who takes the desk as their job ----------

export function quartermasterTick() {
  // Unemployed villagers standing at a free desk take the job
  forEachMachine(DESK, (block, dim) => {
    const t = block.location;
    const center = { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
    if (dim.getEntities({ type: QUARTERMASTER, location: center, maxDistance: 8 }).length > 0) return;
    // An unemployed villager nearby takes the job; on the map, where no villagers live, one turns up by himself
    // (new-player audit, Mateo 2026-11-13: the desk was a dead end without villagers)
    const recruit = dim.getEntities({ type: "minecraft:villager_v2", families: ["unskilled"], location: center, maxDistance: 3 })[0];
    let at, name;
    if (recruit) {
      at = { ...recruit.location };
      name = recruit.nameTag;
      recruit.remove();
    } else {
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => {
        const b = dim.getBlock({ x: t.x + dx, y: t.y, z: t.z + dz });
        return b?.isAir && dim.getBlock({ x: t.x + dx, y: t.y + 1, z: t.z + dz })?.isAir;
      });
      if (!side) return;
      at = { x: t.x + side[0] + 0.5, y: t.y, z: t.z + side[1] + 0.5 };
    }
    const qm = dim.spawnEntity(QUARTERMASTER, at);
    if (name) qm.nameTag = name;
    qm.setDynamicProperty("siege:desk", JSON.stringify({ x: t.x, y: t.y, z: t.z }));
    dim.spawnParticle("minecraft:villager_happy", { x: at.x, y: at.y + 1.8, z: at.z });
    sfx(dim, "random.levelup", at, { volume: 0.6 });
    for (const p of dim.getPlayers({ location: at, maxDistance: 16 })) {
      p.sendMessage("§6A villager has taken the post of Quartermaster! Spend your siege winnings with them.");
    }
  });

  // A quartermaster whose desk is broken goes back to being a plain villager
  const dim = world.getDimension("overworld");
  for (const qm of dim.getEntities({ type: QUARTERMASTER })) {
    try {
      const desk = JSON.parse(qm.getDynamicProperty("siege:desk") ?? "null");
      if (!desk) continue;
      const block = dim.getBlock(desk);
      if (!block || block.typeId === DESK) continue;
      const villager = dim.spawnEntity("minecraft:villager_v2", qm.location);
      if (qm.nameTag) villager.nameTag = qm.nameTag;
      qm.remove();
    } catch {
      // desk chunk not loaded; check again later
    }
  }
}
