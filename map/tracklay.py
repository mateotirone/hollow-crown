#!/usr/bin/env python3
"""Turn a rail line's block path into Track blocks (siege:track) with the right block states.

Pure: touches no files and needs no Amulet, so map/genworld.py can call it and tests can run it.

    from tracklay import lay
    blocks = lay(path, stations=[], junctions=[])
    # -> [(x, y, z, {"siege:kind": k, "siege:dir": d}), ...] one per path position, in path order

path: integer (x, y, z) block positions, each next to the one before (8-connected, diagonals allowed).
      Height may change by one block only on a north/south/east/west step, and never twice in a row
      (the map keeps it to at most 1 block up per 3 along the line). y is the block the track sits IN
      (the air block above the bed). A closed loop repeats nothing: pass closed=True instead.
stations, junctions: (x, z) spots on the path. Accepted now so the call stays the same; passing loops at
      stations and switches at junctions are added once switches exist in the game (see the train design doc).

The shape list and the rules match Siege_Nights_BP/scripts/trains/track.js (SHAPES). Run this file to self-test.
"""

DX = [0, 1, 1, 1, 0, -1, -1, -1]
DZ = [-1, -1, 0, 1, 1, 1, 0, -1]
NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# (kind, dir, links, up) exactly as track.js builds SHAPES
SHAPES = []
for _d in range(4):
    SHAPES.append((0, _d, (_d, _d + 4), None))
for _i, _d in enumerate([0, 2, 4, 6]):
    SHAPES.append((1, _i * 2, (_d, (_d + 3) % 8), None))
    SHAPES.append((1, _i * 2 + 1, (_d, (_d + 5) % 8), None))
for _i, _d in enumerate([0, 2, 4, 6]):
    SHAPES.append((2, _i, (_d, (_d + 2) % 8), None))
for _i, _d in enumerate([0, 2, 4, 6]):
    SHAPES.append((3, _i, ((_d + 4) % 8, _d), _d))


def _dir(a, b):
    dx, dz = b[0] - a[0], b[2] - a[2]
    if max(abs(dx), abs(dz)) != 1:
        raise ValueError(f"track path jumps from {a} to {b}: steps must be to a neighbouring block")
    for d in range(8):
        if DX[d] == dx and DZ[d] == dz:
            return d


def _flat(a, b, at):
    for kind, d, links, up in SHAPES:
        if up is None and set(links) == {a, b} and a != b:
            return kind, d
    raise ValueError(f"no Track piece turns from {NAMES[a]} to {NAMES[b]} at {at}: "
                     "turn at most 45 degrees per block on the line (90 only at an orthogonal corner)")


def _slope(up, at):
    for kind, d, links, u in SHAPES:
        if u == up:
            return kind, d
    raise ValueError(f"track can only climb on a north/south/east/west step, at {at}")


def shape_at(prev, p, nxt):
    """(kind, dir) of the piece at p, given its neighbours on the path (prev or nxt may be None at an end)."""
    to_prev = _dir(p, prev) if prev else None
    to_next = _dir(p, nxt) if nxt else None
    if nxt and nxt[1] == p[1] + 1:
        if prev and to_prev != (to_next + 4) % 8:
            raise ValueError(f"a slope must run straight through, at {p}")
        return _slope(to_next, p)
    if prev and prev[1] == p[1] + 1:
        if nxt and to_next != (to_prev + 4) % 8:
            raise ValueError(f"a slope must run straight through, at {p}")
        return _slope(to_prev, p)
    for q in (prev, nxt):
        if q and abs(q[1] - p[1]) > 1:
            raise ValueError(f"track climbs more than one block at once near {p}")
    if to_prev is None:
        to_prev = (to_next + 4) % 8
    if to_next is None:
        to_next = (to_prev + 4) % 8
    return _flat(to_prev, to_next, p)


def lay(path, stations=(), junctions=(), closed=False):
    path = [tuple(int(v) for v in p) for p in path]
    if len(path) < 2:
        raise ValueError("a track path needs at least two blocks")
    out = []
    n = len(path)
    for i, p in enumerate(path):
        prev = path[i - 1] if (i > 0 or closed) else None
        nxt = path[(i + 1) % n] if (i < n - 1 or closed) else None
        # a block lower than its neighbour going up is the slope; its upper neighbour stays flat
        if prev and nxt and prev[1] < p[1] and nxt[1] < p[1]:
            raise ValueError(f"track peaks in a single block at {p}")
        kind, d = shape_at(prev, p, nxt)
        out.append((p[0], p[1], p[2], {"siege:kind": kind, "siege:dir": d}))
    return out


# ---------------------------------------------------------------- self-test: python3 map/tracklay.py
if __name__ == "__main__":
    assert len(SHAPES) == 20 and len({(k, d) for k, d, _, _ in SHAPES}) == 20
    # east 4, bend, diagonal SE 2, bend, east 2, climb 1, east 2
    path = [(x, 64, 0) for x in range(4)] + [(4, 64, 1), (5, 64, 2), (6, 64, 2), (7, 64, 2), (8, 65, 2), (9, 65, 2)]
    got = lay(path)
    kinds = [b[3]["siege:kind"] for b in got]
    assert kinds == [0, 0, 0, 1, 0, 1, 0, 3, 0, 0], kinds
    assert got[7][3] == {"siege:kind": 3, "siege:dir": 1}, got[7]  # slope up toward east (dir index 1 = E)
    # the showcase loop from scripts/trains/data.js closes on itself
    legs = [(2, 15), (3, 3), (4, 4), (5, 3), (6, 15), (7, 3), (0, 4), (1, 3)]
    pts, x, z = [], 0, 0
    for d, k in legs:
        for _ in range(k):
            pts.append((x, 0, z)); x += DX[d]; z += DZ[d]
    assert (x, z) == (0, 0)
    assert all(b[3]["siege:kind"] in (0, 1) for b in lay(pts, closed=True))
    for bad in ([(0, 0, 0), (2, 0, 0)], [(2, 0, 0), (1, 0, 0), (2, 0, -1)], [(0, 0, 0), (1, 0, 1), (2, 1, 2)]):
        try:
            lay(bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"should refuse {bad}")
    print("tracklay: ALL OK")
