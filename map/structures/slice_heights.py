"""Put the world's exact ground into a terrain slice before planning a town on it.

    python3 slice_heights.py SLICE.npz HEIGHTS.npy OUT.npz [--origin -1264]

HEIGHTS is genworld's pre-town ground (hollow-crown-full-map-heights-pretown.npy: int16 [x, z],
top ground block y, rails, roads and banks included, before any town plan goes down). The slice's
Y is replaced by it, so plots and paths are graded to the ground the world will really have.
"""
import argparse
import numpy as np


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("slice"); ap.add_argument("heights"); ap.add_argument("out")
    ap.add_argument("--origin", type=int, default=-1264)
    a = ap.parse_args()
    T = dict(np.load(a.slice)); H = np.load(a.heights, mmap_mode="r")
    x0, z0 = int(T["X0"]) - a.origin, int(T["Z0"]) - a.origin
    n0, n1 = T["Y"].shape
    Y = np.array(H[x0:x0 + n0, z0:z0 + n1]).astype(T["Y"].dtype)
    d = Y.astype(int) - T["Y"].astype(int)
    print(f"ground changed: mean {d.mean():+.2f}, max |{np.abs(d).max()}|, {int((np.abs(d) >= 2).sum())} columns by 2+")
    T["Y"] = Y
    np.savez_compressed(a.out, **T)


if __name__ == "__main__":
    main()
