"""The Sallow Lantern: the ghost ship the Captain chases (roletrials/lantern.js; Mateo 2026-11-15: "We'll need a custom
build for this").

The hull comes from the building skill's own `ship` part (.claude/skills/minecraft-builder/scripts/ship.py), so it
has the same lines as the great ship at Gull's Rest, only smaller, older and rotten: two masts, torn grey sails,
pale green lanterns and no lights in the cabins. Because it sails, it is an entity, not a stamped build: this script
voxelises the ship, keeps only the cells you can see from outside, merges runs into cubes and writes the model.

Writes:
  Siege_Nights_RP/models/entity/roletrials/sallow_lantern.geo.json
  Siege_Nights_RP/textures/entity/roletrials/sallow_lantern.png
  Siege_Nights_RP/entity/roletrials/sallow_lantern.entity.json
  Siege_Nights_RP/animations/sallow_lantern.animation.json
  Siege_Nights_BP/entities/roletrials/sallow_lantern.json
  art/roletrials/sallow_lantern_cells.json   (the voxels, for the 3D preview)

Run: python3 studio/build_lantern.py
"""
import json
import random
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".claude/skills/minecraft-builder/scripts"))
import ship  # noqa: E402

ID = "siege:sallow_lantern"
GEO = "geometry.siege_sallow_lantern"
SPEC = {
    "length": 31, "beam": 9, "furl": 0, "aft": 9, "fore": 7, "poop": 4,
    "masts": [
        {"at": 8, "top": 15, "yards": [[6, 4, 4], [11, 3, 3]]},
        {"at": 19, "top": 19, "yards": [[7, 5, 5], [13, 4, 4]], "nest": 16},
    ],
    "materials": {"hull": "rot_planks", "stripe": "rot_dark", "wale": "rot_dark", "bottom": "weed", "boot": "weed",
                  "deck": "rot_planks", "castle": "rot_planks", "sail": "sail", "band": "sail_dark", "pennant": "sail_dark",
                  "figure": "bone", "figure_pillar": "bone", "figure_head": "bone", "figure_wing": "bone_stairs",
                  "glass": "dark_pane", "rail": "rot_fence", "rig": "rot_fence"},
}

# Ghost palette: base colour per kind of block (RGB). Anything not listed falls back by name.
PALETTE = {
    "rot_planks": (74, 66, 58), "rot_dark": (44, 40, 38), "weed": (40, 58, 46), "sail": (150, 156, 146),
    "sail_dark": (96, 104, 98), "bone": (196, 192, 170), "dark_pane": (26, 30, 34), "rot_fence": (58, 52, 46),
    "lantern": (176, 255, 196), "mast": (64, 58, 52), "iron": (60, 62, 64),
}
TILES = list(PALETTE)


def kind(block):
    b = block.replace("minecraft:", "")
    for k in ("rot_planks", "rot_dark", "weed", "sail_dark", "sail", "bone", "dark_pane", "rot_fence", "lantern"):
        if b.startswith(k): return k
    if "log" in b or "mast" in b: return "mast"
    if "fence" in b or "chain" in b: return "rot_fence"
    if "lantern" in b: return "lantern"
    if "planks" in b or "stairs" in b or "slab" in b or "trapdoor" in b or "door" in b: return "rot_planks"
    if "wool" in b: return "sail"
    return "iron"


def shape(block):
    """How a block is drawn: (x0, y0, x1, y1, z0, z1) in pixels of the 16 px cell: across w, up y, along u."""
    b = block
    if "fence" in b or "chain" in b: return (7, 0, 9, 16, 7, 9)       # rigging: thin lines, never merged
    if "pane" in b: return (7, 0, 9, 16, 0, 16)
    if "slab" in b or "trapdoor" in b: return (0, 0, 16, 8, 0, 16)
    if "lantern" in b: return (5, 2, 11, 10, 5, 11)
    return (0, 0, 16, 16, 0, 16)


def cells():
    rnd = random.Random(317)
    out = {}
    for u, y, w, b, *_ in ship.ship_cells(SPEC):
        b = str(b)
        if b in ("air", "water") or any(k in b for k in ("carpet", "bed", "barrel", "chest", "table", "lectern", "book",
                                                          "smoker", "cauldron", "pressure_plate", "torch")):
            continue
        if b.startswith("sail") and rnd.random() < 0.28: continue   # torn
        if "pane" in b and rnd.random() < 0.5: continue              # broken windows
        out[(u, y, w)] = b
    return out


def visible(cs):
    """Cells with a face open to the outside (flood fill from beyond the bounding box)."""
    us = [c[0] for c in cs]; ys = [c[1] for c in cs]; ws = [c[2] for c in cs]
    lo = (min(us) - 1, min(ys) - 1, min(ws) - 1); hi = (max(us) + 1, max(ys) + 1, max(ws) + 1)
    solid = {c for c, b in cs.items() if shape(b) == (0, 0, 16, 16, 0, 16)}
    seen = {lo}; q = deque([lo])
    while q:
        c = q.popleft()
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            n = (c[0] + d[0], c[1] + d[1], c[2] + d[2])
            if n in seen or n in solid or not all(lo[i] <= n[i] <= hi[i] for i in range(3)): continue
            seen.add(n); q.append(n)
    keep = {}
    for c, b in cs.items():
        if c not in solid or any((c[0] + d[0], c[1] + d[1], c[2] + d[2]) in seen for d in
                                 ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))):
            keep[c] = b
    # No lights in the cabins: only lanterns that hang from something you can see, and no more than three
    near = lambda c: any((c[0] + d[0], c[1] + d[1], c[2] + d[2]) in keep and "lantern" not in keep[(c[0] + d[0], c[1] + d[1], c[2] + d[2])]
                         for d in ((0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1)))
    lamps = sorted((c for c in keep if "lantern" in keep[c]), key=lambda c: c[0])
    hung = [c for c in lamps if near(c)]
    chosen = set(hung[:2] + hung[-1:])                       # the stern pair and one at the bow
    for c in lamps:
        if c not in chosen: del keep[c]
    return keep


def runs(cs):
    """Merge cells along u (the keel) into runs of the same kind and shape. -> [(u0, u1, y, w, kind, shape)]"""
    by = {}
    for (u, y, w), b in cs.items():
        if not is_rope(b): by[(u, y, w)] = (kind(b), shape(b))
    done = set(); out = []
    for (u, y, w) in sorted(by):
        if (u, y, w) in done: continue
        k = by[(u, y, w)]; u1 = u
        while k[1][4:] == (0, 16) and by.get((u1 + 1, y, w)) == k and (u1 + 1, y, w) not in done: u1 += 1
        for uu in range(u, u1 + 1): done.add((uu, y, w))
        out.append((u, u1, y, w, *k))
    return out


def is_rope(b):
    return "fence" in b or "chain" in b


def ropes(cs):
    """Rigging and rails drawn like fences: a thin post, with arms reaching to every rope next to it, so the
    shrouds and stays read as lines. -> [(u, y, w, kind, (x0, y0, x1, y1, z0, z1))]"""
    out = []
    rope = {c for c, b in cs.items() if is_rope(b)}
    for (u, y, w) in rope:
        k = kind(cs[(u, y, w)])
        up, down = (u, y + 1, w) in rope, (u, y - 1, w) in rope
        out.append((u, y, w, k, (7, 0 if down else 4, 9, 16 if up else 12, 7, 9)))
        for du, dw in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if any((u + du, y + dy, w + dw) in rope for dy in (-1, 0, 1)) or (u + du, y, w + dw) in cs:
                x0, x1 = (7, 9) if not dw else ((9, 16) if dw > 0 else (0, 7))
                z0, z1 = (7, 9) if not du else ((9, 16) if du > 0 else (0, 7))
                for yy in (6, 12):
                    out.append((u, y, w, k, (x0, yy, x1, yy + 2, z0, z1)))
    return out


def texture():
    """A 64 x 64 atlas: one 16 px tile per colour, with a little grain so it doesn't read as plastic."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); rnd = random.Random(3)
    for i, k in enumerate(TILES):
        r, g, b = PALETTE[k]; tx, ty = (i % 4) * 16, (i // 4) * 16
        for x in range(16):
            for y in range(16):
                j = rnd.randint(-10, 10) + (-12 if k.startswith("rot") and y % 4 == 0 else 0)
                img.putpixel((tx + x, ty + y), (max(0, min(255, r + j)), max(0, min(255, g + j)), max(0, min(255, b + j)), 255))
    return img


def geometry(rs, rp):
    us = [r[0] for r in rs] + [r[1] for r in rs]
    mid = (min(us) + max(us) + 1) / 2
    cubes = []
    for u0, u1, y, w, k, (x0, y0, x1, y1, z0, z1) in rs + [(u, u, y, w, k, sh) for u, y, w, k, sh in rp]:
        i = TILES.index(k); tile = [(i % 4) * 16, (i // 4) * 16]
        face = {"uv": tile, "uv_size": [16, 16]}
        cubes.append({
            "origin": [w * 16 + x0 - 8, y * 16 + y0, (u0 - mid) * 16 + z0],
            "size": [x1 - x0, y1 - y0, (u1 - u0) * 16 + z1 - z0],
            "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")},
        })
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": GEO, "texture_width": 64, "texture_height": 64,
                            "visible_bounds_width": 56, "visible_bounds_height": 40, "visible_bounds_offset": [0, 12, 0]},
            "bones": [{"name": "root", "pivot": [0, 0, 0]},
                      {"name": "hull", "parent": "root", "pivot": [0, 0, 0], "cubes": cubes}],
        }],
    }


ANIMS = {
    "format_version": "1.8.0",
    "animations": {
        "animation.siege_sallow_lantern.bob": {
            "loop": True,
            "bones": {"hull": {"rotation": ["math.sin(query.life_time * 40) * 2.5", 0, "math.sin(query.life_time * 27) * 4"],
                               "position": [0, "math.sin(query.life_time * 55) * 3 - 8", 0]}},
        },
        "animation.siege_sallow_lantern.sink": {
            "animation_length": 8, "hold_on_last_frame": True,
            "bones": {"root": {
                "rotation": {"0.0": [0, 0, 0], "2.0": [-8, 0, 6], "5.0": [-26, 0, 14], "8.0": [-34, 0, 18]},
                "position": {"0.0": [0, 0, 0], "2.0": [0, -24, 0], "5.0": [0, -180, 0], "8.0": [0, -480, 0]},
            }},
        },
    },
}

CLIENT = {
    "format_version": "1.10.0",
    "minecraft:client_entity": {"description": {
        "identifier": ID,
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": "textures/entity/roletrials/sallow_lantern"},
        "geometry": {"default": GEO},
        "animations": {"bob": "animation.siege_sallow_lantern.bob", "sink": "animation.siege_sallow_lantern.sink"},
        "scripts": {"animate": ["bob"]},
        "render_controllers": ["controller.render.default"],
    }},
}

SERVER = {
    "format_version": "1.21.0",
    "minecraft:entity": {
        "description": {"identifier": ID, "is_spawnable": False, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["inanimate", "siege_prop", "sallow_lantern"]},
            "minecraft:collision_box": {"width": 0.1, "height": 0.1},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            "minecraft:health": {"value": 1000, "max": 1000},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"breathes_water": True, "breathes_air": True},
            "minecraft:nameable": {},
        },
    },
}


def write(path, data):
    p = ROOT / path; p.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, Image.Image): data.save(p)
    else: p.write_text(json.dumps(data, indent=None if path.endswith(".geo.json") else 1, separators=(",", ":") if path.endswith(".geo.json") else None) + "\n")


def main():
    cs = visible(cells()); rs = runs(cs); rp = ropes(cs)
    write("Siege_Nights_RP/models/entity/roletrials/sallow_lantern.geo.json", geometry(rs, rp))
    write("Siege_Nights_RP/textures/entity/roletrials/sallow_lantern.png", texture())
    write("Siege_Nights_RP/entity/roletrials/sallow_lantern.entity.json", CLIENT)
    write("Siege_Nights_RP/animations/sallow_lantern.animation.json", ANIMS)
    write("Siege_Nights_BP/entities/roletrials/sallow_lantern.json", SERVER)
    write("art/roletrials/sallow_lantern_cells.json", [[u, y, w, kind(b)] for (u, y, w), b in sorted(cs.items())])
    print(f"Sallow Lantern: {len(cs)} visible cells, {len(rs) + len(rp)} cubes")


if __name__ == "__main__":
    main()
