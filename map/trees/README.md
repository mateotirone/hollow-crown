# Tree assets

Custom block-built trees for the map and towns: each region's real trees, converted to Minecraft style,
built in stages and saved as a database of `.mcstructure` + stamp JSON the world writer can paste.

| File | What it is |
| --- | --- |
| `species.py` | Species cards: region, real tree, blocks (log, bark-on-all-sides wood, matching stone for bark, fence/wall/slab/trapdoor for thin limbs), leaf mix, details, four sizes |
| `grow.py` | The grower: card + size + seed -> Blueprint, in stages (trunk, limbs or conifer whorls, canopy clumps, roots, bark, drape, ground, snow) |
| `build_trees.py` | Builds every species x size x variant, writes `trees.json` (the index) and the 3D previews |
| `ref/` | Mateo's reference pictures |

Build and preview (textures and three.js as in `map/structures/README.md`):

    python3 build_trees.py OUT --variants 6 --render --textures <bedrock-samples>/resource_pack/textures/blocks --three <node_modules/three>

## Rules (from Mateo)

- One species at a time: real tree first, then its Minecraft version, then detail.
- Odd heights and trunk widths (1 or 3, flaring to 5 at the roots) so every tree has a centre.
- Bark depth from a stone that matches the log's colour, picked from the textures (acacia with tuff, pale oak with
  cobbled deepslate, cherry with nether bricks, birch with diorite, oak with mud bricks); woods with no close stone
  (dark oak, spruce, mangrove, jungle) use their own stairs, slabs and trapdoors.
- Limbs step down: logs (bark on all sides) -> walls or slabs -> fences at the tips; trapdoors cling to thin upright limbs.
- Canopy is many clumps at the limb tips with gaps, light leaves on top, dark below, a scattered accent.
- Tree assets placed in the world are unbreakable (for now); settlements get a tree farm for wood.

## Unbreakable tree blocks

`lock.py` swaps every log, bark block, leaf, wall, fence, stair, slab and trapdoor in a finished tree for a
tree-only copy, `siege:old_<vanilla name>` (same vanilla texture; can't be mined or blown up, doesn't burn or
decay). `studio/build_tree_blocks.py` writes those blocks from whatever the species use; rerun it after adding
a species. Previews use the vanilla names; the database (`.mcstructure`, stamps) uses the tree-only ones, so
stamps carry `rotations: [0]` (variants give the variety). `LOCK = False` in `lock.py` goes back to vanilla.

Needs an in-game check: the stair/trapdoor turn direction (`YAW` in build_tree_blocks.py), leaf tint, and that
wall/fence arms show by block state (`bone_visibility` with block-state queries).

## The settlement grove (Forester's Lodge)

The one place trees can be chopped. `build_grove.py` grows three species per settlement style (sapling, young,
mature; two variants) in plain vanilla wood, without `lock.py`, and writes them as
`Siege_Nights_BP/structures/siege_grove/*.mcstructure` plus `scripts/forestry/grove_data.js`. Rerun it after
changing those species. The game side is `scripts/forestry/`: the Lodge block raises a fenced 41 x 29 yard with
2, 4 or 6 plots; chopping the bottom trunk block fells the tree (its logs drop at the stump, 12 to 48), and a
sapling regrows to full size in three days. Test with `/scriptevent siege:forestry_grove [style]`.

## Placing trees (size profiles)

Every tree in `trees.json` carries a size profile (`profile.py`): `offset` (stamp corner from the trunk's ground
cell), `height`, `trunk` (the cells its trunk, roots and knees stand on), `trunk_r`, `rings` (canopy reach at
each height), `low_r` (reach up to 6 blocks) and `crown_r`. `place.py` scatters trees with them:
`scatter(index, region, hard, soft, density, seed)` takes two masks of the area. **hard** (buildings, walls,
towers, wells, stalls): the whole crown stays a block clear, so no branch hangs over a roof or through a wall.
**soft** (roads, paths, rails, bridleways, fields): only the trunk stays off, with a block to spare, so crowns
may shade a road. Big sizes are tried first, then smaller ones of the same species; crowns may touch at
the edges but never another trunk. The map writer and the town generator are meant to call it with their own
masks.
