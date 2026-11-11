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
| 4. Never | more than 3 blocks in one surface; a block of a different hue; two busy textures side by side |
| 5. Placement | Weighted by position (height, distance from an edge or opening, facing), using a hashed position so it is stable and repeatable, never per-run random |

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

- [ ] Base block at least 60%, at most 3 blocks, all one colour family.
- [ ] Every variation has a cause (base, openings, corners, sun, water, wear).
- [ ] Looked at from the street and from a hill: one material, no noise, no blotches.
