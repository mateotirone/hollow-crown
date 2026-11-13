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

Stages, in order: shapes, foundation, frame, floors, walls, openings, roof, details, interior, place, light.
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
import emit, lighting, parts  # noqa: E402

STAGES = ["shapes", "foundation", "frame", "floors", "walls", "openings", "roof", "details", "interior", "place", "light"]


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
        forms = mats.define(v["mat"]).get("forms") or {}
        if k in forms or (k == "post" and "wall" in forms):    # a material can name its own partial blocks
            fb = forms.get(k) or forms["wall"]
            if k in ("full", "post"): p.pop("axis", None)
            if k != "full" or "axis" not in fb: out[(x, y, z)] = (fb, p); continue
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
    if spec.get("ruin"): ruin(blocks, spec["ruin"], log)
    check_water(blocks, log)
    light_stage(spec, blocks, stage_of, log)
    emit.connect(blocks)
    return blocks, stage_of, log


def light_stage(spec, blocks, stage_of, log):
    """Mateo 2026-11-13 ("light all the builds"): every build is lit at night. lighting.py adds lanterns until every
    room, door and yard the build lays reaches its light (house rules, "Every build is lit"). "light": false opts a
    spec out (a deliberately dark crypt); a dict changes the targets; a Hollow style gets soul light."""
    opt = spec.get("light", True)
    if opt is False or not blocks or spec.get("ruin"): return     # a ruin stays dark: its lanterns are long gone
    styles = [str(p.get("style", "")) for p in spec.get("parts", [])]
    kind = spec.get("light_kind") or ("hollow" if any(s.startswith("hollow") for s in styles) else None)
    lighting.light(blocks, targets=opt if isinstance(opt, dict) else None, log=log, stage_of=stage_of, kind=kind)


AGE = {   # what time does to a block in a ruin: (share swapped, to)
    "stone_bricks": (0.45, ["mossy_stone_bricks", "cracked_stone_bricks"]), "cobblestone": (0.4, ["mossy_cobblestone"]),
    "stone_brick_stairs": (0.35, ["mossy_stone_brick_stairs"]), "stone_brick_slab": (0.35, ["mossy_stone_brick_slab"]),
    "cobblestone_stairs": (0.35, ["mossy_cobblestone_stairs"]), "cobblestone_slab": (0.35, ["mossy_cobblestone_slab"]),
    "stone_brick_wall": (0.35, ["mossy_stone_brick_wall"]), "cobblestone_wall": (0.35, ["mossy_cobblestone_wall"]),
    "deepslate_tiles": (0.4, ["cracked_deepslate_tiles"]), "deepslate_bricks": (0.4, ["cracked_deepslate_bricks"]),
    "polished_blackstone_bricks": (0.4, ["cracked_polished_blackstone_bricks"]), "nether_bricks": (0.4, ["cracked_nether_bricks"]),
}
GONE = ("glass", "door", "lantern", "torch", "bell", "chain", "carpet", "bed", "banner", "sign", "flower_pot", "campfire", "barrel",
        "chest", "bookshelf", "crafting", "furnace", "lectern", "candle", "painting", "item_frame")
ROT = ("planks", "_log", "stripped_", "_wood", "fence", "trapdoor", "wool")
RUBBLE = ["cobblestone", "mossy_cobblestone", "cobblestone_slab", "mossy_cobblestone_slab", "gravel", "stone_brick_slab", "andesite", "moss_block"]


def ruin(blocks, opt, log=None):
    """Turn a finished build into its ruin (Mateo 2026-11-13, the air boat station: "ruins" and "restored" from
    one design). Build the restored spec, add "ruin": {...}, and this runs after resolve, before connections:
      cap:   [[x0, z0, x1, z1, top, jag], ...]  everything in the box above top + up to jag (noise) falls
      holes: share of wall blocks knocked out, in clumps (0.06)
      seed:  noise seed
    Then glass, doors, lanterns, bells and furniture go; timber and cloth mostly rot away; stone ages (AGE);
    what fell lies as rubble round the foot of the walls; and anything left hanging with no path to the ground
    is dropped too, so nothing floats (house rule)."""
    import random as _r
    rnd = _r.Random(opt.get("seed", 7))
    def h(x, z, k=0):
        n = (x * 73856093) ^ (z * 19349663) ^ (k * 83492791) ^ opt.get("seed", 7)
        return ((n * 2654435761) & 0xffffffff) / 0xffffffff
    def smooth(x, z, k):                                     # blocky value noise, 3-block cells
        return (h(x // 3, z // 3, k) * 2 + h(x // 2, z // 2, k + 1)) / 3
    ground = min(c[1] for c in blocks)
    fallen = 0
    for x0, z0, x1, z1, top, jag in opt.get("cap", []):
        for c in [c for c in blocks if x0 <= c[0] <= x1 and z0 <= c[2] <= z1]:
            if c[1] > top + int(smooth(c[0], c[2], 3) * (jag + 1)): del blocks[c]; fallen += 1
    hole = opt.get("holes", 0.06)
    seeds = [c for c in blocks if c[1] > ground + 3 and rnd.random() < hole / 9]
    for x, y, z in seeds:                                    # clumps, wider than tall, more near the top of a wall
        for dx in range(-1, 2):
            for dy in range(-1, 1 + (rnd.random() < 0.5)):
                for dz in range(-1, 2):
                    if blocks.pop((x + dx, y + dy, z + dz), None): fallen += 1
    for c, (n, p) in list(blocks.items()):
        if any(g in n for g in GONE): del blocks[c]; continue
        if any(g in n for g in ROT) and h(*c[::2], c[1]) < 0.55: del blocks[c]; fallen += 1; continue
        if "copper" in n and "oxidized" not in n:
            blocks[c] = (n.replace("exposed_", "").replace("weathered_", "").replace("waxed_", "waxed_oxidized_", 1) if n.startswith("waxed_") else n, p)
        a = AGE.get(n)
        if a and rnd.random() < a[0]: blocks[c] = (rnd.choice(a[1]), p)
    # nothing floats: keep only what joins the ground through faces
    keep, todo = set(), [c for c in blocks if c[1] <= ground + 1]
    keep.update(todo)
    while todo:
        x, y, z = todo.pop()
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            q = (x + d[0], y + d[1], z + d[2])
            if q in blocks and q not in keep: keep.add(q); todo.append(q)
    for c in [c for c in blocks if c not in keep]: del blocks[c]; fallen += 1
    # rubble at the foot of what stands: on the ground row, beside walls
    tops = {}
    for (x, y, z) in blocks: tops[(x, z)] = max(tops.get((x, z), -999), y)
    walls = [(x, z) for (x, z), t in tops.items() if t > ground + 4]
    for k in range(min(fallen // 6, 4000)):
        if not walls: break
        x, z = rnd.choice(walls)
        x += rnd.randint(-3, 3); z += rnd.randint(-3, 3)
        t = tops.get((x, z))
        if t is None or t > ground + 6: continue
        if (x, t + 1, z) not in blocks and (x, t, z) in blocks and not blocks[(x, t, z)][0].endswith("slab"):
            blocks[(x, t + 1, z)] = (rnd.choice(RUBBLE), {}); tops[(x, z)] = t + 1
    if log is not None: log.append(f"ruin: {fallen} blocks fell")
    return blocks


SPIRE_TOPS = ("siege:spire_roof",)
WATERS = ("water", "minecraft:water", "flowing_water", "minecraft:flowing_water")


def spilling_water(blocks):
    """Water that will run out of its basin in game: a water block with air, or nothing at all, beside it
    (n, s, e, w) or under it. A source block there flows up to 7 blocks across the floor (the Drowned Court's
    channels, 2026-11-12: water put at the walking row ran over the whole hall). Returns the cells."""
    out = []
    for (x, y, z), (n, _q) in blocks.items():
        if n not in WATERS: continue
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0)):
            b = blocks.get((x + dx, y + dy, z + dz))
            if b is None or b[0] in ("air", "minecraft:air"):
                out.append((x, y, z)); break
    return out


def check_water(blocks, log=None):
    """Warn about every water block that would spill (see spilling_water). Water sits a row below the floor
    it runs through, walled on four sides and floored, never at the row players stand on."""
    bad = spilling_water(blocks)
    if bad and log is not None:
        log.append(f"{len(bad)} water block(s) would spill out of their basin, first at {bad[0]}: "
                   "sink water a row into the floor and close every side and the bottom")
    return bad


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
    # vines, bells and buttons keep their logical "attach"/"facing", so bp.rotated turns them with the building and
    # bp.to_bedrock writes the states (as raw states they stayed put and a turned stamp hung them on air, 2026-11-13)
    if n == "vine": q.setdefault("attach", "n")
    if n in ("end_rod", "lightning_rod"): raw["facing_direction"] = 1
    if n == "bell": raw["attachment"] = "hanging"; q.setdefault("facing", "s")
    if n == "candle" or n.endswith("_candle"): raw["candles"] = max(0, int(q.pop("candles", 1)) - 1); raw["lit"] = bool(q.pop("lit", True))
    if n.endswith("_button"): q.setdefault("facing", "s")
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
