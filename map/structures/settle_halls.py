"""Settlement town halls rebuilt in the map kit's style (Mateo 2026-11-11: rebuild the upgrade
buildings and strongholds in the new building style). Same five levels and roughly the same
footprints as the town hall code's halls, so they still fit the plot and the wall ring.

Frame: front faces south (+z); the door's outside face is on z = 0 at x = 0 unless a porch moves it
(bp.markers["door"] is the door cell); ground floor at y = 1. Every size is odd.
Stonework is the region's Castle Stone family (settlements use only it); stairs, slabs and walls
stay vanilla because the family has none. Interiors hold only what the hall needs to work:
the Tree of Oaths, hearth, ledger lectern, cartographer's table, throne and vault (marks).
"""
from bp import Blueprint, DIRS, OPP, RIGHT
from kit import band_index, Building, VALE, mix, grow, h3, DOCTRINE, finish_detail
from vale import STYLES

def detailed(P):
    """Every settlement palette gets the detailing passes (build-instructions 05-07): dressed windows and doors,
    chimney tops, verge and hip-corner lanterns, arched jetty supports, beamed floor bands."""
    wood = P["trim"].replace("_stairs", "")
    P.update(DOCTRINE, shelf=f"{wood}_slab")
    return P

def castle(region="vale"):
    suf = "" if region == "vale" else "_" + region
    k = lambda kind: f"siege:castle_{kind}{suf}"
    return k

def vale_palette(seed=0):
    k = castle("vale")
    P = {**VALE, **STYLES["stone"]}
    P.update(stone=mix([(k("smooth"), 100)], 61 + seed),
             plinth=mix([(k("cobbled"), 70), (k("stone"), 30)], 62 + seed), found=k("cobbled"),
             quoin=k("stone"), quoin2=k("bricks"), chimney=mix([(k("bricks"), 80), (k("cobbled"), 20)], 63))
    P["infill"] = P["stone"]
    return detailed(P)

def timber_palette(seed=0):
    k = castle("vale")
    P = dict(VALE)
    P.update(plinth=mix([(k("cobbled"), 70), (k("stone"), 30)], 64 + seed), found=k("cobbled"),
             stone=mix([(k("stone"), 80), (k("bricks"), 12), (k("cobbled"), 8)], 65 + seed),
             quoin=k("smooth"), quoin2=k("bricks"), chimney=mix([(k("bricks"), 80), (k("cobbled"), 20)], 66))
    return detailed(P)

# ---------------------------------------------------------------- helpers
def pyramid(bp, P, x0, z0, x1, z1, base, pitch=1, mat=None, block=None, finial="stone_brick_wall"):
    """Hipped / pyramid roof over a rect: rings of stairs stepping in, `pitch` blocks up per ring."""
    stair = mat or P["roof"]; solid = block or P["roof_block"]
    ladder = P.get("roof_ladder") if not mat and isinstance(stair, str) and stair in (P.get("roof_ladder") or ()) else None
    rings = max(1, (min(x1 - x0, z1 - z0) + 2) // 2)
    r = 0; y = base; ring1 = {}
    while x0 + r <= x1 - r and z0 + r <= z1 - r:
        a0, b0, a1, b1 = x0 + r, z0 + r, x1 - r, z1 - r
        ring = [(x, z) for x in range(a0, a1 + 1) for z in range(b0, b1 + 1) if x in (a0, a1) or z in (b0, b1)]
        last = a0 == a1 or b0 == b1
        for (x, z) in ring:
            for dy in range(pitch - 1): bp.set(x, y + dy, z, solid)
            if last: bp.set(x, y + pitch - 1, z, solid); continue
            f = "s" if z == b0 else "n" if z == b1 else "e" if x == a0 else "w"
            if (x, z) in ((a0, b0), (a1, b0), (a0, b1), (a1, b1)):
                f = "s" if z == b0 else "n"
            st = stair
            if ladder:      # the doctrine's roof gradient: eaves -> ridge in clean bands, teeth at the band edges
                st = ladder[band_index(r, 0, rings - 1, len(ladder), x if z in (b0, b1) else z)]
            bp.set(x, y + pitch - 1, z, st, facing=f, half="bottom")
            if r == 1: ring1[(x, z)] = y + pitch - 1
            if r == 0 and P.get("verge_lanterns") and (x, z) in ((a0, b0), (a1, b0), (a0, b1), (a1, b1)) \
                    and all(bp.get(x, y - k, z)[0] in ("keep", "air") for k in (1, 2, 3, 4)) and y - 3 >= 2:
                # the chain hangs straight from the corner stair, no block under it (Mateo 2026-11-12, 06-roof)
                bp.set(x, y - 1, z, "iron_chain"); bp.set(x, y - 2, z, P.get("lantern", "lantern"), hanging=True)
        if last:
            if finial: bp.set((a0 + a1) // 2, y + pitch, (b0 + b1) // 2, finial)
            break
        r += 1; y += pitch
    close_under(bp, ring1)
    return y + pitch

def close_under(bp, ring1):
    """No open row between a wall top and the hip roof over it (Mateo 2026-11-12, 06-roof wall plate): under
    the ring one in from the eave (the wall line), one or two rows of air between that ring's stair and a solid
    wall block below are filled with that wall block. Openings (glass, doors, fences, stairs, slabs) stay."""
    soft = lambda n: n in ("air", "keep")
    open_ = lambda n: any(w in n for w in ("glass", "pane", "door", "fence", "stairs", "slab", "lantern", "chain", "trapdoor", "sign", "leaves", "_wall"))
    for (x, z), ry in ring1.items():
        gap = []; y = ry - 1
        while y > ry - 4 and soft(bp.get(x, y, z)[0]): gap.append(y); y -= 1
        if not gap or len(gap) > 2: continue
        below = bp.get(x, y, z)
        if soft(below[0]) or open_(below[0]): continue
        for g in gap: bp.set(x, g, z, below[0], **below[1])

def crenels(bp, x0, z0, x1, z1, y, merlon, walk=None):
    """Parapet on a rect's outline at height y: alternate merlons (odd cells) like the walls' battlements."""
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if x in (x0, x1) or z in (z0, z1):
                if (x + z) % 2 == 0: bp.set(x, y, z, merlon)
            elif walk: bp.set(x, y - 1, z, walk)

def tower(B, cx, cz, half, y0, h, top="spire", windows=2, eave=1):
    """Square stone tower (2*half+1 wide) from y0 up h blocks, slit windows, then a spire or crenels."""
    bp, P = B.bp, B.P
    rect = (cx - half, cz - half, cx + half, cz + half)
    B.foundation(rect, y0 - 1)
    B.stone_storey(rect, y0, h, plinth=True)
    for x in range(rect[0] + 1, rect[2]):
        for z in range(rect[1] + 1, rect[3]): bp.set(x, y0 - 1, z, P["floor"])
    for y in range(y0 + 4, y0 + h - 2, 5):
        for side in "nsew":
            dx, _, dz = DIRS[side]
            x, z = cx + dx * half, cz + dz * half
            bp.set(x, y, z, P["pane"]); bp.set(x, y + 1, z, P["pane"])
    yt = y0 + h
    if top == "spire":
        for side in "nsew":       # eaves: corbelled band under the spire
            for (x, z) in [(x, z) for x in range(rect[0], rect[2] + 1) for z in range(rect[1], rect[3] + 1) if x in (rect[0], rect[2]) or z in (rect[1], rect[3])]:
                pass
        return pyramid(bp, P, rect[0] - eave, rect[1] - eave, rect[2] + eave, rect[3] + eave, yt, pitch=2)
    for x in range(rect[0] + 1, rect[2]):
        for z in range(rect[1] + 1, rect[3]): bp.set(x, yt - 1, z, P["floor"])
    # corbel ring then merlons
    for x in range(rect[0] - 1, rect[2] + 2):
        for z in range(rect[1] - 1, rect[3] + 2):
            if x in (rect[0] - 1, rect[2] + 1) or z in (rect[1] - 1, rect[3] + 1):
                f = "s" if z == rect[1] - 1 else "n" if z == rect[3] + 1 else "e" if x == rect[0] - 1 else "w"
                bp.set(x, yt - 1, z, P["sill"], facing=OPP[f], half="top")
                bp.set(x, yt, z, P["stone"])
                if (x + z) % 2 == 0: bp.set(x, yt + 1, z, P["stone"])
    return yt + 2

def hang(bp, pts):
    for x, y, z in pts: bp.set(x, y, z, "lantern", hanging=True)

def oath_dais(bp, P, cx, cz, half=1, y=0, mat=None):
    """Raised dais with the Tree of Oaths in the middle."""
    k = castle("vale")
    for x in range(cx - half, cx + half + 1):
        for z in range(cz - half, cz + half + 1): bp.set(x, y + 1, z, mat or "polished_andesite")
    bp.set(cx, y + 2, cz, "siege:tree_of_oaths")
    bp.marks["tree"] = (cx, y + 2, cz)

def new_hall(name, P, seed):
    P.setdefault("spikes", 5)                 # town halls carry ridge spikes and gable finials (07-detailing)
    bp = Blueprint(name); B = Building(bp, P, seed); bp.marks = {}
    return bp, B

# ---------------------------------------------------------------- Vale: the five halls
def vale_1(seed=1):
    """Longhouse: a timber hall-house on a stone footing, hearth in the middle, the Tree at the back. 9 x 15."""
    P = timber_palette(seed); bp, B = new_hall("hall_vale_1", P, seed)
    rect = (-4, -14, 4, 0)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 1, quoins=False)
    B.timber_storey(rect, 2, 4, bay=4)
    B.bay_windows(rect, 2, "ew")
    B.door(0, 1, 0, "s", canopy=True, lanterns=True, frame=P["frame"])
    for x in (-2, 2): B.window(x, 3, 0, "s", 1, 2)
    B.roof(rect, "z", 6, overhang=1, verge=1)
    B.build_roofs(); B.gable_walls(rect, "z", 6, style="timber")
    B.window(0, 7, 0, "s", 1, 2); B.window(0, 7, -14, "n", 1, 2)
    for z in (-4, -10): bp.fill(-3, 5, z, 3, 5, z, P["frame"], axis="x")    # tie beams
    # hearth: stone kerb, campfire, smoke louvre on the ridge
    for x in (-1, 0, 1):
        for z in (-8, -7, -6): bp.set(x, 1, z, "siege:castle_cobbled") if (x, z) != (0, -7) else bp.set(x, 1, z, "campfire")
    bp.marks["hearth"] = (0, 1, -7)
    top = B.H[(0, -7)][0]
    bp.set(0, top, -7, "stone_brick_wall"); bp.set(0, top + 1, -7, P["roof_slab"], half="bottom")
    oath_dais(bp, P, 0, -12)
    bp.set(3, 1, -12, "lectern", facing="w"); bp.marks["ledger"] = (3, 1, -12)
    bp.set(-3, 1, -12, "bookshelf"); bp.set(-3, 2, -12, "bookshelf")
    hang(bp, [(-2, 4, -4), (2, 4, -4), (-2, 4, -10), (2, 4, -10)])
    B.chimney(-5, -9, 1) if False else None
    bp.markers["door"] = (0, 1, 0)
    return finish_detail(bp, P)

def vale_2(seed=2):
    """Stone Hall: a buttressed stone hall with a gabled porch, a bellcote and a raised dais. 13 x 21."""
    P = vale_palette(seed); bp, B = new_hall("hall_vale_2", P, seed)
    rect = (-6, -20, 6, 0)
    B.foundation(grow(rect, "new", 2), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 6)
    for z in (0, -5, -10, -15, -20):                       # buttresses: bays of 4 between them
        for x, f in ((-7, "e"), (7, "w")):
            for y in range(1, 5): bp.set(x, y, z, P["stone"])
            bp.set(x, 5, z, "stone_brick_stairs", facing=f, half="bottom")
    for z in (-3, -8, -13, -18):                           # tall windows in each bay
        B.window(6, 2, z + 1, "e", 1, 3, kind="stone"); B.window(-6, 2, z - 1 + 0, "w", 1, 3, kind="stone")
    B.roof(rect, "z", 7, overhang=1, verge=1)
    # porch: 5 wide, 3 deep, its own little gable
    porch = (-2, 0, 2, 3)
    B.foundation(grow(porch, "ew"), 0)
    for x in range(-1, 2):
        for z in (1, 2): bp.set(x, 0, z, "polished_andesite")
    for x in (-2, 2):
        for z in (1, 3):
            for y in range(1, 4): bp.set(x, y, z, P["stone"])
    for z in (1, 2, 3):
        for x in (-2, 2): bp.set(x, 3, z, P["stone"])
    B.roof(porch, "z", 4, overhang=0, verge=0)
    B.build_roofs()
    B.gable_walls(rect, "z", 7, style="stone"); B.gable_walls(porch, "z", 4, style="stone")
    for x in range(-1, 2):
        for y in range(1, 4): bp.set(x, y, 3, "air")
    bp.set(-1, 3, 3, "stone_brick_stairs", facing="w", half="top"); bp.set(1, 3, 3, "stone_brick_stairs", facing="e", half="top")
    B.door(0, 1, 0, "s", canopy=False, lanterns=False, frame="siege:castle_smooth")
    hang(bp, [(0, 3, 2)])
    for x in (-3, 3): B.window(x, 3, 0, "s", 1, 2, kind="stone")
    B.window(0, 8, 0, "s", 1, 3, kind="stone")          # gable window over the porch
    for dx, dy in ((0, 0), (-1, 1), (0, 1), (1, 1), (0, 2)): bp.set(dx, 9 + dy, -20, P["pane"])   # round window at the back
    apex = B.H[(0, 0)][0]                                  # bellcote on the front gable
    for x in (-1, 0, 1): bp.set(x, apex, 0, P["stone"]); bp.set(x, apex + 3, 0, P["stone"])
    for x in (-1, 1): bp.set(x, apex + 1, 0, "stone_brick_wall"); bp.set(x, apex + 2, 0, "stone_brick_wall")
    bp.set(0, apex + 2, 0, "bell"); bp.set(0, apex + 4, 0, "stone_brick_wall")
    B.chimney(7, -12, 1, w=1, d=1)
    for z in (-5, -10, -15): bp.fill(-5, 6, z, 5, 6, z, P["frame2"], axis="x")
    # dais across the back with the Tree
    for x in range(-5, 6):
        for z in range(-19, -15): bp.set(x, 1, z, "siege:castle_smooth")
        bp.set(x, 1, -15, "stone_brick_stairs", facing="n")
    bp.set(0, 2, -18, "siege:tree_of_oaths"); bp.marks["tree"] = (0, 2, -18)
    bp.set(-2, 2, -16, "siege:brazier"); bp.set(2, 2, -16, "siege:brazier")
    bp.set(5, 1, -9, "cartography_table"); bp.marks["cartography"] = (5, 1, -9); bp.marks["sage"] = (4, 1, -12)
    for z in (-13, -12, -11): bp.set(5, 1, z, "bookshelf"); bp.set(5, 2, z, "bookshelf")
    bp.set(-5, 1, -9, "lectern", facing="e"); bp.marks["ledger"] = (-5, 1, -9)
    for z in (-6, -5): bp.set(-5, 1, z, "siege:castle_cobbled")
    bp.set(-5, 1, -4, "campfire"); bp.marks["hearth"] = (-5, 1, -4)
    hang(bp, [(0, 5, -5), (0, 5, -10), (0, 5, -15)])
    bp.markers["door"] = (0, 1, 0)
    return finish_detail(bp, P)

def _keep_body(B, P, rect, H):
    bp = B.bp
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, H)
    x0, z0, x1, z1 = rect
    for y in range(4, H, 1):  # pilaster strips every 4 along the long sides (Norman flat buttresses)
        for z in range(z1 - 4, z0, -4):
            bp.set(x0 - 1, y - 3, z, P["stone"]) if y - 3 <= H - 2 else None
            bp.set(x1 + 1, y - 3, z, P["stone"]) if y - 3 <= H - 2 else None

def vale_3(seed=3):
    """Keep: a tall Norman hall with four square corner towers, a war-room gallery inside. 17 x 23 (towers 5 x 5)."""
    P = vale_palette(seed); bp, B = new_hall("hall_vale_3", P, seed)
    rect = (-8, -22, 8, 0); H = 9
    _keep_body(B, P, rect, H)
    for z in (-6, -10, -14, -18):
        for x, s in ((8, "e"), (-8, "w")): B.window(x, 3, z, s, 1, 2, kind="stone"); B.window(x, 6, z, s, 1, 2, kind="stone")
    B.roof(rect, "z", H + 1, overhang=1, verge=0)
    B.build_roofs(); B.gable_walls(rect, "z", H + 1, style="stone")
    B.window(0, H + 2, 0, "s", 1, 3, kind="stone"); B.window(0, H + 2, -22, "n", 1, 3, kind="stone")
    for x in (-3, 3): B.window(x, 5, 0, "s", 1, 2, kind="stone")
    # deep arched doorway: 3 wide recess, door in the middle
    for x in (-1, 0, 1):
        for y in (1, 2, 3): bp.set(x, y, 1, "air")
    for x in (-2, 2):
        for y in (1, 2, 3, 4): bp.set(x, y, 1, "siege:castle_smooth")
    for x in (-1, 0, 1): bp.set(x, 4, 1, "siege:castle_smooth")
    bp.set(-1, 3, 1, "stone_brick_stairs", facing="w", half="top"); bp.set(1, 3, 1, "stone_brick_stairs", facing="e", half="top")
    B.door(0, 1, 0, "s", canopy=False, lanterns=False, frame="siege:castle_smooth")
    hang(bp, [(-1, 3, 2), (1, 3, 2)]) if False else hang(bp, [(0, 3, 1)])
    for (cx, cz) in ((-8, 0), (8, 0)): tower(B, cx, cz, 2, 1, H + 6, top="crenel")
    for (cx, cz) in ((-8, -22), (8, -22)): tower(B, cx, cz, 2, 1, H + 6, top="spire")
    for z in (-4, -8, -12): bp.fill(-7, H - 1, z, 7, H - 1, z, P["frame2"], axis="x")
    oath_dais(bp, P, 0, -11, half=2)
    bp.set(-3, 2, -11, "siege:brazier"); bp.set(3, 2, -11, "siege:brazier")
    # gallery over the back third: the war room
    for x in range(-7, 8):
        for z in range(-21, -15): bp.set(x, 5, z, P["floor"])
        bp.set(x, 6, -15, "spruce_fence")
    for k in range(1, 6):
        bp.set(6, k, -9 - k, "spruce_stairs", facing="n")
        for y in range(k + 1, k + 4): bp.set(6, y, -9 - k, "air")
    bp.set(6, 6, -15, "air")
    bp.set(0, 6, -19, "cartography_table"); bp.marks["warroom"] = (0, 6, -18); bp.marks["cartography"] = (0, 6, -19)
    bp.set(-2, 6, -19, "lectern", facing="s"); bp.set(2, 6, -19, "lectern", facing="s")
    for x in list(range(-6, -1)) + list(range(2, 7)): bp.set(x, 6, -21, "bookshelf"); bp.set(x, 7, -21, "bookshelf")
    for z in range(-21, -16): bp.set(-7, 1, z, "bookshelf"); bp.set(-7, 2, z, "bookshelf")
    bp.marks["sage"] = (-5, 1, -19)
    bp.set(5, 1, -20, "campfire"); bp.marks["hearth"] = (5, 1, -20)
    bp.set(-7, 1, -8, "lectern", facing="e"); bp.marks["ledger"] = (-7, 1, -8)
    hang(bp, [(-3, H - 2, -4), (3, H - 2, -4), (-3, H - 2, -8), (3, H - 2, -8), (0, 4, -19)])
    bp.markers["door"] = (0, 1, 0)
    return finish_detail(bp, P)

def _fortress(seed, sovereign):
    P = vale_palette(seed); bp, B = new_hall(f"hall_vale_{5 if sovereign else 4}", P, seed)
    rect = (-12, -30, 12, 0); H = 11
    _keep_body(B, P, rect, H)
    # parapet walk with merlons, slate roof inside it
    crenels(bp, -12, -30, 12, 0, H + 1, "siege:battlement")
    for x in range(-12, 13):
        for z in range(-30, 1):
            if x in (-12, 12) or z in (-30, 0): bp.set(x, H, z, P["stone"])
    B.roof((-10, -28, 10, -2), "z", H + 1, overhang=0, verge=0)
    # tall windows in two rows
    for z in (-5, -9, -13, -17, -24, -28) if False else (-5, -9, -13, -17):
        for x, s in ((12, "e"), (-12, "w")): B.window(x, 3, z, s, 1, 3, kind="stone"); B.window(x, 7, z, s, 1, 2, kind="stone")
    for z in (-24, -27):
        for x, s in ((12, "e"), (-12, "w")): B.window(x, 3, z, s, 1, 2, kind="stone")
    # gatehouse: a deep 3-wide arched passage between two 5 x 5 towers that stand forward of the wall,
    # machicolations over the arch, the portcullis raised in its slot
    for cx in (-4, 4): tower(B, cx, 1, 2, 1, H + 7, top="crenel")
    GH = H + 2
    for z in range(-1, 4):
        for x in range(-2, 3):
            for y in range(1, GH + 1):
                bp.set(x, y, z, "air" if (abs(x) <= 1 and y <= 4) else P["stone"])
            bp.set(x, 0, z, "polished_andesite")
    for x in (-1, 1): bp.set(x, 4, 3, "stone_brick_stairs", facing="w" if x < 0 else "e", half="top")
    for x in (-1, 0, 1): bp.set(x, 4, 2, "siege:portcullis", axis="x")
    for x in range(-3, 4): bp.set(x, GH - 1, 4, "stone_brick_stairs", facing="n", half="top")
    for x in range(-3, 4):
        bp.set(x, GH, 4, P["stone"])
        if x % 2 == 0: bp.set(x, GH + 1, 4, "siege:battlement")
    B.window(0, 7, 3, "s", 1, 2, kind="stone")
    B.door(0, 1, -2, "s", canopy=False, lanterns=False, frame="siege:castle_smooth")
    hang(bp, [(0, 4, 0)])
    # corner towers 7 x 7 with tall spires
    TH = H + 8 + (4 if sovereign else 0)
    for (cx, cz) in ((-12, 0), (12, 0), (-12, -30), (12, -30)): tower(B, cx, cz, 3, 1, TH, top="spire", eave=0)
    B.build_roofs(); B.gable_walls((-10, -28, 10, -2), "z", H + 1, style="stone")
    for z in (-5, -9, -13, -17): bp.fill(-11, H - 1, z, 11, H - 1, z, P["frame2"], axis="x")
    oath_dais(bp, P, 0, -11, half=3)
    for (x, z) in ((-3, -8), (3, -8), (-3, -14), (3, -14)): bp.set(x, 2, z, "siege:brazier")
    for z in range(-14, -7): bp.set(-11, 1, z, "bookshelf"); bp.set(-11, 2, z, "bookshelf"); bp.set(-11, 3, z, "bookshelf")
    bp.marks["sage"] = (-10, 1, -11)
    bp.set(11, 1, -11, "campfire"); bp.marks["hearth"] = (11, 1, -11)
    bp.set(-11, 1, -5, "lectern", facing="e"); bp.marks["ledger"] = (-11, 1, -5)
    # inner wall and the throne room at the back
    for x in range(-11, 12):
        for y in range(1, H): bp.set(x, y, -20, P["stone"])
    for x in (-1, 0, 1):
        for y in (1, 2, 3, 4): bp.set(x, y, -20, "air")
    for x in range(-3, 4):
        for z in range(-28, -24): bp.set(x, 1, z, "siege:castle_smooth")
        bp.set(x, 1, -24, "stone_brick_stairs", facing="n")
    bp.set(0, 2, -27, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, 2, -27)
    bp.set(-1, 2, -27, "quartz_slab"); bp.set(1, 2, -27, "quartz_slab")
    banner = "red_wool"
    for x in (-2, 2):
        for y in range(2, 7): bp.set(x, y, -29, banner)
    bp.set(-3, 2, -25, "siege:brazier"); bp.set(3, 2, -25, "siege:brazier")
    for z in range(-23, -20): bp.set(0, 1, z, "red_carpet")
    for z in range(-7, 0): bp.set(0, 1, z - 1, "red_carpet")
    # war room gallery over the throne room
    for x in range(-11, 12):
        for z in range(-29, -20): bp.set(x, 7, z, P["floor"])
    for x in (-1, 0, 1):
        for z in (-23, -22, -21): bp.set(x, 7, z, "air")
    for k in range(1, 8):
        bp.set(10, k, -12 - k, "spruce_stairs", facing="n")
        for y in range(k + 1, k + 4): bp.set(10, y, -12 - k, "air")
    for x in range(-11, 12): bp.set(x, 7, -20, P["floor"])
    bp.set(10, 7, -20, "air"); bp.set(10, 8, -20, "air"); bp.set(10, 9, -20, "air")
    bp.set(0, 8, -27, "cartography_table"); bp.marks["warroom"] = (0, 8, -26); bp.marks["cartography"] = (0, 8, -27)
    bp.set(-2, 8, -27, "lectern", facing="s"); bp.set(2, 8, -27, "lectern", facing="s")
    for x in range(-8, 9): bp.set(x, 8, -29, "bookshelf"); bp.set(x, 9, -29, "bookshelf")
    hang(bp, [(-5, H - 2, z) for z in (-5, -9, -13, -17)] + [(5, H - 2, z) for z in (-5, -9, -13, -17)] + [(-6, 6, -24), (6, 6, -24)])
    if sovereign:
        for z in (-5, -9, -13, -17):            # hanging banners inside the great hall
            for y in range(5, 9): bp.set(-11, y, z + 2, "red_wool"); bp.set(11, y, z + 2, "red_wool")
        # crown vault behind the throne room: 9 x 9, gilded floor
        vr = (-4, -36, 4, -30)
        B.foundation(grow(vr, "ew"), 0); B.floor(vr, 0, mat="gold_block")
        B.stone_storey(vr, 1, 7)
        B.roof(vr, "x", 8, overhang=1, verge=1)
        B.build_roofs(); B.gable_walls(vr, "x", 8, style="stone")
        for y in (1, 2): bp.set(3, y, -30, "air")
        for (x, z) in ((-3, -31), (3, -33), (-3, -37), (3, -37)): bp.set(x, 1, z, "siege:brazier")
        bp.marks["vault"] = (0, 1, -33)
        # the great tower over the hall's middle: a lantern tower with a gilded crown of merlons
        tower(B, 0, -11, 2, H + 1, 17, top="spire")
        for cx in (-4, 4):                      # royal banners down the gatehouse towers
            for y in range(8, 15): bp.set(cx, y, 4, "red_wool")
            bp.set(cx, 15, 4, "gold_block")
    bp.markers["door"] = (0, 1, 3)       # the gatehouse mouth: the Cornerstone stands just outside it
    return finish_detail(bp, P)

def vale_4(seed=4): return _fortress(seed, False)
def vale_5(seed=5): return _fortress(seed, True)

VALE_HALLS = [None, vale_1, vale_2, vale_3, vale_4, vale_5]
HALL_NAMES = [None, "Longhouse", "Stone Hall", "Keep", "Fortress", "Sovereign's Throne"]

# ---------------------------------------------------------------- shared fit-out
def fit_out(bp, P, rect, level, stone, door_z=None, back_room=None, gallery_y=None, floor_mat=None):
    """The working furniture every hall needs, placed by level in the hall's main room.
    rect = main room outline (x0, z0, x1, z1) with the door on z1. Returns nothing; sets bp.marks."""
    x0, z0, x1, z1 = rect
    cx = (x0 + x1) // 2
    room_back = back_room[3] if back_room else z0
    tz = room_back + 4 if not back_room else back_room[3] - 1 - 4    # the Tree stands near the back of the main room
    if back_room: tz = back_room[3] - 6
    half = 1 if level <= 2 else 2
    for x in range(cx - half, cx + half + 1):
        for z in range(tz - half, tz + half + 1): bp.set(x, 1, z, floor_mat or stone)
    bp.set(cx, 2, tz, "siege:tree_of_oaths"); bp.marks["tree"] = (cx, 2, tz)
    if level >= 2:
        bp.set(cx - half - 1, 2 if False else 1, tz, "siege:brazier"); bp.set(cx + half + 1, 1, tz, "siege:brazier")
    hz = (tz + z1) // 2
    bp.set(x1 - 1, 1, hz, "campfire"); bp.marks["hearth"] = (x1 - 1, 1, hz)
    bp.set(x0 + 1, 1, hz, "lectern", facing="e"); bp.marks["ledger"] = (x0 + 1, 1, hz)
    if level >= 2:
        bp.set(x1 - 1, 1, tz, "cartography_table"); bp.marks["cartography"] = (x1 - 1, 1, tz)
        for dz in (-1, 1): bp.set(x0 + 1, 1, tz + dz, "bookshelf"); bp.set(x0 + 1, 2, tz + dz, "bookshelf")
        bp.marks["sage"] = (x0 + 2, 1, tz)
    if level >= 3 and gallery_y:
        bp.marks["warroom"] = (cx, gallery_y + 1, z0 + 3); bp.marks["cartography"] = (cx, gallery_y + 1, z0 + 2)
        bp.set(cx, gallery_y + 1, z0 + 2, "cartography_table")
    if back_room:
        bx0, bz0, bx1, bz1 = back_room; bcx = (bx0 + bx1) // 2
        bp.set(bcx, 1, bz0 + 2, stone); bp.set(bcx, 2, bz0 + 2, "quartz_stairs", facing="n"); bp.marks["throne"] = (bcx, 2, bz0 + 2)
        for z in range(bz0 + 3, bz1): bp.set(bcx, 1, z, "blue_carpet" if False else "red_carpet")

def skirt(bp, P, rect, y, width=2, posts=4, mat=None):
    """Stave-church gallery roof: a pent roof of stairs all round the walls, on posts."""
    x0, z0, x1, z1 = rect; st = mat or P["roof"]
    for w in range(1, width + 1):
        yy = y - (w - 1)
        a0, b0, a1, b1 = x0 - w, z0 - w, x1 + w, z1 + w
        for x in range(a0, a1 + 1):
            for z in range(b0, b1 + 1):
                if not (x in (a0, a1) or z in (b0, b1)): continue
                f = "s" if z == b0 else "n" if z == b1 else "e" if x == a0 else "w"
                if (x, z) in ((a0, b0), (a1, b0)): f = "s"
                if (x, z) in ((a0, b1), (a1, b1)): f = "n"
                bp.set(x, yy, z, st, facing=f, half="bottom")
    a0, b0, a1, b1 = x0 - width, z0 - width, x1 + width, z1 + width
    for x in range(a0, a1 + 1):
        for z in range(b0, b1 + 1):
            if (x in (a0, a1) or z in (b0, b1)) and ((x - a0) % posts == 0 or (z - b0) % posts == 0) and (x in (a0, a1)) != (z in (b0, b1)) or (x, z) in ((a0, b0), (a1, b0), (a0, b1), (a1, b1)):
                if (x in (a0, a1) and (z - b0) % posts == 0) or (z in (b0, b1) and (x - a0) % posts == 0):
                    for yy in range(1, y - width + 1): bp.set(x, yy, z, P["fence"])
        # gallery floor
    for x in range(a0, a1 + 1):
        for z in range(b0, b1 + 1):
            if not (x0 <= x <= x1 and z0 <= z <= z1): bp.setif(x, 0, z, P["floor"])

def dragon_heads(bp, x, y, z, along="z", mat="dark_oak_stairs"):
    """Crossed barge boards: the verge boards run on past the ridge in a V, the Norse gable horns."""
    for s_ in (-1, 1):
        for i in (1, 2):
            dx, dz = (s_ * i, 0) if along == "z" else (0, s_ * i)
            f = ("e" if s_ > 0 else "w") if along == "z" else ("s" if s_ > 0 else "n")
            bp.set(x + dx, y + i - 1, z + dz, mat, facing=f, half="bottom")

def frost_palette(seed=0):
    k = castle("frostmarch")
    P = dict(VALE)
    P.update(plinth=mix([(k("cobbled"), 60), (k("stone"), 40)], 70 + seed), found=k("cobbled"), stone=mix([(k("smooth"), 100)], 71),
             quoin=k("stone"), quoin2=k("bricks"), frame="dark_oak_log", frame2="dark_oak_log", infill="spruce_planks",
             roof="dark_oak_stairs", roof_block="dark_oak_planks", roof_slab="dark_oak_slab", trim="spruce_stairs", trim_block="spruce_planks",
             trim_slab="spruce_slab", gable="stripped_spruce_log", floor="spruce_planks", door="dark_oak_door", shutter="dark_oak_trapdoor", shutters=0.0,
             chimney=mix([(k("bricks"), 80), (k("cobbled"), 20)], 72), sill="stone_brick_stairs", fence="dark_oak_fence")
    return detailed(P)

def frost_hall(level, seed=0):
    """Frostmarch: Norse mead halls growing into a stave-church fortress. Steep shingle roofs (two up per step),
    a gallery skirt roof round the walls from level 2, a tiered ridge tower from level 3, stone towers at 4 and 5."""
    P = frost_palette(seed); bp, B = new_hall(f"hall_frostmarch_{level}", P, seed)
    w, d, h = [None, (9, 17, 4), (13, 21, 5), (15, 23, 6), (17, 27, 7), (19, 31, 8)][level]
    hx = w // 2; rect = (-hx, -(d - 1), hx, 0)
    k = castle("frostmarch")
    B.foundation(grow(rect, "new", 3 if level >= 2 else 1), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, 1, quoins=False)
    B.timber_storey(rect, 2, h + 1, bay=4)
    if level == 1: B.bay_windows(rect, 2, "ew")
    else:
        for z in range(-3, -(d - 1), -4):
            for x, sd in ((hx, "e"), (-hx, "w")): B.window(x, h, z, sd, 1, 1)
    top = 2 + h + 1
    B.roof(rect, "z", top, overhang=1, verge=1, pitch=1)
    B.build_roofs(); B.gable_walls(rect, "z", top, style="timber")
    if level >= 2: skirt(bp, P, rect, h + 1, width=2)
    apex_f = B.H[(0, 0)][0]; apex_b = B.H[(0, -(d - 1))][0]
    dragon_heads(bp, 0, apex_f + 1, 1); dragon_heads(bp, 0, apex_b + 1, -(d - 1) - 1)
    # porch with its own little steep roof over the door
    porch = (-2, 1, 2, 2)
    for x in range(-2, 3):
        for z in range(1, porch[3] + 1): bp.set(x, 0, z, P["floor"])
    for x in (-2, 2):
        for y in range(1, 4): bp.set(x, y, porch[3], "dark_oak_log", axis="y")
    B.roof(porch, "z", 4, overhang=0, verge=1, pitch=1)
    B.build_roofs(); B.gable_walls(porch, "z", 4, style="timber")
    for x in range(-1, 2):
        for y in range(1, 4): bp.set(x, y, porch[3], "air")
        for z in range(1, porch[3]):
            for y in range(1, 4): bp.set(x, y, z, "air")
    B.door(0, 1, 0, "s", canopy=False, lanterns=False, frame="dark_oak_log")
    hang(bp, [(0, 3, 2)])
    B.window(0, top + 2, 0, "s", 1, 2)
    gy = None
    if level >= 3:     # tiered tower on the ridge, stave-church style
        tz = -(d // 2); tiers = 2 if level == 3 else 3
        base = B.H[(0, tz)][0] - 1; half = 2
        for t in range(tiers):
            for x in range(-half, half + 1):
                for z in range(tz - half, tz + half + 1):
                    for y in range(base, base + 3):
                        edge = abs(x) == half or abs(z - tz) == half
                        bp.set(x, y, z, ("dark_oak_log" if (abs(x) == half and abs(z - tz) == half) else P["infill"]) if edge else "air", **({"axis": "y"} if (abs(x) == half and abs(z - tz) == half) else {}))
            for sd, (x, z) in (("s", (0, tz + half)), ("n", (0, tz - half)), ("e", (half, tz)), ("w", (-half, tz))): bp.set(x, base + 1, z, P["pane"])
            nb = pyramid(bp, P, -half - 1, tz - half - 1, half + 1, tz + half + 1, base + 3, pitch=1 if t < tiers - 1 else 2, finial=None if t < tiers - 1 else "dark_oak_fence")
            if t < tiers - 1: base = base + 4; half = max(1, half - 1)
        gy = None
    if level >= 3:
        gy = 2 + h
        for x in range(-hx + 1, hx):
            for z in range(-(d - 2), -(d - 2) + 5): bp.set(x, gy, z, P["floor"])
            bp.set(x, gy + 1, -(d - 2) + 5, "dark_oak_fence")
    if level >= 4:     # frostmarch stone towers at the front corners, steep spires
        for cx in (-hx - 1, hx + 1): tower(B, cx, 0, 2, 1, h + 9, top="spire")
    back = None
    if level == 5:     # throne annex and vault behind, same mead-hall form
        ar = (-5, -(d - 1) - 10, 5, -(d - 1))
        B.foundation(grow(ar, "ew"), 0); B.floor(ar, 0); B.stone_storey(ar, 1, 1, quoins=False); B.timber_storey(ar, 2, 5, bay=4)
        B.roof(ar, "z", 8, overhang=1, verge=1, pitch=1); B.build_roofs(); B.gable_walls(ar, "z", 8, style="timber")
        for x in (-1, 0, 1):
            for y in (1, 2, 3): bp.set(x, y, -(d - 1), "air")
        bp.set(0, 2, ar[1] + 2, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, 2, ar[1] + 2)
        for x in (-2, 2):
            for y in range(2, 6): bp.set(x, y, ar[1] + 1, "blue_wool")
        bp.marks["vault"] = (0, 1, ar[1] + 5)
        for x in range(-1, 2):
            for z in range(ar[1] + 4, ar[1] + 7): bp.set(x, 0, z, "gold_block")
    fit_out(bp, P, rect, level, k("smooth"), gallery_y=gy)
    if level == 4:
        bp.set(0, 2, -(d - 2) + 1, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, 2, -(d - 2) + 1)
    for z in range(-4, -(d - 1), -4): hang(bp, [(0, 1 + h, z)])
    bp.markers["door"] = (0, 1, 0)
    return finish_detail(bp, P)

# ---------------------------------------------------------------- shared shapes for the southern / fen halls
def dome(bp, cx, y0, cz, r, mat, finial=None):
    """Blocky hemisphere shell of radius r sitting on y0."""
    import math
    for y in range(0, r + 1):
        for x in range(-r, r + 1):
            for z in range(-r, r + 1):
                d = math.sqrt(x * x + z * z + (y * 1.0) ** 2)
                if r - 1 < d <= r + 0.3: bp.set(cx + x, y0 + y, cz + z, mat)
                elif d <= r - 1: bp.set(cx + x, y0 + y, cz + z, "air") if bp.get(cx + x, y0 + y, cz + z)[0] == "keep" else None
    if finial: bp.set(cx, y0 + r + 1, cz, finial)
    return y0 + r

def drum(B, cx, cz, half, y0, h, windows=True):
    """Square drum (the base a dome or lantern sits on), windows on each face."""
    rect = (cx - half, cz - half, cx + half, cz + half)
    B.stone_storey(rect, y0, h, plinth=False)
    if windows:
        for side in "nsew":
            dx, _, dz = DIRS[side]
            for o in (-1, 0, 1) if half >= 3 else (0,):
                x, z = cx + dx * half + (o if side in "ns" else 0), cz + dz * half + (o if side in "ew" else 0)
                B.bp.set(x, y0 + 1, z, B.P["pane"]); B.bp.set(x, y0 + 2, z, B.P["pane"])
    return y0 + h

def arcade(B, x0, x1, z, y0, h, step=2, roof=True):
    """An open arcade along a front at plane z: piers every `step`+1, arches of upside-down stairs, a pent roof over."""
    bp, P = B.bp, B.P
    for x in range(x0, x1 + 1):
        pier = (x - x0) % (step + 1) == 0
        for y in range(y0, y0 + h): bp.set(x, y, z, P["stone"] if pier else "air")
        bp.set(x, y0 + h, z, P["stone"])
        if not pier:
            l = (x - x0) % (step + 1)
            bp.set(x, y0 + h - 1, z, P["sill"], facing="w" if l == 1 else "e", half="top") if step >= 2 and l in (1, step) else None
        bp.set(x, y0 - 1, z, P["floor"])
    if roof:
        for x in range(x0 - 1, x1 + 2): bp.set(x, y0 + h + 1, z, P["roof"], facing="n", half="bottom")

def flat_roof(bp, P, rect, y, parapet=True, merlons=False):
    x0, z0, x1, z1 = rect
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z in (z0, z1)
            bp.set(x, y, z, P["roof_flat"] if not edge else P["stone"])
            if edge and parapet and (not merlons or (x + z) % 2 == 0):
                bp.set(x, y + 1, z, P["stone"])

def salt_palette(seed=0):
    k = castle("saltreach")
    P = dict(VALE)
    P.update(plinth=mix([(k("cobbled"), 60), (k("stone"), 40)], 80), found=k("cobbled"), stone=mix([(k("smooth"), 100)], 81),
             quoin=k("smooth"), quoin2=k("smooth"), roof="dark_prismarine_stairs", roof_block="dark_prismarine", roof_slab="dark_prismarine_slab",
             trim="birch_stairs", trim_block="birch_planks", trim_slab="birch_slab", floor="birch_planks", door="birch_door",
             frame="stripped_birch_log", frame2="stripped_birch_log", sill="sandstone_stairs", shutter="birch_trapdoor", fence="birch_fence",
             chimney=mix([(k("bricks"), 100)], 82), roof_flat=k("tiles"))
    return detailed(P)

def salt_hall(level, seed=0):
    """Saltreach: whitewashed-sand harbour halls with sea-green tile roofs, a front arcade, a dome over
    the hall from level 2, a lighthouse tower from level 3, more domes and towers at 4 and 5."""
    P = salt_palette(seed); bp, B = new_hall(f"hall_saltreach_{level}", P, seed)
    k = castle("saltreach")
    w, d, h = [None, (11, 15, 5), (13, 19, 6), (15, 23, 7), (19, 27, 8), (21, 29, 9)][level]
    hx = w // 2; rect = (-hx, -(d - 1), hx, -2)       # the arcade porch takes z -1..0
    B.foundation(grow((rect[0], rect[1], rect[2], 0), "nsew", 1), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, h)
    for x in range(-hx, hx + 1):                     # cornice band
        for z in (rect[1], rect[3]): bp.set(x, h + 1, z, k("bricks"))
    for z in range(rect[1], rect[3] + 1):
        for x in (-hx, hx): bp.set(x, h + 1, z, k("bricks"))
    for z in range(rect[3] - 3, rect[1], -4):
        for x, s in ((hx, "e"), (-hx, "w")): B.window(x, 2, z, s, 1, 3 if h >= 7 else 2, kind="stone")
    # front arcade (loggia): piers, a tiled pent roof, the door in the back wall of it
    ax = min(hx, 2 + 3 * max(1, level - 1) // 1)
    ax = hx if level >= 2 else 4
    for x in range(-ax, ax + 1):
        for z in (-1, 0): bp.set(x, 0, z, k("tiles"))
    arcade(B, -ax, ax, 0, 1, 3, step=2 if level < 4 else 2)
    for x in range(-ax, ax + 1): bp.set(x, 4, -1, P["stone"])
    B.door(0, 1, -2, "s", canopy=False, lanterns=False, frame=k("stone"))
    for x in (-3, 3): B.window(x, 2, -2, "s", 1, 2, kind="stone") if hx >= 4 else None
    hang(bp, [(-2, 3, -1), (2, 3, -1)])
    if level == 1:
        pyramid(bp, P, -hx - 1, rect[1] - 1, hx + 1, rect[3] + 1, h + 2, pitch=1, finial="lantern" if False else "lantern")
    else:
        pyramid(bp, P, -hx - 1, rect[1] - 1, hx + 1, rect[3] + 1, h + 2, pitch=1, finial=None)
        cz = (rect[1] + rect[3]) // 2
        r = [None, 0, 3, 3, 4, 5][level]
        roof_top = h + 2 + min(hx + 1, (rect[3] - rect[1]) // 2 + 1)
        top = drum(B, 0, cz, r, h + 2, roof_top - h - 1)
        dome(bp, 0, top, cz, r, "dark_prismarine", finial="lantern")
    if level >= 3:     # lighthouse at the front-left corner: tall square shaft, gallery, glowing lantern room, little dome
        lx, lz = -hx - 1, -2
        T = h + 10 + 2 * (level - 3)
        tower(B, lx, lz, 2, 1, T, top="crenel")
        for y in range(T + 1, T + 4):
            for x in range(lx - 1, lx + 2):
                for z in range(lz - 1, lz + 2):
                    edge = abs(x - lx) == 1 or abs(z - lz) == 1
                    bp.set(x, y, z, ("glass" if y < T + 3 else k("smooth")) if edge else ("glowstone" if y == T + 1 else "air"))
        dome(bp, lx, T + 3, lz, 2, "dark_prismarine", finial="lantern")
    if level >= 4:     # bell tower at the front-right, small dome
        tower(B, hx + 1, -2, 2, 1, h + 8, top="crenel")
        dome(bp, hx + 1, h + 11, -2, 2, "dark_prismarine", finial="lantern")
    if level == 5:     # side domes on the back corners and the vault behind
        for x in (-hx + 2, hx - 2):
            drum(B, x, rect[1] + 2, 1, h + 3, 2, windows=False); dome(bp, x, h + 5, rect[1] + 2, 2, "dark_prismarine", finial="lantern")
        vr = (-4, rect[1] - 8, 4, rect[1])
        B.foundation(grow(vr, "ew"), 0); B.floor(vr, 0, mat="gold_block"); B.stone_storey(vr, 1, 6)
        flat_roof(bp, P, vr, 7)
        for y in (1, 2): bp.set(0, y, rect[1], "air")
        bp.marks["vault"] = (0, 1, vr[1] + 4)
    gy = None
    if level >= 3:
        gy = h - 2
        for x in range(-hx + 1, hx):
            for z in range(rect[1] + 1, rect[1] + 5): bp.set(x, gy, z, P["floor"])
            bp.set(x, gy + 1, rect[1] + 5, "birch_fence")
    fit_out(bp, P, rect, level, k("smooth"), gallery_y=gy)
    if level >= 4:
        bp.set(0, 2, rect[1] + 2 if level == 4 else rect[1] + 2, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, 2, rect[1] + 2)
    for z in range(rect[3] - 3, rect[1], -4): hang(bp, [(0, h, z)])
    bp.markers["door"] = (0, 1, -2)
    return finish_detail(bp, P)

def ember_palette(seed=0):
    k = castle("emberwaste")
    P = dict(VALE)
    P.update(plinth=mix([(k("cobbled"), 60), (k("stone"), 40)], 90), found=k("cobbled"), stone=mix([(k("smooth"), 100)], 91),
             quoin=k("smooth"), quoin2=k("smooth"), roof="red_sandstone_stairs", roof_block="cut_red_sandstone", roof_slab="red_sandstone_slab",
             trim="acacia_stairs", trim_block="acacia_planks", trim_slab="acacia_slab", floor="acacia_planks", door="acacia_door",
             frame="stripped_acacia_log", sill="polished_granite_stairs", shutter="acacia_trapdoor", fence="acacia_fence",
             chimney=mix([(k("bricks"), 100)], 92), roof_flat=k("tiles"), planters=False)
    return detailed(P)

def kasbah_tower(B, cx, cz, half, h, k):
    """Tapering kasbah tower: wide base, steps in near the top, crenels of corner horns, slit windows, vigas."""
    bp, P = B.bp, B.P
    rect = (cx - half, cz - half, cx + half, cz + half)
    B.foundation(rect, 0); B.stone_storey(rect, 1, h, plinth=False, quoins=False)
    for y in range(4, h - 1, 4):
        for side in "nsew":
            dx, _, dz = DIRS[side]; bp.set(cx + dx * half, y, cz + dz * half, P["pane"])
    r2 = (cx - half + 1, cz - half + 1, cx + half - 1, cz + half - 1)
    B.stone_storey(r2, h + 1, 3, plinth=False, quoins=False)
    yt = h + 4
    for x in range(r2[0], r2[2] + 1):
        for z in range(r2[1], r2[3] + 1):
            edge = x in (r2[0], r2[2]) or z in (r2[1], r2[3])
            bp.set(x, yt - 1, z, k("tiles") if not edge else bp.get(x, yt - 1, z)[0])
            if (x, z) in ((r2[0], r2[1]), (r2[2], r2[1]), (r2[0], r2[3]), (r2[2], r2[3])):
                bp.set(x, yt, z, P["stone"]); bp.set(x, yt + 1, z, P["stone"])
            elif edge and (x + z) % 2 == 0: bp.set(x, yt, z, P["stone"])
    for side in "nsew":       # vigas: beam ends poking out under the step
        dx, _, dz = DIRS[side]
        for o in (-1, 1):
            x = cx + dx * (half + 1) + (o if side in "ns" else 0); z = cz + dz * (half + 1) + (o if side in "ew" else 0)
            pass
    return yt + 2

def ember_hall(level, seed=0):
    """Emberwaste: a fortified red kasbah. Flat roofs with toothed parapets, tapering corner towers,
    beam ends (vigas), a striped awning over the door; terraces stepping up into a ziggurat at 4 and 5."""
    P = ember_palette(seed); bp, B = new_hall(f"hall_emberwaste_{level}", P, seed)
    k = castle("emberwaste")
    w, d, h = [None, (11, 13, 5), (13, 19, 6), (17, 23, 7), (21, 29, 8), (23, 31, 9)][level]
    hx = w // 2; rect = (-hx, -(d - 1), hx, 0)
    B.foundation(grow(rect, "nsew"), 0); B.floor(rect, 0)
    B.stone_storey(rect, 1, h, quoins=False)
    for z in range(-3, -(d - 1), -4):
        for x, s in ((hx, "e"), (-hx, "w")): B.window(x, 3, z, s, 1, 1, kind="stone")
    for x in range(-hx + 1, hx, 2):                  # vigas along the front and back
        for z in (1, -d): bp.set(x, h - 1, z, "stripped_spruce_log", axis="z")
    for x in range(-hx, hx + 1):                     # a band of patterned brick under the parapet
        for z in (0, -(d - 1)): bp.set(x, h, z, k("bricks"))
    for z in range(-(d - 1), 1):
        for x in (-hx, hx): bp.set(x, h, z, k("bricks"))
    flat_roof(bp, P, rect, h + 1, parapet=True, merlons=True)
    # tall arched doorway with a striped awning on acacia posts
    for y in (1, 2, 3):
        for x in (-1, 0, 1): bp.set(x, y, 0, "air")
    bp.set(-1, 3, 0, "red_sandstone_stairs", facing="w", half="top"); bp.set(1, 3, 0, "red_sandstone_stairs", facing="e", half="top")
    B.door(0, 1, -1, "s", canopy=False, lanterns=False, frame=k("stone"))
    for x in range(-2, 3):
        bp.set(x, 4, 1, "orange_wool" if x % 2 == 0 else "white_wool"); bp.set(x, 4, 2, "orange_wool" if x % 2 == 0 else "white_wool")
    for x in (-2, 2):
        for y in (1, 2, 3): bp.set(x, y, 2, "acacia_fence")
    hang(bp, [(0, 3, 1)])
    if level >= 2:
        for cx in (-hx, hx): kasbah_tower(B, cx, 0, 2, h + 4, k)
    if level >= 3:
        for cx in (-hx, hx): kasbah_tower(B, cx, -(d - 1), 2, h + 4, k)
    if level >= 4:      # stepped terraces: a second and third box on the roof, ziggurat-like
        r2 = (-hx + 3, -(d - 1) + 3, hx - 3, -6)
        B.stone_storey(r2, h + 2, 5, plinth=False, quoins=False); flat_roof(bp, P, r2, h + 7, merlons=True)
        for z in range(r2[3] - 2, r2[1], -4):
            for x, s in ((r2[2], "e"), (r2[0], "w")): B.window(x, h + 4, z, s, 1, 1, kind="stone")
        r3 = (-3, (r2[1] + r2[3]) // 2 - 3, 3, (r2[1] + r2[3]) // 2 + 3)
        B.stone_storey(r3, h + 8, 4 + (2 if level == 5 else 0), plinth=False, quoins=False)
        yt = h + 12 + (2 if level == 5 else 0)
        flat_roof(bp, P, r3, yt, merlons=True)
        if level == 5:
            dome(bp, 0, yt + 1, (r3[1] + r3[3]) // 2, 3, "gold_block", finial="lantern")
    back = None
    if level == 5:
        vr = (-4, -(d - 1) - 8, 4, -(d - 1))
        B.foundation(grow(vr, "ew"), 0); B.floor(vr, 0, mat="gold_block"); B.stone_storey(vr, 1, 6, quoins=False)
        flat_roof(bp, P, vr, 7, merlons=True)
        for y in (1, 2): bp.set(0, y, -(d - 1), "air")
        bp.marks["vault"] = (0, 1, vr[1] + 4)
    gy = None
    if level >= 3:
        gy = h - 2
        for x in range(-hx + 1, hx):
            for z in range(-(d - 2), -(d - 2) + 4): bp.set(x, gy, z, P["floor"])
            bp.set(x, gy + 1, -(d - 2) + 4, "acacia_fence")
    fit_out(bp, P, (rect[0], rect[1], rect[2], -1), level, k("smooth"), gallery_y=gy)
    if level >= 4: bp.set(0, 2, -(d - 2) + 1, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, 2, -(d - 2) + 1)
    for z in range(-4, -(d - 1), -4): hang(bp, [(0, h, z)])
    bp.markers["door"] = (0, 1, -1)
    return finish_detail(bp, P)

def fen_palette(seed=0):
    k = castle("blackfen")
    P = dict(VALE)
    P.update(plinth=mix([(k("cobbled"), 100)], 100), found=k("cobbled"), stone=mix([(k("smooth"), 100)], 101),
             quoin=k("stone"), quoin2=k("bricks"), frame="mangrove_log", frame2="mangrove_log", infill=mix([("mud_bricks", 85), ("packed_mud", 15)], 102),
             roof="dark_oak_stairs", roof_block="dark_oak_planks", roof_slab="dark_oak_slab", trim="mangrove_stairs", trim_block="mangrove_planks",
             trim_slab="mangrove_slab", floor="dark_oak_planks", door="mangrove_door", shutter="mangrove_trapdoor", fence="mangrove_fence",
             gable="mangrove_planks", sill="mud_brick_stairs", chimney=mix([(k("bricks"), 100)], 103))
    return detailed(P)

def thatch(bp, P, B, rect, y_moss=True):
    """Moss over the roof: carpets on the stair steps and moss blocks on the ridge, for the fen's turf roofs."""
    for (x, z), (hh, _) in B.H.items():
        n = bp.get(x, hh, z)[0]
        if n.endswith("_stairs") and h3(x, hh, z, 7) < 0.12: bp.set(x, hh, z, "moss_block")
        elif n.endswith("_planks"): bp.set(x, hh, z, "moss_block")
        above = bp.get(x, hh + 1, z)[0]
        if above.endswith("_slab"): bp.set(x, hh + 1, z, "moss_carpet")

def fen_hall(level, seed=0):
    """Blackfen: a stilt hall over the mire on mangrove piles, mud-brick between mangrove frames under
    moss-turfed roofs, a boardwalk round it; a mossy stone witch tower from level 3, more at 4 and 5."""
    P = fen_palette(seed); bp, B = new_hall(f"hall_blackfen_{level}", P, seed)
    k = castle("blackfen")
    w, d, h = [None, (9, 13, 4), (11, 17, 5), (13, 21, 5), (15, 25, 6), (17, 27, 7)][level]
    lift = 2
    hx = w // 2; rect = (-hx, -(d - 1), hx, 0)
    # piles and the boardwalk deck at y = lift
    for x in range(-hx - 2, hx + 3):
        for z in range(-(d - 1) - 2, 2):
            bp.set(x, lift, z, P["floor"])
            if (x in (-hx - 2, hx + 2) or z in (-(d - 1) - 2, 1)) and (x + z) % 3 == 0:
                for y in range(-2, lift): bp.set(x, y, z, "mangrove_log", axis="y")
                bp.set(x, lift + 1, z, "mangrove_fence")
            elif (x in (-hx, hx) and z in (0, -(d - 1))):
                for y in range(-2, lift): bp.set(x, y, z, "mangrove_log", axis="y")
    for x in range(-1, 2):           # stair down from the deck to the ground in front
        for i in range(lift):
            bp.set(x, lift - i, 2 + i, "dark_oak_stairs", facing="n")
    B.timber_storey(rect, lift + 1, h, bay=4)
    B.bay_windows(rect, lift + 1, "ew")
    B.door(0, lift + 1, 0, "s", canopy=True, lanterns=True, frame="mangrove_log")
    top = lift + 1 + h
    B.roof(rect, "z", top, overhang=1, verge=1, pitch=1)
    B.build_roofs(); B.gable_walls(rect, "z", top, style="timber"); thatch(bp, P, B, rect)
    if level >= 2:   # side wing (a cross gable) to the east
        wr = (hx, -(d // 2) - 3, hx + 4, -(d // 2) + 3)
        for x in range(wr[0], wr[2] + 2):
            for z in range(wr[1] - 2, wr[3] + 3): bp.setif(x, lift, z, P["floor"])
        for x in (wr[2] + 1,):
            for z in range(wr[1] - 2, wr[3] + 3, 3):
                for y in range(-2, lift): bp.set(x, y, z, "mangrove_log", axis="y")
        B2 = Building(bp, P, seed + 1); B2.timber_storey(wr, lift + 1, h - 1, bay=3)
        for z in range(wr[1] + 1, wr[3]): bp.set(hx, lift + 2, z, "air"); bp.set(hx, lift + 3, z, "air")
        B2.roof(wr, "x", lift + h, overhang=1, verge=1); B2.build_roofs(); B2.gable_walls(wr, "x", lift + h, style="timber"); thatch(bp, P, B2, wr)
    if level >= 3:   # the witch tower: mossy castle stone, round-ish, a steep turf cone with a lantern
        tx, tz = -hx - 1, -(d - 1)
        T = h + 9 + 3 * (level - 3)
        tower(B, tx, tz, 2, 1, T, top="spire")
        for (x, z), (hh, _) in list(B.H.items()): pass
        bp.set(tx, T + 9, tz, "soul_lantern") if False else None
    if level >= 4:
        tower(B, hx + 1, -(d - 1), 2, 1, h + 8, top="spire")
    if level == 5:
        vr = (-3, -(d - 1) - 7, 3, -(d - 1))
        B3 = Building(bp, P, seed + 3); B3.foundation(vr, lift - 1); B3.floor(vr, lift, mat="gold_block")
        B3.stone_storey(vr, lift + 1, 5); B3.roof(vr, "x", lift + 6); B3.build_roofs(); B3.gable_walls(vr, "x", lift + 6, style="stone"); thatch(bp, P, B3, vr)
        for y in (lift + 1, lift + 2): bp.set(0, y, -(d - 1), "air")
        bp.marks["vault"] = (0, lift + 1, vr[1] + 3)
    # fit-out one floor up (the hall floor is the deck)
    before = dict(bp.cells)
    sub = Blueprint("tmp"); sub.marks = {}
    gy = None
    if level >= 3:      # war-room loft over the back of the hall
        gy = h - 1
        for x in range(-hx + 1, hx):
            for z in range(-(d - 2), -(d - 2) + 4): sub.set(x, gy, z, P["floor"])
            sub.set(x, gy + 1, -(d - 2) + 4, "mangrove_fence")
    fit_out(sub, P, rect, level, k("smooth"), gallery_y=gy)
    for (x, y, z), v in sub.cells.items(): bp.cells[(x, y + lift, z)] = v
    for m, (x, y, z) in sub.marks.items(): bp.marks[m] = (x, y + lift, z)
    if level >= 4: bp.set(0, lift + 2, -(d - 2) + 1, "quartz_stairs", facing="n"); bp.marks["throne"] = (0, lift + 2, -(d - 2) + 1)
    for z in range(-4, -(d - 1), -4): hang(bp, [(0, lift + h, z)])
    bp.markers["door"] = (0, 1, 3)               # the Cornerstone stands on the ground at the foot of the deck stair
    bp.markers["entry"] = (0, lift + 1, 0)       # the hall's own door up on the deck
    return finish_detail(bp, P)

REGION_HALLS = {"vale": lambda l: VALE_HALLS[l](), "frostmarch": frost_hall, "saltreach": salt_hall, "emberwaste": ember_hall, "blackfen": fen_hall}
