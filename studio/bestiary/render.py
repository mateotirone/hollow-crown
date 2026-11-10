# Quick oblique previews of the box models (front, top and one side), so the roster can be looked at
# without opening the game. Cube rotations are ignored; it's a sketch, not the Texture Studio.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from models import Model, faces
import roster

def render(m, size=220, pal=None):
    """Oblique view (front, top, one side) painted texel by texel from the real skin."""
    model = Model(m["id"], m["pal"], seed=sum(map(ord, m["id"]))); m["model"](model); model.pack()
    tex = model.texture(pal).load()
    P = lambda x, y, z: (x + 0.45 * z, -y - 0.28 * z)
    pts = []
    for c in model.cubes:
        x, y, z = c["origin"]; w, h, d = c["size"]
        for px in (x, x + w):
            for py in (y, y + h):
                for pz in (z, z + d): pts.append(P(px, py, pz))
    minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts); miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
    s = min((size - 16) / max(maxx - minx, 1), (size - 16) / max(maxy - miny, 1), 9) * 3
    W = size * 3
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ox = (W - (maxx - minx) * s) / 2 - minx * s; oy = (W - (maxy - miny) * s) / 2 - miny * s
    T = lambda x, y, z: (ox + P(x, y, z)[0] * s, oy + P(x, y, z)[1] * s)
    for c in sorted(model.cubes, key=lambda c: (-(c["origin"][2] + c["size"][2] / 2), c["origin"][1], c["origin"][0])):
        x, y, z = c["origin"]; w, h, d = c["size"]; u, v = c["uv"]; g = c.get("inflate", 0)
        x -= g; y -= g; z -= g; W2, H2, D2 = w + 2 * g, h + 2 * g, d + 2 * g
        fs = faces(u, v, w, h, d)
        layer = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dr = ImageDraw.Draw(layer)
        def quad(a, b, c2, d2, colr):
            if colr[3]: dr.polygon([a, b, c2, d2], fill=colr)
        fx, fy, fw, fh = fs["east"]                                    # the side we can see (+x)
        for ty in range(fh):
            for tx in range(fw):
                z0 = z + D2 * tx / fw; z1 = z + D2 * (tx + 1) / fw; y1 = y + H2 * (1 - ty / fh); y0 = y + H2 * (1 - (ty + 1) / fh)
                quad(T(x + W2, y0, z0), T(x + W2, y0, z1), T(x + W2, y1, z1), T(x + W2, y1, z0), tex[fx + fw - 1 - tx, fy + ty])
        fx, fy, fw, fh = fs["up"]
        for ty in range(fh):
            for tx in range(fw):
                x0 = x + W2 * tx / fw; x1 = x + W2 * (tx + 1) / fw; z1 = z + D2 * (1 - ty / fh); z0 = z + D2 * (1 - (ty + 1) / fh)
                quad(T(x0, y + H2, z0), T(x1, y + H2, z0), T(x1, y + H2, z1), T(x0, y + H2, z1), tex[fx + tx, fy + ty])
        fx, fy, fw, fh = fs["north"]
        for ty in range(fh):
            for tx in range(fw):
                x0 = x + W2 * tx / fw; x1 = x + W2 * (tx + 1) / fw; y1 = y + H2 * (1 - ty / fh); y0 = y + H2 * (1 - (ty + 1) / fh)
                quad(T(x0, y0, z), T(x1, y0, z), T(x1, y1, z), T(x0, y1, z), tex[fx + tx, fy + ty])
        im = Image.alpha_composite(im, layer)
    return im.resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for m in roster.MOBS:
        if m["id"] == "hollow_bolt": continue
        render(m).save(os.path.join(out, m["id"] + ".png"))
    # contact sheet for a quick look
    ms = [m for m in roster.MOBS if m["id"] != "hollow_bolt"]; cols = 8; rows = (len(ms) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 220, rows * 220), (36, 38, 44, 255))
    for i, m in enumerate(ms): 
        t = Image.open(os.path.join(out, m["id"] + ".png")); sheet.alpha_composite(t, ((i % cols) * 220, (i // cols) * 220))
    sheet.save(os.path.join(out, "_sheet.png"))
