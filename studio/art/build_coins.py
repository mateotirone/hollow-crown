"""Coin icons for the economy (currency thread, 2026-11-10): the everyday iron coin and the gold coin worth 64,
both struck with the old king's crowned head in profile. Run: python3 build_coins.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from palette import M
OUT = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/items/'
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
if __name__ == '__main__':
    coin(M['iron']).save(OUT + 'siege_coin.png'); coin(M['gold']).save(OUT + 'siege_gold_coin.png')
    a = Image.new('RGBA', (34, 16), (40, 34, 48, 255)); a.alpha_composite(coin(M['iron']), (0, 0)); a.alpha_composite(coin(M['gold']), (18, 0))
    a.resize((340, 160), Image.NEAREST).save('/mnt/project-files/siege-nights/art/coins.png')
