"""catalogue.json + card pictures -> one self-contained catalogue page.

    python3 render/catalogue_page.py CAT_DIR out.html
"""
import sys, os, json, base64, io, html
from PIL import Image
cat_dir, out = sys.argv[1], sys.argv[2]
idx = json.load(open(os.path.join(cat_dir, "catalogue.json")))
STOREYS = {"kingsrest_inn": "2 + attic", "vale_house_11": "2", "vale_house_12": "3", "vale_house_13": "2", "vale_house_14": "2"}
def img(p):
    im = Image.open(os.path.join(cat_dir, p)).convert("RGB")
    w, h = im.size; im = im.crop((int(w * .12), int(h * .04), int(w * .88), int(h * .96))).resize((720, 552), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=78, optimize=True); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
cards = []
for e in idx:
    sx, sy, sz = e["size"]
    styles = "".join(f'<button type="button" class="sw" data-style="{k}" aria-pressed="{str(k == "tudor").lower()}">{html.escape(v["name"])}</button>' for k, v in e["styles"].items())
    pics = "".join(f'<img data-style="{k}" src="{img(v["image"])}" alt="{html.escape(e["title"])}, {html.escape(v["name"])}" {"" if k == "tudor" else "hidden"} loading="lazy">' for k, v in e["styles"].items())
    blocks = e["styles"]["tudor"]["blocks"]
    cards.append(f'''<article class="card" id="{e["key"]}">
  <div class="pic">{pics}</div>
  <div class="body">
    <p class="kind">{html.escape(e["kind"])}</p>
    <h2>{html.escape(e["title"])}</h2>
    <div class="styles" role="group" aria-label="Style">{styles}</div>
    <dl>
      <div><dt>Footprint</dt><dd>{sx} × {sz}</dd></div>
      <div><dt>Height</dt><dd>{sy}</dd></div>
      <div><dt>Floors</dt><dd>{STOREYS.get(e["key"], "")}</dd></div>
      <div><dt>Blocks</dt><dd>{blocks:,}</dd></div>
    </dl>
    <p>{html.escape(e["use"])}</p>
    <p class="inside"><b>Inside:</b> {html.escape(e["inside"])}</p>
    <p class="where"><b>Goes:</b> {html.escape(e["where"])}</p>
    <p class="file">{e["key"]}.mcstructure</p>
  </div>
</article>''')
n = len(idx)
page = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalogue.tpl.html")).read()
page = page.replace("__CARDS__", "\n".join(cards)).replace("__N__", str(n)).replace("__V__", str(n * 3))
open(out, "w").write(page); print(out, round(len(page) / 1e6, 2), "MB")
