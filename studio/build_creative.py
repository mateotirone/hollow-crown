"""Creative-menu tools for playtesting.

Run from the repo root:   python3 studio/build_creative.py

Writes:
  * one Boss Summon item per boss (siege:summon_<id>): use it and the boss appears 6 blocks in front of you
    and its full fight starts (scripts/creative/summons.js). Not craftable, not sold, creative / /give only.
  * their 16x16 icons (a sealed writ, the seal in the boss's colour), atlas lines and names
  * Siege_Nights_BP/item_catalog/crafting_item_catalog.json: our own fold-out groups in the creative menu
    (Boss Summons, Guard-only armour, Locked world trees) so playtesters can find things.

The list of bosses must match SUMMONS in scripts/creative/summons.js (a self-test checks it).
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "studio", "art"))
from palette import M, ramp  # noqa: E402
from PIL import Image  # noqa: E402

BP = os.path.join(ROOT, "Siege_Nights_BP")
RP = os.path.join(ROOT, "Siege_Nights_RP")

# id, shown name, seal ramp
BOSSES = [
    ("reeve", "The Clockwork Reeve", M["gold"]),
    ("huntsman", "The Pale Huntsman", M["iron"]),
    ("bride", "The Drowned Bride", M["diamond"]),
    ("seneschal", "The Ash Seneschal", M["ember"]),
    ("mother", "The Mother of Changelings", M["emerald"]),
    ("warlord_king", "The Warlord King", M["blood_red"]),
    ("choir", "The Choir", M["purple"]),
    ("morvane", "Morvane", ramp("#b0207a", 0.08, 0.70)),
    ("pretender", "a Pretender", M["royal_blue"]),
    ("bell_wife", "Ulfa, the Bell-Wife", ramp("#9a6a3a", 0.10, 0.62)),
]


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


def merge_atlas(entries):
    path = os.path.join(RP, "textures", "item_texture.json")
    data = json.load(open(path, encoding="utf8"))
    data["texture_data"].update(entries)
    write_json(path, data)


def add_lang(names):
    for pack in (BP, RP):
        path = os.path.join(pack, "texts", "en_US.lang")
        lines = open(path, encoding="utf8").read().splitlines()
        keep = [l for l in lines if l.split("=", 1)[0] not in names]
        keep += [f"{k}={v}" for k, v in names.items()]
        with open(path, "w", encoding="utf8") as f:
            f.write("\n".join(keep) + "\n")


# ---------- the writ icon ----------
PAPER = M["parchment"]
INK = M["coal"]
RIBBON = M["blood_red"]


def writ(seal):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    # the sheet, rolled at top and bottom
    for y in range(2, 14):
        for x in range(3, 13):
            px[x, y] = PAPER[3] if x < 12 else PAPER[1]
    for x in range(2, 14):
        px[x, 1] = PAPER[1]; px[x, 2] = PAPER[4]; px[x, 3] = PAPER[2]   # top roll
        px[x, 12] = PAPER[2]; px[x, 13] = PAPER[4]; px[x, 14] = PAPER[1]  # bottom roll
    for y in (1, 2, 3, 12, 13, 14):
        px[2, y] = PAPER[0]; px[13, y] = PAPER[0]
    for y in range(4, 12):
        px[2, y] = PAPER[0]; px[13, y] = PAPER[0]
    # lines of writing
    for y, (a, b) in zip((5, 7, 9), ((4, 11), (4, 10), (4, 8))):
        for x in range(a, b):
            px[x, y] = INK[3] if x % 3 else INK[2]
    # ribbon tails and the seal
    px[9, 12] = RIBBON[2]; px[9, 13] = RIBBON[3]; px[12, 13] = RIBBON[2]; px[12, 14] = RIBBON[1]
    for (x, y), tone in {(10, 9): 2, (11, 9): 3, (9, 10): 2, (10, 10): 4, (11, 10): 3, (12, 10): 2,
                         (9, 11): 1, (10, 11): 3, (11, 11): 2, (12, 11): 1, (10, 12): 1, (11, 12): 1}.items():
        px[x, y] = seal[tone]
    px[10, 10] = seal[5]
    return img


# ---------- items ----------
atlas, names = {}, {}
for bid, shown, seal in BOSSES:
    iid = f"siege:summon_{bid}"
    icon = f"siege_summon_{bid}"
    write_json(os.path.join(BP, "items", "creative", f"summon_{bid}.json"), {
        "format_version": "1.21.60",
        "minecraft:item": {
            "description": {"identifier": iid, "menu_category": {"category": "equipment"}},
            "components": {
                "minecraft:icon": icon,
                "minecraft:display_name": {"value": f"item.{iid}.name"},
                "minecraft:max_stack_size": 16,
                "minecraft:glint": True,
            },
        },
    })
    out = os.path.join(RP, "textures", "items", "creative", f"summon_{bid}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    writ(seal).save(out)
    atlas[icon] = {"textures": f"textures/items/creative/summon_{bid}"}
    names[f"item.{iid}.name"] = f"Boss Summon: {shown}"

names["siege:itemGroup.name.bossSummons"] = "Hollow Crown: Boss Summons"
names["siege:itemGroup.name.guardGear"] = "Hollow Crown: Guard-only Armour"
names["siege:itemGroup.name.lockedTrees"] = "Hollow Crown: Locked World Trees"
merge_atlas(atlas)
add_lang(names)


# ---------- the creative menu's own groups ----------
def ids_in(folder, kind):
    out = []
    for p in sorted(glob.glob(os.path.join(BP, folder, "**", "*.json"), recursive=True)):
        d = json.load(open(p, encoding="utf8")).get(kind, {}).get("description", {})
        if d.get("identifier"):
            out.append(d["identifier"])
    return out


guard = sorted(i for i in ids_in("items", "minecraft:item") if i.startswith("siege:guardgear_"))
trees = sorted(i for i in ids_in("blocks", "minecraft:block") if i.startswith("siege:old_"))
summons = [f"siege:summon_{b[0]}" for b in BOSSES]

write_json(os.path.join(BP, "item_catalog", "crafting_item_catalog.json"), {
    "format_version": "1.21.60",
    "minecraft:crafting_items_catalog": {
        "categories": [
            {"category_name": "equipment", "groups": [
                {"group_identifier": {"icon": summons[0], "name": "siege:itemGroup.name.bossSummons"}, "items": summons},
                {"group_identifier": {"icon": guard[0], "name": "siege:itemGroup.name.guardGear"}, "items": guard},
            ]},
            {"category_name": "construction", "groups": [
                {"group_identifier": {"icon": "siege:old_oak_log", "name": "siege:itemGroup.name.lockedTrees"}, "items": trees},
            ]},
        ]
    },
})
print(f"{len(summons)} boss summons, {len(guard)} guard pieces, {len(trees)} locked tree blocks in the creative menu.")
