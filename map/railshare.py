#!/usr/bin/env python3
"""One height for track that two lines share (playtest 2026-11-12: at Millbrook the Oakmere branch ran its 25 shared
platform blocks one block above the North line's, so a bought branch laid a second track stacked on the first).

Lines are planned one by one (genworld.py, railplan.profile_dp), so where two lines run over the same blocks (a
shared platform, the throat of a junction) each picked its own heights. harmonise() keeps the first line's heights
on every shared block and re-fits each later line round them, under the same climbing rules (a height change only on
a straight north/south/east/west step, at least two level blocks between changes), staying as close as it can to the
heights it had.

    from railshare import harmonise
    ys_by_line = harmonise([(cells, ys), ...])          # cells [(x, z)], ys [y]; first line wins shared blocks

    python3 map/railshare.py map/rail-segments.json      # fix an exported plan in place (re-lays track shapes)
"""
import json
import sys

DX = [0, 1, 1, 1, 0, -1, -1, -1]
DZ = [-1, -1, 0, 1, 1, 1, 0, -1]


def _dir(a, b):
    return next(d for d in range(8) if DX[d] == b[0] - a[0] and DZ[d] == b[1] - a[1])


def _may_change(cells):
    """ok[i]: may the height change arriving at cell i (a straight orthogonal step with straight track either side)"""
    n = len(cells); ok = [False] * n
    for i in range(1, n):
        if not (cells[i][0] == cells[i - 1][0] or cells[i][1] == cells[i - 1][1]): continue
        st = i + 1 >= n or _dir(cells[i - 1], cells[i]) == _dir(cells[i], cells[i + 1])
        st = st and (i - 2 < 0 or _dir(cells[i - 2], cells[i - 1]) == _dir(cells[i - 1], cells[i]))
        ok[i] = st
    return ok


PIN = 1000.0      # cost per block of height off a shared block (held, but never made impossible)


def refit(cells, ys, pin):
    """Heights for one line: pin {i: y} held (an earlier line's shared blocks), the rest as close to ys as the rules
    allow. Where the earlier line changes height between two shared blocks, this one may too."""
    n = len(cells)
    ok = _may_change(cells)
    for i in range(1, n):
        if i in pin and i - 1 in pin and pin[i] != pin[i - 1]: ok[i] = True
    lo = min(min(ys), min(pin.values(), default=min(ys))) - 4
    hi = max(max(ys), max(pin.values(), default=max(ys))) + 4
    H = hi - lo + 1
    INF = float("inf")

    def cost(i, y):
        if i in pin: return PIN * abs(y - pin[i])
        return abs(y - ys[i])
    # state (height, since): since = level blocks since the last change, capped at 2 (2: a change may come next)
    cur = [[INF] * 3 for _ in range(H)]
    for h in range(H): cur[h][2] = cost(0, lo + h)
    back = []
    for i in range(1, n):
        nxt = [[INF] * 3 for _ in range(H)]; bk = [[None] * 3 for _ in range(H)]
        for h in range(H):
            c = cost(i, lo + h)
            if c == INF: continue
            for s_from, s_to in ((0, 1), (1, 2), (2, 2)):
                v = cur[h][s_from] + c
                if v < nxt[h][s_to]: nxt[h][s_to] = v; bk[h][s_to] = (h, s_from)
            if ok[i]:
                for hp in (h - 1, h + 1):
                    if 0 <= hp < H:
                        v = cur[hp][2] + c + 0.01
                        if v < nxt[h][0]: nxt[h][0] = v; bk[h][0] = (hp, 2)
        back.append(bk); cur = nxt
    best = min(((cur[h][s], h, s) for h in range(H) for s in range(3)))
    if best[0] == INF: raise ValueError("no heights fit the shared track under the climbing rules")
    out = [0] * n; h, s = best[1], best[2]
    for i in range(n - 1, 0, -1):
        out[i] = lo + h; h, s = back[i - 1][h][s]
    out[0] = lo + h
    return out


def harmonise(lines):
    """[(cells, ys)] -> [ys]: every block shared with an earlier line takes that line's height."""
    seen = {}
    out = []
    for cells, ys in lines:
        ys = [int(y) for y in ys]
        pin = {i: seen[c] for i, c in enumerate(cells) if c in seen}
        if any(ys[i] != y for i, y in pin.items()):
            ys = refit(cells, ys, pin)
        for c, y in zip(cells, ys): seen.setdefault(c, y)
        out.append(ys)
    return out


def fix_plan(path):
    """Harmonise an exported map/rail-segments.json in place: segments are regrouped into their lines, re-fitted,
    re-laid (tracklay) and split again; stops take the height of their track block."""
    sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
    from tracklay import lay
    d = json.load(open(path))
    order, lines = [], {}
    for s in d["segments"]:
        if s["line"] not in lines: order.append(s["line"]); lines[s["line"]] = []
        lines[s["line"]].append(s)
    packed = []
    for ln in order:
        cells, ys, cuts = [], [], []
        for s in lines[ln]:
            b = s["blocks"] if not cells else s["blocks"][1:]       # neighbouring segments share their end block
            cuts.append((len(cells) - (1 if cells else 0), len(cells) + len(b) - 1))
            cells += [(x, z) for x, y, z, *_ in b]; ys += [y for x, y, z, *_ in b]
        packed.append((ln, cells, ys, cuts))
    new = harmonise([(c, y) for _, c, y, _ in packed])
    changed = 0
    for (ln, cells, ys, cuts), ny in zip(packed, new):
        if ny == ys: continue
        blocks = [[b[0], b[1], b[2], b[3]["siege:kind"], b[3]["siege:dir"]] for b in lay([(x, y, z) for (x, z), y in zip(cells, ny)])]
        for s, (a, b) in zip(lines[ln], cuts):
            moved = {(p[0], p[2]): q[1] - p[1] for p, q in zip(s["blocks"], blocks[a:b + 1]) if p[1] != q[1]}
            changed += len(moved)
            # the works' clear space over a moved track block moves with it (it was cut for the old height)
            for wk in s.get("works", []):
                dy = moved.get((wk[0], wk[1]))
                if dy and wk[4] == 0:
                    wk[2] += dy; wk[3] += dy
            s["blocks"] = blocks[a:b + 1]
    at = {(b[0], b[2]): b[1] for s in d["segments"] for b in s["blocks"]}
    for st in d["stops"]:
        if (st["x"], st["z"]) in at: st["y"] = at[(st["x"], st["z"])]
    json.dump(d, open(path, "w"))
    return changed


def _selftest():
    # two lines leave a station together for 6 blocks at different heights, then part
    a = [(x, 0) for x in range(20)]; ya = [70] * 20
    b = [(x, 0) for x in range(7)] + [(6 + k, k) for k in range(1, 8)]; yb = [71] * len(b)
    na, nb = harmonise([(a, ya), (b, yb)])
    assert na == ya and nb[:7] == [70] * 7, nb
    assert all(abs(nb[i] - nb[i - 1]) <= 1 for i in range(1, len(nb)))
    # no change two blocks in a row, and only on straight orthogonal steps
    ch = [i for i in range(1, len(nb)) if nb[i] != nb[i - 1]]
    assert all(j - i >= 3 for i, j in zip(ch, ch[1:]))
    ok = _may_change(b)
    assert all(ok[i] for i in ch), (ch, nb)
    print("railshare: ALL OK")


if __name__ == "__main__":
    if len(sys.argv) > 1: print("railshare:", fix_plan(sys.argv[1]), "track blocks moved")
    else: _selftest()
