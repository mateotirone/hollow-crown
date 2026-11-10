# Box-model builder for the Hollow Crown bestiary.
# A Model is a list of bones made of cubes. Each cube names a material ("mat"), and the
# placeholder texture paints every cube from the creature's palette, so final art can replace
# the PNG later without touching the geometry (same file name, same size).
import random
from PIL import Image
import skin

class Model:
    def __init__(self, name, palette, seed=1):
        self.name = name; self.palette = palette; self.bones = []; self.cubes = []
        self.rnd = random.Random(seed)

    def bone(self, name, pivot, parent=None, rotation=None):
        b = {"name": name, "pivot": [float(p) for p in pivot], "cubes": []}
        if parent: b["parent"] = parent
        if rotation: b["rotation"] = rotation
        self.bones.append(b); return name

    def box(self, bone, origin, size, mat, inflate=0, mirror=False, face=None, rot=None, pivot=None, role=None):
        size = [int(round(s)) for s in size]
        c = {"origin": [float(o) for o in origin], "size": size, "_mat": mat, "_face": face, "_role": role}
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
        for n, c in enumerate(self.cubes):
            w, h, d = c["size"]; u, v = c["uv"]; seed = (sum(map(ord, c["_mat"])) + n * 3) % 97
            for f, (fx, fy, fw, fh) in faces(u, v, w, h, d).items():
                for yy in range(fh):
                    for xx in range(fw):
                        col = skin.paint(pal, c, f, xx, yy, fw, fh, seed)
                        if 0 <= fx + xx < self.tw and 0 <= fy + yy < self.th: px[fx + xx, fy + yy] = col
        return im

def faces(u, v, w, h, d):
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h),
            "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}

# ---------- body plans ----------
def biped(m, L=12, B=12, bw=8, bd=4, head=(8, 8, 8), arm=(4, 12, 4), mats=None, face="eyes", arm_len=None, gap=0):
    mats = mats or {}
    hm, bm, am, lm = mats.get("head", "skin"), mats.get("body", "cloth"), mats.get("arm", mats.get("body", "cloth")), mats.get("leg", "pants")
    aw, ah, ad = arm; ah = arm_len or ah
    hw, hh, hd = head
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, L, 0], "root")
    m.box("body", [-bw / 2, L, -bd / 2], [bw, B, bd], bm, role="torso")
    m.bone("head", [0, L + B, 0], "body")
    m.box("head", [-hw / 2, L + B, -hd / 2], [hw, hh, hd], hm, face=face)
    sx = bw / 2 + gap
    m.bone("arm_r", [-(sx + aw / 2), L + B - 2, 0], "body")
    m.box("arm_r", [-(sx + aw), L + B - ah, -ad / 2], [aw, ah, ad], am, role="arm")
    m.bone("arm_l", [sx + aw / 2, L + B - 2, 0], "body")
    m.box("arm_l", [sx, L + B - ah, -ad / 2], [aw, ah, ad], am, mirror=True, role="arm")
    lw = bw / 2
    m.bone("leg_r", [-lw / 2, L, 0], "root")
    m.box("leg_r", [-lw, 0, -bd / 2], [lw, L, bd], lm, role="leg" if lm != bm else None)
    m.bone("leg_l", [lw / 2, L, 0], "root")
    m.box("leg_l", [0, 0, -bd / 2], [lw, L, bd], lm, mirror=True, role="leg" if lm != bm else None)
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
        m.box(nm, [x - lw / 2, 0, z - ld / 2], [lw, legh, ld], mats.get("leg", mats.get("body", "fur")), mirror=sx > 0, role="paw")
    if tail:
        m.bone("tail", [0, legh + bh - 1, bl / 2], "body")
        m.box("tail", [-1, legh + bh - 8, bl / 2], [2, 8, 2], mats.get("tail", mats.get("body", "fur")), rot=[30, 0, 0], pivot=[0, legh + bh - 1, bl / 2])
    return dict(legh=legh, bw=bw, bh=bh, bl=bl, hy=hy, hd=hd, hh=hh, hw=hw)
