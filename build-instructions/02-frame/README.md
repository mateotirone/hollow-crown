# Stage 2: Frame

The skeleton: corner posts, bay posts, the beams at every floor line, jetties and everything that
holds something up. Frame the whole height of the building, every storey, before any wall goes in.
Stone buildings without a timber frame still get this stage: their "frame" is the corners (quoins),
piers and string courses.

## Principles

- **The frame is the structure. Make it look like it carries the load.** Posts stand on the plinth or on
  a post below. Beams rest on posts. Upper storeys rest on beams. If a viewer cannot see what holds
  something up, add the support.
- **Posts follow the bay pattern from the plan.** Every `P` in the bay patterns is a post, on every
  storey, in the same column.
- **Dark frame, light infill** is the usual contrast in timber regions (dark oak or spruce logs, pale
  infill). Pale frame on darker infill also works (Vale brick style, Saltreach birch). Never frame in a
  colour close to the infill.

## Step 1: Corner posts

- Logs standing upright (`axis = y`) from the plinth top to the eaves at every outside corner of every
  module.
- Big buildings (9 wide and up) may use a stripped log or a different log for corners, or a 3-block
  cluster on the capital and halls.
- Stone buildings: quoins instead of posts: corners alternate the palette's quoin block every course,
  or every other course in pairs on tall buildings.

## Step 2: Bay posts

- One upright log at every `P` of every wall's bay pattern, the whole storey high.
- Door jambs are their own blocks (stage 5); a post never doubles as a jamb unless the doorway's
  pattern says so (`P1P3P1P`: the posts at x2 and x6 sit beside the door bay, the jambs are inside it).

## Step 3: Beams at every floor line

- A horizontal log (axis along the wall: `x` on north and south walls, `z` on east and west) runs the
  full length of every wall at:
  - the bottom of the timber (the sill beam, on top of the plinth),
  - every floor line (the floor layer of the storey above, seen from outside),
  - the top of the wall (the wall plate, which the roof sits on).
- Corners where two beams meet: the post wins (keep the upright log at the corner).
- Stone buildings: a string course at each floor line instead (a row of a smoother stone, or upside-down
  stairs proud of the face by 1, see `07-detailing`).

## Step 4: Braces (optional, by style)

- Diagonal look on timber faces: in a 3-bay, an upside-down stair at the top corners of the bay against
  the posts (tall side to the post), or a right-way stair at the bottom corners. Use on at most a third
  of the bays and keep them symmetric about the centre of a face.
- Vale "close studding": in tall storeys, an extra upright log centred in a 5-bay with no window.

## Step 5: Jetties (upper storey sticking out)

Jetties are the Vale's signature and work in Frostmarch too.

- An upper storey may step out **1 block** over the street front (and the back, or the sides for corner
  houses). Never more than 1 per storey; a second jetty in a gable is allowed (the attic steps out again).
- The joists show: under the jettied floor, an upside-down stair of the trim wood under **every post of the
  upper frame** and at each corner (`kit.jetty_brackets`), tall side against the wall below.
- The upper storey's bay pattern is the lower one grown by 1 at each jettied side, so its posts still line
  up with the lower posts plus one new corner post. Re-check the upper bay pattern is odd.

## Step 6: Structural supports

Every overhang shows what holds it. Use this table:

| Overhang | Support |
|---|---|
| 1 block (jetty, eave, balcony lip, sill) | upside-down stair bracket under it, tall side to the wall; or the stair/slab itself if it is a sill |
| 2 blocks (balcony, deep canopy, oriel) | a bracket of two parts: an upside-down stair under the outer edge and a log (axis out from the wall) or a top slab under the inner part, or a fence post brace down to a bracket on the wall |
| 3 or more (porch, gallery, covered walk, lean-to) | posts to the ground: log or fence posts on a footing block, every 3 or 5 blocks (odd), with a beam on top |
| Big roofs over a wide room (9 or more inside) | trusses every 3 or 5 blocks, see `06-roof` |
| Floors spanning more than 9 blocks inside | a beam (log) across the room under the floor, resting on posts in the walls, every 5 blocks; or a free-standing column row (X on the plan) |
| Arches | the arch itself is the support; the wall above a wide opening (5 or more) gets a beam or a stair-arch, see `reference/shapes.md` |
| Towers on a wall corner (corbelled turret) | a ring of upside-down stairs, then a ring of top slabs or a second stair ring under the turret floor |
| Stone walls taller than 9 or longer than 15 | buttresses every 5 to 7 blocks: 1 block out, stepping back with a stair at mid height and at the top |

Fences are posts for light things only (awnings, signs, lanterns, slab roofs over a stall, balcony rails).
Anything with a roof of stairs or a floor on it gets logs or walls as posts.

## Frame flush or proud

Both are right; the style decides (Mateo, 2026-11-11: "It could be either, depending on the style of the
house"):

- **Flush frame** (logs and infill in the same plane): neat town houses, Saltreach, brick-and-timber Vale
  style. Depth then comes from jetties, sills, eaves and plinth.
- **Proud frame** (posts and beams stick 1 block out; the infill stays on the wall line): cottages,
  rustic and Norse builds, big halls where the frame is the show. Never get a proud frame by pushing the
  infill back: set-back infill renders as holes or a cage (lesson from the first Kingsrest proof and every
  render since).
- Decide by looking at the building as a real house and at the references; write the choice in the plan.

## Region notes

- **Vale**: stripped dark oak or dark oak frame, calcite (or brick for the brick style) infill, jetties
  on town houses, close studding on the inn and guildhall.
- **Frostmarch**: dark oak or spruce log frame, spruce plank infill, no jetties on halls but heavy
  corner posts; stave-church look on civic builds (tall posts, tiered roofs).
- **Saltreach**: stone ground storey; birch or stripped oak frame above, whitewash infill, flush.
- **Blackfen**: mangrove log frame and stilts; mud brick infill; frame proud.
- **Emberwaste**: no timber frame; corners and piers in cut sandstone, projecting log roof beams (vigas)
  at the roof line every other block.
- **Hollow**: dark oak frame, pale ash infill. Crookedness is a **single one-block offset** of a whole
  upper storey (or of the roof) to one side, never a gradual shear: shearing a block every few rows
  renders jagged. The posts of the offset storey still stand on the beam below.

## Before you move on

- [ ] Corner posts (or quoins) on every corner of every module, full height.
- [ ] A post at every `P` of every bay pattern, on every storey, lined up vertically.
- [ ] Beams at the sill, every floor line and the wall plate on every wall.
- [ ] Jetties at most 1 per storey, with a bracket under every upper post.
- [ ] Every overhang has its support from the table.
- [ ] Flush or proud frame chosen and written in the plan.
- [ ] Look at the skeleton alone: it should read as a building that could stand.
