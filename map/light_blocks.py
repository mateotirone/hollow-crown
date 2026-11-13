"""Light a baked town (hollow-crown-worldblocks/1) the way the building engine lights every build (Mateo 2026-11-13,
"we need to go around and light all the builds"): the skill's light stage (lighting.py) over the whole town at once,
so it sees the town's own street lamps and every building's rooms, doors and yards together.

    python3 map/light_blocks.py map/millbrook-blocks.json [more ...]      # in place; prints what it added

towngen.write_worldblocks and bake_town.py call light_worldblocks() before they write, so a new bake comes out lit;
running this again on a lit file adds nothing. Lanterns go in after every block they hang from (attached blocks last).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".claude", "skills", "minecraft-builder", "scripts"))
import emit, lighting  # noqa: E402

DOOR_DIR = {0: "e", 1: "s", 2: "w", 3: "n"}


def logical(e):
    """A worldblocks palette entry -> (bare name, the few logical props lighting reads)."""
    n, st = lighting.bare(e["name"]), e.get("states") or {}
    p = {}
    if n.endswith("_door") and "trapdoor" not in n:
        p["facing"] = DOOR_DIR.get(st.get("direction", 1), "s")
        if st.get("upper_block_bit"): p["upper"] = True
    if st.get("hanging"): p["hanging"] = True
    if n.endswith("_slab"): p["half"] = st.get("minecraft:vertical_half", "top" if st.get("top_slot_bit") else "bottom")
    return n, p


def light_worldblocks(d, kind=None, log=None):
    """Add the town's missing lights to worldblocks dict d in place. Returns the number of blocks added."""
    pal = d["palette"]
    lp = [logical(e) for e in pal]
    blocks = {}
    for x, y, z, i in d["blocks"]:
        if pal[i].get("soft") and (x, y, z) in blocks: continue          # leaves only fill air
        blocks[(x, y, z)] = lp[i]
    added, _r = lighting.light(blocks, kind=kind, log=log)
    if not added: return 0
    new = {c: blocks[c] for c in added}
    # fence brackets join the wall they stick out from (connections from the town's blocks round them)
    near = {}
    for (x, y, z) in new:
        for dx, dz in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            c = (x + dx, y, z + dz)
            if c in blocks: near[c] = blocks[c]
    emit.connect(near)
    idx = {json.dumps([e["name"], e.get("states") or {}, bool(e.get("soft"))], sort_keys=True): k for k, e in enumerate(pal)}

    def pid(n, p):
        name, st = emit.bedrock_state(n, p)
        name = name if ":" in name else "minecraft:" + name
        key = json.dumps([name, st, False], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append({"name": name, "states": st})
        return idx[key]

    order = sorted(new, key=lambda c: (lighting.bare(new[c][0]) in ("lantern", "soul_lantern"), -c[1] if new[c][1].get("hanging") else c[1]))
    for c in order:                        # posts and chains before the lanterns on them, chains from the top down
        n, p = near.get(c, new[c])
        d["blocks"].append([c[0], c[1], c[2], pid(n, p)])
    return len(added)


def main():
    for f in sys.argv[1:]:
        d = json.load(open(f))
        log = []
        n = light_worldblocks(d, log=log)
        if n:
            with open(f, "w") as fh: json.dump(d, fh, separators=(",", ":"))
        print(os.path.basename(f), "added", n, "blocks", *log)


if __name__ == "__main__":
    main()
