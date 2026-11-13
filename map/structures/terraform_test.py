"""Checks for the terraform pass: python3 map/structures/terraform_test.py (prints TERRAFORM OK).

The cases in terraform_cases.json are shared with the game's copy (Siege_Nights_BP/scripts/settle/terraform.js):
both must give the same ground. Run with --write to regenerate the expected heights after a deliberate change.
"""
import json, os, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import terraform as TF

CASES = os.path.join(HERE, "terraform_cases.json")


def land(kind, n=31):
    i = np.arange(n)[:, None]; j = np.arange(n)[None, :]
    if kind == "flat": return np.full((n, n), 64)
    if kind == "slope2": return (64 + i // 2 + 0 * j).astype(int)               # 1 in 2
    if kind == "slope1": return (60 + i + 0 * j).astype(int)                    # 1 in 1
    if kind == "bumpy": return (64 + (3 * np.sin(i / 3.0) + 2 * np.cos(j / 4.0)).round()).astype(int)
    if kind == "cliff": return np.where(i < 15, 64, 72) + 0 * j
    raise KeyError(kind)


def site(h, x0, z0, w, d, fill="stone", door=True):
    cells = [(i, j) for i in range(x0, x0 + w) for j in range(z0, z0 + d)]
    y = TF.pad_height([h[c] for c in cells])
    con = {(x0 + w // 2 + s, z0 + d + t): y for s in (-1, 0, 1) for t in range(4)} if door else {}
    return TF.Site(pad={c: y for c in cells}, connectors=con, pad_fill=fill)


def run_case(c):
    h = land(c["land"])
    sites = [site(h, *s["box"], fill=s.get("fill", "stone"), door=s.get("door", True)) for s in c["sites"]]
    T, wall = TF.solve(h, sites)
    return h, sites, T, wall


def check(c, h, sites, T, wall):
    errs = []
    for s in sites:
        for cell, y in {**s.connectors, **s.pad}.items():
            if T[cell] != y: errs.append(f"anchor {cell} at {T[cell]}, wants {y}")
        hs = [h[cell] for cell in s.pad]
        y = next(iter(s.pad.values()))
        if y > max(hs) or y < max(hs) - TF.MAX_BELOW: errs.append(f"pad at {y}, land {min(hs)}..{max(hs)}")
    rep = TF.report(h, T, wall, sites)
    if rep["steepest"] > 1: errs.append(f"open ground steps {rep['steepest']} blocks")
    pad = np.zeros(T.shape, bool)
    for s in sites:
        for cell in s.pad: pad[cell] = True
    # nothing moves further than skirt_max + FEATHER from a pad or connector
    far = TF._envelope(T.shape, {cell: 0 for s in sites for cell in {**s.connectors, **s.pad}}, 1.0, 99, +1, None)
    moved = (T != h) & ~pad
    if moved.any() and far[moved].max() > max(s.skirt_max for s in sites) + TF.FEATHER + 1e-6:
        errs.append(f"ground moved {far[moved].max():.1f} blocks out")
    if c["land"] == "flat" and rep["moved"]: errs.append("flat land should not move")
    # blocks: nothing floats over air, no air left under a pad
    b = TF.blocks(h, T, wall, sites)
    for (x, y, z), (n, _) in b.items():
        if n == "air" or y <= h[x, z]: continue
        under = b.get((x, y - 1, z), ("ground" if y - 1 <= h[x, z] else "air", {}))[0]
        if under == "air": errs.append(f"{n} floats at {(x, y, z)}")
    return errs, rep


def main():
    cases = json.load(open(CASES))
    write = "--write" in sys.argv; bad = 0
    for c in cases:
        h, sites, T, wall = run_case(c)
        errs, rep = check(c, h, sites, T, wall)
        if write: c["expect"] = T.tolist()
        elif c.get("expect") is not None and T.tolist() != c["expect"]: errs.append("heights differ from terraform_cases.json")
        print(f"{c['name']:<22}", rep, "FAIL " + "; ".join(errs[:4]) if errs else "ok")
        bad += bool(errs)
    if write: json.dump(cases, open(CASES, "w"), separators=(",", ":"))
    print("TERRAFORM OK" if not bad else f"TERRAFORM FAILED ({bad})")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
