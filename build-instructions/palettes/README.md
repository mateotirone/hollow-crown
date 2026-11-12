# Palettes

The full style guide of each region (what it is, its theme, buildings, roofs, weather, paths, trees) is in
`.claude/skills/minecraft-builder/regions/`; read it first. Every region has its own full block palette. Blocks are chosen **strictly by colour, whatever the block
is**, as long as a full-block role uses a solid block (Mateo, 2026-11-11). There is no holdback on which
blocks can be used: concrete, terracotta, copper, prismarine, froglights, ice, quartz, any wood. Castle
Stone is one colour option per region, made so each region had a block coloured and textured for it; it
is not required anywhere, and player settlements use the full palette too (Mateo chose "everything free",
2026-11-11).

| Region | Towns and places | File |
|---|---|---|
| Aldmere Vale | Kingsrest (capital), Millbrook | [vale.md](vale.md) |
| Frostmarch | Rimehold (internal id hollowfast), Frosthelm | [frostmarch.md](frostmarch.md) |
| Saltreach | Gull's Rest | [saltreach.md](saltreach.md) |
| Blackfen | Mirelight | [blackfen.md](blackfen.md) |
| Emberwaste | Sunscar | [emberwaste.md](emberwaste.md) |
| The Hollow | Glimwade, Lowseam, Tollrest, Highcut, the centre sites, the drowned city | [hollow.md](hollow.md) |

Roof colour mixes per town: [towns.md](towns.md).

## Roles

Every region file fills the same roles, so a builder can swap regions without changing code:

| Role | What it is | Shape needs |
|---|---|---|
| footing / plinth | the base, darker and rougher than the walls | full block |
| stone | stone walls and ground storeys | full block, plus stairs and slabs in the same colour for courses |
| quoin | corners and dressed edges | full block |
| plaster / infill | the panels between timber | full block |
| frame | posts and beams | log (with axis) |
| trim | sills, brackets, barge boards, eaves, canopies | stairs, slabs, trapdoors |
| floor | floor field and border | slabs (top half) |
| roof | the roof colours available in the region | stairs, slabs and a full block in that colour |
| glass | window options | panes (and full blocks for big hall windows) |
| door, shutter, fence | | door, trapdoor, fence |
| light | lights at doors and under eaves | |
| accent | the colour that makes the region's civic buildings stand out | |
| greenery | plants that belong | |

## Choosing a block by colour

1. Decide the colour the role needs (look at the reference pictures and the region file).
2. Pick any block whose texture reads as that colour at a distance, regardless of what it "is".
3. For roles that need shapes (stairs, slabs, walls), the shape must exist in that block or a block of
   the same colour (for example a white roof: `smooth_quartz_stairs` or `polished_diorite_stairs`; an
   orange roof: `waxed_cut_copper_stairs` or `acacia_stairs`).
4. Check it in the render next to the other blocks of the building. Texture matters as well as colour:
   very busy textures (bricks, some ores, glazed terracotta) only as accents.

## Hard rules

- Full-block roles: solid blocks only (Mateo).
- No blocks that fall (sand, gravel, concrete powder) where they can fall; gravel only as ground paths.
- No blocks that change on their own: use **waxed** copper; no unwaxed copper, no grass blocks inside
  walls, no leaves that decay (placed leaves must be persistent).
- No light-emitting blocks in walls or roofs unless the light is the point (Hollow windows, Mirelight
  froglights).
- Ids are Bedrock ids exactly as in `map/structures/bedrock_states.json` (for example `brick_block`, not
  `bricks`; `hardened_clay` for plain terracotta; `grass_path`). The add-on's own blocks use `siege:`.
