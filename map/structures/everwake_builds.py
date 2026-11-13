"""Everwake, the city in the sky, built with the minecraft-builder skill for the live asset viewer
(tools/asset-viewer EXTRAS "everwake") and for pictures.

    python3 map/structures/everwake_builds.py OUT [--only everwake_city] [--preview]
        -> OUT/<build>/scene.json (+ .mcfunction, summary.json, preview.png with --preview)
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "everwake"))
from spec import specs as city_specs  # noqa: E402
from airboat import specs as airboat_specs  # noqa: E402


def specs():
    return {**city_specs(), **airboat_specs()}

BUILD = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts", "build.py")


def main():
    out = os.path.abspath(sys.argv[1])
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    for name, spec in specs().items():
        if only and name != only: continue
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "spec.json")
        json.dump(spec, open(path, "w"))
        args = [sys.executable, BUILD, path, d] + ([] if "--preview" in sys.argv else ["--no-preview"])
        subprocess.run(args, check=True, stdout=subprocess.DEVNULL)
        print(name, "ok")


if __name__ == "__main__":
    main()
