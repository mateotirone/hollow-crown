"""Everwake Wings: paint the 64x64 wing texture and write the Bedrock geometry.
(The animated preview on the game's player model is build_anim.py.)

    python3 build_wings.py OUTDIR
"""
import base64, io, json, math, os, random, sys
from PIL import Image

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(1319)

# ---------------------------------------------------------------- palette (light and cloth)
WHITE = (250, 247, 238); CREAM = (238, 228, 204); CREAM2 = (226, 213, 184); SHAFT = (205, 190, 158)
GOLD = (246, 222, 150); GLOW = (255, 244, 205); CLOTH = (214, 226, 238); CLOTH2 = (188, 204, 222); CLOTHD = (160, 178, 200)
BRASS = (196, 168, 102); BRASSD = (150, 122, 70)

W = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
px = W.load()


def put(x, y, c, a=255):
    if 0 <= x < 64 and 0 <= y < 64: px[x, y] = c + (a,)


def feather_face(x0, y0, w, h, lens, top_cover=3, row_shift=0):
    """A face of feathers, w wide, h tall: vertical feathers 2 px wide whose lengths are `lens`
    (from the top), white with a shaft line, cream shading, glowing gold tip, transparent below."""
    for i in range(0, w, 2):
        L = lens[min(len(lens) - 1, i // 2)]
        for dy in range(h):
            for k in (0, 1):
                x = x0 + i + k
                if x >= x0 + w: continue
                if dy >= L: continue                       # past the tip: see-through, the notched edge
                c = WHITE if k == 0 else CREAM
                if dy < top_cover: c = CREAM2 if (dy + i // 2 + row_shift) % 2 else CREAM   # coverts
                if k == 1 and dy >= top_cover: c = SHAFT if dy % 3 == 0 else CREAM
                if dy == L - 1: c = GLOW
                elif dy == L - 2: c = GOLD
                put(x, y0 + dy, c)


def solid(x0, y0, w, h, cols):
    for y in range(h):
        for x in range(w):
            put(x0 + x, y0 + y, cols[(x + y) % len(cols)])


def box_uv(u, v, w, h, d, faces):
    """paint a Bedrock box-uv area: faces = dict of name -> painter(x0,y0,fw,fh)"""
    rects = {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h),
             "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}
    for n, (x, y, fw, fh) in rects.items():
        faces.get(n, faces.get("*"))(x, y, fw, fh)


def edge(x, y, fw, fh): solid(x, y, fw, fh, [CREAM, CREAM2])
def cloth(x, y, fw, fh): solid(x, y, fw, fh, [CLOTH, CLOTH, CLOTH2])
def brass(x, y, fw, fh): solid(x, y, fw, fh, [BRASS, BRASSD])

# feather panels: (name, size w,h, uv, lengths per 2-px feather)
PANELS = [("root", (8, 9), (0, 0), [6, 7, 8, 9]),
          ("mid", (10, 14), (0, 12), [11, 12, 13, 13, 14]),
          ("tip", (10, 20), (0, 30), [20, 19, 17, 15, 13])]
for name, (w, h), (u, v), lens in PANELS:
    box_uv(u, v, w, h, 1, {"north": lambda x, y, fw, fh, l=lens: feather_face(x, y, fw, fh, l),
                           "south": lambda x, y, fw, fh, l=lens: feather_face(x, y, fw, fh, l[::-1], row_shift=1),
                           "*": edge})
# wing bones: cloth-wrapped, a brass cap at the joint
for (u, v), (w, h, d) in (((24, 0), (8, 2, 2)), ((24, 6), (10, 2, 2)), ((24, 12), (10, 2, 2))):
    box_uv(u, v, w, h, d, {"*": cloth})
box_uv(48, 0, 3, 3, 2, {"*": brass})            # the mount on the back
# small hanging cloth ribbon under the root (the "cloth" in light and cloth)
box_uv(48, 8, 2, 6, 1, {"*": lambda x, y, fw, fh: solid(x, y, fw, fh, [CLOTH2, CLOTHD])})
W.save(os.path.join(OUT, "everwake_wings.png"))

# ---------------------------------------------------------------- the geometry (Bedrock, 64x64)
def wing(side):
    s = 1 if side == "left" else -1                  # Bedrock: +x is the model's left
    x0 = 2 * s                                       # mount just off the spine
    def ox(a, w): return a if s > 0 else -a - w      # mirror an x origin
    root, mid, tip = f"{side}_wing", f"{side}_wing_mid", f"{side}_wing_tip"
    m = s < 0
    return [
        {"name": root, "parent": "wings", "pivot": [x0, 21, 3.5],
         "cubes": [{"origin": [ox(x0 - 0.5 if s > 0 else 1.5, 3) if False else (x0 - 1.5 if s > 0 else -x0 - 1.5), 19.5, 3], "size": [3, 3, 2], "uv": [48, 0]},
                   {"origin": [ox(x0, 8), 20, 3.5], "size": [8, 2, 2], "uv": [24, 0], "mirror": m},
                   {"origin": [ox(x0, 8), 11, 4], "size": [8, 9, 1], "uv": [0, 0], "mirror": m},
                   {"origin": [ox(x0 + 3, 2), 14, 4.6], "size": [2, 6, 1], "uv": [48, 8], "mirror": m}]},
        {"name": mid, "parent": root, "pivot": [x0 + 8 * s, 21, 4.5],
         "cubes": [{"origin": [ox(x0 + 8 * s if s > 0 else 0, 10) if s > 0 else -(x0 + 8) - 10 + 0, 20, 3.5], "size": [10, 2, 2], "uv": [24, 6], "mirror": m},
                   {"origin": [ox(x0 + 8, 10) if s > 0 else -(x0 + 8) - 10, 6, 4], "size": [10, 14, 1], "uv": [0, 12], "mirror": m}]},
        {"name": tip, "parent": mid, "pivot": [x0 + 18 * s, 21, 4.5],
         "cubes": [{"origin": [x0 + 18 if s > 0 else -(x0 + 18) - 10, 20, 3.5], "size": [10, 2, 2], "uv": [24, 12], "mirror": m},
                   {"origin": [x0 + 18 if s > 0 else -(x0 + 18) - 10, 0, 4], "size": [10, 20, 1], "uv": [0, 30], "mirror": m}]},
    ]

# tidy the origins written above into plain numbers (the lambdas were only for mirroring)
def fix(b, side):
    s = 1 if side == "left" else -1; x0 = 2 * s
    if b["name"] == f"{side}_wing":
        b["cubes"][0]["origin"][0] = (x0 - 1.5) if s > 0 else (x0 - 1.5)
        b["cubes"][1]["origin"][0] = x0 if s > 0 else x0 - 8
        b["cubes"][2]["origin"][0] = x0 if s > 0 else x0 - 8
        b["cubes"][3]["origin"][0] = x0 + 3 if s > 0 else x0 - 5
    elif b["name"] == f"{side}_wing_mid":
        for c in b["cubes"]: c["origin"][0] = x0 + 8 if s > 0 else x0 - 18
    else:
        for c in b["cubes"]: c["origin"][0] = x0 + 18 if s > 0 else x0 - 28
    return b

bones = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
         {"name": "body", "parent": "waist", "pivot": [0, 24, 0]},
         {"name": "wings", "parent": "body", "pivot": [0, 21, 2]}]
for side in ("left", "right"):
    bones += [fix(b, side) for b in wing(side)]
GEO = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {
    "identifier": "geometry.siege.everwake_wings", "texture_width": 64, "texture_height": 64,
    "visible_bounds_width": 5, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]}, "bones": bones}]}
json.dump(GEO, open(os.path.join(OUT, "everwake_wings.geo.json"), "w"), indent=1)

# the 8x blow-up of the texture sheet, for review
W.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, "everwake_wings_x8.png"))
print("ok")
