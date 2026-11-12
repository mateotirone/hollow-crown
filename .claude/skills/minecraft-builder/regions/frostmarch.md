# Frostmarch

## What the region is

The cold north of the map, a band of foothills, a mountain range and high plateaus above the Vale. It
holds these places:
- **Rimehold**, the region town. Its internal id is still `hollowfast`, and it sits by the lake Hallowmere.
- **Two claimable plots:**
  - Frosthelm, a shelf in the western foothills;
  - Wolfcairn, a high plateau north of the range: the cairn of six thousand and four stones.
- **The Deepforge** above Rimehold.
- **Two of the seven thin places:** the Bellfounders' Mine (an old bronze bell at its mouth, cut by hands,
  ice and snow) and Frostvein Gap (ice and snow).
- **The Shut Pass**, an expansion zone the map leaves closed, through the range to the north.

It is the land of smiths, copper and bells. Queen Maelis's copper diggings were here and the Founding Bell
was cast from them. Its role is the **Forgemaster** (the Deepforge, mentor Ulla Deepforge): smiths and siege
engines. Its mood is hard, quiet and self-reliant: woodsmoke and lamplight against the snow, the wind on
the passes. At night it should feel lonely, not frightening.

## Theme

**Norse medieval, with a light fantasy edge.**
- **The look:** a Scandinavian mountain town. Dark log frames and plank walls on dark stone bases, steep
  shingle roofs that shed snow, tiered stave halls and stave chapels, carved dragon heads on the gable peaks.
- **Real-world references:** Norwegian stave churches, Viking longhouses, Alpine-Nordic farms.
- **The fantasy edge:** the dragon heads, pale blue ice used as an accent, and weathered copper on the great
  buildings. The real dragons live in the Emberwaste; here they are carvings and story.

## Land, weather and light

| | |
|---|---|
| Ground | grass under snow in the valleys, bare stone, scree and snow blocks on the heights, podzol in the woods; crags and steep faces on the mountains, with rock texture on the slopes and snow only near the tops; calcite streaks on steep northern ground |
| Biome | `ice_plains`, so **it snows instead of raining**; frozen rivers, cold ocean on the coast |
| Region weather | **flurries**: snow blowing down off the peaks from the north. **Blizzards**: a white fog (#e3e9ef) down to 16 blocks with driving snow; they close the passes and come more often while vanilla snow falls (region weather, PR #193: spells of 3 to 16 minutes with 6 to 22 minutes of plain sky between; under a roof it thins to a grey light; never in caves) |
| Light | low, cold and blue-white by day; warm orange windows and hearth light at night |
| Feel | snow on everything, dark timber against white, wind on the passes |

Build for snow. Roofs are steep (pitch 2) so snow slides off. Ridges, chimney caps and flat tops carry
snow layers. Plinths are often 2 courses high to stay above the drifts. Snow layers lie beside the steps. Shelter matters here: deep eaves, porches, covered walkways and wind-breaks on the north side.

## Towns and paths

**Towns:**
- Towns sit on shelves and terraces in the foothills, round a longhouse hall.
- Buildings are tight together for shelter.
- Byres and barns sit at the edges.

**Streets:**
- **Surface:** a bottom slab, half a block below the buildings, made of `cobbled_deepslate_slab` 60,
  `stone_brick_slab` 25 and `andesite_slab` 15.
- **Edges:** snow layers on the edges, with verges of `gravel` and `snow_layer`.
- **Slopes:** on slopes the uphill side gets a retaining course of dark stone.
- **Full rules:** `build-instructions/paths/README.md`.

## Buildings

| Building | What it looks like |
|---|---|
| House | dark deepslate base, plank rows in a spruce or dark oak frame, a steep pitch 2 roof, frosted glass, small windows; dragon heads on the gable of the bigger houses |
| Byre / barn | low dark stone walls, plank rows above, a very steep roof down to head height, cart doors |
| Longhouse hall (Rimehold) | a stone course and plank rows in a dark frame, a steep weathered copper roof with a gallery skirt roof round it on posts, crossed dragon heads on both gables, a ridge lantern tower, light blue glass |
| Stave chapel | a tall narrow nave and a lower apse, a skirt roof all round on posts, three tiers of steep roofs climbing to a spire, dragon heads on every gable peak, cyan, blue and white stained glass |
| Inn, smithy, store | the region's versions of the town set: stone ground storey, plank upper storey, steep roofs; the smithy has a big chimney and an open workshop |
| Stone towers | dark deepslate, 1-wide slit windows with iron bars, a pitched tower roof in the region's shingle |

**From the ground up:**
- **Plinth:** dark cobbled deepslate, often 2 courses (FRO-01 ladder: `deepslate_bricks`, `cobbled_deepslate`,
  `tuff`, `andesite`, darkest at the base).
- **Frame:** heavy dark log frame (`dark_oak_log` or `spruce_log`), with big corner posts.
- **Walls:** plain spruce plank infill (a row mix with stripped logs looked busy).
- **Gables:** vertical stripped spruce or planks.
- **Jetties:** they work on houses but never on halls.

## Roofs

**Shapes:**
- **Default:** gable, **pitch 2** (steep, sheds snow).
- **Also:**
  - A-frames on huts and hunting lodges;
  - skirt roofs round halls (a low roof all round, on posts, below the main roof);
  - tiered stave roofs and tiered ridge towers on chapels;
  - steep spires.

**What they carry:**
- **Gable peaks:** dragon heads: crossed barge boards that run on past the ridge in a V, one block above the
  ridge at each gable end (`settle_halls.dragon_heads`; in the skill `"gable_horns": true`). Every gable roof
  carries them (refinement thread, 2026-11-12).
- **Ridge:** spikes every 3 blocks (house rule).
- **Snow:** snow layers on the ridge and the top rows of every roof, and on chimney caps.
- **Chimneys:** dark deepslate brick with a cobbled deepslate wall cap.
- **Halls and chapels:** ridge lantern towers.
- **Accent:** packed ice on trim courses and finials only.

**Colour and texture:**
- **Colours (every roof is textured):**
  - dark shingle (`dark_oak`);
  - mid shingle (`spruce`);
  - slate (`deepslate_tile`);
  - weathered copper (`waxed_weathered` and `waxed_oxidized_cut_copper`) for civic accents.
- **Mix (out of 10):**
  - Rimehold: dark shingle 5, mid shingle 3, slate 2, all snow-capped, with weathered copper on the hall
    and the stave chapel;
  - Frosthelm: dark shingle 6, mid shingle 4, no accent.

**How they are made:**
- Pitch 2 means a stair on a full block, two up for every block in.
- On each gable end: a full block on the ridge and back-to-back stairs above it.
- Overhang: 1 at the eaves and verges, with an eave row and barge boards.
- Snow layers are added after the roof is built.

## Windows, doors and details

**Windows:**
- **Size:** small (cold), with heavy dark oak surrounds.
- **Glass by building:**
  - houses: `white_stained_glass_pane` (frosted);
  - halls and longhouses: `light_blue_stained_glass_pane`;
  - towers: slits with iron bars or light grey glass;
  - the stave chapel: cyan, blue and white stained glass.
- **Shutters:** none on halls; on houses dark oak shutters on at most 3 in 10.

**Doors:** dark oak, heavy, in a dark oak surround.

**Details:**
- woodpiles under the eaves (every house has one);
- lean-to sheds;
- barrels;
- campfires in hearths;
- snow layers beside every step.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| plinth | `cobbled_deepslate` 60, `deepslate_bricks` 25, regional castle cobble 15 |
| stone | `polished_deepslate`, `deepslate_bricks`, `cobbled_deepslate` with `stone_bricks` and `andesite` |
| plank infill | plain `spruce_planks` (the refinement thread found the spruce and stripped-log row mix busy; keep stripped logs for gables) |
| light infill | `snow` block, `calcite`, `white_concrete` |
| frame | `dark_oak_log`, `spruce_log` |
| trim | `dark_oak` (spruce on dark oak buildings) |
| ice accent | `packed_ice`, on trim courses and finials only, never on floors |
| light | `lantern`, `campfire` |

Full table: `build-instructions/palettes/frostmarch.md`; ladders FRO-01 to FRO-06:
`build-instructions/texturing/regions/frostmarch.md`.

## Trees and greenery

**Trees:** Norway spruce, Scots pine, snowy birch, juniper, treeline pine and snags, plus the custom cold-region
spruces (tall spruce, grey fir).

**Ground cover:** ferns, sweet berry bushes, snow on roofs and ground. There are few flowers.

## Building it with the skill

- **Presets:**
  - `frost_timber`: plank rows in a dark log frame, white frosted glass;
  - `frost_stone`: dark deepslate, for towers and halls' ground storeys.
- **Roof:** always set `"roof": {"type": "gable", "pitch": 2, "gable_horns": true, "snow": true}` (snow on the
  ridge and on every step open to the sky).
- **Parts that fit:** `woodpile`, `lean_to`, `spire` (stave chapel top), `belfry`, `porch`.

```json
{"part": "house", "style": "frost_timber", "rect": [0, 0, 8, 10], "plinth": 2, "storeys": [5, 4],
 "door": {"side": "s"}, "roof": {"type": "gable", "pitch": 2, "ridge": "z", "gable_horns": true, "snow": true},
 "storey_style": [{"frame_kind": "stone", "infill": "FRO-01"}, {}]}
```

**Not in the skill yet:**
- **Roof forms:** skirt roofs and tiered stave roofs; build the tiers as stacked houses with lean-tos.

## Never

- **Roofs:** no shallow pitch 1 roofs on houses (they cannot shed snow) and no flat roofs.
- **Windows:** no big glass fronts.
- **Materials:**
  - no ice on floors or in walls;
  - no bright colours, which belong to the coast and desert;
  - no light timber frames: birch is Saltreach's.
- **Halls:** no jetties and no shutters on halls.
