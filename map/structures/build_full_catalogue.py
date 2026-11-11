"""The whole building catalogue in one go: map town buildings, every settlement building and hall tier
in each region, all ten wall levels in each region, and the Citadel. One picture per card.

    node settle_dump.mjs WORK/settle.json
    python3 build_full_catalogue.py WORK/settle.json OUT_DIR --textures DIR --three DIR [--only PREFIX]

Writes OUT_DIR/img/<key>.jpg and OUT_DIR/full-catalogue.json (sections -> cards). Pictures are
rendered with the same real-texture renderer as the town previews; one browser shoots them all.
"""
import os, sys, json, base64, argparse, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "render"))
from bp import Blueprint
from mesher import Mesher
import vale_civic, settle_halls, settle_buildings, hollow_kit
from build_catalogue import DESIGNS, STYLE_NAMES

REGION_GROUND = {"vale": ("grass_block", "dirt"), "frostmarch": ("snow", "dirt"), "saltreach": ("sand", "sandstone"),
                 "emberwaste": ("red_sand", "red_sandstone"), "blackfen": ("mud", "mud")}
STYLE_GROUND = {"frost": "frostmarch", "salt": "saltreach", "ember": "emberwaste", "fen": "blackfen"}
CITADEL = {"stone": "siege:castle_stone", "smooth": "siege:castle_smooth", "band": "siege:castle_bricks", "plinth": "siege:castle_cobbled", "tile": "deepslate_tiles", "floor": "polished_deepslate", "quartz": "quartz_block", "gold": "gold_block",
           "battlement": "siege:battlement", "slit": "siege:arrow_slit", "spire": "siege:spire_roof", "brazier": "siege:brazier", "port": "siege:portcullis",
           "throne": "gold_block", "wool": "red_wool", "carpet": "red_carpet", "ladder": "ladder"}

def from_cells(name, cells, kinds=None):
    b = Blueprint(name)
    for c in cells:
        x, y, z, n = c[:4]; p = c[4] if len(c) > 4 and isinstance(c[4], dict) else {}
        if kinds is not None: n = kinds.get(n, n)
        if n in ("air", "gap", "open", "walk"): continue
        b.set(x, y, z, n, **p)
    return b

def roof_cell(c, kinds):
    """A wall tower's roof stair "roof:<dir>" becomes the region's roof stair rising that way."""
    if isinstance(c[3], str) and c[3].startswith("roof:"): return [c[0], c[1], c[2], kinds["roofStair"], {"facing": c[3][5:]}]
    return c

def card_scene(b, ground=("grass_block", "dirt"), margin=3, view=None):
    b.finish(); lo, hi = b.bounds()
    sc = Blueprint(b.name + "_card"); sc.paste(b, 0, 0, 0)
    top, under = ground
    for x in range(lo[0] - margin, hi[0] + margin + 1):
        for z in range(lo[2] - margin, hi[2] + margin + 1):
            if sc.get(x, 0, z)[0] == "keep": sc.set(x, 0, z, top)
            if sc.get(x, -1, z)[0] == "keep": sc.set(x, -1, z, under)
    sc.finish()
    w, d, h = hi[0] - lo[0], hi[2] - lo[2], hi[1] + 1
    ext = max(w, d) + 2 * margin + 1
    tgt = [(lo[0] + hi[0] + 1) / 2, max(2, h * 0.42), (lo[2] + hi[2] + 1) / 2]
    az, el, k = view or (-38, 22, 1.25)
    sc.camera = {"views": {"card": [az, el, max(ext * k, h * 2.4)] + tgt}}
    return sc, [w + 1, h, d + 1], sum(1 for v in b.cells.values() if v[0] not in ("air", "keep"))

def page_for(sc, work, key, textures, title):
    cells = {k: v for k, v in sc.cells.items() if v[0] != "keep"}
    m = Mesher(cells, textures).run()
    sub = os.path.join(work, key); os.makedirs(sub, exist_ok=True)
    names = m.textures(os.path.join(sub, "tex"))
    tex = {k: "data:image/png;base64," + base64.b64encode(open(os.path.join(sub, "tex", f), "rb").read()).decode() for k, f in names.items()}
    xs, ys, zs = zip(*cells)
    data = {"meshes": m.out, "textures": names, "bounds": [min(xs), min(ys), min(zs), max(xs) + 1, max(ys) + 1, max(zs) + 1], "camera": sc.camera}
    html = open(os.path.join(HERE, "render", "viewer.tpl.html")).read()
    html = html.replace("__TITLE__", title).replace("__BLURB__", "").replace("__DATA__", json.dumps(data, separators=(",", ":"))).replace("__TEX__", json.dumps(tex))
    page = os.path.join(sub, "viewer.html")
    if not os.path.exists(page) or open(page).read() != html: open(page, "w").write(html)
    return page

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dump"); ap.add_argument("out")
    ap.add_argument("--textures", required=True); ap.add_argument("--three", required=True); ap.add_argument("--only", default="")
    ap.add_argument("--procs", type=int, default=3, help="browsers shooting in parallel")
    a = ap.parse_args()
    D = json.load(open(a.dump)); img = os.path.join(a.out, "img"); work = os.path.join(a.out, "_work")
    os.makedirs(img, exist_ok=True)
    sections, jobs = [], []

    def add(sec, key, title, sub, blurb, make, ground=("grass_block", "dirt"), view=None, status="new", extra=None):
        card = {"key": key, "title": title, "sub": sub, "blurb": blurb, "image": f"img/{key}.jpg", "status": status, **(extra or {})}
        sec["cards"].append(card)
        if a.only and not key.startswith(a.only): return
        sc, size, n = card_scene(make(), ground, view=view)
        card["size"] = size; card["blocks"] = n
        jobs.append([page_for(sc, work, key, a.textures, title), os.path.join(work, key, "shot.png"), "card", 1400, 900])

    # ---- 1. Map towns: the buildings stamped into the world map ----
    sec = {"id": "map", "title": "Map towns", "blurb": "Fixed buildings stamped into the world map before release. Interiors are left empty for players, except the inn.", "cards": []}
    sections.append(sec)
    for d in DESIGNS:
        for style in ([d["only"]] if d.get("only") else ("tudor", "stone", "brick")):
            g = REGION_GROUND[STYLE_GROUND.get(style, "vale")]
            add(sec, f"map-{d['key']}-{style}", d["title"], STYLE_NAMES[style], d["use"], (lambda d=d, s=style: d["make"](s)), g,
                extra={"where": d["where"], "kind": d["kind"]})
    add(sec, "map-millbrook_clock_tower", "Millbrook clock tower", "Norman stone", "Three storeys and a belfry with clock faces and a stepped spire, in the middle of Millbrook's square.",
        lambda: vale_civic.clock_tower(), extra={"where": "Millbrook, the square", "kind": "Civic"})
    add(sec, "map-millbrook_watermill", "Millbrook watermill", "Stone and timber", "Stone ground floor on the river bank, timber above, with a working-looking wheel in the water.",
        lambda: vale_civic.watermill(), extra={"where": "Millbrook, on the river", "kind": "Civic"})

    # ---- 2. Settlements: what grows on a player's plot ----
    for rid, r in D["regions"].items():
        g = REGION_GROUND.get(rid, ("grass_block", "dirt"))
        sec = {"id": "settle-" + rid, "title": f"{r['name']} settlement", "blurb": r["blurb"], "cards": []}
        sections.append(sec)
        NEW = settle_halls.REGION_HALLS.get(rid)
        for i, cells in enumerate(r["halls"]):
            t = D["hallTiers"][i]
            make = (lambda f=NEW, l=i + 1: f(l)) if NEW else (lambda c=cells, k=f"hall_{rid}_{i}": from_cells(k, c))
            add(sec, f"hall-{rid}-{i + 1}", f"Town hall {i + 1}: {t['name']}", f"{t['settlement']} tier", f"The hall at level {i + 1}, when the settlement becomes a {t['settlement']}.",
                make, g, status="new" if NEW else "old", extra={"group": "Town hall upgrades", "tier": i + 1})
        for b in D["buildings"]:
            NEWB = settle_buildings.BUILDERS.get(b["id"]) if rid in settle_buildings.REGIONS else None
            make = (lambda f=NEWB, r=rid: f(r)) if NEWB else (lambda c=r["buildings"][b["id"]], k=f"{b['id']}_{rid}": from_cells(k, c))
            add(sec, f"bld-{rid}-{b['id']}", b["name"], r["name"], b["blurb"], make, g,
                status="new" if NEWB else "old", extra={"group": "Plot buildings"})

    # ---- 3. Walls: ten levels, each region's stone ----
    sec = {"id": "walls", "title": "Settlement walls", "blurb": "The ring wall raised round every plot, upgraded at the town hall. Shown here: the stretch round the gate.", "cards": []}
    sections.append(sec)
    for w in D["wallLevels"]:
        for rid, r in D["regions"].items():
            add(sec, f"wall-{w['level']:02d}-{rid}", f"Wall {w['level']}: {w['name']}", r["name"], "",
                (lambda c=w["cellsBy"][rid], k=r["kinds"], n=f"wall_{w['level']}_{rid}": from_cells(n, [roof_cell(x, k) for x in c], k)), REGION_GROUND.get(rid), view=(-28, 20, 0.95), status="new",
                extra={"level": w["level"], "region": rid})

    # ---- 4. Strongholds ----
    sec = {"id": "strongholds", "title": "Strongholds", "blurb": "The biggest builds: the ruler's Citadel. Town hall levels 4 and 5 (Fortress, Sovereign's Throne) are in each settlement section.", "cards": []}
    sections.append(sec)
    add(sec, "stronghold-citadel", "The Citadel", "Raised by the ruler", "Curtain wall with eight round towers, a gatehouse and the 25 by 25 Great Keep. Built from the Citadel Cornerstone once someone holds the Heart.",
        lambda: from_cells("citadel", [c[:4] for c in D["citadel"]], CITADEL), view=(-35, 32, 1.05), status="new")

    # ---- 5. The Hollow: its own kit, its own world ----
    sec = {"id": "hollow", "title": "The Hollow", "blurb": "The Hollow is its own world, so its buildings are its own: dark veinstone and blackstone, black timber with pale ash, steep deepslate roofs, warm windows where the miners live and soul light everywhere else. Nothing stands quite straight.", "cards": []}
    sections.append(sec)
    HG = ("siege:undertow_moss", "cobbled_deepslate")
    add(sec, "hollow-village", "A mining village", "Glimwade, Lowseam, Tollrest, Highcut", "Foreman's house and two cottages round the yard, the smithy with its smoking chimney, the ore-sorting shed by the rails from the mine mouths, the Tally under its purple awning, soul lamps and fences. Each village turns its houses a little differently.",
        lambda: hollow_kit.village("glimwade", 0), HG, view=(-38, 34, 1.3), extra={"wide": True})
    add(sec, "hollow-cottage", "Miner's cottage", "Two storeys", "Veinstone below, a black-and-ash upper floor that juts out and sits a block out of true, a steep deepslate roof.",
        lambda: hollow_kit.cottage(5, 7, 7, "s", 2, 1), HG, view=(-38, 30, 1.4))
    add(sec, "hollow-drowned_city", "The drowned city", "By the Court landing", "Hallowmere's own country: seven leaning towers on the marsh banks where the light river ends, seen from the path to the Court. Every one is out of true; two have lost their tops; a few windows are still lit.",
        lambda: hollow_kit.drowned_city_preview(), HG, view=(-38, 26, 1.0), extra={"wide": True})
    for sid, title, blurb, yaw in (("truce_hall", "The Truce Hall", "Where two kings sat down. A long buttressed hall with tall lit windows, its roof fallen in at the far end. One table, two seats, one knocked over.", -38),
                                   ("far_door", "The Far Door", "The Hollow's side of the Gate: a sealed pointed arch in the rock face, scaffold towers with a beam and a hanging soul lantern, dig pits, braziers.", 142),
                                   ("pilgrims_cross", "Pilgrim's Cross", "The west crossroads: a four-armed signpost on a stepped plinth and a roofed bench for travellers.", -38),
                                   ("cartmeet", "Cartmeet", "Where the ore carts turn: a cart shelter over the rail, barrels, a signpost.", -38),
                                   ("the_seams", "The Seams", "An open ore face with a timbered mouth and a winch house over the rail.", -38),
                                   ("lattice_gate", "The Lattice Wood", "A woodcutter's shed where the lane meets the thick forest, cut lattice stacked to dry.", -38),
                                   ("wound_dock", "The Wound landing", "The first dock a new arrival sees: a plank landing on log piles and a boatwright's shed with a boat half built.", -38)):
        add(sec, f"hollow-{sid}", title, "Hollow centre", blurb, hollow_kit.SITE_BUILDERS[sid], HG, view=(yaw, 32, 1.3))

    print("cards", sum(len(s["cards"]) for s in sections), "to shoot", len(jobs), flush=True)
    jf = os.path.join(work, "jobs.json"); json.dump(jobs, open(jf, "w"))
    n = a.procs
    procs = [subprocess.Popen(["node", os.path.join(HERE, "render", "shoot_many.cjs"), jf, a.three, str(n), str(i)]) for i in range(n)]
    if any(p.wait() for p in procs): sys.exit("a screenshot process failed")
    from PIL import Image
    for page, shot, *_ in jobs:
        key = os.path.basename(os.path.dirname(shot))
        Image.open(shot).convert("RGB").resize((980, 630), Image.LANCZOS).save(os.path.join(img, key + ".jpg"), quality=84)
    dest = os.path.join(a.out, "full-catalogue.json")
    if a.only and os.path.exists(dest):   # cards not re-shot this time keep their measured size
        before = {c["key"]: c for s in json.load(open(dest)) for c in s["cards"]}
        for s in sections:
            for c in s["cards"]:
                for f in ("size", "blocks"):
                    if f not in c and f in before.get(c["key"], {}): c[f] = before[c["key"]][f]
    json.dump(sections, open(dest, "w"), indent=1)

if __name__ == "__main__":
    main()
