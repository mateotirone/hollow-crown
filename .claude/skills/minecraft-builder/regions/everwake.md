# Everwake (the city in the sky)

Read this before you build anything for Everwake: the city itself, the island under it, the air boat station, or the sky
model of it. The plan behind it is the Claude Doc "Cloud City and Flight: Plan" (Mateo, 2026-11-12).

## What the region is

Everwake is the bellfounders' town that Queen Maelis's Founding Bell rang *up* on the night it rang the
Hollow out. It has hung on that held note for 700 years, watching the Gate. It shows itself to a player only
once they open the Gate. It comes closer like a falling star, and after Morvane falls it stays where it is.
Each player sees it at their own stage of the story. The real block city is **its own world** (a custom
dimension, like the Hollow; Mateo 2026-11-13), hanging over a far-off copy of Aldmere's own land. Players reach
it by **air boat**: the air boat station in Aldmere is a ruin until the story brings the city in, then it is
rebuilt and an air boat moors at its mast. Walking through the Gate on the mast deck (a portal) takes the player
to Everwake; in the story they are simply riding the air boat. It is where players earn the Everwake Wings.

Mood: beautiful and wrong at once. Sunlit, silent, a city that should have fallen long ago. Uneasy, not
horror. Almost nobody lives there: a handful of Bellkeepers who never sleep.

## Theme

A white stone hill town, half Mont-Saint-Michel and half bell foundry, lifted into the clouds. The fantasy
is in the setting (a city on a cloud, stone roots hanging under it), not in the buildings. Each building
is plain and well made: white stone walls, aged copper roofs, gold only on the bells and spire tops.

## Land, weather and light

- **Ground:** the city's paving at Y 254 is a cloud-shaped disc: a main disc of radius 88 with seven lobes
  (about 210 across, round 2, Mateo 2026-11-13: "much more dense ... maybe bigger").
- **Underneath (round 2, Mateo: "the platform itself needs some work"):** the deck sits on the hill it was rung
  up with: a floating island of rock (tuff at the tip to calcite under the deck), broad under the deck and
  narrowing in lumps to a ragged point about 66 below, with a shoulder of rock under each lobe and lesser crags
  hanging off. Cloud wraps the rim and the island's shoulders in round puffs, white on top and grey only on the
  undersides. No loose floating puffs below: from the side they read as flying stones.
- **Below:** far down (about 180 blocks) lies Aldmere's real land, cut from the map's terrain (the viewer uses
  the country round Wren Water). Looking off the edge you see fields, forest and rivers through the haze.
- **Air boat dock:** a stone pier runs on south from the gatehouse over the cloud, on corbel brackets, to a
  small mooring mast; the air boat lies along its east side with a gangway across to its gondola. (The boat
  itself is designed in its own thread.)
- **Weather:** always clear. Wind and chimes by day; at night a full sky of stars and almost no sound. No
  rain, no snow.

## Towns and paths

- One city, dense (round 2). The Spire of the Held Note stands in the middle, with seven bell towers in a ring at
  radius 64.
- **Streets:** seven avenues (3 wide) run from the Spire past the towers to the edge, with a wider one (5) due
  south to the gate; three ring streets at radius 30, 54 and 78; lanes (1 wide) halfway between the avenues from
  the first ring out, and quarter lanes in the outer band; a loop lane round each lobe. Streets are polished
  andesite and the plazas are a noisy mix of polished diorite, calcite and smooth quartz.
- A low parapet runs round the outer edge, one block high, with a gap at the gate.
- **Blocks between the streets are full:** houses are packed from the street edge inwards, each fronting its
  nearest street with the door on it, two blocks between walls so the eaves meet over a gutter lane. Three
  storeys toward the Spire, two in the middle band, some one-storey at the rim. Six civic buildings go in first
  (bell foundry, Bellkeepers' hall, market hall, the Last Inn, chapter house, ringers' lodge). No ridge spikes
  on houses (`"finials": false`).

## Buildings

| Building | Size | What it is |
|---|---|---|
| Spire of the Held Note | 21 x 21 base, 4 storeys, paved crenellated terrace; 15 x 15 shaft, 3 storeys of slits and lancets; 17 x 17 open belfry (6 high) on corbels; copper spire (rows 2) to the finial at Y 316 | The landmark. The open belfry is the boss arena (deck at Y 291) |
| Bell towers (7) | 7 x 7 shaft of four 6-high stages, 9 x 9 open belfry on corbels, copper spire (rows 3), about 46 high | One per Note. Each will hold a Gatehouse bell |
| Gatehouse | 11 x 9 hall with an open arcade on the ground storey, two 5 x 5 towers (three 6-high stages, 7 x 7 belfry on corbels, copper spire without a flare) | Where the air boat pier arrives |
| Houses | 5 x 7 to 11 x 9, one to three storeys (5, 4, 4), hip or gable roofs | Interiors by the skill (every building has one). Doors on the street |
| Civic | bell foundry 17 x 13, Bellkeepers' hall 15 x 13, market hall 15 x 11, the Last Inn 13 x 11, chapter house 13 x 13, ringers' lodge 13 x 9 | Grand doors on the street |
| Air boat dock | 7-wide pier, 40 long, a 5 x 5 mooring mast at the end | Where players arrive |

## Towers (build-instructions/towers, Mateo 2026-11-12)

Every Everwake tower is built by the tower guide, with `tower()` in `spec.py`:

- **Shaft:** plain white stone (`everwake_stone`, stone frame: diorite quoins and a course at every stage
  line), stages 6 high, 3 to 5 times the width. Windows are bare slits (1x2) low and lancets (1x3) in the top
  stage, stacked centre on centre, with no shutters, sill or surround (style `"panel": null, "sill": "none"`).
- **Top stage:** an open belfry one block wider on every side, quartz-brick piers and a smooth-quartz deck,
  carried on smooth-quartz corbels (upside-down stairs) at each corner and every 3rd block. A bell in every one.
- **Roof:** a steep waxed copper spire, weathered at the eave to oxidized at the top, with a birch eave ring:
  rows 3 on the bell towers, rows 2 on the Spire (the Y 319 limit caps it), no flare on the 5-wide gate towers
  (a 9-wide eave on a 5-wide shaft reads as a mushroom). The spire top block finishes every one.
- Outline changes four times: plinth, shaft, corbelled belfry, spire. The Spire stays the tallest; the bell
  towers frame it.

## Roofs

- Most roofs are waxed copper, weathered at the eaves and oxidized at the ridge (a gradient, so no second
  texture block). About a quarter are exposed-to-weathered copper (warmer). About a fifth are smooth quartz
  textured with polished diorite (white roofs).
- Hip roofs mostly; some gables. Pitch 1. Spires on towers step every 2 rows (rows 2).
- Never coloured concrete roofs: light blue concrete read as swimming pools in the first pass.

## Windows, doors and details

- Light blue stained glass panes, flush with the wall. Birch doors, birch trim.
- Diorite quoins, smooth quartz string courses on the Spire, quartz brick piers on the belfries.
- Shutters on about a quarter of windows. No chimneys anywhere: nobody up here keeps a fire.
- Bells (vanilla `bell`) in every belfry. Gold only for finials and bells, never on walls.

## Colour and blocks (short)

| Role | Blocks |
|---|---|
| Walls | polished diorite to calcite (`axis y`), smooth quartz frame, diorite quoins |
| Plinth | polished diorite and calcite, noisy |
| Roofs | waxed weathered to oxidized cut copper; exposed to weathered; smooth quartz + polished diorite |
| Trim | birch planks (stairs, slabs, trapdoors) |
| Paving | polished diorite, calcite, smooth quartz; streets polished andesite |
| Cloud | light grey wool, white concrete, white wool (bottom to top), never textured |
| Rock | tuff, andesite, diorite, calcite (bottom to top) |

## Trees and greenery

No trees. Azalea leaves in window boxes, and later small hanging gardens on the terraces.

## Building it with the skill

- **Preset:** `everwake_stone` (in `scripts/parts.py`).
- **Specs:** `map/structures/everwake/spec.py` writes the whole city (the Needle is gone in round 2);
  `map/structures/everwake_builds.py OUT` builds it (asset viewer section "Everwake"). The air boat station is
  `map/structures/everwake/station.py` (restored and ruin from one design, the ruin by the engine's `"ruin"` step).
- Local y 0 is world Y 255 (the paving is local -1). Nothing may go above local 64 (Y 319).

```json
{"part": "house", "style": "everwake_stone", "rect": [0, 0, 8, 6], "y": 0, "storeys": [5, 4], "door": {"side": "s"},
 "chimney": false, "roof": {"type": "hip"}, "shutters": 0.25}
```

**Not in the skill yet:** the cloud-shaped platform and parapet, the island and cloud underneath are shapes in
`spec.py`; the pier and the street paint are `place` cells.

## The air boat (Mateo OK 2026-11-13)

The blimp that carries players to Everwake (in lore; the station's Gate teleports them). One build,
`map/structures/everwake/airboat.py`: `cells(ring_at, heading)` places it with its copper nose ring at a mooring,
nose pointing e/w/n/s; `MOORING` gives the deck (20 under the ring), the bow rail gap and the starboard door.

- Envelope 61 x 19: white wool with a light grey belly (two-row dithered seam), weathered copper ribs every 8,
  cut copper caps on nose and tail. A long tapering tail, never a blunt egg end.
- Fins: four in a cross growing out of the taper, white canvas with birch spars and edge, a 2-block weathered
  copper rudder or elevator on the trailing edge behind a stripped birch hinge. Never flat plank boards.
- Stern: two copper nacelles on dark oak struts with open-trapdoor propellers, and an X-bladed pusher prop
  behind the tail (clear of the cross of fins).
- Gondola 7 x 15 cabin on a curved dark oak hull: dark oak base row, a band of light blue glass panes between
  stripped birch posts, copper roof with an upside-down-stair eave. Inside: benches, chart table, bell,
  lanterns. Hung on iron chains from a dark oak keel beam.
- The envelope is fitted ring by ring with the skill part `envelope` (parts.py), not a `lathe` shape: the
  lathe fit is jaggy and holed on a horizontal axis.

## Never

- Nothing above Y 319 (Everwake's own world has the same height limit).
- No dark timber, no dark walls, no chimneys, no coloured concrete roofs.
- No trees, no farms, no signs of daily life beyond the Bellkeepers.
- No vanilla particles on the city later: its glow and chimes are custom.
