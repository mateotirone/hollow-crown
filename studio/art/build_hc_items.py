"""Final-style item icons for Hollow Crown features (mob drops, boss keys and relics, horse gear, crown and lore items).
Run: python3 build_hc_items.py
Grids use three ramps: lowercase h l m d s o = ramp 1 from highlight to outline, uppercase = ramp 2, digits 5..0 = ramp 3.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M, REGIONS, fixed, ramp
from texlib import *
TI = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/items/'
G, S, I, L, P, OAK, DOAK, BS, RED = M['gold'], M['steel'], M['iron'], M['leather'], M['parchment'], M['oak'], M['dark_oak'], M['blacksteel'], M['blood_red']
VIOLET = fixed('#2a1250', '#4a1e88', '#7234c4', '#a05cf0', '#c896ff', '#ecd8ff')
ICE = fixed('#1c3a52', '#3a6a8a', '#6a9cba', '#9ccae0', '#ccecf6', '#f2fcff')
BONE = fixed('#4a4234', '#7a705a', '#a89e84', '#cec6ac', '#e8e2ce', '#f8f6ea')
ASH = fixed('#16141a', '#2a282e', '#44424a', '#62606a', '#86848e', '#aeacb4')
SEA = fixed('#0a2a2e', '#14484c', '#226a6c', '#3a908c', '#6ab8ac', '#aee0d0')
SAND = fixed('#4a3414', '#7a5a22', '#a88236', '#cca852', '#e6ca7c', '#f8e8b4')
BOG = fixed('#141e0a', '#243612', '#3a521c', '#56722a', '#7a9642', '#a6bc6a')
BRASS = fixed('#3a2a0c', '#6a4e14', '#9a7620', '#c49c34', '#e2c25c', '#f6e49c')
EMBER, LINEN = M['ember'], fixed('#6a5e48', '#8e826a', '#b0a488', '#cdc2a6', '#e2d9c0', '#f2ecda')
PEARL = fixed('#3a4658', '#6a7a90', '#9aaabe', '#c4d2e0', '#e4eef4', '#ffffff')

def grid(rows, name, r1, r2=None, r3=None, extra=None):
    t = Tex(); m1 = dict(zip('osdmlh', range(6))); m2 = dict(zip('OSDMLH', range(6)))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in m1: t.set(x, y, r1[m1[ch]])
            elif ch in m2 and r2: t.set(x, y, r2[m2[ch]])
            elif ch.isdigit() and r3: t.set(x, y, r3[int(ch)])
            elif extra and ch in extra: t.set(x, y, extra[ch])
    t.save(TI + name + '.png'); return t

SHARD = ["................", ".........oo.....", "........ohlo....", ".......ohlmo....", ".......ohlmdo...", "......ohlmmdo...", "......ohlmddo...", ".....ohlmmdso...",
         ".....ohlmddso...", "....ohlmmdso....", "....ohlmddso....", "....olmmdso.....", "....olmdso......", ".....omdso......", ".....odso.......", "......oo........"]
SCALE = ["................", "................", "....oooooooo....", "...ohhllllmmo...", "..ohllllmmmmdo..", "..ohllmmmmmddo..", "..olllmmmmdddo..", "..olmmmmmddddo..",
         "..olmmmmddddso..", "...ommmddddso...", "...omdddddsso...", "....oddddsso....", ".....oddsso.....", "......osso......", ".......oo.......", "................"]
PILE = ["................", "................", "................", "................", "................", ".......ol.......", "......olmo......", ".....ohlmdo.....",
        "....ohllmmdo....", "...ohlllmmddo...", "..ohllmmmmddso..", ".ohllmmmmmdddso.", ".olmmmmmdddddso.", ".oossssssssssoo.", "................", "................"]
VIAL = ["................", "......oooo......", "......oLMo......", "......oMDo......", ".....oo55oo.....", ".....o5..5o.....", "....o5....5o....", "...o5.hlll.5o...",
        "...o5hllmmm5o...", "...o5lmmmmd5o...", "...o5mmmddd5o...", "...o5mmddds5o...", "....o5ddds5o....", ".....o5555o.....", "......oooo......", "................"]
ORB = ["................", "................", ".....oooooo.....", "....ohhllmmo....", "...ohhhllmmdo...", "..ohh5hlmmmddo..", "..ohhhllmmmddo..", "..ohllmmmmdddo..",
       "..ollmmmmddddo..", "..olmmmmddddso..", "..ommmddddssso..", "...omdddddsso...", "....oddssso.....", ".....oooooo.....", "................", "................"]
RING = ["................", "......o55o......", ".....o5445o.....", "......o33o......", ".....oollmoo....", "....ohllmmmdo...", "...ohlooooodso..", "...olo.....odo..",
        "...olo.....odo..", "...olo.....odo..", "...omo.....oso..", "...omdoooooso...", "....oddddsso....", ".....ooooooo....", "................", "................"]
COG = ["................", "......oooo......", ".oo...ollo...oo.", "olmo.ohlmdo.olmo", "ommdohlmmddodmso", ".oddlllmmmddddo.", "..ohlmmoommddo..", ".ohlmmo..omddso.",
       ".ollmmo..omddso.", "..olmmmoommdso..", ".ommddmmmdddsso.", "olmdoddddssodmso", "omso.oddsso.osso", ".oo...osso...oo.", "......oooo......", "................"]
KEY = ["................", "..........oooo..", ".........ohllmo.", "........ohlooldo", "........olo..omo", "........omo..oso", "........omdoodo.", ".......oolmdso..",
       "......ohlmooo...", ".....ohlmo......", "....ohlmo.......", "...ohlmo........", "..ohlmdo........", ".olmdmso........", ".omo.oso........", "..o...o........."]
HORN = ["................", "..........ooooo.", ".........ohhhlSo", "........ohhllmSo", "........ohlllmSo", ".......oLLLMMoo.", "......ohhllmo...", ".....ohhllmo....",
        "....ohhllmo.....", "...oLLLMMo......", "..ohllmo........", ".ohlmo..........", ".oLLo...........", ".oo.............", "................", "................"]
ANTLER = ["................", "..o......o...o..", ".oho....oho.oho.", ".olo....olo.olo.", ".olmo...olmoolo.", "..olmo..ollmlmo.", "..ollmo.ohlmmo..", "...olmmoolmdo...",
          "....ollmllmo....", ".....ohllmdo....", "......olmmo.....", "......olmdo.....", ".....ohlmdo.....", ".....olmmdso....", "....olmddsso....", ".....oooooo....."]
PELT = ["................", "..oo........oo..", ".ohlo......ohlo.", ".ollmooooooolmo.", "..ohhllllllmmo..", "..ohhlllllmmdo..", "...ohllllmmdo...", "...ohlllmmmdo...",
        "...ohllmmmddo...", "..ohllmmmmdddo..", "..ohlmmmmddddo..", ".ollmooddoosdso.", ".olmo.oddo.odso.", "..oo...oo...oo..", "................", "................"]
SEAL = ["................", "................", "....oooooooo....", "...ohhllllmmo...", "..ohlloooommdo..", "..oll o....omdo.", "..olo......odo..", "..olo......odo..",
        "..olo......odo..", "..omo......oso..", "..ommo....osso..", "..omddoooodsso..", "...oddddssso....", "....oooooooo....", "................", "................"]
EFFIGY = ["................", "......oooo......", ".....oLLMMo.....", ".....oLMMDo.....", "......oMDo......", "..oo..olmo..oo..", ".olmoohlmooolmo.", "..oollllmmmmoo..", "....ohlmmdo.....",
          "....oLLMMDo.....", "....ohlmmdo.....", "....olmodmo.....", "...olmo.omdo....", "...omo...oso....", "..oomo...osoo...", "................"]
HEART = ["................", "................", "...ooo....ooo...", "..ohhlo..ollmo..", ".ohhllloolmmmdo.", ".ohlllmmmmmmddo.", ".ollmmmmmmmdddo.", ".olmmm5mmmdddso.",
         "..ommm55mdddso..", "...ommm5dddso...", "....ommdddso....", ".....omddso.....", "......odso......", ".......oo.......", "................", "................"]
BOW = ["................", ".....oooo.......", "....ohlmdo..5...", "...oo.olmdo.5...", "........olmo5...", ".........oldo5..", ".........olmo5..", "..LLLLLLLolmo5..",
       "..OOOOOOOolmo5..", ".........olmo5..", ".........oldo5..", "........olmo5...", "...oo.olmdo.5...", "....ohlmdo..5...", ".....oooo.......", "................"]
VEIL = ["................", "....oooooooo....", "...oLLLMMMMDo...", "..ohhllllmmmdo..", "..ohl.l.l.mmdo..", "..ol.l.l.m.mdo..", "..ohl.l.m.m.do..", "..ol.l.m.m.mdo..",
        "..ol.l.m.m.d.o..", "..om.m.m.d.dso..", "..o.m.m.d.d.so..", "..om.m.d.d.sso..", "...o.m.d.d.so...", "...om.d.d.so....", "....o.d.s.o.....", ".....o.o.o......"]
SHIELD = ["................", "..oooooooooooo..", ".ohhhlllLlmmmdo.", ".ohllllLLLmmmdo.", ".ohlllmmLmmmddo.", ".olllLLLLLLLddo.", ".ollmmmmLmmdddo.", ".ollmmmmLmmdddo.",
          ".olmmmmmLmddddo.", "..ommmmmLmdddo..", "..ommmmdLddddo..", "...ommdddddso...", "....omdddsso....", ".....oddsso.....", "......osso......", ".......oo......."]
MANTLE = ["................", "..oooo....oooo..", ".oLLLMoooooMMDo.", ".oLMMhhllllmMDo.", ".oMMohhlllmmoDo.", ".ooo.ohlllmdo.oo", ".....ohllmmdo...", ".....ohllmmdo...",
          "....ohlllmmdo...", "....ohllmmmddo..", "....ohllmmdddo..", "...ohllmmmdddo..", "...ohlmmmddddo..", "...olmomdodsdo..", "...oo.ooo.ooo...", "................"]
HALTER = ["................", ".....oooooo.....", "....ohllmmdo....", "...ohoooooodo...", "...olo....omo...", "..oLo......oMo..", "..olo......omo..", "..olmoooooomdo..",
          "..oolllmmmddoo..", "...oloooooomo...", "...olo....omo...", "....olo..omo....", ".....olmmdo.....", "......oLMo......", ".......oo.......", "................"]
WHISTLE = ["................", "................", "..........ooo...", ".........oLMDo..", "........ooMDo...", ".....ooohlloo...", "....ohhhllllmo..", "...ohhllooolmdo.",
           "...ohlloSSolmdo.", "...ollmooooomdo.", "...ollmmmmmmddo.", "....ommmmmdddo..", ".....oodddsoo...", ".......ooo......", "................", "................"]
CROP = ["................", "..............o.", ".............oLo", "............oLMo", "...........oLo..", "..........olo...", ".........olo....", "........olo.....",
        ".......olo......", "......olo.......", ".....olo........", "....oLo.........", "...oLMo.........", "..oLMDo.........", "..oMDo..........", "...oo..........."]
SHOES = ["................", "................", ".oooo....oooo...", "ohllmo..ohllmo..", "olooomo.oloooldo", "olo.omo.olo..omo", "olo.omo.olo..omo", "omo.odo.omo..odo",
         "omo.odo.omo..odo", "omdoodo.omdoosdo", "oomddo..oomddso.", ".oooo....oooo...", "................", "................", "................", "................"]
SHOES = ["................", "................", ".oo..oo..oo..oo.", ".oho.olo.oho.olo", ".olo.omo.olo.omo", ".oso.oso.oso.oso", ".olo.omo.olo.omo", ".oso.oso.oso.oso",
         ".olo.omo.olo.omo", ".olmoomo.olmoomo", ".ollmmdo.ollmmdo", "..oddso...oddso.", "...ooo.....ooo..", "................", "................", "................"]
SADDLE = ["................", "................", "....oooooooo....", "..oohhllllmmoo..", ".ohhhlllllmmmdo.", ".ohlllmmmmmmddo.", ".oLLLLLLLLLMMMo.", ".olmmooooooddso.",
          ".olmo......odso.", ".oMDo......oMDo.", ".o55o......o55o.", ".o5.5o....o5.5o.", ".o555o....o555o.", "..ooo......ooo..", "................", "................"]
CLOTH = ["................", "................", "..oooooooooooo..", ".ohhllhllhllmmo.", ".ohlmmlmmlmmmdo.", ".ollmmlmmlmmddo.", ".ohhllhllhllmmo.", ".ohlmmlmmlmmmdo.",
         ".ollmmlmmlmmddo.", ".ohhllhllhllmdo.", ".ohlmmlmmlmmddo.", ".ommddmddmdddso.", "..oooooooooooo..", "................", "................", "................"]
CAPARISON = ["................", "..oooooooooooo..", ".ohhlllLLlllmmo.", ".ohllLLLLLLlmdo.", ".ohlllLMMLllmdo.", ".ollllLMMLlmmdo.", ".ollmmLLLLmmmdo.", ".olmmmmLLmmmddo.",
             ".olmmmmmmmmdddo.", ".oLLLLLLLLLLLMo.", ".olmmmmmmmddddo.", ".omddmddmddmdso.", ".omo.odo.odo.oo.", "..o...o...o.....", "................", "................"]
EMBERORB = ["................", "......5..5......", "....5..oo..5....", "......ohlo......", "..5..ohhllo..5..", "....ohhhllmo....", "...ohhhhllmmo...", ".5.ohhhlllmmo.5.",
            "...ohhlllmmdo...", "...ohlllmmmdo...", "....ollmmddo....", "..5..ommddo..5..", "......oddo......", "....5..oo..5....", "......5..5......", "................"]
BOUND = ["................", ".....oooooo.....", "....oLLMMMDo....", "...oLoohloooDo..", "...oLohhlloDo...", "..oLohhhllmoDo..", "..oLohhlllmoDo..", "..oMohllmmmoDo..",
         "..oMollmmddoSo..", "...oMommddoSo...", "...oMooddooSo...", "....oMMDDSSo....", ".....oooooo.....", "................", "................", "................"]
GAUNTLET = ["................", "....o.o.o.o.....", "...oholoholo.o..", "...olololomooho.", "...ololomomoolo.", "...ohllllmmdomo.", "...ohlllmmmddo..", "...ollmmmmdddo..",
            "...olmmmmddddo..", "....oLLLLLMMo...", "....ohllmmddo...", "....olmmmdddo...", "...oLLLLLLMMMo..", "...olmmmddddso..", "....oooooooo....", "................"]
HALL = ["................", ".......oo.......", "......oLLo......", ".....oLLMMo.....", "....oLLMMMDo....", "...oLLMMMMDDo...", "..oLLMMMMMDDDo..", "..oooooooooooo..",
        "..ohhllllmmmdo..", "..ohllloollmdo..", "..ohllo55olmdo..", "..ollmo55ommdo..", "..olmmo55omddo..", "..ommdo55oddso..", "..oooooooooooo..", "................"]
CROWN = ["................", "................", "..o....oo....o..", ".oho..ohlo..oho.", ".olo.oh5lmo.olo.", ".olmoohllmdoomo.", ".ohlmhlmmlmdmdo.", ".ohlllmmmmmdddo.",
         ".oloooooooooodo.", ".olo........odo.", ".ohllllmmmmmddo.", ".ol5mmLmmLmm5so.", ".oddddddddsssso.", "..oooooooooooo..", "................", "................"]
BOOK = ["................", "..oooooooooo....", ".ohhlllllmmdo...", ".ohLLLLLLLmdoo..", ".ohlllllmmmdo5o.", ".ohllmmmmmmdo5o.", ".ohlmLLLLmmdo5o.", ".ohlmLMMLmmdo5o.",
        ".ohlmLLLLmmdo5o.", ".ollmmmmmmddo5o.", ".olmmmmmmdddo5o.", ".olLLLLLLLddo5o.", ".ommdddddddso5o.", "..oooooooooo55o.", "...o555555555o..", "....ooooooooo..."]
LEDGER = ["................", "..oooooooooo.5..", ".ohhlllllmmdo55.", ".ohlllllmmmdo5o.", ".ohlLLLLLmmd5o..", ".ohllmmmmmmd5o..", ".ohlLLLLmmm5do..", ".ohllmmmmm5ddo..",
          ".ohlLLLmm5dddo..", ".ollmmmm5ddddo..", ".olmmmmm5ddddo..", ".olmmmmdddddso..", ".ommdddddddsso..", "..oooooooooooo..", "................", "................"]
BANNER = ["................", ".oo.............", ".oLoooooooooo...", ".oLohhllllmmdo..", ".oMohlllllmmdo..", ".oMohll55lmmdo..", ".oMohl5555mmdo..", ".oMoll5555mddo..",
          ".oMolll55mmddo..", ".oMolmmmmmdddo..", ".oMolmmomddodo..", ".oMoooo.ooo.oo..", ".oDo............", ".oDo............", ".oDo............", ".oo............."]
SCEPTER = ["................", "...........ooo..", "..........o5H5o.", ".........oH555Ho", "..........o5H5o.", ".........oLMoo..", "........oLMo....", ".......oLMo.....",
           "......oLMo......", ".....oLMo.......", "....oLMo........", "...oLMo.........", "..oLMo..........", ".oHLMo..........", ".oLMo...........", "..oo............"]
WHEEL = ["................", ".....oooooo.....", "...oohhllmmoo...", "..ohlloLLomddo..", ".ohloLLMMMDodso.", ".oloLMooooMDodo.", "ohoLMo5445oMDoso", "oloLo544335oDoso",
         "oloMo543325oDoso", "omoMDo3322oDSoso", ".omoMDooooDSoso.", ".omdoMDDDSSodso.", "..oddooSSoodso..", "...oossssssoo...", ".....oooooo.....", "................"]

def diag_sword(name, blade, guard, grip, pommel, length=9, wide=True, glow=None):
    t = Tex(); n = 15
    for i in range(5, 5 + length):
        x, y = i, n - i
        t.set(x, y, R(blade, 4))
        if wide: t.set(x - 1, y, R(blade, 5)); t.set(x, y + 1, R(blade, 2))
    tip = 5 + length; t.set(tip, n - tip, R(blade, 5)); t.set(5, 11, R(blade, 3))
    for k in range(-2, 3): t.set(4 + k, 11 + k, R(guard, 4 if k < 0 else 3 if k == 0 else 2))
    for i in (2, 3): t.set(i, n - i, R(grip, 3 if i == 3 else 2)); t.set(i + 1, n - i + 1, R(grip, 1))
    t.set(1, 14, R(pommel, 4)); t.set(2, 14, R(pommel, 2))
    outline_alpha(t, R(blade, 0))
    if glow:
        for (x, y) in glow: t.set(x, y, R(blade, 5))
    t.save(TI + name + '.png')

B = 'bestiary/'
grid(PILE, B + 'hollow_ash', ASH); grid(PILE, B + 'wight_dust', BONE)
grid(ANTLER, B + 'pale_antler', BONE); grid(PELT, B + 'rime_pelt', ICE)
grid(SCALE, B + 'brine_scale', SEA); grid(SCALE, B + 'wyrm_scale', SAND)
grid(SHARD, B + 'ash_glass', fixed('#2a0c06', '#5e2410', '#a04a1c', '#d87a34', '#f4b060', '#ffe4b0')); grid(SHARD, B + 'faceless_crown_shard', BONE)
grid(VIAL, B + 'toad_venom', BOG, L, PEARL); grid(VIAL, B + 'changeling_ichor', fixed('#141404', '#3a3a0a', '#6a6a14', '#a0a024', '#d0cc44', '#f0ee90'), L, PEARL)
grid(COG, B + 'clockwork_cog', BRASS); grid(ORB, B + 'drowned_pearl', PEARL, r3=PEARL)
grid(RING, B + 'drowned_ring', G, r3=SEA); grid(KEY, B + 'stopped_clock_key', BRASS)
grid(HORN, B + 'pale_horn', BONE, ICE); grid(SEAL, B + 'faceless_seal', fixed('#2a0a08', '#561610', '#84261a', '#b03c28', '#d4603e', '#eea07a'))
grid(EFFIGY, B + 'mire_effigy', BOG, SAND); grid(HEART, B + 'mire_heart', BOG, r3=M['emerald'])
grid(BOW, B + 'rimefang_bow', ICE, DOAK, PEARL); grid(VEIL, B + 'widows_veil', PEARL, ASH)
grid(SHIELD, B + 'seneschal_greatshield', ASH, EMBER); grid(MANTLE, B + 'crownless_mantle', fixed('#0c1220', '#162236', '#22344e', '#32486a', '#486288', '#6a84a8'), ASH)
diag_sword(B + 'minute_hand', BRASS, BS, BS, BRASS, length=10, wide=False)
diag_sword(B + 'warlords_brand', fixed('#3a0606', '#701010', '#a82018', '#dc4024', '#f8843c', '#ffd070'), BS, L, BS, glow=[(9, 6), (12, 3)])
diag_sword(B + 'oath_of_oswin', PEARL, G, fixed('#0c1220', '#162236', '#22344e', '#32486a', '#486288', '#6a84a8'), VIOLET, glow=[(13, 2)])
H = 'horses/'
grid(HALTER, H + 'siege_halter', L, BRASS); grid(WHISTLE, H + 'siege_horse_whistle', BRASS, L, BS); grid(CROP, H + 'siege_riding_crop', DOAK, L)
grid(SHOES, H + 'siege_horseshoes_iron', I); grid(SHOES, H + 'siege_horseshoes_diamond', M['diamond']); grid(SHOES, H + 'siege_horseshoes_netherite', M['netherite'])
grid(CLOTH, H + 'siege_saddlecloth_padded', LINEN); grid(SADDLE, H + 'siege_saddle_cavalry', L, S, S); grid(SADDLE, H + 'siege_saddle_royal', RED, G, G)
grid(CAPARISON, H + 'siege_caparison', RED, G)
grid(EMBERORB, 'siege_hollow_ember', VIOLET, r3=VIOLET); grid(BOUND, 'siege_bound_ember', VIOLET, BS)
grid(WHEEL, 'siege_cipher_wheel', BRASS, BRASS, BS); grid(SHARD, 'siege_crown_shard', VIOLET); grid(SHARD, 'siege_mirror_glass', SEA)
grid(GAUNTLET, 'siege_gauntlet_of_challenge', S, RED); grid(HALL, 'siege_hall_cornerstone', REGIONS['vale']['stone'], RED, DOAK)
grid(BOOK, 'siege_lore_tome', L, G, P); grid(LEDGER, 'siege_ledger', fixed('#0c2414', '#163c22', '#245634', '#36744a', '#52946a', '#80b894'), G, P)
grid(BANNER, 'siege_oath_banner', RED, DOAK, G); grid(SCEPTER, 'siege_royal_scepter', G, G, VIOLET)
print('hc items done')

# ---- Hollow ore chain and the Warden's Bell (added for the Hollow thread's placeholders)
CHOIR = fixed('#241640', '#42287a', '#6a44b0', '#9a74dc', '#c4a8f4', '#ece0ff')
LUMP = ["................", "................", ".....ooo........", "....ohlmoo......", "...ohllmmdo.oo..", "...olmmHddoohlo.", "..oommMLddsolmo.", "..olmdMDdssomdo.",
        ".ohlmmddsoommdo.", ".olmmHLdsolmddo.", ".ommdMDsoommdso.", ".oddddssoddsso..", "..osssoo.osso...", "...ooo....oo....", "................", "................"]
INGOT = ["................", "................", "................", "................", "......ooooooooo.", ".....ohhhhhhllo.", "....ohlllllmmdo.", "...ohlllllmmdso.",
         "..ohhhhhhhmddso.", "..olllllllmdso..", "..olmmmmmmdso...", "..ommmmmmmso....", "..oooooooooo....", "................", "................", "................"]
BELL = ["................", ".......oo.......", "......oLMo......", "......oMDo......", "......oDDo......", ".....oollo......", "....ohllmmo.....", "....ohlmmdo.....",
        "...ohllmmddo....", "...ohlmmmddo....", "...olmmmdddo....", "..ohlmmmdddso...", "..olmmmddddso...", ".oHHLLLMMMDDSo..", ".ooooooLMooooo..", ".......oo......."]
grid(LUMP, 'siege_raw_choir_ore', REGIONS['undertow']['stone'], VIOLET)
grid(INGOT, 'siege_choirsteel_ingot', CHOIR)
grid(BELL, 'siege_wardens_bell', fixed('#120a1c', '#22143a', '#382258', '#523678', '#74529c', '#a07ec4'), BRASS)

import build_crown_art; build_crown_art.icon()   # the Hollow Crown icon follows Mateo's reference
