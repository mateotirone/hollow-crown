"""Final art for the rest of the Codex items: the Oathsworn set and the Cairn-Helm (worn in 3D), the boss and rival
drops, the twelve mythical weapons and tools, the seven thin-place charms, the Sun Gate caravan goods and the Codex.
Same paths as studio/art/build_codex_art.py (textures/items/codex/<id>.png, textures/models/siege_armor/codex_<id>.png,
models/entity/armor/codex_<id>.geo.json).

    python3 studio/art/build_codex_art2.py [repo root]      then  python3 tools/build_player_joints.py
Re-run safe. Sheet for review: art/codex-items.png

Icons are drawn as 16x16 character grids. One letter is one fixed colour (see PAL), '.' is empty, and a dark outline
is added round the shape, as on every other item.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M, fixed
from texlib import Tex, outline_alpha
import build_codex_art as A

T = A.T
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
PAL = {k: hx(v) for k, v in {
    'S': '#eef0f2', 's': '#c4c8cc', 'z': '#8e949c', 'Z': '#5a606a',          # silver
    'Y': '#fff4b8', 'y': '#e8b83a', 'u': '#8f5a16',                          # gold
    'I': '#6e7a89', 'i': '#3f4753', 'j': '#20242d',                          # dark iron
    'W': '#8a6440', 'w': '#6c4c30', 'v': '#3c2818',                          # wood
    'R': '#e05040', 'r': '#a02424', 'q': '#5a1010',                          # red
    'B': '#c4e6f6', 'b': '#6a9cbc', 'n': '#2c4c7c',                          # blue
    'E': '#a0dc40', 'e': '#4f8f33', 'f': '#254d18',                          # green
    'P': '#c08cf0', 'p': '#7446b8', 'l': '#3a1f6a',                          # violet
    'A': '#f0e6c8', 'a': '#c8b48a', 'c': '#8a744e',                          # parchment, bone, rope
    'F': '#ffd560', 'o': '#ee6a12', 'O': '#a82a0a',                          # flame
    'K': '#a4a6a8', 'k': '#6a6c70', 'm': '#44464a',                          # stone
    'D': '#dba848', 'd': '#905a1a',                                          # bronze
    'C': '#58b5a6', 't': '#22696a',                                          # sea green
    'h': '#f0a0c0', 'X': '#ffffff', 'x': '#221c28', 'V': '#ecd8ff', 'U': '#a05cf0'}.items()}
INK = (34, 28, 40)

ICONS = {
 # ---- Oathsworn and the drops
 'oathsworn_sword': ['.............Ss.', '............Ssz.', '...........Ssz..', '..........Ssz...', '.........Skz....', '........Ssz.....', '.......Ssz......',
                     '....u.Ssz.......', '....yusz........', '...vyyu.........', '..vw.yu.........', '.zv.............', '.Zz.............'],   # old silver, a nick in the blade, the gold worn thin
 'usurpers_edge': ['.............Ri.', '............Rij.', '...........RIj..', '..........RIj...', '.........RIj....', '........RIj.....', '.......RIj......',
                   '....y.rIj.......', '....Yyij........', '...vyyu.........', '..vw.yu.........', '.yv.............', '.Yy.............'],        # dark blade, a red edge, a crown for a pommel
 'seers_glass': ['................', '.....yyyy.......', '....yBBBby......', '...yBXBbbby.....', '...yBBbbbny.....', '...yBbbbnny.....', '...ybbbnnny.....',
                 '....ybnnny......', '.....yyyyu......', '........uwv.....', '.........wWv....', '..........wWv...', '...........wv...'],
 'claimants_mace': ['..........I.I...', '.........IiIiI..', '........IiiIiij.', '.........iIiij..', '........IiiIjij.', '.........jijij..', '........Ww.j....',
                    '.......Ww.......', '......Ww........', '.....Ww.........', '....yw..........', '...Wy...........', '..vw............'],
 'lists_gauntlet': ['................', '....S.S.S.S.....', '...SsSsSsSsz....', '...SsSsSsSsz....', '...SssssssszS...', '...SsssssssSsz..', '...zzzzzzzzsz...',
                    '....Ssssssz.....', '....yyyyyyu.....', '....Sssssz......', '....Sssssz......', '....zzzzzZ......'],
 'hex_lantern': ['.......jj.......', '......j..j......', '......jiij......', '.....jIiiij.....', '.....iPPpli.....', '.....iPXPli.....', '.....iPPpli.....',
                 '.....ipppli.....', '.....iplllj.....', '.....jIiiij.....', '......jjjj......'],
 'lords_signet': ['................', '......qRRq......', '.....qRhRrq.....', '.....yRRrry.....', '....yYyqqyuy....', '...yYy....yuy...', '...yy......yu...',
                  '...yy......yu...', '...yuy....yuu...', '....yuyyyyuu....', '.....uuuuuu.....'],
 'regents_seal_ring': ['................', '......nBBn......', '.....nBXBbn.....', '.....pBBbbp.....', '....pPplllpl....', '...pPp....plp...', '...pp......pl...',
                       '...pp......pl...', '...plp....pll...', '....plpppplk....', '.....llllll.....'],
 'fair_champions_barding': ['................', '..yy............', '.ybby...........', '.ybbbyyyyyyy....', '.ybnbbbbbbbby...', '..ybbbYbbYbbby..', '..ybbbbbbbbbny..',
                            '..ybnbbbbbbnby..', '...ynnyyyynny...', '...yby....yby...', '...yby....yby...', '...yyy....yyy...'],
 # ---- mythical weapons
 'maelis_clapper': ['................', '..........yy....', '.........yDDy...', '........yDYDdy..', '........yDDddy..', '.........yddy...', '........Dyy.....',
                    '.......Dd.......', '......Dd........', '.....Dd.........', '....yd..........', '...cy...........', '..cc............'],     # the bell's own tongue, bronze, on a rope loop
 'cairn_axe': ['......kKKk......', '.....kKBKKk.....', '....KKKbKKKK....', '....KKBKKkKK....', '....kKKKkWkK....', '.....kKk.Ww.K...', '......k..Ww.....',
               '........Ww......', '.......Ww.......', '......Ww........', '.....cW.........', '....Wc..........', '...vw...........'],                    # grey stone-forged bit with pale runes
 'holts_debt': ['............oF..', '...........oIi..', '..........FIij..', '.........oIij...', '........oIij....', '.......FIij.....', '......oIij......',
                '....m.Oij.......', '....kmij........', '...vkkm.........', '..vw.km.........', '.mv.............', '.Om.............'],          # a boat-burner's cutlass, the edge still embered
 'ysolts_lance': ['..............F.', '.............Fo.', '............yO..', '...........yu...', '........RRWw....', '.......RRrW.....', '......RrrWw.....',
                  '.......rWw......', '......Ww........', '.....Ww.........', '....Ww..........', '...yw...........', '..Wy............', '.vw.............'],   # ember tip, red pennon
 'sedges_thorn': ['................', '............E...', '...........ef...', '..........efj...', '.........efj....', '........efj.E...', '.......efj.e....',
                  '......efj.......', '....c.fj........', '....vcj.........', '...vcc..........', '..vw.c..........', '.vv.............'],      # a long black thorn that is still green
 'second_moon_bow': ['......bSSX......', '....bSS..B......', '...bS....B......', '..bS.....B......', '..S......B......', '.bS......B......', '.BX......B......',
                     '.BX......B......', '.bS......B......', '..S......B......', '..bS.....B......', '...bS....B......', '....bSS..B......', '......bSSX......'],   # pale as a second moon, strung with light
 'eddas_mercy': ['.............XS.', '............XSs.', '...........XSs..', '..........XSs...', '.........XSs....', '........XSs.....', '.......XSs......',
                 '....y.XSs.......', '....YySs........', '...Ayyu.........', '..Aa.yu.........', '.ha.............', '.hh.............'],          # a saint's slim white blade
 # ---- mythical tools
 'hrodas_pick': ['................', '....dDDDDDd.....', '...dDYDDDDDd....', '..dD...WwdDDd...', '..d...Ww..dDd...', '.....Ww....Dd...', '....Ww.....dd...',
                 '...Ww.......d...', '..Ww............', '.yw.............', '.wv.............'],                                                 # bell-bronze head
 'sextons_spade': ['..........iIi...', '.........iIIIi..', '........iIIIIIj.', '........iIIIIij.', '.........iIIij..', '........Wwiij...', '.......Ww.j.....',
                   '......Ww........', '.....Ww.........', '....Ww..........', '..vWw...........', '.vWv............', '..v.............'],
 'aldrics_sickle': ['.....yYYy.......', '....yY..uyy.....', '...yY.....uy....', '...Y.......uy...', '...........uy...', '..........uyy...', '.........uy.....',
                    '........Wu......', '.......Ww.......', '......Ww.e......', '.....Ww..E......', '....Wv..........', '...vv...........'],     # a king's gold sickle, a leaf still on it
 'wennas_line': ['.............W..', '............Ww.A', '...........Ww..A', '..........Ww...A', '.........Ww....A', '........Ww.....A', '.......Ww......A',
                 '......Ww.......A', '.....Ww........R', '....zw.........X', '...Wz..........R', '..vw...........z', '.vv.............'],              # a plain rod, a red float
 'corvins_lodestone': ['.......cc.......', '......c..c......', '......c..c......', '.......cc.......', '......mkkm......', '.....mkKkkm.....', '....mkKRkkjm....',
                       '....mkkkbkjm....', '....mkkkkjjm....', '.....mkjjjm.....', '......mmmm......'],
 # ---- thin-place charms
 'chapel_clapper': ['................', '.......cc.......', '......c..c......', '.......cc.......', '.......tC.......', '.......tC.......', '......tCCt......',
                    '.....tCXCtt.....', '.....tCCCtt.....', '......tttt......'],
 'founders_slag': ['................', '................', '.....mkkm.......', '....mkKkkmm.....', '...mkDkkkjkm....', '...mkkkjDkkm....', '..mkkjkkkkjm....',
                   '..mkYkkkjkkm....', '...mjkkDkjm.....', '....mmjjmm......'],
 'barrow_coin': ['................', '.....uddddu.....', '....dDDDDDdu....', '...dDyDyDyDdu...', '...dDyyyyyDdu...', '...dDDyyyDDdu...', '...dDDDDDDddu...',
                 '...dDddddDddu...', '....dDDDDddu....', '.....uddddu.....'],
 'saltglass_prism': ['................', '.......XX.......', '......XBBb......', '......XBBb......', '.....XBBbbb.....', '.....XBhbbb.....', '....XBBEbbbn....',
                     '....XBBbFbbn....', '...XBBBbbbbbn...', '...bbbbbnnnnn...'],
 'frostvein_shard': ['.........X......', '........XBb.....', '........XBb.....', '.......XBBb.....', '.......XBbbn....', '......XBBbbn....', '......XBbbn.....',
                     '.....XBBbbn.....', '.....BBbbn......', '......bbn.......', '.......n........'],
 'quarry_mark': ['................', '....kKKKKk......', '...kKKKKKKKk....', '..kKKmKKKmKKk...', '..kKKKmKmKKKm...', '..kKKKKmKKKKm...', '..kKKKmKmKKkm...',
                 '..kKKmKKKmKkm...', '...kKKKKKkkm....', '....mmmmmmm.....'],
 'witchroot_knot': ['................', '......vWw.......', '....wW..Wwv.....', '...wW.wWv.Wv....', '...W.wW.Wv.w....', '...WvW.E.WvW....', '...wWvWwWvWv....',
                    '....vWwvwWv.....', '......v..w......', '.....v....v.....'],
 # ---- Sun Gate caravan goods
 'wayfarers_compass': ['................', '.....uyyyyu.....', '....yYAAAAyu....', '...yAAARAAAyu...', '...yAAARAAAyu...', '...yAAAxAAAyu...', '...yAAAzAAAyu...',
                       '...yAAAzAAAyu...', '....yAAAAAyu....', '.....uyyyyu.....'],
 'sandglass_of_nights': ['....wWWWWWWw....', '....vBBBBBBv....', '.....BBBBBB.....', '.....BnnnnB.....', '......BnnB......', '.......nB.......', '.......nB.......',
                         '......B.nB......', '.....B.nn.B.....', '.....BnnnnB.....', '....vnnnnnnv....', '....wWWWWWWw....'],                        # night-blue sand
 'caravan_saddle': ['................', '................', '...WW......ww...', '..WwwW....Wwwv..', '..WwwwWWWWwwwv..', '.oFoFoFoFoFoFoO.', '.RrRrRrRrRrRrRq.',
                    '.oFoFoFoFoFoFoO.', '...c........c...', '...y........y...', '..yuy......yuy..'],
 'ember_tea': ['.......X........', '......X..X......', '.......X.X......', '......X.X.......', '................', '...AAAAAAAA.....', '...AoFoooOAaa...',
               '...AooooOOA.a...', '...AAooOOAAaa...', '....AAAAAAa.....', '..aAAAAAAAAAa...'],
 'far_coast_seeds': ['................', '......ccc.......', '.....cAAAc......', '......cRc.......', '.....aAAAac.....', '....aAAAAAac....', '...aAAeAAAAac...',
                     '...aAAAAEAAac...', '...aAEAAAAAac...', '....aAAAeAac....', '.....acccc......'],
 'hatching_brazier': ['......F.........', '.....FoF..F.....', '....FoOoFFo.....', '....oOOOooO.....', '...jiIIIIIij....', '...jOiOiOiOj....', '....jiIIIij.....',
                      '.....jiij.......', '......ii........', '.....jiij.......', '....j.ii.j......', '...j..jj..j.....'],
 'map_of_lost_things': ['................', '..aAAAa.aAAAa...', '..AAAAAaAAAAAc..', '..AAcAAaAeeAAc..', '..AcAcAaAAeAAc..', '..AAcAAaAAAAAc..', '..AAAAcaccAAAc..',
                        '..AbbAAaAAcRAc..', '..AAbbAaARAcAc..', '..AAAAAaAAcRAc..', '..aAAAa.aAAAac..'],
 'ashglass_lantern': ['.......kk.......', '......k..k......', '......mkkm......', '.....mKkkkm.....', '.....kzFFzk.....', '.....kFXFok.....', '.....kzFozk.....',
                      '.....kzzzzk.....', '.....mKkkkm.....', '......mmmm......'],
 'desert_rose': ['................', '......aAa.......', '....aAAhAAa.....', '...aAhAAAhAa....', '...AAAhhAAAa....', '..aAhAhAhAhAa...', '...AAAhAhAAAc...',
                 '...aAhAAAhAac...', '....aAAhAAac....', '......accc......'],
 'mirage_flask': ['.......cc.......', '.......AA.......', '......zBBz......', '......zBBz......', '.....zBBBBz.....', '....zBXBhBBz....', '....zBBBBPBz....',
                  '....zBhBBBBz....', '....zBBPBBbz....', '.....zbbbbz.....', '......zzzz......'],
 'caravan_banner': ['...y............', '..yYy...........', '...WoFoFoFoO....', '...WFoFYFoFO....', '...WoFYyYFoO....', '...WFoFYFoFO....', '...WoFoFoFO.....',
                    '...WFoFoFO......', '...WoFoO........', '...W............', '...W............', '...w............', '...w............'],
 # ---- the five Choir Shards, one from each regional boss: the same violet stone, grown through what each boss was
 'choir_shard_reeve': ['........V.......', '.......VPU......', '.......VPUp.....', '......VPUUp.....', '...y.yVPUppy.y..', '..yYyDDDDDDDyuy.', '..yDDdxdddxdDdu.',     # Stopped Clock: a brass cog locked round it, two hands
                       '...u.uPUxplu.u..', '......VPUpl.....', '......VUUpl.....', '.......Upl......', '.......Upl......', '........l.......'],
 'choir_shard_huntsman': ['..X.......X.....', '..XB.....XB.....', '..XBb...XBb.....', '...XBb.XBbn.....', '...XBBVBBbn.....', '....XBVPUbn.....', '....XBVPUbn.....',   # Frozen Lake: forked like an antler, clear ice over the violet
                          '.....XVPUbn.....', '.....XBPUbn.....', '......XBUbn.....', '......XBbn......', '.......Bbn......', '.......bn.......'],
 'choir_shard_bride': ['.......cc.......', '.......CC.......', '......CVPt......', '.....CVPUpt.....', '.....CVPUpt.....', '....CVPPUppt....', '....CVPUUplt....',     # Drowned Altar: bell-shaped, sea-green and wet, a drop falling
                       '...CCVPUUpltt...', '...Ctttttttttt...', '.......Ct.......', '................', '.......B........', '.......b........'],
 'choir_shard_seneschal': ['.........a......', '........aVa.....', '.......aVPUc....', '.......aPoUc....', '......aVPFUpc...', '......aVoUUpc...', '.....aVPFUopc...',   # Faceless Vault: sand-crusted, ember running in its cracks
                           '.....aVPUoUpc...', '....aAVPUFppc...', '....aAaPUopc....', '...aAAaaUpc.....', '...aaAAaacc.....', '....cccccc......'],
 'choir_shard_mother': ['........V.......', '.......VPU......', '..v....VPUp.....', '..wv..VPUUp..v..', '...wvVPUUpp.vw..', '....wWPUEpvvw...', '.....VwWUvwp....',     # Cradle Tree: roots grip it, fen-light where they cross
                        '.....VPwWwpl....', '....vwVwEWwl....', '...vw.wUplWv....', '..vw..vUpl.wv...', '..v....vl...v...', '................'],
 'caravan_rations': ['................', '.....cccccc.....', '....cAAAAAAc....', '...cAAaAAaAAc...', '...cccRcccccc...', '...cAAaRAaAAc...', '...cAAAaRAAAc...',
                     '...cAaAARAaAc...', '....cAAAAAAc....', '.....cccccc.....'],                                                         # a waxed-cloth bundle, tied with red cord
 'codex': ['................', '...fffffffffff..', '..feeeeeeeeeefy.', '..feyyyyyyyeefA.', '..feyeeYeeyeefA.', '..feyeYeYeyeeyy.', '..feyeeYeeyeeyu.',
           '..feyeeeeeyeefA.', '..feyyyyyyyeefA.', '..feeeeeeeeeefA.', '..ffffffffffffA.', '...cAAAAAAAAAAc.'],
}

OATH = dict(metal=fixed('#3c3e44', '#5c5f66', '#82868c', '#a6a9ac', '#c6c8c8', '#e2e2de'), trim=fixed('#4a3a18', '#6e5822', '#94782e', '#b4963e', '#ccb260', '#e0cc8c'),
            cloth=fixed('#2a2030', '#3e3046', '#54425e', '#6c5878', '#867292', '#a290ac'), glow=fixed('#6e5822', '#94782e', '#b4963e', '#ccb260', '#e0cc8c', '#f0e4b8'), style='plate', tabard=False)
CAIRN = dict(metal=fixed('#26282c', '#3a3d42', '#52565c', '#6e7278', '#8e9296', '#b0b3b4'), trim=fixed('#3e6480', '#6a9cbc', '#9ccbe4', '#c4e6f6', '#e2f5fd', '#f8feff'),
             cloth=M['leather'], glow=M['parchment'], style='plate', tabard=False)


def icon(iid, rows):
    t = Tex()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(16, '.')[:16]):
            if ch != '.': t.set(x, y + (16 - len(rows)) // 2, PAL[ch])
    outline_alpha(t, INK)
    os.makedirs(T + 'items/codex', exist_ok=True); t.save(T + f'items/codex/{iid}.png'); return t.im


def main():
    A.SETS['oathsworn'] = OATH; A.SETS['cairn'] = CAIRN
    oath_extra = {"helmet": {"head": [A.cube([-0.5, 33, -2], [1, 1, 3], [32, 0], 'metal')]},                      # the crest was broken off: only its stub is left
                  "chestplate": A.pauldrons(), "leggings": A.knees(), "boots": A.cuffs('metal')}
    worn = A.build_set('oathsworn', OATH, E=oath_extra)
    cairn_extra = {"helmet": {"head": [A.cube([-7, 29, -1], [2, 1, 1], [32, 0], 'glowhorn'), A.cube([-7, 30, -1], [1, 3, 1], [40, 0], 'glowhorn'),   # two horns, out and up
                                       A.cube([5, 29, -1], [2, 1, 1], [32, 0], 'glowhorn', True), A.cube([6, 30, -1], [1, 3, 1], [40, 0], 'glowhorn', True),
                                       A.cube([-2.5, 33, -2.5], [5, 1, 5], [32, 4], 'metal')]}}                  # a flat stone cap, like the top of a cairn
    cairn = A.build_set('cairn', CAIRN, pieces=('helmet',), E=cairn_extra)
    os.replace(T + 'models/siege_armor/codex_cairn_helmet.png', T + 'models/siege_armor/codex_cairn_helm.png')    # the item id is siege:cairn_helm
    p = A.RP + 'models/entity/armor/codex_cairn_helmet.geo.json'; s = open(p).read().replace('geometry.siege_codex_cairn_helmet', 'geometry.siege_codex_cairn_helm')
    open(A.RP + 'models/entity/armor/codex_cairn_helm.geo.json', 'w').write(s); os.remove(p)
    icons = [A.armour_icon('oathsworn', OATH, pc) for pc in A.PIECES]
    ch = A.armour_icon('cairn', CAIRN, 'helmet'); os.replace(T + 'items/codex/cairn_helmet.png', T + 'items/codex/cairn_helm.png'); icons.append(ch)
    icons += [icon(k, v) for k, v in ICONS.items()]
    C = 12; sh = Image.new('RGBA', (C * 72 + 8, ((len(icons) + C - 1) // C) * 72 + 8 + 80), (38, 34, 46, 255))
    for i, im in enumerate(icons): sh.alpha_composite(im.resize((64, 64), Image.NEAREST), (8 + (i % C) * 72, 8 + (i // C) * 72))
    y0 = ((len(icons) + C - 1) // C) * 72 + 12
    for k, pc in enumerate(A.PIECES): sh.alpha_composite(worn[pc].resize((128, 64), Image.NEAREST), (8 + k * 136, y0))
    sh.alpha_composite(cairn['helmet'].resize((128, 64), Image.NEAREST), (8 + 4 * 136, y0))
    sh.save(A.ROOT + 'art/codex-items.png'); print('codex art 2:', len(icons), 'icons')


if __name__ == '__main__':
    main()
