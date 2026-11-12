"""The one building engine (Mateo, 2026-11-12: every build uses this skill), callable from Python.

build.py is the command-line front end. Code that builds the map (map/structures/ builders, the review
builders, settlement and Hollow kits) calls this module instead, so every build gets the same parts,
roofs, colour matching and rules:

    import sys; sys.path.insert(0, ".claude/skills/minecraft-builder/scripts")
    import engine
    blocks, stage_of, log = engine.compute(spec)                    # {(x, y, z): (block, props)}
    engine.into_blueprint(bp, spec, offset=(x, y, z))               # write into a map/structures bp.Blueprint
    engine.into_blueprint(bp, spec, upto="walls")                   # stage by stage: foundation .. upto
    engine.into_blueprint(bp, spec, only="roof")                    # one stage, for fn(bp, B) stage functions

Stages, in order: shapes, foundation, frame, floors, walls, openings, roof, details, interior, place.
Props follow map/structures/bp.py (facing n/s/e/w, half, open, upper, hinge, hanging, axis); the few the
kit has no field for (corner stairs, vine sides, rods) go in "raw" as Bedrock states. Blocks are the
Bedrock ids the kit already uses. compute() caches nothing and is pure: same spec, same blocks.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
from colour import Palette  # noqa: E402
from fit import voxelize  # noqa: E402
from materials import Materials  # noqa: E402
import emit, parts  # noqa: E402

STAGES = ["shapes", "foundation", "frame", "floors", "walls", "openings", "roof", "details", "interior", "place"]


def resolve(cells, mats, pal, log):
    """Logical cells {kind, props, mat|name} -> {(x,y,z): (block id, props)}"""
    for c, v in cells.items():
        if v.get("mat"): mats.note_cell(v["mat"], *c)
    out, warned = {}, set()
    for (x, y, z), v in cells.items():
        k, p = v["kind"], dict(v.get("props", {}))
        if k == "air": continue
        if k == "raw":
            out[(x, y, z)] = (v["name"], p); continue
        if not v.get("mat"):
            if ("nomat", k) not in warned: log.append(f"{k} cell at {x},{y},{z} has no material"); warned.add(("nomat", k))
            continue
        b, raw = mats.block(v["mat"], x, y, z)
        if raw:
            out[(x, y, z)] = (b, p); continue
        if k == "full":
            if "axis" not in pal.blocks[b]["tags"]: p.pop("axis", None)
            out[(x, y, z)] = (b, p); continue
        if k == "post":
            k = "wall" if "wall" in pal.blocks[b]["variants"] else "fence" if "fence" in pal.blocks[b]["variants"] else \
                ("wall" if pal.substitute(b, "wall") else "fence")
        sub = pal.substitute(b, k)
        if sub is None:
            if (k, b) not in warned: log.append(f"no {k} form near {b}; used a full block"); warned.add((k, b))
            out[(x, y, z)] = (b, {}); continue
        if sub != b and (k, b) not in warned:
            log.append(f"{b} has no {k} form: those cells use {sub}"); warned.add((k, b))
        p.pop("axis", None)
        out[(x, y, z)] = (pal.variant(sub, k), p)
    return out


def cells_of(spec, log=None, info=None):
    """Spec -> logical cells and the stage of each, before materials are resolved. Pass a dict as info to
    get the layout back (see layout())."""
    log = [] if log is None else log
    cells, stage_of = {}, {}
    if spec.get("shapes"):
        sc = voxelize(spec["shapes"], q=spec.get("quality", 4), thin=spec.get("thin", False), hollow=spec.get("hollow", 1), log=log)
        for c, v in sc.items(): cells[c] = v; stage_of[c] = "shapes"
    ctx = parts.Context(cells, stage_of, log, spec)
    for pt in spec.get("parts", []):
        parts.run(ctx, pt)
    if info is not None: info.update(ctx.info)
    for e in spec.get("place", []):
        x, y, z, b = e[:4]; p = e[4] if len(e) > 4 else {}
        ctx.set(x, y, z, "place", raw=b.replace("minecraft:", ""), **p)
    return cells, stage_of, log


def layout(spec):
    """Where things ended up, for code that adds to a build (furnished interiors, signs, NPC spots):
    {"houses": [{"name", "rect", "plate", "storeys": [{"floor_y", "stand_y", "height", "rect"}]}]}.
    floor_y is the floor block's row; stand_y = floor_y + 1 is the first air row, where furniture and
    feet go. The old map builders counted floors one row lower, so port their interiors with stand_y."""
    spec = dict(spec); spec["materials"] = dict(spec.get("materials") or {})
    info = {}
    cells_of(spec, info=info)
    return info


def compute(spec, edition=None, pal=None):
    """Spec -> ({(x, y, z): (block, props)}, {(x, y, z): stage}, warnings). Connections are worked out."""
    spec = dict(spec); spec["materials"] = dict(spec.get("materials") or {})
    pal = pal or Palette(edition=edition or spec.get("edition", "bedrock"))
    cells, stage_of, log = cells_of(spec)
    mats = Materials(spec.get("materials"), pal, log)
    blocks = resolve(cells, mats, pal, log)
    seat_spire_tops(blocks, pal, log)
    emit.connect(blocks)
    return blocks, stage_of, log


SPIRE_TOPS = ("siege:spire_roof",)


def seat_spire_tops(blocks, pal, log=None):
    """Mateo 2026-11-12: a custom spire top block never sits on a slab (it reads as floating). A slab or
    nothing under one becomes the full block of that material."""
    for (x, y, z), (n, q) in list(blocks.items()):
        if n not in SPIRE_TOPS: continue
        below = blocks.get((x, y - 1, z))
        if below is None:
            if log is not None: log.append(f"{n} at {x},{y},{z} has nothing under it")
            continue
        bn = below[0]
        if bn.endswith("_slab") or bn == "slab" or "_slab" in bn:
            full = pal.base_of(bn) or bn.replace("_slab", "")
            blocks[(x, y - 1, z)] = (full, {})
            if log is not None: log.append(f"{n} at {x},{y},{z} sat on {bn}: made it {full}")


def to_bp(n, q):
    """One skill block -> the (name, props) a map/structures bp.Blueprint takes."""
    q = dict(q); corner = q.pop("corner", None); q.pop("conn", None); q.pop("post", None)
    raw = dict(q.pop("raw", {}) or {})
    if corner and corner != "none": raw["minecraft:corner"] = corner
    if n == "vine": raw["vine_direction_bits"] = {"s": 1, "w": 2, "n": 4, "e": 8}[q.pop("attach", "n")]
    if n in ("end_rod", "lightning_rod"): raw["facing_direction"] = 1
    if n == "bell": raw["attachment"] = "hanging"; raw["direction"] = {"s": 0, "w": 1, "n": 2, "e": 3}[q.pop("facing", "s")]
    if n == "candle" or n.endswith("_candle"): raw["candles"] = max(0, int(q.pop("candles", 1)) - 1); raw["lit"] = bool(q.pop("lit", True))
    if n.endswith("_button"): raw["facing_direction"] = {"n": 2, "s": 3, "w": 4, "e": 5}[q.pop("facing", "s")]
    if raw: q["raw"] = raw
    return n, q


def into_blueprint(bp, spec, offset=(0, 0, 0), upto=None, only=None, edition=None):
    """Write the build into a bp.Blueprint at offset. upto = last stage to include (stage-by-stage
    renders and build(upto) entry points); only = a single stage. Returns the warnings."""
    blocks, stage_of, log = compute(spec, edition=edition)
    keep = None
    if only: keep = {only}
    elif upto: keep = set(STAGES[:STAGES.index(upto) + 1])
    ox, oy, oz = offset
    for (x, y, z), (n, q) in blocks.items():
        if keep is not None and stage_of.get((x, y, z), "shapes") not in keep: continue
        bn, bq = to_bp(n, q)
        bp.cells[(x + ox, y + oy, z + oz)] = (bn, bq)
    return log
