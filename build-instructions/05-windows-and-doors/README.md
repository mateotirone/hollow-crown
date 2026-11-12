# Stage 5: Windows and doors

Finish every opening the walls left: doorways, doors, windows, glass, sills, heads, surrounds,
shutters, planters, arches. Openings are where a build is looked at most, so they get the most care.

References: `reference/pictures/window-ideas-four-styles.png` and `window-ideas-grid.png` (Mateo,
2026-11-11). What they have in common, and what these rules turn into steps:

1. Every window has a **surround** that comes forward of the wall: a frame of trapdoors, stairs, logs
   or stone around the glass.
2. The **sill** is wider than the glass, sticking out past it on both sides.
3. The **head** (top) is a cap wider than the glass too, often stepped up in the middle (a crown).
4. **Shutters** (open trapdoors) and **planters** (trapdoor boxes with flowers or berry bushes) add the
   life, on some windows, not all.
5. The glass is tinted or textured to the house, not plain everywhere.

## Doors

### Placing the doorway

- The doorway sits where the plan put it: on a bay centre, never on a post, at least 2 from a corner.
- **House doorway, 3 wide**: jamb, door, jamb. Jambs are upright logs (timber) or the quoin/dressed
  stone (stone), 2 tall. On a narrow timber front where the door bay sits between posts (`P1P3P1P`),
  the bay's own infill can be the jambs, with the lintel beam across all 3 above: log jambs there make the
  whole ground front dark timber (test house, 2026-11-11). A lintel on top across all 3 (log with axis along the wall, or a stone block,
  or an upside-down stair at each end with a full block in the middle).
- **Grand doorway, 5 wide**: jamb, 3-wide opening, jamb, under an arch (see below). The door block goes
  in the centre of the opening; the two cells beside it are filled to door height with the door's
  surround (iron bars, fence gates, a trapdoor pair, or dark planks) or left open as a side light with
  glass above. Never two doors side by side, except the six-block door below.
- **Large-looking door (Mateo, 2026-11-11, `reference/pictures/large-door-trapdoors.png`)**: a 3-wide,
  3-tall opening with the door in the middle of the bottom row and trapdoors of the same wood closed
  flat on the outside face in every other cell of the opening, so the whole opening reads as one big
  plank door. The **six-block door**: a double door (two doors side by side) with a top slab of the same
  wood in each cell above them, so 2 wide by 3 tall reads as one tall door. Use on barns, stores,
  halls and inn yards; a house keeps the plain 3-wide doorway.
- **Door block**: the palette's door, facing out, hinge on the side away from the stair inside.

### Around the door

- A 3-wide canopy over house doors when there is room above: a row of trim stairs, right way up, facing
  out (tall side to the wall) at lintel height + 1, with a bracket (upside-down stair) at each end
  under it, or a lantern hung from each end. One or the other, not both crowded together (the Kingsrest
  doorway lesson: canopy plus two lanterns plus a double door was clutter).
- Or a porch (a small module, planned in stage 0) with its own posts and roof.
- Step or landing outside (stage 1) is as wide as the doorway.
- A wall lantern or a hanging lantern beside or over every main door; a sign or banner for shops.
- **The way in stays clear (Mateo, 2026-11-12: "the door is blocked", "the slabs make the door hard to get
  into")**: nothing stands in front of or behind a door at the door's two rows (no post, sill, shelf,
  barrel, bush), and no sill, window box, shutter or slab sticks out in the cells either side of the
  doorway at foot or hand height. Steps below the door stay. A window over a door gets no shelf. The skill
  does this (`parts._openings`, door approach); old builders get it from `kit.clear_doorways` in
  `finish_detail`.
- **Every part of a building has a way in (Mateo, 2026-11-12, Kingsrest coaching inn)**: when a carriage
  arch, passage or wing cuts a range in two, each side gets its own door. Check it from the outside: walk
  round the build and find a door into every block.

## Windows

### Sizes

| Building | Window | Glass |
|---|---|---|
| Hut, cottage | 1 x 2 | 1 wide, 2 tall |
| House | 1 x 2 in 3-bays, 3 x 2 in 5-bays | |
| Shop front (ground floor) | 3 x 2 or 3 x 3 | |
| Hall, chapel | 1 x 3, 3 x 3, tall 1 x 5 to 3 x 7 with an arch top | stained in chapels |
| Tower, stone fortification | 1 x 2 slit or 1 x 1 | often bars instead of glass |
| Gable, attic, dormer | 1 x 1 or 1 x 2, on the centre line | |

**Windows line up (Mateo, 2026-11-12)**: every window stands over a window of the storey below, centre
on centre: upper storeys over ground-floor bays, dormers over the top storey's windows. The skill moves a
dormer onto the nearest window centre below it (and logs it; `"align": false` keeps it where you put it).

Windows start one block above the floor. Upper windows sit straight above lower openings.

### Glass

- The glass follows the style of the house, and is **not clear everywhere** (Mateo, 2026-11-11). Tint
  and texture are chosen per building from the region's glass options (`palettes/`), compared in the
  render against the walls.
- Panes, not full glass blocks, in houses (thinner, framed look). Full blocks only in big hall windows
  where the pane lines would look busy.
- **Chapels and churches get stained glass**: a pattern in 2 to 3 colours from the region palette, with
  the centre column of a tall window a different colour from its sides (odd widths make this land).
- Shops can have plain glass on the ground floor (display), tinted above.
- The Hollow uses light blocks in place of glass in miners' homes (ochre froglight) and soul light
  elsewhere (`hollow_kit.py`).

### Glass position (depth)

- **Glass is flush with the wall face, always.** Recessed glass renders as a black hole at most
  distances (every render so far, stone and timber). Depth comes from the sill, surround and cap in front.
- **Timber walls, proud frame**: the glass is flush with the infill (the wall line), one block behind the
  frame face; the frame around it is the surround, so skip shutters on these windows.
- Glass never sticks out past the wall face.

### Window boxes (default under house windows)

Mateo, 2026-11-11, on the test house: replace the right-way-up stair sills with **leaves boxed in by
signs**.

- One block out from the wall, directly under the glass, a row of leaves as wide as the glass
  (azalea leaves with about 30% flowering azalea in the Vale; the region's leaves elsewhere, persistent).
- Wall signs in the trim wood on the front of every leaf block and on both ends of the row, so the leaves
  sit in a thin wooden box. Signs blank.
- On every house window where the cell is free. Where it is not (a bracket, the eaves, a step), leave the
  window without one.
- Stone and civic buildings keep the stair or slab sills below, but a stone house may stand a leaf box
  on the ground in front of the wall instead (next section).

### Stone ground floors: stone, dark oak, spruce (Mateo, 2026-11-11)

From `reference/pictures/stone-ground-floor-trapdoors.png` and `stone-window-stair-heads.png`. Mateo:
the dark brown of the dark oak trapdoors goes really well with spruce and stone; this is the doctrine for
**anything that uses stone** (see `texturing/README.md`, Pairings).

- **Three tones**: the stone is the light field, spruce is the middle brown, dark oak is the darkest note.
  Never all three woods the same.
- **Windows**: tall and narrow (1 wide, 2 or 3 tall), glass panes flush with the wall face.
- **Heads**: an upside-down stair of the wall stone above every window, facing out
  (`stone-window-stair-heads.png`). This is the default head on stone walls.
- **Dark oak trapdoors**: closed flat against the wall face beside the windows, filling the wall between
  them as tall as the glass, so the front reads as stone piers, dark wood panels and slim windows.
  Lighter dressed stone (polished andesite, smooth stone) for the piers next to the glass.
- **Spruce at the foot of the wall**: planter boxes of spruce trapdoors or slabs with flowers, a spruce
  slab stand with a lantern on it, set one block out on the ground.
- **The sign-boxed bush**: a leaf block (or two) on the ground in front of the wall with wall signs on
  every open side, so the signs look like they are holding the bush in (Mateo loves this). Spruce or dark
  oak signs. Use it between windows or in the middle of a front, with the spruce planters either side.
- Vines and a few flowers growing up the piers, lower on the shady side.

### Sills (stone and civic buildings)

- Default: a **right-way-up stair** under each glass cell, its tall side against the wall
  and its low step facing the street (in `bp.py`: `facing` = the side towards the wall, `half="bottom"`;
  see `reference/block-states.md`), one block in front of the wall face, in the trim wood or the sill stone. It reads as a ledge.
- The sill is **wider than the glass**: add one more block each side. For the end cells, either a stair
  turned sideways (an end cap) or a bottom slab.
- Alternative (stone and grand buildings): a **row of bottom slabs** 2 wider than the glass, with an
  upside-down stair under each end as a bracket. The slab row sits in the wall face line or 1 out.
- Under the sill, on some windows only: a planter (below) or an upside-down stair bracket under each end.
- Bottom of a 2-tall window = the floor + 1; the sill sits at the floor + 0 in front of the wall.

### Heads (tops)

- Timber: the beam above the window is the head. Add a cap (a row of top slabs 2 wider than the glass)
  only if the next beam is more than 2 blocks above the window; otherwise the cap, the beam and the
  jetty brackets stack into dark bands (test house, 2026-11-11).
- Stone: an upside-down stair above each glass cell, facing out (`kit.window(kind="stone")`), or a lintel
  of a dressed block, or an arch for 3-wide and taller windows.
- Crown (optional, larger windows): above the cap, a centred block or slab rising one more (a small
  pediment or keystone), like the reference grid's top-right windows.

### Surrounds

- A frame that comes forward of the wall plane by one block: trapdoors closed against the wall on both
  sides of the glass (upright, facing out), or upright logs, or stone wall blocks as side posts, or
  stairs turned to face each other.
- At least every street-facing window on a house gets a surround; back windows can be plain with a sill.
- Surround material: trim wood on timber buildings, dressed stone on stone, contrasting with the wall.

### Shutters

- Open trapdoors in the trim wood, on both sides of the glass, each one block wide and as tall as the
  glass, against the wall just outside the surround.
- On **at most about 30%** of a building's windows (the kit's default is 0.3; Frostmarch none on halls),
  chosen in symmetric pairs across a front. More than that and the facade looks busy, like a pattern.
- Shutters only on windows 1 or 3 wide; never on stone hall windows, windows with bars, or windows set
  in a proud frame.

### Shutter dressing (Mateo, 2026-11-11, `reference/pictures/shutter-shelf-lantern.png`)

What goes with a shuttered window, so no two windows on a front look the same:

- **Shelf**: a slab of the trim wood one block out under the glass, a little shelf. Every so often (about
  one shuttered window in three, never two side by side) a lantern stands on it.
- **Single shutter**: a window may have one open trapdoor on one side only instead of a pair, with the
  shelf or the leaves taking the other side's weight.
- **Leaves**: flowering azalea (or the region's leaves) hanging out under the shelf or a window, spilling
  down the wall a block or two.
- **Vines**: on the infill panels beside the windows, a few blocks, more on shady walls.
- Mix these per window from the same short list: shelf, shelf with a lantern, leaves, leaf box with signs,
  plain. Hash the choice by position so it repeats the same every build.

### Planters (alternative)

- A box of trapdoors (open, facing out, round the front and ends) one block in front of the wall, under
  the sill, with flowers or sweet berry bushes or leaves on dirt or a composter inside.
- On homes and shops, about a quarter of street windows. Colour of flowers from the region (`palettes/`).

## Arches over openings

All arches follow `reference/shapes.md`. Quick versions:

- **3 wide**: an upside-down stair in each top corner of the opening, facing inward (tall side to the
  jamb), the centre cell open. The opening reads round.
- **3 wide, flat (trapdoor)**: top trapdoors (closed, in the top half) in the corner cells instead of
  stairs, for a thinner, lighter edge on timber buildings.
- **5 wide**: row at the top of the opening = stair, top slab, open, top slab, stair. The stairs are
  upside down and face inward; the slabs are top slabs. The row below has nothing (open) except on tall
  openings where a second stair pair steps the curve down.
- **Trapdoor, stair, trapdoor** (Mateo's round angle, the default archway): at each top corner an open trapdoor
  against the jamb, an upside-down stair in the corner and a closed top trapdoor on the ceiling beside
  it, so the curve runs smoothly. Diagrams in `reference/shapes.md`.
- **Slab, stair, slab** (alternative cap): top slab, upside-down stair as a keystone, top slab, above
  the opening.
- Wider (7, 9): build the curve from both sides in steps of stair, slab, slab..., always symmetric about
  the centre block.

## Region notes

- **Vale**: dark oak surrounds and sills, spruce shutters on a third, flower planters; stone style uses
  stone brick stair heads; chapel stained glass.
- **Frostmarch**: small windows (cold), heavy dark oak surrounds, no shutters on halls, light blue or
  white tint; thick stone surrounds instead of reveals.
- **Saltreach**: painted shutters (the region's signature, still at most 30%), smooth sandstone sills, light tints; arcades of
  3-wide arches on the ground floor of civic buildings.
- **Blackfen**: few, small windows high up; mangrove trapdoor shutters; dim tint (brown, green-grey).
- **Emberwaste**: small deep windows, cut sandstone surrounds, wooden lattice (trapdoors) over glass, warm
  tint; arched doorways.
- **Hollow**: froglight or soul-lit windows; on an offset storey the windows move with it.

## Before you move on

- [ ] Every door on a bay centre with jambs and lintel; no double doors; canopy or lantern, not clutter.
- [ ] Every window the planned size, stacked over the openings below.
- [ ] Glass tinted/textured to the house (stained in chapels), flush with the wall face.
- [ ] House windows have leaf boxes with signs; stone sills wider than the glass; heads capped where there is room.
- [ ] Shutters on at most 30%, planters on about a quarter, in symmetric pairs on formal fronts.
- [ ] Arches symmetric about the centre block.
