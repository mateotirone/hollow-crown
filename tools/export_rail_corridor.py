"""Export the blocks around every planned rail line from a Bedrock world, for tools/rail_lay_test.mjs.
usage: export_corridor.py <world dir> <rail-segments.json> <out.json> [radius]"""
import amulet, json, sys, logging
logging.disable(logging.WARNING)
world, segs, out = sys.argv[1:4]; R = int(sys.argv[4]) if len(sys.argv) > 4 else 12
lv = amulet.load_level(world)
bed = lv.translation_manager.get_version("bedrock", (1, 21, 0))
d = json.load(open(segs))
want = {}                                     # (x, z) -> (ylo, yhi)
for s in d["segments"]:
    for x, y, z, k, dr in s["blocks"]:
        for dx in range(-R, R + 1):
            for dz in range(-R, R + 1):
                c = (x + dx, z + dz); lo, hi = want.get(c, (10**9, -10**9))
                want[c] = (min(lo, y - 16), max(hi, y + 16))
bychunk = {}
for (x, z), r in want.items(): bychunk.setdefault((x >> 4, z >> 4), []).append((x, z, r))
names, nidx, tcache = [], {}, {}
def name_of(b):
    key = b
    if key in tcache: return tcache[key]
    if b.namespace.startswith("universal_"):
        try:
            v = bed.block.from_universal(b)[0]; n = v.namespaced_name
        except Exception: n = b.namespaced_name.replace("universal_", "")
    else: n = b.namespaced_name
    n = n.replace("universal_", "")
    if n not in nidx: nidx[n] = len(names); names.append(n)
    tcache[key] = nidx[n]; return nidx[n]
cols = {}
for i, ((cx, cz), lst) in enumerate(bychunk.items()):
    try: ch = lv.get_chunk(cx, cz, "minecraft:overworld")
    except Exception: continue
    pal = ch.block_palette; local = {}
    for x, z, (lo, hi) in lst:
        import numpy as np; arr = np.asarray(ch.blocks[x & 15:(x & 15) + 1, lo:hi + 1, z & 15:(z & 15) + 1]).ravel()
        ids = []
        for v in arr.tolist():
            if v not in local: local[v] = name_of(pal[v])
            ids.append(local[v])
        cols[f"{x},{z}"] = [lo, ids]
    if i % 200 == 0: print(i, len(bychunk), file=sys.stderr)
json.dump({"palette": names, "cols": cols}, open(out, "w"), separators=(",", ":"))
print("columns", len(cols), "palette", len(names))
