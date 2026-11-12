# Shapes

Load when the spec has `shapes`. All maths lives in `scripts/shapes.py`; fitting in `scripts/fit.py`.

## Primitives

| shape | keys | notes |
|---|---|---|
| `sphere` | `at`, `r` | `at` is the centre |
| `ellipsoid` | `at`, `r` [rx, ry, rz] | |
| `egg` | `at` (centre of the widest band), `R`, `H` (half height), `k` | r(t) = R·sqrt(1−t²)·(1−k·t), t = (y − at.y)/H. k > 0 = fatter bottom (0.2 to 0.3 looks like an egg) |
| `cylinder` | `at` (centre of the base), `r`, `h`, `axis` y/x/z, `r2` (top radius, for a taper) | towers, drums, columns |
| `cone` | `at` (base centre), `r`, `h`, `axis` | spires and turret roofs. h = r gives 45°, the smoothest stairs |
| `lathe` | `at`, `profile` [[y, r], ...], `axis` | any round outline: onion domes, vases, bell towers, fountains |
| `torus` | `at`, `R` (ring), `r` (tube), `axis` | rings, wreaths, fountain rims |
| `box` | `min`, `max` (inclusive blocks) | |
| `rounded_box` | `min`, `max`, `radius` | |
| `arch` | `at` (bottom centre of the opening), `width`, `height` (to the crown), `depth`, `axis` (the way the wall runs), `profile` round/pointed | the OPENING: subtract it from a wall, or add it as a solid |
| `extrude` | `points` [[u, v], ...], `axis`, `from`, `to` | a polygon pushed along an axis. axis z: u = x, v = y; axis x: u = z, v = y; axis y: u = x, v = z. Gables, buttress profiles, ships' hulls |
| `plane` | `at`, `normal` | keeps the side the normal points away from; use with `intersect` to cut |

Every shape also takes `rotate` [rx, ry, rz] in degrees (about `at`) and `thickness` (a shell of that many
blocks, for big shells of 2 or more; for a 1-block shell keep the shape solid and let `hollow` peel it,
which is always watertight).

## Combining

`shapes` run in order: `add` sets the material where the shape is, `sub` empties, `intersect` keeps only
the overlap with what is there, `paint` recolours filled samples only (bands, a different roof on the
same mass). Recipes:

- Dome on a drum: cylinder + sphere (or `lathe`), then `sub` a box under the sphere's equator if needed.
- Onion dome: `lathe` with profile [[0, 4.5], [2, 5.5], [4, 4.5], [6, 2.5], [8, 0.5], [9, 0]].
- Arcade: a box wall, then `sub` one `arch` per bay at odd spacing, the centre arch on the centre line.
- Bridge: a box deck, `sub` a big `arch` under it (`profile` round), `paint` a band of trim along the top.
- Egg or pod buildings: `egg`, then `sub` an `arch` for the door and small arches for windows.
- Tower windows: thin `arch` with depth 3 through the wall, then `place` glass panes in the holes.

## How a block is chosen

Each block is sampled `quality`³ times (4 = 2×2×2 per octant). Its sample pattern is compared with the
masks of: air, full, bottom/top slab, stairs in 4 facings upright and upside down, inner and outer corner
stairs, and (with `thin`) trapdoors and posts. Fewest mismatches wins; ties go to stairs over slabs so 45°
faces read as stairs. Two more rules make it look built, not rasterised:

1. **Vertical faces are full or air.** A cell whose fill does not change between its lower and upper half
   is a wall face: stairs there only add ledges and holes. It becomes full if at least half full.
2. **Up and down surfaces are a height field.** Domes, cones, roofs, the top and bottom of an egg: per
   column, the surface height inside the top cell picks full (≥ 0.8), slab, or stairs facing the higher
   neighbour, inner corners in hollows, outer corners on ridges. Undersides get the same upside down.

Then interior full blocks are dropped (`hollow`, default 1 block of shell).

## Getting smooth results

- Radii ending in .5 give odd widths with a true centre block (the house rule).
- 45° slopes (cone h = r, a dome's shoulder) give the cleanest stair rings; very steep slopes step in
  full blocks, which is right for a spire.
- Curves under about radius 3 cannot be smooth in blocks: make them bigger or square them off.
- If a surface looks lumpy in the preview, check the material first: a busy gradient hides the shape.
