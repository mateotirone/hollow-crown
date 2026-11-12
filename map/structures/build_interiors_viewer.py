"""The interiors in 3D: every build on the building skill (review/specs), cut open floor by floor.

    python3 build_interiors_viewer.py OUT --textures <bedrock-samples>/resource_pack/textures/blocks [--only REGEX]

OUT gets index.html, data/ and tex.json (the 3D catalogue viewer, render/viewer3d.tpl.html). Each build opens
with its roof off; the buttons cut it at each floor (Ground floor, Floor 2, Attic) and the slider at any
height. Publish index.html with data/*.txt and tex.json as files.
"""
import os, sys, json, glob, re, argparse
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "review"))
SKILL = os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts")
sys.path.insert(0, SKILL)
import engine
from bp import Blueprint
from build_3d_catalogue import write_viewer

REGION_GROUND = {"vale": ("grass_block", "dirt"), "frostmarch": ("snow", "dirt"), "saltreach": ("grass_block", "dirt"),
                 "emberwaste": ("red_sand", "red_sandstone"), "blackfen": ("mud", "mud"), "hollow": ("siege:undertow_moss", "deepslate")}
ORDER = ["house", "townhouse", "farmhouse", "inn", "mint"]


def from_spec(f):
    """As the catalogue builds it (build_full_catalogue.from_spec): settlement buildings through settle_skill."""
    k = os.path.basename(f)[:-5]
    if k.startswith("settle_"):
        import settle_skill; bid, region = k[7:].rsplit("_", 1); return settle_skill.build(bid, region)
    spec = json.load(open(f)); b = Blueprint(spec["name"]); engine.into_blueprint(b, spec)
    if spec.get("after"):
        import importlib; mod, fn = spec["after"].split(":"); m = importlib.import_module(mod)
        tmp = Blueprint("after"); getattr(m, fn)(tmp, m.Building(tmp, m.P, 3)); dy = spec.get("after_dy", 0)
        for (x, y, z), v in tmp.cells.items():
            if v[0] != "keep": b.cells[(x, y + dy, z)] = v
    return b.finish()


def levels_of(spec):
    """Stand rows of the first house's storeys (and its attic), to cut at."""
    info = engine.layout(spec)
    if not info.get("houses"): return [], False
    h = info["houses"][0]
    lv = [s["stand_y"] for s in h["storeys"]]
    hp = next(p for p in spec["parts"] if p.get("part") == "house")
    I = hp.get("interior")
    attic = isinstance(I, dict) and bool(I.get("attic"))
    if attic: lv.append(h["plate"] + 1)
    return lv, attic


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--textures", required=True); ap.add_argument("--only", default="")
    a = ap.parse_args()
    files = sorted(g for g in glob.glob(os.path.join(HERE, "review", "specs", "*.json")) if not g.endswith(".base.json"))
    secs = {}
    for f in files:
        key = os.path.basename(f)[:-5]
        if a.only and not re.search(a.only, key): continue
        spec = json.load(open(f)); meta = spec.get("card", {})
        region = meta.get("region", "vale")
        sid = "settle-" + region if key.startswith("settle_") else "kingsrest"
        title = {"kingsrest": "Kingsrest and Millbrook"}.get(sid, "Settlement plots · " + region.capitalize())
        sec = secs.setdefault(sid, {"id": sid, "title": title, "cards": []})
        lv, attic = levels_of(spec)
        I = next((p.get("interior") for p in spec["parts"] if p.get("part") == "house"), None)
        use = I if isinstance(I, str) else (I or {}).get("use", "home")
        card = {"key": key, "title": meta.get("title", key.replace("_", " ").capitalize()), "sub": meta.get("sub", ""),
                "blurb": f"Inside: {use}. " + meta.get("blurb", ""), "levels": lv, "attic": attic,
                "cut": (lv[-1] + 3) if lv else None}
        sec["cards"].append((card, f, REGION_GROUND.get(region)))
    items = []
    for sid in ["kingsrest"] + [f"settle-{r}" for r in ("vale", "frostmarch", "saltreach", "emberwaste", "blackfen")]:
        if sid not in secs: continue
        sec = secs[sid]
        cards = sorted(sec["cards"], key=lambda c: next((i for i, o in enumerate(ORDER) if f"_{o}_" in c[1]), 9))
        for card, f, ground in cards:
            items.append((sec, card, (lambda f=f: from_spec(f)), ground, None))
    write_viewer(items, a.out, a.textures)


if __name__ == "__main__":
    main()
