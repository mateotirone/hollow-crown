// The founder's chest (new-player audit, Mateo 2026-11-13): the map's old trees can't be felled and a new player
// starts with no Regals, so nothing could be crafted at all. When a founder's own cottage is finished, a chest in it
// is filled once with what the first days need: logs and saplings of the region's wood, a stone pickaxe and axe,
// bread, torches and a few Regals.
//
// Test: /scriptevent siege:founder_chest   fill the chest in your founder's house again (or put one at your feet)

import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { on, moduleStore, addTests, assert } from "../siege/api.js";
import { townOf } from "../settle/founding.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:newplayer_founder", () => ({ given: {} })); // owner id -> day the chest was filled

// The region's own wood: [log, sapling]
export const WOOD = {
  vale: ["oak_log", "oak_sapling"], frostmarch: ["spruce_log", "spruce_sapling"], saltreach: ["birch_log", "birch_sapling"],
  emberwaste: ["acacia_log", "acacia_sapling"], blackfen: ["dark_oak_log", "dark_oak_sapling"],
};
export const COINS = 48; // one siege win's worth: a Woodcutter's planks, a Smith's sword, or most of a guard

// What goes in the chest: [item id, count]
export function founderKit(style) {
  const [log, sapling] = WOOD[style] ?? WOOD.vale;
  return [
    [`minecraft:${log}`, 16], [`minecraft:${sapling}`, 4], ["minecraft:stone_pickaxe", 1], ["minecraft:stone_axe", 1],
    ["minecraft:bread", 8], ["minecraft:torch", 16], ["siege:coin", COINS],
  ];
}

function chestIn(dim, box, y0) {
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) for (let y = y0; y <= y0 + 8; y++) {
    const b = dim.getBlock({ x, y, z });
    if (b?.typeId === "minecraft:chest") return b;
  }
  return undefined;
}

function chestBeside(dim, bed) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]]) {
    const b = dim.getBlock({ x: bed.x + dx, y: bed.y, z: bed.z + dz });
    if (b?.typeId === "minecraft:air" && dim.getBlock({ x: bed.x + dx, y: bed.y - 1, z: bed.z + dz })?.isSolid) {
      b.setPermutation(BlockPermutation.resolve("minecraft:chest"));
      return b;
    }
  }
  return undefined;
}

export function fillChest(block, style) {
  const inv = block?.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (const [id, n] of founderKit(style)) {
    try {
      const left = inv.addItem(new ItemStack(id, n));
      if (left) block.dimension.spawnItem(left, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
    } catch { /* an item this build doesn't know */ }
  }
  return true;
}

function giveFor(owner, st, style) {
  const dim = world.getDimension(OVERWORLD);
  const box = st.box, y0 = st.origin?.y ?? st.ownerBed?.y ?? 0;
  const block = (box && chestIn(dim, box, y0 - 1)) ?? (st.ownerBed && chestBeside(dim, st.ownerBed));
  if (!fillChest(block, style)) return false;
  store.data.given[owner] = Math.floor(world.getAbsoluteTime() / 24000);
  store.save();
  world.getPlayers().find((p) => p.id === owner)?.sendMessage(
    "§6A founder's chest waits in your house:§7 logs and saplings, a stone pickaxe and axe, bread, torches and a few Regals. The old trees out there can't be felled: plant the saplings for more wood.");
  return true;
}

// After the founder's cottage is up and its bed is in (settle/basebuilds.js does the bed on the same event)
on("settleBuilt", ({ owner, building, slotId }) => {
  if (building !== "cottage" || store.data.given[owner] !== undefined) return;
  const town = townOf(owner);
  const st = slotId && town?.slots[slotId];
  if (!st?.founderHome) return;
  let tries = 0;
  const go = () => {
    try { if (giveFor(owner, st, town.style)) return; } catch (e) { console.warn(`[Hollow Crown] founder chest: ${e}`); }
    if (++tries < 10) system.runTimeout(go, 40);
  };
  system.runTimeout(go, 40);
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:founder_chest") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const town = townOf(player.id);
  const st = town && Object.values(town.slots).find((s) => s.founderHome);
  let ok = false;
  try { ok = st ? giveFor(player.id, st, town.style) : false; } catch { /* not loaded */ }
  if (!ok) {
    const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
    const b = player.dimension.getBlock(at);
    if (b) { b.setPermutation(BlockPermutation.resolve("minecraft:chest")); ok = fillChest(b, town?.style ?? "vale"); }
  }
  player.sendMessage(ok ? "§6Founder's chest filled." : "§cNo founder's house loaded, and no room for a chest here.");
});

addTests("newplayer founder", {
  "every region's founder's kit has wood, saplings, a pickaxe and coins": () => {
    for (const style of Object.keys(WOOD)) {
      const kit = founderKit(style).map(([id]) => id);
      assert(kit.some((id) => id.endsWith("_log")) && kit.some((id) => id.endsWith("_sapling")), `${style}: wood`);
      assert(kit.includes("minecraft:stone_pickaxe") && kit.includes("siege:coin"), `${style}: pickaxe and coins`);
    }
  },
});
