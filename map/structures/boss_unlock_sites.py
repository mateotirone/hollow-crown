"""The five boss unlock set pieces for the 3D viewer, read from the game's own plans.

The blocks come from Siege_Nights_BP/scripts/unlocks/plans.js and well_plan.js through boss_unlock_sites.mjs, so the
preview is exactly what the game builds on flat ground (`/scriptevent siege:unlock <site> here`). Each site also gets a
cut-away (east half removed) to see the rooms underground.

    python3 map/structures/boss_unlock_sites.py OUT
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bp import Blueprint, is_stairs, is_slab  # noqa: E402

FACE = {0: "e", 1: "w", 2: "s", 3: "n"}
CARD = {"north": "n", "south": "s", "east": "e", "west": "w"}


def logical(block, st):
    st = st or {}
    if block.startswith("siege:") or block.startswith("hc:"):
        p = {"raw": {k: v for k, v in st.items() if k != "minecraft:cardinal_direction"}}
        if "minecraft:cardinal_direction" in st: p["facing"] = CARD[st["minecraft:cardinal_direction"]]
        return block, p
    name = block[10:] if block.startswith("minecraft:") else block
    p = {}
    if is_stairs(name):
        p["facing"] = FACE.get(st.get("weirdo_direction", 3), "n")
        if st.get("upside_down_bit"): p["half"] = "top"
    elif is_slab(name) and st.get("minecraft:vertical_half") == "top":
        p["half"] = "top"
    if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
    if "minecraft:cardinal_direction" in st: p["facing"] = CARD[st["minecraft:cardinal_direction"]]
    return name, p


def main(out):
    data = json.loads(subprocess.check_output(["node", os.path.join(HERE, "boss_unlock_sites.mjs")]))
    names = {}
    for sid, s in data.items():
        for key, cut in ((sid, False), (sid + "_inside", True)):
            b = Blueprint(key)
            for dx, dy, dz, block, st in s["ops"]:
                if cut and dx > 0: continue
                n, p = logical(block, st)
                if n == "air":
                    if (dx, dy, dz) in b.cells: del b.cells[(dx, dy, dz)]
                    continue
                b.set(dx, dy, dz, n, **p)
            d = os.path.join(out, key); os.makedirs(d, exist_ok=True)
            b.save_logical(os.path.join(d, "scene.json"))
            names[key] = s["title"] + (" (cut away)" if cut else "")
        print(sid, len(s["ops"]), "ops")
    json.dump(names, open(os.path.join(out, "names.json"), "w"), indent=1)
    json.dump({k: {"title": v["title"], "map": v["map"], "spots": v["spots"], "info": v["info"]} for k, v in data.items()},
              open(os.path.join(out, "spots.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
