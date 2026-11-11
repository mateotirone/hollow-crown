"""Size profiles for trees, so a placer can keep them clear of buildings, roads and rails.

    profile(bp) -> {
      "offset": [x, y, z],   where the stamp's corner sits relative to the trunk's ground cell (0, 0, 0)
      "height": top of the tree above the ground,
      "trunk": [[x, z], ...] cells the trunk, roots and knees stand on (nothing may be there),
      "trunk_r": furthest trunk/root cell from the centre (blocks, Chebyshev),
      "rings": [r per height], the canopy's reach at each height y = 0..height (Chebyshev, -1 = nothing),
      "low_r": reach below LOW (where it would run into walls, people and carts),
      "crown_r": reach at any height,
    }
"""
LOW = 6          # anything at or below this height runs into walls, doors, riders and trains
GROUNDISH = {"dirt_with_roots", "coarse_dirt", "podzol", "rooted_dirt", "mud", "sand", "grass_block", "moss_block", "dirt",
             "leaf_litter", "snow_layer", "short_grass", "fern", "deadbush", "short_dry_grass", "tall_dry_grass", "moss_carpet", "pale_moss_carpet"}


def profile(bp):
    lo, hi = bp.bounds()
    rings = [-1] * (hi[1] + 1)
    trunk = set()
    for (x, y, z), (n, p) in bp.cells.items():
        name = n.split(":")[-1]
        if y < 0: continue
        if name in GROUNDISH: continue
        r = max(abs(x), abs(z))
        rings[y] = max(rings[y], r)
        if y <= 1: trunk.add((x, z))
    trunk_r = max((max(abs(x), abs(z)) for x, z in trunk), default=0)
    return {"offset": list(lo), "height": hi[1], "trunk": sorted([list(c) for c in trunk]), "trunk_r": trunk_r, "rings": rings,
            "low_r": max([r for r in rings[:LOW + 1]] + [0]), "crown_r": max(rings + [0])}
