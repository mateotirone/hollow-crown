"""The land at the seven thin places (Mateo 2026-11-12: "it's designing the actual map itself").

genworld.py calls shape_sites() once its heights and water are settled. Each thin place in the square being
written gets the land from shape.mjs (the one Mateo approved in the 3D view): a long barrow, a mine escarpment,
a gorge, a chalk headland with a flooded sinkhole, a flooded hollow, a salt pan, a stepped quarry pit. The land
is fully shaped out to about 62 blocks and blends back into the map by 96. Roads, trails and rivers keep their
own ground (the `keep` mask).

Run it alone to check a change without writing a world, and to refresh the game's copy of the facts it needs:
    python3 map/thinplaces/land.py HEIGHTS.npy WATER.npy [--js Siege_Nights_BP/scripts/undertow/thin_land.js]
HEIGHTS / WATER are genworld's saved grids (int16 [x, z], origin -1264; -pretown heights, water -999 = none).
"""
import json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RAD = 100          # the square handed to shape_cli.mjs reaches this far from the site
CONFIG = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "plots", "config.js")


def thin_sites(config=CONFIG):
    """[(id, name, x, z, facing)] from the add-on's own config, with each site's offset applied."""
    out = []
    for m in re.finditer(r'\{ name: "([^"]+)", x: (-?\d+), z: (-?\d+), r: \d+, thin: true, site: "(\w+)"([^}]*)\}', open(config).read()):
        face = re.search(r'face: "(\w+)"', m[5]); off = re.search(r"off: \[(-?\d+), (-?\d+)\]", m[5])
        out.append((m[4], m[1], int(m[2]) + (int(off[1]) if off else 0), int(m[3]) + (int(off[2]) if off else 0), face[1] if face else "south"))
    return out


def fill_pools(Y, water_level, pools):
    """Fen pools near a thin place are filled back up to the ground round them (they are pits with water far below
    the fen, and a place's own water would pour into them)."""
    todo = pools.copy(); Yf = np.where(todo, -999, Y)
    for _ in range(80):
        if not todo.any(): break
        p = np.pad(Yf, 1, mode="edge"); n = np.maximum.reduce([p[1:-1, :-2], p[1:-1, 2:], p[:-2, 1:-1], p[2:, 1:-1]])
        got = todo & (n > -999); Yf[got] = n[got]; todo &= ~got
    Y[pools & ~todo] = Yf[pools & ~todo]; water_level[pools & ~todo] = -999


def shape_sites(Y, water_level, X0, Z0, keep=None, sites=None, log=print, pools=None, paths=None):
    """Shape every thin place whose whole square lies inside the grids. Y and water_level ([x, z], water -999 or
    lower = none) are changed in place. pools: standing pools (not rivers or the sea) that may be filled in near a
    place. keep: 0..1, ground that stays as it is (roads and rivers). paths: roads and trails, which keep their own
    surface on the new ground. Returns (shaped mask, [(x, y, z, name, states)], {id: facts})."""
    SX, SZ = Y.shape
    shaped = np.zeros(Y.shape, bool); blocks = []; facts = {}
    for sid, name, x, z, facing in (sites or thin_sites()):
        a, b = x - RAD - X0, z - RAD - Z0
        if a < 0 or b < 0 or a + 2 * RAD + 1 > SX or b + 2 * RAD + 1 > SZ: continue
        sl = (slice(a, a + 2 * RAD + 1), slice(b, b + 2 * RAD + 1))
        if pools is not None and pools[sl].any():
            ys, ws = Y[sl], water_level[sl]; fill_pools(ys, ws, pools[sl]); Y[sl] = ys; water_level[sl] = ws
        k = keep[sl] if keep is not None else np.zeros((2 * RAD + 1,) * 2, np.float32)
        inp = {"id": sid, "x": x, "z": z, "facing": facing, "rad": RAD, "heights": Y[sl].astype(int).ravel().tolist(),
               "water": np.maximum(water_level[sl], -999).astype(int).ravel().tolist(), "keep": np.round(k, 3).ravel().tolist(),
               "path": (paths[sl].astype(int).ravel().tolist() if paths is not None else None)}
        r = subprocess.run(["node", os.path.join(HERE, "shape_cli.mjs")], input=json.dumps(inp), capture_output=True, text=True)
        if r.returncode: raise RuntimeError(f"thin place {sid}: {r.stderr[-800:]}")
        o = json.loads(r.stdout); n = 2 * RAD + 1
        Y[sl] = np.array(o["heights"], Y.dtype).reshape(n, n)
        water_level[sl] = np.array(o["water"], water_level.dtype).reshape(n, n)
        shaped[sl] |= np.array(o["mix"], np.float32).reshape(n, n) > 0
        pal = o["palette"]
        blocks += [(x + dx, y, z + dz, pal[i]["name"], pal[i]["states"]) for dx, y, dz, i in o["blocks"]]
        facts[sid] = {"x": x, "z": z, "floor": o["floor"], "probes": [[x + dx, z + dz, y] for dx, dz, y in o["probes"]]}
        log("thin place", name, "floor", o["floor"], "blocks", len(o["blocks"]), "probes", len(o["probes"]), "leaks", o["leaks"], "causeway", o["causeway"], "paths under water", o["drowned"])
    return shaped, blocks, facts


def write_js(facts, path):
    """The game's copy: the ground height outside each mouth, and five columns that tell shaped land from the old."""
    with open(path, "w") as f:
        f.write("// Made by map/thinplaces/land.py from the map's own heights. Do not edit by hand: run the tool again.\n")
        f.write("// floor: the top ground block outside the cave mouth. probes: [x, z, y] columns of the shaped land; the game\n")
        f.write("// builds on the shaped land only where it finds them (thinplaces.js landOf), so an older world still works.\n")
        f.write("export const THIN_LAND = {\n")
        for sid, d in facts.items():
            f.write(f"  {sid}: {{ floor: {d['floor']}, probes: {json.dumps([[p[0], p[1], p[2]] for p in [(a, b, c) for a, b, c in d['probes']]])} }},\n")
        f.write("};\n")


def near_lines(lines_json, X0, Z0, shape, kinds):
    """A stand-in for genworld's road, trail and river masks when run alone: blocks to the nearest line of those kinds."""
    L = json.load(open(lines_json)); L = {k: L[k] for k in kinds}; d = np.full(shape, 99.0, np.float32)
    def walk(o):
        if isinstance(o, list) and o and isinstance(o[0], list) and len(o[0]) >= 2 and all(isinstance(a, (int, float)) for a in o[0][:2]): yield np.array([p[:2] for p in o], float)
        elif isinstance(o, dict): 
            for a in o.values(): yield from walk(a)
        elif isinstance(o, list):
            for a in o: yield from walk(a)
    sites = thin_sites()
    for P in walk(L):
        for i in range(len(P) - 1):
            p, q = P[i], P[i + 1]
            if not any(abs((p[0] + q[0]) / 2 - s[2]) < 260 and abs((p[1] + q[1]) / 2 - s[3]) < 260 for s in sites): continue
            n = int(max(abs(q - p).max(), 1)) + 1
            for t in np.linspace(0, 1, n):
                cx, cz = p + (q - p) * t; a, b = int(round(cx)) - X0, int(round(cz)) - Z0
                x0, x1, z0, z1 = max(0, a - 14), min(shape[0], a + 15), max(0, b - 14), min(shape[1], b + 15)
                if x0 >= x1 or z0 >= z1: continue
                gx, gz = np.meshgrid(np.arange(x0, x1) - a, np.arange(z0, z1) - b, indexing="ij")
                d[x0:x1, z0:z1] = np.minimum(d[x0:x1, z0:z1], np.hypot(gx, gz))
    return d


if __name__ == "__main__":
    Y = np.load(sys.argv[1]).astype(np.int32); W = np.load(sys.argv[2]).astype(np.int32); O = -1264
    lines = os.path.join(os.path.dirname(sys.argv[1]), "lines.json")
    keep = paths = None
    if os.path.exists(lines):
        keep = np.maximum(np.clip((16 - near_lines(lines, O, O, Y.shape, ("roads",))) / 8, 0, 1),
                          np.clip((44 - near_lines(lines, O, O, Y.shape, ("rivers",))) / 30, 0, 1))   # a river keeps its whole valley
        paths = near_lines(lines, O, O, Y.shape, ("roads", "trails")) <= 2
    Y0 = Y.copy()
    pools = (W > Y) & (W == 62)   # stand-in for genworld's fenpool mask: still water at sea level, away from the coast
    for sid, _, x, z, _ in thin_sites():
        if sid == "drowned_chapel": pools[max(0, x - 130 - O):x + 130 - O, max(0, z - 130 - O):z + 130 - O] = False
    shaped, blocks, facts = shape_sites(Y, W, O, O, keep, pools=pools, paths=paths)
    print("columns shaped", int(shaped.sum()), "changed", int((Y != Y0).sum()), "blocks", len(blocks))
    if "--js" in sys.argv: write_js(facts, sys.argv[sys.argv.index("--js") + 1]); print("wrote", sys.argv[sys.argv.index("--js") + 1])
    if "--save" in sys.argv:
        out = sys.argv[sys.argv.index("--save") + 1]; np.save(out + "-heights.npy", Y.astype(np.int16)); np.save(out + "-water.npy", W.astype(np.int16))
        json.dump([[x, y, z, n, s] for x, y, z, n, s in blocks], open(out + "-blocks.json", "w"))
