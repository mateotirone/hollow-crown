// The shape of a wild Dragon Nest: 9x9 blocks with rounded corners. Plain maths, no Minecraft, so it can be
// tested in Node and drawn by the preview (studio/dragon_nest_preview.html).
//
//   floor (the bowl)  lining, with the egg clutch in the very middle         dy 0
//   inner rim         woven branches, loose twigs heaped on top              dy 0..1
//   outer rim         woven branches two high, twigs on top, a few peaks     dy 0..3
//
// dy 0 is the level of the clutch. Out in the wild the clutch sits one block into the ground, so the bowl
// is sunk and the rim stands about two blocks above the land round it.
// Pieces are made by studio/build_dragon_nest.py.

export const NEST = "hc:dragon_nest";
export const WEAVE = "hc:nest_weave";
export const TWIGS = "hc:nest_twigs";
export const LINING = "hc:nest_lining";
export const FILL = "hc:nest_fill";
export const NEST_PIECES = [NEST, WEAVE, TWIGS, LINING, FILL];
export const NEST_RADIUS = 4; // 9x9

// What a cell of the footprint is: "clutch", "floor", "inner", "outer" or undefined (the cut-off corners)
export function cellKind(dx, dz) {
  if (dx === 0 && dz === 0) return "clutch";
  const d = Math.hypot(dx, dz);
  if (d <= 2.3) return "floor";
  if (d <= 3.5) return "inner";
  if (d <= 4.8) return "outer";
  return undefined;
}

// Floor decoration (hc:v): 0 plain straw, 1 a bone, 2 a ribcage, 3 a skull, 4 shed scales and shell
function floorLook(rand, skulls) {
  const x = rand();
  if (x < 0.5) return 0;
  if (x < 0.65) return 1;
  if (x < 0.75) return 2;
  if (x < 0.8 && skulls.n < 1) return (skulls.n++, 3);
  return 4;
}

// Every block of one nest: [{ dx, dy, dz, id, states }]. rand() is Math.random or a seeded stand-in.
export function nestPlan(rand = Math.random) {
  const out = [];
  const skulls = { n: 0 };
  const turn = () => Math.floor(rand() * 4);
  for (let dx = -NEST_RADIUS; dx <= NEST_RADIUS; dx++) {
    for (let dz = -NEST_RADIUS; dz <= NEST_RADIUS; dz++) {
      const kind = cellKind(dx, dz);
      const put = (dy, id, states = {}) => out.push({ dx, dy, dz, id, states });
      if (kind === "clutch") put(0, NEST, { "hc:laid": true });
      else if (kind === "floor") put(0, LINING, { "hc:v": floorLook(rand, skulls), "hc:turn": turn() });
      else if (kind === "inner") {
        put(0, WEAVE, { "hc:turn": turn() });
        if (rand() < 0.6) put(1, TWIGS, { "hc:turn": turn() });
      } else if (kind === "outer") {
        put(0, WEAVE, { "hc:turn": turn() });
        put(1, WEAVE, { "hc:turn": turn() });
        const peak = rand();
        if (peak < 0.18) {
          put(2, WEAVE, { "hc:turn": turn() });
          put(3, TWIGS, { "hc:turn": turn() });
        } else if (peak < 0.88) put(2, TWIGS, { "hc:turn": turn() });
      }
    }
  }
  return out;
}

// The highest dy a plan uses (the space that has to be clear above the clutch)
export const NEST_HEIGHT = 4;

// A small seeded random number source, for tests and the preview
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
