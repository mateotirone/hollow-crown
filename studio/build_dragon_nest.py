"""Builds the wild Dragon Nest: a 9x9 nest of woven branches, bones and straw with a clutch of eggs in the middle.

Run from the repo root:   python3 studio/build_dragon_nest.py

A Minecraft block can't be 9 blocks wide, so the nest is made of five unbreakable pieces that the script
(scripts/dragons/nestshape.js) lays out in the world:

  hc:dragon_nest   the clutch in the middle: three eggs on straw (clicked to take an egg; hc:laid false = empty)
  hc:nest_weave    the rim: a solid block of branches woven round and round, ends poking out
  hc:nest_twigs    loose sticks heaped on top of the rim, the tips flaring up and out
  hc:nest_lining   the floor of the bowl: trampled straw, sometimes with bones, ribs, a skull or shed scales
  hc:nest_fill     packed earth and twigs under the nest where the ground dips (never seen from above)

Writes the block JSON, one model file with every shape, the 16x16 textures, the atlas lines, the block
sounds and the names. Textures are always rewritten (they are made here, not painted over).
"""
import json, math, os, random, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "studio", "art"))
from palette import M, ramp  # noqa: E402
from PIL import Image  # noqa: E402

BP = os.path.join(ROOT, "Siege_Nights_BP")
RP = os.path.join(ROOT, "Siege_Nights_RP")
TEX = "textures/blocks/dragons/nest/"


def write_json(path, data, indent=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=indent)
        f.write("\n")


# ---------------------------------------------------------------- textures (16x16)
BARK = ramp("#5e4430", 0.08, 0.52, cool=0.08)        # weathered dead branches
PALE = ramp("#a08c6c", 0.22, 0.80, cool=0.05)        # sun-bleached wood
CHAR = M["coal"]                                      # scorched by dragon breath
STRAW = ramp("#a88a52", 0.16, 0.68)
BONE = M["parchment"]
EGG = ramp("#7a1e1a", 0.06, 0.50, cool=0.04)
EMBER = M["ember"]
SCALE = ramp("#6a2420", 0.08, 0.48)
EARTH = ramp("#6e5038", 0.10, 0.52)


def tex(name, paint, seed):
    r = random.Random(seed)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), tuple(paint(x, y, r)) + (255,))
    path = os.path.join(RP, TEX + name + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def bark(ramp_, knots=True):
    # vertical grain: long streaks of dark and light, a knot or two
    def paint(x, y, r):
        streak = (x * 7 + (y // 5) * 3) % 5
        i = 2 + (streak == 0) - (streak == 3) + (r.random() < 0.12) - (r.random() < 0.12)
        if knots and ((x - 4) ** 2 + (y - 11) ** 2 < 2 or (x - 11) ** 2 + (y - 3) ** 2 < 2): i = 1
        if x % 8 == 0: i -= 1
        return ramp_[max(0, min(5, i))]
    return paint


def straw(x, y, r):
    # loose diagonal strands
    s = (x + y * 2 + int(r.random() * 2)) % 6
    i = [3, 4, 2, 3, 5, 1][s]
    return STRAW[max(1, min(5, i - (r.random() < 0.1)))]


def fill(x, y, r):
    # packed earth with bits of straw and twig through it
    if (x * 3 + y * 5) % 11 == 0: return STRAW[2]
    if (x + y * 3) % 13 == 0: return BARK[1]
    return EARTH[2 + (r.random() < 0.3) - (r.random() < 0.3)]


def bone(x, y, r):
    i = 4 - (y in (0, 15)) - (x in (0, 15)) + (r.random() < 0.15) - (r.random() < 0.08)
    if (x * 5 + y) % 9 == 0: i -= 1
    return BONE[max(1, min(5, i))]


def egg(x, y, r):
    # dark red scales in rows, a few glowing seams
    row = y // 2
    sx = (x + (row % 2) * 2) % 4
    i = 2 + (sx == 0) - (y % 2 == 1 and sx == 2)
    if (x == 5 and 3 < y < 9) or (y == 8 and 5 <= x < 10) or (x == 10 and 8 <= y < 13): return EMBER[3 + (r.random() < 0.4)]
    return EGG[max(0, min(5, i + (r.random() < 0.1)))]


def scale(x, y, r):
    row = y // 3
    sx = (x + (row % 2) * 2) % 4
    i = 3 - (y % 3 == 2) - (sx == 0) + (sx == 2 and y % 3 == 0)
    return SCALE[max(0, min(5, i))]


def build_textures():
    tex("branch", bark(BARK), 1)
    tex("branch_pale", bark(PALE), 2)
    tex("branch_char", bark(CHAR, False), 3)
    tex("straw", straw, 4)
    tex("fill", fill, 5)
    tex("bone", bone, 6)
    tex("egg", egg, 7)
    tex("scale", scale, 8)


# ---------------------------------------------------------------- model helpers
class Shape:
    """One block model. Units are pixels: the block is x,z -8..8 and y 0..16."""
    LIMIT = 14.5   # keep everything inside a 29-pixel box (Bedrock allows 30)

    def __init__(self, name, seed):
        self.name, self.r = name, random.Random(seed)
        self.bones = {}

    def cube(self, origin, size, mat="*", rot=None, pivot=None, bone="main"):
        r = self.r
        faces = {}
        for face, (w, h) in {"north": (size[0], size[1]), "south": (size[0], size[1]), "east": (size[2], size[1]),
                             "west": (size[2], size[1]), "up": (size[0], size[2]), "down": (size[0], size[2])}.items():
            w, h = max(1, min(16, round(w))), max(1, min(16, round(h)))
            u, v = r.randint(0, 16 - w), r.randint(0, 16 - h)
            f = {"uv": [u, v], "uv_size": [w, h]}
            if mat != "*": f["material_instance"] = mat
            faces[face] = f
        c = {"origin": [round(o, 3) for o in origin], "size": [round(s, 3) for s in size], "uv": faces}
        if rot:
            c["rotation"] = list(rot)
            c["pivot"] = [round(p, 3) for p in (pivot or [origin[i] + size[i] / 2 for i in range(3)])]
        self.check(c)
        self.bones.setdefault(bone, []).append(c)
        return c

    @staticmethod
    def corners(c):
        o, s = c["origin"], c["size"]
        pts = [[o[0] + s[0] * i, o[1] + s[1] * j, o[2] + s[2] * k] for i in (0, 1) for j in (0, 1) for k in (0, 1)]
        if "rotation" not in c: return pts
        p, (rx, ry, rz) = c["pivot"], [math.radians(a) for a in c["rotation"]]
        out = []
        for x, y, z in pts:
            x, y, z = x - p[0], y - p[1], z - p[2]
            y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
            x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
            x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
            out.append([x + p[0], y + p[1], z + p[2]])
        return out

    def check(self, c):
        for x, y, z in self.corners(c):
            assert abs(x) <= self.LIMIT and abs(z) <= self.LIMIT and -0.01 <= y <= 28, f"{self.name}: cube out of bounds {c}"

    def stick(self, cx, y, cz, length, axis="x", thick=2, mat=None, yaw=0, tilt=0, bone="main"):
        """A branch lying along x or z, centred on cx/cz, bottom at y. yaw turns it about y, tilt lifts one end."""
        mat = mat or self.wood()
        if axis == "x": origin, size = [cx - length / 2, y, cz - thick / 2], [length, thick, thick]
        else: origin, size = [cx - thick / 2, y, cz - length / 2], [thick, thick, length]
        rot = None
        if yaw: rot = [0, yaw, 0]
        elif tilt: rot = [0, 0, tilt] if axis == "x" else [tilt, 0, 0]
        # shorten until it fits rather than failing the build
        for _ in range(12):
            try:
                return self.cube(origin, size, mat, rot, bone=bone)
            except AssertionError:
                length -= 1.5
                if axis == "x": origin, size = [cx - length / 2, y, cz - thick / 2], [length, thick, thick]
                else: origin, size = [cx - thick / 2, y, cz - length / 2], [thick, thick, length]
        return None

    def wood(self):
        x = self.r.random()
        return "*" if x < 0.72 else "pale" if x < 0.94 else "char"

    def geo(self):
        return {"description": {"identifier": f"geometry.hc_{self.name}", "texture_width": 16, "texture_height": 16},
                "bones": [{"name": b, "pivot": [0, 0, 0], "cubes": cubes} for b, cubes in self.bones.items()]}


def weave():
    s = Shape("nest_weave", 11)
    r = s.r
    s.cube([-7, 0, -7], [14, 15, 14], "fill")
    # rings of branches laid round the block, the ends running past the corners into the next block
    for layer, y in enumerate([0, 2.5, 5, 7.5, 10, 12.5]):
        out = 0.5 if layer % 2 else 0
        for side in range(4):
            for _ in range(1 + (r.random() < 0.6)):
                length = r.uniform(13, 19)
                off = r.uniform(-2, 2)
                yy = y + r.uniform(-0.5, 0.5)
                yaw = r.choice([0, 0, 0, 22.5, -22.5])
                th = r.choice([2, 2, 1.5, 2.5])
                if side == 0: s.stick(off, yy, -7.5 - out, length, "x", th, yaw=yaw)
                elif side == 1: s.stick(off, yy, 7.5 + out, length, "x", th, yaw=yaw)
                elif side == 2: s.stick(-7.5 - (0.5 - out), yy, off, length, "z", th, yaw=yaw)
                else: s.stick(7.5 + (0.5 - out), yy, off, length, "z", th, yaw=yaw)
    # a ragged top: branches crossing over it
    for _ in range(6):
        s.stick(r.uniform(-4, 4), 15 + r.uniform(-0.5, 0.8), r.uniform(-4, 4), r.uniform(12, 18), r.choice("xz"), 2,
                yaw=r.choice([0, 22.5, 45, -22.5, -45, 67.5]))
    # strays poking out of the sides at an angle
    for _ in range(5):
        axis = r.choice("xz")
        s.stick(r.uniform(-3, 3), r.uniform(2, 12), r.uniform(-3, 3), r.uniform(18, 22), axis, 1.5, tilt=r.choice([22.5, -22.5]))
    return s


def twigs():
    s = Shape("nest_twigs", 12)
    r = s.r
    s.cube([-6.5, 0, -6.5], [13, 3, 13], "fill")
    s.cube([-4, 3, -4], [8, 2, 8], "fill")
    # a loose heap
    for i in range(14):
        s.stick(r.uniform(-4, 4), r.uniform(0, 6), r.uniform(-4, 4), r.uniform(10, 17), r.choice("xz"), r.choice([1.5, 2, 2]),
                yaw=r.choice([0, 22.5, 45, 67.5, -22.5, -45, -67.5]))
    # tips flaring up and out in every direction, like the lip of a real nest
    for ang in (0, 1, 2, 3):
        for _ in range(2):
            length = r.uniform(14, 19)
            lift = r.choice([22.5, 45])
            if ang == 0: s.stick(r.uniform(-4, 4), r.uniform(3, 6), -5, length, "z", 1.5, tilt=lift)
            elif ang == 1: s.stick(r.uniform(-4, 4), r.uniform(3, 6), 5, length, "z", 1.5, tilt=-lift)
            elif ang == 2: s.stick(-5, r.uniform(3, 6), r.uniform(-4, 4), length, "x", 1.5, tilt=-lift)
            else: s.stick(5, r.uniform(3, 6), r.uniform(-4, 4), length, "x", 1.5, tilt=lift)
    return s


def bone_piece(s, x, z, length, axis, yaw, bone):
    """A long bone: a shaft with knuckles at both ends."""
    s.stick(x, 1, z, length, axis, 2, "bone", yaw=yaw, bone=bone)
    for end in (-1, 1):
        d = end * length / 2
        c, sn = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        ex, ez = (x + d * c, z - d * sn) if axis == "x" else (x + d * sn, z + d * c)
        s.cube([ex - 1.5, 0.5, ez - 1.5], [3, 3, 3], "bone", bone=bone)


def lining():
    s = Shape("nest_lining", 13)
    r = s.r
    s.cube([-8, 0, -8], [16, 1, 16], "straw")
    for _ in range(9):   # strands and tufts of straw
        s.cube([r.uniform(-7, 4), 1, r.uniform(-7, 4)], [r.uniform(2, 4), 0.6, r.uniform(2, 4)], "straw")
    for _ in range(5):
        s.stick(r.uniform(-4, 4), 1, r.uniform(-4, 4), r.uniform(6, 12), r.choice("xz"), 1, "straw", yaw=r.choice([0, 22.5, 45, -45]))
    s.stick(r.uniform(-3, 3), 1, r.uniform(-3, 3), 11, "x", 1.5, "*", yaw=22.5)
    # v1: a gnawed leg bone
    bone_piece(s, 0, 1, 10, "x", -22.5, "deco_bone")
    # v2: a ribcage, half sunk in the straw
    for i in range(4):
        z = -4.5 + i * 3
        s.cube([-5, 1, z], [1.5, 4, 1.5], "bone", rot=[0, 0, -22.5], bone="deco_ribs")
        s.cube([3.5, 1, z], [1.5, 4, 1.5], "bone", rot=[0, 0, 22.5], bone="deco_ribs")
        s.cube([-3.5, 4.2, z], [7, 1.5, 1.5], "bone", bone="deco_ribs")
    s.cube([-1, 1, -6], [2, 2, 12], "bone", bone="deco_ribs")   # spine
    # v3: the skull of something the dragon ate (a big horned beast)
    s.cube([-3, 1, -1], [6, 5, 6], "bone", bone="deco_skull")
    s.cube([-2, 1, -5], [4, 3, 4], "bone", bone="deco_skull")
    s.cube([-2.5, 3.5, -1.2], [1.5, 1.5, 0.4], "char", bone="deco_skull")   # eye holes
    s.cube([1, 3.5, -1.2], [1.5, 1.5, 0.4], "char", bone="deco_skull")
    s.cube([-7, 4, 1], [4, 1.5, 1.5], "bone", rot=[0, 0, 22.5], bone="deco_skull")   # horns
    s.cube([3, 4, 1], [4, 1.5, 1.5], "bone", rot=[0, 0, -22.5], bone="deco_skull")
    # v4: shed scales and broken eggshell
    for _ in range(6):
        s.cube([r.uniform(-6, 4), 1, r.uniform(-6, 4)], [r.choice([2, 3]), 0.5, r.choice([2, 3])], "scale",
               rot=[0, r.choice([0, 22.5, 45]), 0], bone="deco_scales")
    for _ in range(3):
        s.cube([r.uniform(-5, 3), 1, r.uniform(-5, 3)], [3, 1.5, 2], "egg", rot=[r.choice([22.5, -22.5]), 0, 0], bone="deco_scales")
    return s


def egg_shape(s, cx, cz, scale, lean, bone):
    """An egg built from stacked slabs, widest a third of the way up."""
    rows = [(0, 0.55), (1, 0.85), (2, 1.0), (3, 1.0), (4, 0.95), (5, 0.85), (6, 0.7), (7, 0.5), (8, 0.25)]
    w0, h = 6 * scale, 1.1 * scale
    for i, k in rows:
        w = max(1, w0 * k)
        if i == 8: w = max(w, 2)
        y = 1 + i * h
        dx = lean * i * h * 0.12
        s.cube([cx + dx - w / 2, y, cz - w / 2], [w, h + 0.05, w], "egg", bone=bone)


def clutch():
    s = Shape("dragon_nest", 14)
    r = s.r
    s.cube([-8, 0, -8], [16, 1, 16], "straw")
    for _ in range(8):   # a ring of straw pulled up round the eggs
        a = r.uniform(0, math.tau)
        s.cube([math.cos(a) * 5.5 - 1.5, 1, math.sin(a) * 5.5 - 1.5], [3, 1.5, 3], "straw")
    for _ in range(4):
        s.stick(r.uniform(-3, 3), 1, r.uniform(-3, 3), r.uniform(10, 14), r.choice("xz"), 1.5, yaw=r.choice([22.5, 45, -45]))
    egg_shape(s, -0.5, 1.5, 2.0, 0.3, "eggs")     # the big one, near a block tall
    egg_shape(s, 6.5, -4.5, 1.4, 1.2, "eggs")
    egg_shape(s, -7, -5, 1.3, -1.2, "eggs")
    # taken: broken shell where the eggs were
    for _ in range(5):
        s.cube([r.uniform(-4, 3), 1, r.uniform(-4, 3)], [r.choice([2, 3]), 1.5, 2], "egg", rot=[0, r.choice([0, 22.5, 45]), 0], bone="shells")
    s.cube([-3, 1, -1.5], [3, 2.5, 3], "egg", rot=[0, 0, 22.5], bone="shells")
    return s


SHAPES = [weave(), twigs(), lining(), clutch()]


# ---------------------------------------------------------------- blocks
MATS = {
    "*": "hc_nest_branch", "pale": "hc_nest_branch_pale", "char": "hc_nest_branch_char", "straw": "hc_nest_straw",
    "fill": "hc_nest_fill", "bone": "hc_nest_bone", "egg": "hc_nest_egg", "scale": "hc_nest_scale",
}


def mats(*keys, glow=False):
    out = {}
    for k in ("*",) + keys:
        out[k] = {"texture": MATS[k], "render_method": "opaque"}
        if glow and k == "egg": out[k].update({"face_dimming": False})
    return out


def box(h):
    return {"origin": [-8, 0, -8], "size": [16, h, 16]}


TURN = [{"condition": f"q.block_state('hc:turn') == {i}", "components": {"minecraft:transformation": {"rotation": [0, 90 * i, 0]}}}
        for i in (1, 2, 3)]

COMMON = {
    "minecraft:destructible_by_mining": False,      # can't be broken (Creative can still clear it)
    "minecraft:destructible_by_explosion": False,
    "minecraft:flammable": {"catch_chance_modifier": 0, "destroy_chance_modifier": 0},
    "minecraft:light_dampening": 0,
}


def block(ident, name_key, geo, materials, collision, color, states=None, extra=None, perms=None):
    desc = {"identifier": ident, "menu_category": {"category": "nature"}}
    if states: desc["states"] = states
    comp = {"minecraft:display_name": f"tile.{ident}.name", "minecraft:geometry": geo, "minecraft:material_instances": materials,
            "minecraft:collision_box": collision, "minecraft:selection_box": box(16), "minecraft:map_color": color, **COMMON, **(extra or {})}
    data = {"format_version": "1.21.90", "minecraft:block": {"description": desc, "components": comp}}
    if perms: data["minecraft:block"]["permutations"] = perms
    write_json(os.path.join(BP, "blocks", "dragons", ident.split(":")[1] + ".json"), data, indent=2)


DECOS = ["deco_bone", "deco_ribs", "deco_skull", "deco_scales"]


def build_blocks():
    block("hc:nest_weave", "Woven Nest Branches", "geometry.hc_nest_weave", mats("pale", "char", "fill"), True, "#5e4430",
          states={"hc:turn": [0, 1, 2, 3]}, perms=TURN)
    block("hc:nest_twigs", "Nest Twigs", "geometry.hc_nest_twigs", mats("pale", "char", "fill"), box(8), "#6e5038",
          states={"hc:turn": [0, 1, 2, 3]}, perms=TURN)
    block("hc:nest_lining", "Nest Lining", {"identifier": "geometry.hc_nest_lining",
                                             "bone_visibility": {b: f"q.block_state('hc:v') == {i + 1}" for i, b in enumerate(DECOS)}},
          mats("straw", "bone", "char", "scale", "egg"), box(2), "#b8944e", states={"hc:v": [0, 1, 2, 3, 4], "hc:turn": [0, 1, 2, 3]}, perms=TURN)
    block("hc:dragon_nest", "Dragon Nest", {"identifier": "geometry.hc_dragon_nest",
                                             "bone_visibility": {"eggs": "q.block_state('hc:laid')", "shells": "!q.block_state('hc:laid')"}},
          mats("straw", "egg", glow=True), box(4), "#7a1e1a", states={"hc:laid": [True, False]},
          extra={"minecraft:light_emission": 4, "siege:clickable": {}})
    block("hc:nest_fill", "Packed Nest Earth", "minecraft:geometry.full_block", {"*": {"texture": "hc_nest_fill", "render_method": "opaque"}},
          True, "#6e5038")


# ---------------------------------------------------------------- shared files (read again right before writing)
NAMES = {"hc:dragon_nest": "Dragon Nest", "hc:nest_weave": "Woven Nest Branches", "hc:nest_twigs": "Nest Twigs",
         "hc:nest_lining": "Nest Lining", "hc:nest_fill": "Packed Nest Earth"}
SOUNDS = {"hc:dragon_nest": "grass", "hc:nest_weave": "wood", "hc:nest_twigs": "wood", "hc:nest_lining": "grass", "hc:nest_fill": "gravel"}


def merge_shared():
    path = os.path.join(RP, "textures", "terrain_texture.json")
    data = json.load(open(path, encoding="utf8"))
    td = data["texture_data"]
    for old in ("siege_dragon_nest_side", "siege_dragon_nest_top"): td.pop(old, None)
    for key, tex_ in MATS.items():
        td[tex_] = {"textures": TEX + tex_.replace("hc_nest_", "")}
    write_json(path, data)

    path = os.path.join(RP, "blocks.json")
    data = json.load(open(path, encoding="utf8"))
    for k, v in SOUNDS.items(): data[k] = {"sound": v}
    write_json(path, data)

    path = os.path.join(RP, "texts", "en_US.lang")
    lines = [l for l in open(path, encoding="utf8").read().split("\n") if not any(l.startswith(f"tile.{k}.name=") for k in NAMES)]
    while lines and lines[-1] == "": lines.pop()
    lines += [f"tile.{k}.name={v}" for k, v in NAMES.items()]
    open(path, "w", encoding="utf8").write("\n".join(lines) + "\n")

    for old in ("siege_dragon_nest_side.png", "siege_dragon_nest_top.png"):
        p = os.path.join(RP, "textures", "blocks", "dragons", old)
        if os.path.exists(p): os.remove(p)


if __name__ == "__main__":
    build_textures()
    write_json(os.path.join(RP, "models", "blocks", "dragon_nest.geo.json"),
               {"format_version": "1.12.0", "minecraft:geometry": [s.geo() for s in SHAPES]})
    build_blocks()
    merge_shared()
    print("dragon nest:", ", ".join(f"{s.name} {sum(len(c) for c in s.bones.values())} cubes" for s in SHAPES))
