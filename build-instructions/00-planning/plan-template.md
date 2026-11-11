# Plan: <building name>

Copy this file next to the builder (or into the design's docstring) and fill every section before
placing a block. Every number odd.

## 1. Identity

| Field | Value |
|---|---|
| Type | e.g. town house |
| Region | Vale / Frostmarch / Saltreach / Blackfen / Emberwaste / Hollow |
| Town and street | e.g. Kingsrest, High Street, north side |
| Front faces | street / square (in the plan always south, +z) |
| Rotation when placed | 0 / 90 / 180 / 270 clockwise |
| Ground under footprint | lowest y .., highest y .. |
| Interior | empty (default) / inn / custom |
| Style notes | which reference it follows, e.g. "cottage sheet, row 2 left" |

## 2. Modules

| Module | Rect (x0, z0, x1, z1) | Size | Storeys x height | Roof (shape, ridge axis, pitch) | Notes |
|---|---|---|---|---|---|
| Main | 0, 0, 8, 10 | 9 x 11 | 2 x 5 | gable, ridge z, pitch 1 | door on front centre |
| Wing | | | | | at least 2 lower, set back 2 |

## 3. Bay patterns

| Wall | Length | Pattern | Openings per bay (per storey) |
|---|---|---|---|
| Front (south) | 9 | `P1P3P1P` | ground: W, door, W / upper: W, W, W |
| East | 11 | `P3P5P` | W, W3 / W, W3 |
| North | 9 | `P3P3P` | W, W / W, W |
| West | 11 | `P5P3P` | |

## 4. Heights

| Item | y |
|---|---|
| Ground outside (y = 0 by definition after levelling) | 0 |
| Ground floor walking surface | 1 (or 2-3, see foundation) |
| Upper floor layer(s) | |
| Eaves (top of the wall) | |
| Ridge | |
| Chimney top | |

## 5. Level plans

Draw each level with the legend from `00-planning/README.md` (P # D J W = S L O . , T C B X).

```
Ground floor
```

```
Upper floor
```

```
Roof plan (ridges, valleys, dormers, chimneys)
```

## 6. Entrance

Door at (x, y, z), doorway width 3 / 5, steps: number, width, direction, landing.

## 7. Roof

Roof type per module from `06-roof/roof-types.md` with the reason in one line (span, run, place in town,
neighbours' roof types). Shape, pitch, overhang (eaves) .., verge (gables) .., colour (from `palettes/towns.md`: town mix and
the neighbours' colours), gradient rows if any, trusses visible yes/no, chimneys at.

## 8. Palette sheet (blocks for this building only)

| Role | Block(s) and mix |
|---|---|
| Footing / plinth | |
| Frame posts and beams | |
| Wall main | |
| Wall accent / texture mix | |
| Quoins / corners | |
| Floor field / border | |
| Trim wood (stairs, slabs, trapdoors) | |
| Window glass | |
| Sill / lintel | |
| Door | |
| Shutters | |
| Roof stair / slab / block | |
| Fence / rail | |
| Lights | |
| Greenery | |

## 9. Decisions made by eye

Anything the rules left open (frame flush or proud, glass tint, which side the wing goes) and why.
