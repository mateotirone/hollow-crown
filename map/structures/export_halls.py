"""Write the rebuilt town halls into the add-on as data the town hall build engine raises block by block.

    python3 export_halls.py            -> ../../Siege_Nights_BP/scripts/townhall/designs_data.js

Coordinates go into the hall's own frame (townhall/hallparts.js): the Hall Cornerstone at (0, 1, 0)
right in front of the door, +z into the hall, +x to the player's right. Blocks are kept in the
logical form (name + facing / axis / half ...) so the game can turn them to face any way;
townhall/designs.js does the turning and the Bedrock state spelling.
Rows are run-length coded along x: [y, z, x0, count, paletteIndex].
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import settle_halls as H
sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
import lighting  # every build is lit at night (Mateo 2026-11-13): the engine's light stage

ARCH = {"vale": "vale", "frostmarch": "frost", "saltreach": "salt", "emberwaste": "ember", "blackfen": "fen"}
KEEP = ("facing", "axis", "half", "upper", "hinge", "open", "hanging", "conn", "post", "head")
# limits from the plot: the level-5 hall must stay within 15 blocks each side and 42 deep (settle/rules.js)
SIDE, DEEP, FRONT = 15, 42, -2

SIDES = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}

def tidy(bp):
    """Take out what a composed build leaves that no one would build (the 2026-11-14 town audit): a window box's sign
    whose face is right up against the next wing's wall, and a fence left floating on its own (a gallery post cut away
    by the room behind it). Returns how many cells went."""
    gone = []
    get = lambda x, y, z: (bp.cells.get((x, y, z)) or ("air", {}))[0]
    for (x, y, z), (n, p) in list(bp.cells.items()):
        if n.endswith("wall_sign") and p.get("facing") in SIDES:
            dx, dz = SIDES[p["facing"]]
            front = get(x + dx, y, z + dz)
            if front != "air" and lighting.opaque(front): gone.append((x, y, z))
        elif n.endswith("_fence"):
            if all(get(x + a, y + b, z + c) == "air" for a, b, c in ((0, -1, 0), (0, 1, 0), (1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1))):
                gone.append((x, y, z))
    # a railing left hanging where a gallery's floor was cut away (halls 3 to 5): a run of fence with air under every
    # post and nothing hard beside it stands on nothing (the "what's underneath" audit, Mateo 2026-11-14)
    hard = lambda n: n != "air" and lighting.opaque(n)
    hang = {(x, y, z) for (x, y, z), (n, p) in bp.cells.items() if n.endswith("_fence") and get(x, y - 1, z) == "air"
            and not any(hard(get(x + a, y, z + c)) for a, c in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    # where the gallery's floor still runs beside the post, the floor comes back under it (the railing stands on
    # the gallery's edge again); a railing with no floor anywhere beside it goes below
    floored = set()
    for (x, y, z) in hang:
        for a, c in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = get(x + a, y - 1, z + c)
            if hard(n) and get(x, y - 2, z) == "air":
                bp.cells[(x, y - 1, z)] = bp.cells[(x + a, y - 1, z + c)]; floored.add((x, y, z)); break
    hang -= floored
    seen = set()
    for c0 in hang:
        if c0 in seen: continue
        run, todo = [], [c0]; seen.add(c0)
        while todo:
            x, y, z = todo.pop(); run.append((x, y, z))
            for a, c in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + a, y, z + c)
                if q not in seen and get(*q).endswith("_fence"):
                    seen.add(q); todo.append(q)
        if all(q in hang or q in floored or q not in hang and get(q[0], q[1] - 1, q[2]) == "air" for q in run) and not any(q in floored for q in run):                        # every post of the run hangs: the whole railing goes
            for q in run:
                gone.append(q)
                if get(q[0], q[1] + 1, q[2]) in ("lantern", "soul_lantern"): gone.append((q[0], q[1] + 1, q[2]))
    for c in gone: bp.cells[c] = ("air", {})
    if gone or floored: bp.finish()
    return len(gone) + len(floored)

def export(bp, light=True):
    tidy(bp)
    if light: lighting.light_blueprint(bp)
    dx, dy, dz = bp.markers["door"]
    to = lambda x, y, z: (x - dx, y, dz - z + 1)
    pal, idx, cells = [], {}, {}
    for (x, y, z), (n, p) in bp.cells.items():
        if n in ("keep",): continue
        q = {k: v for k, v in p.items() if k in KEEP}
        if n == "air": q = {}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n if ":" in n else "minecraft:" + n, q])
        cells[to(x, y, z)] = idx[key]
    # facing in the hall frame: the design faces south (+z) toward the player, so the hall's +z is the design's north
    rows = []
    for (y, z) in sorted({(c[1], c[2]) for c in cells}):
        xs = sorted(c[0] for c in cells if c[1] == y and c[2] == z)
        run = None
        for x in xs:
            pi = cells[(x, y, z)]
            if run and run[2] + run[3] == x and run[4] == pi: run[3] += 1
            else:
                if run: rows.append(run)
                run = [y, z, x, 1, pi]
        if run: rows.append(run)
    marks = {k: list(to(*v)) for k, v in getattr(bp, "marks", {}).items()}
    xs = [c[0] for c in cells]; zs = [c[2] for c in cells]
    box = {"x0": min(xs), "x1": max(xs), "z0": min(zs), "z1": max(zs), "y1": max(c[1] for c in cells)}
    entry = list(to(*bp.markers["entry"])) if "entry" in bp.markers else [0, dy, 1]
    out = {"palette": pal, "rows": rows, "marks": marks, "box": box, "door": entry}
    if getattr(bp, "yard", None):   # yard wall and floor columns a site can open up for a path (the Barracks)
        out["yard"] = {k: [[x - dx, dz - z + 1] for x, z in v] for k, v in bp.yard.items()}
    return out

def main():
    out = {}
    problems = []
    for region, arch in ARCH.items():
        out[arch] = {}
        for level in range(1, 6):
            bp = H.REGION_HALLS[region](level)
            d = export(bp); out[arch][level] = d
            b = d["box"]
            if max(-b["x0"], b["x1"]) > SIDE or b["z1"] > DEEP or b["z0"] < FRONT:
                problems.append(f"{region} {level}: {b}")
            need = {"tree", "hearth", "ledger"} | ({"cartography", "sage"} if level >= 2 else set()) | ({"throne"} if level >= 4 else set()) | ({"vault"} if level == 5 else set())
            missing = need - set(d["marks"])
            if missing: problems.append(f"{region} {level}: missing marks {sorted(missing)}")
            print(region, level, "cells", sum(r[3] for r in d["rows"]), "rows", len(d["rows"]), "box", b)
    dest = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "townhall", "designs_data.js")
    js = ("// Generated by map/structures/export_halls.py from settle_halls.py. Do not edit by hand.\n"
          "// The town halls in the map kit's style, per arch and level: palette [id, logical props], rows [y, z, x0, count, palette index].\n"
          "export const HALL_DESIGNS = " + json.dumps(out, separators=(",", ":")) + ";\n")
    open(dest, "w").write(js)
    print("wrote", os.path.normpath(dest), round(len(js) / 1e3), "KB")
    if problems: print("PROBLEMS:\n  " + "\n  ".join(problems)); sys.exit(1)

if __name__ == "__main__":
    main()
