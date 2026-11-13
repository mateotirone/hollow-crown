// The Hollow's mood changes from place to place (Mateo, 2026-11-13). The base fog, specks, motes, clouds and
// the endless storm live in index.js ("undertow:sky"); this file only says how each place bends them:
//   the Wound          a thicker violet haze where you arrive, more specks hanging in it
//   the Drowned Court  a cold blue-grey haze over the Court and the drowned towers, more glow off the water
//   the Seat           still and quiet: thinner, darker air, specks that barely move, no clouds, no thunder
//   the light rivers   a brighter glow rising off the water when you are near one
// Each place has a core (full strength) and an edge (nothing); between them it fades. Fog comes in two steps
// per place (RP fogs/hollow_haze_<place>_<1|2>.json) pushed on their own layer, so the change is never a wall.
// Pure maths, no Minecraft calls (the tests run in Node).

import { HEART, COURT } from "./layout.js";
import { DROWNED_AREA } from "./drowned.js";

export const MOOD_LAYER = "hc_mood";

export const MOOD_PLACES = [
  { id: "wound", x: 0, z: -5, core: 45, edge: 100,
    specks: 2, still: 0, motes: 1, clouds: 1, glow: 1, thunder: true },
  { id: "court", x: COURT.center.x, z: COURT.center.z, core: 45, edge: 110,
    specks: 1.5, still: 0, motes: 1.5, clouds: 1.5, glow: 2, thunder: true },
  { id: "court", x: (DROWNED_AREA.x1 + DROWNED_AREA.x2) / 2, z: (DROWNED_AREA.z1 + DROWNED_AREA.z2) / 2, core: 40, edge: 90,
    specks: 1.5, still: 0, motes: 1.5, clouds: 1.5, glow: 2, thunder: true },
  { id: "seat", x: HEART.center.x, z: HEART.center.z, core: HEART.outerRadius + 10, edge: 95,
    specks: 0, still: 2, motes: 0.25, clouds: 0, glow: 0.5, thunder: false },
];

// Within this many blocks of a light river's middle, the water glows brighter.
export const RIVER_GLOW = { near: 20, extra: 4 };

const NONE = { id: null, strength: 0, step: 0, specks: 1, still: 0, motes: 1, clouds: 1, glow: 1, thunder: true };

// 1 in the core, 0 past the edge, a straight fade between.
export function strengthAt(place, x, z) {
  const d = Math.hypot(x - place.x, z - place.z);
  if (d <= place.core) return 1;
  if (d >= place.edge) return 0;
  return 1 - (d - place.core) / (place.edge - place.core);
}

// The mood at a spot: the strongest place wins, its numbers eased from the plain Hollow by its strength.
export function moodAt(x, z) {
  let best, s = 0;
  for (const p of MOOD_PLACES) {
    const v = strengthAt(p, x, z);
    if (v > s) { s = v; best = p; }
  }
  if (!best) return { ...NONE };
  const ease = (k) => 1 + (best[k] - 1) * s;
  return {
    id: best.id, strength: s, step: s >= 0.6 ? 2 : s >= 0.2 ? 1 : 0,
    specks: ease("specks"), still: best.still * s, motes: ease("motes"), clouds: ease("clouds"), glow: ease("glow"),
    thunder: best.thunder || s < 0.2,
  };
}

// The fog id for a mood, or null for the plain Hollow fog.
export function moodFog(mood) {
  return mood.id && mood.step ? `siege:hollow_haze_${mood.id}_${mood.step}` : null;
}

// A count scaled by a multiplier, the leftover fraction rolled so the average comes out right.
export function scaled(base, mult, roll = Math.random()) {
  const n = base * mult, whole = Math.floor(n);
  return whole + (roll < n - whole ? 1 : 0);
}
