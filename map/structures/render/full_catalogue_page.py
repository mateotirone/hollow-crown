"""Full building catalogue page from full-catalogue.json (build_full_catalogue.py).

    python3 full_catalogue_page.py OUT_DIR [--towns DIR]

Writes OUT_DIR/index.html next to OUT_DIR/img/. Town overview pictures (<town>-town-draft.png in --towns)
are copied into img/ as JPEGs. The page is published with img/ as supporting files.
"""
import os, sys, json, html, argparse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--towns", default="")
a = ap.parse_args()
S = json.load(open(os.path.join(a.out, "full-catalogue.json")))
esc = html.escape

TOWNS = [("kingsrest", "Kingsrest", "The royal town where the rivers meet: guildhall, chapel, station, the coaching inn and about forty houses."),
         ("millbrook", "Millbrook", "The first story town: clock tower square, watermill on the river, chapel and twenty-one houses.")]
towns_html = []
for key, name, blurb in TOWNS:
    src = os.path.join(a.towns, f"{key}-town-draft.png")
    if a.towns and os.path.exists(src):
        Image.open(src).convert("RGB").resize((1280, 800), Image.LANCZOS).save(os.path.join(a.out, "img", f"town-{key}.jpg"), quality=84)
    towns_html.append(f'<figure class="town"><img src="img/town-{key}.jpg" alt="{esc(name)} from above" loading="lazy">'
                      f'<figcaption><b>{esc(name)}</b><span>{esc(blurb)}</span><em class="pill ok">Laid out on the real map</em></figcaption></figure>')

def card(c, wide=False):
    size = c.get("size"); meta = []
    if size: meta.append(f"{size[0]} × {size[2]} footprint, {size[1]} tall")
    if c.get("blocks"): meta.append(f"{c['blocks']:,} blocks")
    where = f'<p class="where">{esc(c["where"])}</p>' if c.get("where") else ""
    blurb = f"<p>{esc(c['blurb'])}</p>" if c.get("blurb") else ""
    pill = {"old": '<em class="pill old">Old look, being rebuilt</em>', "new": '<em class="pill ok">New style</em>'}.get(c.get("status"), "")
    return (f'<article class="card{" wide" if wide else ""}"><div class="pic"><img src="{c["image"]}" alt="{esc(c["title"])}" loading="lazy"></div>'
            f'<div class="body"><span class="kind">{esc(c.get("sub", ""))}</span><h3>{esc(c["title"])}</h3>{blurb}{where}'
            f'<p class="meta">{" · ".join(meta)}</p>{pill}</div></article>')

by = {s["id"]: s for s in S}
regions = [s for s in S if s["id"].startswith("settle-")]
rid = lambda s: s["id"][7:]

# ---- Map towns
mp = by["map"]
map_html = f'<p class="lede">{esc(mp["blurb"])}</p><div class="towns">{"".join(towns_html)}</div><h2 class="sub">Buildings</h2><div class="grid">' + \
    "".join(card(c) for c in mp["cards"]) + "</div>"

# ---- Settlements: region switch, hall tiers strip, plot buildings
reg_buttons = "".join(f'<button type="button" data-region="{rid(s)}" aria-pressed="{str(i == 0).lower()}">{esc(s["title"].replace(" settlement", ""))}</button>' for i, s in enumerate(regions))
settle_html = f'<p class="lede">What grows on a player\'s own plot. The town hall upgrades through five levels as the settlement grows; plot buildings open with it. Every region has its own architecture.</p><div class="bar" role="group" aria-label="Region">{reg_buttons}</div>'
for i, s in enumerate(regions):
    halls = [c for c in s["cards"] if c.get("group") == "Town hall upgrades"]
    blds = [c for c in s["cards"] if c.get("group") == "Plot buildings"]
    settle_html += (f'<div class="region" data-region="{rid(s)}"{"" if i == 0 else " hidden"}><p class="rblurb">{esc(s["blurb"])}</p>'
                    f'<h2 class="sub">Town hall, level 1 to 5</h2><ol class="steps">' +
                    "".join(f'<li>{card(c)}</li>' for c in halls) + '</ol><h2 class="sub">Plot buildings</h2><div class="grid">' +
                    "".join(card(c) for c in blds) + "</div></div>")

# ---- Walls: level rows, region switch
wl = by["walls"]; levels = sorted({c["level"] for c in wl["cards"]})
wall_buttons = "".join(f'<button type="button" data-wregion="{rid(s)}" aria-pressed="{str(i == 0).lower()}">{esc(s["title"].replace(" settlement", ""))}</button>' for i, s in enumerate(regions))
walls_html = f'<p class="lede">{esc(wl["blurb"])} Wall level is capped by settlement tier: Hamlet 3, Town 5, City 8, Castle 10.</p><div class="bar" role="group" aria-label="Region">{wall_buttons}</div><ol class="steps walls">'
for L in levels:
    cs = [c for c in wl["cards"] if c["level"] == L]
    walls_html += "<li>" + "".join(f'<div class="wcard" data-wregion="{c["region"]}"{"" if c["region"] == "vale" else " hidden"}>{card(c)}</div>' for c in cs) + "</li>"
walls_html += "</ol>"

# ---- Strongholds: the Citadel, then every region's Fortress and Sovereign's Throne
st = by["strongholds"]
strong_html = f'<p class="lede">{esc(st["blurb"])}</p><div class="grid">' + "".join(card(c, wide=True) for c in st["cards"])
for s in regions:
    strong_html += "".join(card({**c, "sub": s["title"].replace(" settlement", "")}) for c in s["cards"] if c.get("tier") in (4, 5))
strong_html += "</div>"

# ---- Still to design
TODO = [
    ("Map towns", [("Rimehold", "Frostmarch town by Hallowmere. House design done (below in Map towns); street layout, snow and a signature hall next."),
                   ("Gull's Rest", "Saltreach harbour town. House design done; harbour, lighthouse and layout to do."),
                   ("Sunscar", "Emberwaste desert town. House design done; layout on sand to do."),
                   ("Mirelight", "Blackfen stilt town. House design done; boardwalks and layout to do.")]),
    ("Story sites", [("Five boss arenas", "One per under-boss, built round each fight."),
                     ("Seven thin-place caves", "Where the Hollow seeps through."),
                     ("Crownhold", "The old royal seat."), ("Bellhollow", ""), ("The Ashen sites", ""), ("Ruins", "Scattered across the regions.")]),
    ("Rails", [("Stations along every line", "Kingsrest station is done; halts and junctions for the other lines to do."),
               ("Rail bridges and tunnels", "Road bridges in Kingsrest and Millbrook are done.")]),
    ("Elsewhere", [("Rival Lords' seats", "The rival lords play from their own plots but have no buildings or walls of their own yet."),
                   ("The Hollow's mining villages", "Glimwade, Lowseam, Tollrest and Highcut are built in code by the Hollow work; pictures not in this catalogue yet.")]),
]
todo_html = '<p class="lede">Everything still to design, so the catalogue shows the whole job.</p><div class="todo">' + "".join(
    f'<section><h2 class="sub">{esc(g)}</h2><ul>' + "".join(f'<li><b>{esc(n)}</b>{" <span>" + esc(d) + "</span>" if d else ""}</li>' for n, d in items) + "</ul></section>"
    for g, items in TODO) + "</div>"

n_cards = sum(len(s["cards"]) for s in S) + len(TOWNS)
n_todo = sum(len(i) for _, i in TODO)
counts = {"pictures": n_cards, "regions": len(regions), "hall levels": 5 * len(regions), "wall levels": len(levels), "still to design": n_todo}

tpl = open(os.path.join(HERE, "full_catalogue.tpl.html")).read()
out = (tpl.replace("__COUNTS__", "".join(f"<div><b>{v}</b><span>{k}</span></div>" for k, v in counts.items()))
          .replace("__MAP__", map_html).replace("__SETTLE__", settle_html).replace("__WALLS__", walls_html)
          .replace("__STRONG__", strong_html).replace("__TODO__", todo_html))
open(os.path.join(a.out, "index.html"), "w").write(out)
print("page", os.path.join(a.out, "index.html"), round(len(out) / 1e3), "KB,", n_cards, "pictures")
