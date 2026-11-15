// The Tree of Oaths as its own object (Mateo 2026-11-14: "the table it's on sucks, let's make the entire thing its own
// object"). The siege:tree_of_oaths block stays where the hall design puts it (the "tree" mark): it is the anchor,
// the light, and what the guide and the labels know. Over it stands siege:oath_tree, a tree model on its own roots
// (studio/art/build_oath_tree.py). It grows with the hall (Mateo's pick): about 4.7 blocks tall over a 3 x 3 in the
// Longhouse and the Stone Hall, half as big again over a 5 x 5 from the Keep up. It wears the hall's look: plain, a
// Knight's banners or a Marked hall's ember cracks. Clicking it is clicking the Tree.
//   oathTreeSize(level) -> "small" | "grown"
//   placeOathTree(owner) -> true when the tree stands at the hall's mark

import { world, system } from "@minecraft/server";
import { on, onTick, addTests, assertEqual } from "../siege/api.js";
import { halls, hallOf, TREE } from "./townhall.js";
import { heroOf, playerById } from "./hero.js";
import { openTree } from "./tree.js";

export const OATH_TREE = "siege:oath_tree";
const TAG = "hc_oath_tree";
const GROWN = "hc_oath_tree_grown";
const ownTag = (owner) => `${TAG}_${owner}`;
const OVERWORLD = "minecraft:overworld";
const LOOKS = { none: 0, knight: 1, marked: 2 };

export const oathTreeSize = (level) => ((level ?? 0) >= 3 ? "grown" : "small");

const dimension = () => world.getDimension(OVERWORLD);
function treesOf(owner) {
  try { return dimension().getEntities({ type: OATH_TREE, tags: [ownTag(owner)] }); } catch { return []; }
}
function anchorOf(owner) {
  const at = hallOf(owner)?.marks?.tree;
  if (!at) return undefined;
  try {
    const block = dimension().getBlock(at);
    return block?.typeId === TREE ? block : undefined;
  } catch { return undefined; } // not loaded
}

export function placeOathTree(owner) {
  const hall = hallOf(owner);
  if (!hall?.level || hall.building || hall.lost) return false;
  const block = anchorOf(owner);
  const found = treesOf(owner);
  if (!block) { // no Tree block at the mark any more (the hall came down, or is being rebuilt): no tree
    for (const e of found) try { e.remove(); } catch { /* gone */ }
    return false;
  }
  const spot = { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 };
  let tree = found[0];
  for (const extra of found.slice(1)) try { extra.remove(); } catch { /* gone */ }
  if (!tree) {
    tree = dimension().spawnEntity(OATH_TREE, spot);
    tree.addTag(TAG);
    tree.addTag(ownTag(owner));
  } else if (Math.abs(tree.location.x - spot.x) > 0.2 || Math.abs(tree.location.z - spot.z) > 0.2 || Math.abs(tree.location.y - spot.y) > 0.2) {
    tree.teleport(spot);
  }
  const grown = oathTreeSize(hall.level) === "grown";
  if (grown !== tree.hasTag(GROWN)) {
    tree.triggerEvent(grown ? "siege:grow" : "siege:shrink");
    if (grown) tree.addTag(GROWN); else tree.removeTag(GROWN);
  }
  const player = playerById(owner);
  if (player) {
    const look = LOOKS[heroOf(player).path] ?? 0;
    try { if (tree.getProperty("siege:look") !== look) tree.setProperty("siege:look", look); } catch { /* an older pack */ }
  }
  return true;
}

// Clicking the tree is clicking the Tree of Oaths block under it
const lastClick = new Map();
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== OATH_TREE) return;
  event.cancel = true;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 8) return;
  lastClick.set(player.id, now);
  const owner = target.getTags().find((t) => t.startsWith(`${TAG}_`))?.slice(TAG.length + 1);
  system.run(() => {
    const block = owner && anchorOf(owner);
    if (block) openTree(player, block);
  });
});

// A hall finished, or a road chosen at the Tree: stand it (or dress it) now rather than at the next pass
on("hallBuilt", ({ owner }) => system.runTimeout(() => { try { placeOathTree(owner); } catch { /* next pass */ } }, 20));
on("pathChosen", ({ player }) => system.runTimeout(() => { try { if (player?.id) placeOathTree(player.id); } catch { /* next pass */ } }, 10));

// Keep every hall's tree standing (and the right size and look) while somebody is near enough to see it
onTick("oath_tree", 60, () => {
  const players = world.getPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  for (const [owner, hall] of Object.entries(halls())) {
    const at = hall?.marks?.tree;
    if (!at || !players.some((p) => Math.hypot(p.location.x - at.x, p.location.z - at.z) < 80)) continue;
    try { placeOathTree(owner); } catch (e) { console.warn(`[Town Hall] oath tree: ${e}`); }
  }
});

addTests("oath_tree", {
  "the Tree of Oaths grows with the hall": () => {
    assertEqual(oathTreeSize(1), "small", "Longhouse");
    assertEqual(oathTreeSize(2), "small", "Stone Hall");
    assertEqual(oathTreeSize(3), "grown", "Keep");
    assertEqual(oathTreeSize(5), "grown");
    assertEqual(oathTreeSize(undefined), "small");
  },
});
