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
import random, re
import vale_civic, settle_halls, settle_buildings, hollow_kit, capital, stations, regions_towns as RT
from build_catalogue import DESIGNS, STYLE_NAMES

REGION_GROUND = {"vale": ("grass_block", "dirt"), "frostmarch": ("snow", "dirt"), "saltreach": ("sand", "sandstone"),
                 "emberwaste": ("red_sand", "red_sandstone"), "blackfen": ("mud", "mud")}
STYLE_GROUND = {"frost": "frostmarch", "salt": "saltreach", "ember": "emberwaste", "fen": "blackfen"}
CITADEL = {"stone": "siege:castle_stone", "smooth": "siege:castle_smooth", "band": "siege:castle_bricks", "plinth": "siege:castle_cobbled", "tile": "deepslate_tiles", "floor": "polished_deepslate", "quartz": "quartz_block", "gold": "gold_block",
           "battlement": "siege:battlement", "slit": "siege:arrow_slit", "spire": "siege:spire_roof", "brazier": "siege:brazier", "port": "siege:portcullis",
           "throne": "gold_block", "wool": "red_wool", "carpet": "red_carpet", "ladder": "ladder"}

TOWNS = (("rimehold", "Rimehold", "frostmarch", "frost", "The Frostmarch town: dark log frames, plank walls in rows, dark stone bases and steep snow-capped roofs, a longhouse hall and a stave chapel under weathered copper."),
         ("gulls_rest", "Gull's Rest", "saltreach", "salt", "The Saltreach harbour, Atlantean: pale stone and quartz columns on sea-worn prismarine, sea-glass windows, roofs that never repeat (low hips, mansards, bell roofs, domes, temple fronts, terraces and towers) in sea green, teal, white and copper, a quay, a lighthouse and a boathouse."),
         ("sunscar", "Sunscar", "emberwaste", "ember", "The Emberwaste town: thick sandstone walls, flat roofs behind parapets, lattice windows, striped awnings and a domed market hall."),
         ("mirelight", "Mirelight", "blackfen", "fen", "The Blackfen town: mud brick between mangrove posts, houses up on stilts over the black water, mossy roofs and froglights by the doors."))
HOUSE_BLURB = {"frost": ["Two storeys, a dark stone ground floor or plank rows to the ground, dragon heads on the gable.", "One or two storeys of plank rows in a spruce frame, a steep roof that sheds snow.",
                         "A small cottage: low walls, a roof nearly to the ground, snow on the ridge.", "A byre: a dark stone base, plank rows and a very steep roof over the cart door."],
               "salt": ["Pale stone and quartz columns on a prismarine plinth, sea-glass windows, a roof from the town's seven forms.", "A pale stone street house with sea-glass windows under a hip, mansard, bell, temple or dome roof.",
                        "A one-storey pale stone cottage under a low hip, a bell roof or a small dome.", "A net store: pale stone on a prismarine plinth, a low gable, a big plank door."],
               "ember": ["Two storeys of painted sandstone, a roof terrace behind the parapet, lattice windows, roof beams.", "A sandstone house with a striped awning over the door; some carry a red roof or dome.",
                         "A small flat-roofed house with a roof hatch.", "A granary with a walled yard and hay under an awning."],
               "fen": ["Mud brick between mangrove posts, two storeys up on short stilts, a froglight by the stair.", "A stilt house with a stair down to the boardwalk.",
                       "A small stilt cottage.", "A thatched barn on short stilts."]}
CIVIC_TITLE = {"hall": "Longhouse hall", "stave_chapel": "Stave chapel", "inn": "Inn", "smithy": "Smithy", "store": "General store", "market_hall": "Market hall",
               "quay": "Harbour quay", "lighthouse": "Lighthouse", "boathouse": "Boathouse", "stilt_house": "Stilt house on the water", "stilt_house_big": "Big stilt house on the water"}
TOWN_BLURB = {("gulls_rest", "quay"): "The quay wall with bollards, a jetty on piles, a cargo crane, barrels and kelp, and the harbourmaster's hut.",
              ("gulls_rest", "lighthouse"): "A white tower banded in sea green with a gallery, a glass lamp room of sea lanterns and a copper cap, and the keeper's cottage.",
              ("gulls_rest", "boathouse"): "A stone shed straddling the shore, open at the back over a water slip, a net loft above.",
              ("mirelight", "stilt_house"): "Tall stilts down into the mire, the back half over the water, a mooring platform behind.",
              ("mirelight", "stilt_house_big"): "Two storeys on tall stilts over the water.",
              ("rimehold", "inn"): "Two storeys of dark stone and plank rows, a tap room with a bar and hearth, bedrooms upstairs. The only furnished building.",
              ("gulls_rest", "inn"): "A stone and whitewash inn under an orange hipped roof, a tap room and bedrooms upstairs. The only furnished building.",
              ("mirelight", "inn"): "Mud brick and mangrove under a mossy roof, a tap room and bedrooms upstairs. The only furnished building.",
              ("sunscar", "inn"): "A caravanserai round a courtyard with a palm and a well, a corner tower and a striped gate awning."}

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
    ap.add_argument("--mcstructure", default="", help="write every build as .mcstructure files into this folder instead of rendering")
    ap.add_argument("--viewer3d", default="", help="write the 3D catalogue (index.html, data/, tex.json) into this folder instead of rendering")
    ap.add_argument("--procs", type=int, default=3, help="browsers shooting in parallel")
    a = ap.parse_args()
    D = json.load(open(a.dump)); img = os.path.join(a.out, "img"); work = os.path.join(a.out, "_work")
    os.makedirs(img, exist_ok=True)
    sections, jobs, structures = [], [], []

    def add(sec, key, title, sub, blurb, make, ground=("grass_block", "dirt"), view=None, status="new", extra=None):
        card = {"key": key, "title": title, "sub": sub, "blurb": blurb, "image": f"img/{key}.jpg", "status": status, **(extra or {})}
        sec["cards"].append(card)
        if a.only and not re.match(a.only, key): return
        if a.mcstructure:
            structures.append((sec["title"], card, make())); return
        if a.viewer3d:
            structures.append((sec, card, make, ground, view)); return
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
    add(sec, "map-kingsrest_capital", "Kingsrest capital hall", "Grand medieval", "The grandest building in the game: Norman stone and dark timber, a two-tier drum under a copper dome that weathers from green at the top to bright copper at the eaves, long wings with corner towers, and a walled garden forecourt.",
        lambda: capital.medieval(), view=(20, 30, 1.3), extra={"where": "Kingsrest, the heart of the royal town", "kind": "Civic"})
    add(sec, "map-millbrook_clock_tower", "Millbrook clock tower", "Norman stone", "Three storeys and a belfry with clock faces and a stepped spire, in the middle of Millbrook's square.",
        lambda: vale_civic.clock_tower(), extra={"where": "Millbrook, the square", "kind": "Civic"})
    add(sec, "map-millbrook_watermill", "Millbrook watermill", "Stone and timber", "Stone ground floor on the river bank, timber above, with a working-looking wheel in the water.",
        lambda: vale_civic.watermill(), extra={"where": "Millbrook, on the river", "kind": "Civic"})

    # ---- 1a. Kingsrest, rebuilt one by one in the build review (map/structures/review/) ----
    sys.path.insert(0, os.path.join(HERE, "review"))
    import kingsrest_house, kingsrest_inn, kingsrest_guildhall
    sec = {"id": "review-kingsrest", "title": "Kingsrest (reviewed)", "blurb": "Kingsrest buildings rebuilt stage by stage from build-instructions in the build review, with Mateo's notes folded in.", "cards": []}
    sections.append(sec)
    for roof in ("red", "slate"):
        add(sec, f"review-kingsrest_house-{roof}", "Street house", f"{roof.capitalize()} roof", "Stone ground floor, jettied stripped-spruce frame above, dormer, lean-to woodshed, leaf boxes and shutters.",
            (lambda r=roof: kingsrest_house.build(99, r)), extra={"where": "Kingsrest streets", "kind": "House"})
    add(sec, "review-kingsrest_inn", "Coaching inn", "Furnished", "Cross-wing coaching inn: a long range with a carriage arch through to the yard and a gabled wing to the square with the door.",
        lambda: kingsrest_inn.build(99, "red"), extra={"where": "Kingsrest, on the square", "kind": "Civic"})
    add(sec, "review-kingsrest_guildhall", "Guildhall", "Copper roof", "An open market arcade under the guild's hall, a copper roof and a belfry on the ridge.",
        lambda: kingsrest_guildhall.build(99, "copper"), extra={"where": "Kingsrest, on the square", "kind": "Civic"})

    # ---- 1a'. The run-through pass on the building skill (one engine): every spec in review/specs ----
    sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "minecraft-builder", "scripts"))
    import glob, engine
    from bp import Blueprint
    sec = {"id": "skill-pass", "title": "Reviewed on the building skill", "blurb": "The run-through pass: each building rebuilt from the current build instructions on the one building engine, checked in 3D, then Mateo's notes.", "cards": []}
    sections.append(sec)
    def from_spec(f):
        k = os.path.basename(f)[:-5]
        if k.startswith("settle_"):    # settlement plot buildings: exactly as the game gets them (settle_skill.build)
            import settle_skill; bid, region = k[7:].rsplit("_", 1); return settle_skill.build(bid, region)
        spec = json.load(open(f)); b = Blueprint(spec["name"]); engine.into_blueprint(b, spec)
        if spec.get("after"):          # a furnished build: the review module's interior stage runs on the skill's shell
            import importlib; mod, fn = spec["after"].split(":"); m = importlib.import_module(mod)
            tmp = Blueprint("after"); getattr(m, fn)(tmp, m.Building(tmp, m.P, 3)); dy = spec.get("after_dy", 0)
            for (x, y, z), v in tmp.cells.items():
                if v[0] not in ("keep",): b.cells[(x, y + dy, z)] = v
        return b.finish()
    for f in sorted(g for g in glob.glob(os.path.join(HERE, "review", "specs", "*.json")) if not g.endswith(".base.json")):
        meta = json.load(open(f)).get("card", {})
        key = os.path.splitext(os.path.basename(f))[0]
        add(sec, "skill-" + key, meta.get("title", key.replace("_", " ").capitalize()), meta.get("sub", ""), meta.get("blurb", ""),
            (lambda f=f: from_spec(f)), REGION_GROUND.get(meta.get("region", "vale")), extra={"where": meta.get("where", ""), "kind": meta.get("kind", "")})

    # ---- 1b. The four regional map towns (laid out by the town generator) ----
    for tid, tname, rid, reg, blurb in TOWNS:
        sec = {"id": "town-" + tid, "title": tname, "blurb": blurb, "cards": []}
        sections.append(sec)
        g = REGION_GROUND[rid]
        roofs = RT.assign_roofs(tid, 7)
        for k, (tier, title) in enumerate(((0, "Tall house by the square"), (0, "Tall house by the square"), (1, "Street house"), (1, "Street house"),
                                           (2, "Outer cottage"), (2, "Outer cottage"), (3, "Farm building"))):
            seed = 300 + k * 7
            add(sec, f"town-{tid}-house{k}", title, f"{tname}, {roofs[k]} roof" if roofs[k] != "flat" else tname, HOUSE_BLURB[reg][min(tier, 3)],
                (lambda f=RT.HOUSES[reg], s=seed, t=tier, r=roofs[k]: f(s, random.Random(s), t, r)), g, extra={"group": "Houses", "kind": "House"})
        if tid == "gulls_rest":      # every Atlantean roof form, so the town's variety can be checked in one place
            import atlantean
            cols = ["green", "teal", "white", "orange"]
            for j, form in enumerate(atlantean.FORMS):
                for t in (0, 1):
                    seed = 500 + j * 11 + t; col = cols[(j + t) % 4]
                    add(sec, f"town-{tid}-atl-{form}-t{t}", atlantean.TITLES[form], f"{tname}, {'by the square' if t == 0 else 'street house'}"
                        + (f", {col} roof" if form != "dome" else ""), atlantean.BLURBS[form],
                        (lambda s=seed, t=t, c=col, f=form: atlantean.house(s, random.Random(s), t, c, f)), g,
                        extra={"group": "Atlantean houses: every roof form", "kind": "House"})
        for name, mk in RT.CIVIC[tid]:
            add(sec, f"town-{tid}-{name}", CIVIC_TITLE[name], tname, (TOWN_BLURB.get((tid, name)) or (mk.__doc__ or "").split(". ")[0] + "."),
                mk, g, extra={"group": "On the square", "kind": "Civic"})
        for name, mk in RT.SHORE.get(tid, []):
            add(sec, f"town-{tid}-{name}", CIVIC_TITLE[name], tname, TOWN_BLURB.get((tid, name), ""), mk, g,
                view=(150, 30, 1.5), extra={"group": "On the water", "kind": "Harbour"})

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

        if rid in settle_buildings.REGIONS:   # what placed blocks raise: the Stables, the Breeder's Yard, the guard
            for bid, title, blurb in (("stables_1", "Stables, level 1", "Raised by the Stables block: three stalls either side of an aisle, hay and water in each."),
                                      ("stables_2", "Stables, level 2", "Five stalls and a tack corner, with a cupola on the ridge. Builds over level 1."),
                                      ("stables_3", "Stables, level 3", "Eight stalls, a tack room across the back and a hayloft above. Builds over level 2."),
                                      ("breeder_yard", "Breeder's Yard", "Raised by the Breeder's Post: a fenced paddock with an open shelter, hay and troughs."),
                                      ("barracks", "Barracks", "The guardhouse: a two-storey hall for the guard with a crenellated watch tower."),
                                      ("quartermaster", "Quartermaster's armoury", "A small strong store with a serving hatch under an awning, smithing table and anvil inside.")):
                add(sec, f"bld-{rid}-{bid}", title, r["name"], blurb, (lambda f=settle_buildings.BLOCK_BUILDERS[bid], r=rid: f(r)), g, extra={"group": "Plot buildings"})

        if rid in stations.REGIONS:   # the railway station on the plot (or the Rail Depot), at each settlement tier
            for st, title, blurb in (("halt", "Halt (Hamlet)", "A waiting shelter with its eaves to the line, a ticket counter, a bench and a hitching rail."),
                                     ("station", "Station (Town)", "A booking hall along the platform with a centre gable, a long canopy, a parcels corner and stalls."),
                                     ("junction", "Junction (City)", "A two-storey hall with a clock tower on the platform, a stable wing and a parcels wing."),
                                     ("grand", "Grand Station (Castle)", "An arched glass train shed over both lines, a tall centre pavilion and twin clock towers.")):
                add(sec, f"stn-{rid}-{st}", title, r["name"], blurb, (lambda f=stations.STAGE_BUILDERS[st], r=rid: f(r)), g, extra={"group": "Railway station"})
            for st in ("halt", "junction"):
                add(sec, f"stn-{rid}-trade_{st}", f"Trade House ({'small' if st == 'halt' else 'two storeys'})", r["name"],
                    "The goods wing added behind the station: a counter under a striped awning on the street side.",
                    (lambda r=rid, st=st: stations.trade_house(r, st)), g, extra={"group": "Railway station"})
            add(sec, f"stn-{rid}-engine_shed", "Engine shed", r["name"], "Beside the line at a Junction: open ends, room for an engine and a coach, smoke stacks on the ridge.",
                (lambda r=rid: stations.engine_shed(r)), g, extra={"group": "Railway station"})

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
        lambda: hollow_kit.cottage_finished(5, 7, 7, "s", 2, 1), HG, view=(-38, 30, 1.4))
    add(sec, "hollow-drowned_city", "The drowned city", "By the Court landing", "Hallowmere's own country: seven leaning towers on the marsh banks where the light river ends, seen from the path to the Court. Every one is out of true; two have lost their tops; a few windows are still lit.",
        lambda: hollow_kit.finish_hollow(hollow_kit.drowned_city_preview()), HG, view=(-38, 26, 1.0), extra={"wide": True})
    for sid, title, blurb, yaw in (("truce_hall", "The Truce Hall", "Where two kings sat down. A long buttressed hall with tall lit windows, its roof fallen in at the far end. One table, two seats, one knocked over.", -38),
                                   ("far_door", "The Far Door", "The Hollow's side of the Gate: a sealed pointed arch in the rock face, scaffold towers with a beam and a hanging soul lantern, dig pits, braziers.", 142),
                                   ("pilgrims_cross", "Pilgrim's Cross", "The west crossroads before the long track to the Far Door: a stepped signpost, a roofed wayside shrine with benches and an offering ledge of candles, a covered well.", -38),
                                   ("cartmeet", "Cartmeet", "Where the ore carts turn for the Seams: a cart shed over the rail with a cart in it, buffer stops, the tally-house where loads are weighed, barrels, a signpost.", -38),
                                   ("the_seams", "The Seams", "A ragged ore cliff with two slanting seams of Choir Ore, a stone-framed mine mouth, a two-storey winch house with its jib over the rail, ore bins, a spoil heap and a cart on the rail.", -38),
                                   ("lattice_gate", "The Lattice Wood", "The woodcutters' camp where the lane meets the thick forest: a log lodge with a stone chimney, an open sawpit, covered racks of cut lattice drying, the log pile and chopping stumps.", -38),
                                   ("wound_dock", "The Wound landing", "The first dock a new arrival sees, where the Carter waits: a landing stage on log piles with a cargo crane, the boatwright's shed with a boat half built beside it, the Carter's ore cart, a signpost.", -38)):
        add(sec, f"hollow-{sid}", title, "Hollow centre", blurb, hollow_kit.SITE_BUILDERS[sid], HG, view=(yaw, 32, 1.3))

    if a.viewer3d:
        from build_3d_catalogue import write_viewer
        write_viewer(structures, a.viewer3d, a.textures); return
    if a.mcstructure:
        from export_structures import write_all
        write_all(structures, a.mcstructure); return
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
