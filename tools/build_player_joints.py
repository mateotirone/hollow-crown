#!/usr/bin/env python3
"""Elbows and knees (tools/build_player_joints.py). Run from the repo root; safe to run again.

1. Writes geometry.hc.jointed: the classic 64x64 player body with each arm and leg cut in two at the
   elbow and knee (forearm and shin bones). Box UV is kept: the lower half reads the same skin pixels as
   before (only the palm and sole faces read neighbouring pixels).
2. Uses it for the Looking Glass looks (our own textures, so the layout is known). Players on their own
   skin keep Bedrock's skin model, because the game swaps that in for every player and slim or Character
   Creator skins would not fit a fixed layout.
3. Cuts every armour geometry the same way, so sleeves, greaves and boots bend with the joint. The new
   bones are children of the old ones, so armour still looks the same on a straight-limbed player.
   Re-run this after any armour builder (build_armor3d.py, build_guardgear.py, build_varmor.py,
   build_choirsteel_3d.py ...); check.mjs fails while any armour cube still crosses a joint.
"""
import copy, glob, json, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
RP = os.path.join(ROOT, "Siege_Nights_RP")

# limb bone -> (lower bone, joint height, lower bone pivot)
JOINTS = {
    "rightArm": ("rightForearm", 18.0, [-6.0, 18.0, 0.0]),
    "leftArm": ("leftForearm", 18.0, [6.0, 18.0, 0.0]),
    "rightLeg": ("rightShin", 6.0, [-1.9, 6.0, 0.0]),
    "leftLeg": ("leftShin", 6.0, [1.9, 6.0, 0.0]),
}


def split_cube(c, cut):
    """Split one cube at height `cut`. Returns (upper_cubes, lower_cubes)."""
    oy, h = c["origin"][1], c["size"][1]
    if c.get("rotation") or oy >= cut - 1e-6:
        mid = oy + h / 2
        return ([c], []) if mid >= cut else ([], [c])
    if oy + h <= cut + 1e-6:
        return [], [c]
    w, d = c["size"][0], c["size"][2]
    hu, hl = oy + h - cut, cut - oy  # upper and lower heights
    up, lo = copy.deepcopy(c), copy.deepcopy(c)
    up["origin"] = [c["origin"][0], cut, c["origin"][2]]
    up["size"] = [w, hu, d]
    lo["size"] = [w, hl, d]
    uv = c.get("uv")
    if isinstance(uv, list):
        # box UV: the side strip starts at v+d, so moving the lower cube's v down by hu lines its sides up
        # with the bottom part of the original strip. Only its top (hidden in the joint) and bottom (sole of
        # the hand or foot) faces read other pixels.
        lo["uv"] = [uv[0], uv[1] + hu]
        if c.get("inflate"):
            # inflated halves overlap at the joint; keep the lower one a hair inside so they don't flicker
            lo["inflate"] = round(c["inflate"] - 0.02, 3)
        return [up], [lo]
    if isinstance(uv, dict):
        # per-face UV: cut the four side faces at the same fraction; top stays up, bottom goes down
        fu = hu / h
        for f in ("north", "south", "east", "west"):
            if f not in uv:
                continue
            fv = uv[f]
            (u0, v0), (su, sv) = fv["uv"], fv.get("uv_size", [w, h])
            up["uv"][f] = {**fv, "uv": [u0, v0], "uv_size": [su, sv * fu]}
            lo["uv"][f] = {**fv, "uv": [u0, v0 + sv * fu], "uv_size": [su, sv * (1 - fu)]}
        if "down" in uv:
            up["uv"]["down"] = copy.deepcopy(uv.get("up", uv["down"]))
        if "up" in uv:
            lo["uv"]["up"] = copy.deepcopy(uv.get("down", uv["up"]))
        if c.get("inflate"):
            lo["inflate"] = round(c["inflate"] - 0.02, 3)
        return [up], [lo]
    return ([c], []) if oy + h / 2 >= cut else ([], [c])


def joint_bones(g):
    """Add forearm/shin bones to one geometry and move or cut cubes into them. Returns True if changed."""
    bones = g.get("bones", [])
    names = {b["name"] for b in bones}
    changed = False
    out = []
    for b in bones:
        out.append(b)
        spec = JOINTS.get(b["name"])
        if not spec:
            continue
        low_name, cut, pivot = spec
        upper, lower = [], []
        for c in b.get("cubes", []):
            u, l = split_cube(c, cut)
            upper += u
            lower += l
        if not lower:
            continue
        b["cubes"] = upper
        if not upper:
            del b["cubes"]
        low = next((x for x in bones if x["name"] == low_name), None)
        if low is None:
            low = {"name": low_name, "parent": b["name"], "pivot": pivot, "cubes": []}
            out.append(low)
            names.add(low_name)
        low.setdefault("cubes", []).extend(lower)
        changed = True
    g["bones"] = out
    return changed


def crossing(g):
    """Cubes on an upper limb bone that still reach below the joint (for check.mjs-style reporting)."""
    bad = []
    for b in g.get("bones", []):
        spec = JOINTS.get(b["name"])
        if not spec:
            continue
        for c in b.get("cubes", []):
            if not c.get("rotation") and c["origin"][1] < spec[1] - 1e-6 and c["size"][1] > 0:
                bad.append(b["name"])
    return bad


CARRIER = "controller.render.hc_look.item_carrier"
LOOK_ON = "(query.has_property('hc:look') ? query.property('hc:look') : 0) >= 1"


def jointed_geometry():
    def cube(o, s, uv, inflate=0.0):
        c = {"origin": o, "size": s, "uv": uv}
        if inflate:
            c["inflate"] = inflate
        return c

    def limb(name, parent, pivot, origin, uv, sleeve_name, sleeve_uv):
        low, cut, lp = JOINTS[name]
        top = cube(origin, [4, 12, 4], uv)
        sl = cube(origin, [4, 12, 4], sleeve_uv, 0.25)
        b_up = {"name": name, "parent": parent, "pivot": pivot, "cubes": [top]}
        b_sl = {"name": sleeve_name, "parent": name, "pivot": pivot, "cubes": [sl]}
        b_low = {"name": low, "parent": name, "pivot": lp, "cubes": []}
        b_low_sl = {"name": low + "Sleeve", "parent": low, "pivot": lp, "cubes": []}
        u, l = split_cube(top, cut)
        b_up["cubes"], b_low["cubes"] = u, l
        u, l = split_cube(sl, cut)
        b_sl["cubes"], b_low_sl["cubes"] = u, l
        return [b_up, b_sl, b_low, b_low_sl]

    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
        {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [cube([-4, 12, -2], [8, 12, 4], [16, 16])]},
        {"name": "jacket", "parent": "body", "pivot": [0, 24, 0], "cubes": [cube([-4, 12, -2], [8, 12, 4], [16, 32], 0.25)]},
        {"name": "cape", "parent": "body", "pivot": [0, 24, 3]},
        {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [cube([-4, 24, -4], [8, 8, 8], [0, 0])]},
        {"name": "hat", "parent": "head", "pivot": [0, 24, 0], "cubes": [cube([-4, 24, -4], [8, 8, 8], [32, 0], 0.5)]},
    ]
    bones += limb("rightArm", "body", [-5, 22, 0], [-8, 12, -2], [40, 16], "rightSleeve", [40, 32])
    bones += limb("leftArm", "body", [5, 22, 0], [4, 12, -2], [32, 48], "leftSleeve", [48, 48])
    bones += limb("rightLeg", "root", [-1.9, 12, 0], [-3.9, 0, -2], [0, 16], "rightPants", [0, 32])
    bones += limb("leftLeg", "root", [1.9, 12, 0], [-0.1, 0, -2], [16, 48], "leftPants", [0, 48])
    # Held items hang on the UPPER arm, exactly like vanilla (root>waist>body>rightArm>rightItem). Bedrock only
    # attaches held items when a second player geometry keeps the default bone path to rightItem; with the
    # item bone under the forearm every held item floated at the chest or face (playtest 1.2.1116). The
    # animations fold the elbow bend into the shoulder while that hand holds something (build_player_anims.py).
    bones.append({"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1], "locators": {"lead_hold": [-6, 15, 1]}})
    bones.append({"name": "leftItem", "parent": "leftArm", "pivot": [6, 15, 1]})
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.hc.jointed", "texture_width": 64, "texture_height": 64,
                            "visible_bounds_width": 2, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": bones,
        }],
    }


def dump(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def main():
    dump(os.path.join(RP, "models/entity/hc_jointed.geo.json"), jointed_geometry())

    # armour: every geometry under models/entity that has limb bones, except mobs (bestiary has its own rigs)
    n = 0
    for path in sorted(glob.glob(os.path.join(RP, "models/entity/**/*.json"), recursive=True)):
        rel = os.path.relpath(path, RP)
        if "/bestiary/" in rel or rel.endswith("hc_jointed.geo.json"):
            continue
        try:
            d = json.load(open(path))
        except ValueError:
            continue
        geos = d.get("minecraft:geometry", [])
        if not any(b.get("name") in JOINTS for g in geos for b in g.get("bones", [])):
            continue
        if not any(g["description"]["identifier"].startswith("geometry.siege_") for g in geos):
            continue
        if any(joint_bones(g) for g in geos):
            dump(path, d)
            n += 1

    # the looks use the jointed body; first-person shows the forearm with the arm
    ep = os.path.join(RP, "entity/player.entity.json")
    ent = json.load(open(ep))
    ent["minecraft:client_entity"]["description"]["geometry"]["hc_look"] = "geometry.hc.jointed"
    dump(ep, ent)
    rp = os.path.join(RP, "render_controllers/hc_looks.render_controllers.json")
    rc = json.load(open(rp))
    fp = rc["render_controllers"]["controller.render.hc_look.first_person"]["part_visibility"]
    have = {k for e in fp for k in e}
    for arm, extra in (("rightArm", ["rightForearm", "rightForearmSleeve"]), ("leftArm", ["leftForearm", "leftForearmSleeve"])):
        cond = next(e[arm] for e in fp if arm in e)
        for name in extra:
            if name not in have:
                fp.append({name: cond})
    # Item carrier: Bedrock places held items from the player's DEFAULT geometry (their skin model), not from
    # the look's geometry. With only the look drawn, the default model is never posed, so items stayed put
    # while the arm swung (playtest 1.2.1519). Draw the default model too, every part hidden, so the same
    # animations pose it and the item follows the arm. It must come before the look's own controllers.
    rc["render_controllers"][CARRIER] = {
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": ["Texture.default"],
        "part_visibility": [{"*": False}],
    }
    dump(rp, rc)
    rcs = [e for e in ent["minecraft:client_entity"]["description"]["render_controllers"] if CARRIER not in (e if isinstance(e, dict) else {e: 1})]
    first_look = next(i for i, e in enumerate(rcs) if isinstance(e, dict) and any(k.startswith("controller.render.hc_look.") for k in e))
    rcs.insert(first_look, {CARRIER: f"!query.is_spectator && !variable.map_face_icon && {LOOK_ON}"})
    ent["minecraft:client_entity"]["description"]["render_controllers"] = rcs
    dump(ep, ent)
    print(f"geometry.hc.jointed written; {n} armour geometries cut at the elbow/knee")


if __name__ == "__main__":
    main()
