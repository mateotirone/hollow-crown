#!/usr/bin/env python3
"""Tree-only unbreakable blocks for the custom tree assets (map/trees/lock.py explains the rule).

Grows every species in map/trees/species.py, collects each vanilla log, bark, leaf, wall, fence, stair, slab and
trapdoor the trees use, and writes a siege:old_<name> copy of each: behaviour block file, resource-pack texture
entry (pointing at the vanilla texture, so nothing is painted), blocks.json sound, a name, and five shared
geometries (stairs, slab, fence, wall, trapdoor) whose parts show or hide by block state.

The blocks never appear in the creative menu; they exist only inside placed trees.
Run from the repo root:  python3 studio/build_tree_blocks.py   (safe to run again; rerun after adding a species)
Optional: --textures <bedrock-samples>/resource_pack/textures/blocks checks every texture name exists.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
sys.path.insert(0, os.path.join(ROOT, "map", "trees")); sys.path.insert(0, os.path.join(ROOT, "map", "structures", "render"))
from species import CARDS, SIZES
from grow import grow
from lock import kind, tree_id
import mesher

OUT_BLOCKS = os.path.join(BP, "blocks", "trees")
GEO_FILE = os.path.join(RP, "models", "blocks", "old_tree_parts.geo.json")
TINT = {"foliage": "default_foliage", "spruce": "evergreen_foliage", "birch": "birch_foliage"}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f: json.dump(data, f, indent=2); f.write("\n")


def load_jsonc(path):
    raw = open(path, encoding="utf8").read()
    return json.loads(re.sub(r"(?m)^\s*//.*$", "", raw))


def tex_of(name):
    """-> {'side': (texture path, tint), 'end': ...} from the preview renderer's own texture table."""
    k = kind(name)
    if k == "trapdoor":
        w = mesher.wood_of(name); t = {"side": f"{w}_trapdoor" if w != "oak" else "trapdoor"}
    elif k in ("stairs", "slab", "fence", "wall"): t = {"side": mesher.base_material(name)}
    else: t = mesher.cube_tex(name, {})
    out = {}
    for face, spec in t.items():
        tint = None
        if "#" in spec: spec, tint = spec.split("#")
        spec = spec.replace(".tga", "")
        spec = mesher.TEX_ALIAS.get(spec, spec)
        out[face] = (spec, TINT.get(tint))
    return out


def box(o, s): return {"origin": o, "size": s, "uv": {f: {"uv": [0, 0], "uv_size": [16, 16]} for f in ("north", "south", "east", "west", "up", "down")}}


def cube(x0, y0, z0, x1, y1, z1):
    """A cube in block pixels 0..16 with UVs cut from the matching part of the texture (so planks line up)."""
    o = [x0 - 8, y0, z0 - 8]; s = [x1 - x0, y1 - y0, z1 - z0]
    uv = {"north": ([16 - x1, 16 - y1], [x1 - x0, y1 - y0]), "south": ([x0, 16 - y1], [x1 - x0, y1 - y0]),
          "east": ([16 - z1, 16 - y1], [z1 - z0, y1 - y0]), "west": ([z0, 16 - y1], [z1 - z0, y1 - y0]),
          "up": ([x0, z0], [x1 - x0, z1 - z0]), "down": ([x0, 16 - z1], [x1 - x0, z1 - z0])}
    return {"origin": o, "size": s, "uv": {f: {"uv": a, "uv_size": b} for f, (a, b) in uv.items()}}


def bone(name, cubes): return {"name": name, "pivot": [0, 0, 0], "cubes": cubes}


GEOS = {
    # stairs: tall back half along north (-z); the rest turns with siege:dir
    "geometry.siege_old_stairs": [bone("lower", [cube(0, 0, 0, 16, 8, 16)]), bone("upper", [cube(0, 8, 0, 16, 16, 16)]),
                                   bone("back_top", [cube(0, 8, 0, 16, 16, 8)]), bone("back_low", [cube(0, 0, 0, 16, 8, 8)])],
    "geometry.siege_old_slab": [bone("lower", [cube(0, 0, 0, 16, 8, 16)]), bone("upper", [cube(0, 8, 0, 16, 16, 16)])],
    "geometry.siege_old_fence": [bone("post", [cube(6, 0, 6, 10, 16, 10)]),
                                  bone("n", [cube(7, 6, 0, 9, 9, 6), cube(7, 12, 0, 9, 15, 6)]),
                                  bone("s", [cube(7, 6, 10, 9, 9, 16), cube(7, 12, 10, 9, 15, 16)]),
                                  bone("e", [cube(10, 6, 7, 16, 9, 9), cube(10, 12, 7, 16, 15, 9)]),
                                  bone("w", [cube(0, 6, 7, 6, 9, 9), cube(0, 12, 7, 6, 15, 9)])],
    "geometry.siege_old_wall": [bone("post", [cube(4, 0, 4, 12, 16, 12)]),
                                 bone("n", [cube(5, 0, 0, 11, 14, 8)]), bone("s", [cube(5, 0, 8, 11, 14, 16)]),
                                 bone("e", [cube(8, 0, 5, 16, 14, 11)]), bone("w", [cube(0, 0, 5, 8, 14, 11)])],
    # trapdoor: closed low, closed high, or open standing against the north side (turned by siege:dir)
    "geometry.siege_old_trapdoor": [bone("low", [cube(0, 0, 0, 16, 3, 16)]), bone("high", [cube(0, 13, 0, 16, 16, 16)]),
                                     bone("open", [cube(0, 0, 0, 16, 16, 3)])],
}
YAW = {0: 0, 1: 270, 2: 180, 3: 90}      # north, east, south, west (right-handed turn; flagged for an in-game check)


def nameof(n):
    words = n.replace("_", " ").title().replace("Dark Oak", "Dark Oak")
    return "Old " + words


def copy_json(name):
    """The Hollow's own wood (Latticewood): the original block made unbreakable (in the creative menu under Locked World Trees)."""
    import copy, glob
    for f in glob.glob(os.path.join(BP, "blocks", "*.json")):
        d = json.load(open(f, encoding="utf8"))
        b = d.get("minecraft:block", {})
        if b.get("description", {}).get("identifier") != name: continue
        d = copy.deepcopy(d); b = d["minecraft:block"]
        b["description"] = {"identifier": tree_id(name), "menu_category": {"category": "construction"}}
        c = b["components"]; c.pop("minecraft:flammable", None); c.pop("minecraft:loot", None)
        c["minecraft:destructible_by_mining"] = False; c["minecraft:destructible_by_explosion"] = False
        return d
    raise SystemExit(f"{name}: source block not found")


def block_json(name, tex):
    k = kind(name); bid = tree_id(name)
    if k == "copy": return copy_json(name)
    leaves = k == "leaves"
    rm = "alpha_test" if (leaves or k == "trapdoor") else "opaque"
    def mi(spec):
        d = {"texture": "siege_old_" + spec[0].replace("/", "_"), "render_method": rm}
        if spec[1]: d["tint_method"] = spec[1]
        if leaves: d["ambient_occlusion"] = True
        return d
    side = tex["side"]; matinst = {"*": mi(side)}
    if k == "log" and "top" in tex: matinst["up"] = mi(tex["top"]); matinst["down"] = mi(tex.get("bottom", tex["top"]))
    comp = {
        "minecraft:display_name": nameof(name),
        "minecraft:destructible_by_mining": False,
        "minecraft:destructible_by_explosion": False,
        "minecraft:material_instances": matinst,
        "minecraft:map_color": "#3d6b2a" if leaves else "#5a4630",
    }
    states, perms = {}, []
    if k in ("leaves", "log"): comp["minecraft:geometry"] = "minecraft:geometry.full_block"
    if leaves: comp["minecraft:light_dampening"] = 1
    if k == "log":
        states["siege:axis"] = [0, 1, 2]
        perms += [{"condition": "q.block_state('siege:axis') == 1", "components": {"minecraft:transformation": {"rotation": [0, 0, 90]}}},
                  {"condition": "q.block_state('siege:axis') == 2", "components": {"minecraft:transformation": {"rotation": [90, 0, 0]}}}]
    if k == "stairs":
        states.update({"siege:dir": [0, 1, 2, 3], "siege:top": [0, 1]})
        comp["minecraft:geometry"] = {"identifier": "geometry.siege_old_stairs", "bone_visibility": {
            "lower": "q.block_state('siege:top') == 0", "back_top": "q.block_state('siege:top') == 0",
            "upper": "q.block_state('siege:top') == 1", "back_low": "q.block_state('siege:top') == 1"}}
        perms += [{"condition": f"q.block_state('siege:dir') == {d}", "components": {"minecraft:transformation": {"rotation": [0, y, 0]}}} for d, y in YAW.items() if y]
    if k == "slab":
        states["siege:top"] = [0, 1]
        comp["minecraft:geometry"] = {"identifier": "geometry.siege_old_slab", "bone_visibility": {
            "lower": "q.block_state('siege:top') == 0", "upper": "q.block_state('siege:top') == 1"}}
        comp["minecraft:collision_box"] = {"origin": [-8, 0, -8], "size": [16, 8, 16]}
        perms.append({"condition": "q.block_state('siege:top') == 1", "components": {
            "minecraft:collision_box": {"origin": [-8, 8, -8], "size": [16, 8, 16]}, "minecraft:selection_box": {"origin": [-8, 8, -8], "size": [16, 8, 16]}}})
        comp["minecraft:selection_box"] = {"origin": [-8, 0, -8], "size": [16, 8, 16]}
    if k in ("fence", "wall"):
        for d in "nesw": states[f"siege:{d}"] = [0, 1]
        vis = {d: f"q.block_state('siege:{d}') == 1" for d in "nesw"}
        if k == "wall": states["siege:post"] = [0, 1]; vis["post"] = "q.block_state('siege:post') == 1"
        else: vis["post"] = True
        comp["minecraft:geometry"] = {"identifier": f"geometry.siege_old_{k}", "bone_visibility": vis}
        w = 4 if k == "fence" else 8
        comp["minecraft:collision_box"] = {"origin": [-w // 2, 0, -w // 2], "size": [w, 16, w]}
        comp["minecraft:selection_box"] = {"origin": [-w // 2, 0, -w // 2], "size": [w, 16, w]}
    if k == "trapdoor":
        states.update({"siege:dir": [0, 1, 2, 3], "siege:top": [0, 1], "siege:open": [0, 1]})
        comp["minecraft:geometry"] = {"identifier": "geometry.siege_old_trapdoor", "bone_visibility": {
            "open": "q.block_state('siege:open') == 1",
            "low": "q.block_state('siege:open') == 0 && q.block_state('siege:top') == 0",
            "high": "q.block_state('siege:open') == 0 && q.block_state('siege:top') == 1"}}
        comp["minecraft:collision_box"] = False
        comp["minecraft:selection_box"] = {"origin": [-8, 0, -8], "size": [16, 3, 16]}
        perms += [{"condition": f"q.block_state('siege:dir') == {d}", "components": {"minecraft:transformation": {"rotation": [0, y, 0]}}} for d, y in YAW.items() if y]
    if not leaves and k != "log": comp["minecraft:light_dampening"] = 0
    desc = {"identifier": bid, "menu_category": {"category": "construction"}}
    if states: desc["states"] = states
    d = {"format_version": "1.21.60", "minecraft:block": {"description": desc, "components": comp}}
    if perms: d["minecraft:block"]["permutations"] = perms
    return d


def main():
    texdir = None
    if "--textures" in sys.argv: texdir = sys.argv[sys.argv.index("--textures") + 1]
    used = set()
    for card in CARDS.values():
        for size in SIZES:
            for v in range(3):
                for (n, p) in grow(card, size, 1000 + v).cells.values():
                    if kind(n): used.add(n)
    os.makedirs(OUT_BLOCKS, exist_ok=True)
    for f in os.listdir(OUT_BLOCKS):           # drop blocks no tree uses any more
        if f.endswith(".json") and f[:-5] not in {u.split(":")[-1] for u in used}: os.remove(os.path.join(OUT_BLOCKS, f))
    tt_path = os.path.join(RP, "textures", "terrain_texture.json"); tt = load_jsonc(tt_path)
    bj_path = os.path.join(RP, "blocks.json"); bj = load_jsonc(bj_path)
    for k in [k for k in tt["texture_data"] if k.startswith("siege_old_")]: del tt["texture_data"][k]
    for k in [k for k in bj if k.startswith("siege:old_")]: del bj[k]
    missing = []
    for n in sorted(used):
        if kind(n) == "copy":       # keeps its own textures and sound entry
            write_json(os.path.join(OUT_BLOCKS, n.split(":")[-1] + ".json"), copy_json(n))
            bj[tree_id(n)] = {"sound": "wood"}
            continue
        tex = tex_of(n)
        write_json(os.path.join(OUT_BLOCKS, n + ".json"), block_json(n, tex))
        for spec, _ in tex.values():
            tt["texture_data"]["siege_old_" + spec.replace("/", "_")] = {"textures": "textures/blocks/" + spec}
            if texdir and not any(os.path.exists(os.path.join(texdir, spec + e)) for e in (".png", ".tga")): missing.append(spec)
        k = kind(n)
        bj[tree_id(n)] = {"sound": "grass" if k == "leaves" else ("stone" if any(s in n for s in ("tuff", "deepslate", "mud_brick", "cobble", "stone")) else "wood")}
    write_json(tt_path, tt); write_json(bj_path, bj)
    write_json(os.path.join(ROOT, "tools", "vanilla_block_textures.json"),
               sorted({spec for n in used if kind(n) != "copy" for spec, _ in tex_of(n).values()}))
    write_json(GEO_FILE, {"format_version": "1.12.0", "minecraft:geometry": [
        {"description": {"identifier": gid, "texture_width": 16, "texture_height": 16}, "bones": bones} for gid, bones in GEOS.items()]})
    print(len(used), "tree blocks:", ", ".join(sorted(used)))
    if missing: print("MISSING TEXTURES:", sorted(set(missing))); sys.exit(1)


if __name__ == "__main__":
    main()
