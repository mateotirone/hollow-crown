"""The last pass over a baked town (hollow-crown-worldblocks/1), after furnishing and lighting: nothing is left hanging
on nothing, standing on nothing or facing into a wall (town audit 2026-11-14, PR #384's findings).

    tidy_worldblocks(d, ground)      d: the worldblocks dict (changed in place); ground(x, z) -> the top y of the
                                     land under the town there (graded), or None when it isn't known

  * a wall sign, ladder, item frame or button needs a solid block behind it and open space in front: it turns to
    a side that has both, or is dropped (a ladder backed by another ladder is dropped too);
  * a plant, crop, snow layer, carpet, flower pot, candle or standing lantern needs a solid block under it (a snow
    layer never sits on a plant, a crop or another snow layer); a standing lantern under a solid block hangs from it;
  * a hanging lantern needs something above it: a chain up to the ceiling (12 at most), or it is dropped;
  * a chain needs a solid block (or more chain) above it, or it and whatever hung from it go.
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


def tidy_worldblocks(d, ground=None):
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
                    return held and not solid(front)
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
                    if solid(above) or (name_at(above) or "").endswith("chain"): continue
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
                    if solid(below): continue
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
    return n


if __name__ == "__main__":
    for p in sys.argv[1:]:
        d = json.load(open(p)); r = tidy_worldblocks(d)
        with open(p, "w") as fh: json.dump(d, fh, separators=(",", ":"))
        print(p, r)
