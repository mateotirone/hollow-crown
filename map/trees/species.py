"""Species cards: one per real tree, converted to Minecraft blocks.

Every card says what the tree is (region, real species, form), which blocks build it (log, bark-on-all-sides
wood for limbs, matching wall/stairs for bark depth, fence for twigs, slab and trapdoor for thin limbs),
the leaf mix (main, light on top, dark below, a scattered accent), detail stages (roots, drape, ground,
snow), and the four sizes: sapling, young, mature, ancient. Heights are odd so every tree has a centre.

Matching stone for bark is picked by colour from the textures (README "Colour matching").
"""

SIZES = ["sapling", "young", "mature", "ancient"]

CARDS = {
    # ---------------------------------------------------------------- Aldmere Vale
    "vale_great_oak": {
        "id": "vale_great_oak", "region": "vale", "name": "Great Oak", "real": "English oak, wide and weeping (Mateo's willow-oak picture)",
        "form": "broadleaf",
        "wood": {"log": "dark_oak_log", "wood": "dark_oak_wood", "wall": "dark_oak_fence", "slab": "dark_oak_slab",
                 "fence": "dark_oak_fence", "trapdoor": "dark_oak_trapdoor"},
        "bark": {"wall": "mud_brick_wall", "stairs": "dark_oak_stairs"},
        "root_stairs": "dark_oak_stairs", "root_ground": "dirt_with_roots",
        "leaves": {"main": "dark_oak_leaves", "light": "oak_leaves", "accent": "azalea_leaves", "accent_p": 0.05},
        "drape": {"p": 0.24, "len": 4, "vines": 0.35},
        "ground": [("coarse_dirt", 3), ("podzol", 2), ("dirt_with_roots", 1)],
        "litter": {"block": "leaf_litter", "p": 0.05},
        "knots": 0.15, "trapdoors": 0.2,
        "sizes": {
            "sapling": {"h": 5, "trunk": 0.6, "r0": 0.4, "r1": 0.3, "limbs": 2, "reach": 1.6, "clump": 1.6, "depth": 0, "flat": 0.8, "roots": 0, "ground_r": 1},
            "young":   {"h": 9, "trunk": 0.55, "r0": 0.5, "r1": 0.4, "limbs": 3, "reach": 3.2, "clump": 2.2, "depth": 1, "roots": 0, "ground_r": 2, "split": 0.6},
            "mature":  {"h": 15, "trunk": 0.5, "r0": 1.05, "r1": 0.5, "flare": 0.3, "limbs": 5, "reach": 6.5, "clump": 2.3, "depth": 2, "fork": 0.6, "roots": 4,
                        "root_len": 2.5, "ground_r": 3.5, "split": 0.55, "elev": (15, 45), "wander": 0.2},
            "ancient": {"h": 21, "trunk": 0.45, "r0": 1.6, "r1": 0.7, "flare": 0.6, "limbs": 7, "reach": 10.0, "clump": 2.6, "depth": 3, "fork": 0.55, "trunk": 0.5, "roots": 6,
                        "root_len": 3.5, "ground_r": 5, "split": 0.5, "elev": (10, 40), "wander": 0.25, "lean": 0.08},
        },
    },
    # ---------------------------------------------------------------- Frostmarch
    "frost_tall_spruce": {
        "id": "frost_tall_spruce", "region": "frostmarch", "name": "Tall Spruce", "real": "Norway spruce, bare lower trunk and tiered crown (Mateo's picture)",
        "form": "conifer",
        "wood": {"log": "spruce_log", "wood": "spruce_wood", "wall": "spruce_fence", "fence": "spruce_fence", "trapdoor": "dark_oak_trapdoor"},
        "bark": {"wall": "cobbled_deepslate_wall", "stairs": "dark_oak_stairs"},
        "root_stairs": "dark_oak_stairs", "root_ground": "podzol",
        "leaves": {"main": "spruce_leaves", "light": "spruce_leaves", "dark": "dark_oak_leaves", "accent": "oak_leaves", "accent_p": 0.04},
        "ground": [("podzol", 3), ("coarse_dirt", 1), ("dirt_with_roots", 1)],
        "snow": 0.3, "knots": 0.1, "trapdoors": 0.1,
        "sizes": {
            "sapling": {"h": 5, "trunk": 0.4, "r0": 0.4, "r1": 0.3, "crown": 0.4, "reach": 1.2, "whorl": 1.3, "arms": 4, "pad": 0.8, "spire": 1, "ground_r": 1, "disc": 0.8},
            "young":   {"h": 11, "trunk": 0.5, "r0": 0.5, "r1": 0.4, "crown": 0.35, "reach": 2.6, "whorl": 2.0, "arms": 4, "pad": 1.1, "ground_r": 2, "disc": 0.7},
            "mature":  {"h": 19, "trunk": 0.6, "r0": 1.05, "r1": 0.5, "flare": 0.3, "crown": 0.45, "reach": 4.2, "whorl": 2.4, "arms": 5, "pad": 1.3, "disc": 0.75,
                        "roots": 4, "root_len": 2.0, "ground_r": 3, "droop": 0.3},
            "ancient": {"h": 27, "trunk": 0.6, "r0": 1.5, "r1": 0.6, "flare": 0.5, "crown": 0.55, "reach": 5.5, "whorl": 2.6, "arms": 6, "pad": 1.4, "disc": 0.75,
                        "roots": 6, "root_len": 3.0, "ground_r": 4, "droop": 0.35, "spire": 3},
        },
    },
    "frost_grey_fir": {
        "id": "frost_grey_fir", "region": "frostmarch", "name": "Grey Fir", "real": "silver fir, grey bark, drooping skirts (Mateo's acacia + tuff picture)",
        "form": "conifer",
        "wood": {"log": "acacia_log", "wood": "acacia_wood", "wall": "tuff_wall", "fence": "tuff_wall", "trapdoor": "acacia_trapdoor"},
        "bark": {"wall": "tuff_wall", "stairs": "tuff_stairs"},
        "root_stairs": "tuff_stairs", "root_ground": "coarse_dirt",
        "leaves": {"main": "oak_leaves", "light": "azalea_leaves", "dark": "spruce_leaves", "accent": "azalea_leaves", "accent_p": 0.1},
        "ground": [("coarse_dirt", 2), ("podzol", 2), ("moss_block", 1)],
        "knots": 0.08, "trapdoors": 0.0,
        "sizes": {
            "sapling": {"h": 5, "trunk": 0.4, "r0": 0.4, "r1": 0.3, "crown": 0.35, "reach": 1.2, "whorl": 1.3, "arms": 4, "pad": 1.0, "spire": 1, "ground_r": 1},
            "young":   {"h": 13, "trunk": 0.35, "r0": 0.5, "r1": 0.4, "crown": 0.25, "reach": 3.0, "whorl": 1.8, "arms": 4, "pad": 1.1, "ground_r": 2, "droop": 0.4},
            "mature":  {"h": 21, "trunk": 0.4, "r0": 1.05, "r1": 0.5, "flare": 0.3, "crown": 0.28, "reach": 5.0, "whorl": 2.4, "arms": 5, "pad": 1.3,
                        "roots": 4, "root_len": 2.0, "ground_r": 3, "droop": 0.55, "bark_wall": 0.2},
            "ancient": {"h": 29, "trunk": 0.4, "r0": 1.5, "r1": 0.6, "flare": 0.5, "crown": 0.3, "reach": 6.5, "whorl": 2.8, "arms": 6, "pad": 1.5,
                        "roots": 6, "root_len": 3.0, "ground_r": 4, "droop": 0.6, "spire": 3, "bark_wall": 0.22, "bark_h": 0.9},
        },
    },
}
