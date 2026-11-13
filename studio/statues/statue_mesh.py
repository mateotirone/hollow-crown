"""A posed Faceless statue as textured quads, the way the game draws it (for the 3D pages).

    quads(age, hold, wear, size, yaw=0, at=(0, 0, 0))   -> [(4 corner points, 4 uvs (0-1), normal)] in world blocks

It reads the generated model (Siege_Nights_RP/models/entity/statues) and follows the same rules as the game:
VISIBLE is the render controller's part_visibility, POSE is the animation (scale, and the fallen lie), so the
pages show exactly what a player sees. build_statues.py writes both game files from these two tables.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GEO = os.path.join(REPO, "Siege_Nights_RP/models/entity/statues/faceless_statue_{}.geo.json")
AGES = ["boy", "youth", "young_king", "king", "old_king", "seated"]
HOLDS = ["folded", "staff", "sword", "bowl"]
WEARS = ["whole", "headless", "armless", "stump", "fallen"]

# bone -> when it shows, as (molang for the render controller, the same test in Python)
VISIBLE = {
    "body": ("q.property('siege:wear') != 3", lambda h, w: w != 3),
    "head": ("q.property('siege:wear') != 1 && q.property('siege:wear') != 3", lambda h, w: w not in (1, 3)),
    "arm_r": ("q.property('siege:wear') != 2", lambda h, w: w != 2),
    "stub": ("q.property('siege:wear') == 2", lambda h, w: w == 2),
    "rubble": ("q.property('siege:wear') == 3", lambda h, w: w == 3),
    **{f"arms_{n}": (f"q.property('siege:hold') == {i} && q.property('siege:wear') != 2", (lambda i: lambda h, w: h == i and w != 2)(i))
       for i, n in enumerate(HOLDS)},
}
# the animation: the whole figure at its size; a fallen one lies on its back, broken at the knees, the top half slid on
FALL, SLIDE, LIFT = -90, 2, 6
POSE = {
    "root": {"rotation": [f"q.property('siege:wear') == 4 ? {FALL} : 0", 0, 0],
             "scale": "q.property('siege:size')"},
    "body": {"rotation": [f"q.property('siege:wear') == 4 ? {LIFT} : 0", 0, 0],
             "position": [0, f"q.property('siege:wear') == 4 ? {SLIDE} : 0", 0]},
}


def _rx(p, deg, piv):
    """Bedrock's x rotation: positive tips the top of a bone toward the front (-z)."""
    a = math.radians(deg); x, y, z = p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]
    return (x + piv[0], y * math.cos(a) + z * math.sin(a) + piv[1], -y * math.sin(a) + z * math.cos(a) + piv[2])


def quads(age, hold, wear, size, yaw=0, at=(0, 0, 0)):
    g = json.load(open(GEO.format(age)))["minecraft:geometry"][0]
    W, H = g["description"]["texture_width"], g["description"]["texture_height"]
    bones = {b["name"]: b for b in g["bones"]}
    h, w = HOLDS.index(hold) if isinstance(hold, str) else hold, WEARS.index(wear) if isinstance(wear, str) else wear
    fallen = w == 4

    def shown(b):
        while b:
            if b["name"] in VISIBLE and not VISIBLE[b["name"]][1](h, w): return False
            b = bones.get(b.get("parent"))
        return True

    def chain(b):   # transforms from this bone up to the root, innermost first
        out = []
        while b:
            rx = (b.get("rotation") or [0])[0]
            if b["name"] == "body" and fallen: rx += LIFT
            if b["name"] == "root" and fallen: rx += FALL
            dy = SLIDE if (b["name"] == "body" and fallen) else 0
            out.append((rx, b["pivot"], dy))
            b = bones.get(b.get("parent"))
        return out

    a = math.radians(yaw); ca, sa = math.cos(a), math.sin(a)

    def world(p, ch):
        for rx, piv, dy in ch:
            p = (p[0], p[1] + dy, p[2])
            if rx: p = _rx(p, rx, piv)
        x, y, z = (q * size / 16 for q in p)
        x, z = -x, -z                                              # the model's front (-z) looks along the entity's facing
        return (at[0] + x * ca - z * sa, at[1] + y, at[2] + x * sa + z * ca)

    out = []
    for b in g["bones"]:
        if not shown(b): continue
        ch = chain(b)
        for c in b.get("cubes", []):
            (x0, y0, z0), (sx, sy, sz) = c["origin"], c["size"]; x1, y1, z1 = x0 + sx, y0 + sy, z0 + sz
            F = {"north": [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
                 "south": [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
                 "east": [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
                 "west": [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
                 "up": [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
                 "down": [(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)]}
            for fn, pts in F.items():
                if fn not in c["uv"]: continue
                (u, v), (uw, vh) = c["uv"][fn]["uv"], c["uv"][fn]["uv_size"]
                uv = [((u + uw) / W, v / H), (u / W, v / H), (u / W, (v + vh) / H), ((u + uw) / W, (v + vh) / H)]
                P = [world(p, ch) for p in pts]
                e1 = [P[1][i] - P[0][i] for i in range(3)]; e2 = [P[3][i] - P[0][i] for i in range(3)]
                n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
                L = math.sqrt(sum(q * q for q in n)) or 1
                C = world(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ch); M = [sum(p[i] for p in P) / 4 for i in range(3)]
                if sum(n[i] * (M[i] - C[i]) for i in range(3)) < 0:   # wind it so it faces out of the box
                    P, uv, n = P[::-1], uv[::-1], [-q for q in n]
                out.append((P, uv, [q / L for q in n]))
    return out
