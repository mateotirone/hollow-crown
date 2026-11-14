// A Siege Workshop comes with every new settlement (new-player audit, Mateo 2026-11-13): it stands in the Mason's
// Yard beside the bench, so the first castle crafts don't wait on mining iron. One per settlement, once.
//
// Test: /scriptevent siege:yard_workshop   put your settlement's free Workshop where you stand (if it never got one)

import { world, system, BlockPermutation } from "@minecraft/server";
import { on, moduleStore } from "../siege/api.js";

const WORKSHOP = "siege:workshop";
const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:newplayer_workshop", () => ({ placed: {} })); // owner -> { x, y, z }

// A free floor spot next to the bench, beside it rather than in front, so the mason's own spot stays clear
export function besideBench(bench, forward) {
  const side = { x: -forward.z, z: forward.x };
  return [
    { x: bench.x + side.x * 2, z: bench.z + side.z * 2 }, { x: bench.x - side.x * 2, z: bench.z - side.z * 2 },
    { x: bench.x + side.x, z: bench.z + side.z }, { x: bench.x - side.x, z: bench.z - side.z },
    { x: bench.x + side.x * 2 + forward.x, z: bench.z + side.z * 2 + forward.z },
  ].map((p) => ({ ...p, y: bench.y }));
}

function placeAt(dim, spots) {
  for (const s of spots) {
    for (const y of [s.y, s.y + 1, s.y - 1]) {
      const b = dim.getBlock({ x: s.x, y, z: s.z });
      const below = dim.getBlock({ x: s.x, y: y - 1, z: s.z });
      if (b?.isAir && below && !below.isAir && below.typeId !== WORKSHOP) {
        b.setPermutation(BlockPermutation.resolve(WORKSHOP));
        return { x: s.x, y, z: s.z };
      }
    }
  }
  return undefined;
}

on("settleBuilt", ({ owner, building, marks, forward }) => {
  if (building !== "mason_yard" || !marks?.bench || store.data.placed[owner]) return;
  system.runTimeout(() => {
    try {
      const at = placeAt(world.getDimension(OVERWORLD), besideBench(marks.bench, forward ?? { x: 0, z: 1 }));
      if (!at) return;
      store.data.placed[owner] = at;
      store.save();
      world.getPlayers().find((p) => p.id === owner)?.sendMessage(
        "§6A Siege Workshop stands in the Mason's Yard.§7 Open it like a crafting table: Barracks, walls, gates and siege machines are made there.");
    } catch (e) { console.warn(`[Hollow Crown] yard workshop: ${e}`); }
  }, 30);
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:yard_workshop") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (store.data.placed[player.id] && e.message.trim() !== "again") return player.sendMessage("§7Your settlement already has its free Workshop. Add \"again\" to place another.");
  const l = player.location;
  const at = placeAt(player.dimension, [{ x: Math.floor(l.x) + 1, y: Math.floor(l.y), z: Math.floor(l.z) }, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) + 1 }]);
  if (at) { store.data.placed[player.id] = at; store.save(); }
  player.sendMessage(at ? "§6Siege Workshop placed." : "§cNo room for it here.");
});

export const yardWorkshop = (owner) => store.data.placed[owner];
