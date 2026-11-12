#!/usr/bin/env python3
"""Regenerate data/palette.json by averaging block textures. No model needed: run it as a plain script.

    python3 build_palette.py --bedrock <resource_pack folder | textures/blocks folder | .mcpack/.zip>
    python3 build_palette.py --java <client .jar | resource pack .zip | folder>   [--out data/palette.json]

Bedrock vanilla textures: github.com/Mojang/bedrock-samples (resource_pack/textures/blocks).
Java: the client jar from your .minecraft/versions/<version>/<version>.jar, or any resource pack.
A resource pack only needs to hold the textures it changes; pass the vanilla source first and the
pack second (--java vanilla.jar --java pack.zip) and the later one wins.

For every block in data/blocks.json it records the average colour (averaged in linear light, side
faces weighted 2:1 over the top), OKLab, a texture roughness class, a 4x4 thumbnail of the side and top
(for the preview), and which slab / stairs / wall / fence / trapdoor forms exist. A Java jar also
proves which variant ids exist (from its blockstates folder).
"""
import argparse, io, json, os, sys, zipfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from colour import srgb_to_linear, linear_to_srgb, linear_to_oklab, rgb_to_hex  # noqa: E402

SKILL = os.path.dirname(HERE)
# Non-building blocks the preview still needs a colour for (detail parts place them)
EXTRAS = {
    "glass": (["glass"], ["glass"]), "glass_pane": (["glass"], ["glass"]),
    "lantern": (["lantern"], ["lantern"]), "chain": (["chain1", "iron_chain"], ["chain", "iron_chain"]),
    "campfire": (["campfire_log_lit", "campfire_log"], ["campfire_log_lit"]), "flower_pot": (["flower_pot"], ["flower_pot"]),
    "azalea_leaves": (["azalea_leaves"], ["azalea_leaves"]), "azalea_leaves_flowered": (["azalea_leaves_flowers"], ["flowering_azalea_leaves"]),
    "vine": (["vine_carried", "vine"], ["vine"]), "iron_bars": (["iron_bars"], ["iron_bars"]),
    "torch": (["torch_on"], ["torch"]), "end_rod": (["end_rod"], ["end_rod"]), "lightning_rod": (["lightning_rod"], ["lightning_rod"]),
    "grass_block": (["grass_side_carried"], ["grass_block_side"]), "water": (["water_still_grey"], ["water_still"]),
}
for _w, _bt, _jt in (("oak", "door_wood_lower", "oak_door_bottom"), ("spruce", "door_spruce_lower", "spruce_door_bottom"),
                     ("dark_oak", "door_dark_oak_lower", "dark_oak_door_bottom"), ("birch", "door_birch_lower", "birch_door_bottom")):
    EXTRAS[f"{_w}_door"] = ([_bt], [_jt])
for _c in ("white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"):
    EXTRAS[f"{_c}_stained_glass"] = ([f"glass_{'silver' if _c == 'light_gray' else _c}"], [f"{_c}_stained_glass"])
    EXTRAS[f"{_c}_stained_glass_pane"] = EXTRAS[f"{_c}_stained_glass"]


class Source:
    """A folder or archive of textures; looks names up as <name>.png/.tga anywhere under the block folder."""

    def __init__(self, path, edition):
        self.edition, self.files, self.states = edition, {}, set()
        self.zip = None
        if os.path.isdir(path):
            for root, _, fs in os.walk(path):
                for f in fs: self._add(os.path.relpath(os.path.join(root, f), path).replace(os.sep, "/"), os.path.join(root, f))
        else:
            self.zip = zipfile.ZipFile(path)
            for n in self.zip.namelist(): self._add(n, n)

    def _add(self, rel, full):
        low = rel.lower()
        if self.edition == "java" and "/blockstates/" in "/" + low and low.endswith(".json"):
            self.states.add(os.path.basename(low)[:-5]); return
        if not (low.endswith(".png") or low.endswith(".tga")): return
        if self.edition == "java" and "textures/block/" not in low: return
        if self.edition == "bedrock" and "textures/blocks/" not in low and "/" in low.split("textures/blocks/")[-1] and "blocks" not in low:
            pass
        key = low.split("textures/blocks/")[-1].split("textures/block/")[-1].rsplit(".", 1)[0]
        for k in (key, key.split("/")[-1]):
            if k not in self.files or low.endswith(".png"): self.files[k] = full

    def image(self, name):
        f = self.files.get(name.lower())
        if f is None: return None
        data = self.zip.read(f) if self.zip else open(f, "rb").read()
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        w, h = im.size
        if h > w: im = im.crop((0, 0, w, w))       # animated strip: first frame
        return im


def stats(im):
    a = np.asarray(im).reshape(-1, 4).astype(float)
    a = a[a[:, 3] > 128]
    if len(a) == 0: return None
    lin = srgb_to_linear(a[:, :3])
    lab = linear_to_oklab(lin)
    small = im.convert("RGB").resize((4, 4), Image.BOX)
    return {"lin": lin.mean(0), "Lstd": float(lab[:, 0].std()), "edge": float(edge_energy(im)), "thumb": [rgb_to_hex(c) for c in np.asarray(small).reshape(-1, 3)]}


def edge_energy(im):
    g = np.asarray(im.convert("L"), dtype=float) / 255.0
    return (np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean()) / 2


def find(sources, names, fallback_id):
    f = fallback_id
    alt = [f.replace("_wood", "_log_side"), f.replace("_hyphae", "_log_side"), f.replace("_hyphae", "_stem_side"),
           f.replace("_wood", "_log"), f.replace("chiseled_", "") + "_carved", f.replace("waxed_", ""),
           f.replace("waxed_", "").replace("copper", "copper_block") if f.endswith("waxed_copper") else f]
    tried = list(names) + [f, f + "_side", f + "_top"] + [x for x in alt if x != f]
    for n in tried:
        for s in reversed(sources):
            im = s.image(n)
            if im is not None: return im, n
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bedrock", action="append", default=[])
    ap.add_argument("--java", action="append", default=[])
    ap.add_argument("--out", default=os.path.join(SKILL, "data", "palette.json"))
    a = ap.parse_args()
    if bool(a.bedrock) == bool(a.java): ap.error("give --bedrock or --java (one edition)")
    edition = "bedrock" if a.bedrock else "java"
    sources = [Source(p, edition) for p in (a.bedrock or a.java)]
    table = json.load(open(os.path.join(SKILL, "data", "blocks.json")))["blocks"]
    states = set().union(*[s.states for s in sources])
    rows, missing = [], []
    for b in table:
        names = b["tex"][edition]
        side, sname = find(sources, names[:1], b["java"] if edition == "java" else b["id"])
        top, tname = find(sources, names[1:2] or names[:1], b["java"] if edition == "java" else b["id"])
        if side is None: missing.append(b["id"]); continue
        s, t = stats(side), stats(top if top is not None else side)
        lin = (2 * s["lin"] + t["lin"]) / 3
        rgb = linear_to_srgb(lin)
        var = {k: dict(v) for k, v in b["variants"].items()}
        if edition == "java" and states:      # the jar says which forms really exist
            var = {k: v for k, v in var.items() if v.get("java") and v["java"] in states}
            for v in var.values(): v["java_verified"] = True
        rows.append({"id": b["id"], "java": b["java"], "tags": b["tags"], "variants": var,
                     "hex": rgb_to_hex(rgb), "oklab": [round(float(x), 4) for x in linear_to_oklab(lin)],
                     "_rough": (s["Lstd"] + t["Lstd"]) / 2 + 0.5 * (s["edge"] + t["edge"]) / 2,
                     "thumb": {"side": s["thumb"], "top": t["thumb"]}, "tex": [sname, tname]})
    # roughness classes by tertiles of the measured texture busyness
    r = np.array([x["_rough"] for x in rows])
    lo, hi = np.quantile(r, [1 / 3, 2 / 3])
    for x in rows:
        v = x.pop("_rough"); x["rough_score"] = round(float(v), 4)
        x["roughness"] = "smooth" if v < lo else "medium" if v < hi else "rough"
    extras = {}
    for k, (bn, jn) in EXTRAS.items():
        im, _ = find(sources, bn if edition == "bedrock" else jn, k)
        if im is None: continue
        if "glass" in k or k == "iron_bars":    # see-through: show it over a dark room, as a window reads from outside
            bg = Image.new("RGBA", im.size, (38, 40, 44, 255)); bg.alpha_composite(im); im = bg
        s = stats(im)
        if s: extras[k] = {"hex": rgb_to_hex(linear_to_srgb(s["lin"])), "thumb": s["thumb"]}
    out = {"about": f"Block palette for the minecraft-builder skill, averaged from {edition} textures by scripts/build_palette.py "
                    f"({', '.join(os.path.basename(p.rstrip('/')) for p in (a.bedrock or a.java))}). Roughness: tertiles of texture busyness "
                    f"(smooth < {lo:.3f} <= medium < {hi:.3f} <= rough).",
           "edition": edition, "blocks": rows, "extras": extras}
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print(f"{len(rows)} blocks, {len(extras)} extras -> {a.out}")
    if missing: print("no texture found for:", " ".join(missing))


if __name__ == "__main__":
    main()
