#!/usr/bin/env python3
"""The Plan Book and Plan Scroll items (scripts/settle/planbook.js): item files, 16x16 icons, atlas lines,
names and the Plan Book recipe (a book and a paper at a crafting table).
Run from the repo root:  python3 studio/build_plans.py
Safe to run again. Shared files are merged, and an icon that already exists is never overwritten."""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def item(name, icon, stack):
    write_json(os.path.join(BP, "items", "settle", f"{name}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {
            "description": {"identifier": f"siege:{name}", "menu_category": {"category": "items"}},
            "components": {
                "minecraft:icon": icon,
                "minecraft:display_name": {"value": f"item.siege:{name}.name"},
                "minecraft:max_stack_size": stack,
                "minecraft:use_modifiers": {"use_duration": 0.05, "movement_modifier": 1.0},
            },
        },
    })


# palette
INK, LEATHER, LEATHER_D, PAGE, PAGE_D, GOLD, RED, CORD = (40, 34, 30), (112, 70, 40), (78, 46, 26), (232, 220, 190), (196, 180, 146), (214, 170, 60), (150, 40, 34), (120, 96, 60)


def icon(name, rows, colors):
    path = os.path.join(RP, "textures", "items", f"{name}.png")
    if os.path.exists(path):
        return
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors:
                px[x, y] = colors[ch] + (255,)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


# A leather book with a gold house outline on the cover and pale page edges
icon("siege_plan_book", [
    "................",
    "..kkkkkkkkkkk...",
    ".kLLLLLLLLLLLk..",
    ".kLLLLLgLLLLLpk.",
    ".kLLLLgLgLLLLpk.",
    ".kLLLgLLLgLLLpk.",
    ".kLLgggggggLLpk.",
    ".kLLgLLLLLgLLpk.",
    ".kLLgLgggLgLLpk.",
    ".kLLgLgLgLgLLpk.",
    ".kLLgggLgggLLpk.",
    ".kDLLLLLLLLLLpk.",
    ".kDDLLLLLLLLLpk.",
    "..kkkkkkkkkkkkk.",
    "................",
    "................",
], {"k": INK, "L": LEATHER, "D": LEATHER_D, "g": GOLD, "p": PAGE})

# A rolled plan tied with a red cord, a blue-ink plan showing
icon("siege_plan_scroll", [
    "................",
    "....dddddddd....",
    "...dPPPPPPPPd...",
    "...dPbbbbbbPd...",
    "...dPbPPPPbPd...",
    "...dPbPbbPbPd...",
    "...dPbbbbbbPd...",
    "...dPPPPPPPPd...",
    "...dPbbPPbbPd...",
    "...dPPPPPPPPd...",
    "..cdddddddddd...",
    "..crrrrrrrrrrc..",
    "...cPPPPPPPPc...",
    "....cccccccc....",
    "................",
    "................",
], {"d": PAGE_D, "P": PAGE, "b": (52, 84, 150), "c": CORD, "r": RED})

item("plan_book", "siege_plan_book", 1)
item("plan_scroll", "siege_plan_scroll", 1)  # one per stack: each scroll carries its own plan

path = os.path.join(RP, "textures", "item_texture.json")
data = json.load(open(path, encoding="utf8"))
data["texture_data"].update({
    "siege_plan_book": {"textures": "textures/items/siege_plan_book"},
    "siege_plan_scroll": {"textures": "textures/items/siege_plan_scroll"},
})
with open(path, "w", encoding="utf8") as f:  # the atlas keeps the one-space indent the other builders use
    json.dump(data, f, indent=1)
    f.write("\n")

names = {"item.siege:plan_book.name": "Plan Book", "item.siege:plan_scroll.name": "Plan Scroll"}
for pack in (BP, RP):
    p = os.path.join(pack, "texts", "en_US.lang")
    lines = open(p, encoding="utf8").read().splitlines()
    keep = [l for l in lines if l.split("=", 1)[0] not in names]
    keep += [f"{k}={v}" for k, v in names.items()]
    with open(p, "w", encoding="utf8") as f:
        f.write("\n".join(keep) + "\n")

write_json(os.path.join(BP, "recipes", "settle", "plan_book.json"), {
    "format_version": "1.20.10",
    "minecraft:recipe_shapeless": {
        "description": {"identifier": "siege:plan_book_recipe"},
        "tags": ["crafting_table"],
        "ingredients": [{"item": "minecraft:book"}, {"item": "minecraft:paper"}],
        "result": {"item": "siege:plan_book", "count": 1},
        "unlock": {"context": "AlwaysUnlocked"},
    },
})
print("plan book and scroll written")


# ---------- Plan Book cards (the town hall's Plan Book screen, studio/build_tree_ui.py draws the grid) ----------
# One card per pre-designed building per regional style: a small isometric picture of the real design on a paper
# card. *_dim.png is the same card greyed out, for a plan not found yet. Redrawn every run (designs change).
import subprocess, re

CARD_W, CARD_H = 46, 36            # UI pixels; art is drawn at twice the size
CS = 2
PAL = json.load(open(os.path.join(ROOT, ".claude/skills/minecraft-builder/data/palette.json")))
HEX = {}
for b in PAL["blocks"]:
    HEX[b["id"]] = b["hex"]
    for v in b.get("variants", {}).values():
        HEX.setdefault(v.get("bedrock", ""), b["hex"])
for k, v in PAL["extras"].items():
    HEX.setdefault(k, v["hex"])
TERRAIN = json.load(open(os.path.join(RP, "textures/terrain_texture.json")))["texture_data"]
EXTRA = {"water": "#3f6fd8", "grass_path": "#94793f", "farmland": "#593a1f", "wheat": "#c9b24a", "carrots": "#4f9a2a", "potatoes": "#5c9a2a",
         "lantern": "#f0b850", "campfire": "#e88a2a", "iron_chain": "#3c3e46", "flower_pot": "#7a4030", "azalea_leaves_flowered": "#6b8f3a",
         "azalea_leaves": "#5f8a34", "moss_carpet": "#596e2e", "red_wool": "#a12722", "white_wool": "#e9ecec", "blue_wool": "#35399d",
         "cyan_wool": "#158991", "orange_wool": "#f07613", "brown_wool": "#724728", "hay_block": "#a68b0c"}
SUFFIX = re.compile(r"_(stairs|slab|wall_sign|fence_gate|fence|trapdoor|door|wall)$")


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


_colour = {}


def colour(block):
    if block in _colour:
        return _colour[block]
    name = block.split(":", 1)[1]
    c = None
    if block.startswith("siege:"):
        tex = TERRAIN.get(f"siege_{name}", {}).get("textures")
        tex = tex[0] if isinstance(tex, list) else tex
        if isinstance(tex, dict):
            tex = tex.get("path")
        p = os.path.join(RP, f"{tex}.png") if tex else ""
        if p and os.path.exists(p):
            im = Image.open(p).convert("RGBA").resize((1, 1), Image.BOX)
            c = im.getpixel((0, 0))[:3]
        c = c or (130, 126, 118)
    else:
        for n in (name, SUFFIX.sub("", name), SUFFIX.sub("", name) + "s", SUFFIX.sub("", name) + "_planks", re.sub(r"^stripped_", "", name)):
            if n in EXTRA:
                c = hex_rgb(EXTRA[n]); break
            if n in HEX:
                c = hex_rgb(HEX[n]); break
        c = c or (150, 120, 80)
    _colour[block] = c
    return c


THIN = re.compile(r"(pane|fence|wall_sign|trapdoor|chain|lantern|carpet|flower_pot|door|ladder|wheat|carrots|potatoes)")


def picture(cells):
    """An isometric picture of the building, fitted into the card."""
    occ = {(x, y, z) for x, y, z, _ in cells}
    proj = lambda x, y, z: ((x - z), (x + z) * 0.5 - y)
    xs = [proj(x, y, -z)[0] for x, y, z, _ in cells]; ys = [proj(x, y, -z)[1] for x, y, z, _ in cells]
    span_x, span_y = max(xs) - min(xs) + 2, max(ys) - min(ys) + 2
    s = min((CARD_W - 6) * CS / span_x, (CARD_H - 6) * CS / span_y)
    im = Image.new("RGBA", (CARD_W * CS, CARD_H * CS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ox = (CARD_W * CS - span_x * s) / 2 - (min(xs) - 1) * s
    oy = (CARD_H * CS - span_y * s) / 2 - (min(ys) - 1) * s
    for x, y, z, b in sorted(cells, key=lambda c: (c[0] - c[2], c[1])):
        px, py = proj(x, y, -z); px = px * s + ox; py = py * s + oy
        c = colour(b)
        sh = lambda f: tuple(int(v * f) for v in c) + (255,)
        k = 0.5 if THIN.search(b) else 1.0
        top = [(px, py - s), (px + s, py - s * 0.5), (px, py), (px - s, py - s * 0.5)]
        left = [(px - s, py - s * 0.5), (px, py), (px, py + s), (px - s, py + s * 0.5)]
        right = [(px + s, py - s * 0.5), (px, py), (px, py + s), (px + s, py + s * 0.5)]
        if k < 1:
            cx, cy = px, py
            top = [(cx + (a - cx) * k, cy + (b2 - cy) * k) for a, b2 in top]
            left = [(cx + (a - cx) * k, cy + (b2 - cy) * k) for a, b2 in left]
            right = [(cx + (a - cx) * k, cy + (b2 - cy) * k) for a, b2 in right]
        if (x, y + 1, z) not in occ:
            d.polygon(top, fill=sh(1.0))
        d.polygon(left, fill=sh(0.62))
        d.polygon(right, fill=sh(0.8))
    return im


def card_base(dim):
    im = Image.new("RGBA", (CARD_W * CS, CARD_H * CS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    paper, edge = ((70, 66, 60, 255), (40, 38, 36, 255)) if dim else ((226, 212, 178, 255), (120, 92, 52, 255))
    d.rectangle([0, 0, CARD_W * CS - 1, CARD_H * CS - 1], fill=edge)
    d.rectangle([CS, CS, CARD_W * CS - 1 - CS, CARD_H * CS - 1 - CS], fill=paper)
    # faint blueprint grid on the paper
    line = (60, 58, 54, 255) if dim else (204, 190, 156, 255)
    for gx in range(6 * CS, CARD_W * CS - CS, 6 * CS):
        d.line([gx, CS, gx, CARD_H * CS - 1 - CS], fill=line)
    for gy in range(6 * CS, CARD_H * CS - CS, 6 * CS):
        d.line([CS, gy, CARD_W * CS - 1 - CS, gy], fill=line)
    return im


def greyed(pic):
    g = pic.convert("LA").convert("RGBA")
    px = g.load()
    for yy in range(g.height):
        for xx in range(g.width):
            r, gg, b, a = px[xx, yy]
            if a:
                v = 40 + r // 3
                px[xx, yy] = (v, v, v + 4, a)
    return g


from PIL import ImageDraw  # noqa: E402

dump = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "studio/plan_cards/dump.mjs")]))
CARDS = os.path.join(RP, "textures/ui/hc/plans")
os.makedirs(CARDS, exist_ok=True)
for key, cells in dump["cells"].items():
    bid, style = key.split("@")
    pic = picture(cells)
    Image.alpha_composite(card_base(False), pic).save(os.path.join(CARDS, f"{bid}_{style}.png"))
    dim = Image.alpha_composite(card_base(True), greyed(pic))
    ImageDraw.Draw(dim).text((CARD_W * CS - 12, 4), "?", fill=(150, 146, 140, 255))
    dim.save(os.path.join(CARDS, f"{bid}_{style}_dim.png"))

# The "copy a plan to a scroll" card: the scroll icon, big, on a card
scroll = Image.open(os.path.join(RP, "textures/items/siege_plan_scroll.png")).convert("RGBA").resize((28 * CS // 2 * 2, 28 * CS // 2 * 2), Image.NEAREST)
copy = card_base(False)
copy.alpha_composite(scroll, ((CARD_W * CS - scroll.width) // 2, (CARD_H * CS - scroll.height) // 2))
copy.save(os.path.join(CARDS, "copy.png"))
print(f"plan cards: {len(dump['cells'])} designs x 2 in textures/ui/hc/plans/")
