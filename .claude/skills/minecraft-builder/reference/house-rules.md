# House rules (The Hollow Crown)

Load for any build for Mateo's world. The full rules live in `build-instructions/` (stages 00 to 09,
palettes, texturing, paths, reference); this page is the short list and where to read more.

## Always

- **Odd dimensions** ("work in threes" = 3 or 5 blocks, odd numbers): footprints, bays, windows 1 or 3
  wide, doorways 3 or 5, gable spans, tower widths. An odd run has a centre block. Radii end in .5.
- **Storey height 4 or 5** depending on the building's size.
- **Mateo's chimney** is the default chimney (parts.md).
- **Interiors empty** (floors and stairs only) except the inn and builds marked custom.
- **Glass flush with the wall face**, tinted to the house, never clear everywhere; stained glass in chapels.
- **Depth comes outward**, never by recessing a panel: at least three depth layers on any face over 5 long.
- **Every overhang is carried** (bracket, post, corbel, truss).
- **Shutters on at most about 30%** of windows, in symmetric pairs; planters on about a quarter.
- **Roofs overhang 1** at eaves and verges; ridge the long way; secondary roofs lower; no flat roofs on houses (Emberwaste and Saltreach terraces excepted)
- **Every roof is textured**: two blocks of the same colour mixed at random (copper keeps its gradient instead)
  outside Emberwaste.
- **Texturing**: one material in a few shades, gradients over speckle, clusters with a cause (damp low, wear
  at edges), never skip a ladder step (`build-instructions/texturing/README.md`).
- **Vanilla blocks** for map buildings, Bedrock 26.30+, no Beta features. Waxed copper for copper roofs.
- **Paths and water run to the edge** (Mateo 2026-11-12): any path, walkway, slip, channel or water inside a
  build or plot carries on to the edge of its footprint, so it joins whatever is next to it. A boathouse slip
  opens through its wall to the footprint edge; a plot's paths reach its border. Stopping short inside is wrong.
- **Towns are lit** (Mateo 2026-11-12: "none of the towns have light ... the town generation needs to factor in
  lamps"): lamps round every square (an arm with a hanging lantern, one every ~8 blocks of its edge) and posts
  along every street on the verge, sides alternating, every 9 (main) / 11 (lane) / 13 (walk) blocks, none
  closer than 7 to another. Region style in `map/structures/dressing.py` LAMP_STYLE (stone foot, the region's
  wood post, a lantern). towngen does this for every town and settlement (`Town.light_town`); a hand-built
  plot or site lights its own paths the same way. Check: no street block darker than light 4 at night.
- **Nothing stands on a sunk slab** (Mateo 2026-11-12, "the town well is one block too high"): paths and squares
  are bottom slabs sunk half a block, so anything built on one (a well rim, a lamp foot, a step, a post)
  replaces the slab at the slab's own y; setting it on top leaves a half-block gap and reads a block too high.
- **Build stage by stage** and check each stage (`--stages`) before the next. Ask Mateo rather than guess;
  he builds well himself and sends pictures.

## Region styles

**Read the region's page in `regions/` before planning any build for it** (Mateo 2026-11-12): what the
region is, its theme, land and weather, towns and paths, every building type, roofs (shape, what they
carry, how they are made), windows and details, blocks, trees, the preset and spec to start from, and what
never to do. Index: `regions/README.md`.

| Region | Page | Presets |
|---|---|---|
| Aldmere Vale (Kingsrest, Millbrook) | regions/vale.md | `vale_timber`, `vale_stone`, `vale_brick` (mix all three) |
| Frostmarch (Rimehold, Frosthelm) | regions/frostmarch.md | `frost_timber`, `frost_stone`; roofs pitch 2 |
| Saltreach (Gull's Rest) | regions/saltreach.md | `salt_timber`, `salt_stone`; hip roofs |
| Blackfen (Mirelight) | regions/blackfen.md | `fen_timber`; on stilts |
| Emberwaste (Sunscar) | regions/emberwaste.md | `ember_sandstone`; flat roofs |
| The Hollow | regions/hollow.md | `hollow_timber`; roofs pitch 2 |

## Look for, before showing (09-final-check, short)

- [ ] Every dimension odd; door and windows on bay centres; ridge centred.
- [ ] No stair facing the wrong way on roofs (light lips), no holes at valleys, chimney 2 above the roof.
- [ ] Barge boards, eave row, corner blocks present; gable triangles filled.
- [ ] Sills wider than glass; heads where there is room; shutters few and paired.
- [ ] Colour: one family per surface, no band that jumps a step, no single odd block.
- [ ] Curved shapes read smooth from 30 blocks (preview) and from close (hifi render).
- [ ] The summary has no surprising warnings (substituted partial blocks, even footprints).
