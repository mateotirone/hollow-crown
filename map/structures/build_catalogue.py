"""Building catalogue: one picture per building per style, plus a JSON index.

    python3 build_catalogue.py OUT_DIR --textures DIR --three DIR

Writes OUT_DIR/<name>-<style>.png (a 3/4 view of the building on a small lawn)
and OUT_DIR/catalogue.json (size, storeys, style, blocks, file, map spot).
The catalogue page is made from catalogue.json and the pictures.
"""
import os, sys, json, argparse, subprocess, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bp import Blueprint
import vale

STYLE_NAMES = {"tudor": "Plaster and timber", "stone": "Norman stone", "brick": "Brick and spruce"}

# Every finished building design. "where" is its planned map spot; filled in as town plans land.
DESIGNS = [
    dict(key="kingsrest_inn", title="Kingsrest coaching inn", kind="Inn", where="Kingsrest, on the square",
         make=lambda s: vale.coaching_inn(style=s), use="Rooms for travellers, tap room, stable yard through the carriage arch. The innkeeper NPC stands at the bar.",
         inside="Tap room with bar, four tables and a hearth; three bedrooms; the innkeeper's hall with a long table and bookshelves."),
    dict(key="vale_house_11", title="Two-storey house", kind="House", where="Vale towns, any street plot",
         make=lambda s: vale.townhouse(11, width=7, depth=9, storeys=2, ground="stone", roof="slate", chimney_side="w", style=s),
         use="The everyday Vale house: stone ground floor, jettied timber upper floor.", inside="Hearth, table and stairs; bedroom upstairs."),
    dict(key="vale_house_12", title="Narrow three-storey house", kind="House", where="Vale towns, tight plots near a square",
         make=lambda s: vale.townhouse(12, width=5, depth=9, storeys=3, ground="stone", roof="wood", chimney_side="e", style=s),
         use="Tall and thin, for busy streets where plots are narrow.", inside="Hearth and table; two upper floors with a bed each."),
    dict(key="vale_house_13", title="Deep timber house", kind="House", where="Vale towns, edge of town",
         make=lambda s: vale.townhouse(13, width=7, depth=11, storeys=2, ground="timber", jetty=False, chimney_side="w", style=s),
         use="Timber from the ground up, no jetty: a plainer house for the outskirts.", inside="Hearth, table and stairs; bedroom upstairs."),
    dict(key="vale_house_14", title="Wide merchant's house", kind="House", where="Vale towns, main streets",
         make=lambda s: vale.townhouse(14, width=9, depth=9, storeys=2, ground="stone", chimney_side="e", style=s),
         use="The biggest house: wide front for a shop or a well-off family.", inside="Hearth, table and stairs; bedroom upstairs."),
]

ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--textures", required=True); ap.add_argument("--three", required=True)
ap.add_argument("--only", default="")
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); work = os.path.join(a.out, "_work")
index = []
for d in DESIGNS:
    entry = {k: v for k, v in d.items() if k != "make"}; entry["styles"] = {}
    for style in STYLE_NAMES:
        b = d["make"](style); lo, hi = b.bounds()
        size = [hi[0] - lo[0] + 1, hi[1] - max(lo[1], 0), hi[2] - lo[2] + 1]
        n = sum(1 for c in b.cells.values() if c[0] not in ("air", "keep", "structure_void"))
        entry["styles"][style] = {"name": STYLE_NAMES[style], "image": f"{d['key']}-{style}.png", "blocks": n}
        entry["size"] = size; entry["storeys"] = getattr(b, "levels", None) and len(b.levels) or None
        if a.only and a.only != d["key"]: continue
        sc = Blueprint(d["key"] + "_card"); sc.paste(b, 0, 0, 0)
        for x in range(lo[0] - 3, hi[0] + 4):
            for z in range(lo[2] - 3, hi[2] + 4):
                if sc.get(x, 0, z)[0] == "keep": sc.set(x, 0, z, "grass_block")
                if sc.get(x, -1, z)[0] == "keep": sc.set(x, -1, z, "dirt")
        sc.finish()
        ext = max(hi[0] - lo[0], hi[2] - lo[2]) + 7
        tgt = [(lo[0] + hi[0] + 1) / 2, max(3, (hi[1] + 1) * 0.47), (lo[2] + hi[2] + 1) / 2]
        sc.camera = {"views": {"card": [-38, 20, max(ext * 1.25, (hi[1] + 1) * 2.4)] + tgt}}
        sub = os.path.join(work, f"{d['key']}-{style}"); os.makedirs(sub, exist_ok=True)
        sc.save_logical(os.path.join(sub, "scene.json"))
        subprocess.run([sys.executable, os.path.join(HERE, "render", "render.py"), os.path.join(sub, "scene.json"), sub,
                        "--textures", a.textures, "--three", a.three, "--shots", "card"], check=True)
        shutil.copy(os.path.join(sub, "shot-card.png"), os.path.join(a.out, f"{d['key']}-{style}.png"))
    index.append(entry)
json.dump(index, open(os.path.join(a.out, "catalogue.json"), "w"), indent=1)
print("designs", len(index))
