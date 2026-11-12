# Creature voices: what every custom entity sounds like when it idles, is hit, dies and walks.
#
# Until the real recordings arrive (SOUND-LIST.md), each voice is one vanilla sound, re-pitched so no two
# groups sound alike and nothing sounds like the vanilla mob it borrows from. Without an entry here a custom
# entity falls back to the vanilla defaults, which is the PLAYER's hurt and death sound: every boss in the
# game grunted like Steve.
#
# House tone (SOUND-LIST.md): uneasy, especially at night. Lower and softer than vanilla. Nothing sudden.
#
# A voice is (vanilla sound id, lowest pitch, highest pitch, volume). "" means silent on purpose.
# Events: ambient (only for entities whose behaviour file has minecraft:ambient_sound_interval, which
# studio/bestiary/build.py adds from AMBIENT_EVERY below), hurt, death, step, attack.strong.
#
# Run:  python3 studio/bestiary/voices.py   (build.py also runs it). Merges into Siege_Nights_RP/sounds.json
# without touching the steed's or the dragons' entries, and checks every id against tools/vanilla_sounds.json.
import json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")) + "/"
RP = ROOT + "Siege_Nights_RP/"

def V(sound, lo=1.0, hi=None, vol=1.0): return (sound, lo, hi if hi is not None else lo + 0.1, vol)
SILENT = ("", 1, 1, 0)

def voice(ambient=None, hurt=None, death=None, step=None, attack=None):
    return {k: v for k, v in (("ambient", ambient), ("hurt", hurt), ("death", death), ("step", step), ("attack.strong", attack)) if v is not None}

def illager(kind, p, ambient=True, vol=0.9):       # men of the Grey Host and the rival lords: illager voices, slowed
    a = {"vindicator": "mob.vindicator.idle", "pillager": "mob.pillager.idle", "evoker": "mob.evocation_illager.ambient"}[kind]
    stem = {"vindicator": "mob.vindicator", "pillager": "mob.pillager", "evoker": "mob.evocation_illager"}[kind]
    return voice(V(a, p, p + 0.08, vol * 0.7) if ambient else None, V(stem + ".hurt", p, p + 0.1, vol), V(stem + ".death", p - 0.05, p + 0.05, vol))

HEAVY_STEP = V("mob.irongolem.walk", 0.9, 1.0, 0.45)
PROP = voice(ambient=SILENT, hurt=SILENT, death=SILENT)   # stands, markers, cutscene figures, projectiles

VOICES = {
    # ---- Vorlund's Grey Host: tired men, low and slow ----
    "grey_axeman":      illager("vindicator", 0.72),
    "grey_spearman":    illager("vindicator", 0.78),
    "grey_bellcutter":  illager("pillager", 0.74),
    "grey_bowman":      illager("pillager", 0.8),
    "grey_serjeant":    {**illager("vindicator", 0.64), "step": V("armor.equip_chain", 0.7, 0.8, 0.25)},
    "hollow_warlord":   {**illager("vindicator", 0.6, vol=1), "step": HEAVY_STEP},
    # ---- Hollow raiders ----
    "hollow_footman":   voice(V("mob.zombie_villager.say", 0.62, 0.7, 0.6), V("mob.zombie_villager.hurt", 0.65, 0.75, 0.9), V("mob.zombie_villager.death", 0.6, 0.66, 0.9)),
    "bell_ringer":      voice(V("block.bell.hit", 0.5, 0.56, 0.3), V("mob.pillager.hurt", 0.7, 0.8, 0.9), V("mob.pillager.death", 0.62, 0.68, 0.9)),
    "shieldwall_brute": voice(V("mob.piglin_brute.ambient", 0.62, 0.7, 0.6), V("mob.piglin_brute.hurt", 0.6, 0.68), V("mob.piglin_brute.death", 0.55, 0.6), HEAVY_STEP),
    "torchbearer":      voice(V("block.campfire.crackle", 0.8, 1.0, 0.6), V("mob.vindicator.hurt", 0.82, 0.92, 0.9), V("mob.vindicator.death", 0.75, 0.8, 0.9)),
    "siege_ogre":       voice(V("mob.ravager.ambient", 0.58, 0.64, 0.7), V("mob.ravager.hurt", 0.6, 0.66), V("mob.ravager.death", 0.52, 0.56), V("mob.ravager.step", 0.7, 0.76, 0.8), V("mob.ravager.bite", 0.6, 0.66)),
    "crow_mage":        voice(V("mob.evocation_illager.ambient", 0.7, 0.78, 0.6), V("mob.evocation_illager.hurt", 0.7, 0.78, 0.9), V("mob.evocation_illager.death", 0.66, 0.7, 0.9)),
    "hollow_crow":      voice(V("mob.parrot.idle", 0.5, 0.56, 0.5), V("mob.parrot.hurt", 0.55, 0.62, 0.8), V("mob.bat.death", 0.5, 0.55, 0.7)),
    "veinsworn":        voice(V("mob.husk.ambient", 0.6, 0.66, 0.6), V("mob.husk.hurt", 0.6, 0.68, 0.9), V("mob.husk.death", 0.56, 0.6, 0.9)),
    "shardcaster":      voice(V("mob.vex.ambient", 0.55, 0.62, 0.5), V("mob.vex.hurt", 0.58, 0.64, 0.8), V("random.glass", 0.7, 0.76, 0.6)),
    "gatebreaker":      voice(V("mob.warden.idle", 0.8, 0.86, 0.8), V("mob.warden.hurt", 0.85, 0.9), V("mob.warden.death", 0.85, 0.9), V("mob.warden.step", 0.85, 0.9, 0.8)),
    # ---- The Hollow's own ----
    "lost_villager":    voice(V("mob.villager.idle", 0.55, 0.62, 0.5), V("mob.villager.hit", 0.6, 0.66, 0.8), V("mob.zombie_villager.death", 0.7, 0.75, 0.8)),
    "changeling":       voice(V("mob.allay.idle", 0.6, 0.66, 0.5), V("mob.fox.hurt", 0.7, 0.78, 0.8), V("mob.fox.death", 0.6, 0.66, 0.8)),
    "wrongling":        voice(V("mob.endermen.idle", 0.6, 0.66, 0.5), V("mob.endermen.hit", 0.6, 0.66, 0.8), V("mob.endermen.death", 0.66, 0.7, 0.8)),
    "stone_vigil":      voice(V("resonate.amethyst_block", 0.5, 0.56, 0.5), V("mob.irongolem.hit", 1.1, 1.2, 0.8), V("mob.irongolem.death", 0.9, 0.95, 0.8), V("mob.irongolem.walk", 1.2, 1.3, 0.35)),
    "echo_hound":       voice(V("mob.wolf.big.whine", 0.6, 0.66, 0.5), V("mob.wolf.big.hurt", 0.68, 0.75, 0.9), V("mob.wolf.big.death", 0.6, 0.65, 0.9), V("mob.wolf.step", 0.8, 0.9, 0.6)),
    "mirror_knight":    voice(V("chime.amethyst_block", 0.6, 0.66, 0.4), V("hit.amethyst_block", 0.7, 0.8, 1), V("random.glass", 0.7, 0.75, 0.8), V("step.amethyst_block", 0.8, 0.9, 0.5)),
    "tolling_shade":    voice(V("resonate.amethyst_block", 0.45, 0.5, 0.4), V("mob.vex.hurt", 0.5, 0.56, 0.7), V("mob.vex.death", 0.48, 0.52, 0.7)),
    "gloamwing":        voice(V("mob.phantom.idle", 0.5, 0.56, 0.4), V("mob.phantom.hurt", 0.6, 0.66, 0.7), V("mob.phantom.death", 0.58, 0.62, 0.7)),
    "seep":             voice(V("resonate.amethyst_block", 0.4, 0.45, 0.5), V("hit.amethyst_block", 0.5, 0.56, 0.8), V("break.amethyst_block", 0.45, 0.5, 0.9)),
    "omen_raven":       voice(V("mob.parrot.idle", 0.42, 0.48, 0.4), V("mob.parrot.hurt", 0.5, 0.55, 0.6), V("mob.bat.death", 0.45, 0.5, 0.6)),
    "choir_singer":     voice(hurt=V("mob.allay.hurt", 0.5, 0.55, 0.7), death=V("mob.allay.death", 0.45, 0.5, 0.7)),   # the hum is scripted: no idle on top of it
    # ---- The wild, by region ----
    "frost_stag":       voice(V("mob.goat.ambient", 0.6, 0.66, 0.6), V("mob.goat.hurt", 0.6, 0.66, 0.9), V("mob.goat.death", 0.58, 0.62, 0.9), V("mob.goat.step", 0.8, 0.9, 0.6)),
    "rimewolf":         voice(V("mob.wolf.big.growl", 0.7, 0.76, 0.6), V("mob.wolf.big.hurt", 0.75, 0.82, 0.9), V("mob.wolf.big.death", 0.7, 0.75, 0.9), V("mob.wolf.step", 0.8, 0.9, 0.6)),
    "brine_lurker":     voice(V("mob.guardian.land_idle", 0.5, 0.56, 0.6), V("mob.guardian.land_hit", 0.5, 0.56, 0.9), V("mob.guardian.land_death", 0.5, 0.55, 0.9), V("mob.drowned.step", 0.6, 0.66, 0.6)),
    "ash_scarab":       voice(V("mob.silverfish.say", 0.6, 0.66, 0.5), V("mob.silverfish.hit", 0.6, 0.66, 0.8), V("mob.silverfish.kill", 0.6, 0.64, 0.8), V("mob.silverfish.step", 0.6, 0.66, 0.6)),
    "dune_wyrm":        voice(V("mob.sniffer.long_sniff", 0.5, 0.55, 0.6), V("mob.hoglin.hurt", 0.6, 0.66, 0.9), V("mob.hoglin.death", 0.5, 0.55, 0.9), V("dig.sand", 0.7, 0.8, 0.6)),
    "bog_hag":          voice(V("mob.witch.ambient", 0.7, 0.76, 0.6), V("mob.witch.hurt", 0.7, 0.76, 0.9), V("mob.witch.death", 0.68, 0.72, 0.9)),
    "mire_toad":        voice(V("mob.frog.ambient", 0.45, 0.5, 0.9), V("mob.frog.hurt", 0.5, 0.55, 0.9), V("mob.frog.death", 0.48, 0.52, 0.9), V("mob.frog.step", 0.5, 0.56, 0.7)),
    "barrow_wight":     voice(V("mob.stray.ambient", 0.6, 0.66, 0.6), V("mob.stray.hurt", 0.6, 0.66, 0.9), V("mob.stray.death", 0.58, 0.62, 0.9), V("mob.stray.step", 0.7, 0.76, 0.6)),
    # ---- The Ashen Order: living men, nearer their real voices ----
    "ashen_squire":     illager("pillager", 1.0, ambient=False),
    "ashen_knight":     {**illager("vindicator", 0.86, ambient=False), "step": V("armor.equip_chain", 0.8, 0.9, 0.2)},
    "inquisitor":       illager("evoker", 0.86),
    # ---- Rival lords' champions ----
    "champion_knight":   illager("vindicator", 0.9, ambient=False),
    "champion_sorcerer": illager("evoker", 0.9, ambient=False),
    "champion_lord":     illager("vindicator", 0.78, ambient=False),
    "champion_retainer": illager("pillager", 1.0, ambient=False),
    # ---- Bosses: a voice of their own under the arrival sting ----
    "clockwork_reeve":  voice(V("random.click", 0.5, 0.56, 0.8), V("mob.irongolem.hit", 0.7, 0.76), V("mob.irongolem.death", 0.6, 0.64), V("mob.irongolem.walk", 0.7, 0.76, 0.8)),
    "reeve_cog":        voice(hurt=V("mob.irongolem.hit", 1.3, 1.4, 0.6), death=V("random.anvil_land", 1.6, 1.7, 0.4), step=V("mob.irongolem.walk", 1.5, 1.6, 0.35)),
    "pale_huntsman":    voice(V("mob.horse.skeleton.idle", 0.6, 0.66, 0.6), V("mob.stray.hurt", 0.5, 0.56), V("mob.horse.skeleton.death", 0.5, 0.55)),
    "drowned_bride":    voice(V("mob.allay.idle", 0.45, 0.5, 0.6), V("mob.drowned.hurt_water", 0.8, 0.86), V("mob.elderguardian.death", 0.9, 0.95, 0.8)),
    "ash_seneschal":    voice(V("mob.blaze.breathe", 0.5, 0.55, 0.6), V("mob.blaze.hit", 0.55, 0.6), V("mob.blaze.death", 0.5, 0.54)),
    "mother_of_changelings": voice(V("mob.witch.ambient", 0.5, 0.55, 0.6), V("mob.witch.hurt", 0.55, 0.6), V("mob.ghast.death", 0.5, 0.54, 0.7)),
    "mother_echo":      voice(hurt=V("mob.witch.hurt", 0.9, 1.0, 0.5), death=V("mob.vex.death", 0.5, 0.55, 0.6)),
    "warlord_king":     {**illager("vindicator", 0.55, vol=1), "step": HEAVY_STEP},
    "pretender_blade":  illager("pillager", 0.82),
    "pretender_seer":   illager("evoker", 0.8),
    "pretender_brute":  voice(V("mob.piglin_brute.ambient", 0.55, 0.6, 0.6), V("mob.piglin_brute.hurt", 0.55, 0.6), V("mob.piglin_brute.death", 0.5, 0.55), HEAVY_STEP),
    "oswin_the_last":   voice(V("mob.wither.ambient", 0.45, 0.5, 0.4), V("mob.evocation_illager.hurt", 0.5, 0.55), V("mob.wither.death", 0.55, 0.58, 0.7)),
    "oswin_reflection": voice(ambient=SILENT, hurt=V("mob.vex.hurt", 0.4, 0.45, 0.4), death=V("random.glass", 0.5, 0.55, 0.4)),   # the Standing Ranks keep their silence
    "choir_conductor":  voice(hurt=V("mob.evocation_illager.hurt", 0.6, 0.65), death=V("mob.wither.death", 0.8, 0.85, 0.6)),
    "hollow_regent":    voice(hurt=V("mob.evocation_illager.hurt", 0.55, 0.6), death=V("mob.wither.death", 0.6, 0.65, 0.6)),
    "rime_pillar":      voice(hurt=V("hit.amethyst_block", 0.6, 0.7, 0.8), death=V("random.glass", 0.6, 0.65, 0.9)),
    "chapel_bell":      voice(hurt=V("block.bell.hit", 0.6, 0.64, 0.7), death=V("block.bell.hit", 0.4, 0.42, 1)),
    # ---- Your people: human, a little lower than the player ----
    **{k: voice(hurt=V("game.player.hurt", 0.85, 0.95, 0.8), death=V("game.player.die", 0.82, 0.88, 0.8))
       for k in ("archer", "crossbowman", "knight", "man_at_arms", "pikeman", "shieldbearer", "sapper", "ram_crew", "trebuchet_crew")},
    **{k: voice(hurt=V("game.player.hurt", 1.0, 1.1, 0.7), death=V("game.player.die", 1.0, 1.05, 0.7))
       for k in ("townsfolk", "job_npc", "quartermaster", "grave_keeper")},
    # ---- Machines: timber and iron, not a voice ----
    **{k: voice(hurt=V("hit.wood", 0.6, 0.7, 1), death=V("block.scaffolding.break", 0.5, 0.55, 1))
       for k in ("trebuchet_engine", "ram_engine", "ballista_engine")},
    **{k: voice(hurt=V("hit.anvil", 0.7, 0.8, 0.6), death=V("random.anvil_land", 0.5, 0.55, 0.8))
       for k in ("train_engine", "train_coach")},
    "keep_heart":       voice(hurt=V("hit.amethyst_block", 0.5, 0.56, 1), death=V("break.amethyst_block", 0.4, 0.45, 1)),
    # ---- Things that should never make a sound ----
    **{k: PROP for k in ("body", "label", "post_marker", "portrait", "crown_stand", "heart_stand", "template_stand", "resting_heart",
                         "throne_seal", "spell_satchel", "reveal_boy", "reveal_king", "reveal_morvane", "spinning_cog", "hollow_bolt")},
}

# How often an idle sound plays, in seconds: (at least, plus up to). Rarer than vanilla's 8 + 0..16, so a
# sound in the dark means something. Bosses speak a little more often.
AMBIENT_EVERY = {"default": (12, 20), "boss": (8, 10)}

def has_ambient(mid):
    a = VOICES.get(mid, {}).get("ambient")
    return bool(a and a[0])

def ambient_component(mid, boss=False):
    lo, rng = AMBIENT_EVERY["boss" if boss else "default"]
    return {"minecraft:ambient_sound_interval": {"value": lo, "range": rng, "event_name": "ambient"}}

def event_json(v):
    sound, lo, hi, vol = v
    if not sound: return ""
    return {"sound": sound, "pitch": [lo, hi], "volume": vol}

def check(vanilla, ours):
    bad = [f"siege:{mid} {ev}: {v[0]}" for mid, evs in VOICES.items() for ev, v in evs.items() if v[0] and v[0] not in vanilla and v[0] not in ours]
    if bad: sys.exit("Not a Bedrock sound id:\n  " + "\n  ".join(bad))

def write_sounds():
    vanilla = set(json.load(open(ROOT + "tools/vanilla_sounds.json")))
    ours = set(json.load(open(RP + "sounds/sound_definitions.json"))["sound_definitions"])
    check(vanilla, ours)
    path = RP + "sounds.json"
    data = json.load(open(path))   # read right before writing: the steed and dragon builders own their entries
    ents = data.setdefault("entity_sounds", {}).setdefault("entities", {})
    for mid, evs in sorted(VOICES.items()):
        ents["siege:" + mid] = {"volume": 1.0, "pitch": [1.0, 1.0], "events": {ev: event_json(v) for ev, v in evs.items()}}
    with open(path, "w") as f: json.dump(data, f, indent=1)
    print(len(VOICES), "creature voices written to sounds.json")

if __name__ == "__main__": write_sounds()
