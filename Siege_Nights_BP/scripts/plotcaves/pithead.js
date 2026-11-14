// The plot mine's pithead: the collar, headframe and sheave, winding drum and house, ore bin, spoil heap and pit bell
// over every plot's shaft (Mateo 2026-11-14: "redo the 3D build of the mine"), drawn with the building skill in every
// region's look (pithead_data.js, written by map/structures/pithead/export.py). Raised once by the build engine
// (townhall/build.js) on a terraformed pad (settle/ground.js Groundwork), its front towards the plot's Plot Stone.
// Pure code, loads in Node too.

import { Plan, frameFor } from "../townhall/halls.js";
import { drawData } from "../townhall/designs.js";
import { idSpellings } from "../core/blockids.js";
import { PITHEADS } from "./pithead_data.js";

export const PIT_VERSION = 1; // raise to raise every pithead again
const plans = new Map();

/** The pithead of a region as a build Plan, with its own style (one role per palette entry). */
export function pitheadPlan(region) {
  const r = PITHEADS[region] ? region : "vale";
  if (!plans.has(r)) {
    const d = PITHEADS[r], prefix = `pit:${r}`;
    const style = { name: `pithead ${r}`, roles: {} };
    d.palette.forEach(([id], i) => { style.roles[`${prefix}:${i}`] = idSpellings(id); });
    const p = new Plan(style);
    drawData(p, d, prefix);
    plans.set(r, p);
  }
  return plans.get(r);
}

/** Which way the pithead faces for a shaft at (x, z) of a plot whose stone is at (px, pz): forward runs into it, away
 *  from the stone; front is the shaft's side towards the stone (its ladder and the gap in the collar's parapet). */
export function pitheadFacing(site, stone) {
  const dx = site.x - (stone?.x ?? site.x), dz = site.z - (stone?.z ?? site.z - 1);
  const forward = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
  return { forward, front: [-forward.x, -forward.z] };
}

/** The build origin that puts the design's shaft mark on the shaft (toWorld: origin.y - 1 + y, so y 0 is the ground). */
export function pitheadOrigin(site, forward, region) {
  const [mx, , mz] = (PITHEADS[region] ?? PITHEADS.vale).marks.shaft;
  const { F, R } = frameFor(forward);
  return { x: site.x - (mx * R.x + mz * F.x), y: site.y + 1, z: site.z - (mx * R.z + mz * F.z) };
}
