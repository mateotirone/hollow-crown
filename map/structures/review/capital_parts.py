"""The capital hall's drum, dome and forecourt, laid on the skill's shell (spec kingsrest_capital.json, "after").
The shell (centre block, entrance pavilion, wings, corner towers) is the skill's; these round parts and the
garden are shapes the skill has no part for yet, so they come from capital.py unchanged."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from kit import Building, VALE  # noqa: F401  (Building and P are what the catalogue's "after" hook expects)
import capital
P = dict(VALE)

def drum_dome(bp, B, seed=7):
    for (x, z) in capital.disc(7.5):               # clear the roof where the drum stands (no ring of sky round it)
        for y in range(13, 30): bp.set(x, y, z, "air")
    capital.drum(bp, 0, 0, 13, 7, 7, "stripped_birch_log", "dark_oak_planks", "dark_oak_stairs", seed)
    capital.drum(bp, 0, 0, 21, 4, 5.5, "stripped_birch_log", "dark_oak_planks", "dark_oak_stairs", seed)
    capital.dome(bp, 0, 0, 26, 6, rise=1.45, seed=seed)
    capital.gardens(bp, seed)
    for x in (-12, 12):                            # lamp posts either side of the forecourt
        for y in range(1, 4): bp.set(x, y, 17, "dark_oak_fence")
        bp.set(x, 4, 17, "lantern")
