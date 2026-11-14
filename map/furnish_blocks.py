#!/usr/bin/env python3
"""Furnish the empty rooms of a baked town (hollow-crown-worldblocks/1): every building has an interior (Mateo
2026-11-12, CLAUDE.md). The town generator's cottages were drawn "left empty for players to fill" (2026-11-11), and
the town audit (tools/town_audit.py, 2026-11-14) found most town houses in Millbrook, Kingsrest, Sunscar and the
others with nothing inside but a lantern. This pass looks behind every outside door, and a room with no furniture
at all gets some along its walls, by what the building is (the town plan beside the bake says): a home a bed, a
chest, a workbench, a barrel, a furnace and a rug; a barn hay, a chest and a barrel; anything else a lectern, a
chest and a barrel. A one-block walkway from the door is always kept, nothing goes in front of a door, a ladder or a
stair, and a room that already has anything in it is left alone.

    python3 map/furnish_blocks.py map/millbrook-blocks.json [more ...]      # in place; prints what it added

Run before map/light_blocks.py (towngen.write_worldblocks calls furnish_worldblocks before lighting). Running it
again adds nothing.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FURNISHED = re.compile(r"(bed$|:chest$|:barrel$|crafting_table$|furnace$|:smoker$|:lectern$|bookshelf$|_table$|:loom$|"
                       r"stonecutter|:grindstone$|:anvil$|brewing_stand$|cauldron$|:composter$|:jukebox$|decorated_pot$|"
                       r"_carpet$|hay_block$|trapped_chest$|beehive$|chiseled_bookshelf$|_candle$|:candle$|^siege:|^hc:)")
OPEN = re.compile(r"(:air$|_carpet$|pressure_plate$|snow_layer$|:short_grass$|:fern$|button$|:vine$|:light_block)")
STANDABLE_NOT = re.compile(r"(:air$|water|lava|_carpet$|pressure_plate$|snow_layer$|short_grass|:fern$|_button$|:vine$|"
                           r"torch$|lantern$|chain$|_sign$|frame$|ladder$|_door$|flower|sapling|rail$)")
SOLID_NOT = re.compile(r"(:air$|water|lava|glass|_pane$|iron_bars|fence|_door$|trapdoor$|_sign$|carpet|button|lantern|"
                       r"torch|chain|ladder|vine|_slab$|_stairs$|_wall$|leaves|flower|grass$|fern|sapling|rail|snow_layer|"
                       r"bed$|chest$|barrel$|_table$|furnace$|lectern$|bell$|banner|candle|pot$|frame$)")
CARD = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}
FACE_OF = {(0, -1): "north", (0, 1): "south", (-1, 0): "west", (1, 0): "east"}
BED_DIR = {"south": 0, "west": 1, "north": 2, "east": 3}
DIR4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def furnish_worldblocks(d, plan=None, log=print):
    pal, blocks = d["palette"], d["blocks"]
    at = {}
    for b in blocks:
        e = pal[b[3]]
        if e.get("soft") and (b[0], b[1], b[2]) in at: continue
        at[(b[0], b[1], b[2])] = e
    name = lambda c: at[c]["name"] if c in at else "minecraft:air"
    free = lambda c: bool(OPEN.search(name(c)))
    solid = lambda c: c in at and not SOLID_NOT.search(name(c))
    stand = lambda c: c in at and not STANDABLE_NOT.search(name(c))
    covered = lambda c: any(c[:1] + (c[1] + dy,) + c[2:] in at and not OPEN.search(name((c[0], c[1] + dy, c[2])))
                            for dy in range(2, 25))   # a tall house open to its roof ridge is a room too (Rimehold, 2026-11-14)
    pidx = {json.dumps([e["name"], e.get("states", {}), bool(e.get("soft"))], sort_keys=True): i for i, e in enumerate(pal)}

    def pid(n, st):
        k = json.dumps([n, st, False], sort_keys=True)
        if k not in pidx: pidx[k] = len(pal); pal.append({"name": n, "states": st})
        return pidx[k]

    def room(c):
        """Floor cells (feet level) of the room a door opens on: free feet and head, a floor, a roof overhead."""
        if not (free(c) and free((c[0], c[1] + 1, c[2])) and covered(c)): return None, True
        seen, todo, leak = {c}, [c], False
        while todo and len(seen) < 700:
            x, y, z = todo.pop()
            for dx, dz in DIR4:
                for dy in (0, 1, -1):
                    q = (x + dx, y + dy, z + dz)
                    if q in seen or not free(q) or not free((q[0], q[1] + 1, q[2])): continue
                    if abs(q[1] - c[1]) > 1: continue
                    if not stand((q[0], q[1] - 1, q[2])): continue
                    if not covered(q): leak = True; continue
                    seen.add(q); todo.append(q); break
        return seen, leak or len(seen) >= 700

    kinds = {}
    for e in (plan or {}).get("buildings", []):
        if e.get("door"): kinds[tuple(e["door"])] = e.get("kind", "house"), (e.get("name") or e.get("stamp", ""))

    def kind_at(x, z):
        best, bd = ("house", ""), 9
        for (dx, dz), k in kinds.items():
            dd = abs(dx - x) + abs(dz - z)
            if dd < bd: best, bd = k, dd
        return best if bd <= 4 else ("house", "")

    added, rooms = [], 0
    done_rooms = set()
    doors = [(c, e) for c, e in at.items() if re.search(r"(_door|wooden_door)$", e["name"]) and "trapdoor" not in e["name"]
             and not (e.get("states") or {}).get("upper_block_bit")]
    for (x, y, z), e in sorted(doors):
        v = CARD.get((e.get("states") or {}).get("minecraft:cardinal_direction", "south"), (0, 1))
        best = None
        for s in (1, -1):
            c = (x + v[0] * s, y, z + v[1] * s)
            cells, leak = room(c)
            if cells and not leak and len(cells) >= 6 and (best is None or len(cells) > len(best[0])): best = (cells, c)
        if not best: continue
        cells, inside = best
        key = min(cells)
        if key in done_rooms: continue
        done_rooms.add(key)
        if any(FURNISHED.search(name(q)) for c in cells for q in (c, (c[0], c[1] + 1, c[2]), (c[0], c[1] - 1, c[2]),
                                                                    *((c[0] + dx, c[1], c[2] + dz) for dx, dz in DIR4))):
            continue
        rooms += 1
        kind, label = kind_at(x, z)
        # keep clear: the door's inside step and the cell past it, every stair, ladder and door neighbour, and a path
        keep = {inside, (inside[0] + (inside[0] - x), y, inside[2] + (inside[2] - z))}
        for c in cells:
            for dx, dz in DIR4:
                n = name((c[0] + dx, c[1], c[2] + dz))
                if re.search(r"(_door|ladder|_stairs|trapdoor)$", n) or re.search(r"_stairs$", name((c[0], c[1] - 1, c[2]))): keep.add(c)
        def wall_dir(c):
            for dx, dz in DIR4:
                if solid((c[0] + dx, c[1], c[2] + dz)) and solid((c[0] + dx, c[1] + 1, c[2] + dz)): return (dx, dz)
            return None
        spots = sorted((c for c in cells if c not in keep and wall_dir(c)), key=lambda c: (abs(c[0] - x) + abs(c[2] - z)), reverse=True)
        taken = set()

        def still_walkable(extra):
            left = [c for c in cells if c not in taken and c not in extra]
            if inside not in left: return False
            seen, todo = {inside}, [inside]
            pool = set(left)
            while todo:
                a = todo.pop()
                for dx, dz in DIR4:
                    for dy in (0, 1, -1):
                        q = (a[0] + dx, a[1] + dy, a[2] + dz)
                        if q in pool and q not in seen: seen.add(q); todo.append(q); break
            return len(seen) == len(left)

        def put(c, n, st):
            at[c] = {"name": n, "states": st}; taken.add(c); added.append([c[0], c[1], c[2], pid(n, st)])

        if kind in ("barn", "windmill"): want = ["hay", "chest", "barrel", "hay"]
        elif kind in ("house", "shore") or re.search(r"cottage|house|home|hut|stilt", label): want = ["bed", "chest", "crafting_table", "barrel", "furnace"]
        else: want = ["lectern", "chest", "barrel"]
        if len(cells) < 10: want = want[:2] if want[0] != "bed" or len(cells) >= 8 else ["chest", "barrel"]
        for item in want:
            for c in spots:
                if c in taken: continue
                wd = wall_dir(c)
                out = FACE_OF[(-wd[0], -wd[1])]                     # facing away from the wall, into the room
                if item == "bed":
                    # head against the wall, foot one cell into the room
                    foot = (c[0] - wd[0], c[1], c[2] - wd[1])
                    if foot not in cells or foot in keep or foot in taken or not still_walkable({c, foot}): continue
                    d_ = BED_DIR[FACE_OF[wd]]                         # the head end points at the wall
                    put(c, "minecraft:bed", {"direction": d_, "head_piece_bit": True, "occupied_bit": False})
                    put(foot, "minecraft:bed", {"direction": d_, "head_piece_bit": False, "occupied_bit": False})
                    break
                if not still_walkable({c}): continue
                if item == "chest": put(c, "minecraft:chest", {"minecraft:cardinal_direction": out})
                elif item == "barrel": put(c, "minecraft:barrel", {"facing_direction": 1, "open_bit": False})
                elif item == "furnace": put(c, "minecraft:furnace", {"minecraft:cardinal_direction": out})
                elif item == "lectern": put(c, "minecraft:lectern", {"minecraft:cardinal_direction": out, "powered_bit": False})
                elif item == "hay": put(c, "minecraft:hay_block", {"pillar_axis": "y"})
                else: put(c, "minecraft:" + item, {})
                break
        if want[0] == "bed":                                          # a rug in the middle of the room
            mid = [c for c in cells if c not in taken and c not in keep and not wall_dir(c)]
            for c in mid[: max(1, len(mid) // 6)]:
                if name(c) == "minecraft:air": put(c, "minecraft:red_carpet", {})
    blocks.extend(added)
    if log: log(f"{d.get('town', '?')}: furnished {rooms} empty rooms ({len(added)} blocks)")
    return len(added)


def main():
    for path in sys.argv[1:]:
        d = json.load(open(path))
        plan_path = path.replace("-blocks.json", "-plan.json")
        plan = json.load(open(plan_path)) if os.path.exists(plan_path) else None
        if furnish_worldblocks(d, plan):
            json.dump(d, open(path, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
