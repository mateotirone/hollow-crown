#!/usr/bin/env python3
"""Builds the vault blocks (Mateo, 2026-11-12): where a settlement keeps its relics (the Choirsteel
template, the Heart of the Hollow, the Hollow Crown), and what an attacker brings to break in.

  siege:vault_door_<tier>      Strongroom Door: the centre of the 3x3 vault door (wheel, or the wooden door's lock).
  siege:vault_door_plate_<tier> the eight plates round it. Five tiers, each its own block so every tier shows in
                               the creative menu and the asset viewer: wood, iron, diamond, netherite, choirsteel.
                               Upgrading swaps the blocks for the next tier (script side, not written yet).
  The strongroom itself (the room these go in) is map/structures/vault_rooms.py.
  siege:vault_stone            Strongroom Stone: the iron-banded walls of the vault room.
  siege:regal_safe             Regal Safe: 2 wide, 3 high (siege:part 0-5), the owner's Regals. Only the vault builds it.
  siege:relic_coffer           Relic Coffer: the chest inside the vault the relics sit in. Glows when full.
  siege:vault_breaker_<tier>   Vault Breaker: the attacker's auger, set against a vault door. iron, diamond,
                               netherite (better breakers cut the time).

Shapes face north (the front is the -z side) and turn to face whoever places them, like the Tome Cache.
Only the blocks, shapes, textures, names, sounds and recipes are written here; how a siege uses them
waits on Mateo's siege decisions (player-sieges design doc). Safe to run again.

Run from the repo root:   python3 studio/build_vault.py
"""
import json, math, os, random, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "studio", "art"))
from palette import M, fixed, ramp  # noqa: E402
from PIL import Image  # noqa: E402

BP = os.path.join(ROOT, "Siege_Nights_BP")
RP = os.path.join(ROOT, "Siege_Nights_RP")
TEX = "textures/blocks/vault/"


def write_json(path, data, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=indent)
        f.write("\n")


# ---------------------------------------------------------------- colours
CHOIR = fixed("#241640", "#42287a", "#6a44b0", "#9a74dc", "#c4a8f4", "#ece0ff")   # sampled from the Choirsteel ingot
VAULT_STONE = ramp("#4a4850", 0.07, 0.50, cool=0.14, warm=0.02)                  # dark, cold strongroom stone
OAK = M["dark_oak"]

# tier -> body ramp, trim ramp, shown name, upgrade item, break-in seconds (design doc numbers)
TIERS = {
    "wood":       {"body": OAK,              "trim": M["iron"],      "name": "Wooden Strongroom Door",     "seconds": 30},
    "iron":       {"body": M["iron"],        "trim": M["steel"],     "name": "Iron Strongroom Door",       "seconds": 60},
    "diamond":    {"body": M["steel"],       "trim": M["diamond"],   "name": "Diamond Strongroom Door",    "seconds": 120},
    "netherite":  {"body": M["netherite"],   "trim": M["gold"],      "name": "Netherite Strongroom Door",  "seconds": 180},
    "choirsteel": {"body": CHOIR,            "trim": CHOIR,          "name": "Choirsteel Strongroom Door", "seconds": 240},
}
BREAKERS = {
    "iron":      {"metal": M["iron"],      "bit": M["steel"],     "name": "Iron Vault Breaker"},
    "diamond":   {"metal": M["steel"],     "bit": M["diamond"],   "name": "Diamond Vault Breaker"},
    "netherite": {"metal": M["netherite"], "bit": M["gold"],      "name": "Netherite Vault Breaker"},
}


# ---------------------------------------------------------------- textures (16x16)
def tex(name, paint, seed):
    r = random.Random(seed)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            c = paint(x, y, r)
            img.putpixel((x, y), tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,)))
    path = os.path.join(RP, TEX + name + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return f"siege_vault_{name}"


def jitter(r, ramp_, base, spread=1):
    return ramp_[max(0, min(len(ramp_) - 1, base + r.randint(-spread, spread) * (r.random() < 0.35)))]


def planks(R):
    # vertical boards with a dark seam every 4 px and two riveted iron bands across
    def paint(x, y, r):
        if y in (3, 12):
            return M["iron"][2] if x % 4 == 1 else M["iron"][3]
        if y in (2, 4, 11, 13) and x % 4 == 1:
            return M["iron"][1]
        if x % 4 == 0:
            return R[0]
        return jitter(r, R, 2 + (y * 7 + x * 3) % 3 // 2)
    return paint


def plate(R, T, rivets=True, inlay=None):
    # four riveted plates with bevelled edges; optional inlay pattern (diamond lozenge / choir veins)
    def paint(x, y, r):
        lx, ly = x % 8, y % 8
        if lx == 0 or ly == 0:
            return R[0]
        if lx == 7 or ly == 7:
            return R[1]
        if lx == 1 or ly == 1:
            return R[4]
        if rivets and lx in (2, 6) and ly in (2, 6):
            return T[4]
        if inlay and inlay(x, y):
            return T[3] if (x + y) % 2 else T[2]
        return jitter(r, R, 3 if (lx + ly) % 5 else 2)
    return paint


def lozenge(x, y):
    return abs((x % 8) - 4) + abs((y % 8) - 4) == 2


def veins(x, y):
    return (x * 3 + y * 5) % 11 == 0 or (x - y) % 13 == 0


def trim(T):
    # smooth worked metal: one tone, a lit top-left edge, a dark bottom-right edge, the odd glint
    def paint(x, y, r):
        if x == 0 or y == 0:
            return T[4]
        if x == 15 or y == 15:
            return T[1]
        if (x * 7 + y * 3) % 23 == 0:
            return T[5]
        return T[3] if (x + y) % 9 else T[2]
    return paint


def stone(R, bands=True):
    # big squared blocks, dark mortar, an iron strap across the middle
    def paint(x, y, r):
        if bands and y in (7, 8):
            if x % 5 == 2:
                return M["iron"][4]
            return M["iron"][1] if y == 8 else M["iron"][2]
        row = y // 4 if not bands else (0 if y < 7 else 1)
        off = 4 if row % 2 else 0
        if (y % 7 == 6 and y < 7) or y == 15 or (x + off) % 8 == 0:
            return R[0]
        return jitter(r, R, 2 + ((x * 5 + y * 3) % 4 == 0))
    return paint


def wood_frame(x, y, r):
    if y % 5 == 0:
        return OAK[0]
    return jitter(r, OAK, 2 if (x + y) % 3 else 3)


def glow(x, y, r):
    d = math.hypot(x - 7.5, y - 7.5)
    return CHOIR[5] if d < 3 else CHOIR[4] if d < 5.5 else CHOIR[3]


def coffer_body(x, y, r):
    if y in (0, 15) or x in (0, 15) or x in (7, 8):
        return M["iron"][2] if (x + y) % 4 else M["iron"][4]
    return jitter(r, OAK, 2 + (x % 3 == 0))


def cracks(stage):
    # transparent overlay: dark fracture lines spreading from the lock, more of them at stage 2
    lines = [(7, 7, 1, -1), (8, 8, -1, 1), (7, 8, -1, 0), (8, 7, 1, 1)] + ([(7, 7, -1, -1), (8, 8, 1, 0), (6, 9, 0, 1), (9, 6, 1, -1)] if stage == 2 else [])
    hit = set()
    for x0, y0, dx, dy in lines:
        x, y = x0, y0
        for i in range(6 + 2 * stage):
            hit.add((x, y))
            x += dx if i % 3 != 2 else 0
            y += dy if i % 3 != 1 else 0
    def paint(x, y, r):
        if (x, y) in hit:
            return (20, 18, 22, 230)
        if stage == 2 and any((x + a, y + b) in hit for a, b in ((1, 0), (0, 1))) and r.random() < 0.3:
            return (90, 86, 92, 160)
        return (0, 0, 0, 0)
    return paint


def build_textures():
    names = {}
    for i, (tier, t) in enumerate(TIERS.items()):
        body = planks(t["body"]) if tier == "wood" else plate(t["body"], t["trim"], True,
                                                              lozenge if tier == "diamond" else veins if tier == "choirsteel" else None)
        names[f"door_{tier}"] = tex(f"door_{tier}", body, 10 + i)
        names[f"trim_{tier}"] = tex(f"trim_{tier}", trim(t["trim"]), 20 + i)
    names["stone"] = tex("stone", stone(VAULT_STONE), 30)
    names["stone_plain"] = tex("stone_plain", stone(VAULT_STONE, bands=False), 31)
    names["frame_wood"] = tex("frame_wood", wood_frame, 32)
    names["glow"] = tex("glow", glow, 33)
    names["coffer"] = tex("coffer", coffer_body, 34)
    names["cracks_1"] = tex("cracks_1", cracks(1), 35)
    names["cracks_2"] = tex("cracks_2", cracks(2), 36)
    for i, (tier, b) in enumerate(BREAKERS.items()):
        names[f"breaker_{tier}"] = tex(f"breaker_{tier}", plate(b["metal"], b["metal"], True), 40 + i)
        names[f"bit_{tier}"] = tex(f"bit_{tier}", trim(b["bit"]), 50 + i)
    names.update(safe_textures())
    return names


# ---------------------------------------------------------------- the Regal Safe (2x2, only built in the vault)
SAFE = M["blacksteel"]
GOLD = M["gold"]


def safe_front_image():
    """The safe's whole 32x48 front (2 blocks wide, 3 tall), cut into six 16x16 tiles.
    Blackened steel, a gold-bevelled frame, a recessed door with three heavy gold hinges on the left, rivet rows,
    a dark ring for the dial (the dial itself is raised in the model) and a small crowned-coin plate above it."""
    r = random.Random(77)
    W, H = 32, 48
    img = Image.new("RGBA", (W, H))
    for y in range(H):
        for x in range(W):
            edge = min(x, y, W - 1 - x, H - 1 - y)
            d = math.hypot(x - 15.5, y - 23.5)
            if edge == 0:
                c = SAFE[0]
            elif edge == 1:
                c = GOLD[3] if (x + y) % 2 else GOLD[2]               # gold bevel round the front
            elif edge == 2:
                c = SAFE[1]
            elif edge == 3 or edge == 4 and (x in (4, W - 5) or y in (4, H - 5)):
                c = SAFE[4] if x < 16 and y < 24 else SAFE[2]         # door edge: lit top-left, shadowed bottom-right
            elif x in (5, 6) and any(h <= y <= h + 3 for h in (8, 22, 36)):
                c = GOLD[4] if x == 5 else GOLD[2]                     # hinges
            elif (edge == 6) and (x + y) % 4 == 0:
                c = GOLD[4]                                            # rivet row inside the door edge
            elif 6.5 <= d <= 8:
                c = SAFE[0]                                            # recess ring under the dial
            elif 11 <= x <= 20 and 9 <= y <= 12:
                c = GOLD[3] if (x, y) not in ((11, 9), (20, 9), (11, 12), (20, 12)) else SAFE[1]   # name plate
            else:
                c = SAFE[3] if (x * 5 + y * 3) % 17 == 0 else SAFE[2] if r.random() < 0.82 else SAFE[1]
            if 13 <= x <= 18 and 10 <= y <= 11:
                c = GOLD[5] if (x + y) % 2 else GOLD[1]                # the crowned coin on the plate
            img.putpixel((x, y), tuple(c[:3]) + (255,))
    return img


# part numbers, as seen from the front: 0/1 bottom left/right, 2/3 middle, 4/5 top
SAFE_PARTS = range(6)


def safe_textures():
    names = {}
    front = safe_front_image()
    for part in SAFE_PARTS:
        ox, oy = 16 * (part % 2), 32 - 16 * (part // 2)
        tile = front.crop((ox, oy, ox + 16, oy + 16))
        path = os.path.join(RP, TEX + f"safe_front_{part}.png")
        tile.save(path)
        names[f"safe_front_{part}"] = f"siege_vault_safe_front_{part}"
    names["safe_side"] = tex("safe_side", plate(SAFE, GOLD, True), 60)
    names["safe_gold"] = tex("safe_gold", trim(GOLD), 61)
    return names


def regal_safe():
    """Six blocks make one safe, 2 wide and 3 tall. Each block shows its own sixth (bone part<N>, chosen by the
    siege:part state); the dial sits across the two middle blocks, the handle reaches out to the right."""
    s = Shape("regal_safe")
    for part in SAFE_PARTS:
        b = f"part{part}"
        left = part % 2 == 0
        s.cube([-8, 0, -8], [16, 16, 16], "*", b)
        s.cube([-8, 0, -8.1], [16, 16, 0.1], f"front_{part}", b)
        if part in (2, 3):
            # half the dial on each middle block. Facing the safe, your left is the model's +x, so the left block's
            # inner edge is on its -x side
            cx, sx = (-8, 1) if left else (8, -1)
            for w, h, depth in ((6, 3, 1.5), (5, 5, 1.5), (3, 6, 1.5), (2, 2, 2.6)):   # stepped dial, knob on top
                x0 = cx if sx > 0 else cx - w
                s.cube([x0, 8 - h, -8.1 - depth], [w, 2 * h, depth], "gold", b)
        if part == 3:                                                 # the handle: a spoke out to your right and a grip
            s.cube([-4, 7.4, -10.3], [10, 1.2, 1.2], "gold", b)
            s.cube([-5.6, 5.5, -11.3], [1.6, 5, 1.6], "gold", b)
        if part in (0, 1):                                            # gold feet
            fx = 4 if part == 0 else -7
            s.cube([fx, 0, -7], [3, 1, 14], "gold", b)
        s.cube([-6, 3, -8.13], [12, 10, 0.01], "cracks_1", f"cracks_1_{part}")
        s.cube([-6, 3, -8.14], [12, 10, 0.01], "cracks_2", f"cracks_2_{part}")
    return s


# ---------------------------------------------------------------- model helper
class Shape:
    """One block model in pixels: the block is x,z -8..8 and y 0..16. Front = -z (north)."""

    def __init__(self, name):
        self.name, self.cubes = name, {}

    def cube(self, origin, size, mat="*", bone="main", rot=None, pivot=None):
        faces = {}
        for face, (w, h) in {"north": (size[0], size[1]), "south": (size[0], size[1]), "east": (size[2], size[1]),
                             "west": (size[2], size[1]), "up": (size[0], size[2]), "down": (size[0], size[2])}.items():
            w, h = max(1, min(16, round(w))), max(1, min(16, round(h)))
            f = {"uv": [(16 - w) // 2, (16 - h) // 2], "uv_size": [w, h]}
            if mat != "*":
                f["material_instance"] = mat
            faces[face] = f
        c = {"origin": [round(o, 3) for o in origin], "size": [round(s, 3) for s in size], "uv": faces}
        if rot:
            c["rotation"] = list(rot)
            c["pivot"] = list(pivot or [origin[i] + size[i] / 2 for i in range(3)])
        for i, o in enumerate(c["origin"]):
            lo, hi = (0, 30) if i == 1 else (-15, 15)
            assert lo - 0.01 <= o and o + c["size"][i] <= hi + 0.01, f"{self.name}: cube out of bounds {c}"
        self.cubes.setdefault(bone, []).append(c)

    def geo(self):
        return {"description": {"identifier": f"geometry.siege_{self.name}", "texture_width": 16, "texture_height": 16,
                                "visible_bounds_width": 2, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
                "bones": [{"name": b, "pivot": [0, 0, 0], "cubes": c} for b, c in self.cubes.items()]}


def door(kind):
    """The vault door is three blocks wide and three tall, set into the strongroom's front wall.
    kind: "wheel" = the centre block with the locking wheel (iron and up), "lock" = the wooden door's centre
    with its iron lock plate, "plate" = the eight plates around the centre."""
    s = Shape({"wheel": "vault_door", "lock": "vault_door_wood", "plate": "vault_door_plate"}[kind])
    # the slab: a whole block, its face set two pixels back from the wall face so the door reads as recessed
    s.cube([-8, 0, -6], [16, 16, 14], "*", "slab")
    # a locking bar runs across the middle of every block, so the bars line up across the door
    s.cube([-8, 7, -6.6], [16, 2, 0.6], "trim", "slab")
    # rivets at the corners of each plate
    for x in (-6.5, 5.5):
        for y in (1.5, 13.5):
            s.cube([x, y, -6.5], [1, 1, 0.5], "trim", "slab")
    # crack overlays just in front of the slab, shown by siege:cracks (drilled, not yet repaired)
    s.cube([-8, 0, -6.05], [16, 16, 0.01], "cracks_1", "cracks_1")
    s.cube([-8, 0, -6.1], [16, 16, 0.01], "cracks_2", "cracks_2")
    if kind == "plate":
        return s
    if kind == "lock":
        # a big iron lock plate with a keyhole slot and a hasp
        s.cube([-3, 4, -7.4], [6, 8, 1.4], "trim", "lock")
        s.cube([-0.5, 6, -7.6], [1, 3, 0.3], "frame", "lock")
        s.cube([3, 7.5, -7.8], [3, 1, 1.8], "trim", "lock")
        return s
    # the locking wheel: a flat pixel ring, a cross of spokes and a hub, as wide as the block allows
    cx, cy, z = 0, 8, -7.4
    s.cube([cx - 1.5, cy - 1.5, z - 0.8], [3, 3, 2.2], "trim", "wheel")
    for x0, y0, w, h in ((-3, 5, 6, 1.5), (-3, -6.5, 6, 1.5), (5, -3, 1.5, 6), (-6.5, -3, 1.5, 6),
                         (3, 3, 2, 2), (-5, 3, 2, 2), (3, -5, 2, 2), (-5, -5, 2, 2)):
        s.cube([cx + x0, cy + y0, z], [w, h, 1], "trim", "wheel")
    s.cube([cx - 5, cy - 0.5, z + 0.3], [10, 1, 0.7], "trim", "wheel")
    s.cube([cx - 0.5, cy - 5, z + 0.3], [1, 10, 0.7], "trim", "wheel")
    s.cube([cx - 0.75, cy - 0.75, z - 1.1], [1.5, 1.5, 0.3], "gem", "gem")
    return s


def lock():
    """The Vault Lock: a block of strongroom stone set in the wall beside the door, with a round lock face.
    The key goes in here, drills bite here, upgrades are clicked here."""
    s = Shape("vault_lock")
    s.cube([-8, 0, -8], [16, 16, 16], "frame", "body")
    # round face plate: a stepped disc of trim
    for x0, y0, w, h in ((-4, 2, 8, 12), (-6, 4, 12, 8), (-5, 3, 10, 10)):
        s.cube([x0, y0, -9], [w, h, 1], "trim", "plate")
    # keyhole: a round top and a slot, dark
    s.cube([-1.5, 8, -9.3], [3, 3, 0.3], "frame", "keyhole")
    s.cube([-0.75, 5, -9.3], [1.5, 3.5, 0.3], "frame", "keyhole")
    # four bolt heads round the rim and a dial ring
    for x, y in ((-5.5, 7.5), (4.5, 7.5), (-0.5, 12.8), (-0.5, 2.2)):
        s.cube([x, y, -9.6], [1, 1, 0.6], "*", "bolts")
    s.cube([-3, 12, -9.4], [6, 0.6, 0.4], "*", "ring")
    s.cube([-3, 3.4, -9.4], [6, 0.6, 0.4], "*", "ring")
    # crack overlays for a half-drilled lock
    s.cube([-6, 3, -9.65], [12, 10, 0.01], "cracks_1", "cracks_1")
    s.cube([-6, 3, -9.7], [12, 10, 0.01], "cracks_2", "cracks_2")
    return s


def coffer():
    s = Shape("relic_coffer")
    s.cube([-7, 0, -6], [14, 2, 12], "stone", "plinth")
    s.cube([-6, 2, -5], [12, 7, 10], "*", "body")
    s.cube([-6.2, 9.6, -5.2], [12.4, 3.4, 10.4], "*", "lid")
    s.cube([-5.6, 13, -4.6], [11.2, 0.8, 9.2], "*", "lid")
    for x in (-6.4, 5.4):          # iron corner straps over body and lid
        s.cube([x, 2, -5.4], [1, 11, 1], "trim", "straps")
        s.cube([x, 2, 4.4], [1, 11, 1], "trim", "straps")
    s.cube([-1.2, 7, -6], [2.4, 3, 1], "trim", "lock")        # padlock
    s.cube([-0.7, 10, -5.8], [1.4, 1.2, 0.5], "trim", "lock")
    s.cube([-5.8, 9, -4.8], [11.6, 0.6, 9.6], "glow", "glow")  # light in the gap under the lid when it holds a relic
    return s


def breaker():
    s = Shape("vault_breaker")
    s.cube([-6, 0, -2], [12, 2, 10], "*", "sled")                  # iron-shod sled
    for x in (-6, 4.5):
        s.cube([x, 0, -2.5], [1.5, 1, 11], "metal", "sled")
    for x in (-5.5, 4):                                              # uprights and crossbar
        s.cube([x, 2, 3], [1.5, 9, 1.5], "*", "frame")
    s.cube([-5.5, 11, 3], [11, 1.5, 1.5], "*", "frame")
    s.cube([-3, 4.5, -1], [6, 6, 8], "metal", "housing")           # gear housing
    s.cube([-2, 5.5, 7], [4, 4, 1.5], "metal", "housing")
    s.cube([3, 6.5, 2], [3, 2, 2], "metal", "housing")              # crank arm and handle
    s.cube([5.5, 6, 1.5], [1, 6, 1], "*", "crank")
    # the auger: stepped bit pointing out of the front, with spiral flights
    for i, (w, l) in enumerate([(4, 3), (3, 3), (2, 2.5), (1, 2)]):
        z0 = -1 - sum(L for _, L in [(4, 3), (3, 3), (2, 2.5), (1, 2)][: i + 1])
        s.cube([-w / 2, 7.5 - w / 2, z0], [w, w, l], "bit", "bit")
    for k in range(5):
        s.cube([-2.4, 7.1, -2.5 - k * 1.6], [4.8, 0.8, 0.6], "bit", "bit", rot=[0, 0, k * 36], pivot=[0, 7.5, -2.2 - k * 1.6])
    return s


SHAPES = {"safe": regal_safe(), "lock": lock(), "door": door("wheel"), "door_wood": door("lock"), "plate": door("plate"), "coffer": coffer(), "breaker": breaker()}


# ---------------------------------------------------------------- blocks
TURN = [{"condition": f"q.block_state('minecraft:cardinal_direction') == '{d}'", "components": {"minecraft:transformation": {"rotation": [0, r, 0]}}}
        for d, r in (("north", 0), ("west", 90), ("south", 180), ("east", -90))]
FULL = {"origin": [-8, 0, -8], "size": [16, 16, 16]}


def block(ident, geo, materials, *, states=None, collision=FULL, selection=FULL, color="#4a4850", turn=True, extra=None, category="construction"):
    desc = {"identifier": ident, "menu_category": {"category": category}}
    if states:
        desc["states"] = states
    if turn:
        desc["traits"] = {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"]}}
    comp = {"minecraft:display_name": f"tile.{ident}.name", "minecraft:geometry": geo, "minecraft:material_instances": materials,
            "minecraft:collision_box": collision, "minecraft:selection_box": selection, "minecraft:map_color": color,
            "minecraft:light_dampening": 0 if geo != "minecraft:geometry.full_block" else 15, **(extra or {})}
    data = {"format_version": "1.21.90", "minecraft:block": {"description": desc, "components": comp}}
    if turn:
        data["minecraft:block"]["permutations"] = TURN
    write_json(os.path.join(BP, "blocks", "vault", ident.split(":")[1] + ".json"), data)


def mat(texture, method="opaque", **kw):
    return {"texture": texture, "render_method": method, **kw}


# The vault cannot be mined or blown open: only the breaker gets through a door (script side).
# Creative can still clear them.
SOLID = {"minecraft:destructible_by_mining": False, "minecraft:destructible_by_explosion": False,
         "minecraft:flammable": {"catch_chance_modifier": 0, "destroy_chance_modifier": 0}}

NAMES, SOUNDS, RECIPES = {}, {}, {}


def build_blocks(t):
    for tier, info in TIERS.items():
        # one render method per block (the game's rule): alpha_test throughout, so the crack overlays can be see-through
        mats = {"*": mat(t[f"door_{tier}"], "alpha_test"), "trim": mat(t[f"trim_{tier}"], "alpha_test"), "frame": mat(t["stone_plain"], "alpha_test"),
                "cracks_1": mat(t["cracks_1"], "alpha_test"), "cracks_2": mat(t["cracks_2"], "alpha_test")}
        extra = dict(SOLID, **{"siege:clickable": {}})
        if tier == "choirsteel":
            mats["gem"] = mat(t["glow"], "alpha_test", face_dimming=False, ambient_occlusion=False)
            extra["minecraft:light_emission"] = 6
        elif tier != "wood":
            mats["gem"] = mat(t[f"trim_{tier}"], "alpha_test")
        cracks = {"cracks_1": "q.block_state('siege:cracks') == 1", "cracks_2": "q.block_state('siege:cracks') == 2"}
        color = {"wood": "#5c3e26", "iron": "#b4b6ba", "diamond": "#4fd8d0", "netherite": "#3d353c", "choirsteel": "#6a44b0"}[tier]
        # centre block (the one you place and click)
        ident = f"siege:vault_door_{tier}"
        block(ident, {"identifier": "geometry.siege_vault_door" if tier != "wood" else "geometry.siege_vault_door_wood", "bone_visibility": cracks},
              mats, states={"siege:cracks": [0, 1, 2]}, color=color, extra=extra)
        NAMES[ident] = info["name"]
        SOUNDS[ident] = "wood" if tier == "wood" else "metal"
        # the eight plates round it
        ident = f"siege:vault_door_plate_{tier}"
        block(ident, {"identifier": "geometry.siege_vault_door_plate", "bone_visibility": cracks},
              {k: v for k, v in mats.items() if k != "gem"}, states={"siege:cracks": [0, 1, 2]}, color=color, extra=dict(SOLID))
        NAMES[ident] = info["name"].replace("Door", "Door Plate")
        SOUNDS[ident] = "wood" if tier == "wood" else "metal"
        # the Vault Lock beside the door: key, drills and upgrades all go through this block
        ident = f"siege:vault_lock_{tier}"
        block(ident, {"identifier": "geometry.siege_vault_lock", "bone_visibility": cracks},
              {"*": mat(t[f"door_{tier}"], "alpha_test"), "trim": mat(t[f"trim_{tier}"], "alpha_test"), "frame": mat(t["stone_plain"], "alpha_test"),
               "cracks_1": mat(t["cracks_1"], "alpha_test"), "cracks_2": mat(t["cracks_2"], "alpha_test")},
              states={"siege:cracks": [0, 1, 2]}, color=color,
              extra=dict(extra, **{"minecraft:light_emission": 6} if tier == "choirsteel" else {}))
        NAMES[ident] = info["name"].replace("Strongroom Door", "Vault Lock")
        SOUNDS[ident] = "stone"

    block("siege:vault_stone", "minecraft:geometry.full_block", {"*": mat(t["stone"])}, turn=False, extra=SOLID)
    NAMES["siege:vault_stone"], SOUNDS["siege:vault_stone"] = "Strongroom Stone", "stone"

    block("siege:relic_coffer", {"identifier": "geometry.siege_relic_coffer", "bone_visibility": {"glow": "q.block_state('siege:filled')"}},
          {"*": mat(t["coffer"]), "trim": mat(t["trim_iron"]), "stone": mat(t["stone_plain"]),
           "glow": mat(t["glow"], face_dimming=False, ambient_occlusion=False)},
          collision={"origin": [-7, 0, -6], "size": [14, 14, 12]}, selection={"origin": [-7, 0, -6], "size": [14, 14, 12]},
          color="#5c3e26", states={"siege:filled": [False, True]}, extra=dict(SOLID, **{"siege:clickable": {}}))
    # glows brighter when it holds a relic
    path = os.path.join(BP, "blocks", "vault", "relic_coffer.json")
    data = json.load(open(path, encoding="utf8"))
    data["minecraft:block"]["permutations"].append({"condition": "q.block_state('siege:filled')", "components": {"minecraft:light_emission": 7}})
    write_json(path, data)
    NAMES["siege:relic_coffer"], SOUNDS["siege:relic_coffer"] = "Relic Coffer", "wood"

    # the Regal Safe: holds the strongbox's Regals. Only the vault builds it; it can't be mined, moved or blown up
    vis = {}
    for part in SAFE_PARTS:
        vis[f"part{part}"] = f"q.block_state('siege:part') == {part}"
        vis[f"cracks_1_{part}"] = f"q.block_state('siege:part') == {part} && q.block_state('siege:cracks') == 1"
        vis[f"cracks_2_{part}"] = f"q.block_state('siege:part') == {part} && q.block_state('siege:cracks') == 2"
    block("siege:regal_safe", {"identifier": "geometry.siege_regal_safe", "bone_visibility": vis},
          {"*": mat(t["safe_side"], "alpha_test"), "gold": mat(t["safe_gold"], "alpha_test"),
           **{f"front_{p}": mat(t[f"safe_front_{p}"], "alpha_test") for p in SAFE_PARTS},
           "cracks_1": mat(t["cracks_1"], "alpha_test"), "cracks_2": mat(t["cracks_2"], "alpha_test")},
          states={"siege:part": list(SAFE_PARTS), "siege:cracks": [0, 1, 2]}, color="#2a2a30",
          extra=dict(SOLID, **{"siege:clickable": {}}))
    NAMES["siege:regal_safe"], SOUNDS["siege:regal_safe"] = "Regal Safe", "metal"

    for tier, info in BREAKERS.items():
        ident = f"siege:vault_breaker_{tier}"
        block(ident, "geometry.siege_vault_breaker",
              {"*": mat(t["frame_wood"]), "metal": mat(t[f"breaker_{tier}"]), "bit": mat(t[f"bit_{tier}"])},
              collision={"origin": [-6, 0, -6], "size": [12, 12, 14]}, selection={"origin": [-6, 0, -8], "size": [12, 13, 16]},
              color="#5c3e26", category="equipment",
              extra={"minecraft:destructible_by_mining": {"seconds_to_destroy": 3}, "minecraft:destructible_by_explosion": {"explosion_resistance": 2},
                     "siege:clickable": {}})
        NAMES[ident], SOUNDS[ident] = info["name"], "metal"


# ---------------------------------------------------------------- the Vault Key and the relic stands
def key_icon(x, y, r):
    G = M["gold"]
    bow = (x - 4.5) ** 2 + (y - 4.5) ** 2
    if 6 <= bow <= 14:
        return G[3] if x + y < 9 else G[2]
    if bow < 6 and bow > 2:
        return G[1]
    # the shaft runs down-right from the bow, the bit hangs off its end
    d = x - y
    if -1 <= d <= 1 and 7 <= x <= 13:
        return G[4] if d == -1 else G[3] if d == 0 else G[1]
    if (x, y) in ((12, 14), (13, 14), (12, 15), (10, 12), (10, 13), (11, 13)):
        return G[2]
    return (0, 0, 0, 0)


def build_key():
    img = Image.new("RGBA", (16, 16))
    r = random.Random(7)
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), tuple(key_icon(x, y, r)))
    os.makedirs(os.path.join(RP, "textures", "items", "vault"), exist_ok=True)
    key_png = os.path.join(RP, "textures", "items", "vault", "vault_key.png")
    if not os.path.exists(key_png):  # final art is painted by studio/art/build_audit_icons.py; never overwrite it
        img.save(key_png)
    write_json(os.path.join(BP, "items", "vault", "vault_key.json"), {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": "siege:vault_key", "menu_category": {"category": "items"}},
        "components": {"minecraft:icon": "siege_vault_key", "minecraft:display_name": {"value": "item.siege:vault_key.name"},
                       "minecraft:max_stack_size": 1}}})
    path = os.path.join(RP, "textures", "item_texture.json")
    data = json.load(open(path, encoding="utf8"))
    data["texture_data"]["siege_vault_key"] = {"textures": "textures/items/vault/vault_key"}
    write_json(path, data, indent=1)
    lang = os.path.join(RP, "texts", "en_US.lang")
    lines = [l for l in open(lang, encoding="utf8").read().split("\n") if not l.startswith("item.siege:vault_key.name=")]
    while lines and lines[-1] == "":
        lines.pop()
    open(lang, "w", encoding="utf8").write("\n".join(lines + ["item.siege:vault_key.name=Vault Key"]) + "\n")


# Relic stands: the Heart of the Hollow and the Choirsteel template each float, slowly turning, over a small
# stone stand, like the Crown's stand (studio/build_crown_stand.py). Click to take, set it back to leave it.
# The relic is drawn as its own item picture on a double-sided card.
STANDS = {"heart": ("siege:heart_stand", "Heart of the Hollow", "textures/items/siege_heart_of_the_hollow"),
          "template": ("siege:template_stand", "Choirsteel Upgrade Template", "textures/items/siege_choirsteel_upgrade_template")}


def build_stands():
    for key, (ident, name, relic_tex) in STANDS.items():
        short = ident.split(":")[1]
        write_json(os.path.join(BP, "entities", "vault", short + ".json"), {"format_version": "1.21.60", "minecraft:entity": {
            "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True},
            "components": {
                "minecraft:type_family": {"family": ["relic_stand", "inanimate"]},
                "minecraft:health": {"value": 20, "max": 20},
                "minecraft:collision_box": {"width": 0.8, "height": 1.5},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1},
                "minecraft:movement": {"value": 0},
                "minecraft:persistent": {},
                "minecraft:fire_immune": {},
                "minecraft:breathable": {"breathes_water": True, "breathes_air": True, "suffocate_time": -1},
                "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]}}}})
        write_json(os.path.join(RP, "entity", "vault", short + ".entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
            "identifier": ident,
            "materials": {"default": "entity_alphatest"},
            "textures": {"stand": "textures/entity/siege_crown_stand", "relic": relic_tex},
            "geometry": {"stand": "geometry.siege_relic_stand", "relic": "geometry.siege_relic_card"},
            "animations": {"float": "animation.siege_crown_stand.float"},
            "scripts": {"animate": ["float"]},
            "render_controllers": ["controller.render.siege_crown_stand", "controller.render.siege_relic_card"]}}})
        lang = os.path.join(RP, "texts", "en_US.lang")
        lines = [l for l in open(lang, encoding="utf8").read().split("\n") if not l.startswith(f"entity.{ident}.name=")]
        while lines and lines[-1] == "":
            lines.pop()
        open(lang, "w", encoding="utf8").write("\n".join(lines + [f"entity.{ident}.name={name}"]) + "\n")
    write_json(os.path.join(RP, "render_controllers", "siege_relic_card.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {
        "controller.render.siege_relic_card": {"geometry": "Geometry.relic", "materials": [{"*": "Material.default"}], "textures": ["Texture.relic"]}}})
    bounds = {"visible_bounds_width": 2, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1, 0]}
    # the same floating slab as the Crown's stand, so the vault's stands match it
    stand = json.load(open(os.path.join(RP, "models", "entity", "crown_stand.geo.json"), encoding="utf8"))["minecraft:geometry"][0]
    stand = json.loads(json.dumps(stand))
    stand["description"]["identifier"] = "geometry.siege_relic_stand"
    write_json(os.path.join(RP, "models", "entity", "relic_stand.geo.json"), {"format_version": "1.12.0", "minecraft:geometry": [stand]})
    # the relic: a 12x12 card standing on the stand's lip, turning (bone "spin" under "float", like the Crown)
    write_json(os.path.join(RP, "models", "entity", "relic_card.geo.json"), {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.siege_relic_card", "texture_width": 16, "texture_height": 16, **bounds},
        "bones": [{"name": "float", "pivot": [0, 0, 0]},
                  {"name": "spin", "parent": "float", "pivot": [0, 12, 0], "cubes": [
                      {"origin": [-6, 12, 0], "size": [12, 12, 0], "uv": {"north": {"uv": [0, 0], "uv_size": [16, 16]}, "south": {"uv": [16, 0], "uv_size": [-16, 16]}}}]}]}]})


# ---------------------------------------------------------------- recipes (Siege Workshop)
def recipe(ident, pattern, key, count=1):
    short = ident.split(":")[1]
    RECIPES[short] = {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{short}"}, "tags": ["siege_workshop"], "pattern": pattern,
        "key": {k: {"item": v} for k, v in key.items()}, "result": {"item": ident, "count": count}}}


def build_recipes():
    # Only the first door is crafted; the others are upgrades on the placed door (script side).
    # The vault itself (room, door, lock, key) comes from the town hall's "Add Vault", not from crafting:
    # only the attacker's breakers are crafted.
    recipe("siege:vault_breaker_iron", [" I ", "IBI", "PRP"], {"I": "minecraft:iron_block", "B": "minecraft:iron_pickaxe", "P": "minecraft:dark_oak_planks", "R": "minecraft:redstone_block"})
    recipe("siege:vault_breaker_diamond", [" D ", "DBD", " R "], {"D": "minecraft:diamond", "B": "siege:vault_breaker_iron", "R": "minecraft:redstone_block"})
    recipe("siege:vault_breaker_netherite", ["NBN"], {"N": "minecraft:netherite_ingot", "B": "siege:vault_breaker_diamond"})
    for short, data in RECIPES.items():
        write_json(os.path.join(BP, "recipes", "vault", short + ".json"), data)


# ---------------------------------------------------------------- shared files (read again right before writing)
def merge_shared(t):
    path = os.path.join(RP, "textures", "terrain_texture.json")
    data = json.load(open(path, encoding="utf8"))
    for short, key in t.items():
        data["texture_data"][key] = {"textures": TEX + short}
    write_json(path, data, indent=1)

    path = os.path.join(RP, "blocks.json")
    data = json.load(open(path, encoding="utf8"))
    for k, v in SOUNDS.items():
        data[k] = {"sound": v}
    write_json(path, data, indent=1)

    path = os.path.join(RP, "texts", "en_US.lang")
    lines = [l for l in open(path, encoding="utf8").read().split("\n") if not any(l.startswith(f"tile.{k}.name=") for k in NAMES)]
    while lines and lines[-1] == "":
        lines.pop()
    lines += [f"tile.{k}.name={v}" for k, v in NAMES.items()]
    open(path, "w", encoding="utf8").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    t = build_textures()
    write_json(os.path.join(RP, "models", "blocks", "vault.geo.json"),
               {"format_version": "1.12.0", "minecraft:geometry": [s.geo() for s in SHAPES.values()]}, indent=1)
    build_blocks(t)
    build_recipes()
    merge_shared(t)
    build_key()
    build_stands()
    print(f"vault: {len(NAMES)} blocks, {len(t)} textures, {len(RECIPES)} recipes, "
          + ", ".join(f"{n} {sum(len(c) for c in s.cubes.values())} cubes" for n, s in SHAPES.items()))
