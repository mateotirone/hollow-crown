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
                        frame="stripped_dark_oak_log", infill="calcite", floor="spruce_planks", trim="dark_oak_planks",
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
}
WOOD_OF = lambda b: next((w for w in ("dark_oak", "pale_oak", "spruce", "birch", "jungle", "acacia", "mangrove", "cherry", "poplar", "bamboo",
                                      "crimson", "warped", "oak") if b.startswith(w) or b.startswith("stripped_" + w)), "spruce")


class Context:
    def __init__(self, cells, stage_of, log, spec):
        self.cells, self.stage_of, self.log, self.spec = cells, stage_of, log, spec
        self.spec.setdefault("materials", {})
        self.n = 0
        self.roofs = []          # height fields registered by roof parts, built together at the end of each house

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
            ctx.setif(*at(k, 1, 2), S, raw=f"{sw}_wall_sign", facing=side)
        lk, rk = -(w // 2) - 1, w // 2 + 1
        ctx.setif(*at(lk, 1, 1), S, raw=f"{sw}_wall_sign", facing=_dir_of(-rx, -rz))
        ctx.setif(*at(rk, 1, 1), S, raw=f"{sw}_wall_sign", facing=_dir_of(rx, rz))
    elif sill == "stair":     # right-way stair, tall side to the wall, one wider each side with slab ends
        for k in ks: ctx.set(*at(k, 1, 1), S, "stairs", trim if frame_kind != "stone" else ctx.mat(style, "infill"), facing=OPP[side], half="bottom")
        for k in (-(w // 2) - 1, w // 2 + 1): ctx.setif(*at(k, 1, 1), S, "slab", trim if frame_kind != "stone" else ctx.mat(style, "infill"), half="bottom")
    elif sill == "slab":
        for k in range(-(w // 2) - 1, w // 2 + 2): ctx.set(*at(k, 1, 1), S, "slab", trim, half="top")


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
    stairs facing uphill, inner corners in valleys, outer corners on hips, a full block + bottom slab on
    the ridge, verge stairs with a barge board under, an eave row, a trim block at each verge corner."""
    if not roofs: return
    H, info = {}, {}
    for F, r in roofs:
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
                ctx.set(x, row + 1, z, S, "slab", r.get("cap", mat), half="bottom")
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
        x0, z0, x1, z1 = r["rect"]; ridge = r["ridge"]; P = r["base"]
        for (x, z) in F:
            if H.get((x, z)) != F[(x, z)][0]: continue          # covered by a higher roof
            row = H[(x, z)]
            if r["kind"] == "gable":
                gable_end = (ridge == "x" and (x < x0 or x > x1)) or (ridge == "z" and (z < z0 or z > z1))
                if gable_end:
                    up = [f for f, (dx, dz) in DIRS.items() if H.get((x + dx, z + dz), -99) > row]
                    if up: ctx.setif(x, row - r["pitch"], z, S, "stairs", trim, facing=OPP[up[0]], half="top")
                    else: ctx.setif(x, row - 1, z, S, "full", trim)
            eave = F[(x, z)][1] == 0
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
        for (x, z) in cells:
            for y in range(P, H.get((x, z), P)):
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
def house(ctx, s):
    """A building by the stages: foundation, frame, floors, walls, openings, roof, details."""
    st = dict(STYLES[s.get("style", "vale_timber")] if isinstance(s.get("style", "vale_timber"), str) else {})
    if isinstance(s.get("style"), dict): st.update(STYLES.get(s["style"].get("base", "vale_timber"), {})); st.update(s["style"])
    st.update(s.get("materials", {}))
    st["_name"] = s.get("name", f"house{ctx.n}"); ctx.n += 1
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
    for i, (fl, rr, h) in enumerate(zip(floors, rects, storeys)):
        x0, z0, x1, z1 = rr
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
                    if corner or t in posts:
                        ctx.set(x, yy, z, "frame", "full", M("frame"), axis="y")
                    elif beam:
                        ctx.set(x, yy, z, "frame", "full", M("frame"), axis=ax)
                    else:
                        ctx.set(x, yy, z, "walls", "full", M("infill"))
                    if fk == "proud" and (corner or t in posts or beam):
                        ox, oz = DIRS[sd]
                        ctx.set(x + ox, yy, z + oz, "frame", "full", M("frame"), axis="y" if (corner or t in posts) else ax)
            # string course at upper floor lines on stone buildings (02 step 3 / 07)
            if fk == "stone" and i > 0:
                ox, oz = DIRS[sd]
                for t in range(-(L // 2), L // 2 + 1):
                    x, z = wall_cell(rr, sd, t)
                    ctx.set(x + ox, fl, z + oz, "details", "stairs", M("infill"), facing=OPP[sd], half="top")
        # jetty brackets: an upside-down trim stair under every upper post on a jettied side (02 step 5)
        if i > 0:
            for sd in jetty:
                L = side_len(rr, sd)
                for t in posts_of[(i, sd)]:
                    x, z = wall_cell(rr, sd, t)
                    ctx.set(x, fl - 1, z, "frame", "stairs", M("trim"), facing=OPP[sd], half="top")
    if fk == "stone" and len(storeys) > 1:   # string-course corners wrap with outer-corner stairs
        for i in range(1, len(storeys)):
            x0, z0, x1, z1 = rects[i]
            for (cx, cz, fa, fb) in ((x0 - 1, z0 - 1, "n", "w"), (x1 + 1, z0 - 1, "n", "e"), (x0 - 1, z1 + 1, "s", "w"), (x1 + 1, z1 + 1, "s", "e")):
                fc, cn = corner_stair(fa, fb)
                ctx.set(cx, floors[i], cz, "details", "stairs", M("infill"), facing=fc, half="top", corner=cn)
    # ---- 5 openings
    dspec = s.get("door", {"side": "s"})
    dside, dt = dspec.get("side", "s"), dspec.get("at", 0)
    door(ctx, rects[0], dside, dt, floors[0], st, kind=dspec.get("kind", "house"), canopy=dspec.get("canopy", True),
         steps=dspec.get("steps", plinth), frame_kind=fk)
    wspec = s.get("windows", "auto")
    shutter_share = s.get("shutters", 0.3 if fk != "proud" else 0.0)
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
                head_room = (fl + h) - (fl + 2 + wh)
                sh = wv.get("shutters")
                if sh is None:   # symmetric pairs across a front, about 30% (05: shutters)
                    sh = shutter_share > 0 and h3(abs(t), i, "nsew".index(sd), 17) < shutter_share and ww in (1, 3)
                window(ctx, rr, sd, t, fl, st, ww, wh, head_room, fk, sh, wv.get("sill"))
    # ---- 6 roof
    rs = s.get("roof", {})
    kind = rs.get("type", "gable"); pitch = rs.get("pitch", 1)
    top = rects[-1]
    rmat = ctx.mat(st, "roof")
    F, ridge = roof_field(top, kind, rs.get("ridge"), rs.get("overhang", 1), rs.get("verge", 1), pitch, plate)
    rinfo = {"rect": top, "ridge": ridge, "base": plate, "kind": kind, "pitch": pitch, "mat": rmat, "cap": rs.get("cap", rmat)}
    ctx.spec["materials"][rmat] = _with_range(ctx.spec["materials"][rmat], plate, max(v[0] for v in F.values()))
    ch = s.get("chimney", "auto")
    chs = []
    if ch:
        if ch == "auto":       # through the ridge, two in from a gable end (06 step 9)
            x0, z0, x1, z1 = top
            chs = [((x1 - 2, (z0 + z1) // 2) if ridge == "x" else ((x0 + x1) // 2, z1 - 2))]
        else: chs = [tuple(c) for c in (ch if isinstance(ch[0], list) else [ch])]
    for c in chs:
        for yy in range(plate + 1, plate + 40): ctx.clear(c[0], yy, c[1])
    Hf = build_roofs(ctx, [(F, rinfo)], st, chimneys=set(chs))
    gable_walls(ctx, rinfo, Hf, st, fk)
    for (cx, cz) in chs: chimney(ctx, cx, cz, floors[0] + 1, Hf, st)
    # ---- 7 details: a lantern by the door when there is no canopy
    return {"floors": floors, "rects": rects, "plate": plate}


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


PARTS = {"house": house, "arch": arch, "string_course": string_course, "buttress": buttress, "hanging_lantern": hanging_lantern}


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
