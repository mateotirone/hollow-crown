"""Gull's Rest harbour buildings for the asset viewer and the build catalogue: the lighthouse, the boathouse and
the harbourmaster's hut, the deep-water pier with the great ship, built with the minecraft-builder skill from harbour_specs/ (Saltreach style; the town
places them with harbour.py).

    python3 map/structures/harbour_builds.py OUT     -> OUT/<name>/scene.json for each, OUT/names.json
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")
NAMES = {"lighthouse": "Gull's Rest lighthouse (Saltreach)", "boathouse": "Gull's Rest boathouse, slip open to the sea (Saltreach)",
         "harbourmaster": "Gull's Rest harbourmaster's hut (Saltreach)",
         "great_ship": "Gull's Rest deep-water pier and the great ship moored at it (Saltreach)"}
SEA_UNDER = {"great_ship": (-8, 0)}       # shown on its sea: water rows under the waterline, down to a gravel bed

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for n in NAMES:
        subprocess.run([sys.executable, BUILD, os.path.join(HERE, "harbour_specs", n + ".json"), os.path.join(out, n), "--no-preview"], check=True, stdout=subprocess.DEVNULL)
    for n, (lo, hi) in SEA_UNDER.items():                  # the ship sits in the sea: show the water round it
        f = os.path.join(out, n, "scene.json"); d = json.load(open(f))
        taken = {(x, y, z) for x, y, z, _ in d["blocks"]}
        xs = [b[0] for b in d["blocks"]]; zs = [b[2] for b in d["blocks"]]
        d["palette"] += [["water", {}], ["gravel", {}]]; wi, gi = len(d["palette"]) - 2, len(d["palette"]) - 1
        for x in range(min(xs) - 3, max(xs) + 4):
            for z in range(min(zs) - 3, max(zs) + 4):
                if (x, lo - 1, z) not in taken: d["blocks"].append([x, lo - 1, z, gi])
                for y in range(lo, hi + 1):
                    if (x, y, z) not in taken: d["blocks"].append([x, y, z, wi])
        json.dump(d, open(f, "w"))
    json.dump(NAMES, open(os.path.join(out, "names.json"), "w"), indent=1)
    print("built", ", ".join(NAMES))
