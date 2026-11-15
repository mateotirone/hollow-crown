#!/usr/bin/env python3
"""Full snapshot of a played world: everyone and everything in it, as a readable report plus one JSON file.

Mateo 2026-11-15: "a complete snapshot of everyone and everything in the world, so we can build around not only
the state of the map and its buildings, but also where everyone is in the story, amount of regals, what's in
chests, literally everything", so the next playtest is built on that world instead of a fresh one.

    python3 tools/world_snapshot.py WORLD [--base BASE] [--out DIR] [--no-blocks]

WORLD  the downloaded world: a .mcworld (any file name, it is a zip), or an unzipped world folder (holds db/).
--base the world it started from (for example map/hollow-crown-full-map.mcworld or the playtest .mcworld it was
       made from). The report then lists every block players and the game changed, area by area.
--out  folder for the report (default: world-snapshot/<world name>-<date> next to the world).

Writes:
  REPORT.md             readable: the world, every player (place, health, inventory, ender chest, Regals,
                        story steps, settlement), every settlement, every chest and container with what is in it,
                        every creature and NPC by kind and place, the add-on's saved data, the scoreboard, the
                        changed areas of the map
  snapshot.json         the same and more, machine-readable: level.dat, every saved data store (decoded),
                        every player's full save, every container, every entity, every custom block
  blocks-changed.json.gz  with --base: every changed block, [x, y, z, old, new], by chunk

Read-only: the world is never written. Pure Python + numpy (no amulet, no leveldb library): the LevelDB reader
and sub-chunk decoder are tools/bedrock_world.py.

Names: Bedrock does not save player names in the world. The add-on keeps a roster of every player who has joined
(name, Regals, story steps, settlement, last seen) in the world itself (Siege_Nights_BP/scripts/core/snapshot.js),
so this report can name everyone and say where they are in the story even while they are offline.
"""
import argparse, datetime, glob, gzip, hashlib, io, json, os, re, struct, sys, tempfile, zipfile
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bedrock_world import _table, _log, subchunk  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROSTER = "siege:snapshot_roster"   # core/snapshot.js
DIMS = {0: "Overworld", 1: "Nether", 2: "The End"}
TAGS = {43: "Data2D", 44: "Version", 45: "Data2DLegacy", 47: "SubChunk", 49: "BlockEntity", 50: "Entity",
        51: "PendingTicks", 54: "FinalizedState", 57: "Checksums", 58: "RandomTicks", 59: "BlendingData",
        60: "BlendingBiomeHeight", 61: "BlendingBiomeHeight", 63: "BiomeState", 64: "MetaDataHash", 118: "LegacyVersion"}


# ------------------------------------------------------------------ little-endian NBT, all tags
class Reader:
    def __init__(self, b, i=0):
        self.b, self.i = b, i

    def take(self, fmt):
        v = struct.unpack_from(fmt, self.b, self.i); self.i += struct.calcsize(fmt); return v[0]

    def string(self):
        n = self.take("<H"); s = self.b[self.i:self.i + n]; self.i += n
        return s.decode("utf8", "replace")

    def value(self, t):
        if t == 1: return self.take("<b")
        if t == 2: return self.take("<h")
        if t == 3: return self.take("<i")
        if t == 4: return self.take("<q")
        if t == 5: return self.take("<f")
        if t == 6: return self.take("<d")
        if t == 8: return self.string()
        if t in (7, 11, 12):
            n = self.take("<i"); w, f = {7: (1, "b"), 11: (4, "i"), 12: (8, "q")}[t]
            v = list(struct.unpack_from(f"<{n}{f}", self.b, self.i)); self.i += n * w
            return v
        if t == 9:
            ct = self.take("<B"); n = self.take("<i")
            return [self.value(ct) for _ in range(max(n, 0))]
        if t == 10:
            out = {}
            while True:
                ct = self.take("<B")
                if ct == 0: return out
                name = self.string()
                out[name] = self.value(ct)
        raise ValueError(f"NBT tag {t} at {self.i}")

    def root(self):
        t = self.take("<B")
        if t == 0: return None
        self.string()
        return self.value(t)


def nbt(b, i=0):
    """One root tag -> value."""
    return Reader(b, i).root()


def nbt_all(b):
    """Several root tags back to back (block entities, legacy entities) -> list."""
    r, out = Reader(b), []
    while r.i < len(b):
        try:
            v = r.root()
        except Exception:
            break
        if v is None: break
        out.append(v)
    return out


def level_dat(path):
    d = open(path, "rb").read()
    return nbt(d, 8)


# ------------------------------------------------------------------ opening a world
def open_world(path, tmp):
    """-> folder holding db/ and level.dat. A zip (any name) is unpacked into tmp."""
    if os.path.isdir(path):
        if os.path.isdir(os.path.join(path, "db")): return path
        sub = [os.path.dirname(p) for p in glob.glob(os.path.join(path, "*", "db"))]
        if len(sub) == 1: return sub[0]
        sys.exit(f"{path}: no db/ folder here; give the world folder (the one with level.dat and db/).")
    if not zipfile.is_zipfile(path):
        sys.exit(f"{path}: not a world: expected a .mcworld (zip) or a world folder.")
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        lvl = sorted((n for n in names if n.endswith("level.dat") and not n.endswith("level.dat_old")), key=len)
        if not lvl: sys.exit(f"{path}: no level.dat inside, not a world.")
        prefix = lvl[0][: -len("level.dat")]
        for n in names:
            if not n.startswith(prefix) or n.endswith("/"): continue
            rel = n[len(prefix):]
            if rel.startswith(("/", "..")) or ".." in rel.split("/"): continue
            dest = os.path.join(tmp, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(n) as src, open(dest, "wb") as out:
                while True:
                    chunk = src.read(1 << 20)
                    if not chunk: break
                    out.write(chunk)
    return tmp


def db_files(folder):
    db = os.path.join(folder, "db")
    return sorted(glob.glob(os.path.join(db, "*.ldb"))) + sorted(glob.glob(os.path.join(db, "*.log")))


def chunk_key(k):
    """-> (dim, cx, cz, tag, extra) for a chunk key, else None."""
    if len(k) in (9, 10):
        cx, cz = struct.unpack_from("<ii", k); return 0, cx, cz, k[8], (k[9] if len(k) == 10 else None)
    if len(k) in (13, 14):
        cx, cz, dim = struct.unpack_from("<iii", k)
        if 0 < dim < 1 << 16: return dim, cx, cz, k[12], (k[13] if len(k) == 14 else None)
    return None


def is_named(k):
    """World records (scoreboard, players, entities, stores) as against chunk data."""
    if k.startswith((b"actorprefix", b"digp")): return True
    ck = chunk_key(k)
    return ck is None or (bool(re.fullmatch(rb"[ -~]+", k)) and ck[3] not in TAGS)


def read_db(folder, keep_subchunk):
    """One pass over the database, newest write wins.
    -> (named {key: value}, chunks {(dim,cx,cz,tag,extra): value} for tags other than 47,
        subs {(dim,cx,cz,sy): (digest, value or None)}; keep_subchunk(value) says whether to keep a sub-chunk's bytes)"""
    best = {}
    for f in db_files(folder):
        it = _table(f, lambda k: True) if f.endswith(".ldb") else _log(f, lambda k: True)
        for k, seq, t, v in it:
            old = best.get(k)
            if old is not None and old[0] >= seq: continue
            if not is_named(k) and chunk_key(k)[3] == 47:
                best[k] = (seq, t, (hashlib.blake2b(v, digest_size=10).digest(), v if keep_subchunk(v) else None) if t == 1 else None)
            else:
                best[k] = (seq, t, v)
    named, chunks, subs = {}, {}, {}
    for k, (seq, t, v) in best.items():
        if t != 1: continue  # deleted
        if is_named(k):
            named[k] = v; continue
        dim, cx, cz, tag, extra = chunk_key(k)
        if tag == 47:
            subs[(dim, cx, cz, struct.unpack("b", bytes([extra]))[0] if extra is not None else 0)] = v
        else:
            chunks[(dim, cx, cz, tag, extra)] = v
    return named, chunks, subs


# ------------------------------------------------------------------ JSON helpers
def jsonish(v):
    """Strings that hold JSON (the add-on's saved stores) come back decoded."""
    if isinstance(v, str) and v[:1] in "{[" and len(v) > 1:
        try: return json.loads(v)
        except Exception: return v
    return v


def find_dynprops(tree):
    """Dynamic properties anywhere in an NBT tree: any compound called *DynamicProperties*, whose children are
    per-pack compounds of name -> value. Flattened to {name: value}."""
    out = {}

    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if "dynamicpropert" in k.lower() and isinstance(v, dict):
                    for pk, pv in v.items():
                        if isinstance(pv, dict):
                            for name, val in pv.items(): out[name] = jsonish(val)
                        else:
                            out[pk] = jsonish(pv)
                else:
                    walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(tree)
    return out


def dim_name(d):
    return DIMS.get(d, f"dimension {d} (custom: the Hollow or Everwake)")


# ------------------------------------------------------------------ places, to say where things are
def load_places():
    places = []
    try:
        src = open(os.path.join(ROOT, "Siege_Nights_BP/scripts/plots/config.js"), encoding="utf8").read()
        for m in re.finditer(r'name: "([^"]+)",(?: region: "[^"]+",)? x: (-?\d+), z: (-?\d+)', src):
            places.append((m.group(1), int(m.group(2)), int(m.group(3))))
        m = re.search(r"hall: \{ x: (-?\d+), y: -?\d+, z: (-?\d+) \}", src)
        if m: places.append(("the welcome hall", int(m.group(1)), int(m.group(2))))
    except OSError:
        pass
    return places


PLACES = load_places()


def near(x, z):
    if not PLACES: return ""
    name, px, pz = min(PLACES, key=lambda p: (p[1] - x) ** 2 + (p[2] - z) ** 2)
    d = int(((px - x) ** 2 + (pz - z) ** 2) ** 0.5)
    return f"at {name}" if d < 100 else f"{d} blocks from {name}"


# ------------------------------------------------------------------ items
def item_name(it):
    n = it.get("Name", "?")
    if n.startswith("minecraft:"): n = n[10:]
    tag = it.get("tag") or {}
    custom = (tag.get("display") or {}).get("Name")
    return f'{n} "{custom}"' if custom else n


def items_of(lst, depth=0):
    """NBT item list -> [{slot, item, count, damage, name, inside}] (shulker boxes and bundles open up)."""
    out = []
    for it in lst or []:
        if not isinstance(it, dict) or not it.get("Name") or it.get("Count", 0) == 0: continue
        e = {"slot": it.get("Slot"), "item": it.get("Name"), "count": it.get("Count", 1)}
        tag = it.get("tag") or {}
        if it.get("Damage"): e["damage"] = it["Damage"]
        if (tag.get("display") or {}).get("Name"): e["name"] = tag["display"]["Name"]
        if (tag.get("display") or {}).get("Lore"): e["lore"] = tag["display"]["Lore"]
        if tag.get("ench"): e["ench"] = [(x.get("id"), x.get("lvl")) for x in tag["ench"]]
        if tag.get("Items") and depth < 3: e["inside"] = items_of(tag["Items"], depth + 1)
        if tag.get("storage_item_component_content") and depth < 3: e["inside"] = items_of(tag["storage_item_component_content"], depth + 1)
        out.append(e)
    return out


def items_line(items, limit=40):
    if not items: return "empty"
    c = Counter()
    for e in items:
        label = e["item"].replace("minecraft:", "")
        if e.get("name"): label += f' "{e["name"]}"'
        c[label] += e["count"]
        for sub in e.get("inside", []):
            c[sub["item"].replace("minecraft:", "") + " (inside " + e["item"].replace("minecraft:", "") + ")"] += sub["count"]
    parts = [f"{n} x{k}" for n, k in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))]
    more = len(parts) - limit
    return ", ".join(parts[:limit]) + (f", and {more} more kinds" if more > 0 else "")


# ------------------------------------------------------------------ the snapshot
def snapshot(world_folder, base_folder=None, blocks=True):
    lvl = level_dat(os.path.join(world_folder, "level.dat"))
    want_sub = (lambda v: True) if base_folder else (lambda v: b"siege:" in v or b"hc:" in v)
    if not blocks: want_sub = lambda v: False  # noqa: E731
    print("Reading the world database ...", flush=True)
    named, chunks, subs = read_db(world_folder, want_sub)
    snap = {"made": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "world": {"name": open(os.path.join(world_folder, "levelname.txt"), encoding="utf8").read().strip()
                      if os.path.exists(os.path.join(world_folder, "levelname.txt")) else lvl.get("LevelName"),
                      "level_dat": lvl}}

    # packs
    packs = {}
    for kind in ("behavior", "resource"):
        f = os.path.join(world_folder, f"world_{kind}_packs.json")
        lst = json.load(open(f)) if os.path.exists(f) else []
        found = []
        for m in glob.glob(os.path.join(world_folder, f"{kind}_packs", "*", "manifest.json")):
            try:
                h = json.load(open(m, encoding="utf8"))["header"]
                found.append({"folder": os.path.basename(os.path.dirname(m)), "name": h.get("name"), "uuid": h.get("uuid"), "version": h.get("version")})
            except Exception:
                pass
        packs[kind] = {"applied": lst, "in_world": found}
    snap["packs"] = packs

    # world dynamic properties (the add-on's saved stores)
    world_dp = {}
    if b"DynamicProperties" in named:
        world_dp = find_dynprops({"DynamicProperties": nbt(named[b"DynamicProperties"])})
    snap["stores"] = world_dp
    roster = (world_dp.get(ROSTER) or {}).get("players", {}) if isinstance(world_dp.get(ROSTER), dict) else {}

    # players
    players = []
    for k, v in named.items():
        ks = k.decode("latin1")
        if ks == "~local_player" or ks.startswith("player_server_"):
            try: p = nbt(v)
            except Exception as e: players.append({"key": ks, "error": str(e)}); continue
            if not isinstance(p, dict): continue
            pid = str(p.get("UniqueID", ""))
            r = roster.get(pid, {})
            pos = p.get("Pos") or [0, 0, 0]
            attrs = {a.get("Name", "").replace("minecraft:", ""): round(a.get("Current", 0), 1) for a in p.get("Attributes", []) if isinstance(a, dict)}
            players.append({
                "key": ks, "id": pid, "name": r.get("name"), "roster": r,
                "dimension": dim_name(p.get("DimensionId", 0)), "pos": [round(c, 1) for c in pos], "near": near(pos[0], pos[2]),
                "spawn": [p.get("SpawnX"), p.get("SpawnY"), p.get("SpawnZ")] if "SpawnX" in p else None,
                "gamemode": {0: "Survival", 1: "Creative", 2: "Adventure", 5: "Default", 6: "Spectator"}.get(p.get("PlayerGameMode"), p.get("PlayerGameMode")),
                "health": attrs.get("health"), "hunger": attrs.get("player.hunger"), "xp_level": p.get("PlayerLevel"),
                "inventory": items_of(p.get("Inventory")), "armor": items_of(p.get("Armor")), "offhand": items_of(p.get("Offhand")),
                "ender_chest": items_of(p.get("EnderChestInventory")),
                "tags": p.get("Tags", []), "dynamic_properties": find_dynprops(p), "nbt": p,
            })
        elif ks.startswith("player_") and not ks.startswith("player_server_"):
            try: snap.setdefault("player_links", {})[ks] = nbt(v)
            except Exception: pass
    # Players the roster knows but whose save isn't in the world (should not happen, but say so)
    have = {p.get("id") for p in players}
    for pid, r in roster.items():
        if pid not in have:
            players.append({"key": None, "id": pid, "name": r.get("name"), "roster": r, "note": "in the add-on's roster, no player save found"})
    snap["players"] = players

    # entities: modern actorprefix records, placed by digp lists; legacy per-chunk entity tags too
    where = {}
    for k, v in named.items():
        if k.startswith(b"digp"):
            rest = k[4:]
            dim = struct.unpack_from("<i", rest, 8)[0] if len(rest) >= 12 else 0
            for i in range(0, len(v) - 7, 8): where[v[i:i + 8]] = dim
    entities = []
    for k, v in named.items():
        if not k.startswith(b"actorprefix"): continue
        try: e = nbt(v)
        except Exception: continue
        if isinstance(e, dict): entities.append((where.get(k[11:], e.get("DimensionId", 0)), e))
    for (dim, cx, cz, tag, _x), v in chunks.items():
        if tag == 50:
            for e in nbt_all(v): entities.append((dim, e))
    ents = []
    for dim, e in entities:
        pos = e.get("Pos") or [0, 0, 0]
        dp = find_dynprops(e)
        ents.append({"type": e.get("identifier", "?"), "dimension": dim_name(dim), "pos": [round(c, 1) for c in pos],
                     "name": e.get("CustomName") or None, "tags": e.get("Tags", []) or [], "health": next(
                         (round(a.get("Current", 0), 1) for a in e.get("Attributes", []) if isinstance(a, dict) and a.get("Name") == "minecraft:health"), None),
                     "items": items_of((e.get("ChestItems") or []) + (e.get("Mainhand") or []) + (e.get("Armor") or [])),
                     "owner": e.get("OwnerNew"), "dynamic_properties": dp, "id": e.get("UniqueID")})
    snap["entities"] = ents

    # block entities: chests, barrels, signs, lecterns ...
    containers = []
    for (dim, cx, cz, tag, _x), v in chunks.items():
        if tag != 49: continue
        for be in nbt_all(v):
            if not isinstance(be, dict): continue
            row = {"type": be.get("id", "?"), "dimension": dim_name(dim), "pos": [be.get("x"), be.get("y"), be.get("z")]}
            if "Items" in be: row["items"] = items_of(be["Items"])
            if be.get("CustomName"): row["name"] = be["CustomName"]
            for side in ("FrontText", "BackText"):
                t = (be.get(side) or {}).get("Text")
                if t: row.setdefault("text", []).append(t)
            if be.get("Text"): row.setdefault("text", []).append(be["Text"])
            if be.get("book"): row["book"] = be["book"].get("Name")
            if be.get("Item"): row["items"] = items_of([be["Item"]])
            if be.get("pairx") is not None: row["paired"] = [be.get("pairx"), be.get("pairz")]
            row["nbt"] = be
            containers.append(row)
    snap["block_entities"] = containers

    # scoreboard and the other world records
    others = {}
    for k, v in named.items():
        if k.startswith((b"actorprefix", b"digp", b"player_", b"~local_player")) or k == b"DynamicProperties": continue
        ks = k.decode("latin1")
        try: others[ks] = nbt(v)
        except Exception: others[ks] = f"<{len(v)} bytes>"
    snap["scoreboard"] = others.pop("scoreboard", None)
    snap["other_records"] = others

    # the map: which chunks exist, custom blocks
    dims = defaultdict(set)
    for (dim, cx, cz, sy) in subs: dims[dim].add((cx, cz))
    snap["map"] = {"chunks": {dim_name(d): {"count": len(s), "x": [min(c[0] for c in s) * 16, max(c[0] for c in s) * 16 + 15],
                                              "z": [min(c[1] for c in s) * 16, max(c[1] for c in s) * 16 + 15]} for d, s in dims.items()}}
    if blocks:
        print("Counting the add-on's own blocks ...", flush=True)
        custom = defaultdict(lambda: {"count": 0, "at": []})
        for (dim, cx, cz, sy), (dg, v) in subs.items():
            if v is None or not (b"siege:" in v or b"hc:" in v): continue
            try: layers = subchunk(v)
            except Exception: continue
            for pal, idx in (layers or [])[:1]:
                for pi, (name, _st) in enumerate(pal):
                    if not name.startswith(("siege:", "hc:")): continue
                    hits = list(zip(*((idx == pi).nonzero())))
                    c = custom[name]; c["count"] += len(hits)
                    for lx, lz, ly in hits[: max(0, 2000 - len(c["at"]))]:
                        c["at"].append([dim, cx * 16 + int(lx), sy * 16 + int(ly), cz * 16 + int(lz)])
        snap["map"]["custom_blocks"] = dict(sorted(custom.items(), key=lambda kv: -kv[1]["count"]))
    if base_folder:
        snap["map"]["changes"] = diff_map(subs, base_folder)
    return snap


def names_grid(v, ids):
    """Sub-chunk bytes -> 16x16x16 array of global name ids (layer 0)."""
    import numpy as np
    layers = subchunk(v) if v else None
    if not layers: return np.zeros((16, 16, 16), np.int32)
    pal, idx = layers[0]
    look = np.array([ids.setdefault(n, len(ids)) for n, _ in pal], np.int32)
    return look[idx]


def diff_map(subs, base_folder):
    print("Comparing with the base world ...", flush=True)
    bnamed, bchunks, bsubs = read_db(base_folder, lambda v: True)
    ids = {"minecraft:air": 0}
    changed = []                    # (dim, cx, cz, sy, grid_old, grid_new)
    new_chunks = defaultdict(set)
    base_cols = {(d, cx, cz) for (d, cx, cz, sy) in bsubs}
    keys = set(subs) | set(bsubs)
    for key in keys:
        a, b = bsubs.get(key), subs.get(key)
        if a and b and a[0] == b[0]: continue
        d, cx, cz, sy = key
        if (d, cx, cz) not in base_cols:
            new_chunks[d].add((cx, cz)); continue
        changed.append((key, names_grid(a[1] if a else None, ids), names_grid(b[1] if b else None, ids)))
    names = {v: k for k, v in ids.items()}
    placed, removed = Counter(), Counter()
    per_chunk = defaultdict(lambda: {"placed": Counter(), "removed": Counter(), "blocks": []})
    for (d, cx, cz, sy), old, new in changed:
        diff = (old != new).nonzero()
        for lx, lz, ly in zip(*diff):
            o, n = names[int(old[lx, lz, ly])], names[int(new[lx, lz, ly])]
            pc = per_chunk[(d, cx, cz)]
            if n != "minecraft:air": placed[n] += 1; pc["placed"][n] += 1
            if o != "minecraft:air": removed[o] += 1; pc["removed"][o] += 1
            if len(pc["blocks"]) < 20000:
                pc["blocks"].append([cx * 16 + int(lx), sy * 16 + int(ly), cz * 16 + int(lz), o, n])
    # areas of 4x4 chunks (64x64 blocks)
    areas = defaultdict(lambda: {"placed": Counter(), "removed": Counter(), "chunks": 0})
    for (d, cx, cz), pc in per_chunk.items():
        ar = areas[(d, cx >> 2, cz >> 2)]
        ar["placed"].update(pc["placed"]); ar["removed"].update(pc["removed"]); ar["chunks"] += 1
    area_rows = []
    for (d, ax, az), ar in areas.items():
        x, z = ax * 64 + 32, az * 64 + 32
        area_rows.append({"dimension": dim_name(d), "x": [ax * 64, ax * 64 + 63], "z": [az * 64, az * 64 + 63], "near": near(x, z),
                          "placed": sum(ar["placed"].values()), "removed": sum(ar["removed"].values()),
                          "top_placed": ar["placed"].most_common(8), "top_removed": ar["removed"].most_common(8)})
    area_rows.sort(key=lambda r: -(r["placed"] + r["removed"]))
    return {"placed": dict(placed.most_common()), "removed": dict(removed.most_common()), "areas": area_rows,
            "new_chunks": {dim_name(d): {"count": len(s), "x": [min(c[0] for c in s) * 16, max(c[0] for c in s) * 16 + 15],
                                         "z": [min(c[1] for c in s) * 16, max(c[1] for c in s) * 16 + 15]} for d, s in new_chunks.items()},
            "_per_chunk": {f"{dim_name(d)} {cx},{cz}": pc["blocks"] for (d, cx, cz), pc in per_chunk.items()}}


# ------------------------------------------------------------------ the readable report
GR = {"gamemode": "", "doDayLightCycle": "daylight cycle", "doMobSpawning": "mob spawning", "keepInventory": "keep inventory",
      "pvp": "PvP", "showCoordinates": "show coordinates", "commandBlocksEnabled": "command blocks"}


def report(snap):
    L = []
    w = snap["world"]; lvl = w["level_dat"]
    day_ticks = lvl.get("Time") or 0
    L += [f"# World snapshot: {w['name']}", "",
          f"Made {snap['made']} by `tools/world_snapshot.py`. Everything here is also in `snapshot.json`.", "",
          "## The world", "",
          f"- Day {day_ticks // 24000 + 1}, time of day {day_ticks % 24000} (0 is sunrise, 13000 dusk; world clock {day_ticks})",
          f"- Game mode {['Survival', 'Creative', 'Adventure'][lvl.get('GameType', 0)] if lvl.get('GameType', 0) in (0, 1, 2) else lvl.get('GameType')}, "
          f"difficulty {['Peaceful', 'Easy', 'Normal', 'Hard'][lvl.get('Difficulty', 2)] if lvl.get('Difficulty', 2) in (0, 1, 2, 3) else lvl.get('Difficulty')}, "
          f"cheats {'on' if lvl.get('commandsEnabled') else 'off'}",
          f"- World spawn {lvl.get('SpawnX')}, {lvl.get('SpawnY')}, {lvl.get('SpawnZ')}",
          f"- Last played with Minecraft {'.'.join(map(str, lvl.get('lastOpenedWithVersion') or [])) or '?'}"]
    for kind, p in snap["packs"].items():
        for a in p["applied"]:
            m = next((f for f in p["in_world"] if f["uuid"] == a.get("pack_id")), None)
            L.append(f"- {kind.title()} pack {m['name'] if m else a.get('pack_id')} {'.'.join(map(str, a.get('version', [])))}")
    rules = {k: lvl[k] for k in ("doDayLightCycle", "doMobSpawning", "keepInventory", "pvp", "showCoordinates", "commandBlocksEnabled") if k in lvl}
    if rules: L.append("- Game rules: " + ", ".join(f"{GR.get(k, k)} {'on' if v else 'off'}" for k, v in rules.items()))
    for d, c in snap["map"]["chunks"].items():
        L.append(f"- {d}: {c['count']:,} chunks saved, x {c['x'][0]} to {c['x'][1]}, z {c['z'][0]} to {c['z'][1]}")
    L.append("")

    # players
    stores = snap["stores"]
    banks = ((stores.get("siege:economy_banks") or {}).get("of") or {}) if isinstance(stores.get("siege:economy_banks"), dict) else {}
    keeps = ((stores.get("siege:state") or {}).get("keeps") or {}) if isinstance(stores.get("siege:state"), dict) else {}
    L += [f"## Players ({len(snap['players'])})", ""]
    if not snap["players"]: L += ["No player has a save in this world yet.", ""]
    for p in sorted(snap["players"], key=lambda p: (p.get("name") or "~", p.get("id") or "")):
        r = p.get("roster") or {}
        L.append(f"### {p.get('name') or 'Unnamed player'} (id {p.get('id')})")
        L.append("")
        if p.get("note"): L += [f"- {p['note']}", ""]; continue
        if not p.get("name"):
            L.append("- No name on record: this world was last saved by a build from before the roster. Their name shows once they join on a newer build.")
        regals = banks.get(p["id"]) if p.get("id") in banks else r.get("regals")
        L.append(f"- Regals: {regals if regals is not None else 'none on record'}")
        if r.get("mode"): L.append(f"- Playing {r['mode']}")
        if r.get("settlement"): L.append(f"- Settlement: {r['settlement']}")
        if r.get("steps"): L.append("- Story steps on their tracker: " + "; ".join(r["steps"]))
        elif r: L.append("- Story steps on their tracker: none (story done, or nothing to show)")
        if r.get("seen"): L.append(f"- Last seen in game: {r['seen']}")
        L.append(f"- {p['gamemode']}, {p['dimension']} at {p['pos'][0]:.0f}, {p['pos'][1]:.0f}, {p['pos'][2]:.0f} ({p['near']})")
        L.append(f"- Health {p['health']}, hunger {p['hunger']}, XP level {p['xp_level']}")
        if p.get("spawn") and p["spawn"][0] is not None: L.append(f"- Respawn point {p['spawn'][0]}, {p['spawn'][1]}, {p['spawn'][2]}")
        L.append(f"- Inventory: {items_line(p['inventory'])}")
        L.append(f"- Armour: {items_line(p['armor'])}; off hand: {items_line(p['offhand'])}")
        L.append(f"- Ender chest: {items_line(p['ender_chest'])}")
        if p.get("tags"): L.append(f"- Tags: {', '.join(p['tags'])}")
        dp = p.get("dynamic_properties") or {}
        if dp:
            L.append(f"- Saved on the player ({len(dp)}): " + ", ".join(f"`{k}`" for k in sorted(dp)))
        L.append("")

    # settlements
    if keeps:
        roster = (stores.get(ROSTER) or {}).get("players", {}) if isinstance(stores.get(ROSTER), dict) else {}
        L += [f"## Settlements ({len(keeps)})", ""]
        for owner, k in keeps.items():
            if not isinstance(k, dict): continue
            who = (roster.get(owner) or {}).get("name") or (f"rival lord {owner}" if not owner.lstrip("-").isdigit() else f"player {owner}")
            c = k.get("center") or k.get("banner") or k.get("pos") or {}
            at = f" at {c.get('x')}, {c.get('y')}, {c.get('z')} ({near(c.get('x', 0), c.get('z', 0))})" if isinstance(c, dict) and "x" in c else ""
            L.append(f"- **{k.get('name') or who}** ({who}){at}: {k.get('wins', 0)} sieges held, {k.get('warlordsSlain', 0)} warlords slain"
                     + (f", colour {k['color']}" if k.get("color") is not None else ""))
        L.append("")

    # containers
    cont = [c for c in snap["block_entities"] if c.get("items")]
    L += [f"## Chests and containers ({len(cont)} with something in them, {len(snap['block_entities'])} block entities in all)", ""]
    kinds = Counter(c["type"] for c in snap["block_entities"])
    L.append("All block entities: " + ", ".join(f"{k} {n}" for k, n in kinds.most_common()))
    L.append("")
    for c in sorted(cont, key=lambda c: (c["dimension"], c["pos"][0] or 0, c["pos"][2] or 0)):
        x, y, z = c["pos"]
        L.append(f"- {c['type']}{' “' + c['name'] + '”' if c.get('name') else ''} at {x}, {y}, {z}, {c['dimension']} ({near(x or 0, z or 0)}): {items_line(c['items'], 25)}")
    signs = [c for c in snap["block_entities"] if c.get("text") and any(t.strip() for t in c["text"])]
    if signs:
        L += ["", f"### Signs with writing ({len(signs)})", ""]
        for c in signs[:300]:
            L.append(f"- {c['pos'][0]}, {c['pos'][1]}, {c['pos'][2]}: " + " / ".join(t.replace("\n", " ") for t in c["text"] if t.strip()))
    L.append("")

    # entities
    ents = snap["entities"]
    L += [f"## Creatures, NPCs and other entities ({len(ents)})", ""]
    by = Counter((e["type"], e["dimension"]) for e in ents)
    for (t, d), n in sorted(by.items(), key=lambda kv: (-kv[1], kv[0])):
        L.append(f"- {t} x{n} ({d})")
    named = [e for e in ents if e.get("name")]
    if named:
        L += ["", f"### Named ones ({len(named)})", ""]
        for e in sorted(named, key=lambda e: e["name"])[:400]:
            L.append(f"- {e['name']} ({e['type']}) at {e['pos'][0]:.0f}, {e['pos'][1]:.0f}, {e['pos'][2]:.0f}, {e['dimension']} ({near(e['pos'][0], e['pos'][2])})")
    L.append("")

    # stores
    L += [f"## The add-on's saved data ({len(stores)} records)", "",
          "Every saved store, decoded, is under `stores` in snapshot.json. Size is the saved text.", ""]
    for k in sorted(stores):
        v = stores[k]
        size = len(json.dumps(v)) if not isinstance(v, str) else len(v)
        what = ", ".join(list(v.keys())[:12]) if isinstance(v, dict) else type(v).__name__
        L.append(f"- `{k}` ({size:,} chars): {what}")
    L.append("")

    if snap.get("scoreboard"):
        sb = snap["scoreboard"]
        L += ["## Scoreboard", ""]
        for o in sb.get("Objectives", []) if isinstance(sb, dict) else []:
            L.append(f"- {o.get('DisplayName') or o.get('Name')}: " + ", ".join(f"{s.get('ScoreboardId')}={s.get('Score')}" for s in o.get("Scores", [])[:50]))
        L.append("")

    cb = snap["map"].get("custom_blocks")
    if cb:
        L += [f"## The add-on's blocks on the map ({len(cb)} kinds)", ""]
        for name, c in list(cb.items())[:120]:
            L.append(f"- {name} x{c['count']:,}")
        L.append("")
    ch = snap["map"].get("changes")
    if ch:
        L += ["## What changed since the base world", "",
              f"{sum(ch['placed'].values()):,} blocks placed and {sum(ch['removed'].values()):,} removed or replaced, in {len(ch['areas'])} areas of 64 x 64 blocks. "
              "Every block is in blocks-changed.json.gz.", ""]
        for d, c in ch["new_chunks"].items():
            L.append(f"- New ground generated past the base map in the {d}: {c['count']:,} chunks, x {c['x'][0]} to {c['x'][1]}, z {c['z'][0]} to {c['z'][1]}")
        L += ["", "Most placed: " + ", ".join(f"{k.replace('minecraft:', '')} {n:,}" for k, n in list(ch["placed"].items())[:20]),
              "", "Most removed: " + ", ".join(f"{k.replace('minecraft:', '')} {n:,}" for k, n in list(ch["removed"].items())[:20]), "",
              "| Area (x, z) | Where | Placed | Removed | Mostly |", "|---|---|---|---|---|"]
        for a in ch["areas"][:150]:
            top = ", ".join(k.replace("minecraft:", "") for k, _ in a["top_placed"][:4])
            L.append(f"| {a['x'][0]}..{a['x'][1]}, {a['z'][0]}..{a['z'][1]} | {a['near']} | {a['placed']:,} | {a['removed']:,} | {top} |")
        L.append("")
    if snap.get("other_records"):
        L += ["## Other world records", "", ", ".join(f"`{k}`" for k in sorted(snap["other_records"])), ""]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("world")
    ap.add_argument("--base", help="the world it started from, to list every changed block")
    ap.add_argument("--out")
    ap.add_argument("--no-blocks", action="store_true", help="skip the block count and the map comparison (faster)")
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as t1, tempfile.TemporaryDirectory() as t2:
        wf = open_world(a.world, t1)
        bf = open_world(a.base, t2) if a.base and not a.no_blocks else None
        snap = snapshot(wf, bf, blocks=not a.no_blocks)
        name = re.sub(r"[^A-Za-z0-9_-]+", "-", snap["world"]["name"] or "world").strip("-") or "world"
        out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.world)), "world-snapshot", f"{name}-{snap['made'][:10]}")
        os.makedirs(out, exist_ok=True)
        per_chunk = (snap["map"].get("changes") or {}).pop("_per_chunk", None)
        if per_chunk is not None:
            with gzip.open(os.path.join(out, "blocks-changed.json.gz"), "wt", encoding="utf8") as f:
                json.dump(per_chunk, f, separators=(",", ":"))
        with open(os.path.join(out, "snapshot.json"), "w", encoding="utf8") as f:
            json.dump(snap, f, indent=1, default=str, ensure_ascii=False)
        with open(os.path.join(out, "REPORT.md"), "w", encoding="utf8") as f:
            f.write(report(snap))
    print(f"Wrote {out}/REPORT.md and snapshot.json: {len(snap['players'])} players, {len(snap['entities'])} entities, "
          f"{len(snap['block_entities'])} block entities, {len(snap['stores'])} saved stores")


if __name__ == "__main__":
    main()
