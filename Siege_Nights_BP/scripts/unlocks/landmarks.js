// The big exterior landmark round each boss unlock site (drawn by the world builds thread with the minecraft-builder
// skill). Each entry is a stamp in the "hollow-crown-stamp/1" format (Blueprint.save_json): offsets from the site's
// centre, which is the same centre the site's plan uses (plans.js; see spots.json from map/structures/boss_unlock_sites.py).
// The landmark is placed first and the site's own plan on top, so it can never cover a cell the boss code relies on.
// Keep a landmark within about 60 blocks of the centre: that is what the build's ticking area holds loaded.
//
//   import cradle from "./landmarks/mother.js";   export const LANDMARKS = { mother: cradle };

export const LANDMARKS = {};

/** A stamp as plan ops ({ dx, dy, dz, block, states }), with air last so it carves after it builds. */
export function stampOps(stamp) {
  if (!stamp?.blocks) return [];
  const o = stamp.origin ?? [0, 0, 0];
  const ops = stamp.blocks.map(([x, y, z, i]) => {
    const p = stamp.palette[i];
    return { dx: x + o[0], dy: y + o[1], dz: z + o[2], block: p.name, states: p.states && Object.keys(p.states).length ? p.states : undefined };
  }).filter((op) => op.block !== "minecraft:structure_void");
  return [...ops.filter((op) => op.block !== "minecraft:air"), ...ops.filter((op) => op.block === "minecraft:air")];
}
