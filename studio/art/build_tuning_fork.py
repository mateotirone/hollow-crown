"""The Tuning Fork icon, made of the five Choir Shards (Mateo 2026-11-13: "a combination of the shards").

Held like a vanilla tool (handle bottom-left, tines top-right). From the handle up:
  Mother's roots gripping the amethyst handle, with a fen-light bead
  the Seneschal's ember-cracked sand collar
  the Reeve's brass cog at the yoke, an amethyst eye in it
  two tines: the Huntsman's forked ice and the Bride's sea-green, flared like a bell at the tip

Run from the repo root: python3 studio/art/build_tuning_fork.py   (writes textures/items/siege_tuning_fork.png)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "Siege_Nights_RP/textures/items/siege_tuning_fork.png")

C = {
    "O": "#221c28",
    # amethyst (the shards' own core)
    "l": "#ecd8ff", "m": "#c08cf0", "d": "#a05cf0", "e": "#7446b8", "k": "#3a1f6a",
    # Reeve: brass
    "G": "#fff4b8", "B": "#e8b83a", "b": "#dba848", "Z": "#8f5a16",
    # Huntsman: ice
    "W": "#ffffff", "I": "#c4e6f6", "i": "#6a9cbc", "N": "#2c4c7c",
    # Bride: sea
    "S": "#8fe0d0", "s": "#58b5a6", "T": "#22696a",
    # Seneschal: sand and ember
    "Y": "#ffd560", "R": "#ee6a12", "D": "#c8b48a", "u": "#8a744e",
    # Mother: roots and fen-light
    "r": "#8a6440", "q": "#6c4c30", "Q": "#3c2818", "F": "#a0dc40",
}

# Painted cell by cell (x, y), then outlined automatically.
def paint():
    px = {}
    # Huntsman's ice tine (the upper one), forked like an antler at the tip
    for n, (x, y) in enumerate([(6, 6), (7, 5), (8, 4), (9, 3), (10, 2), (11, 1)]):
        px[(x, y)] = "W" if n > 2 else "I"
        px[(x + 1, y)] = "i" if n > 1 else "N"
    px[(12, 0)] = "I"; px[(10, 0)] = "W"; px[(10, 1)] = "I"  # the fork in the antler
    # Bride's sea tine (the lower one), flaring like a bell at the tip
    for n, (x, y) in enumerate([(9, 9), (10, 8), (11, 7), (12, 6), (13, 5), (14, 4)]):
        px[(x, y)] = "S" if n > 2 else "s"
        px[(x + 1, y)] = "s" if n > 2 else "T"
    px[(14, 3)] = "S"; px[(15, 3)] = "s"; px[(13, 4)] = "S"
    # Reeve's brass cog at the yoke, with an amethyst eye; its teeth stick out
    for (x, y), c in {(6, 7): "G", (7, 7): "B", (8, 7): "B", (6, 8): "B", (7, 8): "l", (8, 8): "b",
                      (7, 9): "b", (8, 9): "Z", (9, 8): "b", (5, 7): "B", (7, 6): "G", (9, 10): "Z"}.items():
        px[(x, y)] = c
    # Seneschal's sand collar with ember in the cracks
    for (x, y), c in {(5, 9): "D", (6, 9): "Y", (5, 10): "R", (6, 10): "u", (4, 10): "D", (4, 11): "u"}.items():
        px[(x, y)] = c
    # The amethyst handle
    for (x, y), c in {(3, 11): "l", (4, 12): "e", (3, 12): "d", (2, 12): "m", (2, 13): "d", (3, 13): "k", (1, 14): "e", (2, 14): "k"}.items():
        px[(x, y)] = c
    # Mother's roots gripping it, with one bead of fen-light
    for (x, y), c in {(1, 12): "r", (1, 13): "q", (4, 13): "q", (3, 14): "Q", (2, 15): "q", (0, 15): "Q", (2, 11): "F"}.items():
        px[(x, y)] = c
    return px

def build():
    px = paint()
    # outline: every empty cell touching a painted one (not diagonally)
    for (x, y) in list(px):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < 16 and 0 <= q[1] < 16 and q not in px:
                px[q] = "O"
    im = Image.new("RGBA", (16, 16))
    for (x, y), ch in px.items():
        if 0 <= x < 16 and 0 <= y < 16:
            h = C[ch]
            im.putpixel((x, y), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    im.save(OUT)
    return im

if __name__ == "__main__":
    build()
    print("wrote", OUT)
