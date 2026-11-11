"""Every catalogue build as a .mcstructure, in a small behaviour pack Mateo can add to his own world.

    python3 build_full_catalogue.py WORK/settle.json OUT --textures T --three T --mcstructure DIR

DIR gets  pack/ (manifest + structures/hcb/*.mcstructure), BUILDS.md (one paste-ready /structure load
command per build) and builds.json. Builds wider than 64 blocks are cut into 64 x 64 tiles, each with
its own command, so they also load through a structure block.
Loading: stand on the ground where the build's middle (or its door) should be and paste the command.
"""
import os, re, json, uuid
from bp import Blueprint

TILE = 64

def slug(key): return re.sub(r"[^a-z0-9_]", "_", key.lower())

def tiles(bp):
    lo, hi = bp.bounds()
    if hi[0] - lo[0] < TILE and hi[2] - lo[2] < TILE: return [("", bp)]
    out = []
    for i, x0 in enumerate(range(lo[0], hi[0] + 1, TILE)):
        for j, z0 in enumerate(range(lo[2], hi[2] + 1, TILE)):
            t = Blueprint(f"{bp.name}_{i}_{j}")
            for (x, y, z), v in bp.cells.items():
                if x0 <= x < x0 + TILE and z0 <= z < z0 + TILE and v[0] != "keep": t.cells[(x, y, z)] = v
            if t.cells: out.append((f"_{i}_{j}", t))
    return out

def write_all(structures, out):
    sdir = os.path.join(out, "pack", "structures", "hcb"); os.makedirs(sdir, exist_ok=True)
    rows, index, problems = [], [], []
    section = None
    for title, card, bp in structures:
        bp.finish()
        name = slug(card["key"])
        cmds = []
        for suffix, t in tiles(bp):
            lo, hi = t.bounds()
            try: t.save_mcstructure(os.path.join(sdir, name + suffix + ".mcstructure"))
            except ValueError as e: problems.append(str(e)); continue
            cmds.append(f"/structure load hcb:{name}{suffix} ~{lo[0]} ~{lo[1] - 1} ~{lo[2]}")
        lo, hi = bp.bounds()
        index.append({"id": f"hcb:{name}", "title": card["title"], "sub": card.get("sub", ""), "section": title,
                      "size": [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], "commands": cmds})
        if title != section: rows.append(f"\n## {title}\n"); section = title
        rows.append(f"- **{card['title']}** ({card.get('sub', '')}), {hi[0] - lo[0] + 1} x {hi[2] - lo[2] + 1}, {hi[1] - lo[1] + 1} tall\n" +
                    "".join(f"  `{c}`\n" for c in cmds))
        print("wrote", name, len(cmds), "file(s)", flush=True)
    man = {"format_version": 2, "header": {"name": "Hollow Crown builds", "description": "Every building from the catalogue, as structures to load with /structure load hcb:<name>.",
           "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "hollow-crown-builds-pack")), "version": [1, 0, 0], "min_engine_version": [1, 21, 0]},
           "modules": [{"type": "data", "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "hollow-crown-builds-data")), "version": [1, 0, 0]}]}
    json.dump(man, open(os.path.join(out, "pack", "manifest.json"), "w"), indent=1)
    json.dump(index, open(os.path.join(out, "builds.json"), "w"), indent=1)
    open(os.path.join(out, "BUILDS.md"), "w").write(
        "# Hollow Crown builds\n\nStand on the ground where the middle (or the door) of the build should go, facing any way, "
        "and paste its command. Big builds have one command per 64 x 64 piece; paste them all from the same spot.\n"
        "The builds use the add-on's own blocks, so the world needs The Hollow Crown add-on too.\n" + "".join(rows))
    if problems: print("PROBLEMS:\n  " + "\n  ".join(problems))
    print(len(index), "builds")
