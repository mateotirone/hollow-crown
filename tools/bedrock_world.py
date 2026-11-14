#!/usr/bin/env python3
"""Read blocks out of a Bedrock world (.mcworld or its unzipped folder) without amulet: a small LevelDB reader
(tables and logs, Mojang's raw-zlib blocks) and the sub-chunk format 8/9 decoder. Read-only.

    from bedrock_world import World
    w = World("/path/world")              # the folder holding db/
    blocks = w.box(x0, y0, z0, x1, y1, z1) # {(x, y, z): (name, states)} for every non-air block, inclusive box

Overworld only (the towns and plots). Used by tools/town_audit.py.
"""
import os, struct, zlib, glob
import numpy as np

MAGIC = 0xdb4775248b80fb57


def varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i


def _decomp(raw, kind):
    if kind == 0: return raw
    if kind == 2: return zlib.decompress(raw)
    if kind == 4: return zlib.decompress(raw, -15)
    raise ValueError(f"leveldb block compression {kind} not supported")


def _entries(block):
    n = struct.unpack_from("<I", block, len(block) - 4)[0]
    end = len(block) - 4 - 4 * n
    i, key = 0, b""
    while i < end:
        sh, i = varint(block, i); ns, i = varint(block, i); vl, i = varint(block, i)
        key = key[:sh] + block[i:i + ns]; i += ns
        yield key, block[i:i + vl]; i += vl


def _table(path, want):
    d = open(path, "rb").read()
    f = d[-48:]
    if struct.unpack_from("<Q", f, 40)[0] != MAGIC: return
    i = 0
    _, i = varint(f, i); _, i = varint(f, i)
    io, i = varint(f, i); isz, i = varint(f, i)
    index = _decomp(d[io:io + isz], d[io + isz])
    for _k, h in _entries(index):
        bo, j = varint(h, 0); bsz, j = varint(h, j)
        blk = _decomp(d[bo:bo + bsz], d[bo + bsz])
        for k, v in _entries(blk):
            uk, tail = k[:-8], struct.unpack("<Q", k[-8:])[0]
            if want(uk): yield uk, tail >> 8, tail & 0xff, v


def _log(path, want):
    d = open(path, "rb").read()
    recs, buf, i = [], b"", 0
    while i + 7 <= len(d):
        blk_left = 32768 - (i % 32768)
        if blk_left < 7: i += blk_left; continue
        ln, typ = struct.unpack_from("<HB", d, i + 4)
        data = d[i + 7:i + 7 + ln]; i += 7 + ln
        if typ == 1: recs.append(data)
        elif typ == 2: buf = data
        elif typ == 3: buf += data
        elif typ == 4: recs.append(buf + data); buf = b""
        elif typ == 0: break
    for r in recs:
        seq, cnt = struct.unpack_from("<QI", r, 0); j = 12
        for n in range(cnt):
            t = r[j]; j += 1
            kl, j = varint(r, j); k = r[j:j + kl]; j += kl
            v = b""
            if t == 1:
                vl, j = varint(r, j); v = r[j:j + vl]; j += vl
            if want(k): yield k, seq + n, t, v


# ---------------------------------------------------------------- little-endian NBT (just what palettes use)
def _nbt(b, i, t):
    if t == 1: return struct.unpack_from("<b", b, i)[0], i + 1
    if t == 2: return struct.unpack_from("<h", b, i)[0], i + 2
    if t == 3: return struct.unpack_from("<i", b, i)[0], i + 4
    if t == 4: return struct.unpack_from("<q", b, i)[0], i + 8
    if t == 5: return struct.unpack_from("<f", b, i)[0], i + 4
    if t == 6: return struct.unpack_from("<d", b, i)[0], i + 8
    if t == 8:
        n = struct.unpack_from("<H", b, i)[0]; return b[i + 2:i + 2 + n].decode("utf8", "replace"), i + 2 + n
    if t == 10:
        out = {}
        while True:
            ct = b[i]; i += 1
            if ct == 0: return out, i
            n = struct.unpack_from("<H", b, i)[0]; name = b[i + 2:i + 2 + n].decode(); i += 2 + n
            out[name], i = _nbt(b, i, ct)
    if t == 9:
        ct = b[i]; n = struct.unpack_from("<i", b, i + 1)[0]; i += 5; out = []
        for _ in range(n):
            v, i = _nbt(b, i, ct); out.append(v)
        return out, i
    if t in (7, 11, 12):
        n = struct.unpack_from("<i", b, i)[0]; w = {7: 1, 11: 4, 12: 8}[t]; return None, i + 4 + n * w
    raise ValueError(f"nbt tag {t}")


def _root(b, i):
    t = b[i]; n = struct.unpack_from("<H", b, i + 1)[0]; i += 3 + n
    return _nbt(b, i, t)


def subchunk(v):
    """-> (names list, index array [16,16,16] as x,z,y) for the first storage layer, or None. Layer 2 (water) too."""
    ver = v[0]; i = 1
    if ver in (8, 9):
        n = v[i]; i += 1
        if ver == 9: i += 1
    elif ver == 1: n = 1
    else: return None
    layers = []
    for _ in range(n):
        hdr = v[i]; i += 1; bits = hdr >> 1
        if bits == 0:
            idx = np.zeros(4096, np.uint32)
        else:
            bpw = 32 // bits; words = -(-4096 // bpw)
            w = np.frombuffer(v, "<u4", words, i); i += 4 * words
            sh = (np.arange(bpw, dtype=np.uint32) * bits)
            idx = ((w[:, None] >> sh[None, :]) & ((1 << bits) - 1)).reshape(-1)[:4096]
        ps = struct.unpack_from("<i", v, i)[0]; i += 4
        pal = []
        for _ in range(ps):
            c, i = _root(v, i)
            pal.append((c.get("name", "minecraft:air"), c.get("states", {})))
        layers.append((pal, idx.reshape(16, 16, 16)))
    return layers


class World:
    def __init__(self, folder):
        self.db = os.path.join(folder, "db")
        self.cache = {}

    def load_chunks(self, chunks):
        """chunks: set of (cx, cz). Reads every sub-chunk of them (overworld) into memory, newest value wins."""
        want_set = set()
        for cx, cz in chunks: want_set.add(struct.pack("<ii", cx, cz))

        def want(k):
            return len(k) == 10 and k[8] == 47 and k[:8] in want_set
        best = {}
        files = sorted(glob.glob(os.path.join(self.db, "*.ldb"))) + sorted(glob.glob(os.path.join(self.db, "*.log")))
        for f in files:
            it = _table(f, want) if f.endswith(".ldb") else _log(f, want)
            for k, seq, t, v in it:
                if k not in best or best[k][0] < seq: best[k] = (seq, t, v)
        for k, (seq, t, v) in best.items():
            if t != 1: continue
            cx, cz = struct.unpack_from("<ii", k); sy = struct.unpack_from("<b", k, 9)[0]
            self.cache[(cx, cz, sy)] = subchunk(v)

    def box(self, x0, y0, z0, x1, y1, z1, water=True):
        need = {(cx, cz) for cx in range(x0 >> 4, (x1 >> 4) + 1) for cz in range(z0 >> 4, (z1 >> 4) + 1)}
        missing = {c for c in need if not any((c[0], c[1], sy) in self.cache for sy in range(-4, 20))}
        if missing: self.load_chunks(missing)
        out = {}
        for (cx, cz) in need:
            for sy in range((y0 >> 4), (y1 >> 4) + 1):
                layers = self.cache.get((cx, cz, sy))
                if not layers: continue
                for li, (pal, idx) in enumerate(layers[:2]):
                    if li == 1 and not water: break
                    names = [p[0] for p in pal]
                    solid = np.array([n != "minecraft:air" for n in names])
                    m = solid[idx]
                    for lx, lz, ly in zip(*np.nonzero(m)):
                        x, y, z = cx * 16 + int(lx), sy * 16 + int(ly), cz * 16 + int(lz)
                        if not (x0 <= x <= x1 and y0 <= y <= y1 and z0 <= z <= z1): continue
                        p = pal[idx[lx, lz, ly]]
                        if li == 0: out[(x, y, z)] = p
                        elif (x, y, z) not in out or out[(x, y, z)][0] == "minecraft:air": out[(x, y, z)] = p
        return out
