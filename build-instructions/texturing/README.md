# Texturing

How to mix blocks on any surface (walls, roofs, floors, paths, plinths, terrain around a build) so it
reads as one real material that has aged, not as one flat block and not as confetti. Every stage that
places a surface follows this file; the region files in `palettes/` say which blocks, this file says how
to mix them.

## Principles

1. **One material, a few shades.** A textured surface is one material seen in a few tones: pick blocks of
   the same colour family that differ in value (lighter, darker) or texture (smooth, rough), never in hue.
   Choose by colour, any solid block (Mateo, 2026-11-11).
2. **Variation has a cause.** Real surfaces change where something happens to them: damp and moss at the
   bottom, wear on edges and around doors, soot near chimneys, sun-fade on the south and top, dirt along
   paths. Put the variation there. Even random scatter over a whole wall reads as noise.
3. **The eye reads big shapes first.** From the street and the rails, a building is a few big areas of
   colour. Texture is the second look. Keep big areas calm; put the busiest texture in small areas
   (corners, bands, trims).
4. **Gradients over speckle.** Change tone gradually across a surface (darker at the base, lighter going up;
   oxidised at the ridge, bright at the eaves) rather than scattering single odd blocks.
5. **Check in the render.** Textures look different at distance. A mix that looks rich close up can read as
   grey noise from 30 blocks. Always look from the street and from a hill.

## The recipe

For any surface:

| Step | Rule |
|---|---|
| 1. Base block | One block, at least 60% of the surface |
| 2. Second block | Same colour, slightly lighter or darker, or rougher; 15 to 30% |
| 3. Accent block | Optional, 5 to 10%, only where the cause is (moss low, cracks round openings) |
| 4. Never | more than 3 blocks in one surface (up to 5 on big walls and civic buildings, see below); a block of a different hue; two busy textures side by side; skipping a step of the ladder |
| 5. Placement | Weighted by position (height, distance from an edge or opening, facing) plus low-frequency noise for clusters, using a hashed position so it is stable and repeatable, never per-run random |

## Gradient craft (from the ArdaCraft Gradient Guide, Mateo, 2026-11-11)

Source: [ArdaCraft Gradient Guide](https://www.ardacraft.me/resources/gradient-guide) (the wiki copy is the
same page). What it adds to the recipe:

1. **Value first, then colour, then texture.** Order every ladder by value (light to dark). Blocks need not
   match exactly: if value and colour or texture are close, they work. The hex in `doctrine.json` is there
   to check value.
2. **Never skip a step.** Two cells next to each other differ by at most one step of the ladder. A jump
   from step 1 to step 3 makes hard blocky squares, the commonest mistake. Skip only between two blocks
   so alike they read as one. Builders: after placing, check every pair of neighbours and put the missing
   step between them.
3. **Patterns are weathering, in clusters.** Variation forms blob-like clusters (patches, stains, drips),
   never a random splatter of single blocks. Use smooth low-frequency noise (cells of about 3 to 7
   blocks) on top of the position gradient, then snap to the ladder.
4. **Squint test.** Look at the render small or blurred: the clusters should read as soft shapes. Reshape any
   hard shape, especially a straight 45 degree diagonal run or a stripe.
5. **Cracks with a cause.** Cracked and chipped blocks go at building corners, round windows and doors, and
   where wall planes meet, never scattered. Cracked areas are the most damaged, so they sit in the darkest
   part of the gradient. Add cracks and stains back and forth until it looks right, never overdo it.
6. **Palette size suits the structure.** Small builds (huts, cottages): 2 or 3 steps. Big walls (more than
   15 long or 9 tall) and civic buildings: up to 5 neighbouring steps, with a larger discoloured patch near
   the middle of the wall so the big surface has a focus.
7. **Detail balances detail.** A busy front (close studding, many windows, shutters) gets a simple
   gradient; a plain wall gets a richer one.
8. **Town before building.** Neighbouring buildings share families and strength of weathering; a street
   reads as one place before any one house stands out.
9. **Canvas first.** Build the shape in the base block only (stages 0 to 7), mark where cracks and wear go,
   then paint the gradient over it as a last pass and fix shape or cracks if the result is messy. This is
   why texturing is a pass over finished surfaces, not something chosen block by block while building.

### Mateo's gradient examples (2026-11-11, `gradient-examples-ardacraft.png`)

Three 5 x 11 panels, bottom to top. What they show, now the default for every wall:

- **Bands bottom to top, 4 or 5 steps, dark to light**: bricks at the foot, then cobble, then a mid
  stone, then the lightest, smoothest block at the top.
- **Texture changes along the ladder** (bricks, then cobble, then smooth stone) while lightness climbs.
  Cobble and stone bricks are the same lightness in vanilla, so they never sit side by side as variation
  in one band.
- **Edges interlock in columns** ("teeth"): each column's edge sits a row or two higher or lower than its
  neighbour's, with a few lone blocks of the next step just ahead of the edge. Never a straight line,
  never single-block speckle. `doctrine.py paint_teeth()` does this.
- **Colour may shift** across a real change of material (grey stone at the foot to earth and sand
  render above, the middle panel).
- The panels use a custom texture pack; the vanilla matches by lightness are VAL-01 (left), VAL-11
  (middle) and VAL-10 (right).

## The doctrine: region, colour, code (Mateo, 2026-11-11)

Texturing is broken down by **region**, then by **colour** within the region. Every colour family has a
code (`VAL-01` stone grey, `FRO-04` ice blue...) and a hex measured from the block textures, and a
**ladder** of blocks from dark to light. A surface takes up to 3 neighbouring steps of one ladder.

| Region | File | Families |
|---|---|---|
| Vale | [regions/vale.md](regions/vale.md) | VAL-01 to VAL-08 |
| Frostmarch | [regions/frostmarch.md](regions/frostmarch.md) | FRO-01 to FRO-06 |
| Saltreach | [regions/saltreach.md](regions/saltreach.md) | SAL-01 to SAL-06 |
| Blackfen | [regions/blackfen.md](regions/blackfen.md) | BLK-01 to BLK-05 |
| Emberwaste | [regions/emberwaste.md](regions/emberwaste.md) | EMB-01 to EMB-05 |
| Hollow | [regions/hollow.md](regions/hollow.md) | HOL-01 to HOL-06 |

**It is code.** `doctrine.json` is the source of truth (every region, code, ladder, the rules and the
pairings). `doctrine.py` loads it for builders (`family("VAL-01")`, `paint(w, h, ladder, seed)` paints a
surface by the rules below) and rebuilds the region pages and the viewer `doctrine.html` (real block
textures, a test wall per code; published at https://claude.ai/artifact/TEMXFMWr9LrVPpsaH5LDRn). Edit the
JSON, then run `python3 build-instructions/texturing/doctrine.py --textures <bedrock-samples blocks>
--kit map/structures/render`.

The ladders now are Claude's starters. Mateo is sending the exact blocks for each gradient with a
screenshot per family; his lists replace the starters and the screenshots go in `pictures/` named by code
(`VAL-01.png`). Where a region file and `palettes/` disagree, the region file wins.

## Pairings

Colours that go together across families. A builder uses these before inventing a combination.

| Pairing | Blocks | Where | Source |
|---|---|---|---|
| Stone, spruce, dark oak | stone wall (light field), `spruce` planters, slabs, lantern stands (middle), `dark_oak_trapdoor` panels and shutters (darkest) | anything that uses stone | Mateo, 2026-11-11, `reference/pictures/stone-ground-floor-trapdoors.png`; build rules in `05-windows-and-doors` |

## Gradients by surface

| Surface | Gradient |
|---|---|
| Stone walls | bottom 2 courses: rougher and darker (cobble, mossy cobble, a little moss); body: base block; top: the cleanest block. Cracked blocks around openings and corners |
| Plinths | darkest and roughest part of the building |
| Plaster | plain; at most a slightly darker white in the bottom row near the ground |
| Timber | the frame is one block; no mixing in posts and beams |
| Roofs | weathered at the ridge or at the eaves depending on material: copper oxidised at the ridge, bright at the eaves (dither about +/-0.04 of roof height); slate darker at the eaves; moss low on Blackfen roofs and on old roofs' north side |
| Floors | field plain, border contrasting; stone floors may scatter 2 blocks |
| Paths | see `paths/` |
| Ground around a build | grass, then coarse dirt and path wear near doors and where people walk, gravel or stone at the drip line under eaves |

## Depth with texture

Texture also creates depth without moving a block: a darker block reads as further back, a lighter one as
nearer. Use the darker block of the mix in the cells just under an overhang, round a door, under sills,
and the lighter one on the faces that catch the sun.

## Ageing (old buildings, ruins, the Hollow)

- More of the second and accent blocks (up to 40%), more cracks and moss, missing blocks only where the
  structure would really fail (a roof corner, the top of a wall), never random holes.
- The Hollow ages differently: no moss; pale ash, cracked veinstone and soul light where the seep has
  touched.

## Region notes

The blocks for every role are in `palettes/<region>.md`. The texturing feel per region:

- **Vale**: clean plaster, weathered stone low, slate roofs with a few darker tiles. Lived in, cared for.
- **Frostmarch**: plank rows rather than scatter, snow on the tops of things, dark stone clean.
- **Saltreach**: bright and sun-bleached; salt-white near the sea, warm sand tones on the ground storey.
- **Blackfen**: damp: moss low and on roofs, mud bricks darker near the water, packed mud below.
- **Emberwaste**: sun-faded: lighter sandstone at the top, cut sandstone at corners, red sand dust low.
- **Hollow**: cracks and ash, no green.

## Before you finish a surface

- [ ] Base block at least 60%, at most 3 blocks (5 on big walls), all one colour family.
- [ ] No skipped steps between neighbours; variation in clusters, not speckle; squint test passed.
- [ ] Cracks only at corners, openings and where planes meet, in the darkest part.
- [ ] Every variation has a cause (base, openings, corners, sun, water, wear).
- [ ] Looked at from the street and from a hill: one material, no noise, no blotches.
