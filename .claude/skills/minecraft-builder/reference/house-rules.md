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
- **Roofs overhang 1** at eaves and verges; ridge the long way; secondary roofs lower; no flat roofs on houses
  outside Emberwaste.
- **Texturing**: one material in a few shades, gradients over speckle, clusters with a cause (damp low, wear
  at edges), never skip a ladder step (`build-instructions/texturing/README.md`).
- **Vanilla blocks** for map buildings, Bedrock 26.30+, no Beta features. Waxed copper for copper roofs.
- **Build stage by stage** and check each stage (`--stages`) before the next. Ask Mateo rather than guess;
  he builds well himself and sends pictures.

## Region styles

| Region | Read | Preset to start from |
|---|---|---|
| Aldmere Vale (Kingsrest, Millbrook) | palettes/vale.md, texturing/regions/vale.md | `vale_timber`, `vale_stone`, `vale_brick` (Mateo chose "mix all three": plaster-timber for most, stone for important buildings, some brick) |
| Frostmarch | palettes/frostmarch.md | `vale_timber` with spruce/dark oak frame, spruce infill, pitch 2 roofs, small windows, no shutters on halls |
| Saltreach | palettes/saltreach.md | `vale_stone` with smooth sandstone, birch frame above, hip roofs pitch 1, painted shutters |
| Blackfen | palettes/blackfen.md | proud mangrove frame, mud brick infill, stilts, mossy roofs |
| Emberwaste | palettes/emberwaste.md | stone (cut sandstone), flat roofs with parapets, domes |
| The Hollow | palettes/hollow.md | dark oak frame, pale ash infill, a single one-block offset of a whole storey, deepslate roofs, froglight windows |

## Look for, before showing (09-final-check, short)

- [ ] Every dimension odd; door and windows on bay centres; ridge centred.
- [ ] No stair facing the wrong way on roofs (light lips), no holes at valleys, chimney 2 above the roof.
- [ ] Barge boards, eave row, corner blocks present; gable triangles filled.
- [ ] Sills wider than glass; heads where there is room; shutters few and paired.
- [ ] Colour: one family per surface, no band that jumps a step, no single odd block.
- [ ] Curved shapes read smooth from 30 blocks (preview) and from close (hifi render).
- [ ] The summary has no surprising warnings (substituted partial blocks, even footprints).
