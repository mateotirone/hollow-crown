# Stage 0: Planning

Nothing is placed in this stage. You finish with a plan so complete that every later stage only
carries it out: every wall line, every post, every door and window, every stair, the roof over
every part, the palette and the roof colour. A 7 by 9 cottage and a 151-block capital use the
same process; the capital just has more modules.

Work through the steps in order. Fill in `plan-template.md` as you go.

---

## Step 1: What is it, where is it

Write down before anything else:

- **Type**: cottage, town house, shop, inn, hall, chapel, station, barn, tower, wall section, capital...
- **Region**: Vale, Frostmarch, Saltreach, Blackfen, Emberwaste or the Hollow. This picks the palette
  and the regional shapes (`palettes/`).
- **Town and neighbours**: which town, which street, what the buildings either side look like and what
  roof colours they have (needed in step 9).
- **Front**: which side faces the street or square. In the plan the front is always south (+z).
- **Ground**: the ground heights under the footprint (from the town plan or terrain slice). Note the
  lowest and highest point; the foundation stage needs both.
- **Custom or standard**: custom builds get a furnished interior (`08-interiors`); everything else
  except the inn stays empty.

## Step 2: Pick the size

Start from the type. All sizes are outer wall to outer wall, inclusive, and odd.

| Type | Footprint (w x d) | Storeys | Storey height | Notes |
|---|---|---|---|---|
| Hut, shed, well house | 5 x 5 to 5 x 7 | 1 | 4 | single bay per side |
| Cottage | 7 x 9 | 1 to 1.5 | 4 | the half storey is in the roof, lit by gable or dormer windows |
| Town house | 7 x 11, 9 x 11 | 2 | 4 (narrow) or 5 (9 wide and up) | gable or eaves to the street |
| Large house, shop with home | 9 x 13, 11 x 13 | 2 to 3 | 5 | often an L with a back wing |
| Inn | about 23 x 19 (range plus cross wing) | 2 plus attic | 5 | the only furnished standard build |
| Guildhall, chapel, station | 11 x 21 to 15 x 25 | 1 tall hall or 2 | 5 to 7 (hall) | civic; gets the town's accent roof colour |
| Town hall levels | as in `settle_halls.py` (9 x 17 up to 21 x 29) | grows per level | 5 to 9 | approved shapes, keep them |
| Capital, castle keep | up to about 151 across | 3 plus towers | 5 to 7 | built from modules, see step 4 |

**Storey height** (Mateo, 2026-11-11: "4 or 5, depending on the size of the house"):

- 4 blocks of wall above each floor for small builds (cottages, huts, houses 7 wide or less).
- 5 blocks for houses 9 wide and up, shops, inns.
- 5 to 7 for civic halls and capital rooms; a great hall can be one storey of 7 to 9.
- Floor to floor = storey height + 1 (the floor layer).
- Every storey of one building uses the same height unless the ground storey is a taller stone base
  (then the ground storey is the taller one, never an upper one).

**Proportion checks**

- Wall height to the eaves is between half and the full front width. A 9-wide house: eaves at 5 to 9
  above the floor.
- A pitch-1 roof is half the span tall; a pitch-2 roof is the full span tall. Add that to the wall
  height and check the whole building is not taller than about twice its front width (towers excepted).
- Depth is equal to or longer than width for a gabled house; the ridge runs along the long side
  (see `06-roof`).

## Step 3: Lay the grid

Draw the footprint on a grid. Mark:

1. The **centre line** of the front (it lands on a block, because the width is odd).
2. The **post lines**: corners first, then bay posts so every run between posts is odd (3 or 5 in
   houses, 1 for narrow window bays, 7 for a wide hall bay). A wall of length `L` with `n` bays is
   `L = (n + 1) posts + the bay widths`. Bay patterns are written with `P` for a post and a digit for a
   bay: `P3P5P3P` = post, 3, post, 5, post, 3, post = 15.
3. **A wall with a door in the middle needs an odd number of bays**, so a bay (not a post) sits on the
   centre line. Walls without a centre door may have any number of bays. Use these:

   | Length | Wall with a centre door | Plain wall (sides, back) |
   |---|---|---|
   | 5 | `P3P` | `P3P` |
   | 7 | `P5P` | `P5P` |
   | 9 | `P1P3P1P` (window, door bay, window) | `P3P3P` |
   | 11 | `P1P5P1P` | `P3P5P` or `P5P3P` |
   | 13 | `P3P3P3P` | `P3P3P3P` or `P5P5P` |
   | 15 | `P3P5P3P` | `P3P5P3P` |
   | 17 | `P3P7P3P` or `P1P3P3P3P1P` | `P3P3P3P3P` |
   | 19 | `P5P5P5P` | `P5P5P5P` |
   | 21 | `P3P3P3P3P3P` | `P3P3P3P3P3P` or `P5P3P3P5P` |
   | longer | repeat the pattern outwards from the centre bay; formal fronts stay mirror-symmetric | |

   If a wall cannot be split this way, change its length by 2 until it can. Stone walls without a
   visible frame still get a bay pattern: it places the windows, buttresses and string courses.
4. The **floor lines**: y of every floor (ground floor walking surface first, then + storey height + 1
   for each storey).

Write the bay pattern for each wall as a string, for example front `P3P5P3P` (P = post, digit = bay).
Later stages read it.

## Step 4: Massing (big builds)

Anything over about 15 x 15, and every civic or capital build, is planned as **modules**: a main block
plus wings, towers, porches, bays. Each module is its own odd rectangle with its own roof.

1. Main block first: the biggest, tallest, on the centre line, with the main door.
2. Wings: lower than the main block (eaves at least 2 lower, ridge at least 2 lower), set back or
   forward from the main front by at least 2 blocks, never flush (flush joins look like one long box).
3. Towers: square (odd width) or round, taller than everything they touch by at least a storey, at
   corners or ends of a front, or marking the main entrance.
4. Porches, bays, stair turrets, dormers: small modules (3 or 5 wide) that break up long faces.
5. **Break every long face.** A face longer than 15 blocks gets something every 7 to 15 blocks: a
   projecting bay, a buttress line, a tower, a step in the wall line, or a change in roof height.
6. **Symmetry**: formal buildings (halls, capital, chapel front, guildhall) are mirror-symmetric about
   the front centre line. Homes, inns and shops are balanced, not symmetric: one big gable and one
   smaller part, like the cottage style sheet (`reference/pictures/cottage-style-sheet.png`).
7. **A 150-block capital** (Mateo's example): pick an odd overall width (149 or 151). Lay the centre
   module (great hall with the main entrance and dome or tower, see `reference/pictures/grand-hall-dome.png`)
   on the centre line, then the two flanking ranges, then the end pavilions, then courtyards behind.
   Every module gets a row in the module table of the plan with its rectangle, storeys, storey height
   and roof. Plan the courtyard sizes odd too.

## Step 5: Draw every level

Draw one plan per level: foundation/ground, each floor, the attic, the roof. Use this legend so every
builder reads the same thing:

```
P  post (log or stone pier)          #  wall infill / solid wall
D  door (single door block)          J  door jamb
W  window opening (glass)            =  floor field
S  stair going up (arrow ^ v < >)    L  ladder
O  open to below (stair well, gallery, double-height hall)
.  outside ground                    ,  path / paving outside
T  terrace or step                   C  chimney / fireplace
B  buttress or pier                  X  column standing free inside
```

Example: a two-storey Vale town house, 9 x 11, storey height 5, front south. Front pattern
`P1P3P1P` (door centred), sides `P3P5P` (11), back `P3P3P` (9).

```
Ground floor (walking surface y = 1), front at the bottom
   x 0 1 2 3 4 5 6 7 8
z0   P # W # P # W # P     back P3P3P: a window centred in each 3-bay
z1   # = = = = = = = #
z2   W = = = = = = = W     sides P3P5P: 1-wide window in the 3-bay
z3   # = = = = = = = #
z4   P = = = = = = S P     stair up along the east wall, z9 to z4, rising north (^):
z5   # = = = = = = S #     6 steps for a floor-to-floor of 6, arriving at z3 upstairs
z6   W = = = = = = S W     3-wide window centred in the 5-bay (z6..z8)
z7   W = = = = = = S W
z8   W = = = = = = S W
z9   # = = = = = = S #
z10  P W P J D J P W P     front P1P3P1P: windows in the narrow bays, door on the centre line
```

```
Upper floor (y = 7: floor layer at y = 6, storey height 5)
   x 0 1 2 3 4 5 6 7 8
z0   P # W # P # W # P     windows straight above the ones below
z3   # = = = = = = = #     the stair arrives here
z4   P = = = = = = O P     O = stair well above the flight (z4..z9), guarded by a fence or trapdoor rail
...
z9   # = = = = = = O #
z10  P W P # W # P W P     front: centre window above the door
```

Keep doing this check on every wall: **a door or a single window is always in the middle of a bay,
never on a post.**

## Step 6: Doors

- **Main door** on the front, on the centre line of the front or of the front's main module. Formal
  buildings: always on the centre line.
- **Doorway width**: a house doorway is 3 wide (jamb, door, jamb). A grand doorway is 5 wide (jamb, a
  3-wide opening, jamb) under an arch, with the door block centred and the side cells filled as in
  `05-windows-and-doors`. Bedrock doors are one block wide; never put two doors side by side.
- **Height**: the door is 2 tall; the lintel sits on top (3rd block). Grand doorways are 4 or 5 tall
  to the arch top.
- **Distance from corners**: at least 2 blocks of wall (or a post and a bay) between a doorway and a
  corner.
- **Back or side door**: optional, opposite or near the stair, on a bay centre.
- **Walk the path**: from the door there must be a clear line to the stair (or ladder) and into each
  ground-floor room. Mark the path on the plan.
- **Steps**: if the floor is above the ground (see `01-foundation`), the steps are part of the plan:
  one step per block of rise, the flight as wide as the doorway (3 for a house door, 5 for a grand one),
  coming straight out from the door unless the street is too close (then turn the flight along the wall,
  with a landing outside the door at least 3 x 2).

## Step 7: Windows

- **Placement**: one window centred in each bay that does not have a door. 3-bays get a 1-wide window,
  5-bays a 3-wide window (or a 1-wide window between two blank blocks on small houses).
- **Stacking**: windows on upper floors stand directly above the windows or door below, on the same
  column lines. Never stagger windows between floors.
- **Which way they face**: every street-facing and square-facing wall has windows. Sides that touch a
  neighbour closer than 3 blocks get none. Back walls get windows in at least every other bay. The sunny
  side (south and west in the plan before rotation) gets the bigger windows on homes.
- **Height**: windows start one block above the floor (y floor + 1) and are 2 tall in houses; 3 tall
  in halls and the capital; tall hall windows can run 5 to 7 with an arch top.
- **Gable windows**: one window on the centre line of each gable, in the attic storey; 1 x 1 or 1 x 2.
- **Counts**: a facade should be about one third openings, two thirds wall. More glass than wall reads
  like a greenhouse; fewer than one window per two bays reads like a barn.

## Step 8: Stairs, ladders and extensions

- **Stairs between storeys** run along a wall (never across the middle of a room), starting near the
  door. A straight flight climbs 1 per block, so a storey of height 5 (floor to floor 6) needs 6 stair
  blocks plus a landing cell. Check it fits inside the wall length; if not, use a turn with a landing.
- The **stair well** (the hole above the flight) is at least as long as the flight and 1 wide (2 or 3
  in larger builds). Mark it `O` on the upper floor plan.
- **Ladders** only in huts, towers, lofts and the Hollow's mining homes.
- **Extensions**: porches, lean-tos, wings, back kitchens, balconies, bay windows, dormers, chimneys,
  outside stairs. Each one is drawn on the level plans and the roof plan with its own size (odd), and
  how it joins the main block (step 4).

## Step 9: Roof plan and colour

Draw the roof from above:

- Which way each ridge runs (along the long side of each module), the ridge height, the pitch (1 or 2),
  overhang at the eaves and verge at the gables, valleys where roofs meet, dormers, chimneys, towers.
- The **roof shape** per region (gable, hip, flat with parapet, dome, spire) from `palettes/`.
- The **roof colour**: open `palettes/towns.md`, look up the town's roof mix (for example 5 in 10 dark
  wood, 3 in 10 slate, 2 in 10 white), count the roofs already built or planned in the town and pick
  the colour that keeps the town closest to the mix, without matching both next-door neighbours. Civic
  buildings take the town's accent colour.
- Gradients (copper, weathered) are planned now: which rows get which colour (`06-roof`).

## Step 10: Palette sheet

From the region file in `palettes/`, write the actual blocks for this building into the plan: frame,
wall main, wall accent, plinth, floor, trim wood, roof (stair, slab, full block), glass, door, shutter,
fence, light, greenery. Every later stage takes blocks only from this sheet.

## Before you move on

- [ ] Every dimension in the plan is odd, and every wall has a bay pattern written down.
- [ ] Every door and every single window is in the middle of a bay, never on a post.
- [ ] Upper windows line up over lower windows or doors.
- [ ] Each level is drawn, with stairs and stair wells on both levels they join.
- [ ] Doors have a clear walking path to the stairs; entrance steps are drawn with the right rise.
- [ ] Big builds: every module has a row in the module table; no face over 15 blocks is unbroken.
- [ ] Roof plan drawn; colour chosen against the town mix and the neighbours.
- [ ] Palette sheet filled in.
- [ ] Interior: empty (default) or custom/inn (then `08-interiors` gets planned now as well).
