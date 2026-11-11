# Stage 3: Floors

Every floor of the building, laid inside the frame. Floors are done before walls so the floor layer
can tie into the beams and the stair wells are cut while the inside is open.

## Principles

- **Floors are slabs in the region's wood** (Mateo, 2026-11-11: "The floors are made out of half slabs
  in the wood type that matches the region"). A slab floor reads thinner and more finished than full
  planks, and the half-block gap shows the joists from below.
- **A floor is a field with a border.** A plain field of one block looks unfinished; a border along the
  walls and a direction in the field make it read as laid boards.
- **Floors line up with the beams** you placed at the floor lines in stage 2.

## Step 1: Which half

| Floor | Block | Why |
|---|---|---|
| Ground floor | **top** slabs or full planks/stone at floor y - 1, never bottom slabs (see note) | the walking surface must be level with the door threshold |
| Upper floors | **top** slabs at the floor line | the walking surface is the top of the block, the ceiling below shows the slab underside with joists |

Note on the ground floor: a bottom slab puts the walking surface half a block below the door sill, which
looks like a step down into the house. Use full blocks (planks, or the region's floor stone) or **top**
slabs. Choose one per building and keep every room on that storey the same.

Halls, chapels, stone ground storeys, kitchens, workshops, smithies and stables: the ground floor is
stone or packed paving from the palette (polished stone, bricks, tiles), not wood.

## Step 2: The border

- A 1-block border along every wall inside, in a contrasting block from the palette: a darker or
  lighter wood slab, or stripped logs laid along the wall (axis along the wall) on the ground floor.
- Doorways and the top and bottom of stairs get the border block too (a threshold).
- Big rooms (11 or more across): a second border ring, or a centre panel in a third block, centred on the
  room's centre block (odd sizes make this land exactly).

## Step 3: The field

- Main field: the region's floor wood (see `palettes/`), slabs as above.
- Direction: where you use logs or striped mixes, the boards run **across the short side** of the room,
  the way real joists span the short way.
- Mix: at most 2 woods in a field, about 70/30, laid in rows (not random noise). Random noise mixes are
  for stone floors (polished andesite + stone bricks + tiles).

## Step 4: Joists and beams

- Upper floors: under the top-slab floor, a log joist (axis across the short span) every 3 or 5 blocks,
  in line with the posts of the long walls, so from below you see beams between the walls.
- Rooms wider than 9 inside: a main beam the long way under the joists, resting on posts in the end walls
  or on free-standing columns (X on the plan) every 5 blocks.
- Joists are part of the frame look outside too: their ends may show in the wall at the floor line as log
  ends (axis out of the wall) in proud-frame builds.

### Alternative: the beamed floor (Mateo, 2026-11-11, `reference/pictures/beamed-floor.png`)

- The joists come **up into the floor**: full logs (axis across the short span) every 3 or 5 blocks, lined
  up with the wall posts, their tops flush with the walking surface, and **top slabs** of the floor wood
  in the rows between them.
- From above it reads as a plank floor striped with beams; from the room below, the logs hang half a
  block lower than the slab ceiling between them, like trusses, which gives the ceiling depth.
- The beams run right through to the outside face, and logs stand upright at the corners, so the floor
  line shows as a band of beam ends and corner posts on top of a stone ground floor.
- Logs a shade darker than the slabs (the frame wood under a field of floor wood), or the same wood when
  the picture calls for it. Use it on stone ground floors with a timber or plank upper, and on any room
  whose ceiling people look at (inns, halls, shops).

## Step 5: Stair wells and openings

- Cut the stair well (O on the plan) through the upper floor: as long as the flight, at least 1 wide
  (2 to 3 in larger builds), along the wall.
- Guard the open sides of the well upstairs: a fence rail, or trapdoors (closed, upright, on the edge),
  leaving the top step open. The rail matches the trim wood.
- Stairs themselves: stairs of the floor wood climbing 1 per block, with a full block or top slab under
  each step on long flights so they do not look like they float. Long flights (over 5) against a wall
  may stay open underneath only if the side is closed by the wall.
- Galleries and double-height halls (O areas): edge the floor with a beam (log) and a fence or wall rail.

## Step 6: Attic floors

- The attic floor (inside the roof) is laid like an upper floor, but only as far as the roof leaves at
  least 2 blocks of headroom; beyond that leave it as the top of the joists (or fill with the floor block,
  it will be hidden).

## Region floor woods (default; see `palettes/` for the full sheet)

| Region | Field | Border / accent | Ground floor alternative |
|---|---|---|---|
| Vale | spruce | dark oak | stone bricks, polished andesite |
| Frostmarch | spruce | dark oak | cobbled deepslate, polished deepslate |
| Saltreach | birch | stripped oak / oak | smooth sandstone, white terracotta tiles |
| Blackfen | dark oak | mangrove | packed mud, mud bricks |
| Emberwaste | acacia | dark oak | smooth sandstone, cut red sandstone |
| Hollow | dark oak | blackstone | polished blackstone bricks |

## Before you move on

- [ ] Every floor laid, walking surfaces at the plan's y, level with the door sills.
- [ ] Upper floors are top slabs; ground floor full blocks or top slabs, same throughout the storey.
- [ ] Border along every wall and at every threshold.
- [ ] Joists every 3 or 5 under upper floors, lined up with posts.
- [ ] Stair wells cut and guarded; stairs climb 1 per block and arrive on the right floor.
