# Frostmarch (Rimehold, Frosthelm)

Cold north. Norse look: dark log frames, plank walls, dark cobbled-deepslate bases, steep shingle roofs
that shed snow, tiered stave halls, dragon-head finials. Small windows. White snow and pale blue ice as
the light colours.

| Role | Colour | Blocks |
|---|---|---|
| footing / plinth | very dark grey | `cobbled_deepslate` 60, `deepslate_bricks` 25, `siege:castle_cobbled_frostmarch` 15 |
| stone | dark blue-grey | `polished_deepslate`, `deepslate_bricks`, `cobbled_deepslate` 55 + `stone_bricks` 25 + `andesite` 20; dressed `siege:castle_smooth_frostmarch`; courses `deepslate_brick_stairs`, `deepslate_brick_slab` |
| quoin | | `polished_deepslate`, `siege:castle_stone_frostmarch` |
| plank infill | mid brown | `spruce_planks` 70, `stripped_spruce_log` 30 (in rows, axis along the wall) |
| plaster / light infill | white | `snow` (snow block), `calcite`, `white_concrete` |
| frame | dark brown | `dark_oak_log`, `spruce_log` |
| trim | | `dark_oak_stairs`, `dark_oak_slab`, `dark_oak_trapdoor`; `spruce_*` on dark oak buildings |
| floor | | field `spruce_slab`, border `dark_oak_slab`; stone `polished_deepslate` |
| gable | | `stripped_spruce_log` (vertical), `spruce_planks` |
| ice accent | pale blue | `packed_ice` (trim courses and finials only, never floors) |
| door / shutter / fence | | `dark_oak_door` / `dark_oak_trapdoor` (none on halls, up to 0.3 on houses) / `dark_oak_fence` |
| light | | `lantern`, `campfire` in hearths |
| chimney | | `deepslate_bricks` 80, `cobbled_deepslate` 20, cap `cobbled_deepslate_wall` |
| path | | `gravel`, `cobbled_deepslate`, `snow_layer` beside paths |
| greenery | | spruce trees, ferns, sweet berry bushes, snow on roofs and ground |

## Roof colours available

| Colour | Stairs / slab / block |
|---|---|
| Dark shingle | `dark_oak_stairs` / `dark_oak_slab` / `dark_oak_planks` |
| Mid shingle | `spruce_stairs` / `spruce_slab` / `spruce_planks` |
| Slate | `deepslate_tile_stairs` / `deepslate_tile_slab` / `deepslate_tiles` |
| Snow-capped | any of the above with `snow_layer` on the ridge and the top rows |
| Weathered copper (civic accent) | `waxed_weathered_cut_copper_stairs`, `waxed_oxidized_cut_copper_stairs` |

## Glass

| Building | Glass |
|---|---|
| Houses | `white_stained_glass_pane` (frosted) |
| Halls, longhouses | `light_blue_stained_glass_pane` |
| Stone towers | 1-wide slits, `iron_bars` or `light_gray_stained_glass_pane` |
| Stave chapel | stained: `cyan_stained_glass_pane`, `blue_stained_glass_pane`, `white_stained_glass_pane` |

## Shapes

Gable roofs pitch 2, skirt roofs round halls, tiered ridge towers, dragon heads on gable peaks
(`settle_halls.dragon_heads`), heavy corner posts, no jetties on halls.
