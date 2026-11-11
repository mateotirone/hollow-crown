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
WOODS = {"oak": "oak", "spruce": "spruce", "dark_oak": "big_oak", "birch": "birch", "jungle": "jungle", "acacia": "acacia"}

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
       "smooth_stone_slab": "stone_slab_top", "normal_stone": "stone", "stone_block": "stone"}
for w, t in WOODS.items(): MAT[w] = "planks_" + t; MAT[w + "_planks"] = "planks_" + t

def base_material(n):
    for suf in ("_stairs", "_slab", "_wall", "_fence"):
        if n.endswith(suf): n = n[: -len(suf)]; break
    if n == "stone" : return "cobblestone"     # Bedrock: stone_stairs are cobblestone stairs
    if n == "normal_stone": return "stone"
    if n == "smooth_stone": return "stone_slab_top"
    if n in MAT: return MAT[n]
    w = wood_of(n)
    if w: return "planks_" + WOODS[w]
    return None

def cube_tex(n, p):
    """face -> texture key ('top','bottom','side' / per face)."""
    w = wood_of(n)
    if n.endswith("_log") and n.startswith("stripped_"):
        return {"top": f"stripped_{w}_log_top", "side": f"stripped_{w}_log"}
    if n.endswith("_log") or n.endswith("_wood"):
        t = WOODS[w]; return {"top": f"log_{t}_top", "side": f"log_{t}" if not n.endswith("_wood") else f"log_{t}"}
    simple = {"grass_block": {"top": "grass_top#grass", "bottom": "dirt", "side": "grass_side_carried"},
              "grass_path": {"top": "grass_path_top", "bottom": "dirt", "side": "grass_path_side"},
              "hay_block": {"top": "hay_block_top", "side": "hay_block_side"},
              "farmland": {"top": "farmland_wet", "side": "dirt", "bottom": "dirt"},
              "barrel": {"top": "barrel_top", "bottom": "barrel_bottom", "side": "barrel_side"},
              "crafting_table": {"top": "crafting_table_top", "side": "crafting_table_side", "bottom": "planks_oak"},
              "oak_leaves": {"side": "leaves_oak.tga#foliage"}, "spruce_leaves": {"side": "leaves_spruce.tga#spruce"},
              "dark_oak_leaves": {"side": "leaves_big_oak.tga#foliage"}, "birch_leaves": {"side": "leaves_birch.tga#birch"},
              "azalea_leaves": {"side": "azalea_leaves"}, "azalea_leaves_flowered": {"side": "azalea_leaves_flowers"},
              "water": {"side": "water_still_grey#water"}, "glass": {"side": "glass"},
              "composter": {"top": "composter_top", "side": "composter_side", "bottom": "composter_bottom"},
              "smooth_stone": {"top": "stone_slab_top", "side": "stone_slab_side"},
              "bookshelf": {"top": "planks_oak", "side": "bookshelf"},
              "furnace": {"top": "furnace_top", "side": "furnace_side", "front": "furnace_front_off"},
              "smoker": {"top": "smoker_top", "side": "smoker_side", "front": "smoker_front_off", "bottom": "smoker_bottom"},
              "loom": {"top": "loom_top", "side": "loom_side", "front": "loom_front"},
              "cartography_table": {"top": "cartography_table_top", "side": "cartography_table_side1"}}
    if n in simple: return simple[n]
    if n.endswith("_terracotta") and not n.startswith("glazed"):
        c = n[:-11].replace("light_gray", "silver")
        return {"side": "hardened_clay_stained_" + c if c else "hardened_clay"}
    if n.endswith("_wool"): return {"side": "wool_colored_" + n[:-5].replace("light_gray", "silver")}
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
          "wheat": "wheat_stage_7", "carrots": "carrots_stage_3", "potatoes": "potatoes_stage_3"}

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

def model(n, p):
    """-> list of (box, texdict, flags)."""
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
    if n == "lantern":
        y0 = 1 / 16 if p.get("hanging") else 0
        t = {"side": "lantern@0,2,6,9", "top": "lantern@0,9,6,15", "bottom": "lantern@0,9,6,15"}
        return [((5 / 16, y0, 5 / 16, 11 / 16, y0 + 7 / 16, 11 / 16), t, {"cut": 1, "glow": 1}),
                ((6 / 16, y0 + 7 / 16, 6 / 16, 10 / 16, y0 + 9 / 16, 10 / 16), t, {"cut": 1, "glow": 1})]
    if n == "flower_pot":
        t = {"side": "flower_pot@5,10,11,16", "top": "dirt"}
        return [((5 / 16, 0, 5 / 16, 11 / 16, 6 / 16, 11 / 16), t, {})] + ([("cross", {"side": PLANTS[p["plant"]]}, {"cut": 1, "scale": 0.7, "y": 4 / 16})] if p.get("plant") else [])
    if n.endswith("_carpet"):
        return [((0, 0, 0, 1, 1 / 16, 1), {"side": "wool_colored_" + n[:-7].replace("light_gray", "silver")}, {})]
    if n in PLANTS: return [("cross", {"side": PLANTS[n]}, {"cut": 1})]
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
                    spec = self.face_tex(tex, f, fl)
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
        tints = {"grass": GRASS, "foliage": FOLIAGE, "spruce": SPRUCE, "birch": (0x80, 0xA7, 0x55), "water": (0x3F, 0x76, 0xE4)}
        names = {}
        for key, spec in self.texfiles.items():
            tint = None
            if "#" in spec: spec, tint = spec.split("#")
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
