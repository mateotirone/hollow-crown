"""Blueprint: a sparse 3D grid of vanilla Bedrock blocks, plus writers.

Coordinates: x east, y up, z south (as in Minecraft). y = 0 is the ground
surface the structure sits on; the building's ground floor is at y = 1.
Cells never set are "keep" (structure_void): the terrain there is left alone.
Set a cell to "air" to clear it (interiors, doorways).

Blocks are stored with *logical* properties that are easy to build with:
  facing  n/s/e/w   stairs: the tall back side; doors/trapdoors: Java-style facing
  half    bottom/top  stairs, slabs, trapdoors
  axis    x/y/z     logs, hay
  open, hanging, upper, hinge
Fence, wall and pane connections are worked out by finish().
to_bedrock() turns them into real Bedrock block states (checked against
bedrock_states.json, Mojang's own block list), so a typo fails loudly here
instead of turning into an unknown block in game.
"""
import json, os, struct, math

HERE = os.path.dirname(os.path.abspath(__file__))
_ST = json.load(open(os.path.join(HERE, "bedrock_states.json")))
BLOCKS, PROPS = _ST["blocks"], _ST["properties"]
DIRS = {"n": (0, 0, -1), "s": (0, 0, 1), "e": (1, 0, 0), "w": (-1, 0, 0)}
OPP = {"n": "s", "s": "n", "e": "w", "w": "e"}
LEFT = {"n": "w", "w": "s", "s": "e", "e": "n"}    # turning left from a facing
RIGHT = {v: k for k, v in LEFT.items()}

def _pack_blocks():
    """The add-on's own blocks (siege:..., hc:...): their states with the first value as default, and
    whether they take a placement facing. Read from the behaviour pack beside this folder."""
    import glob
    out = {}
    for f in glob.glob(os.path.join(HERE, "..", "..", "Siege_Nights_BP", "blocks", "**", "*.json"), recursive=True):
        try: d = json.load(open(f))["minecraft:block"]["description"]
        except Exception: continue
        st = {k: v[0] if isinstance(v, list) else (v.get("values", [0])[0] if isinstance(v, dict) else v) for k, v in (d.get("states") or {}).items()}
        for t in (d.get("traits") or {}).values():
            for e in t.get("enabled_states", []): st[e] = {"minecraft:cardinal_direction": "south", "minecraft:facing_direction": "south",
                                                          "minecraft:vertical_half": "bottom", "minecraft:block_face": "up"}.get(e, 0)
        if "siege:armor" in st: st["siege:armor"] = max(d["states"]["siege:armor"])   # castle stone at full strength
        out[d["identifier"]] = st
    return out
PACK = _pack_blocks()

def is_fence(n): return n.endswith("_fence") and "gate" not in n
def is_wall(n): return n.endswith("_wall") and n not in ("wall_banner",)
def is_pane(n): return n.endswith("glass_pane") or n == "iron_bars"
def is_stairs(n): return n.endswith("_stairs")
def is_slab(n): return n.endswith("_slab")
NONSOLID = ("air", "keep", "wheat", "carrots", "potatoes", "beetroot", "sweet_berry_bush", "lantern", "soul_lantern", "flower_pot", "torch", "short_grass", "tall_grass", "poppy", "dandelion",
            "cornflower", "oxeye_daisy", "azure_bluet", "allium", "red_tulip", "white_tulip", "orange_tulip", "pink_tulip",
            "water", "carpet", "rail", "ladder", "lily_of_the_valley", "fern", "large_fern", "wheat", "sweet_berry_bush",
            "vine", "leaf_litter", "pale_hanging_moss", "hanging_roots", "bush", "firefly_bush", "mangrove_roots", "snow_layer",
            "glow_lichen", "moss_carpet", "pale_moss_carpet", "deadbush", "short_dry_grass", "tall_dry_grass")

def solid_full(name, p):
    """True for blocks that fill their whole cell (used for connections and render culling)."""
    if name in NONSOLID or name.endswith("_carpet") or name.endswith("_leaves"): return False
    if is_stairs(name) or is_slab(name) or is_fence(name) or is_wall(name) or is_pane(name): return False
    if name in ("bed", "chest", "cauldron", "lectern", "brewing_stand") or name.endswith("pressure_plate"): return False
    if name.endswith("trapdoor") or name.endswith("_door") or name.endswith("fence_gate") or name.endswith("_sign"): return False
    if name in ("campfire", "bell", "chain", "iron_chain", "cauldron", "anvil", "grindstone", "lectern", "end_rod", "candle", "snow_layer",
                "water_cauldron", "lightning_rod", "decorated_pot", "white_candle", "mangrove_roots", "iron_bars"): return False
    return True


BEDROCK_ALIAS = {"prismarine_brick_stairs": ("prismarine_bricks_stairs", {}), "dark_oak_wall_sign": ("darkoak_wall_sign", {}), "oak_wall_sign": ("wall_sign", {}),
                 "dark_oak_standing_sign": ("darkoak_standing_sign", {}), "oak_sign": ("standing_sign", {}),
                 "water_cauldron": ("cauldron", {"fill_level": 6, "cauldron_liquid": "water"})}

class Blueprint:
    def __init__(self, name):
        self.name = name
        self.cells = {}          # (x,y,z) -> (name, props dict)
        self.notes = []
        self.markers = {}        # named points (doors, NPC spots, sign spots)

    # ---- basic editing
    def set(self, x, y, z, name, **p):
        if callable(name): name, p2 = name(x, y, z); p = {**p2, **p}
        self.cells[(x, y, z)] = (name, p)

    def setif(self, x, y, z, name, **p):
        """Set only if the cell is empty, keep or air."""
        c = self.cells.get((x, y, z))
        if c is None or c[0] in ("air", "keep"): self.set(x, y, z, name, **p)

    def get(self, x, y, z):
        return self.cells.get((x, y, z), ("keep", {}))

    def fill(self, x0, y0, z0, x1, y1, z1, name, **p):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.set(x, y, z, name, **p)

    def fillif(self, x0, y0, z0, x1, y1, z1, name, **p):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.setif(x, y, z, name, **p)

    def paste(self, other, ox, oy, oz):
        for (x, y, z), v in other.cells.items(): self.cells[(x + ox, y + oy, z + oz)] = v
        for k, (x, y, z) in other.markers.items(): self.markers[k] = (x + ox, y + oy, z + oz)

    def rotated(self, deg):
        """A copy turned clockwise (seen from above) by 0/90/180/270 degrees about the origin.
        A building whose front faces south faces west after 90. Facings and axes turn with it."""
        k = (deg // 90) % 4; out = Blueprint(self.name); out.notes = list(self.notes)
        def rp(x, z):
            for _ in range(k): x, z = -z, x
            return x, z
        def rf(f):
            for _ in range(k): f = RIGHT[f]
            return f
        for (x, y, z), (n, p) in self.cells.items():
            q = dict(p)
            if "facing" in q and q["facing"] in DIRS: q["facing"] = rf(q["facing"])
            if "attach" in q and q["attach"] in DIRS: q["attach"] = rf(q["attach"])      # a vine's wall turns too
            if k % 2 and q.get("axis") in ("x", "z"): q["axis"] = "z" if q["axis"] == "x" else "x"
            q.pop("conn", None); q.pop("post", None)
            nx, nz = rp(x, z); out.cells[(nx, y, nz)] = (n, q)
        for m, (x, y, z) in self.markers.items():
            nx, nz = rp(x, z); out.markers[m] = (nx, y, nz)
        return out.finish()

    def bounds(self):
        xs, ys, zs = zip(*self.cells)
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    # ---- connections
    def finish(self):
        """Work out fence, wall and pane connections from neighbours."""
        for (x, y, z), (n, p) in list(self.cells.items()):
            if not (is_fence(n) or is_wall(n) or is_pane(n)): continue
            conn = {}
            for d, (dx, dy, dz) in DIRS.items():
                m, q = self.get(x + dx, y, z + dz)
                ok = solid_full(m, q) and m != "keep"
                if is_fence(n): ok = ok or is_fence(m) or m.endswith("fence_gate")
                if is_wall(n): ok = ok or is_wall(m)
                if is_pane(n): ok = ok or is_pane(m) or is_wall(m)
                conn[d] = ok
            p = dict(p); p["conn"] = conn
            if is_wall(n):
                above = self.get(x, y + 1, z)[0]
                straight = (conn["n"] and conn["s"] and not conn["e"] and not conn["w"]) or (conn["e"] and conn["w"] and not conn["n"] and not conn["s"])
                p["post"] = not straight or (above not in ("air", "keep"))
            self.cells[(x, y, z)] = (n, p)
        return self

    # ---- export
    def to_bedrock(self, name, p):
        if name == "keep": return ("minecraft:structure_void", {"structure_void_type": "void"})
        if name in PACK:   # one of the add-on's own blocks: its own states, the facing if it takes one
            st = dict(PACK[name])
            f = p.get("facing")
            if f and "minecraft:cardinal_direction" in st: st["minecraft:cardinal_direction"] = {"n": "north", "s": "south", "e": "east", "w": "west"}[f]
            if "minecraft:vertical_half" in st and p.get("half"): st["minecraft:vertical_half"] = p["half"]
            for k, v in p.get("raw", {}).items(): st[k] = v
            return (name, st)
        if name.startswith("minecraft:"): name = name[10:]
        name = {"oak_trapdoor": "trapdoor", "oak_door": "wooden_door"}.get(name, name)
        if name in BEDROCK_ALIAS:                    # Java-style names the builders use -> Bedrock's own ids
            name, extra = BEDROCK_ALIAS[name]; p = {**p, "raw": {**extra, **p.get("raw", {})}}
        if name not in BLOCKS: raise ValueError(f"{self.name}: '{name}' is not a Bedrock block")
        st = {}
        for prop in BLOCKS[name]:
            v = PROPS[prop]["values"][0]
            st[prop] = v
        f = p.get("facing")
        if is_stairs(name):
            st["weirdo_direction"] = {"e": 0, "w": 1, "s": 2, "n": 3}[f or "n"]
            st["upside_down_bit"] = p.get("half") == "top"
        if is_slab(name) and "minecraft:vertical_half" in st: st["minecraft:vertical_half"] = p.get("half", "bottom")
        if "pillar_axis" in st: st["pillar_axis"] = p.get("axis", "y")
        if name.endswith("trapdoor"):
            # Bedrock trapdoor direction: 0 east, 1 west, 2 south, 3 north (flagged for an in-game check)
            st["direction"] = {"e": 0, "w": 1, "s": 2, "n": 3}[f or "n"]
            st["open_bit"] = bool(p.get("open"))
            st["upside_down_bit"] = p.get("half") == "top"
        if name.endswith("_door"):
            st["minecraft:cardinal_direction"] = {"n": "north", "s": "south", "e": "east", "w": "west"}[f or "s"]
            st["upper_block_bit"] = bool(p.get("upper")); st["door_hinge_bit"] = bool(p.get("hinge")); st["open_bit"] = bool(p.get("open"))
        if "minecraft:cardinal_direction" in st and f and not name.endswith("_door"):
            st["minecraft:cardinal_direction"] = {"n": "north", "s": "south", "e": "east", "w": "west"}[f]
        if "hanging" in st: st["hanging"] = bool(p.get("hanging"))
        if name == "bed":
            # Bedrock bed direction: 0 south, 1 west, 2 north, 3 east (head end); flagged for an in-game check
            st["direction"] = {"s": 0, "w": 1, "n": 2, "e": 3}[f or "s"]; st["head_piece_bit"] = bool(p.get("head"))
        if "persistent_bit" in st: st["persistent_bit"] = True
        if "extinguished" in st: st["extinguished"] = bool(p.get("out", False))
        if "facing_direction" in st and name in ("barrel",): st["facing_direction"] = 1
        if "facing_direction" in st and (name.endswith("wall_sign") or name in ("ladder", "frame", "glow_frame") or name.endswith("_button")) and f:
            st["facing_direction"] = {"n": 2, "s": 3, "w": 4, "e": 5}[f]     # the way the sign, ladder, item frame or button faces
            # (an item frame left on 0 hangs from the block above and pops off: the arena racks, 2026-11-13)
        if name == "vine" and p.get("attach") in DIRS:   # bits: 1 south, 2 west, 4 north, 8 east = the side it clings to
            st["vine_direction_bits"] = {"s": 1, "w": 2, "n": 4, "e": 8}[p["attach"]]
        if name == "bell" and f: st["direction"] = {"s": 0, "w": 1, "n": 2, "e": 3}[f]
        c = p.get("conn")
        if c and is_fence(name):
            for d, w in (("n", "north"), ("s", "south"), ("e", "east"), ("w", "west")): st["minecraft:connection_" + w] = c[d]
        if c and is_wall(name):
            for d, w in (("n", "north"), ("s", "south"), ("e", "east"), ("w", "west")): st["wall_connection_type_" + w] = "short" if c[d] else "none"
            st["wall_post_bit"] = bool(p.get("post", True))
        for k, v in p.get("raw", {}).items(): st[k] = v
        for k, v in st.items():
            if v not in PROPS[k]["values"]: raise ValueError(f"{self.name}: {name} {k}={v!r} not allowed")
        return ("minecraft:" + name, st)

    def _grid(self, origin=None):
        lo, hi = self.bounds()
        o = origin or lo
        size = (hi[0] - o[0] + 1, hi[1] - o[1] + 1, hi[2] - o[2] + 1)
        return o, size

    def palette_and_blocks(self):
        pal, idx, out = [], {}, []
        for (x, y, z), (n, p) in sorted(self.cells.items()):
            b = self.to_bedrock(n, p)
            key = json.dumps(b, sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append({"name": b[0], "states": b[1]})
            out.append((x, y, z, idx[key]))
        return pal, out

    def save_json(self, path):
        """Stamp format for the world writer: palette + block list, offsets from 'origin'."""
        o, size = self._grid()
        pal, blocks = self.palette_and_blocks()
        data = {"name": self.name, "format": "hollow-crown-stamp/1", "size": list(size),
                "origin": list(o), "ground_y": 0,
                "rotations": getattr(self, "rotations", [0, 90, 180, 270]),
                "fill_below": getattr(self, "fill_below", "cobblestone"), "note": "y=0 is the ground surface; cells not listed are left as they are",
                "markers": self.markers, "palette": pal,
                "blocks": [[x - o[0], y - o[1], z - o[2], i] for x, y, z, i in blocks]}
        with open(path, "w") as f: json.dump(data, f, separators=(",", ":"))
        return data

    def save_logical(self, path):
        """Logical form for the preview renderer."""
        o, size = self._grid()
        pal, idx, rows = [], {}, []
        for (x, y, z), (n, p) in sorted(self.cells.items()):
            if n == "keep": continue
            key = json.dumps([n, p], sort_keys=True)
            if key not in idx: idx[key] = len(pal); pal.append([n, p])
            rows.append([x, y, z, idx[key]])
        with open(path, "w") as f: json.dump({"name": self.name, "palette": pal, "blocks": rows, "camera": getattr(self, "camera", None)}, f, separators=(",", ":"))

    def save_mcstructure(self, path, version=(26, 30, 0)):
        """Bedrock .mcstructure (little-endian NBT). Unset cells are structure_void."""
        o, size = self._grid()
        sx, sy, sz = size
        if sx > 64 or sz > 64: self.notes.append(f"{os.path.basename(path)} is {sx}x{sz}; tile to 64x64 for /structure load")
        pal, blocks = self.palette_and_blocks()
        void = len(pal); pal.append({"name": "minecraft:structure_void", "states": {"structure_void_type": "void"}})
        layer = [void] * (sx * sy * sz)
        for x, y, z, i in blocks:
            layer[((x - o[0]) * sy + (y - o[1])) * sz + (z - o[2])] = i
        ver = (version[0] << 24) | (version[1] << 16) | (version[2] << 8)
        w = _Nbt()
        w.begin_compound("")
        w.int("format_version", 1)
        w.list_int("size", list(size))
        w.begin_compound("structure")
        w.begin_list("block_indices", 9, 2)
        w.list_payload_int(layer); w.list_payload_int([-1] * len(layer))
        w.begin_list("entities", 10, 0)
        w.begin_compound("palette"); w.begin_compound("default")
        w.begin_list("block_palette", 10, len(pal))
        for e in pal:
            w.str("name", e["name"])
            w.begin_compound("states")
            for k, v in e["states"].items():
                if isinstance(v, bool): w.byte(k, int(v))
                elif isinstance(v, int): w.int(k, v)
                else: w.str(k, v)
            w.end()
            w.int("version", ver)
            w.end()                       # end palette entry compound
        w.begin_compound("block_position_data"); w.end()
        w.end(); w.end()                  # default, palette
        w.end()                           # structure
        w.list_int("structure_world_origin", [0, 0, 0])
        w.end()                           # root
        with open(path, "wb") as f: f.write(w.buf)


class _Nbt:
    """Minimal little-endian NBT writer (enough for .mcstructure)."""
    def __init__(self): self.buf = bytearray()
    def _name(self, t, n):
        b = n.encode(); self.buf += struct.pack("<bH", t, len(b)) + b
    def begin_compound(self, n): self._name(10, n)
    def end(self): self.buf += b"\x00"
    def int(self, n, v): self._name(3, n); self.buf += struct.pack("<i", v)
    def byte(self, n, v): self._name(1, n); self.buf += struct.pack("<b", v)
    def str(self, n, v):
        self._name(8, n); b = v.encode(); self.buf += struct.pack("<H", len(b)) + b
    def list_int(self, n, vals):
        self._name(9, n); self.buf += struct.pack("<bi", 3, len(vals)) + struct.pack(f"<{len(vals)}i", *vals)
    def begin_list(self, n, t, count):
        self._name(9, n); self.buf += struct.pack("<bi", t, count)
    def list_payload_int(self, vals):
        """One nested list of ints, inside a list of lists."""
        self.buf += struct.pack("<bi", 3, len(vals)) + struct.pack(f"<{len(vals)}i", *vals)
