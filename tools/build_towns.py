#!/usr/bin/env python3
"""Build every settlement's layout for the game in one run, in the one order (Mateo, 2026-11-16: "it's supposed to be
an order, down to the minute details. lay the plots, lay the paths, wall goes around, paths are correctly connected").

    python3 tools/build_towns.py [plot ...]
        --settlements DIR   the town generator's layouts, <plot>.json (default: the project's towngen/settlements-starter)
        --starters SDIR     where each plot's ground slice <plot>.npz lives and its starter village <plot>.json is
                            written (default: DIR/starter)

The order, and the only place each thing comes from:
  1. sizes      the starter buildings' footprints, from the game's own designs (studio/starter_preview/sizes.mjs)
  2. village    every plot's starter village on its real ground: plots, paths to every door, yards, fields, pens,
                ground and the starter's wall outline (map/structures/starter.py -> SDIR/<plot>.json)
  3. town       the Town, City and Castle bands grown round the village, and every tier's wall line drawn round what
                that tier laid, with room inside for the wall, its towers and stairs; what else lay in a tier's wall
                band (street ends, a field's last rows, lamps, trees) is laid a tier later, once the wall has moved
                past; then every tier's streets are joined into one network reaching every door, links laid on the
                plot's real ground (tools/export_towns.py -> settle/towns_data.js outline.tight, outline.lines, outline.keep)
  3b. road      the road from the gate out to the map's road, straight through every gate before it turns
                (tools/export_road_joins.mjs -> settle/roadjoin_data.js)
  4. game       founding.js lays it in the same order: groundwork (plots and paths), blend, fixtures, then the wall is
                raised (and topped up) on that line, then townReady fires for the last stage (planting). A wall
                standing on an older line in a saved world comes down and rises again on the new one.

Never patch towns_data.js (or a village .json) by hand or with a one-off script: change the step that makes it and run
this again. The whole-town self-tests in settle/tests.js (run by tools/check.mjs) fail when a wall stands on a plot,
yard, field or path, when a wall has a way through, or when the stages disagree.
"""
import argparse, glob, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "map", "structures"))
import export_towns  # noqa: E402
from starter import load_plots  # noqa: E402

DEFAULT = "/mnt/project-files/siege-nights/towngen/settlements-starter"


def main():
    ap = argparse.ArgumentParser(usage=__doc__)
    ap.add_argument("plots", nargs="*")
    ap.add_argument("--settlements", default=DEFAULT)
    ap.add_argument("--starters")
    a = ap.parse_args()
    sdir = a.starters or os.path.join(a.settlements, "starter")
    only = {p.lower() for p in a.plots}

    # 1. sizes
    sizes = os.path.join(sdir, "sizes.json")
    subprocess.run(["node", os.path.join(ROOT, "studio", "starter_preview", "sizes.mjs"), sizes], check=True, stdout=subprocess.DEVNULL)
    # 2. village, every plot (or the ones named), on its own ground slice
    plots = load_plots(os.path.join(ROOT, "Siege_Nights_BP", "scripts", "plots", "config.js"))
    for key, p in plots.items():
        if only and key not in only: continue
        sl = os.path.join(sdir, f"{key}.npz")
        if not os.path.exists(sl):
            sys.exit(f"{key}: no ground slice at {sl} (map/structures/starter_all.py makes them from the map)")
        subprocess.run([sys.executable, os.path.join(ROOT, "map", "structures", "starter.py"), p["name"], sl, os.path.join(sdir, f"{key}.json"), "--sizes", sizes], check=True)
    missing = [k for k in plots if not os.path.exists(os.path.join(sdir, f"{k}.json"))]
    if missing: sys.exit(f"no starter village for {', '.join(missing)}")
    # 3. town and wall lines, all twelve together (towns_data.js holds every plot)
    export_towns.main(a.settlements, sdir)
    # 3b. the road from each gate out to the map's road, straight through every wall's gate (settle/roadjoin_data.js)
    subprocess.run(["node", os.path.join(ROOT, "tools", "export_road_joins.mjs")], check=True, stdout=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
