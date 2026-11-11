"""Interiors: stairs between floors, room furniture and lighting.

Furniture is made the way builders make it from vanilla blocks:
  table  = fence post + pressure plate (or slab on a fence)
  chair  = stairs facing the table
  bar    = stripped logs on their side with trapdoors on the customer face
  hearth = campfire in a stone brick alcove under a flue
  bed    = vanilla bed; wardrobe = barrels; shelves = bookshelves and lecterns
All positions are checked so nothing lands in a doorway, window or stair.
"""
from bp import DIRS, OPP, LEFT, RIGHT

def free(bp, x, y, z):
    return bp.get(x, y, z)[0] in ("air", "keep")

def stair_flight(bp, x, z, y0, n, d, mat="spruce_stairs", rail="spruce_fence", hole_y=None):
    """n stairs climbing in direction d, first step at (x, y0, z). Cuts the floor above for headroom."""
    dx, _, dz = DIRS[d]
    for i in range(n):
        cx, cz, cy = x + dx * i, z + dz * i, y0 + i
        bp.set(cx, cy, cz, mat, facing=d)
        for h in (1, 2, 3):
            if bp.get(cx, cy + h, cz)[0] not in ("air", "keep") and (hole_y is None or cy + h == hole_y): bp.set(cx, cy + h, cz, "air")
        if i > 0: bp.set(cx - dx, cy, cz - dz, "spruce_planks") if bp.get(cx - dx, cy, cz - dz)[0] == "air" and False else None
    return (x + dx * n, y0 + n - 1, z + dz * n)

def table(bp, x, y, z, chairs="nsew", mat="dark_oak"):
    bp.set(x, y, z, f"{mat}_fence"); bp.set(x, y + 1, z, f"{mat}_pressure_plate")
    for d in chairs:
        dx, _, dz = DIRS[d]
        if free(bp, x + dx, y, z + dz): bp.set(x + dx, y, z + dz, f"{mat}_stairs", facing=d)

def long_table(bp, x0, x1, y, z, mat="dark_oak"):
    for x in range(x0, x1 + 1):
        bp.set(x, y, z, f"{mat}_fence"); bp.set(x, y + 1, z, f"{mat}_slab", half="bottom")
        for d in "ns":
            dx, _, dz = DIRS[d]
            if free(bp, x, y, z + dz) and (x - x0) % 2 == 0: bp.set(x, y, z + dz, f"{mat}_stairs", facing=d)

def bar(bp, x0, x1, y, z, face, back=True):
    """Counter along x from x0 to x1 at row z, customers on the 'face' side."""
    for x in range(x0, x1 + 1):
        bp.set(x, y, z, "stripped_dark_oak_log", axis="x")
        dx, _, dz = DIRS[face]
        if free(bp, x, y, z + dz): bp.set(x, y, z + dz, "dark_oak_trapdoor", facing=face, open=True)
    if back:
        bz = z - DIRS[face][2] * 2
        for x in range(x0, x1 + 1, 2):
            if free(bp, x, y, bz): bp.set(x, y, bz, "barrel")
            if free(bp, x, y + 1, bz): bp.set(x, y + 1, bz, "barrel")

def hearth(bp, x, y, z, face):
    """Fireplace against a wall: campfire in an alcove, mantle, flue up to y+3."""
    rx, rz = DIRS[RIGHT[face]][0], DIRS[RIGHT[face]][2]
    bx, bz = x - DIRS[face][0], z - DIRS[face][2]     # the wall behind
    for s in (-1, 1):
        for h in range(3): bp.set(x + rx * s, y + h, z + rz * s, "stone_bricks")
    bp.set(x, y, z, "campfire", facing=face)
    bp.set(x, y + 2, z, "stone_brick_slab", half="top")
    for s in (-1, 0, 1): bp.set(x + rx * s, y + 3, z + rz * s, "stone_brick_stairs", facing=OPP[face], half="top") if free(bp, x + rx * s, y + 3, z + rz * s) else None
    bp.set(x + DIRS[face][0], y, z + DIRS[face][2], "air")

def bed(bp, x, y, z, head):
    """Bed with its head at (x,y,z), foot one block away from 'head' direction."""
    dx, _, dz = DIRS[head]
    bp.set(x, y, z, "bed", facing=head, head=True)
    bp.set(x - dx, y, z - dz, "bed", facing=head, head=False)

def lantern_ceiling(bp, x, y, z):
    if free(bp, x, y, z): bp.set(x, y, z, "lantern", hanging=True)

def partition(bp, x0, z0, x1, z1, y0, y1, mat="spruce_planks", door=None):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for z in range(min(z0, z1), max(z0, z1) + 1):
            for y in range(y0, y1 + 1): bp.set(x, y, z, mat)
    if door:
        dx_, dz_, face = door
        bp.set(dx_, y0, dz_, "spruce_door", facing=face); bp.set(dx_, y0 + 1, dz_, "spruce_door", facing=face, upper=True)
