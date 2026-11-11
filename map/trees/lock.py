"""Unbreakable tree blocks (Mateo, 2026-11-11: "the custom tree assets ... are not going to be breakable", for now).

Every log, bark block, leaf, wall, fence, stair, slab and trapdoor a tree asset uses gets a tree-only copy,
siege:old_<vanilla name>, that looks the same (it points at the vanilla texture) but cannot be mined or blown
up, never burns, and never decays. Hanging plants, vines, leaf litter, snow and ground blocks stay vanilla.

    locked(bp)      -> a copy of a finished tree Blueprint using the tree-only blocks (what the database stores)
    LOCK = False    -> exports plain vanilla trees instead (the one switch to undo the rule)

studio/build_tree_blocks.py writes the block files from KINDS below.
"""
from bp import Blueprint

LOCK = True
DIR = {"n": 0, "e": 1, "s": 2, "w": 3}
AXIS = {"y": 0, "x": 1, "z": 2}


COPY = ("siege:hollowwood_core", "siege:hollowwood_lattice")   # the Hollow's own wood: copied as-is, made unbreakable


def kind(name):
    if name in COPY: return "copy"
    if name.endswith("_leaves") or name.startswith("azalea_leaves"): return "leaves"
    if name.endswith("_log") or name.endswith("_wood"): return "log"
    if name.endswith("_stairs"): return "stairs"
    if name.endswith("_slab"): return "slab"
    if name.endswith("_trapdoor"): return "trapdoor"
    if name.endswith("_fence") and "gate" not in name: return "fence"
    if name.endswith("_wall"): return "wall"
    return None


def tree_id(name): return "siege:old_" + name.split(":")[-1]


def states(name, p):
    k = kind(name)
    if k == "log": return {"siege:axis": AXIS[p.get("axis", "y")]}
    if k == "stairs": return {"siege:dir": DIR[p.get("facing", "n")], "siege:top": int(p.get("half") == "top")}
    if k == "slab": return {"siege:top": int(p.get("half") == "top")}
    if k == "trapdoor":
        # open: the plate stands on the side of its cell that faces the limb it clings to
        side = {"n": "s", "s": "n", "e": "w", "w": "e"}[p.get("facing", "n")]
        return {"siege:dir": DIR[side], "siege:top": int(p.get("half") == "top"), "siege:open": int(bool(p.get("open")))}
    if k in ("fence", "wall"):
        c = p.get("conn", {})
        st = {f"siege:{d}": int(bool(c.get(d))) for d in "nesw"}
        if k == "wall": st["siege:post"] = int(bool(p.get("post", True)))
        return st
    return {}


def locked(bp):
    if not LOCK: return bp
    out = Blueprint(bp.name); out.notes = list(bp.notes); out.markers = dict(bp.markers)
    for cell, (n, p) in bp.cells.items():
        if kind(n): out.cells[cell] = (tree_id(n), {"raw": states(n, p)})
        else: out.cells[cell] = (n, p)
    for a in ("species", "size", "rotations", "fill_below"):
        if hasattr(bp, a): setattr(out, a, getattr(bp, a))
    return out
