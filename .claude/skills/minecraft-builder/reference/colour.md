# Colour and materials

Load when choosing blocks. Code: `scripts/colour.py`, `scripts/materials.py`; data: `data/palette.json`.

## Material forms (in `materials`, or inline wherever a material is expected)

| Form | Example | Result |
|---|---|---|
| block id | `"stone_bricks"` | that block (Bedrock or Java name). Non-building blocks (glass panes, lanterns) are placed as they are |
| colour | `"#a0522d"` or `{"color": "#a0522d", "roughness": "smooth", "tags": ["terracotta"]}` | the nearest block by OKLab that has slab and stair forms |
| doctrine code | `"VAL-06"` | that colour family's ladder from `build-instructions/texturing/doctrine.json` |
| gradient | `{"gradient": ["#3e2d22", "#9a6b3f"], "axis": "y", "from": 4, "to": 12}` | colour stops turned into a block ladder, ordered-dithered |
| ladder | `{"ladder": ["cobblestone", "andesite", "stone"], "axis": "y"}` | your own ladder, dark to light |
| clusters | `{"ladder": "VAL-01", "axis": "noise", "scale": 4}` | soft clusters of the ladder, never speckle |

Options for gradients and ladders: `axis` x / y / z / radial (`center` [x, z]) / noise; `from`, `to` (default:
the extent of the cells that use the material); `reverse`; `dither` bayer (default) / none; `jitter` 0.04
(hashed band-edge wobble, the roof-gradient value from 06-roof); `noise` 0.1 (low-frequency wobble of the
bands); `blend` 0.5 (share of each step that is a dithered seam: solid bands with a dithered join, so a
wide flat surface does not turn into checkerboard); `tags` (families: stone, terracotta, wood, metal, concrete, wool, natural); `roughness`; `need`
(forms the blocks must have, default slab and stairs); `texture` true / 0.35 / {"share", "with"} (mix each
block at random with a same-colour partner, see Roofs in parts.md; on by default for every house roof, never
for copper).

## The rules the code follows

1. **Perceptual matching.** Colours are compared in OKLab, with hue and chroma weighted 1.6 against
   lightness, because a hue jump between neighbours looks worse than a small value step.
2. **One material family.** A gradient without `tags` picks the family (stone, terracotta, wood...) whose
   blocks fit the whole gradient best; concrete and wool only win when nothing else fits.
3. **No skipped steps.** The gradient is sampled finely and collapsed to a ladder of the nearest blocks;
   cells are dithered only between neighbouring steps (ArdaCraft gradient guide, texturing/README.md).
4. **Ordered dithering.** A 4x4x4 Bayer matrix decides each cell between the two nearest steps, so bands
   blend without random noise and the result is the same on every build.
5. **Partial blocks only from blocks that have them.** Slabs, stairs, walls, fences and trapdoors take the
   nearest block (colour, then roughness) that has that form; the summary says when that happened.
6. **Neighbours keep similar roughness.** A gradient's ladder stays within one roughness class of its
   first block (smooth / medium / rough, tertiles of texture busyness).
7. **Logs, pillars, chiseled and glazed blocks** are left out of colour matching (directional or busy);
   name them as a block to use them.

## The palette

`data/palette.json`: 243 building blocks with average colour (averaged in linear light, sides 2 : top 1),
OKLab, roughness class and score, 4x4 thumbnails of side and top for the preview, which forms exist
(Bedrock and Java ids), plus preview colours for glass, doors, lanterns, leaves and the like.
`data/blocks.json` is the block table it is built from (ids, forms, texture names).

Regenerate from your own textures (no model needed):

    python3 scripts/build_palette.py --bedrock <bedrock-samples>/resource_pack        # Mojang's vanilla Bedrock pack
    python3 scripts/build_palette.py --java ~/.minecraft/versions/1.21.5/1.21.5.jar     # Java client jar
    python3 scripts/build_palette.py --java vanilla.jar --java my_pack.zip              # a resource pack on top

A Java jar also proves which slab / stair / wall ids exist (its blockstates folder). The shipped palette is
from Mojang's bedrock-samples v1.26.60. `scripts/make_block_table.py` rebuilds the block table from the
repo's `map/structures/bedrock_states.json` (repo only, when Mojang adds blocks).

Blocks in the table that may be newer than a world: cinnabar, sulfur, poplar, concrete and wool stairs and
slabs (Bedrock 26.x). Name a `tags` family or a block list if a world is older.
