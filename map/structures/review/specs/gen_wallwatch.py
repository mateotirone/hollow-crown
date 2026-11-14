"""Write the wall watchtower as building-skill specs, one per region (wallwatch_<region>.json).

    python3 gen_wallwatch.py

Mateo (2026-11-13): "Build small watchtowers for the guards at the wall in the first wall level". The settlement wall's
first levels (Low Palisade to Battlement Wall) have no towers of their own, so four small watchtowers stand astride the
wall line, where the Watch Wall's stone towers will one day stand (settle/walls.js raises them with the wall). A guard
keeps the lookout of each one (guardposts/posts.js, posts "watch:<n>").

Each tower follows build-instructions/towers/README.md at the small end of its table:
  base     plinth 1, the door on the inside face, no window below the first floor (watch tower rule)
  shaft    5 x 5, two storeys of 5 (stone ground storey, the region's timber or stone above), slits up top
  courses  a string course at the first floor line
  top      an open lookout one block out all round on corbels (an upside-down stair ring), arched on every face, a
           fence rail between the piers for the guard to lean on; Emberwaste: crenels on corbels instead
  roof     the region's tower roof (towers/README section 5): Vale steep slate helm, Frostmarch steep snowy spire,
           Saltreach low sea-green hip, Blackfen dark shingle hood with a lantern under it, Emberwaste flat with
           corner horns and a gold finial
  inside   the skill's "tower" use: ladder up both storeys to a hatch in the lookout deck, lit

Frame (like the Storehouse): the door faces south (+z) on the front wall z = 0, the shaft is x -2..2, z -4..0, the
ground floor walked at y 1 (plinth 1). The lookout deck is at y 10 (the shaft's roof layer, with the hatch), the guard stands on it at feet height 11.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

SHAFT = [-2, -4, 2, 0]
TOP = [-3, -5, 3, 1]          # the lookout, one out all round
DECK = 10                     # plinth 1 + two storeys of 5: the shaft's flat roof layer is the lookout's deck (the hatch stays in it)
STOREYS = [5, 5]

def noise(*blocks, scale=3): return {"ladder": list(blocks), "axis": "noise", "scale": scale}

R = {
    "vale": dict(
        style={"base": "vale_timber", "frame": "stripped_spruce_log"},
        ground={"frame_kind": "stone", "frame": "stone_bricks", "infill": {"ladder": "VAL-01", "axis": "y"}},
        course="stone_brick_stairs", corbel="spruce_stairs", pier="spruce_fence", deck="spruce_planks", trim="dark_oak_planks",
        rail="spruce_fence", cap=dict(cap="spire", rows=3, roof={"block": "deepslate_tiles"}, finial="spire_block")),
    "frostmarch": dict(
        style={"base": "frost_timber"},
        ground={"frame_kind": "stone", "frame": "deepslate_bricks", "infill": noise("cobbled_deepslate", "polished_deepslate")},
        course="deepslate_brick_stairs", corbel="dark_oak_stairs", pier="dark_oak_fence", deck="dark_oak_planks", trim="dark_oak_planks",
        rail="dark_oak_fence", snow=True, cap=dict(cap="spire", rows=3, roof={"block": "deepslate_tiles"}, finial="rod")),
    "saltreach": dict(
        style={"base": "salt_timber"},
        ground={"frame_kind": "stone", "frame": "cut_sandstone", "infill": noise("smooth_sandstone", "sandstone")},
        course="smooth_sandstone_stairs", corbel="birch_stairs", pier="birch_fence", deck="birch_planks", trim="birch_planks",
        rail="birch_fence", cap=dict(cap="hip", roof={"block": "dark_prismarine"}, finial="short")),
    "blackfen": dict(
        style={"base": "fen_timber"}, piles=True,
        ground={"frame_kind": "stone", "frame": "tuff_bricks", "infill": noise("mud_bricks", "packed_mud", scale=2)},
        course="tuff_brick_stairs", corbel="mangrove_stairs", pier="mangrove_fence", deck="mangrove_planks", trim="dark_oak_planks",
        rail="mangrove_fence", hood=True, cap=dict(cap="hip", roof={"block": "dark_oak_planks"}, finial="short")),
    "emberwaste": dict(
        style={"base": "ember_sandstone"}, flat=True,
        ground={}, course="smooth_sandstone_stairs", corbel="cut_sandstone", horn="cut_sandstone"),
}
NAMES = {"vale": "Vale", "frostmarch": "Frostmarch", "saltreach": "Saltreach", "emberwaste": "Emberwaste", "blackfen": "Blackfen"}

def ring(rect):
    x0, z0, x1, z1 = rect
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            if x in (x0, x1) or z in (z0, z1): yield x, z

def slits():
    # 1 x 2 slits in the upper storey only (no window below the first floor on a watch tower), none on the door face
    return {sd: [{"at": 0, "storey": 1, "w": 1, "h": 2, "sill": "none"}] for sd in ("n", "e", "w")} | {"s": []}

def spec(region):
    g = R[region]
    place = []
    house = {"part": "house", "style": g["style"], "rect": SHAFT, "y": 0, "plinth": 1, "storeys": STOREYS,
             "storey_style": [g["ground"], {}] if g["ground"] else [],
             "door": {"side": "s", "kind": "house", "steps": 0, "canopy": False},
             "windows": slits(), "shutters": 0,
             "roof": {"type": "flat", "hatch": False, "beams": False, "parapet": "crenel" if g.get("flat") else "none"},
             "chimney": False, "bushes": False, "vines": 0.04 if region in ("vale", "blackfen") else 0,
             "interior": {"use": "tower", "hatch": True}}
    if g.get("piles"): house["piles"] = True
    parts = [house, {"part": "string_course", "rect": SHAFT, "y": 1 + STOREYS[0] - 1, "sides": "nsew", "material": g["course"]}]
    if g.get("flat"):
        # Emberwaste: no pitched roof (towers/README section 5). Crenels on a corbel ring, the four corners rising as horns,
        # a gold finial on the north-east horn.
        x0, z0, x1, z1 = SHAFT
        for x, z in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)):
            for y in (DECK + 1, DECK + 2, DECK + 3): place.append([x, y, z, g["horn"]])
        place.append([x1, DECK + 4, z0, "gold_block"])
    else:
        # the corbel ring under the lookout's overhang, then the open lookout itself
        parts.append({"part": "string_course", "rect": SHAFT, "y": DECK - 1, "sides": "nsew", "material": g["corbel"]})
        bel = {"part": "belfry", "rect": TOP, "y": DECK, "h": 3, "pier": g["pier"], "deck": g["deck"], "trim": g["trim"],
               "bell": False, "louvres": False, "cap_trim": g["trim"]}
        bel.update(g["cap"])
        parts.append(bel)
        # a rail between the piers, kept clear over the ladder's hatch side (the guard climbs out on the deck inside it)
        x0, z0, x1, z1 = TOP
        for x, z in ring(TOP):
            if (x, z) in ((x0, z0), (x1, z0), (x0, z1), (x1, z1)): continue
            place.append([x, DECK + 1, z, g["rail"]])
        # a lantern hung under the roof in the middle, where it lights the deck and shows from the fields
        place.append([0, DECK + 3, -2, "lantern", {"hanging": True}])
    roof_snow = g.get("snow")
    out = {
        "name": f"wallwatch_{region}",
        "card": {"title": "Wall watchtower", "sub": f"{NAMES[region]}", "region": region,
                 "where": "Every settlement wall from the Palisade (level 2) to the Battlement Wall: four astride the wall line (the Low Palisade gets lookout stands)",
                 "kind": "Defence",
                 "blurb": "A small two-storey tower with an open lookout on corbels and the region's tower roof; "
                          "a ladder inside climbs to the deck, where a guard keeps watch."},
        "parts": parts,
        "place": place,
    }
    if roof_snow: out["snow"] = True
    return out

# ---------- the lookout stand: the Low Palisade's watch post (Mateo, 2026-11-14: the towers are "too big for a level one
# wall", which is 2 high) ----------
# A 3 x 3 open stand on four corner posts and a middle post: a ladder up the middle post's front to a hatch, a railed deck
# for one guard (feet at y 5, three over the palisade), a little roof of the region's on the corner posts. Frame as the
# tower: the ladder side faces south (+z, into the settlement) on z = 0, the stand is x -1..1, z -2..0, its pad at y 0.
STAND = dict(deck=4, top=6)
S = {   # post log, deck planks, rail fence, trapdoor, roof stairs (or None: a flat canopy of slabs), roof block
    "vale": ("stripped_spruce_log", "spruce_planks", "spruce_fence", "spruce_trapdoor", "deepslate_tile_stairs", "deepslate_tiles", "cobblestone"),
    "frostmarch": ("stripped_dark_oak_log", "dark_oak_planks", "dark_oak_fence", "dark_oak_trapdoor", "deepslate_tile_stairs", "deepslate_tiles", "cobbled_deepslate"),
    "saltreach": ("stripped_birch_log", "birch_planks", "birch_fence", "birch_trapdoor", "dark_prismarine_stairs", "dark_prismarine", "smooth_sandstone"),
    "blackfen": ("mangrove_log", "mangrove_planks", "mangrove_fence", "mangrove_trapdoor", "dark_oak_stairs", "dark_oak_planks", "packed_mud"),
    "emberwaste": ("stripped_acacia_log", "acacia_planks", "acacia_fence", "acacia_trapdoor", None, "smooth_sandstone", "sandstone"),
}

def stand_spec(region):
    log, plank, rail, trap, stairs, roofb, pad = S[region]
    D, T = STAND["deck"], STAND["top"]
    place = []
    for x in (-1, 0, 1):
        for z in (-2, -1, 0): place.append([x, 0, z, pad])                      # a pad under it all
    for x, z in ((-1, -2), (1, -2), (-1, 0), (1, 0)):
        for y in range(1, D + 1): place.append([x, y, z, log, {"axis": "y"}])    # corner posts up to the deck,
        for y in range(D + 1, T + 1): place.append([x, y, z, rail])             # fence posts above it, so the lookout stays open
    for y in range(1, D): place.append([0, y, -1, log, {"axis": "y"}])           # the middle post the ladder climbs
    for y in range(1, D): place.append([0, y, 0, "ladder", {"facing": "s"}])
    for x in (-1, 0, 1):
        for z in (-2, -1, 0):
            if (x, z) in ((-1, -2), (1, -2), (-1, 0), (1, 0)): continue
            place.append([x, D, z, trap, {"half": "top", "open": False, "facing": "n"}] if (x, z) == (0, 0) else [x, D, z, plank])
    for x, z in ((0, -2), (-1, -1), (1, -1)): place.append([x, D + 1, z, rail])  # the rail round the guard (the hatch side open)
    # braces under the deck: an upside-down stair out from each post under the deck's edge
    place += [[0, D - 1, -2, plank.replace("planks", "stairs"), {"facing": "s", "half": "top"}],
              [-1, D - 1, -1, plank.replace("planks", "stairs"), {"facing": "e", "half": "top"}],
              [1, D - 1, -1, plank.replace("planks", "stairs"), {"facing": "w", "half": "top"}]]
    # the roof: a little pyramid on the four posts (stairs on the edges, the region's block on the corners), a full
    # block in the middle and the spire top on it
    R = T + 1
    if stairs:
        for x in (-1, 0, 1):
            for z in (-2, -1, 0):
                if (x, z) == (0, -1): place.append([x, R, z, roofb]); continue
                if x != 0 and z != -1: place.append([x, R, z, roofb]); continue
                f = "e" if x == -1 else "w" if x == 1 else "s" if z == -2 else "n"
                place.append([x, R, z, stairs, {"facing": f, "half": "bottom"}])
        place.append([0, R + 1, -1, "siege:spire_roof"])
    else:   # Emberwaste: a flat sandstone canopy with a parapet lip, no pitch
        for x in (-1, 0, 1):
            for z in (-2, -1, 0): place.append([x, R, z, roofb])
        for x, z in ((-1, -2), (1, -2), (-1, 0), (1, 0)): place.append([x, R + 1, z, "sandstone_wall"])   # little horns
        place.append([1, R + 2, -2, "gold_block"])
    place.append([-1, D + 2, -1, "lantern", {"hanging": False}])               # a lantern on the rail post beside the guard (the light stage adds more where needed)
    out = {"name": f"wallstand_{region}",
           "card": {"title": "Lookout stand", "sub": NAMES[region], "region": region,
                    "where": "The Low Palisade (wall level 1): four astride the wall line, where the watchtowers rise at level 2",
                    "kind": "Defence",
                    "blurb": "A small open stand on log posts: a ladder up the middle to a hatch, a railed deck for one guard "
                             "three blocks over the palisade, and a little roof."},
           "place": place}
    if region == "frostmarch": out["snow"] = True
    return out

if __name__ == "__main__":
    for region in R:
        open(os.path.join(HERE, f"wallwatch_{region}.json"), "w").write(json.dumps(spec(region), indent=1))
        open(os.path.join(HERE, f"wallstand_{region}.json"), "w").write(json.dumps(stand_spec(region), indent=1))
    print("wrote", 2 * len(R), "specs")
