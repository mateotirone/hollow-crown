"""Build every landmark (landmarks.py) with the minecraft-builder skill and write them into the add-on.

    python3 export_landmarks.py [--scenes DIR]

-> Siege_Nights_BP/scripts/landmarks/designs_data.js : DESIGNS { id: { palette, rows, box, late, ...meta } }
   Palette entries are [Bedrock id, Bedrock states] (spelled by the skill's emit.bedrock_state), rows are
   run-length along x: [y, z, x0, count, palette index]. Designs in TURNING are written four times,
   "<id>@n|e|s|w", their front (-z) turned to face that way.
--scenes DIR: also a scene.json per design for map/structures/render (previews).
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SKILL = os.path.join(ROOT, ".claude", "skills", "minecraft-builder", "scripts")
sys.path.insert(0, SKILL)
import landmarks as LM  # noqa: E402
import landmarks_story as LS  # noqa: E402
import emit  # noqa: E402
import lighting  # noqa: E402

try:
    import engine  # the one engine's Python entry (PR #155)

    def compute(spec):
        return engine.compute(spec)[0]
except ImportError:  # same steps as engine.compute, through build.py's pieces
    from colour import Palette  # noqa: E402
    from fit import voxelize  # noqa: E402
    from materials import Materials  # noqa: E402
    import parts  # noqa: E402
    from build import resolve  # noqa: E402

    def compute(spec):
        pal, log = Palette(edition="bedrock"), []
        cells, stage_of = {}, {}
        if spec.get("shapes"):
            for c, v in voxelize(spec["shapes"], q=spec.get("quality", 4), hollow=spec.get("hollow", 1), log=log).items():
                cells[c] = v; stage_of[c] = "shapes"
        ctx = parts.Context(cells, stage_of, log, spec)
        for pt in spec.get("parts", []): parts.run(ctx, pt)
        for e in spec.get("place", []):
            x, y, z, b = e[:4]; p = e[4] if len(e) > 4 else {}
            ctx.set(x, y, z, "place", raw=b.replace("minecraft:", ""), **p)
        blocks = resolve(cells, Materials(spec.get("materials"), pal, log), pal, log)
        emit.connect(blocks)
        return blocks

OUT = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "landmarks", "designs_data.js")
TURN = {"n": 0, "e": 1, "s": 2, "w": 3}           # quarter turns clockwise from north
ROT = {"n": "e", "e": "s", "s": "w", "w": "n"}
STATES = emit.bedrock_states()


def turn_cell(x, z, q):
    for _ in range(q): x, z = -z, x                  # clockwise seen from above (x east, z south)
    return x, z


def turn_props(p, q):
    p = dict(p)
    for _ in range(q):
        if p.get("facing") in ROT: p["facing"] = ROT[p["facing"]]
        if p.get("axis") in ("x", "z"): p["axis"] = "z" if p["axis"] == "x" else "x"
        if isinstance(p.get("conn"), dict): p["conn"] = {ROT[k]: v for k, v in p["conn"].items()}
        bs = dict(p.get("bs", {}))
        if "facing_direction" in bs and bs["facing_direction"] in (2, 3, 4, 5):
            bs["facing_direction"] = {2: 5, 5: 3, 3: 4, 4: 2}[bs["facing_direction"]]
        if "direction" in bs and isinstance(bs["direction"], int):   # 0 south, 1 west, 2 north, 3 east
            bs["direction"] = (bs["direction"] + 1) % 4
        if "minecraft:cardinal_direction" in bs:
            bs["minecraft:cardinal_direction"] = {"north": "east", "east": "south", "south": "west", "west": "north"}[bs["minecraft:cardinal_direction"]]
        if "rail_direction" in bs and bs["rail_direction"] in (0, 1): bs["rail_direction"] = 1 - bs["rail_direction"]
        if bs: p["bs"] = bs
    return p


LATE = ("lantern", "sign", "trapdoor", "torch", "chain", "button", "hook", "ladder", "rail", "carpet", "campfire",
        "cocoa", "short_grass", "vine", "cobweb", "fence_gate", "lectern", "flower_pot")


def bedrock(n, p):
    bs = p.get("bs", {})
    q = {k: v for k, v in p.items() if k != "bs"}
    try:
        n2, st = emit.bedrock_state(n, q)
    except (KeyError, ValueError):
        n2, st = n, {}
    if STATES and n2 in STATES["blocks"]:
        for k, v in bs.items():
            if k in STATES["blocks"][n2]: st[k] = v
    else:
        st.update(bs)
    return "minecraft:" + n2, st


# Lit by the world builds thread itself (Mateo 2026-11-13): left as they are here.
LIT_ELSEWHERE = ("cinder_roost", "crownhold_hall", "crownhold_walls")


N18 = [(a, b, e) for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1) if 0 < abs(a) + abs(b) + abs(e) < 3]


def floating(blocks):
    """Cells of a rigid design that would hang in the air: not joined  to anything that stands on its ground
    layer (y 0 and 1 rest on the ground the game fills under it). Joined means sharing a face or an edge, so a stair
    roof stepping down diagonally holds; a block touching only at a corner does not. Mateo 2026-11-13/14: nothing floats, and every story
    build has to be perfect, so they are dropped here and tools/check.mjs keeps it at none."""
    solid = {c for c, (n, _) in blocks.items() if n not in ("air", "water")}
    seen = {c for c in solid if c[1] <= 1}
    todo = list(seen)
    while todo:
        x, y, z = todo.pop()
        for c in ((x + a, y + b, z + e) for a, b, e in N18):
            if c in solid and c not in seen: seen.add(c); todo.append(c)
    return solid - seen


def export(d, q=0, name=None):
    spec = dict(d.spec()); spec["light"] = False      # lit below, once the dug air is in
    blocks = compute(spec)
    for c in d.airs(): blocks[c] = ("air", {})
    if name not in LIT_ELSEWHERE:                       # every build lit at night (Mateo 2026-11-13)
        spots = [tuple(v[:3]) for k in ("signs", "spawns", "npcs", "roleMarks") for v in d.meta.get(k, [])]
        if d.meta.get("mark"): spots.append(tuple(d.meta["mark"][:3]))
        lighting.light(blocks, kind="hollow" if d.meta.get("hollow") else None, avoid=spots)
        emit.connect(blocks)
    if d.meta.get("mode", "rigid") == "rigid" and not d.meta.get("sea") and not d.meta.get("dry"):
        for c in floating(blocks): del blocks[c]
    cells, pal, idx = {}, [], {}

    def index(n, p):
        key = json.dumps(bedrock(n, p), sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append(json.loads(key))
        return idx[key]

    for (x, y, z), (n, p) in blocks.items():
        tx, tz = turn_cell(x, z, q)
        cells[(tx, y, tz)] = index(n, turn_props(p, q)) if n != "air" else index("air", {})
    rows = []
    for (y, z) in sorted({(c[1], c[2]) for c in cells}):
        run = None
        for x in sorted(c[0] for c in cells if c[1] == y and c[2] == z):
            pi = cells[(x, y, z)]
            if run and run[2] + run[3] == x and run[4] == pi: run[3] += 1
            else:
                if run: rows.append(run)
                run = [y, z, x, 1, pi]
        if run: rows.append(run)
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; zs = [c[2] for c in cells]
    out = {"palette": pal, "rows": rows, "box": {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}}
    out["late"] = [i for i, (n, _) in enumerate(pal) if any(k in n for k in LATE)]
    m = dict(d.meta)

    def tp(v):
        x, z = turn_cell(v[0], v[2], q)
        return [x, v[1], z] + list(v[3:])

    for k in ("signs", "spawns", "npcs", "roleMarks", "tomes", "life"): m[k] = [tp(v) for v in m.get(k, [])]
    if "mark" in m: m["mark"] = tp(m["mark"])
    if "fillRects" in m:   # [x0, z0, x1, z1] columns that may be filled under (the rest are left open)
        m["fillRects"] = [[min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])]
                          for a, b in ((turn_cell(r[0], r[1], q), turn_cell(r[2], r[3], q)) for r in m["fillRects"])]
    for k in ("fill", "top"):
        if k in m: m[k] = None if m[k] is None else -2 if m[k] == "keep" else index(m[k], {})
    if "piles" in m: m["piles"] = [index(b, {"axis": "y"}) for b in m["piles"]]
    out.update({k: v for k, v in m.items() if not (k in ("signs", "spawns", "npcs", "roleMarks", "tomes", "life") and not v)})
    out["palette"] = pal
    return out


def scene(data):
    blocks = []
    for y, z, x0, n, i in data["rows"]:
        for x in range(x0, x0 + n): blocks.append([x, y, z, i])
    return blocks


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--scenes"); ap.add_argument("--only")
    a = ap.parse_args()
    designs = {}
    turning = LM.TURNING | LS.STORY_TURNING
    for name, fn in {**LM.DESIGNS, **LS.STORY_DESIGNS}.items():
        if a.only and name not in a.only.split(","): continue
        d = fn()
        if name in turning:
            for f, q in TURN.items(): designs[f"{name}@{f}"] = export(d, q, name)
        else:
            designs[name] = export(d, name=name)
        print(f"{name}: {sum(r[3] for r in (designs.get(name) or designs[name + '@n'])['rows'])} blocks")
    if a.only: return json.dump(designs, open(os.path.join(a.scenes or ".", "designs.json"), "w"))
    js = ("// Generated by map/structures/export_landmarks.py from landmarks.py. Do not edit by hand.\n"
          "// palette: [Bedrock id, states]; rows: [y, z, x0, count, palette index] (see landmarks/plan.js)\n"
          "export const DESIGNS = " + json.dumps(designs, separators=(",", ":")) + ";\n")
    open(OUT, "w").write(js)
    print("wrote", os.path.relpath(OUT, ROOT), round(len(js) / 1024), "KB")
    if a.scenes:
        os.makedirs(a.scenes, exist_ok=True)
        json.dump(designs, open(os.path.join(a.scenes, "designs.json"), "w"))


if __name__ == "__main__":
    main()
