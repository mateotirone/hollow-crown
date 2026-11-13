"""The air boat station on its real ground: the north shore of Wren Water (Mateo picked Wren Water 2026-11-13; spot
about x -11, z 243, boat pointing south over the lake). The station is never a mound dropped on the map: its floor is
a pad solved by the ONE terraform pass (map/structures/terraform.py), the land round it keeps its own shape and is
only graded where it has to meet the pad, the lane runs out to the real road, and the trees stand on the real ground.

    python3 site.py STATION_SCENE.json terrain.npz OUT_DIR

STATION_SCENE is the built airboat_station_restored (or _ruin) scene.json. Writes OUT_DIR/site.json (the station with
its foundation, lane, lamps and trees, in the station's own frame), OUT_DIR/ground.npz (the solved land heights for
viewer/site_backdrop.py; the viewer drops the land one block where the yard and lane are paved) and prints the world spot.

Frame: the station's local +x (towards the boat) is world +z, so world X = CX - lz, world Z = CZ + lx.
"""
import json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import terraform as tf
import trees as T_
from station import HALL

CX, CZ = -11, 243                 # world spot of the station's local (0, 0)
LAKE = (-60, 300, 70, 45)         # Wren Water, as map/genworld.py carves it
R = 120                           # half size of the solved patch
PAVED = (HALL[0] - 2, -9, 7, 9)   # the paved yard round the hall and mast (station.yard)
LANE_Z = (-1, 1)


def land(npz):
    d = np.load(npz); H = int(d["H"]); N = int(d["N"])
    ls = np.arange(-R, R + 1)
    LX, LZ = np.meshgrid(ls, ls, indexing="ij")          # [i, j] = (local x, local z)
    X = CX - LZ; Z = CZ + LX
    def samp(a):
        gx = (X + H) / (2 * H) * (N - 1); gz = (Z + H) / (2 * H) * (N - 1)
        i = np.floor(gx).astype(int); j = np.floor(gz).astype(int); fx = gx - i; fz = gz - j; a = a.astype(np.float32)
        return a[j, i] * (1 - fx) * (1 - fz) + a[j, i + 1] * fx * (1 - fz) + a[j + 1, i] * (1 - fx) * fz + a[j + 1, i + 1] * fx * fz
    Y = samp(d["Y"]); road = np.maximum(samp(d["road"]), samp(d["trail"])) > 0.5
    lx, lz, a, b = LAKE
    th = np.arctan2((Z - lz) / b, (X - lx) / a)
    rr = np.hypot((X - lx) / a, (Z - lz) / b) / ((1 + 0.18 * np.sin(3 * th + 1)) * (1 + 0.2 * np.cos(2 * th)))
    lake = rr < 1
    lvl = int(np.floor(np.percentile(Y[(rr >= 1) & (rr < 1.15)], 10))) - 1
    Y = np.where(lake, np.minimum(Y, lvl - 1 - np.clip((1 - rr) * 9, 0, 7)), Y)
    Y = np.where((rr >= 1) & (rr < 1.35), np.minimum(Y, lvl + 1 + (rr - 1) * 12), Y)
    return np.round(Y).astype(int), lake, road, lvl


def solve_site(cells, h, lake, road):
    """The station on a patch of land (arrays [i, j] = local (x + R, z + R)): returns the cells in the station's frame
    (local y = world y - off) and how the land was solved."""
    I = lambda x, z: (x + R, z + R)
    # the station's own ground (station.yard's grass rise, its lane and lamps) gives way to the real land
    keep = {}
    for (x, y, z), b in cells.items():
        if b[0] == "grass_block" or y < -1: continue
        if x < PAVED[0] and (y == -1 or abs(z) == 3): continue          # lane and lamp posts: laid again on the land
        keep[(x, y, z)] = b
    cells = keep
    # where the lane meets the road
    x_end = next(x for x in range(PAVED[0] - 1, -R, -1) if road[I(x, 0)])
    pad_cells = [I(x, z) for x in range(PAVED[0], PAVED[2] + 1) for z in range(PAVED[1], PAVED[3] + 1)]
    pad_y = tf.pad_height([h[c] for c in pad_cells])
    site = tf.Site(pad={c: pad_y for c in pad_cells}, connectors={I(x_end, z): int(h[I(x_end, z)]) for z in range(LANE_Z[0], LANE_Z[1] + 1)},
                   carve=8, skirt=4, skirt_max=6)
    fixed = lake | road
    G, wall = tf.solve(h, [site], fixed=fixed)
    works = tf.blocks(h, G, wall, [site], region="vale", x0=-R, z0=-R, fixed=fixed)
    off = int(pad_y) + 1                                    # local y = world y - off (the yard floor, local -1, is the pad)
    for (x, y, z), b in works.items():                 # foundation under the pad and retaining walls; the land itself is the backdrop
        if b[0] in ("air", "grass_block", "dirt", "coarse_dirt", "stone") and not wall[I(x, z)]: continue
        if y - off >= -1 and (x, y - off, z) in cells: continue
        cells[(x, y - off, z)] = (b[0], b[1])
    # the lane: graded with the land out to the road, lamp posts every 9
    lane = np.zeros_like(lake)
    rng = np.random.default_rng(7)
    for x in range(x_end + 1, PAVED[0]):
        for z in range(LANE_Z[0] - (1 if x % 5 == 0 else 0), LANE_Z[1] + 1):
            lane[I(x, z)] = True
            r = rng.random()
            cells[(x, G[I(x, z)] - off, z)] = ("cobblestone" if r < 0.5 else "gravel" if r < 0.8 else "andesite", {})
        if (x - PAVED[0]) % 9 == 4:
            for z in (-3, 3):
                g = G[I(x, z)] - off
                for dy, n in enumerate(("cobblestone_wall", "spruce_fence", "spruce_fence", "lantern")):
                    cells[(x, g + 1 + dy, z)] = (n, {})
    # trees on the real ground, never in the lake, on the lane or the yard
    busy = np.zeros_like(lake)
    for c in pad_cells: busy[c] = True
    busy |= lane
    planted = 0
    for k, (x, z, sp, size) in enumerate(T_.STATION):
        c = I(x, z)
        win = (slice(c[0] - 3, c[0] + 4), slice(c[1] - 3, c[1] + 4))
        if lake[win].any() or busy[win].any() or road[win].any(): continue
        planted += T_.plant(cells, (x, z), sp, size, k % 5, int(G[c]) - off)
    cells = {(int(x), int(y), int(z)): b for (x, y, z), b in cells.items()}
    return dict(cells=cells, G=G, off=off, works=works, wall=wall, busy=busy, lane=lane, x_end=x_end, pad_y=pad_y, site=site, planted=planted)


def world_blocks(scene, h, lake, road):
    """For map/genworld.py: the station and all the land it changes, in world coordinates and placing order (the
    solved ground first, then the station, its lane, lamps and trees). h, lake, road: the map's own top block heights,
    water and paths over the patch, [i, j] = local (x + R, z + R). Returns ([(x, y, z, name, props)], pad_y)."""
    r = solve_site(T_.load(scene), h, lake, road)
    off, out = r["off"], []
    w = lambda x, y, z: (CX - z, y, CZ + x)                # station frame -> world (local +x is world +z)
    for (x, y, z), b in r["works"].items():
        if (x, y - off, z) in r["cells"]: continue
        out.append((*w(x, y, z), b[0], b[1]))
    for (x, y, z), b in r["cells"].items():
        out.append((*w(x, y + off, z), b[0], b[1]))
    return out, r["pad_y"]


def main(scene, npz, out):
    os.makedirs(out, exist_ok=True)
    h, lake, road, lvl = land(npz)
    I = lambda x, z: (x + R, z + R)
    r = solve_site(T_.load(scene), h, lake, road)
    cells, G, off, wall, busy, lane, x_end, pad_y, site, planted = (r[k] for k in ("cells", "G", "off", "wall", "busy", "lane", "x_end", "pad_y", "site", "planted"))
    T_.save(cells, os.path.join(out, "site.json"))
    notrees = busy.copy()
    for (x, y, z) in cells:
        if -R <= x <= R and -R <= z <= R: notrees[I(x, z)] = True
    np.savez(os.path.join(out, "ground.npz"), G=G - off, lake=lake, lane=lane | road, paved=busy, notrees=notrees, lvl=lvl - off, R=R)
    print(f"spot world x {CX}, z {CZ}; floor Y {pad_y}; lake level {lvl}; lane to the road at local x {x_end}; "
          f"terraform slope 1 in {round(1 / site.k)}; walls {int(wall.sum())}; trees {planted}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
