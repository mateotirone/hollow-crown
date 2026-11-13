"""Write the vault strongrooms into the add-on as data the town hall build engine raises block by block.

    python3 export_vaults.py   -> ../../Siege_Nights_BP/scripts/vault/rooms_data.js

Rooms come from vault_rooms.py (every tier, every layout). The game frame is the one every settlement build
uses: (0, 1, 0) is the block the player stood in at the top of the stairs (never set), +z runs down the stairs
toward the vault door, +x is to the player's right, y = 0 is the ground they stood on. Everything else lies
below. The export adds what the 3D previews leave out because the ground does that job: the stairwell's side
walls and ceiling, and air above every tread so the stairs are carved through whatever is there.

Blocks keep the logical form (name + facing / axis / half) so townhall/designs.js can turn them any way.
Rows are run-length coded along x: [y, z, x0, count, paletteIndex].
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import vault_rooms as V
from export_halls import KEEP, lighting

HEADROOM = 4   # air above each tread


def room(tier, layout):
    b = V.strongroom(tier, layout)
    t = V.TIERS[tier]
    sx, sy, sz = b.markers["stairs_top"]              # top tread's top, one block out past the last tread
    mid = sx
    ox, oy, oz = sx, sy, sz + 1                        # where the player stands (feet), the frame origin
    # the stairwell: treads at (mid-1..mid+1, y, z) climbing +z; line it and carve it
    treads = sorted({(z, y) for (x, y, z), (n, p) in b.cells.items() if x == mid and n.endswith("_stairs") and z > b.markers["lock"][2] + V.ENTRY + 1})
    for z, y in treads:
        for x in range(mid - 1, mid + 2):
            for yy in range(y + 1, min(y + 1 + HEADROOM, oy + 3)):
                b.cells.setdefault((x, yy, z), ("air", {}))
        top = min(y + HEADROOM + 1, oy)
        for yy in range(y, top):
            for x in (mid - 2, mid + 2):
                b.cells.setdefault((x, yy, z), (t["wall"], {"axis": "x"}))
        if y + HEADROOM + 1 < oy:                       # still underground: a ceiling
            for x in range(mid - 2, mid + 3):
                b.cells.setdefault((x, y + HEADROOM + 1, z), (t["roof"], {}))
    # the frame: player's forward is down the stairs (-z in the room's own coordinates)
    # room coordinates are world-style (x east, z south) with the player facing north down the stairs: their
    # right is +x and forward is -z. The build engine's toWorld puts local y = 1 on the origin (feet) level.
    to = lambda x, y, z: (x - ox, y - oy + 1, oz - z)
    before = dict(b.cells)
    lighting.light_blueprint(b, avoid=[(ox, oy, oz)])   # every build lit (Mateo 2026-11-13); the frame origin stays clear
    # the room is underground: the lighting sees its roof as an open yard and stands lamp posts on it, which would
    # poke up out of the ground (and through the town hall's floor over it). Take back anything it added at or above
    # the ground (frame y >= 0), with the post's foot just below.
    added = [c for c, v in b.cells.items() if before.get(c) != v]
    up = {(x, z) for (x, y, z) in added if to(x, y, z)[1] >= 0}
    for (x, y, z) in added:
        if (x, z) in up and to(x, y, z)[1] >= -1:
            if (x, y, z) in before: b.cells[(x, y, z)] = before[(x, y, z)]
            else: del b.cells[(x, y, z)]
    pal, idx, cells = [], {}, {}
    for (x, y, z), (n, p) in b.cells.items():
        if n == "keep": continue
        q = {k: v for k, v in p.items() if k in KEEP or k == "raw"}   # raw: add-on block states (the safe's part)
        if n == "air": q = {}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n if ":" in n else "minecraft:" + n, q])
        c = to(x, y, z)
        assert c != (0, 1, 0)   # the engine never sets the origin cell
        cells[c] = idx[key]
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
    marks = {k: list(to(*v)) for k, v in b.markers.items()}
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]; zs = [c[2] for c in cells]
    box = {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys), "z0": min(zs), "z1": max(zs)}
    return {"palette": pal, "rows": rows, "marks": marks, "box": box, "size": t["inside"]}


def main():
    out = {}
    for tier in V.TIERS:
        out[tier] = {}
        for layout in V.LAYOUTS:
            d = room(tier, layout)
            need = {"lock", "stand_crown", "stand_heart", "stand_template", "entrance"} - set(d["marks"])
            assert not need, (tier, layout, need)
            assert d["box"]["y1"] < 4, (tier, layout, d["box"])
            out[tier][layout] = d
            print(tier, layout, "cells", sum(r[3] for r in d["rows"]), "box", d["box"], "lock", d["marks"]["lock"])
    dest = os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "vault", "rooms_data.js")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    js = ("// Generated by map/structures/export_vaults.py from vault_rooms.py. Do not edit by hand.\n"
          "// VAULT_ROOMS[tier][layout]: the strongroom with its stairs and entrance hall. Frame: (0, 1, 0) is the block the\n"
          "// player stood in at the top of the stairs, +z down the stairs toward the door, +x to their right, y = 0 their ground.\n"
          "// marks: lock (the Vault Lock), stand_crown / stand_heart / stand_template (floating stands), entrance, stairs_top.\n"
          "// Same shape as townhall/designs_data.js: palette [id, logical props], rows [y, z, x0, count, palette index].\n"
          "export const VAULT_ROOMS = " + json.dumps(out, separators=(",", ":")) + ";\n")
    open(dest, "w").write(js)
    print("wrote", os.path.relpath(dest), os.path.getsize(dest) // 1024, "KB")


if __name__ == "__main__":
    main()
