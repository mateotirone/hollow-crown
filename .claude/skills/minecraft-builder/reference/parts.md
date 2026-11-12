# Parts

Load when the spec has `parts`. Code: `scripts/parts.py`. Each part writes cells tagged with its stage, so
`--stages` shows the build the way `build-instructions/` builds it, one stage at a time. Where a rule comes
from is given as the stage file (`build-instructions/<stage>/README.md`); read that file when you need the
reasoning or a case the part does not cover.

Conventions: `rect` = [x0, z0, x1, z1] inclusive; sides n (z0), s (z1), e (x1), w (x0); `at` along a wall
is the offset from the wall's centre block, positive to the right as seen from outside. Facings follow
`map/structures/bp.py`: a stair faces its tall side; trapdoors and doors face Java-style.

## `house`: a whole building by the stages

```json
{"part": "house", "style": "vale_timber", "rect": [-4, -5, 4, 5], "y": 0, "plinth": 1,
 "storeys": [5, 5], "jetty": ["n", "s"], "frame": "flush", "bay": 3,
 "door": {"side": "s", "at": 0, "kind": "house", "canopy": true, "steps": 1},
 "windows": "auto", "shutters": 0.3,
 "roof": {"type": "gable", "ridge": "z", "pitch": 1, "overhang": 1, "verge": 1},
 "chimney": "auto", "materials": {"roof": "VAL-07"}}
```

| Key | Default | What it does, and the rule behind it |
|---|---|---|
| `style` | `vale_timber` | a preset of materials by role (below), or `{"base": "vale_stone", ...overrides}` |
| `rect`, `y` | | footprint, odd both ways (warned otherwise; 00-planning, "work in threes"). `y` = first plinth row, on the ground |
| `plinth` | 1 | courses of the plinth mix round the footprint; the top course is the ground floor layer (01-foundation step 3) |
| `storeys` | [5] | each storey = its floor/beam row + wall rows. 5 = 4 clear inside. Storey height 4 or 5 (Mateo) |
| `jetty` | [] | upper storeys step out 1 on these sides. In pairs only (n+s or e+w) so walls stay odd (02-frame step 5) |
| `frame` | from style | `flush` (logs and infill in one plane), `proud` (frame 1 out, infill stays on the wall line, never recessed), `stone` (quoins, string courses, no timber; 02-frame "flush or proud") |
| `bay` | 3 | bays between posts are 3 or 5, odd, solved per wall; posts line up storey to storey |
| `door` | s, centre | see Doors |
| `windows` | `auto` | a window on every bay centre (1x2 in 3-bays, 3x2 in 5-bays), skipping the door bay; or `{"s": [{"at": -2, "storey": 0, "w": 1, "h": 2, "sill": "stair", "shutters": true}], ...}` |
| `shutters` | 0.3 (0 on proud frames) | share of windows with shutters, chosen in mirror pairs across each front (05: at most about 30%) |
| `roof` | gable, long ridge | see Roofs |
| `chimney` | `auto` | Mateo's chimney through the ridge, 2 in from a gable end; `[[x, z], ...]` to place; `false` for none |
| `wings` | [] | joined blocks for L, T, U and cross plans: `[{"rect": [...], "storeys": [5, 4], "roof": {"ridge": "z"}}]`. Each wing takes the house's style unless it names its own, gets no door or chimney unless given. Walls, windows and sills between blocks are opened up; all roofs share one height field so valleys close (06 connecting roofs). Make wings narrower or lower than the main block so their roof sits below the main ridge. A wing whose ridge would stay below the main eave has its top storey raised until the roofs meet (`"join": "none"` on the wing to keep it low) |
| `dormers` | [] | `[{"side": "s", "at": 0, "w": 3, "h": 3}]` on an eave side (along the ridge): front wall on the wall line with posts and a window, cheeks down to the main roof, its own bare gable roof running back into the main roof |
| `porch` | none | `{"side": "s", "at": 0, "w": 5, "d": 3, "h": 3}`: plinth-stone floor, log posts on the outer corners, a tie beam, a small gable roof with barge boards that stops at the wall. Best on a ground floor that is not jettied |
| `balconies` | [] | `[{"side": "e", "storey": 1, "at": 0, "w": 3, "d": 1}]`: a door out, a trim floor on upside-down stair brackets, a fence rail (`rail` to change it); the window there is left out |
| `arcade` | none | `true` or `{"sides": "esw", "storey": 0, "height", "style": "round_angle", "material", "trim", "lanterns": true, "pier"}`: every bay between the frame posts of that storey becomes an arch (round angle), so the storey stands open as a market hall; default sides are all but the door's; window dressing in the bays goes; a lantern hangs in each crown. Bays must be odd (`bay` 3 gives 3-wide arches) |
| (windows) | | a window is left out, with its shutters and sill, when another block's roof is in front of it or above its sill, when a porch roof crosses the glass, when its wall faces another block, or when the storey is too short for it under its own roof; the summary says which when you placed it by hand |
| `brackets` | `arched` | under jetties: stair under each post, then top slab, then flat trapdoors to mid-bay (02 arched supports); `stairs` for the plain stair under each post only |
| `trusses` | `auto` | 06 step 8: tie beam at the wall plate on every inner post line, king post to the ridge, braces on spans of 9+. `auto` builds them on spans of 9 or more inside; `true` always; `false` never |
| `finials` | `spikes` | standard on every pitched ridge (Mateo 2026-11-12): a trim fence or wall post with a lightning rod every 3 along the ridge in place of the ridge slab, two posts tall at the gable peaks. `peaks` = peaks only, `endrods` = end rods along the ridge, `false` = none |
| `storey_style` | none | per-storey materials, e.g. a stone ground floor under a timber upper: `[{"frame_kind": "piers", "pier": "stone_bricks", "infill": "stripped_spruce_log"}, {}]`. `piers` = stone corner piers, timber posts, upright log infill. Wings inherit it |
| `vines` | none | share of wall cells that start a vine 1 to 3 long (0.15 is plenty); more on the north side, less on the south |

### What each stage places

1. **foundation**: plinth courses (plinth mix, noisy clusters), entrance steps as wide as the doorway, one
   per block of floor height, stairs facing the building, filled under (01 step 5).
2. **frame**: corner posts (logs, axis y) full height; bay posts; a beam (axis along the wall) at every
   upper floor line and at the wall plate; posts win at corners; jetty brackets: an upside-down trim stair
   under every upper post on a jettied side, with slabs and flat trapdoors between them so each bay reads
   as a shallow arch (02 arched supports). Stone: quoins alternating every course.
3. **floors**: the floor layer inside every storey (03).
4. **walls**: infill between the frame; stone walls in the wall ladder (04). Stone buildings get a string
   course of upside-down stairs at each upper floor line, wrapping corners with outer-corner stairs (07).
5. **openings**: doors and windows (below).
6. **roof**: the roof surface, ridge, verge, barge boards, eaves, corner blocks, gable walls with a centre
   post and an attic window, the chimney (06).
7. **details**: lanterns on shelves, hanging lanterns.

### Style presets (`STYLES` in parts.py)

| Role | `vale_timber` | `vale_stone` | `vale_brick` |
|---|---|---|---|
| plinth | mossy cobble / cobble / andesite clusters | same | same |
| frame | stripped dark oak log | stone bricks | stripped spruce log |
| infill | calcite | VAL-01 stone ladder | mud bricks / bricks clusters |
| trim (stairs, slabs, trapdoors, barge, eaves) | dark oak | dark oak | spruce |
| roof | VAL-06 slate ladder, dark at the ridge | same | dark oak to spruce |
| glass | brown stained pane | gray stained pane | brown stained pane |
| sill | leaf box with dark oak signs | stone stair sill | leaf box with spruce signs |
| other | spruce door and shutters, azalea leaves, stone brick chimney, polished andesite quoins |

These come from `map/structures/kit.py` (VALE) and `vale.py` (STYLES). For other regions copy a preset and
take the blocks from `build-instructions/palettes/<region>.md` and the colour codes from
`build-instructions/texturing/doctrine.json` (any role accepts a doctrine code such as `FRO-02`).

## Doors (05-windows-and-doors, "Doors")

`{"part": "door", "rect": [...], "side": "s", "at": 0, "floor": 0, "kind": "house"}` alone, or `door` in a house.

| kind | What is built |
|---|---|
| `house` | 3 wide: jamb (frame log or quoin), door, jamb, 2 tall; a lintel across all 3 (log along the wall); a canopy of trim stairs at lintel + 1 with upside-down stair brackets under its ends. `canopy: "lanterns"` swaps brackets for lanterns; never both |
| `grand` | 5 wide: jambs, a 3 x 3 opening with the door in the middle, trim planks either side, upside-down stairs in the top corners facing the jambs (the round arch head), glass above the door |
| `large` | Mateo's big plank door: 3 x 3 opening, the door in the bottom middle, trapdoors of the door wood standing on the outside face in every other cell |

Doors sit on a bay centre, never on a post, at least 2 from a corner. Never two doors side by side.

## Windows (05, "Windows")

`{"part": "window", "rect": [...], "side": "e", "at": 2, "floor": 5, "w": 1, "h": 2}` alone, or via `windows`.

- **Glass** in the wall line, flush, never recessed: panes in the style's tint.
- **Head**: timber: the beam above is the head unless it is more than 2 blocks up, then a cap of top slabs
  2 wider than the glass, 1 out. Stone: an upside-down stair of the wall stone above each glass cell, facing out.
- **Sill** (`sill`): `leafbox` = leaves 1 out under the glass, wall signs on the front and both ends
  (Mateo's window box); `stair` = right-way stairs 1 out, tall side to the wall, slab end caps one wider
  each side; `slab` = a top-slab ledge 2 wider; `planter` = a box of open shutter-wood trapdoors 1 out
  round dirt with flowers (style key `flowers` picks them: region colours from `palettes/`), about a
  quarter of street windows (05 planters).
- **Surround**: stone walls get dark oak trapdoors standing either side of the glass (the stone, spruce,
  dark oak pairing).
- **Shutters**: open trapdoors either side of the glass, 1 out, as tall as the glass, with a trim slab
  shelf under it; about one shuttered window in three has a lantern on the shelf; now and then a single
  shutter (shutter dressing).

## Arches (reference/shapes.md in build-instructions)

`{"part": "arch", "at": [x, y, z], "axis": "x", "width": 3, "height": 4, "depth": 1, "style": "round_angle",
"material": "stone_bricks", "trim": "dark_oak_planks"}`: clears the opening and builds the head.

| style | Head |
|---|---|
| `round_angle` (default) | Mateo's trapdoor, stair, trapdoor: open trapdoor against the jamb, upside-down stair in the corner, a top trapdoor on the ceiling beside it on 5+ wide openings; wider openings step inward symmetrically |
| `stairs` | upside-down stairs in the top corners facing the jambs; 5 and 7 wide add top slabs beside them, and a second stair pair one row down on openings 5 or more tall |
| `trapdoor` | top trapdoors in the corners: the light timber arch |
| `slab_stair_slab` | top slab, upside-down stair keystone, top slab above the opening |

For a curved arch in a solid mass (bridges, gateways, arcades) use the `arch` shape and `sub` it instead.

## Roofs (06-roof)

`roof` in a house: `type` gable / hip, `ridge` x / z (default the long way), `pitch` 1 (45°) or 2 (steep:
stair on a full block), `overhang` 1, `verge` 1, `cap` (ridge slab material).

How it is built: a height field over the footprint plus overhang; every cell takes a stair facing uphill;
inner-corner stairs where two higher sides meet (valleys), outer-corner stairs on hip lines; the ridge is a
full block capped with back-to-back stairs along the spine, tall backs touching in pairs, so the crest reads as a row of small peaks between the spikes (Mateo 2026-11-12; on a two-row ridge each pair sits across the spine; style `"ridge_cap": "slab"` for the old slab row). Edges open to the sky get: barge boards (upside-down trim stairs under
every verge stair), an eave row of upside-down trim stairs under the overhang, and Mateo's trim-wood corner
block under the lowest verge stair at every corner. Gable triangles fill after the surface with a centre
post (timber) and an attic window when the gable is 5 or more tall. Roof colour ladders run eaves to
ridge, darkest at the ridge, with band edges wobbled ±0.04.

**Every roof is textured** (Mateo, 2026-11-12, every style and theme): each roof block is mixed at random,
cell by cell, with a partner block of the same colour, on stairs, slabs and the ridge alike. Pairs and the
partner's share come from `TEXTURE_PAIRS` in `scripts/materials.py`, the same table as 06-roof step 10:
deepslate tiles + deepslate bricks 40%, brick + granite 35%, dark oak + spruce 30%, spruce + dark oak 30%,
mangrove + dark oak 25%, smooth quartz + polished diorite 35%, dark prismarine + warped planks 30%,
prismarine bricks + prismarine 35%, smooth red sandstone + red sandstone 35%, polished blackstone bricks +
blackstone 35%, mud bricks + granite 20%. Other blocks get the nearest same-colour block with stair and slab
forms. Copper is the exception and keeps its weathering gradient. `"texture": false` on the roof material
turns it off; `{"share": 0.4, "with": {"bricks": "mud_bricks"}}` picks your own. Domes and cones built from
shapes take the same option on their material (`"texture": true`).

Several roofs passed to `build_roofs` together combine by height (higher roof wins), which closes valleys;
the `house` part builds one roof per building today, so L and T plans are two houses side by side for now.

## Chimney (06 step 9, Mateo's default)

A stone column from the ground floor up to 2 above the highest roof cell around it; wall signs of the trim
wood on all four sides of the last stone; a campfire above with open trapdoors on all four sides; a flower
pot on top.

## Smaller parts

| part | keys | rule |
|---|---|---|
| `string_course` | `rect`, `y`, `sides`, `material` | upside-down stairs 1 out, corners wrapped with outer-corner stairs (07) |
| `buttress` | `rect`, `side`, `at` [offsets], `y`, `height`, `depth` | 1 to 2 out at the foot, stepping in with a stair at mid height and a stair cap (02 step 6) |
| `hanging_lantern` | `at`, `chain` | chain links down to a hanging lantern, from a corner block or bracket (07) |
| `lean_to` | `rect`, `against` (n/s/e/w), `top`, `pitch` (1 or `"half"`), `y`, `roof`, `post`, `trim`, `floor` | a skillion against a wall: one slope falling away from `against`, starting at `top`, overhang 1 at the low edge and a verge at both ends; tie beam under the low edge, log posts at the ends and every 4, upside-down trim stairs under the overhang, barge boards. Roof gets the two-block texture (06) |
| `woodpile` | `at`, `len`, `h` (2-3), `facing`, `wood`, `cover` (`slab`/`trapdoor`/`none`) | logs lying with the end grain to `facing`, top row stepped in, about 1 in 5 stripped, a slab or trapdoor cover, a chopping block beside it (07 dressing) |
| `spire` | `rect` (the tower), `y` (`"top"` default), `rows` (3), `kind` (`stepped` / `broach`), `overhang`, `roof`, `trim`, `finial` (`spire_block` default / `rod` / `tall` / `short` / `none`) | sits on the walls of whatever is built in `rect` and replaces its roof: an eave ring over the overhang with upside-down trim under it, the tower's width one row, then rings stepping in one block every `rows` rows (stairs stacked on stairs, full corners), then the add-on's spire top block `siege:spire_roof` on the full top block (or a wall-post finial with a lightning rod). **Never a slab under a spire top** (Mateo 2026-11-12: it floats): the engine swaps any slab under `siege:spire_roof` for the full block, in every build, `place` cells included. `broach` leaves the corners off the upper rings so it turns octagonal (06 steep roofs) |
| `belfry` | `rect`, `y` (`"top"` on a tower, `"roof"` on a ridge, or a number), `h` (4), `pier`, `deck`, `trim`, `louvres`, `bell` (true), `cap` (`hip` / `spire` / `none`), `roof`, `finial`, `base` | an open bell storey: deck (built up from the roof on a ridge), corner piers (walls when 3 wide), a round-angle head on every face 5 or more wide, a beam ring, a beam across with a hanging bell, louvres of open trapdoors flush to each face, then a spire cap (rows 1 = a hip cap) |
| `clock_face` | `rect` + `side` + `y` (+ `along`) or `at` + `side`; `size` (3 / 5), `time` ("3:00"), `face` (calcite), `hand` (polished_blackstone), `hub` (button), `frame` | a face flush in the wall, hands from the hub (minute on the 12 for whole hours, both snapped to the nearest eighth), a button hub; a window's sill, shutters or lantern in front go. Keep it clear of the eave row |
| `wheel` | `at` (axle centre), `axis` (axle direction x / z), `r` (3-5), `width` (1-2), `wood`, `paddles`, `axle` | a waterwheel: plank rim, fence spokes, a paddle at every eighth, a stripped log axle into the wall |

## Not automated yet (build with shapes and `place`)

Galleries on long rows of posts, sign-boxed bushes on the ground, beam ends on proud frames, hammer-beam
trusses (spans of 15+), hip-roof wings joined to gable roofs at odd angles, round towers joined into a
house roof (build the tower with shapes: cylinder + cone, see shapes.md, and leave a gap in the house), and
interiors (empty by default anyway). Each is described with its exact block pattern in `build-instructions/`
(02-frame, 05, 06, 07 and reference/shapes.md): write the cells with `place`, or add the part to `parts.py`
and this table. A square tower is a narrow house with `"roof": {"type": "hip", "pitch": 2}`.
