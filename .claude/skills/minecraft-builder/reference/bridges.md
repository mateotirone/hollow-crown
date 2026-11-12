# Bridges

Load when a build crosses water or a gap. Code: `scripts/bridges.py` (part `bridge`). Mateo's brief
(2026-11-12): a straight line from point A to point B at any angle; detect the crossing, measure it, build
across, style it. Gaps can be water, a ravine, or a valley between hills. The deck may rise or fall from
one bank to the other, graded at the right slope. Longer bridges are grander and higher. Footbridges get
railings and lights. Rail bridges need no railings but look reinforced. Each deck matches the region's
path. The Hollow is included.

## The four steps

1. **Find** (`find_crossings(points, height, water, kind)`): walk the path's centre line in half-block
   steps. It needs a bridge where it is over water, or where the ground falls more than 3 below both banks
   (a dry gap). For raster paths (town generators, the Hollow's columns), use
   `crossings_from_cells(wet, walk, water, width_of, region, path)`. It groups the wet path cells and fits one
   straight crossing along the line between the dry path cells on each bank.
2. **Measure** (`plan(crossing)`): span L, deck width (foot 5, road 7, rail 5, parapets included, always
   odd), the lowest floor under the span, the water level, and the bank walking heights ya and yb.
3. **Build** (part `bridge` / `bridge_blocks(crossing)`): see "Any angle" below.
4. **Style** (`STYLES[region][use]`, `DECKS[region][path]`): materials, what carries the deck, the parapet
   and the light.

## The crossing dict

| key | meaning |
|---|---|
| `a`, `b` | [x, z] where the deck meets each bank (floats are fine) |
| `ya`, `yb` | walking-surface y at each end (half steps allowed). For rail: the y the track sits in |
| `water_y` | water surface y, or `null` for a dry gap |
| `kind` | `foot`, `road` or `rail` |
| `region` | `vale`, `frostmarch`, `saltreach`, `emberwaste`, `blackfen`, `hollow` (town names alias to theirs) |
| `path` | deck paving: `town` (the town's street mix), `road` (country road), `trail`. Rail: ballast |
| `width` | override the deck width (made odd) |
| `ground` | `fn(x, z) -> top solid y` (the riverbed under water), so piers reach the real floor |
| `style` | per-role overrides, e.g. `{"parapet": "wall", "light": "soul_lantern"}` |

## Any angle

Nothing is rotated. Every block column gets `u` (distance along A->B) and `v` (signed distance across).
The bridge is written as functions of u and v: deck band `|v| < width/2`, walking surface W(u), arch
soffits S(u), piers between openings, cutwaters past the band at each pier. The parapet is every band
cell with a neighbour outside the band (8-way). That always gives a 4-way joined line, so walls and
fences connect on a diagonal. Upside-down stairs on soffits, and projecting string courses, are only used
within about 23 degrees of a cardinal or a 45-degree line. Everywhere else slabs do the half steps, because
a stair's facing can't follow the angle.

## Grades and heights

- Foot and road: the paths rule, at most half a block per block, in slab steps. Over water the deck humps
  as a parabola (the curve of a real arched deck). It rises as high as the clearance needs (foot 3, road 4,
  rail 5 above the water, plus 1 per 12 blocks of span, up to 4), but never steeper than the grade at its
  ends (4h/L <= 1/2).
- Rail: straight from bank to bank at the track's own grade, no hump. It warns when the grade is steeper
  than 1 in 25.
- Trestles and boardwalks stay low over water (3 above, enough for a boat).

## Size by span (longer = grander)

| span | tier | what you get | real reference |
|---|---|---|---|
| <= 4 | beam | one deck on stone ends | Dartmoor clapper bridges |
| 5-15 | single | one arch, humped for walkers | English packhorse bridges |
| 16-40 | arcade | an odd number of openings ("work in threes"), the centre widest, cutwaters, a lamp on every pier, string course | Bideford Long Bridge, Pont Valentre |
| 41+ | grand | 5-wide piers, cutwaters carried up as refuges, thicker deck. Deep gaps get a second tier of arches below | Pont du Gard, Khaju (Isfahan), Ribblehead and Goltzsch viaducts |

Arch width grows with the height above the floor (round: about 0.9 x height; segmental: 1.6 x). Every arch
springs from one line just above the water, or from the floor. A tall opening stands its arch on straight
jambs. A low one flattens to a segment. A low crossing (less than 7 of room) gets a few wide flat arches,
span about 4x rise (Ponte Vecchio), never a row of small holes.

## Styles

| region | foot | road | rail |
|---|---|---|---|
| vale | packhorse, mossy cobble, round arch, low stone wall, lanterns | medieval stone, solid parapet with coping, cutwaters, lanterns | red-brick viaduct with stone dressings and pilasters (Ouse Valley, Digswell) |
| frostmarch | covered timber bridge on trestles, deepslate-tile roof (Kapellbruecke, Lucerne) | deepslate segmental arches | timber trestle, battered legs, on deepslate feet (Western trestles) |
| saltreach | harbour boardwalk on oak piles, fence rail | pale sandstone segmental | sandstone viaduct (Glenfinnan's curve, in stone) |
| emberwaste | pointed sandstone arch | pointed arcade, two tiers over canyons (Khaju) | red sandstone segmental viaduct |
| blackfen | mangrove causeway on stilts, froglights on chains | mud-brick segmental | tuff-brick viaduct |
| hollow | black pointed arches, veinstone, soul lanterns | the same, two tiers over chasms | deepslate pointed viaduct |

Rail rows always use a heavier block than that region's foot and road rows. They have pilasters up each
pier face, cutwaters to the springing line, a string course, a solid parapet on high viaducts or a curb
on low ones, ballast on top, and no lamps.

The deck paving is the region's own path (`DECKS`). For a town, that is the town's street mix (towngen
`PAVE`). For the country, it is the cobble part of the map's roads. The Hollow uses cobbled deepslate.
Blocks the palette doesn't know (`siege:veinstone_bricks` and its cracked form, about 20%) go in as raw
ids on full-block cells (`CUSTOM`).

## Outputs and callers

- `bridge_blocks(crossing)` -> `{(x, y, z): (block, logical props)}` in world coordinates. It includes air
  above the deck where `ground` says the bank rises into it (clear to the sky).
- `works_columns(blocks)` -> `([[x, z, y0, y1, i], ...], palette)` with palette[0] = air: the trains'
  rail-segments "works" format. It never contains track: the train scripts lay track at the deck top + 1.
- `to_works(blocks)` -> bp.py / towngen `works` entries.
- Town generators: `towngen.Town.bridges()` (called from `path_blocks`) replaces the old flat deck.
- Map (genworld road and trail crossings) and rail works: the map thread calls `bridge_blocks`.
- Gallery: `map/structures/bridges_gallery.py OUT` (the asset viewer's "Bridges" section).
- The Hollow: `node tools/hollow_bridges_dump.mjs DUMP && python3 tools/hollow_bridges.py DUMP` writes
  `undertow/bridges_data.js`. Only columns over water, or 3+ above dry ground, are bridged. A carried stretch with
  a rejected run of more than 4 cells (a road running along a river) keeps the terrain's own causeway.
  `terrain.js` stamps the runs per chunk (`planBridges`, before the cart rail so the rail wins) and leaves out the
  old deck, parapet and lanterns on `covered` columns. Rerun after changing the Hollow's roads, rivers or land.
