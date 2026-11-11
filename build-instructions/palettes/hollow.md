# The Hollow

A separate world seeping into ours, not a mirror. Its buildings are their own: dark veinstone and
blackstone, black timber with pale ash between, steep deepslate roofs, warm lit windows in the miners'
homes, soul light elsewhere. Nothing stands quite straight: an upper storey or the roof sits one block off true, like the
drowned city of leaning towers (`map/structures/hollow_kit.py`). Uneasy, never horror.

| Role | Colour | Blocks |
|---|---|---|
| footing / plinth | black-grey | `cobbled_deepslate` 70, `siege:veinstone` 30 (never leans) |
| stone | dark purple-grey | `siege:veinstone_bricks` 74, `siege:cracked_veinstone_bricks` 14, `polished_blackstone_bricks` 12 |
| quoin | black | `polished_blackstone`, `polished_blackstone_bricks` |
| infill | pale grey-white | `siege:pale_ash` |
| frame | black-brown | `dark_oak_log` |
| trim | | `dark_oak_stairs`, `dark_oak_slab`, `dark_oak_trapdoor`; sills `polished_blackstone_brick_stairs` |
| floor | | field `dark_oak_slab`, border `polished_blackstone_bricks` |
| windows | warm or cold light | `ochre_froglight` in miners' homes; soul lanterns behind `iron_bars` elsewhere |
| accent (the Crown's colours) | dark purple, magenta, blue | `crying_obsidian`, `amethyst_block`, `purpur_block` used sparingly at the Seat and Morvane's sites only |
| door / shutter / fence | | `dark_oak_door` / `dark_oak_trapdoor` (0.25) / `dark_oak_fence` |
| light | | `soul_lantern`, `ochre_froglight`, `siege:glimbulb` |
| chimney | | `polished_blackstone_bricks` 70, `cobbled_deepslate` 30, cap `cobbled_deepslate_wall` |
| path | | `coarse_dirt` 60, `cobbled_deepslate` 25, `siege:pale_ash` 15 |
| greenery | | `siege:veilcap`, `siege:undertow_moss`, glow lichen; along the light rivers `siege:glimmerflow` |

## Roof colours available

| Colour | Stairs / slab / block |
|---|---|
| Deepslate | `deepslate_tile_stairs` 84 + `cobbled_deepslate_stairs` 16 / `deepslate_tile_slab` / `deepslate_tiles` |
| Blackstone | `polished_blackstone_brick_stairs` / `polished_blackstone_brick_slab` / `polished_blackstone_bricks` |

## Shapes

Steep gables (pitch 2). Crookedness is a **single one-block offset** of a whole upper storey or of the
roof, never a gradual shear (one block every few rows renders jagged). The plinth and ground storey stay
true; the offset storey's posts still sit on the beam below. The drowned city's towers lean as whole
towers on the same rule: few, clean steps, not a staircase of single-block shifts.
