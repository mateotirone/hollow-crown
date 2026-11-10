# The Hollow Crown bestiary: every new mob and boss, with its look (box model + palette)
# and its data-driven behaviour. Abilities that need code live in scripts/bestiary/*.js.
from models import Model, biped, quadruped

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
    b = biped(m, mats={"head": "skin", "body": "tabard", "arm": "mail", "leg": "pants"}, face="hollow")
    m.box("head", [-4.5, 29, -4.5], [9, 4, 9], "helm")                       # kettle helm
    m.box("head", [-5.5, 29, -5.5], [11, 1, 11], "helm")                     # brim
    m.box("body", [-4.5, 11, -2.5], [9, 3, 5], "belt")
    m.bone("blade", [-6, 12, 0], "arm_r"); m.box("blade", [-6.5, 2, -9], [1, 1, 12], "rust")
mob(id="hollow_footman", name="Hollow Footman", family="raider", model=m_footman,
    pal=P(skin=PALE, tabard={"c": (64, 58, 72), "style": "cloth"}, mail={"c": (104, 106, 112), "style": "metal"}, pants=(54, 48, 46), helm=RUST, belt=(70, 46, 30), rust=RUST, eye=(180, 230, 255)),
    hp=26, speed=0.32, dmg=5, egg=("#3f3a48", "#b4e6ff"), lore="The first to answer the bell. They march with their eyes open and nobody home behind them.")

def m_bellringer(m):
    biped(m, mats={"head": "skin", "body": "robe", "leg": "robe"}, face="hollow")
    m.box("head", [-4.5, 24, -4.5], [9, 9, 9], "hood", inflate=0.3)
    m.bone("pole", [-6, 14, 0], "arm_r"); m.box("pole", [-6.5, 2, -1], [1, 22, 1], "wood")
    m.bone("bell", [-6, 26, 0], "pole"); m.box("bell", [-8.5, 18, -2.5], [5, 6, 5], "bell"); m.box("bell", [-7.5, 24, -1.5], [3, 1, 3], "bell")
mob(id="bell_ringer", name="Bell-Ringer", family="raider", model=m_bellringer,
    pal=P(skin=PALE, robe={"c": (90, 30, 34), "style": "cloth"}, hood={"c": (70, 22, 26), "style": "cloth"}, wood=WOOD, bell=GOLD, eye=(255, 220, 140)),
    hp=20, speed=0.3, dmg=2, flees=True, egg=("#5a1e22", "#dab046"), anim_extra=[("bell", "rotation", ["0", "0", "math.sin(query.life_time*400)*20"])],
    lore="Every ring of its bell makes the raiders around it braver and faster. Kill it first. It knows this, and runs.")

def m_brute(m):
    b = biped(m, L=12, B=14, bw=12, bd=6, head=(8, 8, 8), arm=(5, 14, 5), mats={"head": "skin", "body": "plate", "arm": "skin", "leg": "pants"}, face="visor")
    m.box("head", [-4.5, 26, -4.5], [9, 8, 9], "plate")
    m.bone("shield", [-9, 22, 0], "arm_l"); m.box("shield", [5, 4, -8], [2, 22, 14], "shield")
    m.box("shield", [7, 13, -2], [1, 4, 2], "plate")
mob(id="shieldwall_brute", name="Shieldwall Brute", family="raider", model=m_brute,
    pal=P(skin=(150, 120, 100), plate=DARKIRON, pants=(60, 50, 44), shield={"c": (96, 66, 40), "style": "wood"}, eye=(255, 120, 60)),
    hp=55, speed=0.24, dmg=9, scale=1.15, kb=0.8, resist=dict(projectile=0.25), egg=("#46464f", "#ff783c"),
    lore="A tower shield and nothing else to think about. Arrows bounce. Get behind him.")

def m_torch(m):
    biped(m, mats={"head": "skin", "body": "leather", "leg": "pants"}, face="hollow")
    m.box("head", [-4.5, 24, -4.5], [9, 9, 9], "rag", inflate=0.25)
    m.bone("torch", [-6, 13, 0], "arm_r"); m.box("torch", [-6.5, 1, -7], [1, 1, 8], "wood"); m.box("torch", [-7, 0.5, -10], [2, 2, 3], "flame")
mob(id="torchbearer", name="Torchbearer", family="raider", model=m_torch,
    pal=P(skin=PALE, leather={"c": (92, 60, 36), "style": "cloth"}, pants=(50, 40, 36), rag={"c": (130, 120, 100), "style": "cloth"}, wood=WOOD, flame={"c": (255, 170, 40), "style": "glow"}, eye=(255, 160, 60)),
    hp=22, speed=0.33, dmg=4, resist=dict(fire=True), egg=("#5c3c24", "#ffaa28"),
    lore="Sets every wooden thing it passes alight. Stone walls were built for a reason.")

def m_ogre(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 16, 0], "root")
    m.box("body", [-9, 16, -6], [18, 18, 12], "hide"); m.box("body", [-8, 13, -5], [16, 4, 10], "belt")
    m.bone("head", [0, 34, -2], "body"); m.box("head", [-5, 32, -9], [10, 9, 9], "skin", face="low")
    m.box("head", [-3, 32, -10], [6, 2, 1], "tusk")
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 11, 32, 0], "body"); m.box(nm, [s * 11 - 3.5, 12, -3.5], [7, 22, 7], "skin", mirror=s > 0)
    for s, nm in ((-1, "leg_r"), (1, "leg_l")):
        m.bone(nm, [s * 4.5, 16, 0], "root"); m.box(nm, [s * 4.5 - 3.5, 0, -3.5], [7, 16, 7], "pants", mirror=s > 0)
    m.bone("log", [0, 18, -4], "arm_r"); m.box("log", [-6, 14, -24], [12, 6, 6], "log", rot=[0, 90, 0], pivot=[0, 17, -12])
    m.box("log", [-4, 13, -32], [8, 8, 2], "ironcap")
    m.bone("seat", [0, 34, 2], "body")
mob(id="siege_ogre", name="Siege Ogre", family="raider", model=m_ogre,
    pal=P(skin=(120, 128, 92), hide={"c": (110, 84, 60), "style": "fur"}, belt=(60, 40, 26), pants=(70, 56, 40), tusk=(230, 220, 190), log=WOOD, ironcap=DARKIRON, eye=(250, 220, 80)),
    hp=120, speed=0.22, dmg=14, kb=1.0, collision=(1.6, 3.0), rideable=True, egg=("#78805c", "#6e543c"),
    lore="Carries a whole tree trunk as a ram. Walls crack where it walks.")

def m_crowmage(m):
    biped(m, mats={"head": "mask", "body": "feather", "leg": "feather"}, face="glow")
    m.box("head", [-1, 26, -7], [2, 2, 3], "beak")
    m.box("body", [-5, 3, -3], [10, 9, 6], "feather")                         # long feather robe
    m.bone("staff", [6, 13, 0], "arm_l"); m.box("staff", [5.5, -4, -1], [1, 28, 1], "wood"); m.box("staff", [4.5, 24, -2], [3, 3, 3], "orb")
mob(id="crow_mage", name="Crow-Mage", family="raider", model=m_crowmage,
    pal=P(mask=(40, 36, 44), feather={"c": (30, 28, 36), "style": "fur"}, beak=(200, 170, 80), wood=WOOD, orb={"c": (150, 80, 255), "style": "glow"}, eye=(200, 120, 255)),
    hp=24, speed=0.3, dmg=3, keep_distance=True, egg=("#1e1c24", "#9650ff"),
    lore="Calls a murder of Hollow crows and throws blinding bolts from the back of the line.")

def m_crow(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 3, 0], "root"); m.box("body", [-1.5, 2, -3], [3, 3, 6], "feather")
    m.bone("head", [0, 5, -3], "body"); m.box("head", [-1.5, 4, -6], [3, 3, 3], "feather", face="eyes"); m.box("head", [-0.5, 4.5, -8], [1, 1, 2], "beak")
    m.bone("wing_r", [-1.5, 5, 0], "body"); m.box("wing_r", [-7.5, 4.5, -2], [6, 0, 5], "feather")
    m.bone("wing_l", [1.5, 5, 0], "body"); m.box("wing_l", [1.5, 4.5, -2], [6, 0, 5], "feather", mirror=True)
mob(id="hollow_crow", name="Hollow Crow", family="summon", model=m_crow, plan="bird",
    pal=P(feather={"c": (26, 24, 30), "style": "fur"}, beak=(200, 170, 80), eye=(200, 120, 255)),
    hp=4, speed=0.4, dmg=2, fly=0.35, lifetime=30, collision=(0.5, 0.5), egg=("#1a181e", "#c878ff"), no_loot=True,
    lore="Summoned by Crow-Mages. They come apart into ash after half a minute.")

# ======================================================================================
# Family 2: Hollow things (Undertow-touched)
# ======================================================================================
def villagerish(m, robe, face):
    biped(m, mats={"head": "skin", "body": robe, "arm": robe, "leg": robe}, head=(8, 10, 8), face=face)
    m.box("head", [-1, 25, -6], [2, 4, 2], "skin")                            # nose
    m.box("body", [-4, 4, -3], [8, 8, 6], robe)                               # robe skirt
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
    biped(m, L=20, B=14, bw=6, bd=3, head=(6, 10, 6), arm=(2, 26, 2), mats={"head": "skin", "body": "skin", "leg": "skin"}, face="hollow")
    m.box("head", [-3.5, 41, -3.5], [7, 2, 7], "skin")
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
    q = quadruped(m, legh=9, body=(7, 7, 16), head=(6, 6, 8), mats={"body": "hide", "head": "bone"}, face="glow")
    m.box("body", [-1, 16, -6], [2, 3, 12], "bone")                           # spine ridge
mob(id="echo_hound", name="Echo Hound", family="hollow", model=m_hound, plan="quad",
    pal=P(hide={"c": (40, 44, 60), "style": "fur"}, bone={"c": (200, 200, 190), "style": "bone"}, eye=(120, 220, 255)),
    hp=24, speed=0.38, dmg=5, collision=(0.8, 1.0), groups="hound", egg=("#282c3c", "#78dcff"),
    lore="Blind. It hunts by the hum of the Ember. The louder your Resonance, the farther away it hears you.")

def m_mirror(m):
    biped(m, mats={"head": "mirror", "body": "mirror", "arm": "mirror", "leg": "mirror"}, face="blank")
    m.box("head", [-4.5, 24, -4.5], [9, 9, 9], "mirror", inflate=0.2)
    m.box("body", [-4.5, 12, -2.5], [9, 12, 5], "trim")
    m.bone("blade", [-6, 12, 0], "arm_r"); m.box("blade", [-6.5, 2, -12], [1, 1, 14], "mirror")
mob(id="mirror_knight", name="Mirror Knight", family="hollow", model=m_mirror,
    pal=P(mirror={"c": (200, 214, 226), "style": "metal"}, trim={"c": (120, 140, 160), "style": "metal"}),
    hp=45, speed=0.3, dmg=7, kb=0.5, groups="mirror", egg=("#c8d6e2", "#788ca0"),
    lore="Whatever you hit it with last, it learns. Shoot it and it shoots back. Strike it and it parries. Change it up.")

def m_shade(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 10, 0], "root")
    m.box("body", [-4, 6, -2.5], [8, 14, 5], "shroud"); m.box("body", [-3, 0, -2], [6, 6, 4], "wisp")
    m.bone("head", [0, 20, 0], "body"); m.box("head", [-4, 20, -4], [8, 8, 8], "shroud", face="glow"); m.box("head", [-4.5, 20, -4.5], [9, 9, 9], "shroud", inflate=0.3)
    m.bone("arm_r", [-5, 18, 0], "body"); m.box("arm_r", [-7, 6, -1.5], [3, 13, 3], "shroud")
    m.bone("arm_l", [5, 18, 0], "body"); m.box("arm_l", [4, 6, -1.5], [3, 13, 3], "shroud", mirror=True)
    m.bone("bell", [0, 6, 0], "body"); m.box("bell", [-2, 2, -6], [4, 4, 4], "bell")
mob(id="tolling_shade", name="Tolling Shade", family="hollow", model=m_shade, plan="float", material="entity_alphablend",
    pal=P(shroud={"c": (60, 70, 90, 190), "style": "cloth"}, wisp={"c": (90, 110, 140, 120), "style": "cloth"}, bell=GOLD, eye=(140, 230, 255)),
    hp=30, speed=0.25, dmg=4, fly=0.25, groups=None, egg=("#3c465a", "#8ce6ff"), anim_extra=[("bell", "rotation", ["math.sin(query.life_time*300)*25", "0", "0"])],
    lore="You have heard that bell before, under your own keep. Each ring drags at your legs and darkens the world.")

# ======================================================================================
# Family 3: Regional wildlife and beasts
# ======================================================================================
def m_stag(m):
    q = quadruped(m, legh=14, body=(9, 10, 18), head=(5, 6, 8), mats={"body": "fur", "head": "fur", "leg": "fur"}, neck=6, tail=False)
    hy = q["hy"]
    for s in (-1, 1):
        m.box("head", [s * 2.5 - 0.5, hy + 4, -14], [1, 7, 1], "antler", mirror=s > 0)
        m.box("head", [s * 2.5 + (s > 0) * 0 - (s < 0) * 4, hy + 9, -14], [4, 1, 1], "antler")
        m.box("head", [s * 6 - 0.5, hy + 9, -14], [1, 5, 1], "antler")
mob(id="frost_stag", name="Frost Stag", family="wild", model=m_stag, plan="quad",
    pal=P(fur={"c": (214, 220, 226), "style": "fur"}, antler={"c": (190, 220, 240), "style": "bone"}, eye=(20, 30, 40)),
    hp=30, speed=0.3, dmg=7, collision=(1.2, 1.8), neutral=True, region="Frostmarch", egg=("#d6dce2", "#bedcf0"),
    spawn=dict(biomes=["taiga", "frozen", "cold"], light=None, herd=(1, 3), weight=6, pop="animal"),
    lore="Gentle until you strike it. Its Pale Antlers are worth a fortune to any Stables master.")

def m_rimewolf(m):
    quadruped(m, legh=8, body=(7, 7, 14), head=(6, 6, 7), mats={"body": "fur", "head": "fur"}, face="glow")
    m.box("body", [-4, 14, -7], [8, 3, 6], "frost")                           # icy mane
mob(id="rimewolf", name="Rimewolf", family="wild_hostile", model=m_rimewolf, plan="quad",
    pal=P(fur={"c": (170, 186, 200), "style": "fur"}, frost={"c": (210, 240, 255), "style": "stone"}, eye=(120, 220, 255)),
    hp=22, speed=0.36, dmg=4, collision=(0.8, 0.9), region="Frostmarch", effect={"effect_name": "slowness", "effect_duration": 3}, egg=("#aabac8", "#d2f0ff"),
    spawn=dict(biomes=["taiga", "frozen", "cold"], light=7, herd=(2, 4), weight=8, pop="monster"),
    lore="Hunts in packs through the snow. Their bite freezes your legs, and they know it.")

def m_lurker(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 8, 0], "root")
    m.box("body", [-6, 3, -8], [12, 9, 16], "scale"); m.box("body", [-1, 12, -6], [2, 3, 12], "fin")
    m.bone("head", [0, 9, -8], "body"); m.box("head", [-5, 4, -16], [10, 7, 8], "scale", face="glow"); m.box("head", [-4, 3, -15], [8, 2, 7], "belly")
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * 6; z = sz * 5; m.bone(nm, [x, 4, z], "root"); m.box(nm, [x - 2, 0, z - 2], [4, 4, 4], "scale", mirror=sx > 0)
    m.bone("tail", [0, 8, 8], "body"); m.box("tail", [-2, 5, 8], [4, 4, 12], "scale")
mob(id="brine_lurker", name="Brine Lurker", family="wild_hostile", model=m_lurker, plan="quad",
    pal=P(scale={"c": (50, 90, 84), "style": "stone"}, fin={"c": (90, 140, 120), "style": "bone"}, belly=(170, 180, 150), eye=(240, 250, 120)),
    hp=34, speed=0.26, dmg=6, collision=(1.2, 0.9), swim=True, region="Saltreach", egg=("#325a54", "#f0fa78"),
    spawn=dict(biomes=["beach", "ocean", "river"], light=7, herd=(1, 2), weight=6, pop="monster"),
    lore="Lies still in the shallows like a rock. When you walk past, it drags you under.")

def m_scarab(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 2, 0], "root")
    m.box("body", [-3, 1, -3], [6, 3, 7], "shell"); m.bone("head", [0, 2, -3], "body"); m.box("head", [-2, 1, -5], [4, 2, 2], "shell", face="eyes")
    for i, z in enumerate((-2, 0, 2)):
        for s in (-1, 1):
            nm = f"leg_{'l' if s > 0 else 'r'}{i}"; m.bone(nm, [s * 3, 1, z], "root"); m.box(nm, [s * 3 - (s < 0) * 3, 0, z], [3, 1, 1], "leg")
mob(id="ash_scarab", name="Ash Scarab", family="wild_hostile", model=m_scarab, plan="bug",
    pal=P(shell={"c": (60, 40, 30), "style": "metal"}, leg=(40, 30, 24), eye=(255, 120, 30)),
    hp=6, speed=0.4, dmg=2, collision=(0.5, 0.35), resist=dict(fire=True), region="Emberwaste", egg=("#3c281e", "#ff781e"),
    spawn=dict(biomes=["desert", "mesa"], light=None, herd=(4, 7), weight=8, pop="monster"),
    lore="One is nothing. They are never one. Their bites smoulder, and their shells are half glass.")

def m_wyrm(m):
    m.bone("root", [0, 0, 0]); prev = "root"
    m.bone("head", [0, 6, 0], "root"); m.box("head", [-6, 0, -12], [12, 12, 12], "scale", face="mouth")
    m.box("head", [-5, 1, -13], [10, 3, 1], "tooth")
    for i in range(6):
        nm = f"seg{i}"; z = 12 * i; w = 11 - i
        m.bone(nm, [0, 6, z], prev if i else "root"); m.box(nm, [-w / 2, 0.5 + i * 0.5, z], [w, w, 12], "scale" if i % 2 == 0 else "plate")
        prev = nm
mob(id="dune_wyrm", name="Dune Wyrm", family="wild_hostile", model=m_wyrm, plan="wyrm",
    pal=P(scale={"c": (196, 160, 100), "style": "stone"}, plate={"c": (160, 120, 70), "style": "metal"}, tooth=(240, 230, 210), eye=(30, 20, 10)),
    hp=90, speed=0.28, dmg=10, kb=1.0, collision=(1.8, 1.5), groups="wyrm", region="Emberwaste", egg=("#c4a064", "#a07846"),
    spawn=dict(biomes=["desert", "mesa"], light=None, herd=(1, 1), weight=1, pop="monster"),
    lore="The sand ripples. Then the sand stands up. It hunts by the shake of your footsteps, so stand still or run.")

def m_hag(m):
    biped(m, mats={"head": "skin", "body": "rags", "leg": "rags"}, head=(8, 10, 8), face="eyes")
    m.box("head", [-1, 26, -6], [2, 4, 2], "skin"); m.box("head", [-5, 33, -5], [10, 2, 10], "hat"); m.box("head", [-3, 35, -3], [6, 5, 6], "hat")
    m.box("head", [-1.5, 39, 0], [3, 4, 3], "hat"); m.box("body", [-5, 2, -3], [10, 10, 6], "rags")
mob(id="bog_hag", name="Bog Hag", family="wild_hostile", model=m_hag,
    pal=P(skin=(120, 140, 90), rags={"c": (60, 64, 40), "style": "fur"}, hat={"c": (40, 36, 30), "style": "cloth"}, eye=(255, 140, 40)),
    hp=30, speed=0.27, dmg=3, ranged_def=("minecraft:splash_potion", 25), region="Blackfen", egg=("#3c4028", "#ff8c28"),
    spawn=dict(biomes=["swamp", "mangrove_swamp"], light=7, herd=(1, 1), weight=4, pop="monster"),
    lore="Throws poison and lays hexes. Old Mag says the hags were her sisters once. Old Mag says a lot of things.")

def m_toad(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 4, 0], "root"); m.box("body", [-5, 2, -5], [10, 6, 10], "skin")
    m.bone("head", [0, 6, -5], "body"); m.box("head", [-5, 5, -9], [10, 4, 5], "skin", face="eyes")
    m.box("head", [-4, 9, -8], [2, 2, 2], "wart"); m.box("head", [2, 9, -8], [2, 2, 2], "wart")
    for nm, sx, sz in (("leg_fr", -1, -1), ("leg_fl", 1, -1), ("leg_br", -1, 1), ("leg_bl", 1, 1)):
        x = sx * 5; z = sz * 4; m.bone(nm, [x, 2, z], "root"); m.box(nm, [x - 1.5, 0, z - 1.5], [3, 3, 3], "skin", mirror=sx > 0)
mob(id="mire_toad", name="Mire Toad", family="wild_hostile", model=m_toad, plan="quad",
    pal=P(skin={"c": (90, 110, 50), "style": "stone"}, wart=(160, 90, 40), eye=(250, 200, 40)),
    hp=16, speed=0.3, dmg=3, collision=(0.8, 0.6), hops=True, region="Blackfen", egg=("#5a6e32", "#fac828"),
    spawn=dict(biomes=["swamp", "mangrove_swamp"], light=None, herd=(1, 3), weight=6, pop="monster"),
    lore="Its tongue reaches six blocks. Its skin is poison, so punching it is a mistake.")

def m_wight(m):
    biped(m, mats={"head": "bone", "body": "mail", "arm": "bone", "leg": "mail"}, face="glow")
    m.box("head", [-4.5, 31, -4.5], [9, 2, 9], "crown"); m.box("head", [-4.5, 33, -4.5], [1, 2, 1], "crown"); m.box("head", [3.5, 33, -4.5], [1, 2, 1], "crown"); m.box("head", [-0.5, 33, -4.5], [1, 2, 1], "crown")
    m.box("body", [-4.5, 3, -2.5], [9, 10, 5], "shroud")
mob(id="barrow_wight", name="Barrow Wight", family="undead", model=m_wight,
    pal=P(bone={"c": (200, 196, 176), "style": "bone"}, mail={"c": (80, 84, 80), "style": "metal"}, crown={"c": (150, 130, 70), "style": "metal"}, shroud={"c": (50, 60, 56), "style": "cloth"}, eye=(120, 255, 180)),
    hp=34, speed=0.28, dmg=6, region="Aldmere Vale", burns=True, egg=("#c8c4b0", "#78ffb4"),
    spawn=dict(biomes=["plains", "forest"], light=7, herd=(1, 2), weight=5, pop="monster"),
    lore="A knight buried with his crown and his grudge. Every hit it lands heals it. The Vale's barrows are full of them.")

# ======================================================================================
# Family 4: Order of the Ashen Gate (friend or enemy depending on path)
# ======================================================================================
def m_squire(m):
    biped(m, mats={"head": "skin", "body": "tabard", "arm": "mail", "leg": "pants"}, face="eyes")
    m.box("head", [-4.5, 28, -4.5], [9, 5, 9], "helm")
    m.bone("blade", [-6, 12, 0], "arm_r"); m.box("blade", [-6.5, 2, -10], [1, 1, 12], "steel")
mob(id="ashen_squire", name="Ashen Squire", family="order", model=m_squire,
    pal=P(skin=SKIN, tabard={"c": (200, 196, 190), "style": "cloth"}, mail={"c": (120, 122, 128), "style": "metal"}, pants=(60, 60, 64), helm=IRON, steel=IRON, eye=(60, 80, 110)),
    hp=24, speed=0.3, dmg=5, egg=("#c8c4be", "#5a5a64"),
    lore="Young, loyal, and certain the Order has nothing to hide.")

def m_knight(m):
    biped(m, mats={"head": "plate", "body": "tabard", "arm": "plate", "leg": "plate"}, face="visor")
    m.box("head", [-4.5, 24, -4.5], [9, 9, 9], "plate"); m.box("head", [-0.5, 33, -2], [1, 3, 6], "plume")
    m.box("body", [-4.5, 12, -2.5], [9, 12, 5], "tabard", inflate=0.1)
    m.bone("blade", [-6, 12, 0], "arm_r"); m.box("blade", [-6.5, 2, -12], [1, 1, 14], "steel")
    m.bone("shield", [7, 20, 0], "arm_l"); m.box("shield", [6, 6, -5], [1, 12, 10], "shield")
mob(id="ashen_knight", name="Ashen Knight", family="order", model=m_knight,
    pal=P(plate={"c": (178, 182, 190), "style": "metal"}, tabard={"c": (210, 206, 198), "style": "cloth"}, plume=(160, 30, 30), steel=IRON, shield={"c": (90, 90, 96), "style": "metal"}, eye=(30, 30, 40)),
    hp=44, speed=0.29, dmg=8, kb=0.6, resist=dict(projectile=0.5), egg=("#b2b6be", "#a01e1e"),
    lore="Sworn to the Ashen Gate. An honest blade. Ask what the Gate guards and the conversation ends.")

def m_inquisitor(m):
    biped(m, mats={"head": "skin", "body": "coat", "arm": "coat", "leg": "coat"}, face="eyes")
    m.box("head", [-6, 31, -6], [12, 1, 12], "hat"); m.box("head", [-4, 32, -4], [8, 4, 8], "hat")
    m.box("body", [-4.5, 2, -2.5], [9, 10, 5], "coat"); m.box("body", [-1, 18, -2.7], [2, 5, 0], "sigil")
mob(id="inquisitor", name="Inquisitor", family="order", model=m_inquisitor,
    pal=P(skin=SKIN, coat={"c": (40, 36, 38), "style": "cloth"}, hat={"c": (28, 26, 28), "style": "cloth"}, sigil=GOLD, eye=(200, 60, 40)),
    hp=36, speed=0.3, dmg=4, ranged_def=("minecraft:arrow", None), hunts_marked=True, egg=("#282428", "#c83c28"),
    lore="Hunts the Marked. Near one, the Ember goes quiet: no spells, no Resonance, just you and a crossbow.")

# ======================================================================================
# Bosses
# ======================================================================================
BOSSES = []
def boss(**kw): kw["boss"] = True; BOSSES.append(kw); MOBS.append(kw); return kw

def m_reeve(m, small=False):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 14, 0], "root")
    m.box("body", [-8, 14, -6], [16, 18, 12], "brass"); m.box("body", [-9, 30, -7], [18, 2, 14], "iron")
    m.bone("pendulum", [0, 20, 6], "body"); m.box("pendulum", [-0.5, 8, 6], [1, 12, 1], "iron"); m.box("pendulum", [-2, 5, 5], [4, 4, 3], "brass")
    m.bone("head", [0, 32, 0], "body"); m.box("head", [-6, 32, -5], [12, 12, 10], "wood", face="clock")
    m.bone("hand_minute", [0, 38, -5.2], "head"); m.box("hand_minute", [-0.5, 38, -5.4], [1, 5, 0], "iron")
    m.bone("hand_hour", [0, 38, -5.3], "head"); m.box("hand_hour", [0, 37.5, -5.5], [3, 1, 0], "iron")
    for i, (x, y, r) in enumerate(((-9, 26, 6), (9, 22, 5), (0, 34, 4))):
        nm = f"gear{i}"; m.bone(nm, [x, y, 7], "body"); m.box(nm, [x - r, y - r, 6], [2 * r, 2 * r, 2], "gear")
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 10, 30, 0], "body"); m.box(nm, [s * 10 - 2, 12, -2], [4, 18, 4], "iron", mirror=s > 0); m.box(nm, [s * 10 - 3, 8, -3], [6, 4, 6], "brass")
    for s, nm in ((-1, "leg_r"), (1, "leg_l")):
        m.bone(nm, [s * 4, 14, 0], "root"); m.box(nm, [s * 4 - 2.5, 0, -2.5], [5, 14, 5], "iron", mirror=s > 0)
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
    biped(m, L=16, B=14, bw=7, bd=4, head=(7, 8, 7), arm=(3, 16, 3), mats={"head": "skull", "body": "cloak", "arm": "pale", "leg": "leather"}, face="glow")
    for s in (-1, 1):
        m.box("head", [s * 3 - 0.5, 38, -1], [1, 8, 1], "antler"); m.box("head", [s * 3 + (s > 0) * 1 - (s < 0) * 4, 43, -1], [4, 1, 1], "antler"); m.box("head", [s * 7 - 0.5, 43, -1], [1, 6, 1], "antler")
    m.box("body", [-5, 6, 2], [10, 24, 1], "cloak")
    m.bone("bow", [6, 18, 0], "arm_l"); m.box("bow", [6.5, 8, -2], [1, 18, 1], "antler")
BOSS_HUNT = P(skull={"c": (226, 226, 220), "style": "bone"}, cloak={"c": (190, 200, 210), "style": "fur"}, pale=(210, 214, 216), leather={"c": (90, 80, 76), "style": "cloth"}, antler={"c": (200, 226, 240), "style": "bone"}, eye=(140, 230, 255))
boss(id="pale_huntsman", name="The Pale Huntsman", region="Frostmarch", model=m_huntsman, pal=BOSS_HUNT,
     hp=360, speed=0.33, dmg=8, kb=0.7, collision=(0.9, 3.0), ranged_def=("minecraft:arrow", None), egg=("#e2e2dc", "#8ce6ff"),
     lore="He led Hollowfast's hunters onto the frozen lake one night, and only he walked back off it.")

def m_bride(m):
    m.bone("root", [0, 0, 0]); m.bone("body", [0, 12, 0], "root")
    m.box("body", [-6, 0, -5], [12, 12, 10], "dress"); m.box("body", [-4, 12, -2.5], [8, 12, 5], "dress")
    m.bone("head", [0, 24, 0], "body"); m.box("head", [-4, 24, -4], [8, 8, 8], "skin", face="hollow"); m.box("head", [-4.5, 23, -4.5], [9, 10, 9], "veil", inflate=0.3)
    m.box("head", [-5, 8, 3.5], [10, 24, 1], "veil")
    for s, nm in ((-1, "arm_r"), (1, "arm_l")):
        m.bone(nm, [s * 5, 22, 0], "body"); m.box(nm, [s * 5 - 1.5, 8, -1.5], [3, 14, 3], "skin", mirror=s > 0)
boss(id="drowned_bride", name="The Drowned Bride", region="Saltreach", model=m_bride, plan="float", material="entity_alphablend",
     pal=P(dress={"c": (190, 210, 214, 220), "style": "cloth"}, skin=(150, 180, 176), veil={"c": (220, 236, 240, 150), "style": "cloth"}, eye=(160, 250, 230)),
     hp=320, speed=0.27, dmg=8, kb=1.0, fly=0.3, swim=True, collision=(1.0, 2.2), egg=("#bed2d6", "#a0fae6"),
     lore="The lighthouse keeper still writes to her. She has been answering, from three hundred years under the water.")

def m_seneschal(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "face", "body": "plate", "arm": "plate", "leg": "plate"}, face="blank")
    m.box("body", [-5.5, 14, -3.5], [11, 16, 7], "tabard", inflate=0.1); m.box("head", [-4.5, 38, -4.5], [9, 2, 9], "gold")
    m.bone("shield", [8, 26, 0], "arm_l"); m.box("shield", [7.5, 4, -9], [2, 26, 16], "shield"); m.box("shield", [9.5, 15, -2], [1, 4, 2], "gold")
    m.bone("mainhand", [-8, 14, 0], "arm_r")
boss(id="ash_seneschal", name="The Ash Seneschal", region="Emberwaste", model=m_seneschal,
     pal=P(face={"c": (200, 190, 170), "style": "stone"}, plate={"c": (90, 80, 76), "style": "metal"}, tabard={"c": (150, 60, 30), "style": "cloth"}, gold=GOLD, shield={"c": (120, 100, 80), "style": "metal"}),
     hp=420, speed=0.27, dmg=12, kb=1.0, collision=(1.2, 3.2), scale=1.1, resist=dict(fire=True), egg=("#5a504c", "#963c1e"),
     lore="Sunscar chiseled a face off every statue. The Seneschal chiseled off his own.")

def m_mother(m):
    biped(m, L=18, B=16, bw=8, bd=5, head=(8, 9, 8), arm=(3, 28, 3), mats={"head": "skin", "body": "moss", "arm": "skin", "leg": "root"}, face="glow")
    for s in (-1, 1):
        m.box("head", [s * 3 - 0.5, 43, 0], [1, 6, 1], "root"); m.box("head", [s * 5 - 0.5, 46, 0], [1, 5, 1], "root")
    m.box("body", [-5, 4, -3], [10, 14, 6], "moss")
MOTHER_PAL = P(skin=(130, 150, 110), moss={"c": (60, 80, 44), "style": "fur"}, root={"c": (80, 60, 40), "style": "wood"}, eye=(255, 230, 80))
boss(id="mother_of_changelings", name="The Mother of Changelings", region="Blackfen", model=m_mother, pal=MOTHER_PAL,
     hp=380, speed=0.3, dmg=9, kb=0.8, collision=(1.0, 3.4), egg=("#3c502c", "#ffe650"),
     lore="Every changeling in Mirelight is one of her children. She hides among them, and she has a true name she would kill to keep.")
mob(id="mother_echo", name="The Mother of Changelings", family="boss_add", model=m_mother, pal=MOTHER_PAL, hp=10, speed=0.3, dmg=4,
    collision=(1.0, 3.4), egg=("#3c502c", "#a0a050"), no_loot=True, lore="One of her masks.")

def m_king(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate"}, face="visor")
    m.box("head", [-4.5, 30, -4.5], [9, 9, 9], "plate"); m.box("head", [-5, 39, -5], [10, 2, 10], "crown")
    for x in (-5, -1, 3): m.box("head", [x, 41, -5], [2, 3, 1], "crown")
    m.box("head", [-1, 41, -5.5], [2, 2, 1], "shard")
    m.box("body", [-6, 6, 3], [12, 24, 1], "cape")
    m.bone("blade", [-8, 14, 0], "arm_r"); m.box("blade", [-9, 1, -18], [2, 2, 20], "steel"); m.box("blade", [-10.5, 0.5, -1], [5, 3, 1], "crown")
boss(id="warlord_king", name="The Warlord King", region="Grand Siege", model=m_king,
     pal=P(skin=SKIN, plate={"c": (56, 50, 54), "style": "metal"}, crown=GOLD, shard={"c": (200, 220, 255), "style": "glow"}, cape={"c": (110, 20, 24), "style": "cloth"}, steel=IRON, eye=(255, 60, 40)),
     hp=300, speed=0.3, dmg=12, kb=1.0, collision=(1.2, 3.0), scale=1.05, raider=True, egg=("#383236", "#dab046"),
     lore="Something in his crown catches the light wrong. He has lost before. He keeps coming back.")

def m_oswin(m):
    biped(m, L=14, B=16, bw=10, bd=6, head=(8, 9, 8), arm=(5, 16, 5), mats={"head": "skin", "body": "plate", "arm": "plate", "leg": "plate"}, face="hollow")
    m.box("head", [-5, 39, -5], [10, 3, 10], "crown"); m.box("head", [-3, 39.5, -3], [6, 3, 6], "void")
    for x in (-5, 3): m.box("head", [x, 42, -5], [2, 4, 2], "crown")
    m.box("body", [-6, 2, 3], [12, 28, 1], "cape"); m.box("body", [-5.5, 14, -3.5], [11, 16, 7], "tabard", inflate=0.1)
    m.bone("blade", [-8, 14, 0], "arm_r"); m.box("blade", [-9, 1, -20], [2, 2, 22], "steel")
OSWIN_PAL = P(skin=(150, 170, 170), plate={"c": (60, 84, 90), "style": "metal"}, crown={"c": (180, 170, 140), "style": "metal"}, void=(6, 4, 10), cape={"c": (40, 60, 80), "style": "cloth"}, tabard={"c": (90, 110, 120), "style": "cloth"}, steel={"c": (150, 190, 200), "style": "metal"}, eye=(200, 240, 255))
boss(id="oswin_the_last", name="Oswin the Last", region="The Hollow", model=m_oswin, pal=OSWIN_PAL,
     hp=500, speed=0.31, dmg=13, kb=1.0, collision=(1.2, 3.0), scale=1.05, swim=True, egg=("#3c5460", "#c8f0ff"),
     lore="A king on a drowned throne, in a hall nobody built for the living. He has been waiting a long time for someone to get this far.")
mob(id="oswin_reflection", name="The King's Hollow", family="boss_add", model=m_oswin, material="entity_alphablend",
    pal={**OSWIN_PAL, "plate": {"c": (170, 210, 230, 170), "style": "metal"}, "cape": {"c": (120, 160, 200, 150), "style": "cloth"}, "tabard": {"c": (150, 190, 210, 160), "style": "cloth"}, "skin": (190, 220, 230, 190)},
    hp=200, speed=0.33, dmg=10, kb=1.0, collision=(1.2, 3.0), scale=1.05, egg=("#a0d2e6", "#ffffff"), no_loot=True,
    lore="Something steps out of the king and leaves him kneeling. He cannot be touched until it is dealt with.")

# Warlords that aren't the King also get their own body now
mob(id="hollow_warlord", name="Warlord", family="raider", model=m_king,
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

def m_bolt(m):
    m.bone("root", [0, 0, 0]); m.box("root", [-1.5, 0, -1.5], [3, 3, 3], "orb")
mob(id="hollow_bolt", name="Hollow Bolt", family="projectile", model=m_bolt, plan="none",
    pal=P(orb={"c": (170, 100, 255), "style": "glow"}), hp=1, projectile=True, collision=(0.3, 0.3), egg=None, no_loot=True, lore="")
