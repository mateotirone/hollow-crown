"""Town dressing: back gardens, market stalls, lamp posts and trees. All odd-sized, vanilla blocks.

Every maker returns a Blueprint in the same frame as the buildings (front faces south, y = 0 is
the ground surface). Gardens are made in the frame of the house they belong to, behind it.
"""
import random
from bp import Blueprint
from kit import h3

CROPS = ("wheat", "carrots", "potatoes")
FLOWERS = ("poppy", "dandelion", "cornflower", "oxeye_daisy", "azure_bluet", "allium", "red_tulip", "white_tulip")

def garden(house, seed, depth=5):
    """A fenced yard behind a house: vegetable rows, a working yard, or an orchard corner."""
    rnd = random.Random(seed)
    (lx, _, lz), (hx, _, _) = house.bounds()
    x0, x1 = lx, hx
    if (x1 - x0) % 2: x1 -= 1                     # odd width
    z1 = lz - 1; z0 = z1 - depth + 1              # behind the back wall
    g = Blueprint(f"garden_{seed}")
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            edge = x in (x0, x1) or z == z0
            g.set(x, 0, z, "grass_block")
            if edge: g.set(x, 1, z, "spruce_fence")
    mid = (x0 + x1) // 2
    g.set(mid, 1, z0, "spruce_fence_gate", facing="n")     # gate out the back
    kind = rnd.choice(["veg", "veg", "yard", "orchard"])
    inner = [(x, z) for x in range(x0 + 1, x1) for z in range(z0 + 1, z1 + 1)]
    if kind == "veg":
        crop = rnd.choice(CROPS)
        for x, z in inner:
            if z == z1: continue                              # path along the house
            if (x - x0) % 3 == 2: g.set(x, 0, z, "grass_path")
            else: g.set(x, 0, z, "farmland"); g.set(x, 1, z, crop, raw={"growth": 7})
        g.set(x0 + 1, 1, z1, "composter")
    elif kind == "yard":
        props = ["hay_block", "barrel", "barrel", "composter", "cauldron", "oak_log", "hay_block"]
        rnd.shuffle(props)
        spots = [(x, z) for x, z in inner if x in (x0 + 1, x1 - 1) or z == z0 + 1]
        for (x, z), b in zip(spots[::2], props):
            g.set(x, 1, z, b, **({"axis": "y"} if b in ("hay_block", "oak_log") else {}))
            if b == "hay_block" and rnd.random() < 0.4: g.set(x, 2, z, "hay_block", axis="y")
        for x, z in inner:
            if g.get(x, 1, z)[0] in ("keep",) and h3(x, 0, z, seed) < 0.35: g.set(x, 0, z, "coarse_dirt")
    else:
        tx, tz = (x0 + 2, z0 + 2) if rnd.random() < 0.5 else (x1 - 2, z0 + 2)
        small_tree(g, tx, tz, seed, height=4)
        for x, z in inner:
            if g.get(x, 1, z)[0] == "keep" and h3(x, 3, z, seed) < 0.3: g.set(x, 1, z, rnd.choice(FLOWERS))
    return g.finish()

def small_tree(bp, x, z, seed, height=None):
    h = height or 4 + int(h3(x, 0, z, seed) * 2)
    for y in range(1, h + 1): bp.set(x, y, z, "oak_log", axis="y")
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for dy in range(-1, 2):
                r = dx * dx + dz * dz + dy * dy * 2
                if r <= 4.5 + h3(x + dx, dy, z + dz, seed) * 2 and bp.get(x + dx, h + dy, z + dz)[0] == "keep":
                    bp.set(x + dx, h + dy, z + dz, "oak_leaves")
    bp.set(x, h + 2, z, "oak_leaves")

def tree(seed):
    t = Blueprint(f"oak_tree_{seed}"); rnd = random.Random(seed)
    h = 5 + rnd.randint(0, 2)
    for y in range(1, h + 1): t.set(0, y, 0, "oak_log", axis="y")
    for dx in range(-3, 4):
        for dy in range(-2, 3):
            for dz in range(-3, 4):
                if dx * dx + dz * dz + (dy * 1.4) ** 2 <= 8.5 + h3(dx, dy, dz, seed) * 3 and t.get(dx, h + dy, dz)[0] == "keep":
                    t.set(dx, h + dy, dz, "oak_leaves")
    return t.finish()

def stall(seed):
    """3 x 3 market stall: four posts, striped wool awning, a counter of barrels and a hay bale."""
    rnd = random.Random(seed); s = Blueprint(f"market_stall_{seed}")
    colour = rnd.choice(["red", "yellow", "blue", "green", "orange"])
    for x in (0, 2):
        for z in (0, 2):
            for y in (1, 2, 3): s.set(x, y, z, "spruce_fence")
    for x in range(-1, 4):
        for z in range(0, 3): s.set(x, 4, z, f"{colour}_wool" if (x + 1) % 2 == 0 else "white_wool")
    s.set(1, 1, 2, "barrel"); s.set(0, 1, 1, rnd.choice(["hay_block", "barrel", "composter"]), axis="y")
    s.set(2, 1, 1, rnd.choice(["barrel", "pumpkin", "hay_block"]))
    return s.finish()

# street lamps per region (Mateo 2026-11-12: "none of the towns have light"): a stone foot, a post in the
# region's wood, a lantern on top; the square's lamps carry a second lantern hung from an arm
LAMP_STYLE = {"vale": ("stone_brick_wall", "dark_oak_fence"), "frost": ("cobbled_deepslate_wall", "spruce_fence"),
              "salt": ("stone_brick_wall", "birch_fence"), "ember": ("sandstone_wall", "acacia_fence"),
              "fen": ("mud_brick_wall", "mangrove_fence")}

def lamp(region="vale", arm=False):
    foot, post = LAMP_STYLE.get(region, LAMP_STYLE["vale"])
    l = Blueprint(f"lamp_post_{region}{'_arm' if arm else ''}")
    l.set(0, 1, 0, foot); l.set(0, 2, 0, post); l.set(0, 3, 0, post); l.set(0, 4, 0, "lantern")
    if arm:                                      # an arm toward +z with a hanging lantern (turned to face the street)
        l.set(0, 3, 1, post); l.set(0, 2, 1, "lantern", hanging=True)
    return l.finish()
