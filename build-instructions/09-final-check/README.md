# Stage 9: Final check

Before a build goes to Mateo, it is rendered with the real Bedrock textures, looked at the way players
will see it, checked against this list and fixed. Mateo's bar: "This is what people see EVERY DAY while
playing so it has to be perfect." Be harder on it than he would be.

## Step 1: Render

- Render with Mojang's textures (`map/structures/render/`, see `map/structures/README.md`): front,
  back, both sides, from above at 45 degrees, from street level, and at dusk with lights on.
- Big builds and towns: a shot from the nearest hill or rail line too, since that is how most players
  first see a town.

## Step 2: Look at it like a real building

- Could it stand? Every post on something, every beam on a post, every overhang carried, the roof on
  the walls.
- Does it look like the real medieval buildings it is based on, and like Mateo's references
  (`reference/pictures/`)? Put the render next to the reference and name the differences.
- Is there anything that looks like a hole, a cage, a blotch or a floating block? (Recessed panels and
  recessed glass are the usual cause of holes; one-cell ribs and gradual shears the usual cause of
  speckle and jaggedness.)

## Step 3: Checklist

**Plan and proportion**

- [ ] All dimensions odd; doors and single windows on bay centres; formal fronts symmetric.
- [ ] Proportions: height to eaves between half and the full front width; roof matches its pitch.
- [ ] Long faces broken every 7 to 15 blocks.

**Base and frame**

- [ ] Nothing floats on the low side; plinth visible; steps match the floor height and the doorway width.
- [ ] Posts line up storey to storey; beams at every floor line; jetties bracketed.

**Walls and openings**

- [ ] Three depth layers on every face over 5 long.
- [ ] Wall mixes read as one material; no green patches high up.
- [ ] Windows stacked; glass flush with the face; sills wider than the glass; heads capped; glass tinted
      to the house; shutters on at most 30%.
- [ ] Doorway clean: jambs, lintel, canopy or lanterns, not both crowded.

**Roof**

- [ ] Overhang 1 all round; barge boards and eaves; no gaps at the wall top; valleys closed.
- [ ] Colour fits the town mix and the neighbour rule; gradient bands blend.
- [ ] Chimneys 2 above the roof.

**Detail and interior**

- [ ] Every detail has a reason; 1 to 3 props per door.
- [ ] Interior furnished by use, every storey reached, a one-block walkway to every room, bed and chest (`08-interiors`).

**Technical**

- [ ] Every block state is right (stairs, trapdoors, doors facing the right way after rotation:
      `reference/block-states.md`).
- [ ] Footprints over 64 x 64 are tiled for `/structure load`.
- [ ] In-game builds that place over time use `system.runJob` or spread over ticks (repo rule: no long work
      in one tick).

## Step 4: Fix, then show

Fix everything the list or the comparison found, render again, and only then show Mateo, with the
renders, the plan and a line on any decision made by eye (plan section 9). If something needs his eye
(a style choice the rules left open), ask with pictures of the options.
