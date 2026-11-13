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
| `dormers` | [] | `[{"side": "s", "at": 0, "w": 3, "h": 3}]` on an eave side (along the ridge): front wall on the wall line with posts and a window, cheeks down to the main roof, its own bare gable roof running back into the main roof; its roof stairs face down the main slope like the rest of the roof, and a bracket under each front corner of its roof frames the window (style `bracket`: `stairs` default, `fence`, or a block id; `fen_timber` uses `mud_brick_wall`) (Mateo 2026-11-12). A dormer taller than the main roof stops at the ridge with a warning |
| `bushes` | true | foundation planting: clumps of the style's `bush` leaves (default its `leaves`; none for `ember_sandstone` and `hollow_timber`) on the ground under the ground-floor windows and at about half the corners, gaps between, now and then 2 high below the sill; door and steps clear; off on stilts. `false` turns it off, `{"share": 0.6}` thins it (07, Mateo 2026-11-12) |
| `porch` | none | `{"side": "s", "at": 0, "w": 5, "d": 3, "h": 3}`: plinth-stone floor, log posts on the outer corners, a tie beam, a small gable roof with barge boards that stops at the wall. Best on a ground floor that is not jettied. `"post": "quartz_pillar"` swaps the posts for columns, `"every": 2` adds one every 2 along the front (a colonnade); as wide as a gable-fronted house it reads as a temple front with a pediment (Saltreach) |
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

Other presets: `salt_atlantean` (Gull's Rest: pale stone in a diorite-to-quartz ladder, `quartz_pillar` corners,
prismarine plinth and trim, sea-glass, no window panels), and the region presets named in `regions/`.
Style key `panel`: the trapdoor stood either side of stone windows (default `dark_oak_trapdoor`; `null` for none).

**A material can name its own partial blocks** with `forms` when its block has none or the nearest one is
wrong: `{"block": "prismarine_bricks", "forms": {"trapdoor": "warped_trapdoor", "wall": "prismarine_wall"}}`,
`{"block": "quartz_pillar", "forms": {"wall": "diorite_wall", "slab": "smooth_quartz_slab"}}`. Use it whenever
the summary says a material "has no X form" and the substitute is off-colour (or unwaxed copper).

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
  dark oak pairing). The style key `panel` changes the trapdoor (`everwake_stone` uses `birch_trapdoor`: no dark timber there). `"panel": null` leaves it off (tower slits and lancets, towers guide).
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

`roof` in a house: `type` gable / hip / flat, `profile` (a list of per-row pitches from the eave up, the last
repeating: `[2, 1]` a mansard, `[1, 1, 2]` a bell roof that swells toward the top; Saltreach Atlantean houses,
Mateo 2026-11-12; every steep step, hip lines included, gets full roof blocks under its stair so no corner is open), `gable_horns` (Frostmarch dragon heads: crossed barge boards in a V past the ridge at each gable end), `ridge` x / z (default the long way), `pitch` 1 (45°) or 2 (steep:
stair on a full block), `overhang` 1, `verge` 1, `cap` (ridge slab material).

How it is built: a height field over the footprint plus overhang; every cell takes a stair facing uphill;
inner-corner stairs where two higher sides meet (valleys), outer-corner stairs on hip lines; the ridge is a
full block capped with back-to-back stairs along the spine, tall backs touching in pairs, so the crest reads as a row of small peaks between the spikes (Mateo 2026-11-12; on a two-row ridge each pair sits across the spine; style `"ridge_cap": "slab"` for the old slab row). Edges open to the sky get: barge boards (upside-down trim stairs under
every verge stair), an eave row of upside-down trim stairs under the overhang, and Mateo's trim-wood corner
block under the lowest verge stair at every corner. Gable triangles fill after the surface with a centre
post (timber) and an attic window when the gable is 5 or more tall. Roof colour ladders run eaves to
ridge, darkest at the ridge, with band edges wobbled ±0.04.

**Flat** (`"type": "flat"`, 06 roof-types 18; the Emberwaste default, Saltreach terraces on a lower wing
only): the roof layer sits on the wall top (never a gap) and is made of vigas by default (Mateo 2026-11-12):
spruce logs running right across the building the short way, through the walls and one block out on both
sides, every other block along its length, with top slabs of the roof block between them (log, slab, log,
slab). `"beams"`: a log id to change the wood, `false` for a plain full layer. A parapet one high sits on
top (`"parapet"`: `slab` default, `crenel`, `wall`, `none`; `"parapet_mat"`, default the style's quoin) with
posts on the corners; `"hatch": true` puts a trapdoor in a slab cell in the middle. No auto chimney: give
`chimney` cells by hand. Never on Vale, Frostmarch, Blackfen or Hollow houses.

**No open row under a roof:** after the roofs, any one or two free rows between the top storey's wall plate
and the roof above it (where one block's eave passes over another's wall) are filled with the wall's infill.

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

**Roof finishes** (on the house's `roof`):
- `"snow": true` (Frostmarch): a snow layer replaces the back-to-back ridge cap, and a thin layer sits on every
  full block open to the sky (steps of a pitch 2 roof, chimney tops). Slopes of stairs stay bare.
- `"moss": true` or a share (default 0.13) (Blackfen): moss blocks along the ridge with moss carpet on top,
  and mossy cobblestone stairs in the stairs' shape on about 13% of the slope, half as many again on the
  shady north side.
- `"thatch": true` (barns and stores): hay blocks on the slopes, the roof's own stairs kept along the eaves
  and verges, a moss ridge.

Several roofs passed to `build_roofs` together combine by height (higher roof wins), which closes valleys;
the `house` part builds one roof per building today, so L and T plans are two houses side by side for now.

## Stilts, piles and the Hollow offset (keys on `house`)

- `"stilts": {"ground": 0}` (Blackfen): give the house `"y"` at the platform (3 or 4 above `ground`). The
  plinth edge becomes a mangrove plank platform, mangrove log stilts stand under the corners, the frame
  posts and every second edge block down to the ground, and a stair runs from a 3 x 1 landing at the door
  to the ground with fences under it. Keys `log`, `platform`, `stair` (false for none), `side`.
- `"piles": true` (Blackfen plot buildings on the ground): the plinth course's corners and every other
  edge block become mangrove logs going two below the ground, with mangrove roots between. Keys `log`,
  `roots`, `depth`.
- `"offset": {"storey": 1, "dir": "e"}` or `{"roof": true, "dir": "e"}` (the Hollow): everything from that
  storey (or the roof) up moves one block, as one piece, never a shear. The plinth and ground storey stay
  true, chimneys stay put, and upside-down trim brackets carry the overhanging side. Not for houses with
  wings.

## `dome`

`{"part": "dome", "at": [x, z], "r": 4, "drum": {"h": 3, "windows": 4}, "finial": "gold"}`: a dome on a
drum, sitting on whatever is built under its centre (a flat roof stays as its floor; give `"y"` or
`"at": [x, y, z]` to place it yourself). `r` the radius (end in .5 for an even width), `shape` hemisphere /
onion / tall, `material` (default waxed copper from weathered to oxidized, greener at the top), `drum`
`{"h", "r" (default r), "material" (default the walls of the house built before it), "windows" (4 or 8),
"glass"}`, `finial` `short` / `gold` (one gold block, Emberwaste civic) / `spire_block` / `none`. Cyan
terracotta has no stairs, so its curve uses dark prismarine; the copper default reads better in game.

## Castle parts: `keep` and `curtain` (towers/README castle row; the Barracks, 2026-11-12)

```json
{"part": "keep", "at": [4, -10], "r": 2.5, "y": 0, "h": 20, "floors": [5, 10, 15], "material": "wall", "trim": "stone_bricks",
 "slits": {"sides": "ns"}, "doors": [{"side": "w", "floor": 0}, {"side": "s", "floor": 1}], "ladder": "e",
 "flags": [{"at": [1, -1], "dir": "w"}], "flag": "white_wool"}
{"part": "curtain", "path": [[-7, -7], [-7, 0], [7, 0], [7, -9]], "y": 0, "h": 4, "material": "wall", "cap": "stone_bricks",
 "turrets": [{"at": [-6, -1], "size": 3, "h": 7}], "gate": {"at": [0, 0], "face": "s", "w": 3, "h": 3, "crown": 4, "banner": "white_wool"}}
```

- **`keep`**: a round castle tower. Plinth 2 courses, a shaft 1 thick (r 2.5 = 5 wide, 3.5 = 7), a floor at each
  row in `floors` (relative to `y`) with a ladder up the `ladder` side to a hatch in the deck, a string course of
  upside-down stairs one out at every floor line, 1x2 slits on `slits.sides` (never on the ladder side), doors on
  any floor (`floor` 0 = ground), then machicolated battlements: a ring of upside-down stairs one out (corbels),
  the deck on them at `y + h`, a parapet and merlons on every other block. `flags`: poles on the deck with a
  tapering pennant of `flag` hung from the top. It empties its own column first (`clear`, default true), so put
  it **after** a house whose gable it stands in: the hall's roof and wall make way for it (towers/README section 3
  step 7: a roof runs into the tower). Height: one full stage clear of the ridge beside it (towers/README section 2).
- **`curtain`**: a yard or bailey wall along axis-aligned `path` points: plinth course, `h` rows of wall, a cap
  course, merlons on every other block (ends and corners always carry one). `turrets`: odd square towers rising
  above it, hollow, corner merlons, a lantern on top. `gate`: a `w` x `h` opening with a round-angle arch head, the
  wall raised `crown` rows over it, and optionally a `banner` hung one out on the outer face under a log pole
  (layout info `banner` gives its middle, so a script can recolour it to the settlement's banner colour).
- **Yards fit their site** (Mateo 2026-11-12: "it doesn't have to be a perfect square, match the landscaping where the
  paths are"): a yard is never forced square over the ground. Where a town path already crosses a yard wall, that
  stretch is left out so the path runs in, and the path's surface stays through the yard floor. In the game this is
  done at placement (`settle/raised.js` `yardGaps`, from the `yard` wall and floor columns a design exports).

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
| `lean_to` | `rect`, `against` (n/s/e/w), `top`, `pitch` (1 or `"half"`), `y`, `roof`, `post`, `trim`, `floor` | a skillion against a wall: one slope falling away from `against`, starting at `top`, overhang 1 at the low edge and a verge at both ends; tie beam under the low edge, log posts at the ends and every 4, upside-down trim stairs under the overhang, barge boards. Roof gets the two-block texture (06) and, without `roof`, the colour of the house built before it |
| `woodpile` | `at`, `len`, `h` (2-3), `facing`, `wood`, `cover` (`slab`/`trapdoor`/`none`) | logs lying with the end grain to `facing`, top row stepped in, about 1 in 5 stripped, a slab or trapdoor cover, a chopping block beside it (07 dressing) |
| `spire` | `rect` (the tower), `y` (`"top"` default), `rows` (3), `kind` (`stepped` / `broach`), `overhang`, `roof`, `trim`, `finial` (`spire_block` default / `rod` / `tall` / `short` / `none`) | sits on the walls of whatever is built in `rect` and replaces its roof: an eave ring over the overhang with upside-down trim under it, the tower's width one row, then rings stepping in one block every `rows` rows (stairs stacked on stairs, full corners), then the add-on's spire top block `siege:spire_roof` on the full top block (or a wall-post finial with a lightning rod). **Never a slab under a spire top** (Mateo 2026-11-12: it floats): the engine swaps any slab under `siege:spire_roof` for the full block, in every build, `place` cells included. `broach` leaves the corners off the upper rings so it turns octagonal (06 steep roofs) |
| `belfry` | `rect`, `y` (`"top"` on a tower, `"roof"` on a ridge, or a number), `h` (4), `pier`, `deck`, `trim`, `louvres`, `bell` (true), `cap` (`hip` / `spire` / `none`), `roof`, `finial`, `base` | an open bell storey: deck (built up from the roof on a ridge), corner piers (walls when 3 wide), a round-angle head on every face 5 or more wide, a beam ring, a beam across with a hanging bell, louvres of open trapdoors flush to each face, then a spire cap (rows 1 = a hip cap) |
| `clock_face` | `rect` + `side` + `y` (+ `along`) or `at` + `side`; `size` (3 / 5), `time` ("3:00"), `face` (calcite), `hand` (polished_blackstone), `hub` (button), `frame` | a face flush in the wall, hands from the hub (minute on the 12 for whole hours, both snapped to the nearest eighth), a button hub; a window's sill, shutters or lantern in front go. Keep it clear of the eave row |
| `interior` | `use`, `levels` [{`rect` (inside the walls), `floor_y`, `height`}], `region`, `rooms`, `stairs`, `furnish`, `lights` | stage 8 for shells the `house` part did not make: stairs or ladders between the levels, rooms by use, a one-block walkway, lanterns (08-interiors). The `house` part runs the same stage itself from its `interior` key (default `home`; `false` for none; `attic` adds a room under the roof; `hatch` adds a ladder from the top storey to a trapdoor hatch in a flat roof, kept by a belfry built on top) |
| `wheel` | `at` (axle centre), `axis` (axle direction x / z), `r` (3-5), `width` (1-2), `wood`, `paddles`, `axle` | a waterwheel: plank rim, fence spokes, a paddle at every eighth, a stripped log axle into the wall |

## Round towers, leaning towers, galleries, boardwalks and curved roofs (2026-11-12)

- **Curved roof:** `"roof": {"type": "curved"}` on a house (or a wing): a barrel roof, a gable whose rows
  rise steeply at the eaves and flatten towards the top in a quarter circle (06 roof-types 16), never a row
  with no rise. `"profile": [2, 2, 1, 1]` sets the rises by hand. Halls, chapels, stations, Emberwaste vaults
  and Hollow halls.
- **Round tower joined into a house:** a `keep` with `"cap": "cone"` placed after the house, overlapping
  a corner or a wall. It clears its own shaft first, so the house roof tucks against its wall. The cone has
  an eave ring one out on brackets, rows stepping in half a block (`"pitch"`: rows per block in, 2), and
  the spire top block on a full block at the tip (`"finial"`: `spire_block` / `rod` / `none`); `"roof"` is
  the cone's block. With a cone there are no battlements, hatch or flags.
- **Leaning tower** (the Hollow): `"lean": {"dir": "e", "steps": 2}` on a `keep` or a `house`. The shaft
  splits into `steps + 1` equal parts above its base course, and each part sits one block further over, so
  the whole tower leans in a few clean steps; the cap moves with the top part, and every step's overhang
  gets upside-down trim brackets. Never more than 3 steps.
- **Galleries:** `"galleries": [{"side": "s", "storey": 1, "depth": 2, "from": -4, "to": 4, "posts": 3}]` on
  a house: posts of the frame wood from the ground at both ends and every `posts` blocks, a beam under a
  ceiling of roof-block slabs at the next floor (or the wall plate), a deck of the floor wood with a fence
  rail on the outer edge and the ends. On `storey` 0 there is no deck or rail: a covered walk (Emberwaste
  arcades and shade, Frostmarch covered walks). The caravanserai's upstairs gallery is `storey` 1.
- **`boardwalk`** (Blackfen): `{"part": "boardwalk", "path": [[9, 43], [17, 43]], "y": 3, "ground": 0}`: a deck
  of mangrove top slabs `w` (3) wide along axis-aligned runs, mangrove log stilts and a plank cross beam
  every 4 and at the ends, fence rails on planks along both edges (`"rails"`: `both` / `one` / `none`,
  `"gaps"` for landings), and a lantern on a rail post at both ends and every 8 so it shows through fen mist.

## Not automated yet (build with shapes and `place`)

Sign-boxed bushes on the ground, beam ends on proud frames, hammer-beam trusses (spans of 15+), hip-roof
wings joined to gable roofs at odd angles, and hand-made interiors beyond the interior stage's rooms. Each is described with its exact block pattern in `build-instructions/`
(02-frame, 05, 06, 07 and reference/shapes.md): write the cells with `place`, or add the part to `parts.py`
and this table. A square tower is a narrow house with `"roof": {"type": "hip", "pitch": 2}`.

## Ruins (2026-11-13)

`"ruin": {"seed": 13, "holes": 0.07, "cap": [[x0, z0, x1, z1, top, jag], ...]}` on a spec turns the finished
build into its ruin (`engine.ruin`, run after the blocks are resolved): everything in each cap box above `top`
(plus up to `jag` of blocky noise) falls; clumps of wall are knocked out (`holes`); glass, doors, lanterns,
bells and furniture go; timber and cloth mostly rot away; stone ages to mossy and cracked; copper oxidizes;
anything left with no path to the ground is dropped (nothing floats); rubble lies at the foot of the walls.
Design the restored building once and make the ruin from the same spec (the air boat station,
`map/structures/everwake/station.py`).
