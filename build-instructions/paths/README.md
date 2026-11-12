# Paths

Strict rules for every path, lane, street, square and track. Paths are laid **before** buildings in a
town (the town generator lays paths first, then drops buildings with their doors on them), so this file
is read in town planning, and again in stage 1 (entrance steps) and stage 7 (the street edge) of every
building.

## The sunken half-slab rule (Mateo, 2026-11-11)

- The walking surface of every path is a **bottom slab**, so the path sits half a block below the ground
  and the buildings beside it.
- Every building stands on full blocks, so you always **step up half a block** off the path onto a
  doorstep, a plinth or the grass verge.
- Therefore every path block must exist as a slab. Blocks with no slab form (grass path, gravel, coarse
  dirt) are used only as the verge or in the ground beside the path, never as the walking surface.

## Widths (odd, like everything)

| Path | Width | Where |
|---|---|---|
| High street, main road through town | 5 | from the town gate or station to the square |
| Street | 3 | between houses, to the church, the market |
| Lane, garden path | 1 | from a street to a single door, through gardens and fields |
| Square | odd rectangle or circle, at least 9 across | town centre, market |
| Road between towns | 5 beside every rail line, 3 on bridleways | from the map (`map/draw_map.py`) |

A path to a door is as wide as the doorway's steps (3 for a house door, 5 for a grand one) for its last
3 blocks.

## Height and slope

- A path changes height by at most **half a block per block** along its length: alternate bottom slab and
  full block (a slab, then the full block above, then a slab one higher...). This is the town generator's
  rule and is never broken on streets.
- Stairs only on door walkways and steep lanes (rise more than 1 in 2 over 5 or more blocks), never on
  streets carts and horses use.
- Across its width a path is level. On a side slope, the uphill side gets a retaining edge (a full block
  course or a wall) and the downhill side a verge.
- Paths never sit higher than the doors they lead to.

## Surface and texture

Use the `texturing/` recipe (base at least 60%, at most 3 blocks, one colour family, variation with a
cause). Wear is a cause: the centre line of a street is the most worn, the edges the least.

| Region | Street surface (slabs) | Mix | Verge (beside, full blocks) |
|---|---|---|---|
| Vale | `cobblestone_slab` 60, `stone_brick_slab` 25, `andesite_slab` 15 | worn centre: more cobble | `grass_path`, `coarse_dirt`, `gravel` |
| Frostmarch | `cobbled_deepslate_slab` 60, `stone_brick_slab` 25, `andesite_slab` 15 | snow layers on the edges | `gravel`, `snow_layer` |
| Saltreach | `smooth_sandstone_slab` 60, `sandstone_slab` 25, `cobblestone_slab` 15 | sand-coloured, bleached | `sand` only where it cannot fall, `smooth_sandstone` |
| Blackfen | boardwalk `mangrove_slab` on stilts; `mud_brick_slab` on dry ground | | `packed_mud`, `moss_block` low |
| Emberwaste | `smooth_red_sandstone_slab` 50, `smooth_sandstone_slab` 35, `cut_red_sandstone_slab` 15 | dusty edges | `red_sand` where it cannot fall, `coarse_dirt` |
| Hollow | `cobbled_deepslate_slab` 60, `polished_blackstone_brick_slab` 25, `tuff_slab` 15 | | `coarse_dirt`, `siege:pale_ash` |

Squares use the street mix in a pattern centred on the square's centre block (a ring of the second block,
or a cross of the third), never random. Lanes may use the verge blocks' slab-able neighbours in more
rustic mixes (more cobble, mossy cobble slabs low and in the shade).

## Edges

- Every street of width 3 or more has an edge: a 1-block verge of the region's verge blocks, or a kerb of
  full stone blocks (half a block above the path, level with the ground) in towns.
- Lanes through gardens: edged with flowers, short grass, leaves bushes or a fence on one side.
- Under eaves along a street: a drip line of gravel or stone in the verge.
- Lanterns on posts every 9 to 15 blocks (odd) along the high street, at junctions, at the square's corners.

## Junctions and bends

- Junctions are squares or widenings: where two streets meet, widen to the larger width + 2 for 3 blocks.
- Bends follow the ground and look worn round the inside corner (the second block there).
- No path ends at nothing: every path ends at a door, a gate, a field, a square or another path.

## Bridges and fords

- Paths cross water on a bridge (Kingsrest needs bridges where two rivers meet) as wide as the path, with
  rails (fence or wall) and the same sunken surface between kerbs. Fords only on lanes.

## Yards and walled grounds meet the paths (Mateo, 2026-11-12)

A yard, bailey or walled ground (the Barracks yard) does not have to be a perfect square: it fits the landscaping.
Where a path already crosses the line of its wall, leave that stretch of wall out so the path runs straight in, and
keep the path's own surface through the yard. Never pave over or wall across a path that was there first. The game
does this when it raises the Barracks (`settle/raised.js`, `yardGaps`).

## Before you finish a path

- [ ] Walking surface is bottom slabs, half a block below the buildings beside it.
- [ ] Width odd and right for its rank; door paths as wide as the steps.
- [ ] Height changes at most half a block per block; stairs only on door walkways and steep lanes.
- [ ] Texture by the recipe, worn in the centre; edges and verges on every street.
- [ ] Every path ends somewhere.
