"""Bridges: a straight A-to-B crossing at any angle, sized by its span and styled by region and use.

The four steps Mateo set out (2026-11-12):
  1. find where a path or rail line crosses a gap: water, a ravine, a valley between hills  (find_crossings)
  2. measure it: span, how deep, how high each bank is, which way the deck must slope      (plan)
  3. build the bridge along the line A->B, whatever the angle                               (part "bridge")
  4. style it by region and by use: foot, road or rail                                      (STYLES)

How the any-angle build works. Nothing is rotated. Every block column (x, z) near the line gets two
numbers: u, the distance along the line from A, and v, the signed distance across it. The bridge is
written as functions of u and v only: the walking surface W(u), the deck band |v| <= half width, the
arch soffits S(u) between piers, the parapet on the band's edge, cutwaters past the edge at each pier.
A column is a stack of those answers. So a bridge at 0, 37 or 212 degrees is the same maths, and the
parapet stays joined on a diagonal because the edge is taken as every band cell with an outside
neighbour (8-way), which always gives a 4-way joined line for walls and fences to connect along.

Sizing (longer = grander and higher; reference/bridges.md has the table and the real bridges behind it):
  span <= 4      beam / clapper: one slab deck on stone ends (Dartmoor clapper bridges)
  5 - 15         one arch, humped for foot traffic (packhorse bridges)
  16 - 40        an odd number of arches, piers with cutwaters, lamps on every pier
  41+            grand: wider piers, refuges over the cutwaters, string courses, and when the valley is
                 deep enough a second tier of arches below (Pont du Gard, Goltzsch, Ribblehead)
  Arch width grows with the height above the floor, as real viaducts do (span ~ 0.9 x height).

Grades (Mateo: "graded at the correct angle for slope"): foot and road decks keep the paths rule, at
most half a block per block, in slab steps; over water they hump up to clear boats, never steeper than
that. Rail decks run straight from bank to bank at the track's own grade (the caller's bed heights).

Use: part "bridge" in a spec, or bridge_blocks(crossing) for world blocks, works_columns() for the
trains' run-length format. CLI: python3 bridges.py crossing.json OUT  (preview + .mcfunction like build.py).
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from materials import h3  # noqa: E402

CARD = {"e": (1, 0), "w": (-1, 0), "s": (0, 1), "n": (0, -1)}


def card(dx, dz):
    """Nearest cardinal of a direction; facings follow parts.py (a stair faces its tall side)."""
    if abs(dx) >= abs(dz): return "e" if dx > 0 else "w"
    return "s" if dz > 0 else "n"


def log_axis(dx, dz): return "x" if abs(dx) >= abs(dz) else "z"


# ----------------------------------------------------------------------------------------------- styles
# One table per region, one row per use. Keys:
#   under     arch (round) | segmental | pointed | trestle    what carries the deck
#   wall      spandrel and pier stone        ring  arch ring (voussoirs)      key  keystone on the face
#   deck      walking surface (needs a slab form)               coping  parapet cap / curb
#   parapet   wall | solid | fence | curb | none                light  lantern block, or None
#   footing   pier feet and cutwaters below the waterline        post / beam  trestle timber (logs)
#   brace     trestle bracing (fence material)                   roof   covered bridge roof (Frostmarch)
# The blocks come from build-instructions/palettes/<region>.md. Rail rows use a different, heavier
# material from the foot and road rows of the same region, as Mateo asked.
VALE_STONE = {"ladder": ["mossy_stone_bricks", "cracked_stone_bricks", "stone_bricks", "stone_bricks"], "axis": "noise", "scale": 2}
VALE_FOOT = {"ladder": ["mossy_cobblestone", "cobblestone", "stone_bricks", "andesite"], "axis": "noise", "scale": 2}
STYLES = {
    "vale": {
        # packhorse bridge / medieval multi-arch with cutwaters / red-brick Victorian viaduct (Ouse Valley, Digswell)
        "foot": dict(under="arch", wall=VALE_FOOT, ring="stone_bricks", key="chiseled_stone_bricks", deck="cobblestone",
                     coping="stone_bricks", parapet="wall", light="lantern", footing="mossy_cobblestone"),
        "road": dict(under="arch", wall=VALE_STONE, ring="stone_bricks", key="chiseled_stone_bricks", deck="stone_bricks",
                     coping="stone_bricks", parapet="solid", light="lantern", footing="mossy_stone_bricks"),
        "rail": dict(under="arch", wall={"ladder": ["brick_block", "mud_bricks"], "axis": "noise", "scale": 3}, ring="stone_bricks",
                     key="polished_andesite", deck="stone_bricks", coping="polished_andesite", parapet="solid", light=None,
                     footing="stone_bricks", pilaster="stone_bricks"),
    },
    "frostmarch": {
        # covered timber bridge (Kapellbruecke, Lucerne) / deepslate segmental arches / timber trestle on stone feet
        "foot": dict(under="trestle", post="dark_oak_log", beam="stripped_spruce_log", deck="spruce_planks", brace="spruce_planks",
                     coping="spruce_planks", parapet="fence", light="lantern", footing="cobbled_deepslate",
                     roof={"ladder": ["deepslate_tiles", "cobbled_deepslate"], "axis": "noise", "scale": 2}, roof_trim="dark_oak_planks"),
        "road": dict(under="segmental", wall={"ladder": ["cobbled_deepslate", "deepslate_bricks", "stone_bricks"], "axis": "noise", "scale": 3},
                     ring="deepslate_bricks", key="chiseled_deepslate", deck="deepslate_bricks", coping="polished_deepslate",
                     parapet="wall", light="lantern", footing="cobbled_deepslate"),
        "rail": dict(under="trestle", post="spruce_log", beam="dark_oak_log", deck="spruce_planks", brace="dark_oak_planks",
                     coping="dark_oak_planks", parapet="curb", light=None, footing="cobbled_deepslate", batter=True),
    },
    "saltreach": {
        # harbour boardwalk on piles / pale sandstone segmental arches / sandstone viaduct (Glenfinnan's curve, in stone)
        "foot": dict(under="trestle", post="stripped_oak_log", beam="stripped_birch_log", deck="birch_planks", brace="oak_planks",
                     coping="oak_planks", parapet="fence", light="lantern", footing="cobblestone", bracing=False),
        "road": dict(under="segmental", wall={"ladder": ["sandstone", "smooth_sandstone"], "axis": "noise", "scale": 3},
                     ring="cut_sandstone", key="chiseled_sandstone", deck="smooth_sandstone", coping="smooth_sandstone",
                     parapet="solid", light="lantern", footing="stone_bricks"),
        "rail": dict(under="arch", wall={"ladder": ["sandstone", "smooth_sandstone"], "axis": "noise", "scale": 4}, ring="cut_sandstone",
                     key="chiseled_sandstone", deck="smooth_sandstone", coping="smooth_sandstone", parapet="solid", light=None,
                     footing="stone_bricks", pilaster="cut_sandstone"),
    },
    "emberwaste": {
        # pointed sandstone arches / two-tier arcade (Khaju bridge, Isfahan) / red sandstone segmental viaduct
        "foot": dict(under="pointed", wall={"ladder": ["sandstone", "smooth_sandstone"], "axis": "noise", "scale": 3}, ring="cut_red_sandstone",
                     key="chiseled_sandstone", deck="smooth_sandstone", coping="smooth_sandstone", parapet="solid", light="lantern",
                     footing="sandstone"),
        "road": dict(under="pointed", wall={"ladder": ["smooth_sandstone", "sandstone", "cut_sandstone"], "axis": "noise", "scale": 3},
                     ring="smooth_red_sandstone", key="chiseled_sandstone", deck="smooth_sandstone", coping="smooth_red_sandstone",
                     parapet="solid", light="lantern", footing="sandstone", tiers=True),
        "rail": dict(under="segmental", wall={"ladder": ["red_sandstone", "smooth_red_sandstone"], "axis": "noise", "scale": 3},
                     ring="cut_red_sandstone", key="chiseled_red_sandstone", deck="smooth_red_sandstone", coping="smooth_red_sandstone",
                     parapet="solid", light=None, footing="red_sandstone", pilaster="cut_red_sandstone"),
    },
    "blackfen": {
        # mangrove causeway on stilts with froglights / mud-brick segmental arches / tuff-brick viaduct
        "foot": dict(under="trestle", post="mangrove_log", beam="stripped_mangrove_log", deck="mangrove_planks", brace="mangrove_planks",
                     coping="mangrove_planks", parapet="fence", light="verdant_froglight", footing="mud_bricks", bracing=False),
        "road": dict(under="segmental", wall={"ladder": ["mud_bricks", "packed_mud", "tuff_bricks"], "axis": "noise", "scale": 3},
                     ring="tuff_bricks", key="chiseled_tuff_bricks", deck="mud_bricks", coping="tuff_bricks", parapet="wall",
                     light="verdant_froglight", footing="tuff"),
        "rail": dict(under="arch", wall={"ladder": ["tuff_bricks", "tuff", "polished_tuff"], "axis": "noise", "scale": 3}, ring="polished_tuff",
                     key="chiseled_tuff_bricks", deck="tuff_bricks", coping="polished_tuff", parapet="solid", light=None,
                     footing="tuff", pilaster="polished_tuff"),
    },
    "hollow": {
        # nothing quite like ours: tall pointed arches in black stone, soul light
        "foot": dict(under="pointed", wall={"ladder": ["polished_blackstone_bricks", "blackstone", "cobbled_deepslate"], "axis": "noise", "scale": 3},
                     ring="polished_blackstone", key="chiseled_polished_blackstone", deck="polished_blackstone_bricks",
                     coping="polished_blackstone", parapet="wall", light="soul_lantern", footing="cobbled_deepslate"),
        "road": dict(under="pointed", wall={"ladder": ["polished_blackstone_bricks", "blackstone", "cobbled_deepslate"], "axis": "noise", "scale": 3},
                     ring="polished_blackstone", key="chiseled_polished_blackstone", deck="polished_blackstone_bricks",
                     coping="polished_blackstone", parapet="solid", light="soul_lantern", footing="cobbled_deepslate", tiers=True),
        "rail": dict(under="pointed", wall={"ladder": ["deepslate_bricks", "deepslate_tiles", "cobbled_deepslate"], "axis": "noise", "scale": 3},
                     ring="polished_blackstone_bricks", key="chiseled_polished_blackstone", deck="deepslate_tiles", coping="polished_deepslate",
                     parapet="solid", light=None, footing="cobbled_deepslate", pilaster="polished_blackstone_bricks"),
    },
}
# The deck is the region's own path, so a bridge reads as the road carrying on (Mateo, 2026-11-12). Path blocks
# with a slab form only (paths rule: the walking surface can be a slab). "town" = town streets (towngen PAVE),
# "road" = the map's country roads (genworld: grass path, gravel, cobble: the cobble is what carries over).
_mix = lambda *b: {"ladder": list(b), "axis": "noise", "scale": 1.6}
DECKS = {
    "vale": {"town": _mix("cobblestone", "mossy_cobblestone", "stone_bricks", "andesite", "mossy_stone_bricks", "tuff_bricks"),
             "road": _mix("cobblestone", "mossy_cobblestone", "andesite"), "trail": _mix("mossy_cobblestone", "cobblestone")},
    "frostmarch": {"town": _mix("cobbled_deepslate", "cobblestone", "deepslate_bricks"), "road": _mix("cobblestone", "cobbled_deepslate"),
                   "trail": _mix("cobblestone", "cobbled_deepslate")},
    "saltreach": {"town": _mix("smooth_sandstone", "cobblestone", "stone_bricks"), "road": _mix("cobblestone", "smooth_sandstone"),
                  "trail": _mix("cobblestone", "andesite")},
    "emberwaste": {"town": _mix("smooth_sandstone", "cut_red_sandstone", "sandstone"), "road": _mix("sandstone", "smooth_sandstone"),
                   "trail": _mix("sandstone", "smooth_sandstone")},
    "blackfen": {"town": _mix("mud_bricks", "tuff_bricks", "packed_mud"), "road": _mix("mud_bricks", "tuff"), "trail": _mix("mud_bricks", "tuff")},
    "hollow": {"town": _mix("cobbled_deepslate", "polished_blackstone_bricks"), "road": _mix("cobbled_deepslate", "cobbled_deepslate", "tuff"),
               "trail": _mix("cobbled_deepslate", "tuff")},
}
# Blocks of this pack the palette doesn't know: written as raw ids on full-block cells, the fallback elsewhere.
CUSTOM = {"hollow": {"wall": {"custom": "siege:veinstone_bricks", "mix": "siege:cracked_veinstone_bricks", "share": 0.2}}}

REGION_ALIAS = {"kingsrest": "vale", "millbrook": "vale", "rimehold": "frostmarch", "frosthelm": "frostmarch", "gulls_rest": "saltreach",
                "sunscar": "emberwaste", "mirelight": "blackfen", "undertow": "hollow"}

# use -> deck width in blocks, parapets included (odd, "work in threes"), clearance over water, deck thickness
USE = {"foot": dict(width=5, clear=3, t=1, grade=0.5),
       "road": dict(width=7, clear=4, t=2, grade=0.5),
       "rail": dict(width=5, clear=5, t=2, grade=None)}


# ----------------------------------------------------------------------------------------------- step 1
def find_crossings(points, height, water=None, kind="road", min_gap=3, min_drop=3, step=0.5):
    """Walk a path polyline and return the stretches that need a bridge.

    points: [(x, z), ...] the path's centre line. height(x, z): ground top y (the riverbed under water).
    water(x, z): water surface y there, or None for dry land. A stretch needs a bridge where the path is
    over water, or where the ground drops more than `min_drop` below the straight line between the two
    banks (a ravine, a gully, a valley between hills). Each stretch is shortened or lengthened to the
    first firm bank cell on each side and returned as a crossing dict ready for plan()/bridge_blocks():
    {"a": [x, z], "b": [x, z], "ya": walk y at A, "yb": walk y at B, "water_y": y or None, "kind": kind}.
    """
    water = water or (lambda x, z: None)
    samples = []
    for (x0, z0), (x1, z1) in zip(points, points[1:]):
        L = math.hypot(x1 - x0, z1 - z0); n = max(1, int(L / step))
        for i in range(n):
            t = i / n; samples.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    samples.append(tuple(points[-1]))
    cell = lambda p: (round(p[0]), round(p[1]))
    gnd = [height(*cell(p)) for p in samples]
    wet = [water(*cell(p)) for p in samples]
    out, i, N = [], 0, len(samples)
    while i < N:
        if wet[i] is None:
            # dry dip: ground falls below both neighbours' line by more than min_drop
            j = i + 1
            if i > 0 and j < N and gnd[j] < gnd[i] - 1:
                k = j
                while k < N and wet[k] is None and gnd[k] < gnd[i] - 1: k += 1
                if k < N and wet[k] is None:
                    deck = min(gnd[i], gnd[k])
                    if deck - min(gnd[j:k]) >= min_drop and math.dist(samples[i], samples[k]) >= min_gap:
                        out.append(_crossing(samples, i, k, gnd, None, kind)); i = k; continue
            i += 1; continue
        k = i
        while k < N and wet[k] is not None: k += 1
        a, b = max(0, i - 1), min(N - 1, k)
        if math.dist(samples[a], samples[b]) >= 1:
            out.append(_crossing(samples, a, b, gnd, max(w for w in wet[i:k]), kind))
        i = k + 1
    return out


def _crossing(samples, a, b, gnd, water_y, kind):
    A, B = samples[a], samples[b]
    return {"a": [round(A[0], 2), round(A[1], 2)], "b": [round(B[0], 2), round(B[1], 2)],
            "ya": gnd[a] + 1, "yb": gnd[b] + 1, "water_y": water_y, "kind": kind}


def crossings_from_cells(wet, walk, water, width_of=lambda c: 3, region="vale", path="town", max_across=9, rejects=None):
    """Crossings from a raster of path cells over water (town generators, the Hollow's columns).

    wet: set of (x, z) path cells over water. walk(x, z): walking-surface y (float, half steps) of a dry path
    cell there, or None. water(x, z): water surface y. width_of((x, z)): path width there (1, 3, 5).
    Each 4-joined group becomes one straight crossing along its long axis (any angle), its ends one block onto
    the banks where the path carries on. A group wider than `max_across` (a ford, a flooded square) is skipped.
    """
    cells, seen, out = set(wet), set(), []
    for c0 in sorted(cells):
        if c0 in seen: continue
        comp, todo = [], [c0]; seen.add(c0)
        while todo:
            c = todo.pop(); comp.append(c)
            for ox, oz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (c[0] + ox, c[1] + oz)
                if n in cells and n not in seen: seen.add(n); todo.append(n)
        mx = sum(x for x, _ in comp) / len(comp); mz = sum(z for _, z in comp) / len(comp)
        sxx = sum((x - mx) ** 2 for x, _ in comp); szz = sum((z - mz) ** 2 for _, z in comp); sxz = sum((x - mx) * (z - mz) for x, z in comp)
        ang = 0.5 * math.atan2(2 * sxz, sxx - szz) if len(comp) > 1 else 0.0
        dx, dz = math.cos(ang), math.sin(ang)
        # the bank cells the path carries on from decide the direction better than the water's shape when the
        # crossing is short: use the dry path cells touching the group
        banks = [(c[0] + ox, c[1] + oz) for c in comp for ox in (-1, 0, 1) for oz in (-1, 0, 1)
                 if (c[0] + ox, c[1] + oz) not in cells and walk(c[0] + ox, c[1] + oz) is not None]
        if len(banks) >= 2:
            bx_ = max(banks, key=lambda b: (b[0] - mx) * dx + (b[1] - mz) * dz); ax_ = min(banks, key=lambda b: (b[0] - mx) * dx + (b[1] - mz) * dz)
            far = max(((a, b) for a in banks for b in banks), key=lambda ab: math.dist(*ab))
            if math.dist(*far) > 2: (ax_, bx_) = far
            L0 = math.dist(ax_, bx_); dx, dz = (bx_[0] - ax_[0]) / L0, (bx_[1] - ax_[1]) / L0
        us = [(x - mx) * dx + (z - mz) * dz for x, z in comp]
        vs = [(x - mx) * -dz + (z - mz) * dx for x, z in comp]
        if max(vs) - min(vs) + 1 > max_across and max(us) - min(us) < max(vs) - min(vs): continue
        A = (mx + dx * (min(us) - 1), mz + dz * (min(us) - 1)); B = (mx + dx * (max(us) + 1), mz + dz * (max(us) + 1))
        def bank_y(P, back):
            for k in range(0, 4):
                for r in (0, 1, -1, 2, -2):
                    q = (round(P[0] + back[0] * k - dz * r), round(P[1] + back[1] * k + dx * r))
                    w = walk(*q)
                    if w is not None: return w
            return None
        ya, yb = bank_y(A, (-dx, -dz)), bank_y(B, (dx, dz))
        wy = max(water(*c) for c in comp)
        w = max(width_of(c) for c in comp)
        # a real crossing has a path on dry land at both ends, and the water passes under it: at the middle,
        # water on both sides of the deck. A path running along a bank or into a pond is not a bridge
        # (Mateo, 2026-11-12: "it's not even connecting to anything"); it goes back to the caller as a quay.
        cx_, cz_ = (A[0] + B[0]) / 2, (A[1] + B[1]) / 2; off = w / 2.0 + 2
        def wet_at(px, pz):
            try: return water(round(px), round(pz)) is not None
            except Exception: return False
        sides = [wet_at(cx_ - dz * off * sg, cz_ + dx * off * sg) for sg in (-1, 1)]
        if ya is None or yb is None or not all(sides):
            if rejects is not None: rejects.append(comp)
            continue
        out.append({"a": [round(A[0], 2), round(A[1], 2)], "b": [round(B[0], 2), round(B[1], 2)], "ya": ya, "yb": yb, "water_y": wy,
                    "kind": "road" if w >= 5 else "foot", "width": w + 2, "region": region, "path": path, "cells": len(comp), "_cells": comp})
    return out


def to_works(blocks):
    """Skill blocks -> bp.py / towngen works entries (drops the connection props: bp.finish redoes them)."""
    return {c: (n, {k: v for k, v in p.items() if k not in ("conn", "post")}) for c, (n, p) in blocks.items()}


# ----------------------------------------------------------------------------------------------- step 2
def plan(c):
    """Measure a crossing and decide everything about its bridge. Returns a plan dict (pure numbers)."""
    kind = c.get("kind", "road"); use = USE[kind]
    region = REGION_ALIAS.get(c.get("region", "vale"), c.get("region", "vale"))
    st = dict(STYLES[region][kind])
    path = c.get("path", "town" if kind != "rail" else None)
    if path and st["under"] != "trestle": st["deck"] = DECKS[region][path]
    if c.get("custom_blocks", True): st["_custom"] = CUSTOM.get(region, {})
    st.update(c.get("style", {}))
    ax, az = c["a"]; bx, bz = c["b"]
    L = math.hypot(bx - ax, bz - az)
    if L < 1: raise ValueError("crossing A and B are the same point")
    dx, dz = (bx - ax) / L, (bz - az) / L
    width = c.get("width", use["width"])
    if width % 2 == 0: width += 1
    hw = width / 2.0                        # band |v| <= hw - 0.5 covers `width` cells on a cardinal line
    ya, yb = float(c["ya"]), float(c["yb"])
    water_y = c.get("water_y")
    floor_fn = c.get("_ground_u")           # optional ground profile along u (gallery); world callers pass ground(x, z)
    # lowest floor under the span, sampled along the line
    gfun = c.get("ground")
    def floor_at(u):
        if floor_fn: return floor_fn(u)
        if gfun: return gfun(round(ax + dx * u), round(az + dz * u))
        return (water_y - 3) if water_y is not None else min(ya, yb) - 6
    lows = [floor_at(L * i / 24) for i in range(1, 24)]
    low = min(lows) if lows else min(ya, yb) - 4
    if water_y is not None: low = min(low, water_y - 1)
    # deck: straight bank to bank, humped over water for foot and road, never steeper than the grade
    grade = use["grade"]
    t = use["t"] + (1 if L > 40 and kind != "foot" else 0)
    abut = {"foot": 2, "road": 3, "rail": 4}[kind]
    clear = use["clear"] + (min(4, int(L / 12)) if water_y is not None else 0)
    need = (water_y + 1 + clear + 1 + t) if water_y is not None else None
    if need is not None and st["under"] == "trestle": need = water_y + 3 + (1 if kind == "rail" else 0)   # boardwalks stay low
    # the hump is a parabola (the curve of a real arched deck), as high as the clearance needs but never
    # steeper than the grade at its ends: 4h/L <= grade
    h = 0.0
    if grade is not None and need is not None:
        h = max(0.0, min(need - (ya + yb) / 2.0, grade * L / 4.0))
    def W(u):
        s_ = min(1.0, max(0.0, u / L))
        return ya + (yb - ya) * s_ + h * 4 * s_ * (1 - s_)
    Wq = lambda u: math.floor(W(u) * 2 + 1e-6) / 2.0
    warnings = []
    if kind == "rail" and abs(yb - ya) / L > 1 / 25:
        warnings.append(f"rail grade 1 in {L / max(1e-6, abs(yb - ya)):.0f} is steep for a railway (aim for 1 in 50 or gentler)")
    # tier
    tier = "beam" if L <= 4 else "single" if L <= 15 else "arcade" if L <= 40 else "grand"
    under = st["under"]
    # arch layout: odd number of openings, width grows with height above the floor
    top = sum(Wq(u) for u in [L * i / 24 for i in range(25)]) / 25.0 - t - 1     # the deck's mean height over the gap
    H = max(2.0, top - max(low, (water_y or -1e9)))
    piers, spans = [], []
    if tier != "beam" and under != "trestle":
        # a low crossing gets a few wide flat (segmental) arches, not a row of small holes (Ponte Vecchio,
        # Pont Saint-Martin); round and pointed arches need height to look right
        lay = "segmental" if (under in ("arch", "pointed") and H < 7) else under
        f = {"arch": 0.9, "pointed": 0.8, "segmental": 3.5 if lay != under else 1.6}[lay]   # flat arches: span ~ 4x rise
        target = max(5, min(21 if lay == "segmental" else 15, round(H * f)))
        if kind == "foot" and tier == "single": target = max(target, int(L) - 1 + (int(L) % 2))
        p = 5 if (kind == "rail" and (L >= 24 or H >= 14)) or (kind == "road" and L >= 40) or tier == "grand" else 3
        best = None
        for n in range(1, 60, 2):
            o = (L - (n - 1) * p) / n
            if o < 3: break
            ow = int(o) - (0 if int(o) % 2 else 1)
            if n > 1 and ow > target * 1.35: continue              # wide openings only as a single arch
            score = abs(ow - target) * (1.6 if ow > target else 1.0) + (L - (n * ow + (n - 1) * p)) * 0.35
            if best is None or score < best[0]: best = (score, n, ow)
        if best:
            _, n, o = best
            widths = [o] * n
            if n >= 3 and grade is not None and h > 1:
                # graded openings: the centre arch widest, stepping down towards the banks where the deck is lower
                # (Old Bridge at Bideford, Pont Valentre's humped cousins); symmetric, each odd, total kept
                pos, u = [], (L - (n * o + (n - 1) * p)) / 2.0
                for i in range(n): pos.append(u + o / 2.0); u += o + p
                line_ = (water_y + 1) if water_y is not None else low + 1
                room = [max(1.0, Wq(c) - t - 1 - line_) for c in pos]
                tot = n * o; raw = [r / sum(room) * tot for r in room]
                widths = [max(3, int(round((raw[i] + raw[n - 1 - i]) / 2.0)) | 1) for i in range(n)]
                while sum(widths) > tot:
                    k = min(range(n), key=lambda i: (abs(i - (n - 1) / 2.0) * -1, i)); widths[k] -= 2; widths[n - 1 - k] -= 2 if k != n - 1 - k else 0
                while sum(widths) + 2 <= tot and n % 2 == 1: widths[n // 2] += 2
            used = sum(widths) + (n - 1) * p
            u = (L - used) / 2.0
            for i in range(n):
                spans.append([u, u + widths[i]])
                if i < n - 1: piers.append(u + widths[i] + p / 2.0)
                u += widths[i] + p
        pier_w = p
    else:
        pier_w = 1
    # each span's soffit: spring and crown under the lowest deck point over that span
    arches = []
    for (a, b) in spans:
        o = b - a; R = o / 2.0; c0 = (a + b) / 2.0
        crown = min(Wq(a + (b - a) * i / 8) for i in range(9)) - t - 1
        floor_here = min(floor_at(a + (b - a) * i / 6) for i in range(7))
        # every arch springs from one line just above the water (or the floor), like a real bridge's piers;
        # a tall opening stands its arch on straight jambs, a low one flattens to a segment
        line = (water_y + 1) if water_y is not None else floor_here + 1
        if under == "arch": rise = R
        elif under == "pointed": rise = R * 1.35
        else: rise = max(2.0, min(R, o / 4.0 + 0.5))
        spring = max(line, crown - rise)
        this_under = under
        if crown - spring < rise:
            rise = max(1.5, crown - spring); this_under = "segmental" if rise < R * 0.9 else under
        arch = {"a": a, "b": b, "c": c0, "R": R, "rise": rise, "spring": spring, "crown": crown, "floor": floor_here, "under": this_under}
        # second tier below on deep crossings: road arcades in Emberwaste/Hollow (Khaju) and any rail viaduct
        free = spring - max(floor_here, water_y + 1 if water_y is not None else -1e9)
        if under != "segmental" and (st.get("tiers") or kind == "rail") and free > o * 1.3 + 5:
            c2 = max(floor_here, water_y or -1e9) + free * 0.5
            arch["lower"] = {"crown": c2, "spring": c2 - rise, "band": c2 + 2}
        arches.append(arch)
    lights = []
    if st.get("light"):
        lights = [-abut + 0.5, L + abut - 0.5] + piers
        if not piers:
            k = max(2, int(L / 6)); lights += [L * i / k for i in range(1, k)]
    return {"kind": kind, "region": region, "style": st, "A": (ax, az), "B": (bx, bz), "L": L, "d": (dx, dz), "n": (-dz, dx),
            "hw": hw, "width": width, "t": t, "abut": abut, "W": W, "Wq": Wq, "water_y": water_y, "floor_at": floor_at,
            "ground": gfun, "ground_u": floor_fn, "low": low, "tier": tier, "under": under, "spans": arches, "piers": piers,
            "pier_w": pier_w, "lights": lights, "warnings": warnings, "seed": c.get("seed", 0),
            "approach": c.get("approach", 3)}


# ----------------------------------------------------------------------------------------------- step 3+4
def soffit(arch, u, under):
    """Height of the arch's underside at u (None outside the opening)."""
    under = arch.get("under", under)
    d = abs(u - arch["c"]); R = arch["R"]
    if d >= R: return None
    if under == "arch": return arch["spring"] + math.sqrt(R * R - d * d)
    if under == "pointed":
        # two arcs, each centred at the far springing point's side: a lancet
        r2 = R * 1.6; cx = R * 0.6
        return arch["spring"] + max(0.0, math.sqrt(max(0.0, r2 * r2 - (d + cx) ** 2)) - math.sqrt(max(0.0, r2 * r2 - (R + cx) ** 2))) \
            * arch["rise"] / max(1e-6, math.sqrt(r2 * r2 - cx * cx) - math.sqrt(max(0.0, r2 * r2 - (R + cx) ** 2)))
    rise = arch["rise"]; rr = (R * R + rise * rise) / (2 * rise)    # segmental: a flat arc of radius rr
    return arch["spring"] + math.sqrt(max(0.0, rr * rr - d * d)) - (rr - rise)


def lower_soffit(arch, u, under):
    lo = arch.get("lower")
    if not lo: return None
    a2 = dict(arch, spring=lo["spring"], crown=lo["crown"], under=under)
    return soffit(a2, u, under)


def bridge(ctx, pt):
    """Part "bridge": write the bridge's cells into the builder context (stages foundation..details)."""
    P = plan(pt)
    st = P["style"]
    mats = ctx.spec.setdefault("materials", {})
    name = pt.get("name", f"bridge{ctx.n}"); ctx.n += 1
    M = {}
    for role in ("wall", "ring", "key", "deck", "coping", "footing", "post", "beam", "brace", "roof", "roof_trim", "pilaster"):
        if role in st and st[role]:
            M[role] = f"{name}.{role}"; mats.setdefault(M[role], st[role])
    before = set(ctx.cells)
    if st["under"] == "trestle":
        _trestle(ctx, P, M)
    else:
        _masonry(ctx, P, M)
    _approaches(ctx, P, M)
    for role, cu in st.get("_custom", {}).items():
        if role not in M: continue
        for c, v in ctx.cells.items():
            if c in before or v.get("mat") != M[role] or v["kind"] != "full": continue
            b = cu["mix"] if cu.get("mix") and h3(*c, 77) < cu.get("share", 0) else cu["custom"]
            ctx.cells[c] = {"kind": "raw", "name": b, "props": {}}
    for w in P["warnings"]: ctx.log.append(f"{name}: {w}")
    ctx.log.append(f"{name}: {P['kind']} bridge, {P['region']}, span {P['L']:.0f}, {P['tier']}, {P['under']}, "
                   f"{len(P['spans'])} openings, deck {P['Wq'](0):.1f} -> {P['Wq'](P['L'] / 2):.1f} -> {P['Wq'](P['L']):.1f}")
    return P


def _columns(P, reach):
    """Every block column near the line, with its (u, v)."""
    (ax, az), (bx, bz), L, (dx, dz), (nx, nz) = P["A"], P["B"], P["L"], P["d"], P["n"]
    ext = P["abut"] + 1
    xs = [ax - dx * ext, bx + dx * ext]; zs = [az - dz * ext, bz + dz * ext]
    for x in range(math.floor(min(xs) - reach - 1), math.ceil(max(xs) + reach + 2)):
        for z in range(math.floor(min(zs) - reach - 1), math.ceil(max(zs) + reach + 2)):
            u = (x - ax) * dx + (z - az) * dz
            v = (x - ax) * nx + (z - az) * nz
            if -ext - 0.5 <= u <= L + ext + 0.5 and abs(v) <= reach: yield x, z, u, v


def _floor(P, x, z, u):
    if P["ground"]: return P["ground"](x, z)
    return P["floor_at"](u)


def _in_band(P, u, v):
    return abs(v) < P["hw"] and -P["abut"] - 0.5 <= u <= P["L"] + P["abut"] + 0.5


def _edge(P, x, z):
    """Band cell with an outside neighbour (8-way) = parapet line; stays 4-way joined at any angle."""
    (ax, az), (dx, dz), (nx, nz) = P["A"], P["d"], P["n"]
    uv = lambda xx, zz: ((xx - ax) * dx + (zz - az) * dz, (xx - ax) * nx + (zz - az) * nz)
    u, v = uv(x, z)
    if not _in_band(P, u, v): return False
    for ox in (-1, 0, 1):
        for oz in (-1, 0, 1):
            if ox or oz:
                uu, vv = uv(x + ox, z + oz)
                if abs(vv) >= P["hw"] and -P["abut"] - 0.5 <= uu <= P["L"] + P["abut"] + 0.5: return True
    return False


def _surface(ctx, x, z, Wf, mat, stage="floors"):
    """The walking layer: a bottom slab on half steps, else the top of a full block (paths rule)."""
    y = math.ceil(Wf) - 1
    if Wf - math.floor(Wf) > 0.25: ctx.set(x, y, z, stage, "slab", mat, half="bottom")
    else: ctx.set(x, y, z, stage, "full", mat)
    return y


def _masonry(ctx, P, M):
    st, L, hw, t = P["style"], P["L"], P["hw"], P["t"]
    (dx, dz) = P["d"]; under = P["under"]; water_y = P["water_y"]
    cardinalish = max(abs(dx), abs(dz)) > 0.92
    pw = P["pier_w"]; noses = water_y is not None
    reach = hw + (pw / 2 + 2 if noses else 1.5) + 1
    parapet_cells = []
    for x, z, u, v in _columns(P, reach):
        Wf = P["Wq"](u); ytop = math.ceil(Wf)
        fl = _floor(P, x, z, u)
        av = abs(v)
        in_band = _in_band(P, u, v)
        # piers this column belongs to (for cutwaters, pilasters, footings)
        pier = next((pc for pc in P["piers"] if abs(u - pc) <= pw / 2.0), None)
        if in_band:
            arch = next((a for a in P["spans"] if abs(u - a["c"]) < a["R"]), None)
            S = soffit(arch, u, under) if arch else None
            S2 = lower_soffit(arch, u, under) if arch else None
            bottom = fl if water_y is None else min(fl, water_y)
            y_surf = ytop - 1
            for y in range(int(math.floor(bottom)) + 1, y_surf):
                role = "wall"
                if S is not None:
                    lo = arch.get("lower")
                    if lo and y < lo["band"]:
                        if S2 is not None and y + 1 - S2 < 0.25: continue          # lower tier opening
                        if S2 is not None and y + 1 - S2 < 0.75:
                            _soffit_cell(ctx, x, y, z, M, u, arch, under, cardinalish, P, lower=True); continue
                        if S2 is not None and y < S2 + 1: role = "ring"
                    else:
                        fill = y + 1 - S
                        if fill < 0.25:
                            if water_y is not None and y <= water_y and y > fl: continue   # the river runs through
                            if y > fl: continue
                        elif fill < 0.75:
                            _soffit_cell(ctx, x, y, z, M, u, arch, under, cardinalish, P); continue
                        elif y < S + 1.2: role = "ring"
                if y <= fl and y < (water_y or -1e9) - 0: role = "footing"
                if y <= fl and pier is None and arch is not None: continue            # don't dig under the river bed
                stage = "foundation" if y <= (water_y if water_y is not None else fl) else ("frame" if pier is not None else "walls")
                m = M.get(role, M["wall"])
                ctx.set(x, y, z, stage, "full", m)
            # keystone on each face at the crown
            if S is not None and abs(u - arch["c"]) < 0.5 and av > hw - 1.0 and "key" in M:
                ky = int(math.floor(S + 0.25))
                if ctx.get(x, ky, z): ctx.set(x, ky, z, "details", "full", M["key"])
            # deck
            if _edge(P, x, z) and st["parapet"] not in ("none",):
                parapet_cells.append((x, z, u, v, ytop))
                ctx.set(x, ytop - 1, z, "floors", "full", M["coping"] if st["parapet"] != "solid" else M["wall"])
            else:
                if P["kind"] == "rail" and abs(v) < hw - 0.5:
                    ctx.set(x, ytop - 1, z, "floors", raw="gravel")                     # ballast; the trains lay track at ytop
                else:
                    _surface(ctx, x, z, Wf, M["deck"])
            continue
        # outside the band: cutwaters, footings, pilasters at piers; string course along the faces
        if pier is None: continue
        over = av - hw                           # how far past the face
        k = abs(u - pier) / (pw / 2.0 + 0.5)
        if noses and over <= (pw / 2.0 + 1) * (1 - k) + 0.5:
            fl2 = min(fl, water_y)
            top_c = water_y + 2
            if P["tier"] == "grand" and P["kind"] != "rail": top_c = ytop - 1          # refuge: cutwater carried up to the deck
            elif P["kind"] == "rail": top_c = max(water_y + 2, int(P["spans"][0]["spring"]) if P["spans"] else water_y + 2)
            for y in range(int(fl2) + 1, int(top_c) + 1):
                ctx.set(x, y, z, "foundation" if y <= water_y else "frame", "full", M["footing"] if y <= water_y + 1 else M["wall"])
            if top_c < ytop - 1:
                ctx.set(x, int(top_c) + 1, z, "details", "slab", M["coping"], half="bottom")
            elif P["tier"] == "grand" and P["kind"] != "rail":
                parapet_cells.append((x, z, u, v, ytop))
        elif P["kind"] == "rail" and "pilaster" in M and over <= 1.0 and abs(u - pier) <= pw / 2.0 - 1:
            for y in range(int(fl) + 1, ytop - t):
                ctx.set(x, y, z, "frame", "full", M["pilaster"])
            ctx.set(x, ytop - t, z, "details", "slab", M["coping"], half="bottom")
    # string course: upside-down stairs (slabs off the cardinal) one out along both faces under the deck
    diag = abs(abs(dx) - abs(dz)) < 0.12
    if (P["kind"] == "rail" or P["tier"] in ("arcade", "grand")) and (cardinalish or diag):
        _string_course(ctx, P, M, cardinalish)          # off those angles a projecting course only reads as noise
    _parapets(ctx, P, M, parapet_cells)
    _abutment_ends(ctx, P, M)


def _soffit_cell(ctx, x, y, z, M, u, arch, under, cardinalish, P, lower=False):
    sf = lower_soffit if lower else soffit
    e = 0.3
    s1, s0 = sf(arch, u + e, under), sf(arch, u - e, under)
    slope = 0 if (s1 is None or s0 is None) else (s1 - s0) / (2 * e)
    if cardinalish and abs(slope) > 0.5:
        dx, dz = P["d"]; sgn = -1 if slope > 0 else 1        # face the pier side, where the arch comes down
        ctx.set(x, y, z, "walls", "stairs", M["ring"], facing=card(dx * sgn, dz * sgn), half="top")
    else:
        ctx.set(x, y, z, "walls", "slab", M["ring"], half="top")


def _string_course(ctx, P, M, cardinalish):
    (ax, az), (dx, dz), (nx, nz), hw, L, t = P["A"], P["d"], P["n"], P["hw"], P["L"], P["t"]
    for x, z, u, v in _columns(P, hw + 1.5):
        if not (-0.5 <= u <= L + 0.5): continue
        if not (hw <= abs(v) < hw + 1.0): continue
        y = math.ceil(P["Wq"](u)) - 1 - t
        if not ctx.free(x, y, z): continue
        # only where the face behind it is built
        bx, bz = x - round(nx * (1 if v > 0 else -1)), z - round(nz * (1 if v > 0 else -1))
        if not ctx.get(bx, y, bz) and not ctx.get(x - (1 if v * nx > 0 else -1 if nx else 0), y, z): continue
        if cardinalish:
            sgn = -1 if v > 0 else 1
            ctx.set(x, y, z, "details", "stairs", M.get("ring", M["wall"]), facing=card(nx * sgn, nz * sgn), half="top")
        else:
            ctx.set(x, y, z, "details", "slab", M.get("ring", M["wall"]), half="top")


def _parapets(ctx, P, M, cells):
    st = P["style"]; kind = st["parapet"]
    for x, z, u, v, ytop in cells:
        # fill a half-step under the parapet so it stands on a full block
        if kind == "wall":
            ctx.set(x, ytop, z, "details", "post", M["coping"] if "coping" in M else M["wall"])
        elif kind == "solid":
            # the top follows the deck in half steps (walk + 1.5), so it runs as one smooth line over the hump
            top = P["Wq"](u) + 1.5
            for y in range(ytop, math.floor(top)): ctx.set(x, y, z, "details", "full", M["wall"])
            if top - math.floor(top) > 0.25: ctx.set(x, math.floor(top), z, "details", "slab", M["coping"], half="bottom")
            else: ctx.set(x, math.floor(top) - 1, z, "details", "full", M["coping"])
        elif kind == "fence":
            ctx.set(x, ytop, z, "details", "post", M.get("brace", M.get("coping")))
        elif kind == "curb":
            ctx.set(x, ytop, z, "details", "slab", M["coping"], half="bottom")
    # lamps: a pillar on the parapet at each pier and at both ends, on both sides
    light = st.get("light")
    if not light or not cells: return
    for target in P["lights"]:
        for side in (-1, 1):
            best = min((c for c in cells if c[3] * side > 0), key=lambda c: abs(c[2] - target), default=None)
            if not best or abs(best[2] - target) > 1.5: continue
            x, z, u, v, ytop = best
            h = 2 if kind == "solid" else 1
            if kind in ("wall", "solid"):
                for y in range(ytop, ytop + h): ctx.set(x, y, z, "details", "full", M["ring"] if "ring" in M else M["wall"])
                ctx.set(x, ytop + h, z, "details", "post", M["coping"])
                y0 = ytop + h + 1
            else:
                ctx.set(x, ytop, z, "details", "full", M["post"], axis="y")
                ctx.set(x, ytop + 1, z, "details", "post", M["brace"])
                y0 = ytop + 2
            ctx.set(x, y0, z, "details", raw=light)


def _abutment_ends(ctx, P, M):
    """Wing walls: where the deck leaves the bank, the band's end columns get a newel the parapet stops on."""
    return


def _approaches(ctx, P, M):
    """Mateo (2026-11-12): a bridge never runs straight into a field. Past each abutment the deck carries on as
    `approach` blocks of paved path on land (the bridge's own paving, as wide as its walkway), grading from the
    deck's end height to the ground at the paths rule (half a block per block), filled under to the ground.
    Its far end is recorded in P["ends"] so the caller joins it to the nearest path (connect_to_paths)."""
    n = P["approach"]
    P["ends"] = []
    if P["kind"] == "rail" or n <= 0: return
    (ax, az), (dx, dz), (nx, nz), L, abut = P["A"], P["d"], P["n"], P["L"], P["abut"]
    inner = P["hw"] - 1.0                       # walkway: the band without its parapets
    deck = M.get("deck")
    for side in (-1, 1):
        u_end = -abut if side < 0 else L + abut
        y0 = P["Wq"](0 if side < 0 else L)
        for x, z, u, v in _columns(dict(P, abut=abut + n + 1), P["hw"]):
            k = (u_end - u) if side < 0 else (u - u_end)          # blocks past the abutment
            if not (0.0 < k <= n + 0.5) or abs(v) >= inner: continue
            g = _floor(P, x, z, u) if (P["ground"] or P["ground_u"]) else math.ceil(y0) - 1
            target = g + 1.0
            w = y0 + max(-0.5 * k, min(0.5 * k, target - y0))      # towards the ground at half a block per block
            w = math.floor(w * 2 + 1e-6) / 2.0
            y = _surface(ctx, x, z, w, deck, stage="floors")
            for yy in range(int(g) + 1, y): ctx.setif(x, yy, z, "foundation", "full", deck)
        ex = ax + dx * (u_end + side * n); ez = az + dz * (u_end + side * n)
        P["ends"].append({"x": round(ex, 2), "z": round(ez, 2), "dir": [round(dx * side, 4), round(dz * side, 4)],
                          "width": int(2 * inner + 1) | 1})


def connect_to_paths(end, is_path, max_dist=16):
    """Cells that join a bridge's approach end to the nearest existing path cell: the nearest path cell within
    max_dist (preferring ones ahead of the end), then a straight band as wide as the walkway between them.
    Returns a list of (x, z). is_path(x, z) -> bool. Empty when the approach already touches a path."""
    ex, ez = end["x"], end["z"]
    dx, dz = end["dir"]; w = end.get("width", 3); hw = w / 2.0
    best = None
    for ox in range(-max_dist, max_dist + 1):
        for oz in range(-max_dist, max_dist + 1):
            x, z = round(ex) + ox, round(ez) + oz
            if not is_path(x, z): continue
            fwd = (x - ex) * dx + (z - ez) * dz
            dist = math.hypot(x - ex, z - ez)
            if dist > max_dist or fwd < -1.5: continue
            score = dist - 0.5 * max(0.0, fwd) / max(1.0, dist)
            if best is None or score < best[0]: best = (score, x, z, dist)
    if best is None or best[3] <= hw + 0.5: return []
    _, tx, tz, dist = best
    ux, uz = (tx - ex) / dist, (tz - ez) / dist; px, pz = -uz, ux
    cells = set()
    for x in range(math.floor(min(ex, tx) - w), math.ceil(max(ex, tx) + w) + 1):
        for z in range(math.floor(min(ez, tz) - w), math.ceil(max(ez, tz) + w) + 1):
            t = (x - ex) * ux + (z - ez) * uz; q = (x - ex) * px + (z - ez) * pz
            if -0.5 <= t <= dist + 0.5 and abs(q) < hw and not is_path(x, z): cells.add((x, z))
    return sorted(cells)


def _trestle(ctx, P, M):
    """Timber: bents (posts + cap beam + bracing) every 3 (foot) or 5 (rail) blocks along u, stringers under the
    deck edges, plank deck, fence rails or curb. Rail trestles batter their outer legs outward (Western trestles).
    Frostmarch foot bridges get a roof on posts (covered bridge)."""
    st, L, hw = P["style"], P["L"], P["hw"]
    (dx, dz), (nx, nz) = P["d"], P["n"]
    water_y = P["water_y"]
    spacing = 5 if P["kind"] == "rail" else 3
    nb = max(1, round(L / spacing))
    bents = [L * i / nb for i in range(0, nb + 1)]
    batter = st.get("batter")
    reach = hw + (8 if batter else 1.5)
    along, across = log_axis(dx, dz), log_axis(nx, nz)
    parapet_cells = []
    for x, z, u, v in _columns(P, reach):
        Wf = P["Wq"](u); ytop = math.ceil(Wf); ycap = ytop - 2
        fl = _floor(P, x, z, u)
        bottom = min(fl, water_y) if water_y is not None else fl
        av = abs(v)
        in_band = _in_band(P, u, v)
        bent = next((b for b in bents if abs(u - b) < 0.5), None)
        if in_band:
            if u < -0.5 or u > L + 0.5:            # on the bank: stone abutment under the deck
                for y in range(int(fl) + 1, ytop - 1): ctx.set(x, y, z, "foundation", "full", M["footing"])
            if _edge(P, x, z) and st["parapet"] != "none":
                ctx.set(x, ytop - 1, z, "floors", "full", M["beam"], axis=along)
                parapet_cells.append((x, z, u, v, ytop))
            elif P["kind"] == "rail" and av < hw - 0.5:
                ctx.set(x, ytop - 1, z, "floors", raw="gravel")
            else:
                _surface(ctx, x, z, Wf, M["deck"])
            if -0.5 <= u <= L + 0.5:
                # stringers under the edges and the centre line
                if _edge(P, x, z) or av < 0.5:
                    ctx.setif(x, ytop - 2, z, "frame", "full", M["beam"], axis=along)
        if bent is None or not (-0.5 <= u <= L + 0.5): continue
        # bent: cap beam across the band, posts down to the ground, bracing between
        if in_band: ctx.set(x, ycap, z, "frame", "full", M["beam"], axis=across)
        legs = [0.0, hw - 1.0]
        for y in range(int(bottom) + 1, ycap):
            depth = ycap - y
            out = (depth / 6.0) if batter else 0.0
            is_leg = av < 0.5 or abs(av - (hw - 1.0 + out)) < 0.5 or (batter and abs(av - (hw - 3.0 + out * 0.5)) < 0.5)
            if is_leg:
                ctx.set(x, y, z, "frame", "full", M["footing"] if y <= bottom + 1 else M["post"], axis="y"); continue
            if not in_band and not (batter and av < hw - 1.0 + out): continue
            if st.get("bracing", True) is False: continue
            span = hw - 1.0 + out
            if av > span: continue
            # girts every 4, X braces between
            if (ycap - y) % 4 == 0: ctx.set(x, y, z, "walls", "post", M["brace"]); continue
            ph = (ycap - y) % 4
            if abs(av - span * (ph / 4.0)) < 0.5 or abs(av - span * (1 - ph / 4.0)) < 0.5:
                ctx.set(x, y, z, "walls", "post", M["brace"])
    _parapets(ctx, P, M, parapet_cells)
    if "roof" in M and P["kind"] == "foot":
        _covered_roof(ctx, P, M, bents, parapet_cells)


def _covered_roof(ctx, P, M, bents, cells):
    """Kapellbruecke-style roof: log posts on the parapet at every bent, a tie beam across, a gable roof as a
    function of |v| (half steps in slabs), so it works at any angle."""
    hw, L = P["hw"], P["L"]
    (nx, nz) = P["n"]; across = log_axis(nx, nz)
    H = 3
    for x, z, u, v, ytop in cells:
        if -0.5 <= u <= L + 0.5 and any(abs(u - b) < 0.5 for b in bents):
            for y in range(ytop, ytop + H): ctx.set(x, y, z, "frame", "full", M["post"], axis="y")
    for x, z, u, v in _columns(P, hw + 1.0):
        if not (-1.5 <= u <= L + 1.5): continue
        ytop = math.ceil(P["Wq"](u)); base = ytop + H
        av = abs(v)
        if any(abs(u - b) < 0.5 for b in bents) and av < hw and -0.5 <= u <= L + 0.5:
            ctx.set(x, base, z, "frame", "full", M["beam"], axis=across)
        R = base + 0.5 + (hw + 0.5 - av) * 0.5      # 1 in 2 roof, eave 1 past the parapet
        y = math.floor(R)
        if R - y >= 0.5: ctx.set(x, y, z, "roof", "slab", M["roof"], half="bottom")
        else: ctx.set(x, y - 1, z, "roof", "slab", M["roof"], half="top")
    return


# ----------------------------------------------------------------------------------------------- outputs
def compute(crossing):
    """crossing -> (blocks {(x, y, z): (block, logical props)}, stage_of, log, plan), world coordinates."""
    import parts
    from build import resolve
    from colour import Palette
    from materials import Materials
    import emit
    spec = {"name": crossing.get("name", "bridge"), "materials": {}}
    cells, stage_of, log = {}, {}, []
    ctx = parts.Context(cells, stage_of, log, spec)
    P = bridge(ctx, dict(crossing, part="bridge"))
    pal = Palette(edition="bedrock")
    mats = Materials(spec["materials"], pal, log)
    blocks = resolve(cells, mats, pal, log)
    emit.connect(blocks)
    return blocks, stage_of, log, P


def bridge_blocks(crossing, clear_above=4):
    """World blocks for one crossing. Adds air above the deck where `ground` says the bank rises into it,
    so the path is open to the sky (Mateo's paths rule)."""
    blocks, _, log, P = compute(crossing)
    crossing["_ends"] = P.get("ends", [])           # the approach ends, for connect_to_paths
    g = crossing.get("ground")
    if g:
        for x, z, u, v in _columns(dict(P, abut=P["abut"] + P["approach"]), P["hw"]):
            if not _in_band(dict(P, abut=P["abut"] + P["approach"]), u, v): continue
            y0 = math.ceil(P["Wq"](u)) + (2 if P["style"]["parapet"] == "solid" else 1)
            if not (-P["abut"] <= u <= P["L"] + P["abut"]): y0 = max((y for (xx, y, zz) in blocks if xx == x and zz == z), default=y0 - 1) + 1
            for y in range(y0, max(y0, g(x, z) + 1) + clear_above):
                if (x, y, z) not in blocks: blocks[(x, y, z)] = ("air", {})
    return blocks


def works_columns(blocks):
    """Run-length columns for the trains' rail-segments "works": ([[x, z, y0, y1, i], ...], palette) with
    palette[0] = air and every other entry {"name": "minecraft:...", "states": {...}} (Bedrock states)."""
    import emit
    pal, index, cols = [{"name": "minecraft:air"}], {}, []
    bycol = {}
    for (x, y, z), b in blocks.items(): bycol.setdefault((x, z), {})[y] = b
    for (x, z) in sorted(bycol):
        ys = sorted(bycol[(x, z)]); run = None
        for y in ys:
            n, p = bycol[(x, z)][y]
            if n == "air": i = 0
            else:
                if ":" in n and not n.startswith("minecraft:"): bn, stt = n, {}   # CUSTOM blocks (siege:...) go in as raw ids
                else: bn, stt = emit.bedrock_state(n, p)
                key = json.dumps([bn, stt], sort_keys=True)
                if key not in index:
                    index[key] = len(pal)
                    pal.append({"name": bn if ":" in bn else "minecraft:" + bn, **({"states": stt} if stt else {})})
                i = index[key]
            if run and run[3] == y - 1 and run[4] == i: run[3] = y
            else:
                if run: cols.append(run)
                run = [x, z, y, y, i]
        if run: cols.append(run)
    return cols, pal


def main():
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("crossing", help="crossing JSON: a, b, ya, yb, water_y, kind, region, width")
    ap.add_argument("out")
    a = ap.parse_args()
    c = json.load(open(a.crossing))
    from build import build
    s = build({"name": c.get("name", "bridge"), "parts": [dict(c, part="bridge")]}, a.out, stages=True)
    print(json.dumps(s, separators=(",", ":")))


if __name__ == "__main__":
    main()
