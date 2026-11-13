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
- A settlement's road meets the map's roads (Mateo, 2026-11-12): the gate road is carried on to the nearest map road
  and joins it at that road's own height and surface, graded evenly, with the land either side stepped to it by at
  most 1 a block. The game does it when a settlement is founded (`settle/founding.js` `joinRoad`).
- That road is worked out on the map, never guessed in game (Mateo's playtest 2026-11-13, "My path just ends": at four
  plots the nearest road was 55 to 77 blocks off and the old 48-block look-ahead gave up). `tools/export_road_joins.mjs`
  writes each plot's route to `settle/roadjoin_data.js`: straight out along the gate line to the edge of the settlement
  land (where the later tiers' gate road runs, so it is laid over it as the town grows), then round water and steep
  ground to the nearest map road (a trail only where no road is near). It is 5 wide like the gate road, in the map
  roads' own block mix, and it leaves no gap: only ground the town has already laid out is kept off. Re-run the export
  whenever the map's roads, the plots or the Hamlet layouts change; the self-test fails when a layout's gate road no
  longer starts the route.

## Bridges and fords

- Paths cross water on a bridge (Kingsrest needs bridges where two rivers meet) as wide as the path, with
  rails (fence or wall) and the same sunken surface between kerbs. Fords only on lanes.

## Joining the Citadel

The Citadel (map/structures/citadel.py) brings its own road ends, so a road generator never has to find
the gate itself, and must never cut through a wall, a field or a plot to reach it.

- **Ring road**: a 3-wide sunken road at radius 102 round the farmland (`paths.ring_road` in
  citadel.json). Every road into the Citadel stops at it.
- **Entries**: a 5-wide spoke for each side a road arrives from, running from the ring road out to the plot
  edge at radius 125. Pass the angles in as `roads_in` (0 = +x, 90 = +z, the gate side); the generated
  `paths.entries` list gives each spoke's angle and end point. An outside road ends on that point, with the
  same width and the same slab mix, and meets it level (half a block of change per block at most).
- **Gate avenue**: the gate (angle 90) is always an entry. Its avenue runs through the fields to the ring.
- **Station**: the Grand Station stands on the line at radius 126 on the side of the plot's rail stop, with a
  5-wide high street running in to the ring (`paths.station`). Rails cross no road on the level.
- **End of the line**: at a stop only one stretch reaches (Oakmere, Wolfcairn, Frosthelm) the track never just
  stops in the grass. One block past the last rail at the dead end: a timber buffer beam across the track with a
  lantern on it. One block behind that: an end wall 3 wide and 2 high in the region's low wall stone, no wider
  than the track bed, so a road to the platform end gets past it (`trains/stations.js` BUFFER).
- Roads and tracks inside the Citadel follow the sunken half-slab rule like everywhere else. Bare blocks
  take the region's slab mix (Vale cobble and stone brick, Frostmarch cobbled deepslate, Saltreach smooth
  sandstone, Blackfen mud brick, Emberwaste smooth red sandstone).
- The Hollow stronghold has no road network round it (the Hollow has no roads or trains): its one avenue
  runs from the moat bridge to the gate, and paths from the light rivers end at the bridge.

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
- [ ] A road to the Citadel ends on one of its `paths.entries`, never on its walls or fields.

## Rail beds (Mateo, 2026-11-12)

Track is laid in game when a stretch is bought (`Siege_Nights_BP/scripts/trains/rail_bed.js`), never stamped
into the map. The playtest 1.2.1111 track sat in straight-sided dirt trenches with trees cut in half over it,
so these rules are strict:

- **Graded, never a trench.** The ballast row is 3 wide (gravel over dirt). Beside it the ground is level with
  the ballast, then rises or falls **1 block for every 2 out** (the town slope rule), out to 7 blocks each side.
  Cuttings get turf on their banks; embankments are filled and turfed, never left as pillars.
- **Open to the sky** over the bed. No overhang of rock or leaves, and the train's 3 by 4 opening is always clear.
- **Trees come down whole**: every log, branch, fence, leaf and hanging root, and the root pit is filled. A
  tree that touches a building is a building and stays standing. The map keeps trees 7 blocks off every
  planned line (`map/genworld.py`, `railkeep`).
- **Roads and paths are level crossings** (grass path, dirt path, cobble, mud): the bed goes through them.
- **Buildings are never touched**; the bed stops and reports them.
- **Track two lines share has one height** (`map/railshare.py`): the first line's height wins on every shared
  block, and later lines re-fit round it under the climbing rules.
- Bridges, tunnels and deep cuttings are the map's works (`map/railworks.py`); the bed only clears their
  opening and seats the track on them.

Test any change on the real map before shipping: export the corridor with `tools/export_rail_corridor.py`
(amulet) and run `node tools/rail_lay_test.mjs corridor.json`, which lays all 7 lines and must print ALL OK
(no gaps, no trench walls, nothing in the way, no bare dirt, nothing floating).

### Level crossings (Mateo, 2026-11-13)

Where a road or trail crosses a line, the stretch lays a level crossing straight after its bed (`map/railcross.py`
plans it, `rail_bed.js` `layCrossing` lays it), in the region's style:

- **Boards** in the ballast under the road and one block each side (Vale spruce, Frostmarch dark oak, Saltreach
  birch, Blackfen mangrove, Emberwaste smooth sandstone), so the road runs level over the rails.
- **Setts** for 5 blocks each side of the track, on the graded ground; the road keeps its own surface beyond.
- **Lamp posts** at each corner of the road, 3 from the track: a stone base, two posts, a lantern (froglight in the
  Blackfen). A 3-block **line fence** runs from each post along the line. Posts and fences keep 2 off any other
  line and out of the train's body.
- **Keeper's hut** on roads with room: 5 by 5, one storey, built by the skill's `house` part with its interior, door
  toward the road, on the highest block of its footprint with a stone plinth to the ground, 4 or more off every line.
- Never inside a plot's station site (32 round a plot stop: the station, its platform and passing loop go there) or
  on a bridge or in a tunnel.
