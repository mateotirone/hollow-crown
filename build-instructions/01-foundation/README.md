# Stage 1: Foundation

You have the plan. Now the base: level ground, footings, the plinth, the floor at the right height,
and the steps up to the door. When this stage is done, every door sill is at its final height and
every post has something solid under it.

## Principles

- **A real building sits on footings, not on grass.** The ground under every wall and post is solid
  down to below the lowest ground point, so the build never floats on a slope.
- **The floor is above the ground.** Real houses keep the floor off the wet ground. One step up for a
  home, more for important buildings. It also makes the plinth visible, which is the first depth layer.
- **The base is heavier and darker than the walls above it.** Cobbled, rough or darker stone at the
  bottom, lighter and smoother above.

## Step 1: Level the footprint

Placed by a generator (towns, plots, story sites, the game's Foundation Stone): don't level by hand. The one
terraform pass (`map/structures/terraform.py`, house rules "Every placed thing is terraformed") picks the floor,
cuts the pad, blends a skirt round it and meets the door landing and streets. The steps below are for a build
set by hand on its own.

1. Take the footprint plus one block all round (plus the steps and any terrace from the plan).
2. Set the ground level `y = 0` for the build: the **average** ground height under the front, rounded,
   unless the street gives it.
3. Fill below to `y = 0` where the ground is lower, cut above where it is higher.
4. Ground that varies more than 3 blocks under the footprint: do not flatten it. Step the building
   (split levels with a stair inside, or a tall plinth on the low side used as a cellar or a terrace
   wall). Town placement already rejects plots that vary more than 3 (`map/structures/town.py`).

## Step 2: Footings

- Under every wall line and every post: a solid column from the floor down to 4 blocks below the
  lowest ground (`kit.foundation(depth=4)`), in the palette's footing block.
- Where the ground falls away (slopes, banks, the edge of a terrace), the footing shows above ground:
  make it the plinth material and give it a batter or buttress every 5 blocks if it is taller than 3.
- Footings of wings and towers join the main footing; no gaps under a join.

## Step 3: The plinth

The plinth is the band of stone at the bottom of the wall, from the ground to the ground floor.

| Building | Floor height above outside ground | Plinth | Steps at the door |
|---|---|---|---|
| Shed, hut, barn | 0 to 1 | 1 course, or none for barns (floor = ground) | none or 1 |
| Cottage, house | 1 | 1 course | 1 step |
| Large house, shop, inn | 1 to 2 | 1 to 2 courses | 1 to 2 |
| Civic hall, chapel, guildhall | 2 to 3 | 2 to 3 courses with a top course of a smoother stone | 2 to 3, full flight |
| Capital, keep | 3 to 5 | a full base storey look, string course on top | grand flight, landings |
| Blackfen stilt house | 3 to 4 (on posts) | none: mangrove stilts under every post (`regions.py fen_house`) | a stair to a 3 x 1 landing |
| Emberwaste | 1 | flush with the wall (thick walls, no frame) | 1 |

Rules:

- Plinth blocks are the palette's plinth mix (rough, darker). The top course of a 2-plus plinth may be a
  smoother block or a row of upside-down stairs sticking out 1 (a drip course), see `07-detailing`.
- On timber regions the plinth is one course of stone under the bottom beam (the sill beam), the frame
  starts on top of it. This is what `settle_buildings.body` does: a 1-high stone storey, then timber.
- Corners of a stone plinth get quoins (alternate a lighter block every other course).

## Step 4: The ground floor layer

- The floor layer sits on top of the footings and fills the whole inside of the footprint at
  `floor y - 1`, so the walking surface is the plan's ground floor y. (Floors themselves are laid in
  `03-floors`; here you make sure the solid layer under them is there.)
- If the floor is 2 or more above the ground, fill under the floor solid (footing block) or leave a
  cellar only if the plan has one.

## Step 5: Entrance steps

Steps are built now, while the floor height is fresh, so the door lands on them correctly.

- **Rise**: one step per block of floor height.
- **Width**: the doorway width: 3 for a house door (jamb, door, jamb), 5 for a grand doorway. Never
  narrower than the doorway.
- **Blocks**: stairs of the plinth or path material facing the door (the tall back side towards the
  building: `facing` = the side the building is on, in `bp.py` terms). The top step is a full landing
  block level with the floor, directly in front of the door.
- **Cheeks**: flights of 2 or more get a solid cheek block (or wall block) on each side, capped with a
  slab or a lantern post at the bottom.
- **Landing**: if the flight is longer than 3 steps, put a 3-deep landing halfway (5-wide for grand
  flights).
- **Turned flights**: if the street is too close, the flight runs along the wall from a landing at least
  3 wide x 2 deep in front of the door, with a fence or wall rail on the open side.
- Homes with 1 step: a single row of stairs 3 wide, or a slab + full block for a softer look.

## Step 6: The ground around it

- One-block apron of path or gravel along the front; the street path runs to the steps.
- Grass or coarse dirt to the other walls, never bare levelled stone.
- Save trees, shrubs and flower beds for `07-detailing`.

## Region notes

- **Vale**: cobbled plinth with mossy cobble low on it, one course for homes; Norman stone buildings have
  a 2-course plinth with a string course.
- **Frostmarch**: dark cobbled deepslate plinth, often 2 courses (snow), steps with snow layers beside.
- **Saltreach**: stone ground storey on a sandstone-coloured plinth; harbour buildings may stand on a
  quay wall.
- **Blackfen**: stilts and platforms, not plinths; the platform is the floor.
- **Emberwaste**: thick sandstone base flush with the wall; raised terraces in front of homes.
- **Hollow**: cobbled deepslate plinth; an upper storey or the roof may be offset one block
  (see `02-frame`), the plinth never is.

## Before you move on

- [ ] Ground levelled to y = 0 around the footprint (or stepped, if the plan says so).
- [ ] Every wall line and post has a footing 4 below the lowest ground.
- [ ] Plinth height matches the table for this building; quoins on stone corners.
- [ ] Ground floor solid layer is in, at floor y - 1.
- [ ] Steps: right count, doorway width, cheeks on 2-plus flights, landing in front of the door.
- [ ] Nothing of the building can float: look at it from the low side.
