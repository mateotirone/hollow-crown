"""Colour maths: sRGB <-> OKLab, block matching, gradient ladders and ordered dithering.

Everything perceptual happens in OKLab (Bjorn Ottosson, 2020). Distances are Euclidean in OKLab,
which tracks how different two colours look far better than RGB distance does.
"""
import json, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")


def srgb_to_linear(c):
    c = np.asarray(c, dtype=float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=float), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255.0


def linear_to_oklab(rgb):
    rgb = np.asarray(rgb, dtype=float)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(rgb @ M1.T)
    return lms @ M2.T


def srgb_to_oklab(c):
    return linear_to_oklab(srgb_to_linear(c))


def hex_to_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(c):
    return "#" + "".join(f"{int(round(max(0, min(255, v)))):02x}" for v in c)


# 4x4x4 ordered-dither threshold matrix (3D Bayer), values in (0, 1)
def _bayer3(n):
    if n == 1: return np.zeros((1, 1, 1))
    b = _bayer3(n // 2)
    o = np.array([[[0, 4], [6, 2]], [[3, 7], [5, 1]]])   # 2x2x2 base order, spreads every slice evenly
    out = np.zeros((n, n, n))
    h = n // 2
    for i in range(2):
        for j in range(2):
            for k in range(2):
                out[i * h:(i + 1) * h, j * h:(j + 1) * h, k * h:(k + 1) * h] = 8 * b + o[i, j, k]
    return out
BAYER = (_bayer3(4) + 0.5) / 64.0


def bayer(x, y, z):
    return BAYER[x & 3, y & 3, z & 3]


ROUGH_ORDER = {"smooth": 0, "medium": 1, "rough": 2}


class Palette:
    """The block palette (data/palette.json) with OKLab lookups."""

    def __init__(self, path=None, edition="bedrock"):
        d = json.load(open(path or os.path.join(DATA, "palette.json")))
        self.about = d.get("about", "")
        self.edition = edition
        self.blocks = {b["id"]: b for b in d["blocks"]}
        self.alias = {}
        for b in d["blocks"]:
            if b.get("java"): self.alias[b["java"]] = b["id"]
        self.ids = list(self.blocks)
        self.extras = d.get("extras", {})
        self.variant_base, self._java = {}, {}
        for b in d["blocks"]:
            self._java[b["id"]] = b.get("java")
            for k, v in b["variants"].items():
                self.variant_base.setdefault(v["bedrock"], b["id"]); self._java[v["bedrock"]] = v.get("java")
        self.lab = np.array([self.blocks[i]["oklab"] for i in self.ids])
        self.W = np.array([1.0, 1.6, 1.6])     # hue/chroma shifts read worse than small value steps between neighbours

    def resolve(self, name):
        n = name.replace("minecraft:", "")
        if n in self.blocks: return n
        if n in self.alias: return self.alias[n]
        raise KeyError(f"unknown block '{name}' (not in palette.json; see reference/colour.md)")

    def java_id(self, n):
        """Bedrock id (block or variant) -> Java id; non-palette blocks keep their name."""
        return self._java.get(n) or n

    def base_of(self, n):
        return n if n in self.blocks else self.variant_base.get(n)

    def variant(self, block, kind):
        return self.blocks[block]["variants"][kind]["bedrock"]

    def rough(self, i): return ROUGH_ORDER[self.blocks[i]["roughness"]]

    def candidates(self, need=None, tags_ok=None, tags_no=("pattern", "feature", "axis"), rough=None, rough_span=1, only=None):
        """Ids that pass the filters. need = partial form(s) the block must have ('slab', 'stairs', ...)."""
        out = []
        needs = [need] if isinstance(need, str) else list(need or [])
        for i in (only or self.ids):
            b = self.blocks[i]
            if any(n not in b["variants"] for n in needs): continue
            if self.edition == "java" and any(not b["variants"][n].get("java") for n in needs): continue
            if tags_no and any(t in b["tags"] for t in tags_no) and not only: continue
            if tags_ok and not any(t in b["tags"] for t in tags_ok): continue
            if rough is not None and abs(self.rough(i) - rough) > rough_span: continue
            out.append(i)
        return out

    def nearest(self, lab, cands):
        idx = [self.ids.index(c) for c in cands]
        d = np.linalg.norm((self.lab[idx] - np.asarray(lab)) * self.W, axis=1)
        o = np.argsort(d)
        return [cands[k] for k in o], d[o]

    def substitute(self, block, need, cache={}):
        """Closest block (colour first, then roughness) that has the partial form `need`."""
        key = (block, need, self.edition)
        if key in cache: return cache[key]
        b = self.blocks[block]
        if need in b["variants"] and (self.edition != "java" or b["variants"][need].get("java")):
            cache[key] = block; return block
        cands = self.candidates(need=need, tags_no=("pattern",))
        if not cands: cache[key] = None; return None
        idx = [self.ids.index(c) for c in cands]
        d = np.linalg.norm(self.lab[idx] - np.asarray(b["oklab"]), axis=1)
        d = d + 0.02 * np.array([abs(self.rough(c) - self.rough(block)) for c in cands])
        cache[key] = cands[int(np.argmin(d))]
        return cache[key]

    def ladder(self, stops, cands, steps=48):
        """A gradient (list of (pos, oklab)) -> list of (pos, block) with no skipped steps:
        sample the gradient finely, take the nearest block at each sample, collapse runs."""
        pos = np.linspace(0, 1, steps)
        out = []
        for p in pos:
            lab = gradient_at(stops, p)
            best = self.nearest(lab, cands)[0][0]
            if not out or out[-1][1] != best: out.append([p, best])
        # a block that only shows up for one sample is noise: drop it unless it is an end
        clean = [s for k, s in enumerate(out) if k in (0, len(out) - 1) or (out[k + 1][0] - s[0]) > 1.5 / steps]
        return clean or out


def gradient_at(stops, p):
    """stops: list of (pos 0..1, oklab). Linear in OKLab."""
    if p <= stops[0][0]: return np.asarray(stops[0][1])
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        if p <= p1:
            t = 0 if p1 == p0 else (p - p0) / (p1 - p0)
            return (1 - t) * np.asarray(c0) + t * np.asarray(c1)
    return np.asarray(stops[-1][1])


def ladder_pick(ladder, p, x, y, z, dither=True, blend=0.5):
    """Position p along a ladder -> block, ordered-dithered between the two neighbouring steps."""
    if len(ladder) == 1: return ladder[0][1]
    # centre of each step's run
    cen = [(ladder[k][0] + (ladder[k + 1][0] if k + 1 < len(ladder) else 1.0)) / 2 for k in range(len(ladder))]
    if p <= cen[0]: return ladder[0][1]
    if p >= cen[-1]: return ladder[-1][1]
    for k in range(len(cen) - 1):
        if cen[k] <= p <= cen[k + 1]:
            t = (p - cen[k]) / (cen[k + 1] - cen[k])
            if not dither: return ladder[k + (1 if t >= 0.5 else 0)][1]
            # dither only in a seam round the boundary (blend = its share of the step), solid bands between
            t = min(1.0, max(0.0, (t - 0.5) / max(blend, 1e-3) + 0.5))
            return ladder[k + 1][1] if t > bayer(x, y, z) else ladder[k][1]
    return ladder[-1][1]
