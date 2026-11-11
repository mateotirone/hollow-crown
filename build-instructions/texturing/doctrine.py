"""The texturing doctrine as code.

doctrine.json is the source of truth: region > colour family (a code such as VAL-01) > a ladder of blocks.
This module loads it, paints a surface from a ladder by the rules in README.md, and rebuilds the region
pages (regions/*.md) and the visual viewer (doctrine.html).

Use from a builder:

    from doctrine import family, paint
    ladder = family("VAL-01")["blocks"]
    grid = paint(15, 9, ladder, seed=7)          # grid[y][x] = block id, y = 0 is the bottom row

Rebuild the pages and the viewer after editing doctrine.json:

    python3 build-instructions/texturing/doctrine.py --textures bedrock-samples/resource_pack/textures/blocks \
        [--kit map/structures/render]
"""
import base64, io, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))


def load():
    with open(os.path.join(HERE, "doctrine.json"), encoding="utf-8") as f:
        return json.load(f)


def family(code):
    for r in load()["regions"]:
        for f in r["families"]:
            if f["code"] == code:
                return f
    raise KeyError(code)


# ---------------------------------------------------------------- painting

def _hash(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def _noise(x, y, seed, cell=5.0):
    """Smooth value noise in 0..1, clusters about `cell` blocks across (never single-block speckle)."""
    gx, gy = x / cell, y / cell
    x0, y0 = math.floor(gx), math.floor(gy)
    fx, fy = gx - x0, gy - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(x0, y0, seed), _hash(x0 + 1, y0, seed)
    c, d = _hash(x0, y0 + 1, seed), _hash(x0 + 1, y0 + 1, seed)
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy


def paint_teeth(w, h, ladder, seed=1, depth=1, lone=0.08, top_first=False):
    """Mateo's gradient examples (2026-11-11, gradient-examples-ardacraft.png): the ladder runs bottom to
    top in bands; each band edge interlocks in columns (teeth), every column's edge shifted up or down by
    up to `depth` rows, and a few lone blocks of the next step sit one row ahead of the edge. Returns
    grid[y][x], y = 0 the bottom row."""
    n = len(ladder)
    if n == 1:
        return [[ladder[0]] * w for _ in range(h)]
    edges = [(k + 1) * h / n for k in range(n - 1)]
    idx = [[0] * w for _ in range(h)]
    for x in range(w):
        cut = [e + round((_hash(x, k, seed) - 0.5) * (2 * depth + 0.99)) for k, e in enumerate(edges)]
        for y in range(h):
            i = sum(1 for c in cut if y >= c)
            r = _hash(x, y, seed + 13)
            if r < lone / 2 and i < n - 1 and y + 1 >= cut[i] - 1: i += 1          # lone block of the step above
            elif r > 1 - lone / 2 and i > 0 and y <= cut[i - 1] + 1: i -= 1        # lone block of the step below
            idx[h - 1 - y if top_first else y][x] = i
    for _ in range(n):
        changed = False
        for y in range(h):
            for x in range(w):
                for dx, dy in ((1, 0), (0, 1)):
                    X, Y = x + dx, y + dy
                    if X < w and Y < h and abs(idx[y][x] - idx[Y][X]) > 1:
                        if idx[y][x] > idx[Y][X]: idx[y][x] -= 1
                        else: idx[Y][X] -= 1
                        changed = True
        if not changed:
            break
    return [[ladder[i] for i in row] for row in idx]


def paint(w, h, ladder, seed=1, base=None, strength=0.6, cell=4.0, top_first=False):
    """Paint a w x h surface from a ladder (dark to light). Returns grid[y][x] of block ids.

    - Position gradient: darkest at the bottom row, lightest at the top (top_first=True flips it, for
      ladders listed ridge to eaves such as copper).
    - Plus low-frequency noise (clusters), snapped to the ladder.
    - Then no skipped steps: neighbours differ by at most one step.
    - At most 3 neighbouring steps are used unless the ladder given is longer on purpose.
    """
    n = len(ladder)
    if n == 1:
        return [[ladder[0]] * w for _ in range(h)]
    idx = [[0] * w for _ in range(h)]
    for y in range(h):
        t = y / max(1, h - 1)
        if top_first:
            t = 1 - t
        for x in range(w):
            v = t + (_noise(x, y, seed, cell) - 0.5) * strength
            idx[y][x] = min(n - 1, max(0, int(round(v * (n - 1)))))
    if base is not None:  # pull towards a base step so it holds at least ~60%
        for y in range(h):
            for x in range(w):
                if abs(idx[y][x] - base) == 1 and _hash(x, y, seed + 9) < 0.5:
                    idx[y][x] = base
    for _ in range(n):  # close any skipped step
        changed = False
        for y in range(h):
            for x in range(w):
                for dx, dy in ((1, 0), (0, 1)):
                    X, Y = x + dx, y + dy
                    if X < w and Y < h and abs(idx[y][x] - idx[Y][X]) > 1:
                        if idx[y][x] > idx[Y][X]:
                            idx[y][x] -= 1
                        else:
                            idx[Y][X] -= 1
                        changed = True
        if not changed:
            break
    return [[ladder[i] for i in row] for row in idx]


# ---------------------------------------------------------------- textures

def _texture(block, tex_dir, mesher):
    n = block.replace("waxed_", "")
    special = {"mangrove_log": "mangrove_log_side", "stripped_mangrove_log": "stripped_mangrove_log_side",
               "warped_planks": "huge_fungus/warped_planks", "blue_ice": "blue_ice", "snow": "snow"}
    if n.startswith("siege:"):
        p = os.path.join(REPO, "Siege_Nights_RP/textures/blocks", "siege_" + n[6:] + ".png")
        if os.path.isfile(p):
            return p
        if mesher:
            s = mesher.cube_tex(n, {}).get("side")
            if s and os.path.isfile(s if s.endswith(".png") else s + ".png"):
                return s if s.endswith(".png") else s + ".png"
        return None
    if n.endswith("_concrete"):
        return os.path.join(tex_dir, "concrete_" + n[:-9].replace("light_gray", "silver") + ".png")
    if n in special:
        return os.path.join(tex_dir, special[n] + ".png")
    cands = []
    if mesher:
        s = mesher.cube_tex(n, {}).get("side")
        if s:
            cands.append(s.split("#")[0].replace(".tga", ""))
    cands.append(n)
    for c in cands:
        p = c if os.path.isabs(c) else os.path.join(tex_dir, c)
        for ext in ("", ".png"):
            if os.path.isfile(p + ext) and (p + ext).endswith(".png"):
                return p + ext
    return None


def _measure(path):
    from PIL import Image
    im = Image.open(path).convert("RGBA")
    if im.size[1] > im.size[0]:  # animated strips: first frame
        im = im.crop((0, 0, im.size[0], im.size[0]))
    im = im.resize((16, 16), Image.NEAREST)
    px = [q for q in im.getdata() if q[3] > 200] or [(128, 128, 128, 255)]
    rgb = tuple(sum(q[i] for q in px) // len(px) for i in range(3))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return rgb, "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def hexc(c):
    return "#%02X%02X%02X" % c


# ---------------------------------------------------------------- outputs

def write_pages(d, info):
    out = os.path.join(HERE, "regions")
    os.makedirs(out, exist_ok=True)
    for r in d["regions"]:
        L = [f"# Texturing doctrine: {r['name']} ({', '.join(r['towns'])})", "",
             "Generated from `../doctrine.json` by `../doctrine.py`: edit the JSON, not this page. Blocks run",
             "**dark to light** by value unless a family says otherwise; the hex is the average colour of the",
             "block's texture. Paint surfaces by the rules in `../README.md` (no skipped steps, clusters, cracks",
             "with a cause). The viewer `../doctrine.html` shows every ladder with the real textures.", ""]
        for f in r["families"]:
            cols = [info.get(b, (None, None))[0] for b in f["blocks"]]
            have = [c for c in cols if c]
            avg = hexc(tuple(sum(c[i] for c in have) // len(have) for i in range(3))) if have else "?"
            status = {"mateo": "Mateo's blocks", "principle": "built by the gradient rules from Mateo's examples, waiting for his check"}.get(f.get("status"), "Claude's starter, waiting for Mateo's blocks")
            L += [f"## {f['code']} {f['name']} ({avg})", "", f"Used for: {f['use']}. Status: {status}.", ""]
            if f.get("order"):
                L += [f"Order: {f['order']}.", ""]
            if f.get("note"):
                L += [f"Note: {f['note']}.", ""]
            L += ["| Step | Block | Hex |", "|---|---|---|"]
            for i, (b, c) in enumerate(zip(f["blocks"], cols), 1):
                L.append(f"| {i} | `{b}` | {hexc(c) if c else '?'} |")
            L += ["", f"Screenshot: {f.get('screenshot') or '_waiting_'}", ""]
        with open(os.path.join(out, r["id"] + ".md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(L))


def write_viewer(d, info):
    tpl = open(os.path.join(HERE, "viewer.tpl.html"), encoding="utf-8").read()
    data = {"rules": d["rules"], "pairings": d.get("pairings", []), "regions": d["regions"],
            "tex": {b: {"hex": hexc(v[0]), "img": v[1]} for b, v in info.items()}}
    html = tpl.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False))
    with open(os.path.join(HERE, "doctrine.html"), "w", encoding="utf-8") as fh:
        fh.write(html)


def main(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--textures", required=True, help="vanilla block textures folder (bedrock-samples)")
    ap.add_argument("--kit", help="map/structures/render, for its block-to-texture names")
    a = ap.parse_args(argv)
    mesher = None
    if a.kit:
        sys.path.insert(0, a.kit)
        import mesher as _m
        _m._REPO = REPO
        mesher = _m
    d = load()
    blocks = {b for r in d["regions"] for f in r["families"] for b in f["blocks"]}
    blocks |= {b for p in d.get("pairings", []) for b in p["blocks"]}
    info, missing = {}, []
    for b in sorted(blocks):
        p = _texture(b, a.textures, mesher)
        if p and os.path.isfile(p):
            info[b] = _measure(p)
        else:
            missing.append(b)
    write_pages(d, info)
    write_viewer(d, info)
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    for r in d["regions"]:                     # the ladder check: lightness climbs, no equal neighbours
        for f in r["families"]:
            if "ridge" in (f.get("order") or "") or "hue gradient" in (f.get("note") or "") or "accent" in f["name"].lower() or "timber" in f["code"].lower():
                continue
            ls = [lum(info[b][0]) for b in f["blocks"] if b in info]
            bad = [(f["blocks"][i], f["blocks"][i + 1]) for i in range(len(ls) - 1) if ls[i + 1] - ls[i] < 5]
            if bad and f["code"] != "VAL-09":
                print(f"ladder check {f['code']}: {bad}")
    fams = sum(len(r["families"]) for r in d["regions"])
    print(f"{len(d['regions'])} regions, {fams} families, {len(blocks)} blocks; no texture: {missing or 'none'}")


if __name__ == "__main__":
    main(sys.argv[1:])
