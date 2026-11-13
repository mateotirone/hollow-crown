"""Regional themes for the material-loop machines (Ironworks, Gold Sluice, Deep Shaft). Every machine can be built
in any region, so each one comes in every region's look (Mateo 2026-11-12: "what if these buildings are in
different themes?"). The layout and stages stay the same; the buildings take the region's skill presets and
roofs, and the yard, fences, ground, plants and trees take the region's blocks. Sources: the skill's
regions/<region>.md pages and build-instructions/palettes/<region>.md.

A spec asks for a theme with theme(region) and uses its keys:
  timber, stone        house styles (skill presets) for timber and stone buildings
  roof(ridge)          the region's roof dict for a house part ({} keys merged into the part: house_extra)
  wood, log            trim wood prefix (fence, trapdoor, slab, stairs, planks) and the structural log
  stone_*              full stone, brick, wall, slab, stairs for curbs, dykes and channels
  ground(x, z, n, k)   a ground block; yard(...) worked earth; path(...) a path block
  green(place, box, seed, trees)   plants and trees on ground not built on yet
  tree(place, x, z, h) one of the region's trees; plate (under, top) for pictures; snow (Frostmarch)
"""
import math


def _hash(x, z, k):
    h = (x * 374761393 + z * 668265263 + k * 2147483647) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return (h & 0xffff) / 65535


def noise(x, z, k, s=3.0):
    fx, fz = x / s, z / s
    x0, z0 = math.floor(fx), math.floor(fz)
    tx, tz = fx - x0, fz - z0
    tx, tz = tx * tx * (3 - 2 * tx), tz * tz * (3 - 2 * tz)
    a, b, c, d = _hash(x0, z0, k), _hash(x0 + 1, z0, k), _hash(x0, z0 + 1, k), _hash(x0 + 1, z0 + 1, k)
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz


ORDER = ["vale", "frostmarch", "saltreach", "blackfen", "emberwaste"]
NAMES = {"vale": "Aldmere Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "blackfen": "Blackfen", "emberwaste": "Emberwaste"}


# ---------- trees ----------

def broadleaf(place, x, z, h, kind="oak"):
    """English oak or birch: trunk, two wide leaf layers, a narrow cap"""
    for y in range(1, h + 1): place.append([x, y, z, f"{kind}_log"])
    for y, r in ((h - 1, 2), (h, 2), (h + 1, 1), (h + 2, 0)):
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                if (dx, dz) == (0, 0) and y <= h: continue
                if r == 2 and abs(dx) == 2 and abs(dz) == 2: continue
                place.append([x + dx, y, z + dz, f"{kind}_leaves"])


def spruce(place, x, z, h):
    """Norway spruce: a spire top, alternating wide and narrow tiers, snow on the tip"""
    for y in range(1, h + 1): place.append([x, y, z, "spruce_log"])
    place += [[x, h + 1, z, "spruce_leaves"], [x, h + 2, z, "spruce_leaves"]]
    for y in range(3, h + 1):
        r = 1 if (h - y) % 2 == 0 or y > h - 2 else 2
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                if dx == dz == 0: continue
                if abs(dx) == abs(dz) == r and (r == 2 or _hash(x + dx, z + dz + y, 3) < 0.5): continue
                place.append([x + dx, y, z + dz, "spruce_leaves"])


def cypress(place, x, z, h):
    """Italian cypress, wind-sheared: a narrow dark column"""
    for y in range(1, h): place.append([x, y, z, "spruce_log"])
    for y in range(2, h + 2):
        place.append([x, y, z, "spruce_leaves"]) if y >= h else None
        if y <= h:
            for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if y < h or _hash(x + dx, z + dz, y) < 0.5: place.append([x + dx, y, z + dz, "spruce_leaves"])


def fen_tree(place, x, z, h):
    """Bald cypress / black alder: a mangrove trunk on roots, a low flat crown, hanging vines of moss"""
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)): place.append([x + dx, 1, z + dz, "mangrove_roots"])
    for y in range(1, h + 1): place.append([x, y, z, "mangrove_log"])
    for y, r in ((h, 2), (h + 1, 1)):
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                if (dx, dz) == (0, 0) and y <= h: continue
                if r == 2 and abs(dx) == 2 and abs(dz) == 2: continue
                place.append([x + dx, y, z + dz, "mangrove_leaves"])
    for dx, dz in ((2, 1), (-2, -1), (1, -2)): place.append([x + dx, h - 1, z + dz, "vine"])


def palm(place, x, z, h):
    """Date palm: a leaning trunk and drooping fronds"""
    for y in range(1, h + 1): place.append([x + (1 if y > h - 2 and h > 5 else 0), y, z, "jungle_log"])
    tx = x + (1 if h > 5 else 0)
    place.append([tx, h + 1, z, "jungle_leaves"])
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        place += [[tx + dx, h + 1, z + dz, "jungle_leaves"], [tx + 2 * dx, h, z + 2 * dz, "jungle_leaves"], [tx + 3 * dx, h - 1, z + 3 * dz, "jungle_leaves"]]
    for dx, dz in ((1, 1), (-1, 1), (1, -1), (-1, -1)): place.append([tx + dx, h, z + dz, "jungle_leaves"])


# ---------- plants ----------

def _plants(region):
    """(threshold, [blocks...]) runs by hash: the region's ground cover"""
    return {
        "vale": [(0.10, ["short_grass"]), (0.16, ["fern"]), (0.22, ["poppy", "dandelion", "cornflower", "oxeye_daisy"]), (0.27, ["azalea_leaves", "azalea_leaves_flowered"])],
        "frostmarch": [(0.12, ["fern"]), (0.20, ["bush"]), (0.23, ["boulder"]), (0.25, ["mossy_cobblestone"])],
        "saltreach": [(0.08, ["short_grass"]), (0.13, ["azalea_leaves", "azalea_leaves_flowered"]), (0.16, ["boulder"]), (0.19, ["bush"])],
        "blackfen": [(0.12, ["fern"]), (0.22, ["moss_carpet"]), (0.27, ["short_grass"]), (0.31, ["mangrove_leaves"])],
        "emberwaste": [(0.07, ["deadbush"]), (0.10, ["cactus"]), (0.13, ["boulder"])],
    }[region]


THEMES = {
    "vale": dict(
        timber="vale_timber", stone="vale_stone", roof={"type": "gable", "pitch": 1}, house_extra={},
        wood="spruce", log="stripped_spruce_log", tree=lambda p, x, z, h: broadleaf(p, x, z, h, "oak"),
        stone_full="cobblestone", stone_brick="stone_bricks", stone_accent="mossy_stone_bricks", stone_wall="stone_brick_wall",
        stone_slab="stone_brick_slab", stone_stairs="stone_brick_stairs", boulder="mossy_cobblestone",
        grounds=[(0.75, "grass_block"), (0.9, "coarse_dirt"), (1, "grass_block")],
        yards=[(0.3, "packed_mud"), (0.78, "coarse_dirt"), (1, "gravel")], paths=[(0.62, "gravel"), (1, "cobblestone")],
        plate=("dirt", "grass_block"), snow=False, water=True, fence_post=None),
    "frostmarch": dict(
        timber="frost_timber", stone="frost_stone", roof={"type": "gable", "pitch": 2, "gable_horns": True}, house_extra={},
        wood="spruce", log="dark_oak_log", tree=spruce,
        stone_full="cobbled_deepslate", stone_brick="deepslate_bricks", stone_accent="polished_deepslate", stone_wall="cobbled_deepslate_wall",
        stone_slab="cobbled_deepslate_slab", stone_stairs="cobbled_deepslate_stairs", boulder="cobbled_deepslate",
        grounds=[(0.18, "gravel"), (0.86, "grass_block"), (1, "podzol")],
        yards=[(0.35, "gravel"), (0.8, "coarse_dirt"), (1, "packed_mud")], paths=[(0.6, "cobbled_deepslate_slab"), (0.85, "stone_brick_slab"), (1, "andesite_slab")],
        plate=("stone", "snow"), snow=True, water=True),
    "saltreach": dict(
        timber="salt_timber", stone="salt_stone", roof={"type": "hip"}, house_extra={},
        wood="birch", log="stripped_birch_log", tree=cypress,
        stone_full="cobblestone", stone_brick="stone_bricks", stone_accent="smooth_sandstone", stone_wall="stone_brick_wall",
        stone_slab="smooth_sandstone_slab", stone_stairs="stone_brick_stairs", boulder="andesite",
        grounds=[(0.25, "gravel"), (0.55, "coarse_dirt"), (0.8, "grass_block"), (1, "sand")],
        yards=[(0.4, "gravel"), (0.8, "coarse_dirt"), (1, "sand")], paths=[(0.6, "gravel"), (1, "smooth_sandstone")],
        plate=("sandstone", "gravel"), snow=False, water=True),
    "blackfen": dict(
        timber="fen_timber", stone={"base": "fen_timber", "frame_kind": "flush"}, roof={"type": "gable", "pitch": 1, "moss": True},
        house_extra={"piles": True},
        wood="mangrove", log="mangrove_log", tree=fen_tree,
        stone_full="packed_mud", stone_brick="mud_bricks", stone_accent="tuff_bricks", stone_wall="mud_brick_wall",
        stone_slab="mud_brick_slab", stone_stairs="mud_brick_stairs", boulder="moss_block",
        grounds=[(0.3, "mud"), (0.6, "grass_block"), (0.82, "moss_block"), (1, "podzol")],
        yards=[(0.45, "mud"), (0.8, "packed_mud"), (1, "coarse_dirt")], paths=[(0.7, "mangrove_slab"), (1, "mud_brick_slab")],
        plate=("mud", "grass_block"), snow=False, water=True),
    "emberwaste": dict(
        timber={"base": "ember_sandstone", "roof": "smooth_sandstone"}, stone={"base": "ember_sandstone", "roof": "smooth_sandstone"},
        roof={"type": "flat", "parapet": "crenel", "beams": True}, house_extra={"bushes": False},
        wood="acacia", log="stripped_acacia_log", tree=palm,
        stone_full="sandstone", stone_brick="cut_sandstone", stone_accent="smooth_sandstone", stone_wall="sandstone_wall",
        stone_slab="smooth_sandstone_slab", stone_stairs="sandstone_stairs", boulder="sandstone",
        grounds=[(0.28, "red_sand"), (0.62, "coarse_dirt"), (0.85, "sand"), (1, "packed_mud")],
        yards=[(0.35, "red_sand"), (0.8, "coarse_dirt"), (1, "packed_mud")], paths=[(0.35, "smooth_sandstone"), (1, "cut_red_sandstone")],
        plate=("red_sandstone", "red_sand"), snow=False, water=True),
}


def _pick(runs, v):
    for t, b in runs:
        if v <= t: return b
    return runs[-1][1]


class Theme:
    def __init__(self, region):
        self.region = region
        self.name = NAMES[region]
        for k, v in THEMES[region].items(): setattr(self, k, v)
        self.fence = f"{self.wood}_fence"
        self.planks = f"{self.wood}_planks"
        self.slab = f"{self.wood}_slab"
        self.trapdoor = f"{self.wood}_trapdoor"
        self.stairs = f"{self.wood}_stairs"

    def roof_of(self, ridge=None, **kw):
        r = dict(self.roof)
        if ridge and r["type"] != "flat": r["ridge"] = ridge
        r.update(kw)
        return r

    def house(self, kind, **spec):
        """A house part in the region's look: kind 'timber' or 'stone'; ridge goes in spec['ridge']"""
        ridge = spec.pop("ridge", None)
        roof_kw = spec.pop("roof_kw", {})
        part = {"part": "house", "style": self.timber if kind == "timber" else self.stone, **self.house_extra, **spec}
        part["roof"] = self.roof_of(ridge, **roof_kw)
        if self.roof["type"] == "flat" and part.get("chimney") == "auto": part["chimney"] = False
        return part

    def ground(self, x, z, seed=1):
        return _pick(self.grounds, noise(x, z, seed))

    def yard(self, x, z, seed=1):
        return _pick(self.yards, noise(x, z, seed))

    def path(self, x, z):
        return _pick(self.paths, _hash(x, z, 5))

    def snow_layer(self, place, x, z, y=1, chance=0.3):
        if self.snow and noise(x, z, 3, 2.2) > chance: place.append([x, y, z, "snow_layer"])

    def green(self, place, box, seed, trees=(), ground=True):
        """The region's ground and ground cover on box, and its trees at (x, z, h)"""
        x0, z0, x1, z1 = box
        runs = _plants(self.region)
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                g = self.ground(x, z, seed)
                if self.region in ("vale", "frostmarch") and g == "gravel": g = "grass_block"
                if ground: place.append([x, 0, z, g])
                if any(abs(x - t[0]) <= 1 and abs(z - t[1]) <= 1 for t in trees): continue
                k = _hash(x, z, seed + 1)
                for t, blocks in runs:
                    if k < t:
                        b = blocks[int(k * 1000) % len(blocks)]
                        if b == "boulder": place.append([x, 1, z, self.boulder]); self.snow_layer(place, x, z, 2, -1)
                        elif b == "cactus": place += [[x, 1, z, "cactus"]] + ([[x, 2, z, "cactus"]] if k < 0.085 else [])
                        else: place.append([x, 1, z, b])
                        break
                else:
                    self.snow_layer(place, x, z)
        for t in trees: self.tree(place, t[0], t[1], t[2])


def theme(region):
    return Theme(region)


def snow_cap(blocks, place):
    """frostmarch.md: snow layers on ridges, chimney caps, flat tops and wall tops: a snow layer on every
    topmost full block, wall or top slab open to the sky. blocks = engine.compute()'s result."""
    tops = {}
    for (x, y, z), (n, p) in blocks.items():
        if n != "air": tops[(x, z)] = max(tops.get((x, z), y), y)
    for (x, z), y in tops.items():
        n, p = blocks[(x, y, z)]
        if n in ("snow_layer", "lantern", "campfire", "flower_pot", "lightning_rod", "iron_chain", "grindstone", "rail", "fern", "bush",
                 "sweet_berry_bush", "water", "black_concrete", "cactus", "deadbush", "short_grass", "anvil", "cauldron") or \
                n.endswith(("_stairs", "_trapdoor", "_door", "_sign", "_fence", "_leaves", "_pane", "_carpet")):
            continue
        if n.endswith("_slab"):
            if (p or {}).get("half") == "top": place.append([x, y + 1, z, "snow_layer"])
            continue
        place.append([x, y + 1, z, "snow_layer"])


def names_json(prefix, title, stages):
    """{dir key: {"title", "sub"}} for the asset viewer: one row per stage, one chip per region"""
    out = {}
    for r in ORDER:
        for lv, stage in enumerate(stages, 1):
            out[f"{prefix}_{r}_{lv}"] = {"title": f"{title} {lv}: {stage}", "sub": NAMES[r]}
    return out
