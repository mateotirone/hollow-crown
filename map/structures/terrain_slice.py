"""Reproduce genworld.py's height field for one square of the map, without amulet.

    python3 terrain_slice.py MAP_DIR x0 z0 size out.npz

MAP_DIR holds genworld.py, terrain.npz and lines.json (run draw_map.py there first) and
config.js (a copy of Siege_Nights_BP/scripts/plots/config.js). Town layouts use the result so
buildings sit on the ground the real world file will have.
"""
import sys, re, os, math, json, time, numpy as np
from PIL import Image, ImageDraw
here = sys.argv[1]; X0, Z0, SIZE, OUT = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
src_lines = open(os.path.join(here, "genworld.py")).read().split("\n")
a = next(i for i, l in enumerate(src_lines) if l.startswith("# ---------------------------------------------------------------- plan data"))
b = next(i for i, l in enumerate(src_lines) if 'log("heights ready' in l)
g = dict(np=np, re=re, os=os, sys=sys, out=os.path.dirname(os.path.abspath(OUT)), __file__=os.path.join(here, 'genworld.py'), math=math, json=json, time=time, Image=Image, ImageDraw=ImageDraw, X0=X0, Z0=Z0, SIZE=SIZE,
         src=os.path.join(here, "terrain.npz"), CONFIG=os.path.join(here, "config.js"), SEA=62, VALE=0, FROST=1, SALT=2, FEN=3, EMBER=4,
         T0=time.time(), log=lambda *x: None)
exec(compile("\n".join(src_lines[a:b + 1]), "genworld-slice", "exec"), g)
np.savez_compressed(OUT, Y=g["Y"], water=g["water_level"], road=g["isroad"], trail=g["istrail"], river=g["isriver"], bank=g["bank"], X0=X0, Z0=Z0, PLAZA=json.dumps(g["PLAZA"]))
print("ok", g["PLAZA"].get("Kingsrest"), int(g["Y"].min()), int(g["Y"].max()))
