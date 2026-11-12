#!/usr/bin/env python3
"""Bridge gallery: every region x use, at odd angles and spans, over water and over dry gaps, each on a patch
of made-up ground so the bridge reads in context. Uses the minecraft-builder skill's bridge generator
(.claude/skills/minecraft-builder/scripts/bridges.py), the one building engine.

    python3 map/structures/bridges_gallery.py OUT [--only NAME,...] [--textures TEX --three THREE]

Writes OUT/<name>/scene.json (for the asset viewer and render.py) and OUT/gallery.json (the plans).
"""
import argparse, json, math, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, ".claude", "skills", "minecraft-builder", "scripts"))
import bridges, emit  # noqa: E402

# name: crossing + made-up ground ("water": river depth under the deck; "gap": dry valley depth)
CASES = {
    # Vale: packhorse footbridge, medieval road bridge, red-brick rail viaduct over a valley
    "vale_foot_packhorse": dict(a=[0, 0], b=[11, 4], ya=64, yb=64, water_y=61, kind="foot", region="vale", depth=3),
    "vale_road_river":     dict(a=[0, 0], b=[33, -9], ya=64, yb=65, water_y=61, kind="road", region="vale", depth=4),
    "vale_rail_viaduct":   dict(a=[0, 0], b=[70, 22], ya=80, yb=78, water_y=None, kind="rail", region="vale", depth=34),
    "vale_foot_ravine":    dict(a=[0, 0], b=[-9, 14], ya=70, yb=73, water_y=None, kind="foot", region="vale", depth=14),
    # Frostmarch: covered timber footbridge, deepslate road bridge, timber rail trestle
    "frostmarch_foot_covered": dict(a=[0, 0], b=[19, 0], ya=64, yb=64, water_y=61, kind="foot", region="frostmarch", depth=3),
    "frostmarch_road_river":   dict(a=[0, 0], b=[24, 17], ya=64, yb=64, water_y=60, kind="road", region="frostmarch", depth=4),
    "frostmarch_rail_trestle": dict(a=[0, 0], b=[45, -6], ya=80, yb=81, water_y=None, kind="rail", region="frostmarch", depth=20),
    # Saltreach: boardwalk on piles, sandstone road bridge, sandstone rail viaduct over an estuary
    "saltreach_foot_boardwalk": dict(a=[0, 0], b=[17, 9], ya=63, yb=63, water_y=61, kind="foot", region="saltreach", depth=3),
    "saltreach_road_river":     dict(a=[0, 0], b=[29, 0], ya=64, yb=64, water_y=61, kind="road", region="saltreach", depth=4),
    "saltreach_rail_estuary":   dict(a=[0, 0], b=[55, 0], ya=72, yb=72, water_y=61, kind="rail", region="saltreach", depth=5),
    # Emberwaste: pointed footbridge, two-tier arcade road bridge over a canyon, red sandstone rail viaduct
    "emberwaste_foot_wadi":    dict(a=[0, 0], b=[13, -5], ya=66, yb=67, water_y=None, kind="foot", region="emberwaste", depth=6),
    "emberwaste_road_canyon":  dict(a=[0, 0], b=[47, 0], ya=80, yb=80, water_y=None, kind="road", region="emberwaste", depth=30),
    "emberwaste_rail_viaduct": dict(a=[0, 0], b=[40, 30], ya=76, yb=75, water_y=None, kind="rail", region="emberwaste", depth=16),
    # Blackfen: mangrove causeway, mud-brick road bridge, tuff-brick rail bridge
    "blackfen_foot_causeway": dict(a=[0, 0], b=[25, -11], ya=63, yb=63, water_y=61, kind="foot", region="blackfen", depth=2),
    "blackfen_road_river":    dict(a=[0, 0], b=[21, 0], ya=64, yb=64, water_y=61, kind="road", region="blackfen", depth=3),
    "blackfen_rail_fen":      dict(a=[0, 0], b=[38, 8], ya=68, yb=68, water_y=61, kind="rail", region="blackfen", depth=3),
    # The Hollow: black pointed arches
    "hollow_foot_chasm":  dict(a=[0, 0], b=[15, 15], ya=70, yb=70, water_y=None, kind="foot", region="hollow", depth=22),
    "hollow_road_river":  dict(a=[0, 0], b=[35, 0], ya=70, yb=72, water_y=None, kind="road", region="hollow", depth=28),
}


def ground_profile(case):
    """Made-up ground along the line: banks at deck level, falling to a river bed or a valley floor."""
    ax, az = case["a"]; bx, bz = case["b"]; L = math.hypot(bx - ax, bz - az)
    ya, yb, wy, depth = case["ya"] - 1, case["yb"] - 1, case.get("water_y"), case["depth"]
    floor = (wy - depth) if wy is not None else min(ya, yb) - depth
    def g(u):
        if u <= 0: return ya
        if u >= L: return yb
        e = min(u, L - u)
        bank = 3 if wy is not None else max(4, L * 0.28)
        k = min(1.0, e / bank)
        k = k * k * (3 - 2 * k)
        base = ya + (yb - ya) * u / L
        return round(base + (floor - base) * k)
    return L, g


def build_case(name, case, out):
    L, g = ground_profile(case)
    ax, az = case["a"]; dx, dz = (case["b"][0] - ax) / L, (case["b"][1] - az) / L
    nx, nz = -dz, dx
    ground = lambda x, z: g((x - ax) * dx + (z - az) * dz)
    c = {k: v for k, v in case.items() if k != "depth"}
    c.update(name=name, ground=ground)
    blocks = bridges.bridge_blocks(c, clear_above=0)
    P = bridges.plan(c)
    # terrain patch around it, under anything the bridge placed
    wy = case.get("water_y")
    pad = P["hw"] + 9
    for x, z, u, v in bridges._columns(P, pad):
        if abs(v) > pad: continue
        uu = max(-P["abut"] - 4.0, min(L + P["abut"] + 4.0, u))
        top = g(uu)
        for y in range(top - 3, top + 1):
            if (x, y, z) in blocks: continue
            blk = "grass_block" if y == top and (wy is None or top >= wy) else ("dirt" if y > top - 3 else "stone")
            if wy is not None and top < wy and y == top: blk = "gravel"
            if case["region"] in ("emberwaste",): blk = "sand" if y == top else "sandstone"
            if case["region"] == "hollow": blk = "deepslate" if y < top else "tuff"
            if case["region"] == "frostmarch" and y == top and blk == "grass_block": blk = "snow"
            blocks[(x, y, z)] = (blk, {})
        if wy is not None:
            for y in range(top + 1, wy + 1):
                if (x, y, z) not in blocks: blocks[(x, y, z)] = ("water", {})
    blocks = {k: v for k, v in blocks.items() if v[0] != "air"}
    d = os.path.join(out, name); os.makedirs(d, exist_ok=True)
    sp = os.path.join(d, "scene.json")
    emit.save_logical(blocks, sp)
    # views square to the bridge: side-on to read the arches, and a three-quarter view from above
    sc = json.load(open(sp)); a = math.degrees(math.atan2(nx, nz)); dd = sc["camera"]["views"]["front"][2]
    sc["camera"]["views"].update({"side": [round(a), 6, dd], "three-quarter": [round(a + 35), 26, dd], "deck": [round(a + 70), 30, dd * 0.8]})
    json.dump(sc, open(sp, "w"), separators=(",", ":"))
    return {"name": name, "span": round(L, 1), "tier": P["tier"], "under": P["under"], "openings": len(P["spans"]),
            "kind": P["kind"], "region": P["region"], "deck": [P["Wq"](0), P["Wq"](L / 2), P["Wq"](L)], "warnings": P["warnings"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--only", default="")
    ap.add_argument("--textures"); ap.add_argument("--three")
    ap.add_argument("--shots", default="side,three-quarter")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    names = [n for n in CASES if not a.only or n in a.only.split(",")]
    info = [build_case(n, CASES[n], a.out) for n in names]
    json.dump(info, open(os.path.join(a.out, "gallery.json"), "w"), indent=1)
    if a.textures and a.three:
        from concurrent.futures import ThreadPoolExecutor
        r = os.path.join(ROOT, "map", "structures", "render", "render.py")
        run = lambda n: subprocess.run([sys.executable, r, os.path.join(a.out, n, "scene.json"), os.path.join(a.out, n, "hifi"), "--textures",
                                        a.textures, "--three", a.three, "--shots", a.shots, "--title", n], check=True, stdout=subprocess.DEVNULL)
        with ThreadPoolExecutor(a.jobs) as ex: list(ex.map(run, names))
    for i in info: print(i["name"], i["span"], i["tier"], i["under"], i["openings"], i["deck"], *i["warnings"])


if __name__ == "__main__":
    main()
