"""The Faceless statues as 3D entities (siege:faceless_statue): one Blockbench-format model and skin per age.

    python3 studio/statues/build_statues.py        writes the five models, their skins and scripts/statues/model_data.js

The forty statues are King Oswin at every age (lore: Lord Sorrel, Warden Isolde): boy, youth, young king, king and old
king. Every one is robed and hooded with a blank, smooth quartz face (never a carved face) and the same pale quartz
hands ("You can tell from the hands"). From the young king on he wears a crown ring over the hood. One model per age
carries every pose as its own bone, and the entity's properties pick what shows (render controller):

    siege:age   0 boy, 1 youth, 2 young king, 3 king, 4 old king          which model
    siege:hold  0 folded hands, 1 staff, 2 sword, 3 bowl                   which arms bone shows
    siege:wear  0 whole, 1 headless, 2 armless, 3 stump, 4 fallen          what is broken off (fallen = toppled on its back)
    siege:size  how many times bigger than the model (the avenue's are 5, the Gate's 7.3)

Units are model pixels (16 = one block at size 1). The front is -z (Bedrock's model front), the feet at y 0.
The bone names and what each holds:
    root    everything (the animation scales it, and lays it down when fallen)
    legs    the hem and skirt, up to the knees: all a stump keeps
    body    waist, chest, mantle, the hood's drape, both sleeves
    head    the hood and the blank face;  crown (in head) the ring, young king on
    arm_r   the right sleeve (gone when armless);  stub (in body) the broken shoulder an armless one shows
    arms_folded / arms_staff / arms_sword / arms_bowl    the forearms, the hands and what they hold
    rubble  broken pieces round the feet of a stump
"""
import json, math, os, random, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RP = os.path.join(REPO, "Siege_Nights_RP")
BP = os.path.join(REPO, "Siege_Nights_BP")

AGES = ["boy", "youth", "young_king", "king", "old_king"]
HOLDS = ["folded", "staff", "sword", "bowl"]
WEARS = ["whole", "headless", "armless", "stump", "fallen"]

# per age: overall height factor (king = 1, 48 px), slimness, head size, stoop (degrees the body and head bow), crown
AGE_SHAPE = {
    "boy":        dict(k=0.62, slim=0.86, head=1.18, stoop=0, bow=0, crown=False),
    "youth":      dict(k=0.80, slim=0.92, head=1.06, stoop=0, bow=0, crown=False),
    "young_king": dict(k=0.94, slim=1.0, head=1.0, stoop=0, bow=0, crown=True),
    "king":       dict(k=1.0, slim=1.06, head=1.0, stoop=0, bow=0, crown=True),
    "old_king":   dict(k=0.96, slim=1.0, head=1.0, stoop=7, bow=12, crown=True),
}

# what each material looks like (base colour, how much grain)
MATS = {
    "robe": ((214, 197, 146), 1.0),     # weathered sandstone
    "fold": ((196, 178, 128), 1.0),     # the shadowed folds down the front
    "pale": ((236, 230, 218), 0.35),    # the smooth quartz face and hands
    "crown": ((176, 96, 48), 0.8),      # cut red sandstone
    "staff": ((186, 166, 116), 0.9),
    "bowl": ((168, 88, 46), 0.8),
    "rubble": ((204, 188, 138), 1.2),
    "shadow": ((150, 134, 96), 0.8),
}


class Model:
    def __init__(self, name):
        self.name = name; self.bones = []; self.faces = []   # faces: (cube, face name, w, h, mat)

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        b = {"name": name, "pivot": list(pivot), "cubes": []}
        if parent: b["parent"] = parent
        if rotation: b["rotation"] = list(rotation)
        self.bones.append(b); return b

    def cube(self, bone, x0, y0, z0, x1, y1, z1, mat="robe", front=None):
        """A box from (x0, y0, z0) to (x1, y1, z1). `front` gives the north face its own material (the blank face)."""
        w, h, d = x1 - x0, y1 - y0, z1 - z0
        c = {"origin": [x0, y0, z0], "size": [w, h, d], "uv": {}, "_mat": mat}
        bone["cubes"].append(c)
        for f, (fw, fh) in {"north": (w, h), "south": (w, h), "east": (d, h), "west": (d, h), "up": (w, d), "down": (w, d)}.items():
            self.faces.append((c, f, max(1, math.ceil(fw)), max(1, math.ceil(fh)), front if (f == "north" and front) else mat))
        return c


def r(v): return round(v * 2) / 2   # half pixels keep the model tidy


def figure(age):
    s = AGE_SHAPE[age]; k = s["k"]; sl = s["slim"]; hd = s["head"]
    m = Model(age)
    K = lambda v: r(v * k)                 # heights
    W = lambda v: r(v * k * sl)            # widths and depths
    knee = K(13)
    root = m.bone("root")

    def tiers(bone, prof, mat="robe", zc=0.0):
        """Stacked rings from a profile [(y from, y to, half-width, half-depth)]: the robe's silhouette, stepped."""
        for y0_, y1_, hx, hz_ in prof:
            m.cube(bone, -W(hx), K(y0_), r(zc - W(hz_)), W(hx), K(y1_), r(zc + W(hz_)), mat)

    legs = m.bone("legs", "root")
    tiers(legs, [(0, 1, 7.5, 6.5), (1, 2.5, 7, 6), (2.5, 5, 6.5, 5.5), (5, 9, 6, 5), (9, 13, 5.5, 4.6)])   # the hem spread on the plinth
    for x in (-W(3.5), -W(1), W(1.5)):                                         # deep folds down the front of the skirt
        m.cube(legs, x, K(2.5), -W(5.5) - 0.5, x + 1, K(9), -W(5.5), "fold")
        m.cube(legs, x, K(9), -W(4.6) - 0.5, x + 1, knee, -W(4.6), "fold")
    body = m.bone("body", "root", (0, knee, 0), (s["stoop"], 0, 0) if s["stoop"] else None)
    sh = K(31)
    tiers(body, [(13, 17, 5.2, 4.3), (17, 18, 5.7, 4.8), (18, 22, 5.4, 4.4), (22, 26, 5.9, 4.6), (26, 28, 6.6, 4.8), (28, 30, 7.4, 4.8), (30, 31, 6.4, 4.3)])
    m.cube(body, -W(1), K(13), -W(4.8), W(1), K(17), -W(4.3), "fold")           # the girdle's knot hanging
    m.cube(body, -W(4.5), K(24), W(3.5), W(4.5), sh + 1, W(5.5))               # the hood's drape down the back
    m.cube(body, -W(3.5), K(21), W(4), W(3.5), K(24), W(5))
    ex = W(9.5)                                                                # outer edge of a sleeve
    for side, nm in ((-1, "arm_l"), (1, "arm_r")):
        b = m.bone(nm, "body", (side * W(7), sh, 0)) if nm == "arm_r" else body
        for y0_, y1_, inner, outer, hz_ in ((26, 30, 6.2, 8.4, 2.6), (21, 26, 6.3, 9.0, 3.0), (16.5, 21, 6.4, 9.6, 3.5)):   # a bell sleeve
            x0, x1 = sorted((side * W(inner), side * W(outer)))
            m.cube(b, x0, K(y0_), -W(hz_), x1, K(y1_), W(hz_))
    stub = m.bone("stub", "body")
    m.cube(stub, W(6.2), K(26), -W(2.6), W(8.4), K(30), W(2.6))               # an arm broken off at the shoulder
    m.cube(stub, W(6.4), K(25), -W(2.2), W(8), K(26), W(2.2), "fold")
    # the head: a deep rounded hood, its opening framed and set back, the blank pale face in its shadow
    head = m.bone("head", "body", (0, sh, 0), (s["bow"], 0, 0) if s["bow"] else None)
    H_ = lambda v: r(v * hd * k)
    zb = H_(4.5)                                                               # the back of the hood
    fwd = -1 if s["bow"] else 0                                                # the old king's head comes forward
    y0 = sh
    for a_, b_, hx, back, front in ((0, 2, 4.4, 4.5, 3.8), (2, 7, 4.8, 4.8, 4.2), (7, 9, 4.3, 4.6, 3.8), (9, 10.5, 3.4, 4.0, 2.6), (10.5, 11.5, 2.2, 3.2, 1.0)):
        m.cube(head, -H_(hx), y0 + H_(a_), fwd - H_(front), H_(hx), y0 + H_(b_), fwd + H_(back))
    m.cube(head, -H_(3.3), y0 + H_(1), fwd - H_(4.2) - 1, -H_(2.3), y0 + H_(8), fwd - H_(4.2), "fold")    # the rim round the opening
    m.cube(head, H_(2.3), y0 + H_(1), fwd - H_(4.2) - 1, H_(3.3), y0 + H_(8), fwd - H_(4.2), "fold")
    m.cube(head, -H_(3.3), y0 + H_(7), fwd - H_(4.2) - 1, H_(3.3), y0 + H_(8.5), fwd - H_(4.2), "fold")
    m.cube(head, -H_(2.3), y0 + H_(1), fwd - H_(4.2) - 0.5, H_(2.3), y0 + H_(7), fwd - H_(4.2) + 1, "robe", front="pale")   # the face: smooth, blank
    if s["crown"]:
        crown = m.bone("crown", "head", (0, y0 + H_(7), 0))
        cy = y0 + H_(6); cw = H_(4.8) + 0.5; cf = fwd - H_(4.2) - 0.5; cb = fwd + H_(4.8) + 0.5
        m.cube(crown, -cw, cy, cf, cw, cy + 1.5, cf + 1, "crown")              # the ring: front, back and sides
        m.cube(crown, -cw, cy, cb - 1, cw, cy + 1.5, cb, "crown")
        m.cube(crown, -cw, cy, cf + 1, -cw + 1, cy + 1.5, cb - 1, "crown")
        m.cube(crown, cw - 1, cy, cf + 1, cw, cy + 1.5, cb - 1, "crown")
        pts = [(-cw + 0.5, cf), (-0.5, cf), (cw - 1.5, cf), (-cw, (cf + cb) / 2 - 0.5), (cw - 1, (cf + cb) / 2 - 0.5)]
        for i, (x, z) in enumerate(pts):                                       # five points, the middle one tallest
            m.cube(crown, r(x), cy + 1.5, r(z), r(x) + 1, cy + (3.5 if i == 1 else 2.5), r(z) + 1, "crown")
    # the arms and what they hold: one bone per pose
    fz = -W(4.6)                                                               # the chest's front
    a = m.bone("arms_folded", "body")
    m.cube(a, 0, K(18), fz - W(2.5), W(8), K(21), fz + 0.5)                    # forearms across the chest
    m.cube(a, -W(8), K(18), fz - W(2.5), 0, K(21), fz + 0.5)
    m.cube(a, -W(2), K(19), fz - W(3.5), W(2), K(23), fz - W(1.5), "pale")     # the hands, folded
    a = m.bone("arms_staff", "body")
    m.cube(a, W(6), K(17.5), fz - W(3.5), ex, K(20.5), fz + 1)                 # the right forearm, forward
    m.cube(a, W(6.5), K(17.5), fz - W(5.5), ex - 0.5, K(21.5), fz - W(3.5), "pale")   # the right hand round the staff
    sx = r((W(6.5) + ex - 0.5) / 2)
    m.cube(a, sx - 1, 0, fz - W(5) , sx + 1, K(52), fz - W(4), "staff")       # the staff, foot on the plinth
    m.cube(a, sx - 2, K(52), fz - W(5.5) - 0.5, sx + 2, K(52) + 3, fz - W(3.5) + 0.5, "staff")   # its head
    m.cube(a, -W(8.8), K(14.5), -W(2), -W(6.8), K(16.5), W(1.5), "pale")       # the left hand hangs at his side
    a = m.bone("arms_sword", "body")
    m.cube(a, W(2), K(15), fz - W(2.5), W(8), K(18), fz + 0.5)                 # forearms down to the hilt
    m.cube(a, -W(8), K(15), fz - W(2.5), -W(2), K(18), fz + 0.5)
    m.cube(a, -W(2.5), K(14), fz - W(4), W(2.5), K(18), fz - W(1.5), "pale")   # both hands on the hilt
    m.cube(a, -1, 0, fz - W(3.5), 1, K(14), fz - W(2.5), "staff")              # the blade, point down on the plinth
    m.cube(a, -W(4), K(13), fz - W(4), W(4), K(14), fz - W(2), "staff")        # the crossguard
    m.cube(a, -1, K(18), fz - W(3.5), 1, K(20), fz - W(2), "staff")            # the pommel
    a = m.bone("arms_bowl", "body")
    m.cube(a, W(3), K(20), fz - W(4), W(8), K(23), fz + 0.5)                   # forearms held out
    m.cube(a, -W(8), K(20), fz - W(4), -W(3), K(23), fz + 0.5)
    m.cube(a, W(1), K(20), fz - W(5.5), W(4), K(23), fz - W(3.5), "pale")      # the hands under the bowl
    m.cube(a, -W(4), K(20), fz - W(5.5), -W(1), K(23), fz - W(3.5), "pale")
    m.cube(a, -W(4.5), K(22.5), fz - W(9), W(4.5), K(25), fz - W(3), "bowl")   # the bowl
    m.cube(a, -W(5), K(25), fz - W(9.5), W(5), K(26), fz - W(2.5), "bowl")     # its lip
    rub = m.bone("rubble", "root")
    for (x, z, w, h) in ((-W(9), -W(7), 3, 2), (W(7), -W(6), 4, 2), (W(6), W(6), 3, 3), (-W(8), W(5), 2, 2)):
        m.cube(rub, x, 0, z, x + w, h, z + w, "rubble")
    return m


def pack(m):
    """Shelf-pack every face into one skin, each with a one-texel gutter round it; returns the skin's size."""
    faces = sorted(m.faces, key=lambda f: -f[3])
    W = 128
    while True:
        x = y = row = 0; spots = []
        for f in faces:
            w, h = f[2] + 2, f[3] + 2
            if x + w > W: x = 0; y += row; row = 0
            spots.append((x + 1, y + 1)); x += w; row = max(row, h)
        H = y + row
        if H <= W: break
        W *= 2
    H = 1 << max(4, math.ceil(math.log2(max(1, H))))
    for (c, fn, w, h, mat), (u, v) in zip(faces, spots):
        c["uv"][fn] = {"uv": [u, v], "uv_size": [w, h]}
        c.setdefault("_faces", {})[fn] = (u, v, w, h, mat)
    return W, H


def paint(m, W, H, seed):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = im.load()
    rnd = random.Random(seed)
    for b in m.bones:
        for c in b["cubes"]:
            oy = c["origin"][1]
            for fn, (u, v, w, h, mat) in c["_faces"].items():
                base, grain = MATS[mat]
                for j in range(h):
                    for i in range(w):
                        # the sand wore the lower robe darker and rougher; strata run across; chips here and there
                        yy = oy + (h - 1 - j) if fn not in ("up", "down") else oy
                        wear = max(0.0, 1 - yy / 18) * 0.07 * grain
                        strata = 0.025 * grain * math.sin(yy * 1.7 + (u % 7))
                        n = (rnd.random() - 0.5) * 0.09 * grain
                        f = 1 + strata + n - wear
                        if fn == "up": f += 0.04
                        if fn == "down": f -= 0.08
                        if grain >= 0.8 and rnd.random() < 0.035: f -= 0.14              # a chip
                        if mat == "pale" and fn == "north": f -= 0.16 * max(0.0, 1 - j / max(1, h * 0.6))   # the hood's shadow over the face
                        px[u + i, v + j] = tuple(max(0, min(255, round(ch * f))) for ch in base) + (255,)
    # spread each face's edge into the empty skin round it, so a mipmap never mixes black into an edge
    for _ in range(3):
        src = im.copy(); sp = src.load()
        for y in range(H):
            for x in range(W):
                if sp[x, y][3]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if 0 <= x + dx < W and 0 <= y + dy < H and sp[x + dx, y + dy][3]:
                        px[x, y] = sp[x + dx, y + dy]; break
    return im


def geo(m, W, H):
    """The Blockbench / Bedrock geometry (format 1.12.0, per-face UVs)."""
    bones = []
    for b in m.bones:
        nb = {k: v for k, v in b.items() if k != "cubes"}
        if b["cubes"]:
            nb["cubes"] = [{"origin": c["origin"], "size": c["size"], "uv": c["uv"]} for c in b["cubes"]]
        bones.append(nb)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.siege_faceless_statue_{m.name}", "texture_width": W, "texture_height": H,
                        # in blocks, round the entity, covering the biggest statue standing (the Gate's, 7.3x) or lying down
                        "visible_bounds_width": 44, "visible_bounds_height": 34, "visible_bounds_offset": [0, 14, 0]},
        "bones": bones}]}


def core(m):
    """The solid core the game fills with barrier blocks so nobody walks through the figure: half-width of the skirt and
    the height of the shoulders, in model pixels (the script turns them into blocks at the statue's size)."""
    s = AGE_SHAPE[m.name]; k = s["k"]; sl = s["slim"]
    return {"half": r(5 * k * sl), "knee": r(13 * k), "shoulder": r(31 * k), "top": r((31 + 11.5 * s["head"]) * k), "depth": r(4.5 * k * sl)}


def game_files():
    """The entity, its client file, render controller and animation, from statue_mesh's VISIBLE and POSE tables."""
    sys.path.insert(0, HERE)
    from statue_mesh import VISIBLE, POSE
    ent = {"format_version": "1.21.60", "minecraft:entity": {
        "description": {"identifier": "siege:faceless_statue", "is_spawnable": False, "is_summonable": True, "properties": {
            "siege:age": {"type": "int", "range": [0, len(AGES) - 1], "default": 3, "client_sync": True},
            "siege:hold": {"type": "int", "range": [0, len(HOLDS) - 1], "default": 0, "client_sync": True},
            "siege:wear": {"type": "int", "range": [0, len(WEARS) - 1], "default": 0, "client_sync": True},
            "siege:size": {"type": "float", "range": [0.5, 12.0], "default": 5.0, "client_sync": True}}},
        "components": {
            "minecraft:type_family": {"family": ["faceless_statue", "inanimate"]},
            "minecraft:health": {"value": 20, "max": 20},
            # a small box at the feet, inside the barrier core the script lays: nothing can hit, push or stand in it
            "minecraft:collision_box": {"width": 0.4, "height": 0.4},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:movement": {"value": 0},
            "minecraft:persistent": {},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "suffocate_time": -1},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]}}}}
    client = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "siege:faceless_statue",
        "materials": {"default": "entity"},
        "textures": {f"t{i}": f"textures/entity/statues/faceless_statue_{a}" for i, a in enumerate(AGES)},
        "geometry": {f"g{i}": f"geometry.siege_faceless_statue_{a}" for i, a in enumerate(AGES)},
        "animations": {"pose": "animation.siege_faceless_statue.pose"},
        "scripts": {"animate": ["pose"]},
        "enable_attachables": False,
        "render_controllers": ["controller.render.siege_faceless_statue"]}}}
    rc = {"format_version": "1.8.0", "render_controllers": {"controller.render.siege_faceless_statue": {
        "arrays": {"textures": {"Array.skins": [f"Texture.t{i}" for i in range(len(AGES))]},
                   "geometries": {"Array.shapes": [f"Geometry.g{i}" for i in range(len(AGES))]}},
        "geometry": "Array.shapes[q.property('siege:age')]",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.skins[q.property('siege:age')]"],
        "part_visibility": [{"*": True}] + [{bone: m} for bone, (m, _) in VISIBLE.items()]}}}
    anim = {"format_version": "1.8.0", "animations": {"animation.siege_faceless_statue.pose": {"loop": True, "bones": POSE}}}
    files = {"Siege_Nights_BP/entities/statues/faceless_statue.json": ent,
             "Siege_Nights_RP/entity/statues/faceless_statue.entity.json": client,
             "Siege_Nights_RP/render_controllers/siege_faceless_statue.render_controllers.json": rc,
             "Siege_Nights_RP/animations/faceless_statue.animation.json": anim}
    for path, data in files.items():
        os.makedirs(os.path.dirname(os.path.join(REPO, path)), exist_ok=True)
        json.dump(data, open(os.path.join(REPO, path), "w"), indent=2)


def build():
    out = {}
    for i, age in enumerate(AGES):
        m = figure(age)
        W, H = pack(m)
        im = paint(m, W, H, 70 + i)
        os.makedirs(os.path.join(RP, "models/entity/statues"), exist_ok=True)
        os.makedirs(os.path.join(RP, "textures/entity/statues"), exist_ok=True)
        json.dump(geo(m, W, H), open(os.path.join(RP, f"models/entity/statues/faceless_statue_{age}.geo.json"), "w"), indent=1)
        im.save(os.path.join(RP, f"textures/entity/statues/faceless_statue_{age}.png"))
        out[age] = core(m)
        print(age, f"{W}x{H}", sum(len(b["cubes"]) for b in m.bones), "cubes")
    js = ("// Generated by studio/statues/build_statues.py. Do not edit by hand.\n"
          "// Per age, in model pixels: the skirt's half-width and depth, the knee, the shoulders and the top of the head.\n"
          f"export const CORE = {json.dumps(out, separators=(',', ':'))};\n")
    os.makedirs(os.path.join(BP, "scripts/statues"), exist_ok=True)
    open(os.path.join(BP, "scripts/statues/model_data.js"), "w").write(js)
    game_files()


if __name__ == "__main__":
    build()
