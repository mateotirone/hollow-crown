"""Real bridges for the Hollow, from the one bridge generator (minecraft-builder skill, bridges.py).

    node tools/hollow_bridges_dump.mjs /tmp/hollow-crossings.json
    python3 tools/hollow_bridges.py /tmp/hollow-crossings.json [--scene DIR]

The Hollow is generated chunk by chunk in the game (undertow/terrain.js), so its bridges are worked out
here once and shipped as data. The dump lists every place a road or the story path is carried over a
light river, a lake or a valley (columnAt().under). Each carried stretch that is a real crossing (path on
dry land at both ends, water or low ground on both sides at the middle) becomes one straight bridge in the
Hollow style (black pointed arches, veinstone, soul lanterns), graded and humped like every other bridge.
Stretches that are not crossings (a road cut along a hillside) keep the generator's own solid deck.

Writes Siege_Nights_BP/scripts/undertow/bridges_data.js:
    HOLLOW_BRIDGES = { palette: [[id, states]], chunks: { "cx,cz": [[x, z, y0, y1, i], ...] },
                       covered: { "cx,cz": [x, z, ...] } }
palette[0] is air (clearing above the deck). `covered` lists the carried columns a bridge replaces, so the
terrain generator leaves out its old flat deck, parapet and lanterns there.
--scene DIR also writes DIR/scene.json (bridges with their land) for the 3D renderer.
Rerun after changing the Hollow's roads, rivers or land, or the bridge generator.
"""
import json, os, sys, argparse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, ".claude", "skills", "minecraft-builder", "scripts"))
import bridges as BR  # noqa: E402

OUT = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "undertow", "bridges_data.js")
MIN_CELLS = 12   # fewer carried columns than this is a road edging along a slope, not a crossing


def crossings(group, sea):
    """The real crossings in one carried stretch. Only the columns over water (or 3+ above dry ground) are
    bridged; where the land comes up to the road again the generator's own causeway carries on to the bank."""
    C = {(c[0], c[1]): c for c in group["cells"]}
    top = lambda c: c[3] if c[3] is not None else c[2]
    deck = [c for c in group["cells"] if c[3] is not None]
    if len(deck) < MIN_CELLS: return []
    deck_y = max(c[2] for c in deck)
    wet = {(c[0], c[1]): (3 if c[7] else 5) for c in deck if c[4] and (top(c) < sea or c[2] - top(c) >= 3)}
    if not wet: return []

    def walk(x, z):
        c = C.get((x, z))
        return c[2] + 1 if c and c[4] and (x, z) not in wet else None

    def low(x, z):
        c = C.get((x, z))
        if c is None: return None
        t = top(c)
        return sea if t < sea else (t if t <= deck_y - 3 else None)

    rejects = []
    found = BR.crossings_from_cells(set(wet), walk, low, lambda k: wet[k], region="hollow", path="road", max_across=11, rejects=rejects)
    # a road running along a river rather than over it is no crossing: that whole stretch keeps its causeway
    if any(len(r) > 4 for r in rejects): return []
    for cr in found:
        cr["_wet"] = cr.pop("_cells")
        cr["water_y"] = sea if any(top(C[k]) < sea for k in cr["_wet"]) else None
        cr["ground"] = lambda x, z: top(C[(x, z)]) if (x, z) in C else deck_y - 1
    return found


def build(dump):
    """Every Hollow bridge from a dump: (palette, chunks, covered, report lines, [(group, crossing, blocks)])."""
    d = json.load(open(dump)); sea = d["sea"]
    pal, idx = [["minecraft:air", {}]], {}
    chunks, covered = defaultdict(list), defaultdict(list)
    report, scene = [], []
    for gi, g in enumerate(d["groups"]):
        for cr in crossings(g, sea):
            wetc = cr.pop("_wet")
            blocks = BR.bridge_blocks(cr)
            cols, p = BR.works_columns(blocks)
            remap = [0]
            for e in p[1:]:
                k = json.dumps([e["name"], e.get("states", {})], sort_keys=True)
                if k not in idx: idx[k] = len(pal); pal.append([e["name"], e.get("states", {})])
                remap.append(idx[k])
            for x, z, y0, y1, i in cols:
                chunks[f"{x >> 4},{z >> 4}"].append([x, z, y0, y1, remap[i]])
            # every carried column of this stretch: the old deck goes, the land beneath stays
            foot = {(x, z) for (x, y, z), b in blocks.items() if b[0] != "air"} | set(wetc)
            for c in g["cells"]:
                if c[3] is not None and (c[0], c[1]) in foot: covered[f"{c[0] >> 4},{c[1] >> 4}"] += [c[0], c[1]]
            P = BR.plan(cr)
            report.append(f"  {cr['a']} -> {cr['b']}: span {P['L']:.0f}, {cr['kind']}, {'over water' if cr['water_y'] else 'dry gap'}, tier {P.get('tier')}")
            scene.append((g, cr, blocks))
    return pal, chunks, covered, report, scene, sea


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("dump")
    ap.add_argument("--scene", help="also write DIR/hollow_bridge_N/scene.json (each bridge on its land)")
    a = ap.parse_args()
    pal, chunks, covered, report, scene, sea = build(a.dump)
    with open(OUT, "w") as f:
        f.write("// Generated by tools/hollow_bridges.py from the bridge generator (minecraft-builder skill). Do not edit by hand.\n")
        f.write("// HOLLOW_BRIDGES.palette: [[id, states]] (0 = air). chunks[\"cx,cz\"]: runs [x, z, y0, y1, palette index] in world\n")
        f.write("// coordinates. covered[\"cx,cz\"]: x, z pairs of carried columns whose old deck a bridge replaces.\n")
        f.write("export const HOLLOW_BRIDGES = " + json.dumps({"palette": pal, "chunks": chunks, "covered": covered}, separators=(",", ":")) + ";\n")
    print(f"{len(report)} bridges, {sum(map(len, chunks.values()))} runs, {os.path.getsize(OUT) // 1024} KB -> {os.path.relpath(OUT, ROOT)}")
    print("\n".join(report))
    if a.scene: write_scene(a.scene, scene, sea)


def write_scene(out, scene, sea):
    """The bridges on their land for map/structures/render (terrain columns from the dump, Hollow blocks)."""
    import math, emit
    os.makedirs(out, exist_ok=True)
    for n, (g, cr, blocks) in enumerate(scene):
        cells = {}
        for x, z, h, under, paved, road, river, narrow in g["cells"]:
            t = under if under is not None else h
            for y in range(max(t - 4, sea - 6), t): cells[(x, y, z)] = ("deepslate" if y < t - 1 else "tuff", {})
            cells[(x, t, z)] = ("cobbled_deepslate" if paved and under is None else ("tuff" if t < sea else "moss_block"), {})
            for y in range(t + 1, sea + 1): cells[(x, y, z)] = ("water", {})
        for k, b in blocks.items():
            if b[0] == "air": cells.pop(k, None)
            else: cells[k] = b
        d = os.path.join(out, f"hollow_bridge_{n}"); os.makedirs(d, exist_ok=True)
        sp = os.path.join(d, "scene.json"); emit.save_logical(cells, sp)
        (ax, az), (bx, bz) = cr["a"], cr["b"]; L = math.hypot(bx - ax, bz - az)
        nx, nz = -(bz - az) / L, (bx - ax) / L
        sc = json.load(open(sp)); a = math.degrees(math.atan2(nx, nz)); dd = sc["camera"]["views"]["front"][2]
        sc["camera"]["views"].update({"side": [round(a), 6, dd * 0.9], "three-quarter": [round(a + 35), 26, dd * 0.8]})
        json.dump(sc, open(sp, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
