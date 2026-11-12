# Emberwaste

## What the region is

The hot red desert in the east and south-east of the map, the **dragon region**. It holds these places:
- **Sunscar**, the region town.
- **Two claimable plots:**
  - Redmesa, a mesa top at the desert's edge: the carvers' yard of the forty statues;
  - Dunehold, an oasis among the dunes: the Order's house of exiled copyists.
- **Cinder Roost**, the dragon riders' school, with the Span (a gorge-bridge crossing) and the wild dragon
  nests (natural 9 x 9 nests that cannot be broken).
- **One of the seven thin places:** the Saltglass Grotto (salt in the air).

Dragons live only here, and only residents and their allies can hatch and fly them. Its role is the
**Dragon Rider** (Wingmistress Kesh Cinder). Its mood is heat, glare and dust by day, and cold stars and
dragon cries at night. It is grand and dangerous rather than gloomy.

## Theme

**Desert fantasy: a North African kasbah town with dragons.**
- **The look:** thick sandstone walls, flat roofs with parapets and roof terraces, tapering towers with
  corner horns, small deep windows behind wooden lattice, projecting roof beams, striped awnings over doors
  and markets, blue-green domes with gold finials on the civic buildings, courtyards with a palm and a well.
- **Real-world references:** the ksour of the Draa valley and Aït Benhaddou, desert caravanserais,
  Andalusian domes.
- **The fantasy:** strongest here, with the dragons, the Roost and the red mesas. The buildings stay
  believable.

## Land, weather and light

| | |
|---|---|
| Ground | sand over sandstone, red sand drifts, dunes; steep ground shows banded terracotta (mesas); oases with palms; no grass |
| Biome | `desert`: **it never rains**. Clear skies, heat |
| Light | harsh white-gold sun, deep shadows under awnings and arcades; warm lanterns and campfires in courtyards at night |
| Feel | dust, heat, red rock, shade as a luxury |

Build for sun, not rain. Roofs are flat for terraces and sleeping, with parapets. Walls are thick with
small deep windows. Shade comes from awnings, arcades and courtyards. There are no gutters, no moss and no
drip lines. Wear shows as dusty edges and a slightly darker band at the base of walls.

## Towns and paths

**Towns:**
- Towns are dense and inward-looking: blocks round courtyards, narrow shaded streets opening onto a market
  square in front of the market hall.
- A walled forge yard and granaries with walled yards sit at the edges.
- Crops need water. Sunscar's fields have no watering yet, an open question for the towns thread.

**Streets:**
- **Surface:** a bottom slab made of `smooth_red_sandstone_slab` 50, `smooth_sandstone_slab` 35 and
  `cut_red_sandstone_slab` 15, with dusty edges.
- **Verges:** `coarse_dirt`, with `red_sand` only where it cannot fall.
- **Full rules:** `build-instructions/paths/README.md`.

## Buildings

| Building | What it looks like |
|---|---|
| House | thick painted sandstone walls, a parapet round a flat roof terrace, deep windows behind acacia lattice, projecting roof beams (vigas), a striped awning; 3 in 10 carry a low red roof or a dome instead |
| Granary | a squat flat-roofed mud-and-sandstone store, a walled yard, hay under an awning |
| Market hall | a square hall behind an arcade of pointed arches, a drum with windows carrying a blue-green dome (cyan terracotta, oxidized copper near the top, a gold finial), flat parapet roofs round it with corner kiosks, stalls under the arcade |
| Caravanserai inn | a two-storey block round an open courtyard with a palm and a well, a tapering corner tower, a striped awning over the gate, rooms off an upstairs gallery |
| Smithy | a walled forge yard behind a flat-roofed workshop, an open forge under a beam-and-awning shade, a squat chimney |
| Spice and cloth store | two storeys, flat roof, a deep arched shopfront under a long striped awning, pots and barrels out front, a roof terrace with a cloth shade |
| Towers | tapering kasbah towers with corner horns (the corners rise above the parapet) |

**From the ground up:**
- **Base:** a thick sandstone base flush with the wall; raised terraces in front of homes.
- **Walls:** smooth sandstone 60, sandstone 30, cut sandstone 10 (EMB-01, slightly darker at the base),
  with cut sandstone at the corners and openings.
- **Red accents:** smooth and cut red sandstone.
- **Clay accents:** orange and white terracotta.
- **Frame:** none. Corners and piers are cut sandstone; roof beams are spruce logs sticking out every other
  block; doors and windows have stripped acacia lintels.
- **Floors:** acacia slab field, dark oak border, or smooth sandstone and cut red sandstone.

## Roofs

**Shapes:**
- **Default:** **flat**, on the wall top with no gap, behind a parapet (slabs, crenels or walls with
  posts on the corners).
- **Also:** domes on drums for civic buildings, low red pitched or domed roofs on 3 in 10 houses, and curved
  roofs.

This is the one region where flat roofs on houses are the rule, not the exception. The refinement thread's
plot designs (2026-11-12) put a flat roof on **every** building, the stone Mint included. A house with no
attic gets a low extra storey instead of a pitched roof. Mateo decided (2026-11-12): **plot buildings are all
flat; Sunscar and other towns keep the mix** below (3 in 10 red pitched or domed).

**What they carry:**
- roof terraces;
- hatches with ladders;
- cloth shades and awnings;
- corner kiosks on the market hall;
- corner horns on towers;
- projecting roof beams below the parapet;
- squat chimneys;
- on domes, a single `gold_block` finial (civic only).

**Colour and texture:**
- **Colours:**
  - flat sand roof (`smooth_sandstone` with a slab parapet and `sandstone_wall` corners);
  - red (`red_sandstone`, `smooth_red_sandstone`, `cut_red_sandstone`);
  - the blue-green dome accent (`cyan_terracotta` body, `waxed_oxidized_cut_copper` near the top).
- **Mix (Sunscar, out of 10):** flat sand roof 7, red dome or pitched 3, plus blue-green domes with a gold
  finial on civic buildings.
- **Texture:** pitched red roofs are textured like everywhere else. Flat roofs are a floor you walk on, so
  keep them plain with the parapet doing the work.

**How they are made:**
- The flat roof is a full layer on the top course of the wall, never floating.
- The parapet is 1 high round the edge, with posts on the corners.
- Roof beams (vigas) stick out every other block along the long sides, one block below the roof deck.
- Domes sit on a drum with windows, courses stepping in as a circle with no one-cell ribs, and the
  copper gets greener near the top.

## Windows, doors and details

**Windows:**
- **Size:** small and deep, with the glass set back one block behind closed acacia trapdoor lattice.
- **Surrounds:** cut sandstone, with chiseled sandstone lintels.
- **Glass by building:**
  - houses: orange;
  - halls: yellow;
  - shrines: orange, red and yellow stained glass.

**Doors:** arched doorways with acacia doors.

**Details:**
- striped awnings of wool and carpet in orange, red, yellow and white;
- lanterns;
- campfires in courtyards;
- pots and barrels;
- cactus in pots;
- a palm and a well in courtyards;
- arcades of pointed arches on civic fronts;
- stalls under the arcade.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| footing | `sandstone`, regional castle cobble |
| walls | `smooth_sandstone` 60, `sandstone` 30, `cut_sandstone` 10 |
| red stone | `smooth_red_sandstone`, `cut_red_sandstone`, `red_sandstone` |
| clay accents | `orange_terracotta`, `hardened_clay`, `white_terracotta` |
| quoin / jamb | `cut_sandstone`, `chiseled_sandstone` (lintels) |
| beams | `stripped_acacia_log`; roof beams `spruce_log` |
| trim | `acacia` stairs, slabs, trapdoors (lattice) |
| awnings | wool and carpet stripes |
| light | `lantern`, `campfire` |

Full table: `build-instructions/palettes/emberwaste.md`; ladders EMB-01 to EMB-05:
`build-instructions/texturing/regions/emberwaste.md`.

## Trees and greenery

**Trees:** date palm, umbrella acacia, baobab, argan, dragon's blood tree. Umbrella acacia and dragon's blood
still look too round, as flagged in the tree thread.

**Smaller plants:** dead bush, cactus in pots, a palm in each courtyard. No grass.

## Building it with the skill

- **Preset:** `ember_sandstone`: thick sandstone walls on the EMB-01 ladder, cut sandstone corners, orange
  glass, acacia trim. Its roof is red sandstone for the pitched share.
- **Flat roofs:** set `"roof": {"type": "flat", "parapet": "crenel" | "slab" | "wall" | "none", "beams":
  true, "hatch": true}` with `"roof": "smooth_sandstone"` in the style.
- **Parts that fit:** `arcade` (market fronts), `arch`, `belfry`, `lean_to` (forge shade), `porch`.

```json
{"part": "house", "style": {"base": "ember_sandstone", "roof": "smooth_sandstone"}, "rect": [0, 0, 8, 8],
 "storeys": [5, 4], "door": {"side": "s"}, "roof": {"type": "flat", "parapet": "crenel", "beams": true}}
```

**Not in the skill yet:**
- domes on drums;
- pointed arches;
- tapering towers with horns (use shapes);
- lattice windows set back;
- striped awnings;
- courtyards (build them as wings round an open middle).

## Never

- **Roofs:** no steep roofs, no shingle, no slate.
- **Materials:** no timber frames, no green grass, no moss.
- **Windows:** no big windows.
- **Sand:** no sand anywhere it can fall.
- **Copper:** no unwaxed copper on domes.
