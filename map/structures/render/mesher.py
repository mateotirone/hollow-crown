import math
"""Turn a logical blueprint (bp.Blueprint.save_logical) into textured meshes for the
preview renderer, using Mojang's own Bedrock block textures.

    python3 mesher.py scene.json textures_dir out.json

Blocks get their real shapes (stairs, slabs, fences, walls, panes, trapdoors, doors,
lanterns, plants), faces hidden by solid neighbours are dropped, and full cubes get
Minecraft-style ambient occlusion in their vertex colours.
"""
import sys, os, json, math
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bp import solid_full, is_fence, is_wall, is_pane, is_stairs, is_slab, DIRS

GRASS = (0x91, 0xBD, 0x59); FOLIAGE = (0x6A, 0x9E, 0x3A); SPRUCE = (0x61, 0x99, 0x61)
WOODS = {"oak": "oak", "spruce": "spruce", "dark_oak": "big_oak", "birch": "birch", "jungle": "jungle", "acacia": "acacia", "mangrove": "mangrove",
         "cherry": "cherry", "pale_oak": "pale_oak", "warped": "warped"}
# Bedrock names some newer textures differently from the old pattern
TEX_ALIAS = {"chiseled_deepslate": "deepslate/chiseled_deepslate", "chiseled_red_sandstone": "red_sandstone_carved", "deepslate": "deepslate/deepslate",
             "planks_mangrove": "mangrove_planks", "log_mangrove": "mangrove_log_side", "log_mangrove_top": "mangrove_log_top",
             "stripped_mangrove_log": "stripped_mangrove_log_side",
             "door_mangrove_lower": "mangrove_door_bottom", "door_big_oak_lower": "door_dark_oak_lower", "door_big_oak_upper": "door_dark_oak_upper", "door_mangrove_upper": "mangrove_door_top",
             "log_cherry": "cherry_log_side", "log_cherry_top": "cherry_log_top", "stripped_cherry_log": "stripped_cherry_log_side",
             "log_pale_oak": "pale_oak_log_side", "log_pale_oak_top": "pale_oak_log_top", "stripped_pale_oak_log": "stripped_pale_oak_log_side",
             "planks_cherry": "cherry_planks", "planks_pale_oak": "pale_oak_planks",
             "planks_warped": "huge_fungus/warped_planks", "door_warped_lower": "huge_fungus/warped_door_lower", "door_warped_upper": "huge_fungus/warped_door_top", "trapdoor_warped": "huge_fungus/warped_trapdoor", "warped_trapdoor": "huge_fungus/warped_trapdoor"}

# The add-on's own blocks (siege:*): texture from the behaviour pack's material instances and the
# resource pack's terrain_texture.json, as absolute paths.
_REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
_SIEGE = None
def siege_tex(n):
    global _SIEGE
    if _SIEGE is None:
        import glob, re
        _SIEGE = {}
        try:
            raw = open(os.path.join(_REPO, "Siege_Nights_RP/textures/terrain_texture.json")).read()
            td = json.loads(re.sub(r"(?m)^\s*//.*$", "", raw))["texture_data"]
            for f in glob.glob(os.path.join(_REPO, "Siege_Nights_BP/blocks/**/*.json"), recursive=True):
                try: b = json.load(open(f))["minecraft:block"]
                except Exception: continue
                mi = b.get("components", {}).get("minecraft:material_instances", {})
                out = {}
                for face, v in mi.items():
                    if not isinstance(v, dict) or v.get("texture") not in td: continue
                    t = td[v["texture"]]["textures"]; t = t[0] if isinstance(t, list) else t
                    if isinstance(t, dict): t = t.get("path") or t["variations"][0]["path"]
                    out[face] = os.path.join(_REPO, "Siege_Nights_RP", t)
                if out: _SIEGE[b["description"]["identifier"]] = out
        except Exception as e: print("siege textures:", e)
    t = _SIEGE.get(n, {})
    d = {"side": t.get("*") or t.get("side") or next(iter(t.values()), "stone")}
    for f in ("up", "down"):
        if f in t: d["top" if f == "up" else "bottom"] = t[f]
    for f in ("north", "south", "east", "west"):
        if f in t and "side" not in t and "*" not in t: d["side"] = t[f]
    return d

_SGEO = {}
def _siege_block(n):
    if n not in _SGEO:
        import glob
        _SGEO[n] = {}
        for f in glob.glob(os.path.join(_REPO, "Siege_Nights_BP/blocks/**/*.json"), recursive=True):
            try: b = json.load(open(f))["minecraft:block"]
            except Exception: continue
            if b["description"]["identifier"] == n: _SGEO[n] = b.get("components", {}); break
    return _SGEO[n]
def siege_geo(n):
    g = _siege_block(n).get("minecraft:geometry"); return g if isinstance(g, str) else (g or {}).get("identifier")
def siege_cutout(n):
    return any(isinstance(v, dict) and v.get("render_method") in ("alpha_test", "blend") for v in _siege_block(n).get("minecraft:material_instances", {}).values())


# The add-on's own blocks with their own 3D shape (Siege_Nights_RP/models/blocks/*.geo.json): drawn from
# their cubes, each cube in its material instance's texture, turned so the model's front (-z) faces "facing".
# Rotated cubes are left out, and bone_visibility is read for the block's default states.
_SGEOS = None
def _siege_geos():
    global _SGEOS
    if _SGEOS is None:
        import glob
        _SGEOS = {}
        for f in glob.glob(os.path.join(_REPO, "Siege_Nights_RP/models/blocks/**/*.json"), recursive=True):
            try: gs = json.load(open(f)).get("minecraft:geometry", [])
            except Exception: continue
            for g in gs: _SGEOS[g["description"]["identifier"]] = g
    return _SGEOS
def _siege_states(n):
    import glob
    for f in glob.glob(os.path.join(_REPO, "Siege_Nights_BP/blocks/**/*.json"), recursive=True):
        try: b = json.load(open(f))["minecraft:block"]
        except Exception: continue
        if b["description"]["identifier"] == n:
            return {k: (v[0] if isinstance(v, list) else 0) for k, v in b["description"].get("states", {}).items()}
    return {}
def siege_model(n, p):
    import re
    g = _siege_block(n).get("minecraft:geometry")
    gid = g if isinstance(g, str) else (g or {}).get("identifier")
    geo = _siege_geos().get(gid)
    if not geo: return None
    vis = (g or {}).get("bone_visibility", {}) if isinstance(g, dict) else {}
    st = _siege_states(n); st.update(p.get("raw", {}))
    def shown(bone):
        ex = vis.get(bone, True)
        if isinstance(ex, bool): return ex
        py = re.sub(r"q(?:uery)?\.block_state\('([^']+)'\)", lambda m: repr(st.get(m.group(1), 0)), ex)
        py = py.replace("&&", " and ").replace("||", " or ").replace("!=", "<>").replace("!", " not ").replace("<>", "!=")
        try: return bool(eval(py, {"true": True, "false": False}))
        except Exception: return True
    tex = siege_tex(n)
    mats = {}
    td = None
    for k, v in _siege_block(n).get("minecraft:material_instances", {}).items():
        if not isinstance(v, dict): continue
        if td is None:
            try: td = json.loads(re.sub(r"(?m)^\s*//.*$", "", open(os.path.join(_REPO, "Siege_Nights_RP/textures/terrain_texture.json")).read()))["texture_data"]
            except Exception: td = {}
        t = td.get(v.get("texture"), {}).get("textures")
        t = t[0] if isinstance(t, list) else t
        if isinstance(t, dict): t = t.get("path")
        if t: mats[k] = {"side": os.path.join(_REPO, "Siege_Nights_RP", t)}
    f = p.get("facing") or {"north": "n", "south": "s", "east": "e", "west": "w"}.get(p.get("raw", {}).get("minecraft:cardinal_direction"), "n")
    def turn(x, z):
        return {"n": (x, z), "s": (1 - x, 1 - z), "e": (1 - z, x), "w": (z, 1 - x)}[f]
    out = []
    for bone in geo.get("bones", []):
        if not shown(bone.get("name")): continue
        for c in bone.get("cubes", []):
            if c.get("rotation") and any(c["rotation"]): continue
            o, sz = c["origin"], c["size"]
            x0, x1 = (o[0] + 8) / 16, (o[0] + sz[0] + 8) / 16
            z0, z1 = (o[2] + 8) / 16, (o[2] + sz[2] + 8) / 16
            y0, y1 = o[1] / 16, (o[1] + sz[1]) / 16
            if sz[0] < 0.05 or sz[1] < 0.05 or sz[2] < 0.05: continue
            ax, az = turn(x0, z0); bx, bz = turn(x1, z1)
            uv = c.get("uv") if isinstance(c.get("uv"), dict) else {}
            mname = next((v.get("material_instance") for v in uv.values() if isinstance(v, dict) and v.get("material_instance")), "*")
            out.append(((min(ax, bx), y0, min(az, bz), max(ax, bx), y1, max(az, bz)), mats.get(mname) or mats.get("*") or tex, {}))
    return out or None

def wood_of(n):
    for w in sorted(WOODS, key=len, reverse=True):
        if n.startswith(w + "_") or n.startswith("stripped_" + w): return w
    return None

# material name -> texture of a full block of it (for stairs, slabs, walls)
MAT = {"stone_brick": "stonebrick", "stone_bricks": "stonebrick", "mossy_stone_brick": "stonebrick_mossy", "mossy_stone_bricks": "stonebrick_mossy",
       "cracked_stone_bricks": "stonebrick_cracked", "chiseled_stone_bricks": "stonebrick_carved", "cobblestone": "cobblestone", "stone": "cobblestone",
       "mossy_cobblestone": "cobblestone_mossy", "andesite": "stone_andesite", "polished_andesite": "stone_andesite_smooth",
       "deepslate_tile": "deepslate/deepslate_tiles", "deepslate_tiles": "deepslate/deepslate_tiles", "deepslate_brick": "deepslate/deepslate_bricks",
       "deepslate_bricks": "deepslate/deepslate_bricks", "cobbled_deepslate": "deepslate/cobbled_deepslate", "polished_deepslate": "deepslate/polished_deepslate",
       "brick": "brick", "brick_block": "brick", "mud_brick": "mud_bricks", "mud_bricks": "mud_bricks", "packed_mud": "packed_mud",
       "calcite": "calcite", "tuff": "tuff", "tuff_brick": "tuff_bricks", "tuff_bricks": "tuff_bricks", "smooth_stone": "stone_slab_top",
       "gravel": "gravel", "dirt": "dirt", "coarse_dirt": "coarse_dirt", "glass": "glass", "sandstone": "sandstone_normal", "smooth_sandstone": "sandstone_top",
       "diorite": "stone_diorite", "polished_diorite": "stone_diorite_smooth", "granite": "stone_granite", "polished_granite": "stone_granite_smooth", "mud": "mud", "clay": "clay", "snow": "snow",
       "cut_sandstone": "sandstone_smooth", "chiseled_sandstone": "sandstone_carved", "sand": "sand", "red_sand": "red_sand",
       "hardened_clay": "hardened_clay", "packed_ice": "ice_packed", "red_sandstone": "red_sandstone_normal", "smooth_red_sandstone": "red_sandstone_top",
       "cut_red_sandstone": "red_sandstone_smooth", "prismarine_bricks": "prismarine_bricks", "polished_tuff": "polished_tuff",
       "smooth_stone_slab": "stone_slab_top", "normal_stone": "stone", "stone_block": "stone",
       "quartz": "quartz_block_side", "quartz_block": "quartz_block_side", "smooth_quartz": "quartz_block_bottom", "quartz_bricks": "quartz_bricks",
       "dark_prismarine": "prismarine_dark", "prismarine": "prismarine_rough", "gold_block": "gold_block", "snow_layer": "snow", "moss_block": "moss_block", "polished_blackstone_brick": "polished_blackstone_bricks", "polished_blackstone": "polished_blackstone", "blackstone": "blackstone",
       "blast_furnace": "blast_furnace_side", "cobbled_deepslate_wall": "deepslate/cobbled_deepslate",
       "chiseled_red_sandstone": "red_sandstone_carved", "chiseled_deepslate": "deepslate/chiseled_deepslate", "cracked_deepslate_bricks": "deepslate/cracked_deepslate_bricks"}
for w, t in WOODS.items(): MAT[w] = "planks_" + t; MAT[w + "_planks"] = "planks_" + t
for _c in ("", "exposed_", "weathered_", "oxidized_"):          # copper roofs (waxed looks the same)
    MAT[_c + "cut_copper"] = MAT["waxed_" + _c + "cut_copper"] = _c + "cut_copper"

def base_material(n):
    for suf in ("_stairs", "_slab", "_wall", "_fence"):
        if n.endswith(suf): n = n[: -len(suf)]; break
    if n.startswith("waxed_"): n = n[6:]
    if n.endswith("copper") and "_" not in n.replace("_cut_copper", "").replace("_copper", "").replace("cut_copper", "x"):
        return {"copper": "copper_block", "double_cut_copper": "cut_copper"}.get(n, n.replace("double_", ""))
    if n == "stone" : return "cobblestone"     # Bedrock: stone_stairs are cobblestone stairs
    if n == "normal_stone": return "stone"
    if n == "smooth_stone": return "stone_slab_top"
    if n in MAT: return MAT[n]
    if n.endswith("_wool"): return "wool_colored_" + n[:-5].replace("light_gray", "silver")      # wool and concrete stairs/slabs (2026 drop)
    if n.endswith("_concrete"): return "concrete_" + n[:-9].replace("light_gray", "silver")
    w = wood_of(n)
    if w: return "planks_" + WOODS[w]
    return None

def cube_tex(n, p):
    """face -> texture key ('top','bottom','side' / per face)."""
    if n.startswith("siege:"): return siege_tex(n)
    if n == "stone": return {"side": "stone"}          # plain stone, not cobblestone
    if n == "tuff_bricks": return {"side": "tuff_bricks"}
    w = wood_of(n)
    if n.endswith("_log") and n.startswith("stripped_"):
        return {"top": f"stripped_{w}_log_top", "side": f"stripped_{w}_log"}
    if n.endswith("_wood"):   # bark on every face
        return {"side": f"stripped_{w}_log" if n.startswith("stripped_") else f"log_{WOODS[w]}"}
    if n.endswith("_log") or n.endswith("_wood"):
        t = WOODS[w]; return {"top": f"log_{t}_top", "side": f"log_{t}" if not n.endswith("_wood") else f"log_{t}"}
    simple = {"pumpkin": {"top": "pumpkin_top", "side": "pumpkin_side"},
              "grass_block": {"top": "grass_top#grass", "bottom": "dirt", "side": "grass_side_carried"},
              "podzol": {"top": "dirt_podzol_top", "bottom": "dirt", "side": "dirt_podzol_side"},
              "ochre_froglight": {"top": "ochre_froglight_top", "bottom": "ochre_froglight_top", "side": "ochre_froglight_side"},
              "verdant_froglight": {"top": "verdant_froglight_top", "bottom": "verdant_froglight_top", "side": "verdant_froglight_side"},
              "mangrove_roots": {"top": "mangrove_roots_top", "side": "mangrove_roots_side"},
              "quartz_pillar": {"top": "quartz_block_lines_top", "bottom": "quartz_block_lines_top", "side": "quartz_block_lines"},
              "chiseled_quartz_block": {"top": "quartz_block_chiseled_top", "bottom": "quartz_block_chiseled_top", "side": "quartz_block_chiseled"},
              "smithing_table": {"top": "smithing_table_top", "bottom": "smithing_table_bottom", "side": "smithing_table_side", "front": "smithing_table_front"},
              "basalt": {"top": "basalt_top", "bottom": "basalt_top", "side": "basalt_side"},
              "polished_basalt": {"top": "polished_basalt_top", "bottom": "polished_basalt_top", "side": "polished_basalt_side"},
              "grass_path": {"top": "grass_path_top", "bottom": "dirt", "side": "grass_path_side"},
              "hay_block": {"top": "hay_block_top", "side": "hay_block_side"},
              "farmland": {"top": "farmland_wet", "side": "dirt", "bottom": "dirt"},
              "barrel": {"top": "barrel_top", "bottom": "barrel_bottom", "side": "barrel_side"},
              "crafting_table": {"top": "crafting_table_top", "side": "crafting_table_side", "bottom": "planks_oak"},
              "oak_leaves": {"side": "leaves_oak.tga#foliage"}, "spruce_leaves": {"side": "leaves_spruce.tga#spruce"},
              "dark_oak_leaves": {"side": "leaves_big_oak.tga#foliage"}, "birch_leaves": {"side": "leaves_birch.tga#birch"},
              "azalea_leaves": {"side": "azalea_leaves"}, "acacia_leaves": {"side": "leaves_acacia.tga#foliage"},
              "jungle_leaves": {"side": "leaves_jungle.tga#foliage"}, "mangrove_leaves": {"side": "mangrove_leaves.tga#foliage"},
              "cherry_leaves": {"side": "cherry_leaves.tga"}, "pale_oak_leaves": {"side": "pale_oak_leaves.tga"},
              "mangrove_roots": {"side": "mangrove_roots_side", "top": "mangrove_roots_top"},
              "muddy_mangrove_roots": {"side": "muddy_mangrove_roots_side", "top": "muddy_mangrove_roots_top"},
              "dirt_with_roots": {"side": "dirt_with_roots"}, "mud": {"side": "mud"}, "snow": {"side": "snow"}, "azalea_leaves_flowered": {"side": "azalea_leaves_flowers"},
              "water": {"side": "water_still_grey#water"}, "glass": {"side": "glass"},
              "composter": {"top": "composter_top", "side": "composter_side", "bottom": "composter_bottom"},
              "smooth_stone": {"top": "stone_slab_top", "side": "stone_slab_side"},
              "bookshelf": {"top": "planks_oak", "side": "bookshelf"},
              "furnace": {"top": "furnace_top", "side": "furnace_side", "front": "furnace_front_off"},
              "smoker": {"top": "smoker_top", "side": "smoker_side", "front": "smoker_front_off", "bottom": "smoker_bottom"},
              "loom": {"top": "loom_top", "side": "loom_side", "front": "loom_front"},
              "cartography_table": {"top": "cartography_table_top", "side": "cartography_table_side1"}}
    if n in simple: return simple[n]
    if n.endswith("_glazed_terracotta"): return {"side": "glazed_terracotta_" + n[:-18].replace("light_gray", "silver")}
    if n == "scaffolding": return {"side": "scaffolding_side", "top": "scaffolding_top", "bottom": "scaffolding_bottom"}
    if n.endswith("_terracotta") and not n.startswith("glazed"):
        c = n[:-11].replace("light_gray", "silver")
        return {"side": "hardened_clay_stained_" + c if c else "hardened_clay"}
    if n.endswith("_wool"): return {"side": "wool_colored_" + n[:-5].replace("light_gray", "silver")}
    if n.endswith("_concrete"): return {"side": "concrete_" + n[:-9].replace("light_gray", "silver")}
    if n == "decorated_pot": return {"side": "decorated_pot_side", "top": "decorated_pot_base"}
    if n == "dried_kelp_block": return {"side": "dried_kelp_side_a", "top": "dried_kelp_top"}
    m = base_material(n)
    if m: return {"side": m}
    return {"side": n}

def leafy(n): return n.endswith("_leaves") or n.startswith("azalea_leaves")
def opaque_cube(c):
    if c is None: return False
    n, p = c
    return solid_full(n, p) and n not in ("glass", "water") and not leafy(n)
def cull_group(n):
    if leafy(n): return "leaves"
    if n == "glass": return "glass"
    if n == "water": return "water"
    return None

PLANTS = {"poppy": "flower_rose", "dandelion": "flower_dandelion", "cornflower": "flower_cornflower", "oxeye_daisy": "flower_oxeye_daisy",
          "azure_bluet": "flower_houstonia", "allium": "flower_allium", "red_tulip": "flower_tulip_red", "white_tulip": "flower_tulip_white",
          "pink_tulip": "flower_tulip_pink", "orange_tulip": "flower_tulip_orange", "lily_of_the_valley": "flower_lily_of_the_valley",
          "short_grass": "tallgrass#grass", "fern": "fern#grass", "sweet_berry_bush": "sweet_berry_bush_stage3",
          "wheat": "wheat_stage_7", "cactus": "cactus_side", "dead_bush": "deadbush", "carrots": "carrots_stage_3", "potatoes": "potatoes_stage_3", "beetroot": "beetroots_stage_3"}

FACES = {  # name: normal, 4 corners as functions of box
    "up": (0, 1, 0), "down": (0, -1, 0), "south": (0, 0, 1), "north": (0, 0, -1), "east": (1, 0, 0), "west": (-1, 0, 0)}
FACE_OF = {"n": "north", "s": "south", "e": "east", "w": "west"}

def face_quad(f, b):
    x0, y0, z0, x1, y1, z1 = b
    # corners in CCW order seen from outside, with (u, v) in block units for auto-UV
    if f == "up":    return [(x0, y1, z1, x0, 1 - z1), (x1, y1, z1, x1, 1 - z1), (x1, y1, z0, x1, 1 - z0), (x0, y1, z0, x0, 1 - z0)]
    if f == "down":  return [(x0, y0, z0, x0, z0), (x1, y0, z0, x1, z0), (x1, y0, z1, x1, z1), (x0, y0, z1, x0, z1)]
    if f == "south": return [(x0, y0, z1, x0, y0), (x1, y0, z1, x1, y0), (x1, y1, z1, x1, y1), (x0, y1, z1, x0, y1)]
    if f == "north": return [(x1, y0, z0, 1 - x1, y0), (x0, y0, z0, 1 - x0, y0), (x0, y1, z0, 1 - x0, y1), (x1, y1, z0, 1 - x1, y1)]
    if f == "east":  return [(x1, y0, z1, 1 - z1, y0), (x1, y0, z0, 1 - z0, y0), (x1, y1, z0, 1 - z0, y1), (x1, y1, z1, 1 - z1, y1)]
    if f == "west":  return [(x0, y0, z0, z0, y0), (x0, y0, z1, z1, y0), (x0, y1, z1, z1, y1), (x0, y1, z0, z0, y1)]

def stair_boxes(p):
    top = p.get("half") == "top"
    base = (0, 0.5, 0, 1, 1, 1) if top else (0, 0, 0, 1, 0.5, 1)
    ylo, yhi = (0, 0.5) if top else (0.5, 1)
    f = p.get("facing", "n")
    back = {"n": (0, ylo, 0, 1, yhi, 0.5), "s": (0, ylo, 0.5, 1, yhi, 1), "e": (0.5, ylo, 0, 1, yhi, 1), "w": (0, ylo, 0, 0.5, yhi, 1)}[f]
    return [base, back]

def thin_plate(side, t=3 / 16):
    return {"n": (0, 0, 0, 1, 1, t), "s": (0, 0, 1 - t, 1, 1, 1), "e": (1 - t, 0, 0, 1, 1, 1), "w": (0, 0, 0, t, 1, 1)}[side]

_TDX = [0, 1, 1, 1, 0, -1, -1, -1]; _TDZ = [-1, -1, 0, 1, 1, 1, 0, -1]
def _track_links(kind, d):
    if kind == 0: return d, d + 4
    if kind == 1: return d, (d + 3) % 8
    if kind == 2: return d, (d + 2) % 8
    return d, d + 4 if d < 4 else d - 4
def track_preview(kind, d):
    """siege:track drawn with small upright boxes (the renderer has no rotated cubes): two iron rails and spruce
    sleepers along the centreline from one link's edge through the middle to the other's, so diagonals and bends
    read as smooth 45-degree track instead of a staircase."""
    a, b = _track_links(int(kind), int(d) % 8)
    ends = [(0.5 + _TDX[a] * 0.5, 0.5 + _TDZ[a] * 0.5), (0.5, 0.5), (0.5 + _TDX[b] * 0.5, 0.5 + _TDZ[b] * 0.5)]
    out = []; R, T = {"side": "iron_block"}, {"side": "planks_spruce"}
    for (x0, z0), (x1, z1) in zip(ends, ends[1:]):
        L = math.hypot(x1 - x0, z1 - z0) or 1; tx, tz = (x1 - x0) / L, (z1 - z0) / L; nx, nz = -tz, tx
        k = 0
        while k * 0.16 <= L:
            cx, cz = x0 + tx * k * 0.16, z0 + tz * k * 0.16
            if k % 2 == 0:                                   # a sleeper across the line
                for s in (-0.36, -0.12, 0.12, 0.36):
                    px, pz = cx + nx * s, cz + nz * s
                    out.append(((max(0, px - 0.07), 0, max(0, pz - 0.07), min(1, px + 0.07), 1 / 16, min(1, pz + 0.07)), T, {}))
            for s in (-0.25, 0.25):                          # the rails
                px, pz = cx + nx * s, cz + nz * s
                out.append(((max(0, px - 0.05), 1 / 16, max(0, pz - 0.05), min(1, px + 0.05), 3 / 16, min(1, pz + 0.05)), R, {}))
            k += 1
    return out

def model(n, p):
    """-> list of (box, texdict, flags)."""
    if n.startswith("minecraft:"): n = n[10:]          # tree stamps carry full ids
    if n == "siege:track_preview": return track_preview(p.get("kind", 0), p.get("dir", 0))
    if is_stairs(n): t = {"side": base_material(n)}; return [(b, t, {}) for b in stair_boxes(p)]
    if is_slab(n):
        t = {"side": base_material(n)}
        if n == "smooth_stone_slab": t = {"top": "stone_slab_top", "side": "stone_slab_side"}
        return [((0, 0.5, 0, 1, 1, 1) if p.get("half") == "top" else (0, 0, 0, 1, 0.5, 1), t, {})]
    if is_fence(n):
        t = {"side": base_material(n)}; c = p.get("conn", {})
        out = [((6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16), t, {})]
        for d, on in c.items():
            if not on: continue
            for ya, yb in ((6 / 16, 9 / 16), (12 / 16, 15 / 16)):
                out.append(({"n": (7 / 16, ya, 0, 9 / 16, yb, 6 / 16), "s": (7 / 16, ya, 10 / 16, 9 / 16, yb, 1),
                             "e": (10 / 16, ya, 7 / 16, 1, yb, 9 / 16), "w": (0, ya, 7 / 16, 6 / 16, yb, 9 / 16)}[d], t, {}))
        return out
    if is_wall(n):
        t = {"side": base_material(n)}; c = p.get("conn", {}); out = []
        if p.get("post", True): out.append(((4 / 16, 0, 4 / 16, 12 / 16, 1, 12 / 16), t, {}))
        for d, on in c.items():
            if on: out.append(({"n": (5 / 16, 0, 0, 11 / 16, 14 / 16, 8 / 16), "s": (5 / 16, 0, 8 / 16, 11 / 16, 14 / 16, 1),
                                "e": (8 / 16, 0, 5 / 16, 1, 14 / 16, 11 / 16), "w": (0, 0, 5 / 16, 8 / 16, 14 / 16, 11 / 16)}[d], t, {}))
        return out
    if is_pane(n):
        t = {"side": "glass", "edge": "glass_pane_top"}; c = p.get("conn", {}); out = [((7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16), t, {"cut": 1})]
        if not any(c.values()): c = {"n": True, "s": True}
        for d, on in c.items():
            if on: out.append(({"n": (7 / 16, 0, 0, 9 / 16, 1, 7 / 16), "s": (7 / 16, 0, 9 / 16, 9 / 16, 1, 1),
                                "e": (9 / 16, 0, 7 / 16, 1, 1, 9 / 16), "w": (0, 0, 7 / 16, 7 / 16, 1, 9 / 16)}[d], t, {"cut": 1}))
        return out
    if n.endswith("trapdoor"):
        w = wood_of(n); t = {"side": f"{w}_trapdoor" if w != "oak" else "trapdoor"}
        if p.get("open"):
            side = {"n": "s", "s": "n", "e": "w", "w": "e"}[p.get("facing", "n")]
            return [(thin_plate(side), t, {"cut": 1})]
        return [((0, 13 / 16, 0, 1, 1, 1) if p.get("half") == "top" else (0, 0, 0, 1, 3 / 16, 1), t, {"cut": 1})]
    if n.endswith("_door"):
        w = WOODS[wood_of(n)]; t = {"side": f"door_{w if w != 'oak' else 'wood'}_{'upper' if p.get('upper') else 'lower'}"}
        side = {"n": "s", "s": "n", "e": "w", "w": "e"}[p.get("facing", "s")]
        if p.get("open"): side = {"n": "e", "e": "s", "s": "w", "w": "n"}[side] if not p.get("hinge") else {"n": "w", "w": "s", "s": "e", "e": "n"}[side]
        return [(thin_plate(side), t, {"cut": 1})]
    if n in ("lantern", "soul_lantern"):
        y0 = 1 / 16 if p.get("hanging") else 0
        t = {"side": f"{n}@0,2,6,9", "top": f"{n}@0,9,6,15", "bottom": f"{n}@0,9,6,15"}
        return [((5 / 16, y0, 5 / 16, 11 / 16, y0 + 7 / 16, 11 / 16), t, {"cut": 1, "glow": 1}),
                ((6 / 16, y0 + 7 / 16, 6 / 16, 10 / 16, y0 + 9 / 16, 10 / 16), t, {"cut": 1, "glow": 1})]
    if n == "flower_pot":
        t = {"side": "flower_pot@5,10,11,16", "top": "dirt"}
        return [((5 / 16, 0, 5 / 16, 11 / 16, 6 / 16, 11 / 16), t, {})] + ([("cross", {"side": PLANTS[p["plant"]]}, {"cut": 1, "scale": 0.7, "y": 4 / 16})] if p.get("plant") else [])
    if n.endswith("_carpet") and n not in ("moss_carpet", "pale_moss_carpet"):
        return [((0, 0, 0, 1, 1 / 16, 1), {"side": "wool_colored_" + n[:-7].replace("light_gray", "silver")}, {})]
    if n == "anvil":
        t = {"side": "anvil_base", "top": "anvil_top_damaged_0"}
        return [((2 / 16, 0, 2 / 16, 14 / 16, 4 / 16, 14 / 16), t, {}), ((5 / 16, 4 / 16, 4 / 16, 11 / 16, 10 / 16, 12 / 16), t, {}),
                ((3 / 16, 10 / 16, 0, 13 / 16, 1, 1), t, {})]
    if n == "grindstone":
        return [((4 / 16, 4 / 16, 2 / 16, 12 / 16, 1, 14 / 16), {"side": "grindstone_side.tga", "top": "grindstone_round.tga"}, {}),
                ((2 / 16, 0, 6 / 16, 4 / 16, 10 / 16, 10 / 16), {"side": "planks_big_oak"}, {}), ((12 / 16, 0, 6 / 16, 14 / 16, 10 / 16, 10 / 16), {"side": "planks_big_oak"}, {})]
    if n.endswith("_hanging_sign"):     # a board hanging on two short chains under the block above
        w = wood_of(n); t = {"side": "planks_" + WOODS.get(w, "oak")}
        fd = (p.get("bs") or {}).get("facing_direction", 2)
        board = (1 / 16, 0, 7 / 16, 15 / 16, 10 / 16, 9 / 16) if fd in (2, 3) else (7 / 16, 0, 1 / 16, 9 / 16, 10 / 16, 15 / 16)
        return [(board, t, {}), ("cross", {"side": "chain1"}, {"cut": 1, "scale": 0.3, "y": 10 / 16})]
    if n.endswith("_wall_sign"):        # a thin board on the face of the block behind it
        w = wood_of(n); t = {"side": "planks_" + WOODS.get(w, "oak")}
        f = p.get("facing", "s")
        box = {"s": (0, 4 / 16, 0, 1, 12 / 16, 2 / 16), "n": (0, 4 / 16, 14 / 16, 1, 12 / 16, 1),
               "e": (0, 4 / 16, 0, 2 / 16, 12 / 16, 1), "w": (14 / 16, 4 / 16, 0, 1, 12 / 16, 1)}[f]
        return [(box, t, {"cut": 1})]
    if n in ("iron_chain", "chain"): return [("cross", {"side": "chain1"}, {"cut": 1, "scale": 0.4})]
    if n == "lightning_rod": return [((7 / 16, 0, 7 / 16, 9 / 16, 12 / 16, 9 / 16), {"side": "oxidized_lightning_rod"}, {}),
                                     ((6 / 16, 12 / 16, 6 / 16, 10 / 16, 1, 10 / 16), {"side": "oxidized_lightning_rod"}, {})]
    if n == "ladder":
        return [((0, 0, 0, 1, 1, 1 / 16), {"side": "ladder"}, {"cut": 1})]
    if n == "moss_carpet": return [((0, 0, 0, 1, 1 / 16, 1), {"side": "moss_block"}, {})]
    if n == "pale_moss_carpet": return [((0, 0, 0, 1, 1 / 16, 1), {"side": "pale_moss_block"}, {})]
    if n == "short_dry_grass": return [("cross", {"side": "short_dry_grass"}, {"cut": 1})]
    if n == "candle" or n.endswith("_candle"):   # one candle, a 2x6 stick (lit: the wick glows)
        t = f"candles/{n}{'_lit' if p.get('lit') else ''}"
        return [((7 / 16, 0, 7 / 16, 9 / 16, 6 / 16, 9 / 16), {"side": f"{t}@0,8,2,14", "top": f"{t}@0,6,2,8"}, {"cut": 1, **({"glow": 1} if p.get("lit") else {})})]
    if n == "snow_layer": return [((0, 0, 0, 1, (2 * (int(p.get("height", 0)) + 1)) / 16, 1), {"side": "snow"}, {})]
    if n == "rail": return [((0, 0, 0, 1, 1 / 16, 1), {"side": "rail_normal"}, {"cut": 1})]
    if n in ("siege:portcullis", "siege:castle_gate"):
        t = siege_tex(n); ax = p.get("axis", "x")
        return [(((0, 0, 7 / 16, 1, 1, 9 / 16) if ax == "x" else (7 / 16, 0, 0, 9 / 16, 1, 1)), t, {"cut": 1})]
    if n == "siege:spire_roof":
        t = siege_tex(n); return [((a / 16, a / 8 * 1, a / 16, 1 - a / 16, (a + 2) / 8 * 1, 1 - a / 16), t, {}) for a in range(0, 8, 2)]
    if n == "siege:brazier":
        t = siege_tex(n); return [((3 / 16, 0, 3 / 16, 13 / 16, 10 / 16, 13 / 16), t, {"glow": 1})]
    if n == "siege:battlement":
        t = siege_tex(n); return [((0, 0, 0, 1, 1, 1), t, {})]
    if n in PLANTS: return [("cross", {"side": PLANTS[n]}, {"cut": 1})]
    if n.startswith("siege:") and siege_geo(n) == "minecraft:geometry.cross": return [("cross", siege_tex(n), {"cut": 1, "glow": 1})]
    if n.startswith("siege:") and siege_geo(n) and siege_geo(n) != "minecraft:geometry.full_block":
        m = siege_model(n, p)
        if m: return m
    if n.startswith("siege:") and siege_cutout(n): return [((0, 0, 0, 1, 1, 1), siege_tex(n), {"cut": 1})]
    if n == "vine":
        bits = p.get("raw", {}).get("vine_direction_bits", 0); out = []
        for bit, side in ((1, "s"), (2, "w"), (4, "n"), (8, "e")):
            if bits & bit: out.append((thin_plate(side, 1 / 16), {"side": "vine#foliage"}, {"cut": 1}))
        return out
    if n == "pale_hanging_moss": return [("cross", {"side": "pale_hanging_moss_tip" if p.get("raw", {}).get("tip") else "pale_hanging_moss_middle"}, {"cut": 1})]
    if n == "hanging_roots": return [("cross", {"side": "hanging_roots"}, {"cut": 1})]
    if n in ("bush", "firefly_bush"): return [("cross", {"side": n + ("#grass" if n == "bush" else "")}, {"cut": 1})]
    if n == "leaf_litter": return [((0, 0, 0, 1, 1 / 16, 1), {"side": "leaf_litter#litter"}, {"cut": 1})]
    if n == "snow_layer": return [((0, 0, 0, 1, 2 / 16, 1), {"side": "snow"}, {})]
    if n == "water": return [((0, 0, 0, 1, 14 / 16, 1), cube_tex(n, p), {"water": 1})]
    if n == "campfire":
        t = {"side": "campfire_log"}
        return [((1 / 16, 0, 4 / 16, 15 / 16, 4 / 16, 8 / 16), t, {}), ((1 / 16, 0, 8 / 16, 15 / 16, 4 / 16, 12 / 16), t, {}),
                ((4 / 16, 3 / 16, 1 / 16, 8 / 16, 7 / 16, 15 / 16), t, {}), ((8 / 16, 3 / 16, 1 / 16, 12 / 16, 7 / 16, 15 / 16), t, {})]
    if n == "bed":
        head = p.get("head"); part = "head" if head else "feet"
        return [((0, 3 / 16, 0, 1, 9 / 16, 1), {"side": f"bed_{part}_side", "top": f"bed_{part}_top", "bottom": "planks_oak"}, {}),
                ((0, 0, 0, 3 / 16, 3 / 16, 3 / 16), {"side": "planks_oak"}, {}), ((13 / 16, 0, 13 / 16, 1, 3 / 16, 1), {"side": "planks_oak"}, {})]
    if n.endswith("pressure_plate"):
        return [((1 / 16, 0, 1 / 16, 15 / 16, 1 / 16, 15 / 16), {"side": base_material(n.replace("_pressure_plate", "_planks"))}, {})]
    if n == "chest":
        return [((1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16), {"side": "chest_side", "top": "chest_top", "front": "chest_front"}, {"front": p.get("facing", "s")})]
    if n == "cauldron":
        return [((0, 0, 0, 1, 1, 1), {"side": "cauldron_side", "top": "cauldron_top", "bottom": "cauldron_bottom"}, {"cut": 1})]
    if n == "lectern":
        return [((0, 0, 0, 1, 2 / 16, 1), {"side": "lectern_base"}, {}), ((4 / 16, 2 / 16, 4 / 16, 12 / 16, 13 / 16, 12 / 16), {"side": "lectern_front"}, {}),
                ((0, 12 / 16, 0, 1, 15 / 16, 1), {"side": "lectern_sides", "top": "lectern_top"}, {})]
    if n in ("bell",):
        return [((4 / 16, 4 / 16, 4 / 16, 12 / 16, 13 / 16, 12 / 16), {"side": "bell_side", "top": "bell_top"}, {})]
    if n in ("air", "keep"): return []
    fl = {}
    if leafy(n): fl["cut"] = 1
    if n == "glass": fl["cut"] = 1
    if n.endswith("_log") and p.get("axis", "y") != "y": fl["axis"] = p["axis"]
    if n == "hay_block" and p.get("axis", "y") != "y": fl["axis"] = p["axis"]
    if "front" in cube_tex(n, p): fl["front"] = p.get("facing", "s")
    return [((0, 0, 0, 1, 1, 1), cube_tex(n, p), fl)]


class Mesher:
    def __init__(self, cells, texdir):
        self.cells = cells; self.texdir = texdir
        self.out = {}; self.texfiles = {}

    def texkey(self, spec):
        """'name[.tga][#tint][@u0,v0,u1,v1]' -> (key, uvrect)"""
        rect = None
        if "@" in spec: spec, r = spec.split("@"); rect = [int(v) for v in r.split(",")]
        key = spec.replace("/", "_").replace(".tga", "").replace("#", "_")
        if key not in self.texfiles: self.texfiles[key] = spec
        return key, rect

    def add_quad(self, key, flags, verts, normal, ao):
        m = self.out.setdefault(key, {"p": [], "n": [], "uv": [], "c": [], "cut": 0, "water": 0, "glow": 0})
        if flags.get("cut"): m["cut"] = 1
        if flags.get("water"): m["water"] = 1
        if flags.get("glow"): m["glow"] = 1
        for (x, y, z, u, v), a in zip(verts, ao):
            m["p"] += [round(x, 4), round(y, 4), round(z, 4)]; m["n"] += list(normal); m["uv"] += [round(u, 4), round(v, 4)]; m["c"].append(round(a, 3))

    def occ(self, x, y, z): return 1 if opaque_cube(self.cells.get((x, y, z))) else 0

    def ao_for(self, x, y, z, f, verts):
        nx, ny, nz = FACES[f]
        res = []
        for vx, vy, vz, _, _ in verts:
            # corner direction in the face plane
            dx = (1 if vx - x > 0.5 else -1) if nx == 0 else 0
            dy = (1 if vy - y > 0.5 else -1) if ny == 0 else 0
            dz = (1 if vz - z > 0.5 else -1) if nz == 0 else 0
            bx, by, bz = x + nx, y + ny, z + nz
            axes = [(dx, 0, 0) if dx else None, (0, dy, 0) if dy else None, (0, 0, dz) if dz else None]
            axes = [a for a in axes if a]
            s1 = self.occ(bx + axes[0][0], by + axes[0][1], bz + axes[0][2])
            s2 = self.occ(bx + axes[1][0], by + axes[1][1], bz + axes[1][2])
            cn = self.occ(bx + dx, by + dy, bz + dz)
            lvl = 0 if (s1 and s2) else 3 - (s1 + s2 + cn)
            res.append((0.42, 0.6, 0.8, 1.0)[lvl])
        return res

    def run(self):
        for (x, y, z), (n, p) in self.cells.items():
            if n in ("air", "keep"): continue
            parts = model(n, p)
            full = len(parts) == 1 and parts[0][0] == (0, 0, 0, 1, 1, 1)
            for b, tex, fl in parts:
                if b == "cross": self.cross(x, y, z, tex, fl); continue
                for f, nrm in FACES.items():
                    # cull faces on the cell boundary against solid neighbours
                    on_edge = {"up": b[4] == 1, "down": b[1] == 0, "south": b[5] == 1, "north": b[2] == 0, "east": b[3] == 1, "west": b[0] == 0}[f]
                    if on_edge:
                        nb = self.cells.get((x + nrm[0], y + nrm[1], z + nrm[2]))
                        if opaque_cube(nb): continue
                        if full and nb and cull_group(nb[0]) and cull_group(nb[0]) == cull_group(n): continue
                    if fl.get("water") and f != "up" and self.cells.get((x + nrm[0], y + nrm[1], z + nrm[2]), ("", {}))[0] == "water": continue
                    spec = self.face_tex(tex, f, fl) or tex.get("side") or "stone"
                    key, rect = self.texkey(spec)
                    verts = face_quad(f, b)
                    rot = fl.get("axis") and self.rotated(fl["axis"], f)
                    if rect:
                        u0, v0, u1, v1 = rect
                        verts = self.rect_uv(verts, f, b, u0, v0, u1, v1)
                    elif rot:
                        verts = [(vx, vy, vz, v, 1 - u) for vx, vy, vz, u, v in verts]
                    elif is_pane(n) and tex.get("edge") and f in ("up", "down"):
                        key, _ = self.texkey(tex["edge"])
                    ao = self.ao_for(x, y, z, f, verts) if (full and opaque_cube((n, p))) else [1, 1, 1, 1]
                    self.add_quad(key, fl, [(vx + x, vy + y, vz + z, u, v) for vx, vy, vz, u, v in verts], nrm, ao)
        return self

    def rotated(self, axis, f):
        return (axis == "x" and f in ("up", "down", "north", "south")) or (axis == "z" and f in ("east", "west"))

    def face_tex(self, tex, f, fl):
        if fl.get("front") and "front" in tex and FACE_OF[fl["front"]] == f: return tex["front"]
        ax = fl.get("axis", "y")
        endf = {"y": ("up", "down"), "x": ("east", "west"), "z": ("north", "south")}[ax]
        if f in endf:
            if f == endf[0] and "top" in tex: return tex["top"]
            if f == endf[1]: return tex.get("bottom", tex.get("top", tex["side"]))
        if tex.get("side") is None: print("no texture for a face; using stone"); return "stone"
        return tex["side"]

    def rect_uv(self, verts, f, b, u0, v0, u1, v1):
        # map the face's own extent onto a pixel rect of the texture (v counted from the top of the image)
        us = [v[3] for v in verts]; vs = [v[4] for v in verts]
        lo_u, hi_u, lo_v, hi_v = min(us), max(us), min(vs), max(vs)
        out = []
        for vx, vy, vz, u, v in verts:
            fu = (u - lo_u) / ((hi_u - lo_u) or 1); fv = (v - lo_v) / ((hi_v - lo_v) or 1)
            out.append((vx, vy, vz, (u0 + fu * (u1 - u0)) / 16, 1 - (v1 - fv * (v1 - v0)) / 16))
        return out

    def cross(self, x, y, z, tex, fl):
        key, _ = self.texkey(tex["side"]); s = fl.get("scale", 0.9) / 2; yo = fl.get("y", 0); h = fl.get("scale", 1)
        for (ax, az, bx, bz) in ((0.5 - s, 0.5 - s, 0.5 + s, 0.5 + s), (0.5 - s, 0.5 + s, 0.5 + s, 0.5 - s)):
            for flip in (0, 1):
                q = [(ax, yo, az, 0, 0), (bx, yo, bz, 1, 0), (bx, yo + h, bz, 1, 1), (ax, yo + h, az, 0, 1)]
                if flip: q = q[::-1]
                nx, nz = (bz - az), -(bx - ax)
                L = math.hypot(nx, nz); nrm = (0, 1, 0)
                self.add_quad(key, {"cut": 1}, [(vx + x, vy + y, vz + z, u, v) for vx, vy, vz, u, v in q], nrm, [1, 1, 1, 1])

    def textures(self, outdir):
        """Write every used texture as a 16x16 PNG (first animation frame, tinted)."""
        os.makedirs(outdir, exist_ok=True)
        tints = {"grass": GRASS, "foliage": FOLIAGE, "spruce": SPRUCE, "birch": (0x80, 0xA7, 0x55), "water": (0x3F, 0x76, 0xE4), "litter": (0xB0, 0x8A, 0x55)}
        names = {}
        for key, spec in self.texfiles.items():
            tint = None
            if "#" in spec: spec, tint = spec.split("#")
            spec = TEX_ALIAS.get(spec, spec)
            src = None
            for ext in ("", ".png", ".tga"):
                f = os.path.join(self.texdir, spec + ext) if not spec.endswith(".tga") or ext == "" else None
                if f and os.path.isfile(f): src = f; break
            if not src:
                print("missing texture", spec); im = Image.new("RGBA", (16, 16), (255, 0, 255, 255))
            else:
                im = Image.open(src).convert("RGBA")
                if im.height > im.width: im = im.crop((0, 0, im.width, im.width))
                if im.width != 16: im = im.resize((16, 16), Image.NEAREST)
            if tint:
                tr, tg, tb = tints[tint]; px = im.load()
                for i in range(16):
                    for j in range(16):
                        r, g, b_, a = px[i, j]; px[i, j] = (r * tr // 255, g * tg // 255, b_ * tb // 255, a if tint != "water" else 200)
            im.save(os.path.join(outdir, key + ".png")); names[key] = key + ".png"
        return names


if __name__ == "__main__":
    scene, texdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
    d = json.load(open(scene))
    cells = {(x, y, z): tuple(d["palette"][i]) for x, y, z, i in d["blocks"]}
    m = Mesher(cells, texdir).run()
    names = m.textures(os.path.join(os.path.dirname(os.path.abspath(out)), "tex"))
    xs, ys, zs = zip(*cells)
    json.dump({"meshes": m.out, "textures": names, "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1],
               "camera": d.get("camera")}, open(out, "w"), separators=(",", ":"))
    print("quads", sum(len(v["c"]) // 4 for v in m.out.values()), "materials", len(m.out))
