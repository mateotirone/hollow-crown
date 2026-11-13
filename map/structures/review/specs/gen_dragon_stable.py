"""Write the Dragon Stable as a building-skill spec (dragon_stable_emberwaste.json).

    python3 gen_dragon_stable.py

Mateo (2026-11-13): "There should be a custom building for settlements in emberwaste as a dragon stable. That's
also where there is an attached nursery. That's where the dragon hatching blocks are."

A kasbah stable (regions/emberwaste.md, preset ember_sandstone, flat roofs with vigas and a parapet):
  the stable hall  15 x 15, two storeys: a wide arched way in for a grown dragon, a 5-wide aisle, three big
                   stalls either side (straw, a water trough, a meat hook), the tack corner by the door, and a
                   loft upstairs (hay, the keeper's bunk, saddles). Its flat roof is the landing terrace.
  the nursery      7 x 11, joined on the east, one storey under a small blue-green dome: three Hatching
                   Braziers (siege:hatching_brazier) on a warm sand bed, where eggs are set to hatch.

Frame (settle_buildings.py): front faces south (+z), the front wall on z = 0, the Dragon Roost block just outside
the arch at (0, 1, 1). The furnishing is dragon_stable_skill.py (what the skill has no part for).
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}

HALL = [-7, -14, 7, 0]           # 15 x 15
NURSERY = [7, -12, 13, -2]       # 7 x 11, sharing the hall's east wall: the whole build is x -7..13 (21 wide)
DOME = [10, -7]                  # over the middle of the nursery
# Small deep windows (the region's rule): none low on the front (the arch is the front), two in the loft under
# awnings; high in each stall's back wall; the loft lit from both sides and the back.
W = lambda at, storey, h=2: {"at": at, "storey": storey, "w": 1, "h": h}
WINDOWS = {"s": [W(-5, 1), W(5, 1)], "w": [W(-4, 0), W(0, 0), W(4, 0), W(-4, 1), W(4, 1)],
           "e": [W(-4, 1), W(4, 1)], "n": [W(-4, 0), W(4, 0), W(-4, 1), W(4, 1)]}

def spec():
    style = {"base": "ember_sandstone", "roof": "smooth_sandstone"}
    flat = {"type": "flat", "parapet": "crenel", "beams": "stripped_acacia_log"}
    hall = {"part": "house", "style": style, "rect": HALL, "y": 0, "plinth": 1, "storeys": [6, 5],
            "door": {"side": "n", "kind": "house", "steps": 1}, "roof": flat, "windows": WINDOWS, "chimney": False, "shutters": 0, "interior": False,
            "bushes": False,
            "wings": [{"rect": NURSERY, "storeys": [6], "roof": {"type": "flat", "parapet": "slab", "beams": "stripped_acacia_log"}}]}
    dome = {"part": "dome", "at": DOME, "r": 2.5, "drum": {"h": 2, "windows": 4, "glass": "orange_stained_glass_pane"}, "finial": "gold"}
    return {
        "name": "dragon_stable_emberwaste",
        "card": {"title": "Dragon Stable", "sub": "Emberwaste, stable hall and nursery", "region": "emberwaste",
                 "where": "Emberwaste settlements, raised by the Dragon Roost block", "kind": "Work",
                 "blurb": "A kasbah stable for dragons: a wide arched way in, six big stalls off a broad aisle, a tack corner "
                          "and a hay loft, and a flat roof to land on. The nursery joined on the east, under a small blue-green "
                          "dome, holds three Hatching Braziers where eggs are set to hatch."},
        "after": "dragon_stable_skill:inside",
        "parts": [hall, dome],
    }

if __name__ == "__main__":
    open(os.path.join(HERE, "dragon_stable_emberwaste.json"), "w").write(json.dumps(spec(), indent=1))
    print("wrote dragon_stable_emberwaste.json")
