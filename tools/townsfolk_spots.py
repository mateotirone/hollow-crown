#!/usr/bin/env python3
"""Where the townsfolk of each map town live: picks street spots from the baked town files.

    python3 tools/townsfolk_spots.py            reads map/<town>-blocks.json, writes Siege_Nights_BP/scripts/townsfolk/spots_data.js

A spot is a paved street cell (a paving slab or path block laid by the town's groundwork) with open
sky above it and paving on at least three sides, so it is a real street, not a wall top or a doorstep. Spots are
then spread out (each new one as far as possible from the ones already picked, starting at the square), so the
townsfolk are scattered over the whole town, each wandering a few blocks round their own spot.

Re-run this whenever a town's blocks file changes (the town-layout thread regenerates them), then commit the
new spots_data.js. The game also checks each spot on the spot and steps aside if something now stands there.
"""
import json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS = {  # file stem -> (town name as in plots/config.js WARDS, how many townsfolk)
    "kingsrest": ("Kingsrest", 20),
    "millbrook": ("Millbrook", 10),
    "rimehold": ("Rimehold", 10),
    "gulls_rest": ("Gull's Rest", 10),
    "sunscar": ("Sunscar", 10),
    "mirelight": ("Mirelight", 10),
}
PAVING_WORDS = ("_slab", "gravel", "grass_path", "dirt_path")  # full blocks are plot pads and edges, not streets
NOT_PAVING = ("farmland", "wheat", "potatoes", "carrots", "beetroot", "water", "fence", "wall", "door", "air", "leaves", "log")
MIN_GAP = 9          # blocks between two townsfolk's spots
INNER = 0.85         # keep to this share of the town's radius: townsfolk live in the streets, not out by the fields
SKY_CLEAR = 6        # this many blocks above a spot must be empty


def paving(name):
    n = name.split(":")[-1]
    return any(w in n for w in PAVING_WORDS) and not any(w in n for w in NOT_PAVING)


def spots_for(path, count, centre):
    d = json.load(open(path))
    pal, blocks, g = d["palette"], d["blocks"], d["groundwork_blocks"]
    solid = {}                                   # (x, y, z) -> palette index of what stands there at the end
    for x, y, z, i in blocks:
        e = pal[i]
        if e["name"] == "minecraft:air":
            solid.pop((x, y, z), None)
        elif e.get("soft") and (x, y, z) in solid:
            continue
        else:
            solid[(x, y, z)] = i
    top = {}                                     # column -> highest groundwork cell still standing
    for x, y, z, _ in blocks[:g]:
        if (x, y, z) in solid and y >= top.get((x, z), -999):
            top[(x, z)] = y
    columns = {}
    for (x, z), y in top.items():
        if not paving(pal[solid[(x, y, z)]]["name"]):
            continue
        if any((x, y + k, z) in solid for k in range(1, SKY_CLEAR + 1)):
            continue
        columns[(x, z)] = y
    street = [(x, z) for (x, z) in columns
              if sum((x + dx, z + dz) in columns and abs(columns[(x + dx, z + dz)] - columns[(x, z)]) <= 1
                     for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3]
    if not street:
        return []
    cx, cz = centre[0], centre[1]
    inner = [c for c in street if (c[0] - cx) ** 2 + (c[1] - cz) ** 2 <= (INNER * centre[2]) ** 2]
    street = inner or street
    first = min(street, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cz) ** 2)
    picked, best = [first], {c: (c[0] - first[0]) ** 2 + (c[1] - first[1]) ** 2 for c in street}
    while len(picked) < count:
        c, far = max(best.items(), key=lambda kv: (kv[1], -kv[0][0], -kv[0][1]))
        if far < MIN_GAP * MIN_GAP:
            break
        picked.append(c)
        for o in best:
            best[o] = min(best[o], (o[0] - c[0]) ** 2 + (o[1] - c[1]) ** 2)
    return [[x, columns[(x, z)], z] for x, z in picked]


def wards():
    """Town centres from plots/config.js WARDS, so the first spot is the one nearest the square."""
    src = open(os.path.join(ROOT, "Siege_Nights_BP/scripts/plots/config.js")).read()
    out = {}
    for name, _ in TOWNS.values():
        key = '{ name: "%s", x: ' % name
        at = src.index(key) + len(key)
        x = int(src[at:src.index(",", at)])
        zat = src.index("z: ", at) + 3
        rat = src.index("r: ", at) + 3
        out[name] = (x, int(src[zat:src.index(",", zat)]), int(src[rat:src.index(" ", rat)].rstrip("},")))
    return out


def main():
    centres = wards()
    data = {}
    for stem, (name, count) in TOWNS.items():
        path = os.path.join(ROOT, "map", f"{stem}-blocks.json")
        data[name] = spots_for(path, count, centres[name]) if os.path.exists(path) else []
        print(f"{name}: {len(data[name])} spots")
    out = os.path.join(ROOT, "Siege_Nights_BP/scripts/townsfolk/spots_data.js")
    with open(out, "w") as f:
        f.write("// Made by tools/townsfolk_spots.py from map/<town>-blocks.json. Do not edit by hand: re-run the tool.\n")
        f.write("// Town name -> [[x, y, z], ...]: the street cell each townsperson wanders round (y = the paving block).\n")
        f.write("export const TOWNSFOLK_SPOTS = " + json.dumps(data, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
