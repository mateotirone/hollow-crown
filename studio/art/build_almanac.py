"""The Settler's Almanac item icon (16x16): a squat green cloth-bound book, gilt corners and a gilt
compass rose on the cover, cream page edges. Run: python3 build_almanac.py (writes into the repo's RP)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from palette import M, ramp
from texlib import *

OUT = os.path.join(HERE, '..', '..', 'Siege_Nights_RP', 'textures', 'items', 'siege_almanac.png')
GREEN = ramp('#3f6a3a', 0.08, 0.60)
G, P, C = M['gold'], M['parchment'], M['coal']
LEG = {'k': R(C, 1), 'o': R(GREEN, 0), 'd': R(GREEN, 1), 'm': R(GREEN, 2), 'l': R(GREEN, 3), 'h': R(GREEN, 4),
       'g': R(G, 2), 'G': R(G, 4), 'y': R(G, 1), 'p': R(P, 4), 'q': R(P, 2), 'r': R(P, 1)}
ROWS = ["................",
        "................",
        "..kkkkkkkkkkk...",
        "..kGgmmmmmmgGk..",
        "..kgmmmmGmmmgkk.",
        "..kmmmmmGmmmmkpk",
        "..kmmmmGGGmmmkqk",
        "..kmmGGGyGGGmkpk",
        "..kmmmmGGGmmmkqk",
        "..kmmmmmGmmmmkpk",
        "..kmhmmmGmmmdkqk",
        "..kgmmmmmmmmgkpk",
        "..kGgddddddgGkrk",
        "...kkkkkkkkkkkkk",
        "................",
        "................"]
t = Tex()
for y, row in enumerate(ROWS):
    for x, ch in enumerate(row):
        if ch in LEG: t.set(x, y, LEG[ch])
t.save(OUT)
print('wrote', os.path.normpath(OUT))
