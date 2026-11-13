#!/usr/bin/env python3
"""Level crossings: where a road or a trail crosses a rail line, the stretch's track lays a crossing with it (Mateo
2026-11-13: "do we have custom cool builds for the crossings?"). Nothing is in the world until the stretch is bought;
the game lays the crossing after the stretch's track (rail_bed.js, layCrossing), on the ground the bed has graded.

A crossing, in each region's style (KITS):
  deck        the ballast under the road and one each side becomes the region's crossing boards or setts
  road        the road surface is relaid in setts from the deck out to 5 each side
  posts       a gate post at each corner of the road, 3 from the track (base, two posts, a lamp)
  line fence  3 of fence from each post along the line, keeping walkers off the track
  keeper's hut on roads (5 wide): a 5 x 5 one-storey hut beside the line, built by the one building engine
              (minecraft-builder, house part, with its interior), on the highest block of its footprint

    from railcross import segment_crossings
    xs = segment_crossings(cells, ys, path_width, region, log)     # path_width(x, z) -> 0 | 3 | 5
    seg["crossings"] = xs

    python3 map/railcross.py corridor.json map/rail-segments.json   # add crossings to an exported plan, from a
                                                                   # corridor export of the built world (roads found
                                                                   # from the path blocks either side of the line)
"""
import json
import math
import os
import sys

SKILL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".claude", "skills", "minecraft-builder", "scripts")
sys.path.insert(0, SKILL)

# region -> kit. post: blocks from the ground up; fence: the line fence; deck: crossing boards; road: setts (a mix)
KITS = {
    "vale": dict(style="vale_timber", roof="gable", deck="spruce_planks", road=["cobblestone", "cobblestone", "mossy_cobblestone"],
                 post=["stone_brick_wall", "birch_fence", "birch_fence", "lantern"], fence="spruce_fence"),
    "frostmarch": dict(style="frost_timber", roof="gable", deck="dark_oak_planks", road=["cobbled_deepslate", "cobblestone", "gravel"],
                       post=["cobbled_deepslate_wall", "spruce_fence", "spruce_fence", "lantern"], fence="spruce_fence"),
    "saltreach": dict(style="salt_timber", roof="gable", deck="birch_planks", road=["cobblestone", "stone", "gravel"],
                      post=["prismarine_wall", "birch_fence", "birch_fence", "lantern"], fence="birch_fence"),
    "blackfen": dict(style="fen_timber", roof="gable", deck="mangrove_planks", road=["packed_mud", "mud_bricks", "packed_mud"],
                     post=["mud_brick_wall", "mangrove_fence", "mangrove_fence", "ochre_froglight"], fence="mangrove_fence"),
    "emberwaste": dict(style="ember_sandstone", roof="flat", deck="smooth_sandstone", road=["sandstone", "smooth_sandstone", "cut_sandstone"],
                       post=["sandstone_wall", "red_sandstone_wall", "red_sandstone_wall", "lantern"], fence="sandstone_wall"),
}
REGION_KEY = {"Aldmere Vale": "vale", "Frostmarch": "frostmarch", "Saltreach": "saltreach", "Blackfen": "blackfen",
              "Emberwaste": "emberwaste"}
ROAD_OUT = 5          # setts this far from the track centre, each side
POST_D = 3            # posts and line fence this far from the track centre
FENCE_RUN = 3
HUT = 5               # odd


def _frame(cells, k):
    a, b = cells[max(0, k - 3)], cells[min(len(cells) - 1, k + 3)]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz) or 1
    return (dx / L, dz / L), (-dz / L, dx / L)


def _crossing_at(cells, k, path_width):
    """the road's width if a path crosses the line at cell k (path on the cell and on both sides 3..5 out)"""
    w = path_width(*cells[k])
    if not w: return 0
    _, (px, pz) = _frame(cells, k)
    x, z = cells[k]
    for sg in (1, -1):
        if sum(1 for o in (3, 4, 5) if path_width(round(x + sg * px * o), round(z + sg * pz * o))) < 2: return 0
    return w


def plan_crossing(cells, ys, k, width, kit_name, side_free=None, lines=None):
    """One crossing at track index k: world-coordinate items for the game (rail_bed.js layCrossing)."""
    kit = KITS[kit_name]
    (tx, tz), (px, pz) = _frame(cells, k)
    cx, cz = cells[k]; y = ys[k]
    h = width // 2
    track = {tuple(c): i for i, c in enumerate(cells)}
    lines = lines or set(track)        # every line's track cells: posts, fences and huts keep off all of them

    mine = {tuple(c) for c in cells[max(0, k - 14):k + 15]}       # this line here: kept off by design (d >= 3)
    others = lines - mine

    def near_line(x, z, r): return any((x + a, z + b) in mine for a in (-1, 0, 1) for b in (-1, 0, 1)) or any((x + a, z + b) in others for a in range(-r, r + 1) for b in range(-r, r + 1))

    def ad(x, z): return ((x - cx) * tx + (z - cz) * tz, (x - cx) * px + (z - cz) * pz)

    def cell(a, d): return (round(cx + tx * a + px * d), round(cz + tz * a + pz * d))
    deck, road = [], []
    R = ROAD_OUT + 2
    for x in range(cx - R - h, cx + R + h + 1):
        for z in range(cz - R - h, cz + R + h + 1):
            a, d = ad(x, z)
            if abs(a) > h + 0.5: continue
            near = min((abs(i - k) for c, i in track.items() if abs(c[0] - x) <= 1 and abs(c[1] - z) <= 1), default=None)
            if near is not None and near <= h + 3:
                deck.append([x, z, ys[min(len(ys) - 1, max(0, k + int(round(a))))] - 1])
            elif abs(d) <= ROAD_OUT + 0.5:
                road.append([x, z, y - 1, kit["road"][(x * 7 + z * 13) % len(kit["road"])]])
    taken = {(c[0], c[1]) for c in deck}
    posts = []
    for sa in (1, -1):
        for sd in (1, -1):
            px_, pz_ = cell(sa * (h + 1), sd * POST_D)
            if (px_, pz_) not in taken and not near_line(px_, pz_, 2): posts.append([px_, pz_, y - 1, kit["post"]]); taken.add((px_, pz_))
            for r in range(1, FENCE_RUN + 1):
                fx, fz = cell(sa * (h + 1 + r), sd * POST_D)
                if (fx, fz) in taken or near_line(fx, fz, 2): continue
                posts.append([fx, fz, y - 1, [kit["fence"]]]); taken.add((fx, fz))
    out = {"at": k, "width": width, "region": kit_name, "deck": deck, "road": road, "posts": posts,
           "deck_block": kit["deck"]}
    if width >= 5:
        hut = plan_hut(cells, k, h, kit, (tx, tz), (px, pz), side_free, lines, y)
        if hut: out["hut"] = hut
    return out


def plan_hut(cells, k, h, kit, t, p, side_free, track, ys_k=64):
    """the keeper's hut: 5 x 5, beside the line fence, its door toward the road. Blocks relative to its floor."""
    import engine, emit
    (tx, tz), (px, pz) = t, p
    cx, cz = cells[k]
    for sd in (1, -1):
        for sa in (1, -1):
            a, d = sa * (h + 2 + HUT // 2 + 1), sd * (POST_D + 2 + HUT // 2)
            hx, hz = round(cx + tx * a + px * d), round(cz + tz * a + pz * d)
            foot = [(hx + i, hz + j) for i in range(-(HUT // 2), HUT // 2 + 1) for j in range(-(HUT // 2), HUT // 2 + 1)]
            # the hut and a ring round it stay clear of every track cell's body and bed sides
            if any((fx + a, fz + b) in track for fx, fz in foot for a in range(-4, 5) for b in range(-4, 5)): continue
            if side_free and not all(side_free(fx, fz) for fx, fz in foot): continue
            # the door faces the road: the world side nearest the direction back toward the crossing
            vx, vz = -sa * tx, -sa * tz
            side = ("e" if vx > 0 else "w") if abs(vx) >= abs(vz) else ("s" if vz > 0 else "n")
            spec = {"name": "crossing_hut", "edition": "bedrock",
                    "parts": [{"part": "house", "style": kit["style"], "rect": [0, 0, HUT - 1, HUT - 1], "storeys": [4],
                               "door": {"side": side}, "roof": {"type": kit["roof"]}, "interior": "home"}]}
            blocks, _, _ = engine.compute(spec)
            rel = []
            for (x, y, z), (nm, pr) in sorted(blocks.items(), key=lambda b: (b[0][1], b[0][0], b[0][2])):
                bn, st = emit.bedrock_state(nm, pr)
                rel.append([x - HUT // 2, y, z - HUT // 2, bn if ":" in bn else "minecraft:" + bn] + ([st] if st else []))
            return {"x": hx, "z": hz, "y": ys_k, "half": HUT // 2, "spec": spec, "plinth": "minecraft:" + _plinth(kit), "blocks": rel}
    return None


def _plinth(kit):
    return {"vale_timber": "cobblestone", "frost_timber": "cobbled_deepslate", "salt_timber": "stone_bricks",
            "fen_timber": "mud_bricks", "ember_sandstone": "sandstone"}[kit["style"]]


STATION_CLEAR = 32    # a plot's station (its platform, building and passing loop) is built in game round its stop


def segment_crossings(cells, ys, path_width, region, log=print, custom=(), side_free=None, lines=None, stations=()):
    """[(x, z)] cells, [y] track heights -> crossings for the segment's export (skips bridges and tunnels: custom,
    and the station sites round plot stops: stations [(x, z)])"""
    out, k, n = [], 2, len(cells)
    while k < n - 2:
        if any(a - 4 <= k <= b + 4 for a, b in custom): k += 1; continue
        if any(math.hypot(cells[k][0] - sx, cells[k][1] - sz) < STATION_CLEAR for sx, sz in stations): k += 1; continue
        w = _crossing_at(cells, k, path_width)
        if not w: k += 1; continue
        j = k
        while j + 1 < n - 2 and _crossing_at(cells, j + 1, path_width): j += 1
        if j - k > 6:                       # a road running along the line, not across it
            k = j + 1; continue
        m = (k + j) // 2
        kit = REGION_KEY.get(region(*cells[m]), region(*cells[m]))
        if kit in KITS:
            try: out.append(plan_crossing(cells, ys, m, 5 if w >= 5 else 3, kit, side_free, lines))
            except Exception as e: log("rail crossing failed", cells[m], e)
        k = j + 8
    return out


# ---------------------------------------------------------------- from a corridor export of the built world
STOP_REGION = {"harrowford": "vale", "oakmere": "vale", "thistledown": "vale", "wrenfield": "vale", "kingsrest": "vale",
               "millbrook": "vale", "frosthelm": "frostmarch", "wolfcairn": "frostmarch", "rimehold": "frostmarch",
               "gullcliff": "saltreach", "tidewatch": "saltreach", "gull_s_rest": "saltreach", "reedmoor": "blackfen",
               "lanternbog": "blackfen", "mirelight": "blackfen", "redmesa": "emberwaste", "dunehold": "emberwaste",
               "sunscar": "emberwaste"}
PATHY = {"grass_path", "dirt_path", "cobblestone", "mossy_cobblestone", "packed_mud", "gravel", "sandstone"}
LOOSE = ("air", "short_grass", "tall_grass", "fern", "large_fern", "snow_layer", "sweet_berry_bush")


def fix_plan(corridor, plan):
    d = json.load(open(corridor)); P = [p.replace("minecraft:", "") for p in d["palette"]]
    seg_d = json.load(open(plan))
    stops = seg_d["stops"]

    def top(x, z):
        c = d["cols"].get(f"{x},{z}")
        if not c: return None, None
        y0, ids = c
        for i in range(len(ids) - 1, -1, -1):
            t = P[ids[i]]
            if t in LOOSE or "leaves" in t or "flower" in t or t.endswith("tulip") or t in ("poppy", "dandelion", "allium", "azure_bluet"): continue
            return y0 + i, t
        return None, None
    BUILT = ("planks", "brick", "stairs", "slab", "fence", "wall", "door", "glass", "lantern", "trapdoor", "log", "wood")

    def region(x, z):
        return STOP_REGION[min(stops, key=lambda s: (s["x"] - x) ** 2 + (s["z"] - z) ** 2)["id"]]
    total = 0
    lines = {(b[0], b[2]) for s in seg_d["segments"] for b in s["blocks"]}
    for s in seg_d["segments"]:
        cells = [(b[0], b[2]) for b in s["blocks"]]; ys = [b[1] for b in s["blocks"]]
        track = set(cells)
        ty = {c: y for c, y in zip(cells, ys)}

        def path_width(x, z, _ty=ty):
            yy, t = top(x, z)
            if t not in PATHY: return 0
            # gravel and sandstone are also wild ground: a road needs path blocks round it too
            n = sum(1 for dx in (-1, 0, 1) for dz in (-1, 0, 1) if top(x + dx, z + dz)[1] in PATHY)
            return 5 if n >= 7 else 0

        def free(x, z):
            yy, t = top(x, z)
            return t is not None and not any(b in t for b in BUILT) and t not in PATHY and (x, z) not in track
        xs = segment_crossings(cells, ys, path_width, region, custom=s.get("custom", []), side_free=free, lines=lines,
                               stations=[(st["x"], st["z"]) for st in stops if st["kind"] == "plot"])
        if xs: s["crossings"] = xs
        else: s.pop("crossings", None)
        total += len(xs)
    json.dump(seg_d, open(plan, "w"))
    return total


def _selftest():
    cells = [(x, 0) for x in range(-20, 21)]; ys = [70] * len(cells)
    road = lambda x, z: 5 if abs(x) <= 2 else 0
    xs = segment_crossings(cells, ys, road, lambda x, z: "vale")
    assert len(xs) == 1, xs
    c = xs[0]
    assert c["width"] == 5 and c["region"] == "vale"
    assert sorted({x for x, z, y in c["deck"]}) == [-2, -1, 0, 1, 2], c["deck"]
    assert all(abs(z) <= 1 for x, z, y in c["deck"])
    assert {(p[0], p[1]) for p in c["posts"] if len(p[3]) > 1} == {(3, 3), (3, -3), (-3, 3), (-3, -3)}
    assert c.get("hut") and all(abs(c["hut"]["z"]) - 2 >= 4 for _ in [0]), c.get("hut", {}).get("z")
    # a road running along the line is not a crossing
    assert not segment_crossings(cells, ys, lambda x, z: 5 if abs(z) <= 2 else 0, lambda x, z: "vale")
    print("railcross: ALL OK")


if __name__ == "__main__":
    if len(sys.argv) > 2: print("railcross:", fix_plan(sys.argv[1], sys.argv[2]), "crossings")
    else: _selftest()
