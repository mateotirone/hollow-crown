# Aldmere Vale (Kingsrest, Millbrook)

Temperate heartland of the old kingdom. English and Norman look: white plaster between dark timber,
grey Norman stone, warm red brick, dark slate and dark shingle roofs, with warm terracotta and the odd
copper roof in the market towns (`reference/pictures/market-town-roofs.png`).

Three styles mix in every Vale town (Mateo, 2026-11-10: "mix all three"): **plaster and timber** for
most houses, **Norman stone** for important buildings, **brick** for some. (`vale.py STYLES`.)

| Role | Colour | Blocks |
|---|---|---|
| footing / plinth | dark grey, rough | `cobblestone` 50, `mossy_cobblestone` 30 (bottom course only), `andesite` 10, `stone_bricks` 10; or `siege:castle_cobbled` |
| stone | mid grey | `stone_bricks` 50, `cobblestone` 14, `cracked_stone_bricks` 10, `andesite` 10, `mossy_stone_bricks` 8 (low), `tuff` 4; dressed: `siege:castle_smooth`, `polished_andesite`; courses `stone_brick_stairs`, `stone_brick_slab` |
| quoin | light grey | `polished_andesite`, `siege:castle_stone` |
| plaster / infill | warm white | `calcite` (default; diorite reads as grey patches), `white_concrete` for a cleaner white; half-timbered panels `siege:timber_frame`, `siege:timber_frame_cross` |
| brick infill | warm red | `brick_block` 85, `mud_bricks` 15 |
| frame | warm mid brown | `stripped_spruce_log` (Mateo approved on the Kingsrest street house, 2026-11-12: dark oak frames under slate read gloomy); `stripped_dark_oak_log` for darker accents |
| trim | dark brown | `dark_oak_stairs`, `dark_oak_slab`, `dark_oak_trapdoor`; brick style `spruce_*` |
| floor | mid brown field, dark border | field `spruce_slab`, border `dark_oak_slab`; stone floors `stone_bricks`, `polished_andesite` |
| glass | see below | |
| door / shutter / fence | | `spruce_door` / `spruce_trapdoor` (about a third of windows) / `dark_oak_fence` |
| light | warm | `lantern` |
| chimney | grey, rough | `stone_bricks` 60, `cobblestone` 25, `cracked_stone_bricks` 15, cap `stone_brick_wall` |
| path | | `grass_path`, `gravel`, `cobblestone`, `coarse_dirt` |
| greenery | | oak and birch trees, azalea, flower beds (poppy, cornflower, dandelion, azure bluet, oxeye daisy, tulips), vines on shady walls |

## Roof colours available

| Colour | Stairs / slab / block |
|---|---|
| Slate (dark grey) | `deepslate_tile_stairs` 88 + `deepslate_brick_stairs` 8 + `cobbled_deepslate_stairs` 4 / `deepslate_tile_slab` / `deepslate_tiles` |
| Dark shingle (brown) | `dark_oak_stairs` / `dark_oak_slab` / `dark_oak_planks` |
| Mid shingle | `spruce_stairs` / `spruce_slab` / `spruce_planks` |
| Warm red (terracotta look) | `brick_stairs`, or `polished_granite_stairs` for an orange-pink / matching slabs / `brick_block`, `polished_granite` |
| White (limewashed) | `smooth_quartz_stairs`, `polished_diorite_stairs` / matching slabs |
| Copper (civic accent) | waxed copper gradient: `waxed_oxidized_cut_copper_stairs`, `waxed_weathered_cut_copper_stairs`, `waxed_exposed_cut_copper_stairs`, `waxed_cut_copper_stairs` |

## Glass (choose per building, not clear everywhere)

| Building | Glass |
|---|---|
| Plaster and timber houses | `brown_stained_glass_pane` (old warm glass) or `light_gray_stained_glass_pane` |
| Stone houses, guildhall | `gray_stained_glass_pane` or `light_gray_stained_glass_pane` |
| Brick houses | `brown_stained_glass_pane` |
| Shop fronts (ground floor) | `glass_pane` |
| Chapel | stained: `red_stained_glass_pane`, `blue_stained_glass_pane`, `yellow_stained_glass_pane` |
| Capital hall | `light_blue_stained_glass_pane` with a stained rose window |

## Shapes

Gable roofs pitch 1 (cottages may bell-cast), jettied town houses, cross wings with gables to the street,
carriage arches, spires on chapels, the capital's domes (`reference/pictures/grand-hall-dome.png`).
