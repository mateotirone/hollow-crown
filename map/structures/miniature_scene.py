"""The welcome hall's miniature map as a preview scene for the live asset viewer.

    python3 miniature_scene.py OUT

Reads Siege_Nights_BP/scripts/plots/miniature_data.js (made by tools/miniature.py) and lays the miniature out
block for block the way scripts/plots/miniature.js builds it in game (the cloud underneath, its rim, the land,
water, plants, towns, the quay with the Waystone and a Map Stone on every plot), then writes OUT/miniature/scene.json.
The unseen barrier fence is left out. Keep this in step with miniature.js when either changes.
"""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "miniature_data.js")
CONFIG = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "config.js")
ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
ID = {"grass": "grass_block", "deadbush": "dead_bush", "hardened_clay": "terracotta"}
UNDER = {"grass": "dirt", "grass_path": "dirt", "podzol": "dirt", "moss_block": "dirt", "mud": "dirt", "sand": "sandstone", "red_sand": "sandstone"}
MESA_BANDS = ["orange_terracotta", "terracotta", "red_terracotta", "orange_terracotta", "yellow_terracotta"]
PLINTH = {"mossy_stone_bricks": "mossy_stone_brick_slab", "packed_ice": "deepslate_tile_slab", "prismarine_bricks": "prismarine_brick_slab",
          "red_sandstone": "red_sandstone_slab", "mud_bricks": "mud_brick_slab"}
REGION_BLOCK = {"Aldmere Vale": "mossy_stone_bricks", "Frostmarch": "packed_ice", "Saltreach": "prismarine_bricks",
                "Emberwaste": "red_sandstone", "Blackfen": "mud_bricks"}


def load():
    src = open(DATA).read()
    return json.loads(src[src.index("{"):src.rindex("}") + 1])


def build(M):
    half = M["half"]
    cells = {}
    put = lambda x, y, z, n, p=None: cells.__setitem__((x, y, z), (ID.get(n, n), p or {}))
    inside = lambda dx, dz: abs(dx) <= half and abs(dz) <= half
    mask = lambda dx, dz: int(M["m"][dz + half][dx + half]) if inside(dx, dz) else 0
    hof = lambda dx, dz: ALPHA.index(M["h"][dz + half][dx + half])

    def lump(dx, dz, k):
        n = math.sin((dx + half) * 127.1 + (dz + half) * 311.7 + k * 74.7) * 43758.5453
        return n - math.floor(n)

    q = M["quay"]
    in_quay = lambda dx, dz: abs(dx - q["dx"]) <= q["half"] and abs(dz - q["dz"]) <= q["half"]
    markers = {(p["dx"], p["dz"]): REGION_BLOCK.get(p.get("region"), "stone_bricks") for p in M["plots"]}
    R = half + 1
    for dx in range(-R, R + 1):
        for dz in range(-R, R + 1):
            m = mask(dx, dz)
            if m == 0:
                continue
            under = int(M["u"][dz + half][dx + half]) if inside(dx, dz) else 1
            for y in range(1, under + 1):
                put(dx, -y, dz, "white_wool")
            if m == 2:
                hi = 1
                for ax in (-1, 0, 1):
                    for az in (-1, 0, 1):
                        if mask(dx + ax, dz + az) == 1:
                            hi = max(hi, hof(dx + ax, dz + az))
                top = max(2, hi + 1) + (1 if lump(dx, dz, 11) < 0.4 else 0)
                for y in range(top):
                    put(dx, y, dz, "white_wool")
                continue
            if in_quay(dx, dz):
                for y in range(q["h"] + 1):
                    put(dx, y, dz, "polished_andesite" if y == q["h"] else "stone_bricks")
                if abs(dx - q["dx"]) == q["half"] and abs(dz - q["dz"]) == q["half"]:
                    put(dx, q["h"] + 1, dz, "stone_brick_wall")
                    put(dx, q["h"] + 2, dz, "lantern")
                continue
            a, b = dx + half, dz + half
            h = ALPHA.index(M["h"][b][a])
            s = M["surfaces"][ALPHA.index(M["s"][b][a])]
            w = M["w"][b][a] == "1"
            sub = UNDER.get(s, "stone")
            put(dx, 0, dz, sub if h > 0 else s)
            for y in range(1, h + 1):
                put(dx, y, dz, s if y == h else (MESA_BANDS[y % len(MESA_BANDS)] if s == "red_sand" else sub))
            if w:
                put(dx, 1, dz, "water")
            if (dx, dz) in markers:
                put(dx, h + 1, dz, markers[(dx, dz)])
                put(dx, h + 2, dz, "siege:map_marker")
                continue
            d = ALPHA.index(M["d"][b][a])
            if d > 0:
                for i, n in enumerate(M["decos"][d - 1].split("|")):
                    put(dx, h + 1 + i, dz, n, {"persistent_bit": True} if n.endswith("_leaves") else None)
    for (mx, mz), ped in markers.items():
        ground = hof(mx, mz)
        slab = PLINTH.get(ped, "stone_brick_slab")
        for ax in (-1, 0, 1):
            for az in (-1, 0, 1):
                nx, nz = mx + ax, mz + az
                if (ax or az) and mask(nx, nz) == 1 and not in_quay(nx, nz) and M["w"][nz + half][nx + half] != "1" \
                        and abs(hof(nx, nz) - ground) <= 1:
                    put(nx, hof(nx, nz) + 1, nz, slab, {"type": "bottom"})
    put(q["dx"], q["h"] + 1, q["dz"], "chiseled_stone_bricks")
    put(q["dx"], q["h"] + 2, q["dz"], "siege:hall_waystone")
    return cells


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "miniature-out"
    M = load()
    cells = build(M)
    pal, idx, rows = [], {}, []
    for (x, y, z), (n, p) in sorted(cells.items()):
        key = json.dumps([n, p], sort_keys=True)
        if key not in idx:
            idx[key] = len(pal)
            pal.append([n, p])
        rows.append([x, y, z, idx[key]])
    d = os.path.join(out, "miniature")
    os.makedirs(d, exist_ok=True)
    json.dump({"name": "Welcome hall miniature map", "palette": pal, "blocks": rows, "camera": None},
              open(os.path.join(d, "scene.json"), "w"), separators=(",", ":"))
    print(f"miniature: {len(rows)} blocks -> {d}/scene.json")


if __name__ == "__main__":
    main()
