"""Picture tools: rebuild a building from a screenshot or photo without guessing colours or sizes by eye.

  python3 scripts/picture.py grid    IMG OUT.png [--step 50]
      the picture with a labelled pixel grid, so you can read off boxes (x0 y0 x1 y1) for the next commands
  python3 scripts/picture.py palette IMG [--box x0 y0 x1 y1] [--k 8] [--any]
      the main colours of the picture (or one box) with their share and the nearest blocks
  python3 scripts/picture.py sample  IMG --region roof x0 y0 x1 y1 --region walls x0 y0 x1 y1 ... [--any]
      per region: the main block and, when the region is visibly two-toned, its texture partner and share,
      ready to paste into spec "materials"
  python3 scripts/picture.py measure --px 412 --block-px 18.5
      a length in pixels -> blocks, given the pixel size of one block measured on the same face
  python3 scripts/picture.py compare IMG PREVIEW.png OUT.png
      the picture and your render side by side at the same height, for the look-and-fix loop

Shading: a screenshot face is darker than its texture (sides, shadow, evening light). Every match tries the
block at brightness 0.3 to 1.6 (renders with bloom run bright) and keeps the best, so a shaded wall still finds the right block; hue and
chroma decide, lightness only within that range. `--any` also allows blocks without slab/stair forms.
Colour cast (fog, the Hollow's purple haze, sunset, shaders): `--calibrate x0 y0 x1 y1 BLOCK` names one box
you know the block of (or a plain white/grey block); every colour is corrected by the same per-channel gain
before matching. Without it, tinted pictures drift toward purple, blue or orange blocks.
Output is a few lines of JSON per region: read that, never the pixels.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from colour import Palette, srgb_to_linear, linear_to_oklab, linear_to_srgb, rgb_to_hex   # noqa: E402

SKIP = ("pattern", "feature")


def oklab_to_linear(lab):
    lab = np.asarray(lab, dtype=float)
    M2i = np.linalg.inv(np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                                  [1.9779984951, -2.4285922050, 0.4505937099],
                                  [0.0259040371, 0.7827717662, -0.8086757660]]))
    M1i = np.linalg.inv(np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                                  [0.2119034982, 0.6806995451, 0.1073969566],
                                  [0.0883024619, 0.2817188376, 0.6299787005]]))
    return (lab @ M2i.T) ** 3 @ M1i.T


class Matcher:
    """Nearest blocks to a picture colour, allowing for the face being lit darker or brighter."""
    GAINS = np.linspace(0.3, 1.6, 27)

    def __init__(self, pal, any_form=False):
        self.pal = pal
        need = [] if any_form else ["slab", "stairs"]
        self.ids = pal.candidates(need=need, tags_no=SKIP + (() if any_form else ("axis",)))
        lin = np.array([np.clip(oklab_to_linear(pal.blocks[i]["oklab"]), 0, 1) for i in self.ids])
        # oklab of every block at every gain: (gains, blocks, 3)
        self.lab = np.stack([linear_to_oklab(np.clip(lin * g, 0, 1)) for g in self.GAINS])
        self.W = np.array([0.6, 1.6, 1.6])        # lighting moves lightness most: hue and chroma decide
        # flat, toy-like families only when nothing else fits (the same rule as gradients)
        self.pen = np.array([1.4 if "wool" in pal.blocks[i]["tags"] else 1.25 if "concrete" in pal.blocks[i]["tags"] else 1.0
                             for i in self.ids])

    def match(self, lin, n=3):
        lab = linear_to_oklab(np.clip(lin, 0, 1))
        d = np.linalg.norm((self.lab - lab) * self.W, axis=2)        # (gains, blocks)
        best = d.min(axis=0) * self.pen; gain = self.GAINS[d.argmin(axis=0)]
        o = np.argsort(best)[:n]
        return [{"block": self.ids[k], "err": round(float(best[k]), 3), "light": round(float(gain[k]), 2)} for k in o]


CAL = np.ones(3)


def calibrate(path, box, block, pal):
    """Per-channel gain that turns the box's colour into the named block's colour (brightness kept)."""
    global CAL
    seen = load(path, box, raw=True).mean(axis=0)
    want = np.clip(oklab_to_linear(pal.blocks[pal.resolve(block)]["oklab"]), 1e-4, 1)
    g = want / np.maximum(seen, 1e-4)
    CAL = g / (g @ np.array([0.2126, 0.7152, 0.0722]))       # colour only: keep the lighting for the matcher


def load(path, box=None, max_side=480, raw=False):
    im = Image.open(path).convert("RGB")
    if box: im = im.crop(tuple(int(v) for v in box))
    s = max_side / max(im.size)
    if s < 1: im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.BILINEAR)
    X = srgb_to_linear(np.asarray(im).reshape(-1, 3))
    return X if raw else np.clip(X * CAL, 0, 1)


def kmeans(X, k, iters=25, seed=3):
    """Plain k-means in OKLab (no sklearn). -> centres (linear rgb), share, labels."""
    lab = linear_to_oklab(np.clip(X, 0, 1))
    rng = np.random.default_rng(seed)
    k = min(k, len(np.unique(lab.round(3), axis=0)))
    C = lab[rng.choice(len(lab), 1)]
    while len(C) < k:              # k-means++ seeding: spread the starts
        d = np.min(np.linalg.norm(lab[:, None] - C[None], axis=2), axis=1) ** 2
        C = np.vstack([C, lab[rng.choice(len(lab), p=d / d.sum())]])
    for _ in range(iters):
        L = np.argmin(np.linalg.norm(lab[:, None] - C[None], axis=2), axis=1)
        C2 = np.array([lab[L == j].mean(axis=0) if np.any(L == j) else C[j] for j in range(k)])
        if np.allclose(C2, C): break
        C = C2
    cent = np.array([X[L == j].mean(axis=0) if np.any(L == j) else oklab_to_linear(C[j]) for j in range(k)])
    share = np.array([np.mean(L == j) for j in range(k)])
    o = np.argsort(-share)
    return cent[o], share[o], np.argsort(o)[L]


def hexof(lin): return rgb_to_hex(linear_to_srgb(lin))


def cmd_palette(a, M):
    X = load(a.img, a.box)
    cent, share, _ = kmeans(X, a.k)
    out = [{"hex": hexof(c), "share": round(float(s), 3), "blocks": M.match(c)} for c, s in zip(cent, share) if s >= 0.01]
    print(json.dumps(out, indent=1))


def cmd_sample(a, M):
    """Per region: two tones close together = one material with a texture partner; far apart = the box
    holds two materials (frame and infill, glass and wall), so both are listed and the box should be split."""
    res = {}
    for name, *box in a.region:
        X = load(a.img, [float(v) for v in box])
        cent, share, _ = kmeans(X, 2)
        main = M.match(cent[0])[0]
        r = {"hex": hexof(cent[0]), "block": main["block"], "light": main["light"], "err": main["err"],
             "also": [m["block"] for m in M.match(cent[0])[1:]]}
        if len(cent) == 2 and share[1] >= 0.15:
            b1 = M.match(cent[1])[0]
            sep = float(np.linalg.norm(linear_to_oklab(np.clip(cent[0], 0, 1)) - linear_to_oklab(np.clip(cent[1], 0, 1))))
            if sep > 0.12:
                r["mixed"] = {"note": "two different materials in this box: split it", "second": b1["block"],
                              "second_hex": hexof(cent[1]), "second_share": round(float(share[1]), 2)}
            elif b1["block"] != main["block"] and sep > 0.03:
                r["texture"] = {"share": round(float(share[1]), 2), "with": {main["block"]: b1["block"]}}
                r["tones"] = [hexof(cent[0]), hexof(cent[1])]
        r["material"] = {"block": r["block"], **({"texture": r["texture"]} if "texture" in r else {})}
        res[name] = r
    print(json.dumps(res, indent=1))


def cmd_grid(a):
    im = Image.open(a.img).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")
    for x in range(0, im.width, a.step):
        d.line([(x, 0), (x, im.height)], fill=(255, 0, 255, 110 if x % (a.step * 2) else 190), width=1)
        d.text((x + 2, 2), str(x), fill=(255, 255, 0, 255))
    for y in range(0, im.height, a.step):
        d.line([(0, y), (im.width, y)], fill=(255, 0, 255, 110 if y % (a.step * 2) else 190), width=1)
        d.text((2, y + 2), str(y), fill=(255, 255, 0, 255))
    im.save(a.out); print(json.dumps({"out": a.out, "size": im.size}))


def cmd_measure(a):
    b = a.px / a.block_px
    n = int(round(b)); odd = n if n % 2 else (n - 1 if b < n else n + 1)
    print(json.dumps({"blocks": round(b, 2), "nearest": n, "nearest_odd": odd}))


def cmd_compare(a):
    A, B = Image.open(a.img).convert("RGB"), Image.open(a.preview).convert("RGB")
    h = min(720, max(A.height, B.height))
    A = A.resize((int(A.width * h / A.height), h)); B = B.resize((int(B.width * h / B.height), h))
    im = Image.new("RGB", (A.width + B.width + 12, h + 22), (222, 228, 232))
    im.paste(A, (0, 22)); im.paste(B, (A.width + 12, 22))
    d = ImageDraw.Draw(im); d.text((4, 4), "reference", fill=(30, 30, 30)); d.text((A.width + 16, 4), "build", fill=(30, 30, 30))
    im.save(a.out); print(json.dumps({"out": a.out}))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    g = sp.add_parser("grid"); g.add_argument("img"); g.add_argument("out"); g.add_argument("--step", type=int, default=50)
    p = sp.add_parser("palette"); p.add_argument("img"); p.add_argument("--box", nargs=4, type=float); p.add_argument("--k", type=int, default=8); p.add_argument("--any", action="store_true")
    s = sp.add_parser("sample"); s.add_argument("img"); s.add_argument("--region", nargs=5, action="append", required=True, metavar=("NAME", "X0", "Y0", "X1", "Y1")); s.add_argument("--any", action="store_true")
    m = sp.add_parser("measure"); m.add_argument("--px", type=float, required=True); m.add_argument("--block-px", type=float, required=True)
    c = sp.add_parser("compare"); c.add_argument("img"); c.add_argument("preview"); c.add_argument("out")
    for q in (p, s): q.add_argument("--calibrate", nargs=5, metavar=("X0", "Y0", "X1", "Y1", "BLOCK"))
    a = ap.parse_args()
    if a.cmd == "grid": return cmd_grid(a)
    if a.cmd == "measure": return cmd_measure(a)
    if a.cmd == "compare": return cmd_compare(a)
    pal = Palette()
    if a.calibrate: calibrate(a.img, [float(v) for v in a.calibrate[:4]], a.calibrate[4], pal)
    M = Matcher(pal, any_form=getattr(a, "any", False))
    (cmd_palette if a.cmd == "palette" else cmd_sample)(a, M)


if __name__ == "__main__":
    main()
