"""Every landmark and story place as a preview scene, for the asset viewer's Builds tab (tools/asset-viewer).

    python3 landmark_scenes.py OUT

-> OUT/<design>/scene.json (the design on a grass pad, cellars and piles shown below it) and OUT/names.json.
The real placement (fill, cuts, the map's own ground) is in Siege_Nights_BP/scripts/landmarks/plan.js; these show
the design itself, front (-z) to the north.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import export_landmarks as X  # noqa: E402  (sets up the skill's path)
import landmarks as LM  # noqa: E402
import landmarks_story as LS  # noqa: E402

PAD = {"Blackfen": "mud", "Frostmarch": "snow", "Emberwaste": "sand"}
REGION = {"tidewatch_posts": "Saltreach", "gullcliff_beacon": "Saltreach", "reedmoor_ring": "Blackfen", "lanternbog_posts": "Blackfen",
          "redmesa_stones": "Emberwaste", "dunehold_hall": "Emberwaste", "dunehold_well": "Emberwaste", "dunehold_palms": "Emberwaste",
          "frosthelm_road": "Frostmarch", "wolfcairn_cairn": "Frostmarch", "deepforge": "Frostmarch", "cinder_roost": "Emberwaste",
          "mags_hut": "Blackfen", "nell_raft": "Blackfen", "ashen_watch": "Blackfen",
          "shut_pass_gate": "Frostmarch", "vorlunds_muster": "Frostmarch"}


def title(name, fn):
    doc = (fn.__doc__ or "").strip()
    for sep in (":", ",", "."): doc = doc.split(sep)[0]
    return doc if doc else name.replace("_", " ").title()


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "landmark-scenes"
    os.makedirs(out, exist_ok=True)
    names = {}
    for name, fn in {**LM.DESIGNS, **LS.STORY_DESIGNS}.items():
        d = fn()
        blocks = X.compute(d.spec())
        for c in d.airs(): blocks.pop(c, None)
        pal, idx, rows = [], {}, []

        def ix(n, p):
            k = json.dumps([n, p], sort_keys=True)
            if k not in idx: idx[k] = len(pal); pal.append([n, p])
            return idx[k]

        xs = [c[0] for c in blocks]; zs = [c[2] for c in blocks]
        pad = PAD.get(REGION.get(name), "grass_block")
        if d.meta.get("mode") != "drape" or not d.meta.get("rise"):
            for x in range(min(xs) - 2, max(xs) + 3):
                for z in range(min(zs) - 2, max(zs) + 3):
                    if (x, -1, z) not in blocks and (x, 0, z) not in blocks: rows.append([x, -1, z, ix(pad, {})])
        else:   # it stands in water
            for x in range(min(xs) - 2, max(xs) + 3):
                for z in range(min(zs) - 2, max(zs) + 3):
                    if (x, 0, z) not in blocks: rows.append([x, 0, z, ix("water", {})])
                    rows.append([x, -3, z, ix("mud", {})])
        for (x, y, z), (n, p) in sorted(blocks.items()):
            if n != "air": rows.append([x, y, z, ix(n, p)])
        os.makedirs(os.path.join(out, name), exist_ok=True)
        json.dump({"name": name, "palette": pal, "blocks": rows}, open(os.path.join(out, name, "scene.json"), "w"), separators=(",", ":"))
        kind = ("Boss arena · " if name == "vorlunds_muster" else "Sealed way out · " if name in LS.DOOR_DESIGNS
                else "Story place · " if name in LS.STORY_DESIGNS else "Plot landmark · ")
        names[name] = kind + title(name, fn)
        print(name, len(rows))
    import portal   # the rail tunnel portals, one per region, in a bit of hillside
    for reg in portal.REGIONS:
        key = "portal_" + reg.split()[-1].lower()
        pad = PAD.get(reg, "grass_block")
        cells = {}
        for x in range(-9, 10):
            for z in range(-8, 6):
                g = 12 if z <= 0 else (0 if abs(x) <= 6 else max(0, 12 - 2 * z))
                for y in range(0, g + 1): cells[(x, y, z)] = (pad if y == g else "stone", {})
        for x in range(-1, 2):
            for z in range(-8, 6): cells[(x, 0, z)] = ("gravel", {})
        for x, y, z, b, p in portal.portal_blocks({"x": 0, "z": 0, "floor_y": 0, "out": (0, 1)}, reg):
            if b == "air": cells.pop((x, y, z), None)
            else: cells[(x, y, z)] = (b, p)
        for z in range(-8, -3):
            for x in range(-1, 2):
                for y in range(1, 7): cells.pop((x, y, z), None)
        pal, idx = [], {}
        rows = []
        for (x, y, z), (n, p) in sorted(cells.items()):
            k = json.dumps([n, p], sort_keys=True)
            if k not in idx: idx[k] = len(pal); pal.append([n, p])
            rows.append([x, y, z, idx[k]])
        os.makedirs(os.path.join(out, key), exist_ok=True)
        json.dump({"name": key, "palette": pal, "blocks": rows}, open(os.path.join(out, key, "scene.json"), "w"), separators=(",", ":"))
        names[key] = f"Rail tunnel portal · {reg}"
    import subprocess   # the Drowned Court and the Seat (hollow_arenas.py writes their scenes)
    subprocess.run([sys.executable, os.path.join(HERE, "hollow_arenas.py"), "--scenes", out, "--no-write"], check=True)
    names["court_design"] = "Hollow · The Drowned Court"
    names["seat_design"] = "Hollow · The Seat"
    json.dump(names, open(os.path.join(out, "names.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
