# Block states

How to make shaped blocks face the right way. Builders write states the `bp.py` way; `bp.py` turns
them into Bedrock states when it writes `.mcstructure` and stamp files. Directions: `n` = -z, `s` = +z,
`e` = +x, `w` = -x. Designs face south (+z); rotating a stamp turns every `facing` and swaps `x`/`z`
axes (`bp.py` does this).

## Stairs

- `facing` = the side the **tall back** of the stair is on. A stair with `facing="n"` climbs towards
  the north: you walk up it going north.
- `half="bottom"` (default) = right way up. `half="top"` = upside down (the solid half on top).
- Bedrock: `weirdo_direction` 0 = east, 1 = west, 2 = south, 3 = north (the tall side), and
  `upside_down_bit`.

| What you want | facing | half |
|---|---|---|
| Roof stair on the south slope (climbing north to the ridge) | `n` | bottom |
| Entrance step in front of a door on the south wall | `n` (tall side towards the house) | bottom |
| Window sill on a south wall, sticking out | `n` (tall side against the wall) | bottom |
| Bracket under a south jetty or eave | `n` (tall side against the wall) | top |
| Barge board under a verge on the east gable | `w` (tall side towards the building) | top |
| Arch corner, left top corner of an opening (seen from outside on a south wall) | tall side against the left jamb: `w` | top |
| Arch corner, right top corner | `e` | top |
| Stair head above a stone window on a south wall | `s` (as `kit.window` kind="stone") | top |

Corner stairs (inner and outer) form by themselves in game when two stairs meet; the renderer shows
them the same way.

## Slabs

- `half="bottom"` sits in the lower half of the block, `half="top"` in the upper half.
- Bedrock: `minecraft:vertical_half` = `bottom` / `top`.
- Floors: top slabs (walking surface at the block top). Ridge caps, parapets: bottom slabs. Arch and
  head pieces: top slabs.

## Trapdoors

- `facing` is Java style in `bp.py`. The working convention from `kit.py`: **shutters** on a wall whose
  outside faces direction `d` are `facing=d`, `open=True`, placed in the cells just outside the wall beside
  the window (`kit.window`); **planter fronts** the same, one cell further out (`kit.flower_box`).
- `open=True` = standing up (shutters, surrounds, planter sides). `open=False` = lying flat (hatches,
  thin caps); with `half="top"` it lies in the top of the cell (a thin lip under a sill or an arch).
- Bedrock: `direction` 0 = east, 1 = west, 2 = south, 3 = north, `open_bit`, `upside_down_bit`.
  `map/structures/README.md` flags the direction numbers as needing an in-game check: check shutters in
  game on the first build of a new design.

## Logs

- `axis="y"` upright (posts), `axis="x"` lying east-west (beams on north and south walls), `axis="z"`
  lying north-south (beams on east and west walls, joists spanning north-south).
- Bedrock: `pillar_axis`.

## Doors

- `facing` = the way the door faces out; `upper=True` for the top half; `hinge` for the hinge side.
- Bedrock: `minecraft:cardinal_direction`, `upper_block_bit`, `door_hinge_bit`, `open_bit`.
- Place both halves. Hinge on the side away from the inside stair, so the door opens against the wall.

## Lanterns, beds, others

- Lanterns: `hanging=True` under a block (beams, canopies, arches), otherwise standing.
- Beds: direction 0 south, 1 west, 2 north, 3 east (head end); flagged for an in-game check.
- Barrels: `facing_direction` 1 (up) by default.
