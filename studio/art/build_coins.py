"""Coin icons for the economy (currency thread, 2026-11-10): the everyday iron coin and the gold coin worth 64,
both struck with the old king's crowned head in profile, plus the 8x8 menu coin (textures/ui/hc/coin.png) for the menu skin.
The name Regal is confirmed by Mateo (2026-11-10).   Run: python3 build_coins.py [repo root]"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M
ROOT = (sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/siege-nights').rstrip('/') + '/'
OUT = ROOT + 'Siege_Nights_RP/textures/items/'
G = ['................',
     '.....oooooo.....',
     '...ooLLLLLLoo...',
     '..oLLcmcmcmMMo..',
     '..oLmcccccmmMo..',
     '.oLmshhhhhmmmMo.',
     '.oLmshhhhshmmMo.',
     '.oLmshhhhhhhmMo.',
     '.oLmshhhhhhmmMo.',
     '.oLmmshhhshmmMo.',
     '.oLmmmshhhmmdMo.',
     '..oMmhhhmmmdDo..',
     '..oMhhhhhmdDDo..',
     '...ooDDDDDDoo...',
     '.....oooooo.....',
     '................']
def coin(r):
    k = {'o': r[0], 'L': r[4], 'M': r[2], 'D': r[1], 'm': r[2], 'd': r[1], 'h': r[5], 'c': r[4], 's': r[1]}
    im = Image.new('RGBA', (16, 16))
    for y, row in enumerate(G):
        for x, ch in enumerate(row):
            if ch != '.': im.putpixel((x, y), tuple(k[ch][:3]) + (255,))
    return im
# The menu coin: the same Regal at 8x8 (rim, lit edge, a crowned head in profile)
U = ['..oooo..',
     '.oLcLco.',
     'oLmhhmMo',
     'oLshhhMo',
     'oLmshhMo',
     'oLmshdMo',
     '.oMhhDo.',
     '..oooo..']
def ui_coin(r):
    k = {'o': r[0], 'L': r[4], 'M': r[2], 'D': r[1], 'm': r[2], 'd': r[1], 'h': r[5], 'c': r[4], 's': r[1]}
    im = Image.new('RGBA', (8, 8))
    for y, row in enumerate(U):
        for x, ch in enumerate(row):
            if ch != '.': im.putpixel((x, y), tuple(k[ch][:3]) + (255,))
    return im
if __name__ == '__main__':
    ui_coin(M['iron']).save(ROOT + 'Siege_Nights_RP/textures/ui/hc/coin.png')
    coin(M['iron']).save(OUT + 'siege_coin.png'); coin(M['gold']).save(OUT + 'siege_gold_coin.png')
    a = Image.new('RGBA', (34, 16), (40, 34, 48, 255)); a.alpha_composite(coin(M['iron']), (0, 0)); a.alpha_composite(coin(M['gold']), (18, 0))
    a.resize((340, 160), Image.NEAREST).save(ROOT + 'art/coins.png')
