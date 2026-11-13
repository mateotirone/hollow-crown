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
import math
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
    # Saltreach's sea-temple look (Atlantean, Mateo 2026-11-12): pale stone walls, quartz-pillar column corners,
    # a sea-worn prismarine plinth and trim, sea-glass windows; roofs vary (regions/saltreach.md "Atlantean houses")
    "salt_atlantean": dict(plinth={"ladder": ["prismarine_bricks", "prismarine", "dark_prismarine"], "axis": "noise", "scale": 3},
                           frame={"block": "quartz_pillar", "forms": {"wall": "diorite_wall", "slab": "smooth_quartz_slab", "stairs": "smooth_quartz_stairs"}},
                           infill={"ladder": ["polished_diorite", "calcite", "smooth_quartz"], "axis": "y"},
                           floor="smooth_sandstone", trim={"block": "prismarine_bricks", "forms": {"trapdoor": "warped_trapdoor", "wall": "prismarine_wall"}},
                           roof={"block": "dark_prismarine"}, shutter="warped_planks", panel=None,
                           door="warped_door", glass="light_blue_stained_glass_pane", leaves="azalea_leaves", sign_wood="warped",
                           chimney="prismarine_bricks", quoin={"block": "quartz_pillar", "forms": {"wall": "diorite_wall", "slab": "smooth_quartz_slab", "stairs": "smooth_quartz_stairs"}},
                           stone={"block": "smooth_quartz", "forms": {"wall": "diorite_wall"}}, frame_kind="stone", sill="stair"),
    "fen_timber": dict(plinth={"ladder": ["mud_bricks", "tuff_bricks"], "axis": "noise", "scale": 3}, frame="mangrove_log",
                       infill={"ladder": ["packed_mud", "mud_bricks"], "axis": "y"}, floor="dark_oak_planks", trim="spruce_planks",
                       roof={"block": "dark_oak_planks"}, shutter="mangrove_planks", door="mangrove_door", glass="brown_stained_glass_pane",
                       leaves="mangrove_leaves", bracket="mud_brick_wall", sign_wood="mangrove", chimney="mud_bricks", quoin="tuff_bricks", stone="mud_bricks",
                       frame_kind="proud", sill="stair"),
    "ember_sandstone": dict(plinth={"block": "sandstone"}, frame="cut_sandstone", infill={"ladder": "EMB-01", "axis": "y"},
                            floor="acacia_planks", trim="acacia_planks", roof={"block": "smooth_red_sandstone"}, shutter="acacia_planks",
                            door="acacia_door", glass="orange_stained_glass_pane", leaves="jungle_leaves", bush=None, sign_wood="acacia",
                            chimney="sandstone", quoin="cut_sandstone", stone="smooth_sandstone", frame_kind="stone", sill="stair"),
    # Everwake, the city in the sky (regions/everwake.md): white stone, aged copper roofs, gold, pale blue glass
    "everwake_stone": dict(plinth={"ladder": ["polished_diorite", "calcite"], "axis": "noise", "scale": 3}, frame="smooth_quartz",
                           infill={"ladder": ["polished_diorite", "calcite"], "axis": "y"}, floor="birch_planks", trim="birch_planks",
                           roof={"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}, shutter="birch_planks",
                           door="birch_door", glass="light_blue_stained_glass_pane", leaves="azalea_leaves", sign_wood="birch",
                           chimney="quartz_bricks", quoin="diorite", stone="smooth_quartz", panel="birch_trapdoor", frame_kind="stone", sill="stair"),
    "hollow_timber": dict(plinth={"ladder": ["cobbled_deepslate", "polished_blackstone_bricks"], "axis": "noise", "scale": 3},
                          frame="dark_oak_log", infill="siege:pale_ash", floor="dark_oak_planks", trim="dark_oak_planks",
                          roof={"ladder": ["cobbled_deepslate", "deepslate_tiles"], "axis": "y"}, shutter="dark_oak_planks",
                          door="dark_oak_door", glass="iron_bars", leaves="azalea_leaves", bush=None, sign_wood="dark_oak",
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
    if frame_kind == "stone" and style.get("panel", "dark_oak_trapdoor"):   # dark oak panels either side (05: stone, dark oak, spruce); style "panel" swaps or drops them
        for k in (-(w // 2) - 1, w // 2 + 1):
            for dy in range(2, 2 + h): ctx.set(*at(k, dy, 1), S, raw=style.get("panel", "dark_oak_trapdoor"), open=True, facing=side)
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
    for dd in (lo_d - 1, hi_d + 1):   # a window box, sill or shutter left hanging in front of the opening goes (Mateo 2026-11-12)
        for k in range(-hw, hw + 1):
            for dy in range(h):
                if ctx.stage_of.get(P(k, dy, dd)) in ("openings", "details"): ctx.clear(*P(k, dy, dd))
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
def rise(pitch, d, profile=None):
    """Height of a roof row d steps in from the eave: d * pitch, or the sum of a profile of per-row pitches
    (Saltreach curved roofs, Mateo 2026-11-12: [1, 1, 2] swells into a bell, [2, 1] is a mansard)."""
    if not profile: return d * pitch
    return sum(profile[min(i, len(profile) - 1)] for i in range(d))


def step_at(r, d):
    """The pitch of the step just below roof row d (how many full blocks go under its stair)."""
    pr = r.get("profile")
    if not pr: return r["pitch"]
    return pr[min(max(d - 1, 0), len(pr) - 1)]


def curve_profile(rect, ridge, overhang=1):
    """Per-row pitches of a curved (barrel) roof (06 roof-types 16): a quarter circle each side, steep at
    the eaves and nearly flat at the top, never a row with no rise (that would read as a flat band)."""
    import math
    x0, z0, x1, z1 = rect
    if ridge is None: ridge = "x" if (x1 - x0) >= (z1 - z0) else "z"
    n = ((z1 - z0) if ridge == "x" else (x1 - x0)) // 2 + overhang     # rows from the eave to the ridge
    R = n + 0.5
    h = [R * math.sqrt(max(0.0, 1 - ((R - d) / R) ** 2)) for d in range(n + 1)]
    h = [x * (n * 1.1) / max(h[-1], 1) for x in h]                       # about as tall as a pitch 1 roof
    out, acc = [], 0
    for d in range(n):
        step = max(1, min(3, round(h[d + 1] - acc)))
        out.append(step); acc += step
    return out


def roof_field(rect, kind, ridge, overhang, verge, pitch, base, profile=None):
    """-> {(x, z): (row, d, dmax)} for one roof. row = the row of the roof surface block at that cell.
    kind "curved" is a gable with a quarter-circle profile (curve_profile)."""
    if kind == "curved":
        kind = "gable"; profile = profile or curve_profile(rect, ridge, overhang)
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
            F[(x, z)] = (base + rise(pitch, d, profile), d, dmax)
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
        mat = r["mat"]; pitch = step_at(r, d)
        hi = [f for f, (dx, dz) in DIRS.items() if H.get((x + dx, z + dz), -99) > row]
        if (x, z) in chimneys: continue
        if not hi:
            diag = [(dx, dz) for dx in (-1, 1) for dz in (-1, 1) if H.get((x + dx, z + dz), -99) > row]
            if diag:     # hip edge: outer corner towards the higher diagonal
                dx, dz = diag[0]; f = _dir_of(0, dz); g = _dir_of(dx, 0)
                ctx.set(x, row, z, S, "stairs", mat, facing=f, half="bottom", corner="outer_left" if g == LEFT[f] else "outer_right")
                for k in range(1, pitch):    # a steep step on the hip line needs its full blocks too (no hole at the corner)
                    ctx.set(x, row - k, z, S, "full", mat)
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
                    if up: ctx.setif(x, row - step_at(r, F[(x, z)][1]), z, S, "stairs", trim, facing=OPP[up[0]], half="top")
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
    dwidth = 0
    if dspec:
        dwidth = door(ctx, rects[0], dside, dt, floors[0], st, kind=dspec.get("kind", "house"), canopy=dspec.get("canopy", True),
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
    if dside:   # 05 door approach (Mateo 2026-11-12): nothing sticks out at foot or hand height beside the door
        x, z = wall_cell(rects[0], dside, dt); ox, oz = DIRS[dside]; rx, rz = RIGHT_OF[dside]
        for k in range(-(dwidth // 2) - 1, dwidth // 2 + 2):
            for dy in (1, 2):
                c = (x + rx * k + ox, floors[0] + dy, z + rz * k + oz)
                if ctx.stage_of.get(c) == "openings": ctx.clear(*c)
                elif k == 0 and ctx.stage_of.get(c) == "frame": ctx.clear(*c)   # a proud post never stands in the doorway


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
    prof = rs.get("profile")
    if kind == "curved":     # a barrel roof (06 roof-types 16): a gable whose rows rise steep then flatten
        prof = prof or curve_profile(top, rs.get("ridge"), rs.get("overhang", 1)); kind = "gable"
    F, ridge = roof_field(top, kind, rs.get("ridge"), rs.get("overhang", 1), rs.get("verge", 1), pitch, plate, prof)
    r = {"rect": top, "ridge": ridge, "base": plate, "kind": kind, "pitch": pitch, "mat": rmat, "cap": rs.get("cap", rmat), "profile": prof,
         "horns": rs.get("gable_horns", False)}
    if not k: ctx.last_roof = {a: b for a, b in raw_roof(ctx, st).items() if a not in ("from", "to")} if isinstance(raw_roof(ctx, st), dict) else raw_roof(ctx, st)
    ctx.spec["materials"][rmat] = _with_range(ctx.spec["materials"][rmat], plate, max(v[0] for v in F.values()))
    return F, r


def _flat_roof(ctx, r, st, H):
    """06 roof-types 18 / palettes/emberwaste.md: the roof layer on the wall top (no gap), a parapet one high
    round it (slabs, crenels, walls or none) with posts on the corners, and an optional hatch.
    Default deck (Mateo 2026-11-12): vigas, logs running right across the building wall to wall and one
    block out on both sides, every other block along its length, with top slabs of the roof block between
    them, so log, slab, log, slab is the roof. roof keys: parapet, parapet_mat, beams (true default, a log
    id, or false for a plain full layer), hatch (true)."""
    f = r["flat"]; x0, z0, x1, z1 = r["rect"]; y = r["base"] + 1; m = r["mat"]
    beams = f.get("beams", True)
    log = beams if isinstance(beams, str) else "spruce_log"
    long_x = (x1 - x0) >= (z1 - z0)                       # logs span the short way, spaced along the long way
    def is_beam(x, z):
        a = (x - x0) if long_x else (z - z0); n = (x1 - x0) if long_x else (z1 - z0)
        return 0 < a < n and a % 2 == 1
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            if beams and is_beam(x, z): ctx.set(x, y, z, "roof", raw=log, axis="z" if long_x else "x")
            elif beams and not edge: ctx.set(x, y, z, "roof", "slab", m, half="top")
            else: ctx.set(x, y, z, "roof", "full", m)
            H[(x, z)] = max(H.get((x, z), -99), y)
    if beams:                                              # the log ends stick out one block on both sides
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                if not is_beam(x, z): continue
                if long_x and z in (z0, z1): ctx.setif(x, y, z + (1 if z == z1 else -1), "roof", raw=log, axis="z")
                if not long_x and x in (x0, x1): ctx.setif(x + (1 if x == x1 else -1), y, z, "roof", raw=log, axis="x")
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
    if f.get("hatch"):
        cx, cz = (x0 + x1) // 2, (z0 + z1) // 2
        if beams and is_beam(cx, cz): cx, cz = (cx + 1, cz) if long_x else (cx, cz + 1)
        ctx.set(cx, y, cz, "roof", "trapdoor", ctx.mat(st, "trim"), half="top")


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
    # 05 windows line up (Mateo 2026-11-12): the dormer's window stands over a window of the storey below
    if d.get("align", True):
        i = len(B["storeys"]) - 1
        ws = ctx.spec_windows.get(side) if getattr(ctx, "spec_windows", None) is not None else None
        if ws is not None: cs = [wv["at"] for wv in ws if wv.get("storey", 0) == i]
        else:
            cs, sz = bay_centres(B["posts_of"].get((i, side), []))
            cs = [c for c, b in zip(cs, sz) if b >= 3]
        if cs and t not in cs:
            t2 = min(cs, key=lambda c: (abs(c - t), abs(c)))
            ctx.log.append(f"{st['_name']}: dormer on the {side} side moved from {t} to {t2} to stand over the window below")
            t = t2
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
        nxt = Fmain.get((cx - ox, cz - oz))
        if nxt is None or nxt[0] < Fmain.get((cx, cz), (0,))[0]:      # past the main ridge: stop here
            ctx.log.append(f"{st['_name']}: dormer on the {side} side is taller than the main roof; lower its h or the window")
            break
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
    # the dormer's roof stairs face down the main slope like the rest of the roof (Mateo 2026-11-12: sideways
    # stairs read as turned against the main roof); the ridge cap stays
    up = OPP[side]; sideways = {d for d in DIRS if DIRS[d][0] * ox + DIRS[d][1] * oz == 0}
    for (cx, cz) in set(dm["cells"]) | {(cx + rx * s_, cz + rz * s_) for (cx, cz) in dm["cells"] for s_ in (-1, 1)}:
        for y in range(r["base"], H.get((cx, cz), r["base"]) + 2):
            c = ctx.get(cx, y, cz)
            if (c and c.get("kind") == "stairs" and ctx.stage_of.get((cx, y, cz)) == "roof"
                    and c.get("props", {}).get("half", "bottom") == "bottom" and c.get("props", {}).get("facing") in sideways):
                c["props"] = dict(c.get("props", {}), facing=up, corner="none")
    # every overhang carried (07; Mateo 2026-11-12, "it helps frame the window"): a bracket under the dormer
    # roof's front overhang either side of the window. Style "bracket": "stairs" (upside-down trim stair,
    # default), "fence" (trim fence) or a block id such as "mud_brick_wall"
    br = st.get("bracket", "stairs")
    for k in (-(w // 2), w // 2):
        fx, fz = x + rx * k + ox, z + rz * k + oz
        ys = [y for y in range(plate, plate + 30) if ctx.stage_of.get((fx, y, fz)) == "roof"]
        if not ys: continue
        by = min(ys) - 1
        if not ctx.free(fx, by, fz): continue
        if br == "stairs": ctx.set(fx, by, fz, "roof", "stairs", ctx.mat(st, "trim"), facing=OPP[side], half="top")
        elif br == "fence": ctx.set(fx, by, fz, "roof", "post", ctx.mat(st, "trim"))
        else: ctx.set(fx, by, fz, "roof", raw=br)
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
    if p.get("post"):            # columns instead of log posts (Saltreach porticoes: quartz pillars)
        frame = f"{st['_name']}.porch_post"; ctx.spec["materials"][frame] = p["post"]
    cells = [(x + rx * k + ox * j, z + rz * k + oz * j) for k in range(-(w // 2), w // 2 + 1) for j in range(1, dpt + 1)]
    for (cx, cz) in cells:
        ctx.set(cx, fl, cz, "foundation", "full", plinth)
        for yy in range(B["y"], fl): ctx.setif(cx, yy, cz, "foundation", "full", plinth)
    every = p.get("every")       # a colonnade: a post every n along the front as well as the corners
    ks = sorted(set([-(w // 2), w // 2] + ([k for k in range(-(w // 2), w // 2 + 1) if (k + w // 2) % every == 0] if every else [])))
    for k in ks:
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
    st = _style(ctx, s); ctx.last_style = st
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
                               rs.get("pitch", 1), wy + sum(sty) - 1, rs.get("profile"))
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
    ctx.spec_windows = s.get("windows") if s.get("windows", "auto") != "auto" else None
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
    for _, _, bst, bB in roofs: close_plate(ctx, bB, bst)
    # ---- 7 details
    for (F, r, bst, bB), (bs, _, _) in zip(roofs, blocks):
        tr = bs.get("trusses", s.get("trusses", "auto"))
        if tr: trusses(ctx, r, Hf, bst, bB, tr)
        fin = bs.get("finials", s.get("finials", "spikes"))
        if fin: finials(ctx, r, Hf, fin, {c for c, _, _ in chs}, bst)
    if s.get("vines"): vines(ctx, blocks, s["vines"])
    if s.get("bushes", True) and not s.get("stilts"): bushes(ctx, blocks, s.get("bushes", True))
    for (F, r, bst, bB), (bs, _, _) in zip(roofs, blocks):     # roof dressings (regions/*.md)
        rs = bs.get("roof", {})
        if rs.get("thatch"): _thatch(ctx, F, r, Hf)
        if rs.get("moss"): _moss(ctx, F, r, Hf, rs["moss"])
    if s.get("stilts"): _stilts(ctx, s, st, B, s["stilts"])
    if s.get("piles"): _piles(ctx, s, B, s["piles"])
    for g in s.get("galleries", []): _gallery(ctx, g, st, B)
    if s.get("offset"): _offset(ctx, s, st, B, s["offset"], {c for c, _, _ in chs})
    if s.get("lean"):
        x0_, z0_, x1_, z1_ = B["rects"][0]
        _lean(ctx, (x0_ - 3, z0_ - 3, x1_ + 3, z1_ + 3), B["y"], B["plate"], s["lean"], ctx.mat(st, "trim"))
    if s.get("snow") or s.get("roof", {}).get("snow"): _snow(ctx, blocks, s.get("snow") or s["roof"]["snow"])
    # ---- 8 interiors (08-interiors): stairs, rooms by use, a one-block walkway, light (interiors.py)
    import interiors
    ctx.chimneys = {c for c, _, _ in chs}
    interiors.furnish(ctx, s, st, blocks)
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


def close_plate(ctx, B, st):
    """No open row between a wall's top and its roof (kit close_plate, refinement thread 2026-11-12): on the
    top storey's outline, any free cells between the wall plate and the first roof cell above get infill."""
    x0, z0, x1, z1 = B["rects"][-1]; plate = B["plate"]; n = 0
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if not (x in (x0, x1) or z in (z0, z1)) or ctx.free(x, plate, z): continue
            above = [y for y in range(plate + 1, plate + 40) if ctx.stage_of.get((x, y, z)) == "roof"]
            if not above: continue
            gap = [y for y in range(plate + 1, min(above)) if ctx.free(x, y, z)]
            if gap and len(gap) == min(above) - plate - 1 and len(gap) <= 2:     # a missed row, not a gable or a join
                for y in gap: ctx.set(x, y, z, "walls", "full", ctx.mat(st, "infill")); n += 1
    if n: ctx.log.append(f"{st['_name']}: closed {n} open cells between the wall top and the roof")


def _is_window(c):
    n = (c or {}).get("name", "") if (c or {}).get("kind") == "raw" else ""
    return "glass" in n or n in ("iron_bars", "ochre_froglight", "pearlescent_froglight", "verdant_froglight")


def bushes(ctx, blocks, opt=True):
    """Foundation planting (07-detailing; Mateo 2026-11-12: "not one string of grass around it, but just under
    the windows and stuff, so it looks like bushes"): a clump of leaf blocks on the ground under each
    ground-floor window (the window's width and one either side, with gaps, now and then two high where it
    stays below the sill) and at about half the corners. Other stretches stay bare; the door and its steps
    stay clear; everything sits one out from the wall, inside the roof overhang. Leaves from the style's
    "bush" (default its "leaves"; none in the Emberwaste and the Hollow). {"share": 0.8} thins the clumps."""
    share = opt.get("share", 0.8) if isinstance(opt, dict) else 0.8
    for s, st, B in blocks[:1] + [b for b in blocks[1:] if b[0].get("bushes", True)]:
        leaf = st.get("bush", st.get("leaves"))
        if not leaf: continue
        gy, fl, rr = B["y"], B["floors"][0], B["rects"][0]
        def put(x, y, z, k):
            if not ctx.free(x, y, z): return False
            name = leaf + ("_flowered" if leaf == "azalea_leaves" and h3(x, y, z, 97) < 0.35 else "")
            ctx.set(x, y, z, "details", raw=name); return True
        for sd in "nsew":
            ox, oz = DIRS[sd]; L = side_len(rr, sd)
            col = {t_: wall_cell(rr, sd, t_) for t_ in range(-(L // 2), L // 2 + 1)}
            win = {t_ for t_, (x, z) in col.items() if any(_is_window(ctx.get(x, y, z)) for y in range(fl + 1, fl + 3))}
            door = {t_ for t_, (x, z) in col.items() if any(str((ctx.get(x, y, z) or {}).get("name", "")).endswith("_door")
                                                          or (ctx.get(x, y, z) or {}).get("kind") == "door" for y in range(fl, fl + 3))}
            sill = min([y for t_ in win for y in range(fl + 1, fl + 3) if _is_window(ctx.get(*col[t_][:1], y, col[t_][1]))] or [fl + 1])
            want = set(win)                      # under the window only, so clumps stay apart
            for t_ in win:                       # now and then one more beside a window, never joining the next clump
                for d in (-1, 1):
                    if t_ + d not in win and t_ + 2 * d not in win and h3(*col[t_], 89 + d) < 0.35: want.add(t_ + d)
            want -= {t_ + d for t_ in door for d in (-1, 0, 1)}
            for t_ in sorted(want):
                if t_ not in col: continue
                x, z = col[t_]; bx, bz = x + ox, z + oz
                if h3(bx, gy, bz, 91) > share: continue
                if put(bx, gy, bz, 0) and gy + 1 < sill and t_ in win and h3(bx, gy, bz, 93) < 0.3: put(bx, gy + 1, bz, 1)
        x0, z0, x1, z1 = rr
        for cx, cz, dx, dz in ((x0, z0, -1, -1), (x1, z0, 1, -1), (x0, z1, -1, 1), (x1, z1, 1, 1)):
            if h3(cx, gy, cz, 95) > 0.5: continue
            for bx, bz in ((cx + dx, cz), (cx, cz + dz), (cx + dx, cz + dz)):
                if h3(bx, gy, bz, 99) < 0.85: put(bx, gy, bz, 0)


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
    # 07 walkways (Mateo 2026-11-12): the covered ground is walked in, so window sills, boxes and shutters of
    # the wall behind do not stick into it; leave at least one block of clear walk (two high) under the roof
    for (x, z) in span:
        for yy in range(y0 + 1, y0 + 4):
            stg = ctx.stage_of.get((x, yy, z))
            if stg == "openings" or (stg == "frame" and j_of(x, z) == 0): ctx.clear(x, yy, z)   # proud wall frame too


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
            for z in range(z0, z1 + 1):
                if (x, deck, z) not in getattr(ctx, "hatches", ()): ctx.set(x, deck, z, "floors", "full", dm)   # keep the tower's roof hatch
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
    if s.get("marks", n >= 5):          # hour marks at 12, 3, 6 and 9 just inside the rim (towers/README.md, the clock)
        mk = s.get("mark", hand)
        for (u, v) in ((0, r), (r, 0), (0, -r), (-r, 0)):
            if (u, v) not in hands: ctx.set(*P(u, v), "details", raw=mk)
    fr = s.get("frame")
    if fr == "stairs":                  # a raised frame one out: stairs along top and bottom, trapdoors up the sides
        wood = s.get("frame_wood", "dark_oak")
        for u in range(-r - 1, r + 2):
            for v, half in ((r + 1, "top"), (-r - 1, "bottom")):
                c = P(u, v); ctx.set(c[0] + ox, c[1], c[2] + oz, "details", raw=f"{wood}_stairs", facing=OPP[sd], half=half)
        for v in range(-r, r + 1):
            for u in (-r - 1, r + 1):
                c = P(u, v); ctx.set(c[0] + ox, c[1], c[2] + oz, "details", raw=f"{wood}_trapdoor", open=True, facing=sd)
    elif fr:
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


# ------------------------------------------------------------------ regional dressings (regions/*.md)
def _roof_cells(ctx, F, r, H):
    """(x, z, row, d) of this roof's own surface cells (not covered by a higher roof)."""
    own = r.get("_F", F)
    return [(x, z, H[(x, z)], v[1]) for (x, z), v in own.items() if H.get((x, z)) == v[0]]


def _chimney_cell(v):
    return str(v.get("mat", "")).endswith(".chimney")


def _moss(ctx, F, r, H, share=0.13):
    """Blackfen mossy shingle (palettes/blackfen.md, settle_halls.thatch): moss blocks on the ridge, moss on
    about 13% of the slope (more on the north, shady side), moss carpet in place of the ridge cap."""
    share = 0.13 if share is True else share
    for x, z, row, d in _roof_cells(ctx, F, r, H):
        v = ctx.get(x, row, z)
        if not v or ctx.stage_of.get((x, row, z)) != "roof" or _chimney_cell(v): continue   # the chimney stays stone
        shade = 1.5 if v.get("props", {}).get("facing") == "s" else 1.0      # a north-facing slope faces s-up
        if v.get("kind") == "full":
            ctx.set(x, row, z, "roof", raw="moss_block")
            cap = ctx.get(x, row + 1, z)
            if cap and ctx.stage_of.get((x, row + 1, z)) == "roof": ctx.set(x, row + 1, z, "roof", raw="moss_carpet")
        elif v.get("kind") == "stairs" and h3(x, row, z, 71) < share * shade:
            ctx.set(x, row, z, "roof", raw="mossy_cobblestone_stairs", **v.get("props", {}))   # moss in the stair's shape


def _thatch(ctx, F, r, H):
    """Thatch on barns and stores (regions_towns.thatch_roof): hay blocks on the slopes, the roof's stairs
    kept along the eaves and verges, a moss ridge."""
    x0, z0, x1, z1 = r["rect"]
    for x, z, row, d in _roof_cells(ctx, F, r, H):
        v = ctx.get(x, row, z)
        if not v or ctx.stage_of.get((x, row, z)) != "roof" or _chimney_cell(v): continue   # the chimney stays stone
        edge = d == 0 or not (x0 <= x <= x1 and z0 <= z <= z1)
        if v.get("kind") == "full":
            ctx.set(x, row, z, "roof", raw="moss_block")
            if ctx.get(x, row + 1, z) and ctx.stage_of.get((x, row + 1, z)) == "roof": ctx.set(x, row + 1, z, "roof", raw="moss_carpet")
        elif v.get("kind") == "stairs" and not edge:
            ctx.set(x, row, z, "roof", raw="hay_block", axis="y")


def _snow(ctx, blocks, how=True):
    """Frostmarch snow (palettes/frostmarch.md, regions_towns.snow_cap): a snow layer on every ridge in place
    of the ridge cap, and on chimney tops, corner blocks and other full blocks open to the sky. Snow layers
    only go on full blocks, so slopes of stairs stay bare (they would not hold a layer)."""
    xs = [c for bs, bst, bB in blocks for rr in bB["rects"] for c in (rr[0] - 3, rr[2] + 3)]
    zs = [c for bs, bst, bB in blocks for rr in bB["rects"] for c in (rr[1] - 3, rr[3] + 3)]
    tops = {}
    for (x, y, z) in ctx.cells:
        if min(xs) <= x <= max(xs) and min(zs) <= z <= max(zs): tops[(x, z)] = max(tops.get((x, z), y), y)
    for (x, z), y in tops.items():
        v = ctx.get(x, y, z)
        if v.get("kind") == "stairs" and ctx.stage_of.get((x, y, z)) == "roof":
            below = ctx.get(x, y - 1, z)
            if below and below.get("kind") == "full" and ctx.stage_of.get((x, y - 1, z)) == "roof":   # the ridge cap
                ctx.set(x, y, z, "roof", raw="snow_layer", height=1)
        elif v.get("kind") == "full" or (v.get("kind") == "raw" and v.get("name") in ("stone_bricks", "deepslate_bricks")):
            ctx.setif(x, y + 1, z, "details", raw="snow_layer", height=0)


def _stilts(ctx, s, st, B, o):
    """Blackfen stilt house (01-foundation, regions/blackfen.md): set the house's "y" to the platform height
    and give "stilts": {"ground": 0}. Mangrove log stilts under every corner and frame post down to the
    ground, the plinth course becomes a plank platform, and a stair runs down from a 3 x 1 landing at the
    door. Keys: ground, log, platform, stair (true), side (the door's side)."""
    o = {} if o is True else o
    g = o.get("ground", 0); log = o.get("log", "mangrove_log"); plat = o.get("platform", "mangrove_planks")
    y = B["y"]; x0, z0, x1, z1 = B["rects"][0]
    for yy in range(y, y + B["plinth"]):
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                if x in (x0, x1) or z in (z0, z1): ctx.set(x, yy, z, "foundation", raw=plat)
    stilt = set((x, z) for x in (x0, x1) for z in (z0, z1))
    for sd in "nsew":
        L = side_len(B["rects"][0], sd)
        for t_ in B["posts_of"][(0, sd)]: stilt.add(wall_cell(B["rects"][0], sd, t_))
        for t_ in range(-(L // 2), L // 2 + 1, 2): stilt.add(wall_cell(B["rects"][0], sd, t_))
    for (x, z) in stilt:
        for yy in range(g, y): ctx.set(x, yy, z, "foundation", raw=log, axis="y")
    if not o.get("stair", True) or not s.get("door"): return
    sd = s["door"].get("side", "s"); at = s["door"].get("at", 0)
    ox, oz = DIRS[sd]; rx, rz = RIGHT_OF[sd]
    fl = y + B["plinth"] - 1
    dx, dz = wall_cell(B["rects"][0], sd, at)
    for k in (-1, 0, 1):                                     # the landing, level with the floor
        lx, lz = dx + ox + rx * k, dz + oz + rz * k
        ctx.set(lx, fl, lz, "foundation", raw=plat)
        if k != 0:
            for yy in range(g, fl): ctx.set(lx, yy, lz, "foundation", raw=log, axis="y")
    for i in range(1, fl - g + 1):                           # the stair down, away from the door
        sx, sz, sy = dx + ox * (1 + i), dz + oz * (1 + i), fl - i + 1
        ctx.clear(sx, sy + 1, sz)
        ctx.set(sx, sy, sz, "foundation", raw=plat.replace("_planks", "_stairs"), facing=OPP[sd], half="bottom")
        for yy in range(g, sy): ctx.setif(sx, yy, sz, "foundation", raw=plat.replace("_planks", "_fence"))


def _piles(ctx, s, B, o):
    """Blackfen on a plot (refinement thread 2026-11-12, regions/blackfen.md): the footprint and door step
    stay; the plinth course becomes mangrove log piles at the corners and every other edge block, driven
    two below the ground, with mangrove roots between them."""
    o = {} if o is True else o
    log = o.get("log", "mangrove_log"); roots = o.get("roots", "mangrove_roots"); depth = o.get("depth", 2)
    x0, z0, x1, z1 = B["rects"][0]; y = B["y"]
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if not (x in (x0, x1) or z in (z0, z1)): continue
            corner = x in (x0, x1) and z in (z0, z1)
            if corner or (x - x0 + z - z0) % 2 == 0:
                for yy in range(y - depth, y + B["plinth"] - 1 + 1 if B["plinth"] > 1 else y + 1):
                    ctx.set(x, yy, z, "foundation", raw=log, axis="y")
            else:
                ctx.set(x, y, z, "foundation", raw=roots)


def _offset(ctx, s, st, B, o, chimneys=()):
    """The Hollow's crookedness (palettes/hollow.md): a single one-block offset of a whole upper storey and
    everything above it ({"storey": 1, "dir": "e"}), or of the roof only ({"roof": true, "dir": "e"}).
    Never a gradual shear. The plinth and ground storey stay true; the shifted storey overhangs one side
    like a jetty, so it gets brackets under its posts there. Chimneys stay put. Not for houses with wings."""
    sd = o.get("dir", "e"); dx, dz = DIRS[sd]
    if o.get("roof"): y_from = B["plate"] + 1
    else: y_from = B["floors"][max(1, o.get("storey", 1))] if len(B["floors"]) > 1 else B["plate"] + 1
    x0, z0, x1, z1 = B["rects"][-1]
    box = (x0 - 4, z0 - 4, x1 + 4, z1 + 4)
    moving = [c for c in ctx.cells if box[0] <= c[0] <= box[2] and box[1] <= c[2] <= box[3] and c[1] >= y_from
              and (c[0], c[2]) not in chimneys]
    saved = {c: (ctx.cells[c], ctx.stage_of.get(c)) for c in moving}
    for c in moving: ctx.clear(*c)
    for (x, y, z), (v, stg) in saved.items():
        ctx.cells[(x + dx, y, z + dz)] = v; ctx.stage_of[(x + dx, y, z + dz)] = stg
    if not o.get("roof"):            # brackets under the overhanging side (07: every overhang carried)
        i = max(1, o.get("storey", 1)); rr = B["rects"][i] if i < len(B["rects"]) else B["rects"][-1]
        posts = B["posts_of"].get((i, sd), [])
        L = side_len(rr, sd)
        for t_ in [-(L // 2), L // 2] + list(posts):
            wx, wz = wall_cell(rr, sd, t_)
            ctx.setif(wx + dx, y_from - 1, wz + dz, "frame", "stairs", ctx.mat(st, "trim"), facing=OPP[sd], half="top")


def dome(ctx, s):
    """A dome on an optional drum (06 roof-types 17: courses stepping in as a circle, smooth, no one-cell
    ribs; the capital hall, Saltreach and Emberwaste civic accents). at = [x, y, z] or [x, z] with "y": the
    centre block at the foot of the drum (or of the dome); y may be "top" (default) to sit on what is built
    under it. r = radius (end in .5
    for an odd width), shape hemisphere / onion / tall, material (default the waxed copper gradient, greener
    at the top), drum {"h": 4, "r": r, "material" (default the walls of the house under it), "windows": 4 or
    8, "glass"}, finial ("short" / "gold" /
    "spire_block" / "none")."""
    from fit import voxelize
    at = s["at"]
    if len(at) == 2: (cx, cz), y = at, s.get("y", "top")
    else: cx, y, cz = at
    r = s.get("r", 3.5)
    R = int(r + 1)
    if not isinstance(y, (int, float)):        # sit on the deck under the centre (a flat roof stays as the floor)
        ys = [c[1] for c in ctx.cells if abs(c[0] - cx) <= 1 and abs(c[2] - cz) <= 1]
        if ys: y = max(ys) + 1
        else: y = 0; ctx.log.append(f"dome: nothing built under {cx},{cz}; put it on the ground (y 0) or give y")
    COP = {"ladder": ["waxed_weathered_cut_copper", "waxed_oxidized_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"}
    under = getattr(ctx, "last_style", None) or {}
    drum_mat = under.get("infill", "smooth_stone")            # the drum is built of the walls it stands on
    st = {"_name": s.get("name", f"dome{ctx.n}"), "dome": s.get("material", COP),
          "drum": (s.get("drum") or {}).get("material", drum_mat) if isinstance(s.get("drum"), dict) else drum_mat}
    ctx.n += 1
    dm = ctx.mat(st, "dome"); drm = ctx.mat(st, "drum")
    X, Z = cx + 0.5, cz + 0.5                     # the centre of the centre block
    ops, y0 = [], y
    drum = s.get("drum")
    if drum:
        drum = {} if drum is True else drum
        dr, dh = drum.get("r", r), drum.get("h", 4)
        dcells = voxelize([{"shape": "cylinder", "at": [X, y, Z], "r": dr, "h": dh, "material": drm}], q=4, thin=False, hollow=1, log=ctx.log)
        for c, v in dcells.items(): ctx.set(*c, "walls", v["kind"], v.get("mat"), **v.get("props", {}))
        n = drum.get("windows", 4); glass = drum.get("glass", "light_blue_stained_glass_pane")
        import math
        for k in range(n):
            a = 2 * math.pi * k / n; ux, uz = math.sin(a), -math.cos(a)
            wx, wz = cx + round(ux * (dr - 0.5)), cz + round(uz * (dr - 0.5))
            for yy in (y + 1, y + 2):
                if (wx, yy, wz) in ctx.cells: ctx.set(wx, yy, wz, "openings", raw=glass)
        y0 = y + dh
    shape = s.get("shape", "hemisphere")
    if shape == "onion":
        prof = [[0, r], [r * 0.5, r * 1.12], [r * 1.0, r * 0.95], [r * 1.5, r * 0.5], [r * 1.9, 0.6], [r * 2.1, 0.0]]
        ops.append({"shape": "lathe", "at": [X, y0, Z], "profile": prof, "material": dm})
        top = y0 + r * 2.1
    elif shape == "tall":
        ops.append({"shape": "ellipsoid", "at": [X, y0, Z], "r": [r, r * 1.4, r], "material": dm})
        top = y0 + r * 1.4
    else:
        ops.append({"shape": "sphere", "at": [X, y0, Z], "r": r, "material": dm})
        top = y0 + r
    ops.append({"op": "intersect", "shape": "box", "min": [cx - R - 1, y0, cz - R - 1], "max": [cx + R + 1, int(top) + 2, cz + R + 1]})
    ctx.spec["materials"][dm] = _with_range(ctx.spec["materials"][dm], y0, int(top))
    cells = voxelize(ops, q=4, thin=True, hollow=1, log=ctx.log)
    for c, v in cells.items(): ctx.set(*c, "roof", v["kind"], v.get("mat"), **v.get("props", {}))
    col = [c for c in cells if c[0] == cx and c[2] == cz]
    ytop = max(c[1] for c in col) if col else int(top)
    ctx.set(cx, ytop, cz, "roof", "full", dm)
    fin = s.get("finial", "short")
    if fin == "gold": ctx.set(cx, ytop + 1, cz, "details", raw="gold_block")
    elif fin != "none": _finial(ctx, cx, ytop + 1, cz, fin, drm, dm)
    return ytop


# ------------------------------------------------------------------ castle parts: round keep, curtain wall (towers/README "Castle / Citadel")
def _disc(r):
    """Cells of a round plan of radius r about (0, 0): r 2.5 = 5 wide, 3.5 = 7 wide (radii end in .5, odd widths)."""
    R = int(r + 0.5)
    return {(dx, dz) for dx in range(-R, R + 1) for dz in range(-R, R + 1) if dx * dx + dz * dz <= r * r + 0.01}


def _toward(dx, dz):
    """The side of a round plan a cell is on, by its larger offset (ties go to n/s)."""
    if abs(dz) >= abs(dx): return "s" if dz > 0 else "n"
    return "e" if dx > 0 else "w"


def _merlon(t):
    """Merlons on even steps of a parapet run, so ends and corners (step 0) always carry one."""
    return t % 2 == 0


def keep(ctx, s):
    """A round castle keep (towers/README: castle row; Mateo's barracks reference, 2026-11-12). A plinth, a
    shaft one block thick in the wall material, floors inside with a ladder up the wall, a string course
    one out at every floor line, 1x2 slits on the given sides, doors, then machicolated battlements: a
    ring of upside-down stairs one out (the corbels), the roof deck on them, a parapet and merlons on
    every other block. Flags on poles above the deck.

    at [x, z] centre, r (2.5 = 5 wide; 3.5 = 7), y (ground row, the plinth's first course), h (shaft
    height, 3 to 5 times the width), floors (rows above y of each floor inside; the deck is y + h),
    material / plinth / trim (courses, corbels, parapet cap) / floor, slits {"sides": "sen", "glass"},
    doors [{"side": "w", "floor": 1, "door": "spruce_door"}] (floor = the floor row the door opens on),
    ladder side (the inside wall it climbs), flags [{"at": [dx, dz], "dir": "e"}] with "flag" material,
    clear (true: empties the shaft first, so a roof or wall built before it makes way)."""
    cx, cz = s["at"]; r = s.get("r", 2.5); y0 = s.get("y", 0); h = s["h"]
    wall = s.get("material", "stone_bricks"); plinth = s.get("plinth", wall); trim = s.get("trim", wall)
    floor_m = s.get("floor", "spruce_planks"); top = y0 + h
    body, inner, crown = _disc(r), _disc(r - 1), _disc(r + 1)
    ring, outer = body - inner, crown - body
    floors = sorted(y0 + f for f in s.get("floors", []))
    lad = s.get("ladder", "e"); lx, lz = DIRS[lad]; R1 = int(r - 0.5)
    lcell = (cx + lx * (R1 - 1), cz + lz * (R1 - 1))           # inside, against the wall on that side
    if s.get("clear", True):
        for (dx, dz) in crown:
            for y in range(y0, top + 3):
                if (dx, dz) in body or y >= top - 1: ctx.clear(cx + dx, y, cz + dz)
    for (dx, dz) in body:                                       # 01: plinth, two courses
        for y in (y0, y0 + 1): ctx.set(cx + dx, y, cz + dz, "foundation", "full", plinth)
    for (dx, dz) in ring:                                       # 04: the shaft
        for y in range(y0 + 2, top): ctx.set(cx + dx, y, cz + dz, "walls", "full", wall)
    for fy in [y0 + 1] + floors:                                # 03: floors, the ladder's hole left open
        for (dx, dz) in inner:
            c = (cx + dx, cz + dz)
            if fy > y0 + 1 and c == lcell: continue
            ctx.set(c[0], fy, c[1], "floors", "full", floor_m if fy > y0 + 1 else plinth)
    for fy in floors:                                           # 07: a course one out at each stage line
        for (dx, dz) in outer:
            ctx.set(cx + dx, fy, cz + dz, "details", "stairs", trim, facing=OPP[_toward(dx, dz)], half="top")
    sl = s.get("slits", {"sides": "nesw"})
    if sl:
        for fy in [y0 + 1] + floors:
            if fy + 3 >= top: continue
            for sd in sl.get("sides", "nesw"):
                ox, oz = DIRS[sd]
                if (ox, oz) == (lx, lz): continue
                for dy in (2, 3):
                    ctx.set(cx + ox * R1, fy + dy, cz + oz * R1, "openings", raw=sl.get("glass", "gray_stained_glass_pane"))
    for d in s.get("doors", []):
        sd = d.get("side", "s"); ox, oz = DIRS[sd]; fy = y0 + 1 if d.get("floor", 0) == 0 else floors[d["floor"] - 1]
        x, z = cx + ox * R1, cz + oz * R1; dw = d.get("door", "spruce_door")
        ctx.set(x, fy + 1, z, "openings", raw=dw, facing=sd, hinge=False)
        ctx.set(x, fy + 2, z, "openings", raw=dw, facing=sd, hinge=False, upper=True)
        ctx.set(x, fy + 3, z, "openings", "stairs", trim, facing=OPP[sd], half="top")
        for (dx, dz) in inner:                                  # nothing stands in front of it inside
            if (cx + dx, cz + dz) == (x - ox, z - oz):
                for dy in (1, 2): ctx.clear(x - ox, fy + dy, z - oz)
    for y in range(y0 + 2, top + 1):                            # the ladder, from the ground floor to the deck
        ctx.set(lcell[0], y, lcell[1], "details", raw="ladder", facing=OPP[lad])
    if s.get("cap") == "cone":                                 # a round tower's conical cap (towers/README 5)
        _cone_cap(ctx, cx, cz, r, top, s); s = dict(s, flags=[])
        ctx.info.setdefault("keeps", []).append({"at": [cx, cz], "r": r, "floors": floors, "deck": top, "ladder": list(lcell), "cap": "cone"})
        if s.get("lean"): _lean(ctx, (cx - int(r) - 3, cz - int(r) - 3, cx + int(r) + 3, cz + int(r) + 3), y0, top, s["lean"], trim)
        return
    # battlements: corbels one out, the deck on them, a parapet, merlons on every other block
    for (dx, dz) in outer:
        ctx.set(cx + dx, top - 1, cz + dz, "roof", "stairs", trim, facing=OPP[_toward(dx, dz)], half="top")
    for (dx, dz) in crown:
        c = (cx + dx, cz + dz)
        if c != lcell: ctx.set(c[0], top, c[1], "roof", "full", wall if (dx, dz) in outer or (dx, dz) in ring else trim)
    rim = sorted(outer, key=lambda c: __import__("math").atan2(c[1], c[0]))
    for i, (dx, dz) in enumerate(rim):
        ctx.set(cx + dx, top + 1, cz + dz, "roof", "full", wall)
        if _merlon(i): ctx.set(cx + dx, top + 2, cz + dz, "roof", "full", wall)
    ctx.set(lcell[0], top + 1, lcell[1], "details", raw=s.get("hatch", "spruce_trapdoor"), half="bottom", open=False)
    for f in s.get("flags", []):                                # 07: poles with the flag hung from the top
        fx, fz = cx + f["at"][0], cz + f["at"][1]; n = f.get("h", 5); ux, uz = DIRS[f.get("dir", "e")]
        for k in range(n): ctx.set(fx, top + 1 + k, fz, "details", "post", s.get("pole", "spruce_planks"))
        ctx.set(fx, top + 1 + n, fz, "details", raw="lightning_rod")
        fm = s.get("flag", "white_wool")
        for k, rows in enumerate((2, 2, 1)):                  # a pennant: two rows, tapering to one
            for j in range(rows): ctx.set(fx + ux * (k + 1), top + n - j, fz + uz * (k + 1), "details", raw=fm)
    ctx.info.setdefault("keeps", []).append({"at": [cx, cz], "r": r, "floors": floors, "deck": top, "ladder": list(lcell)})
    if s.get("lean"): _lean(ctx, (cx - int(r) - 3, cz - int(r) - 3, cx + int(r) + 3, cz + int(r) + 3), y0, top, s["lean"], trim)


def _gallery(ctx, g, st, B):
    """A gallery on a row of posts along one side (07; the caravanserai's upstairs gallery, covered walkways
    in the Emberwaste and Frostmarch). g = {"side": "s", "storey": 1, "depth": 2, "from": t0, "to": t1,
    "posts": 3}. Posts of the frame wood stand on the ground at both ends and every `posts` blocks along the
    outer edge, up to the gallery's ceiling: the next floor, or the wall plate on the top storey. A deck of
    the floor wood at the storey's floor with a fence rail on the outer edge (none on the ground storey,
    which makes a covered walk), a ceiling of bottom slabs of the roof block, a beam of the frame wood along
    the outer edge under it, and upside-down trim stairs under the ceiling's outer edge."""
    sd = g.get("side", "s"); i = g.get("storey", 1); dep = g.get("depth", 2); every = g.get("posts", 3)
    i = min(i, len(B["floors"]) - 1)
    rr = B["rects"][i]; fy = B["floors"][i]
    cy = B["floors"][i + 1] if i + 1 < len(B["floors"]) else B["plate"] + 1
    L = side_len(rr, sd); t0 = g.get("from", -(L // 2)); t1 = g.get("to", L // 2)
    ox, oz = DIRS[sd]; gy = B["y"]
    frame, floor_m, trim = ctx.mat(st, "frame"), ctx.mat(st, "floor"), ctx.mat(st, "trim")
    roof = ctx.mat(st, "roof"); ax = ALONG_AXIS[sd]
    ts = list(range(t0, t1 + 1)); posts = {t0, t1} | {t_ for t_ in ts if (t_ - t0) % every == 0 and t1 - t_ >= 2}
    for t_ in ts:
        wx, wz = wall_cell(rr, sd, t_)
        for j in range(1, dep + 1):
            x, z = wx + ox * j, wz + oz * j
            for y in range(fy + 1 if i else gy, cy):         # the walk stays clear under the ceiling
                if ctx.stage_of.get((x, y, z)) in ("details", "openings"): ctx.clear(x, y, z)
            if i: ctx.set(x, fy, z, "floors", "full", floor_m)
            ctx.setif(x, cy, z, "roof", "slab", roof, half="bottom")
            if j == dep:
                ctx.set(x, cy - 1, z, "frame", "full", frame, axis=ax)          # the beam on the posts
                if t_ in posts:
                    for y in range(gy, cy - 1): ctx.set(x, y, z, "frame", "full", frame, axis="y")
                elif i: ctx.set(x, fy + 1, z, "details", "post", trim)          # the rail
                ctx.setif(x + ox, cy - 1, z + oz, "roof", "stairs", trim, facing=OPP[sd], half="top")
        if i and t_ in (t0, t1):                                                  # rails closing the gallery's ends
            for j in range(1, dep): ctx.setif(wx + ox * j, fy + 1, wz + oz * j, "details", "post", trim)


def _cone_cap(ctx, cx, cz, r, top, s):
    """A steep cone on a round shaft: an eave ring one out with upside-down trim under it, then rings
    stepping in half a block a row (stairs facing up the slope on the edge, full blocks behind), the
    add-on's spire top block on a full block at the tip (never on a slab). Keys: roof (material), trim,
    finial ("spire_block" default / "rod" / "none"), pitch (rows per block in, 2)."""
    roof = s.get("roof", "deepslate_tiles"); trim = s.get("trim", s.get("material", "stone_bricks"))
    per = s.get("pitch", 2)
    rk = r + 1; y = top; k = 0
    for (dx, dz) in _disc(r + 1) - _disc(r):                  # the eave carried on brackets
        ctx.set(cx + dx, top - 1, cz + dz, "roof", "stairs", trim, facing=OPP[_toward(dx, dz)], half="top")
    while rk >= 0.5:
        D, Din = _disc(rk), _disc(rk - 1.0 / per - 0.5)
        for (dx, dz) in D:
            if (dx, dz) == (0, 0) and rk < 1.5: continue
            if (dx, dz) not in _disc(rk - 1.0 / per):          # the edge of this row: a stair facing up
                ctx.set(cx + dx, y, cz + dz, "roof", "stairs", roof, facing=OPP[_toward(dx, dz)], half="bottom")
            elif (dx, dz) not in Din: ctx.set(cx + dx, y, cz + dz, "roof", "full", roof)
        y += 1; k += 1; rk -= 1.0 / per
    ctx.set(cx, y - 1, cz, "roof", "full", roof); ctx.set(cx, y, cz, "roof", "full", roof)
    fin = s.get("finial", "spire_block")
    if fin == "spire_block": ctx.set(cx, y + 1, cz, "details", raw="siege:spire_roof")
    elif fin == "rod": ctx.set(cx, y + 1, cz, "details", raw="lightning_rod")


def _lean(ctx, box, y0, y1, o, trim):     # y1: the top of the shaft (the cap above moves with the last step)
    """The Hollow's leaning towers (regions/hollow.md): the whole shaft leans in a few clean steps, each a
    one-block shift of everything above a line, never a staircase of single-block shifts. o = {"dir": "e",
    "steps": 2 (1 to 3)}: the shaft splits into steps + 1 equal parts above its base course. Every
    overhang left by a step is carried on upside-down trim stairs (07)."""
    sd = o.get("dir", "e"); dx, dz = DIRS[sd]; n = max(1, min(3, o.get("steps", 2)))
    hi = y1; base = y0 + 2                                    # the steps split the shaft (base course to y1)
    lines = [base + (hi - base) * k // (n + 1) for k in range(1, n + 1)]
    for k, ly in enumerate(reversed(lines)):                  # top line first, so each shift carries the rest
        bx = (box[0] - n, box[1] - n, box[2] + n, box[3] + n)
        moving = [c for c in ctx.cells if bx[0] <= c[0] <= bx[2] and bx[1] <= c[2] <= bx[3] and c[1] >= ly]
        saved = {c: (ctx.cells[c], ctx.stage_of.get(c)) for c in moving}
        for c in moving: ctx.clear(*c)
        for (x, y, z), (v, stg) in saved.items(): ctx.cells[(x + dx, y, z + dz)] = v; ctx.stage_of[(x + dx, y, z + dz)] = stg
    for ly in lines:                                            # brackets under each overhang
        row = [c for c in ctx.cells if c[1] == ly and bx[0] <= c[0] <= bx[2] and bx[1] <= c[2] <= bx[3]
               and ctx.stage_of.get(c) in ("walls", "foundation", "frame")]
        for (x, y, z) in row:
            if ctx.free(x, y - 1, z): ctx.set(x, y - 1, z, "details", "stairs", trim, facing=OPP[sd], half="top")


def curtain(ctx, s):
    """A curtain wall round a yard (towers/README castle row; build-instructions/07 battlements): a run of
    straight wall through the points in `path` (axis-aligned steps), a plinth course, the wall, a cap
    course, merlons on every other block; square turrets that rise above it; a gate with an arched head,
    a raised crown over it and an optional banner hung one out on the crown's outer face.

    path [[x, z], ...], y (ground row), h (wall rows above the plinth course, 4), material / plinth / cap,
    turrets [{"at": [x, z], "size": 3, "h": 7}], gate {"at": [x, z], "face": "s", "w": 3, "h": 3,
    "crown": 3, "banner": "white_wool" | null, "pole": "stripped_spruce_log", "trim"}."""
    y0 = s.get("y", 0); h = s.get("h", 4); wall = s.get("material", "stone_bricks")
    plinth = s.get("plinth", wall); cap = s.get("cap", wall)
    cells = []
    pts = s["path"]
    for (ax_, az_), (bx_, bz_) in zip(pts, pts[1:]):
        if ax_ != bx_ and az_ != bz_: ctx.log.append(f"curtain: {ax_},{az_} to {bx_},{bz_} is not straight; use axis-aligned steps")
        n = max(abs(bx_ - ax_), abs(bz_ - az_))
        for k in range(n + 1):
            c = (ax_ + (bx_ - ax_) * k // max(n, 1), az_ + (bz_ - az_) * k // max(n, 1))
            if c not in cells: cells.append(c)
    top = y0 + h
    for t, (x, z) in enumerate(cells):
        ctx.set(x, y0, z, "foundation", "full", plinth)
        for y in range(y0 + 1, top): ctx.set(x, y, z, "walls", "full", wall)
        ctx.set(x, top, z, "walls", "full", cap)
        if _merlon(t): ctx.set(x, top + 1, z, "details", "full", wall)
    for tu in s.get("turrets", []):
        tx, tz = tu["at"]; n = tu.get("size", 3) // 2; th = y0 + tu.get("h", h + 3)
        for dx in range(-n, n + 1):
            for dz in range(-n, n + 1):
                edge = abs(dx) == n or abs(dz) == n
                for y in range(y0, th):
                    if edge or y in (y0, th - 1): ctx.set(tx + dx, y, tz + dz, "foundation" if y == y0 else "walls", "full", plinth if y == y0 else wall)
                    else: ctx.clear(tx + dx, y, tz + dz)
                if edge:
                    ctx.set(tx + dx, th, tz + dz, "details", "full", cap)
                    if abs(dx) == n and abs(dz) == n: ctx.set(tx + dx, th + 1, tz + dz, "details", "full", wall)   # merlons on the corners
                else: ctx.set(tx + dx, th - 1, tz + dz, "walls", "full", cap)
        ctx.set(tx, th, tz, "details", raw="lantern")
    g = s.get("gate")
    if g:
        gx, gz = g["at"]; face = g.get("face", "s"); w = g.get("w", 3); gh = g.get("h", 3); cr = g.get("crown", 3)
        ax = ALONG_AXIS[face]; ux, uz = (1, 0) if ax == "x" else (0, 1); ox, oz = DIRS[face]; hw = w // 2
        for k in range(-hw - 1, hw + 2):                    # the crown: the wall raised over the gate, w + 2 wide
            x, z = gx + ux * k, gz + uz * k
            ctx.clear(x, top + 1, z)
            for y in range(top, top + cr): ctx.set(x, y, z, "walls", "full", wall)
            ctx.set(x, top + cr, z, "walls", "full", cap)
            if _merlon(k + hw + 1): ctx.set(x, top + cr + 1, z, "details", "full", wall)
        arch(ctx, {"at": [gx, y0 + 1, gz], "axis": ax, "width": w, "height": gh + 1, "material": cap,
                   "trim": g.get("trim", "spruce_planks"), "style": "round_angle"})
        if g.get("banner"):                                  # hung one out on the outer face, under a pole
            py = top + cr - 1
            for k in range(-hw - 1, hw + 2):
                ctx.set(gx + ux * k + ox, py, gz + uz * k + oz, "details", raw=g.get("pole", "stripped_spruce_log"), axis=ax)
            for row in range(1, 4):
                for k in range(-hw, hw + 1):
                    if row == 3 and k != 0: continue        # the banner's point
                    ctx.set(gx + ux * k + ox, py - row, gz + uz * k + oz, "details", raw=g["banner"])
            ctx.info["banner"] = [gx + ox, py - 2, gz + oz]
        ctx.info["gate"] = [gx, y0 + 1, gz]


PARTS = {"keep": keep, "curtain": curtain, "house": house, "dome": dome, "lean_to": lean_to, "woodpile": woodpile, "spire": spire, "belfry": belfry, "clock_face": clock_face, "wheel": wheel, "arch": arch, "string_course": string_course, "buttress": buttress, "hanging_lantern": hanging_lantern}


def boardwalk(ctx, s):
    """Blackfen boardwalk (regions/blackfen.md, paths/README, regions_towns.BOARDWALK): a deck of top slabs
    on mangrove log stilts over wet ground or water, with fence rails and lanterns that show through fen mist.
    path [[x, z], ...] in axis-aligned runs, y (deck row), ground (where the stilts stop, 0), w (3), deck
    ("mangrove_slab"), beam ("mangrove_planks"), stilt ("mangrove_log"), rail ("mangrove_fence"),
    rails ("both" / "one" / "none"), gaps [[x, z], ...] (openings in the rail for landings and stairs),
    light ("lantern"; every 8 and at both ends, on a rail post; null for none)."""
    y = s["y"]; g = s.get("ground", 0); w = s.get("w", 3); hw = w // 2
    deck = s.get("deck", "mangrove_slab"); beam = s.get("beam", "mangrove_planks")
    stilt = s.get("stilt", "mangrove_log"); rail = s.get("rail", "mangrove_fence"); light = s.get("light", "lantern")
    rails = s.get("rails", "both"); gaps = {tuple(c) for c in s.get("gaps", [])}
    pts = s["path"]; line = []                                  # centre cells with their run direction
    for (ax_, az_), (bx_, bz_) in zip(pts, pts[1:]):
        if ax_ != bx_ and az_ != bz_: ctx.log.append(f"boardwalk: {ax_},{az_} to {bx_},{bz_} is not straight; use axis-aligned runs")
        n = max(abs(bx_ - ax_), abs(bz_ - az_)); d = "x" if bx_ != ax_ else "z"
        for k in range(n + 1):
            c = (ax_ + (bx_ - ax_) * k // max(n, 1), az_ + (bz_ - az_) * k // max(n, 1))
            if not line or line[-1][0] != c: line.append((c, d))
    deckc, edges = set(), {}
    for (cx, cz), d in line:
        ux, uz = (0, 1) if d == "x" else (1, 0)                # across the run
        for k in range(-hw, hw + 1): deckc.add((cx + ux * k, cz + uz * k))
    for (cx, cz), d in line:
        ux, uz = (0, 1) if d == "x" else (1, 0)
        for sgn in ((-1, 1) if rails == "both" else (1,) if rails == "one" else ()):
            e = (cx + ux * (hw + 1) * sgn, cz + uz * (hw + 1) * sgn)
            if e not in deckc: edges[e] = d
    for (x, z) in deckc: ctx.set(x, y, z, "floors", raw=deck, half="top")
    n_ = len(line)
    for k, ((cx, cz), d) in enumerate(line):                    # stilts and a cross beam every 4 and at the ends
        if not (k in (0, n_ - 1) or k % 4 == 0 and n_ - 1 - k >= 2): continue
        ux, uz = (0, 1) if d == "x" else (1, 0)
        for j in range(-hw, hw + 1):
            ctx.set(cx + ux * j, y - 1, cz + uz * j, "frame", raw=beam)
        for j in (-hw, hw):
            for yy in range(g, y - 1): ctx.set(cx + ux * j, yy, cz + uz * j, "foundation", raw=stilt, axis="y")
    for i, ((x, z), d) in enumerate(sorted(edges.items())):
        if (x, z) in gaps: continue
        ctx.setif(x, y, z, "details", raw=beam)                 # the rail stands on an edge plank
        ctx.setif(x, y + 1, z, "details", raw=rail)
    if light:
        for k, ((cx, cz), d) in enumerate(line):
            if not (k in (0, n_ - 1) or k % 8 == 0): continue
            ux, uz = (0, 1) if d == "x" else (1, 0)
            e = (cx + ux * (hw + 1), cz + uz * (hw + 1))
            if e in edges and e not in gaps:
                ctx.set(e[0], y + 2, e[1], "details", raw=rail); ctx.set(e[0], y + 3, e[1], "details", raw=light)


PARTS["boardwalk"] = boardwalk


def interior(ctx, pt):
    import interiors
    interiors.interior_part(ctx, pt)


PARTS["interior"] = interior


def bridge(ctx, s):
    """A straight A-to-B bridge at any angle, sized by span, styled by region and use (scripts/bridges.py)."""
    import bridges
    return bridges.bridge(ctx, s)


PARTS["bridge"] = bridge


# ---- sideways bodies of revolution (air boat envelopes, barrels on their side, hulls of airships) ----
# The shape fitter reads up/down surfaces as a height field, which suits domes but leaves a body lying on its
# side jagged and full of holes. A body along a horizontal axis is fitted ring by ring instead: each slice
# across the axis is a circle of full blocks, upright stairs on the top half, upside-down stairs underneath and
# slabs at the crown and keel, with radii held to half blocks so rings run in clean bands (air boat, 2026-11-13).
HEADING = {   # nose direction -> (x, z) of local (u along the axis, w across, +w = starboard), and local facing map
    "e": (lambda u, w: (u, w), {"e": "e", "w": "w", "s": "s", "n": "n"}),
    "w": (lambda u, w: (-u, -w), {"e": "w", "w": "e", "s": "n", "n": "s"}),
    "s": (lambda u, w: (-w, u), {"e": "s", "w": "n", "s": "w", "n": "e"}),
    "n": (lambda u, w: (w, -u), {"e": "n", "w": "s", "s": "e", "n": "w"}),
}


def turn_cell(cell, at, heading):
    """A local cell [u, y, w, block, {states}] (u east = toward the nose) placed at `at` facing `heading`."""
    u, y, w, b = cell[:4]
    st = dict(cell[4]) if len(cell) > 4 else {}
    xz, fm = HEADING[heading]
    dx, dz = xz(u, w)
    if "facing" in st: st["facing"] = fm[st["facing"]]
    if st.get("axis") in ("x", "z") and heading in ("n", "s"): st["axis"] = "z" if st["axis"] == "x" else "x"
    return [at[0] + dx, at[1] + y, at[2] + dz, b] + ([st] if st else [])


def profile_r(profile, u):
    if u <= profile[0][0]: return profile[0][1]
    for (u0, r0), (u1, r1) in zip(profile, profile[1:]):
        if u0 <= u <= u1: return r0 + (r1 - r0) * (u - u0) / (u1 - u0)
    return 0.0


def ring_fit(R, q=4):
    """One circular slice of radius R round the centre of block (0, 0): {(y, w): (kind, facing, half)}."""
    out, n = {}, int(R) + 2
    opts = [("full", None, None, lambda i, j: True), ("slab", None, "bottom", lambda i, j: i < q // 2),
            ("slab", None, "top", lambda i, j: i >= q // 2),
            ("stairs", "n", "bottom", lambda i, j: i < q // 2 or j < q // 2), ("stairs", "s", "bottom", lambda i, j: i < q // 2 or j >= q // 2),
            ("stairs", "n", "top", lambda i, j: i >= q // 2 or j < q // 2), ("stairs", "s", "top", lambda i, j: i >= q // 2 or j >= q // 2)]
    rank = {"air": 0, "full": 0, "stairs": 1, "slab": 2}
    for y in range(-n, n + 1):
        for w in range(-n, n + 1):
            m = [[(w - .5 + (j + .5) / q) ** 2 + (y - .5 + (i + .5) / q) ** 2 <= R * R for j in range(q)] for i in range(q)]
            tot = sum(map(sum, m))
            if tot == 0: continue
            if tot == q * q: out[(y, w)] = ("full", None, None); continue
            mis = lambda f: sum(1 for i in range(q) for j in range(q) if f(i, j) != m[i][j])
            best = min([("air", None, None, lambda i, j: False)] + opts, key=lambda o: (mis(o[3]), rank[o[0]]))
            if best[0] != "air": out[(y, w)] = best[:3]
    return out


def envelope_cells(profile, belly="light_gray_wool", top="white_wool", rib=None, rib_every=8, cap=None, cap_len=(2, 4),
                   belly_rows=5, shell=1):
    """Local cells [u, y, w, block, {states}] of a body of revolution along u (tail u 0, nose at the last profile u),
    axis through the centre of block row y 0. profile [[u, r], ...]. Two-row dithered seam from belly to top
    `belly_rows` under the axis; `rib` rings every `rib_every`; `cap` on the last cap_len[1] / first cap_len[0] slices."""
    L = int(profile[-1][0])
    rings = {u: ring_fit(max(0.8, math.floor(profile_r(profile, u) * 2 + .5) / 2)) for u in range(0, L + 1)}
    solid = lambda u, y, w: rings.get(u, {}).get((y, w), ("",))[0] == "full"
    out = []
    for u, cells in rings.items():
        for (y, w), (kind, f, h) in cells.items():
            if kind == "full" and shell and all(solid(*p) for p in ((u + 1, y, w), (u - 1, y, w), (u, y + 1, w), (u, y - 1, w), (u, y, w + 1), (u, y, w - 1))):
                continue
            if cap and (u > L - cap_len[1] or u < cap_len[0]): b = cap
            elif rib and u % rib_every == 0 and rib_every <= u <= L - cap_len[1]: b = rib
            else:
                t = y + belly_rows
                b = belly if t < 0 or (t < 2 and (u + w + t) % 2 == 0) else top
            if kind == "full": out.append([u, y, w, b])
            elif kind == "slab": out.append([u, y, w, b + "_slab", {"half": h}])
            else: out.append([u, y, w, b + "_stairs", {"facing": f, "half": h}])
    return out


def envelope(ctx, s):
    """Part "envelope": a body of revolution lying along a horizontal axis, fitted ring by ring (see ring_fit).
    at [x, y, z] = the tail-end centre block of the axis, heading e/w/n/s = the way the nose points, profile
    [[u, r], ...] from the tail (u 0) to the nose, belly / top / rib / cap blocks (with _stairs and _slab forms),
    rib_every, belly_rows (rows under the axis where the belly colour gives way to the top)."""
    for c in envelope_cells(s["profile"], s.get("belly", "light_gray_wool"), s.get("top", "white_wool"), s.get("rib"),
                            s.get("rib_every", 8), s.get("cap"), tuple(s.get("cap_len", (2, 4))), s.get("belly_rows", 5)):
        x, y, z, b, *st = turn_cell(c, s["at"], s.get("heading", "e"))
        ctx.set(x, y, z, "frame", raw=b, **(st[0] if st else {}))


PARTS["envelope"] = envelope



def ring_norm(x, z, chamfer=None):
    """Distance from the centre for ring builds (stands, arena walls): a square ring (chamfer None), or an
    octagon whose diagonal faces are cut `chamfer` in from the corners (|x| + |z| - chamfer)."""
    ax, az = abs(x), abs(z)
    return max(ax, az) if chamfer is None else max(ax, az, ax + az - chamfer)


def stands(ctx, s):
    """Tiered seating round an open floor (an arena, a tilting ground, a moot): one row per ring of the
    octagon (or square) round `at`, every row one block up and one block out, so each row sees over the
    heads of the row in front (07 detailing: depth outward; the arena, 2026-11-13).

    at [x, z] the floor centre, chamfer (the octagon's corner cut, None for a square), from / to (the first
    and last row's ring), y (the first row's seat block), walk ([ring, ...]: level walkways a row wide that
    do not rise, between tiers), seat (stairs material: each seat is a stair with its tall side away from the
    floor, so people sit facing in; on the diagonal faces a bottom slab, a bench), aisle (material of the
    stairs every `aisle_every` blocks along the straight faces, marking the ways up), band ({"every": 4,
    "material": ...}: every few rows in a lighter stone, so the tiers read from across the floor), fill (what is under the
    seats, down to `base`), skip ([[x0, z0, x1, z1], ...] world boxes to leave out, for
    stair halls and boxes built into the stands), round (true: the rows are circles, d = round(hypot), for a
    round amphitheatre; the aisles then run out along `aisles` evenly spaced rays instead of every few blocks,
    and every seat is a stair facing its nearest axis). The seat spots (the air block a person stands in) go to the
    layout as info["stands"]."""
    cx, cz = s["at"]; ch = s.get("chamfer"); d0, d1 = s["from"], s["to"]; y0 = s["y"]
    walk = set(s.get("walk", [])); seat = s.get("seat", "stone_bricks"); aisle = s.get("aisle", seat)
    every = s.get("aisle_every", 0); fill = s.get("fill", seat); base = s.get("base", 0); skip = s.get("skip", [])
    band = s.get("band") or {}                   # {"every": 4, "material": ...}: a lighter row every few, so the tiers read
    rnd = s.get("round", False); n_ais = s.get("aisles", 0)
    tops, y = {}, y0
    for d in range(d0, d1 + 1):
        if d in walk and d != d0: y -= 1
        tops[d] = y; y += 1
    spots = ctx.info.setdefault("stands", [])
    for x in range(-d1, d1 + 1):
        for z in range(-d1, d1 + 1):
            d = int(round(math.hypot(x, z))) if rnd else ring_norm(x, z, ch)
            if not d0 <= d <= d1: continue
            if any(a <= x + cx <= c and b <= z + cz <= e for a, b, c, e in skip): continue
            t = tops[d]
            for yy in range(base, t): ctx.set(cx + x, yy, cz + z, "foundation", "full", fill)
            ax, az = abs(x), abs(z)
            diag = not rnd and ch is not None and ax + az - ch > max(ax, az)
            if d in walk:
                ctx.set(cx + x, t, cz + z, "floors", "full", fill); continue
            if diag:
                ctx.set(cx + x, t, cz + z, "floors", "slab", seat, half="bottom")
            else:
                face = ("s" if z > 0 else "n") if az >= ax else ("e" if x > 0 else "w")
                along = x if face in "ns" else z
                if rnd and n_ais:                        # on an aisle ray: within half a block of it, across
                    a = math.atan2(x, -z) * n_ais / (2 * math.pi)
                    on = abs(a - round(a)) * 2 * math.pi * math.hypot(x, z) / n_ais <= 0.5
                else:
                    on = every and along % every == 0
                m = aisle if on else seat
                if band and (d - d0) % band.get("every", 4) == band.get("every", 4) - 1: m = band.get("material", aisle)
                ctx.set(cx + x, t, cz + z, "floors", "stairs", m, facing=face, half="bottom")
                if (x + z) % 2 == 0: spots.append([cx + x, t + 1, cz + z])
    ctx.info["stand_rows"] = tops


PARTS["stands"] = stands

def run(ctx, pt):
    k = pt.get("part")
    nm = pt.get("name")
    if nm:                                       # materials are named after the part: two parts, one name, one look
        seen = ctx.__dict__.setdefault("_names", set())
        if nm in seen: ctx.log.append(f"two parts are named {nm!r}: the second takes the first's materials; give each part its own name")
        seen.add(nm)
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
