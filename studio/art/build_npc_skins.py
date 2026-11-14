"""NPC skins: one painted skin for every NPC the game spawns (Mateo 2026-11-13: "make sure everyone has a skin").

Bedrock's built-in NPC entity (minecraft:npc) shows the skin its siege:skin property points at (key index + 1), set by
core/npc_skins.js dressNpc; 0 falls back to its skinIndex. Our packs replace that entity's whole skin list with ours,
so no NPC can show Bedrock's default skin. Keys "<key>__<region>" are regional looks (REGIONAL below). The list and its order live in
Siege_Nights_BP/scripts/core/npc_skins_data.js (the place of a key is its skinIndex); this script reads it and writes
  Siege_Nights_RP/textures/entity/siege/npc_skins/<key>.png      64x64 player layout (geometry.humanoid.custom)
  Siege_Nights_RP/entity/npc.entity.json                          minecraft:npc client entity, one texture per key
  Siege_Nights_RP/render_controllers/siege_npc.render_controllers.json
  Siege_Nights_BP/entities/npc.json                               minecraft:npc with one skin_list entry per key
Run: python3 studio/art/build_npc_skins.py [sheet.png]

Same painter and ramps as the townsfolk (build_townsfolk.py), with more clothes: robes, mail and tabards, long coats,
motley, shawls, wimples, lords' circlets and miners' lamp caps. tools/check.mjs fails if a key has no picture or
the client entity, render controller or BP skin list does not match the list.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import ramp, fixed
from texlib import Tex, R
from build_townsfolk import faces, part, HEAD, BODY, RARM, LARM, RLEG, LLEG, SKIN, HAIR, LEATHER, EYE, C, front_view

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'Siege_Nights_BP/scripts/core/npc_skins_data.js')
OUT = os.path.join(ROOT, 'Siege_Nights_RP/textures/entity/siege/npc_skins/')
TEX_PATH = 'textures/entity/siege/npc_skins/'

SKINS = SKIN + [ramp('#b4bcc4', 0.20, 0.88, cool=0.08, warm=0.0, sat=0.6)]   # 4: the pale folk from below
PALE = 4
HAIRS = HAIR + [ramp('#e4e0d8', 0.30, 0.92, sat=0.3)]                        # 7: white
WHITE_HAIR = 7
MAIL = fixed('#3b3d44', '#5e6168', '#8a8d94', '#b4b6ba', '#d8d8d8', '#f4f2ee')  # vanilla iron
GOLD = ramp('#d8a832', 0.20, 0.82)
LAMP = fixed('#7a5a1a', '#c08a2a', '#f0c050', '#ffe08a', '#fff2c0', '#fffae6')


def spec(t, o, l, h=None, ok='none', hk='short', lk='breeches', sk=0, hair=0, beard=False, cuffs=False, trim=None):
    return dict(t=t, o=o, l=l, h=h, ok=ok, hk=hk, lk=lk, sk=sk, hair=hair, beard=beard, cuffs=cuffs, trim=trim)


S = spec
# key -> look. Kinds: over (ok) none apron vest fur stripes sash robe mail coat motley shawl;
# head (hk) short long bald cap kerchief hood wrap fur wimple circlet lamp; legs (lk) breeches skirt.
LOOKS = {
    'commoner': S('#7a5a3a', '#cdc2a6', '#4a3e30', None, 'apron', 'short', sk=1, hair=1),
    'mason': S('#7a7468', '#7a4e2c', '#4a443c', '#8e8a80', 'apron', 'cap', sk=1, hair=0, beard=True),
    # story people (lore/data/dialogue.js)
    'lore_wren': S('#4e5868', '#cdc2a6', '#3a3e48', '#e2d9c0', 'robe', 'wimple', 'skirt', sk=0, hair=4, trim='#8a6a3a'),
    'lore_aldous': S('#5e6168', '#d8d4c8', '#3a3632', None, 'mail', 'short', sk=0, hair=3, trim='#8a2a26'),
    'lore_elspeth': S('#5a5048', '#cdc2a6', '#3e3630', '#8a7e70', 'shawl', 'kerchief', 'skirt', sk=0, hair=WHITE_HAIR),  # Old Elspeth: blind, very old, at every hall's hearth
    'lore_mag': S('#3e4a2c', '#5a4a3a', '#2e2a24', '#4a4a30', 'shawl', 'hood', 'skirt', sk=1, hair=WHITE_HAIR),
    'lore_elias': S('#2a3456', '#c8b070', '#2a2e3a', '#2a3456', 'coat', 'cap', sk=0, hair=WHITE_HAIR, beard=True, cuffs=True),
    'lore_sage': S('#6a4a2e', '#b09a6a', '#3a2e24', None, 'robe', 'short', 'skirt', sk=2, hair=1, trim='#2a3a5a'),
    'lore_cael': S('#3a3634', '#6a6058', '#2a2624', None, 'robe', 'bald', 'skirt', sk=0, hair=4, trim='#6a6058'),
    'lore_sigrun': S('#7a2424', '#d8d4cc', '#3a3632', None, 'fur', 'long', 'skirt', sk=0, hair=3, cuffs=True),
    'lore_isolde': S('#c89a4a', '#7a2a1a', '#5a3a2a', '#e8dcc0', 'sash', 'wrap', sk=2, hair=5, trim='#e0b040'),
    'lore_nessa': S('#9a4a5a', '#ece4d0', '#4a3a34', '#ece4d0', 'apron', 'kerchief', 'skirt', sk=0, hair=2),
    'lore_jorund': S('#3a4e62', '#8a7a6a', '#2e2a28', '#7a6a5a', 'fur', 'fur', sk=0, hair=6, beard=True, cuffs=True),
    'lore_tilly': S('#2f6f8f', '#e2e6e8', '#4a4a52', None, 'stripes', 'long', 'skirt', sk=0, hair=6),
    'lore_hesper': S('#5a4a5a', '#7a6a3a', '#3a3428', '#6a5a7a', 'shawl', 'kerchief', 'skirt', sk=1, hair=1),
    'lore_corvin': S('#1e3e44', '#2e5a5e', '#1a2e30', None, 'robe', 'long', 'skirt', sk=PALE, hair=5, trim='#5a8a8a'),
    'lore_kesh': S('#6a3a2a', '#3a2a22', '#4a3a30', '#c8a060', 'vest', 'wrap', sk=2, hair=5, cuffs=True),
    'lore_ulla': S('#4a3a32', '#2e2a28', '#2e2a28', None, 'apron', 'short', sk=1, hair=6, beard=False),
    'lore_ottilie': S('#24365a', '#e2e6e8', '#3a3e4a', '#24365a', 'coat', 'cap', 'skirt', sk=0, hair=1, cuffs=True),
    'lore_nell': S('#5a6a3a', '#a89a6a', '#3a3428', '#8a7a4a', 'vest', 'kerchief', 'skirt', sk=1, hair=2),
    'lore_carter': S('#3e3648', '#6a5a4a', '#2e2a32', '#4a4054', 'vest', 'cap', sk=PALE, hair=0),
    # settlers: everyday folk from all over
    'settler_0': S('#8a3a26', '#cdc2a6', '#5a4a36', None, 'apron', 'short', sk=0, hair=1),
    'settler_1': S('#5a7a34', '#7a4e2c', '#4a3e30', '#6a5e48', 'vest', 'cap', sk=2, hair=0),
    'settler_2': S('#b08a3a', '#e2d9c0', '#6a3a2a', None, 'apron', 'long', 'skirt', sk=1, hair=3),
    'settler_3': S('#2e4a5a', '#d8d8d4', '#3a3632', '#d8d8d4', 'fur', 'fur', sk=0, hair=2, beard=True),
    'settler_4': S('#2f8f88', '#cdc2a6', '#4a4a52', '#cdc2a6', 'apron', 'kerchief', 'skirt', sk=3, hair=5),
    'settler_5': S('#a8482a', '#e0b040', '#6a4a3a', '#e0b040', 'sash', 'wrap', sk=2, hair=5),
    'settler_6': S('#4a5a2a', '#5a4632', '#3a3428', '#4a5a2a', 'vest', 'hood', sk=1, hair=4),
    'settler_7': S('#7a2a3a', '#cdc2a6', '#5a4a36', None, 'sash', 'long', 'skirt', sk=0, hair=6),
    # market fair traders, one per region
    'fair_vale': S('#6a3a5a', '#d8b04a', '#4a3e30', '#6a3a5a', 'vest', 'cap', sk=1, hair=1, trim='#d8b04a'),
    'fair_frostmarch': S('#3a4a6a', '#d8d4cc', '#2e2a28', '#d8d4cc', 'fur', 'fur', sk=0, hair=3, beard=True),
    'fair_saltreach': S('#d8d0b8', '#2a3e6a', '#3a3e4a', '#2a3e6a', 'stripes', 'kerchief', sk=0, hair=0),
    'fair_emberwaste': S('#e0c890', '#b0402a', '#8a6a4a', '#b0402a', 'sash', 'wrap', sk=3, hair=5, trim='#e0b040'),
    'fair_blackfen': S('#4a4a2a', '#8a7a4a', '#2e2a24', '#5a4632', 'shawl', 'hood', sk=1, hair=4),
    # the travelling players: patched motley
    'mummer_0': S('#b0302a', '#e0b040', '#3a6a3a', '#e0b040', 'motley', 'cap', sk=0, hair=6),
    'mummer_1': S('#3a6a3a', '#6a3a8a', '#b0302a', None, 'motley', 'long', 'skirt', sk=1, hair=2),
    'mummer_2': S('#2a4a8a', '#d8783a', '#e0b040', '#2a4a8a', 'motley', 'hood', sk=2, hair=0),
    # wonder keepers
    'keeper_great_lighthouse': S('#1e3256', '#d8b04a', '#2a2e3a', '#1e3256', 'coat', 'cap', 'skirt', sk=0, hair=4, cuffs=True),
    'keeper_high_watch': S('#5e6168', '#3a6a34', '#3a3632', None, 'mail', 'short', sk=1, hair=0, beard=True, trim='#d8b04a'),
    'keeper_rimeforge_hall': S('#6a2424', '#5a3a22', '#2e2a28', None, 'apron', 'long', 'skirt', sk=0, hair=WHITE_HAIR, cuffs=True),
    'keeper_sun_gate': S('#d8c8a0', '#2a5a7a', '#8a6a4a', '#2a5a7a', 'sash', 'wrap', sk=3, hair=5, beard=True, trim='#e0b040'),
    'keeper_lantern_spire': S('#3e4a34', '#c08a2a', '#2e2a24', '#3e4a34', 'coat', 'lamp', sk=1, hair=4),
    'keeper_great_horse_fair': S('#6a2a2a', '#7a4e2c', '#4a3e30', '#3a3022', 'vest', 'cap', 'skirt', sk=0, hair=2),
    # lost travellers: road cloaks
    'traveller_0': S('#5a5448', '#6a5e48', '#3a3630', '#5a5448', 'shawl', 'hood', sk=0, hair=1),
    'traveller_1': S('#4a3a3a', '#7a6a5a', '#2e2a28', None, 'shawl', 'long', 'skirt', sk=1, hair=2),
    'traveller_2': S('#3a4a4a', '#5a4632', '#2e2a28', '#3a4a4a', 'coat', 'hood', sk=3, hair=0),
    'traveller_3': S('#6a5a3a', '#8e826a', '#4a3e30', None, 'vest', 'short', sk=2, hair=4, beard=True),
    # Millbrook's clock keepers: Old Pell, Ada Rook, Hob Miller, Marta Lane, Corin Ashby
    'clock_0': S('#2e2c2e', '#5a5458', '#2a2628', None, 'coat', 'bald', sk=0, hair=WHITE_HAIR, beard=True),
    'clock_1': S('#4a4a52', '#e2d9c0', '#3a3a40', '#e2d9c0', 'apron', 'kerchief', 'skirt', sk=1, hair=0),
    'clock_2': S('#cdc2a6', '#e8e2d0', '#6a5e48', '#e8e2d0', 'apron', 'cap', sk=0, hair=3),
    'clock_3': S('#7a3a2a', '#ece4d0', '#4a3a34', None, 'apron', 'long', 'skirt', sk=2, hair=6),
    'clock_4': S('#3a4a3a', '#8a7a5a', '#2e2a28', None, 'vest', 'short', sk=0, hair=1, trim='#2a2a3a'),
    # Old Sigga, warden of the hunting lodge
    'warden_sigga': S('#3a4a2a', '#6a4a2c', '#3a3022', '#3e5a2c', 'vest', 'hood', 'skirt', sk=0, hair=WHITE_HAIR),
    # Mirelight villagers: Nell Reed, Osk Fenner, Brida Mott, Tam Cotter, Wynn Hale
    'mire_0': S('#5a4a5a', '#8a8a5a', '#3a3428', None, 'apron', 'long', 'skirt', sk=0, hair=1),
    'mire_1': S('#3a4a2a', '#5a4632', '#2e2a24', '#3a4a2a', 'vest', 'hood', sk=1, hair=0, beard=True),
    'mire_2': S('#6a6a3a', '#c08a2a', '#3a3428', '#6a5a7a', 'apron', 'kerchief', 'skirt', sk=2, hair=2),
    'mire_3': S('#5a4632', '#7a6a3a', '#2e2a24', None, 'sash', 'short', sk=0, hair=6),
    'mire_4': S('#3a3a2a', '#4a5a6a', '#2e2a24', '#4a5a6a', 'coat', 'cap', sk=1, hair=4),
    # rival lords: knights in mail and their region's tabard, the marked in dark robes; both wear a circlet
    'lord_vale_knight': S('#5e6168', '#3a6a34', '#3a3632', None, 'mail', 'circlet', sk=0, hair=1, trim='#d8b04a'),
    'lord_vale_marked': S('#2e3a2a', '#3a6a34', '#2a2a24', None, 'robe', 'circlet', 'skirt', sk=1, hair=5, trim='#d8b04a'),
    'lord_frostmarch_knight': S('#5e6168', '#2e4a6a', '#3a3632', None, 'mail', 'circlet', sk=0, hair=3, beard=True, trim='#d8d4cc'),
    'lord_frostmarch_marked': S('#2a3440', '#d8d4cc', '#2a2a2e', None, 'robe', 'circlet', 'skirt', sk=0, hair=WHITE_HAIR, trim='#7aa0c0'),
    'lord_saltreach_knight': S('#5e6168', '#2a3e6a', '#3a3632', None, 'mail', 'circlet', sk=1, hair=0, trim='#e2e6e8'),
    'lord_saltreach_marked': S('#1e2e44', '#2f8f88', '#2a2a32', None, 'robe', 'circlet', 'skirt', sk=0, hair=2, trim='#d8b04a'),
    'lord_emberwaste_knight': S('#5e6168', '#a8482a', '#3a3632', None, 'mail', 'circlet', sk=3, hair=5, trim='#e0b040'),
    'lord_emberwaste_marked': S('#4a2018', '#e0b040', '#2e2220', None, 'robe', 'circlet', 'skirt', sk=2, hair=5, trim='#e0b040'),
    'lord_blackfen_knight': S('#5e6168', '#4a5a2a', '#3a3632', None, 'mail', 'circlet', sk=1, hair=1, beard=True, trim='#9ad04a'),
    'lord_blackfen_marked': S('#2a2a22', '#5a4a6a', '#24221e', None, 'robe', 'circlet', 'skirt', sk=0, hair=5, trim='#9ad04a'),
    # guest-night visitors from below (lore/data/truce.js GUESTS, in order): pale, a little wet, lamp-lit
    'guest_0': S('#4a4060', '#8a84a0', '#2e2a3a', '#4a4060', 'shawl', 'hood', 'skirt', sk=PALE, hair=5),          # Ysse
    'guest_1': S('#2e3e44', '#6a5a4a', '#24282c', '#3a4048', 'coat', 'cap', sk=PALE, hair=WHITE_HAIR, beard=True),  # Old Tamwick
    'guest_2': S('#3a3a50', '#c08a2a', '#2a2a38', None, 'coat', 'lamp', 'skirt', sk=PALE, hair=4),                # Brannagh
    'guest_3': S('#5a4a6a', '#8a84a0', '#2e2a3a', None, 'robe', 'short', 'skirt', sk=PALE, hair=0),               # Cless
    'guest_4': S('#4a3e34', '#7a4e2c', '#2e2a28', None, 'apron', 'short', sk=PALE, hair=1, beard=True),           # Wenlow
    'guest_5': S('#3e5a5a', '#cdc2a6', '#2a3434', '#cdc2a6', 'apron', 'kerchief', 'skirt', sk=PALE, hair=3),      # Ama Reed
    'guest_6': S('#5a6a7a', '#c8d4dc', '#2a2e38', None, 'stripes', 'long', 'skirt', sk=PALE, hair=WHITE_HAIR),    # Hollis Glass
    'guest_7': S('#4a3a5a', '#8a6aa0', '#2e2a3a', '#8a6aa0', 'motley', 'hood', sk=PALE, hair=5),                  # The Twins Ferrow
    'guest_8': S('#3a4a3e', '#8a7a4a', '#24282a', '#3a4a3e', 'vest', 'hood', sk=PALE, hair=2),                    # Dannet
    'guest_9': S('#5a3a4a', '#8a84a0', '#2e2a3a', '#d8d4dc', 'shawl', 'wimple', 'skirt', sk=PALE, hair=WHITE_HAIR),  # Mother Quell
    'guest_10': S('#3a3a5a', '#d8d4dc', '#2a2a38', None, 'robe', 'short', sk=PALE, hair=6),                       # Pellam
    'guest_11': S('#2e2a3e', '#a08a4a', '#24222e', '#2e2a3e', 'coat', 'cap', 'skirt', sk=PALE, hair=4, trim='#d8b04a'),  # Seneth
    # the Hollow's miners
    'hollow_foreman': S('#3e3a4a', '#6a4a2c', '#2a2832', '#4a4658', 'apron', 'lamp', sk=PALE, hair=4, beard=True),
    'hollow_miner_0': S('#4a4250', '#5a4a3a', '#2a2832', '#4a4658', 'vest', 'lamp', sk=PALE, hair=0),
    'hollow_miner_1': S('#3a404a', '#5a4632', '#262830', '#3e4450', 'sash', 'lamp', sk=PALE, hair=5),
    'hollow_miner_2': S('#4a3e3a', '#4a5058', '#2a2826', '#4a4658', 'vest', 'lamp', 'skirt', sk=PALE, hair=2),
    # envoys of the great houses: Ondrel (Low Bell), Vesk (Salt Ledger), Ilith (Lamp-Keepers), Saelin (Deep Root), Carrack (Tidewall)
    'envoy_bell': S('#22305a', '#8a9ac0', '#1e2438', None, 'robe', 'bald', 'skirt', sk=PALE, hair=5, trim='#8a9ac0'),
    'envoy_salt': S('#4a3a22', '#d8a832', '#2a2420', '#d8d0b8', 'coat', 'cap', sk=PALE, hair=4, trim='#d8a832'),
    'envoy_lamp': S('#5a5030', '#e8d070', '#2e2a20', None, 'robe', 'lamp', 'skirt', sk=PALE, hair=WHITE_HAIR, trim='#e8d070'),
    'envoy_root': S('#2a3e2a', '#6a5a3a', '#22281e', '#2a3e2a', 'shawl', 'hood', 'skirt', sk=PALE, hair=1),
    'envoy_tide': S('#1e4448', '#5e6168', '#1a2a2e', None, 'mail', 'long', sk=PALE, hair=6, trim='#4a9a9a'),
}

# Regional looks (Mateo 2026-11-14): the same person dressed for each region, signature kept (Elspeth's shawl,
# kerchief and white hair; the Mason's leather apron, cap and beard). The Vale wears the plain key.
REGIONAL = {
    'lore_elspeth': {
        'frostmarch': dict(t='#3e4e60', o='#d8d4cc', l='#2e2a28', h='#6a7a90'),     # blue wool, white fleece shawl
        'saltreach': dict(t='#d8d0b8', o='#2a4e6a', l='#3a3e4a', h='#e2e6e8'),      # linen, sea-blue shawl
        'emberwaste': dict(t='#c8a060', o='#a8482a', l='#6a4a3a', h='#e0c890'),     # sand, rust shawl, pale headcloth
        'blackfen': dict(t='#3a3a2a', o='#5a4a3a', l='#24221e', h='#4a4a30'),       # oilskin dark, reed-brown shawl
    },
    'mason': {
        'frostmarch': dict(t='#3a4e62', h='#d8d4cc', l='#2e2a28', cuffs=True),      # wool and a fleece cap
        'saltreach': dict(t='#d8d0b8', h='#2a3e6a', l='#3a3e4a'),                   # linen, sea-blue cap
        'emberwaste': dict(t='#c8a060', h='#e0c890', l='#8a6a4a', sk=3),            # sand, pale cap
        'blackfen': dict(t='#4a4a2a', h='#3a3a2a', l='#2e2a24'),                    # oilskin and a dark cap
    },
}
for _base, _regions in REGIONAL.items():
    for _slug, _over in _regions.items():
        LOOKS[f'{_base}__{_slug}'] = {**LOOKS[_base], **_over}


def keys_from_js():
    src = open(DATA).read()
    body = src[src.index('NPC_SKINS = ['):]
    body = body[:body.index('];')]
    body = re.sub(r'//[^\n]*', '', body)
    return re.findall(r'"([a-z0-9_]+)"', body)


def person(key, seed):
    s = LOOKS[key]
    ok, hk, lk = s['ok'], s['hk'], s['lk']
    T_, O_, L_ = C(s['t']), C(s['o']), C(s['l'])
    H_ = C(s['h']) if s['h'] else (fixed('#f2ecda', '#f2ecda', '#e2d9c0', '#e2d9c0', '#f2ecda', '#f2ecda') if hk == 'wimple' else None)
    if hk == 'wimple' and s['h']: H_ = ramp(s['h'], 0.55, 0.95, sat=0.4)
    if H_ is None: H_ = O_                                                  # a cap or hood in the over colour
    TR = C(s['trim']) if s['trim'] else None
    sk = SKINS[s['sk']]
    hair = HAIRS[s['hair']]
    t = Tex(64, 64, seed=seed)
    covered = hk in ('hood', 'wrap', 'fur', 'wimple')
    robe = ok == 'robe'

    def head(face, i, j, fw, fh):
        if face == 'front':
            if covered and (j <= 1 or i in (0, 7)): return R(H_, 3 if j == 0 else 2)
            if hk == 'lamp' and j <= 1: return R(LAMP, 4) if (j == 1 and i in (3, 4)) else R(H_, 3 - (j == 1))
            if hk in ('cap', 'kerchief') and j <= 1: return R(H_, 4 if j == 0 else 3)
            if hk == 'circlet' and j == 1: return R(GOLD, 4 if i in (3, 4) else 3)
            if hk == 'circlet' and j == 0: return R(hair, 3)
            if hk in ('short', 'long') and j <= 1 or (hk == 'long' and i in (0, 7) and j <= 6): return R(hair, 3 - (j == 1))
            if hk == 'bald' and j == 0: return R(sk, 3)
            if j == 4 and i in (2, 5): return EYE if s['sk'] != PALE else (54, 52, 72)
            if j == 4 and i in (1, 6): return (226, 222, 214)
            if j == 3 and i in (1, 2, 5, 6) and not covered: return R(hair, 1)
            if j == 5 and i in (3, 4): return R(sk, 2)
            if j == 6 and 3 <= i <= 4: return R(sk, 1)
            if s['beard'] and j >= 6 and 1 <= i <= 6 and not (j == 6 and 3 <= i <= 4): return R(hair, 2 + (j == 7))
            return R(sk, 4 if (i < 4 and j < 5) else 3)
        if face == 'bottom': return R(sk, 2)
        if covered: return R(H_, 3 + (face == 'top') - ((i + j) % 6 == 0))
        if hk in ('cap', 'kerchief', 'lamp') and (face == 'top' or j <= 2): return R(H_, 3 + (face == 'top') - (i % 3 == 0))
        if hk == 'circlet' and face != 'top' and j == 1: return R(GOLD, 3 - (face == 'back'))
        if hk == 'bald': return R(hair, 2) if (face != 'top' and 3 <= j <= 5) else R(sk, 3 + (face == 'top'))
        if hk == 'short' and face != 'top' and j >= 4: return R(sk, 3) if face in ('left', 'right') and j >= 5 else R(hair, 2)
        return R(hair, 3 + (face == 'top') - ((i * 3 + j) % 5 == 0) - (j == fh - 1))

    def body(face, i, j, fw, fh):
        if face == 'top': return R(O_ if ok in ('fur', 'shawl', 'coat') else MAIL if ok == 'mail' else T_, 4)
        if face == 'bottom': return R(L_, 1)
        edge = -1 if face in ('left', 'right', 'back') else 0
        if ok == 'mail':                                                     # mail under a tabard, belted
            if face in ('front', 'back') and 2 <= i <= 5 and j >= 1:
                if j == 7: return R(LEATHER, 2 + (face == 'front' and i in (3, 4)) * 2)
                if TR and face == 'front' and (i in (3, 4) and 2 <= j <= 6 or j == 4): return R(TR, 3)
                return R(O_, 3 + edge - (j == fh - 1))
            if j == 7: return R(LEATHER, 2)
            return R(MAIL, 1 + ((i + j // 2) % 2) + edge + (j == 0))
        if robe:
            if j == 7: return R(TR or LEATHER, 3 - (face != 'front'))           # rope or sash belt
            if face == 'front' and i in (3, 4) and j <= 2 and TR: return R(TR, 3)
            if covered and j <= 1: return R(H_, 3 - j)
            return R(T_, 3 + edge + (j == 0) - (i == fw - 1) - (i % 3 == 2 and j > 7))
        if ok == 'coat':
            if j == 7: return R(LEATHER, 2)
            if face == 'front' and i in (3, 4): return R(O_ if i == 3 and j % 3 == 1 else T_, 2 if i == 4 else 4)  # buttons
            if face == 'front' and j <= 1 and i in (2, 5): return R(T_, 4)                                     # lapels
            return R(T_, 3 + edge + (j == 0) - (i == fw - 1))
        if ok == 'motley':
            if j == 7: return R(LEATHER, 2)
            return R(O_ if ((i // 2) + (j // 3)) % 2 else T_, 3 + edge)
        if ok == 'shawl' and j <= 3 and (face != 'front' or j <= 2 - abs(i - 3.5) // 2 or i in (0, 7)):
            return R(O_, 3 + edge + (j == 0) - (j == 3))
        if j == 7 and ok != 'sash': return R(LEATHER, 2) if not (face == 'front' and i in (3, 4)) else R(LEATHER, 4)
        if ok == 'sash' and j in (6, 7): return R(O_, 3 - (j == 7))
        if face == 'front':
            if ok == 'apron' and 2 <= i <= 5 and j >= 3: return R(O_, 4 - (j == fh - 1) - (i == 5))
            if ok == 'vest' and i in (0, 1, 6, 7) and j < 7: return R(O_, 3 - (i in (1, 6)))
            if ok == 'fur' and j <= 2: return R(O_, 4 - (i + j) % 2)
            if ok == 'stripes' and j % 2 == 1 and j < 7: return R(O_, 3)
            if TR and ok in ('sash', 'vest') and j == 0: return R(TR, 3)
        elif ok in ('vest', 'fur') and j <= (11 if ok == 'vest' else 2) and face != 'back' or (ok == 'vest' and face == 'back' and j < 7):
            return R(O_, 3 + edge)
        elif ok == 'stripes' and j % 2 == 1 and j < 7: return R(O_, 3 + edge)
        if covered and j <= 1: return R(H_, 3 - j)                                         # hood falls on the shoulders
        return R(T_, 3 + edge + (j == 0) - (j == fh - 1) - (i == fw - 1))

    def arm(face, i, j, fw, fh):
        if face == 'top': return R(O_ if ok in ('fur', 'shawl') else MAIL if ok == 'mail' else T_, 4)
        if face == 'bottom': return R(sk, 2)
        if j >= 10: return R(sk, 3 - (i == fw - 1))
        if ok in ('fur',) and j <= 2: return R(O_, 4 - (i + j) % 2)
        if ok == 'shawl' and j <= 3: return R(O_, 3 - (face in ('back', 'left')) + (j == 0))
        if ok == 'mail': return R(MAIL, 1 + ((i + j // 2) % 2) - (face in ('back', 'left')) + (j == 0))
        if ok == 'motley': return R(O_ if (j // 3) % 2 else T_, 3 - (face in ('back', 'left')))
        if j == 9 and (s['cuffs'] or ok in ('coat', 'robe')): return R(TR or O_ if ok == 'coat' else TR or T_, 2 if not TR else 3)
        return R(T_, 3 - (face in ('back', 'left')) - (i == fw - 1) + (j == 0))

    def leg(face, i, j, fw, fh):
        if face == 'top': return R(T_ if robe else L_, 2)
        if face == 'bottom': return R(LEATHER, 0)
        back = face in ('back', 'left')
        if robe and j <= 10: return R(T_, 3 - back - (i == fw - 1) - (j == 10) + (j == 0 and face == 'front'))
        if ok == 'coat' and j <= 5: return R(T_, 3 - back - (i == fw - 1) - (j == 5))
        if lk == 'skirt' and j <= 8:
            if face == 'front' and ok == 'apron' and j <= 4: return R(O_, 3 - (j == 4))
            return R(L_, 3 - (j == 8) - back - (i == fw - 1))
        if j >= 9: return R(LEATHER, 3 if j == 9 else 2 - (i == fw - 1))
        if ok == 'motley': return R(L_ if (i + face.__len__()) % 2 else O_, 3 - back)
        return R(L_, 3 - (i == fw - 1) - back)

    for box, fn in ((HEAD, head), (BODY, body), (RARM, arm), (LARM, arm), (RLEG, leg), (LLEG, leg)): part(t, box, fn)
    return t


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(data, f, indent=2); f.write('\n')


def pack_files(keys):
    tex = {k: TEX_PATH + k for k in keys}
    write_json(os.path.join(ROOT, 'Siege_Nights_RP/entity/npc.entity.json'), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "minecraft:npc",
            "materials": {"default": "entity_alphatest"},
            "textures": tex,
            "geometry": {"default": "geometry.humanoid.custom"},
            "scripts": {
                "pre_animation": ["variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / 1.0) * 57.3;"],
                "animate": ["humanoid_base_pose", "look_at_target_default", "move"]},
            "animations": {
                "humanoid_base_pose": "animation.humanoid.base_pose",
                "look_at_target_default": "animation.humanoid.look_at_target.default",
                "move": "animation.humanoid.move"},
            "render_controllers": ["controller.render.siege_npc"],
            "spawn_egg": {"texture": "spawn_egg", "texture_index": 35}}}})
    write_json(os.path.join(ROOT, 'Siege_Nights_RP/render_controllers/siege_npc.render_controllers.json'), {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render.siege_npc": {
            "arrays": {"textures": {"Array.skins": [f"Texture.{k}" for k in keys]}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            # siege:skin (key index + 1) from core/npc_skins.js dressNpc; 0 = Bedrock's own pick, for hand-placed NPCs
            "textures": ["Array.skins[query.property('siege:skin') > 0 ? query.property('siege:skin') - 1 : query.variant]"]}}})
    # Bedrock's own NPC entity, as shipped, with our skin list: skinIndex N shows variant N (our key N)
    write_json(os.path.join(ROOT, 'Siege_Nights_BP/entities/npc.json'), {
        "format_version": "1.21.60",
        "minecraft:entity": {
            "description": {"identifier": "minecraft:npc", "is_experimental": False, "is_summonable": True,
                            "is_spawnable": True, "spawn_category": "creature",
                            "properties": {"siege:skin": {"type": "int", "range": [0, len(keys)], "default": 0, "client_sync": True}}},
            "components": {
                "minecraft:behavior.look_at_player": {"look_time": {"min": 1, "max": 2}, "look_distance": 6},
                "minecraft:collision_box": {"height": 2.1, "width": 0.6},
                "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no"}},
                "minecraft:fire_immune": {},
                "minecraft:loot": {"table": "loot_tables/empty.json"},
                "minecraft:movement": {"value": 0.5},
                "minecraft:nameable": {"allow_name_tag_renaming": False, "always_show": False},
                "minecraft:npc": {"npc_data": {
                    "picker_offsets": {"scale": [1.7, 1.7, 1.7], "translate": [0, 20, 0]},
                    "portrait_offsets": {"scale": [1.75, 1.75, 1.75], "translate": [-7, 50, 0]},
                    "skin_list": [{"variant": i} for i in range(len(keys))]}},
                "minecraft:persistent": {},
                "minecraft:physics": {},
                "minecraft:type_family": {"family": ["npc", "mob"]}}}})


if __name__ == '__main__':
    keys = keys_from_js()
    missing = [k for k in keys if k not in LOOKS]
    extra = [k for k in LOOKS if k not in keys]
    if missing: sys.exit(f'no look for: {", ".join(missing)} (add them to LOOKS)')
    if extra: sys.exit(f'looks not in npc_skins_data.js: {", ".join(extra)}')
    os.makedirs(OUT, exist_ok=True)
    cols = 12
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 110, rows * 210), (58, 58, 64, 255))
    for n, k in enumerate(keys):
        t = person(k, n + 1)
        t.save(OUT + f'{k}.png')
        fv = front_view(t.im)
        sheet.paste(fv, ((n % cols) * 110 + 7, (n // cols) * 210 + 9), fv)
    pack_files(keys)
    if len(sys.argv) > 1: sheet.save(sys.argv[1])
    print(f'{len(keys)} NPC skins done')
