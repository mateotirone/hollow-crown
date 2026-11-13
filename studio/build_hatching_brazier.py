"""Builds the Hatching Brazier: the block in a Dragon Stable's nursery where a Dragon Egg is set to hatch.

Run from the repo root:   python3 studio/build_hatching_brazier.py

Mateo (2026-11-13): the Emberwaste's Dragon Stable has "an attached nursery. That's where the dragon hatching
blocks are." A carved red sandstone bowl on a short stem, a bronze rim, a bed of glowing coals, and the egg in it
while one warms (siege:egg 1), cracked and glowing through the cracks near the end (siege:egg 2), empty at 0.
The egg uses the wild nest's egg texture (build_dragon_nest.py), so an egg looks the same wherever it is.

Writes the block JSON, the model, the textures, the atlas lines, the block sound and the name (shared files are
read again right before writing, and only these entries change).
"""
import json, os, random, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "studio", "art"))
from palette import M, ramp  # noqa: E402
from PIL import Image  # noqa: E402

BP = os.path.join(ROOT, "Siege_Nights_BP")
RP = os.path.join(ROOT, "Siege_Nights_RP")
TEX = "textures/blocks/dragons/brazier/"
ID = "siege:hatching_brazier"
NAME = "Hatching Brazier"

STONE = ramp("#b4532a", 0.14, 0.62)          # red sandstone, the Emberwaste's own
BRONZE = ramp("#9a6a2a", 0.18, 0.78)
EMBER = M["ember"]
COAL = M["coal"]
EGG = ramp("#7a1e1a", 0.06, 0.50, cool=0.04)  # as the nest's eggs


def write_json(path, data, indent=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=indent)
        f.write("\n")


def tex(name, paint, seed):
    r = random.Random(seed)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), tuple(paint(x, y, r)) + (255,))
    path = os.path.join(RP, TEX + name + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def stone(x, y, r):
    # carved courses: a band of chevrons across the middle, worn edges, sand in the joints
    i = 3 + (r.random() < 0.18) - (r.random() < 0.18)
    if y in (0, 15): i -= 1
    if y in (5, 10): i = 1
    if 6 <= y <= 9 and (x + (y - 6)) % 4 == 0: i = 4
    if 6 <= y <= 9 and (x - (y - 6)) % 4 == 0: i = 2
    return STONE[max(0, min(5, i))]


def bronze(x, y, r):
    i = 3 + (y % 4 == 0) - (x % 5 == 2) + (r.random() < 0.15) - (r.random() < 0.15)
    return BRONZE[max(1, min(5, i))]


def coals(x, y, r):
    # black coals with orange and yellow glowing between them
    if (x * 5 + y * 3) % 7 == 0 or r.random() < 0.18: return EMBER[4 + (r.random() < 0.4)]
    if (x + y * 2) % 5 == 0: return EMBER[2 + (r.random() < 0.5)]
    return COAL[1 + (r.random() < 0.4) + ((x + y) % 3 == 0)]


def egg_cracked(x, y, r):
    # the nest egg's scale rows, split by bright cracks
    row = y // 2
    sx = (x + (row % 2) * 2) % 4
    i = 2 + (sx == 0) - (y % 2 == 1 and sx == 2)
    crack = (x == 7 and y < 6) or (y == 5 and 4 <= x <= 7) or (x == 4 and 5 <= y <= 10) or (y == 10 and 4 <= x <= 11) \
        or (x == 11 and 10 <= y <= 15) or (x == 9 and 2 <= y <= 5) or (y == 2 and 9 <= x <= 13)
    if crack: return EMBER[5] if r.random() < 0.6 else EMBER[4]
    return EGG[max(0, min(5, i + (r.random() < 0.1)))]


class Shape:
    """One block model. Units are pixels: the block is x,z -8..8 and y 0..16."""

    def __init__(self):
        self.bones = {}

    def cube(self, origin, size, mat="*", bone="bowl"):
        faces = {}
        for face, (w, h) in {"north": (size[0], size[1]), "south": (size[0], size[1]), "east": (size[2], size[1]),
                             "west": (size[2], size[1]), "up": (size[0], size[2]), "down": (size[0], size[2])}.items():
            w, h = max(1, min(16, round(w))), max(1, min(16, round(h)))
            f = {"uv": [(16 - w) // 2, (16 - h) // 2], "uv_size": [w, h]}
            if mat != "*": f["material_instance"] = mat
            faces[face] = f
        self.bones.setdefault(bone, []).append({"origin": [round(o, 3) for o in origin], "size": [round(s, 3) for s in size], "uv": faces})

    def egg(self, mat, bone):
        """An egg of stacked slabs, widest a third of the way up, standing in the coals."""
        y = 7
        for w, h in ((4, 1), (6, 1.5), (7, 2), (7, 2), (6, 1.5), (5, 1.5), (3, 1.5)):
            self.cube([-w / 2, y, -w / 2], [w, h + 0.05, w], mat, bone)
            y += h

    def geo(self):
        return {"description": {"identifier": "geometry.siege_hatching_brazier", "texture_width": 16, "texture_height": 16},
                "bones": [{"name": b, "pivot": [0, 0, 0], "cubes": c} for b, c in self.bones.items()]}


def model():
    s = Shape()
    s.cube([-5, 0, -5], [10, 2, 10])                     # the foot
    s.cube([-3, 2, -3], [6, 3, 6])                       # the stem
    s.cube([-6, 5, -6], [12, 1, 12])                     # the bowl's floor
    s.cube([-7, 5, -7], [14, 4, 1]); s.cube([-7, 5, 6], [14, 4, 1])     # its walls
    s.cube([-7, 5, -6], [1, 4, 12]); s.cube([6, 5, -6], [1, 4, 12])
    s.cube([-7.5, 9, -7.5], [15, 1, 1], "rim"); s.cube([-7.5, 9, 6.5], [15, 1, 1], "rim")   # the bronze rim
    s.cube([-7.5, 9, -6.5], [1, 1, 13], "rim"); s.cube([6.5, 9, -6.5], [1, 1, 13], "rim")
    for x, z in ((-5.5, -5.5), (4.5, -5.5), (-5.5, 4.5), (4.5, 4.5)): s.cube([x, 0, z], [1, 1, 1], "rim")   # bronze feet studs
    s.cube([-6, 6, -6], [12, 2.5, 12], "coals")          # the coals
    s.egg("egg", "egg")
    s.egg("cracked", "cracked")
    return s


MATS = {"*": "siege_brazier_stone", "rim": "siege_brazier_bronze", "coals": "siege_brazier_coals",
        "egg": "hc_nest_egg", "cracked": "siege_brazier_egg_cracked"}
GLOW = ("coals", "egg", "cracked")


def build_block():
    mats = {k: {"texture": v, "render_method": "opaque", **({"face_dimming": False} if k in GLOW else {})} for k, v in MATS.items()}
    data = {"format_version": "1.21.90", "minecraft:block": {
        "description": {"identifier": ID, "menu_category": {"category": "items"}, "states": {"siege:egg": [0, 1, 2]}},
        "components": {
            "minecraft:display_name": f"tile.{ID}.name",
            "minecraft:geometry": {"identifier": "geometry.siege_hatching_brazier",
                                   "bone_visibility": {"egg": "q.block_state('siege:egg') == 1", "cracked": "q.block_state('siege:egg') == 2"}},
            "minecraft:material_instances": mats,
            "minecraft:collision_box": {"origin": [-7, 0, -7], "size": [14, 10, 14]},
            "minecraft:selection_box": {"origin": [-7, 0, -7], "size": [14, 16, 14]},
            "minecraft:map_color": "#b4532a",
            "minecraft:light_emission": 9,
            "minecraft:light_dampening": 0,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
            "siege:clickable": {},
        }}}
    write_json(os.path.join(BP, "blocks", "dragons", "hatching_brazier.json"), data, indent=2)


def merge_shared():
    path = os.path.join(RP, "textures", "terrain_texture.json")
    data = json.load(open(path, encoding="utf8"))
    for k in ("stone", "bronze", "coals", "egg_cracked"):
        data["texture_data"][f"siege_brazier_{k}"] = {"textures": TEX + k}
    write_json(path, data)
    path = os.path.join(RP, "blocks.json")
    data = json.load(open(path, encoding="utf8"))
    data[ID] = {"sound": "stone"}
    write_json(path, data)
    path = os.path.join(RP, "texts", "en_US.lang")
    lines = [l for l in open(path, encoding="utf8").read().split("\n") if not l.startswith(f"tile.{ID}.name=")]
    while lines and lines[-1] == "": lines.pop()
    lines.append(f"tile.{ID}.name={NAME}")
    open(path, "w", encoding="utf8").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    tex("stone", stone, 21)
    tex("bronze", bronze, 22)
    tex("coals", coals, 23)
    tex("egg_cracked", egg_cracked, 24)
    s = model()
    write_json(os.path.join(RP, "models", "blocks", "hatching_brazier.geo.json"), {"format_version": "1.12.0", "minecraft:geometry": [s.geo()]})
    build_block()
    merge_shared()
    print("hatching brazier:", sum(len(c) for c in s.bones.values()), "cubes")
