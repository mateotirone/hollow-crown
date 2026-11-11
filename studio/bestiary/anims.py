# Bestiary animations: how every mob and boss moves.
#
# Each mob gets a small set of animations instead of one looping wiggle:
#   base     head follows its target, plus the mob's own extras (Reeve's gears, a bell swinging...)
#   idle     breathing and its habits while standing (Hollow folk twitch, hunters scan, clockwork ticks)
#   walk     its gait, faster and leaning in when it runs (scaled by query.modified_move_speed)
#   attack   one swing that fits its weapon, played by a controller each time the engine swings (variable.attack_time)
#   aim      archers and casters raise bow, crossbow or staff while they have a target
#   hurt     a flinch each time it is hit
# Bosses also get one wind-up pose ("wind", held and trembling) and one release ("strike") for every
# fight attack, plus "rage" when a phase begins. scripts/bestiary/anim.js plays them from bossCore: the
# wind-up when the warning goes up, the strike when the hit lands. Death is the body (bodies.js) falling.
#
# Run on its own (python3 studio/bestiary/anims.py) to rewrite only animation files, client entities
# and scripts/bestiary/moves.js; build.py calls the same code on a full rebuild.
import json, os

WALK_COS = "math.cos(query.modified_distance_moved*{c})"
SPEED = "query.modified_move_speed"

# ---------- gaits ----------
# leg/arm swing in degrees, cadence (stride frequency per block walked), body bob (px), lean when running (deg),
# hunch (constant forward lean), sway (side roll per step), uneven (one leg drags), idle style
GAITS = {
    "march":   dict(leg=40, arm=30, cad=38.17, bob=0.6, lean=8, hunch=0, sway=0, uneven=0, idle="soldier"),
    "heavy":   dict(leg=28, arm=16, cad=26.0, bob=1.3, lean=4, hunch=2, sway=5, uneven=0, idle="heavy"),
    "stalk":   dict(leg=34, arm=10, cad=32.0, bob=0.5, lean=12, hunch=10, sway=0, uneven=0, idle="scan"),
    "shamble": dict(leg=36, arm=6, cad=30.0, bob=0.9, lean=6, hunch=6, sway=7, uneven=0.45, idle="twitch"),
    "regal":   dict(leg=32, arm=12, cad=34.0, bob=0.3, lean=4, hunch=0, sway=0, uneven=0, idle="still"),
    "nimble":  dict(leg=50, arm=40, cad=40.0, bob=0.8, lean=12, hunch=3, sway=0, uneven=0, idle="soldier"),
    "clock":   dict(leg=26, arm=14, cad=24.0, bob=1.0, lean=2, hunch=0, sway=4, uneven=0, idle="tick"),
    "float":   dict(leg=0, arm=0, cad=0, bob=0, lean=14, hunch=0, sway=0, uneven=0, idle="drift"),
}
GAIT_OF = {
    "shieldwall_brute": "heavy", "siege_ogre": "heavy", "hollow_warlord": "heavy", "gatebreaker": "heavy", "ash_seneschal": "heavy",
    "warlord_king": "heavy", "pretender_brute": "heavy",
    "crow_mage": "stalk", "veinsworn": "stalk", "barrow_wight": "stalk", "pale_huntsman": "stalk", "mother_of_changelings": "stalk", "mother_echo": "stalk",
    "lost_villager": "shamble", "changeling": "shamble", "wrongling": "shamble", "bog_hag": "shamble",
    "mirror_knight": "regal", "ashen_knight": "regal", "inquisitor": "regal", "oswin_the_last": "regal", "oswin_reflection": "regal", "pretender_seer": "regal",
    "grey_bellcutter": "nimble", "pretender_blade": "nimble", "champion_knight": "nimble", "champion_sorcerer": "nimble", "champion_lord": "nimble", "champion_retainer": "nimble",
    "clockwork_reeve": "clock", "reeve_cog": "clock",
}

# ---------- what it swings ----------
WEAPON_KIND = {"sword": "slash", "blade": "slash", "torch": "slash", "axe": "chop", "mace": "chop", "mainhand": "chop",
               "greatsword": "cleave", "log": "cleave", "spear": "thrust", "bow": "bow", "crossbow": "crossbow",
               "staff": "cast", "pole": "chop", "shards": "cast", "halo": "cast"}

# ---------- boss moves: fight attack id -> pose archetype, per entity ----------
PRETENDER_MOVES = {"lance": "thrust", "ground": "slam", "ring": "slam", "call": "call", "pull": "pull", "blink": "vanish", "rain": "call", "mark": "point", "wall": "sweep"}
BOSS_MOVES = {
    "clockwork_reeve": {"timestop": "clockstrike", "cog": "throw", "rewind": "rewind"},
    "pale_huntsman": {"marked": "drawhigh", "pack": "howl", "snare": "snare"},
    "drowned_bride": {"wail": "wail", "grasp": "grasp", "drowned": "call"},
    "ash_seneschal": {"bash": "bash", "cleave": "sweep", "volley": "point", "sand": "overhead"},
    "mother_of_changelings": {"roots": "grasp", "brood": "roar", "lullaby": "cradle"},
    "warlord_king": {"warcry": "roar", "lance": "thrust", "toll": "overhead", "quake": "slam"},
    "oswin_the_last": {"toll": "slam", "blow": "sweep", "blink": "vanish", "tollmen": "call", "surface": "call", "lance": "thrust", "quake": "slam", "overhead": "slam"},
    "pretender_blade": PRETENDER_MOVES, "pretender_seer": PRETENDER_MOVES, "pretender_brute": PRETENDER_MOVES,
}

def num(v): return round(v, 3) if isinstance(v, float) else v

# Poses use roles: W = weapon arm, O = the other arm, B = body, H = head, R = root, LR/LL = legs, X = weapon bone.
# Rotations are [x, y, z] in degrees on top of the rest pose (negative x lifts an arm forward; positive x tips body or head forward).
# W is written as if it were the right arm and O as if it were the left (positive z = right arm out, negative z = left arm out;
# negative y turns the right arm in across the body, positive y the left); a mob holding things the other way round is mirrored.
# Careful: with an arm raised over the head (x below about -110) z works the other way round, so spreading raised arms is negative z.
# A string in a pose is molang; "~" in it stands for a tremble that only plays while the wind-up is held.
TREM = "math.sin(query.life_time*1900)*1.6"
ARCH = {
    # wind-up pose, strike pose (where the swing ends before it eases back)
    "slash":   ({"W": [-140, 25, 20], "B": [0, 20, 0]}, {"W": [-35, -35, -10], "B": [6, -22, 0]}),
    "chop":    ({"W": [-165, 0, 12], "B": [-8, 12, 0], "H": [-6, 0, 0]}, {"W": [-25, 0, 0], "B": [16, -6, 0], "H": [6, 0, 0]}),
    "cleave":  ({"W": [-165, 0, 10], "O": [-165, 0, -10], "B": [-12, 0, 0], "H": [-8, 0, 0]}, {"W": [-30, 0, 4], "O": [-30, 0, -4], "B": [24, 0, 0], "H": [10, 0, 0], "R": {"position": [0, -1.5, 0]}}),
    "thrust":  ({"W": [-70, 0, 0], "B": [0, 30, 0], "R": {"position": [0, 0, 1.5]}}, {"W": [-95, 0, 0], "B": [8, -15, 0], "R": {"position": [0, 0, -2.5]}, "LR": [-25, 0, 0]}),
    "claw":    ({"W": [-125, 0, 25], "O": [-125, 0, -25], "B": [-10, 0, 0]}, {"W": [-25, 0, -5], "O": [-25, 0, 5], "B": [18, 0, 0], "H": [8, 0, 0]}),
    "reach":   ({"W": [-60, 0, 20], "O": [-60, 0, -20], "B": [-6, 0, 0]}, {"W": [-100, 0, -5], "O": [-100, 0, 5], "B": [12, 0, 0], "R": {"position": [0, 0, -2]}}),
    "cast":    ({"W": [-150, 0, 10], "O": [-50, 0, -20], "B": [-8, 0, 0], "H": [-10, 0, 0]}, {"W": [-95, 0, 0], "O": [-90, 0, 0], "B": [8, 0, 0], "H": [4, 0, 0]}),
    "bow":     ({"W": [-90, -6, 0], "O": [-90, 30, 0]}, {"W": [-78, -6, 0], "O": [-90, 8, 0], "B": [-4, 0, 0]}),
    "crossbow": ({"W": [-90, 0, 0], "O": [-90, 30, 0]}, {"W": [-75, 0, 0], "O": [-80, 30, 0], "B": [-5, 0, 0], "R": {"position": [0, 0, 1]}}),
    "bite":    ({"H": [-30, 0, 0], "B": [-8, 0, 0], "jaw": [5, 0, 0]}, {"H": [22, 0, 0], "B": [8, 0, 0], "jaw": [35, 0, 0], "R": {"position": [0, 0, -2.5]}}),
    "peck":    ({"B": [-25, 0, 0], "H": [-20, 0, 0]}, {"B": [30, 0, 0], "H": [25, 0, 0]}),
    "strike":  ({"H": [-45, 0, 0], "seg0": [-25, 0, 0], "seg1": [-10, 0, 0]}, {"H": [35, 0, 0], "seg0": [20, 0, 0], "seg1": [10, 0, 0]}),
    # boss moves
    "slam":    ({"W": ["-170+~", 0, 10], "O": ["-170+~", 0, -10], "B": [-14, 0, 0], "H": [-12, 0, 0]},
                {"W": [-25, 0, 4], "O": [-25, 0, -4], "B": [30, 0, 0], "H": [12, 0, 0], "LR": [-30, 0, 0], "LL": [20, 0, 0], "R": {"position": [0, -2.5, 0]}}),
    "overhead": ({"W": ["-172+~", 0, 15], "B": [-10, 15, 0], "H": [-8, 0, 0]}, {"W": [-20, 0, 0], "B": [22, -10, 0], "H": [8, 0, 0], "R": {"position": [0, -1.5, 0]}}),
    "sweep":   ({"W": ["-85+~", 75, 0], "B": [0, 45, 0], "H": [0, -20, 0]}, {"W": [-85, -85, 0], "B": [4, -50, 0], "H": [0, 25, 0]}),
    "throw":   ({"W": ["-170+~", 0, 0], "B": [-12, 32, 0], "O": [-40, 0, -20]}, {"W": [-60, 0, 0], "B": [14, -28, 0], "O": [10, 0, -10]}),
    "call":    ({"W": ["-150+~", 0, -25], "O": ["-150+~", 0, 25], "H": [-30, 0, 0], "B": [-8, 0, 0]}, {"W": [-178, 0, -40], "O": [-178, 0, 40], "H": [-42, 0, 0], "B": [-12, 0, 0]}),
    "pull":    ({"W": ["-95+~", 0, 0], "O": ["-95+~", 0, 0], "B": [10, 0, 0]}, {"W": [-40, 0, 20], "O": [-40, 0, -20], "B": [-14, 0, 0], "R": {"position": [0, 0, 1.5]}}),
    "point":   ({"W": ["-150+~", 0, 0], "O": [-20, 0, -15], "B": [-6, 15, 0]}, {"W": [-95, 0, 0], "O": [-10, 0, -10], "B": [6, -5, 0]}),
    "roar":    ({"H": ["-35+~", 0, 0], "W": [-40, 0, 50], "O": [-40, 0, -50], "B": [-16, 0, 0]}, {"H": ["-45+~*3", 0, 0], "W": [-60, 0, 75], "O": [-60, 0, -75], "B": [-20, 0, 0]}),
    "vanish":  ({"B": [30, 0, 0], "H": [20, 0, 0], "W": [-70, -40, 0], "O": [-70, 40, 0], "LR": [-35, 0, 0], "LL": [-35, 0, 0], "R": {"position": [0, -3, 0]}},
                {"B": [-10, 0, 0], "H": [-8, 0, 0], "W": [-20, 0, 70], "O": [-20, 0, -70]}),
    "bash":    ({"O": ["-115+~", 0, -10], "B": [-8, 22, 0]}, {"O": [-80, 10, 0], "B": [16, -16, 0], "R": {"position": [0, 0, -3]}, "LR": [-25, 0, 0]}),
    "clockstrike": ({"W": ["-175+~", 0, 12], "O": ["-175+~", 0, -12], "H": ["-8", "~*2", 0], "B": [-10, 0, 0]},
                    {"W": [-40, 0, 6], "O": [-40, 0, -6], "B": [24, 0, 0], "H": [10, 0, 0], "R": {"position": [0, -2, 0]}}),
    "rewind":  ({"W": ["-90+math.sin(query.life_time*720)*40", 0, 15], "O": ["-90-math.sin(query.life_time*720)*40", 0, -15], "H": [0, "-math.sin(query.life_time*360)*10", 0]},
                {"B": [-16, 0, 0], "W": [-30, 0, 40], "O": [-30, 0, -40], "H": [-10, 0, 0]}),
    "drawhigh": ({"W": ["-115+~", -6, 0], "O": ["-115+~", 32, 0], "B": [-10, 0, 0], "H": [-15, 0, 0]}, {"W": [-100, -6, 0], "O": [-100, 5, 0], "B": [-14, 0, 0], "H": [-15, 0, 0]}),
    "howl":    ({"H": ["-50+~", 0, 0], "O": [-110, 35, 0], "B": [-16, 0, 0]}, {"H": [-55, 0, 0], "W": [-45, 0, 60], "O": [-45, 0, -60], "B": [-18, 0, 0]}),
    "snare":   ({"B": [28, 0, 0], "O": [-35, 0, -25], "H": [12, 0, 0], "R": {"position": [0, -2, 0]}}, {"B": [-6, 0, 0], "O": [-130, 0, -35], "H": [-6, 0, 0]}),
    "wail":    ({"H": ["-40+~", 0, 0], "W": [-30, 0, 65], "O": [-30, 0, -65], "B": [-16, 0, 0]}, {"H": ["16+~*3", 0, 0], "W": [-100, 0, 18], "O": [-100, 0, -18], "B": ["10+~*2", 0, 0]}),
    "grasp":   ({"B": [35, 0, 0], "W": ["-60+~", 0, 0], "O": ["-60+~", 0, 0], "H": [20, 0, 0], "R": {"position": [0, -2, 0]}}, {"B": [-15, 0, 0], "W": [-165, 0, -30], "O": [-165, 0, 30], "H": [-20, 0, 0]}),
    "cradle":  ({"W": [-55, -40, 0], "O": [-55, 40, 0], "H": [15, 0, "18+math.sin(query.life_time*100)*8"], "B": [6, 0, "math.sin(query.life_time*100)*6"]},
                {"W": [-55, -40, 0], "O": [-55, 40, 0], "H": [15, 0, "18+math.sin(query.life_time*100)*8"], "B": [6, 0, "math.sin(query.life_time*100)*6"]}),
    "rage":    ({}, {"H": ["-40+~*3", 0, 0], "W": [-55, 0, 70], "O": [-55, 0, -70], "B": [-18, 0, 0], "R": {"position": ["~*0.3", 0, 0]}}),
}

class Rig:
    """Which bones a model has and which arm holds what, so a pose by role becomes a pose by bone."""
    def __init__(self, model):
        self.bones = {b["name"]: b for b in model.bones}
        self.names = set(self.bones)
        parent = lambda n: self.bones[n].get("parent")
        self.weapon = next((n for n in self.bones if n in WEAPON_KIND and parent(n) in ("arm_r", "arm_l")), None)
        self.shield = "shield" if "shield" in self.names else None
        self.W = parent(self.weapon) if self.weapon else "arm_r"
        if self.W == "arm_l" and self.shield and parent(self.shield) == "arm_l": self.W = "arm_r"
        self.O = "arm_l" if self.W == "arm_r" else "arm_r"
        if self.shield and parent(self.shield) in ("arm_r", "arm_l"): self.O = parent(self.shield)
        self.kind = WEAPON_KIND.get(self.weapon) if self.weapon else None

    def bone_of(self, role):
        return {"W": self.W, "O": self.O, "B": "body", "H": "head", "R": "root", "LR": "leg_r", "LL": "leg_l"}.get(role, role)

    body_k = 1.0   # floaters bend from the hem, so their body poses are toned down

    def resolve(self, pose, tremble=True):
        """Role pose -> {bone: {channel: [x, y, z]}}. An arm on the other side from its role's usual one is mirrored (y and z flip)."""
        out = {}
        for role, v in pose.items():
            bone = self.bone_of(role)
            if bone not in self.names: continue
            ch = v if isinstance(v, dict) else {"rotation": v}
            for c, vec in ch.items():
                vec = [fix(x, tremble) for x in vec]
                if bone == "body" and c == "rotation" and self.body_k != 1: vec = [x * self.body_k if isinstance(x, (int, float)) else f"({x})*{self.body_k}" for x in vec]
                if c == "rotation" and ((role == "W" and bone == "arm_l") or (role == "O" and bone == "arm_r")): vec = [vec[0], neg(vec[1]), neg(vec[2])]
                out.setdefault(bone, {})[c] = vec
            if role in ("W", "O") and bone.startswith("arm_") and ("arm2_" + bone[4:]) in self.names:   # the Gatebreaker's lower arms follow the upper ones
                out["arm2_" + bone[4:]] = {k: list(x) for k, x in out[bone].items()}
        return out

def fix(x, tremble):
    if isinstance(x, str):
        x = x.replace("~", f"({TREM})" if tremble else "0")
        try: return num(float(eval(x, {"__builtins__": {}})))
        except Exception: return x
    return num(x)

def neg(x):
    if isinstance(x, (int, float)): return num(-x)
    return f"-({x})"

def add(a, b):
    """a + b for numbers or molang strings."""
    if isinstance(a, (int, float)) and isinstance(b, (int, float)): return num(a + b)
    if a in (0, "0"): return b
    if b in (0, "0"): return a
    return f"{a}+{b}"

def zero_like(pose):
    return {bn: {c: [0, 0, 0] for c in chs} for bn, chs in pose.items()}

def merge_keys(*poses):
    keys = {}
    for p in poses:
        for bn, chs in p.items():
            for c in chs: keys.setdefault(bn, set()).add(c)
    return keys

def timeline(frames, keys):
    """frames: [(t, pose)] -> bones with keyframes. Missing bone/channel in a frame = 0."""
    bones = {}
    for bn, chans in keys.items():
        for c in sorted(chans):
            kf = {}
            for t, pose in frames:
                kf[f"{t:g}"] = pose.get(bn, {}).get(c, [0, 0, 0])
            bones.setdefault(bn, {})[c] = kf
    return bones

def drop_locked(bones, locked):
    """Leave out channels that a mob's own extras already drive (champions' arms, the Reeve's gears)."""
    out = {}
    for bn, chs in bones.items():
        keep = {c: v for c, v in chs.items() if (bn, c) not in locked}
        if keep: out[bn] = keep
    return out

def anim(bones, **kw):
    a = dict(kw)
    if bones: a["bones"] = bones
    elif "animation_length" not in a: a["animation_length"] = 1.0
    return a

# ---------- the per-mob set ----------
def plan_of(m): return m.get("plan", "biped")

def has_melee(bp):
    c = bp["minecraft:entity"]["components"]; groups = bp["minecraft:entity"]["component_groups"].values()
    return any("minecraft:behavior.melee_attack" in g or "minecraft:behavior.swoop_attack" in g for g in [c, *groups])

def has_shooter(bp):
    c = bp["minecraft:entity"]["components"]; groups = bp["minecraft:entity"]["component_groups"].values()
    return any("minecraft:shooter" in g for g in [c, *groups])

def build_set(m, model, bp):
    """Returns (animations {id: anim}, controllers {id: ctrl}, client animations map, animate list, boss moves list)."""
    mid = m["id"]; plan = plan_of(m); rig = Rig(model); n = rig.names
    if plan == "float": rig.body_k = 0.4
    P = f"animation.siege_b.{mid}"
    anims = {}; ctrls = {}; amap = {}; animate = []
    locked = {(bone, ch) for bone, ch, _ in m.get("anim_extra", [])}

    # base: head look + extras (always there, the old single animation's name)
    base = {}
    if plan != "none" and "head" in n and ("head", "rotation") not in locked: base["head"] = {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}
    for bone, ch, val in m.get("anim_extra", []):
        if bone in n: base.setdefault(bone, {})[ch] = val
    anims[P] = anim(base, loop=True); amap["base"] = P; animate.append("base")
    if plan == "none":
        idle = still_idle(mid, n)
        if idle:
            anims[P + ".idle"] = anim(idle, loop=True); amap["idle"] = P + ".idle"; animate.append("idle")
        return anims, ctrls, amap, animate, []

    # idle + walk
    idle, walk = motion(m, rig, plan)
    for name, bones in (("idle", idle), ("walk", walk)):
        bones = drop_locked(bones, locked)
        if bones: anims[f"{P}.{name}"] = anim(bones, loop=True); amap[name] = f"{P}.{name}"; animate.append(name)

    # one-shot attack, on the engine's swing
    melee, shooter = has_melee(bp), has_shooter(bp)
    kind = attack_kind(m, rig, plan)
    if melee or (shooter and kind not in ("bow", "crossbow", "cast")):
        wind, strike = ARCH[kind]
        w, s = rig.resolve(wind, False), rig.resolve(strike, False)
        keys = merge_keys(w, s)
        bones = drop_locked(timeline([(0, {}), (0.12, w), (0.24, s), (0.5, {})], keys), locked)
        if bones:
            anims[P + ".attack"] = anim(bones, animation_length=0.5); amap["attack"] = P + ".attack"
            amap["swing"] = f"controller.animation.siege_b.{mid}.swing"; animate.append("swing")
            ctrls[amap["swing"]] = {"initial_state": "default", "states": {
                "default": {"transitions": [{"swinging": "variable.attack_time > 0"}]},
                "swinging": {"animations": ["attack"], "transitions": [{"default": "query.all_animations_finished"}], "blend_transition": 0.1}}}
    # ready pose while it has a target: bows drawn, crossbows levelled, staffs raised, shields up
    ready = ready_pose(rig, kind, shooter)
    ready = drop_locked(rig.resolve(ready, False), locked) if ready else {}
    if ready:
        anims[P + ".aim"] = anim(ready, loop=True); amap["aim"] = P + ".aim"
        amap["ready"] = f"controller.animation.siege_b.{mid}.ready"; animate.append("ready")
        ctrls[amap["ready"]] = {"initial_state": "default", "states": {
            "default": {"transitions": [{"aiming": "query.has_target"}], "blend_transition": 0.25},
            "aiming": {"animations": ["aim"], "transitions": [{"default": "!query.has_target"}], "blend_transition": 0.25}}}

    # flinch when hit
    hurt = drop_locked(rig.resolve(hurt_pose(plan), False), locked)
    if hurt:
        keys = merge_keys(hurt)
        anims[P + ".hurt"] = anim(timeline([(0, {}), (0.08, hurt), (0.35, {})], keys), animation_length=0.35); amap["hurt"] = P + ".hurt"
        amap["flinch"] = f"controller.animation.siege_b.{mid}.flinch"; animate.append("flinch")
        ctrls[amap["flinch"]] = {"initial_state": "default", "states": {
            "default": {"transitions": [{"flinching": "query.hurt_time > 0"}]},
            "flinching": {"animations": ["hurt"], "transitions": [{"default": "query.all_animations_finished && query.hurt_time <= 0"}]}}}

    # boss moves, played by script
    moves = []
    table = BOSS_MOVES.get(mid)
    if table is not None:
        for move, arch in list(table.items()) + [("rage", "rage")]:
            wind, strike = ARCH[arch]
            w_hold, w_flat, s = rig.resolve(wind, True), rig.resolve(wind, False), rig.resolve(strike, True)
            keys = merge_keys(w_hold, s)
            if not keys: continue
            if w_hold:
                anims[f"{P}.move.{move}.wind"] = anim(timeline([(0, {}), (0.35, w_hold)], merge_keys(w_hold)), loop="hold_on_last_frame", animation_length=0.35)
            frames = [(0, w_flat), (0.12, s), (0.5 if arch != "rage" else 1.2, s), (0.9 if arch != "rage" else 1.6, {})]
            anims[f"{P}.move.{move}.strike"] = anim(timeline(frames, keys), animation_length=frames[-1][0])
            moves.append(move)
    return anims, ctrls, amap, animate, moves

def attack_kind(m, rig, plan):
    if plan in ("quad", "bug"): return "bite"
    if plan == "bird": return "peck"
    if plan == "wyrm": return "strike"
    if rig.kind: return rig.kind
    return "reach" if plan == "float" else "claw"

def ready_pose(rig, kind, shooter):
    aimx = "query.target_x_rotation-90"
    if kind == "bow": return {"W": [aimx, -6, 0], "O": [aimx, "30+math.sin(query.life_time*200)*3", 0]}
    if kind == "crossbow": return {"W": [aimx, 0, 0], "O": [aimx, 30, 0]}
    if kind == "cast" and shooter: return {"W": [-40, 0, 10], "O": [-70, 0, "-15+math.sin(query.life_time*160)*6"]}
    if rig.shield: return {"O": [-30, 18, 0]}
    if rig.weapon and kind in ("slash", "chop", "thrust", "cleave"): return {"W": [-20, 0, 0]}
    return None

def hurt_pose(plan):
    if plan in ("quad", "bug"): return {"B": [-8, 0, 0], "H": [-18, 0, 0], "R": {"position": [0, 0, 1.2]}}
    if plan in ("bird", "wyrm"): return {"H": [-20, 0, 0], "seg0": [-10, 0, 0], "B": [-10, 0, 0]}
    return {"B": [-10, 0, 0], "H": [-14, 0, 0], "W": [-15, 0, 12], "O": [-15, 0, -12], "R": {"position": [0, 0, 1]}}

def still_idle(mid, n):
    """Mobs with no walk cycle that still have a habit."""
    if mid == "omen_raven" and "head" in n:   # a raven's head jerks from side to side
        return {"head": {"rotation": ["math.mod(query.life_time, 2.7) < 0.1 ? 10 : 0", "math.floor(math.mod(query.life_time*0.9, 3))*40-40", 0]}}
    return {}

def motion(m, rig, plan):
    mid = m["id"]; n = rig.names
    g = GAITS["float" if plan == "float" else GAIT_OF.get(mid, "march")]
    idle, walk = {}, {}
    def put(d, bone, ch, vec):
        if bone in n: d.setdefault(bone, {})[ch] = [num(v) if not isinstance(v, str) else v for v in vec]
    S = SPEED; t = "query.life_time"
    if plan in ("biped", "float"):
        c = WALK_COS.format(c=g["cad"]); sn = c.replace("cos", "sin")
        run = f"math.max(0, {S}-0.45)"   # only once it is running
        # idle by style
        st = g["idle"]
        breathe = {"heavy": f"math.sin({t}*60)*2", "tick": "0", "still": f"math.sin({t}*50)*0.8", "drift": "0"}.get(st, f"math.sin({t}*80)*1.2")
        put(idle, "body", "rotation", [f"{g['hunch']}+{breathe}" if g["hunch"] else breathe, 0, 0])
        if st == "scan": put(idle, "head", "rotation", [f"-{g['hunch']}", f"math.sin({t}*22)*18", 0])
        elif st == "twitch":   # every few seconds the head snaps sideways, then hangs crooked
            put(idle, "head", "rotation", [f"-{g['hunch']}+math.sin({t}*40)*3", f"math.mod({t}, 3.7) < 0.12 ? 35 : 0", f"12+math.sin({t}*30)*5+(math.mod({t}, 5.3) < 0.1 ? -30 : 0)"])
        elif st == "tick":     # clockwork: the head and body move in ticks, not smoothly
            put(idle, "head", "rotation", [0, "(math.mod(math.floor(query.life_time*2), 2)*2-1)*4", 0])
            put(idle, "body", "rotation", [0, 0, "(math.mod(math.floor(query.life_time), 2)*2-1)*1.5"])
        elif st == "heavy": put(idle, "head", "rotation", [f"-{g['hunch']}", 0, f"math.sin({t}*30)*2"])
        elif st == "drift":
            put(idle, "body", "position", [0, f"math.sin({t}*120)*1.5", 0]); put(idle, "head", "rotation", [8, 0, f"math.sin({t}*45)*6"])
        # arms at rest
        if st == "drift":
            put(idle, rig.W, "rotation", [f"math.sin({t}*70)*6", 0, f"{'' if rig.W == 'arm_r' else '-'}(4+math.sin({t}*55)*4)"])
            put(idle, rig.O, "rotation", [f"-math.sin({t}*70)*6", 0, f"{'' if rig.O == 'arm_r' else '-'}(4+math.sin({t}*55+90)*4)"])
        else:
            sway = "math.sin(query.life_time*90)*3" if st != "tick" else "0"
            for arm, s in (("arm_r", 1), ("arm_l", -1)):
                base = -8 if (arm == rig.W and rig.weapon) else 0
                if arm == rig.O and rig.shield: base = -20
                put(idle, arm, "rotation", [f"{base}+{sway}" if sway != "0" else base, 0, f"{s}*(3+math.sin(query.life_time*70)*2)" if st != "tick" else s * 3])
        if "cloak" in n: put(idle, "cloak", "rotation", [f"math.sin({t}*60)*2", 0, f"math.sin({t}*40)*1.5"])
        # walk
        if plan == "biped":
            un = g["uneven"]
            put(walk, "leg_r", "rotation", [f"{c}*{g['leg']}*{S}*(1+{run})", 0, 0])
            put(walk, "leg_l", "rotation", [f"-{c}*{g['leg'] * (1 - un):.1f}*{S}*(1+{run})", 0, 0])
            put(walk, "body", "position", [0, f"math.abs({sn})*{g['bob']}*{S}", 0])
            body_rot = [f"{run}*{g['lean'] * 2}", f"{c}*4*{S}", f"{sn}*{g['sway']}*{S}" if g["sway"] else 0]
            put(walk, "body", "rotation", body_rot)
            put(walk, "head", "rotation", [f"-{run}*{g['lean']}", f"-{c}*4*{S}", f"-{sn}*{g['sway'] / 2}*{S}" if g["sway"] else 0])
            arm_amp = g["arm"]
            for arm, sgn in (("arm_r", -1), ("arm_l", 1)):
                amp = arm_amp * (0.35 if (arm == rig.O and rig.shield) else 1)
                put(walk, arm, "rotation", [f"{'-' if sgn < 0 else ''}{c}*{amp:.1f}*{S}*(1+{run}*1.5)", 0, 0])
            if "cloak" in n: put(walk, "cloak", "rotation", [f"{S}*22+math.abs({sn})*4*{S}", 0, 0])
            if "arm2_r" in n:
                put(walk, "arm2_r", "rotation", [f"{c}*{arm_amp}*{S}", 0, 0]); put(walk, "arm2_l", "rotation", [f"-{c}*{arm_amp}*{S}", 0, 0])
        else:   # float: leans into the drift, arms trail behind
            put(walk, "body", "rotation", [f"{S}*{g['lean']}", 0, 0])
            for arm in ("arm_r", "arm_l"): put(walk, arm, "rotation", [f"{S}*25", 0, 0])
            if "halo" in n: put(walk, "halo", "rotation", [0, f"{t}*90*(1+{S}*2)", 0])
    elif plan == "quad":
        c = WALK_COS.format(c=38.17); sn = c.replace("cos", "sin")
        put(idle, "body", "rotation", [f"math.sin({t}*70)*1", 0, 0])
        put(idle, "head", "rotation", [f"math.sin({t}*35)*3", f"math.sin({t}*18)*10", 0])
        if "tail" in n and ("tail", "rotation") not in {(b, ch) for b, ch, _ in m.get("anim_extra", [])}:
            put(idle, "tail", "rotation", [-10, f"math.sin({t}*120)*10", 0])
            put(walk, "tail", "rotation", [f"{S}*25", f"math.sin({t}*420)*14*{S}", 0])
        gallop = f"math.max(0, {S}-0.55)*2"
        for nm, s in (("leg_fr", ""), ("leg_bl", ""), ("leg_fl", "-"), ("leg_br", "-")):
            put(walk, nm, "rotation", [f"{s}{c}*42*{S}*(1+{gallop}*0.5)", 0, 0])
        put(walk, "body", "rotation", [f"{sn}*3*{S}*(1+{gallop})", 0, 0])
        put(walk, "body", "position", [0, f"math.abs({sn})*0.8*{S}", 0])
        put(walk, "head", "rotation", [f"-{sn}*5*{S}", 0, 0])
        if "jaw" in n: put(idle, "jaw", "rotation", [f"math.max(0, math.sin({t}*50))*8", 0, 0])
    elif plan == "bug":
        for bn in n:
            if bn.startswith("leg_"): put(walk, bn, "rotation", [0, f"math.sin({t}*900+{ord(bn[-1]) * 40})*24*{S}", f"math.cos({t}*900+{ord(bn[-1]) * 40})*8*{S}"])
        put(idle, "head", "rotation", [0, f"math.sin({t}*300)*3", 0])
        put(walk, "body", "position", [0, f"math.abs(math.sin({t}*900))*0.4*{S}", 0])
    elif plan == "wyrm":
        for i in range(6):
            put(idle, f"seg{i}", "rotation", [f"math.cos({t}*150-{i * 45})*3", f"math.sin({t}*200-{i * 45})*9*(1+{S}*1.5)", 0])
        put(idle, "head", "rotation", [f"math.sin({t}*90)*6", f"math.sin({t}*200-300)*12", 0])
    elif plan == "bird":
        put(idle, "wing_r", "rotation", [0, 0, f"math.sin({t}*1400)*45"]); put(idle, "wing_l", "rotation", [0, 0, f"-math.sin({t}*1400)*45"])
        put(idle, "body", "position", [0, f"math.sin({t}*300)*0.6", 0])
        put(idle, "head", "rotation", [0, f"math.mod({t}, 2.1) < 0.1 ? 25 : 0", 0])
    return idle, walk

# ---------- the Hollow Choir (built by studio/build_undertow_choir.py, not the roster) ----------
# Their geometry names bones robe / arm_left / arm_right, all hung from root, so their poses are written per bone here.
T = "query.life_time"
CHOIR = {
    "choir_conductor": {
        # it conducts in three: the baton beats down, out and up; the empty hand keeps the swell
        "idle": {"root": {"position": [0, f"math.sin({T}*90)*1.2", 0]},
                 "arm_right": {"rotation": [f"math.sin({T}*240)*22", 0, f"math.cos({T}*240)*12"]},
                 "arm_left": {"rotation": [f"math.sin({T}*80)*10", 0, f"-math.sin({T}*80+40)*8"]},
                 "head": {"rotation": [f"math.sin({T}*240)*4", 0, f"math.sin({T}*80)*5"]}},
        "moves": {
            "toll": ({"arm_right": ["-150+~", 0, -40], "arm_left": ["-150+~", 0, 40], "head": [-20, 0, 0]},
                     {"arm_right": [-20, 0, -30], "arm_left": [-20, 0, 30], "head": [15, 0, 0], "root": {"position": [0, -2, 0]}}),
            "undertow": ({"arm_right": ["-95+~", 0, -45], "arm_left": ["-95+~", 0, 45], "head": [10, 0, 0]},
                         {"arm_right": [30, 0, -20], "arm_left": [30, 0, 20], "head": [-25, 0, 0], "root": {"rotation": [-12, 0, 0]}}),
            "echo": ({"arm_right": ["-30+~", 0, 25], "arm_left": ["-30+~", 0, -25], "head": [-35, 0, 0]},
                     {"arm_right": [-90, 0, -50], "arm_left": [-90, 0, 50], "head": [10, 0, 0]}),
            "rage": ({}, {"arm_right": [-60, 0, 30], "arm_left": [-60, 0, -30], "head": ["-40+~*3", 0, 0], "root": {"position": ["~*0.3", 0, 0]}}),
        }},
    # singers rock on their note, heads bowed, each slightly out of time with the next
    "choir_singer": {"idle": {"root": {"position": [0, f"math.sin({T}*100)*0.8", 0], "rotation": [0, 0, f"math.sin({T}*60)*4"]},
                              "head": {"rotation": [f"math.sin({T}*180)*6", 0, f"math.sin({T}*60)*6"]}}},
    "hollow_regent": {"idle": {"robe": {"scale": [1, f"1+math.sin({T}*50)*0.01", 1]}, "head": {"rotation": [0, f"math.sin({T}*15)*10", 0]}}},
}
CHOIR_TYPE = {"choir_conductor": "siege:choir_conductor"}

def choir_set(name):
    """(animations, client animations map, animate list, moves) for one Choir entity."""
    P = f"animation.siege_b.{name}"; spec = CHOIR[name]
    def bones_of(pose, tremble):
        return {bn: ({"rotation": [fix(x, tremble) for x in v]} if isinstance(v, list) else {c: [fix(x, tremble) for x in vec] for c, vec in v.items()}) for bn, v in pose.items()}
    anims = {P + ".idle": anim(spec["idle"], loop=True)}; amap = {"idle": P + ".idle"}; moves = []
    for move, (wind, strike) in spec.get("moves", {}).items():
        wh, wf, st = bones_of(wind, True), bones_of(wind, False), bones_of(strike, True)
        keys = merge_keys(wh, st)
        if wh: anims[f"{P}.move.{move}.wind"] = anim(timeline([(0, {}), (0.35, wh)], merge_keys(wh)), loop="hold_on_last_frame", animation_length=0.35)
        end = (1.2, 1.6) if move == "rage" else (0.5, 0.9)
        anims[f"{P}.move.{move}.strike"] = anim(timeline([(0, wf), (0.12, st), (end[0], st), (end[1], {})], keys), animation_length=end[1])
        moves.append(move)
    return anims, amap, ["idle"], moves

def choir_client(name, client):
    """Adds the Choir entity's animations to the client entity build_undertow_choir.py writes."""
    _, amap, animate, _ = choir_set(name)
    d = client["minecraft:client_entity"]["description"]; d["animations"] = dict(amap); d["scripts"] = {"animate": list(animate)}
    return client

# ---------- files ----------
def collect(mobs_models, entity_bp):
    """mobs_models: [(m, model)] -> (anim file dicts, controllers, {mid: (amap, animate)}, moves {typeId: [move]})."""
    base, motion_, moves_ = {}, {}, {}; ctrls = {}; client = {}; moves = {}
    for m, model in mobs_models:
        a, c, amap, animate, mv = build_set(m, model, entity_bp(m))
        for k, v in a.items():
            (moves_ if ".move." in k else base if k == f"animation.siege_b.{m['id']}" else motion_)[k] = v
        ctrls.update(c); client[m["id"]] = (amap, animate)
        if mv: moves["siege:" + m["id"]] = mv
    return base, motion_, moves_, ctrls, client, moves

def write_all(RP, BP, mobs_models, entity_bp, client_entity, write):
    base, motion_, moves_, ctrls, client, moves = collect(mobs_models, entity_bp)
    for name in CHOIR:   # the Hollow Choir: animations here, client entity patched in place
        a, _, _, mv = choir_set(name)
        for k, v in a.items(): (moves_ if ".move." in k else motion_)[k] = v
        if mv: moves[CHOIR_TYPE[name]] = mv
        path = RP + f"entity/undertow/{name}.entity.json"
        if os.path.exists(path): write(path, choir_client(name, json.load(open(path))))
    write(RP + "animations/bestiary.animation.json", {"format_version": "1.8.0", "animations": base})
    write(RP + "animations/bestiary_motion.animation.json", {"format_version": "1.8.0", "animations": motion_})
    write(RP + "animations/bestiary_moves.animation.json", {"format_version": "1.8.0", "animations": moves_})
    write(RP + "animation_controllers/bestiary.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": ctrls})
    for m, _ in mobs_models:
        write(RP + f"entity/bestiary/{m['id']}.entity.json", client_entity(m, client[m["id"]]))
    write(BP + "scripts/bestiary/moves.js", "// GENERATED by studio/bestiary/anims.py. Do not edit by hand.\n"
          + "// Boss moves that have a wind-up and a strike animation (animation.siege_b.<mob>.move.<id>.wind / .strike), by entity type.\n"
          + "export const MOVES = " + json.dumps(moves, indent=1) + ";\n")
    return len(base) + len(motion_) + len(moves_), len(ctrls)

if __name__ == "__main__":
    import build, roster
    from models import Model
    built = []
    for m in roster.MOBS:
        model = Model(m["id"], m["pal"], seed=sum(map(ord, m["id"]))); m["model"](model)
        built.append((m, model))
    print(write_all(build.RP, build.BP, built, build.entity_bp, build.client_entity, build.write), "animations, controllers")
