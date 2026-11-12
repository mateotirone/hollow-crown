# Plan: Kingsrest guildhall (review round 1)

Builder: `kingsrest_guildhall.py`. The layout follows `build-instructions/00-planning/plan-template.md`.

## 1. Identity

| Field | Value |
|---|---|
| Type | civic hall (empty interior, stairs only) |
| Region | Vale |
| Town and street | Kingsrest, on the square |
| Front faces | the square (south in the plan) |
| Style notes | open market arcade below, the guild's hall above, copper roof and a small belfry on the ridge |

## 2. Modules

| Module | Rect | Size | Storeys | Roof | Notes |
|---|---|---|---|---|---|
| Plinth | 0, 0, 20, 12 | 21 x 13 | 3 courses | | cobble footing, polished andesite top, front flight with cheeks |
| Market arcade | 0, 0, 20, 12 | 21 x 13 | 1 x 6 | | piers every 4, round-angle arches, columns inside carry the floor |
| Hall | 0, 0, 20, 12 | 21 x 13 | 1 x 8 | copper gable, ridge x | pilasters on every pier line, stone gables with round windows |
| Belfry | on the ridge, centre | 3 x 3 | | copper cap | stone base, wall posts, hanging bell, lightning rod |
| Chimney | east side, z 3 | | | | stone |

## 3. Bay patterns

| Wall | Pattern | Openings |
|---|---|---|
| Front / back (21) | `P3P3P3P3P3P` | arcade arches below; hall: tall windows, a 3-wide centre window with keystone on the front |
| Sides (13) | `P3P3P3P` | arches below; tall windows at z 2, 6, 10 |

## 4. Heights

Market floor y 3 (plinth), arch crowns y 7, hall floor y 9, wall top y 16.

## 5. Palette

- **Stone:** stone bricks with the VAL-01 gradient, polished andesite dressings and quoins.
- **Trim:** spruce, dark oak beams under the hall floor.
- **Roof:** copper (keeps its weathering fade, per 06-roof).
- **Lights:** lanterns in every arch crown and at the steps.

## 6. Decisions made by eye

- An open arcade under the hall gives the square a covered market and stops this reading as a big stone box.
- Copper roof marks it as civic beside the red and slate houses.
