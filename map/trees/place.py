"""Scatter database trees over an area without running into what is already there.

    from place import scatter
    spots = scatter(index, region, hard, soft, density=0.012, seed=1)
    -> [(x, z, file, profile), ...]   x, z = the trunk's ground cell in mask coordinates; file as in trees.json

index   trees.json (loaded), whose files carry the size profiles from profile.py
region  which region's species to use ("vale", "frostmarch", ...), or a {species_id: weight} dict
hard    2D bool array [x][z], True where trees must keep their whole crown out, with a block to spare:
        buildings, walls, towers, gates, wells, market stalls (no branch over a roof or through a wall)
soft    2D bool array [x][z], True where only the trunk must stay off (plus one block): roads, paths, rails,
        bridleways, fields. A crown may hang over a road; a trunk never stands on one.
blocked cells also include water you do not want trees in; mark it in soft (or hard) before calling.

Big sizes are tried first, then smaller ones of the same species, so a tight gap gets a young tree instead of
nothing. Trees keep their crowns apart (a crown may touch another crown's edge, never its trunk).
"""
import random
import numpy as np

SIZE_ORDER = ["ancient", "mature", "young", "sapling"]
SIZE_WEIGHT = {"ancient": 0.12, "mature": 0.5, "young": 0.28, "sapling": 0.1}


def _species(index, region):
    if isinstance(region, dict): return region
    return {sid: 1.0 for sid, s in index["species"].items() if s["region"] == region}


def _grow_mask(mask, r):
    """Cells within Chebyshev distance r of a True cell."""
    if r <= 0: return mask.copy()
    W, D = mask.shape
    pad = np.pad(mask, r)
    out = np.zeros_like(mask)
    for dx in range(2 * r + 1):
        for dz in range(2 * r + 1): out |= pad[dx:dx + W, dz:dz + D]
    return out


def fits(prof, x, z, hard, soft, taken):
    W, D = hard.shape
    r = prof["crown_r"]
    if x - r < 0 or z - r < 0 or x + r >= W or z + r >= D: return False
    for tx, tz in prof["trunk"]:                      # trunk and roots: off roads (one block margin) and off everything
        X, Z = x + tx, z + tz
        if soft[X, Z] or hard[X, Z] or taken[X, Z] >= 2: return False
    lr = prof["crown_r"] + 1                         # the whole crown, plus a block, stays clear of buildings
    if hard[x - lr:x + lr + 1, z - lr:z + lr + 1].any(): return False
    cr = max(1, prof["crown_r"] - 2)                 # crowns may overlap at the edges only
    if (taken[x - cr:x + cr + 1, z - cr:z + cr + 1] >= 1).any(): return False
    return True


def mark(prof, x, z, taken):
    cr = max(1, prof["crown_r"] - 2)
    t = taken[x - cr:x + cr + 1, z - cr:z + cr + 1]
    np.maximum(t, 1, out=t)
    for tx, tz in prof["trunk"]: taken[x + tx, z + tz] = 2


def scatter(index, region, hard, soft, density=0.012, seed=1, tries=None):
    rng = random.Random(seed)
    hard = np.asarray(hard, bool); soft = _grow_mask(np.asarray(soft, bool), 1)
    taken = np.zeros(hard.shape, np.int8)
    weights = _species(index, region)
    sids = list(weights); w = [weights[s] for s in sids]
    W, D = hard.shape
    want = int(W * D * density)
    out = []
    for _ in range(tries or want * 6):
        if len(out) >= want: break
        x, z = rng.randrange(W), rng.randrange(D)
        sid = rng.choices(sids, w)[0]
        sizes = index["species"][sid]["sizes"]
        first = rng.choices(SIZE_ORDER, [SIZE_WEIGHT[s] for s in SIZE_ORDER])[0]
        for size in SIZE_ORDER[SIZE_ORDER.index(first):]:
            f = rng.choice(sizes[size])
            if fits(f, x, z, hard, soft, taken):
                mark(f, x, z, taken); out.append((x, z, f["file"], f)); break
    return out
