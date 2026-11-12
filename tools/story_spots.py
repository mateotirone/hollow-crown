#!/usr/bin/env python3
"""Where the story's town characters stand and where the town Dusty Tomes lie: picks street spots from the baked
town files, the same way the townsfolk get theirs (tools/townsfolk_spots.py), but past the townsfolk's own spots.

    python3 tools/story_spots.py            reads map/<town>-blocks.json, writes Siege_Nights_BP/scripts/lore/story_spots_data.js
    python3 tools/story_spots.py DIR        reads DIR/<town>/<town>-blocks.json instead where there is one (a fresh towngen bake)

The townsfolk tool spreads its spots out from the square, each as far as possible from the ones before. This tool
asks for more of the same spread and keeps only the extra ones, so a story character never stands on a townsperson's
spot. Each character then takes the extra spot that best fits the place their dialogue names (the lowest street in
Gull's Rest for the lighthouse keeper, the street nearest the frozen lake in Rimehold, and so on), and each named
tome takes one of what is left.

Re-run this whenever a town's blocks file changes (after tools/townsfolk_spots.py), then commit the new file.
The game checks each spot on the spot and steps aside if something now stands there.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import townsfolk_spots as TF  # noqa: E402

ROOT = TF.ROOT
EXTRA = 14  # extra spots asked for in each town, past the townsfolk's own

# Who stands in which town, and how to pick their street (key: lower sorts first). "near:<id>" = closest to that
# character's spot. Characters are picked in this order, so a later one never takes an earlier one's spot.
# "in:x,y,z" = inside the building their dialogue names, at that air cell (the floor is the block under it). These
# come from the baked towns (project files siege-nights/towngen/, towns thread 2026-11-12), not from the street
# spots, and take none of them. Re-check them whenever the towns are baked again.
PEOPLE = [
    # Gull's Rest: the lighthouse keeper in the lighthouse, the harbourmistress in the harbour office, the girl on the
    # sea wall on the lowest street
    ("elias", "Gull's Rest", "in:-949,65,402"),   # the lighthouse, ground floor
    ("tilly", "Gull's Rest", "low"),
    ("ottilie", "Gull's Rest", "in:-914,65,388"), # the harbour office
    ("pip", "Gull's Rest", "near:tilly"),        # Tilly's little brother (a villager: the Returned case)
    # Rimehold: Sigrun's longhouse and Jorund's net sheds both face the frozen lake (Hallowmere, north-east)
    ("sigrun", "Rimehold", "in:-90,116,-1114"),   # the longhouse nearest Hallowmere
    ("jorund", "Rimehold", "in:-19,115,-1095"),   # the net sheds, on the street nearest the lake
    ("bram", "Rimehold", "near:jorund"),          # Jorund's father
    # Sunscar: the warden's office on the avenue of statues
    ("isolde", "Sunscar", "in:891,95,445"),       # the warden's office
    # Millbrook: the bakery
    ("nessa", "Millbrook", "in:-41,82,-480"),     # the bakery
    ("harl", "Millbrook", "near:nessa"),          # her husband, at the ovens
    # Mirelight: the last house before the lanterns stop
    ("hesper", "Mirelight", "in:-4,75,892"),  # by the Fen Line's east gate, past the last lamp
    ("odo", "Mirelight", "near:hesper"),          # her husband, cutting reeds out back
]

# Tomes whose page says they lie in one of the six towns (lore/data/tomes_*.js `where`), in the order they take spots
TOWN_TOMES = [
    ("chron_01", "Millbrook"), ("test_01", "Millbrook"), ("test_03", "Millbrook"),
    ("chron_05", "Rimehold"), ("corv_02", "Rimehold"), ("test_05", "Rimehold"),
    ("corv_04", "Gull's Rest"), ("lett_01", "Gull's Rest"), ("lett_02", "Gull's Rest"), ("lett_03", "Gull's Rest"),
    ("lett_04", "Gull's Rest"), ("lett_07", "Gull's Rest"), ("test_06", "Gull's Rest"),
    ("test_07", "Sunscar"),
    ("test_10", "Kingsrest"),
]


def main():
    centres = TF.wards()
    extras = {}
    for stem, (name, count) in TF.TOWNS.items():
        path = os.path.join(ROOT, "map", f"{stem}-blocks.json")
        if len(sys.argv) > 1 and os.path.exists(os.path.join(sys.argv[1], stem, f"{stem}-blocks.json")):
            path = os.path.join(sys.argv[1], stem, f"{stem}-blocks.json")
        spots = TF.spots_for(path, count + EXTRA, centres[name]) if os.path.exists(path) else []
        extras[name] = spots[count:]
        print(f"{name}: {len(extras[name])} extra spots")

    people = {}
    for npc, town, how in PEOPLE:
        if how.startswith("in:"):
            x, y, z = map(int, how[3:].split(","))
            people[npc] = {"town": town, "at": [x, y - 1, z], "indoors": True}   # at = the floor block, as for streets
            continue
        free = extras[town]
        if not free:
            raise SystemExit(f"{town}: no free street left for {npc}")
        cx, cz, _ = centres[town]
        d2 = lambda s, x, z: (s[0] - x) ** 2 + (s[2] - z) ** 2
        if how == "low":
            key = lambda s: (s[1], d2(s, cx, cz))
        elif how == "northeast":
            key = lambda s: -(s[0] - cx) + (s[2] - cz)
        elif how == "centre":
            key = lambda s: d2(s, cx, cz)
        elif how == "far":
            key = lambda s: -d2(s, cx, cz)
        else:
            other = people[how.split(":")[1]]["at"]
            key = lambda s: d2(s, other[0], other[2])
        best = min(free, key=key)
        free.remove(best)
        people[npc] = {"town": town, "at": best}

    tomes = {}
    for tome, town in TOWN_TOMES:
        free = extras[town]
        if not free:
            raise SystemExit(f"{town}: no free street left for {tome}")
        tomes[tome] = free.pop(0)

    out = os.path.join(ROOT, "Siege_Nights_BP/scripts/lore/story_spots_data.js")
    with open(out, "w") as f:
        f.write("// Made by tools/story_spots.py from map/<town>-blocks.json. Do not edit by hand: re-run the tool.\n")
        f.write("// STORY_PEOPLE: character id -> { town, at: [x, y, z] }   (y = the paving block; they stand on top)\n")
        f.write("// TOWN_TOME_SPOTS: tome id -> [x, y, z]                    (the Dusty Tome lies on top of that block)\n")
        f.write("export const STORY_PEOPLE = " + json.dumps(people, separators=(",", ":")) + ";\n")
        f.write("export const TOWN_TOME_SPOTS = " + json.dumps(tomes, separators=(",", ":")) + ";\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
