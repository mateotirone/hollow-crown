#!/usr/bin/env python3
"""Regenerate data/blocks.json: every vanilla building block, its Bedrock and Java ids, which
slab / stairs / wall / fence / trapdoor forms it has, and which texture files show it.

Repo-only maintenance tool (needs map/structures/bedrock_states.json and the mesher's texture
names from the hollow-crown repo). Normal use never runs this: build_palette.py reads the table.

    python3 make_block_table.py            # writes ../data/blocks.json
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(SKILL, "..", "..", ".."))
sys.path.insert(0, os.path.join(REPO, "map", "structures"))
sys.path.insert(0, os.path.join(REPO, "map", "structures", "render"))
from mesher import cube_tex  # noqa: E402

ST = json.load(open(os.path.join(REPO, "map", "structures", "bedrock_states.json")))["blocks"]

# Base blocks worth building with (full, solid, not falling, not functional).
BASES = """acacia_log acacia_planks acacia_wood amethyst_block andesite bamboo_block bamboo_mosaic bamboo_planks
basalt blackstone bone_block brick_block calcite chiseled_cinnabar chiseled_copper chiseled_deepslate
chiseled_nether_bricks chiseled_polished_blackstone chiseled_quartz_block chiseled_red_sandstone chiseled_resin_bricks
chiseled_sandstone chiseled_stone_bricks chiseled_sulfur chiseled_tuff chiseled_tuff_bricks cinnabar cinnabar_bricks clay
coal_block coarse_dirt cobbled_deepslate cobblestone copper_block cracked_deepslate_bricks cracked_deepslate_tiles
cracked_nether_bricks cracked_polished_blackstone_bricks cracked_stone_bricks crimson_hyphae crimson_planks
cut_copper cut_red_sandstone cut_sandstone dark_oak_log dark_oak_planks dark_oak_wood dark_prismarine deepslate
deepslate_bricks deepslate_tiles diorite dirt dripstone_block end_bricks end_stone exposed_chiseled_copper exposed_copper
exposed_cut_copper granite hardened_clay hay_block iron_block jungle_log jungle_planks jungle_wood mangrove_log
mangrove_planks mangrove_wood moss_block mossy_cobblestone mossy_stone_bricks mud_bricks nether_brick netherrack
oak_log oak_planks oak_wood obsidian oxidized_chiseled_copper oxidized_copper oxidized_cut_copper packed_ice packed_mud
pale_moss_block pale_oak_log pale_oak_planks pale_oak_wood polished_andesite polished_basalt polished_blackstone
polished_blackstone_bricks polished_cinnabar polished_deepslate polished_diorite polished_granite polished_sulfur
polished_tuff poplar_log poplar_planks poplar_wood prismarine prismarine_bricks purpur_block purpur_pillar quartz_block
quartz_bricks quartz_pillar raw_copper_block raw_iron_block raw_gold_block red_nether_brick red_sandstone resin_bricks
sandstone smooth_basalt smooth_quartz smooth_red_sandstone smooth_sandstone smooth_stone snow spruce_log spruce_planks
spruce_wood stone stone_bricks stripped_acacia_log stripped_acacia_wood stripped_bamboo_block stripped_birch_log
stripped_birch_wood stripped_cherry_log stripped_cherry_wood stripped_crimson_hyphae stripped_dark_oak_log
stripped_dark_oak_wood stripped_jungle_log stripped_jungle_wood stripped_mangrove_log stripped_mangrove_wood
stripped_oak_log stripped_oak_wood stripped_pale_oak_log stripped_pale_oak_wood stripped_poplar_log stripped_poplar_wood
stripped_spruce_log stripped_spruce_wood stripped_warped_hyphae sulfur sulfur_bricks tuff tuff_bricks warped_hyphae
warped_planks warped_wart_block weathered_chiseled_copper weathered_copper weathered_cut_copper birch_log birch_planks
birch_wood cherry_log cherry_planks cherry_wood blue_ice nether_wart_block
""".split()
for _o in ("", "exposed_", "weathered_", "oxidized_"):     # waxed copper never changes in game (06-roof: copper roofs)
    BASES += [f"waxed_{_o}cut_copper", f"waxed_{_o}copper" if _o else "waxed_copper", f"waxed_{_o}chiseled_copper"]
COLOURS = "white orange magenta light_blue yellow lime pink gray light_gray cyan purple blue brown green red black".split()
for c in COLOURS:
    BASES += [f"{c}_concrete", f"{c}_terracotta", f"{c}_wool", ("silver" if c == "light_gray" else c) + "_glazed_terracotta"]

# Bedrock id -> Java id where they differ
JAVA_ID = {"brick_block": "bricks", "hardened_clay": "terracotta", "nether_brick": "nether_bricks", "red_nether_brick": "red_nether_bricks",
           "end_bricks": "end_stone_bricks", "snow": "snow_block", "silver_glazed_terracotta": "light_gray_glazed_terracotta"}
# Bedrock variant ids that the generic rule misses
VAR_OVERRIDE = {
    "stone": {"slab": "normal_stone_slab", "stairs": "normal_stone_stairs"},
    "cobblestone": {"stairs": "stone_stairs"},
    "end_bricks": {"slab": "end_stone_brick_slab", "stairs": "end_brick_stairs", "wall": "end_stone_brick_wall"},
    "prismarine_bricks": {"stairs": "prismarine_bricks_stairs"},
    "nether_brick": {"fence": "nether_brick_fence"},
    "oak_planks": {"trapdoor": "trapdoor"},
    "copper_block": {"trapdoor": "copper_trapdoor"}, "waxed_copper": {"trapdoor": "waxed_copper_trapdoor"},
    "waxed_exposed_copper": {"trapdoor": "waxed_exposed_copper_trapdoor"}, "waxed_weathered_copper": {"trapdoor": "waxed_weathered_copper_trapdoor"},
    "waxed_oxidized_copper": {"trapdoor": "waxed_oxidized_copper_trapdoor"}, "exposed_copper": {"trapdoor": "exposed_copper_trapdoor"},
    "weathered_copper": {"trapdoor": "weathered_copper_trapdoor"}, "oxidized_copper": {"trapdoor": "oxidized_copper_trapdoor"},
    "iron_block": {"trapdoor": "iron_trapdoor"},
}
# Bedrock variant id -> Java id where they differ
JAVA_VAR = {"normal_stone_slab": "stone_slab", "normal_stone_stairs": "stone_stairs", "stone_stairs": "cobblestone_stairs",
            "end_brick_stairs": "end_stone_brick_stairs", "prismarine_bricks_stairs": "prismarine_brick_stairs", "trapdoor": "oak_trapdoor"}
NOT_IN_JAVA = ("concrete_slab", "concrete_stairs", "wool_slab", "wool_stairs")    # Bedrock 26.x extras


def stem(b):
    s = b
    for a, z in (("_planks", ""), ("_bricks", "_brick"), ("_tiles", "_tile"), ("_block", "")):
        if s.endswith(a): s = s[: -len(a)] + z; break
    return s


def variants(b):
    out = {}
    s = stem(b)
    for kind in ("slab", "stairs", "wall", "fence", "trapdoor"):
        cand = VAR_OVERRIDE.get(b, {}).get(kind)
        if not cand:
            for c in (f"{s}_{kind}", f"{b}_{kind}"):
                if c in ST: cand = c; break
        if cand and cand in ST:
            j = JAVA_VAR.get(cand, cand)
            if j.startswith("brick_block"): j = j.replace("brick_block", "brick")
            out[kind] = {"bedrock": cand, "java": None if any(cand.endswith(x) for x in NOT_IN_JAVA) else j}
    return out


def tags(b):
    t = []
    if b.endswith("_planks") or b.endswith("_log") or b.endswith("_wood") or b.endswith("hyphae") or "bamboo" in b: t.append("wood")
    elif b.endswith("_concrete"): t.append("concrete")
    elif b.endswith("_wool"): t.append("wool")
    elif "glazed" in b: t.append("pattern")
    elif b.endswith("terracotta") or b == "hardened_clay": t.append("terracotta")
    elif "copper" in b: t.append("metal")
    elif b in ("iron_block", "raw_iron_block", "raw_copper_block", "raw_gold_block", "coal_block"): t.append("metal")
    elif b in ("dirt", "coarse_dirt", "moss_block", "pale_moss_block", "clay", "snow", "packed_ice", "blue_ice", "hay_block",
               "netherrack", "nether_wart_block", "warped_wart_block"): t.append("natural")
    else: t.append("stone")
    if b.startswith("chiseled_") or b in ("quartz_pillar", "purpur_pillar", "bone_block", "hay_block") or "glazed" in b: t.append("feature")
    if b.endswith("_log") or b.endswith("_pillar") or b in ("basalt", "polished_basalt", "bone_block", "hay_block", "deepslate", "bamboo_block", "stripped_bamboo_block") \
            or b.endswith("hyphae") or b.endswith("_wood"): t.append("axis")
    return t


def java_tex(j, b):
    """Java texture names (assets/minecraft/textures/block/<name>.png), side first then top."""
    special = {"smooth_sandstone": ["sandstone_top"], "smooth_red_sandstone": ["red_sandstone_top"], "smooth_quartz": ["quartz_block_bottom"],
               "smooth_stone": ["smooth_stone"], "quartz_block": ["quartz_block_side", "quartz_block_top"],
               "snow_block": ["snow"], "sandstone": ["sandstone", "sandstone_top"], "red_sandstone": ["red_sandstone", "red_sandstone_top"],
               "cut_sandstone": ["cut_sandstone", "sandstone_top"], "cut_red_sandstone": ["cut_red_sandstone", "red_sandstone_top"]}
    if j in special: return special[j]
    if j.endswith("_wood") or j.endswith("_hyphae"):
        return [j.replace("_wood", "_log").replace("_hyphae", "_stem")]
    if j.endswith("_log") or j.endswith("_pillar") or j in ("basalt", "polished_basalt", "bone_block", "hay_block", "deepslate", "bamboo_block", "stripped_bamboo_block"):
        return [j if not j.startswith("polished_basalt") and not j == "basalt" else j + "_side", j + "_top"] if j not in ("bone_block", "hay_block") else [j + "_side", j + "_top"]
    return [j]


def main():
    rows = []
    for b in sorted(set(BASES)):
        if b not in ST: print("skip (not a Bedrock block):", b); continue
        try: ct = cube_tex(b, {})
        except Exception: ct = {}
        side, top = ct.get("side", b), ct.get("top", ct.get("side", b))
        tex_b = [x for x in dict.fromkeys([side, top]) if x]
        j = JAVA_ID.get(b, b)
        rows.append({"id": b, "java": j, "tags": tags(b), "variants": variants(b),
                     "tex": {"bedrock": tex_b, "java": java_tex(j, b)}})
    out = {"about": "Building blocks for the minecraft-builder skill. Ids are Bedrock; 'java' is the Java id. "
                    "Variants checked against Mojang's Bedrock block list (map/structures/bedrock_states.json). "
                    "Regenerate with scripts/make_block_table.py (repo only).",
           "blocks": rows}
    p = os.path.join(SKILL, "data", "blocks.json")
    json.dump(out, open(p, "w"), indent=0, separators=(",", ":"))
    nv = sum(1 for r in rows if r["variants"])
    print(f"{len(rows)} blocks, {nv} with partial forms -> {p}")


if __name__ == "__main__":
    main()
