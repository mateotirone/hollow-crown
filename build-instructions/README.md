# Build instructions

How every building in The Hollow Crown is built, one stage at a time. This folder is written for
the AI (or person) that builds: map towns, settlement buildings, town halls, walls, strongholds and
the Hollow's sites all follow it. Read a stage, do only that stage, check it, then move on.

**Before any build, read the building skill first** (`.claude/skills/minecraft-builder/SKILL.md`, the one engine every
build uses) **and the region's style guide** (`.claude/skills/minecraft-builder/regions/<region>.md`). The repo's
`CLAUDE.md` says the same, so every session sees it.

Mateo's direction (2026-11-11): the builder should not "build a house from the ground up" in one go.
It meticulously goes through every step, making sure everything is in the right place for what it is.

## The stages, in order

| # | Folder | What you do there | You leave with |
|---|---|---|---|
| 0 | [00-planning](00-planning/README.md) | Size, massing, full floor plan of every level with exact block counts, doors, windows, stairs, extensions, roof plan, palette and roof colour | A finished plan (template in `00-planning/plan-template.md`) |
| 1 | [01-foundation](01-foundation/README.md) | Level the ground, footings, plinth, floor height, entrance steps, terraces | The building's base, door sills at the right height |
| 2 | [02-frame](02-frame/README.md) | Corner posts, bay posts, beams at every floor line, jetties, structural supports | The skeleton of every storey |
| 3 | [03-floors](03-floors/README.md) | Floor fields, borders, joists, stair openings | Every floor laid |
| 4 | [04-walls](04-walls/README.md) | Infill between the frame, texture mixes, depth layers, gables below the roof line | Closed walls with openings left for doors and windows |
| 5 | [05-windows-and-doors](05-windows-and-doors/README.md) | Doorways, door surrounds, windows, sills, lintels, shutters, planters, arches | Every opening finished |
| 6 | [06-roof](06-roof/README.md) | Roof shape, pitch, overhang, verges, ridges, valleys, dormers, trusses, roof colour and gradients, chimneys | The building is closed in |
| 7 | [07-detailing](07-detailing/README.md) | Depth with slabs and stairs, fences, arches, lights, greenery, signs, the street edge | The outside is finished |
| 8 | [08-interiors](08-interiors/README.md) | Every building furnished by use: stairs, rooms, a one-block walkway, light (the skill's interior stage) | The inside is finished |
| 9 | [09-final-check](09-final-check/README.md) | Render, look from the street, run the checklist, fix | A build ready for Mateo's review |

**Towers** (bell, clock, corner, watch, wall towers, lighthouses, wonders) also follow [towers/README.md](towers/README.md): stages, proportions, the clock, and the tower style of each region.

Supporting folders:

- [palettes](palettes/README.md): every region's block palette, chosen by colour, plus the roof colour mix for every town.
- [texturing](texturing/README.md): how to mix blocks on any surface, the per-region colour doctrine with codes (`texturing/regions/`), and pairings such as stone, spruce, dark oak.
- [paths](paths/README.md): strict rules for every path, street and square (sunken half slab, odd widths, slope, surfaces per region).
- [minecraft-builder skill](../.claude/skills/minecraft-builder/SKILL.md): these stages as code. A JSON spec of shapes (curves, domes, arches) and parts (plinth, frame, doors, windows, roofs, chimney) becomes a .mcfunction, a summary and previews.
- [reference](reference/README.md): block states (which way a stair faces), the shape library (arches, sills, brackets, trusses) and Mateo's reference pictures.

## Rules that hold at every stage

1. **Odd numbers.** Every dimension is odd: footprints, wall runs between posts (3 or 5), window widths
   (1 or 3), doorways (3 or 5 including the jambs), gable spans, tower widths. An odd run has a centre
   block, so doors, windows, ridges and peaks sit dead centre. If a number comes out even, change the
   design, never centre "between two blocks". (Mateo, 2026-11-10: "just work in odd numbers".)
2. **Plan before you place.** Nothing is placed until the plan for the whole building exists, every
   level, every opening, the roof. A build that changes its plan halfway goes back to stage 0.
3. **Region first.** Every block comes from the region's palette in [palettes](palettes/README.md).
   Blocks are chosen strictly by colour, whatever the block is, as long as full-block roles use a solid
   block (Mateo, 2026-11-11). Castle Stone is one colour option per region, not a requirement; player
   settlements use the full palette too (Mateo chose "everything free", 2026-11-11).
4. **Every building has an interior** (Mateo, 2026-11-12, replacing the 2026-11-11 "empty" rule): stairs
   or ladders between storeys, rooms furnished by what the building is for, a one-block walkway everywhere
   players walk. The skill's interior stage does it (`08-interiors`).
5. **Every overhang is carried.** Anything sticking out more than one block shows what holds it up
   (bracket, post, brace, corbel). See `02-frame` and `reference/shapes.md`.
6. **Three depths on every face.** Any wall face longer than 5 blocks has at least three depth layers:
   the wall face, things one block proud (frame, sills, string courses, jetty), and things further out
   (eaves, brackets, buttresses, planters). Depth always comes **outward**: never recess a wall panel or
   the glass behind the face, because in real-texture renders a recess reads as a hole or a cage. Flat
   faces are the most common reason a build looks cheap.
7. **One stage at a time.** Finish and check a stage before starting the next. Each stage ends with a
   "Before you move on" checklist. Do not skip it.
8. **Build it like a real building.** At every stage, look at what you made as if it were a real house
   (Mateo, 2026-11-11). Is it structural: does every post stand on something, does every beam rest on a
   post or wall, could the roof actually be carried? Does it look like real medieval buildings (English
   and Norman timber framing, Norse stave halls, Mediterranean harbour houses, North African kasbahs,
   stilt houses) and like Mateo's reference pictures? The rules here are the floor, not the ceiling: where
   a rule leaves a choice ("flush or proud frame", "which glass tint"), choose with your own eye for the
   style of this particular building, and write the choice into the plan.
9. **When unsure, ask Mateo.** He is an experienced builder and will send pictures. A question is cheaper
   than a rebuild.

## Coordinates every builder uses

The same frame as `map/structures/` (`bp.py`, `kit.py`):

- `y = 0` is the top layer of the ground outside. The ground floor walking surface is `y = 1` or higher
  (see `01-foundation`).
- The front of a design faces **south (+z)**. Stamps are rotated clockwise when placed (0 = front south).
- `x` runs west to east, `z` north to south. A footprint is written `width (x) by depth (z)`, counting
  blocks inclusive: a wall from `x = 0` to `x = 8` is 9 wide.
- Block states are written the `bp.py` way (`facing`, `half`, `axis`, `open`); see
  `reference/block-states.md` for what they mean in Bedrock.

## Who uses this

- `map/structures/` (kit.py, vale.py, regions.py, settle_halls.py, settle_buildings.py, hollow_kit.py):
  the builders the "Build great-looking map structures with AI" thread wrote. Where the kit and these docs
  disagree, these docs win and the kit is changed.
- The town generator from the "Procedurally generate terrain-aware towns" thread: it takes stage 0's
  massing and street rules and the town roof mixes from `palettes/towns.md`.
- Anyone placing a build by hand from a plan.

## Changing these docs

Mateo decides how things look. When he gives a rule, it goes into the stage it belongs to with the date,
and the builders are updated to match. Rules marked **(proposed)** are a starting point Mateo has not yet
confirmed.
