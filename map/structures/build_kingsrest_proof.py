"""Proof build: Kingsrest coaching inn and a short street of town houses.

    python3 build_kingsrest_proof.py OUT_DIR [--render --textures DIR --three DIR]

Writes per building: <name>.mcstructure, <name>.stamp.json (world-writer format),
and scene.json (logical, for the renderer). With --render, also a 3D viewer page and shots.
"""
import os, sys, json, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
from kit import h3, VALE
import vale

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--render", action="store_true")
ap.add_argument("--textures", default=""); ap.add_argument("--three", default=""); ap.add_argument("--shots", default="front-left,front-right,high,street")
ap.add_argument("--dusk", action="store_true"); ap.add_argument("--style", default="tudor")
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)

inn = vale.coaching_inn(style=a.style)
houses = [
    (vale.townhouse(11, width=7, depth=9, storeys=2, ground="stone", roof="slate", chimney_side="w", style=a.style), -10, 2),
    (vale.townhouse(12, width=5, depth=9, storeys=3, ground="stone", roof="wood", chimney_side="e", style=a.style), -18, 3),
    (vale.townhouse(13, width=7, depth=11, storeys=2, ground="timber", jetty=False, chimney_side="w", style=a.style), -27, 1),
    (vale.townhouse(14, width=9, depth=9, storeys=2, ground="stone", chimney_side="e", style=a.style), 26, 2),
]
for b in [inn] + [h for h, _, _ in houses]:
    b.save_mcstructure(os.path.join(a.out, b.name + ".mcstructure"))
    b.save_json(os.path.join(a.out, b.name + ".stamp.json"))
    for n in b.notes: print("note:", n)

# ---- preview scene: buildings on grass, a street, a few trees
scene = Blueprint("kingsrest_proof_scene")
scene.paste(inn, 0, 0, 0)
for h, ox, oz in houses: scene.paste(h, ox, 0, oz)
lo, hi = scene.bounds()
X0, X1, Z0, Z1 = lo[0] - 40, hi[0] + 40, lo[2] - 30, hi[2] + 50
street = lambda z: 21 <= z <= 25
for x in range(X0, X1 + 1):
    for z in range(Z0, Z1 + 1):
        if scene.get(x, 0, z)[0] == "keep":
            if street(z): scene.set(x, 0, z, VALE["path"](x, 0, z)[0])
            else:
                scene.set(x, 0, z, "grass_block")
                r = h3(x, 1, z, 9)
                if scene.get(x, 1, z)[0] == "keep" and not (-1 <= z - 20 <= 0):
                    if r < 0.07: scene.set(x, 1, z, "short_grass")
                    elif r < 0.09: scene.set(x, 1, z, ["poppy", "dandelion", "cornflower", "oxeye_daisy", "azure_bluet"][int(h3(x, 2, z, 3) * 5)])
        for y in range(-1, 0):
            if scene.get(x, y, z)[0] == "keep": scene.set(x, y, z, "dirt")
def tree(x, z, s):
    hgt = 5 + int(h3(x, 0, z, s) * 3)
    for y in range(1, hgt + 1): scene.set(x, y, z, "oak_log")
    for dx in range(-3, 4):
        for dy in range(-2, 3):
            for dz in range(-3, 4):
                if dx * dx + dz * dz + (dy * 1.4) ** 2 <= 9.5 + h3(x + dx, dy, z + dz, s) * 3 and scene.get(x + dx, hgt + dy, z + dz)[0] == "keep":
                    scene.set(x + dx, hgt + dy, z + dz, "oak_leaves")
for (tx, tz) in ((-6, -10), (30, -6), (-34, 8), (40, 16), (-44, 12), (44, 34), (-40, 30)): tree(tx, tz, tx)
scene.finish()
scene.camera = {"views": {"inn": [28, 14, 44, 11, 7, 11], "inn-left": [-30, 18, 46, 9, 7, 8], "street": [-62, 4, 30, 4, 5, 20],
                          "town": [-20, 30, 90, 0, 4, 8], "cutaway": [15, 62, 48, 9, 2, 8], "cutaway-houses": [10, 60, 46, -14, 2, 7], "yard": [200, 30, 50, 11, 6, 2]}}
scene.save_logical(os.path.join(a.out, "scene.json"))
print("scene blocks", len(scene.cells))
if a.render:
    cmd = [sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), a.out,
           "--title", "Kingsrest coaching inn", "--blurb", "Proof build for the map: the inn and a street of town houses, real Bedrock textures.",
           "--textures", a.textures, "--three", a.three, "--shots", a.shots] + (["--dusk"] if a.dusk else [])
    subprocess.run(cmd, check=True)
    for cut in (5, 10):
        sub = os.path.join(a.out, f"cut{cut}")
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(a.out, "scene.json"), sub, "--cut", str(cut),
                        "--textures", a.textures, "--three", a.three, "--shots", "cutaway,cutaway-houses"], check=True)
