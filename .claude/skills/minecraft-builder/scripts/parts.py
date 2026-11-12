"""Building parts: the build-instructions/ stages as code.

Shapes give the massing (towers, domes, eggs, arches cut from walls). Parts give everything a builder
does by rule: plinth and steps, timber frame and jetties, floors, infill, doors with jambs, lintel and
canopy, windows with sills, heads, surrounds, shutters and leaf boxes, arches with the trapdoor-stair-
trapdoor round angle, roofs from a height field (verge, barge boards, eaves, corner blocks, ridge slab,
gable walls), Mateo's chimney, string courses, buttresses, hanging lanterns.

Every rule here cites the stage file it comes from (build-instructions/<stage>/README.md). Parts write
cells with a stage name so the builder can render the build stage by stage (build.py --stages).

Conventions: rect = [x0, z0, x1, z1] inclusive block indices; sides n (z0), s (z1), e (x1), w (x0);
"at" along a wall = offset from the wall's centre block, positive to the right as seen from outside.
Logical facing as in map/structures/bp.py: stairs face their tall side; trapdoors/doors Java-style.
"""
from materials import h3

DIRS = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}
LEFT = {"n": "w", "w": "s", "s": "e", "e": "n"}
RIGHT_OF = {"s": (1, 0), "n": (-1, 0), "e": (0, -1), "w": (0, 1)}       # observer's right when facing the wall from outside
ALONG_AXIS = {"n": "x", "s": "x", "e": "z", "w": "z"}

# Style presets: role -> material (a block id, a doctrine code, or a name from spec "materials").
# From map/structures/kit.py VALE + vale.py STYLES and build-instructions/palettes/vale.md.
STYLES = {
    "vale_timber": dict(plinth={"ladder": ["mossy_cobblestone", "cobblestone", "andesite"], "axis": "noise", "scale": 3},
                        frame="stripped_spruce_log", infill="calcite", floor="spruce_planks", trim="dark_oak_planks",
                        roof={"ladder": "VAL-06", "axis": "y", "reverse": True, "jitter": 0.04}, shutter="spruce_planks",
                        door="spruce_door", glass="brown_stained_glass_pane", leaves="azalea_leaves", sign_wood="dark_oak",
                        chimney="stone_bricks", quoin="polished_andesite", stone="VAL-01", frame_kind="flush", sill="leafbox"),
    "vale_stone": dict(plinth={"ladder": ["mossy_cobblestone", "cobblestone", "andesite"], "axis": "noise", "scale": 3},
                       frame="stone_bricks", infill={"ladder": "VAL-01", "axis": "y"}, floor="spruce_planks", trim="dark_oak_planks",
                       roof={"ladder": "VAL-06", "axis": "y", "reverse": True, "jitter": 0.04}, shutter="dark_oak_planks",
                       door="spruce_door", glass="gray_stained_glass_pane", leaves="azalea_leaves", sign_wood="spruce",
                       chimney="stone_bricks", quoin="polished_andesite", stone="stone_bricks", frame_kind="stone", sill="stair"),
    "vale_brick": dict(plinth={"ladder": ["mossy_cobblestone", "cobblestone", "andesite"], "axis": "noise", "scale": 3},
                       frame="stripped_spruce_log", infill={"ladder": ["mud_bricks", "brick_block"], "axis": "noise", "scale": 3},
                       floor="spruce_planks", trim="spruce_planks", roof={"ladder": ["dark_oak_planks", "spruce_planks"], "axis": "y", "reverse": True},
                       shutter="spruce_planks", door="spruce_door", glass="brown_stained_glass_pane", leaves="azalea_leaves",
                       sign_wood="spruce", chimney="stone_bricks", quoin="polished_andesite", stone="VAL-01", frame_kind="flush", sill="leafbox"),
    # the other regions (regions/<region>.md says when to use each; roof pitch and type stay in the spec)
    "frost_timber": dict(plinth={"ladder": "FRO-01", "axis": "noise", "scale": 3}, frame="dark_oak_log",
                         infill="spruce_planks", floor="spruce_planks",
                         trim="dark_oak_planks", roof={"block": "dark_oak_planks"}, shutter="dark_oak_planks", door="dark_oak_door",
                         glass="white_stained_glass_pane", leaves="spruce_leaves", sign_wood="dark_oak", chimney="deepslate_bricks",
                         quoin="polished_deepslate", stone="FRO-01", frame_kind="flush", sill="stair"),
    "frost_stone": dict(plinth={"ladder": "FRO-01", "axis": "noise", "scale": 3}, frame="deepslate_bricks", infill={"ladder": "FRO-01", "axis": "y"},
                        floor="spruce_planks", trim="dark_oak_planks", roof={"block": "dark_oak_planks"}, shutter="dark_oak_planks",
                        door="dark_oak_door", glass="light_blue_stained_glass_pane", leaves="spruce_leaves", sign_wood="dark_oak",
                        chimney="deepslate_bricks", quoin="polished_deepslate", stone="deepslate_bricks", frame_kind="stone", sill="stair"),
    "salt_timber": dict(plinth={"ladder": "SAL-05", "axis": "noise", "scale": 3}, frame="stripped_birch_log", infill="calcite",
                        floor="birch_planks", trim="birch_planks", roof={"block": "dark_prismarine"}, shutter="warped_planks",
                        door="birch_door", glass="light_blue_stained_glass_pane", leaves="azalea_leaves", sign_wood="birch",
                        chimney="brick_block", quoin="cut_sandstone", stone="smooth_sandstone", frame_kind="flush", sill="stair"),
    "salt_stone": dict(plinth={"ladder": "SAL-05", "axis": "noise", "scale": 3}, frame="smooth_sandstone",
                       infill={"ladder": ["sandstone", "smooth_sandstone"], "axis": "y"}, floor="birch_planks", trim="birch_planks",
                       roof={"block": "dark_prismarine"}, shutter="warped_planks", door="birch_door", glass="cyan_stained_glass_pane",
                       leaves="azalea_leaves", sign_wood="birch", chimney="brick_block", quoin="cut_sandstone", stone="smooth_sandstone",
                       frame_kind="stone", sill="stair"),
    "fen_timber": dict(plinth={"ladder": ["mud_bricks", "tuff_bricks"], "axis": "noise", "scale": 3}, frame="mangrove_log",
                       infill={"ladder": ["packed_mud", "mud_bricks"], "axis": "y"}, floor="dark_oak_planks", trim="spruce_planks",
                       roof={"block": "dark_oak_planks"}, shutter="mangrove_planks", door="mangrove_door", glass="brown_stained_glass_pane",
                       leaves="mangrove_leaves", sign_wood="mangrove", chimney="mud_bricks", quoin="tuff_bricks", stone="mud_bricks",
                       frame_kind="proud", sill="stair"),
    "ember_sandstone": dict(plinth={"block": "sandstone"}, frame="cut_sandstone", infill={"ladder": "EMB-01", "axis": "y"},
                            floor="acacia_planks", trim="acacia_planks", roof={"block": "smooth_red_sandstone"}, shutter="acacia_planks",
                            door="acacia_door", glass="orange_stained_glass_pane", leaves="jungle_leaves", sign_wood="acacia",
                            chimney="sandstone", quoin="cut_sandstone", stone="smooth_sandstone", frame_kind="stone", sill="stair"),
    "hollow_timber": dict(plinth={"ladder": ["cobbled_deepslate", "polished_blackstone_bricks"], "axis": "noise", "scale": 3},
                          frame="dark_oak_log", infill="siege:pale_ash", floor="dark_oak_planks", trim="dark_oak_planks",
                          roof={"ladder": ["cobbled_deepslate", "deepslate_tiles"], "axis": "y"}, shutter="dark_oak_planks",
                          door="dark_oak_door", glass="iron_bars", leaves="azalea_leaves", sign_wood="dark_oak",
                          chimney="polished_blackstone_bricks", quoin="polished_blackstone", stone="polished_blackstone_bricks",
                          frame_kind="flush", sill="stair"),
}
WOOD_OF = lambda b: next((w for w in ("dark_oak", "pale_oak", "spruce", "birch", "jungle", "acacia", "mangrove", "cherry", "poplar", "bamboo",
                                      "crimson", "warped", "oak") if b.startswith(w) or b.startswith("stripped_" + w)), "spruce")


class Context:
    def __init__(self, cells, stage_of, log, spec):
        self.cells, self.stage_of, self.log, self.spec = cells, stage_of, log, spec
        self.spec.setdefault("materials", {})
        self.n = 0
        self.roofs = []          # height fields registered by roof parts, built together at the end of each house
        self.info = {"houses": []}   # layout for code that adds to a build (engine.layout)

    # ---- cells
    def set(self, x, y, z, stage, kind=None, mat=None, raw=None, **p):
        if raw: self.cells[(x, y, z)] = {"kind": "raw", "name": raw, "props": p}
        else: self.cells[(x, y, z)] = {"kind": kind, "mat": mat, "props": p}
        self.stage_of[(x, y, z)] = stage

    def setif(self, x, y, z, *a, **k):
        if (x, y, z) not in self.cells: self.set(x, y, z, *a, **k); return True
        return False

    def clear(self, x, y, z):
        self.cells.pop((x, y, z), None); self.stage_of.pop((x, y, z), None)

    def get(self, x, y, z): return self.cells.get((x, y, z))

    def free(self, x, y, z): return (x, y, z) not in self.cells

    def mat(self, style, role):
        """Register the style's material for a role and return its name."""
        v = style[role]
        if isinstance(v, str) and (v in self.spec["materials"]): return v
        name = f"{style['_name']}.{role}"
        self.spec["materials"].setdefault(name, v)
        return name


def wall_cell(rect, side, t):
    """(x, z) of the wall cell at offset t from the centre of `side` (positive = observer's right)."""
    x0, z0, x1, z1 = rect
    cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
    rx, rz = RIGHT_OF[side]
    if side == "s": return cx + t * rx, z1
    if side == "n": return cx + t * rx, z0
    if side == "e": return x1, cz + t * rz
    return x0, cz + t * rz


def side_len(rect, side):
    x0, z0, x1, z1 = rect
    return (x1 - x0 + 1) if side in "ns" else (z1 - z0 + 1)


def odd_posts(L, bay=3):
    """Post offsets from the centre along a wall of L cells (corners included) with odd bays of `bay`
    or bay+2 (build-instructions/02-frame: bays of 3 or 5). Returns sorted offsets."""
    if L % 2 == 0: return [-(L // 2), L // 2 - 1]
    half = L // 2
    best = None
    for n in range(1, L):
        span = L - 1 - (n - 1)            # cells left for bays if there are n bays (n+1 posts, n-1 inner)
        if span <= 0: break
        for big in range(n + 1):           # `big` bays of bay+2, the rest of bay
            if (n - big) * bay + big * (bay + 2) + (n + 1) == L:
                if n % 2 == 1 or big % 2 == 0:
                    score = abs(big - n / 2) * 0.1 + (0 if bay >= 3 else 9)
                    if best is None or score < best[0]: best = (score, n, big)
    if best is None:
        return [-half, half]
    _, n, big = best
    sizes = [bay] * n
    # big bays in the middle, symmetric
    order = sorted(range(n), key=lambda i: abs(i - (n - 1) / 2))
    k = 0
    for i in order:
        if k >= big: break
        sizes[i] = bay + 2; k += 1
    pos = [-half]
    for s in sizes: pos.append(pos[-1] + s + 1)
    return pos


def bay_centres(posts):
    return [(a + b) // 2 for a, b in zip(posts, posts[1:])], [b - a - 1 for a, b in zip(posts, posts[1:])]


def corner_stair(fa, fb):
    """Outer-corner stair at the diagonal cell outside a building corner between faces fa, fb, tall
    quadrant towards the building (build-instructions/07-detailing: courses wrap corners)."""
    f = OPP[fa]; g = OPP[fb]
    return f, ("outer_left" if g == LEFT[f] else "outer_right")


# ------------------------------------------------------------------ openings (05-windows-and-doors)
def door(ctx, rect, side, t, floor, style, kind="house", canopy=True, steps=0, frame_kind="flush"):
    x, z = wall_cell(rect, side, t)
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    trim, frame = ctx.mat(style, "trim"), ctx.mat(style, "frame")
    dwood = style["door"].replace("_door", "")
    ax = ALONG_AXIS[side]
    jamb_mat = frame if frame_kind != "stone" else ctx.mat(style, "quoin")
    S = "openings"
    def at(k, dy, out=0): return x + rx * k + ox * out, floor + dy, z + rz * k + oz * out
    if kind == "large":       # 3 x 3 opening reading as one big plank door (Mateo, 2026-11-11)
        for k in (-1, 0, 1):
            for dy in (1, 2, 3): ctx.clear(*at(k, dy))
        for k in (-1, 0, 1):
            for dy in (1, 2, 3):
                if k == 0 and dy < 3: continue
                ctx.set(*at(k, dy), S, "trapdoor", f"{dwood}_planks", open=True, facing=OPP[side])
        width = 3
    elif kind == "grand":     # 5 wide: jamb, 3-wide opening under an arch, jamb
        for k in (-1, 0, 1):
            for dy in (1, 2, 3): ctx.clear(*at(k, dy))
        for k in (-2, 2):
            for dy in (1, 2, 3): ctx.set(*at(k, dy), S, "full", jamb_mat, axis="y")
            ctx.set(*at(k, 4), S, "full", jamb_mat, axis=ax)
        for k in (-1, 1):
            for dy in (1, 2): ctx.set(*at(k, dy), S, "full", trim)
            ctx.set(*at(k, 3), S, "stairs", trim, half="top", facing=_dir_of(-rx, -rz) if k < 0 else _dir_of(rx, rz))
        ctx.set(*at(0, 3), S, raw=style["glass"])
        ctx.set(*at(0, 4), S, "full", jamb_mat, axis=ax)
        for k in (-1, 1): ctx.set(*at(k, 4), S, "full", jamb_mat, axis=ax)
        width = 5
    else:                     # house doorway: jamb, door, jamb, lintel across all 3
        for k in (-1, 1):
            for dy in (1, 2): ctx.set(*at(k, dy), S, "full", jamb_mat, axis="y")
        for k in (-1, 0, 1): ctx.set(*at(k, 3), S, "full", jamb_mat, axis=ax)
        width = 3
    ctx.set(*at(0, 1), S, raw=style["door"], facing=side, hinge=False)
    ctx.set(*at(0, 2), S, raw=style["door"], facing=side, hinge=False, upper=True)
    if canopy and kind == "house":   # trim stairs at lintel + 1, brackets under the ends (05: canopy OR lanterns, not both)
        for k in (-1, 0, 1): ctx.set(*at(k, 4, 1), S, "stairs", trim, facing=OPP[side], half="bottom")
        for k in (-1, 1): ctx.set(*at(k, 3, 1), S, "stairs", trim, facing=OPP[side], half="top")
    elif canopy == "lanterns":
        for k in (-1, 1): ctx.set(*at(k, 3, 1), "details", raw="lantern", hanging=False)
    # entrance steps (01-foundation step 5): one per block of floor height, as wide as the doorway
    plinth = ctx.mat(style, "plinth")
    for s_ in range(steps):
        row = floor - s_            # the top step sits one below the floor, against the wall
        for k in range(-(width // 2), width // 2 + 1):
            px, py, pz = at(k, 0, s_ + 1); py = row
            ctx.set(px, py, pz, "foundation", "stairs", plinth, facing=OPP[side], half="bottom")
            for yy in range(floor - steps + 1, py): ctx.set(px, yy, pz, "foundation", "full", plinth)
    return width


def _dir_of(dx, dz):
    return {(1, 0): "e", (-1, 0): "w", (0, 1): "s", (0, -1): "n"}[(dx, dz)]


def window(ctx, rect, side, t, floor, style, w=1, h=2, head_room=9, frame_kind="flush", shutters=False, sill=None, seed=0):
    # sill: leafbox | stair | slab | planter | none
    """Glass flush with the wall face (05: never recessed); sill wider than the glass; head; surround or shutters."""
    x, z = wall_cell(rect, side, t)
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    trim = ctx.mat(style, "trim")
    S = "openings"
    sill = sill or style.get("sill", "leafbox")
    def at(k, dy, out=0): return x + rx * k + ox * out, floor + dy, z + rz * k + oz * out
    ks = range(-(w // 2), w // 2 + 1)
    for k in ks:
        for dy in range(2, 2 + h): ctx.set(*at(k, dy), S, raw=style["glass"])
    top = 2 + h
    # head (05: timber: the beam is the head unless it is more than 2 above; stone: upside-down stair, facing out)
    if frame_kind == "stone":
        for k in ks: ctx.set(*at(k, top), S, "stairs", ctx.mat(style, "infill"), facing=side, half="top")
    elif head_room > 2:
        for k in range(-(w // 2) - 1, w // 2 + 2): ctx.set(*at(k, top, 1), S, "slab", trim, half="top")
    # sides: shutters on some windows, a trapdoor surround on stone, none on proud frames
    if shutters:
        one = h3(x, floor, z, seed + 3) < 0.25          # a single shutter now and then (05: shutter dressing)
        for k in ((-(w // 2) - 1,) if one else (-(w // 2) - 1, w // 2 + 1)):
            for dy in range(2, 2 + h): ctx.set(*at(k, dy, 1), S, "trapdoor", ctx.mat(style, "shutter"), open=True, facing=side)
        for k in ks: ctx.set(*at(k, 1, 1), S, "slab", trim, half="top")            # the shelf
        if h3(x, floor, z, seed + 9) < 0.34: ctx.set(*at(0, 2, 1), "details", raw="lantern")
        return
    if frame_kind == "stone":   # dark oak panels either side (05: stone, dark oak, spruce)
        for k in (-(w // 2) - 1, w // 2 + 1):
            for dy in range(2, 2 + h): ctx.set(*at(k, dy, 1), S, "trapdoor", "dark_oak_planks", open=True, facing=side)
    # sill
    if sill == "leafbox":     # leaves boxed in by wall signs (05: window boxes, Mateo 2026-11-11)
        sw = style.get("sign_wood", "dark_oak")
        for k in ks:
            leaf = style["leaves"] + ("_flowered" if style["leaves"] == "azalea_leaves" and h3(*at(k, 1, 1), seed) < 0.3 else "")
            ctx.set(*at(k, 1, 1), S, raw=leaf)
            if side in style.get("box_signs", "nsew"): ctx.setif(*at(k, 1, 2), S, raw=f"{sw}_wall_sign", facing=side)
        lk, rk = -(w // 2) - 1, w // 2 + 1
        ctx.setif(*at(lk, 1, 1), S, raw=f"{sw}_wall_sign", facing=_dir_of(-rx, -rz))
        ctx.setif(*at(rk, 1, 1), S, raw=f"{sw}_wall_sign", facing=_dir_of(rx, rz))
    elif sill == "stair":     # right-way stair, tall side to the wall, one wider each side with slab ends
        for k in ks: ctx.set(*at(k, 1, 1), S, "stairs", trim if frame_kind != "stone" else ctx.mat(style, "infill"), facing=OPP[side], half="bottom")
        for k in (-(w // 2) - 1, w // 2 + 1): ctx.setif(*at(k, 1, 1), S, "slab", trim if frame_kind != "stone" else ctx.mat(style, "infill"), half="bottom")
    elif sill == "slab":
        for k in range(-(w // 2) - 1, w // 2 + 2): ctx.set(*at(k, 1, 1), S, "slab", trim, half="top")
    elif sill == "planter":   # 05 planters: a box of open trapdoors one out from the wall, flowers on dirt inside
        sh = ctx.mat(style, "shutter")
        flowers = style.get("flowers", ["poppy", "cornflower", "oxeye_daisy", "allium"])
        for k in ks:
            ctx.set(*at(k, 1, 1), S, raw="dirt")
            ctx.set(*at(k, 2, 1), "details", raw=flowers[int(h3(*at(k, 2, 1), seed + 5) * len(flowers)) % len(flowers)])
            ctx.setif(*at(k, 1, 2), S, "trapdoor", sh, open=True, facing=side)
        ctx.setif(*at(-(w // 2) - 1, 1, 1), S, "trapdoor", sh, open=True, facing=_dir_of(-rx, -rz))
        ctx.setif(*at(w // 2 + 1, 1, 1), S, "trapdoor", sh, open=True, facing=_dir_of(rx, rz))


def arch(ctx, spec):
    """An opening with an arched head (reference/shapes.md). at = bottom centre of the opening, axis =
    the direction the wall runs, width 3/5/7, height, style round_angle | stairs | trapdoor | slab_stair_slab."""
    x, y, z = spec["at"]; ax = spec.get("axis", "x"); w = spec.get("width", 3); h = spec.get("height", 4)
    d = spec.get("depth", 1); style = spec.get("style", "round_angle")
    mat = spec.get("material", "stone_bricks"); trim = spec.get("trim", "dark_oak_planks")
    S = spec.get("stage", "openings")
    ux, uz = (1, 0) if ax == "x" else (0, 1)
    nx, nz = (0, 1) if ax == "x" else (1, 0)
    lo_d, hi_d = -(d // 2), d - d // 2 - 1
    hw = w // 2
    def P(k, dy, dd): return x + ux * k + nx * dd, y + dy, z + uz * k + nz * dd
    left, right = _dir_of(-ux, -uz), _dir_of(ux, uz)
    for dd in range(lo_d, hi_d + 1):
        for k in range(-hw, hw + 1):
            for dy in range(h): ctx.clear(*P(k, dy, dd))
        top = h - 1
        if style == "stairs":         # u< (St ...) . (... St) u>, second pair one row down on tall openings
            ctx.set(*P(-hw, top, dd), S, "stairs", mat, facing=left, half="top"); ctx.set(*P(hw, top, dd), S, "stairs", mat, facing=right, half="top")
            if hw >= 2:
                ctx.set(*P(-hw + 1, top, dd), S, "slab", mat, half="top"); ctx.set(*P(hw - 1, top, dd), S, "slab", mat, half="top")
            if w >= 5 and h >= 5:
                ctx.set(*P(-hw, top - 1, dd), S, "stairs", mat, facing=left, half="top"); ctx.set(*P(hw, top - 1, dd), S, "stairs", mat, facing=right, half="top")
        elif style == "trapdoor":
            ctx.set(*P(-hw, top, dd), S, "trapdoor", trim, half="top"); ctx.set(*P(hw, top, dd), S, "trapdoor", trim, half="top")
        elif style == "slab_stair_slab":
            ctx.set(*P(0, h, dd), S, "stairs", mat, facing=_dir_of(nx, nz) if dd == hi_d else _dir_of(-nx, -nz), half="top")
            ctx.set(*P(-1, h, dd), S, "slab", mat, half="top"); ctx.set(*P(1, h, dd), S, "slab", mat, half="top")
        else:                          # round angle: open trapdoor on the jamb, stair in the corner, top trapdoor beside it
            steps = max(1, (hw + 1) // 2) if w > 3 else 1
            for s_ in range(steps):
                kL, kR, row = -hw + s_, hw - s_, top - (steps - 1 - s_)
                ctx.set(*P(kL, row, dd), S, "stairs", mat, facing=left, half="top")
                ctx.set(*P(kR, row, dd), S, "stairs", mat, facing=right, half="top")
                if row - 1 >= 0:
                    ctx.set(*P(kL, row - 1, dd), S, "trapdoor", trim, open=True, facing=right)     # panel against the jamb side
                    ctx.set(*P(kR, row - 1, dd), S, "trapdoor", trim, open=True, facing=left)
                if w > 3 and kL + 1 < kR - 1:
                    ctx.set(*P(kL + 1, row, dd), S, "trapdoor", trim, half="top"); ctx.set(*P(kR - 1, row, dd), S, "trapdoor", trim, half="top")


# ------------------------------------------------------------------ roofs (06-roof)
def roof_field(rect, kind, ridge, overhang, verge, pitch, base):
    """-> {(x, z): (row, d, dmax)} for one roof. row = the row of the roof surface block at that cell."""
    x0, z0, x1, z1 = rect
    if ridge is None: ridge = "x" if (x1 - x0) >= (z1 - z0) else "z"
    F = {}
    gx0, gx1, gz0, gz1 = x0, x1, z0, z1
    if kind == "hip": gx0, gx1, gz0, gz1 = x0 - overhang, x1 + overhang, z0 - overhang, z1 + overhang
    elif ridge == "x": gx0, gx1, gz0, gz1 = x0 - verge, x1 + verge, z0 - overhang, z1 + overhang
    else: gx0, gx1, gz0, gz1 = x0 - overhang, x1 + overhang, z0 - verge, z1 + verge
    for x in range(gx0, gx1 + 1):
        for z in range(gz0, gz1 + 1):
            if kind == "hip": d = min(x - gx0, gx1 - x, z - gz0, gz1 - z); dmax = min(gx1 - gx0, gz1 - gz0) // 2
            elif ridge == "x": d = min(z - gz0, gz1 - z); dmax = (gz1 - gz0) // 2
            else: d = min(x - gx0, gx1 - x); dmax = (gx1 - gx0) // 2
            F[(x, z)] = (base + d * pitch, d, dmax)
    return F, ridge


def build_roofs(ctx, roofs, style, chimneys=()):
    """Combine every roof's height field (higher roof wins, 06 'connecting roofs') and place the surface:
    stairs facing uphill, inner corners in valleys, outer corners on hips, a full block on the ridge capped
    with back-to-back stairs (Mateo 2026-11-12; style "ridge_cap": "slab" for the old slab row), verge stairs with a barge board under, an eave row, a trim block at each verge corner."""
    if not roofs: return
    H, info = {}, {}
    for F, r in roofs:
        if r["kind"] == "flat": continue          # flat roofs are laid by _flat_roof
        for c, (row, d, dmax) in F.items():
            if c not in H or row > H[c]: H[c] = row; info[c] = (r, d, dmax)
    S = "roof"
    trim = ctx.mat(style, "trim")
    for (x, z), row in H.items():
        r, d, dmax = info[(x, z)]
        mat = r["mat"]; pitch = r["pitch"]
        hi = [f for f, (dx, dz) in DIRS.items() if H.get((x + dx, z + dz), -99) > row]
        if (x, z) in chimneys: continue
        if not hi:
            diag = [(dx, dz) for dx in (-1, 1) for dz in (-1, 1) if H.get((x + dx, z + dz), -99) > row]
            if diag:     # hip edge: outer corner towards the higher diagonal
                dx, dz = diag[0]; f = _dir_of(0, dz); g = _dir_of(dx, 0)
                ctx.set(x, row, z, S, "stairs", mat, facing=f, half="bottom", corner="outer_left" if g == LEFT[f] else "outer_right")
            else:        # ridge: full block with a bottom slab on top (06 step 3)
                ctx.set(x, row, z, S, "full", mat)
                if r.get("ridge_cap", style.get("ridge_cap", "stairs")) == "slab":
                    ctx.set(x, row + 1, z, S, "slab", r.get("cap", mat), half="bottom")
                else:    # back-to-back stairs along the spine (Mateo 2026-11-12): pairs with their tall backs touching
                    along = x if r["ridge"] == "x" else z
                    f = ("e" if along % 2 == 0 else "w") if r["ridge"] == "x" else ("s" if along % 2 == 0 else "n")
                    for g in (("n", "s") if r["ridge"] == "x" else ("w", "e")):   # two-row ridge: the pair sits across
                        dx, dz = DIRS[g]
                        if H.get((x + dx, z + dz)) == row: f = g
                    ctx.set(x, row + 1, z, S, "stairs", r.get("cap", mat), facing=f, half="bottom")
                if pitch == 2: ctx.set(x, row - 1, z, S, "full", mat)
            continue
        f = hi[0]
        corner = "none"
        if len(hi) >= 2:
            g = hi[1] if hi[1] != OPP[f] else (hi[2] if len(hi) > 2 else None)
            if g: corner = "inner_left" if g == LEFT[f] else "inner_right"
        ctx.set(x, row, z, S, "stairs", mat, facing=f, half="bottom", corner=corner)
        for k in range(1, pitch):    # steeper than a stair: full roof blocks under it
            ctx.set(x, row - k, z, S, "full", mat)
    # edges open to the sky: barge boards under verge stairs, eave row under the overhang, corner blocks
    for F, r in roofs:
        if r["kind"] == "flat": continue
        x0, z0, x1, z1 = r["rect"]; ridge = r["ridge"]; P = r["base"]
        edge = r.get("edge", "full")         # dormers: none (small roofs read cleaner bare); porches: barge only
        if edge == "none": continue
        for (x, z) in F:
            if H.get((x, z)) != F[(x, z)][0]: continue          # covered by a higher roof
            row = H[(x, z)]
            if r["kind"] == "gable":
                gable_end = (ridge == "x" and (x < x0 or x > x1)) or (ridge == "z" and (z < z0 or z > z1))
                if gable_end:
                    up = [f for f, (dx, dz) in DIRS.items() if H.get((x + dx, z + dz), -99) > row]
                    if up: ctx.setif(x, row - r["pitch"], z, S, "stairs", trim, facing=OPP[up[0]], half="top")
                    else: ctx.setif(x, row - 1, z, S, "full", trim)
            eave = F[(x, z)][1] == 0 and edge == "full"
            if eave:
                inside = (x0 <= x <= x1) and (z0 <= z <= z1)
                if not inside:
                    up = [f for f, (dx, dz) in DIRS.items() if H.get((x + dx, z + dz), -99) > row]
                    corner_cell = r["kind"] == "gable" and ((ridge == "x" and (x < x0 or x > x1)) or (ridge == "z" and (z < z0 or z > z1)))
                    if corner_cell: ctx.set(x, row - 1, z, S, "full", trim)      # Mateo's corner block (06 step 5)
                    elif up: ctx.setif(x, row - 1, z, S, "stairs", trim, facing=up[0], half="top")
    return H


def gable_walls(ctx, r, H, style, frame_kind):
    """Fill the gable triangles under the roof (06 step 6): posts on the centre line, infill between,
    an attic window on the centre line when there is room."""
    x0, z0, x1, z1 = r["rect"]; ridge = r["ridge"]; P = r["base"]
    if r["kind"] != "gable": return
    ends = (("w", [(x0, z) for z in range(z0, z1 + 1)]), ("e", [(x1, z) for z in range(z0, z1 + 1)])) if ridge == "x" else \
           (("n", [(x, z0) for x in range(x0, x1 + 1)]), ("s", [(x, z1) for x in range(x0, x1 + 1)]))
    infill = ctx.mat(style, "infill"); frame = ctx.mat(style, "frame")
    for side, cells in ends:
        mid = cells[len(cells) // 2]
        own = r.get("_F", {})
        for (x, z) in cells:
            for y in range(P, min(H.get((x, z), P), own.get((x, z), (99999,))[0])):
                if not ctx.free(x, y, z) and ctx.get(x, y, z)["kind"] != "air": continue
                centre = (x, z) == mid
                if frame_kind != "stone" and centre: ctx.set(x, y, z, "roof", "full", frame, axis="y")
                else: ctx.set(x, y, z, "roof", "full", infill if frame_kind != "stone" else ctx.mat(style, "infill"))
        top = H.get(mid, P)
        if top - P >= 5:
            for y in (P + 2, P + 3): ctx.set(mid[0], y, mid[1], "roof", raw=style["glass"])


def chimney(ctx, x, z, base, H, style):
    """Mateo's chimney (06 step 9): stone column 2 above the roof, wall signs round the last stone, a
    campfire with open trapdoors on all four sides, a flower pot on top."""
    top = max(H.get((x + dx, z + dz), base) for dx in (-1, 0, 1) for dz in (-1, 0, 1)) + 2
    st = ctx.mat(style, "chimney"); sw = style.get("sign_wood", "dark_oak"); trim = ctx.mat(style, "trim")
    for y in range(base, top + 1): ctx.set(x, y, z, "roof", "full", st)
    for f, (dx, dz) in DIRS.items():
        ctx.set(x + dx, top, z + dz, "roof", raw=f"{sw}_wall_sign", facing=f)
        ctx.set(x + dx, top + 1, z + dz, "roof", "trapdoor", trim, open=True, facing=f)
    ctx.set(x, top + 1, z, "roof", raw="campfire")
    ctx.set(x, top + 2, z, "roof", raw="flower_pot")


# ------------------------------------------------------------------ the whole building
def _style(ctx, s, parent=None):
    if parent is not None and "style" not in s: st = dict(parent)
    else:
        st = dict(STYLES[s.get("style", "vale_timber")] if isinstance(s.get("style", "vale_timber"), str) else {})
        if isinstance(s.get("style"), dict): st.update(STYLES.get(s["style"].get("base", "vale_timber"), {})); st.update(s["style"])
    st.update(s.get("materials", {}))
    st["_name"] = s.get("name", parent["_name"] if parent else f"house{ctx.n}")
    if parent is None: ctx.n += 1
    return st


def _body(ctx, s, st):
    """Stages 1 to 5 for one block of a building: foundation, frame, floors, walls, openings."""
    rect = list(s["rect"]); y = s.get("y", 0)
    W, D = rect[2] - rect[0] + 1, rect[3] - rect[1] + 1
    if W % 2 == 0 or D % 2 == 0: ctx.log.append(f"{st['_name']}: footprint {W}x{D} has an even side; build-instructions want odd (work in threes)")
    plinth = s.get("plinth", 1); storeys = s.get("storeys", [5]); jetty = s.get("jetty", [])
    fk = s.get("frame", st.get("frame_kind", "flush"))
    bay = s.get("bay", 3)
    if len(jetty) % 2 or (jetty and not (set(jetty) in ({"n", "s"}, {"e", "w"}, {"n", "s", "e", "w"}))):
        ctx.log.append(f"{st['_name']}: jetties go in pairs (front and back, or both sides) so walls stay odd (02-frame step 5)")
    M = lambda role: ctx.mat(st, role)
    # ---- 1 foundation: plinth course(s) round the footprint, floor layer inside (01-foundation)
    for yy in range(y, y + plinth):
        for x in range(rect[0], rect[2] + 1):
            for z in range(rect[1], rect[3] + 1):
                edge = x in (rect[0], rect[2]) or z in (rect[1], rect[3])
                if edge or yy == y + plinth - 1:
                    ctx.set(x, yy, z, "foundation", "full", M("plinth") if edge else M("floor"))
                    if not edge: ctx.stage_of[(x, yy, z)] = "floors"
    # ---- storeys
    floors, rects = [], []
    f = y + plinth - 1; r = list(rect)
    for i, h in enumerate(storeys):
        if i > 0:
            for sd in jetty:
                dx, dz = DIRS[sd]
                if dx < 0: r[0] -= 1
                if dx > 0: r[2] += 1
                if dz < 0: r[1] -= 1
                if dz > 0: r[3] += 1
        floors.append(f); rects.append(list(r)); f += h
    plate = floors[-1] + storeys[-1] - 1
    posts_of = {}
    base_M, base_fk, fk_of = M, fk, []
    sov = s.get("storey_style", [])
    for i, (fl, rr, h) in enumerate(zip(floors, rects, storeys)):
        x0, z0, x1, z1 = rr
        ov = sov[i] if i < len(sov) and sov[i] else {}
        if ov:      # this storey in its own materials (a stone ground floor under a timber upper, 02-frame)
            sst = dict(st); sst.update({k: v for k, v in ov.items() if k != "frame_kind"}); sst["_name"] = f"{st['_name']}.s{i}"
            M = (lambda sst: (lambda role: ctx.mat(sst, role)))(sst); fk = ov.get("frame_kind", base_fk)
        else: M, fk = base_M, base_fk
        fk_of.append(fk)
        # ---- 3 floors: the floor layer (upper floors; ground floor done with the plinth)
        if i > 0:
            for x in range(x0 + 1, x1):
                for z in range(z0 + 1, z1): ctx.set(x, fl, z, "floors", "full", M("floor"))
        for sd in "nsew":
            L = side_len(rr, sd)
            posts = odd_posts(L, bay); posts_of[(i, sd)] = posts
            ax = ALONG_AXIS[sd]
            for t in range(-(L // 2), L // 2 + 1):
                x, z = wall_cell(rr, sd, t)
                corner = t in (-(L // 2), L // 2)
                for yy in range(fl if i > 0 else fl + 1, fl + h):
                    beam = (i > 0 and yy == fl) or (i == len(storeys) - 1 and yy == plate)
                    if fk == "stone":
                        if corner:   # quoins: alternate the quoin block every course (02-frame step 1)
                            ctx.set(x, yy, z, "frame", "full", M("quoin") if (yy // 1) % 2 == 0 else M("infill"))
                        else:
                            ctx.set(x, yy, z, "walls", "full", M("infill"))
                        continue
                    if fk == "piers" and corner:     # stone corner piers, timber posts and logs between
                        ctx.set(x, yy, z, "frame", "full", M("pier") if "pier" in (ov or st) else M("quoin"))
                    elif corner or t in posts:
                        ctx.set(x, yy, z, "frame", "full", M("frame"), axis="y")
                    elif beam:
                        ctx.set(x, yy, z, "frame", "full", M("frame"), axis=ax)
                    else:
                        ctx.set(x, yy, z, "walls", "full", M("infill"), axis="y")   # log infill stands upright
                    if fk == "proud" and (corner or t in posts or beam):
                        ox, oz = DIRS[sd]
                        ctx.set(x + ox, yy, z + oz, "frame", "full", M("frame"), axis="y" if (corner or t in posts) else ax)
            # string course at upper floor lines on stone buildings (02 step 3 / 07)
            if fk == "stone" and i > 0:
                ox, oz = DIRS[sd]
                for t in range(-(L // 2), L // 2 + 1):
                    x, z = wall_cell(rr, sd, t)
                    ctx.set(x + ox, fl, z + oz, "details", "stairs", M("infill"), facing=OPP[sd], half="top")
        # jetty brackets: an upside-down trim stair under every upper post on a jettied side (02 step 5);
        # "arched" (the default) steps slab, then flat trapdoors to mid-bay and back (02 arched supports)
        if i > 0:
            for sd in jetty:
                posts = posts_of[(i, sd)]
                for t in posts:
                    x, z = wall_cell(rr, sd, t)
                    ctx.set(x, fl - 1, z, "frame", "stairs", M("trim"), facing=OPP[sd], half="top")
                if s.get("brackets", "arched") == "arched":
                    for a_, b_ in zip(posts, posts[1:]):
                        for t in range(a_ + 1, b_):
                            x, z = wall_cell(rr, sd, t)
                            if min(t - a_, b_ - t) == 1: ctx.set(x, fl - 1, z, "frame", "slab", M("trim"), half="top")
                            else: ctx.set(x, fl - 1, z, "frame", "trapdoor", M("trim"), open=False, half="top", facing=sd)
    M, fk = base_M, base_fk
    if fk == "stone" and len(storeys) > 1:   # string-course corners wrap with outer-corner stairs
        for i in range(1, len(storeys)):
            x0, z0, x1, z1 = rects[i]
            for (cx, cz, fa, fb) in ((x0 - 1, z0 - 1, "n", "w"), (x1 + 1, z0 - 1, "n", "e"), (x0 - 1, z1 + 1, "s", "w"), (x1 + 1, z1 + 1, "s", "e")):
                fc, cn = corner_stair(fa, fb)
                ctx.set(cx, floors[i], cz, "details", "stairs", M("infill"), facing=fc, half="top", corner=cn)
    return {"floors": floors, "rects": rects, "plate": plate, "fk": fk, "y": y, "plinth": plinth, "storeys": storeys,
            "posts_of": posts_of, "fk_of": fk_of}


def _openings(ctx, s, st, B, H_blocks, H_extra, others):
    """Stage 5 for one block, run once every roof field is known, so no window opens onto a roof: a
    window is left out when another block's roof is in front of it or above its sill (it would look into
    that roof or its attic), when a porch roof crosses the glass, when its wall faces another block, and
    when the storey is too short for it under its own roof (no shutters left standing on a roof)."""
    floors, rects, storeys, plinth, fk, plate = B["floors"], B["rects"], B["storeys"], B["plinth"], B["fk"], B["plate"]
    posts_of = B["posts_of"]
    inside_other = lambda c: any(r[0] <= c[0] <= r[2] and r[1] <= c[1] <= r[3] for ob in others for r in ob["rects"])
    def blocked(rr, sd, t, fl, ww, wh, dropped):
        ox, oz = DIRS[sd]; rx, rz = RIGHT_OF[sd]
        x, z = wall_cell(rr, sd, t); top = fl + 1 + wh
        if top > (plate if rr is rects[-1] else fl + storeys[rects.index(rr)] - 1): return "runs into its roof"
        for k in range(-(ww // 2) - 1, ww // 2 + 2):
            for out in (1, 2, 3):
                c = (x + rx * k + ox * out, z + rz * k + oz * out)
                if out == 1 and inside_other(c): return "faces another block"
                if H_blocks.get(c, -99) >= fl + 1: return "looks onto a roof"
                if fl + 1 <= H_extra.get(c, -99) <= top + 1: return "a porch roof crosses it"
        return None
    dspec = s.get("door", {"side": "s"})
    dside, dt = (dspec or {}).get("side", "s"), (dspec or {}).get("at", 0)
    if dspec:
        door(ctx, rects[0], dside, dt, floors[0], st, kind=dspec.get("kind", "house"), canopy=dspec.get("canopy", True),
             steps=dspec.get("steps", plinth), frame_kind=fk)
    else: dside, dt = None, 0
    skip = {(b.get("side", "s"), b.get("storey", 1), b.get("at", 0)) for b in s.get("balconies", [])}
    wspec = s.get("windows", "auto")
    shutter_share = s.get("shutters", 0.3 if fk != "proud" else 0.0)
    y = B["y"]
    for i, (fl, rr, h) in enumerate(zip(floors, rects, storeys)):
        for sd in "nsew":
            if wspec != "auto":
                lst = [w for w in wspec.get(sd, []) if w.get("storey", 0) == i]
            else:
                cs, sz = bay_centres(posts_of[(i, sd)])
                lst = [{"at": c, "w": 3 if b >= 5 else 1} for c, b in zip(cs, sz) if b >= 3]
            for wv in lst:
                t = wv["at"]; ww = wv.get("w", 1); wh = wv.get("h", 2)
                if i == 0 and sd == dside and abs(t - dt) <= 1 + ww // 2: continue
                if any(sd == bs and i == bi and abs(t - bt) <= 1 + ww // 2 for bs, bi, bt in skip): continue
                why = blocked(rr, sd, t, fl, ww, wh, None)
                if why:
                    if wspec != "auto": ctx.log.append(f"{st['_name']}: window {sd} storey {i} at {t} left out: {why}")
                    continue
                head_room = (fl + h) - (fl + 2 + wh)
                sh = wv.get("shutters")
                if sh is None:   # symmetric pairs across a front, about 30% (05: shutters)
                    sh = shutter_share > 0 and h3(abs(t), i, "nsew".index(sd), 17) < shutter_share and ww in (1, 3)
                window(ctx, rr, sd, t, fl, st, ww, wh, head_room, B["fk_of"][i], sh, wv.get("sill"))


def raw_roof(ctx, st):
    raw = st["roof"]
    return ctx.spec["materials"].get(raw, raw) if isinstance(raw, str) else raw


def _roof_of(ctx, s, st, B, k=0):
    """The roof field of one block of a building (06-roof). Wings get their own copy of the roof material,
    so a colour ladder runs eave to ridge on each roof, not over the main roof's heights."""
    rs = s.get("roof", {})
    kind = rs.get("type", "gable"); pitch = rs.get("pitch", 1)
    top = B["rects"][-1]; plate = B["plate"]
    rmat = ctx.mat(st, "roof")
    if k:
        raw = st["roof"]; raw = ctx.spec["materials"].get(raw, raw) if isinstance(raw, str) else raw
        if isinstance(raw, dict): raw = {a: b for a, b in raw.items() if a not in ("from", "to")}   # the main roof's range
        rmat = f"{st['_name']}.roof{k}"; ctx.spec["materials"][rmat] = raw
    if kind == "flat":       # a flat roof on the wall top (06 roof-types 18: Emberwaste, harbour terraces)
        x0, z0, x1, z1 = top
        F = {(x, z): (plate + 1, 0, 0) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)}
        ctx.spec["materials"][rmat] = _with_range(ctx.spec["materials"][rmat], plate, plate + 1)
        return F, {"rect": top, "ridge": "x", "base": plate, "kind": "flat", "pitch": 0, "mat": rmat, "flat": rs}
    F, ridge = roof_field(top, kind, rs.get("ridge"), rs.get("overhang", 1), rs.get("verge", 1), pitch, plate)
    r = {"rect": top, "ridge": ridge, "base": plate, "kind": kind, "pitch": pitch, "mat": rmat, "cap": rs.get("cap", rmat),
         "horns": rs.get("gable_horns", False)}
    if not k: ctx.last_roof = {a: b for a, b in raw_roof(ctx, st).items() if a not in ("from", "to")} if isinstance(raw_roof(ctx, st), dict) else raw_roof(ctx, st)
    ctx.spec["materials"][rmat] = _with_range(ctx.spec["materials"][rmat], plate, max(v[0] for v in F.values()))
    return F, r


def _flat_roof(ctx, r, st, H):
    """06 roof-types 18 / palettes/emberwaste.md: the roof layer on the wall top (no gap), a parapet one high
    round it (slabs, crenels, walls or none) with posts on the corners, optional projecting roof beams
    (vigas) every other block on the long sides, an optional hatch. roof keys: parapet, parapet_mat,
    beams (true or a log), hatch (true)."""
    f = r["flat"]; x0, z0, x1, z1 = r["rect"]; y = r["base"] + 1; m = r["mat"]
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            ctx.set(x, y, z, "roof", "full", m); H[(x, z)] = max(H.get((x, z), -99), y)
    par = f.get("parapet", "slab"); pm = f.get("parapet_mat") or ctx.mat(st, "quoin")
    if par != "none":
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                if not (x in (x0, x1) or z in (z0, z1)): continue
                corner = x in (x0, x1) and z in (z0, z1)
                t_ = (x - x0) + (z - z0)
                if corner: ctx.set(x, y + 1, z, "roof", "post", pm)
                elif par == "crenel": (t_ % 2 == 0) and ctx.set(x, y + 1, z, "roof", "full", pm)
                elif par == "wall": ctx.set(x, y + 1, z, "roof", "post", pm)
                else: ctx.set(x, y + 1, z, "roof", "slab", pm, half="bottom")
    if f.get("beams"):
        log = f["beams"] if isinstance(f["beams"], str) else "spruce_log"
        long_x = (x1 - x0) >= (z1 - z0)
        for sd in (("n", "s") if long_x else ("w", "e")):
            L = side_len(r["rect"], sd); ox, oz = DIRS[sd]
            for t_ in range(-(L // 2) + 1, L // 2, 2):
                wx, wz = wall_cell(r["rect"], sd, t_)
                ctx.setif(wx + ox, y - 1, wz + oz, "details", raw=log, axis="z" if long_x else "x")
    if f.get("hatch"):
        cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
        ctx.set(cx, y, cz, "roof", "trapdoor", ctx.mat(st, "trim"), half="bottom")


def _join(ctx, blocks):
    """Wings joined to the main block (L, T, U and cross plans, 00-planning extensions): every cell that is
    inside the joined footprint on all four sides is opened up, so walls, windows and sills between the
    blocks go and one building is left. Floor lines stay as floor."""
    lo = min(B["floors"][0] for _, _, B in blocks) + 1
    hi = max(B["plate"] for _, _, B in blocks)
    for y in range(lo, hi + 1):
        U = set()
        for _, _, B in blocks:
            for k, (fl, rr, h) in enumerate(zip(B["floors"], B["rects"], B["storeys"])):
                if (fl if k else fl + 1) <= y < fl + h or (k == len(B["storeys"]) - 1 and y == B["plate"]):
                    U |= {(x, z) for x in range(rr[0], rr[2] + 1) for z in range(rr[1], rr[3] + 1)}
        for (x, z) in U:
            if all((x + dx, z + dz) in U for dx, dz in DIRS.values()):
                c = ctx.get(x, y, z)
                if c and ctx.stage_of.get((x, y, z)) in ("frame", "walls", "openings", "details"):
                    ctx.clear(x, y, z)
                    for s, st, B in blocks:
                        if y in B["floors"][1:] and any(r[0] <= x <= r[2] and r[1] <= z <= r[3] for r in B["rects"]):
                            ctx.set(x, y, z, "floors", "full", ctx.mat(st, "floor")); break


def _dormer_fields(ctx, d, st, B, Fmain, rmain):
    """A gabled dormer standing on an eave side (06-roof dormers): front wall on the wall line, a window in
    it, cheeks down to the main roof, its own roof running back into the main roof."""
    side = d.get("side", "s"); w = d.get("w", 3); hd = d.get("h", 3); t = d.get("at", 0)
    top = rmain["rect"]; plate = B["plate"]
    if ALONG_AXIS[side] != rmain["ridge"] or rmain["kind"] != "gable":
        if rmain["kind"] == "gable":
            ctx.log.append(f"{st['_name']}: dormer on the {side} side skipped: dormers stand on an eave side (along the ridge)")
            return None
    x, z = wall_cell(top, side, t)
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    base = plate + hd; ridge_row = base + w // 2
    # run back from the wall until the main roof is at least as high as the dormer ridge
    depth = 1
    while depth < 20:
        cx, cz = x - ox * depth, z - oz * depth
        if Fmain.get((cx, cz), (0,))[0] >= ridge_row + 1: break
        depth += 1
    cells = [(x + rx * k - ox * j, z + rz * k - oz * j) for k in range(-(w // 2), w // 2 + 1) for j in range(depth + 1)]
    xs, zs = [c[0] for c in cells], [c[1] for c in cells]
    rect = [min(xs), min(zs), max(xs), max(zs)]
    dr = "x" if side in "ew" else "z"
    F, _ = roof_field(rect, "gable", dr, 0, 1, 1, base)
    # the back verge would poke out of the main roof: keep the front verge only
    F = {c: v for c, v in F.items() if c in cells or (c[0] - x) * ox + (c[1] - z) * oz > 0}
    r = {"rect": rect, "ridge": dr, "base": base, "kind": "gable", "pitch": 1, "mat": rmain["mat"], "cap": rmain["cap"],
         "edge": "none", "dormer": {"side": side, "front": (x, z), "w": w, "cells": cells, "glass": d.get("glass", st["glass"])}}
    return F, r


def _dormer_walls(ctx, r, H, Fmain, st, plate):
    dm = r["dormer"]; side = dm["side"]; x, z = dm["front"]; w = dm["w"]
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    frame, infill = ctx.mat(st, "frame"), ctx.mat(st, "infill")
    for k in range(-(w // 2), w // 2 + 1):
        fx, fz = x + rx * k, z + rz * k
        cheek = abs(k) == w // 2
        for y in range(plate + 1, r["base"]):        # front wall: posts at the corners, window in the middle
            if cheek: ctx.set(fx, y, fz, "roof", "full", frame, axis="y")
            elif y - plate <= 2: ctx.set(fx, y, fz, "roof", raw=dm["glass"])
            else: ctx.set(fx, y, fz, "roof", "full", infill)
        ctx.set(fx, plate, fz, "roof", "full", frame, axis=ALONG_AXIS[side])
        if cheek:                                     # cheeks: down to the main roof all the way back
            for j in range(1, 30):
                cx, cz = fx - ox * j, fz - oz * j
                if (cx, cz) not in H or Fmain.get((cx, cz), (0,))[0] >= H[(cx, cz)]: break
                for y in range(Fmain[(cx, cz)][0] + 1, H[(cx, cz)]):
                    ctx.set(cx, y, cz, "roof", "full", infill)
    # inside the dormer: no main-roof stairs left over
    for (cx, cz) in dm["cells"]:
        for y in range(plate + 1, H.get((cx, cz), plate)):
            c = ctx.get(cx, y, cz)
            if c and c.get("kind") == "stairs" and ctx.stage_of.get((cx, y, cz)) == "roof" and (cx, cz) != (x, z): ctx.clear(cx, y, cz)
    # sill under the window
    for k in range(-(w // 2) + 1, w // 2):
        ctx.setif(x + rx * k + ox, plate, z + rz * k + oz, "roof", "slab", ctx.mat(st, "trim"), half="top")


def _porch(ctx, p, st, B):
    """A gabled porch over the door (07-detailing): posts at the outer corners on stone pads, a floor of
    the plinth stone, its own small roof; its back stops at the wall."""
    side = p.get("side", "s"); w = p.get("w", 5); dpt = p.get("d", 3); t = p.get("at", 0); h = p.get("h", 3)
    rect0 = B["rects"][0]; fl = B["floors"][0]
    x, z = wall_cell(rect0, side, t)
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    frame, plinth = ctx.mat(st, "frame"), ctx.mat(st, "plinth")
    cells = [(x + rx * k + ox * j, z + rz * k + oz * j) for k in range(-(w // 2), w // 2 + 1) for j in range(1, dpt + 1)]
    for (cx, cz) in cells:
        ctx.set(cx, fl, cz, "foundation", "full", plinth)
        for yy in range(B["y"], fl): ctx.setif(cx, yy, cz, "foundation", "full", plinth)
    for k in (-(w // 2), w // 2):
        px, pz = x + rx * k + ox * dpt, z + rz * k + oz * dpt
        for yy in range(fl + 1, fl + 1 + h): ctx.set(px, yy, pz, "frame", "full", frame, axis="y")
    xs, zs = [c[0] for c in cells], [c[1] for c in cells]
    rect = [min(xs), min(zs), max(xs), max(zs)]
    dr = "x" if side in "ew" else "z"
    F, _ = roof_field(rect, "gable", dr, 1, 1, 1, fl + h + 1)
    inside = lambda c: any(r[0] <= c[0] <= r[2] and r[1] <= c[1] <= r[3] for r in B["rects"])
    back = lambda c: (c[0] - x) * ox + (c[1] - z) * oz <= 0
    F = {c: v for c, v in F.items() if not inside(c) and not back(c)}
    rmat = ctx.mat(st, "roof")
    r = {"rect": rect, "ridge": dr, "base": fl + h + 1, "kind": "gable", "pitch": 1, "mat": rmat, "cap": rmat, "porch": True, "edge": "barge"}
    # tie beam across the front, at post-top height
    for k in range(-(w // 2), w // 2 + 1):
        ctx.set(x + rx * k + ox * dpt, fl + h, z + rz * k + oz * dpt, "frame", "full", frame, axis=ALONG_AXIS[side])
    return F, r


def _balcony(ctx, b, st, B):
    """A balcony on an upper storey (07-detailing): a door out of the wall, a trim floor one or two deep on
    upside-down stair brackets, a fence rail round the open sides."""
    side = b.get("side", "s"); i = b.get("storey", 1); w = b.get("w", 3); dpt = b.get("d", 1); t = b.get("at", 0)
    if i >= len(B["floors"]): ctx.log.append(f"{st['_name']}: balcony on storey {i} skipped (no such storey)"); return
    rr = B["rects"][i]; fl = B["floors"][i]
    x, z = wall_cell(rr, side, t)
    ox, oz = DIRS[side]; rx, rz = RIGHT_OF[side]
    trim = ctx.mat(st, "trim"); fence = b.get("rail", f"{WOOD_OF(st['door'])}_fence")
    for k in range(-(w // 2), w // 2 + 1):
        for j in range(1, dpt + 1):
            cx, cz = x + rx * k + ox * j, z + rz * k + oz * j
            ctx.set(cx, fl, cz, "details", "full", trim)
            edge = j == dpt or abs(k) == w // 2
            if edge: ctx.set(cx, fl + 1, cz, "details", raw=fence)
        bx, bz = x + rx * k + ox, z + rz * k + oz
        if abs(k) == w // 2 or w <= 3: ctx.set(bx, fl - 1, bz, "details", "stairs", trim, facing=OPP[side], half="top")
    ctx.set(x, fl + 1, z, "openings", raw=st["door"], facing=side, hinge=False)
    ctx.set(x, fl + 2, z, "openings", raw=st["door"], facing=side, hinge=False, upper=True)
    if dpt >= 1: ctx.clear(x + ox, fl + 1, z + oz)    # no rail in front of the door when only one deep
    if dpt > 1: ctx.set(x + ox * dpt, fl + 1, z + oz * dpt, "details", raw=fence)


def house(ctx, s):
    """A building by the stages: foundation, frame, floors, walls, openings, roof, details.
    Optional: wings (joined blocks with joined roofs), dormers, porch, balconies."""
    st = _style(ctx, s)
    B = _body(ctx, s, st)
    blocks = [(s, st, B)]
    for k, wg in enumerate(s.get("wings", [])):
        ws = {key: v for key, v in s.items() if key in ("style", "materials", "plinth", "y", "frame", "bay", "shutters", "storeys", "storey_style")}
        ws.update({"door": None, "chimney": None}); ws.update(wg)
        wst = _style(ctx, ws, st if "style" not in wg else None)
        if ws.get("join", "eave") == "eave":   # a wing's ridge must reach the main eave so the roofs join (06)
            sty = list(ws.get("storeys", [5])); wy = ws.get("y", 0) + ws.get("plinth", 1) - 1
            wr = ws["rect"]; rs = ws.get("roof", {})
            Fw, _ = roof_field(wr, rs.get("type", "gable"), rs.get("ridge"), rs.get("overhang", 1), rs.get("verge", 1),
                               rs.get("pitch", 1), wy + sum(sty) - 1)
            gap = B["plate"] - max(v[0] for v in Fw.values())
            if gap > 0:
                sty[-1] += gap; ws = dict(ws, storeys=sty)
                ctx.log.append(f"{st['_name']}: wing {k + 1} top storey raised by {gap} so its ridge meets the main eave (\"join\": \"none\" keeps it low)")
        blocks.append((ws, wst, _body(ctx, ws, wst)))
    if len(blocks) > 1: _join(ctx, blocks)
    for b in s.get("balconies", []): _balcony(ctx, b, st, B)
    # ---- 6 roof fields first (06 connecting roofs), so openings can keep clear of every roof
    roofs = [(*_roof_of(ctx, bs, bst, bB, k), bst, bB) for k, (bs, bst, bB) in enumerate(blocks)]
    Fmain, rmain = roofs[0][0], roofs[0][1]
    extra = []
    for d in s.get("dormers", []):
        got = _dormer_fields(ctx, d, st, B, Fmain, rmain)
        if got: extra.append(got)
    if s.get("porch"): extra.append(_porch(ctx, s["porch"] if isinstance(s["porch"], dict) else {}, st, B))
    H_extra = {}
    for F, r in extra:
        if r.get("porch"):
            for c, v in F.items(): H_extra[c] = max(H_extra.get(c, -99), v[0])
    # ---- 5 openings, block by block
    for k, (bs, bst, bB) in enumerate(blocks):
        Hb = {}
        for j, (F, r, *_x) in enumerate(roofs):
            if j == k: continue
            for c, v in F.items(): Hb[c] = max(Hb.get(c, -99), v[0])
        _openings(ctx, bs, bst, bB, Hb, H_extra, [ob for j, (_a, _b, ob) in enumerate(blocks) if j != k])
    if s.get("arcade"): _arcade(ctx, s, st, B, s["arcade"])
    # a wing roof that ends against a taller wall: say so (it reads as unfinished; 06 connecting roofs)
    for k, (F, r, bst, bB) in enumerate(roofs[1:], 1):
        top = max(v[0] for v in F.values())
        if top < B["plate"] and any(any(rr[0] - 1 <= c[0] <= rr[2] + 1 and rr[1] - 1 <= c[1] <= rr[3] + 1 for rr in B["rects"]) for c in F):
            ctx.log.append(f"{st['_name']}: wing {k}'s ridge ({top}) stays below the main eave ({B['plate']}), so its roof stops "
                           "against the main wall; give the wing the main block's storeys so the roofs join")
    chs = []
    for bs, bst, bB in blocks:
        ch = bs.get("chimney", "auto")
        if not ch: continue
        if ch == "auto":       # through the ridge, two in from a gable end (06 step 9)
            F_, r_ = roofs[blocks.index((bs, bst, bB))][:2]
            if r_["kind"] == "flat": continue      # flat roofs: give chimneys by hand
            x0, z0, x1, z1 = r_["rect"]
            chs.append(((x1 - 2, (z0 + z1) // 2) if r_["ridge"] == "x" else ((x0 + x1) // 2, z1 - 2), bst, bB))
        else: chs += [(tuple(c), bst, bB) for c in (ch if isinstance(ch[0], list) else [ch])]
    for c, _, bB in chs:
        for yy in range(bB["plate"] + 1, bB["plate"] + 40): ctx.clear(c[0], yy, c[1])
    for F, r, *_ in roofs + extra: r["_F"] = F          # gable fills stop at their own roof, not a higher one
    Hf = build_roofs(ctx, [(F, r) for F, r, *_ in roofs] + extra, st, chimneys={c for c, _, _ in chs})
    for F, r, bst, bB in roofs:
        if r["kind"] == "flat": _flat_roof(ctx, r, bst, Hf)
        gable_walls(ctx, r, Hf, bst, bB["fk"])
    for F, r in extra:
        if "dormer" in r: _dormer_walls(ctx, r, Hf, Fmain, st, B["plate"]); gable_walls(ctx, r, Hf, st, B["fk"])
        elif r.get("porch"): gable_walls(ctx, r, Hf, st, B["fk"])
    for c, bst, bB in chs: chimney(ctx, c[0], c[1], bB["floors"][0] + 1, Hf, bst)
    # ---- 7 details
    for (F, r, bst, bB), (bs, _, _) in zip(roofs, blocks):
        tr = bs.get("trusses", s.get("trusses", "auto"))
        if tr: trusses(ctx, r, Hf, bst, bB, tr)
        fin = bs.get("finials", s.get("finials", "spikes"))
        if fin: finials(ctx, r, Hf, fin, {c for c, _, _ in chs}, bst)
    if s.get("vines"): vines(ctx, blocks, s["vines"])
    for bs, bst, bB in blocks:
        ctx.info["houses"].append({"name": bst["_name"], "rect": list(bs["rect"]), "plate": bB["plate"],
                                   "storeys": [{"floor_y": fl, "stand_y": fl + 1, "height": h, "rect": list(rr)}
                                               for fl, h, rr in zip(bB["floors"], bB["storeys"], bB["rects"])]})
    return B


def trusses(ctx, r, H, st, B, mode="auto"):
    """06 step 8: tie beam at wall-plate height across the span, king post to the ridge, braces on spans
    9+. Lined up with the posts along the ridge. "auto": only where the attic is open to view (spans of 9
    or more inside, which is where halls and barns are); true: always; false: never."""
    if r["kind"] != "gable": return
    x0, z0, x1, z1 = r["rect"]; P = B["plate"]; ridge = r["ridge"]
    span = (z1 - z0 - 1) if ridge == "x" else (x1 - x0 - 1)
    if mode == "auto" and span < 9: return
    frame = ctx.mat(st, "frame")
    L = (x1 - x0 + 1) if ridge == "x" else (z1 - z0 + 1)
    for t in odd_posts(L, 3)[1:-1]:
        along = (x0 + x1) // 2 + t if ridge == "x" else (z0 + z1) // 2 + t
        cells = [(along, z) for z in range(z0 + 1, z1)] if ridge == "x" else [(x, along) for x in range(x0 + 1, x1)]
        ax = "z" if ridge == "x" else "x"
        for (x, z) in cells: ctx.setif(x, P, z, "roof", "full", frame, axis=ax)
        mx, mz = cells[len(cells) // 2]
        for y in range(P + 1, H.get((mx, mz), P)): ctx.setif(mx, y, mz, "roof", "full", frame, axis="y")
        if span >= 9:      # braces: upside-down stairs climbing from the tie beam to the king post
            for k, (x, z) in enumerate(cells):
                d = min(k, len(cells) - 1 - k)
                if 0 < d < len(cells) // 2 and d >= len(cells) // 2 - 2:
                    f = ("n" if k < len(cells) // 2 else "s") if ridge == "x" else ("w" if k < len(cells) // 2 else "e")
                    ctx.setif(x, P + 1 + d - (len(cells) // 2 - 2), z, "roof", "stairs", ctx.mat(st, "trim"), facing=f, half="top")


def finials(ctx, r, H, kind, skip=(), st=None):
    """07 / 06 roof-types (Mateo 2026-11-12: standard on every pitched ridge): a spike every 3 along the
    ridge, a fence post (wood trim) or wall post (stone trim) with a lightning rod on top, in place of the
    ridge slab; taller finials (two posts) at the gable peaks. kind: "spikes" (default), "peaks" (peaks
    only), "endrods" (end rods along the ridge, finials at the peaks), false for none."""
    if r["kind"] not in ("gable", "hip"): return
    x0, z0, x1, z1 = r["rect"]
    own = r.get("_F", H)
    cells = [c for c in own if H.get(c) == own[c][0] if isinstance(own[c], tuple)] if own is not H else list(H)
    cells = [c for c in cells if x0 - 1 <= c[0] <= x1 + 1 and z0 - 1 <= c[1] <= z1 + 1]
    if not cells: return
    top = max(H[c] for c in cells)
    line = sorted(c for c in cells if H[c] == top)
    post = ctx.mat(st, "trim") if st else "spruce_planks"
    n = len(line); mid = n // 2
    for k, (x, z) in enumerate(line):
        if (x, z) in skip: continue
        peak = k in (0, n - 1)
        if not peak and (kind == "peaks" or (k - mid) % 3 or k in (1, n - 2)): continue
        y = top + 1                                     # in place of the ridge slab
        if peak and r.get("horns") and r["kind"] == "gable":
            # Frostmarch gable horns (settle_halls.dragon_heads): the verge boards run on past the ridge in a V
            cx, cz = (0, 1) if r["ridge"] == "x" else (1, 0)
            for s_ in (-1, 1):
                for i in (1, 2):
                    ctx.set(x + cx * s_ * i, top + i - 1, z + cz * s_ * i, "details", "stairs", post,
                            facing=_dir_of(cx * s_, cz * s_), half="bottom")
            continue
        ctx.clear(x, y, z)
        if kind == "endrods" and not peak:
            ctx.set(x, y, z, "details", raw="end_rod"); continue
        for j in range(2 if peak else 1): ctx.set(x, y + j, z, "details", "post", post)
        ctx.set(x, y + (2 if peak else 1), z, "details", raw="lightning_rod")


def vines(ctx, blocks, share=0.15):
    """05/07: vines on infill beside windows and at corners, more on the shady (north) side, never a whole
    face. Placed on wall cells one out, hanging 1 to 3 down from a hashed start."""
    share = 0.15 if share is True else share
    seen = set()
    for s, st, B in blocks:
        for i, (fl, rr, h) in enumerate(zip(B["floors"], B["rects"], B["storeys"])):
            for sd in "nsew":
                ox, oz = DIRS[sd]; L = side_len(rr, sd)
                mul = {"n": 1.8, "e": 1.0, "w": 1.0, "s": 0.5}[sd]
                for t in range(-(L // 2), L // 2 + 1):
                    x, z = wall_cell(rr, sd, t)
                    if h3(x, i, z, 41) > share * mul: continue
                    top = fl + h - 1 - int(h3(x, i, z, 43) * 2)
                    run = 1 + int(h3(x, i, z, 47) * 3)
                    for y in range(top, max(fl, top - run), -1):
                        c = ctx.get(x, y, z)
                        if not c or ctx.stage_of.get((x, y, z)) not in ("walls", "frame"): break
                        if not ctx.free(x + ox, y, z + oz) or (x + ox, y, z + oz) in seen: break
                        ctx.set(x + ox, y, z + oz, "details", raw="vine", attach=OPP[sd]); seen.add((x + ox, y, z + oz))


def _with_range(m, lo, hi):
    """Roof material: the ladder spans eave to ridge, and every roof is textured (two same-colour blocks
    mixed at random, Mateo 2026-11-12) unless the spec says "texture": false."""
    if isinstance(m, dict) and ("ladder" in m or "gradient" in m):
        m = dict(m); m.setdefault("from", lo); m.setdefault("to", hi)
    elif isinstance(m, str) and len(m) >= 5 and m[3] == "-" and m[:3].isupper():
        m = {"ladder": m, "axis": "y", "from": lo, "to": hi, "reverse": True}
    elif isinstance(m, str):
        m = {"color": m} if m.startswith("#") else {"block": m}
    if isinstance(m, dict): m = dict(m); m.setdefault("texture", True)
    return m


def string_course(ctx, s):
    x0, z0, x1, z1 = s["rect"]; y = s["y"]; m = s.get("material", "stone_bricks")
    for sd in s.get("sides", "nsew"):
        L = side_len(s["rect"], sd); ox, oz = DIRS[sd]
        for t in range(-(L // 2), L // 2 + 1):
            x, z = wall_cell(s["rect"], sd, t)
            ctx.set(x + ox, y, z + oz, "details", "stairs", m, facing=OPP[sd], half="top")
    for (cx, cz, fa, fb) in ((x0 - 1, z0 - 1, "n", "w"), (x1 + 1, z0 - 1, "n", "e"), (x0 - 1, z1 + 1, "s", "w"), (x1 + 1, z1 + 1, "s", "e")):
        fc, cn = corner_stair(fa, fb); ctx.set(cx, y, cz, "details", "stairs", m, facing=fc, half="top", corner=cn)


def buttress(ctx, s):
    """1-2 out at the foot, stepping in with a stair at mid height and a stair cap (02 step 6 / shapes.md)."""
    m = s.get("material", "stone_bricks"); sd = s["side"]; ox, oz = DIRS[sd]
    y0, h = s["y"], s["height"]; depth = s.get("depth", 2)
    for t in s["at"]:
        x, z = wall_cell(s["rect"], sd, t)
        for k in range(1, depth + 1):
            top = y0 + (h if k == 1 else h // 2) - 1
            for yy in range(y0, top): ctx.set(x + ox * k, yy, z + oz * k, "details", "full", m)
            ctx.set(x + ox * k, top, z + oz * k, "details", "stairs", m, facing=OPP[sd], half="bottom")


def hanging_lantern(ctx, s):
    x, y, z = s["at"]; n = s.get("chain", 2)
    for k in range(n): ctx.set(x, y - k, z, "details", raw="iron_chain", axis="y")
    ctx.set(x, y - n, z, "details", raw="lantern", hanging=True)


def lean_to(ctx, s):
    """A lean-to (06-roof skillion): one slope against a wall, on log posts. rect = the covered ground
    [x0, z0, x1, z1]; against = the side the wall is on (n/s/e/w); top = y of the roof's high edge, just
    under the wall's eave; pitch 1 (stairs) or "half" (slabs stepping half a block, for shallow sheds).
    Posts on the open corners and every 4 along the open edge, a tie beam under the low edge, an eave of
    upside-down trim stairs, barge boards on both ends. Keys: roof, post, trim, floor (optional), y (ground)."""
    x0, z0, x1, z1 = s["rect"]; side = s.get("against", "n"); top = s["top"]; y0 = s.get("y", 0)
    pitch = s.get("pitch", 1)
    st = {"_name": s.get("name", f"lean_to{ctx.n}"), "roof": s.get("roof", getattr(ctx, "last_roof", None) or {"ladder": "VAL-06"}),
          "post": s.get("post", "stripped_spruce_log"), "trim": s.get("trim", "spruce_planks")}
    ctx.n += 1
    rm, pm, tm = ctx.mat(st, "roof"), ctx.mat(st, "post"), ctx.mat(st, "trim")
    ox, oz = DIRS[side]                       # towards the wall
    away = OPP[side]
    depth = (z1 - z0 + 1) if side in "ns" else (x1 - x0 + 1)
    span = [(x, z) for x in range(x0, x1 + 1) for z in range(z0, z1 + 1)]
    def j_of(x, z):                           # 0 next to the wall .. depth-1 at the open edge, +1 = overhang
        return (z - z0 if side == "n" else z1 - z if side == "s" else x - x0 if side == "w" else x1 - x)
    lo = top - (depth if pitch == 1 else (depth + 1) // 2)
    ctx.spec["materials"][rm] = _with_range(ctx.spec["materials"][rm], lo, top)
    cells = list(span)
    ex, ez = DIRS[away]
    edge = [c for c in span if j_of(*c) == depth - 1]
    cells += [(x + ex, z + ez) for (x, z) in edge]                         # overhang 1 at the low edge
    ends = (("w", "e") if side in "ns" else ("n", "s"))
    for e_ in ends:                                                          # verge 1 at both ends
        dx, dz = DIRS[e_]
        cells += [(x + dx, z + dz) for (x, z) in list(cells) if (x + dx, z + dz) not in cells and
                  ((e_ == "w" and x == x0) or (e_ == "e" and x == x1) or (e_ == "n" and z == z0) or (e_ == "s" and z == z1))]
    roof_y = {}
    for (x, z) in cells:
        j = max(0, min(depth, j_of(x, z)))
        if pitch == 1:
            roof_y[(x, z)] = top - j
            ctx.set(x, top - j, z, "roof", "stairs", rm, facing=side, half="bottom")
        else:
            hh = 2 * top + 1 - j; roof_y[(x, z)] = hh // 2
            ctx.set(x, hh // 2, z, "roof", "slab", rm, half="top" if hh % 2 else "bottom")
    # the low edge: tie beam, posts, eave of upside-down trim stairs; ends: barge boards
    ax = ALONG_AXIS[side]
    edge.sort(); n_ = len(edge)
    for k, (x, z) in enumerate(edge):
        ry = roof_y[(x, z)]
        ctx.set(x, ry - 1, z, "frame", "full", pm, axis=ax)
        if k in (0, n_ - 1) or (k % 4 == 0 and n_ - 1 - k >= 2):
            for yy in range(y0 + 1, ry - 1): ctx.set(x, yy, z, "frame", "full", pm, axis="y")
        oy = roof_y.get((x + ex, z + ez))
        if oy is not None: ctx.setif(x + ex, oy - 1, z + ez, "roof", "stairs", tm, facing=side, half="top")
    for (x, z), ry in roof_y.items():
        if side in "ns" and x in (x0 - 1, x1 + 1): inward = "e" if x == x0 - 1 else "w"
        elif side in "ew" and z in (z0 - 1, z1 + 1): inward = "s" if z == z0 - 1 else "n"
        else: continue
        ctx.setif(x, ry - 1, z, "roof", "stairs", tm, facing=inward, half="top")
    if s.get("floor"):
        for (x, z) in span: ctx.set(x, y0, z, "foundation", "full", s["floor"])


def woodpile(ctx, s):
    """A log stack (07-detailing dressing): logs lying with their end grain to the front, stepped in at
    the top, a few stripped logs mixed in by hash, a slab or trapdoor cover. at = [x, y, z] front-left
    bottom; len along the wall, h high (2-3), facing = the side the end grain shows (n/s/e/w), wood."""
    x, y, z = s["at"]; L = s.get("len", 3); h = s.get("h", 2); f = s.get("facing", "s"); w = s.get("wood", "spruce")
    rx, rz = RIGHT_OF[f]
    ax = "z" if f in "ns" else "x"
    top = None
    for j in range(h):
        inset = 1 if (j == h - 1 and h > 1 and L >= 3) else 0
        for k in range(inset, L - inset):
            cx, cz = x + rx * k, z + rz * k
            stripped = h3(cx, y + j, cz, 61) < 0.2
            ctx.set(cx, y + j, cz, "details", raw=("stripped_" if stripped else "") + f"{w}_log", axis=ax)
    for k in range(L):
        cx, cz = x + rx * k, z + rz * k
        yy = y + h - (0 if 0 < k < L - 1 or L < 3 or h == 1 else 1)
        if ctx.free(cx, yy, cz): ctx.set(cx, yy, cz, "details", raw=f"{w}_slab" if s.get("cover", "slab") == "slab" else f"{w}_trapdoor", half="bottom")
    if s.get("block", True):                 # a chopping block beside it
        cx, cz = x - rx, z - rz
        ctx.setif(cx, y, cz, "details", raw=f"stripped_{w}_log", axis="y")


# ------------------------------------------------------------------ towers, civic dressing (06-roof, 07-detailing)
def _top(ctx, rect, stages=("walls", "frame"), pad=0):
    """Highest cell of the given stages inside rect (+pad): the top of a tower built by an earlier part."""
    x0, z0, x1, z1 = rect
    ys = [y for (x, y, z) in ctx.cells if x0 - pad <= x <= x1 + pad and z0 - pad <= z <= z1 + pad
          and ctx.stage_of.get((x, y, z)) in stages]
    return max(ys) if ys else None


def _base_y(ctx, s, rect, default="top"):
    """y of a part that sits on something already built: a number, "top" (above the walls and frame in
    rect; the old roof there is cleared) or "roof" (on the highest roof cell in rect)."""
    y = s.get("y", default)
    if isinstance(y, (int, float)): return int(y)
    if y == "roof":
        t = _top(ctx, rect, ("roof",))
        if t is not None: return t
    t = _top(ctx, rect)
    if t is None: ctx.log.append(f"{s.get('part')}: nothing built under {rect}; put it on the ground (y 0) or give y"); return 0
    pad = s.get("overhang", 1) + 1
    x0, z0, x1, z1 = rect
    for c in [c for c in ctx.cells if x0 - pad <= c[0] <= x1 + pad and z0 - pad <= c[2] <= z1 + pad and c[1] > t
              and ctx.stage_of.get(c) in ("roof", "details")]:
        ctx.clear(*c)                        # the tower's own roof makes way for the spire or belfry
    return t + 1


def _ring(ctx, X0, Z0, X1, Z1, y, mat, stage="roof", fill=True, corners="stairs"):
    """One ring of a pyramid: stairs facing in (up the slope) on the edge, outer-corner stairs on the
    corners, full blocks inside."""
    for x in range(X0, X1 + 1):
        for z in range(Z0, Z1 + 1):
            ex = "w" if x == X0 else "e" if x == X1 else None
            ez = "n" if z == Z0 else "s" if z == Z1 else None
            if X0 == X1 or Z0 == Z1:
                ctx.set(x, y, z, stage, "full", mat); continue
            if ex and ez:
                if corners == "none": continue
                if corners == "full": ctx.set(x, y, z, stage, "full", mat); continue
                f, cn = corner_stair(ez, ex)
                ctx.set(x, y, z, stage, "stairs", mat, facing=f, half="bottom", corner=cn)
            elif ex or ez:
                ctx.set(x, y, z, stage, "stairs", mat, facing=OPP[ex or ez], half="bottom")
            elif fill:
                ctx.set(x, y, z, stage, "full", mat)


def _finial(ctx, x, y, z, kind, post_mat, cap_mat, stage="details"):
    """Spire top: a post of wall blocks, a cap block and a lightning rod (06: finials)."""
    if kind in (None, "none", False): return y
    if kind == "spire_block":       # the add-on's spire top on the full top block, never on a slab (Mateo 2026-11-12)
        ctx.set(x, y, z, stage, raw="siege:spire_roof"); return y + 1
    n = 2 if kind == "rod" else 3 if kind == "tall" else 1
    for k in range(n): ctx.set(x, y + k, z, stage, "post", post_mat)
    ctx.set(x, y + n, z, stage, "full", cap_mat)
    ctx.set(x, y + n + 1, z, stage, raw="lightning_rod")
    return y + n + 2


def spire(ctx, s):
    """A spire on a square tower (06-roof, steep roofs): an eave ring of stairs over the overhang, then
    rings stepping in one block every `rows` rows (stairs stacked on stairs, corner blocks full, so
    the slope reads steep and tiled), then a finial. kind "stepped" (default) or "broach" (the corners of the
    upper rings are left off, so the spire turns octagonal above square broaches). Keys: rect (the tower),
    y (default "top": on the tower's walls, replacing its roof), rows (3), overhang (1), roof, trim, finial
    ("spire_block", the default: the add-on's siege:spire_roof on the full top block, never on a slab;
    "rod" / "tall" / "short" / "none")."""
    rect = list(s["rect"]); x0, z0, x1, z1 = rect
    y = _base_y(ctx, s, rect)
    ov = s.get("overhang", 1); rows = s.get("rows", 3); kind = s.get("kind", "stepped")
    st = {"_name": s.get("name", f"spire{ctx.n}"), "roof": s.get("roof", {"block": "deepslate_tiles"}),
          "trim": s.get("trim", s.get("roof", {"block": "deepslate_tiles"}))}
    ctx.n += 1
    rm = ctx.mat(st, "roof"); tm = ctx.mat(st, "trim")
    steps = (min(x1 - x0, z1 - z0) // 2) + 1
    ctx.spec["materials"][rm] = _with_range(ctx.spec["materials"][rm], y, y + 1 + rows * steps)
    _ring(ctx, x0 - ov, z0 - ov, x1 + ov, z1 + ov, y, rm)            # the eave ring
    for X0, Z0, X1, Z1 in [(x0 - ov, z0 - ov, x1 + ov, z1 + ov)]:     # an eave of upside-down trim under the overhang
        for x in range(X0, X1 + 1):
            for z in range(Z0, Z1 + 1):
                if not (x0 <= x <= x1 and z0 <= z <= z1):
                    sd = "n" if z < z0 else "s" if z > z1 else "w" if x < x0 else "e"
                    if (x < x0 or x > x1) and (z < z0 or z > z1): continue
                    ctx.setif(x, y - 1, z, "roof", "stairs", tm, facing=OPP[sd], half="top")
    y += 1
    k = 0
    while x0 + k <= x1 - k and z0 + k <= z1 - k:
        X0, Z0, X1, Z1 = x0 + k, z0 + k, x1 - k, z1 - k
        for r in range(rows):
            last = r == rows - 1
            if k == 0 and not last: continue
            corners = "none" if (kind == "broach" and k > 0 and r > 0) else "stairs"
            if kind == "broach" and k == 0: corners = "stairs" if last else "full"
            if last or X0 == X1 or Z0 == Z1: _ring(ctx, X0, Z0, X1, Z1, y, rm, corners=corners)
            else:            # lower rows of a step: stairs stacked on stairs, so the steep face reads as tiles, not a box
                _ring(ctx, X0, Z0, X1, Z1, y, rm, fill=False, corners="none" if corners == "none" else "full")
            y += 1
            if X0 == X1 or Z0 == Z1: break
        if X0 == X1 or Z0 == Z1: break
        k += 1
    cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
    if x1 - x0 == z1 - z0: _finial(ctx, cx, y, cz, s.get("finial", "spire_block"), tm, rm)
    return y


def belfry(ctx, s):
    """An open bell storey (07-detailing, towers): a solid deck, corner piers, an arched head on every face
    (round angle, when the face is 3 or more wide), a beam ring on top, a bell hanging from a beam across the
    middle, optional louvres (open trapdoors flush to each face) and a cap. Sits on a tower (y "top",
    replacing its roof), on a ridge (y "roof": the deck is built up from the roof) or at a given y.
    Keys: rect, y, h (open height, 4), pier, deck, trim, roof, louvres, bell, cap ("hip" / "spire" / "none"),
    finial, base (rows of deck above the ridge, 1)."""
    rect = list(s["rect"]); x0, z0, x1, z1 = rect
    on_roof = s.get("y") == "roof"
    y = _base_y(ctx, s, rect, "top")
    h = s.get("h", 4)
    st = {"_name": s.get("name", f"belfry{ctx.n}"), "pier": s.get("pier", "stone_bricks"), "deck": s.get("deck", s.get("pier", "stone_bricks")),
          "trim": s.get("trim", "spruce_planks"), "roof": s.get("roof", {"block": "deepslate_tiles"})}
    ctx.n += 1
    pm, dm, tm = ctx.mat(st, "pier"), ctx.mat(st, "deck"), ctx.mat(st, "trim")
    if on_roof:              # build the deck up from the roof surface in every column
        deck = y + s.get("base", 1) - 1
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                lo = min([yy for (cx, yy, cz) in ctx.cells if cx == x and cz == z and ctx.stage_of.get((cx, yy, cz)) == "roof"] or [deck])
                for yy in range(lo, deck + 1): ctx.set(x, yy, z, "frame", "full", dm)
    else:
        deck = y
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1): ctx.set(x, deck, z, "floors", "full", dm)
    W, D = x1 - x0 + 1, z1 - z0 + 1
    thin = min(W, D) <= 3
    for x, z in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
        for yy in range(deck + 1, deck + h + 1): ctx.set(x, yy, z, "frame", "post" if thin else "full", pm)
    beam = deck + h + 1
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if x in (x0, x1) or z in (z0, z1): ctx.set(x, beam, z, "frame", "full", tm, axis="x" if z in (z0, z1) else "z")
    for sd in "nsew":
        L = side_len(rect, sd)
        if L - 2 >= 3 and (L - 2) % 2:
            cx, cz = wall_cell(rect, sd, 0)
            arch(ctx, {"at": [cx, deck + 1, cz], "axis": ALONG_AXIS[sd], "width": L - 2, "height": h, "style": s.get("arch", "round_angle"),
                       "material": ctx.mat(st, "pier"), "trim": tm, "stage": "walls"})
        if s.get("louvres"):
            for t_ in range(-(L // 2) + 1, L // 2):
                x, z = wall_cell(rect, sd, t_)
                for yy in range(deck + 1, deck + h):
                    if ctx.free(x, yy, z): ctx.set(x, yy, z, "details", "trapdoor", tm, open=True, facing=OPP[sd])
    cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
    if s.get("bell", True):
        ax = "x" if W >= D else "z"
        for k in range((x0 if ax == "x" else z0) + 1, (x1 if ax == "x" else z1)):
            ctx.set(k if ax == "x" else cx, beam, cz if ax == "x" else k, "frame", "full", tm, axis=ax)
        ctx.set(cx, beam - 1, cz, "details", raw="bell", facing="s" if ax == "x" else "e")
    cap = s.get("cap", "hip")
    if cap == "none": return beam
    return spire(ctx, {"rect": rect, "y": beam + 1, "rows": 1 if cap == "hip" else s.get("rows", 3), "overhang": s.get("overhang", 1),
                       "roof": s.get("roof", {"block": "deepslate_tiles"}), "trim": s.get("cap_trim", st["pier"]),
                       "finial": s.get("finial", "spire_block"), "kind": s.get("kind", "stepped"),
                       "name": st["_name"] + ".cap", "part": "spire"})


def clock_face(ctx, s):
    """A clock on a wall (07-detailing): a 3x3 (or 5, round) face of calcite flush in the wall, hands in a
    dark block from the hub (minute hand on the 12, hour hand by `time`), a button for the hub and an
    optional frame. Place it by at = [x, y, z] (the face centre, in the wall) and side (the way it faces),
    or by rect + side + y (+ "along", offset along the wall like windows' "at")."""
    sd = s["side"]
    if "rect" in s:
        x, z = wall_cell(s["rect"], sd, s.get("along", 0)); y = s["y"]
    else: x, y, z = s["at"]
    n = s.get("size", 3); r = n // 2
    face, hand = s.get("face", "calcite"), s.get("hand", "polished_blackstone")
    hh, mm = (int(v) for v in str(s.get("time", "3:00")).split(":"))
    rx, rz = RIGHT_OF[sd]; ox, oz = DIRS[sd]
    def P(u, v): return x + rx * u, y + v, z + rz * u       # u right, v up, seen from outside
    def ray(deg, length):
        import math
        a = math.radians(round(deg / 45) * 45); du, dv = round(math.sin(a)), round(math.cos(a))
        return [(du * k, dv * k) for k in range(1, length + 1)]
    for u in range(-r - 1, r + 2):          # a window's sill, shutters or lantern in front of the face go
        for v in range(-r - 1, r + 2):
            c = (P(u, v)[0] + ox, P(u, v)[1], P(u, v)[2] + oz)
            if ctx.stage_of.get(c) in ("openings", "details"): ctx.clear(*c)
    hands = {(0, 0)} | set(ray(mm * 6, r)) | set(ray((hh % 12) * 30 + mm / 2, max(1, r - 1)))
    for u in range(-r, r + 1):
        for v in range(-r, r + 1):
            if n >= 5 and abs(u) == r and abs(v) == r: continue      # round the big face's corners
            ctx.set(*P(u, v), "details", raw=hand if (u, v) in hands else face)
    fr = s.get("frame")
    if fr:
        for u in range(-r - 1, r + 2):
            for v in range(-r - 1, r + 2):
                if max(abs(u), abs(v)) == r + 1: ctx.set(*P(u, v), "details", raw=fr)
    hub = s.get("hub", "polished_blackstone_button")
    if hub: ctx.set(x + ox, y, z + oz, "details", raw=hub, facing=sd)


def wheel(ctx, s):
    """A waterwheel (mills): a plank rim, spokes of fence from the hub, paddles standing out of the rim at
    every eighth, and a log axle running into the mill wall. at = the axle centre, axis = the axle's
    direction (x or z), r = radius (3-5), width 1 or 2 along the axle, axle = blocks of axle each side, wood."""
    import math
    x, y, z = s["at"]; ax = s.get("axis", "x"); r = s.get("r", 3); w = s.get("width", 1); wood = s.get("wood", "spruce")
    rim, spoke, log = s.get("rim", f"{wood}_planks"), s.get("spoke", f"{wood}_fence"), s.get("axle_block", f"stripped_{wood}_log")
    def P(a, u, v): return (x + a, y + v, z + u) if ax == "x" else (x + u, y + v, z + a)
    for a in range(w):
        for u in range(-r - 1, r + 2):
            for v in range(-r - 1, r + 2):
                d = math.hypot(u, v)
                if r - 0.5 <= d < r + 0.5: ctx.set(*P(a, u, v), "details", raw=rim)
        for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            for k in range(1, r):
                c = P(a, du * k, dv * k)
                if math.hypot(du * k, dv * k) < r - 0.5 and ctx.free(*c): ctx.set(*c, "details", raw=spoke)
            if s.get("paddles", True):
                k = r + 1 if du == 0 or dv == 0 else round((r + 1) / math.sqrt(2))
                ctx.set(*P(a, du * k, dv * k), "details", raw=rim)
    n = s.get("axle", 1)
    for a in range(-n, w + n): ctx.set(*P(a, 0, 0), "details", raw=log, axis=ax)


def _arcade(ctx, s, st, B, a):
    """An arcade along a house's ground storey (02 arched supports): every bay between the frame posts
    becomes a round-angle arch, so the storey stands open as a market hall. Keys: sides (default every
    side but the door's), storey (0), height, style, material, trim, lanterns (one in each crown), pier
    (a block for the posts between arches)."""
    a = {} if a is True else a
    door_side = (s.get("door") or {}).get("side", "s") if s.get("door", {}) is not None else None
    sides = a.get("sides", "".join(d for d in "nsew" if d != door_side))
    i = a.get("storey", 0)
    fl, h, rr = B["floors"][i], B["storeys"][i], B["rects"][i]
    hgt = a.get("height", h - 1 if i < len(B["storeys"]) - 1 else h - 2)
    mat = a.get("material") or ctx.mat(st, "plinth"); trim = a.get("trim") or ctx.mat(st, "trim")
    for sd in sides:
        L = side_len(rr, sd); ox, oz = DIRS[sd]
        stops = sorted(set([-(L // 2), L // 2] + list(B["posts_of"][(i, sd)])))
        for a_, b_ in zip(stops, stops[1:]):
            w = b_ - a_ - 1
            if w < 1: continue
            if w % 2 == 0:
                ctx.log.append(f"{st['_name']}: arcade bay of {w} on side {sd} is even, left as wall (set bay so posts sit an odd gap apart)"); continue
            for t_ in range(a_ + 1, b_):          # sills, shutters and boxes of windows in the bay go
                wx, wz = wall_cell(rr, sd, t_)
                for yy in range(fl + 1, fl + hgt + 1):
                    if ctx.stage_of.get((wx + ox, yy, wz + oz)) in ("openings", "details"): ctx.clear(wx + ox, yy, wz + oz)
            c = (a_ + b_) // 2; x, z = wall_cell(rr, sd, c)
            arch(ctx, {"at": [x, fl + 1, z], "axis": ALONG_AXIS[sd], "width": w, "height": hgt, "style": a.get("style", "round_angle"),
                       "material": mat, "trim": trim})
            if a.get("lanterns", True) and w >= 3: ctx.set(x, fl + hgt, z, "details", raw="lantern", hanging=True)
        if a.get("pier"):
            for t_ in stops:
                if t_ in (-(L // 2), L // 2): continue
                px, pz = wall_cell(rr, sd, t_)
                for yy in range(fl + 1, fl + hgt + 1): ctx.set(px, yy, pz, "frame", "full", a["pier"])


PARTS = {"house": house, "lean_to": lean_to, "woodpile": woodpile, "spire": spire, "belfry": belfry, "clock_face": clock_face, "wheel": wheel, "arch": arch, "string_course": string_course, "buttress": buttress, "hanging_lantern": hanging_lantern}


def run(ctx, pt):
    k = pt.get("part")
    if k == "window":
        st = dict(STYLES[pt.get("style", "vale_timber")]); st.update(pt.get("materials", {})); st["_name"] = pt.get("name", f"window{ctx.n}"); ctx.n += 1
        window(ctx, pt["rect"], pt["side"], pt.get("at", 0), pt["floor"], st, pt.get("w", 1), pt.get("h", 2), pt.get("head_room", 9),
               pt.get("frame", st.get("frame_kind", "flush")), pt.get("shutters", False), pt.get("sill"))
        return
    if k == "door":
        st = dict(STYLES[pt.get("style", "vale_timber")]); st.update(pt.get("materials", {})); st["_name"] = pt.get("name", f"door{ctx.n}"); ctx.n += 1
        door(ctx, pt["rect"], pt["side"], pt.get("at", 0), pt["floor"], st, pt.get("kind", "house"), pt.get("canopy", True), pt.get("steps", 0),
             pt.get("frame", st.get("frame_kind", "flush")))
        return
    if k not in PARTS: raise ValueError(f"unknown part '{k}' (known: {', '.join(sorted(PARTS) + ['window', 'door'])})")
    PARTS[k](ctx, pt)
