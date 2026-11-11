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
