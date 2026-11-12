# Saltreach

## What the region is

The long western coast of the map, from the white chalk cliffs in the north to the dunes in the south.
It holds these places:
- **Gull's Rest**, the region's harbour town.
- **Two claimable plots:**
  - Gullcliff, on the clifftop over the northern coast, once a beacon station;
  - Tidewatch, in the dunes above the southern shore, once a tide-readers' house.
- **One of the seven thin places:** the Drowned Chapel (swim to reach it, an old bronze bell at the mouth,
  cut by hands, salt in the air).
- **The Far Shore and the Horizon Isles**, expansion zones the map leaves empty out to sea.

It is the land of sailors, trade and weather-watchers. Its role is the **Captain** (Harbourmistress Ottilie
Holt and her Debt Book): the fleet and harbour trade. Its mood is bright and windy by day. At night it is
a dark coast with one lighthouse, where sails come in without wind.

## Theme

**A sunlit harbour town, half Mediterranean and half Atlantic, medieval with no overt fantasy.**
- **The town:** wind-proof pale stone ground storeys, whitewashed upper walls between pale birch frames,
  low hipped sea-green roofs, white and orange roofs among them, painted shutters, domes and a lighthouse on
  the civic buildings. Think of a fishing port on the Portuguese or Breton coast with a touch of the Greek
  islands.
- **The northern coast:** English chalk downs cut off by the sea, like the Seven Sisters and Dover (Mateo
  asked for that coast).
- **The fantasy:** only in the colour, the sea-green and copper.

## Land, weather and light

| | |
|---|---|
| Ground | stony shore, gravel and coarse ground (biome `stone_beach`); in the north white chalk cliffs with grass to the edge, buttresses, flutes and ledges, fallen chalk and flint shingle at the foot; in the south dunes above the shore |
| Weather | the world's normal weather, with rain and storms off the sea; sieges bring the Long Night's thunderstorm |
| Region weather | **sea wind**: a light blue-grey haze with spray blowing inland from the west. **Sea fret**: a thick white fog (#c3cbcd) with a buoy bell, mostly at first light (region weather, PR #193: spells of 3 to 16 minutes with 6 to 22 minutes of plain sky between; under a roof it thins to a grey light; never in caves) |
| Light | bright, bleached, salt-white; the lighthouse's sea lanterns at night |
| Feel | wind, salt, white walls, blue-green roofs and shutters, gulls, nets drying |

Build for wind and salt. The ground storeys are stone and the roofs low (pitch 1, hipped) so the wind
slides over. Colours are bleached and pale. Kelp dries on walls. Lanterns that show through fog matter here: light the quay, the harbour steps and doors so they read in a sea fret.

## Towns and paths

**Towns:**
- Towns step down to the water: houses on the slope, the quay, the boathouse and the lighthouse on the shore.
- Gull's Rest's ward as laid out has no water inside it yet, so the shore buildings are not placed. See
  the conflicts list in the README.

**Streets:**
- **Surface:** a bottom slab made of `smooth_sandstone_slab` 60, `sandstone_slab` 25 and `cobblestone_slab`
  15, sand-coloured and bleached.
- **Verges:** `smooth_sandstone`, with `sand` only where it cannot fall.
- **Full rules:** `build-instructions/paths/README.md`.

## Buildings

| Building | What it looks like |
|---|---|
| House | a stone ground storey (wind-proof), a whitewashed upper storey between pale birch posts, a low hipped roof (pitch 1), painted sea-green shutters; some have a flat roof terrace on a lower wing |
| Net store / farm store | stone below, white boards above, a low hipped roof, a hoist beam over a loft door |
| Quay | a stone quay wall with mooring bollards, a timber jetty on piles, a cargo crane, barrels and nets, the harbourmaster's hut |
| Lighthouse | an octagonal white tower banded in teal on a stone base at the water's edge, a gallery on brackets, a glass lamp room with sea lanterns, an oxidized copper cap, the keeper's cottage beside it |
| Boathouse | a stone shed straddling the shore, its back open over a water slip with a boat cradle and winch, a sea-green hipped roof, a net loft |
| Inn, smithy, store | the region's versions of the town set: pale stone below, whitewash above, hipped roofs |
| Civic | arcades of 3-wide arches on the front; domes from hall level 2; the lighthouse tower from level 3 |

**From the ground up:**
- **Plinth:** warm grey (SAL-05: `tuff`, `cobblestone`, `andesite`).
- **Ground storey:** pale sand stone (SAL-01: `white_terracotta`, `sandstone`, `smooth_sandstone`,
  `smooth_quartz`), with `cut_sandstone` corners.
- **Upper storey:** bright white whitewash (SAL-02: `polished_diorite`, `white_concrete`, `calcite`,
  `smooth_quartz`) between `stripped_birch_log` or stripped oak posts, flush.
- **Floors:** birch slab field, oak border, or smooth sandstone and white terracotta tiles.

## Roofs

**Shapes:**
- **Default:** hip, pitch 1 (low).
- **Also:** low gables on stores, flat roof terraces on the lower wing of harbour houses, domes on civic
  buildings, the lighthouse cap.

**No dormers** on Saltreach hipped roofs: the roofs stay low (refinement thread, 2026-11-12).

**What they carry:**
- spikes along the ridge (house rule);
- brick chimneys;
- hoist beams on stores;
- an oxidized copper cap on the lighthouse;
- copper domes on civic buildings, oxidized at the top.

**Colour and texture:**
- **Colours (every roof is textured):**
  - sea green (`dark_prismarine`);
  - light teal (`prismarine_bricks`);
  - white (`smooth_quartz`, `polished_diorite`);
  - orange tile (`waxed_cut_copper`, `acacia`);
  - slate (`deepslate_tile`);
  - copper domes as a civic accent.
- **Mix (Gull's Rest, out of 10):** sea green 4, white 3, orange tile 2, slate 1, plus oxidized copper domes
  and the lighthouse cap.

**How they are made:**
- Hip roofs step in from every side, with outer-corner stairs on the hips.
- Overhang 1, with an eave row of birch stairs.
- A flat terrace sits on the wall top with a parapet (`"type": "flat"`).

## Windows, doors and details

**Windows:**
- **Glass by building:**
  - houses: `light_blue_stained_glass_pane`;
  - stores and shops: clear below, white above;
  - civic: cyan;
  - the chapel: blue, cyan and yellow stained glass.
- **Shutters:** painted shutters are the region's signature, still on at most 3 in 10: teal `warped_trapdoor`
  or pale birch.
- **Sills:** smooth sandstone.

**Doors:** birch doors, with teal warped doors on some.

**Details:**
- flowers in pots;
- sea pickles;
- dried kelp blocks drying on walls;
- nets;
- barrels and crates on the quay;
- bollards;
- arcades on civic fronts.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| plinth | `cobblestone` 40, `andesite` 30, `stone_bricks` 30 |
| stone | `smooth_sandstone`, `stone_bricks`; quoins `cut_sandstone` |
| whitewash | `calcite`, `white_concrete`, `smooth_quartz` (brightest, civic) |
| frame | `stripped_birch_log`, `stripped_oak_log` |
| trim | `birch` (oak) stairs, slabs, trapdoors |
| shutters | `warped_trapdoor` (teal), `birch_trapdoor` |
| chimney | `brick_block` |
| light | `lantern`; `sea_lantern` in the lighthouse |

Full table: `build-instructions/palettes/saltreach.md`; ladders SAL-01 to SAL-06:
`build-instructions/texturing/regions/saltreach.md`.

## Trees and greenery

**Trees** are few and windswept: wind-sheared cypress, umbrella pine, Italian cypress, olive and tamarisk.

**Smaller plants:** flowers in pots and sea pickles. There is little grass in town.

## Building it with the skill

- **Presets:**
  - `salt_timber`: whitewash between birch posts, teal shutters;
  - `salt_stone`: pale sandstone, cyan glass, for civic buildings and ground storeys.
- **A typical house:** a `salt_stone` ground storey under a `salt_timber` upper storey.
- **Roof:** `"roof": {"type": "hip"}`.
- **Parts that fit:** `arcade` (civic fronts), `balconies`, `belfry`, `porch`, `lean_to` (net
  stores), and `"type": "flat"` for terraces.

```json
{"part": "house", "style": "salt_timber", "rect": [0, 0, 8, 8], "storeys": [5, 4], "door": {"side": "s"},
 "roof": {"type": "hip"}, "storey_style": [{"frame_kind": "stone", "infill": "SAL-01"}, {}], "shutters": true}
```

**Not in the skill yet:**
- the octagonal lighthouse (build it with shapes: a cylinder at 8 sides);
- piles and jetties (use `place`).

## Never

- **Walls and colours:** no dark timber frames and no dark walls; Saltreach is pale.
- **Roofs:** no dormers, no steep roofs on houses, and no flat roofs over a whole house (terraces only on a lower wing).
- **Materials:**
  - no sand in walls, and no sand anywhere it can fall;
  - no unwaxed copper (it turns green on its own).
- **Shutters:** never on every window, even though they are the signature.
