# The Hollow Crown bestiary: every new mob and boss, with its look (box model + palette)
# and its data-driven behaviour. Abilities that need code live in scripts/bestiary/*.js.
from models import Model, biped, quadruped, hold, shield, cloak, horns, bow_shape

# ---------- palettes ----------
SKIN = (196, 150, 120); PALE = (178, 180, 172); GREY = (120, 118, 116); RUST = {"c": (128, 78, 52), "style": "metal"}
IRON = {"c": (160, 164, 172), "style": "metal"}; DARKIRON = {"c": (70, 70, 80), "style": "metal"}; GOLD = {"c": (218, 176, 70), "style": "metal"}
WOOD = {"c": (110, 78, 46), "style": "wood"}; ASH = {"c": (196, 192, 186), "style": "cloth"}

def P(**kw): return kw

MOBS = []
def mob(**kw): MOBS.append(kw); return kw

# ---------- shared behaviour pieces ----------
def any_of(*f): return {"any_of": list(f)}
def fam(v, op="=="): return {"test": "is_family", "subject": "other", "operator": op, "value": v}
def tag(v): return {"test": "has_tag", "subject": "other", "value": v}

RAIDER_TARGETS = any_of(fam("player"), fam("siege_guard"), fam("irongolem"), fam("keep"))
PLAYERS = fam("player")
MARKED = any_of(tag("siege_marked"), tag("siege_order_enemy"))

def targets(filters, dist=24, priority=2, must_see=False):
    return {"minecraft:behavior.nearest_attackable_target": {"priority": priority, "must_see": must_see, "reselect_targets": True,
            "within_radius": dist, "entity_types": [{"filters": filters, "max_dist": dist}]}}

def melee(dmg, speed=1.2, effect=None):
    a = {"damage": dmg}
    if effect: a.update(effect)
    return {"minecraft:attack": a, "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": speed, "track_target": True}}

def ranged(projectile, interval=(1.5, 2.5), radius=16, aux=None, priority=3):
    s = {"def": projectile}
    if aux is not None: s["aux_val"] = aux
    return {"minecraft:shooter": s, "minecraft:behavior.ranged_attack": {"priority": priority, "attack_interval_min": interval[0],
            "attack_interval_max": interval[1], "attack_radius": radius, "burst_shots": 1}}

def resist(projectile=1.0, melee_mult=None, fire=False, fall=False, drown=False, extra=None):
    t = []
    if projectile != 1.0: t.append({"cause": "projectile", "damage_multiplier": projectile})
    if fire: t += [{"cause": "fire", "deals_damage": "no"}, {"cause": "fire_tick", "deals_damage": "no"}, {"cause": "lava", "deals_damage": "no"}]
    if fall: t.append({"cause": "fall", "deals_damage": "no"})
    if drown: t.append({"cause": "drowning", "deals_damage": "no"})
    if extra: t += extra
    return {"minecraft:damage_sensor": {"triggers": t}} if t else {}

def flying(speed=0.3):
    return {"minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True, "can_path_from_air": True,
            "avoid_water": True, "avoid_damage_blocks": True, "avoid_sun": False},
            "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": speed}, "minecraft:can_fly": {},
            "minecraft:physics": {"has_gravity": False}, "minecraft:behavior.random_hover": {"priority": 6, "xz_dist": 8, "y_dist": 4, "y_offset": -1, "interval": 1, "hover_height": [1, 4]}}

def swimmer():
    return {"minecraft:navigation.generic": {"is_amphibious": True, "can_path_over_water": True, "can_swim": True, "can_walk": True, "can_breach": True, "can_sink": False},
            "minecraft:movement.amphibious": {"max_turn": 5}, "minecraft:underwater_movement": {"value": 0.15},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True, "breathes_air": True}}

# ======================================================================================
# Family 1: Choir-called raiders (sieges, warlord camps)
# ======================================================================================
def m_footman(m):
    biped(m, mats={"head": "skin", "body": "tabard", "arm": "mail", "leg": "pants", "belt": "belt"}, face="hollow")
    m.box("head", [-4.5, 29, -4.5], [9, 3, 9], "helm"); m.box("head", [-5.5, 29, -5.5], [11, 1, 11], "helm"); m.box("head", [-2.5, 32, -2.5], [5, 1, 5], "helm")   # kettle helm
    m.box("head", [-4.5, 24, 2.5], [9, 5, 2], "mail")                          # mail coif at the neck
    m.box("body", [-4.5, 8, -2.5], [9, 4, 5], "tabard")                        # ragged skirt of the tabard
    m.box("body", [-3.5, 6, -2.5], [3, 2, 5], "tabard"); m.box("body", [1.5, 7, -2.5], [2, 1, 5], "tabard")
    hold(m, "sword", blade="rust", hilt="belt", long=12)
    shield(m, size=(8, 9), shield="belt", trim="rust")
mob(id="hollow_footman", name="Tollman", family="raider", model=m_footman,
    pal=P(skin=PALE, tabard={"c": (64, 58, 72), "style": "cloth"}, mail={"c": (104, 106, 112), "style": "metal"}, pants=(54, 48, 46), helm=RUST, belt=(70, 46, 30), rust=RUST, eye=(180, 230, 255)),
    hp=26, speed=0.32, dmg=5, egg=("#3f3a48", "#b4e6ff"), lore="The first to answer the bell. They march with their eyes open and nobody home behind them.")

def m_bellringer(m):
    biped(m, mats={"head": "skin", "body": "robe", "leg": "robe"}, face="hollow")
    cloak(m, "hood", hood=True); m.box("body", [-4.5, 0, -2.5], [9, 12, 5], "robe"); m.box("body", [-0.5, 14, -3.2], [1, 8, 1], "bell")   # robe skirt, a brass chain
    hold(m, "staff", bone="pole", haft="wood", long=31)
    m.box("pole", [-6.5, 33, -5], [1, 1, 5], "wood"); m.box("pole", [-6.5, 31, -1.5], [1, 2, 1], "wood")
    m.bone("bell", [-6, 33, -3.5], "pole")
    m.box("bell", [-6.5, 31, -4], [1, 2, 1], "wood"); m.box("bell", [-7.5, 29, -5], [3, 2, 3], "bell"); m.box("bell", [-8.5, 25, -6], [5, 4, 5], "bell")
    m.box("bell", [-9, 24, -6.5], [6, 1, 6], "bell"); m.box("bell", [-6.5, 22.5, -4], [1, 2, 1], "wood")
mob(id="bell_ringer", name="Bell-Ringer", family="raider", model=m_bellringer,
    pal=P(skin=PALE, robe={"c": (90, 30, 34), "style": "cloth"}, hood={"c": (70, 22, 26), "style": "cloth"}, wood=WOOD, bell=GOLD, eye=(255, 220, 140)),
    hp=20, speed=0.3, dmg=2, flees=True, egg=("#5a1e22", "#dab046"), anim_extra=[("bell", "rotation", ["0", "0", "math.sin(query.life_time*400)*20"])],
    lore="Every ring of its bell makes the raiders around it braver and faster. Kill it first. It knows this, and runs.")

def m_brute(m):
    biped(m, L=12, B=14, bw=12, bd=6, head=(8, 8, 8), arm=(5, 14, 5), mats={"head": "skin", "body": "plate", "arm": "skin", "leg": "pants", "shoulder": "plate", "bracer": "plate"}, face=None, nose=False)
    m.box("head", [-4.5, 26, -4.5], [9, 9, 9], "plate", face="visor"); m.box("head", [-0.5, 35, -4], [1, 2, 8], "plate")     # great helm with a crest
    m.box("body", [-6.5, 22, -3.5], [13, 4, 7], "plate"); m.box("body", [-6, 12, -3.5], [12, 3, 7], "pants")                # gorget, padded skirt
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 9 - 0.5, 27, -0.5], [1, 3, 1], "plate")                      # a spike on each shoulder
    hold(m, "mace", haft="shield", blade="plate", long=13)
    shield(m, size=(14, 22), shield="shield", trim="plate")
mob(id="shieldwall_brute", name="Shieldwall Brute", family="raider", model=m_brute,
    pal=P(skin=(150, 120, 100), plate=DARKIRON, pants=(60, 50, 44), shield={"c": (96, 66, 40), "style": "wood"}, eye=(255, 120, 60)),
    hp=55, speed=0.24, dmg=9, scale=1.15, kb=0.8, resist=dict(projectile=0.25), egg=("#46464f", "#ff783c"),
    lore="A tower shield and nothing else to think about. Arrows bounce. Get behind him.")

def m_torch(m):
    biped(m, mats={"head": "skin", "body": "leather", "leg": "pants", "belt": "rag"}, face="hollow")
    m.box("head", [-4.5, 29, -4.5], [9, 4, 9], "rag"); m.box("head", [-4.5, 24, -4.5], [9, 2, 9], "rag"); m.box("head", [2.5, 20, 3.5], [2, 6, 1], "rag")   # head wrap, scarf, its loose end
    m.box("body", [-4.5, 9, -2.5], [9, 3, 5], "leather"); m.box("body", [-5, 14, 2], [4, 6, 2], "leather")                   # jerkin skirt, oil satchel
    hold(m, "torch", haft="wood", flame="flame", wrap="rag", bend=55)
mob(id="torchbearer", name="Torchbearer", family="raider", model=m_torch,
    pal=P(skin=PALE, leather={"c": (92, 60, 36), "style": "cloth"}, pants=(50, 40, 36), rag={"c": (130, 120, 100), "style": "cloth"}, wood=WOOD, flame={"c": (255, 170, 40), "style": "glow"}, eye=(255, 160, 60)),
    hp=22, speed=0.33, dmg=4, resist=dict(fire=True), egg=("#5c3c24", "#ffaa28"),
    lore="Sets every wooden thing it passes alight. Stone walls were built for a reason.")

def m_ogre(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 16, 0], "root")
    m.box("body", [-9, 16, -6], [18, 18, 12], "hide"); m.box("body", [-8, 13, -5], [16, 4, 10], "belt")
    m.box("body", [-7, 16, -8], [14, 10, 2], "skin"); m.box("body", [-10, 28, -7], [20, 6, 14], "hide")                      # belly, shoulders of fur
    m.box("body", [-4, 5, -6], [8, 9, 1], "hide"); m.box("body", [-1.5, 13.5, -6], [3, 3, 1], "ironcap")                     # loincloth and buckle
    m.bone("head", [0, 34, -2], "body"); m.box("head", [-5, 32, -9], [10, 9, 9], "skin", face="low")
    m.box("head", [-5.5, 38, -10], [11, 2, 2], "skin"); m.box("head", [-4, 32, -11], [8, 3, 2], "skin")                      # brow ridge, jaw
    for s in (-1, 1):
        m.box("head", [s * 3 - 0.5, 34, -12], [1, 3, 1], "tusk"); m.box("head", [s * 6 - 1, 35, -5], [2, 3, 1], "skin")      # tusks, ears
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 11, 32, 0], "body"); m.box(nm, [s * 11 - 3.5, 12, -3.5], [7, 22, 7], "skin", mirror=s > 0)
        m.box(nm, [s * 11 - 4, 16, -4], [8, 5, 8], "belt", mirror=s > 0); m.box(nm, [s * 11 - 4, 10, -4], [8, 4, 8], "skin", mirror=s > 0)   # bracer, fist
    for s, nm in ((-1, "leg_r"), (1, "leg_l")):
        m.bone(nm, [s * 4.5, 16, 0], "root"); m.box(nm, [s * 4.5 - 3.5, 0, -3.5], [7, 16, 7], "pants", mirror=s > 0)
        m.box(nm, [s * 4.5 - 4, 0, -6], [8, 3, 10], "skin", mirror=s > 0)                                                     # feet
        for t in (-3, -0.5, 2): m.box(nm, [s * 4.5 + t, 0, -7], [1, 2, 1], "tusk")                                            # toenails
    m.pose("arm_r", [-22, 0, 0])
    m.bone("log", [-11, 13, 0], "arm_r"); m.box("log", [-14, 10, -28], [6, 6, 36], "log")                                     # a tree trunk, carried as a ram
    m.box("log", [-15, 9, -31], [8, 8, 4], "ironcap"); m.box("log", [-14.5, 9.5, -18], [7, 7, 2], "ironcap"); m.box("log", [-14.5, 9.5, -4], [7, 7, 2], "ironcap")
    m.box("log", [-12, 16, 2], [2, 3, 2], "log")                                                                              # a sawn-off branch
    m.bone("seat", [0, 34, 2], "body")
mob(id="siege_ogre", name="Siege Ogre", family="raider", model=m_ogre,
    pal=P(skin=(120, 128, 92), hide={"c": (110, 84, 60), "style": "fur"}, belt=(60, 40, 26), pants=(70, 56, 40), tusk=(230, 220, 190), log=WOOD, ironcap=DARKIRON, eye=(250, 220, 80)),
    hp=120, speed=0.22, dmg=14, kb=1.0, collision=(1.6, 3.0), rideable=True, egg=("#78805c", "#6e543c"),
    lore="Carries a whole tree trunk as a ram. Walls crack where it walks.")

def m_crowmage(m):
    biped(m, mats={"head": "mask", "body": "feather", "leg": "feather"}, face="glow")
    m.box("head", [-1, 26, -8], [2, 2, 4], "beak"); m.box("head", [-0.5, 25, -9], [1, 2, 2], "beak")                          # a long hooked beak
    cloak(m, "feather", hood=True)
    m.box("body", [-5, 0, -3], [10, 12, 6], "feather")                                                                        # feather robe to the ground
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 8 - 1.5, 22, -3], [3, 3, 6], "feather", inflate=0.4)          # feathered shoulders
    hold(m, "staff", side="l", haft="wood", orb="orb", long=32)
mob(id="crow_mage", name="Crow-Mage", family="raider", model=m_crowmage,
    pal=P(mask=(40, 36, 44), feather={"c": (30, 28, 36), "style": "fur"}, beak=(200, 170, 80), wood=WOOD, orb={"c": (150, 80, 255), "style": "glow"}, eye=(200, 120, 255)),
    hp=24, speed=0.3, dmg=3, keep_distance=True, egg=("#1e1c24", "#9650ff"),
    lore="Calls a murder of Bellcrows and throws blinding bolts from the back of the line.")

def m_crow(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 3, 0], "root"); m.box("body", [-1.5, 2, -3], [3, 3, 6], "feather")
    m.box("body", [-1, 2.5, 3], [2, 1, 4], "feather"); m.box("body", [-1.5, 2.5, 6], [3, 1, 2], "feather")                    # tail fan
    m.bone("head", [0, 5, -3], "body"); m.box("head", [-1.5, 4, -6], [3, 3, 3], "feather", face="eyes"); m.box("head", [-0.5, 4.5, -8], [1, 1, 2], "beak")
    m.bone("wing_r", [-1.5, 5, 0], "body"); m.box("wing_r", [-7.5, 4.5, -2], [6, 0, 5], "feather"); m.box("wing_r", [-11.5, 4.5, -1], [4, 0, 3], "feather")
    m.bone("wing_l", [1.5, 5, 0], "body"); m.box("wing_l", [1.5, 4.5, -2], [6, 0, 5], "feather", mirror=True); m.box("wing_l", [7.5, 4.5, -1], [4, 0, 3], "feather", mirror=True)
    for s in (-1, 1): m.box("body", [s - 0.5, 0, 0], [1, 2, 1], "beak")
mob(id="hollow_crow", name="Bellcrow", family="summon", model=m_crow, plan="bird",
    pal=P(feather={"c": (26, 24, 30), "style": "fur"}, beak=(200, 170, 80), eye=(200, 120, 255)),
    hp=4, speed=0.4, dmg=2, fly=0.35, lifetime=30, collision=(0.5, 0.5), egg=("#1a181e", "#c878ff"), no_loot=True,
    lore="Summoned by Crow-Mages. They come apart into ash after half a minute.")

# ======================================================================================
# Family 2: things from the Hollow
# ======================================================================================
def villagerish(m, robe, face):
    biped(m, mats={"head": "skin", "body": robe, "arm": robe, "leg": robe}, head=(8, 10, 8), face=face, nose=False)
    m.box("head", [-1, 25, -6], [2, 4, 2], "skin")                            # nose
    m.box("head", [-4.5, 29, -4.5], [9, 1, 2], "skin")                        # one long brow
    m.box("body", [-4, 2, -3], [8, 10, 6], robe)                              # robe skirt
    m.box("body", [-6, 15, -5], [12, 4, 3], robe)                             # arms folded into the sleeves
def m_lost(m): villagerish(m, "robe", "hollow")
mob(id="lost_villager", name="Lost Villager", family="hollow", model=m_lost,
    pal=P(skin=(176, 150, 130), robe={"c": (110, 92, 70), "style": "cloth"}, eye=(230, 230, 220)),
    hp=20, speed=0.22, dmg=6, groups="lost", egg=("#6e5c46", "#e6e6dc"),
    lore="One of the Lost Days. It just stands there facing you. It is never where you left it when you look back.")

def m_changeling(m):
    villagerish(m, "robe", "eyes")
    m.bone("jaw", [0, 24, -4], "head"); m.box("jaw", [-3, 22, -5], [6, 2, 4], "skin")
mob(id="changeling", name="Changeling", family="hollow", model=m_changeling, variants=2,
    pal=P(skin=(184, 150, 120), robe={"c": (60, 90, 70), "style": "cloth"}, eye=(40, 30, 20)),
    pal_alt=P(skin=(120, 150, 110), robe={"c": (40, 60, 44), "style": "fur"}, eye=(255, 230, 80)),
    hp=28, speed=0.24, dmg=6, groups="changeling", egg=("#3c5a46", "#ffe650"),
    lore="Something wearing a villager. It gets the face nearly right. Nearly.")

def m_wrongling(m):
    biped(m, L=20, B=14, bw=6, bd=3, head=(6, 10, 6), arm=(2, 26, 2), mats={"head": "skin", "body": "skin", "leg": "skin"}, face="hollow", nose=False)
    m.box("head", [-3.5, 41, -3.5], [7, 2, 7], "skin"); m.box("head", [-2.5, 34, -3.5], [5, 2, 1], "skin")                    # swollen crown, a jaw that hangs
    for s in (-1, 1):
        nm = "arm_r" if s < 0 else "arm_l"
        for dx, dz, n in ((-0.5, -1, 5), (0.5, 0, 6), (-0.5, 1, 4)): m.box(nm, [s * 4 + dx - 0.5, 8 - n, dz - 0.5], [1, n, 1], "skin")   # fingers far too long
        m.box("body", [s * 2 - 1, 26, 1.5], [2, 6, 1], "skin")                                                                # shoulder blades
    for y in (22, 25, 28): m.box("body", [-2.5, y, -2], [5, 1, 1], "skin")                                                    # ribs
    m.box("body", [-0.5, 21, 1.5], [1, 12, 1], "skin")                                                                        # spine
mob(id="wrongling", name="Wrongling", family="hollow", model=m_wrongling,
    pal=P(skin=(214, 210, 200), eye=(10, 8, 10)),
    hp=40, speed=0.45, dmg=10, collision=(0.6, 2.9), groups="wrongling", egg=("#d6d2c8", "#0a080a"),
    lore="It only moves when nobody is looking. Don't blink. Don't turn around. Don't go alone.")

def m_vigil(m):
    # A carved mourner: hooded, hands folded, wings shut behind it. Nothing moves in the model on purpose.
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 12, 0], "root")
    m.box("body", [-5, 0, -3], [10, 2, 6], "plinth")
    m.box("body", [-4, 2, -2.5], [8, 12, 5], "robe"); m.box("body", [-4, 14, -2], [8, 11, 4], "robe")
    m.box("body", [-2, 15, -4], [4, 3, 2], "stone")                           # folded hands
    m.bone("head", [0, 25, 0], "body"); m.box("head", [-3.5, 25, -3.5], [7, 7, 7], "stone", face="blank")   # no face: a veil of stone with one crack
    m.box("head", [-4.5, 25, -2.5], [9, 8, 7], "robe"); m.box("head", [-4.5, 31, -4.5], [9, 2, 2], "robe")   # hood and its brim
    m.box("head", [-4.5, 25, -4.5], [1, 6, 2], "robe"); m.box("head", [3.5, 25, -4.5], [1, 6, 2], "robe")
    m.bone("arm_r", [-5, 23, 0], "body"); m.box("arm_r", [-6, 14, -1.5], [2, 11, 3], "robe")
    m.bone("arm_l", [5, 23, 0], "body"); m.box("arm_l", [4, 14, -1.5], [2, 11, 3], "robe", mirror=True)
    m.bone("wing_r", [-2, 22, 2], "body"); m.box("wing_r", [-10, 7, 2.5], [8, 29, 1], "wing", rot=[0, 18, 0], pivot=[-2, 22, 2.5])
    m.bone("wing_l", [2, 22, 2], "body"); m.box("wing_l", [2, 7, 2.5], [8, 29, 1], "wing", rot=[0, -18, 0], pivot=[2, 22, 2.5], mirror=True)
mob(id="stone_vigil", name="Stone Vigil", family="hollow", model=m_vigil, plan="none",
    pal=P(stone={"c": (150, 152, 146), "style": "bone"}, robe={"c": (124, 128, 124), "style": "cloth"}, wing={"c": (100, 108, 104), "style": "stone"},
          plinth={"c": (84, 92, 84), "style": "stone"}, eye=(18, 16, 22)),
    hp=60, speed=0.5, dmg=8, kb=1, collision=(0.7, 2.1), resist=dict(projectile=0.0, fire=True, drown=True), groups=None, egg=("#8c908a", "#12101a"),
    lore="The Order carved them to keep watch over its dead. Something else is keeping watch through them now. It is only a statue while somebody is looking.")

def m_hound(m):
    q = quadruped(m, legh=9, body=(7, 7, 16), head=(6, 6, 8), mats={"body": "hide", "head": "bone", "nose": "bone"}, face="glow", ears=False)
    m.box("body", [-1, 16, -6], [2, 3, 12], "bone")                           # spine ridge
    for z in (-5, -2, 1, 4): m.box("body", [-0.5, 19, z], [1, 2, 1], "bone")  # and its spurs
    for z in (-4, -1, 2): m.box("body", [-4, 11, z], [8, 4, 1], "bone")       # ribs showing through
    m.bone("jaw", [0, q["hy"] - 2, -10], "head"); m.box("jaw", [-2.5, q["hy"] - 4, -18], [5, 1, 8], "bone")
    for s in (-1, 1): m.box("jaw", [s * 2 - 0.5, q["hy"] - 3, -18], [1, 2, 1], "bone"); m.box("head", [s * 2 - 0.5, q["hy"] - 2, -18.5], [1, 2, 1], "bone")
mob(id="echo_hound", name="Echo Hound", family="hollow", model=m_hound, plan="quad",
    pal=P(hide={"c": (40, 44, 60), "style": "fur"}, bone={"c": (200, 200, 190), "style": "bone"}, eye=(120, 220, 255)),
    hp=24, speed=0.38, dmg=5, collision=(0.8, 1.0), groups="hound", egg=("#282c3c", "#78dcff"),
    lore="Blind. It hunts by the hum of the Ember. The more of the Ember you carry, the farther away it hears you.")

def m_mirror(m):
    biped(m, mats={"head": "mirror", "body": "mirror", "arm": "mirror", "leg": "mirror", "belt": "trim", "shoulder": "trim", "bracer": "trim", "boot": "trim"}, face="blank", nose=False)
    m.box("head", [-4.5, 31, -4.5], [9, 2, 9], "trim"); m.box("head", [-0.5, 24, -4.6], [1, 7, 1], "trim"); m.box("head", [-0.5, 33, -3], [1, 2, 6], "trim")   # a faceless helm
    m.box("body", [-4.5, 17, -2.6], [9, 1, 5], "trim"); m.box("body", [-0.5, 12, -2.8], [1, 12, 1], "trim")
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 8.5 - 1, 24, -1], [2, 2, 2], "mirror")                        # shard on each shoulder
    hold(m, "sword", blade="mirror", hilt="trim", long=15)
    shield(m, size=(8, 12), shield="mirror", trim="trim", kite=True)
mob(id="mirror_knight", name="Mirror Knight", family="hollow", model=m_mirror,
    pal=P(mirror={"c": (200, 214, 226), "style": "metal"}, trim={"c": (120, 140, 160), "style": "metal"}),
    hp=45, speed=0.3, dmg=7, kb=0.5, groups="mirror", egg=("#c8d6e2", "#788ca0"),
    lore="Whatever you hit it with last, it learns. Shoot it and it shoots back. Strike it and it parries. Change it up.")

def m_shade(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 10, 0], "root")
    m.box("body", [-4, 6, -2.5], [8, 14, 5], "shroud"); m.box("body", [-3, 0, -2], [6, 6, 4], "wisp")
    m.box("body", [-5, 3, -3], [3, 5, 6], "shroud"); m.box("body", [2, 1, -3], [3, 7, 6], "shroud"); m.box("body", [-2, -3, -1], [2, 4, 2], "wisp"); m.box("body", [1, -2, 0], [1, 3, 1], "wisp")   # torn hem, trailing threads
    m.bone("head", [0, 20, 0], "body"); m.box("head", [-4, 20, -4], [8, 8, 8], "shroud", face="glow")
    m.box("head", [-4.5, 20, -3], [9, 9, 8], "shroud"); m.box("head", [-4.5, 27, -5], [9, 2, 2], "shroud"); m.box("head", [-2, 29, 0], [4, 2, 5], "shroud"); m.box("head", [-1, 27, 5], [2, 3, 2], "shroud")   # deep hood with a drooping peak
    m.bone("arm_r", [-5, 18, 0], "body"); m.box("arm_r", [-7, 6, -1.5], [3, 13, 3], "shroud"); m.box("arm_r", [-7.5, 3, -2], [4, 4, 4], "shroud")
    m.bone("arm_l", [5, 18, 0], "body"); m.box("arm_l", [4, 6, -1.5], [3, 13, 3], "shroud", mirror=True); m.box("arm_l", [3.5, 3, -2], [4, 4, 4], "shroud", mirror=True)
    m.pose("arm_r", [-75, 0, 0]); m.pose("arm_l", [-40, 0, 0])                 # one hand holds the bell out, the other reaches
    x, y, z = -5.5, 6, -3.5                                                    # the bell hangs from the right fist
    m.bone("bell", [x, 9 + y, -9 + z], "body"); m.box("bell", [x - 0.5, 7 + y, -9.5 + z], [1, 3, 1], "bell"); m.box("bell", [x - 1.5, 5 + y, -10.5 + z], [3, 2, 3], "bell")
    m.box("bell", [x - 2.5, 1 + y, -11.5 + z], [5, 4, 5], "bell"); m.box("bell", [x - 3, y, -12 + z], [6, 1, 6], "bell")
mob(id="tolling_shade", name="Tolling Shade", family="hollow", model=m_shade, plan="float", material="entity_alphablend",
    pal=P(shroud={"c": (60, 70, 90, 190), "style": "cloth"}, wisp={"c": (90, 110, 140, 120), "style": "cloth"}, bell=GOLD, eye=(140, 230, 255)),
    hp=30, speed=0.25, dmg=4, fly=0.25, groups=None, egg=("#3c465a", "#8ce6ff"), anim_extra=[("bell", "rotation", ["math.sin(query.life_time*300)*25", "0", "0"])],
    lore="You have heard that bell before, under your own keep. Each ring drags at your legs and darkens the world.")

# ======================================================================================
# Family 3: Regional wildlife and beasts
# ======================================================================================
def m_stag(m):
    q = quadruped(m, legh=14, body=(9, 10, 18), head=(5, 6, 8), mats={"body": "fur", "head": "fur", "leg": "fur"}, neck=6, tail=False)
    hy = q["hy"]; z = q["hz"] + 6
    for s in (-1, 1):                                                         # a full rack: beam, brow tine, two points, a crown
        m.box("head", [s * 2 - 0.5, hy + 4, z], [1, 5, 1], "antler"); m.box("head", [s * 3.5 - 1, hy + 8, z], [2, 1, 1], "antler")
        m.box("head", [s * 5 - 0.5, hy + 8, z], [1, 7, 1], "antler"); m.box("head", [s * 2 - 0.5, hy + 6, z - 3], [1, 1, 3], "antler"); m.box("head", [s * 2 - 0.5, hy + 6, z - 4], [1, 3, 1], "antler")
        m.box("head", [s * 6.5 - 1, hy + 11, z], [2, 1, 1], "antler"); m.box("head", [s * 8 - 0.5, hy + 11, z], [1, 5, 1], "antler"); m.box("head", [s * 5 - 0.5, hy + 13, z + 1], [1, 1, 3], "antler"); m.box("head", [s * 5 - 0.5, hy + 13, z + 3], [1, 4, 1], "antler")
    m.box("body", [-5, 15, -11], [10, 8, 5], "fur", inflate=0.3)              # winter ruff
    m.box("body", [-1.5, 21, 8], [3, 3, 3], "antler")                         # white scut of a tail
mob(id="frost_stag", name="Frost Stag", family="wild", model=m_stag, plan="quad",
    pal=P(fur={"c": (214, 220, 226), "style": "fur"}, antler={"c": (190, 220, 240), "style": "bone"}, eye=(20, 30, 40)),
    hp=30, speed=0.3, dmg=7, collision=(1.2, 1.8), neutral=True, region="Frostmarch", egg=("#d6dce2", "#bedcf0"),
    spawn=dict(biomes=["taiga", "frozen", "cold"], light=None, herd=(1, 3), weight=6, pop="animal"),
    lore="Gentle until you strike it. Its Pale Antlers are worth a fortune to any Stables master.")

def m_rimewolf(m):
    q = quadruped(m, legh=8, body=(7, 7, 14), head=(6, 6, 7), mats={"body": "fur", "head": "fur", "nose": "frost"}, face="glow")
    m.box("body", [-4, 14, -7], [8, 3, 6], "frost"); m.box("body", [-4.5, 9, -8], [9, 6, 4], "fur", inflate=0.4)             # icy mane, heavy ruff
    for z, h in ((-6, 4), (-3, 5), (0, 3), (3, 2)): m.box("body", [-0.5, 16, z], [1, h, 2], "frost")                         # ice growing along its spine
    for s in (-1, 1): m.box("head", [s * 1.5 - 0.5, q["hy"] - 3, q["hz"] - 3.5], [1, 2, 1], "frost")                         # fangs
mob(id="rimewolf", name="Rimewolf", family="wild_hostile", model=m_rimewolf, plan="quad",
    pal=P(fur={"c": (170, 186, 200), "style": "fur"}, frost={"c": (210, 240, 255), "style": "stone"}, eye=(120, 220, 255)),
    hp=22, speed=0.36, dmg=4, collision=(0.8, 0.9), region="Frostmarch", effect={"effect_name": "slowness", "effect_duration": 3}, egg=("#aabac8", "#d2f0ff"),
    spawn=dict(biomes=["taiga", "frozen", "cold"], light=7, herd=(2, 4), weight=8, pop="monster"),
    lore="Hunts in packs through the snow. Their bite freezes your legs, and they know it.")

def m_lurker(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 8, 0], "root")
    m.box("body", [-6, 3, -8], [12, 9, 16], "scale"); m.box("body", [-5, 2, -7], [10, 1, 14], "belly")
    for z, h in ((-6, 3), (-3, 5), (0, 6), (3, 4), (6, 2)): m.box("body", [-0.5, 12, z], [1, h, 2], "fin")                   # a sail of spines
    m.bone("head", [0, 9, -8], "body"); m.box("head", [-5, 4, -16], [10, 7, 8], "scale", face="glow"); m.box("head", [-4, 3, -15], [8, 2, 7], "belly")
    m.box("head", [-6, 9, -13], [2, 3, 3], "scale"); m.box("head", [4, 9, -13], [2, 3, 3], "scale")                           # eyes set on top, like a crocodile's
    for x in (-4, -2, 1, 3): m.box("head", [x, 2, -16.5], [1, 2, 1], "fin")                                                   # teeth
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * 6; z = sz * 5; m.bone(nm, [x, 4, z], "root"); m.box(nm, [x - 2, 0, z - 2], [4, 4, 4], "scale", mirror=sx > 0)
        m.box(nm, [x + sx * 2 - 2, 0, z - 3], [5, 1, 6], "fin", mirror=sx > 0)                                                # webbed feet
    m.bone("tail", [0, 8, 8], "body"); m.box("tail", [-2, 5, 8], [4, 4, 8], "scale"); m.box("tail", [-1.5, 5.5, 16], [3, 3, 6], "scale"); m.box("tail", [-0.5, 4, 20], [1, 7, 5], "fin")
mob(id="brine_lurker", name="Brine Lurker", family="wild_hostile", model=m_lurker, plan="quad",
    pal=P(scale={"c": (50, 90, 84), "style": "stone"}, fin={"c": (90, 140, 120), "style": "bone"}, belly=(170, 180, 150), eye=(240, 250, 120)),
    hp=34, speed=0.26, dmg=6, collision=(1.2, 0.9), swim=True, region="Saltreach", egg=("#325a54", "#f0fa78"),
    spawn=dict(biomes=["beach", "ocean", "river"], light=7, herd=(1, 2), weight=6, pop="monster"),
    lore="Lies still in the shallows like a rock. When you walk past, it drags you under.")

def m_scarab(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 2, 0], "root")
    m.box("body", [-3, 1, -3], [6, 3, 7], "shell"); m.box("body", [-2.5, 4, -2], [5, 1, 5], "shell"); m.box("body", [-0.5, 4.2, -2], [1, 1, 6], "leg")   # domed wing-cases and their seam
    m.bone("head", [0, 2, -3], "body"); m.box("head", [-2, 1, -5], [4, 2, 2], "shell", face="eyes")
    m.box("head", [-0.5, 2, -8], [1, 1, 3], "leg"); m.box("head", [-0.5, 3, -8], [1, 2, 1], "leg")                            # horn
    for s in (-1, 1): m.box("head", [s * 1.5 - 0.5, 1, -7], [1, 1, 2], "leg")                                                 # mandibles
    for i, z in enumerate((-2, 0, 2)):
        for s in (-1, 1):
            nm = f"leg_{'l' if s > 0 else 'r'}{i}"; m.bone(nm, [s * 3, 1, z], "root"); m.box(nm, [s * 3 - (s < 0) * 3, 1, z], [3, 1, 1], "leg"); m.box(nm, [s * 5.5 - 0.5, 0, z], [1, 2, 1], "leg")
mob(id="ash_scarab", name="Ash Scarab", family="wild_hostile", model=m_scarab, plan="bug",
    pal=P(shell={"c": (60, 40, 30), "style": "metal"}, leg=(40, 30, 24), eye=(255, 120, 30)),
    hp=6, speed=0.4, dmg=2, collision=(0.5, 0.35), resist=dict(fire=True), region="Emberwaste", egg=("#3c281e", "#ff781e"),
    spawn=dict(biomes=["desert", "mesa"], light=None, herd=(4, 7), weight=8, pop="monster"),
    lore="One is nothing. They are never one. Their bites smoulder, and their shells are half glass.")

def m_wyrm(m):
    m.bone("root", [0, 0, 0]); prev = "root"
    m.bone("head", [0, 6, 0], "root"); m.box("head", [-6, 0, -12], [12, 12, 12], "scale", face="mouth")
    m.box("head", [-5, 1, -13], [10, 3, 1], "tooth"); m.box("head", [-5, 9, -13], [10, 2, 1], "tooth")
    for s in (-1, 1):
        m.box("head", [s * 7 - 1, 3, -16], [2, 2, 8], "plate"); m.box("head", [s * 6 - 1, 3, -18], [2, 2, 2], "tooth")       # mandibles
        m.box("head", [s * 4 - 1, 12, -8], [2, 3, 2], "plate")                                                                # brow horns
    m.box("head", [-6.5, 11, -6], [13, 2, 6], "plate")                                                                         # head plate
    for i in range(6):
        nm = f"seg{i}"; z = 12 * i; w = 11 - i
        m.bone(nm, [0, 6, z], prev if i else "root"); m.box(nm, [-w / 2, 0.5 + i * 0.5, z], [w, w, 12], "scale" if i % 2 == 0 else "plate")
        m.box(nm, [-1, 0.5 + i * 0.5 + w, z + 3], [2, 3 - i // 3, 5], "plate")                                                # a spine on every segment
        m.box(nm, [-w / 2 - 0.5, 0.5 + i * 0.5, z + 10], [w + 1, w, 2], "plate")                                              # the joint between them
        prev = nm
    m.box("seg5", [-1, 2, 72], [2, 3, 6], "tooth")                                                                             # tail spike
mob(id="dune_wyrm", name="Dune Wyrm", family="wild_hostile", model=m_wyrm, plan="wyrm",
    pal=P(scale={"c": (196, 160, 100), "style": "stone"}, plate={"c": (160, 120, 70), "style": "metal"}, tooth=(240, 230, 210), eye=(30, 20, 10)),
    hp=90, speed=0.28, dmg=10, kb=1.0, collision=(1.8, 1.5), groups="wyrm", region="Emberwaste", egg=("#c4a064", "#a07846"),
    spawn=dict(biomes=["desert", "mesa"], light=None, herd=(1, 1), weight=1, pop="monster"),
    lore="The sand ripples. Then the sand stands up. It hunts by the shake of your footsteps, so stand still or run.")

def m_hag(m):
    biped(m, mats={"head": "skin", "body": "rags", "leg": "rags"}, head=(8, 10, 8), face="eyes", nose=False)
    m.box("head", [-1, 26, -6], [2, 4, 2], "skin"); m.box("head", [-0.5, 25, -7], [1, 2, 1], "skin"); m.box("head", [-2, 23, -4.5], [4, 2, 1], "skin")   # hooked nose, long chin
    m.box("head", [-6, 33, -6], [12, 1, 12], "hat"); m.box("head", [-3.5, 34, -3.5], [7, 4, 7], "hat"); m.box("head", [-2.5, 38, -2], [5, 3, 5], "hat")
    m.box("head", [-1.5, 41, 0], [3, 3, 3], "hat"); m.box("head", [-0.5, 43, 2], [2, 2, 3], "hat")                             # the hat's crooked point
    m.box("body", [-5, 0, -3], [10, 12, 6], "rags"); m.box("body", [-4, 18, 2], [8, 6, 3], "rags")                             # skirts, and a hump
    m.pose("body", [12, 0, 0])
    cloak(m, "rags", length=14)
    hold(m, "staff", haft="hat", long=26, bend=40)
    m.box("staff", [-7.5, 28, -1.5], [3, 2, 3], "hat"); m.box("staff", [-7, 30, 0.5], [1, 2, 1], "hat")                        # gnarled knot at the top
mob(id="bog_hag", name="Bog Hag", family="wild_hostile", model=m_hag,
    pal=P(skin=(120, 140, 90), rags={"c": (60, 64, 40), "style": "fur"}, hat={"c": (40, 36, 30), "style": "cloth"}, eye=(255, 140, 40)),
    hp=30, speed=0.27, dmg=3, ranged_def=("minecraft:splash_potion", 25), region="Blackfen", egg=("#3c4028", "#ff8c28"),
    spawn=dict(biomes=["swamp", "mangrove_swamp"], light=7, herd=(1, 1), weight=4, pop="monster"),
    lore="Throws poison and lays hexes. Old Mag says the hags were her sisters once. Old Mag says a lot of things.")

def m_toad(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 4, 0], "root"); m.box("body", [-5, 2, -5], [10, 6, 10], "skin")
    m.box("body", [-4, 8, -3], [8, 1, 7], "skin"); m.box("body", [-4, 1, -6], [8, 4, 2], "wart")                               # hump, throat sac
    for x, z in ((-3, -1), (2, 1), (-1, 3), (3, -3)): m.box("body", [x, 8.5, z], [1, 1, 1], "wart")
    m.bone("head", [0, 6, -5], "body"); m.box("head", [-5, 5, -9], [10, 4, 5], "skin", face=None)
    m.box("head", [-5, 8, -8], [3, 3, 3], "skin", face="eyes"); m.box("head", [2, 8, -8], [3, 3, 3], "skin", face="eyes")      # eyes that sit up out of the water
    m.box("head", [-5.5, 5, -9.5], [11, 1, 2], "wart")                                                                         # the wide mouth
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * 5; z = sz * 4; m.bone(nm, [x, 2, z], "root"); m.box(nm, [x - 1.5, 0, z - 1.5], [3, 3, 3], "skin", mirror=sx > 0)
        if sz > 0: m.box(nm, [x + sx * 1 - 1.5, 1, z - 3], [4, 5, 5], "skin", mirror=sx > 0)                                  # big folded hind legs
        m.box(nm, [x + sx * 1.5 - 2, 0, z - 3 * (1 if sz < 0 else 1)], [4, 1, 3], "wart", mirror=sx > 0)                       # splayed toes
mob(id="mire_toad", name="Mire Toad", family="wild_hostile", model=m_toad, plan="quad",
    pal=P(skin={"c": (90, 110, 50), "style": "stone"}, wart=(160, 90, 40), eye=(250, 200, 40)),
    hp=16, speed=0.3, dmg=3, collision=(0.8, 0.6), hops=True, region="Blackfen", egg=("#5a6e32", "#fac828"),
    spawn=dict(biomes=["swamp", "mangrove_swamp"], light=None, herd=(1, 3), weight=6, pop="monster"),
    lore="Its tongue reaches six blocks. Its skin is poison, so punching it is a mistake.")

def m_wight(m):
    biped(m, mats={"head": "bone", "body": "mail", "arm": "bone", "leg": "mail", "shoulder": "mail", "bracer": "crown", "belt": "crown"}, face="glow", nose=False)
    m.box("head", [-4.5, 31, -4.5], [9, 2, 9], "crown")
    for x, z in ((-4.5, -4.5), (3.5, -4.5), (-0.5, -4.5), (-4.5, 3.5), (3.5, 3.5)): m.box("head", [x, 33, z], [1, 2, 1], "crown")
    m.box("head", [-3, 22, -4], [6, 2, 3], "bone")                                                                             # jaw
    for y in (16, 19): m.box("body", [-3.5, y, -3.2], [7, 1, 1], "bone")                                                       # ribs through the rusted mail
    m.box("body", [-4.5, 3, -2.5], [9, 10, 5], "shroud"); m.box("body", [-3.5, 0, -2.5], [3, 3, 5], "shroud"); m.box("body", [1.5, 1, -2.5], [2, 2, 5], "shroud")
    cloak(m, "shroud", length=20)
    hold(m, "sword", blade="mail", hilt="crown", long=15)
mob(id="barrow_wight", name="Barrow Wight", family="undead", model=m_wight,
    pal=P(bone={"c": (200, 196, 176), "style": "bone"}, mail={"c": (80, 84, 80), "style": "metal"}, crown={"c": (150, 130, 70), "style": "metal"}, shroud={"c": (50, 60, 56), "style": "cloth"}, eye=(120, 255, 180)),
    hp=34, speed=0.28, dmg=6, region="Aldmere Vale", burns=True, egg=("#c8c4b0", "#78ffb4"),
    spawn=dict(biomes=["plains", "forest"], light=7, herd=(1, 2), weight=5, pop="monster"),
    lore="A knight buried with his crown and his grudge. Every hit it lands heals it. The Vale's barrows are full of them.")

# ======================================================================================
# Family 4: Order of the Ashen Gate (friend or enemy depending on path)
# ======================================================================================
def m_squire(m):
    biped(m, mats={"head": "skin", "body": "tabard", "arm": "mail", "leg": "pants", "belt": "pants"}, face="eyes")
    m.box("head", [-4.5, 29, -4.5], [9, 4, 9], "helm"); m.box("head", [-4.5, 24, 1.5], [9, 5, 3], "helm"); m.box("head", [-0.5, 27, -5], [1, 3, 1], "helm")   # open helm with a nasal bar
    m.box("body", [-4.5, 8, -2.5], [9, 4, 5], "tabard"); m.box("body", [-1, 16, -3.2], [2, 4, 1], "steel")                    # tabard skirt, the Gate's badge
    hold(m, "sword", blade="steel", hilt="pants", long=12)
    shield(m, size=(8, 10), shield="tabard", trim="helm")
mob(id="ashen_squire", name="Ashen Squire", family="order", model=m_squire,
    pal=P(skin=SKIN, tabard={"c": (200, 196, 190), "style": "cloth"}, mail={"c": (120, 122, 128), "style": "metal"}, pants=(60, 60, 64), helm=IRON, steel=IRON, eye=(60, 80, 110)),
    hp=24, speed=0.3, dmg=5, egg=("#c8c4be", "#5a5a64"),
    lore="Young, loyal, and certain the Order has nothing to hide.")

def m_knight(m):
    biped(m, mats={"head": "plate", "body": "tabard", "arm": "plate", "leg": "plate", "belt": "shield"}, face=None, nose=False)
    m.box("head", [-4.5, 24, -4.5], [9, 9, 9], "plate", face="visor"); m.box("head", [-0.5, 33, -3], [1, 2, 7], "plume"); m.box("head", [-0.5, 35, 0], [1, 2, 5], "plume"); m.box("head", [-0.5, 31, 4.5], [1, 3, 2], "plume")
    m.box("body", [-4.5, 12, -2.5], [9, 12, 5], "tabard", inflate=0.1); m.box("body", [-4.5, 7, -2.5], [9, 5, 5], "tabard"); m.box("body", [-1, 16, -3.3], [2, 5, 1], "shield"); m.box("body", [-2, 18, -3.3], [4, 1, 1], "shield")
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 6 - 2.5 + s * 0.5, 22, -3], [5, 3, 6], "plate")               # pauldrons
    cloak(m, "plume", length=19)
    hold(m, "sword", blade="steel", hilt="shield", long=16)
    shield(m, size=(10, 13), shield="shield", trim="plate", kite=True)
mob(id="ashen_knight", name="Ashen Knight", family="order", model=m_knight,
    pal=P(plate={"c": (178, 182, 190), "style": "metal"}, tabard={"c": (210, 206, 198), "style": "cloth"}, plume=(160, 30, 30), steel=IRON, shield={"c": (90, 90, 96), "style": "metal"}, eye=(30, 30, 40)),
    hp=44, speed=0.29, dmg=8, kb=0.6, resist=dict(projectile=0.5), egg=("#b2b6be", "#a01e1e"),
    lore="Sworn to the Ashen Gate. An honest blade. Ask what the Gate guards and the conversation ends.")

def m_inquisitor(m):
    biped(m, mats={"head": "skin", "body": "coat", "arm": "coat", "leg": "coat", "belt": "hat"}, face="eyes")
    m.box("head", [-6, 31, -6], [12, 1, 12], "hat"); m.box("head", [-4, 32, -4], [8, 4, 8], "hat"); m.box("head", [-4.2, 32, -4.2], [9, 1, 9], "sigil")   # wide hat with a brass band
    m.box("head", [-4.5, 24, -4.6], [9, 3, 1], "hat")                                                                          # a cloth over the mouth
    m.box("body", [-4.5, 2, -2.5], [9, 10, 5], "coat"); m.box("body", [-5, 20, -3], [10, 4, 6], "coat", inflate=0.2); m.box("body", [-1, 16, -3.2], [2, 5, 1], "sigil"); m.box("body", [-2, 18, -3.2], [4, 1, 1], "sigil")
    cloak(m, "coat", length=20)
    hold(m, "crossbow", haft="hat", blade="sigil")
mob(id="inquisitor", name="Inquisitor", family="order", model=m_inquisitor,
    pal=P(skin=SKIN, coat={"c": (40, 36, 38), "style": "cloth"}, hat={"c": (28, 26, 28), "style": "cloth"}, sigil=GOLD, eye=(200, 60, 40)),
    hp=36, speed=0.3, dmg=4, ranged_def=("minecraft:arrow", None), hunts_marked=True, egg=("#282428", "#c83c28"),
    lore="Hunts Sorcerers. Near one, the Ember goes quiet: no spells, nothing answering, just you and a crossbow.")

# ======================================================================================
# Bosses
# ======================================================================================
BOSSES = []
def boss(**kw): kw["boss"] = True; BOSSES.append(kw); MOBS.append(kw); return kw

def m_reeve(m, small=False):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-8, 14, -6], [16, 18, 12], "brass"); m.box("body", [-9, 30, -7], [18, 2, 14], "iron"); m.box("body", [-9, 13, -7], [18, 2, 14], "iron")
    m.box("body", [-5, 17, -7], [10, 11, 1], "wood"); m.box("body", [-6, 16, -7.5], [12, 1, 1], "iron"); m.box("body", [-6, 28, -7.5], [12, 1, 1], "iron")   # the pendulum case door
    for x in (-8.5, 7.5): m.box("body", [x, 15, -6.5], [1, 15, 1], "iron"); m.box("body", [x, 15, 5.5], [1, 15, 1], "iron")                                  # riveted corner posts
    m.bone("pendulum", [0, 27, -7.5], "body"); m.box("pendulum", [-0.5, 19, -8], [1, 8, 1], "iron"); m.box("pendulum", [-2, 16, -8.5], [4, 4, 1], "gear")
    m.bone("head", [0, 32, 0], "body"); m.box("head", [-6, 32, -5], [12, 12, 10], "wood", face="clock")
    m.box("head", [-7, 43, -6], [14, 2, 12], "wood"); m.box("head", [-5, 45, -4], [10, 1, 8], "wood"); m.box("head", [-1, 46, -1], [2, 3, 2], "brass")       # cornice and finial
    m.box("head", [-7, 32, -5.5], [1, 11, 1], "brass"); m.box("head", [6, 32, -5.5], [1, 11, 1], "brass")                                                     # brass pillars beside the face
    m.bone("hand_minute", [0, 38, -5.2], "head"); m.box("hand_minute", [-0.5, 38, -5.4], [1, 5, 0], "iron")
    m.bone("hand_hour", [0, 38, -5.3], "head"); m.box("hand_hour", [0, 37.5, -5.5], [3, 1, 0], "iron")
    for i, (x, y, r) in enumerate(((-9, 26, 6), (9, 22, 5), (0, 34, 4))):
        nm = f"gear{i}"; m.bone(nm, [x, y, 7], "body"); m.box(nm, [x - r, y - r, 6], [2 * r, 2 * r, 2], "gear")
        m.box(nm, [x - r - 1, y - 1, 6.5], [2 * r + 2, 2, 1], "gear"); m.box(nm, [x - 1, y - r - 1, 6.5], [2, 2 * r + 2, 1], "gear"); m.box(nm, [x - 1, y - 1, 8], [2, 2, 1], "iron")   # teeth and axle
    m.bone("key", [0, 22, 9], "body"); m.box("key", [-0.5, 21.5, 8], [1, 1, 5], "brass"); m.box("key", [-4, 19, 13], [3, 6, 1], "brass"); m.box("key", [1, 19, 13], [3, 6, 1], "brass"); m.box("key", [-1, 21, 13], [2, 2, 1], "brass")   # the winding key in its back
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 10, 30, 0], "body"); m.box(nm, [s * 10 - 2, 12, -2], [4, 18, 4], "iron", mirror=s > 0); m.box(nm, [s * 10 - 3, 8, -3], [6, 4, 6], "brass")
        m.box(nm, [s * 10 - 3, 27, -3], [6, 5, 6], "brass", mirror=s > 0); m.box(nm, [s * 10 - 2.5, 19, -2.5], [5, 2, 5], "gear", mirror=s > 0)                # shoulder housing, elbow collar
        for t in (-2.5, -0.5, 1.5): m.box(nm, [s * 10 + t, 5, -3], [1, 3, 2], "iron")                                                                           # three iron fingers
    for s, nm in ((-1, "leg_r"), (1, "leg_l")):
        m.bone(nm, [s * 4, 14, 0], "root"); m.box(nm, [s * 4 - 2.5, 0, -2.5], [5, 14, 5], "iron", mirror=s > 0)
        m.box(nm, [s * 4 - 3, 6, -3], [6, 2, 6], "gear", mirror=s > 0); m.box(nm, [s * 4 - 3.5, 0, -5], [7, 2, 9], "brass", mirror=s > 0)                      # knee collar, cast foot
REEVE_PAL = P(brass=GOLD, iron=DARKIRON, wood=WOOD, gear={"c": (184, 140, 60), "style": "metal"})
boss(id="clockwork_reeve", name="The Clockwork Reeve", region="Aldmere Vale", model=m_reeve, pal=REEVE_PAL,
     hp=320, speed=0.25, dmg=9, kb=1.0, collision=(1.4, 2.9), egg=("#dab046", "#46464f"),
     anim_extra=[("gear0", "rotation", ["0", "0", "query.life_time*90"]), ("gear1", "rotation", ["0", "0", "-query.life_time*120"]),
                 ("gear2", "rotation", ["0", "0", "query.life_time*160"]), ("hand_minute", "rotation", ["0", "0", "-query.life_time*360"]),
                 ("hand_hour", "rotation", ["0", "0", "-query.life_time*30"]), ("pendulum", "rotation", ["0", "0", "math.sin(query.life_time*180)*25"])],
     lore="Millbrook's town clock, given legs. It is keeping one minute safe, and it will not let that minute end.")
mob(id="reeve_cog", name="Reeve's Cog", family="boss_add", model=m_reeve, pal=REEVE_PAL, scale=0.55, hp=60, speed=0.32, dmg=6,
    collision=(0.8, 1.6), egg=("#b88c3c", "#46464f"), no_loot=True, anim_extra=[("gear0", "rotation", ["0", "0", "query.life_time*200"])],
    lore="A third of the Reeve, ticking on its own.")

def m_huntsman(m):
    biped(m, L=16, B=14, bw=7, bd=4, head=(7, 8, 7), arm=(3, 16, 3), mats={"head": "skull", "body": "cloak", "arm": "pale", "leg": "leather", "belt": "leather", "bracer": "leather"}, face="blank", nose=False)
    # a stag's skull worn as a face: the muzzle narrows in two steps, dark sockets with a cold light deep inside
    m.box("head", [-2.5, 30, -7.5], [5, 4, 4], "skull"); m.box("head", [-1.5, 30, -11.5], [3, 3, 4], "skull")                 # muzzle, then the narrow snout
    m.box("head", [-0.5, 31, -11.8], [1, 2, 1], "void"); m.box("head", [-1.5, 33, -10.5], [3, 1, 3], "void", inflate=-0.3)     # nasal slit, the open nose cavity on top
    m.box("head", [-1.5, 28.4, -10.5], [3, 1, 7], "jaw"); m.box("head", [-2.5, 28.4, -4.5], [5, 2, 2], "jaw")                  # the loose lower jaw, hanging a little open
    for x in (-1.5, 0.5): m.box("head", [x, 29.3, -11], [1, 1, 1], "skull")                                                    # front teeth
    m.box("head", [-4, 35.5, -4.5], [8, 1, 2], "skull")                                                                        # heavy brow
    for s in (-1, 1):
        m.box("head", [s * 2.25 - 1, 33.5, -3.9], [2, 2, 1], "void"); m.box("head", [s * 2.25 - 0.5, 34, -4.1], [1, 1, 1], "eye")   # sockets, the light in them
        m.box("head", [s * 4.25 - 1, 36, -1], [2, 1, 1], "antler")                                                             # the rack grows from the sides of the skull
        m.box("head", [s * 5.5 - 0.5, 36, -1], [1, 8, 1], "antler"); m.box("head", [s * 7 - 1, 43, -1], [2, 1, 1], "antler"); m.box("head", [s * 8.5 - 0.5, 43, -1], [1, 8, 1], "antler")
        m.box("head", [s * 5.5 - 0.5, 40, -4], [1, 1, 3], "antler"); m.box("head", [s * 5.5 - 0.5, 40, -5], [1, 4, 1], "antler")
        m.box("head", [s * 10 - 1, 47, -1], [2, 1, 1], "antler"); m.box("head", [s * 11.5 - 0.5, 47, -1], [1, 6, 1], "antler"); m.box("head", [s * 8.5 - 0.5, 50, 0], [1, 1, 3], "antler"); m.box("head", [s * 8.5 - 0.5, 50, 2], [1, 4, 1], "antler")
    for y in (22, 25): m.box("body", [-3, y, -2.6], [6, 1, 1], "skull")                                                        # ribs under the open cloak
    cloak(m, "cloak", length=27, width=10); m.box("body", [-5.5, 27, -3.5], [11, 4, 8], "cloak", inflate=0.3)                  # a pelt over the shoulders
    m.box("cloak", [2, 14, 4], [3, 14, 3], "leather"); 
    for dx in (2, 3, 4): m.box("cloak", [dx, 28, 4.5 + (dx % 2)], [1, 3, 1], "antler")                                         # quiver and fletchings
    hold(m, "bow", side="l", haft="antler", long=26)
BOSS_HUNT = P(skull={"c": (226, 226, 220), "style": "bone"}, jaw={"c": (186, 184, 172), "style": "bone"}, void=(14, 18, 26), cloak={"c": (190, 200, 210), "style": "fur"}, pale=(210, 214, 216), leather={"c": (90, 80, 76), "style": "cloth"}, antler={"c": (200, 226, 240), "style": "bone"}, eye=(140, 230, 255))
boss(id="pale_huntsman", name="The Pale Huntsman", region="Frostmarch", model=m_huntsman, pal=BOSS_HUNT,
     hp=360, speed=0.33, dmg=8, kb=0.7, collision=(0.9, 3.0), ranged_def=("minecraft:arrow", None), egg=("#e2e2dc", "#8ce6ff"),
     lore="He led Rimehold's hunters onto the frozen lake one night, and only he walked back off it.")

def m_bride(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 12, 0], "root")
    m.box("body", [-6, 0, -5], [12, 12, 10], "dress"); m.box("body", [-4, 12, -2.5], [8, 12, 5], "dress")
    m.box("body", [-7, 0, -6], [14, 4, 13], "dress"); m.box("body", [-5, 0, 7], [10, 2, 8], "dress"); m.box("body", [-3, 0, 15], [6, 1, 6], "dress")       # hem and the train behind her
    m.box("body", [-4.5, 11, -3], [9, 2, 6], "veil"); m.box("body", [-3, 19, -3.2], [6, 3, 1], "veil")                                                      # sash, lace at the collar
    m.bone("head", [0, 24, 0], "body"); m.box("head", [-4, 24, -4], [8, 8, 8], "skin", face="hollow"); m.box("head", [-4.5, 23, -4.5], [9, 10, 9], "veil", inflate=0.3)
    m.box("head", [-5, 8, 3.5], [10, 24, 1], "veil"); m.box("head", [-6, 2, 4.5], [12, 8, 1], "veil")                                                       # veil falling down her back
    for x in (-4, -2, 0, 2, 4): m.box("head", [x - 0.5, 33, -2 + abs(x) * 0.5], [1, 2 if x else 3, 1], "pearl")                                             # a comb of pearls
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 5, 22, 0], "body"); m.box(nm, [s * 5 - 1.5, 8, -1.5], [3, 14, 3], "skin", mirror=s > 0)
        m.box(nm, [s * 5 - 2, 15, -2], [4, 8, 4], "dress", mirror=s > 0); m.box(nm, [s * 5 - 2.5, 13, -2.5], [5, 3, 5], "veil", mirror=s > 0)               # sleeve and lace cuff
    m.box("arm_l", [4.5, 9, -2], [1, 1, 4], "pearl")                                                                                                         # the ring
boss(id="drowned_bride", name="The Drowned Bride", region="Saltreach", model=m_bride, plan="float", material="entity_alphablend",
     pal=P(dress={"c": (190, 210, 214, 220), "style": "cloth"}, pearl={"c": (226, 240, 236), "style": "glow"}, skin=(150, 180, 176), veil={"c": (220, 236, 240, 150), "style": "cloth"}, eye=(160, 250, 230)),
     hp=320, speed=0.27, dmg=8, kb=1.0, fly=0.3, swim=True, collision=(1.0, 2.2), egg=("#bed2d6", "#a0fae6"),
     lore="The lighthouse keeper still writes to her. She has been answering, from three hundred years under the water.")

def m_seneschal(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "face", "body": "plate", "arm": "plate", "leg": "plate", "belt": "gold"}, face="blank", nose=False)
    m.box("body", [-5.5, 14, -3.5], [11, 16, 7], "tabard", inflate=0.1); m.box("body", [-5.5, 6, -3.5], [11, 8, 7], "tabard"); m.box("body", [-1, 8, -3.8], [2, 18, 1], "gold")   # long tabard with a gold stripe
    m.box("head", [-4.5, 38, -4.5], [9, 2, 9], "gold"); m.box("head", [-4.5, 30, 0], [9, 8, 5], "plate"); m.box("head", [-5, 30, -2], [1, 8, 3], "plate"); m.box("head", [4, 30, -2], [1, 8, 3], "plate")   # circlet, an open-faced coif of plate
    for s in (-1, 1):
        nm = "arm_r" if s < 0 else "arm_l"
        m.box(nm, [s * 7.5 - 3.5, 27, -4], [7, 4, 8], "plate"); m.box(nm, [s * 7.5 - 3, 31, -3], [6, 1, 6], "gold")                                          # layered pauldrons
    cloak(m, "tabard", length=26, width=12)
    hold(m, "mace", bone="mainhand", haft="plate", blade="gold", long=18)
    shield(m, size=(16, 26), shield="shield", trim="gold", kite=True)
boss(id="ash_seneschal", name="The Ash Seneschal", region="Emberwaste", model=m_seneschal,
     pal=P(face={"c": (200, 190, 170), "style": "stone"}, plate={"c": (90, 80, 76), "style": "metal"}, tabard={"c": (150, 60, 30), "style": "cloth"}, gold=GOLD, shield={"c": (120, 100, 80), "style": "metal"}),
     hp=420, speed=0.27, dmg=12, kb=1.0, collision=(1.2, 3.2), scale=1.1, resist=dict(fire=True), egg=("#5a504c", "#963c1e"),
     lore="Sunscar chiseled a face off every statue. The Seneschal chiseled off his own.")

def m_mother(m):
    biped(m, L=18, B=16, bw=8, bd=5, head=(8, 9, 8), arm=(3, 28, 3), mats={"head": "skin", "body": "moss", "arm": "skin", "leg": "root"}, face="glow", nose=False, detail=False)
    for s in (-1, 1):                                                                                                          # a crown of roots, like antlers grown wrong
        m.box("head", [s * 3 - 0.5, 43, 0], [1, 6, 1], "root"); m.box("head", [s * 5 - 0.5, 46, 0], [1, 6, 1], "root"); m.box("head", [s * 4 - 1, 46, 0], [2, 1, 1], "root")
        m.box("head", [s * 6.5 - 1, 49, 0], [2, 1, 1], "root"); m.box("head", [s * 8 - 0.5, 49, 0], [1, 4, 1], "root"); m.box("head", [s * 3 - 0.5, 47, -2], [1, 1, 2], "root"); m.box("head", [s * 3 - 0.5, 47, -3], [1, 3, 1], "root")
        nm = "arm_r" if s < 0 else "arm_l"
        for dx, dz, n in ((-1, -1, 5), (0, 0, 7), (1, 1, 4)): m.box(nm, [s * 5.5 + dx - 0.5, 6 - n, dz - 0.5], [1, n, 1], "root")   # root fingers that reach her knees
        m.box(nm, [s * 5.5 - 2, 28, -2], [4, 5, 4], "moss")
        leg = "leg_r" if s < 0 else "leg_l"
        m.box(leg, [s * 2 - 3, 0, -4], [6, 2, 8], "root"); m.box(leg, [s * 4 - 0.5, 0, -6], [1, 1, 3], "root"); m.box(leg, [s * 1 - 0.5, 0, 4], [1, 1, 3], "root")   # feet that are roots
    m.box("head", [-4.5, 34, -1], [9, 10, 6], "moss"); m.box("head", [-3, 30, 4], [6, 6, 2], "moss")                           # a mane of moss
    m.box("body", [-5, 4, -3], [10, 14, 6], "moss"); m.box("body", [-6, 0, -4], [12, 5, 8], "moss"); m.box("body", [-5, 30, -3.5], [10, 4, 7], "moss")
    for y in (22, 25, 28): m.box("body", [-3, y, -3.2], [6, 1, 1], "root")
MOTHER_PAL = P(skin=(130, 150, 110), moss={"c": (60, 80, 44), "style": "fur"}, root={"c": (80, 60, 40), "style": "wood"}, eye=(255, 230, 80))
boss(id="mother_of_changelings", name="The Mother of Changelings", region="Blackfen", model=m_mother, pal=MOTHER_PAL,
     hp=380, speed=0.3, dmg=9, kb=0.8, collision=(1.0, 3.4), egg=("#3c502c", "#ffe650"),
     lore="Every changeling in Mirelight is one of her children. She hides among them, and she has a true name she would kill to keep.")
mob(id="mother_echo", name="The Mother of Changelings", family="boss_add", model=m_mother, pal=MOTHER_PAL, hp=10, speed=0.3, dmg=4,
    collision=(1.0, 3.4), egg=("#3c502c", "#a0a050"), no_loot=True, lore="One of her masks.")

def m_king(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate", "belt": "crown"}, face=None, nose=False)
    m.box("head", [-4.5, 30, -4.5], [9, 9, 9], "plate", face="visor"); m.box("head", [-5, 39, -5], [10, 2, 10], "crown")
    for x in (-5, -1, 3): m.box("head", [x, 41, -5], [2, 3, 1], "crown"); m.box("head", [x, 41, 4], [2, 2, 1], "crown")
    for z in (-2, 1): m.box("head", [-5, 41, z], [1, 2, 2], "crown"); m.box("head", [4, 41, z], [1, 2, 2], "crown")
    m.box("head", [-1, 41, -5.5], [2, 2, 1], "shard")
    for s in (-1, 1):
        nm = "arm_r" if s < 0 else "arm_l"
        m.box(nm, [s * 7.5 - 3.5, 27, -4], [7, 4, 8], "plate"); m.box(nm, [s * 9 - 0.5, 31, -0.5], [1, 3, 1], "crown"); m.box(nm, [s * 7 - 0.5, 31, -2.5], [1, 2, 1], "crown")   # spiked pauldrons
    m.box("body", [-5.5, 8, -3.5], [11, 6, 7], "cape"); m.box("body", [-2, 20, -3.8], [4, 6, 1], "crown")                     # war-skirt, a breastplate device
    cloak(m, "cape", length=27, width=12)
    hold(m, "greatsword", bone="blade", blade="steel", hilt="crown")
boss(id="warlord_king", name="The Warlord King", region="Grand Siege", model=m_king,
     pal=P(skin=SKIN, plate={"c": (56, 50, 54), "style": "metal"}, crown=GOLD, shard={"c": (200, 220, 255), "style": "glow"}, cape={"c": (110, 20, 24), "style": "cloth"}, steel=IRON, eye=(255, 60, 40)),
     hp=300, speed=0.3, dmg=12, kb=1.0, collision=(1.2, 3.0), scale=1.05, raider=True, egg=("#383236", "#dab046"),
     lore="Something in his crown catches the light wrong. He has lost before. He keeps coming back.")

def hollow_crown(m, top, bone="hcrown", parent="head"):
    """The Hollow Crown, as on the wearable one (studio/art/build_crown_art.py): dark violet cracked stone, jagged spikes
    leaning out, magenta veins, pale blue gems on the band, an amethyst shard in the tall front spike and a small blue
    crystal floating in its opening. Sits on an 8-wide head whose top is at `top`. Own bone, so it can be knocked off."""
    y = top - 1
    m.bone(bone, [0, top, 0], parent)
    B = lambda o, sz, mt, **k: m.box(bone, o, sz, mt, **k)
    B([-5, y, -5], [10, 2, 1], "hstone"); B([-5, y, 4], [10, 2, 1], "hstone"); B([-5, y, -4], [1, 2, 8], "hstone"); B([4, y, -4], [1, 2, 8], "hstone")   # the band
    for x in (-4, 3): B([x, y + 0.5, -5.3], [1, 1, 1], "hgem")                                                                    # gems on the band
    B([-5.3, y + 0.5, -1], [1, 1, 2], "hgem"); B([4.3, y + 0.5, -1], [1, 1, 2], "hgem")
    B([-2, y + 2, -5], [1, 4, 1], "hstone"); B([1, y + 2, -5], [1, 4, 1], "hstone"); B([-2, y + 6, -5], [4, 1, 1], "hstone"); B([-1, y + 7, -5], [2, 1, 1], "hstone")   # the tall front spike, open in the middle
    B([-0.5, y + 8, -5], [1, 3, 1], "hvein"); B([-0.5, y + 11, -5], [1, 1, 1], "hvein", inflate=-0.2)                             # the amethyst shard
    B([-0.5, y + 3.25, -5], [1, 2, 1], "hgem", inflate=-0.15)                                                                     # the crystal floating in the opening
    B([-1.5, y + 2, -5.2], [1, 3, 1], "hvein", inflate=-0.3); B([0.5, y, -5.2], [1, 2, 1], "hvein", inflate=-0.3)                 # veins
    for sx in (-1, 1):
        for sz in (-1, 1):                                                                                                        # corner spikes lean outward
            x = -5 if sx < 0 else 4; z = -5 if sz < 0 else 4; piv = [x + 0.5, y + 2, z + 0.5]; rot = [10 * sz, 0, 10 * sx]
            B([x, y + 2, z], [1, 4, 1], "hstone", rot=rot, pivot=piv); B([x, y + 6, z], [1, 2, 1], "hstone", inflate=-0.2, rot=rot, pivot=piv)
        x = -5 if sx < 0 else 4; piv = [x + 0.5, y + 2, 0]
        B([x, y + 2, -0.5], [1, 3, 1], "hstone", rot=[0, 0, 8 * sx], pivot=piv); B([x, y + 5, -0.5], [1, 1, 1], "hvein", inflate=-0.2, rot=[0, 0, 8 * sx], pivot=piv)
    B([-0.5, y + 2, 4], [1, 3, 1], "hstone", rot=[8, 0, 0], pivot=[0, y + 2, 4.5]); B([-0.5, y + 5, 4], [1, 2, 1], "hstone", inflate=-0.2, rot=[8, 0, 0], pivot=[0, y + 2, 4.5])
HCROWN = dict(hstone={"c": (58, 40, 78), "style": "stone"}, hvein={"c": (230, 70, 200), "style": "glow"}, hgem={"c": (120, 190, 255), "style": "glow"})


# ---------- Pretenders: claimants who rise in the Hollow after Morvane falls (scripts/bestiary/pretenders.js) ----------
# Three bodies; the name, the powers and the claim are generated per Pretender, so no two are the same fight.
def m_pretender_blade(m):
    biped(m, L=13, B=14, bw=9, bd=5, head=(8, 8, 8), arm=(4, 14, 4), mats={"head": "plate", "body": "plate", "arm": "plate", "leg": "plate", "belt": "trim"}, face="visor", nose=False)
    m.box("head", [-4.5, 35, -4.5], [9, 1, 9], "hstone")
    for x, h in ((-4.5, 3), (-1.5, 1), (1.5, 4), (3.5, 2)): m.box("head", [x, 36, -4.5], [1, h, 1], "hstone")   # half a crown: he made it himself
    m.box("head", [1.5, 38, -4.7], [1, 1, 1], "hvein", inflate=-0.2)
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 6.5 - 3, 24, -3], [6, 4, 6], "plate")
    m.box("body", [-1, 17, -3], [2, 7, 1], "hvein", inflate=-0.2)                                                # a vein of the Hollow up the breastplate
    cloak(m, "cape", length=24, width=11)
    hold(m, "greatsword", bone="blade", blade="steel", hilt="trim")
def m_pretender_seer(m):
    biped(m, L=12, B=13, bw=8, bd=4, mats={"head": "skin", "body": "robe", "arm": "robe", "leg": "robe", "belt": "trim"}, face="eyes")
    cloak(m, "hood", hood=True, length=22)
    m.box("body", [-4.5, 0, -2.5], [9, 12, 5], "robe"); m.box("body", [-0.5, 2, -2.8], [1, 21, 1], "hvein", inflate=-0.2)
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 6 - 2.5, 12, -2.5], [5, 5, 5], "robe")
    m.bone("shards", [0, 36, 0], "head")
    for x, y, z in ((-5, 35, -2), (4, 36, 1), (-1, 38, 4), (0, 37, -5)): m.box("shards", [x, y, z], [1, 3, 1], "hgem", inflate=-0.15)   # a crown that will not settle: shards hang round the head
    hold(m, "staff", bone="blade", haft="trim", orb="hvein", long=30)
def m_pretender_brute(m):
    biped(m, L=12, B=16, bw=14, bd=8, head=(8, 8, 8), arm=(6, 18, 6), mats={"head": "skin", "body": "hide", "arm": "skin", "leg": "hide", "belt": "trim"}, face="eyes")
    horns(m, "hstone", up=6, out=4)
    m.box("head", [-4.5, 35, -4.5], [9, 1, 9], "hstone"); m.box("head", [-0.5, 36, -4.5], [1, 2, 1], "hvein", inflate=-0.2)
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 10 - 4, 26, -4.5], [8, 4, 9], "hstone")           # stone on the shoulders
    m.box("body", [-7.5, 10, -4.5], [15, 4, 9], "trim")
    hold(m, "axe", bone="blade", blade="steel", haft="trim")
PRETENDER = dict(HCROWN, trim={"c": (92, 62, 120), "style": "metal"}, steel={"c": (150, 140, 176), "style": "metal"}, eye=(230, 70, 200))
boss(id="pretender_blade", name="The Pretender", region="The Hollow, after the story", model=m_pretender_blade,
     pal=P(plate={"c": (60, 52, 78), "style": "metal"}, cape={"c": (70, 30, 96), "style": "cloth"}, **PRETENDER),
     hp=420, speed=0.3, dmg=11, kb=0.9, collision=(1.0, 2.6), scale=1.05, egg=("#3c344e", "#e646c8"),
     lore="Somebody always thinks the Seat is empty. This one brought a sword and half a crown.")
boss(id="pretender_seer", name="The Pretender", region="The Hollow, after the story", model=m_pretender_seer,
     pal=P(skin=PALE, robe={"c": (48, 36, 70), "style": "cloth"}, hood={"c": (38, 28, 58), "style": "cloth"}, **PRETENDER),
     hp=360, speed=0.28, dmg=9, kb=0.6, collision=(0.9, 2.4), egg=("#302446", "#78beff"),
     lore="It heard the Hollow had no voice now, and came to be one.")
boss(id="pretender_brute", name="The Pretender", region="The Hollow, after the story", model=m_pretender_brute,
     pal=P(skin=GREY, hide={"c": (66, 54, 60), "style": "cloth"}, **PRETENDER),
     hp=520, speed=0.26, dmg=13, kb=1.0, collision=(1.5, 3.0), scale=1.1, egg=("#42363c", "#3a284e"),
     lore="It does not want to rule anything. It wants nobody else to.")

def m_oswin(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate", "belt": "crown"}, face="hollow")
    hollow_crown(m, 39)                                                                                                        # he wears the Hollow Crown itself (Mateo). Stage 7 knocks it off: event siege:bare_on
    m.box("head", [-4.5, 30, 1], [9, 9, 4], "tabard")                                                                          # hair gone the colour of the water
    for s in (-1, 1):
        nm = "arm_r" if s < 0 else "arm_l"
        m.box(nm, [s * 7.5 - 3.5, 27, -4], [7, 4, 8], "plate"); m.box(nm, [s * 7.5 - 3, 31, -3], [6, 1, 6], "crown")
    m.box("body", [-5.5, 14, -3.5], [11, 16, 7], "tabard", inflate=0.1); m.box("body", [-5.5, 5, -3.5], [11, 9, 7], "tabard"); m.box("body", [-1.5, 19, -3.9], [3, 5, 1], "crown")
    cloak(m, "cape", length=29, width=12); m.box("cloak", [-7, 0, 5], [14, 2, 6], "cape")                                      # the cloak pools behind him
    hold(m, "greatsword", side="l", bone="blade", blade="steel", hilt="crown", long=24)   # LEFT-handed: his right hand took the splinter of the Crown and never served him again
OSWIN_PAL = P(skin=(150, 170, 170), plate={"c": (60, 84, 90), "style": "metal"}, crown={"c": (96, 92, 110), "style": "metal"}, void=(6, 4, 10), **HCROWN, cape={"c": (40, 60, 80), "style": "cloth"}, tabard={"c": (90, 110, 120), "style": "cloth"}, steel={"c": (150, 190, 200), "style": "metal"}, eye=(138, 142, 150))   # grey-eyed; he fights left-handed (the boy in the reveal writes with his right: that contrast is the point)
boss(id="oswin_the_last", name="Morvane", region="The Hollow", model=m_oswin, pal=OSWIN_PAL,
     hp=1000, speed=0.31, dmg=13, kb=1.0, collision=(1.2, 3.0), scale=1.05, bare_flag=True, anim_extra=[("hcrown", "scale", "query.is_charged ? 0 : 1")],
     swim=True, egg=("#3c5460", "#c8f0ff"),
     lore="He holds the Seat at the bottom of the Hollow, and he has been waiting a long time for someone to get this far.")
mob(id="oswin_reflection", name="Standing Rank", family="boss_add", model=m_oswin, material="entity_alphablend",
    pal={**OSWIN_PAL, "plate": {"c": (170, 210, 230, 170), "style": "metal"}, "cape": {"c": (120, 160, 200, 150), "style": "cloth"}, "tabard": {"c": (150, 190, 210, 160), "style": "cloth"}, "skin": (190, 220, 230, 190)},
    hp=120, speed=0.33, dmg=9, kb=1.0, collision=(1.2, 3.0), scale=1.05, egg=("#a0d2e6", "#ffffff"), no_loot=True,
    lore="Empty armour in his shape, standing in ranks. One of them is not empty.")

# ---------- the Grey Host: the army the Hollow took, every man, in the space of one bell. Sent back up. ----------
GREYHOST = dict(skin=(150, 156, 160), surcoat={"c": (96, 108, 116), "style": "cloth"}, mail={"c": (120, 124, 130), "style": "metal"}, helm={"c": (104, 110, 112), "style": "metal"},
                bronze={"c": (120, 112, 84), "style": "metal"}, leather=(62, 58, 56), rime=(206, 226, 236), wood={"c": (84, 80, 78), "style": "wood"}, eye=(170, 200, 215))
def greyhost_base(m, heavy=False):
    biped(m, bw=9 if heavy else 8, mats={"head": "skin", "body": "surcoat", "arm": "mail", "leg": "leather", "belt": "leather", "shoulder": "helm", "bracer": "bronze"}, face="hollow")
    top = m.d["top"]
    m.box("head", [-4.5, top - 4, -4.5], [9, 5, 9], "helm"); m.box("head", [-3.5, top + 1, -3.5], [7, 2, 7], "helm"); m.box("head", [-1.5, top + 3, -1.5], [3, 2, 3], "helm")   # an old conical helm
    m.box("head", [-0.5, top - 8, -5], [1, 5, 1], "helm")                                                                         # nasal bar
    m.box("head", [-4.5, top - 8, 2.5], [9, 5, 2], "mail")                                                                        # aventail
    m.box("body", [-4.5, 7, -2.5], [9, 5, 5], "surcoat"); m.box("body", [-1.5, 15, -2.6], [3, 6, 1], "bronze")                    # long surcoat, a device nobody remembers
    for x in (-4, 2): m.box("head", [x, top + 1, -4], [2, 1, 2], "rime")                                                          # three hundred years of frost that never melted
    m.box("body", [-5, 22, -3], [3, 1, 6], "rime"); m.box("body", [2, 23, -3], [3, 1, 6], "rime")
def m_grey_spear(m):
    greyhost_base(m); hold(m, "spear", haft="wood", blade="helm", long=30); shield(m, size=(9, 9), shield="surcoat", trim="bronze")
def m_grey_bow(m):
    greyhost_base(m); cloak(m, "surcoat", length=14, width=9)
    m.box("cloak", [1, 12, 3.5], [3, 12, 3], "leather")
    for dx in (1, 2, 3): m.box("cloak", [dx, 24, 4 + dx % 2], [1, 3, 1], "rime")                                                  # quiver, frozen fletchings
    hold(m, "bow", side="l", haft="wood", long=20)
def m_grey_serjeant(m):
    greyhost_base(m, heavy=True); cloak(m, "surcoat", length=20, width=11)
    top = m.d["top"]
    m.box("head", [-0.5, top + 4, -4], [1, 4, 8], "bronze")                                                                       # a crest
    m.bone("banner", [0, 24, 3], "body"); m.box("banner", [-0.5, 14, 4], [1, 30, 1], "wood"); m.box("banner", [0.5, 32, 4], [8, 10, 1], "surcoat"); m.box("banner", [2, 34, 3.8], [4, 5, 1], "bronze")   # the company's colours, on his back
    hold(m, "greatsword", blade="helm", hilt="bronze", long=22)
def m_grey_axe(m):
    greyhost_base(m); hold(m, "axe", haft="wood", blade="helm", long=16)
    m.box("body", [-4.5, 13, 2.5], [9, 9, 1], "leather")                                                                          # a hide over the back
def m_grey_cutter(m):
    greyhost_base(m); hold(m, "sword", blade="bronze", hilt="leather", long=9); hold(m, "sword", side="l", blade="bronze", hilt="leather", long=9)   # two short hooked blades, for rope and clapper
    m.box("body", [-4.5, 12, -3], [9, 2, 1], "bronze"); m.box("body", [-3, 9, -3.2], [2, 3, 1], "bronze"); m.box("body", [1, 9, -3.2], [2, 3, 1], "bronze")   # cut bell-clappers on his belt
mob(id="grey_axeman", name="Grey Host Axeman", family="raider", model=m_grey_axe, pal=P(**GREYHOST),
    hp=34, speed=0.31, dmg=8, egg=("#606c74", "#54504e"), lore="He was halfway through a swing three hundred years ago. He would like to finish it.")
mob(id="grey_bellcutter", name="Grey Host Bell-cutter", family="raider", model=m_grey_cutter, pal=P(**GREYHOST),
    hp=24, speed=0.36, dmg=5, egg=("#606c74", "#787054"), lore="Goes for anything that rings. They learned, the last time, what a bell can do to them.")
mob(id="grey_spearman", name="Grey Host Shield-bearer", family="raider", model=m_grey_spear, pal=P(**GREYHOST),
    hp=30, speed=0.3, dmg=6, egg=("#606c74", "#cee2ec"), lore="His boots were found standing in the snow three hundred years ago. The rest of him has only now come back for them.")
mob(id="grey_bowman", name="Grey Host Bowman", family="raider", model=m_grey_bow, pal=P(**GREYHOST),
    hp=22, speed=0.3, dmg=3, ranged_def=("minecraft:arrow", None), egg=("#606c74", "#aac8d7"), lore="Draws, looses, draws. He was told to hold this line and nobody has ever told him otherwise.")
mob(id="grey_serjeant", name="Vorlund's Guard", family="raider", model=m_grey_serjeant, pal=P(**GREYHOST),
    hp=52, speed=0.28, dmg=9, kb=0.5, collision=(0.8, 2.1), egg=("#606c74", "#787054"), lore="Carries the colours of a company that was swallowed whole. The others still form up on him.")

# ---------- soldiers of the Hollow itself. Not men, and not copies of men. The first real look at what is down there. ----------
HOLLOWKIN = dict(stone={"c": (58, 40, 78), "style": "stone"}, dark={"c": (34, 24, 48), "style": "stone"}, vein={"c": (230, 70, 200), "style": "glow"},
                 gem={"c": (120, 190, 255), "style": "glow"}, eye=(255, 120, 230))
def m_veinsworn(m):
    """Line soldier: too tall, too thin, arms to the knees, no face, one arm grown into a blade."""
    biped(m, L=17, B=13, bw=6, bd=4, head=(5, 9, 5), arm=(3, 19, 3), mats={"head": "stone", "body": "stone", "arm": "dark", "leg": "stone", "belt": "dark"}, face="blank", nose=False, detail=False)
    m.box("head", [-0.5, 32, -2.8], [1, 6, 1], "vein")                                                                             # where a face would be: one lit seam
    m.box("body", [-0.5, 19, -2.3], [1, 10, 1], "vein"); m.box("body", [-2.5, 24, -2.3], [5, 1, 1], "vein")                         # veins through the chest
    for s in (-1, 1):
        m.box("body", [s * 4 - 1, 29, -1], [2, 4, 2], "gem"); m.box("body", [s * 5.5 - 0.5, 28, 0], [1, 3, 1], "gem")               # crystal growing out of the shoulders
        m.box("leg_r" if s < 0 else "leg_l", [s * 1.5 - 0.5, 4, -2.3], [1, 8, 1], "vein")
    m.box("arm_r", [-6, 2, -1], [2, 12, 2], "gem"); m.box("arm_r", [-5.5, 0, -0.5], [1, 3, 1], "gem")                              # the right arm ends in a long shard
    m.box("arm_l", [3.5, 12, -1.8], [1, 9, 1], "vein")
    m.pose("arm_r", [-18, 0, 4]); m.pose("head", [8, 0, 0])
def m_shardcaster(m):
    """Stands off and throws. No legs: a column of stone drifting a hand above the ground, shards circling its head."""
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-4, 16, -3], [8, 12, 6], "stone"); m.box("body", [-3, 9, -2], [6, 7, 4], "dark"); m.box("body", [-2, 4, -1.5], [4, 5, 3], "dark"); m.box("body", [-1, 1, -1], [2, 3, 2], "vein")   # tapering to nothing
    m.box("body", [-0.5, 17, -3.3], [1, 10, 1], "vein"); m.box("body", [-3.5, 22, -3.3], [7, 1, 1], "vein")
    m.bone("head", [0, 28, 0], "body"); m.box("head", [-2.5, 28, -2.5], [5, 8, 5], "stone"); m.box("head", [-1.5, 30, -2.8], [3, 1, 1], "vein"); m.box("head", [-0.5, 31, -2.8], [1, 4, 1], "vein")
    m.bone("halo", [0, 38, 0], "head")
    for i, (x, z) in enumerate(((6, 0), (-6, 0), (0, 6), (0, -6), (4.5, 4.5), (-4.5, -4.5))): m.box("halo", [x - 0.5, 34 + i % 3, z - 0.5], [1, 5 - i % 2, 1], "gem")   # the shards it throws
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 5.5, 26, 0], "body"); m.box(nm, [s * 5.5 - 1, 12, -1], [2, 15, 2], "dark", mirror=s > 0); m.box(nm, [s * 5.5 - 0.5, 9, -0.5], [1, 3, 1], "gem")
        m.pose(nm, [-50, 0, -s * 14])
def m_gatebreaker(m):
    """The thing that takes walls down: a slab of the Hollow on short legs, four arms, a crown of crystal where a head should be."""
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-9, 14, -6], [18, 20, 12], "stone"); m.box("body", [-7, 34, -5], [14, 4, 10], "dark"); m.box("body", [-8, 12, -5], [16, 2, 10], "dark")
    m.box("body", [-0.5, 16, -6.3], [1, 16, 1], "vein"); m.box("body", [-6, 26, -6.3], [12, 1, 1], "vein"); m.box("body", [-4, 20, -6.3], [1, 6, 1], "vein"); m.box("body", [3, 22, -6.3], [1, 8, 1], "vein")
    m.bone("head", [0, 38, 0], "body"); m.box("head", [-3, 38, -3], [6, 4, 6], "dark")
    for x, z, h in ((-2, -2, 7), (1, -1, 9), (-1, 1, 6), (2, 2, 5), (0, -3, 4)): m.box("head", [x - 0.5, 41, z - 0.5], [2, h, 2], "gem")
    for s in (-1, 1):
        side = "r" if s < 0 else "l"
        up, low = f"arm_{side}", f"arm2_{side}"
        m.bone(up, [s * 11.5, 32, 0], "body"); m.box(up, [s * 11.5 - 3, 10, -3], [6, 24, 6], "stone", mirror=s > 0); m.box(up, [s * 11.5 - 4, 6, -4], [8, 6, 8], "dark", mirror=s > 0)   # the big pair: fists like doorposts
        m.box(up, [s * 11.5 - 0.5, 14, -3.3], [1, 14, 1], "vein")
        m.bone(low, [s * 9.5, 22, -3], "body"); m.box(low, [s * 9.5 - 1.5, 8, -4.5], [3, 14, 3], "dark", mirror=s > 0); m.box(low, [s * 9.5 - 1, 5, -4], [2, 3, 2], "gem")              # the small pair, under them
        m.pose(low, [-35, 0, -s * 10])
        leg = f"leg_{side}"
        m.bone(leg, [s * 5, 14, 0], "root"); m.box(leg, [s * 5 - 3.5, 0, -3.5], [7, 14, 7], "dark", mirror=s > 0); m.box(leg, [s * 5 - 4, 0, -5], [8, 3, 9], "stone", mirror=s > 0)
    m.pose("arm_r", [-14, 0, 0]); m.pose("arm_l", [-8, 0, 0])
mob(id="veinsworn", name="Veinsworn", family="raider", model=m_veinsworn, pal=P(**HOLLOWKIN),
    hp=38, speed=0.33, dmg=8, collision=(0.7, 2.6), scale=1.05, resist=dict(fire=True), egg=("#3a284e", "#e646c8"),
    lore="Too tall, and it walks as if it learned how from a description. There is no face. It has never needed one.")
mob(id="shardcaster", name="Shardcaster", family="raider", model=m_shardcaster, plan="float", pal=P(**HOLLOWKIN),
    hp=28, speed=0.27, dmg=4, keep_distance=True, hollow_bolts=True, collision=(0.7, 2.4), resist=dict(fire=True), egg=("#3a284e", "#78beff"),
    lore="It stays at the back and the air around its head is full of knives. It does not touch the ground.")
mob(id="gatebreaker", name="Gatebreaker", family="raider", model=m_gatebreaker, pal=P(**HOLLOWKIN),
    hp=130, speed=0.22, dmg=15, kb=1.0, collision=(1.7, 3.2), resist=dict(fire=True, projectile=0.5), egg=("#221830", "#e646c8"),
    lore="Walls were built to keep out things that climb, or dig, or burn. Nobody built one for this.")

# ---------- the reveal scene: one pose, three ages (stand-ins until the art pass) ----------
def m_at_desk(m, age):
    """Seated at a small desk, back straight, the RIGHT hand writing. Boy, king and Morvane share the pose exactly."""
    if age == "boy":
        biped(m, L=7, B=8, bw=6, bd=3, head=(7, 7, 7), arm=(2, 8, 2), mats={"head": "skin", "body": "tunic", "arm": "tunic", "leg": "hose", "belt": "hose"}, face="eyes")
        m.box("head", [-3.5, 19, -3.5], [7, 3, 7], "hair", inflate=0.2); m.box("head", [-3.5, 16, 2.5], [7, 4, 1], "hair", inflate=0.2)      # a mop of hair
    elif age == "king":
        biped(m, L=12, B=12, bw=8, bd=4, head=(8, 8, 8), arm=(4, 12, 4), mats={"head": "skin", "body": "robe", "arm": "robe", "leg": "robe", "belt": "trim", "shoulder": "trim"}, face="eyes")
        m.box("head", [-4.5, 31, -4.5], [9, 2, 9], "crown"); 
        for x in (-4.5, -0.5, 3.5): m.box("head", [x, 33, -4.5], [1, 2, 1], "crown")                                                           # a plain gold circlet
        m.box("head", [-3, 22, -4.6], [6, 3, 1], "hair")                                                                                       # a beard going grey
        cloak(m, "robe", length=20, width=10)
    else:
        biped(m, L=14, B=13, bw=10, bd=6, head=(8, 8, 8), arm=(4, 13, 4), mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate", "belt": "cape"}, face="eyes")
        hollow_crown(m, 35)                                                                                                                    # the Hollow Crown, the same one as in the fight
        cloak(m, "cape", length=24, width=12)
    d = m.d; L = d["L"]; top = L + d["B"]
    m.pose("leg_r", [-90, 0, 0]); m.pose("leg_l", [-90, 0, 0])                    # seated
    m.pose("head", [14, 0, 0])
    if age == "morvane": m.pose("arm_l", [-68, 0, 8]); m.pose("arm_r", [-12, 0, -4])            # only he favours the left: the right hand hangs dead at his side
    else: m.pose("arm_r", [-68, 0, -8]); m.pose("arm_l", [-35, 0, 6])                           # the boy and the king write with the right hand
    m.bone("desk", [0, 0, 0], "root")
    m.box("desk", [-4, 0, -1], [8, L - d["bd"] // 2 - 1, 5], "wood")               # stool
    dh = L + 4
    m.box("desk", [-9, dh, -L - 13], [18, 1, 10], "wood")                          # the desk top, in front of the knees
    for x in (-9, 8): m.box("desk", [x, 0, -L - 13], [1, dh, 1], "wood"); m.box("desk", [x, 0, -L - 5], [1, dh, 1], "wood")
    m.box("desk", [-4, dh + 1, -L - 11], [7, 1, 6], "page")                        # the open book
    m.box("desk", [5, dh + 1, -L - 11], [2, 3, 2], "candle"); m.box("desk", [5.5, dh + 4, -L - 10.5], [1, 1, 1], "flame")
    if age == "morvane": m.box("desk", [-8, dh + 1, -L - 5], [16, 1, 2], "steel")  # where the pen lay, a sword lies
    else: m.box("desk", [-6, dh + 1, -L - 9], [1, 1, 4], "quill")                  # the pen, under the right hand
DESK = dict(wood=WOOD, page=(232, 222, 196), candle=(236, 228, 204), flame=(255, 190, 90), quill=(240, 240, 236), eye=(138, 142, 150))
for _age, _name, _pal, _lore in (
    ("boy", "The Boy at the Desk", P(skin=SKIN, tunic={"c": (120, 60, 50), "style": "cloth"}, hose={"c": (70, 62, 54), "style": "cloth"}, hair=(96, 70, 44), **DESK), "A boy of nine, writing by candlelight. He has not heard you come in."),
    ("king", "The King at the Desk", P(skin=SKIN, robe={"c": (110, 40, 44), "style": "cloth"}, trim=GOLD, crown=GOLD, hair=(150, 146, 140), **DESK), "The same desk. The same hand. Many years."),
    ("morvane", "The One at the Desk", P(**{**OSWIN_PAL, **DESK, "wood": {"c": (60, 56, 60), "style": "wood"}, "flame": (150, 200, 255), "eye": (138, 142, 150)}), "The same desk. The same hand. He looks up."),
):
    mob(id=f"reveal_{_age}", name=_name, family="boss_prop", model=(lambda m, a=_age: m_at_desk(m, a)), plan="none", pal=_pal,
        hp=20, static=True, unbreakable=True, collision=(0.8, 1.6), egg=("#6e4e2e", "#8a8e96"), no_loot=True, lore=_lore)

# Warlords that aren't the King also get their own body now
mob(id="hollow_warlord", name="Grey Warlord", family="raider", model=m_king,
    pal=P(skin=SKIN, plate={"c": (80, 70, 66), "style": "metal"}, crown={"c": (120, 100, 70), "style": "metal"}, shard={"c": (120, 100, 70), "style": "metal"}, cape={"c": (70, 50, 40), "style": "cloth"}, steel=IRON, eye=(255, 140, 60)),
    hp=60, speed=0.3, dmg=9, kb=0.6, collision=(1.0, 2.8), egg=("#50463f", "#ff8c3c"),
    lore="A named war-chief who heard the bell louder than the rest.")

# ---------- stationary fight props (entities, so fights never edit the map's blocks) ----------
def m_pillar(m):
    m.bone("root", [0, 0, 0]); m.box("root", [-5, 0, -5], [10, 30, 10], "ice"); m.box("root", [-3, 30, -3], [6, 8, 6], "ice"); m.box("root", [-7, 0, -7], [14, 3, 14], "snow")
mob(id="rime_pillar", name="Rime Pillar", family="boss_prop", model=m_pillar, plan="none", material="entity_alphablend",
    pal=P(ice={"c": (170, 220, 250, 210), "style": "stone"}, snow=(240, 246, 250)), hp=40, static=True, collision=(0.9, 2.4), egg=("#aadcfa", "#f0f6fa"), no_loot=True,
    lore="The Huntsman's cold is anchored in these. Break them all.")

def m_bell(m):
    m.bone("root", [0, 0, 0]); m.box("root", [-1, 0, -1], [2, 30, 2], "wood"); m.box("root", [-6, 28, -1], [12, 2, 2], "wood")
    m.bone("bell", [0, 28, 0], "root"); m.box("bell", [-5, 14, -5], [10, 10, 10], "bell"); m.box("bell", [-3, 24, -3], [6, 3, 6], "bell"); m.box("bell", [-1, 11, -1], [2, 3, 2], "clapper")
mob(id="chapel_bell", name="Chapel Bell", family="boss_prop", model=m_bell, plan="none",
    pal=P(wood=WOOD, bell=GOLD, clapper=DARKIRON), hp=20, static=True, unbreakable=True, collision=(0.9, 2.0), egg=("#dab046", "#6e4e2e"), no_loot=True,
    anim_extra=[("bell", "rotation", ["0", "0", "query.is_charged ? math.sin(query.life_time*500)*25 : 0"])],
    lore="Strike it to ring it. Three bells rung together turn the tide.")

# ======================================================================================
# Champions: NPC stand-ins for players. Player-shaped, geared, and driven by scripts/bestiary/champions.js.
# Each carries a blade, a bow, a shield and a flask as bones; the animation shows whichever is in use.
# ======================================================================================
_W = "math.cos(query.modified_distance_moved*38.17)*query.modified_move_speed"
def champ_anim(bow=True, shield=True):
    a = [("blade", "scale", ["(query.is_charged || query.is_ignited) ? 0 : 1"] * 3),
         ("arm_r", "rotation", [f"query.is_ignited ? -100 : (query.is_charged ? -57 : -{_W}*35 - math.sin(variable.attack_time*180)*95)", "query.is_ignited ? -25 : 0", "0"]),
         ("arm_l", "rotation", [f"query.is_saddled ? -70 : (query.is_charged ? -80 : {_W}*35)", "query.is_saddled ? 35 : 0", "0"])]
    if bow:   # off the back and into the left hand: the offsets were worked out from the rest pose
        a += [("bow", "position", ["query.is_charged ? 6 : 0", "query.is_charged ? 2.4 : 0", "query.is_charged ? -12.4 : 0"]), ("bow", "rotation", ["0", "0", "query.is_charged ? -35 : 0"])]
    return a
def champ_gear(m, blade="steel", bow=True, shield_=True, long=14, staff=False):
    if staff: hold(m, "staff", bone="blade", haft=blade, orb="ember", long=30)
    else: hold(m, "sword", bone="blade", blade=blade, hilt="hilt", long=long)
    if shield_: shield(m, size=(10, 13), shield="shield", trim="trim", kite=True)
    if bow:                                                                    # slung across the back until it is needed (the animation brings it to the hand)
        m.bone("bow", [0, 18, 3.5], "body", rotation=[0, 0, 35]); bow_shape(m, "bow", 0, 18, 3.5, 20, "wood", "wood")
        m.box("body", [2, 14, 2.5], [3, 10, 2], "wood")                        # quiver
        for dx in (2, 3, 4): m.box("body", [dx, 24, 3], [1, 2, 1], "trim")
    m.box("body", [-4, 11, -3.5], [2, 3, 2], "potion"); m.box("body", [-3.5, 14, -3], [1, 1, 1], "wood")                       # a potion on the belt
def m_champ_knight(m):
    biped(m, mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate", "belt": "belt"}, face="eyes")
    m.box("head", [-4.5, 29, -4.5], [9, 4, 9], "plate"); m.box("head", [-4.5, 24, 0.5], [9, 5, 4], "plate"); m.box("head", [-0.5, 33, -3], [1, 2, 7], "tabard")   # open-faced helm with a crest
    m.box("head", [-4.6, 24, -2], [1, 5, 3], "plate"); m.box("head", [3.6, 24, -2], [1, 5, 3], "plate")                         # cheek plates
    m.box("body", [-4.5, 12, -2.5], [9, 8, 5], "tabard", inflate=0.1); m.box("body", [-4.5, 7, -2.5], [9, 5, 5], "tabard")
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 6 - 2.5 + s * 0.5, 22, -3], [5, 3, 6], "plate")
    cloak(m, "tabard", length=18)
    champ_gear(m)
def m_champ_sorcerer(m):
    biped(m, mats={"head": "skin", "body": "robe", "arm": "robe", "leg": "robe", "belt": "trim"}, face="eyes")
    cloak(m, "hood", hood=True, length=20)
    m.box("body", [-4.5, 0, -2.5], [9, 12, 5], "robe"); m.box("body", [-4, 21, -2.6], [8, 2, 1], "trim"); m.box("body", [-0.5, 2, -2.8], [1, 19, 1], "trim")   # long robe, trimmed
    for s in (-1, 1): m.box("arm_r" if s < 0 else "arm_l", [s * 6 - 2.5, 12, -2.5], [5, 5, 5], "robe")                         # wide sleeves
    champ_gear(m, blade="staff", bow=False, shield_=False, staff=True)
def m_champ_lord(m):
    biped(m, mats={"head": "skin", "body": "surcoat", "arm": "mail", "leg": "mail", "belt": "belt", "shoulder": "gold"}, face="eyes")
    m.box("head", [-4.5, 31, -4.5], [9, 2, 9], "gold")
    for x, z in ((-4.5, -4.5), (3.5, -4.5), (-0.5, -4.5), (-4.5, 3.5), (3.5, 3.5), (-4.5, -0.5), (3.5, -0.5)): m.box("head", [x, 33, z], [1, 3 if x == -0.5 else 2, 1], "gold")
    m.box("head", [-4.5, 24, 1], [9, 7, 4], "mail"); m.box("head", [-3, 23, -4.5], [6, 2, 1], "belt")                           # mail coif, a short beard
    m.box("body", [-4.5, 6, -2.5], [9, 18, 5], "surcoat", inflate=0.1); m.box("body", [-1, 14, -3.3], [2, 6, 1], "gold"); m.box("body", [-2.5, 17, -3.3], [5, 1, 1], "gold")
    cloak(m, "cape", length=21, width=10); m.box("body", [-5.5, 22, -3.5], [11, 3, 7], "cape", inflate=0.2)                      # a fur-collared cloak
    champ_gear(m, blade="steel", long=16)
def m_champ_retainer(m):
    biped(m, mats={"head": "skin", "body": "mail", "arm": "mail", "leg": "pants", "belt": "pants"}, face="eyes")
    m.box("head", [-5, 30, -5], [10, 2, 10], "plate"); m.box("head", [-4, 32, -4], [8, 2, 8], "plate"); m.box("head", [-4.5, 24, 1.5], [9, 6, 3], "mail")   # kettle helm over a coif
    m.box("body", [-4.5, 12, -2.5], [9, 9, 5], "tabard", inflate=0.1); m.box("body", [-4.5, 8, -2.5], [9, 4, 5], "tabard")
    hold(m, "spear", bone="blade", haft="wood", blade="steel", long=30)
    shield(m, size=(9, 11), shield="shield", trim="trim")
_CH = dict(family="champion", kb=0.5, lore_kind="champion")
mob(id="champion_knight", name="Rival Knight", model=m_champ_knight, anim_extra=champ_anim(),
    pal=P(skin=SKIN, plate={"c": (160, 164, 172), "style": "metal"}, tabard={"c": (150, 40, 36), "style": "cloth"}, steel=IRON, hilt=GOLD, wood=WOOD,
          shield={"c": (150, 40, 36), "style": "wood"}, trim=GOLD, potion={"c": (220, 70, 110), "style": "glow"}, eye=(60, 44, 30), belt=(70, 50, 36)),
    hp=80, speed=0.3, dmg=7, egg=("#a0a4ac", "#962824"), resist=dict(projectile=0.7), **_CH,
    lore="Fights like you do: sword up close, bow at range, a shield in between, and a potion when it goes badly. Bring an axe for the shield.")
mob(id="champion_sorcerer", name="Rival Sorcerer", model=m_champ_sorcerer, anim_extra=champ_anim(bow=False, shield=False),
    pal=P(skin=SKIN, robe={"c": (52, 44, 84), "style": "cloth"}, hood={"c": (40, 34, 66), "style": "cloth"}, trim=GOLD, staff=WOOD, hilt=WOOD, wood=WOOD,
          ember={"c": (176, 140, 236), "style": "glow"}, potion={"c": (120, 200, 230), "style": "glow"}, eye=(150, 120, 230), hand=SKIN),
    hp=64, speed=0.3, dmg=5, egg=("#342c54", "#b08cec"), **_CH,
    lore="Keeps its distance, throws Veilbolts, marks the ground under your feet and steps through the air when you close in.")
mob(id="champion_lord", name="Rival Lord", model=m_champ_lord, anim_extra=champ_anim(),
    pal=P(skin=SKIN, surcoat={"c": (40, 70, 130), "style": "cloth"}, mail={"c": (120, 124, 130), "style": "metal"}, gold=GOLD, cape={"c": (120, 30, 40), "style": "cloth"},
          steel=IRON, hilt=GOLD, wood=WOOD, shield={"c": (40, 70, 130), "style": "wood"}, trim=GOLD, potion={"c": (220, 70, 110), "style": "glow"}, eye=(40, 60, 90), belt=(70, 50, 36)),
    hp=110, speed=0.3, dmg=8, egg=("#284682", "#dab046"), resist=dict(projectile=0.7), **_CH,
    lore="A lord with a keep of their own. Everything a Rival Knight does, plus retainers who come when called.")
mob(id="champion_retainer", name="Retainer", model=m_champ_retainer, anim_extra=champ_anim(bow=False),
    pal=P(skin=SKIN, mail={"c": (120, 124, 130), "style": "metal"}, plate={"c": (140, 144, 150), "style": "metal"}, tabard={"c": (90, 96, 104), "style": "cloth"}, pants=(70, 60, 50),
          steel=IRON, hilt=DARKIRON, wood=WOOD, shield={"c": (104, 80, 56), "style": "wood"}, trim=DARKIRON, potion={"c": (220, 70, 110), "style": "glow"}, eye=(50, 40, 30)),
    hp=36, speed=0.3, dmg=5, egg=("#787c82", "#685038"), **_CH,
    lore="A lord's man-at-arms. Uses a shield properly, which is more than most things out here.")

def m_gloamwing(m):
    # A ray that flies: flat body, long two-part wings, a whip of a tail. Nothing like a bird.
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 4, 0], "root")
    m.box("body", [-3, 3, -6], [6, 3, 13], "hide"); m.box("body", [-2, 6, -4], [4, 1, 9], "hide"); m.box("body", [-2.5, 2, -5], [5, 1, 10], "belly")
    for z in (-3, 0, 3): m.box("body", [-0.5, 6.5, z], [1, 1, 2], "vein")
    m.bone("head", [0, 4, -6], "body"); m.box("head", [-3.5, 3, -11], [7, 3, 5], "hide", face="glow"); m.box("head", [-2.5, 2, -12], [5, 2, 2], "belly")
    for s in (-1, 1): m.box("head", [s * 3 - 0.5, 4, -14], [1, 1, 4], "vein")                                                  # barbels that feel ahead of it
    for s, nm, tip in ((-1, "wing_r", "tip_r"), (1, "wing_l", "tip_l")):
        m.bone(nm, [s * 3, 5, 0], "body")
        m.box(nm, [s * 3 - (10 if s < 0 else 0), 4, -5], [10, 1, 11], "hide", mirror=s > 0); m.box(nm, [s * 3 - (9 if s < 0 else -1), 5, -1], [8, 1, 1], "vein", mirror=s > 0)
        m.bone(tip, [s * 13, 5, 0], nm)
        m.box(tip, [s * 13 - (9 if s < 0 else 0), 4, -3], [9, 1, 8], "hide", mirror=s > 0); m.box(tip, [s * 22 - (5 if s < 0 else 0), 4, -1], [5, 1, 4], "hide", mirror=s > 0)
        m.box(tip, [s * 13 - (8 if s < 0 else -1), 5, 0], [7, 1, 1], "vein", mirror=s > 0)
    m.bone("tail", [0, 4, 7], "body"); m.box("tail", [-1, 3.5, 7], [2, 2, 8], "hide")
    m.bone("tail2", [0, 4, 15], "tail"); m.box("tail2", [-0.5, 4, 15], [1, 1, 10], "hide"); m.box("tail2", [-0.5, 3, 24], [1, 3, 2], "vein")
mob(id="gloamwing", name="Gloamwing", family="hollow", model=m_gloamwing, plan="none", glider=True,
    pal=P(hide={"c": (52, 34, 78), "style": "stone"}, belly={"c": (84, 62, 110), "style": "skin"}, vein={"c": (214, 80, 190), "style": "glow"}, eye=(170, 220, 255)),
    hp=14, speed=0.3, dmg=3, collision=(0.9, 0.5), groups=None, egg=("#34224e", "#d650be"),
    anim_extra=[("wing_r", "rotation", ["0", "0", "math.sin(query.life_time*260)*26"]), ("wing_l", "rotation", ["0", "0", "-math.sin(query.life_time*260)*26"]),
                ("tip_r", "rotation", ["0", "0", "math.sin(query.life_time*260-70)*30"]), ("tip_l", "rotation", ["0", "0", "-math.sin(query.life_time*260-70)*30"]),
                ("tail", "rotation", ["math.sin(query.life_time*130)*8", "math.sin(query.life_time*90)*14", "0"]), ("tail2", "rotation", ["0", "math.sin(query.life_time*90-80)*20", "0"])],
    lore="They ride the fog over the Hollow and leave new arrivals alone. Stay too long and they stop.")

def m_seep(m):
    # A standing crack in the air with something bright behind it. Not symmetrical on purpose.
    m.bone("root", [0, 0, 0])
    m.box("root", [-1, 2, -0.5], [2, 30, 1], "light"); m.box("root", [-2, 10, -0.5], [1, 14, 1], "light"); m.box("root", [1, 6, -0.5], [1, 9, 1], "light")
    m.box("root", [-3, 0, -1], [3, 12, 2], "dark"); m.box("root", [1, 0, -1], [3, 7, 2], "dark"); m.box("root", [-4, 12, -1], [2, 13, 2], "dark")
    m.box("root", [2, 15, -1], [2, 15, 2], "dark"); m.box("root", [-2, 25, -1], [1, 9, 2], "dark"); m.box("root", [1, 30, -1], [1, 5, 2], "dark")
    m.box("root", [-6, 0, -3], [12, 1, 6], "stain")
mob(id="seep", name="Seep", family="seep", model=m_seep, plan="none", material="entity_alphablend",
    pal=P(light={"c": (176, 140, 236), "style": "glow"}, dark={"c": (26, 22, 40, 235), "style": "stone"}, stain={"c": (40, 34, 60, 150), "style": "stone"}),
    hp=60, static=True, collision=(1.0, 2.4), egg=("#1a1628", "#b08cec"),
    lore="A place where the Hollow is pushing through. Things come out of it. Left alone, it widens.")

def m_bolt(m):
    m.bone("root", [0, 0, 0]); m.box("root", [-1.5, 0, -1.5], [3, 3, 3], "orb")
mob(id="hollow_bolt", name="Veilbolt", family="projectile", model=m_bolt, plan="none",
    pal=P(orb={"c": (170, 100, 255), "style": "glow"}), hp=1, projectile=True, collision=(0.3, 0.3), egg=None, no_loot=True, lore="")
