# Quick oblique previews of the box models (front, top and one side), so the roster can be looked at
# without opening the game. Cube rotations are ignored; it's a sketch, not the Texture Studio.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from models import Model, faces
import roster

def _rot(rx, ry, rz):
    """Bedrock bone/cube rotation (degrees) as a matrix in model coordinates."""
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    X = ((1, 0, 0), (0, cx, -sx), (0, sx, cx)); Y = ((cy, 0, sy), (0, 1, 0), (-sy, 0, cy)); Z = ((cz, -sz, 0), (sz, cz, 0), (0, 0, 1))
    mul = lambda A, B: tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
    return mul(Z, mul(Y, X))
def _about(M, piv, p):
    v = [p[i] - piv[i] for i in range(3)]
    return tuple(piv[i] + sum(M[i][k] * v[k] for k in range(3)) for i in range(3))

def render(m, size=220, pal=None, yaw=-32, pitch=14):
    """Three-quarter view painted texel by texel from the real skin, with bone and cube rotations applied (rest pose)."""
    model = Model(m["id"], m["pal"], seed=sum(map(ord, m["id"]))); m["model"](model); model.pack()
    tex = model.texture(pal).load()
    bones = {b["name"]: b for b in model.bones}
    V = _rot(0, 0, 0)
    cy, sy, cp, sp = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    def view(p):
        x, y, z = p
        x, z = x * cy + z * sy, -x * sy + z * cy          # turn the model
        y, z = y * cp + z * sp, -y * sp + z * cp          # tip it toward us
        return (x, -y, z)
    quads = []
    for b in model.bones:
        chain = []; cur = b
        while cur:
            if cur.get("rotation"): chain.append((_rot(*cur["rotation"]), cur["pivot"]))
            cur = bones.get(cur.get("parent"))
        for c in b["cubes"]:
            x, y, z = c["origin"]; w, h, d = c["size"]; u, v = c["uv"]; g = c.get("inflate", 0)
            x0, y0, z0, x1, y1, z1 = x - g, y - g, z - g, x + w + g, y + h + g, z + d + g
            cr = (_rot(*c["rotation"]), c["pivot"]) if c.get("rotation") else None
            def T(p):
                if cr: p = _about(cr[0], cr[1], p)
                for M, piv in chain: p = _about(M, piv, p)
                return view(p)
            fs = faces(u, v, w, h, d); mir = c.get("mirror")
            if mir: fs["east"], fs["west"] = fs["west"], fs["east"]
            # each face: texture rect, then the 3D corner for (tx,ty) = (0,0), (1,0), (0,1) as fractions
            plan = {"north": ((x0, y1, z0), (x1, y1, z0), (x0, y0, z0)), "south": ((x1, y1, z1), (x0, y1, z1), (x1, y0, z1)),
                    "east": ((x0, y1, z1), (x0, y1, z0), (x0, y0, z1)), "west": ((x1, y1, z0), (x1, y1, z1), (x1, y0, z0)),
                    "up": ((x0, y1, z1), (x1, y1, z1), (x0, y1, z0)), "down": ((x0, y0, z0), (x1, y0, z0), (x0, y0, z1))}
            for f, (o, a, bb) in plan.items():
                fx, fy, fw, fh = fs[f]
                if fw <= 0 or fh <= 0:
                    continue
                O, A, B = T(o), T(a), T(bb)
                ua = [A[i] - O[i] for i in range(3)]; ub = [B[i] - O[i] for i in range(3)]
                nz = ua[0] * ub[1] - ua[1] * ub[0]
                thin = min(w, h, d) == 0
                if nz <= 0 and not thin: continue            # facing away
                for ty in range(fh):
                    for tx in range(fw):
                        sx_ = (fw - 1 - tx) if (mir and f in ("north", "south", "up", "down")) else tx
                        col = tex[min(fx + sx_, model.tw - 1), min(fy + ty, model.th - 1)]
                        if not col[3]: continue
                        pts = []
                        for (ia, ib) in ((tx, ty), (tx + 1, ty), (tx + 1, ty + 1), (tx, ty + 1)):
                            pts.append(tuple(O[i] + ua[i] * ia / fw + ub[i] * ib / fh for i in range(3)))
                        quads.append((sum(p[2] for p in pts) / 4, pts, col))
    if not quads: return Image.new("RGBA", (size, size), (0, 0, 0, 0))
    xs = [p[0] for q in quads for p in q[1]]; ys = [p[1] for q in quads for p in q[1]]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    S = 3; W = size * S
    s = min((W - 16 * S) / max(maxx - minx, 1), (W - 16 * S) / max(maxy - miny, 1), 9 * S)
    ox = (W - (maxx - minx) * s) / 2 - minx * s; oy = (W - (maxy - miny) * s) / 2 - miny * s
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0)); dr = ImageDraw.Draw(im, "RGBA")
    for _, pts, col in sorted(quads, key=lambda q: -q[0]):
        dr.polygon([(ox + p[0] * s, oy + p[1] * s) for p in pts], fill=col)
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
