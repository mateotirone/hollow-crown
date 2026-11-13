// Boss sites baked into the base map (Mateo 2026-11-13: the boss locations are physical places from the start).
// genworld.py writes baked_sites.js; a site whose check cells are really in this world is adopted as it stands (its
// centre and puzzle seed taken from the bake, then only signs, keepers and fights are added when a player comes
// near). Any other world (an older map, a test world) builds the site on approach as before. Pure: no game imports.

import { BAKED_SITES } from "./baked_sites.js";

/** The bake for a site, or undefined if there is none or it was made for another anchor. */
export function bakedFor(id, anchor) {
  const b = BAKED_SITES[id];
  if (!b || !anchor || b.anchor?.x !== anchor.x || b.anchor?.z !== anchor.z) return undefined;
  return b;
}

/**
 * Is the bake really standing here? typeAt(x, y, z) -> block type id, or undefined if that chunk is not loaded.
 * "yes" (every check cell loaded and at least all but one match), "wait" (some not loaded), "no".
 */
export function bakedState(bake, typeAt) {
  if (!bake?.check?.length) return "no";
  let hit = 0;
  for (const [dx, dy, dz, block] of bake.check) {
    const t = typeAt(bake.center.x + dx, bake.center.y + dy, bake.center.z + dz);
    if (t === undefined) return "wait";
    if (t === block) hit++;
  }
  return hit >= bake.check.length - 1 ? "yes" : "no";
}
