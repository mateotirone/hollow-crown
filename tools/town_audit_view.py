#!/usr/bin/env python3
"""The town audit in 3D: every site's blocks with real Minecraft textures and a pin on each finding.

    python3 tools/town_audit_view.py TEXTURES_DIR OUT_DIR AUDIT.json SITE [SITE ...]

TEXTURES_DIR is bedrock-samples' resource_pack/textures/blocks. SITE files are what tools/town_audit.py read
(town_audit_dump.py .npz or sim-hamlet.mjs .json); AUDIT.json is its --out (findings by site name, several files may
be given joined with commas). Writes OUT_DIR/sites/<slug>.json (+ <slug>.bin.txt, gzip in base64: positions and uv in
sixteenths, shade, one normal per quad), OUT_DIR/tex.json (every texture once, as data URIs) and OUT_DIR/index.json.
Only blocks that can be seen are meshed (a face of air or a see-through block next to them), inside the site's
radius and from a few rows under the ground up. Block states go back to the builder's logical blocks the same way
the Town Upgrade Simulator does (studio/town_sim/mesh.py) so stairs, doors, lanterns and plants get their shapes.
"""
import sys, os, json, base64, gzip, re, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "map", "structures"))
sys.path.insert(0, os.path.join(ROOT, "map", "structures", "render"))
import mesher as _mesher  # noqa: E402
from mesher import Mesher, opaque_cube  # noqa: E402
from bp import BEDROCK_ALIAS  # noqa: E402
from town_audit import load_site  # noqa: E402
_mesher.TEX_ALIAS.update({"bricks": "brick", "stonecutter": "stonecutter2_side", "water_cauldron": "cauldron_side"})
_siege_tex = _mesher.siege_tex


def _siege_tex_or_vanilla(n):
    """The add-on's world trees use vanilla textures by path (textures/blocks/cherry_leaves): find those in Mojang's set."""
    d = _siege_tex(n)
    return {k: (os.path.splitext(os.path.basename(v))[0] if os.path.isabs(v) and not os.path.isfile(v) else v) for k, v in d.items()}


_mesher.siege_tex = _siege_tex_or_vanilla

UNALIAS = {v[0]: k for k, v in BEDROCK_ALIAS.items()}
UNALIAS.update({"wooden_door": "oak_door", "trapdoor": "oak_trapdoor", "stonecutter_block": "stonecutter", "brick_block": "bricks",
                "iron_chain": "chain", "darkoak_wall_sign": "dark_oak_wall_sign", "wall_sign": "oak_wall_sign", "fence_gate": "oak_fence_gate",
                "standing_sign": "oak_sign", "darkoak_standing_sign": "dark_oak_sign"})
UNALIAS["grass_path"] = "grass_path"          # the mesher draws Bedrock's own path block
WEIRDO = ["e", "w", "s", "n"]
CARD = {"north": "n", "south": "s", "east": "e", "west": "w"}


def logical(bid, st):
    st = st or {}
    if bid == "siege:track":
        return ("siege:track_preview", {"kind": st.get("siege:kind", 0), "dir": st.get("siege:dir", 0)})
    if bid.startswith("siege:"):
        p = {}
        if "minecraft:cardinal_direction" in st: p["facing"] = CARD.get(st["minecraft:cardinal_direction"], "s")
        if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
        return (bid, p)
    n = bid[10:] if bid.startswith("minecraft:") else bid
    n = UNALIAS.get(n, n)
    p = {}
    if "weirdo_direction" in st: p["facing"] = WEIRDO[st["weirdo_direction"]]
    if st.get("upside_down_bit"): p["half"] = "top"
    if "minecraft:vertical_half" in st: p["half"] = st["minecraft:vertical_half"]
    if "pillar_axis" in st: p["axis"] = st["pillar_axis"]
    if n.endswith("trapdoor"):
        p["facing"] = WEIRDO[st.get("direction", 3) % 4]
        if st.get("open_bit"): p["open"] = True
    if n.endswith("_door"):
        p["facing"] = CARD.get(st.get("minecraft:cardinal_direction", "south"), "s")
        if st.get("upper_block_bit"): p["upper"] = True
        if st.get("door_hinge_bit"): p["hinge"] = True
        if st.get("open_bit"): p["open"] = True
    elif "minecraft:cardinal_direction" in st: p["facing"] = CARD.get(st["minecraft:cardinal_direction"], "s")
    if "hanging" in st: p["hanging"] = bool(st["hanging"])
    if n == "bed":
        p["facing"] = ["s", "w", "n", "e"][st.get("direction", 0) % 4]
        if st.get("head_piece_bit"): p["head"] = True
    if "facing_direction" in st and (n.endswith("wall_sign") or n == "ladder"):
        p["facing"] = {2: "n", 3: "s", 4: "w", 5: "e"}.get(st["facing_direction"], "n")
    if n in ("wheat", "carrots", "potatoes", "beetroot"): p["age"] = st.get("growth", 7)
    return (n, p)


class Seen(dict):
    """All the cells (for face culling), but the mesher walks only the visible ones."""
    def __init__(self, cells, show):
        super().__init__(cells); self.show = show
    def items(self): return ((k, self[k]) for k in self.show)


def slug(n): return re.sub(r"[^a-z0-9]+", "_", n.lower()).strip("_")


def main():
    texroot, out, audits, *sites = sys.argv[1:]
    os.makedirs(os.path.join(out, "sites"), exist_ok=True)
    found = {}
    for a in audits.split(","): found.update(json.load(open(a)))
    texfiles, index = {}, []
    for path in sites:
        meta, pal, xyz, pid = load_site(path)
        name = meta.get("name") or os.path.basename(path)
        t = meta.get("town") or {}
        cx, cz = (t["x"], t["z"]) if t else (meta["x"], meta["z"])
        R = 78 if meta.get("kind") == "hamlet" else meta.get("r", 100)
        L = [logical(n, st) for n, st in pal]
        keep = (np.abs(xyz[:, 0] - cx) <= R) & (np.abs(xyz[:, 2] - cz) <= R)
        xyz, pid = xyz[keep], pid[keep]
        # the ground: the 10th percentile of column tops near the centre; nothing more than 8 under it
        tops = {}
        for (x, y, z) in xyz[::7].tolist():
            if tops.get((x, z), -999) < y: tops[(x, z)] = y
        cy = int(t.get("y") or meta.get("sqy") or np.percentile(list(tops.values()), 50))
        lo = int(np.percentile(list(tops.values()), 3)) - 4
        keep = xyz[:, 1] >= lo
        xyz, pid = xyz[keep], pid[keep]
        opaq = np.array([opaque_cube(c) for c in L] + [False])
        o = xyz.min(0) - 1
        shp = tuple(xyz.max(0) - o + 2)
        g = np.full(shp, len(L), np.int32)
        r = xyz - o
        g[r[:, 0], r[:, 1], r[:, 2]] = pid
        O = opaq[g]
        vis = ~O.copy()
        for ax in range(3):
            for s in (1, -1):
                vis |= ~np.roll(O, s, axis=ax)
        vis &= g != len(L)
        air = {i for i, (n, _) in enumerate(L) if n in ("air", "cave_air", "light_block", "structure_void")}
        cells, show = {}, []
        for (x, y, z), p in zip(r.tolist(), pid.tolist()):
            if p in air: continue
            k = (x + o[0] - cx, y + o[1] - cy, z + o[2] - cz)
            cells[k] = L[p]
            if vis[x, y, z]: show.append(k)
        m = Mesher(Seen(cells, show), texroot).run()
        texfiles.update(m.texfiles)
        # one binary file per site: for each mesh, positions (int16, sixteenths), uv (uint8, sixteenths), shade (uint8),
        # then one normal per quad (int8 x3); the header says where each mesh's parts start
        meshes, blobs, at = [], [], 0
        for key, v in m.out.items():
            nv = len(v["c"])
            parts = [np.round(np.array(v["p"]) * 16).astype("<i2"), np.clip(np.round(np.array(v["uv"]) * 16), 0, 255).astype("u1"),
                     np.clip(np.round(np.array(v["c"]) * 255), 0, 255).astype("u1"), np.array(v["n"], "i1").reshape(-1, 4, 3)[:, 0, :].reshape(-1)]
            offs = []
            for a in parts:
                pad = (-at) % 4
                if pad: blobs.append(b"\0" * pad); at += pad
                offs.append(at); b = a.tobytes(); blobs.append(b); at += len(b)
            meshes.append({"k": key, "cut": v["cut"], "water": v["water"], "glow": v["glow"], "nv": nv, "o": offs})
        bin_name = slug(name) + ".bin.txt"        # gzip, then base64: artifacts serve text, and the meshes pack well
        open(os.path.join(out, "sites", bin_name), "w").write(base64.b64encode(gzip.compress(b"".join(blobs), 9)).decode())
        fs = []
        for f in (found.get(name) or {}).get("findings", []):
            if f.get("at"): fs.append({"kind": f["kind"], "what": f["what"], "sev": f.get("sev", "fix"), "at": [f["at"][0] - cx, f["at"][1] - cy, f["at"][2] - cz]})
        d = {"name": name, "kind": meta.get("kind"), "region": meta.get("region"), "centre": [cx, cy, cz], "radius": R, "bin": bin_name, "meshes": meshes, "findings": fs,
             "stats": (found.get(name) or {}).get("stats", {})}
        f = os.path.join(out, "sites", slug(name) + ".json")
        json.dump(d, open(f, "w"), separators=(",", ":"))
        index.append({"name": name, "kind": meta.get("kind"), "region": meta.get("region"), "file": f"sites/{slug(name)}.json", "findings": len(fs)})
        print(name, len(show), "visible of", len(cells), sum(x["nv"] // 4 for x in meshes), "quads", at // 1024, "KB", flush=True)
    td = tempfile.mkdtemp()
    m = Mesher({}, texroot); m.texfiles = texfiles
    names = m.textures(td)
    tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(td, fn), "rb").read()).decode() for k, fn in names.items()}
    json.dump(tex, open(os.path.join(out, "tex.json"), "w"), separators=(",", ":"))
    json.dump(index, open(os.path.join(out, "index.json"), "w"), indent=1)
    print("textures", len(tex), os.path.getsize(os.path.join(out, "tex.json")) // 1024, "KB")


if __name__ == "__main__":
    main()
