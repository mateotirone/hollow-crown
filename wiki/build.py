#!/usr/bin/env python3
# Builds the Hollow Crown wiki as one HTML page.
#   python3 wiki/build.py              full version, spoilers marked     -> wiki/hollow-crown-wiki.html
#   python3 wiki/build.py --players    spoilers and spoiler pages removed -> wiki/hollow-crown-wiki-players.html
# Words: wiki/content.py. Pictures, health and attack: studio/bestiary/roster.py (rendered by render.py).
import base64, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "studio", "bestiary"))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True
import roster, render, content
from PIL import Image

PLAYERS = "--players" in sys.argv
BY_ID = {m["id"]: m for m in roster.MOBS}

def uri(im):
    b = io.BytesIO(); im.save(b, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()

IMG = {}
def picture(mob_id):
    if mob_id not in IMG: IMG[mob_id] = uri(render.render(BY_ID[mob_id], 240))
    return mob_id

entries = []
for pg in content.PAGES:
    if PLAYERS and pg.get("hide"): continue
    d = dict(pg)
    d["sections"] = [{"h": h, "p": t} if not sp else {"h": h, "p": t, "s": 1} for h, t, sp in pg["sections"] if not (PLAYERS and sp)]
    if PLAYERS: d.pop("hide", None)
    entries.append(d)
for e in content.E:
    if PLAYERS and e.get("hide"): continue
    d = {k: v for k, v in e.items() if k != "mob"}
    m = BY_ID.get(e.get("mob")) if e.get("mob") else None
    if m:
        d.setdefault("name", m["name"]); d["img"] = picture(m["id"]); d["gid"] = "siege:" + m["id"]
        if e["key"] not in ("the-watcher", "boss-helpers"):
            d["hp"] = m.get("hp"); d["dmg"] = m.get("dmg")
        if m.get("region"): d.setdefault("region", m["region"])
    if PLAYERS: d.pop("secret", None); d.pop("hide", None)
    entries.append(d)

dragon = os.path.join(ROOT, "art", "dragons", "preview.png")
if os.path.exists(dragon):
    IMG["_dragons"] = uri(Image.open(dragon).convert("RGBA").resize((240, 240), Image.LANCZOS))
    for d in entries:
        if d["key"] == "dragons": d["img"] = "_dragons"

groups = [{"id": g[0], "name": g[1], "about": g[2], "secret": None if PLAYERS else g[3]} for g in content.GROUPS]
groups = [g for g in groups if any(d["group"] == g["id"] for d in entries)]
world = [{"title": w[0], "text": w[1], "secret": None if PLAYERS else w[2]} for w in content.WORLD]
world = [w for w in world if w["text"] or w["secret"]]
data = {"entries": entries, "groups": groups, "world": world, "img": IMG, "players": PLAYERS}

page = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
page = page.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
out = os.path.join(HERE, "hollow-crown-wiki-players.html" if PLAYERS else "hollow-crown-wiki.html")
open(out, "w", encoding="utf-8").write(page)
print(out, len(page) // 1024, "KB,", len(entries), "pages")
