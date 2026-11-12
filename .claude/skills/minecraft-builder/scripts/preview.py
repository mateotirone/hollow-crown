"""Isometric preview PNG straight from the block list: no browser, no model, a second or two.

Every block is drawn with its real shape (slabs, stairs and corners, trapdoors, walls, fences, panes,
doors, signs, lanterns...) on a sub-block grid, coloured from 4x4 thumbnails of the real textures in
palette.json, with simple face shading and contact shadows. Two views: from the south-east and from the
north-west.
"""
import numpy as np
from PIL import Image, ImageDraw
from colour import hex_to_rgb
from emit import is_stairs, is_slab, is_wall, is_fence, is_pane, is_trapdoor

LEFT = {"n": "w", "w": "s", "s": "e", "e": "n"}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}
FALLBACK = {"air": "#000000"}


def block_mask(n, p, q):
    a = np.arange(q); X, Y, Z = np.meshgrid(a, a, a, indexing="ij"); h = q // 2
    side = {"n": Z < h, "s": Z >= h, "e": X >= h, "w": X < h}
    t = max(1, round(q * 3 / 16)); c0, c1 = q // 2 - max(1, q // 8), q // 2 + max(1, q // 8)
    edge = {"n": Z < t, "s": Z >= q - t, "e": X >= q - t, "w": X < t}
    f = p.get("facing", "n")
    if is_stairs(n):
        base, cap = (Y >= h, Y < h) if p.get("half") == "top" else (Y < h, Y >= h)
        L = LEFT[f]; c = p.get("corner", "none")
        top = {"none": side[f], "outer_left": side[f] & side[L], "outer_right": side[f] & side[OPP[L]],
               "inner_left": side[f] | side[L], "inner_right": side[f] | side[OPP[L]]}[c]
        return base | (cap & top)
    if is_slab(n): return Y >= h if p.get("half") == "top" else Y < h
    if is_trapdoor(n):
        if p.get("open"): return edge[OPP[f]]
        return Y >= q - t if p.get("half") == "top" else Y < t
    post = (X >= c0) & (X < c1) & (Z >= c0) & (Z < c1)
    if is_fence(n) or is_pane(n) or is_wall(n):
        w0, w1 = (q // 4, q - q // 4) if is_wall(n) else (c0, c1)
        m = ((X >= w0) & (X < w1) & (Z >= w0) & (Z < w1)) if (is_wall(n) and p.get("post", True)) or is_fence(n) else np.zeros_like(post)
        arm_y = (Y < q - max(1, q // 8)) if is_wall(n) else ((Y >= q * 6 // 16) & (Y < q * 15 // 16)) if is_fence(n) else np.ones_like(post)
        conn = p.get("conn", {})
        if is_pane(n) and not any(conn.values()): conn = {"n": True, "s": True}
        for d, on in conn.items():
            if not on: continue
            if d in "ns": m |= (X >= c0) & (X < c1) & arm_y & ((Z < h) if d == "n" else (Z >= h))
            else: m |= (Z >= c0) & (Z < c1) & arm_y & ((X >= h) if d == "e" else (X < h))
        return m | (post if not is_wall(n) else m)
    if n.endswith("_door"): return edge[OPP[p.get("facing", "s")]]
    if n.endswith("wall_sign"):
        return edge[OPP[f]] & (Y >= q * 4 // 16) & (Y < q * 13 // 16) & (((X >= 1) & (X < q - 1)) if f in "ns" else ((Z >= 1) & (Z < q - 1)))
    if n in ("lantern", "soul_lantern"):
        m = (X >= q // 4) & (X < q - q // 4) & (Z >= q // 4) & (Z < q - q // 4)
        return m & ((Y >= q // 8) & (Y < q * 5 // 8) if p.get("hanging") else (Y < q // 2))
    if n in ("iron_chain", "end_rod", "lightning_rod"): return post
    if n == "torch": return post & (Y < q * 5 // 8)
    if n == "campfire": return Y < q * 7 // 16
    if n == "flower_pot": return (X >= q * 5 // 16) & (X < q * 11 // 16) & (Z >= q * 5 // 16) & (Z < q * 11 // 16) & (Y < q * 6 // 16)
    if n == "vine": return edge[f] if f else Y < 1
    return np.ones((q, q, q), bool)


def _colours(name, palette):
    base = palette.base_of(name)
    if base:
        th = palette.blocks[base]["thumb"]; return th["side"], th["top"]
    k = name
    for a, b in (("_wall_sign", "_planks"), ("_trapdoor", "_planks"), ("_fence", "_planks")):
        if k.endswith(a) and (k[: -len(a)] + b) in palette.blocks:
            th = palette.blocks[k[: -len(a)] + b]["thumb"]; return th["side"], th["top"]
    if k == "trapdoor": th = palette.blocks["oak_planks"]["thumb"]; return th["side"], th["top"]
    if k == "iron_trapdoor": th = palette.blocks["iron_block"]["thumb"]; return th["side"], th["top"]
    for key in (k, k.replace("_pane", ""), "glass" if "glass" in k else "", "oak_door" if k.endswith("_door") else ""):
        if key in palette.extras:
            th = palette.extras[key]["thumb"]; return th, th
    if k in ADDON:                    # the add-on's own blocks: the nearest vanilla look, for previews only
        return _colours(ADDON[k], palette)
    if k.endswith("_button") and (k[: -len("_button")]) in palette.blocks:
        th = palette.blocks[k[: -len("_button")]]["thumb"]; return th["side"], th["top"]
    return ["#ff00ff"] * 16, ["#ff00ff"] * 16


ADDON = {"siege:pale_ash": "light_gray_concrete", "siege:veinstone": "blackstone", "siege:veinstone_bricks": "polished_blackstone_bricks",
         "siege:cracked_veinstone_bricks": "cracked_polished_blackstone_bricks", "siege:spire_roof": "deepslate_tiles",
         "siege:glimbulb": "orange_concrete", "iron_bars": "iron_block"}


def _stamp(face, a):
    """Pixel offsets covered by one sub-voxel face, relative to the projected (x, y, z) corner."""
    P = lambda x, y, z: ((x - z) * a, (x + z) * a / 2 - y * a)
    quad = {"top": [P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)],
            "east": [P(1, 0, 0), P(1, 0, 1), P(1, 1, 1), P(1, 1, 0)],
            "south": [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)]}[face]
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    ox, oy = int(np.floor(min(xs))), int(np.floor(min(ys)))
    w, h = int(np.ceil(max(xs))) - ox + 1, int(np.ceil(max(ys))) - oy + 1
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).polygon([(x - ox, y - oy) for x, y in quad], fill=255)
    yy, xx = np.nonzero(np.asarray(im) > 0)
    return xx + ox, yy + oy


def render_view(blocks, palette, q, a, view="se"):
    xs, ys, zs = zip(*blocks)
    x0, y0, z0 = min(xs), min(ys), min(zs)
    NX, NY, NZ = (max(xs) - x0 + 1) * q, (max(ys) - y0 + 1) * q + 1, (max(zs) - z0 + 1) * q
    names = sorted({n for n, _ in blocks.values()})
    nid = {n: i + 1 for i, n in enumerate(names)}
    G = np.zeros((NX + 1, NY + 1, NZ + 1), np.int16)
    for (x, y, z), (n, p) in blocks.items():
        m = block_mask(n, p, q)
        sl = G[(x - x0) * q:(x - x0 + 1) * q, (y - y0) * q:(y - y0 + 1) * q, (z - z0) * q:(z - z0 + 1) * q]
        sl[m] = nid[n]
    if view == "nw": G = np.pad(np.ascontiguousarray(G[:NX, :, :NZ][::-1, :, ::-1]), ((0, 1), (0, 0), (0, 1)))
    side_tex = np.zeros((len(names) + 1, 16, 3)); top_tex = np.zeros((len(names) + 1, 16, 3))
    for n, i in nid.items():
        s, t = _colours(n, palette)
        side_tex[i] = [hex_to_rgb(c) for c in s]; top_tex[i] = [hex_to_rgb(c) for c in t]
    occ = G > 0
    faces = []
    tq = max(1, q // 4)
    for face, shade, nb in (("top", 1.0, (0, 1, 0)), ("east", 0.62, (1, 0, 0)), ("south", 0.80, (0, 0, 1))):
        dx, dy, dz = nb
        exp = occ.copy()
        exp[:-1 if dx else None, :-1 if dy else None, :-1 if dz else None] &= ~occ[dx:, dy:, dz:]
        X, Y, Z = np.nonzero(exp)
        ids = G[X, Y, Z]
        if face == "top": u, v, tex = (X % q) // tq, (Z % q) // tq, top_tex
        elif face == "east": u, v, tex = (Z % q) // tq, (q - 1 - Y % q) // tq, side_tex
        else: u, v, tex = (X % q) // tq, (q - 1 - Y % q) // tq, side_tex
        col = tex[ids, (v % 4) * 4 + (u % 4)] * shade
        # contact shadow: darken faces with something right above-in-front (cheap ambient occlusion)
        if face != "top":
            above = np.zeros(len(X), bool)
            ok = Y + 1 < G.shape[1]
            ax_, ay_, az_ = X + dx, np.minimum(Y + 1, G.shape[1] - 1), Z + dz
            ok &= (ax_ < G.shape[0]) & (az_ < G.shape[2])
            above[ok] = occ[ax_[ok], ay_[ok], az_[ok]]
            col[above] *= 0.82
        faces.append((face, X, Y, Z, col))
    # project
    allx = []; ally = []; depth = []; cols = []
    for face, X, Y, Z, col in faces:
        sx, sy = _stamp(face, a)
        bx = (X - Z) * a; by = (X + Z) * a / 2 - Y * a
        px = (bx[:, None] + sx[None, :]).reshape(-1); py = (by[:, None] + sy[None, :]).reshape(-1)
        d = np.repeat((X + Y + Z).astype(np.int64) * 4 + {"top": 3, "east": 2, "south": 1}[face], len(sx))
        allx.append(px); ally.append(py); depth.append(d); cols.append(np.repeat(col, len(sx), axis=0))
    px = np.concatenate(allx).astype(np.int64); py = np.concatenate(ally).astype(np.int64)
    d = np.concatenate(depth); c = np.concatenate(cols)
    px -= px.min(); py -= py.min()
    W, H = int(px.max()) + 1, int(py.max()) + 1
    order = np.argsort(d, kind="stable")
    img = np.zeros((H, W, 3)); has = np.zeros((H, W), bool)
    img[py[order], px[order]] = c[order]          # later (closer) writes win
    has[py, px] = True
    return img, has


def render(blocks, palette, path, max_w=1200, views=("se", "nw"), label=None):
    if not blocks:
        Image.new("RGB", (200, 100), (222, 228, 232)).save(path); return path
    xs, ys, zs = zip(*blocks)
    ext = max(max(xs) - min(xs), max(zs) - min(zs), max(ys) - min(ys)) + 1
    q = 8 if ext <= 40 else 4 if ext <= 100 else 2
    span = ((max(xs) - min(xs) + 1) + (max(zs) - min(zs) + 1)) * q * len(views)
    a = 2 if span * 2 <= max_w * 1.6 else 1 if q == 2 else 2
    tiles = []
    for v in views:
        img, has = render_view(blocks, palette, q, a, v)
        h, w = has.shape
        bg = np.empty((h, w, 3)); grad = np.linspace(236, 214, h)[:, None]
        bg[..., 0] = grad - 6; bg[..., 1] = grad; bg[..., 2] = grad + 6
        out = np.where(has[..., None], img, bg)
        tiles.append(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)))
    pad = 16
    W = sum(t.width for t in tiles) + pad * (len(tiles) + 1); H = max(t.height for t in tiles) + pad * 2 + (18 if label else 0)
    sheet = Image.new("RGB", (W, H), (226, 232, 236))
    x = pad
    for t in tiles:
        sheet.paste(t, (x, pad + (18 if label else 0) + (H - pad * 2 - (18 if label else 0) - t.height) // 2)); x += t.width + pad
    if label: ImageDraw.Draw(sheet).text((pad, 4), label, fill=(40, 44, 48))
    if sheet.width > max_w:
        sheet = sheet.resize((max_w, int(sheet.height * max_w / sheet.width)), Image.LANCZOS)
    sheet.save(path)
    return path
