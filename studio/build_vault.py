#!/usr/bin/env python3
"""Builds the vault blocks (Mateo, 2026-11-12): where a settlement keeps its relics (the Choirsteel
template, the Heart of the Hollow, the Hollow Crown), and what an attacker brings to break in.

  siege:vault_door_<tier>      Strongroom Door. Five tiers, each its own block so every tier shows in the
                               creative menu and the asset viewer: wood, iron, diamond, netherite, choirsteel.
                               Upgrading swaps the block for the next tier (script side, not written yet).
  siege:vault_stone            Strongroom Stone: the iron-banded walls of the vault room.
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
    def paint(x, y, r):
        if (x + y) % 6 == 0:
            return T[5]
        return T[2] if (x // 2 + y // 2) % 3 == 0 else T[3]
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
    return names


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


def door(wheel):
    s = Shape("vault_door" if wheel else "vault_door_wood")
    # stone frame all round, full depth, so the door sits in the wall like a real strongroom
    s.cube([-8, 0, -8], [2, 16, 16], "frame", "frame")
    s.cube([6, 0, -8], [2, 16, 16], "frame", "frame")
    s.cube([-6, 14, -8], [12, 2, 16], "frame", "frame")
    s.cube([-6, 0, -8], [12, 1, 16], "frame", "frame")
    # the door slab, set a pixel back from the frame face
    s.cube([-6, 1, -7], [12, 13, 15], "*", "slab")
    # hinges on the left, two locking bars across
    for y in (2.5, 10.5):
        s.cube([-7, y, -8.5], [2.5, 2.5, 1.5], "trim", "slab")
    for y in (4, 10):
        s.cube([-5.5, y, -7.6], [11, 1, 0.6], "trim", "slab")
    # crack overlays just in front of the slab, shown by the door's siege:cracks state (drilled, not yet repaired)
    s.cube([-6, 1, -7.05], [12, 13, 0.01], "cracks_1", "cracks_1")
    s.cube([-6, 1, -7.1], [12, 13, 0.01], "cracks_2", "cracks_2")
    if not wheel:
        # a big iron lock plate with a keyhole slot and a hasp
        s.cube([-2, 5.5, -8.2], [4, 5, 1.2], "trim", "lock")
        s.cube([-0.5, 6.5, -8.4], [1, 2, 0.3], "frame", "lock")
        s.cube([2, 7.5, -8.6], [2.5, 1, 1.6], "trim", "lock")
        return s
    # the spoked locking wheel: hub, ring of eight blocks, four spokes, and a jewel (Choirsteel glows)
    cx, cy, z = 0, 7.5, -9.5
    s.cube([cx - 1.25, cy - 1.25, z], [2.5, 2.5, 2.5], "trim", "wheel")
    # no rotated cubes: an axis-aligned pixel ring reads cleanly in game and in every viewer
    for x0, y0, w, h in ((-2.5, 4, 5, 1), (-2.5, -5, 5, 1), (4, -2.5, 1, 5), (-5, -2.5, 1, 5),          # four sides
                         (2.5, 3, 1.5, 1.5), (-4, 3, 1.5, 1.5), (2.5, -4.5, 1.5, 1.5), (-4, -4.5, 1.5, 1.5)):  # stepped corners
        s.cube([cx + x0, cy + y0, z + 0.5], [w, h, 1], "trim", "wheel")
    s.cube([cx - 4, cy - 0.4, z + 0.8], [8, 0.8, 0.8], "trim", "wheel")      # cross spokes
    s.cube([cx - 0.4, cy - 4, z + 0.8], [0.8, 8, 0.8], "trim", "wheel")
    for dx, dy in ((5, 0), (-5, 0), (0, 5), (0, -5)):                         # grip knobs past the rim
        s.cube([cx + dx - 0.6 - (0.4 if dx > 0 else 0) + (0.4 if dx < 0 else 0), cy + dy - 0.6 - (0.4 if dy > 0 else 0) + (0.4 if dy < 0 else 0), z + 0.3], [1.2, 1.2, 1.4], "trim", "wheel")
    s.cube([cx - 0.6, cy - 0.6, z - 0.4], [1.2, 1.2, 0.5], "gem", "gem")
    # bolt housings on the right edge
    for y in (3, 7, 11):
        s.cube([4.2, y, -8.3], [1.6, 1.6, 1.3], "trim", "slab")
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


SHAPES = {"door": door(True), "door_wood": door(False), "coffer": coffer(), "breaker": breaker()}


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
        ident = f"siege:vault_door_{tier}"
        # one render method per block (the game's rule): alpha_test throughout, so the crack overlays can be see-through
        mats = {"*": mat(t[f"door_{tier}"], "alpha_test"), "trim": mat(t[f"trim_{tier}"], "alpha_test"), "frame": mat(t["stone_plain"], "alpha_test"),
                "cracks_1": mat(t["cracks_1"], "alpha_test"), "cracks_2": mat(t["cracks_2"], "alpha_test")}
        extra = dict(SOLID, **{"siege:clickable": {}})
        if tier == "choirsteel":
            mats["gem"] = mat(t["glow"], "alpha_test", face_dimming=False, ambient_occlusion=False)
            extra["minecraft:light_emission"] = 6
        elif tier != "wood":
            mats["gem"] = mat(t[f"trim_{tier}"], "alpha_test")
        geo = {"identifier": "geometry.siege_vault_door" if tier != "wood" else "geometry.siege_vault_door_wood",
               "bone_visibility": {"cracks_1": "q.block_state('siege:cracks') == 1", "cracks_2": "q.block_state('siege:cracks') == 2"}}
        block(ident, geo, mats, states={"siege:cracks": [0, 1, 2]},
              color={"wood": "#5c3e26", "iron": "#b4b6ba", "diamond": "#4fd8d0", "netherite": "#3d353c", "choirsteel": "#6a44b0"}[tier],
              extra=extra)
        NAMES[ident] = info["name"]
        SOUNDS[ident] = "wood" if tier == "wood" else "metal"

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

    for tier, info in BREAKERS.items():
        ident = f"siege:vault_breaker_{tier}"
        block(ident, "geometry.siege_vault_breaker",
              {"*": mat(t["frame_wood"]), "metal": mat(t[f"breaker_{tier}"]), "bit": mat(t[f"bit_{tier}"])},
              collision={"origin": [-6, 0, -6], "size": [12, 12, 14]}, selection={"origin": [-6, 0, -8], "size": [12, 13, 16]},
              color="#5c3e26", category="equipment",
              extra={"minecraft:destructible_by_mining": {"seconds_to_destroy": 3}, "minecraft:destructible_by_explosion": {"explosion_resistance": 2},
                     "siege:clickable": {}})
        NAMES[ident], SOUNDS[ident] = info["name"], "metal"


# ---------------------------------------------------------------- recipes (Siege Workshop)
def recipe(ident, pattern, key, count=1):
    short = ident.split(":")[1]
    RECIPES[short] = {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"siege:{short}"}, "tags": ["siege_workshop"], "pattern": pattern,
        "key": {k: {"item": v} for k, v in key.items()}, "result": {"item": ident, "count": count}}}


def build_recipes():
    # Only the first door is crafted; the others are upgrades on the placed door (script side).
    recipe("siege:vault_door_wood", ["PIP", "PCP", "PIP"], {"P": "minecraft:dark_oak_planks", "I": "minecraft:iron_ingot", "C": "minecraft:chest"})
    recipe("siege:vault_stone", ["SIS", "ISI", "SIS"], {"S": "minecraft:deepslate_bricks", "I": "minecraft:iron_ingot"}, count=4)
    recipe("siege:relic_coffer", ["IGI", "PCP", "III"], {"I": "minecraft:iron_ingot", "G": "minecraft:gold_ingot", "P": "minecraft:dark_oak_planks", "C": "minecraft:chest"})
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
    print(f"vault: {len(NAMES)} blocks, {len(t)} textures, {len(RECIPES)} recipes, "
          + ", ".join(f"{n} {sum(len(c) for c in s.cubes.values())} cubes" for n, s in SHAPES.items()))
