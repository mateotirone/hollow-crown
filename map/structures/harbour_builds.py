"""Gull's Rest harbour buildings for the asset viewer and the build catalogue: the lighthouse, the boathouse and
the harbourmaster's hut, built with the minecraft-builder skill from harbour_specs/ (Saltreach style; the town
places them with harbour.py).

    python3 map/structures/harbour_builds.py OUT     -> OUT/<name>/scene.json for each, OUT/names.json
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")
NAMES = {"lighthouse": "Gull's Rest lighthouse (Saltreach)", "boathouse": "Gull's Rest boathouse, slip open to the sea (Saltreach)",
         "harbourmaster": "Gull's Rest harbourmaster's hut (Saltreach)"}

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for n in NAMES:
        subprocess.run([sys.executable, BUILD, os.path.join(HERE, "harbour_specs", n + ".json"), os.path.join(out, n), "--no-preview"], check=True, stdout=subprocess.DEVNULL)
    json.dump(NAMES, open(os.path.join(out, "names.json"), "w"), indent=1)
    print("built", ", ".join(NAMES))
