"""Mob-skin shader in the shared art style, for box models whose cubes carry a material and a face tag.

Drop-in replacement for studio/bestiary/models.py `paint`:
    from skinlib import paint          (sys.path needs studio/art)
    paint(rnd, pal, mat, face, f, x, y, w, h) -> (r, g, b, a)
Same palettes as before (a colour, or {"c": colour, "style": ...}); each colour is turned into a
6-tone hue-shifted ramp and shaded with clusters instead of per-pixel noise. Light is top-left.
Styles: plain, skin, cloth, metal, fur, wood, stone, bone, glow, plus new ones: scale, rot, ghost.
Face tags: eyes, low, glow, hollow, visor, clock, blank, mouth (same meaning as before).
`rnd` is ignored (shading is deterministic, so re-running never changes a finished skin).
"""
import colorsys, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import ramp

_cache = {}
def ramp_of(base):
    key = tuple(base[:3])
    if key not in _cache:
        r, g, b = [v / 255 for v in key]; _, l, _ = colorsys.rgb_to_hls(r, g, b)
        _cache[key] = ramp(key, max(0.05, l - 0.30), min(0.93, l + 0.24), cool=0.10, warm=0.06)
    return _cache[key]

def _h(x, y, s=0):          # small deterministic hash, 0..1
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0

def _tone(style, f, x, y, w, h, seed):
    side = f not in ("up", "down")
    t = 3
    if f == "up": t = 4
    elif f == "down": t = 2
    if side:
        if y == 0: t += 1
        if y == h - 1 and h > 2: t -= 1
        if x == w - 1 and w > 3: t -= 1
    if style == "metal":
        if side and h >= 8 and y % 5 == 4: t -= 1                     # plate seam
        if side and h >= 8 and y % 5 == 0 and y: t += 1                # lit lip under the seam
        if w >= 6 and h >= 6 and (x, y) in ((1, 1), (w - 2, 1)): t = 5  # rivets
        if (x + y) % 9 == 0 and t == 3: t = 4                          # sheen
    elif style == "cloth":
        if side and x % 3 == 2 and y > 0: t -= 1                       # folds
        if side and x % 3 == 0 and y % 4 == 1: t += 0
        if _h(x // 2, y // 2, seed) < 0.10: t -= 1
    elif style == "fur":
        k = _h(x, y // 3, seed)
        if (y + int(k * 3)) % 3 == 0: t -= 1                           # staggered tufts
        elif k > 0.72: t += 1
    elif style == "wood":
        if x % 4 == 3: t -= 2
        elif x % 4 == 0: t += 0
        if _h(x, y // 4, seed) < 0.15: t -= 1
    elif style == "stone":
        k = _h(x // 2, y // 2, seed); t += 1 if k > 0.75 else -1 if k < 0.25 else 0
    elif style == "bone":
        t += 1
        if side and y % 4 == 3: t -= 1
        if _h(x, y, seed) < 0.05: t -= 2                               # pits
    elif style == "glow":
        t = 4 + (1 if _h(x, y, seed) > 0.7 else 0) - (1 if (x in (0, w - 1) or y in (0, h - 1)) and side else 0)
    elif style == "scale":
        t += (1, 0, 0, -1)[(x + (2 if (y // 2) % 2 else 0)) % 4] if y % 2 == 0 else 0
        if y % 2 == 1 and (x + (2 if (y // 2) % 2 else 0)) % 4 == 3: t -= 1
    elif style == "rot":                                               # sagging, blotched flesh or cloth
        k = _h(x // 2, y // 3, seed); t += -1 if k < 0.3 else 0
        if side and y >= h - 2 and _h(x, 0, seed) < 0.5: t -= 1
    elif style == "ghost":
        t = 3 + (1 if y < h // 3 else 0) - (1 if y > 2 * h // 3 else 0)
    else:                                                              # plain / skin
        if _h(x // 2, y // 2, seed) < 0.08: t -= 1
    return max(0, min(5, t))

def paint(rnd, pal, mat, face, f, x, y, w, h):
    spec = pal.get(mat, (255, 0, 255)); style = "plain"
    if isinstance(spec, dict): style = spec.get("style", "plain"); base = spec["c"]
    else: base = spec
    alpha = base[3] if len(base) == 4 else 255
    r = ramp_of(base); seed = (sum(base[:3]) + len(mat) * 7) & 0xffff
    t = _tone(style, f, x, y, w, h, seed)
    if style == "ghost" and f not in ("up", "down"):                   # ghosts thin out toward the hem
        alpha = int(alpha * (1.0 - 0.45 * (y / max(h - 1, 1)))) if not (y >= h - 2 and x % 2) else 0
    col = r[t] + (alpha,)
    if face and f == "north" and w >= 6:
        eye = tuple(pal.get("eye", (240, 240, 230)))[:3]
        cx = w // 2; ey = max(1, h * 3 // 8) if face != "low" else max(1, h // 2)
        L1, L2, R1, R2 = cx - 3, cx - 2, cx + 1, cx + 2                # two 2px eyes
        dark = (14, 12, 18, 255)
        if face in ("eyes", "low"):
            if y == ey and x in (L1, R2): return eye + (255,)
            if y == ey and x in (L2, R1): return dark
            if y == ey - 1 and x in (L1, L2, R1, R2): return r[max(0, t - 2)] + (alpha,)     # brow shadow
            if y == ey + 3 and cx - 1 <= x <= cx and h >= 8: return r[max(0, t - 2)] + (alpha,)  # mouth
        elif face == "glow":
            if y == ey and x in (L1, L2, R1, R2): return eye + (255,)
            if y in (ey - 1, ey + 1) and x in (L1, L2, R1, R2): return r[0] + (alpha,)        # sunk sockets
        elif face == "hollow":
            if ey <= y <= ey + 1 and x in (L1, L2, R1, R2): return eye + (255,) if (y == ey and x in (L2, R1)) else dark
            if y == ey + 3 and cx - 2 <= x <= cx + 1 and h >= 8: return dark                  # a mouth that hangs open
        elif face == "visor":
            if y == ey and 1 <= x <= w - 2: return eye + (255,) if x in (L2, R1) else dark
            if y == ey + 2 and x in (cx - 1, cx): return dark
        elif face == "clock":
            mx, my = (w - 1) / 2, (h - 1) / 2; d = ((x - mx) ** 2 + (y - my) ** 2) ** 0.5; rad = min(w, h) / 2
            if d > rad: return r[1] + (alpha,)
            if d > rad - 1.1: return r[4] + (alpha,)
            if (round(x - mx) == 0 and y <= my) or (round(y - my) == 0 and x >= mx): return (30, 24, 18, 255)
            if abs(d - (rad - 2)) < 0.5 and (round(x - mx) == 0 or round(y - my) == 0): return (60, 44, 24, 255)
            return (232, 222, 192, 255) if (x + y) % 5 else (210, 198, 164, 255)
        elif face == "mouth":
            if y == h - 2 and 1 <= x <= w - 2: return dark if x % 2 else (40, 10, 14, 255)
            if y == h - 3 and 1 <= x <= w - 2 and x % 2 == 0: return (236, 230, 214, 255)      # teeth
    return col
