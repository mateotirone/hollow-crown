"""The Gold Sluice, all three levels, built with the minecraft-builder skill for the live asset viewer
(tools/asset-viewer EXTRAS "goldsluice") and for pictures.

    python3 map/structures/goldsluice_builds.py OUT [--ground]   -> OUT/<level>/scene.json (+ .mcfunction, preview)
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "goldsluice"))
from spec import specs  # noqa: E402

BUILD = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")

def main():
    out = os.path.abspath(sys.argv[1])
    for name, spec in specs("--ground" in sys.argv).items():
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "spec.json")
        json.dump(spec, open(path, "w"))
        subprocess.run([sys.executable, BUILD, path, d, "--no-preview"], check=True, stdout=subprocess.DEVNULL)
        print(name, "ok")

if __name__ == "__main__":
    main()
