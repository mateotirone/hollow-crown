"""Draw the quest pins for the HUD minimap and the "talk to me" marker over the next person to see.

    python3 tools/minimap_pins.py

Writes (all RGBA: palette PNGs show black on the HUD, playtest 2026-11-11):
    Siege_Nights_RP/textures/ui/hc/minimap/pg.png      the quest's place, on the map
    Siege_Nights_RP/textures/ui/hc/minimap/pe.png      the quest's place, held on the map's rim when it is further
    Siege_Nights_RP/textures/ui/hc/minimap/pt.png      the person the quest sends you to talk to
    Siege_Nights_RP/textures/particle/hc_quest_mark.png the marker floating over that person (siege:quest_mark)
The HUD side is tools/minimap_ui.py, the script side scripts/minimap/data.js (pinCode) and scripts/quests/marks.js.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(ROOT, "Siege_Nights_RP", "textures", "ui", "hc", "minimap")
PARTICLE = os.path.join(ROOT, "Siege_Nights_RP", "textures", "particle")

GOLD = (236, 192, 84, 255)
PALE = (255, 236, 160, 255)
DARK = (38, 26, 14, 255)
INK = (110, 30, 20, 255)


def diamond(d, cx, cy, r, fill, outline):
    d.polygon([(cx, cy - r - 1), (cx + r + 1, cy), (cx, cy + r + 1), (cx - r - 1, cy)], fill=outline)
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def goal():
    im = Image.new("RGBA", (14, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    diamond(d, 7, 7, 5, GOLD, DARK)
    d.rectangle([6, 6, 7, 7], fill=PALE)
    return im


def edge():
    im = Image.new("RGBA", (14, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    diamond(d, 7, 7, 5, GOLD, DARK)
    d.polygon([(7, 4), (10, 7), (7, 10), (4, 7)], fill=(0, 0, 0, 0))  # hollow: "further than this"
    return im


def talk(size=14):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size / 14
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(4 * s), fill=DARK)
    d.rounded_rectangle([round(s), round(s), size - 1 - round(s), size - 1 - round(s)], radius=round(3 * s), fill=GOLD)
    # the "!"
    x0, x1 = round(6 * s), round(7.99 * s)
    d.rectangle([x0, round(3 * s), x1, round(8 * s)], fill=INK)
    d.rectangle([x0, round(10 * s), x1, round(11 * s)], fill=INK)
    return im


def main():
    os.makedirs(UI, exist_ok=True)
    goal().save(os.path.join(UI, "pg.png"))
    edge().save(os.path.join(UI, "pe.png"))
    talk().save(os.path.join(UI, "pt.png"))
    Image.new("RGBA", (14, 14), (0, 0, 0, 0)).save(os.path.join(UI, "p_.png"))  # no pin: what a pin shows if its binding fails
    talk(16).save(os.path.join(PARTICLE, "hc_quest_mark.png"))
    print("wrote pins pg, pe, pt, p_ and particle hc_quest_mark")


if __name__ == "__main__":
    main()
