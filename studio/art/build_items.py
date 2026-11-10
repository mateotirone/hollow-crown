"""Final-style item icons (16x16). Hand-placed pixel grids, coloured from the shared palette.
Run: python3 build_items.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import M
from texlib import *

TI = '/mnt/project-files/siege-nights/Siege_Nights_RP/textures/items/'
S, I, G, L, P, W, D = M['steel'], M['iron'], M['gold'], M['leather'], M['parchment'], M['oak'], M['dark_oak']
RED, BS = M['blood_red'], M['blacksteel']

def grid(rows, legend, name):
    t = Tex()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in legend: t.set(x, y, legend[ch])
    t.save(TI + name + '.png'); return t

def diag_sword(name, blade, guard, grip, pommel, length=9):
    t = Tex(); n = 15
    for i in range(5, 5 + length):                     # blade along the diagonal, lit upper-left edge
        x, y = i, n - i
        t.set(x, y, R(blade, 4)); t.set(x - 1, y, R(blade, 5)); t.set(x, y + 1, R(blade, 2))
    tip = 5 + length; t.set(tip, n - tip, R(blade, 5))
    t.set(5, 11, R(blade, 3))
    for k in range(-2, 3): t.set(4 + k, 11 + k, R(guard, 4 if k < 0 else 3 if k == 0 else 2))  # crossguard
    t.set(1, 13, R(guard, 2)); t.set(6, 13, R(guard, 2)) if False else None
    for i in (2, 3): t.set(i, n - i - 1 + 1, R(grip, 3 if i == 3 else 2)); t.set(i + 1, n - i + 1, R(grip, 1))
    t.set(1, 14, R(pommel, 4)); t.set(2, 14, R(pommel, 2)); t.set(1, 13, R(pommel, 3)) if False else None
    outline_alpha(t, R(blade, 0)); t.save(TI + name + '.png'); return t

diag_sword('siege_longsword', S, G, L, G, length=9)

def warhammer():
    t = Tex()
    for i in range(1, 10):                              # haft
        x, y = i, 15 - i; t.set(x, y, R(W, 3)); t.set(x + 1, y, R(W, 1))
    for (x, y) in [(2, 13), (3, 12)]: t.set(x, y, R(L, 3))   # leather grip wrap
    t.set(4, 11, R(L, 2))
    head = [".oooooo..", "ollllmdo.", "olmmmmdoo", "olmmmmddo", "olmmmmddo", "odddddddo", "ooooooooo"]
    leg = {'o': R(S, 0), 'l': R(S, 5), 'm': R(S, 3), 'd': R(S, 1)}
    for j, row in enumerate(head):
        for i2, ch in enumerate(row):
            if ch in leg: t.set(7 + i2, 1 + j, leg[ch])
    
    t.set(10, 4, R(G, 4)); t.set(11, 4, R(G, 3))
    outline_alpha(t, R(D, 0)); t.save(TI + 'siege_warhammer.png')
warhammer()

O = R(L, 0)
grid(["................",
      "..........ooooo.",
      ".........obbbBho",
      "........obbBBdho",
      "........obBBBdho",
      ".......ogggGGoo.",
      "......obbBBdo...",
      ".....obbBBdo....",
      "....obbBBdo.....",
      "...ogggGGo......",
      "..obBBdo........",
      ".obBdo..........",
      ".oggo...........",
      ".oo.............",
      "................",
      "................"],
     {'o': O, 'b': R(P, 5), 'B': R(P, 3), 'd': R(P, 1), 'g': R(G, 4), 'G': R(G, 2), 'h': R(L, 1)}, 'siege_war_horn')

grid(["................",
      "..oooooooooooo..",
      ".obbbbbbbbbbbBo.",
      ".oBddddddddddBo.",
      "..obbbbbbbbbBo..",
      "..obkkkkkkkbBo..",
      "..obbbbbbbbbBo..",
      "..obkkkkkkbbBo..",
      "..obbbbbbbbbBo..",
      "..obkkkkbbrrro..",
      "..obbbbbbrRRRro.",
      ".oooooooorRrRro.",
      ".obbbbbbbrRRRro.",
      ".oBdddddddrrro..",
      "..oooooooooo....",
      "................"],
     {'o': R(P, 0), 'b': R(P, 4), 'B': R(P, 2), 'd': R(P, 1), 'k': R(M['coal'], 3), 'r': R(RED, 1), 'R': R(RED, 3)}, 'siege_writ')

# Castle Guard armour icons: steel with the red tabard (worn pieces take the banner colour)
AL = {'o': R(S, 0), 'l': R(S, 5), 'm': R(S, 3), 'd': R(S, 1), 'k': R(BS, 0), 'r': R(RED, 3), 'R': R(RED, 4), 'q': R(RED, 1),
      'g': R(G, 4), 'G': R(G, 2), 'h': R(L, 2), 'H': R(L, 1)}
grid(["................",
      ".......rr.......",
      "......rRrq......",
      "....oooroooo....",
      "...ollllmmmdo...",
      "..olllmmmmmddo..",
      "..olmmmmmmmddo..",
      "..okkkkkkkkkko..",
      "..olmmmgmmmddo..",
      "..olmmkgkmmddo..",
      "..olmmmgmmmddo..",
      "..oommmmmmmmoo..",
      "...oooooooooo...",
      "................",
      "................",
      "................"], AL, 'siege_guard_helmet')
grid(["................",
      "..oooo....oooo..",
      ".ollmmoooommddo.",
      ".olmmrRRRrrmmdo.",
      ".olmmrRggrqmmdo.",
      ".ooomrggggqmooo.",
      "...omrRggrqmo...",
      "...omrRggrqmo...",
      "...omrrrrrqmo...",
      "...ohhhGhhhHo...",
      "...omrrrrrqmo...",
      "...omrrrrrqmo...",
      "...omrrrrqqmo...",
      "...oooooooooo...",
      "................",
      "................"], AL, 'siege_guard_chestplate')
grid(["................",
      "................",
      "...oooooooooo...",
      "...ohhhGhhhHo...",
      "...olmmmmmmdo...",
      "...olmmoommdo...",
      "...olmo..omdo...",
      "...olmo..omdo...",
      "...olmo..omdo...",
      "...olgo..ogdo...",
      "...olmo..omdo...",
      "...olmo..omdo...",
      "...olmo..omdo...",
      "...oooo..oooo...",
      "................",
      "................"], AL, 'siege_guard_leggings')
grid(["................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "...oooo..oooo...",
      "...olmo..olmo...",
      "...olgo..olgo...",
      "...olmo..olmo...",
      "..ollmo.ollmo...",
      ".olmmmdoolmmmdo.",
      ".oddddddoddddddo",
      ".ooooooo.ooooooo",
      "................",
      "................"], AL, 'siege_guard_boots')

WL = {'o': R(D, 0), 'w': R(W, 4), 'W': R(W, 2), 'd': R(W, 1), 'h': R(L, 3), 'H': R(L, 1), 'i': R(I, 4), 'I': R(I, 2),
      'a': R(D, 2), 'A': R(D, 1), 'c': R(I, 3), 'r': R(M['rope'], 4), 's': R(M['rope'], 2), 'g': R(G, 4), 'b': R(S, 4)}
grid(["................",
      "................",
      "....oooooooo....",
      "...ohhhhhhhho...",
      "..ohhhhhhhhHHo..",
      "..oHHHHHHHHHHo..",
      "..oo.ow..wo.oo..",
      ".oooooooooooooo.",
      ".owwwwwwwwwwwiio",
      ".oWWWWWWWWWWWiIo",
      ".odddddddddddIIo",
      ".ooooooooooooooo",
      "..oaao....oaao..",
      "..oaAo....oaAo..",
      "...oo......oo...",
      "................"], WL, 'siege_battering_ram')
grid(["..oo............",
      ".oro............",
      ".os.o...........",
      "..oowo..........",
      "...owwo.........",
      "....owwo........",
      ".....owwo.......",
      "....oowcwo......",
      "...owo.owwoooo..",
      "..owo...owIiiio.",
      ".owo.....oIiIio.",
      ".owo.....oIIIIo.",
      "owwwwwwwwwwwwwwo",
      "oddddddddddddddo",
      "oaao........oaao",
      ".oo..........oo."], WL, 'siege_trebuchet')
grid(["................",
      ".oooo......oooo.",
      "owwWWo....oWWwwo",
      ".oooWWo..oWWooo.",
      "....oWWooWWo....",
      "...o.osbbso.o...",
      "..o...owwo...o..",
      "......owwo......",
      "......owwo......",
      ".....oowwoo.....",
      "....owdooowo....",
      "...owo....owo...",
      "..owo......owo..",
      ".owo........owo.",
      ".oo..........oo.",
      "................"], {**WL, 's': R(M['rope'], 5)}, 'siege_ballista')

# picked-up guard tokens: small standing figures
FL = {'o': R(BS, 0), 's': R(M['skin'], 3), 'S': R(M['skin'], 1), 'r': R(RED, 3), 'R': R(RED, 1), 'm': R(I, 3), 'M': R(I, 1), 'l': R(I, 5),
      'h': R(L, 3), 'H': R(L, 1), 'w': R(W, 4), 'W': R(W, 2), 'g': R(G, 4), 'b': R(M['rope'], 5), 'k': R(BS, 2), 'f': R(M['dark_oak'], 3)}
grid([".....oooo.......",
      "....orrrro..o...",
      "....orssSo..ow..",
      "....orsSSo..ob.w",
      "...oooRRooo.ob.w",
      "..ohhrrgrRHHob.w",
      "..osorrgrRoSob.w",
      "..osorrrrRoSob.w",
      "...oohhhhHoooboo",
      "....orrrrRo..ow.",
      "....okk.kko...o.",
      "....okk.kko.....",
      "....okk.kko.....",
      "....ofo.ofo.....",
      "....ooo.ooo.....",
      "................"], FL, 'siege_archer')
grid([".....oooo....o..",
      "....ommmMo..olo.",
      "....omllMo...m..",
      "....okssko...w..",
      "...oooSSooo..w..",
      "..ommrrgrRMo.w..",
      "..omorrgrRoo.w..",
      "..osorrgrRoswo..",
      "...oohhhhHooso..",
      "....orrrrRo.w...",
      "....omm.mMo.w...",
      "....omm.mMo.....",
      "....omm.mMo.....",
      "....ofo.ofo.....",
      "....ooo.ooo.....",
      "................"], FL, 'siege_man_at_arms')
print('items done')
