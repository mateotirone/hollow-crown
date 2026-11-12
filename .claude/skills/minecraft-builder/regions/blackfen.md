# Blackfen

## What the region is

The black-water marsh in the south of the map, below the Vale, running down to a fen coast. It holds
these places:
- **Mirelight**, the region town, named for the green glow of its froglights.
- **Two claimable plots:**
  - Reedmoor, on the firm northern edge of the fen. The Even Market stood here: a ring of nine posts where
    two worlds traded every third night, before the Bell.
  - Lanternbog, a dry island deep in the fen, once a lantern house for those lost in the fen.
- **One of the seven thin places:** the Witchroot Caves (swim to reach them, roots over the entrance).

It is the land of witches, brews and old bargains. Its role is the **Witch** (Nell Sedge, past Mirelight).
Its mood is dark, damp and close: still water, mist, green light in cages, boardwalks creaking. It is the
most uneasy region at night, and still never horror.

## Theme

**Dark folk medieval, leaning gently into fantasy.**
- **The look:** a fen village on stilts. Houses of mangrove and mud brick lifted above the wet ground, mossy
  low roofs almost down to the platforms, few small windows, boardwalks between houses, froglights in iron
  cages.
- **Real-world references:** the Fens and the Somerset Levels before drainage, crossed with stilt villages
  and a Louisiana bayou.
- **The fantasy:** the light, a soft green-gold glow in the murk, and the witchcraft in the details.

## Land, weather and light

| | |
|---|---|
| Ground | grass, mud, moss and podzol in patches; shallow black-water pools in the low fen (never on plots, towns or roads); mangrove roots; the sea edge is mangrove swamp too |
| Biome | `mangrove_swamp`: the world's normal rain, murky water, and the region's own dark water fog (`siege:blackfen_fog`, black-green #07090b, thick under water) |
| Light | dim, green-grey by day; froglights (verdant and ochre) and lanterns at night |
| Feel | wet, still and close; moss on everything low; things half-seen across the water |

Build for wet ground. Houses never touch the ground: they sit on mangrove stilts under every corner and
bay, with the platform as the floor. Moss climbs from below and damp darkens the lower walls (more packed
mud low down). Roofs carry moss.

## Towns and paths

**Towns:**
- Towns are clusters of stilt houses joined by boardwalks, with stilt houses on the waterline.
- On those, the back half stands over the water with a little mooring platform behind and a landing and
  stair at the front.
- Stores and barns stand on short stilts.

**Paths:**
- **Over wet ground and water:** boardwalks of `mangrove_slab` on mangrove log stilts with mangrove fences.
- **On dry ground:** `mud_brick_slab`.
- **Verges:** `packed_mud`, with `moss_block` low.
- **Full rules:** `build-instructions/paths/README.md`; the town generator's boardwalk is
  `regions_towns.BOARDWALK`.

## Buildings

| Building | What it looks like |
|---|---|
| House | mud brick between mangrove posts, lifted 3 to 4 on mangrove stilts, a stair down to a 3 x 1 landing on the boardwalk, a mossy low roof, a froglight in a cage by the door |
| Waterline stilt house | tall stilts, the back half over the water, a boardwalk landing and stair at the front, a mooring platform behind |
| Store / barn | on short stilts, mud and mangrove, a thatch roof (hay with dark oak edges) |
| Inn, smithy, store | the region's versions of the town set: mud brick and mangrove, low mossy roofs |
| Halls | green glass, mossy roofs, more froglight |

**From the ground up:**
- **Stilts and platform:** mangrove log stilts (axis y) under every corner and bay, mangrove plank platform,
  no plinth.
- **Stone buildings:** they stand on mud brick, tuff or the region's castle cobble.
- **Frame:** mangrove logs, standing proud of the walls.
- **Walls:** mud brick 70 to 85 with packed mud 15 to 30 in the lower half (BLK-01).
- **Gables:** mangrove planks.
- **Floors:** dark oak slab field with a mangrove border; packed mud on stone ground.

## Roofs

**Shapes:**
- **Default:** gable, pitch 1, low, with the eaves coming down almost to the platform.
- **Also:** jerkinheads on long houses and the inn, and turf ridges.

**What they carry:**
- moss: a ridge of moss blocks and 10 to 15% moss on the slope;
- hanging roots and vines at the eaves;
- spikes along the ridge (house rule);
- mud brick chimneys;
- froglight cages hung from the eaves.

**Colour and texture:**
- **Colours (every roof is textured):**
  - mossy dark shingle (`dark_oak` with moss);
  - mangrove;
  - mud tile (`mud_brick`);
  - thatch (`hay_block` with dark oak edges) on barns and stores.
- **Mix (Mirelight, out of 10):** mossy dark shingle 5, mangrove 3, mud tile 2. Thatch on barns and stores
  counts as the store's own roof, not as the civic accent.

**How they are made:**
- Dark oak stairs at pitch 1, with moss blocks laid along the ridge after the roof is built.
- Moss is scattered on 10 to 15% of the slope, more on the shady side.
- Overhang 1, with an eave row and barge boards in mangrove.

## Windows, doors and details

**Windows:**
- **Size and place:** few and small, high up.
- **Glass by building:**
  - houses: brown;
  - halls: green;
  - stores: a trapdoor lattice, no glass;
  - the chapel: green, lime and brown stained glass.
- **Shutters:** mangrove trapdoors on up to 4 in 10.

**Doors:** mangrove doors, reached by a stair from the boardwalk.

**Details:**
- froglights (`verdant_froglight`, `ochre_froglight`) hung in iron-bar cages by doors and along boardwalks;
- lanterns;
- lily pads;
- moss carpets;
- hanging roots;
- vines;
- mooring platforms behind waterline houses.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| stilts / platform | `mangrove_log` (axis y), `mangrove_planks` |
| footing (stone) | `mud_bricks`, `tuff`, regional castle cobble |
| infill | `mud_bricks` 70 to 85, `packed_mud` 15 to 30 (lower half) |
| stone | `tuff_bricks`, `mud_bricks`; courses `mud_brick` stairs and slabs |
| frame | `mangrove_log`, `stripped_mangrove_log` |
| trim | `mangrove` stairs, slabs, trapdoors (spruce as a second) |
| light | `verdant_froglight`, `ochre_froglight` in iron-bar cages, `lantern` |

Full table: `build-instructions/palettes/blackfen.md`; ladders BLK-01 to BLK-05:
`build-instructions/texturing/regions/blackfen.md`.

## Trees and greenery

**Trees:** bald cypress with knees and pale hanging moss, black alder, pollard willow, drowned snags. Dark woods
get dark oak stairs and fences for bark, never mud brick.

**Smaller plants:** mangrove roots, moss carpets, lily pads, hanging roots, vines.

## Building it with the skill

- **Preset:** `fen_timber`: mud brick in a proud mangrove frame, brown glass, a dark oak roof.
- **Roof:** `"roof": {"type": "gable"}`, with the house set on stilts by giving it `"y"` 3 or 4 above the
  ground.
- **Stilts:** build the stilts with `place` (mangrove logs, axis y) under every corner and frame post, down to
  the ground.
- **Parts that fit:** `porch` (a landing), `lean_to`, `woodpile`, `vines`.

```json
{"part": "house", "style": "fen_timber", "rect": [0, 0, 8, 6], "y": 4, "plinth": 1, "storeys": [5],
 "door": {"side": "s"}, "roof": {"type": "gable", "ridge": "x"}, "vines": 0.2}
```

**Not in the skill yet:**
- a stilts part (posts down to the ground, the stair to the landing);
- the moss on the roof (add it with `place`, or ask for a `moss` roof option);
- boardwalks;
- thatch roofs;
- froglight cages.

## Never

- **Ground:** no houses sitting on the wet ground.
- **Windows and colour:** no big windows, no bright colours, no white walls.
- **Light:** no froglights in walls except as the point of a building.
- **Wood:**
  - no mud brick or mangrove planks for bark on dark trees (too light and red);
  - no clean, fresh-looking timber.
- **Tone:** no horror. Uneasy, damp and quiet.
