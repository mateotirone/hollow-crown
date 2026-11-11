// The Undertow's fixed numbers: where things are and how big. Other threads import this
// (the mobs and bosses thread uses COURT for Oswin's arena), so change values here only.

export const UNDERTOW_ID = "siege:undertow"; // the dimension id. The name players see is in TEXT.name.

export const TEXT = {
  name: "the Hollow", // Mateo's name for it (ids and folders still say "undertow")
  riftOpened: "§5The ground groans. Somewhere below, the Rift has opened.",
};

export const UNDERTOW_LAYOUT = {
  // The Spine: the walled valley down the middle that the story path follows.
  halfWidth: 150, // the Spine runs from x = -150 to x = 150
  // The open country around it, generated as players explore. Past this there is only fog and void.
  reach: 700, // the Hollow runs from about x = -700 to x = 700
  seaY: 62, // the one water level of every light river and pool
  zStart: -48,
  zEnd: 2460,
  floorY: 40, // lowest solid layer (blackstone); below it, void
  ceilingY: 200, // the ceiling slab: see-through to light, so the valley isn't pitch black
  ceilingThickness: 4,

  // Arrival: the Wound, a ledge looking out over the valley. The return crack is in the wall behind.
  arrival: { x: 0.5, y: 101, z: 0.5 },
  woundLedgeY: 100,
  returnCrack: { x: 0, y: 101, z: -11, facing: "south" }, // seam bottom; the crack faces +z (toward the ledge)

  // The route, in order. Waystones sit on the path at these z values.
  stages: [
    { id: "wound", name: "The Wound", z0: -48, z1: 40 },
    { id: "shallows", name: "The Landing Reach", z0: 40, z1: 500 },
    { id: "mirror", name: "The Truce Country", z0: 500, z1: 1000 },
    { id: "bells", name: "The Bell Wastes", z0: 1000, z1: 1540 },
    { id: "court", name: "The Drowned Court", z0: 1540, z1: 1660 },
    { id: "climb", name: "The Long Climb", z0: 1660, z1: 2330 },
    { id: "heart", name: "The Choir's Heart", z0: 2330, z1: 2460 },
  ],
  waystoneZ: [12, 260, 520, 780, 1040, 1300, 1520, 1700, 2000, 2290],
};

// Oswin the Last's flooded throne hall (boss code lives with the mobs and bosses thread).
export const COURT = {
  center: { x: 0, y: 90, z: 1600 },
  radius: 32,
  floorY: 90,
  gateZ: 1632, // the sealed wall across the whole valley, with a gate in it, opened when Oswin dies
  bossId: "oswin",
};

// The Hollow Choir's arena: a ring cathedral floating in the fog.
export const HEART = {
  center: { x: 0, y: 120, z: 2400 },
  outerRadius: 30,
  innerRadius: 7, // the central disc, the last stand in phase 3
  singerRadius: 22, // where the 7 Singer pillars stand
};

// Where the walking path runs: a slow S-curve so the valley doesn't feel like a corridor.
// It straightens out to x = 0 at the Wound, through the Drowned Court and at the Heart.
const ramp = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
export function pathX(z) {
  const env = Math.min(ramp((z - 40) / 80), ramp((1540 - z) / 80) + ramp((z - 1660) / 80), ramp((2300 - z) / 80));
  return Math.round((38 * Math.sin(z / 230) + 14 * Math.sin(z / 71)) * env);
}

export function stageAt(z) {
  return UNDERTOW_LAYOUT.stages.find((s) => z >= s.z0 && z < s.z1);
}
