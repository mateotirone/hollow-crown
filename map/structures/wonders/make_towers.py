"""The three tower wonders, written to build-instructions/towers/README.md (Mateo's tower guide, 2026-11-12).

    python3 make_towers.py   -> great_lighthouse.json, high_watch.json, lantern_spire.json (minecraft-builder specs)

Then run export_wonders.py. Every tower here has the guide's five things: a plain solid shaft with strong
corners, stages marked by courses every 5 to 7 blocks, a top stage that changes and overhangs on brackets, a
steep roof with a flared eave (the lighthouse keeps Saltreach's low copper cap: no needle spires there), and a
finish on top. Widths are odd; the front of each is +z (south in the spec).
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def octagon(hw, y0, y1, material, op=None, chamfer=None):
    """Octagonal prism, half width hw (n + 0.5 = odd width), layers y0..y1 inclusive."""
    c = chamfer if chamfer is not None else round(hw * 0.59)
    a, b = hw, hw - c
    pts = [[b, a], [a, b], [a, -b], [b, -a], [-b, -a], [-a, -b], [-a, b], [-b, a]]
    s = {"shape": "extrude", "points": pts, "axis": "y", "from": y0, "to": y1, "material": material}
    if op: s["op"] = op
    return s


def octagon_slab(hw, y, material, chamfer=None):
    """A ring of top slabs at layer y, out to half width hw (a course or a corbel row)."""
    s = octagon(hw, y, y, material, chamfer=chamfer)
    s["from"], s["to"] = y + 0.5, y
    return s


def box(x0, y0, z0, x1, y1, z1, material, op=None):
    s = {"shape": "box", "min": [x0, y0, z0], "max": [x1, y1, z1], "material": material}
    if op: s["op"] = op
    return s


def pyramid(hw, y0, height, material, flare=None, depth_hw=None, step=0.25, min_w=0.05):
    """A square (or, with depth_hw, oblong hipped) roof built from thin square slices, so the fitter sees a true
    slope and lays stairs. hw = half width at the eave; it rises `height` to a point (or ridge). flare =
    (out, rise): a bell-cast foot jutting `out` past hw over the first `rise` layers at a gentle pitch."""
    out = []
    dz = (depth_hw - hw) if depth_hw else 0
    t = 0.0
    while t < height - 1e-6:
        if flare and t < flare[1]:
            w = hw + flare[0] * (1 - t / flare[1])
        else:
            t0 = flare[1] if flare else 0
            w = hw * (1 - (t - t0) / (height - t0))
        if w > min_w:
            out.append({"shape": "extrude", "points": [[-w, -(w + dz)], [w, -(w + dz)], [w, w + dz], [-w, w + dz]],
                        "axis": "y", "from": y0 + t, "to": y0 + t + step - 1, "material": material})
        t += step
    return out


def slit(x, y, z, axis, h=2, w=1, depth=3):
    return {"op": "sub", "shape": "arch", "at": [x, y, z], "width": w, "height": h, "depth": depth, "axis": axis}


def stacked_windows(faces, rows, half):
    """Windows centre on centre up every face: rows = [(y, height)], faces = 'nsew'."""
    out = []
    for f in faces:
        for y, h in rows:
            if f == "s": out.append(slit(0, y, half, "x", h))
            if f == "n": out.append(slit(0, y, -half, "x", h))
            if f == "e": out.append(slit(half, y, 0, "z", h))
            if f == "w": out.append(slit(-half, y, 0, "z", h))
    return out


def glaze(faces, rows, half, pane):
    out = []
    for f in faces:
        for y, h in rows:
            for k in range(h):
                if f == "s": out.append([0, y + k, half, pane])
                if f == "n": out.append([0, y + k, -half, pane])
                if f == "e": out.append([half, y + k, 0, pane])
                if f == "w": out.append([-half, y + k, 0, pane])
    return out


def ring_cells(hw, chamfer=None):
    """Integer cells on the outline of an octagon of half width hw (for railings and lantern posts)."""
    c = chamfer if chamfer is not None else round(hw * 0.59)
    n = int(hw - 0.5)
    cells = []
    for x in range(-n, n + 1):
        for z in range(-n, n + 1):
            inside = abs(x) <= n and abs(z) <= n and abs(x) + abs(z) <= 2 * n - c + 1
            edge = abs(x) == n or abs(z) == n or abs(x) + abs(z) == 2 * n - c + 1
            if inside and edge: cells.append((x, z))
    return cells


# ---------------------------------------------------------------------------------------------------------
# Great Lighthouse (Saltreach): an octagonal white tower banded in teal on a stone base by the sea, a gallery
# on brackets, a glass lamp room with sea lanterns, a low oxidized copper cap, the keeper's cottage beside it.

def lighthouse():
    mats = {
        "base": {"ladder": ["tuff", "cobblestone", "andesite"], "axis": "y", "noise": 0.15},
        "sand": {"ladder": ["sandstone", "smooth_sandstone", "cut_sandstone"], "axis": "noise", "scale": 3},
        "white": {"ladder": ["polished_diorite", "white_concrete", "calcite"], "axis": "noise", "scale": 2},
        "teal": "prismarine_bricks",
        "teal_dark": "dark_prismarine",
        "deck": "smooth_stone",
        "cap": "waxed_oxidized_cut_copper",
        "mullion": "dark_prismarine",
        "glass": "light_blue_stained_glass",
        "roofc": {"ladder": ["waxed_oxidized_cut_copper", "prismarine_bricks"], "axis": "noise", "scale": 2},
    }
    S = []
    # stone base: a battered two-step plinth with a terrace on top
    S.append(octagon(9.5, 0, 1, "base"))
    S.append(octagon(8.5, 2, 3, "base"))
    S.append(octagon_slab(9.5, 1, "base"))
    S.append(octagon(8.5, 4, 4, "deck"))
    # a flight of steps up the front of the base
    S.append({"shape": "extrude", "points": [[8.5, 0], [8.5, 5], [13.5, 0]], "axis": "x", "from": -1.5, "to": 1.5, "material": "sand"})
    # the shaft, in four stages stepping in: 11 wide, then 9
    stages = [(5, 11, 5.5), (12, 18, 5.5), (19, 25, 4.5), (26, 31, 4.5)]
    for y0, y1, hw in stages:
        S.append(octagon(hw, y0, y1, "white"))
    # teal bands: painted courses in the wall plus a slab course one out at every stage line
    for y in (11, 18, 25):
        hw = 5.5 if y < 19 else 4.5
        S.append(octagon(hw + 0.01, y, y, "teal", op="paint"))
        S.append(octagon_slab(hw + 1, y, "teal_dark"))
    # plinth of the shaft in sandstone (the strong foot)
    S.append(octagon(5.5 + 0.01, 5, 6, "sand", op="paint"))
    # gallery on brackets: two corbel rows of slabs stepping out, then the deck one further out
    S.append(octagon_slab(5.5, 31, "teal_dark"))
    S.append(octagon(6.5, 32, 32, "deck"))
    # lamp room: glass all round on a white drum, 7 wide
    S.append(octagon(3.5, 33, 33, "white"))
    S.append(octagon(3.5, 34, 38, "glass"))
    # the low copper cap: a bell-cast eave one out, then a low dome
    S.append(octagon_slab(4.5, 38, "teal_dark"))
    S.append({"shape": "lathe", "at": [0, 39, 0], "profile": [[0, 4.6], [0.6, 4.4], [1.5, 3.7], [2.5, 2.6], [3.3, 1.2], [3.7, 0]], "material": "cap"})
    # door and windows, centre on centre (slits low, lancets high)
    S.append({"op": "sub", "shape": "arch", "at": [0, 5, 5], "width": 3, "height": 4, "depth": 3, "axis": "x"})
    S += stacked_windows("nsew", [(14, 2)], 5)
    S += stacked_windows("nsew", [(21, 3), (27, 3)], 4)
    S += stacked_windows("new", [(8, 2)], 5)
    # keeper's cottage beside the tower: stone below, whitewash above, a low hipped copper-green roof
    cx0, cx1, cz0, cz1 = 10, 16, -4, 4
    S.append(box(cx0, 0, cz0, cx1, 2, cz1, "sand"))
    S.append(box(cx0, 3, cz0, cx1, 4, cz1, "white"))
    S.append(box(cx0 - 1, 0, cz0 - 1, cx1 + 1, 0, cz1 + 1, "base"))
    S.append({"op": "sub", "shape": "box", "min": [cx0 + 1, 1, cz0 + 1], "max": [cx1 - 1, 4, cz1 - 1]})
    hw = (cx1 - cx0) / 2 + 1  # one out over the walls
    mid = (cx0 + cx1) / 2
    S.append({"shape": "box", "min": [cx0 - 1, 5, cz0 - 1], "max": [cx1 + 1, 5, cz1 + 1], "material": "white"})
    S.append({"op": "sub", "shape": "box", "min": [cx0, 5, cz0], "max": [cx1, 5, cz1]})
    roof = pyramid(hw + 0.5, 5, hw + 0.5, "roofc", depth_hw=(cz1 - cz0) / 2 + 1.5)
    for r in roof:
        for pt in r["points"]: pt[0] += mid
    S += roof
    S.append({"op": "sub", "shape": "arch", "at": [13, 1, cz1], "width": 1, "height": 2, "depth": 1, "axis": "x"})
    S += [slit(cx0, 3, 0, "z", 1), slit(cx1, 3, 0, "z", 1), slit(11, 1, cz1, "x", 1), slit(15, 1, cz1, "x", 1)]
    P = []
    # lamp: a column of sea lanterns in the lamp room
    P += [[0, y, 0, "sea_lantern"] for y in range(34, 39)]
    # mullions at the lamp room's eight corners
    for x, z in ring_cells(3.5):
        if abs(x) == abs(z): P += [[x, y, z, "dark_prismarine"] for y in range(34, 39)]
    # gallery railing of prismarine wall round the deck's edge
    for x, z in ring_cells(6.5):
        P.append([x, 33, z, "prismarine_wall"])
    # finial: a small lantern on a post with a rod, never a bare point
    P += [[0, 43, 0, "prismarine_wall"], [0, 44, 0, "lantern"], [0, 45, 0, "lightning_rod"]]
    # glass in the windows, lanterns at the door and on the terrace corners
    P += glaze("nsew", [(14, 2)], 5, "light_blue_stained_glass_pane")
    P += glaze("nsew", [(21, 3), (27, 3)], 4, "light_blue_stained_glass_pane")
    P += glaze("new", [(8, 2)], 5, "light_blue_stained_glass_pane")
    P += [[-2, 5, 6, "lantern"], [2, 5, 6, "lantern"]]
    for x, z in ring_cells(8.5):
        if abs(x) == abs(z) and (x, z) != (0, 0): P.append([x, 5, z, "lantern"])
    P += [[13, 1, cz1, "spruce_door", {"facing": "s"}], [13, 2, cz1, "spruce_door", {"facing": "s", "upper": True}]]
    return {"name": "great_lighthouse", "materials": mats, "shapes": S, "place": P}


# ---------------------------------------------------------------------------------------------------------
# High Watch (Vale): a civic watchtower in a walled yard. Stone shaft with quoins and string courses, a jettied
# stripped-spruce watch stage with calcite infill and open arches, a steep slate spire with a bell-cast eave and
# an open lantern on top. Corner towers of the yard get machicolated battlements.

def high_watch():
    mats = {
        "wall": {"ladder": "VAL-01", "axis": "y", "noise": 0.12},
        "stone": {"ladder": ["cobblestone", "andesite", "stone_bricks", "stone_bricks"], "axis": "y", "noise": 0.1},
        "quoin": "polished_andesite",
        "plinth": {"ladder": ["mossy_cobblestone", "cobblestone"], "axis": "y"},
        "frame": "stripped_spruce_log",
        "infill": "calcite",
        "roof": {"ladder": ["deepslate_tiles", "cobbled_deepslate"], "axis": "noise", "scale": 2},
        "yard": {"ladder": "VAL-08", "axis": "noise", "scale": 3},
        "trim": "spruce_planks",
    }
    S, PARTS, P = [], [], []
    # the yard and its curtain wall
    S.append(box(-15, -1, -15, 15, -1, 15, "yard"))
    S.append(box(-15, 0, -15, 15, 6, 15, "wall"))
    S.append(box(-14, 0, -14, 14, 6, 14, "wall", op="sub"))
    S.append({"op": "sub", "shape": "arch", "at": [0, 0, 15], "width": 5, "height": 5, "depth": 1, "axis": "x"})
    # corner towers: 5 wide, 13 tall, machicolations (a row of upside-down stairs one out) and merlons
    for sx in (-14, 14):
        for sz in (-14, 14):
            S.append(box(sx - 2, 0, sz - 2, sx + 2, 12, sz + 2, "stone"))
            S.append(box(sx - 2, 0, sz - 2, sx + 2, 1, sz + 2, "plinth", op="paint"))
            PARTS.append({"part": "string_course", "rect": [sx - 2, sz - 2, sx + 2, sz + 2], "y": 12, "material": "stone_bricks"})
            for dx in range(-2, 3):
                for dz in range(-2, 3):
                    if max(abs(dx), abs(dz)) == 2 and (dx + dz) % 2 == 0:
                        P.append([sx + dx, 13, sz + dz, "stone_bricks"])
            P.append([sx, 13, sz, "lantern"])
    # the central tower: 11 wide, plinth, a shaft in five stages, quoins at the corners
    S.append(box(-6, 0, -6, 6, 1, 6, "plinth"))
    S.append(box(-5, 2, -5, 5, 31, 5, "stone"))
    for cx in (-5, 5):
        for cz in (-5, 5):
            for y in range(2, 32):
                # quoins: long and short stones alternating up each corner
                P.append([cx, y, cz, "polished_andesite"])
                if (y // 2) % 2 == 0:
                    P.append([cx - (1 if cx > 0 else -1), y, cz, "polished_andesite"])
                else:
                    P.append([cx, y, cz - (1 if cz > 0 else -1), "polished_andesite"])
    for y in (8, 14, 20, 26):
        PARTS.append({"part": "string_course", "rect": [-5, -5, 5, 5], "y": y, "material": "stone_bricks"})
    # cornice: two rows under the watch stage
    PARTS.append({"part": "string_course", "rect": [-5, -5, 5, 5], "y": 31, "material": "stone_bricks"})
    S.append(box(-6, 31, -6, 6, 31, 6, "stone"))
    # door and windows centre on centre: slits low, lancets high, a round window mid-shaft on the front
    S.append({"op": "sub", "shape": "arch", "at": [0, 2, 5], "width": 3, "height": 5, "depth": 3, "axis": "x"})
    S += stacked_windows("nsew", [(10, 2), (16, 2)], 5)
    S += stacked_windows("nsew", [(22, 3), (27, 3)], 5)
    # watch stage: stripped spruce frame jettied one out (13 wide), calcite infill, an open arch on every face
    S.append(box(-6, 32, -6, 6, 37, 6, "infill"))
    S.append(box(-5, 32, -5, 5, 37, 5, "infill", op="sub"))
    for f in "nsew":
        if f in "ns": S.append({"op": "sub", "shape": "arch", "at": [0, 33, 6 if f == "s" else -6], "width": 5, "height": 4, "depth": 1, "axis": "x"})
        else: S.append({"op": "sub", "shape": "arch", "at": [6 if f == "e" else -6, 33, 0], "width": 5, "height": 4, "depth": 1, "axis": "z"})
    for x in (-6, -3, 3, 6):
        for z in (-6, 6):
            P += [[x, y, z, "stripped_spruce_log"] for y in range(32, 38)]
            P += [[z, y, x, "stripped_spruce_log"] for y in range(32, 38)]
    for x in range(-6, 7):
        for z in (-6, 6):
            P.append([x, 32, z, "stripped_spruce_log", {"axis": "x"}]); P.append([z, 32, x, "stripped_spruce_log", {"axis": "z"}])
            P.append([x, 38, z, "stripped_spruce_log", {"axis": "x"}]); P.append([z, 38, x, "stripped_spruce_log", {"axis": "z"}])
    # brackets under the jetty: an upside-down stair under each corner and every third block
    for i in (-6, -3, 0, 3, 6):
        P.append([i, 31, 6, "spruce_stairs", {"facing": "n", "half": "top"}])
        P.append([i, 31, -6, "spruce_stairs", {"facing": "s", "half": "top"}])
        P.append([6, 31, i, "spruce_stairs", {"facing": "w", "half": "top"}])
        P.append([-6, 31, i, "spruce_stairs", {"facing": "e", "half": "top"}])
    # rail in each arch and the watch bell
    for i in range(-2, 3):
        P += [[i, 33, 6, "spruce_fence"], [i, 33, -6, "spruce_fence"], [6, 33, i, "spruce_fence"], [-6, 33, i, "spruce_fence"]]
    P += [[0, 37, 0, "spruce_planks"], [0, 36, 0, "bell"], [0, 32, 0, "spruce_planks"]]
    # the spire: eave ring 15 wide (one out over the stage), a bell-cast foot, then steep to a point 20 up
    S += pyramid(6.5, 39, 27, "roof", flare=(1, 2), min_w=1.5)
    # open lantern on the tip: four posts, a lantern, its own tiny cap and a rod
    tip = 60
    for x, z in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        P += [[x, tip, z, "spruce_fence"], [x, tip + 1, z, "spruce_fence"]]
    P += [[0, tip - 1, 0, "deepslate_tiles"], [0, tip, 0, "lantern"]]
    for x in (-1, 0, 1):
        for z in (-1, 0, 1):
            P.append([x, tip + 2, z, "deepslate_tile_slab"])
    P += [[0, tip + 2, 0, "deepslate_tiles"], [0, tip + 3, 0, "lightning_rod"]]
    # glass and gate lanterns
    P += glaze("nsew", [(10, 2), (16, 2)], 5, "brown_stained_glass_pane")
    P += glaze("nsew", [(22, 3), (27, 3)], 5, "brown_stained_glass_pane")
    P += [[-3, 4, 16, "lantern"], [3, 4, 16, "lantern"], [-2, 5, 6, "lantern"], [2, 5, 6, "lantern"]]
    return {"name": "high_watch", "materials": mats, "shapes": S, "parts": PARTS, "place": P}


# ---------------------------------------------------------------------------------------------------------
# Lantern Spire (Blackfen): mud brick on mangrove piles, a mangrove frame above, a hooded timber lantern stage
# jettied out, a dark shingle hood roof with moss, lanterns hung under the hood and from brackets up the shaft.

def lantern_spire():
    mats = {
        "deck": {"ladder": ["mangrove_planks", "dark_oak_planks", "spruce_planks"], "axis": "noise", "scale": 3},
        "mud": {"ladder": ["mud_bricks", "packed_mud", "brown_terracotta"], "axis": "y", "noise": 0.12},
        "foot": {"ladder": ["tuff_bricks", "mud_bricks"], "axis": "noise", "scale": 2},
        "moss": {"ladder": ["mossy_cobblestone", "mossy_stone_bricks"], "axis": "noise", "scale": 3},
        "post": "mangrove_log",
        "band": "stripped_mangrove_log",
        "timber": "dark_oak_planks",
        "roof": "dark_oak_planks",
    }
    S, PARTS, P = [], [], []
    # piles and the boardwalk deck the spire stands on
    for x, z in ((-9, -9), (9, -9), (-9, 9), (9, 9), (0, -12), (0, 12), (-12, 0), (12, 0)):
        S.append({"shape": "cylinder", "at": [x, -2, z], "r": 1.5, "h": 3, "material": "post"})
    S.append({"shape": "cylinder", "at": [0, 1, 0], "r": 13.5, "h": 1, "material": "deck"})
    S.append({"op": "sub", "shape": "cylinder", "at": [0, 1, 0], "r": 9.5, "h": 1})
    S.append({"shape": "cylinder", "at": [0, 1, 0], "r": 9.5, "h": 1, "material": "deck"})
    # the shaft: 9 wide, a stone foot, then mud brick in four stages between mangrove corner posts
    S.append(box(-5, 2, -5, 5, 3, 5, "foot"))
    S.append(box(-4, 4, -4, 4, 28, 4, "mud"))
    for cx in (-4, 4):
        for cz in (-4, 4):
            P += [[cx, y, cz, "mangrove_log"] for y in range(4, 29)]
    for y in (10, 16, 22):
        for i in range(-4, 5):
            P += [[i, y, 4, "stripped_mangrove_log", {"axis": "x"}], [i, y, -4, "stripped_mangrove_log", {"axis": "x"}], [4, y, i, "stripped_mangrove_log", {"axis": "z"}], [-4, y, i, "stripped_mangrove_log", {"axis": "z"}]]
        PARTS.append({"part": "string_course", "rect": [-4, -4, 4, 4], "y": y, "material": "mud_bricks"})
    PARTS.append({"part": "string_course", "rect": [-4, -4, 4, 4], "y": 28, "material": "spruce_planks"})
    S.append({"op": "sub", "shape": "arch", "at": [0, 4, 4], "width": 3, "height": 4, "depth": 3, "axis": "x"})
    S += stacked_windows("nsew", [(12, 2), (18, 2)], 4)
    S += stacked_windows("nsew", [(24, 3)], 4)
    # moss creeping up the foot
    S.append({"op": "paint", "shape": "box", "min": [-5, 2, -5], "max": [5, 5, 5], "material": "moss"})
    # the hooded lantern stage: timber, jettied one out (11 wide), wide open bays with froglights inside
    S.append(box(-5, 29, -5, 5, 34, 5, "timber"))
    S.append(box(-4, 29, -4, 4, 34, 4, "timber", op="sub"))
    for f in "nsew":
        if f in "ns": S.append({"op": "sub", "shape": "box", "min": [-3, 30, 5 if f == "s" else -5], "max": [3, 33, 5 if f == "s" else -5]})
        else: S.append({"op": "sub", "shape": "box", "min": [5 if f == "e" else -5, 30, -3], "max": [5 if f == "e" else -5, 33, 3]})
    for x in (-5, 5):
        for z in (-5, 5):
            P += [[x, y, z, "mangrove_log"] for y in range(29, 35)]
    for i in (-5, -2, 0, 2, 5):
        P.append([i, 28, 5, "spruce_stairs", {"facing": "n", "half": "top"}])
        P.append([i, 28, -5, "spruce_stairs", {"facing": "s", "half": "top"}])
        P.append([5, 28, i, "spruce_stairs", {"facing": "w", "half": "top"}])
        P.append([-5, 28, i, "spruce_stairs", {"facing": "e", "half": "top"}])
    for i in range(-3, 4):
        P += [[i, 30, 5, "dark_oak_fence"], [i, 30, -5, "dark_oak_fence"], [5, 30, i, "dark_oak_fence"], [-5, 30, i, "dark_oak_fence"]]
    P += [[0, y, 0, "verdant_froglight"] for y in range(29, 33)]
    # the hood: a steep dark shingle roof jutting two out (15 wide) with a bell-cast foot, moss on the eave
    S += pyramid(6.5, 35, 21, "roof", flare=(1, 2), min_w=1.0)
    # lanterns hung under the hood at each corner and mid-side, on chains
    for x, z in ((-6, -6), (6, -6), (-6, 6), (6, 6), (0, 7), (0, -7), (7, 0), (-7, 0)):
        P += [[x, 34, z, "iron_chain"], [x, 33, z, "lantern", {"hanging": True}]]
    # lanterns on brackets up the shaft, every stage
    for y in (14, 20, 26):
        for x, z, f in ((0, 5, "s"), (0, -5, "n"), (5, 0, "e"), (-5, 0, "w")):
            P += [[x, y, z, "dark_oak_fence"], [x, y - 1, z, "lantern", {"hanging": True}]]
    # finial: a lantern on a post with a rod
    P += [[0, 55, 0, "dark_oak_fence"], [0, 56, 0, "lantern"], [0, 57, 0, "lightning_rod"]]
    # moss on the deck in patches
    for x, z in ((-7, 3), (-8, 4), (6, -8), (7, -7), (3, 9), (-3, -9), (10, 2), (-10, -3)):
        P.append([x, 1, z, "moss_block"])
    # deck lanterns and the windows' brown glass
    for x, z in ((-9, -9), (9, -9), (-9, 9), (9, 9)):
        P += [[x, 2, z, "dark_oak_fence"], [x, 3, z, "lantern"]]
    P += glaze("nsew", [(12, 2), (18, 2)], 4, "brown_stained_glass_pane")
    P += glaze("nsew", [(24, 3)], 4, "brown_stained_glass_pane")
    return {"name": "lantern_spire", "materials": mats, "shapes": S, "parts": PARTS, "place": P}


if __name__ == "__main__":
    for spec in (lighthouse(), high_watch(), lantern_spire()):
        with open(os.path.join(HERE, spec["name"] + ".json"), "w") as f:
            json.dump(spec, f, indent=1)
        print("wrote", spec["name"])
