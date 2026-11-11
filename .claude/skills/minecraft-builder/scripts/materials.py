"""Materials: turn a material name from the spec into a block at a position.

Forms (in spec "materials", or written inline where a material is expected):
  "stone_bricks"                       a block id (Bedrock or Java name)
  "#a0522d"                            nearest block by colour (OKLab)
  "VAL-06"                             a doctrine colour family (build-instructions/texturing/doctrine.json): its ladder
  {"block": "spruce_planks"}
  {"color": "#c8b9a0", "roughness": "smooth", "tags": ["stone"]}
  {"gradient": ["#3e2d22", "#9a6b3f"], "axis": "y", "from": 4, "to": 12}     colour stops -> block ladder
  {"ladder": ["cobblestone", "andesite", "stone"], "axis": "y"}               explicit block ladder (dark to light)
  {"ladder": "VAL-01", "axis": "noise", "scale": 4}                           clusters instead of a gradient
Gradient options: axis x|y|z|radial|noise (radial: distance from "center" [x, z]); from/to default to the
extent of the cells using the material; "reverse": true; "dither": "bayer" (default) | "none";
"jitter": 0.04 (hashed band-edge wobble, the roof-gradient value); "noise": 0.1 (low-frequency wobble);
"blend": 0.5 (share of each step that is a dithered seam; 1 = dither the whole way, 0 = hard bands).
Ladders never skip a step: neighbouring cells differ by at most one ladder block.
"""
import json, math, os
import numpy as np
from colour import Palette, hex_to_rgb, srgb_to_oklab, ladder_pick, ROUGH_ORDER

HERE = os.path.dirname(os.path.abspath(__file__))


def h3(x, y, z, s=0):
    n = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (s * 2654435761)
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, z, scale=4.0, seed=0):
    fx, fy, fz = x / scale, y / scale, z / scale
    ix, iy, iz = math.floor(fx), math.floor(fy), math.floor(fz)
    tx, ty, tz = fx - ix, fy - iy, fz - iz
    sm = lambda t: t * t * (3 - 2 * t)
    tx, ty, tz = sm(tx), sm(ty), sm(tz)
    v = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (tx if dx else 1 - tx) * (ty if dy else 1 - ty) * (tz if dz else 1 - tz)
                v += w * h3(ix + dx, iy + dy, iz + dz, seed)
    return v


def _find_doctrine():
    d = HERE
    for _ in range(8):
        p = os.path.join(d, "build-instructions", "texturing", "doctrine.json")
        if os.path.exists(p): return p
        d = os.path.dirname(d)
    return None


_DOC = None
def doctrine_ladder(code):
    global _DOC
    if _DOC is None:
        p = _find_doctrine(); _DOC = {}
        if p:
            for r in json.load(open(p))["regions"]:
                for f in r["families"]: _DOC[f["code"]] = f
    if code not in _DOC: raise KeyError(f"doctrine code {code} not found (build-instructions/texturing/doctrine.json)")
    return list(_DOC[code]["blocks"])


class Materials:
    def __init__(self, spec, palette: Palette, log):
        self.spec, self.pal, self.log = spec or {}, palette, log
        self.cache, self.ranges = {}, {}

    def define(self, name):
        if name in self.cache: return self.cache[name]
        m = self.spec.get(name, name)
        if isinstance(m, str):
            if m.startswith("#"): m = {"color": m}
            elif len(m) >= 5 and m[3] == "-" and m[:3].isupper(): m = {"ladder": m}
            else: m = {"block": m}
        m = dict(m)
        pal = self.pal
        if "block" in m:
            try: m["_ladder"] = [[0.0, pal.resolve(m["block"])]]
            except KeyError: m["_raw"] = m["block"].replace("minecraft:", "")      # not a building block: place as is
        elif "color" in m:
            lab = srgb_to_oklab(hex_to_rgb(m["color"]))
            cands = pal.candidates(tags_ok=m.get("tags"), rough=ROUGH_ORDER.get(m.get("roughness")), rough_span=0 if m.get("roughness") else 9,
                                   need=m.get("need", ["slab", "stairs"]))
            m["_ladder"] = [[0.0, pal.nearest(lab, cands)[0][0]]]
        elif "gradient" in m:
            st = m["gradient"]
            st = [[k / max(1, len(st) - 1), s] if isinstance(s, str) else s for k, s in enumerate(st)]
            stops = [(p, srgb_to_oklab(hex_to_rgb(h))) for p, h in st]
            r = m.get("roughness")
            first = pal.nearest(stops[0][1], pal.candidates(tags_ok=m.get("tags"), need=m.get("need", ["slab", "stairs"])))[0][0]
            if r is None: r = pal.blocks[first]["roughness"]   # neighbours keep similar roughness (within one class)
            if not m.get("tags"):   # one material family unless told otherwise: the family that fits the whole gradient best
                best = None
                for fam in ("stone", "terracotta", "wood", "metal", "concrete", "wool", "natural"):
                    cs = pal.candidates(tags_ok=[fam], need=m.get("need", ["slab", "stairs"]))
                    if len(cs) < 2: continue
                    from colour import gradient_at
                    e = sum(pal.nearest(gradient_at(stops, t), cs)[1][0] for t in np.linspace(0, 1, 9))
                    e *= {"concrete": 1.25, "wool": 1.4}.get(fam, 1.0)      # flat, toy-like: only when nothing else fits
                    if best is None or e < best[0]: best = (e, fam)
                m["tags"] = [best[1]] if best else None
                first = pal.nearest(stops[0][1], pal.candidates(tags_ok=m["tags"], need=m.get("need", ["slab", "stairs"])))[0][0]
                if m.get("roughness") is None: r = pal.blocks[first]["roughness"]
            cands = pal.candidates(tags_ok=m.get("tags"), rough=ROUGH_ORDER[r], rough_span=m.get("rough_span", 1),
                                   need=m.get("need", ["slab", "stairs"]))
            m["_ladder"] = pal.ladder(stops, cands)
        elif "ladder" in m:
            lad = m["ladder"]
            if isinstance(lad, str): lad = doctrine_ladder(lad)
            ids = []
            for b in lad:
                try: ids.append(pal.resolve(b))
                except KeyError: self.log.append(f"material {name}: '{b}' is not in the palette, skipped")
            n = len(ids)
            m["_ladder"] = [[k / n, b] for k, b in enumerate(ids)]
        else:
            raise ValueError(f"material {name}: needs block, color, gradient or ladder")
        self.cache[name] = m
        return m

    def note_cell(self, name, x, y, z):
        """Called for every cell before resolving, so gradients default to the material's real extent."""
        if name is None: return
        r = self.ranges.setdefault(name, [[x, y, z], [x, y, z]])
        for i, v in enumerate((x, y, z)):
            r[0][i] = min(r[0][i], v); r[1][i] = max(r[1][i], v)

    def block(self, name, x, y, z):
        """-> (block id, is_raw)"""
        m = self.define(name)
        if "_raw" in m: return m["_raw"], True
        lad = m["_ladder"]
        if len(lad) == 1: return lad[0][1], False
        ax = m.get("axis", "y")
        rng = self.ranges.get(name, [[x, y, z], [x, y, z]])
        if ax == "noise":
            p = vnoise(x, y, z, m.get("scale", 4.0), m.get("seed", 7))
            p = min(1, max(0, (p - 0.2) / 0.6))
        elif ax == "radial":
            c = m.get("center", [(rng[0][0] + rng[1][0]) / 2, (rng[0][2] + rng[1][2]) / 2])
            d = math.hypot(x - c[0], z - c[1])
            f, t = m.get("from", 0), m.get("to", max(1, max(rng[1][0] - rng[0][0], rng[1][2] - rng[0][2]) / 2))
            p = (d - f) / ((t - f) or 1)
        else:
            i = "xyz".index(ax); v = (x, y, z)[i]
            f, t = m.get("from", rng[0][i]), m.get("to", rng[1][i])
            p = (v - f) / ((t - f) or 1)
        if m.get("reverse"): p = 1 - p
        if m.get("noise"): p += (vnoise(x, y, z, m.get("scale", 4.0), 11) - 0.5) * 2 * m["noise"]
        if m.get("jitter"): p += (h3(x, y, z, 5) - 0.5) * 2 * m["jitter"]
        p = min(1.0, max(0.0, p))
        return ladder_pick(lad, p, x, y, z, dither=m.get("dither", "bayer") != "none", blend=m.get("blend", 0.5)), False
