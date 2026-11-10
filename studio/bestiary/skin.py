# Skin painter for the bestiary box models, in the house style (art/STYLE-GUIDE.md):
#   * every material is a 6-tone hue-shifted ramp from studio/art/palette.py (0 shadow .. 5 highlight)
#   * light from the top-left: top faces and top/left edges a tone lighter, bottom/right a tone darker
#   * texture comes from patterns and small clusters (folds, tufts, rivets, scales), never per-pixel noise
# paint() is called for every texel of every cube face. A cube has a material, and may have a face
# (drawn on its front) and a role (torso, arm, leg, paw) that adds belts, hands, boots and hooves.
import colorsys, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "art"))
from palette import M, ramp, fixed

KNOWN = {(160, 164, 172): M["iron"], (70, 70, 80): M["blacksteel"], (218, 176, 70): M["gold"], (196, 150, 120): M["skin"]}
BOOT = ramp("#4a3226", 0.07, 0.46)
WHITE_EYE = (236, 236, 230)
PARCH = M["parchment"]
_cache = {}

def material(spec, name=""):
    """-> (ramp, kind, alpha)"""
    key = (repr(spec), name)
    if key in _cache: return _cache[key]
    kind = "plain"; c = spec
    if isinstance(spec, dict): c = spec["c"]; kind = spec.get("style", "plain")
    alpha = c[3] if len(c) == 4 else 255
    rgb = tuple(c[:3])
    if rgb in KNOWN: r = KNOWN[rgb]
    else:
        _, l, _ = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
        r = ramp(rgb, max(0.04, l - 0.30), min(0.93, l + 0.24), cool=0.10, warm=0.06)
    if kind == "plain" and name in ("skin", "pale", "face"): kind = "skin"
    if kind == "metal": kind = "plate"
    _cache[key] = (r, kind, alpha)
    return _cache[key]

def R(r, i): return r[max(0, min(len(r) - 1, int(i)))]
BASE = {"up": 4, "north": 3, "east": 3, "west": 2, "south": 2, "down": 1}

def tone(kind, f, x, y, w, h, s):
    v = BASE[f]; side = f not in ("up", "down")
    e = 0
    if (h >= 3 and y == 0) or (w >= 3 and x == 0): e = 1
    if (h >= 3 and y == h - 1) or (w >= 3 and x == w - 1): e = -1
    p = 0
    if kind == "cloth":
        if side and (x + s) % 4 == 2 and y > h * 0.3: p = -1                      # folds hang from a third of the way down
        elif (x * 5 + y * 3 + s) % 13 == 0: p = -1
    elif kind == "fur":
        if (x * 3 + y * 2 + s) % 7 == 0 or (x * 3 + (y - 1) * 2 + s) % 7 == 0: p = -1   # two-pixel tufts
        elif (x * 2 + y * 5 + s) % 9 == 0: p = 1
    elif kind == "plate":
        if side and h >= 8 and y == h // 2: return max(0, v - 2)                  # panel seam
        if side and h >= 8 and y == h // 2 + 1: p = 1
        elif (x + y + s) % 7 == 0: p = 1                                          # sheen
        if side and w >= 6 and h >= 6 and (x in (1, w - 2)) and (y in (1, h - 2)): return 5   # rivets
    elif kind == "mail":
        return max(0, min(5, (2 if (x + y) % 2 else 3) + (1 if f == "up" else 0) + min(e, 0)))
    elif kind == "bone":
        if side and h >= 8 and y % 4 == 3: p = -1
        elif (x * 7 + y * 3 + s) % 13 == 0: p = -1
    elif kind == "wood":
        if (x + s) % 4 == 3: return max(0, v - 2)                                 # plank seam
        p = -1 if (x * 13 + s) % 3 == 0 else 0
        if (y * 3 + x * 5 + s) % 11 == 0: p -= 1
    elif kind == "stone":                                                         # overlapping scales / rough facets
        row = y // 2
        if (x + row * 2 + s) % 4 == 0: p = -1
        elif y % 2 == 0 and (x + row * 2 + s) % 4 == 2: p = 1
    elif kind == "skin":
        if (x * 5 + y * 7 + s) % 17 == 0: p = -1
    elif kind == "glow":
        return 5 if 0 < x < w - 1 and 0 < y < h - 1 else 4
    else:
        if (x * 3 + y * 5 + s) % 11 == 0: p = -1
    return max(0, min(5, v + e + p))

def draw_face(kind_face, r, kind, pal, x, y, w, h, s):
    """Colour for a texel of a head's front, or None to fall through to the plain material."""
    if w < 5 or h < 5: return None
    eye = tuple(pal.get("eye", WHITE_EYE)[:3])
    ew = 2 if w >= 8 else 1
    lx, rx, ry = w // 2 - 1 - ew, w // 2 + 1, h // 2
    in_l, in_r = lx <= x < lx + ew, rx <= x < rx + ew
    mid = x in (w // 2 - 1, w // 2)
    if kind_face == "eyes":
        if y == ry and (in_l or in_r):
            if ew == 1: return eye
            return WHITE_EYE if x in (lx, rx) else eye
        if y == ry - 1 and (in_l or in_r): return R(r, 0)                          # brows
        if y == ry + 1 and mid: return R(r, 2)                                     # nose shadow
        if y == ry + 2 and w // 2 - 2 <= x <= w // 2 + 1: return R(r, 1)           # mouth
    elif kind_face == "hollow":                                                    # sunken sockets with one live glint
        if y in (ry - 1, ry) and (in_l or in_r):
            if y == ry and x in (lx + ew - 1, rx): return eye
            return R(r, 0)
        if y == ry + 1 and (in_l or in_r): return R(r, 1)
        if y == ry - 2 and (in_l or in_r): return R(r, 2)
        if y == ry + 2 and mid: return R(r, 0)                                     # a small open mouth
        if y == ry + 3 and mid and h >= 8: return R(r, 1)
    elif kind_face in ("glow", "low"):
        ey = ry - 1 if kind_face == "low" else ry
        if y == ey and (in_l or in_r): return eye
        if y == ey - 1 and lx <= x < rx + ew: return R(r, 1)                       # brow ridge
        if kind == "bone":
            if y == ey + 1 and mid: return R(r, 0)                                 # nose hole
            if y == h - 2 and 1 <= x <= w - 2: return R(r, 5 if x % 2 else 0)      # teeth
        elif y == ey + (3 if kind_face == "low" else 2) and 1 <= x <= w - 2: return R(r, 0)   # mouth
    elif kind_face == "visor":
        if y == ry and 1 <= x <= w - 2: return eye if x in (lx + ew - 1, rx) else R(r, 0)
        if y >= ry + 2 and y < h - 1 and x % 2 == 0 and 2 <= x <= w - 3: return R(r, 1)      # breaths
    elif kind_face == "clock":
        cx, cy = (w - 1) / 2, (h - 1) / 2; d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5; rad = min(w, h) / 2 - 0.6
        if d > rad + 0.6: return None
        if d > rad - 0.5: return R(M["gold"], 3 if x + y < w else 1)               # brass rim
        if (abs(x - cx) < 0.6 and y < cy and y > cy - rad + 1) or (abs(y - cy) < 0.6 and x > cx and x < cx + rad - 2): return R(M["blacksteel"], 1)
        if d > rad - 1.8 and (abs(x - cx) < 0.6 or abs(y - cy) < 0.6): return R(PARCH, 0)   # hour marks
        return R(PARCH, 4 if x + y < w else 3)
    elif kind_face == "mouth":
        if y == 1 and x in (1, w - 2): return eye
        if h // 3 <= y <= h - 2 and 1 <= x <= w - 2:
            if y in (h // 3, h - 2): return R(PARCH, 5 if x % 2 else 2)            # teeth
            return R(M["blood_red"], 0 if y > h // 2 else 1)
    elif kind_face == "blank":
        if abs((x - w // 2) - (y - h // 2) // 2) == 0 and 1 < y < h - 1: return R(r, 1)      # one long crack
    return None

EMBLEMS = {"gate": ["XXXX", "X..X", "X..X", "X..X"], "bell": [".XX.", "XXXX", "XXXX", ".X.."]}

def paint(pal, cube, f, x, y, w, h, seed):
    mat = cube["_mat"]; role = cube.get("_role"); s = seed
    r, kind, alpha = material(pal.get(mat, (255, 0, 255)), mat)
    side = f not in ("up", "down")
    a = alpha
    if alpha < 255 and kind == "cloth" and side: a = int(alpha * (1 - 0.45 * y / max(h - 1, 1)))    # ghosts fade toward the hem
    if cube.get("_face") and f == "north":
        c = draw_face(cube["_face"], r, kind, pal, x, y, w, h, s)
        if c is not None: return tuple(c) + (255 if alpha == 255 else min(255, alpha + 50),)
    if role == "leg" and side and h >= 8 and y >= h - 3 and alpha == 255:           # boots
        b = material(pal["boot"], "boot")[0] if "boot" in pal else BOOT
        return R(b, 4 if y == h - 3 else (2 if x < w - 1 else 1)) + (255,)
    if role == "leg" and f == "down" and alpha == 255: return R(BOOT, 0) + (255,)
    if role == "paw" and side and y >= h - 2: return R(r, 1 if y == h - 2 else 0) + (a,)
    if role == "arm" and side and h >= 8 and alpha == 255:
        hand = pal.get("hand", pal.get("skin", pal.get("pale")))
        if hand is not None and pal.get(mat) != hand:
            if y >= h - 3: return R(material(hand, "skin")[0], 3 if x < w - 1 else 2) + (255,)
            if y == h - 4: return R(r, 1) + (255,)                                    # cuff
    if role == "torso" and side:
        if "belt" in pal and y == h - 4:
            if f == "north" and x in (w // 2 - 1, w // 2): return R(M["gold"], 4) + (255,)
            return R(material(pal["belt"], "belt")[0], 1) + (255,)
        em = pal.get("_emblem")
        if em and f == "north" and w >= 8:
            rows = EMBLEMS[em[0]]; ex, ey = x - (w // 2 - 2), y - 2
            if 0 <= ey < len(rows) and 0 <= ex < 4 and rows[ey][ex] == "X": return R(material(pal[em[1]], em[1])[0], 3 if ex < 2 else 2) + (255,)
    return R(r, tone(kind, f, x, y, w, h, s)) + (a,)
