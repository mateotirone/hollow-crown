# Plan: Kingsrest coaching inn (review round 2)

Builder: `kingsrest_inn.py`. The layout follows `build-instructions/00-planning/plan-template.md`.

## 1. Identity

| Field | Value |
|---|---|
| Type | inn (the only standard build that is furnished) |
| Region | Vale |
| Town and street | Kingsrest, on the square |
| Front faces | the square (south in the plan) |
| Interior | furnished (08-interiors) |
| Style notes | cross-wing coaching inn: a long range with a carriage arch through to the yard, and a gabled wing standing forward to the street with the door. Stone below, jettied timber above, like the street house |

## 2. Modules

| Module | Rect | Size | Storeys | Roof | Notes |
|---|---|---|---|---|---|
| Range, ground | 0, 0, 26, 10 | 27 x 11 | 1 x 5 stone | | carriage arch x 5..9, 5 wide |
| Range, upper | 0, -1, 26, 11 | 27 x 13 | 1 x 5 timber | gable, ridge x, pitch 1, ridge y 19 | jettied front and back |
| Cross wing | 15, 11, 23, 18 (upper to 19) | 9 wide | 2 x 5 | gable to the street, ridge z, ridge y 17 (2 below the range) | inn door on its centre line |
| Dormers | 3 wide | 5 | in the roof | gable, ridge 16 | 2 on the street slope (x 2, 12), 3 on the back slope (x 7, 13, 19) over the windows |
| Chimneys | both gable ends | | | | outside breasts 3 wide, then 1 wide up through the verge |

The wing stands 3 in from the range's east end, so no side wall runs flush.

## 3. Bay patterns

| Wall | Pattern | Openings |
|---|---|---|
| Range back (27) | `P3P5P5P5P3P` | ground: slim stone windows; the arch in the 5-bay at x 5..9; upper: 1, 3, 3, 3, 1 wide windows |
| Range front, west of wing (15) | `P3P5P3P` | ground: window, arch, window; upper: window, 3-wide over the arch, window |
| Wing front (9) | `P1P3P1P` | ground: window, door between piers, window; upper: window, 3-wide, window; gable window on the centre line |
| Range ends (11 / 13) | upper `P3P3P3P` | windows at z 2 and 8 (ground), z 1 and 9 (upper); chimney breast on the centre line |
| Wing sides (9) | `P3P3P` | windows at z 12 and 16 (ground), z 13 and 17 (upper) |

## 4. Heights

The ground floor is at y 2, with one step up. The upper floor band is at y 7 and the wall plate at y 12. The arch opening runs from y 1 to y 5, with its curve in the top row.

## 5. Rooms (furnished)

| Floor | Room | Contents |
|---|---|---|
| Ground | tap room (wing) | bar with barrels behind, two tables with chairs |
| Ground | hall (range, east of the arch) | long table and benches, hearth on the east gable, the stair up along the back wall |
| Ground | parlour (west of the arch) | hearth on the west gable, a table |
| Upper | street side | three bedrooms west of the wing and one at the east end, each with a bed, chest and lantern |
| Upper | wing | the innkeeper's hall: bookshelves, a table, a lectern |
| Upper | back | a gallery along the back with the stair well, railed |

## 6. Palette

Same sheet as the street house:

- **Stone:** VAL-01 gradient below, with polished andesite quoins, arch piers and door piers.
- **Timber:** stripped spruce frame with calcite infill, dark oak trim and brackets.
- **Floors:** stone in the tap room and hall; boards in the parlour and upstairs.
- **Roof:** warm red (brick with granite at random).
- **Lights:** lanterns on chains at every verge foot.
- **Ridges:** spruce spikes every 5, with lightning-rod finials.

## 7. Decisions made by eye

- **Roof colour:** warm red, to sit beside the street house on the square. Slate is the alternative.
- **Arch curve:** the curve runs the whole depth of the passage, so it reads as a vault from inside. Beams and planks above it carry the upper floor.
- **Back dormers:** three dormers break up the 27-block back slope (stage 0 asks for a break every 7 to 15 blocks).
- **Lanterns:** at the door, in both arch crowns and at the verge corners. There are none on the window shelves.
