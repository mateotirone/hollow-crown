"""Outputs: block states per edition, merged .mcfunction, summary JSON, logical scene (for the repo's
three.js renderer) and .mcstructure (through the repo's bp.py when it is there).

Logical blocks follow map/structures/bp.py: facing n/s/e/w (stairs: the tall back side; trapdoors and
doors: Java-style facing), half bottom/top, corner none/inner_left/inner_right/outer_left/outer_right,
open, axis x/y/z, upper, hinge, hanging, conn (fence/wall/pane connections, worked out here).
"""
import json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
FILL_LIMIT = 32768
BEDROCK_FUNC_LIMIT = 9000          # Bedrock rejects function files over 10,000 commands
DIRS = {"n": (0, 0, -1), "s": (0, 0, 1), "e": (1, 0, 0), "w": (-1, 0, 0)}
CARD = {"n": "north", "s": "south", "e": "east", "w": "west"}
SIGN_WOOD = {"oak": "wall_sign", "dark_oak": "darkoak_wall_sign"}
DOOR_ID = {"oak_door": "wooden_door"}


def _find_up(rel):
    d = HERE
    for _ in range(8):
        p = os.path.join(d, rel)
        if os.path.exists(p): return p
        d = os.path.dirname(d)
    return None


_STATES = None
def bedrock_states():
    global _STATES
    if _STATES is None:
        p = _find_up(os.path.join("map", "structures", "bedrock_states.json"))
        _STATES = json.load(open(p)) if p else False
    return _STATES


def is_stairs(n): return n.endswith("_stairs")
def is_slab(n): return n.endswith("_slab")
def is_wall(n): return n.endswith("_wall") and not n.endswith("wall_sign")
def is_fence(n): return n.endswith("_fence")
def is_pane(n): return n.endswith("glass_pane") or n == "iron_bars"
def is_trapdoor(n): return n.endswith("trapdoor")


def solid_full(n, p):
    if not n or n == "air": return False
    if is_stairs(n) or is_slab(n) or is_wall(n) or is_fence(n) or is_pane(n) or is_trapdoor(n): return False
    if n.endswith("_door") or n.endswith("_sign") or n in ("lantern", "soul_lantern", "campfire", "flower_pot", "iron_chain", "torch",
                                                            "end_rod", "lightning_rod", "vine", "water") or n.endswith("leaves") or n.endswith("leaves_flowered"):
        return False
    return True


def connect(blocks):
    """Fence, wall and pane connections from neighbours (like bp.finish)."""
    for (x, y, z), (n, p) in list(blocks.items()):
        if not (is_fence(n) or is_wall(n) or is_pane(n)): continue
        conn = {}
        for d, (dx, dy, dz) in DIRS.items():
            m, q = blocks.get((x + dx, y, z + dz), (None, {}))
            ok = solid_full(m, q)
            if m and is_fence(n): ok = ok or is_fence(m) or m.endswith("fence_gate")
            if m and is_wall(n): ok = ok or is_wall(m)
            if m and is_pane(n): ok = ok or is_pane(m) or is_wall(m)
            conn[d] = bool(ok)
        p = dict(p); p["conn"] = conn
        if is_wall(n):
            straight = (conn["n"] and conn["s"] and not conn["e"] and not conn["w"]) or (conn["e"] and conn["w"] and not conn["n"] and not conn["s"])
            p["post"] = not straight or (x, y + 1, z) in blocks
        blocks[(x, y, z)] = (n, p)
    return blocks


def bedrock_state(n, p):
    """logical -> (bedrock id, {state: value})"""
    if ":" in n and not n.startswith("minecraft:"): return n, {}      # the add-on's own blocks (siege:spire_roof)
    st = {}
    f = p.get("facing")
    if is_stairs(n):
        st["weirdo_direction"] = {"e": 0, "w": 1, "s": 2, "n": 3}[f or "n"]
        st["upside_down_bit"] = p.get("half") == "top"
        if p.get("corner", "none") != "none": st["minecraft:corner"] = p["corner"]
    elif is_slab(n):
        st["minecraft:vertical_half"] = p.get("half", "bottom")
    elif is_trapdoor(n):
        st["direction"] = {"e": 0, "w": 1, "s": 2, "n": 3}[f or "n"]
        st["open_bit"] = bool(p.get("open")); st["upside_down_bit"] = p.get("half") == "top"
    elif is_wall(n):
        c = p.get("conn", {})
        for d in "nsew": st["wall_connection_type_" + CARD[d]] = "short" if c.get(d) else "none"
        st["wall_post_bit"] = bool(p.get("post", True))
    elif is_fence(n) or is_pane(n):
        c = p.get("conn", {})
        if n != "iron_bars":
            for d in "nsew": st["minecraft:connection_" + CARD[d]] = bool(c.get(d))
    elif n.endswith("_door"):
        n = DOOR_ID.get(n, n)
        st["minecraft:cardinal_direction"] = CARD[f or "s"]; st["upper_block_bit"] = bool(p.get("upper"))
        st["door_hinge_bit"] = bool(p.get("hinge")); st["open_bit"] = False
    elif n.endswith("_wall_sign"):
        w = n[: -len("_wall_sign")]; n = SIGN_WOOD.get(w, n)
        st["facing_direction"] = {"n": 2, "s": 3, "w": 4, "e": 5}[f or "s"]
    elif n in ("lantern", "soul_lantern"):
        st["hanging"] = bool(p.get("hanging"))
    elif n == "campfire":
        st["minecraft:cardinal_direction"] = CARD[f or "s"]; st["extinguished"] = False
    elif n.endswith("leaves") or n.endswith("leaves_flowered"):
        st["persistent_bit"] = True
    elif n == "vine":          # bits: 1 south, 2 west, 4 north, 8 east = the face of the cell it clings to
        st["vine_direction_bits"] = {"s": 1, "w": 2, "n": 4, "e": 8}[p.get("attach", "n")]
    elif n in ("end_rod", "lightning_rod"):
        st["facing_direction"] = 1
    elif n == "snow_layer":
        st["height"] = int(p.get("height", 0))
    elif n == "bell":          # hanging from the beam above
        st["attachment"] = "hanging"; st["direction"] = {"s": 0, "w": 1, "n": 2, "e": 3}[f or "s"]
    elif n.endswith("_button"):  # stuck to the wall behind it, pointing out of face f
        st["facing_direction"] = {"n": 2, "s": 3, "w": 4, "e": 5}[f or "s"]
    if p.get("axis"): st["pillar_axis"] = p["axis"]
    S = bedrock_states()
    if S:
        if n not in S["blocks"]: raise ValueError(f"'{n}' is not a Bedrock block (bedrock_states.json)")
        allowed = S["blocks"][n]
        for k in list(st):
            if k not in allowed: del st[k]                       # e.g. pillar_axis on a block without one
            elif st[k] not in S["properties"][k]["values"]: raise ValueError(f"{n}: {k}={st[k]!r} not allowed")
    return n, st


def java_state(n, p, java_id):
    if ":" in n and not n.startswith("minecraft:"): return n, {}
    f = p.get("facing"); st = {}
    n = java_id or n
    if is_stairs(n):
        st = {"facing": CARD[f or "n"], "half": p.get("half", "bottom"), "shape": {"none": "straight"}.get(p.get("corner", "none"), p.get("corner", "straight"))}
    elif is_slab(n): st = {"type": p.get("half", "bottom")}
    elif is_trapdoor(n): st = {"facing": CARD[f or "n"], "half": p.get("half", "bottom"), "open": str(bool(p.get("open"))).lower()}
    elif is_wall(n):
        c = p.get("conn", {}); st = {CARD[d]: "low" if c.get(d) else "none" for d in "nsew"}; st["up"] = str(bool(p.get("post", True))).lower()
    elif is_fence(n) or is_pane(n):
        c = p.get("conn", {}); st = {CARD[d]: str(bool(c.get(d))).lower() for d in "nsew"}
    elif n.endswith("_door"):
        st = {"facing": CARD[f or "s"], "half": "upper" if p.get("upper") else "lower", "hinge": "right" if p.get("hinge") else "left"}
    elif n.endswith("_wall_sign"): st = {"facing": CARD[f or "s"]}
    elif n in ("lantern", "soul_lantern"): st = {"hanging": str(bool(p.get("hanging"))).lower()}
    elif n == "campfire": st = {"facing": CARD[f or "s"], "lit": "true"}
    elif n.endswith("leaves"): st = {"persistent": "true"}
    elif n == "azalea_leaves_flowered": n = "flowering_azalea_leaves"; st = {"persistent": "true"}
    elif n == "vine": st = {CARD[p.get("attach", "n")]: "true"}
    elif n in ("end_rod", "lightning_rod"): st = {"facing": "up"}
    elif n == "bell": st = {"attachment": "ceiling", "facing": CARD[f or "s"]}
    elif n == "snow_layer": n = "snow"; st = {"layers": str(int(p.get("height", 0)) + 1)}
    elif n.endswith("_button"): st = {"face": "wall", "facing": CARD[f or "s"]}
    if p.get("axis"): st["axis"] = p["axis"]
    if n == "iron_chain": n = "chain"
    return n, st


def state_str(edition, name, st):
    if edition == "java":
        return f"minecraft:{name}" + ("[" + ",".join(f"{k}={v}" for k, v in st.items()) + "]" if st else "")
    if not st: return name
    def val(v):
        if isinstance(v, bool): return "true" if v else "false"
        if isinstance(v, int): return str(v)
        return f'"{v}"'
    return name + " [" + ",".join(f'"{k}"={val(v)}' for k, v in st.items()) + "]"


RANK = lambda n, p: 0 if solid_full(n, p) else 1 if (is_stairs(n) or is_slab(n)) else 2 if (is_wall(n) or is_fence(n) or is_pane(n) or is_trapdoor(n)) else 3


def merge_boxes(cells):
    """cells: {(x,y,z): key} -> [(x0,y0,z0,x1,y1,z1,key)], greedy x then z then y, each box <= FILL_LIMIT."""
    left = dict(cells); out = []
    for (x, y, z) in sorted(cells, key=lambda c: (c[1], c[2], c[0])):
        if (x, y, z) not in left: continue
        k = left[(x, y, z)]
        x1 = x
        while left.get((x1 + 1, y, z)) == k: x1 += 1
        z1 = z
        while all(left.get((i, y, z1 + 1)) == k for i in range(x, x1 + 1)) and (x1 - x + 1) * (z1 - z + 2) <= FILL_LIMIT: z1 += 1
        y1 = y
        while all(left.get((i, y1 + 1, j)) == k for i in range(x, x1 + 1) for j in range(z, z1 + 1)) \
                and (x1 - x + 1) * (z1 - z + 1) * (y1 - y + 2) <= FILL_LIMIT: y1 += 1
        for i in range(x, x1 + 1):
            for j in range(y, y1 + 1):
                for l in range(z, z1 + 1): del left[(i, j, l)]
        out.append((x, y, z, x1, y1, z1, k))
    return out


def write_functions(blocks, out_dir, name, edition, palette, clear=False, offset=(0, 0, 0)):
    """blocks: {(x,y,z): (name, props)} -> list of written files and the command count."""
    ox, oy, oz = offset
    keys, rank = {}, {}
    for c, (n, p) in blocks.items():
        if edition == "java":
            jid = palette.java_id(n)
            bn, st = java_state(n, p, jid)
        else:
            bn, st = bedrock_state(n, p)
        s = state_str(edition, bn, st)
        keys[c] = s; rank[s] = min(rank.get(s, 9), RANK(n, p))
    cmds = []
    if clear and blocks:
        xs, ys, zs = zip(*blocks)
        air = {(x, y, z): "air" for x in range(min(xs), max(xs) + 1) for y in range(min(ys), max(ys) + 1) for z in range(min(zs), max(zs) + 1)}
        for b in merge_boxes(air): cmds.append(_cmd(b, ox, oy, oz))
    by_rank = {}
    for c, s in keys.items(): by_rank.setdefault(rank[s], {})[c] = s
    for r in sorted(by_rank):
        for b in sorted(merge_boxes(by_rank[r]), key=lambda b: (b[1], b[2], b[0])): cmds.append(_cmd(b, ox, oy, oz))
    files = []
    chunks = [cmds[i:i + BEDROCK_FUNC_LIMIT] for i in range(0, len(cmds), BEDROCK_FUNC_LIMIT)] or [[]]
    head = f"# {name}: built by the minecraft-builder skill. Relative to where it runs: ~0 ~0 ~0 is the spec's 0,0,0.\n"
    if len(chunks) == 1:
        p = os.path.join(out_dir, f"{name}.mcfunction"); open(p, "w").write(head + "\n".join(chunks[0]) + "\n"); files.append(p)
    else:
        for i, ch in enumerate(chunks, 1):
            p = os.path.join(out_dir, f"{name}_part{i}.mcfunction"); open(p, "w").write(head + "\n".join(ch) + "\n"); files.append(p)
        main = os.path.join(out_dir, f"{name}.mcfunction")
        open(main, "w").write(head + "\n".join(f"function {name}_part{i}" for i in range(1, len(chunks) + 1)) + "\n"); files.insert(0, main)
    return files, len(cmds)


def _cmd(b, ox, oy, oz):
    x0, y0, z0, x1, y1, z1, k = b
    r = lambda v, o: f"~{v + o}" if v + o else "~"
    if (x0, y0, z0) == (x1, y1, z1): return f"setblock {r(x0, ox)} {r(y0, oy)} {r(z0, oz)} {k}"
    return f"fill {r(x0, ox)} {r(y0, oy)} {r(z0, oz)} {r(x1, ox)} {r(y1, oy)} {r(z1, oz)} {k}"


def save_logical(blocks, path):
    """Scene file for map/structures/render/render.py (palette + [x, y, z, i])."""
    pal, idx, out = [], {}, []
    for (x, y, z), (n, p) in sorted(blocks.items()):
        q = {k: v for k, v in p.items()}
        key = json.dumps([n, q], sort_keys=True)
        if key not in idx: idx[key] = len(pal); pal.append([n, q])
        out.append([x, y, z, idx[key]])
    xs, ys, zs = zip(*blocks) if blocks else ([0], [0], [0])
    w = max(max(xs) - min(xs), max(zs) - min(zs)) + 1; h = max(ys) - min(ys) + 1
    d = round(1.4 * max(1.0, 1.15 * h / w), 2)          # step back for tall builds so the whole thing is in frame
    cam = {"views": {"front-left": [-35, 24, d], "front-right": [35, 24, d], "high": [20, 55, d * 1.1], "back": [145, 24, d],
                      "front": [0, 10, d], "right": [90, 10, d], "left": [-90, 10, d], "rear": [180, 10, d]}}
    json.dump({"palette": pal, "blocks": out, "camera": cam}, open(path, "w"), separators=(",", ":"))


def save_mcstructure(blocks, path, name):
    p = _find_up(os.path.join("map", "structures", "bp.py"))
    if not p: return None
    import sys
    sys.path.insert(0, os.path.dirname(p))
    import bp as BP
    b = BP.Blueprint(name)
    from engine import to_bp
    for c, (n, q) in blocks.items():
        n, q = to_bp(n, q)
        if n.endswith("_wall_sign") and n[:-10] == "dark_oak": n = "dark_oak_wall_sign"
        b.cells[c] = (n, q)
    b.finish()
    b.save_mcstructure(path)
    return path


def summary(blocks, stage_of, files, ncmd, warnings, spec_name, extra=None):
    if not blocks:
        return {"name": spec_name, "blocks": 0, "commands": 0, "warnings": warnings}
    xs, ys, zs = zip(*blocks)
    cnt = Counter(n for n, _ in blocks.values())
    st = Counter(stage_of.get(c, "shapes") for c in blocks)
    s = {"name": spec_name,
         "size": [max(xs) - min(xs) + 1, max(ys) - min(ys) + 1, max(zs) - min(zs) + 1],
         "min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)],
         "blocks": len(blocks), "kinds": len(cnt), "top_blocks": cnt.most_common(12),
         "by_stage": dict(st), "commands": ncmd, "files": [os.path.basename(f) for f in files],
         "warnings": warnings[:20]}
    if extra: s.update(extra)
    return s
