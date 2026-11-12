"""The Choir Seam, all three levels in the Hollow (Choir Ore exists only there), built with the minecraft-builder skill for the live asset
viewer (tools/asset-viewer EXTRAS "choirseam": one row per stage, one chip per region) and for pictures.

    python3 map/structures/choirseam_builds.py OUT [--ground] [--region R|all]
        -> OUT/choirseam_<region>_<level>/scene.json (+ .mcfunction), OUT/names.json
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "choirseam"))
from spec import specs, names  # noqa: E402
from machine_regions import ORDER  # noqa: E402

BUILD = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")


def main():
    a = sys.argv[1:]
    out = os.path.abspath(a[0])
    r = a[a.index("--region") + 1] if "--region" in a else "all"
    os.makedirs(out, exist_ok=True)
    json.dump(names(), open(os.path.join(out, "names.json"), "w"), indent=1)
    for name, spec in specs("--ground" in a).items():
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "spec.json")
        json.dump(spec, open(path, "w"))
        subprocess.run([sys.executable, BUILD, path, d, "--no-preview"], check=True, stdout=subprocess.DEVNULL)
        print(name, "ok")


if __name__ == "__main__":
    main()
