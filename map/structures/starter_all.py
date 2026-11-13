"""Bake the starter village for all twelve map plots (the game's Hamlet, merged in by tools/export_towns.py).

    python3 starter_all.py MAP_DIR HEIGHTS.npy SIZES.json OUT_DIR [plot ...]

MAP_DIR is what terrain_slice.py needs (genworld.py, terrain.npz, lines.json, config.js). HEIGHTS is the world's
pre-town ground (hollow-crown-full-map-heights-pretown.npy), put into each slice with slice_heights.py so the
village is graded to the ground the world really has. SIZES comes from studio/starter_preview/sizes.mjs.
Writes OUT_DIR/<plot>.json (format hollow-crown-starter/1), one per plot.
"""
import os, sys, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from starter import load_plots

mapdir, heights, sizes, out, *only = sys.argv[1:]
os.makedirs(out, exist_ok=True)
plots = load_plots(os.path.join(HERE, "..", "..", "Siege_Nights_BP", "scripts", "plots", "config.js"))
for key, p in plots.items():
    if only and key not in [o.lower() for o in only]: continue
    raw, sl = os.path.join(out, f"{key}-raw.npz"), os.path.join(out, f"{key}.npz")
    if not os.path.exists(sl):
        subprocess.run([sys.executable, os.path.join(HERE, "terrain_slice.py"), mapdir, str(p["x"] - 100), str(p["z"] - 100), "201", raw], check=True, stdout=subprocess.DEVNULL)
        subprocess.run([sys.executable, os.path.join(HERE, "slice_heights.py"), raw, heights, sl], check=True)
        os.remove(raw)
    subprocess.run([sys.executable, os.path.join(HERE, "starter.py"), p["name"], sl, os.path.join(out, f"{key}.json"), "--sizes", sizes], check=True)
