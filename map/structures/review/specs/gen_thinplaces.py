"""Writes the building specs for the thin places (the seven Rift sites), on the skill, region by region.

Placed on the shaped land by the Rift thread's gen_places.py (/mnt/project-files/rift/viewer-src), which reads
these JSON files. Every spec's frame: ground at y 0, the building drawn from (0, 0, 0); gen_places sets it on the
highest block of its footprint with a stone foundation down to the ground.

Frostmarch (regions/frostmarch.md):
  thin_bellfounders_headframe   a timber pit headframe over the old shaft: tapering legs, girts, a deck, the
                                rope wheel on its own posts, back-stays raking down towards the winding house
  thin_bellfounders_winding     the winding house the rope runs into, a drum inside
  thin_bellfounders_bellstore   the bell store by the casting pit, a cast bell hung in its open shed
  thin_frostvein_shelter        the A-frame gorge shelter with its fire ring, the camp in the pass
"""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
SHINGLE = {"ladder": ["dark_oak_planks", "spruce_planks"], "axis": "noise", "scale": 2}
ROOF = {"type": "gable", "pitch": 2, "gable_horns": True, "snow": True}


def hsh(a, b, c):
    n = (a * 374761393 + b * 668265263 + c * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 4294967296


def save(spec):
    json.dump(spec, open(os.path.join(HERE, spec["name"] + ".json"), "w"), indent=1)


# ---------------- the headframe (Mateo 2026-11-12 asked what the first one was: it has to read as a pit headframe).
# A real timber headframe: a tapering tower of four legs over the shaft, tied by girts at every stage, a deck at the
# top, the rope wheel (sheave) on its own posts above the deck, and two back-stays raking down towards the winding
# house (-x) to take the pull of the rope. The shaft is 3 x 3 at x 0..2, z 0..2, with a stone collar and a rail.
hf = []
def P(x, y, z, b, **p): hf.append([x, y, z, b, p] if p else [x, y, z, b])
for x in range(-1, 4):                                    # the collar: a deepslate kerb, a fence rail, a gap to load at
    for z in range(-1, 4):
        edge = x in (-1, 3) or z in (-1, 3)
        P(x, 0, z, "cobbled_deepslate" if edge else "air")
for x in range(0, 3):
    for z in (-1, 3): P(x, 1, z, "spruce_fence")
for y in range(-16, 0):                                   # the shaft, lined in stone
    for x in range(0, 3):
        for z in range(0, 3): P(x, y, z, "air")
    for x in range(-1, 4):
        for z in (-1, 3): P(x, y, z, "stone_bricks" if (x + y) % 3 else "cobbled_deepslate")
    for z in range(0, 3):
        for x in (-1, 3): P(x, y, z, "stone_bricks" if (z + y) % 3 else "cobbled_deepslate")
LEG = [(1, 4, -2, 4), (5, 8, -1, 3), (9, 10, 0, 2)]       # (y from, y to, x of the west leg, x of the east leg): the taper
for zp in (-2, 4):                                        # the two leg frames, in front of and behind the shaft
    for y0, y1, xa, xb in LEG:
        for y in range(y0, y1 + 1):
            P(xa, y, zp, "dark_oak_log", axis="y"); P(xb, y, zp, "dark_oak_log", axis="y")
    for y, (xa, xb) in ((4, (-2, 4)), (8, (-1, 3)), (10, (0, 2))):   # girts at every step of the taper
        for x in range(xa, xb + 1): P(x, y, zp, "stripped_dark_oak_log", axis="x")
    for y, xa, xb in ((2, -1, 3), (6, 0, 2)):            # cross braces between the girts
        P(xa, y, zp, "dark_oak_fence"); P(xb, y, zp, "dark_oak_fence")
for z in range(-2, 5):                                    # beams across the top, the deck on them
    P(0, 10, z, "stripped_dark_oak_log", axis="z"); P(2, 10, z, "stripped_dark_oak_log", axis="z")
    P(1, 10, z, "dark_oak_slab", half="top")
for z in range(-2, 5):                                    # a rail round the deck
    for x in (-1, 3): P(x, 11, z, "dark_oak_fence")
for zp in (-1, 3):                                        # the sheave posts carrying the hub
    for y in (11, 12, 13, 14): P(1, y, zp, "dark_oak_log", axis="y")
    P(1, 15, zp, "dark_oak_slab", half="bottom")
CY = 14                                                    # the rope wheel (sheave): a plank rim, fence spokes, a log hub
for y in range(CY - 3, CY + 4):
    for x in range(-2, 5):
        d2 = (x - 1) ** 2 + (y - CY) ** 2
        if 6 <= d2 <= 10: P(x, y, 1, "spruce_planks")
        elif (x == 1 or y == CY) and 0 < d2 < 6: P(x, y, 1, "dark_oak_fence")
for z in (0, 1, 2): P(1, CY, z, "dark_oak_log", axis="z")
for i in range(1, 10):                                    # back-stays raking down to the west, struts between them
    for zp in (-2, 4): P(-i, 10 - i, zp, "dark_oak_log", axis="x")
    if i % 3 == 0:
        for z in range(-1, 4): P(-i, 10 - i, z, "dark_oak_fence")
for zp in (-2, 4): P(-9, 0, zp, "cobbled_deepslate")      # the back-stays' footings
for y in range(-9, 10): P(1, y, 1, "iron_chain", axis="y")   # the rope down the shaft and the bucket at its end
P(1, -10, 1, "barrel", facing="up")
P(1, 9, -2, "lantern", hanging=True); P(1, 9, 4, "lantern", hanging=True)
for i in range(1, 13):                                    # the rope from the top of the wheel to the winding house
    P(-2 - i, 15 - (i * 9) // 15, 1, "iron_chain", axis="x")
for k in range(20):                                       # spoil round the collar, on the side away from the house
    a = hsh(k, 1, 301) * math.pi * 1.6 - math.pi * 0.8; r = 4 + hsh(k, 2, 301) * 3
    x, z = round(1 + math.cos(a) * r), round(1 + math.sin(a) * r)
    if x < 4 and -3 <= z <= 5: continue
    P(x, 1, z, "gravel" if hsh(k, 3, 301) < 0.6 else "cobbled_deepslate")
    if r < 5.5 and hsh(k, 4, 301) < 0.5: P(x, 2, z, "gravel")
for x in range(4, 9): P(x, 1, 1, "rail", shape="east_west")   # the tub rail from the collar out to the tip
P(4, 1, 0, "barrel", facing="up")
save({"name": "thin_bellfounders_headframe", "ground_y": 0,
      "card": {"title": "Bellfounders' Mine headframe", "sub": "Norse timber", "region": "frostmarch", "where": "Bellfounders' Mine (thin place)", "kind": "Landmark",
               "blurb": "A timber pit headframe over the old shaft: four tapering legs tied by girts, a deck with the rope wheel on its own posts, back-stays raking down towards the winding house, a stone collar and a tub rail out to the spoil. Built on the skill."},
      "parts": [], "place": hf})

# ---------------- the winding house: the rope comes in through its east gable to a drum
save({"name": "thin_bellfounders_winding",
      "card": {"title": "Bellfounders' Mine winding house", "sub": "Norse timber and stone", "region": "frostmarch", "where": "Bellfounders' Mine (thin place)", "kind": "Landmark",
               "blurb": "A stone and plank winding house under a steep shingle roof with dragon heads; the headframe's rope runs in through the gable to the winding drum. Built on the skill."},
      "parts": [{"part": "house", "style": {"base": "frost_timber", "roof": SHINGLE}, "rect": [0, 0, 6, 8], "plinth": 2, "storeys": [5],
                 "storey_style": [{"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}}],
                 "door": {"side": "s", "kind": "large", "steps": 1}, "windows": {"n": [{"at": 0, "storey": 0}], "w": [{"at": 0, "storey": 0}], "e": [], "s": []},
                 "shutters": 0, "roof": dict(ROOF, ridge="x"), "chimney": [[1, 6]], "vines": 0, "interior": "storage"},
                {"part": "woodpile", "at": [-1, 1, 2], "len": 3, "h": 2, "facing": "w", "wood": "spruce"}],
      "place": [[x, 4, 4, "stripped_spruce_log", {"axis": "x"}] for x in range(1, 6)] + [[x, 4, z, "spruce_fence"] for x in (1, 5) for z in (3, 5)]
               + [[x, y, 4, "dark_oak_fence"] for x in (1, 5) for y in (2, 3)] + [[6, 6, 4, "air"], [7, 7, 4, "iron_chain", {"axis": "x"}]]})

# ---------------- the bell store, by the casting pit: a cast bell hangs in its open shed
store_pl = []
for z in (3, 5):
    for y in (1, 2, 3): store_pl.append([11, y, z, "dark_oak_log", {"axis": "y"}])
for z in (3, 4, 5): store_pl.append([11, 4, z, "stripped_dark_oak_log", {"axis": "z"}])
store_pl.append([11, 3, 4, "bell", {"attachment": "hanging", "facing": "e"}])
store_pl += [[9, 1, 2, "barrel", {"facing": "up"}], [9, 1, 6, "smithing_table"], [12, 1, 7, "anvil", {"facing": "n"}]]
save({"name": "thin_bellfounders_bellstore",
      "card": {"title": "Bellfounders' bell store", "sub": "Norse timber and stone", "region": "frostmarch", "where": "Bellfounders' Mine (thin place)", "kind": "Landmark",
               "blurb": "A two-storey store on a dark stone ground floor, steep shingle and dragon heads; in the open shed beside it a newly cast bell hangs from a timber frame, ready to go up. Built on the skill."},
      "parts": [{"part": "house", "style": {"base": "frost_timber", "roof": SHINGLE}, "rect": [0, 0, 6, 8], "plinth": 2, "storeys": [5, 4],
                 "storey_style": [{"frame_kind": "stone", "frame": "deepslate_bricks", "infill": {"ladder": "FRO-01", "axis": "y"}}, {}],
                 "door": {"side": "n", "kind": "large", "steps": 1},
                 "windows": {"w": [{"at": -2, "storey": 1}, {"at": 2, "storey": 1}], "s": [{"at": 0, "storey": 0}, {"at": 0, "storey": 1}], "n": [{"at": 0, "storey": 1}], "e": []},
                 "shutters": 0, "roof": dict(ROOF, ridge="z"), "chimney": [[1, 6]], "vines": 0, "interior": "storage"},
                {"part": "lean_to", "rect": [7, 1, 12, 7], "against": "w", "top": 7, "pitch": "half", "y": 0, "roof": SHINGLE,
                 "post": "dark_oak_log", "trim": "dark_oak_planks", "floor": "cobbled_deepslate"}],
      "place": store_pl})

# ---------------- Frostvein Gap: the A-frame gorge shelter and the camp in the pass
camp = [[x, 0, z, "cobbled_deepslate"] for x, z in ((9, 2), (9, 4), (10, 1), (10, 5), (11, 2), (11, 4), (12, 3), (8, 3))]
camp += [[10, 1, 3, "campfire"], [10, 0, 3, "cobbled_deepslate"]]
camp += [[8, 1, 0, "spruce_log", {"axis": "z"}], [12, 1, 6, "spruce_log", {"axis": "x"}], [13, 1, 6, "spruce_log", {"axis": "x"}]]
save({"name": "thin_frostvein_shelter",
      "card": {"title": "Frostvein Gap shelter", "sub": "Norse timber", "region": "frostmarch", "where": "Frostvein Gap (thin place)", "kind": "Landmark",
               "blurb": "An A-frame shelter in the gorge, its steep shingle roof nearly to the ground with dragon heads and snow on the ridge, a woodpile along the side and a fire ring with log seats in front. Built on the skill."},
      "parts": [{"part": "house", "style": {"base": "frost_timber", "roof": SHINGLE}, "rect": [0, 0, 6, 6], "plinth": 2, "storeys": [3],
                 "door": {"side": "e", "kind": "house", "steps": 1}, "windows": {"w": [{"at": 0, "storey": 0}], "n": [], "s": [], "e": []}, "shutters": 0,
                 "roof": dict(ROOF, ridge="x"), "chimney": [[1, 3]], "bushes": False, "vines": 0, "interior": "home"},
                {"part": "woodpile", "at": [1, 1, 7], "len": 4, "h": 2, "facing": "s", "wood": "spruce"}],
      "place": camp})
print("wrote thin_bellfounders_headframe/winding/bellstore, thin_frostvein_shelter")
