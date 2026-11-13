#!/usr/bin/env python3
"""Settlement layouts for the game: the town generator's per-plot JSON -> Siege_Nights_BP/scripts/settle/towns_data.js

    python3 tools/export_towns.py DIR        DIR holds <plot>.json files (format hollow-crown-settlement/1),
                                             e.g. /mnt/project-files/siege-nights/towngen/settlements

One entry per map plot (key = plot name in lower case), three layouts each. Heights are stored relative to the
town square (the game adds the difference between the square and the real ground at the Plot Stone), and the
groundwork is packed into a short string so twelve towns stay small:

  gw = four tier sections joined by "|", each a string of column runs (see pack_groundwork); a block char is an
       index into the layout's palette (CHARS).
"""
import glob, json, os, sys

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
TIER = {"Hamlet": 0, "Town": 1, "City": 2, "Castle": 3}
SIZE = {"Small": "S", "Medium": "M", "Large": "L", "Great": "G"}
STAIR = {"e": 0, "w": 1, "s": 2, "n": 3}       # Bedrock weirdo_direction
GATE = {"s": 0, "w": 1, "n": 2, "e": 3}        # Bedrock direction
RENAME = {"dirt_path": "grass_path"}


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
            out["direction"] = GATE[v]
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
    elif f["name"] == "mason_yard":  # the Mason's yard: side = the way its front faces (n/s/e/w), read as rotation
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
                   [[w[0], w[1], w[2] - base] for w in s["door"]["walk"]], TIER[s["opensAt"]], s["tags"], bool(s.get("long"))] for s in v["slots"]],
        "fields": [[*f["centre"], TIER[f["opensAt"]], f["area_by_tier"]] for f in v["fields"]],
        "fix": [fixture(f, base) for f in v["fixtures"]],
        "pal": [bedrock(n, s) for n, s in pal],
        "gw": pack_groundwork(v["groundwork"]["blocks"], base),
    }


def main(src):
    towns = {}
    for path in sorted(glob.glob(os.path.join(src, "*.json"))):
        with open(path, encoding="utf8") as f:
            d = json.load(f)
        if d.get("format") != "hollow-crown-settlement/1":
            continue
        key = d["plot"]["name"].lower()
        towns[key] = {"name": d["plot"]["name"], "gate": d["plot"]["gate"], "walls": d["wall_radius"], "clear": d["clear"],
                      "minimum": d["minimum"], "variants": [variant(v) for v in d["variants"]]}
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Siege_Nights_BP", "scripts", "settle", "towns_data.js")
    body = json.dumps(towns, separators=(",", ":"))
    with open(out, "w", encoding="utf8") as f:
        f.write("// Generated by tools/export_towns.py from the town generator's settlement layouts. Do not edit by hand.\n")
        f.write(f"// {len(towns)} towns: {', '.join(t['name'] for t in towns.values())}\n")
        f.write(f"export const TOWN_CHARS = {json.dumps(CHARS)};\n")
        f.write(f"export const TOWNS = {body};\n")
    print(f"{out}: {len(towns)} towns, {len(body) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
