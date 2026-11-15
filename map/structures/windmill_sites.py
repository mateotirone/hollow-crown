"""Where each settlement layout's windmill stands (Mateo 2026-11-15: "fix the windmill system": every settlement gets a
windmill by its field, in its region's look).

The town generator only put a windmill on a field portion of 900+ blocks, so 7 of the 36 layouts had one, all in the
Vale look, and the game never raised them. This pass works on the layouts as the game gets them (tools/export_towns.py
variant dicts, after the starter village is in), so it needs no re-run of the generator:

  * the mill opens with the first field (Town): its base stands on that field or on open ground beside it (at most
    7 blocks from a crop: across its track), never on a path, a fence, a plot, the hall's ground (level 5), a fixture or a tree;
  * its base stands within 3 blocks of level (the design's foundation is 3 deep) and it stands inside the Town wall with 3 blocks to spare, sails
    included; nothing a later tier lays (plots, ground, trees) may come under any part of it;
  * its door faces a path: a straight walk of at most 8 blocks from the door step reaches a paved column within a block
    of the floor; the game paves the walk 3 wide (settle/windmill.js);
  * of the spots that pass, the one nearest the field's middle with the shortest walk wins; sails behind the mill
    first, beside it where only that fits, and only if nothing fits at Town, the City (when the field grows).

    site(town, variant, region) -> fixture row ["windmill", x, z, tier, dy, side, sails, walk] or None
      x, z = the door step (blocks from the Plot Stone), dy = the floor block's height above the square (base),
      side = the way the door faces (n/s/e/w), sails = back / left / right (seen from the step: behind the mill where
      they fit, else beside it), walk = cells from the step to the path [[x, z, dy], ...]

Self-test: python3 windmill_sites.py <towns_data.js> prints every layout's site (or why there is none).
"""
import os, sys, json, math, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
REGION = {"Aldmere Vale": "vale", "Frostmarch": "frostmarch", "Saltreach": "saltreach", "Emberwaste": "emberwaste", "Blackfen": "blackfen"}
SIDES = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
NATURAL = ("grass_block", "dirt", "podzol", "coarse_dirt", "sand", "short_grass", "dandelion", "poppy", "azure_bluet", "cornflower",
           "oxeye_daisy", "farmland", "wheat", "carrots", "potatoes", "beetroot", "air")
CROPS = ("farmland",)
# a field's own water channels and fence may go under the mill (its plinth fills the channel, its wall closes the fence)
FIELD = ("water", "oak_fence", "spruce_fence", "acacia_fence", "mangrove_fence", "oak_fence_gate", "spruce_fence_gate", "acacia_fence_gate",
         "mangrove_fence_gate", "oak_log", "spruce_log", "acacia_log", "mangrove_log", "stripped_oak_log", "stripped_spruce_log",
         "stripped_acacia_log", "stripped_mangrove_log", "hay_block", "composter", "lantern")
PAVED = ("_slab", "gravel", "cobblestone", "stone_bricks", "mud_bricks", "tuff_bricks", "andesite", "grass_path", "mossy_stone_bricks")
WALK_MAX = 8
RELIEF = 3                      # the design's foundation is 3 deep: a floor at most 3 over the lowest ground under it
NEAR_CROP = 24
FAR_CROP = 48                   # where nothing fits by the field: anywhere in the band that opens with it
_designs = {}


def groundwork(gw, tier):
    """The groundwork rows of one tier, decoded (settle/towns.js groundwork): [dx, dy, dz, palette index]."""
    text = (gw.split("|") + [""] * 4)[tier]
    idx = CHARS.index; out = []; dx = dz = 0; i = 0
    num2 = lambda s, k: ((idx(s[k]) << 6) | idx(s[k + 1])) - 2048
    while i < len(text):
        head = text[i]; i += 1
        if head == "!": dx, dz = num2(text, i), num2(text, i + 2); i += 4
        elif head == "-": dz += 1
        dy0 = idx(text[i]) - 32; n = idx(text[i + 1]); i += 2
        for k in range(n): out.append((dx, dy0 + k, dz, idx(text[i + k])))
        i += n
    return out


def design(region, sails="back"):
    """The windmill's columns in the design frame (x right, z in from the step at z 0): {(x, z): (lowest y, highest y)}."""
    if (region, sails) not in _designs:
        import windmill_skill as W
        from export_halls import export
        d = export(W.build(region, sails), light=False)
        cols = {}
        for y, z, x0, n, i in d["rows"]:
            if d["palette"][i][0] == "minecraft:air" or y < 0: continue
            for x in range(x0, x0 + n):
                lo, hi = cols.get((x, z), (y, y)); cols[(x, z)] = (min(lo, y), max(hi, y))
        base = {c for c, (lo, hi) in cols.items() if lo <= 2}
        _designs[(region, sails)] = (cols, base)
    return _designs[(region, sails)]


def outline_r(town, radius, a):
    """The wall's radius at angle a (atan2(dz, dx)), as settle/walldata.js radiusAt (without the Hamlet's tight line)."""
    o = town.get("outline")
    if not o: return radius
    radii = o["radii"]; f = ((a % (2 * math.pi)) / (2 * math.pi)) * len(radii)
    i = int(math.floor(f)) % len(radii); t = f - math.floor(f)
    return radii[i] * (1 - t) + radii[(i + 1) % len(radii)] * t + (radius - o["radiiAt"])


def site(town, v, region):
    """The best site: the first field's tier (Town) with the sails behind, then beside the mill; then the City."""
    fields = [f for f in v["fields"] if f[2] >= 1]
    if not fields: return None, "no field"
    first, why = min(f[2] for f in fields), []
    for tier, reach in ((first, NEAR_CROP), (first, FAR_CROP), (min(first + 1, 3), NEAR_CROP)):
        for sails in ("back", "left", "right"):
            row, w = place(town, v, region, tier, sails, reach)
            if row: return row, "ok" if (tier, sails, reach) == (first, "back", NEAR_CROP) else f"ok ({'City' if tier == 2 else 'Town'}, sails {sails}, within {reach} of a crop)"
            why.append(f"{tier}/{sails}/{reach}: {w}")
    return None, "; ".join(why)


def place(town, v, region, tier, sails, reach=None):
    reach = reach or NEAR_CROP
    cols, base = design(region, sails)
    mid = round(sum(z for x, z in base) / len(base))
    pal = [p[0].split(":")[-1] for p in v["pal"]]
    # the ground as each tier leaves it: the top block of every column, and what any tier puts there
    top, ever = {}, {}
    for t in range(4):
        for dx, dy, dz, p in groundwork(v["gw"], t):
            n = pal[p]
            ever.setdefault((dx, dz), set()).add(n)
            if n != "air" and t <= tier and ((dx, dz) not in top or dy >= top[(dx, dz)][0]): top[(dx, dz)] = (dy, n, t)
    crops = {c for c, (dy, n, t) in top.items() if t == tier and (n in CROPS or n in ("wheat", "carrots", "potatoes", "beetroot"))}   # the field that opens with the mill, not the starter's garden
    soil = {c: top[c][0] - (1 if top[c][1] in ("wheat", "carrots", "potatoes", "beetroot", "short_grass") else 0) for c in top}
    if not crops: return None, "no crops at the field's tier"
    blocked = set()
    for s in v["slots"]:
        x0, z0, x1, z1 = s[2:6]
        blocked |= {(x, z) for x in range(x0 - 1, x1 + 2) for z in range(z0 - 1, z1 + 2)}
    for b in v["hall"]:
        blocked |= {(x, z) for x in range(b[0] - 1, b[2] + 2) for z in range(b[1] - 1, b[3] + 2)}
    high = set()                                                 # what the sails may not pass over (plots, the hall, trees)
    for s in v["slots"]:
        x0, z0, x1, z1 = s[2:6]
        high |= {(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)}
    for b in v["hall"]:
        high |= {(x, z) for x in range(b[0], b[2] + 1) for z in range(b[1], b[3] + 1)}
    for f in v["fix"]:
        if f[0] == "windmill": continue
        r = 3 if f[0] == "tree" else 7 if f[0] in ("mason_yard", "storehouse") else 1
        near = {(f[1] + i, f[2] + j) for i in range(-r, r + 1) for j in range(-r, r + 1)}
        blocked |= near
        if f[0] != "lamp": high |= near
    bad_ground = {c for c, names in ever.items() if any(n not in NATURAL and n not in FIELD for n in names)}   # paths, fences, walls, buildings' ground
    paved = {c for c, (dy, n, t) in top.items() if any(n.endswith(p) or n == p for p in PAVED)}
    near = {c: 0 for c in crops}; edge = list(crops)                 # blocks from the nearest crop (steps, not diagonals)
    for d in range(1, reach + 1):
        nxt = []
        for (x, z) in edge:
            for q in ((x + 1, z), (x - 1, z), (x, z + 1), (x, z - 1)):
                if q not in near: near[q] = d; nxt.append(q)
        edge = nxt
    wall = town["walls"][tier]
    cx_ = sum(c[0] for c in crops) / len(crops); cz_ = sum(c[1] for c in crops) / len(crops)
    best = None; fails = {}
    xs = [c[0] for c in crops]; zs = [c[1] for c in crops]
    for sx in range(min(xs) - reach - 12, max(xs) + reach + 13):
        for sz in range(min(zs) - reach - 12, max(zs) + reach + 13):
            for side, (fx, fz) in SIDES.items():
                F = (-fx, -fz); R = (-F[1], F[0])                  # F: from the step into the mill; the door faces `side`
                W = lambda x, z: (sx + x * R[0] + z * F[0], sz + x * R[1] + z * F[1])
                foot = [W(x, z) for (x, z) in base]
                if any(c in blocked or c in bad_ground or c not in soil for c in foot): fails['foot'] = fails.get('foot', 0) + 1; continue
                hs = [soil[c] for c in foot]
                if max(hs) - min(hs) > RELIEF: fails['level'] = fails.get('level', 0) + 1; continue
                floor = max(hs)
                if min(near.get(c, reach + 1) for c in foot) > reach: fails['far'] = fails.get('far', 0) + 1; continue
                ok = True
                for (x, z), (lo, hi) in cols.items():
                    c = W(x, z)
                    if (c in blocked if lo <= 3 else c in high) or math.hypot(*c) > outline_r(town, wall, math.atan2(c[1], c[0])) - 3: ok = False; break
                    if lo <= 2 and (c in bad_ground and c not in foot): ok = False; break
                if not ok: fails['reach'] = fails.get('reach', 0) + 1; continue
                walk = []; c = (sx, sz); end = None; h = floor
                for _ in range(WALK_MAX):          # each step of the walk at most a block from the last (the game paves it)
                    if c in paved and abs(top[c][0] - h) <= 1: end = c; break
                    if c in blocked or (c in bad_ground and c not in paved) or c not in soil or abs(soil[c] - h) > 1: break
                    h = soil[c]; walk.append((c, h)); c = (c[0] + fx, c[1] + fz)
                if end is None or not walk: fails['walk'] = fails.get('walk', 0) + 1; continue
                ctr = W(0, mid)
                score = math.hypot(ctr[0] - cx_, ctr[1] - cz_) + 1.5 * len(walk)
                if best is None or score < best[0]:
                    best = (score, ["windmill", sx, sz, tier, floor, side, sails, [[q[0], q[1], hq] for q, hq in walk]])
    return (best[1], "ok") if best else (None, f"no spot passes {fails}")


def load_towns(path):
    s = open(path, encoding="utf8").read()
    return json.loads(re.search(r"export const TOWNS = (\{.*\});", s).group(1))


if __name__ == "__main__":
    sys.path.insert(0, os.path.join(HERE, ".."))
    towns = load_towns(sys.argv[1])
    plots = {}
    cfg = open(os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "plots", "config.js")).read()
    for m in re.finditer(r'name: "([^"]+)", region: "([^"]+)"', cfg): plots[m.group(1).lower()] = REGION.get(m.group(2), "vale")
    n = 0
    for k, t in towns.items():
        for i, v in enumerate(t["variants"]):
            row, why = site(t, v, plots.get(k, "vale"))
            n += bool(row)
            print(k, i, plots.get(k), row[:7] if row else None, why, "walk", len(row[7]) if row else "")
    print(n, "of", sum(len(t["variants"]) for t in towns.values()), "layouts have a windmill site")
