"""The last pass over a baked town (hollow-crown-worldblocks/1), after furnishing and lighting: nothing is left hanging
on nothing, standing on nothing or facing into a wall (town audit 2026-11-14, PR #384's findings).

    tidy_worldblocks(d, ground, ground_hi)   d: the worldblocks dict (changed in place); ground(x, z) -> the top y of the
                                     land under the town there (graded), or None when it isn't known; ground_hi(x, z) ->
                                     the higher of that and the land as it was (what a sign must not face)

  * a wall sign, ladder, item frame or button needs a solid block behind it and open space in front: it turns to
    a side that has both, or is dropped (a ladder backed by another ladder is dropped too);
  * a plant, crop, snow layer, carpet, flower pot, candle or standing lantern needs a solid block under it (a snow
    layer never sits on a plant, a crop or another snow layer); a standing lantern under a solid block hangs from it;
  * a hanging lantern needs something above it: a chain up to the ceiling (12 at most), or it is dropped;
  * a chain needs a solid block (or more chain) above it, or it and whatever hung from it go;
  * a lone post, barrel or stair standing a block or two over the ground, touching nothing, settles onto it;
  * a door's outside step over a gap of 1 to 3 blocks gets a stoop of the door's sill block down to the ground.
Uses the same idea of "solid" as map/hang_blocks.py and tools/town_audit.py. Run as a script it tidies files in
place, with the land taken as unknown (only the town's own blocks hold things up).

    python3 map/tidy_blocks.py map/millbrook-blocks.json [more ...]
"""
import json, re, sys

SOFT = re.compile(r"(^|:)air$|vine|ladder|lantern|button|sign|frame|torch|carpet|glass_pane|iron_bars|fence|chain|trapdoor|"
                  r"door|slab|stairs|_wall$|structure_void|flower|grass$|fern|bush|sapling|candle|banner|rail|snow_layer|"
                  r"water|lava|leaves|_pane$|wheat|carrots|potatoes|beetroot|reeds|sugar_cane|leaf_litter|petals|roots$|"
                  r"pressure_plate|flower_pot|_pot$|lily|mushroom|dripleaf|bamboo|cactus|kelp|seagrass|cocoa|moss_carpet")
HUNG = re.compile(r"(^|:)(glow_)?frame$|(^|:)ladder$|_button$|wall_sign$")
STANDS = re.compile(r"(short_grass|tall_grass|tallgrass|(^|:)fern$|large_fern|deadbush|poppy|dandelion|cornflower|oxeye|bluet|"
                    r"allium|_tulip$|lily_of_the_valley|blue_orchid|wildflowers|pink_petals|leaf_litter|sweet_berry|wheat$|"
                    r"carrots$|potatoes$|beetroot$|sapling$|sugar_cane|reeds$|snow_layer|carpet$|pressure_plate|flower_pot$|"
                    r"decorated_pot$|_mushroom$|torchflower|pitcher_plant|(^|:)bush$|firefly_bush|dry_grass|standing_sign|"
                    r"standing_banner|candle$|double_plant|red_flower|yellow_flower)")
PLANTISH = re.compile(r"grass|fern|flower|tulip|orchid|allium|bluet|daisy|poppy|dandelion|petals|litter|wheat|carrots|potatoes|"
                      r"beetroot|sapling|bush|reeds|sugar_cane|snow_layer|mushroom")
BEHIND = {2: (0, 0, 1), 3: (0, 0, -1), 4: (1, 0, 0), 5: (-1, 0, 0)}


def tidy_worldblocks(d, ground=None, ground_hi=None):
    pal, blocks = d["palette"], d["blocks"]
    at = {}
    for i, b in enumerate(blocks): at[(b[0], b[1], b[2])] = i          # the last block placed at a cell wins
    pidx = {json.dumps(p, sort_keys=True): i for i, p in enumerate(pal)}
    drop = set()
    n = {"turned": 0, "dropped": 0, "chained": 0, "hung": 0}

    def index_of(p):
        k = json.dumps(p, sort_keys=True)
        if k not in pidx: pidx[k] = len(pal); pal.append(p)
        return pidx[k]

    def name_at(c):
        j = at.get(c)
        if j is None or j in drop: return None
        return pal[blocks[j][3]]["name"]

    def solid(c):
        nm = name_at(c)
        if nm is not None:
            return not SOFT.search(nm)
        if c in at: return False                                        # dropped: air now
        g = ground(c[0], c[2]) if ground else None
        return g is not None and c[1] <= g

    def entry(i): return pal[blocks[i][3]]

    # a lone yard piece (a post, a barrel, a stair seat) standing a block or two over the ground with nothing on any
    # side of it settles down onto the ground (Rimehold's pen: its fittings sat a block over the graded floor)
    LONE = re.compile(r"_fence$|_stairs$|(^|:)barrel$|hay_block$|composter$|cauldron$|_slab$")
    settled = 0
    for cell, i in sorted(at.items(), key=lambda a: a[0][1]):
        e = entry(i); nm = e["name"]
        if not LONE.search(nm) or (nm.endswith("_slab") and (e.get("states") or {}).get("minecraft:vertical_half") == "top"): continue
        x, y, z = cell
        if solid((x, y - 1, z)) or name_at((x, y - 1, z)) not in (None, "minecraft:air") or name_at((x, y + 1, z)) not in (None, "minecraft:air"): continue
        if any(name_at((x + a, y, z + b)) not in (None, "minecraft:air") or solid((x + a, y, z + b)) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
        k = 1
        while k <= 2 and not solid((x, y - k - 1, z)) and name_at((x, y - k - 1, z)) in (None, "minecraft:air"): k += 1
        if k > 2 or not solid((x, y - k - 1, z)): continue
        c = (x, y - k, z)
        blocks[i] = [*c, blocks[i][3], *blocks[i][4:]]; del at[cell]; at[c] = i
        settled += 1
    if settled: n["settled"] = settled

    # a door's outside step needs ground under it: a step left over a gap (a ditch along the wall, a house floor a block
    # or two over the land) gets a stoop of the door's own sill block down to the ground, 3 blocks at most
    stoop = 0
    for cell, i in list(at.items()):
        e = entry(i); nm = e["name"]; st = e.get("states") or {}
        if not re.search(r"_door$|:door$", nm) or "trapdoor" in nm or st.get("upper_block_bit"): continue
        cd = st.get("minecraft:cardinal_direction")
        ax = (1, 0) if cd in ("east", "west") or (cd is None and int(st.get("direction", 1)) % 2 == 0) else (0, 1)
        sill = at.get((cell[0], cell[1] - 1, cell[2]))
        fill = entry(sill) if sill is not None and solid((cell[0], cell[1] - 1, cell[2])) else {"name": "minecraft:cobblestone", "states": {}}
        for sgn in (1, -1):
            sx, sz = cell[0] + ax[0] * sgn, cell[2] + ax[1] * sgn
            if solid((sx, cell[1], sz)) or solid((sx, cell[1] + 1, sz)) or solid((sx, cell[1] - 1, sz)): continue
            gap = []
            for k in range(1, 5):
                c = (sx, cell[1] - k, sz)
                if solid(c): break
                nmk = name_at(c)
                if nmk is not None and not (nmk.endswith(":air") or PLANTISH.search(nmk)): gap = None; break
                gap.append(c)
            else: gap = None
            if not gap or len(gap) > 3: continue
            fi = index_of(fill)
            for c in gap:
                blocks.append([*c, fi]); at[c] = len(blocks) - 1
            stoop += 1
    if stoop: n["stoops"] = stoop

    # what's underneath (Mateo 2026-11-14: "under it is ____ but it's a slab so it's floating. Needs to be a full block").
    # A post (fence, wall, upright log) with nothing hard beside it stands on the ground: a gap, a crop, a plant or
    # leaves under it becomes more of the post, three blocks at most (lamp posts in Sunscar's fields stood on the
    # beetroot). Anything resting on a bottom slab hangs half a block in the air: that slab becomes its double slab.
    POST = re.compile(r"_fence$|(^|:)fence$|_wall$|_log$")
    NOTHING = re.compile(r"(^|:)air$|leaves|" + STANDS.pattern)
    footed = full = 0
    for cell, i in sorted(at.items(), key=lambda a: a[0][1]):
        if i in drop: continue
        e = entry(i); nm = e["name"]; st = e.get("states") or {}
        x, y, z = cell
        if POST.search(nm) and "fence_gate" not in nm and not nm.startswith("siege:old_") and st.get("pillar_axis", "y") == "y":
            if solid((x, y - 1, z)) or name_at((x, y - 1, z)) is not None and not NOTHING.search(name_at((x, y - 1, z))): pass
            elif any(solid((x + a, y, z + b)) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))): pass
            else:
                gap = []
                for k in range(1, 4):
                    c = (x, y - k, z)
                    if solid(c) or name_at(c) is not None and not NOTHING.search(name_at(c)): break
                    gap.append(c)
                else: gap = None
                if gap and solid((x, y - len(gap) - 1, z)):
                    for c in gap:
                        j = at.get(c)
                        if j is not None and j not in drop: blocks[j] = [*c, blocks[i][3], *blocks[j][4:]]
                        else: blocks.append([*c, blocks[i][3]]); at[c] = len(blocks) - 1
                    footed += 1
            continue
        below = at.get((x, y - 1, z))
        if below is None or below in drop: continue
        b = entry(below); bst = b.get("states") or {}
        if not (b["name"].startswith("minecraft:") and b["name"].endswith("_slab") and "double" not in b["name"]
                and bst.get("minecraft:vertical_half", "top" if bst.get("top_slot_bit") else "bottom") == "bottom"): continue
        if re.search(r"(^|:)air$|water|lava|chain$|leaves|trapdoor|vine|snow_layer|scaffolding", nm) or HUNG.search(nm): continue
        if nm.endswith("lantern") and st.get("hanging"): continue
        if nm.endswith("_slab") and st.get("minecraft:vertical_half") == "top": continue
        if nm.endswith("_stairs") and st.get("upside_down_bit"): continue
        if nm.endswith("_door") and st.get("upper_block_bit"): continue
        if "torch" in nm and st.get("torch_facing_direction", "top") != "top": continue
        blocks[below] = [*blocks[below][:3], index_of({"name": b["name"].replace("_slab", "_double_slab"), "states": {}}), *blocks[below][4:]]
        full += 1
    if footed: n["footed"] = footed
    if full: n["full"] = full

    for _ in range(3):                                                  # a drop can leave the next one hanging
        changed = False
        for cell, i in list(at.items()):
            if i in drop: continue
            e = entry(i); nm = e["name"]; st = e.get("states") or {}
            if nm.endswith(":air"): continue
            if HUNG.search(nm):
                f = st.get("facing_direction")
                def ok(fd):
                    o = BEHIND[fd]; back = (cell[0] + o[0], cell[1], cell[2] + o[2]); front = (cell[0] - o[0], cell[1], cell[2] - o[2])
                    bn = name_at(back)
                    held = solid(back) or (nm.endswith("wall_sign") and bn is not None and "leaves" in bn)
                    if nm.endswith("ladder") and bn is not None and bn.endswith("ladder"): held = False
                    # in front: the land as it was counts too (ground_hi: a sign by a house at the town's edge faced
                    # the hillside the grading never reached, Rimehold 2026-11-14)
                    g_hi = ground_hi(front[0], front[2]) if ground_hi and name_at(front) is None and front not in at else None
                    return held and not solid(front) and not (g_hi is not None and front[1] <= g_hi)
                if f in BEHIND and ok(f): continue
                for fd in (2, 3, 4, 5):
                    if ok(fd):
                        blocks[i] = [*blocks[i][:3], index_of({**e, "states": {**st, "facing_direction": fd}}), *blocks[i][4:]]
                        n["turned"] += 1; changed = True; break
                else:
                    drop.add(i); n["dropped"] += 1; changed = True
                continue
            below = (cell[0], cell[1] - 1, cell[2]); above = (cell[0], cell[1] + 1, cell[2])
            if nm.endswith("lantern"):
                if st.get("hanging"):
                    # a fence bracket, a wall post, bars or a slab hold a hung lantern too (the engine's light stage hangs
                    # its wall lanterns under a fence arm: the first tidy pass took them all down, 2026-11-14)
                    if solid(above) or re.search(r"(chain$|_fence$|_wall$|iron_bars$|_slab$|_stairs$|trapdoor$)", name_at(above) or ""): continue
                    gap = []
                    for dy in range(1, 13):
                        c = (cell[0], cell[1] + dy, cell[2])
                        if solid(c) or (name_at(c) or "").endswith("chain"): break
                        if name_at(c) is not None and SOFT.search(name_at(c)) and not name_at(c).endswith(":air"): gap = None; break
                        gap.append(dy)
                    else: gap = None
                    if gap is None:
                        if solid(below):
                            blocks[i] = [*blocks[i][:3], index_of({**e, "states": {**st, "hanging": False}}), *blocks[i][4:]]
                        else: drop.add(i); n["dropped"] += 1
                        changed = True; continue
                    ci = index_of({"name": "minecraft:chain", "states": {"pillar_axis": "y"}})
                    for dy in gap:
                        c = (cell[0], cell[1] + dy, cell[2]); blocks.append([*c, ci]); at[c] = len(blocks) - 1
                    n["chained"] += 1; changed = True
                else:
                    # a lantern stands on a fence or a wall post just as well (every town lamp post: the first tidy
                    # pass took them all off, and Sunscar's yard went dark)
                    if solid(below) or re.search(r"(_fence$|_wall$|_slab$|_stairs$|lantern$|chain$)", name_at(below) or ""): continue
                    if solid(above):
                        blocks[i] = [*blocks[i][:3], index_of({**e, "states": {**st, "hanging": True}}), *blocks[i][4:]]
                        n["hung"] += 1
                    else: drop.add(i); n["dropped"] += 1
                    changed = True
                continue
            if nm.endswith(":chain") or nm.endswith("_chain"):
                up = name_at(above)
                if solid(above) or (up or "").endswith("chain"): continue
                if (st.get("pillar_axis", "y") != "y"): continue
                drop.add(i); n["dropped"] += 1; changed = True
                continue
            if STANDS.search(nm):
                bn = name_at(below)
                if re.search(r"carpet|flower_pot|decorated_pot|candle|pressure_plate|standing_sign|standing_banner", nm):
                    bad = not solid(below) and (bn is None or re.search(r":air$|water|lava|carpet|snow_layer|grass$|flower|fern", bn))
                else:
                    bad = not solid(below) and not (bn and "farmland" in bn)
                    if nm.endswith("snow_layer") and bn and PLANTISH.search(bn): bad = True
                if bad:
                    drop.add(i); n["dropped"] += 1; changed = True
        if not changed: break
    if drop and isinstance(d.get("groundwork_blocks"), int):
        d["groundwork_blocks"] -= sum(1 for i in drop if i < d["groundwork_blocks"])
    d["blocks"] = [b for i, b in enumerate(blocks) if i not in drop]
    if ground: d["tidied_on_land"] = True    # hang_blocks.py: what hangs on the land here was checked against it
    return n


if __name__ == "__main__":
    for p in sys.argv[1:]:
        d = json.load(open(p)); r = tidy_worldblocks(d)
        with open(p, "w") as fh: json.dump(d, fh, separators=(",", ":"))
        print(p, r)
