"""Writes Siege_Nights_BP/scripts/newplayer/workshop_book_data.js: the Siege Workshop book (sneak-click a Workshop),
the main things it makes by category, with each one's ingredients read from the recipe files and its name from the
resource pack. Rerun after a recipe changes: python3 tools/workshop_book.py (--check says whether it is stale)."""
import json, glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
OUT = os.path.join(BP, "scripts", "newplayer", "workshop_book_data.js")

# [category, [(result id, what it does)]]
BOOK = [
    ("Army and defence", [
        ("siege:barracks", "Raises a guardhouse. Click it to train guards (40 Regals each)."),
        ("siege:ballista", "Shoots monsters within 16 blocks by itself, even through Arrow Slits."),
        ("siege:quartermaster_desk", "A quartermaster takes the post and sells siege gear."),
        ("siege:guard_helmet", "Castle Guard armour, in your banner colour."),
        ("siege:war_horn", "Blow it at night to call a siege early, for more pay."),
    ]),
    ("Walls and gates", [
        ("siege:castle_stone", "The wall block raiders have to break. Click it with iron, then diamond, then netherite scrap to harden it."),
        ("siege:battlement", "Crenels for the top of a wall."),
        ("siege:arrow_slit", "Archers and ballistas shoot through it; raiders can't."),
        ("siege:castle_gate", "A gate that swings open with one click."),
        ("siege:portcullis", "A gate that rises with one click."),
        ("siege:palisade", "A timber wall: quick and cheap."),
    ]),
    ("Siege machines", [
        ("siege:trebuchet", "Click it with cobblestone and look where to throw. Sneak-click to change the weight."),
        ("siege:battering_ram", "Ride it and punch to swing the beam."),
        ("siege:breaching_charge", "Blows a hole in a wall after 4 seconds."),
    ]),
    ("Your settlement", [
        ("siege:foundation_stone", "Places a ready-made building."),
        ("siege:hall_cornerstone", "Raises a town hall (one comes free with a map plot)."),
        ("siege:mason_bench", "A mason sets up beside it and sells blocks."),
        ("siege:foresters_lodge", "A grove of your region's trees that regrows by itself."),
        ("siege:ironworks", "Makes iron over time."),
        ("siege:writ_of_alliance", "Use it on a friend to share your land."),
    ]),
    ("Horses and roads", [
        ("siege:stables", "Train, breed and keep horses."),
        ("siege:halter", "Use it on a tamed horse to make it your steed."),
        ("siege:riding_crop", "Gallop while riding."),
        ("siege:horse_whistle", "Calls your horse from up to 64 blocks."),
        ("siege:rail_depot", "Joins your settlement to the rail network."),
    ]),
]

def lang():
    names = {}
    for line in open(os.path.join(RP, "texts", "en_US.lang"), encoding="utf-8"):
        m = re.match(r"(?:item|tile)\.([^=]+)\.name=(.*)", line.strip())
        if m: names[m.group(1)] = m.group(2).strip()
    return names

def nice(i, names):
    if i.startswith("tag:"): return {"minecraft:planks": "any planks", "minecraft:logs": "any logs"}.get(i[4:], i[4:].split(":")[-1].replace("_", " "))
    return names.get(i) or i.split(":")[-1].replace("_", " ")

def recipes():
    out = {}
    for f in glob.glob(os.path.join(BP, "recipes", "**", "*.json"), recursive=True):
        d = json.load(open(f))
        for k, r in d.items():
            if not k.startswith("minecraft:recipe") or "siege_workshop" not in r.get("tags", []): continue
            res = r["result"]["item"] if isinstance(r["result"], dict) else r["result"]
            counts = {}
            if "pattern" in r:
                key = r["key"]
                for row in r["pattern"]:
                    for ch in row:
                        if ch == " ": continue
                        v = key[ch]; i = v.get("item") or ("tag:" + v["tag"])
                        counts[i] = counts.get(i, 0) + 1
            else:
                for v in r.get("ingredients", []):
                    i = v.get("item") or ("tag:" + v["tag"]); counts[i] = counts.get(i, 0) + v.get("count", 1)
            out.setdefault(res, counts)
    return out

def build():
    names, rec = lang(), recipes()
    book = []
    for cat, items in BOOK:
        rows = []
        for rid, what in items:
            if rid not in rec: sys.exit(f"workshop_book: no Workshop recipe makes {rid}")
            needs = ", ".join(f"{n} {nice(i, names)}" for i, n in sorted(rec[rid].items(), key=lambda kv: -kv[1]))
            rows.append({"id": rid, "name": nice(rid, names), "what": what, "needs": needs})
        book.append({"name": cat, "items": rows})
    return "// Written by tools/workshop_book.py from the recipe files. Do not edit by hand.\nexport const WORKSHOP_BOOK = " + json.dumps(book, indent=1, ensure_ascii=False) + ";\nexport const WORKSHOP_RECIPES = " + str(len(rec)) + ";\n"

if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        sys.exit(0 if os.path.exists(OUT) and open(OUT).read() == text else "workshop_book_data.js is stale: python3 tools/workshop_book.py")
    open(OUT, "w").write(text); print("wrote", OUT)
