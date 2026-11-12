"""The six wonders as preview scenes for the 3D asset viewer.

    python3 wonder_scenes.py OUT   -> OUT/<id>/scene.json + OUT/names.json

Same minecraft-builder specs as export_wonders.py (map/structures/wonders/*.json); the game data comes from that.
"""
import os, sys, json, subprocess
from export_wonders import IDS, SPEC, SKILL, HERE

NAMES = {
    "great_lighthouse": "Wonder: Great Lighthouse (Saltreach)",
    "high_watch": "Wonder: High Watch (Vale)",
    "rimeforge_hall": "Wonder: Rimeforge Hall (Frostmarch)",
    "sun_gate": "Wonder: Sun Gate Caravanserai (Emberwaste)",
    "lantern_spire": "Wonder: Lantern Spire (Blackfen)",
    "great_horse_fair": "Wonder: Great Horse Fair (Vale)",
}

def main(out):
    os.makedirs(out, exist_ok=True)
    for wid in IDS:
        spec = os.path.join(HERE, "wonders", f"{SPEC.get(wid, wid)}.json")
        r = subprocess.run([sys.executable, SKILL, spec, os.path.join(out, wid)], capture_output=True, text=True)
        if r.returncode: print(wid, "failed:", r.stderr[-300:])
    json.dump(NAMES, open(os.path.join(out, "names.json"), "w"), indent=1)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "wonders", "out"))
