# Everwake (the city in the sky)

Read this before you build anything for Everwake: the city itself, the Needle, the cloud sea, or the sky
model of it. The plan behind it is the Claude Doc "Cloud City and Flight: Plan" (Mateo, 2026-11-12).

## What the region is

Everwake is the bellfounders' town that Queen Maelis's Founding Bell rang *up* on the night it rang the
Hollow out. It has hung on that held note for 700 years, watching the Gate. It shows itself to a player only
once they open the Gate. It comes closer like a falling star, and after Morvane falls it stays where it is.
Each player sees it at their own stage of the story. The real block city stands at the far south end of the
Horizon Isles, on top of the Needle, above a sea of cloud. It is where players earn the Everwake Wings.

Mood: beautiful and wrong at once. Sunlit, silent, a city that should have fallen long ago. Uneasy, not
horror. Almost nobody lives there: a handful of Bellkeepers who never sleep.

## Theme

A white stone hill town, half Mont-Saint-Michel and half bell foundry, lifted into the clouds. The fantasy
is in the setting (a city on a cloud, stone roots hanging under it), not in the buildings. Each building
is plain and well made: white stone walls, aged copper roofs, gold only on the bells and spire tops.

## Land, weather and light

- **Ground:** the city's paving at Y 254 is a cloud-shaped disc: a main disc of radius 60 with seven lobes.
  Under it is a belly of cloud (white and light grey wool and concrete, darker underneath), with stone
  roots (tuff to calcite) hanging out of it.
- **The Needle:** a sea stack of tuff, andesite, diorite and calcite, from the sea (Y 62) to about Y 245,
  south of the city. It has wind-cut ledges and three wind shrines on the climbing line. Its top sits under
  the cloud sea. A stone stair climbs the last 15 blocks to the city's gate.
- **Cloud sea:** about Y 238 to 242 all around, hiding the ground. In the finished world it will be a custom
  cloud block you fall through. Builds and viewer scenes use white wool as a stand-in.
- **Weather:** always clear. Wind and chimes by day; at night a full sky of stars and almost no sound. No
  rain, no snow.

## Towns and paths

- One city. The Spire of the Held Note stands in the middle, with seven bell towers in a ring at radius 44.
- **Streets:** seven avenues run from the Spire to the towers, with a wider one due south to the gate, and
  a ring street at radius 28. Streets are polished andesite and the plazas are a noisy mix of polished diorite,
  calcite and smooth quartz.
- A low parapet runs round the outer edge, one block high, with a gap at the gate.
- Houses fill the spaces between the streets, each with its door toward the Spire.

## Buildings

| Building | Size | What it is |
|---|---|---|
| Spire of the Held Note | 21 x 21 base, 4 storeys, paved crenellated terrace; 15 x 15 shaft, 3 storeys of slits and lancets; 17 x 17 open belfry (6 high) on corbels; copper spire (rows 2) to the finial at Y 316 | The landmark. The open belfry is the boss arena (deck at Y 291) |
| Bell towers (7) | 7 x 7 shaft of four 6-high stages, 9 x 9 open belfry on corbels, copper spire (rows 3), about 46 high | One per Note. Each will hold a Gatehouse bell |
| Gatehouse | 11 x 9 hall with an open arcade on the ground storey, two 5 x 5 towers (three 6-high stages, 7 x 7 belfry on corbels, copper spire without a flare) | Where the Needle stair arrives |
| Houses | 7 x 7 to 11 x 9, one or two storeys (5, 4), hip or gable roofs | Empty inside (house rule). Doors face the Spire |
| The Last Inn | the first 9 x 9 or larger house inside the ring, two full storeys | The only interior, later |

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
- **Specs:** `map/structures/everwake/spec.py` writes the whole city and the Needle; `map/structures/everwake_builds.py OUT`
  builds them (asset viewer section "Everwake").
- Local y 0 is world Y 255 (the paving is local -1). Nothing may go above local 64 (Y 319).

```json
{"part": "house", "style": "everwake_stone", "rect": [0, 0, 8, 6], "y": 0, "storeys": [5, 4], "door": {"side": "s"},
 "chimney": false, "roof": {"type": "hip"}, "shutters": 0.25}
```

**Not in the skill yet:** the cloud-shaped platform and parapet, the cloud belly and the Needle are shapes in
`spec.py`; the stair to the gate and the street paint are `place` cells.

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

- Nothing above Y 319, and no build that lets a player tower up to the sky model (it is an illusion).
- No dark timber, no dark walls, no chimneys, no coloured concrete roofs.
- No trees, no farms, no signs of daily life beyond the Bellkeepers.
- No vanilla particles on the city later: its glow and chimes are custom.
