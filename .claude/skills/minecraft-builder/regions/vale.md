# Aldmere Vale

## What the region is

The temperate heartland of the old kingdom, in the middle of the map. It covers the land around the river
confluence and spreads south and west of the spawn. Rivers run through it: the Alder, the Greywater and
Wren Water. It holds the following places:
- **Kingsrest**, the spawn town and the region's capital. It sits below the old capital, south-east of the
  river confluence, with the main station.
- **Millbrook**, a village.
- **Crownhold**, the ruined old capital with the Hall of Bells (-235, -345).
- **Bellhollow**, with the sealed Crack in the Deep (155, -100).
- **Four claimable plots:**
  - Harrowford, a river meadow above the lower Alder;
  - Oakmere, oak forest between the two rivers;
  - Thistledown, open downs south of the Greywater;
  - Wrenfield, lakeside fields by Wren Water.
- **Two of the seven thin places:** King's Barrow (cut by hands, roots over the entrance) and the Sunken
  Quarry (swim to reach it, cut by hands).

It is the kingdom the story starts in. Everyone arrives as a plain human here. The Knight's path (the
Oathsworn, Sir Aldous Vane) belongs to it, and so does the cavalry (the Royal Stud, horses and their
upgrading). Its mood is a lived-in old country town: warm windows, smoke from chimneys, green lanes.
At night it should feel a little too quiet, never like a horror game.

## Theme

**Medieval, English and Norman, with no overt fantasy.** It is the most grounded region and the baseline
the others are measured against. Think of a market town in the Cotswolds or the Weald, a Norman
church and a guildhall on the square. Three styles mix in every Vale town (Mateo, 2026-11-10: "mix all
three"):
- **Plaster and timber** for most houses: white plaster between stripped spruce frames, jettied upper storeys.
- **Norman stone** for important buildings: grey stone with dressed corners, arches, buttresses.
- **Brick** for some: warm red brick between timber.

The fantasy shows only in scale and finish: the capital hall's copper domes, spires and clock towers.

## Land, weather and light

| | |
|---|---|
| Ground | grass with coarse dirt patches; oak forest in the wetter parts (biome `forest`), open `plains` elsewhere; rivers and sandy beaches |
| Weather | the world's normal weather: sun, rain and thunderstorms. Sieges bring a thunderstorm on the Long Night |
| Light | warm daylight; lanterns at doors and on posts; warm windows at night |
| Feel | green, soft, old; the road is busy by day and empty at night |

Build for rain. Every overhang has a drip line of gravel or stone in the verge below it. Moss grows low
on shady stone. Vines climb walls that face away from the sun.

## Towns and paths

- **Layout:** towns grow along roads and round a square or market. They are organic, never on a grid,
  and never inside a perfect circle (town edges wobble).
- **Order of work:** paths are laid first, and buildings face the street with their door on it.
- **Lots:** gardens and orchards behind the houses, fields beyond them, a windmill on fields over 900 blocks.
- **Street surface:** a bottom slab, half a block below the buildings, made of `cobblestone_slab` 60,
  `stone_brick_slab` 25 and `andesite_slab` 15. The centre line is the most worn (more cobble).
- **Verges:** `grass_path`, `coarse_dirt`, `gravel`.
- **Widths:** high street 5, streets 3, lanes 1, squares at least 9 across.
- **Lighting:** lanterns on posts every 9 to 15 blocks.
- **Bridges:** where streets cross rivers (Kingsrest has two rivers meeting).
- **Full rules:** `build-instructions/paths/README.md`.

## Buildings

| Building | What it looks like |
|---|---|
| Cottage | 1 to 1.5 storeys, plaster and timber, a pitch 1 gable roof (some bell-cast), a chimney at one end, flower boxes, a garden lane |
| Town house | 2 to 3 storeys on a narrow front, a jetty on the upper storeys (front and back), stripped spruce frame with arched brackets under the jetty, plaster infill, a gable or a cross gable to the street |
| Stone house | the important families: grey stone, dressed corners in polished andesite, a string course at each floor, stone window heads |
| Brick house | brick infill between timber, spruce trim, brown glass |
| Inn | a long two-storey range with a cross wing and a carriage arch, a hanging sign bracket; the only furnished building |
| Smithy | a stone forge house with a big chimney, an open workshop under a lean-to on posts |
| Market hall / guildhall | an open arcade of round-angle arches on the ground floor (market stalls under it), the hall above, a copper roof and a belfry on the ridge |
| Chapel | Norman stone nave with buttresses and tall lancets, a steep slate roof, a square tower with a spire and a clock, a lower chancel |
| Capital hall (Kingsrest) | grand medieval: an 85 x 39 stone hall with domes on drums and a copper gradient (green at the top, orange at the eaves), a rose window |
| Station | the region's station style, copper on the city station |
| Barns, stables | wide and low, pitch 1 gables, plank walls, big doors; stables get stalls and a tack room |

**From the ground up:**
- **Foundation:** plinth of cobblestone with mossy cobble only on the bottom course; the building stands on
  the highest block of its footprint with stone below it.
- **Frame:** stripped spruce logs, flush with the infill on neat town houses or proud on old ones.
  Jetties are the Vale's signature.
- **Walls:** calcite plaster, or stone on the VAL-01 ladder (`tuff_bricks`, cobblestone, stone, andesite)
  painted as a gradient darker at the base, or brick.
- **Floors:** spruce slab field, dark oak border.

## Roofs

**Shapes:**
- **Default:** gable, pitch 1 (one stair per block), overhang 1 at eaves and verges, ridge along the long side.
- **Also:** cross gables to the street, jettied gables, jerkinheads on long houses and inns, hips on civic
  buildings, steep pitch 2 on chapels and gatehouses, spires on chapel and clock towers, domes on the
  capital hall. Bell-cast eaves on cottages.

**What they carry:**
- **Ridge:** back-to-back stairs along it, with spikes every 3 blocks (a trim post and a lightning rod) and
  taller finials at the gable peaks.
- **Edges:** a barge board under every verge; a trim-wood block at each verge corner with a chain and lantern.
- **Chimneys:** Mateo's chimney: stone 2 above the roof, wall signs round the top stone, a campfire with
  open trapdoors, a flower pot.
- **Dormers and roof windows:** dormers on deep roofs; attic windows in the gable ends.
- **Spires:** spires end in the spire top block on a full block.

**Colour and texture:**
- **Colours (every roof is textured):**
  - slate (`deepslate_tile` with 8% deepslate brick and 4% cobbled deepslate);
  - dark shingle (`dark_oak`);
  - mid shingle (`spruce`);
  - warm red (`brick`, or `polished_granite` for orange-pink);
  - white limewash (`smooth_quartz`, `polished_diorite`);
  - waxed copper for civic accents, as a gradient.
- **Mix per town (out of 10):**
  - Kingsrest: slate 4, dark shingle 3, warm red 2, white 1, plus copper on the capital hall, guildhall
    and station. The refinement thread's Kingsrest roofs are warm red and old slate.
  - Millbrook: dark shingle 5, slate 3, warm red 2, plus a slate spire on the chapel.
- **Neighbours:** two houses side by side never share a colour if a third choice is open.

**How they are made:**
- Stairs face uphill, with inner corners in the valleys and outer corners on the hips.
- Each gable end has a full block on the ridge and back-to-back stairs above it.
- Under the overhang: an eave row of upside-down trim stairs and a barge board.
- Gable triangles are filled with posts on the centre line and plaster between.
- A wing's ridge reaches the main eave so the roofs join.

Full rules: `build-instructions/06-roof/`.

## Windows, doors and details

**Windows:**
- **Sizes:** 1 or 3 wide, flush with the wall.
- **Glass by building:**
  - houses: `brown_stained_glass_pane` (old warm glass) or light grey;
  - stone houses and the guildhall: grey;
  - shop fronts: clear;
  - the chapel: red, blue and yellow stained glass;
  - the capital: light blue with a rose window.
- **Dressing:** sills wider than the glass; a stair head where there is room; flower boxes (leaf box sills)
  on about a quarter.
- **Shutters:** spruce shutters on at most 3 in 10, in pairs.

**Doors:**
- spruce doors with a canopy of trim stairs or lanterns;
- grand doors under an arch on civic buildings;
- 3 x 3 plank doors on barns.

**Details:**
- **Under the jetty:** arched brackets.
- **Stone buildings:** string courses and buttresses.
- **On the street:** hanging signs on brackets; lanterns at doors; barrels and crates at shops; a
  woodpile at cottages; lean-tos on sheds.
- **Greenery:** flower beds and vines.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| plinth | `cobblestone`, `mossy_cobblestone` (bottom course), `andesite`, `stone_bricks` |
| stone | ladder VAL-01: `tuff_bricks`, `cobblestone`, `stone`, `andesite`; dressed `polished_andesite` |
| plaster | `calcite` (smooth quartz where it needs stairs or slabs) |
| brick | `brick_block` 85, `mud_bricks` 15 |
| frame | `stripped_spruce_log` (Mateo approved: dark oak frames under slate read gloomy); `stripped_dark_oak_log` for darker accents |
| trim | `dark_oak` stairs, slabs, trapdoors; spruce on brick houses |
| light | `lantern` |

Full table: `build-instructions/palettes/vale.md`; ladders VAL-01 to VAL-11:
`build-instructions/texturing/regions/vale.md`.

## Trees and greenery

**Trees** are the region's species from the tree database, placed only on ground that will never be
built on:
- English oak (Mateo wants big oaks), silver birch, ash, weeping willow, hawthorn, apple, yew.

**Smaller plants:**
- azalea bushes;
- flower beds of poppy, cornflower, dandelion, azure bluet, oxeye daisy and tulips;
- vines on shady walls.

## Building it with the skill

- **Presets:**
  - `vale_timber`: plaster and timber, the default house;
  - `vale_stone`: important buildings;
  - `vale_brick`: some houses.
- **Mixing styles:** use `storey_style` for a stone ground storey under timber.
- **Parts that fit:**
  - on the house: `jetty` with arched brackets, `wings` (cross gables, L and T plans), `dormers`, `porch`,
    `balconies`, `arcade` (guildhall);
  - separate parts: `string_course`, `buttress`, `lean_to`, `woodpile`, `spire` and `clock_face`
    (chapel, clock tower), `belfry`, `wheel` (mills).

```json
{"part": "house", "style": "vale_timber", "rect": [0, 0, 8, 12], "storeys": [5, 4], "jetty": ["n", "s"],
 "door": {"side": "s"}, "roof": {"type": "gable", "ridge": "z"},
 "storey_style": [{"frame_kind": "stone", "infill": "VAL-01"}, {}]}
```

**Not in the skill yet:**
- domes on drums (the capital hall still uses `capital.py`);
- bell-cast eaves;
- jerkinhead roofs;
- carriage arches through a range (use `arch` cut into the wall).

## Never

- **Frames and plaster:** no dark oak frames on whole slate-roofed streets (gloomy), and no diorite
  plaster (reads as grey patches).
- **Roofs:** no single-block roofs (always textured), no flat roofs, and no roof ending against a taller
  wall without joining it.
- **Fantasy:** none on ordinary houses. The Vale is the grounded one.
- **Town shape:** no perfectly circular towns and no grid streets.
