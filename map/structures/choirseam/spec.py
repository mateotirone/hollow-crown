"""Choir Seam specs (the Choir Ore mine, the fourth material-loop machine) for the minecraft-builder skill: three levels,
each drawn over the last, in the Hollow's look (skill regions/hollow.md: dark oak frames with pale ash, veinstone
and blackstone, steep deepslate roofs that sit one block off true, froglight windows where people live, soul light
everywhere else, no sky, no snow, no Crown colours).

Choir Ore only exists in the Hollow, so the Choir Seam is staked on a cliff seam there, not on an overworld plot.
There are no trains below, so the ore leaves by the light river: the seam's jetty loads a barge that runs to the
arrival landing (Mateo 2026-11-12: "we have to figure out a mine for Choirstone").

  1 Seam Cut (any rank, with the ruler's permit)  a timbered adit into the cliff, a cart rail to the ore store,
                                                  a jetty on the light river where the ore barge ties up
  2 Choir Winch                                   a stone winch house over a second, deeper shaft; a loading derrick
  3 Singing Gallery                               a veinstone pit-head tower against the cliff over the adit; the
                                                  store becomes a strongroom; a bigger barge

Skill frame: x east, y up, z south; the front (jetty) faces south. The plot is 25 x 15 (x -12..12, z -15..-1),
the cliff fills its north edge, the light river runs along the south. Ground not built on yet carries Veilcaps,
Veilmoss and a giant Veilcap until it is used (Mateo 2026-11-12).

Usage: python3 spec.py OUTDIR [--ground] [--skill SKILL_DIR]
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from machine_regions import _hash, noise  # noqa: E402

SKILL = os.path.join(HERE, "..", "..", "..", ".claude", "skills", "minecraft-builder")
PLOT = (-12, -15, 12, -1)
CLIFF_Z = -11                 # the cliff face (first rock row), rock behind it to the north edge
ADIT_X = 0                    # the adit's centre
STORE = (-11, -9, -7, -3)     # ore store 5 x 7 (levels 1-2), strongroom 7 x 7 at level 3
STRONG = (-11, -9, -5, -3)
WINCH = (4, -10, 10, -4)      # winch house 7 x 7 (levels 2-3)
TOWER = (-2, -10, 2, -6)      # pit-head tower 5 x 5 at the cliff foot (level 3)
RIVER = (1, 3)                # z rows of the light river, south of the plot
JETTY = (-3, 0, 3, 2)         # the landing stage over the river
STAGES = ["Seam Cut", "Choir Winch", "Singing Gallery"]

STONE = {"base": "hollow_timber", "frame_kind": "stone", "frame": "polished_blackstone_bricks", "infill": "siege:veinstone_bricks",
         "quoin": "polished_blackstone"}
HOMELIKE = {"base": "hollow_timber", "glass": "ochre_froglight"}


def inside(x, z, r, pad=0):
    return r[0] - pad <= x <= r[2] + pad and r[1] - pad <= z <= r[3] + pad


# ---------- land ----------

def cliff_height(x, z):
    """The rock rises from the cliff face to the north edge: 9 to 14 high, with buttresses and notches"""
    d = CLIFF_Z - z                                       # 0 at the face
    base = 9 + round(noise(x, 0, 21, 3.5) * 5)
    return max(1, base + min(d, 2))


def cliff(place, lv):
    x0, z0, x1, z1 = PLOT
    for x in range(x0 - 3, x1 + 4):
        for z in range(z0 - 3, CLIFF_Z + 1):
            face = z == CLIFF_Z or (z == CLIFF_Z - 1 and noise(x, z, 4, 2) < 0.35)
            if z == CLIFF_Z and noise(x, z, 4, 2) < 0.35: continue                 # the face steps in and out
            h = cliff_height(x, z)
            for y in range(1, h + 1):
                k = _hash(x, y * 13 + z, 7)
                b = "siege:veinstone" if k < 0.3 else "deepslate" if k < 0.62 else "tuff" if k < 0.8 else "cobbled_deepslate" if k < 0.92 else "basalt"
                if face and 3 <= y <= h - 2 and _hash(x, y, 33) < 0.07: b = "siege:choir_ore"    # the seam shows in the face
                place.append([x, y, z, b])
            top = h + 1
            k = _hash(x, z, 8)
            place.append([x, top, z, "siege:undertow_moss" if k < 0.6 else "siege:undertow_moss_deep"])
            if face and _hash(x, z, 9) < 0.35:                                    # Veilmoss strands over the edge
                for y in range(h, h - 1 - int(_hash(x, z, 10) * 4), -1): place.append([x, y, z + 1, "siege:veilmoss_strands"])
            if k > 0.93: place.append([x, top + 1, z, "siege:veilcap"])


def ground(place, keep):
    """Mixed Hollow ground: Veilmoss, Deep Veilmoss, dark stone, pale ash, coarse dirt; a slab road to the jetty"""
    x0, z0, x1, z1 = PLOT
    for x in range(x0, x1 + 1):
        for z in range(CLIFF_Z + 1, z1 + 1):
            road = abs(x) <= 1 or (z == -2 and -8 <= x <= 7)
            if road:
                k = _hash(x, z, 5)
                place.append([x, 0, z, "cobbled_deepslate_slab" if k < 0.6 else "polished_blackstone_brick_slab" if k < 0.85 else "tuff_slab"])
                continue
            n = noise(x, z, 1, 2.5)
            b = "siege:undertow_moss" if n < 0.35 else "siege:undertow_moss_deep" if n < 0.55 else "siege:pale_ash" if n < 0.7 else \
                "coarse_dirt" if n < 0.85 else "cobbled_deepslate"
            place.append([x, 0, z, b])


def river(place):
    """The light river: water over a glowing Glimmerflow bed, dark stone banks"""
    x0, _, x1, _ = PLOT
    for x in range(x0 - 3, x1 + 4):
        for z in range(RIVER[0], RIVER[1] + 1):
            place += [[x, -2, z, "siege:glimmerflow"], [x, -1, z, "water"], [x, 0, z, "water"]]
        place += [[x, 0, 0, "polished_blackstone_bricks" if abs(x) <= 4 else "cobbled_deepslate"], [x, 0, RIVER[1] + 1, "cobbled_deepslate"]]


def wall(place):
    """Low cobbled deepslate walls east and west from the cliff to the river, posts with soul lanterns"""
    for x in (PLOT[0], PLOT[2]):
        for z in range(CLIFF_Z + 1, 1):
            post = z in (CLIFF_Z + 1, -5, 0)
            place.append([x, 1, z, "cobbled_deepslate" if post or _hash(x, z, 3) < 0.7 else "siege:veinstone"])
            place.append([x, 2, z, "polished_blackstone_brick_wall" if post else "cobbled_deepslate_wall"])
            if post: place.append([x, 3, z, "soul_lantern"])


def jetty(place, barge=1):
    """The landing stage on dark oak piles, mooring posts with soul lanterns, and the ore barge tied alongside"""
    x0, z0, x1, z1 = JETTY
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            place.append([x, 0, z, "dark_oak_planks"])
            if x in (x0, x1) and z in (z0 + 1, z1): place += [[x, -1, z, "dark_oak_log"], [x, -2, z, "dark_oak_log"]]
    for x in (x0, x1): place += [[x, 1, z1, "dark_oak_fence"], [x, 2, z1, "soul_lantern"]]
    # the barge: a flat hull of dark oak slabs and trapdoor sides lying east of the jetty, ore barrels aboard
    L = 7 if barge == 1 else 11
    bx0 = x1 + 1
    for x in range(bx0, bx0 + L):
        for z in (1, 2, 3):
            edge = x in (bx0, bx0 + L - 1) or z in (1, 3)
            place.append([x, 0, z, "dark_oak_slab", {"half": "top"}] if not edge else [x, 0, z, "dark_oak_planks"])
            if edge: place.append([x, 1, z, "dark_oak_trapdoor", {"facing": "s" if z == 3 else "n" if z == 1 else ("e" if x > bx0 else "w"), "open": True}])
    for x in range(bx0 + 1, bx0 + L - 1, 2): place.append([x, 1, 2, "barrel"])
    place += [[bx0 + L // 2, 1, 2, "dark_oak_fence"], [bx0 + L // 2, 2, 2, "dark_oak_fence"], [bx0 + L // 2, 3, 2, "soul_lantern"]]


def adit(place):
    """A 3 wide, 3 high timbered tunnel into the cliff face: dark oak posts and caps, a lintel, soul lanterns;
    the cart rail runs out of it and round to the store"""
    for z in range(CLIFF_Z - 6, CLIFF_Z + 1):
        for x in (ADIT_X - 1, ADIT_X, ADIT_X + 1):
            for y in (1, 2, 3): place.append([x, y, z, "air"])
            place.append([x, 0, z, "cobbled_deepslate"])
        if (CLIFF_Z - z) % 3 == 0:                               # a timber set every 3 blocks
            place += [[ADIT_X - 1, 1, z, "dark_oak_fence"], [ADIT_X - 1, 2, z, "dark_oak_fence"], [ADIT_X + 1, 1, z, "dark_oak_fence"],
                      [ADIT_X + 1, 2, z, "dark_oak_fence"]] + [[x, 3, z, "dark_oak_log", {"axis": "x"}] for x in (ADIT_X - 1, ADIT_X, ADIT_X + 1)]
    # the portal: a heavy frame proud of the face
    z = CLIFF_Z + 1
    for y in (1, 2, 3): place += [[ADIT_X - 2, y, z, "dark_oak_log"], [ADIT_X + 2, y, z, "dark_oak_log"]]
    for x in range(ADIT_X - 2, ADIT_X + 3): place.append([x, 4, z, "dark_oak_log", {"axis": "x"}])
    place += [[ADIT_X - 1, 3, z, "dark_oak_stairs", {"facing": "w", "half": "top"}], [ADIT_X + 1, 3, z, "dark_oak_stairs", {"facing": "e", "half": "top"}],
              [ADIT_X - 2, 5, z, "soul_lantern"], [ADIT_X + 2, 5, z, "soul_lantern"], [ADIT_X, 2, CLIFF_Z - 6, "siege:choir_ore"],
              [ADIT_X - 1, 2, CLIFF_Z - 6, "siege:choir_ore"], [ADIT_X + 1, 1, CLIFF_Z - 6, "siege:choir_ore"]]
    for z in range(CLIFF_Z - 5, -2): place.append([ADIT_X, 1, z, "rail"])


def spoil(place, box):
    x0, z0, x1, z1 = box
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            h = 3 - round(abs(x - cx) * 1.0 + abs(z - cz) * 1.2 + noise(x, z, 8, 1.5))
            for y in range(1, max(1, h) + 1):
                k = _hash(x, y * 7 + z, 11)
                place.append([x, y, z, "siege:veinstone" if k < 0.4 else "tuff" if k < 0.7 else "gravel"])


def giant_veilcap(place, x, z, h=7):
    """A glowing giant Veilcap: a pale stem and a wide pink cap with a lip"""
    for y in range(1, h + 1): place.append([x, y, z, "siege:veilcap_stem"])
    for dx in range(-3, 4):
        for dz in range(-3, 4):
            d = math.hypot(dx, dz)
            if d <= 3.2: place.append([x + dx, h + 1, z + dz, "siege:veilcap_cap"])
            if 2.6 <= d <= 3.6: place.append([x + dx, h, z + dz, "siege:veilcap_cap"])
            if d <= 1.6: place.append([x + dx, h + 2, z + dz, "siege:veilcap_cap"])


def scrub(place, box, seed, caps=()):
    """Hollow ground cover on ground not built on yet: Veilcaps, glimbulbs, amethyst, a boulder, giant Veilcaps"""
    x0, z0, x1, z1 = box
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if any(abs(x - cx) <= 1 and abs(z - cz) <= 1 for cx, cz, _ in caps): continue
            k = _hash(x, z, seed)
            if k < 0.12: place.append([x, 1, z, "siege:veilcap"])
            elif k < 0.18: place.append([x, 1, z, "siege:glimbulb"])
            elif k < 0.21: place.append([x, 1, z, "small_amethyst_bud"])
            elif k < 0.24: place.append([x, 1, z, "siege:veinstone"])
    for c in caps: giant_veilcap(place, *c)


def store():
    return {"part": "house", "style": HOMELIKE, "rect": list(STORE), "y": 1, "plinth": 1, "storeys": [5], "door": {"side": "e"},
            "roof": {"type": "gable", "pitch": 2, "ridge": "z"}, "offset": {"roof": True, "dir": "w"}, "chimney": [[-9, -8]],
            "shutters": 0.25, "bushes": False}


def strongroom():
    win = {"s": [{"at": 0, "storey": 0, "w": 1, "h": 2}], "w": [{"at": 0, "storey": 0, "w": 1, "h": 2}]}
    return {"part": "house", "style": STONE, "rect": list(STRONG), "y": 1, "plinth": 1, "storeys": [5], "door": {"side": "e", "kind": "large"},
            "windows": win, "roof": {"type": "gable", "pitch": 2, "ridge": "z"}, "chimney": False, "shutters": 0, "bushes": False}


def winch_house():
    return {"part": "house", "style": STONE, "rect": list(WINCH), "y": 1, "plinth": 1, "storeys": [5, 4], "door": {"side": "s", "kind": "large"},
            "roof": {"type": "gable", "pitch": 2, "ridge": "x"}, "offset": {"storey": 1, "dir": "e"}, "chimney": [[9, -8]], "shutters": 0,
            "bushes": False}


def tower():
    win = {s: [{"at": 0, "storey": k, "w": 1, "h": 2} for k in (1, 2)] for s in "esw"}
    return {"part": "house", "style": STONE, "rect": list(TOWER), "y": 1, "plinth": 1, "storeys": [5, 5, 4], "door": {"side": "s", "kind": "large"},
            "windows": win, "roof": {"type": "hip", "pitch": 2}, "chimney": False, "shutters": 0, "bushes": False, "name": "pit_head"}


def derrick(place):
    """Level 2: a loading derrick on the jetty: a mast, a jib out over the barge, a chain and a hanging barrel"""
    x, z = JETTY[2], JETTY[1]
    for y in range(1, 8): place.append([x, y, z, "dark_oak_log"])
    for k in range(1, 5): place.append([x + k, 7, z, "dark_oak_log", {"axis": "x"}])
    place += [[x + 1, 6, z, "dark_oak_stairs", {"facing": "w", "half": "top"}]]
    for y in range(3, 7): place.append([x + 4, y, z + 1 if False else z, "iron_chain"])
    place.append([x + 4, 2, z, "barrel"])


def level(lv):
    parts, place = [], []
    clear = [STORE if lv < 3 else STRONG, WINCH, TOWER, (STORE[0] - 1, STORE[1] - 1, STRONG[2] + 1, STORE[3] + 1),
             (WINCH[0] - 1, WINCH[1] - 1, WINCH[2] + 1, WINCH[3] + 1)]
    cliff(place, lv)
    ground(place, clear)
    river(place)
    wall(place)
    adit(place)
    jetty(place, 1 if lv < 3 else 2)
    spoil(place, (-5, -10, -3, -8))
    if lv < 3:
        parts.append(store())
        place += [[-6, 1, -4, "barrel"], [-6, 1, -8, "siege:glimbulb"]]
        scrub(place, (-6, -10, -5, -3), 51)
    if lv == 1:
        scrub(place, (WINCH[0] - 1, WINCH[1], WINCH[2] + 1, WINCH[3] + 1), 53, caps=[(7, -7, 7)])
    if lv >= 2:
        parts.append(winch_house())
        derrick(place)
        for x in range(2, WINCH[0]): place.append([x, 1, -3, "rail"])
        place += [[3, 1, -4, "barrel"], [11, 1, -3, "siege:glimbulb"]]
    if lv == 3:
        parts += [strongroom(), tower()]
        place += [[-4, 1, -4, "barrel"], [-4, 2, -4, "barrel"]]
    return parts, place


def specs(ground_plate=False, skill=SKILL, regions=None):
    out = {}
    for lv in (1, 2, 3):
        parts, place = level(lv)
        shapes = []
        if ground_plate:
            x0, z0, x1, z1 = PLOT
            shapes = [{"shape": "box", "min": [x0 - 3, -6, z0 - 3], "max": [x1 + 3, -1, RIVER[1] + 2], "material": "deepslate"},
                      {"shape": "box", "min": [x0 - 3, 0, CLIFF_Z], "max": [x1 + 3, 0, RIVER[1] + 2], "material": "cobbled_deepslate"}]
        name = f"choirseam_hollow_{lv}"
        out[name] = {"name": name, "edition": "bedrock", "shapes": shapes, "parts": parts, "place": place}
    return out


def names():
    return {f"choirseam_hollow_{lv}": {"title": f"Choir Seam {lv}: {s}", "sub": "The Hollow"} for lv, s in enumerate(STAGES, 1)}


if __name__ == "__main__":
    a = sys.argv[1:]
    skill = a[a.index("--skill") + 1] if "--skill" in a else SKILL
    for name, spec in specs("--ground" in a, skill).items():
        json.dump(spec, open(os.path.join(a[0], name + ".json"), "w"))
    print("ok")
