#!/usr/bin/env python3
"""Settlement layouts for the game: the town generator's per-plot JSON -> Siege_Nights_BP/scripts/settle/towns_data.js

    python3 tools/export_towns.py DIR [--starter SDIR]
        DIR holds <plot>.json files (format hollow-crown-settlement/1), e.g. /mnt/project-files/siege-nights/towngen/settlements
        SDIR holds the starter villages (<plot>.json, format hollow-crown-starter/1, from map/structures/starter_all.py)

The starter village is every plot's Hamlet (Mateo, 2026-11-13): with --starter, each layout's Hamlet band (its
slots, groundwork and fixtures) is replaced by the plot's starter village, and the Town, City and Castle bands
grow round it: their slots, ground and fixtures that would land on the starter's paths, plots or yards are left
out. The starter's wall outline (radii) goes with the town, so every ring follows the land.

One entry per map plot (key = plot name in lower case), three layouts each. Heights are stored relative to the
town square (the game adds the difference between the square and the real ground at the Plot Stone), and the
groundwork is packed into a short string so twelve towns stay small:

  gw = four tier sections joined by "|", each a string of column runs (see pack_groundwork); a block char is an
       index into the layout's palette (CHARS).
"""
import argparse, glob, json, os, sys

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
TIER = {"Hamlet": 0, "Town": 1, "City": 2, "Castle": 3}
SIZE = {"Small": "S", "Medium": "M", "Large": "L", "Great": "G", "Works": "W"}
STAIR = {"e": 0, "w": 1, "s": 2, "n": 3}       # Bedrock weirdo_direction
GATE = {"s": 0, "w": 1, "n": 2, "e": 3}        # Bedrock direction
RENAME = {"dirt_path": "grass_path"}
STARTER_SKIP = {"plot_marker", "mason_bench"}   # placed by the game (Plot Markers, the bench fixture)


def bedrock(name, states):
    """[id, states] for the game (Java-style names and states from the generator)"""
    out = {}
    for k, v in states.items():
        if k == "raw":
            out.update(v)
        elif k == "half":
            out["minecraft:vertical_half"] = "top" if v == "top" else "bottom"
        elif k == "facing" and name.endswith("_stairs"):
            out["weirdo_direction"] = STAIR[v]
        elif k == "facing" and name.endswith("_gate"):
            out["minecraft:cardinal_direction"] = {"s": "south", "w": "west", "n": "north", "e": "east"}[v]   # 26.x: no more "direction"
        elif k == "axis":
            out["pillar_axis"] = v
        elif k in ("growth", "persistent_bit"):
            out[k] = v
    return ["minecraft:" + RENAME.get(name, name), out]


def pack_groundwork(rows, base):
    """Columns packed to a few characters each. A run of blocks stacked up one column starts with
    "-" (the next column: same dx, dz + 1), "~" (the same column again, higher up) or "!" + dx, dz (two chars each, +2048),
    then dy0 (one char, +32) and the count (one char), then one palette char per block."""
    enc2 = lambda v: CHARS[(v + 2048) >> 6] + CHARS[(v + 2048) & 63]
    tiers = [{} for _ in range(4)]
    for dx, y, dz, pal, tier in rows:
        assert -2048 <= dx < 2048 and -2048 <= dz < 2048 and -32 <= y - base < 32, (dx, dz, y - base)
        tiers[tier].setdefault((dx, dz), {})[y - base] = pal
    sections = []
    for cols in tiers:
        out, last = [], None
        for (dx, dz) in sorted(cols):
            col = cols[(dx, dz)]
            runs, cur = [], []
            for y in sorted(col):
                if cur and (y != cur[-1] + 1 or len(cur) == 63):
                    runs.append(cur)
                    cur = []
                cur.append(y)
            runs.append(cur)
            for i, run in enumerate(runs):
                if i:
                    head = "~"
                elif last == (dx, dz - 1):
                    head = "-"
                else:
                    head = "!" + enc2(dx) + enc2(dz)
                out.append(head + CHARS[run[0] + 32] + CHARS[len(run)] + "".join(CHARS[col[y]] for y in run))
            last = (dx, dz)
        sections.append("".join(out))
    return "|".join(sections)


def fixture(f, base):
    tier = TIER[f["tier"]]
    x, z = f["at"]
    dy = f["ground_y"] - base if "ground_y" in f else None
    row = [f["name"], x, z, tier, dy]
    if f["name"] == "tree":
        row += [f.get("species"), f.get("size"), f.get("rotation", 0)]
    elif f["name"] in ("mason_yard", "storehouse"):  # side = the way its front faces (n/s/e/w), read as rotation
        row += [f.get("side", f.get("rotation", "s"))]
    elif "rotation" in f:
        row += [f.get("stamp"), f.get("rotation", 0)]
    return row


def variant(v):
    base = v["square"]["y"]
    pal = v["groundwork"]["palette"]
    assert len(pal) <= len(CHARS), "palette too long"
    return {
        "template": v["template"], "label": v["label"], "seed": v.get("seed"), "charter": v.get("passes_charter", True),
        "base": base,   # the square's real height on the map: the game lays the groundwork from here (founding.js)
        "square": v["square"]["centre"],
        "hall": [h["box"] for h in v["hall"]],
        "rings": [[r["radius"], TIER[r["opensAt"]]] for r in v["rings"]],
        "slots": [[s["id"], SIZE[s["size"]], *s["box"], s["floor_y"] - base, s["door"]["side"], s["door"]["step"],
                   [[w[0], w[1], w[2] - base] for w in s["door"]["walk"]], TIER[s["opensAt"]], s["tags"], bool(s.get("long")), s.get("start")] for s in v["slots"]],
        "fields": [[*f["centre"], TIER[f["opensAt"]], f["area_by_tier"]] for f in v["fields"]],
        "fix": [fixture(f, base) for f in v["fixtures"]],
        "pal": [bedrock(n, s) for n, s in pal],
        "gw": pack_groundwork(v["groundwork"]["blocks"], base),
    }


def boxes_meet(a, b, pad=0):
    return a[0] - pad <= b[2] and b[0] - pad <= a[2] and a[1] - pad <= b[3] and b[1] - pad <= a[3]


def starter_hamlet(v, st):
    """Put the starter village in as this layout's Hamlet band. v is a hollow-crown-settlement/1 variant
    (changed in place), st the plot's hollow-crown-starter/1 data."""
    base = v["square"]["y"]
    used = {(c[0], c[1]) for c in st["used"]}
    near = {(x + i, z + j) for x, z in used for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2)}   # the 3-block clearance
    in_box = lambda b: any((x, z) in near for x in range(b[0], b[2] + 1) for z in range(b[1], b[3] + 1))
    hall4, hall5 = v["hall"][-2]["box"], v["hall"][-1]["box"]
    # 1. the town layout's own Hamlet goes, and whatever of the later bands would land on the starter village
    v["slots"] = [s for s in v["slots"] if s["opensAt"] != "Hamlet" and not in_box(s["box"])]
    v["fixtures"] = [f for f in v["fixtures"] if f["tier"] != "Hamlet" and tuple(f["at"]) not in near]
    rows = [r for r in v["groundwork"]["blocks"] if r[4] > 0 and (r[0], r[2]) not in used]
    # 2. the starter village's ground and blocks (its palette goes on the end of the layout's)
    pal = v["groundwork"]["palette"]
    index = {(n, json.dumps(p, sort_keys=True)): i for i, (n, p) in enumerate(pal)}
    # the Mason's yard is raised by the game (settle/basebuilds.js, the mason_yard design on the fixture below): of the
    # starter's yard only its levelled ground stays
    yard_n, yard = next(((n, a) for n, a in enumerate(st["areas"]) if a["kind"] == "yard"), (None, None))
    R, A = st["frame"]["right"], st["frame"]["ahead"]
    def world_box(b):
        pts = [(r * R[0] + a * A[0], r * R[1] + a * A[1]) for r, a in ((b[0], b[2]), (b[1], b[3]))]
        return [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
    ybox = world_box(yard["box"]) if yard else None
    for x, y, z, n, p in st["blocks"]:
        if n in STARTER_SKIP or (x, z) == (0, 0):
            continue
        if ybox and ybox[0] <= x <= ybox[2] and ybox[1] <= z <= ybox[3] and y > yard["y"]:
            continue
        k = (n, json.dumps(p, sort_keys=True))
        if k not in index:
            index[k] = len(pal); pal.append([n, p])
        rows.append([x, y, z, index[k], 0])
    keep = sorted({r[3] for r in rows})               # only the palette entries still used
    remap = {o: i for i, o in enumerate(keep)}
    v["groundwork"]["palette"] = [pal[o] for o in keep]
    v["groundwork"]["blocks"] = [[x, y, z, remap[p], t] for x, y, z, p, t in rows]
    # 3. the starter's plots: the library's, the two houses (already standing when you arrive) and the open plot
    for n, (ar, door) in enumerate(zip(st["areas"], st["doors"])):
        if ar["kind"] not in ("building", "slot"):
            continue
        box = world_box(ar["box"])
        wide = box[2] - box[0] + 1 if door["side"] in "ns" else box[3] - box[1] + 1
        deep = box[3] - box[1] + 1 if door["side"] in "ns" else box[2] - box[0] + 1
        design = ar.get("design")
        size = ar.get("size") or ("Small" if wide <= 9 else "Medium" if deep <= 15 and wide <= 13 else "Large")
        size = {"S": "Small", "M": "Medium", "L": "Large"}.get(size, size)
        hall = ["hall4"] if boxes_meet(box, hall4) else ["hall5"] if boxes_meet(box, hall5) else []   # ground the hall takes back
        tags = ["starter"] + (["library", "square"] if design == "library" else []) + hall
        if design == "house" and not any("founder" in q["tags"] for q in v["slots"]):
            tags.append("founder")   # the founder's own house: their bed goes in it (settle/basebuilds.js)
        sx, sz = door["step"]
        v["slots"].append({"id": f"st{n}", "size": size, "box": box, "floor_y": ar["y"], "tags": tags, "long": size == "Medium" and wide == 13,
                           "door": {"side": door["side"], "step": [sx, sz], "walk": [[sx, sz, door["stepY"], "slab"]]},
                           "opensAt": "Hamlet", "start": design if design and design != "library" else None})
    # 4. fixtures: the Mason's yard (front middle, facing out), the Hall Cornerstone and the Mason's Bench (the bench
    # only stands there if the yard can't be raised)
    if yard:
        door = st["doors"][yard_n]
        v["fixtures"].append({"name": "mason_yard", "at": door["cell"], "ground_y": yard["y"], "side": door["side"], "tier": "Hamlet"})
    # the Storehouse's 15 x 15 ground: front middle, the way its door faces (raised and rebuilt by the game)
    for n, ar in enumerate(st["areas"]):
        if ar["kind"] == "storehouse":
            door = st["doors"][n]
            v["fixtures"].append({"name": "storehouse", "at": door["cell"], "ground_y": ar["y"], "side": door["side"], "tier": "Hamlet"})
    for f in st["fixtures"]:
        if f["kind"] in ("hall_cornerstone", "mason_bench"):
            x, y, z = f["at"]
            v["fixtures"].append({"name": f["kind"], "at": [x, z], "ground_y": y - 1, "tier": "Hamlet"})
    return v


def main(src, starters=None):
    towns = {}
    for path in sorted(glob.glob(os.path.join(src, "*.json"))):
        with open(path, encoding="utf8") as f:
            d = json.load(f)
        if d.get("format") != "hollow-crown-settlement/1":
            continue
        key = d["plot"]["name"].lower()
        st = None
        if starters:
            with open(os.path.join(starters, f"{key}.json"), encoding="utf8") as f:
                st = json.load(f)
            assert st["format"] == "hollow-crown-starter/1" and st["gate"] == d["plot"]["gate"], key
            for v in d["variants"]:
                starter_hamlet(v, st)
        towns[key] = {"name": d["plot"]["name"], "gate": d["plot"]["gate"], "walls": d["wall_radius"], "clear": d["clear"],
                      "minimum": d["minimum"], "variants": [variant(v) for v in d["variants"]]}
        if st:   # the wall outline follows the land (walldata.js radiusAt): radii at even angles for a ring of radiiAt
            towns[key]["outline"] = {"radii": [round(r, 1) for r in st["wall"]["radii"]], "radiiAt": st["wall"]["radiiAt"]}
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Siege_Nights_BP", "scripts", "settle", "towns_data.js")
    body = json.dumps(towns, separators=(",", ":"))
    with open(out, "w", encoding="utf8") as f:
        f.write("// Generated by tools/export_towns.py from the town generator's settlement layouts. Do not edit by hand.\n")
        f.write(f"// {len(towns)} towns: {', '.join(t['name'] for t in towns.values())}\n")
        f.write(f"export const TOWN_CHARS = {json.dumps(CHARS)};\n")
        f.write(f"export const TOWNS = {body};\n")
    print(f"{out}: {len(towns)} towns, {len(body) // 1024} KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(usage=__doc__)
    ap.add_argument("dir"); ap.add_argument("--starter")
    a = ap.parse_args()
    main(a.dir, a.starter)
