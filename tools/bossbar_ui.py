"""Boss health bars: one look per boss, drawn here and wired into the HUD.

    python3 tools/bossbar_ui.py

Writes Siege_Nights_RP/textures/ui/hc/bossbar/<key>_frame.png and <key>_fill.png, then rewrites
Siege_Nights_RP/ui/hud_screen.json through tools/minimap_ui.py (that script owns the file and pulls the
boss bar part from entries() below, so running either one keeps both).

How it works (no Beta features): Bedrock's add-on files can't pick a boss bar's colour, and the colour the
game sends is always the same magenta for add-on bosses. So the HUD reads the bar's title (the "name" in
each boss entity's minecraft:boss component, or its name tag) and, when the title holds a boss's word
(MATCH below), hides the vanilla bar and shows that boss's own frame, fill and title colour. Any other
boss bar (a wither, another pack's boss) keeps the vanilla look.

Adding a boss: give its minecraft:boss a "name" (without one the bar says "Unknown"), add a row to BOSSES
with a word only its name contains, and run this script.
"""
import os, random, runpy
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXDIR = os.path.join(ROOT, "Siege_Nights_RP", "textures", "ui", "hc", "bossbar")
TEX = "textures/ui/hc/bossbar/"

FW, FH = 196, 13      # frame, with end caps
BW, BH = 182, 5       # the health strip inside it (same size as the vanilla bar)
BX, BY = (FW - BW) // 2, (FH - BH) // 2


def hx(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# key, word in the bar title, title colour, frame (dark, rim, light), fill (dark, mid, light), empty, cap, pattern
BOSSES = [
    ("reeve",     "Clockwork",   "#e8c25a", ("#2a1e0c", "#8a6420", "#d8a640"), ("#7a4e10", "#c8902a", "#f4d27a"), "#1c140a", "gear",    "ticks"),
    ("huntsman",  "Huntsman",    "#dfe6d6", ("#1c211c", "#6e7a6a", "#c4cdb8"), ("#6c7a64", "#a8b8a0", "#eef4e4"), "#141814", "antler",  "streaks"),
    ("bride",     "Bride",       "#8fd6cf", ("#0c1c20", "#2c5a5e", "#6aa8a4"), ("#14504e", "#2c8a84", "#8ad8cc"), "#08161a", "pearl",   "waves"),
    ("seneschal", "Seneschal",   "#f39a4a", ("#1c1210", "#5a3a2a", "#a0644a"), ("#8a2a0c", "#e0601c", "#ffc060"), "#140c0a", "flame",   "embers"),
    ("mother",    "Changelings", "#b7d47a", ("#1a1420", "#4c3a5a", "#8a70a0"), ("#3e5a1c", "#7a9a34", "#c8e07a"), "#120e16", "eye",     "mottle"),
    ("warlord",   "Warlord",     "#e05a4a", ("#1a1414", "#5a5050", "#9a9090"), ("#5a0c0c", "#a01c18", "#e45a44"), "#140c0c", "rivet",   "rivets"),
    ("pretender", "Pretender",   "#d2d6de", ("#18181c", "#5c5e66", "#a8acb6"), ("#5a5e6a", "#9498a6", "#d8dce6"), "#121216", "crack",   "cracks"),
    ("choir",     "Choir",       "#d6c4ff", ("#16122a", "#4e4282", "#9a8ad8"), ("#5a4aa0", "#9a86e8", "#e4dcff"), "#100c20", "note",    "shimmer"),
    ("regent",    "Hollow Crown", "#c08cff", ("#120c1e", "#3c2a5e", "#7a5aa8"), ("#2a1a5a", "#4a34a0", "#8a74e0"), "#0c0816", "gem",     "veins"),
    ("morvane",   "Morvane",     "#ff5ad8", ("#0e0814", "#3a1c4c", "#7a3c96"), ("#3a0c4a", "#7c1c8c", "#e044c8"), "#0a0610", "crown",   "veins"),
]


# ---------- drawing ----------

def strip_fill(img, x0, y0, w, h, dark, mid, light):
    rows = [light, mid, mid, mid, dark] if h == 5 else [light] + [mid] * (h - 2) + [dark]
    for y in range(h):
        for x in range(w):
            img.putpixel((x0 + x, y0 + y), rows[y])


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def pattern(img, kind, dark, mid, light, rng):
    """Marks on the fill strip (img is BW x BH)."""
    W, H = img.size
    if kind == "ticks":                       # clock face ticks, a long one every fifth
        for x in range(6, W, 9):
            for y in range(1, 4 if (x // 9) % 5 else 5):
                img.putpixel((x, y), dark)
    elif kind == "streaks":                   # pale wind streaks
        for x in range(0, W, 7):
            y = rng.randrange(1, 4)
            for d in range(3):
                if x + d < W: img.putpixel((x + d, y), light)
    elif kind == "waves":
        for x in range(W):
            y = 2 + round(1.2 * __import__("math").sin(x / 3.0))
            img.putpixel((x, y), light if x % 12 < 8 else mid)
    elif kind == "embers":
        for x in range(W):
            if rng.random() < 0.18: img.putpixel((x, rng.randrange(1, 4)), light)
            if rng.random() < 0.10: img.putpixel((x, 4), mix(dark, (40, 10, 4), 0.5))
    elif kind == "mottle":
        for x in range(W):
            for y in range(1, 4):
                if rng.random() < 0.22: img.putpixel((x, y), mix(mid, (120, 80, 150), 0.45))
    elif kind == "rivets":
        for x in range(4, W, 12):
            img.putpixel((x, 2), light); img.putpixel((x, 3), dark)
    elif kind == "cracks":
        x = 3
        while x < W - 2:
            y = rng.randrange(1, 4)
            for d in range(rng.randrange(2, 5)):
                if x + d < W: img.putpixel((x + d, max(0, min(4, y + rng.choice((-1, 0, 1))))), mix(light, (230, 190, 90), 0.6))
            x += rng.randrange(8, 16)
    elif kind == "shimmer":
        for x in range(0, W):
            if (x // 3) % 4 == 0: img.putpixel((x, 1), light)
            if (x // 3) % 4 == 2: img.putpixel((x, 3), light)
    elif kind == "veins":                     # magenta veins running through dark stone, blue glints
        y = 2
        for x in range(W):
            if rng.random() < 0.3: y = max(1, min(3, y + rng.choice((-1, 1))))
            img.putpixel((x, y), light)
        for x in range(9, W, 23):
            img.putpixel((x, 2), (110, 170, 255, 255))


CAPS = {   # 5 x 9 motifs for each end cap, "#" light, "+" rim, "." clear
    "gear":   [".+#+.", "+###+", "##.##", "#...#", "##.##", "+###+", ".+#+.", "..#..", "....."],
    "antler": ["#...#", "#.#.#", ".###.", "..#..", "..#..", ".+#+.", "..#..", ".....", "....."],
    "pearl":  [".....", ".+#+.", "+###+", "#####", "+###+", ".+#+.", ".....", ".....", "....."],
    "flame":  ["..#..", ".+#..", ".##+.", "+###+", "#####", "+###+", ".+#+.", ".....", "....."],
    "eye":    [".....", ".+++.", "+#.#+", "#.#.#", "+#.#+", ".+++.", ".....", ".....", "....."],
    "rivet":  [".....", ".+#+.", "+###+", ".+#+.", ".....", ".+#+.", "+###+", ".+#+.", "....."],
    "crack":  ["..#..", ".#+..", "..#..", "...#.", "..#+.", ".#...", "..#..", ".....", "....."],
    "note":   ["...##", "...#+", "...#.", "...#.", ".###.", "####.", ".##..", ".....", "....."],
    "gem":    ["..#..", ".###.", "##+##", ".###.", "..#..", ".....", ".....", ".....", "....."],
    "crown":  ["#.#.#", "#####", "+###+", "#+#+#", "#####", ".....", ".....", ".....", "....."],
}


def frame(dark, rim, light, empty, cap):
    img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    # body: dark outline, rim colour, light top edge
    for x in range(BX - 2, BX + BW + 2):
        for y in range(BY - 2, BY + BH + 2):
            edge = x in (BX - 2, BX + BW + 1) or y in (BY - 2, BY + BH + 1)
            img.putpixel((x, y), dark if edge else rim)
    for x in range(BX - 1, BX + BW + 1):
        img.putpixel((x, BY - 1), light)
    for x in range(BX, BX + BW):
        for y in range(BY, BY + BH):
            img.putpixel((x, y), empty)
    # end caps
    motif = CAPS[cap]
    for side in (0, 1):
        x0 = 0 if side == 0 else FW - 5
        for y, row in enumerate(motif):
            for x, ch in enumerate(row):
                xx = x0 + (x if side == 0 else 4 - x)
                yy = 2 + y
                if ch == "#": img.putpixel((xx, yy), light)
                elif ch == "+": img.putpixel((xx, yy), rim)
        # outline the motif so it reads on any sky
        for y in range(FH):
            for x in range(x0, x0 + 5):
                if img.getpixel((x, y))[3] == 0 and any(
                        0 <= x + dx < FW and 0 <= y + dy < FH and img.getpixel((x + dx, y + dy))[3] and img.getpixel((x + dx, y + dy))[:3] != dark[:3]
                        and not (BX - 2 <= x + dx < BX + BW + 2) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    img.putpixel((x, y), dark)
    return img


def fill(dark, mid, light, pat, seed):
    img = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    strip_fill(img, 0, 0, BW, BH, dark, mid, light)
    pattern(img, pat, dark, mid, light, random.Random(seed))
    return img


def draw_all():
    os.makedirs(TEXDIR, exist_ok=True)
    for i, (key, _w, _c, fr, fi, empty, cap, pat) in enumerate(BOSSES):
        frame(*map(hx, fr), hx(empty), cap).save(os.path.join(TEXDIR, f"{key}_frame.png"))
        fill(*map(hx, fi), pat, 7 + i).save(os.path.join(TEXDIR, f"{key}_fill.png"))
        print("drew", key)


# ---------- HUD (JSON UI) ----------

NAME = "#bossName"
COLL = {"binding_type": "collection", "binding_collection_name": "boss_bars"}


def has(word):
    return f"(not (({NAME} - '{word}') = {NAME}))"


def name_binding():
    return dict(COLL, binding_name=NAME)


def view_visible(expr):
    return {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}


def title(color):
    # bossCore.js colours the name tag (§c name, §7 temper); drop those codes here so the bar's own colour shows
    return {"type": "label", "text": "#text", "color": color, "shadow": True, "enable_profanity_filter": True,
            "anchor_from": "top_middle", "anchor_to": "top_middle", "layer": 3,
            "bindings": [name_binding(), {"binding_type": "view", "source_property_name": f"(({NAME} - '\u00a7c') - '\u00a77')",
                                          "target_property_name": "#text"}]}


def variant(key, word, color):
    rgb = [round(v / 255, 3) for v in hx(color)[:3]]
    return {f"hc_boss_{key}": {
        "type": "panel", "size": [FW, 22], "anchor_from": "top_middle", "anchor_to": "top_middle",
        "bindings": [name_binding(), view_visible(has(word))],
        "controls": [
            {"title": title(rgb)},
            {"frame": {"type": "image", "texture": f"{TEX}{key}_frame", "size": [FW, FH], "layer": 1,
                       "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 9]}},
            {"fill": {"type": "image", "texture": f"{TEX}{key}_fill", "size": [BW, BH], "layer": 2,
                      "anchor_from": "top_left", "anchor_to": "top_left", "offset": [BX, 9 + BY],
                      "clip_direction": "left", "clip_pixelperfect": False,
                      "bindings": [dict(COLL, binding_name="#progress_percentage", binding_name_override="#clip_ratio")]}},
        ]}}


def entries():
    """The hud_screen.json keys for the boss bars (merged in by tools/minimap_ui.py)."""
    none = " and ".join(f"(({NAME} - '{w}') = {NAME})" for _k, w, *_ in BOSSES)
    controls = [variant(k, w, c) for k, w, c, *_ in BOSSES]
    controls.append({"hc_boss_vanilla": {      # any boss that isn't ours: the game's own bar
        "type": "panel", "size": [182, 20], "anchor_from": "top_middle", "anchor_to": "top_middle",
        "$progress_bar_collection": "boss_bars",
        "bindings": [name_binding(), view_visible(f"({none})")],
        "controls": [
            {"boss_name@hud.boss_name_panel": {}},
            {"progress_bar_for_collections@common.progress_bar_for_collections": {"offset": [0, 10]}},
        ]}})
    return {
        # vanilla's boss_health_panel is one grid item per boss bar; same bindings, our controls
        "boss_health_panel": {
            "type": "panel", "size": [FW, 24], "anchor_from": "top_middle", "anchor_to": "top_middle",
            "$progress_bar_collection": "boss_bars",
            "controls": controls,
            "bindings": [dict(COLL, binding_name="#bar_visible", binding_name_override="#visible")],
        },
        "boss_health_grid": {"size": [FW, "30%"]},
    }


if __name__ == "__main__":
    draw_all()
    runpy.run_path(os.path.join(ROOT, "tools", "minimap_ui.py"), run_name="__main__")
