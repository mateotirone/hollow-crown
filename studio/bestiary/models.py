# Box-model builder for the Hollow Crown bestiary.
# A Model is a list of bones made of cubes. Each cube names a material ("mat"), and the
# placeholder texture paints every cube from the creature's palette, so final art can replace
# the PNG later without touching the geometry (same file name, same size).
import random
from PIL import Image

class Model:
    def __init__(self, name, palette, seed=1):
        self.name = name; self.palette = palette; self.bones = []; self.cubes = []
        self.rnd = random.Random(seed)

    def bone(self, name, pivot, parent=None, rotation=None):
        b = {"name": name, "pivot": [float(p) for p in pivot], "cubes": []}
        if parent: b["parent"] = parent
        if rotation: b["rotation"] = rotation
        self.bones.append(b); return name

    def box(self, bone, origin, size, mat, inflate=0, mirror=False, face=None, rot=None, pivot=None):
        size = [int(round(s)) for s in size]
        c = {"origin": [float(o) for o in origin], "size": size, "_mat": mat, "_face": face}
        if inflate: c["inflate"] = inflate
        if mirror: c["mirror"] = True
        if rot: c["rotation"] = rot; c["pivot"] = [float(p) for p in (pivot or origin)]
        next(b for b in self.bones if b["name"] == bone)["cubes"].append(c)
        self.cubes.append(c)

    # ---------- UV packing + texture ----------
    def pack(self):
        cubes = sorted(self.cubes, key=lambda c: -(c["size"][2] + c["size"][1]))
        for W in (64, 128, 256, 512):
            x = y = row = 0; ok = True; spots = []
            for c in cubes:
                w, h, d = c["size"]
                rw, rh = max(1, 2 * (w + d)), max(1, d + h)
                if rw > W: ok = False; break
                if x + rw > W: x = 0; y += row; row = 0
                spots.append((c, x, y)); x += rw; row = max(row, rh)
            H = y + row
            if ok and H <= W:
                Hp = 32 if H <= 32 and W == 64 else W
                for c, u, v in spots: c["uv"] = [u, v]
                self.tw, self.th = W, Hp
                return
        raise Exception("model too big " + self.name)

    def geometry(self, ident):
        self.pack()
        bones = []
        for b in self.bones:
            bb = {k: v for k, v in b.items() if k != "cubes"}
            bb["cubes"] = [{k: v for k, v in c.items() if not k.startswith("_")} for c in b["cubes"]]
            bones.append(bb)
        xs = [abs(c["origin"][0]) + c["size"][0] for c in self.cubes]
        ys = [c["origin"][1] + c["size"][1] for c in self.cubes]
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": ident, "texture_width": self.tw, "texture_height": self.th,
                            "visible_bounds_width": round(max(xs) / 8 + 1, 1), "visible_bounds_height": round(max(ys) / 16 + 1, 1),
                            "visible_bounds_offset": [0, round(max(ys) / 32, 1), 0]},
            "bones": bones}]}

    def texture(self, palette=None):
        pal = palette or self.palette
        im = Image.new("RGBA", (self.tw, self.th), (0, 0, 0, 0)); px = im.load()
        for c in self.cubes:
            w, h, d = c["size"]; u, v = c["uv"]
            for f, (fx, fy, fw, fh) in faces(u, v, w, h, d).items():
                for yy in range(fh):
                    for xx in range(fw):
                        col = paint(self.rnd, pal, c["_mat"], c.get("_face"), f, xx, yy, fw, fh)
                        if col is not None and 0 <= fx + xx < self.tw and 0 <= fy + yy < self.th:
                            px[fx + xx, fy + yy] = col
        return im

def faces(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h),
            "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}

def cl(c): return tuple(max(0, min(255, int(x))) for x in c)

def paint(rnd, pal, mat, face, f, x, y, w, h):
    spec = pal.get(mat, (255, 0, 255))
    style = "plain"
    if isinstance(spec, dict): style = spec.get("style", "plain"); base = spec["c"]
    else: base = spec
    alpha = base[3] if len(base) == 4 else 255
    k = 1.0
    if f == "up": k = 1.15
    elif f == "down": k = 0.7
    else: k = 1.08 - 0.25 * (y / max(h - 1, 1))
    n = rnd.randint(-7, 7)
    if style == "metal":
        if y == 0 or (f not in ("up", "down") and y == h - 1): k *= 0.75
        if f not in ("up", "down") and x % 4 == 1 and y % 4 == 1: k *= 1.35
        n = rnd.randint(-3, 3)
    elif style == "fur":
        n = rnd.randint(-16, 10); k *= 0.92 if (x + y * 3) % 5 == 0 else 1
    elif style == "wood":
        k *= 0.85 if x % 3 == 0 else 1; n = rnd.randint(-5, 5)
    elif style == "stone":
        n = rnd.randint(-18, 18)
    elif style == "glow":
        k = 1.0; n = rnd.randint(-10, 10)
    elif style == "cloth":
        if f not in ("up", "down") and y == h - 1: k *= 0.7
    elif style == "bone":
        k *= 1.0 if y % 3 else 0.88
    col = cl([c * k + n for c in base[:3]]) + (alpha,)
    # faces: eyes on the front of a head
    if face and f == "north":
        eye = pal.get("eye", (240, 240, 230))
        ey = max(1, h * 3 // 8) if face != "low" else max(1, h // 2)
        if face in ("eyes", "low", "glow") and y == ey and (x == w // 2 - 2 or x == w // 2 + 1) and w >= 6:
            return cl(eye) + (255,)
        if face in ("eyes", "low", "glow") and y == ey and (x == w // 2 - 1 or x == w // 2) and w >= 6 and face == "glow":
            return cl([c * 0.4 for c in base[:3]]) + (255,)
        if face == "hollow" and ey <= y <= ey + 1 and (x in (w // 2 - 2, w // 2 - 1, w // 2 + 1, w // 2)) and w >= 6:
            return (12, 10, 14, 255) if y == ey + 1 or x in (w // 2 - 1, w // 2) else cl(eye) + (255,)
        if face == "visor" and y == ey and 1 <= x <= w - 2:
            return (14, 12, 16, 255) if x not in (2, w - 3) else cl(eye) + (255,)
        if face == "clock":
            cx, cy = (w - 1) / 2, (h - 1) / 2; r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if r > min(w, h) / 2: return cl([c * 0.6 for c in base[:3]]) + (255,)
            if abs(r - min(w, h) / 2 + 1) < 0.6 and (round(x - cx) == 0 or round(y - cy) == 0): return (40, 30, 20, 255)
            if (round(x - cx) == 0 and y <= cy) or (round(y - cy) == 0 and x >= cx): return (30, 24, 18, 255)
            return cl((230, 220, 190)) + (255,)
        if face == "blank":
            return col
        if face == "mouth" and y == h - 2 and 1 <= x <= w - 2:
            return (30, 10, 12, 255)
    return col

# ---------- body plans ----------
def biped(m, L=12, B=12, bw=8, bd=4, head=(8, 8, 8), arm=(4, 12, 4), mats=None, face="eyes", arm_len=None, gap=0):
    mats = mats or {}
    hm, bm, am, lm = mats.get("head", "skin"), mats.get("body", "cloth"), mats.get("arm", mats.get("body", "cloth")), mats.get("leg", "pants")
    aw, ah, ad = arm; ah = arm_len or ah
    hw, hh, hd = head
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, L, 0], "root")
    m.box("body", [-bw / 2, L, -bd / 2], [bw, B, bd], bm)
    m.bone("head", [0, L + B, 0], "body")
    m.box("head", [-hw / 2, L + B, -hd / 2], [hw, hh, hd], hm, face=face)
    sx = bw / 2 + gap
    m.bone("arm_r", [-(sx + aw / 2), L + B - 2, 0], "body")
    m.box("arm_r", [-(sx + aw), L + B - ah, -ad / 2], [aw, ah, ad], am)
    m.bone("arm_l", [sx + aw / 2, L + B - 2, 0], "body")
    m.box("arm_l", [sx, L + B - ah, -ad / 2], [aw, ah, ad], am, mirror=True)
    lw = bw / 2
    m.bone("leg_r", [-lw / 2, L, 0], "root")
    m.box("leg_r", [-lw, 0, -bd / 2], [lw, L, bd], lm)
    m.bone("leg_l", [lw / 2, L, 0], "root")
    m.box("leg_l", [0, 0, -bd / 2], [lw, L, bd], lm, mirror=True)
    return dict(L=L, B=B, bw=bw, bd=bd, head=head, top=L + B + hh, sx=sx, aw=aw, ah=ah)

def quadruped(m, legh=8, body=(8, 8, 16), head=(6, 6, 6), leg=(3, 3), mats=None, face="eyes", tail=True, neck=0):
    mats = mats or {}
    bw, bh, bl = body; hw, hh, hd = head; lw, ld = leg
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, legh + bh / 2, 0], "root")
    m.box("body", [-bw / 2, legh, -bl / 2], [bw, bh, bl], mats.get("body", "fur"))
    hy = legh + bh - hh / 2 + neck
    m.bone("head", [0, hy, -bl / 2], "body")
    if neck: m.box("head", [-2, legh + bh - 2, -bl / 2 - 3], [4, neck + 3, 4], mats.get("body", "fur"))
    m.box("head", [-hw / 2, hy - hh / 2 + 1, -bl / 2 - hd + (1 if neck else 0)], [hw, hh, hd], mats.get("head", mats.get("body", "fur")), face=face)
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * (bw / 2 - lw / 2); z = sz * (bl / 2 - ld / 2 - 1)
        m.bone(nm, [x, legh, z], "root")
        m.box(nm, [x - lw / 2, 0, z - ld / 2], [lw, legh, ld], mats.get("leg", mats.get("body", "fur")), mirror=sx > 0)
    if tail:
        m.bone("tail", [0, legh + bh - 1, bl / 2], "body")
        m.box("tail", [-1, legh + bh - 8, bl / 2], [2, 8, 2], mats.get("tail", mats.get("body", "fur")), rot=[30, 0, 0], pivot=[0, legh + bh - 1, bl / 2])
    return dict(legh=legh, bw=bw, bh=bh, bl=bl, hy=hy, hd=hd, hh=hh, hw=hw)
