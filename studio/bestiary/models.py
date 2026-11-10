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

    def pose(self, bone, rotation):
        """Rest-pose rotation for a bone (animations add to it)."""
        next(b for b in self.bones if b["name"] == bone)["rotation"] = rotation

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

    def deflicker(self, step=0.12, near=0.06):
        """No two faces may share a plane (that flickers in game). Later cubes are the overlays, so each one
        is puffed out a hair until none of its faces lies on a face of an earlier cube in the same pose."""
        bones = {b["name"]: b for b in self.bones}
        def key(b):
            k = []
            while b:
                if any(b.get("rotation") or [0]): k.append((tuple(b["rotation"]), tuple(b["pivot"])))
                b = bones.get(b.get("parent"))
            return tuple(k)
        owner = {id(c): key(b) for b in self.bones for c in b["cubes"]}
        def span(c, inf):
            return [c["origin"][k] - inf for k in range(3)], [c["origin"][k] + c["size"][k] + inf for k in range(3)]
        done = []
        for c in self.cubes:
            if c.get("rotation"): continue
            base = c.get("inflate", 0); rk = owner[id(c)]
            for n in range(12):
                lo, hi = span(c, base + n * step); clash = False
                for (lo2, hi2, rk2) in done:
                    if rk2 != rk: continue
                    for ax in range(3):
                        if abs(lo[ax] - lo2[ax]) >= near and abs(hi[ax] - hi2[ax]) >= near: continue
                        if all(min(hi[k], hi2[k]) - max(lo[k], lo2[k]) > 0.01 for k in range(3) if k != ax): clash = True; break
                    if clash: break
                if not clash: break
            if n: c["inflate"] = round(base + n * step, 2)
            done.append((lo, hi, rk))

    def geometry(self, ident):
        self.deflicker()
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
# The plans build a full silhouette, not a stack of six boxes: shoulders, bracers, hands, a belt, boots
# with toes, a nose. Mobs then add what makes them themselves (helms, cloaks, horns, weapons in the hand).
def biped(m, L=12, B=12, bw=8, bd=4, head=(8, 8, 8), arm=(4, 12, 4), mats=None, face="eyes", arm_len=None, gap=0, nose=None, detail=True):
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
    m.d = dict(L=L, B=B, bw=bw, bd=bd, head=head, top=L + B + hh, sx=sx, aw=aw, ah=ah, ad=ad, lw=lw)
    if not detail: return m.d
    if nose if nose is not None else (face in ("eyes", "hollow") and hw >= 7):
        m.box("head", [-1, L + B + hh // 2 - 2, -hd / 2 - 1], [2, 2, 1], hm)
    m.box("body", [-1.5, L + B - 1, -1.5], [3, 2, 3], hm)                                   # neck
    if bw >= 7:
        m.box("body", [-bw / 2 + 1, L + B - 6, -bd / 2 - 1], [bw - 2, 5, 1], bm)            # chest
        m.box("body", [-bw / 2 + 1, L + B - 7, bd / 2], [bw - 2, 6, 1], bm)                 # shoulder blades
        m.box("body", [-bw / 2, L, -bd / 2], [bw, 2, bd], mats.get("belt", lm), inflate=0.3)   # hips / belt
    if aw >= 3 and ah >= 10:
        sh, br = mats.get("shoulder", am), mats.get("bracer", am)
        for s, nm in ((-1, "arm_r"), (1, "arm_l")):
            x = -(sx + aw) if s < 0 else sx
            m.box(nm, [x, L + B - 3, -ad / 2], [aw, 3, ad], sh, inflate=0.5, mirror=s > 0)                 # shoulder
            m.box(nm, [x, L + B - ah + 3, -ad / 2], [aw, 4, ad], br, inflate=0.3, mirror=s > 0)            # bracer
    if lm != bm and L >= 8:
        bt = mats.get("boot", "boot" if "boot" in m.palette else lm)
        for s, nm in ((-1, "leg_r"), (1, "leg_l")):
            x = -lw if s < 0 else 0
            m.box(nm, [x, 0, -bd / 2], [lw, 5, bd], bt, inflate=0.3, mirror=s > 0)                         # boot
            m.box(nm, [x, 0, -bd / 2 - 2], [lw, 2, 2], bt, mirror=s > 0)                                   # toe
            m.box(nm, [x, L - 6, -bd / 2 - 0.5], [lw, 2, 1], lm, mirror=s > 0)                             # knee
    return m.d

def quadruped(m, legh=8, body=(8, 8, 16), head=(6, 6, 6), leg=(3, 3), mats=None, face="eyes", tail=True, neck=0, detail=True, ears=True):
    mats = mats or {}
    bw, bh, bl = body; hw, hh, hd = head; lw, ld = leg
    bm = mats.get("body", "fur"); hm = mats.get("head", bm); lm = mats.get("leg", bm)
    m.bone("root", [0, 0, 0])
    m.bone("body", [0, legh + bh / 2, 0], "root")
    m.box("body", [-bw / 2, legh, -bl / 2], [bw, bh, bl], bm)
    hy = legh + bh - hh / 2 + neck
    m.bone("head", [0, hy, -bl / 2], "body")
    if neck: m.box("head", [-2, legh + bh - 2, -bl / 2 - 3], [4, neck + 3, 4], bm)
    hz = -bl / 2 - hd + (1 if neck else 0)
    m.box("head", [-hw / 2, hy - hh / 2 + 1, hz], [hw, hh, hd], hm, face=face)
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * (bw / 2 - lw / 2); z = sz * (bl / 2 - ld / 2 - 1)
        m.bone(nm, [x, legh, z], "root")
        m.box(nm, [x - lw / 2, 0, z - ld / 2], [lw, legh, ld], lm, mirror=sx > 0, role="paw")
        if detail:
            m.box(nm, [x - lw / 2, legh - 4, z - ld / 2], [lw, 5, ld], bm, inflate=0.5, mirror=sx > 0)         # shoulder / haunch
            m.box(nm, [x - lw / 2, 0, z - ld / 2 - 1], [lw, 1, 1], lm, mirror=sx > 0)                           # toes
    if tail:
        m.bone("tail", [0, legh + bh - 1, bl / 2], "body")
        m.box("tail", [-1, legh + bh - 8, bl / 2], [2, 8, 2], mats.get("tail", bm), rot=[30, 0, 0], pivot=[0, legh + bh - 1, bl / 2])
        if detail: m.box("tail", [-1.5, legh + bh - 11, bl / 2 + 3], [3, 4, 3], mats.get("tail", bm), rot=[30, 0, 0], pivot=[0, legh + bh - 1, bl / 2])
    if detail:
        top = hy + hh / 2 + 1
        m.box("head", [-hw / 2 + 1, hy - hh / 2 + 1, hz - 3], [hw - 2, hh - 3, 3], mats.get("snout", hm))        # muzzle
        m.box("head", [-1, hy - hh / 2 + hh - 3, hz - 3.5], [2, 1, 1], mats.get("nose", "nose" if "nose" in m.palette else hm))
        if ears:
            for s in (-1, 1): m.box("head", [s * (hw / 2 - 1) - 1, top, hz + hd - 3], [2, 3, 1], hm, mirror=s > 0)
        m.box("body", [-bw / 2 + 1, legh + bh, -bl / 2 + 1], [bw - 2, 1, bl - 3], bm)                             # back
        m.box("body", [-bw / 2, legh + 1, -bl / 2 - 1], [bw, bh - 1, 2], bm, inflate=0.4)                         # chest
    m.d = dict(legh=legh, bw=bw, bh=bh, bl=bl, hy=hy, hd=hd, hh=hh, hw=hw, hz=hz)
    return m.d

# ---------- things in the hand ----------
# hold() puts a real weapon in a biped's hand and bends the arm so it is carried, not dragged.
# Blades and hafts point forward out of the fist; staffs, torches and bows stand upright.
def hold(m, kind, side="r", bone=None, bend=28, long=None, **mat):
    d = m.d; s = -1 if side == "r" else 1; arm = "arm_r" if side == "r" else "arm_l"
    hx = s * (d["sx"] + d["aw"] / 2); hy = d["L"] + d["B"] - d["ah"] + 1.5
    name = bone or kind
    upright = kind in ("staff", "torch", "bow", "pole")
    m.pose(arm, [-bend, 0, 0])
    m.bone(name, [hx, hy, 0], arm, rotation=[bend, 0, 0] if upright else None)
    B = lambda o, sz, mt, **k: m.box(name, o, sz, mat.get(mt, mt), **k)
    if kind == "sword":
        n = long or 14
        B([hx - 0.5, hy - 0.5, -2], [1, 1, 4], "hilt"); B([hx - 1, hy - 1, 2], [2, 2, 1], "pommel" if "pommel" in mat else "hilt")
        B([hx - 2.5, hy - 0.5, -3], [5, 1, 1], "hilt"); B([hx - 0.5, hy - 1.5, -3], [1, 3, 1], "hilt")        # cross-guard
        B([hx - 0.5, hy - 1, -3 - n], [1, 2, n], "blade"); B([hx - 0.5, hy - 0.5, -5 - n], [1, 1, 2], "blade")  # blade and point
    elif kind == "greatsword":
        n = long or 22
        B([hx - 0.5, hy - 0.5, -3], [1, 1, 7], "hilt"); B([hx - 1.5, hy - 1.5, 4], [3, 3, 2], "hilt")
        B([hx - 4.5, hy - 1, -4.5], [9, 2, 2], "hilt"); B([hx - 5.5, hy - 1.5, -5], [2, 3, 2], "hilt"); B([hx + 3.5, hy - 1.5, -5], [2, 3, 2], "hilt")
        B([hx - 1, hy - 1.5, -4 - n], [2, 3, n], "blade"); B([hx - 0.5, hy - 2, -4 - n + 2], [1, 4, n - 4], "edge" if "edge" in mat else "blade")
        B([hx - 1, hy - 1, -6 - n], [2, 2, 2], "blade"); B([hx - 0.5, hy - 0.5, -8 - n], [1, 1, 2], "blade")
    elif kind == "axe":
        n = long or 16
        B([hx - 0.5, hy - 0.5, -n + 3], [1, 1, n], "haft")
        # the head: the blade hangs BELOW the haft with its flared edge lowest (it leads on a downswing), a small spike on top
        B([hx - 0.5, hy - 4.5, -n + 3], [1, 4, 4], "blade"); B([hx - 0.5, hy - 6.5, -n + 2], [1, 2, 6], "blade"); B([hx - 0.5, hy + 0.5, -n + 3.5], [1, 2, 2], "blade")
    elif kind == "mace":
        n = long or 12
        B([hx - 0.5, hy - 0.5, -n + 3], [1, 1, n], "haft"); B([hx - 2, hy - 2, -n - 1], [4, 4, 4], "blade")
        for ox, oy in ((-3, -0.5), (2, -0.5), (-0.5, -3), (-0.5, 2)): B([hx + ox, hy + oy, -n + 0.5], [1, 1, 1], "blade")
        B([hx - 0.5, hy - 0.5, -n - 2], [1, 1, 1], "blade")
    elif kind == "spear":
        n = long or 34
        B([hx - 0.5, hy - 0.5, -n + 12], [1, 1, n], "haft"); B([hx - 1, hy - 1, -n + 8], [2, 2, 4], "blade"); B([hx - 0.5, hy - 0.5, -n + 5], [1, 1, 3], "blade")
        B([hx - 1, hy - 1, -n + 12], [2, 2, 1], "hilt" if "hilt" in mat else "haft")
    elif kind == "club":
        n = long or 14
        B([hx - 0.5, hy - 0.5, -3], [1, 1, 6], "haft"); B([hx - 1, hy - 1, -n + 3], [2, 2, n - 6], "haft"); B([hx - 1.5, hy - 1.5, -n], [3, 3, 4], "haft")
    elif kind == "staff":
        n = long or 30
        B([hx - 0.5, hy - 10, -0.5], [1, n, 1], "haft"); B([hx - 1, hy - 10 + n - 1, -1], [2, 1, 2], "haft")
        if "orb" in mat or "orb" in m.palette:
            B([hx - 1.5, hy - 10 + n, -1.5], [3, 3, 3], "orb"); B([hx - 2.5, hy - 10 + n - 2, -0.5], [1, 4, 1], "haft"); B([hx + 1.5, hy - 10 + n - 2, -0.5], [1, 4, 1], "haft")
    elif kind == "torch":
        B([hx - 0.5, hy - 3, -0.5], [1, 11, 1], "haft"); B([hx - 1, hy + 7, -1], [2, 2, 2], "wrap" if "wrap" in mat else "haft")
        B([hx - 1.5, hy + 9, -1.5], [3, 3, 3], "flame"); B([hx - 1, hy + 12, -1], [2, 2, 2], "flame"); B([hx - 0.5, hy + 14, -0.5], [1, 2, 1], "flame")
    elif kind == "bow":
        bow_shape(m, name, hx, hy, 0, long or 20, mat.get("haft", "haft"), mat.get("string", mat.get("haft", "haft")))
    elif kind == "crossbow":
        B([hx - 0.5, hy - 0.5, -9], [1, 2, 12], "haft"); B([hx - 5.5, hy + 0.5, -9], [11, 1, 1], "haft"); B([hx - 6.5, hy + 0.5, -8], [1, 1, 2], "haft"); B([hx + 5.5, hy + 0.5, -8], [1, 1, 2], "haft")
        B([hx - 0.5, hy + 1.5, -8], [1, 1, 7], "blade")
    return name

def bow_shape(m, bone, x, y, z, n, haft, string):
    """An upright recurve bow centred on (x, y, z): grip, two limbs that sweep back, and the string."""
    h2 = n // 2
    m.box(bone, [x - 0.5, y - 2, z - 1.5], [1, 4, 1], haft)
    for sg in (1, -1):
        m.box(bone, [x - 0.5, y + 2 if sg > 0 else y - 2 - (h2 - 5), z - 1], [1, h2 - 5, 1], haft)
        m.box(bone, [x - 0.5, y + (h2 - 3) if sg > 0 else y - h2, z], [1, 3, 1], haft)
    m.box(bone, [x, y - h2, z + 1], [0, n, 1], string)

def shield(m, side="l", bone="shield", size=(10, 14), kite=False, **mat):
    """A shield strapped to the forearm, facing outward, with a rim and a boss."""
    d = m.d; s = -1 if side == "r" else 1; arm = "arm_r" if side == "r" else "arm_l"
    w, h = size; x = s * (d["sx"] + d["aw"]) + (0.5 if s > 0 else -1.5)
    # centred on the forearm, never higher than the shoulder, never dragging on the ground
    top = d["L"] + d["B"]; y = round(min(top - d["ah"] * 0.62 - h / 2, top - 2 - h)); y = max(y, 6 if kite else 1)
    m.bone(bone, [x, y + h / 2, 0], arm)
    B = lambda o, sz, mt, **k: m.box(bone, o, sz, mat.get(mt, mt), **k)
    B([x, y, -w / 2], [1, h, w], "shield")
    ox = x + s                                                           # one pixel proud of the board
    B([ox, y + h - 1, -w / 2], [1, 1, w], "trim"); B([ox, y, -w / 2], [1, 1, w], "trim"); B([ox, y + 1, -w / 2], [1, h - 2, 1], "trim"); B([ox, y + 1, w / 2 - 1], [1, h - 2, 1], "trim")
    B([ox, y + h / 2 - 1.5, -1.5], [1, 3, 3], "trim"); B([ox + s, y + h / 2 - 0.5, -0.5], [1, 1, 1], "trim")     # boss
    if kite: B([x, y - 3, -w / 2 + 2], [1, 3, w - 4], "shield"); B([x, y - 5, -w / 2 + 4], [1, 2, max(1, w - 8)], "shield")
    return bone

def cloak(m, mat, length=None, width=None, bone="cloak", hood=False):
    """A cloak that hangs off the shoulders in three widening folds, standing off the back."""
    d = m.d; top = d["L"] + d["B"]; n = length or (top - 3); w = width or d["bw"] + 2; z = d["bd"] / 2 + 1
    m.bone(bone, [0, top - 1, z], "body", rotation=[-7, 0, 0])
    third = max(2, n // 3)
    m.box(bone, [-w / 2, top - third, z], [w, third, 1], mat)
    m.box(bone, [-w / 2 - 1, top - 2 * third, z], [w + 2, third, 1], mat)
    m.box(bone, [-w / 2 - 2, top - n, z], [w + 4, n - 2 * third, 1], mat)
    m.box(bone, [-w / 2 - 1, top - 1, -d["bd"] / 2 - 1], [w + 2, 2, d["bd"] + 3], mat)                 # mantle over the shoulders
    if hood:
        hw, hh, hd = d["head"]
        m.box("head", [-hw / 2 - 0.5, top, -hd / 2 + 1], [hw + 1, hh + 1, hd], mat); m.box("head", [-hw / 2 - 0.5, top + hh - 1, -hd / 2 - 1], [hw + 1, 2, 2], mat)
        m.box("head", [-hw / 2 + 1, top + 1, hd / 2 + 1], [hw - 2, hh - 3, 1], mat)
    return bone

def horns(m, mat, y=None, spread=None, up=5, out=3, bone="head", z=-1):
    """A pair of horns: out from the temples, then up, then a tip."""
    d = m.d; hw, hh, hd = d["head"]; y = y if y is not None else d["L"] + d["B"] + hh - 3; sp = spread if spread is not None else hw / 2
    for s in (-1, 1):
        x = s * sp
        m.box(bone, [x - (out if s < 0 else 0), y, z], [out, 2, 2], mat, mirror=s > 0)
        m.box(bone, [x + s * out - (1 if s < 0 else -0) - (0 if s < 0 else 1), y + 1, z], [2, up, 2], mat, mirror=s > 0)
        m.box(bone, [x + s * out - (0.5 if s < 0 else 0.5), y + 1 + up, z + 0.5], [1, 2, 1], mat, mirror=s > 0)
