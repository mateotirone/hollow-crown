# Plan: Kingsrest street house (review round 1)

Filled in from `build-instructions/00-planning/plan-template.md`. Builder: `kingsrest_house.py`.

## 1. Identity

| Field | Value |
|---|---|
| Type | town house |
| Region | Vale |
| Town and street | Kingsrest, any side street |
| Front faces | street (south in the plan) |
| Rotation when placed | set by the town generator |
| Ground under footprint | levelled to y = 0 |
| Interior | empty (floors and a stair) |
| Style notes | `reference/pictures/stone-base-timber-house.png`: stone ground floor, jettied timber upper storey, a dormer, a side lean-to, a chimney through the roof; balanced, not symmetric |

## 2. Modules

| Module | Rect (x0, z0, x1, z1) | Size | Storeys x height | Roof | Notes |
|---|---|---|---|---|---|
| Main, ground | 0, 0, 8, 10 | 9 x 11 | 1 x 5, stone | | door on the front centre |
| Main, upper | 0, -1, 8, 11 | 9 x 13 | 1 x 5, timber | gable, ridge z, pitch 1 | jettied front and back together, so the sides stay odd |
| Dormer | 5, 4, 8, 6 | 3 wide | in the roof | gable, ridge x, pitch 1 | east slope, over the middle side window; ridge 1 below the main ridge |
| Woodshed | -3, 3, -1, 7 | 3 x 5 | open | lean-to against the west wall | two posts on footings, a woodpile under it |

## 3. Bay patterns

| Wall | Length | Pattern | Openings |
|---|---|---|---|
| Front, ground | 9 | `P1P3P1P` | window, door between dressed piers, window; dark oak panels beside the windows |
| Front, upper | 9 | `P1P3P1P` | window, 3-wide window, window (stacked over the ground openings) |
| Sides | 11 / 13 | ground plain stone, upper `P3P3P3P` | windows at z 1, 5, 9 on both storeys |
| Back | 9 | `P3P3P` | windows at x 2 and 6 on both storeys |

## 4. Heights

| Item | y |
|---|---|
| Ground outside | 0 |
| Ground floor walking surface | 2 (one step up) |
| Upper floor line (floor band) | 7 |
| Wall plate | 12 |
| Eaves | 12 at the overhang |
| Ridge | 17 |
| Chimney top | the highest roof cell + 2 |

## 5. Level plans

```
Ground floor (y 2), front at the bottom
   x 0 1 2 3 4 5 6 7 8
z0   P # W # # # W # P
z1   W = = = = = = = W
z5   W = = = = = = S W     stair along the east wall, z 9 to z 4, rising north
z9   W = = = = = = S W
z10  P W # J D J # W P
```

```
Upper floor (y 8), jettied to z -1 and z 11
   x 0 1 2 3 4 5 6 7 8
z-1  P # W # P # W # P
z1   W = = = = = = = W
z5   W = = = = = = O W     stair well guarded by a fence
z9   W = = = = = = O W
z11  P W P W W W P W P
```

## 6. Entrance

Door at (4, 2, 10). The doorway is 3 wide (polished andesite piers, a stone-brick stair head). One step of stone-brick stairs, 3 wide. The jetty is the canopy, with lanterns hung from the brackets either side.

## 7. Roof

- **Shape:** a gable, pitch 1, ridge along z, with 1 overhang at the eaves and 1 at the verges. Span 9 on a side street makes a gable to the street (`roof-types.md`).
- **Colour (two options for Mateo):**
  - Warm red: brick, with granite at the eaves. Kingsrest mix, 2 in 10.
  - Old slate: deepslate tiles at the ridge down to cobbled deepslate. Kingsrest mix, 4 in 10.
- **Edges:** barge boards and an eave row in dark oak. A dark oak corner block sits under every verge foot, with lanterns on chains at the two street corners.
- **Chimney:** a stone stack through the west slope, with the default top (signs, campfire, trapdoors, pot).

## 8. Palette sheet

| Role | Block(s) |
|---|---|
| Footing / plinth | cobblestone |
| Ground walls | VAL-01 gradient (tuff bricks, cobblestone, andesite, smooth stone), painted with teeth |
| Quoins, door piers | polished andesite |
| Frame posts and beams | stripped spruce log |
| Wall main (upper) | calcite |
| Floor field / border | spruce slab / dark oak slab, beamed (logs flush every 4) |
| Trim wood | dark oak stairs, slabs, planks |
| Jetty supports | dark oak stairs under the posts; spruce slabs and trapdoors between |
| Glass | brown stained glass pane |
| Window heads (stone) | stone brick stairs, upside down |
| Door | spruce door |
| Shutters | spruce trapdoors on 4 of 13 windows, in symmetric pairs |
| Window boxes | azalea leaves boxed in by spruce wall signs, under every upper window |
| Fence | spruce fence |
| Lights | lanterns |
| Greenery | azalea, poppy and cornflower planters, vines on the north wall |

## 9. Decisions made by eye

- **Frame wood:** stripped spruce, not dark oak. The palette asks for a dark brown frame, but dark oak bark beside a dark slate roof made the earlier houses gloomy. The warm frame matches Mateo's reference house. Dark oak is kept as the darkest accent (trim, panels, brackets), which follows the stone / spruce / dark oak pairing. **Needs Mateo's OK.**
- **Frame flush:** a neat town house. The depth comes from the jetty, the window boxes, the eaves and the plinth.
- **No close studding on the front:** in test house v2 it made the front mostly dark wood (04-walls: at least half infill).
- **Lanterns:** only at the door and the two street verge corners. There are no lanterns on window shelves, so the front stays calm.
