#!/usr/bin/env python3
"""spec.json -> .mcfunction + summary.json + preview.png (+ stage previews, scene.json, .mcstructure).

    python3 build.py spec.json OUT_DIR [--edition bedrock|java] [--stages] [--no-preview] [--mcstructure]

Prints only the compact summary (a few hundred bytes) whatever the size of the build: read that and
look at the preview, never the command file.
"""
import argparse, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from colour import Palette  # noqa: E402
from fit import voxelize  # noqa: E402
from materials import Materials  # noqa: E402
import emit, parts  # noqa: E402

STAGES = ["shapes", "foundation", "frame", "floors", "walls", "openings", "roof", "details", "place"]


def resolve(cells, mats, pal, log):
    """Logical cells {kind, props, mat|name} -> {(x,y,z): (block id, props)}"""
    for c, v in cells.items():
        if v.get("mat"): mats.note_cell(v["mat"], *c)
    out, warned = {}, set()
    for (x, y, z), v in cells.items():
        k, p = v["kind"], dict(v.get("props", {}))
        if k == "air": continue
        if k == "raw":
            out[(x, y, z)] = (v["name"], p); continue
        if not v.get("mat"):
            if ("nomat", k) not in warned: log.append(f"{k} cell at {x},{y},{z} has no material"); warned.add(("nomat", k))
            continue
        b, raw = mats.block(v["mat"], x, y, z)
        if raw:
            out[(x, y, z)] = (b, p); continue
        if k == "full":
            if "axis" not in pal.blocks[b]["tags"]: p.pop("axis", None)
            out[(x, y, z)] = (b, p); continue
        if k == "post":
            k = "wall" if "wall" in pal.blocks[b]["variants"] else "fence" if "fence" in pal.blocks[b]["variants"] else \
                ("wall" if pal.substitute(b, "wall") else "fence")
        sub = pal.substitute(b, k)
        if sub is None:
            if (k, b) not in warned: log.append(f"no {k} form near {b}; used a full block"); warned.add((k, b))
            out[(x, y, z)] = (b, {}); continue
        if sub != b and (k, b) not in warned:
            log.append(f"{b} has no {k} form: those cells use {sub}"); warned.add((k, b))
        p.pop("axis", None)
        out[(x, y, z)] = (pal.variant(sub, k), p)
    return out


def build(spec, out_dir, edition=None, stages=False, preview=True, mcstructure=False):
    t0 = time.time()
    os.makedirs(out_dir, exist_ok=True)
    edition = edition or spec.get("edition", "bedrock")
    pal = Palette(edition=edition)
    log = []
    name = spec.get("name", "build").replace(" ", "_")
    cells, stage_of = {}, {}
    if spec.get("shapes"):
        sc = voxelize(spec["shapes"], q=spec.get("quality", 4), thin=spec.get("thin", False), hollow=spec.get("hollow", 1), log=log)
        for c, v in sc.items(): cells[c] = v; stage_of[c] = "shapes"
    ctx = parts.Context(cells, stage_of, log, spec)
    for pt in spec.get("parts", []):
        parts.run(ctx, pt)
    for e in spec.get("place", []):
        x, y, z, b = e[:4]; p = e[4] if len(e) > 4 else {}
        ctx.set(x, y, z, "place", raw=b.replace("minecraft:", ""), **p)
    mats = Materials(spec.get("materials"), pal, log)
    blocks = resolve(cells, mats, pal, log)
    emit.connect(blocks)
    files, ncmd = emit.write_functions(blocks, out_dir, name, edition, pal, clear=spec.get("clear", False), offset=tuple(spec.get("offset", (0, 0, 0))))
    extra = {}
    if preview and blocks:
        from preview import render
        files.append(render(blocks, pal, os.path.join(out_dir, "preview.png"), label=f"{name}  {len(blocks)} blocks"))
        if stages:
            from PIL import Image
            seen = [s for s in STAGES if any(stage_of.get(c) == s for c in blocks)]
            tiles, acc = [], set()
            for s in seen:
                acc.add(s)
                sub = {c: b for c, b in blocks.items() if stage_of.get(c, "shapes") in acc}
                pth = os.path.join(out_dir, f"stage-{len(tiles) + 1}-{s}.png")
                render(sub, pal, pth, max_w=700, views=("se",), label=f"{len(tiles) + 1}. {s}")
                tiles.append(pth)
            ims = [Image.open(t) for t in tiles]
            cols = min(3, len(ims)); rows = (len(ims) + cols - 1) // cols
            w = max(i.width for i in ims); h = max(i.height for i in ims)
            sheet = Image.new("RGB", (w * cols, h * rows), (226, 232, 236))
            for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * w, (k // cols) * h))
            sp = os.path.join(out_dir, "stages.png"); sheet.save(sp); files.append(sp)
            for t in tiles: os.remove(t)
    emit.save_logical(blocks, os.path.join(out_dir, "scene.json"))
    if mcstructure:
        p = emit.save_mcstructure(blocks, os.path.join(out_dir, f"{name}.mcstructure"), name)
        if p: files.append(p)
        else: log.append("mcstructure needs the hollow-crown repo's map/structures/bp.py")
    extra["seconds"] = round(time.time() - t0, 1)
    s = emit.summary(blocks, stage_of, files, ncmd, log, name, extra)
    json.dump(s, open(os.path.join(out_dir, "summary.json"), "w"), indent=1)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec"); ap.add_argument("out")
    ap.add_argument("--edition", choices=["bedrock", "java"])
    ap.add_argument("--stages", action="store_true", help="also write stages.png, one cumulative view per build stage")
    ap.add_argument("--no-preview", action="store_true")
    ap.add_argument("--mcstructure", action="store_true")
    ap.add_argument("--shots", default="front-left,back", help="hifi views: front-left, front-right, high, back, "
                    "front, right, left, rear (straight-on views match a screenshot taken face-on)")
    ap.add_argument("--hifi", nargs=2, metavar=("TEXTURES", "THREE"), help="also shoot real-texture renders with the repo's "
                    "three.js renderer (map/structures/render): Bedrock textures/blocks folder and a three@0.170.0 folder")
    a = ap.parse_args()
    spec = json.load(open(a.spec))
    s = build(spec, a.out, a.edition, a.stages, not a.no_preview, a.mcstructure)
    if a.hifi:
        r = emit._find_up(os.path.join("map", "structures", "render", "render.py"))
        if not r: print("--hifi needs the hollow-crown repo (map/structures/render/render.py)", file=sys.stderr)
        else:
            import subprocess
            subprocess.run([sys.executable, r, os.path.join(a.out, "scene.json"), os.path.join(a.out, "hifi"), "--textures", a.hifi[0],
                            "--three", a.hifi[1], "--shots", a.shots, "--title", s["name"]], check=True, stdout=subprocess.DEVNULL)
            s["files"] += [f"hifi/shot-{v}.png" for v in a.shots.split(",")] + ["hifi/viewer.html"]
    print(json.dumps(s, separators=(",", ":")))


if __name__ == "__main__":
    main()
