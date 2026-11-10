#!/usr/bin/env python3
"""The Lore Tomes as a real book: an aged, parchment-paged PDF (6 x 9 in), one tome per page.
Run from the siege-nights folder:   python3 studio/build_lore_book.py
Reads the tome text from Siege_Nights_BP/scripts/lore/data, so rerun it after editing a tome.
Needs: node, Pillow, numpy, and Playwright's Chromium (for the PDF)."""
import base64, html, io, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LORE = os.path.join(ROOT, "Siege_Nights_BP", "scripts", "lore")
OUT_DIR = os.path.join(ROOT, "lore-book")
WORK = sys.argv[1] if len(sys.argv) > 1 else OUT_DIR
os.makedirs(OUT_DIR, exist_ok=True); os.makedirs(WORK, exist_ok=True)

data = json.loads(subprocess.run(
    ["node", "--input-type=module", "-e",
     "const L = await import('file://' + process.argv[1] + '/logic.js');"
     "const W = await import('file://' + process.argv[1] + '/data/world.js');"
     "console.log(JSON.stringify({ tomes: L.TOMES, collections: W.COLLECTIONS }))", LORE],
    capture_output=True, text=True, check=True).stdout)

# ---------------------------------------------------------------- painted textures
rng = np.random.default_rng(7)
W, H = 900, 1350

def cloud(scale, strength):
    small = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))
    return (np.asarray(im, dtype=np.float32) / 255 - 0.5) * strength

def data_uri(arr, quality=72):
    buf = io.BytesIO()
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(buf, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
edge = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy])

def parchment(seed_shift=0.0):
    tone = cloud(160, 0.16) + cloud(48, 0.09) + cloud(12, 0.05) + (rng.random((H, W)).astype(np.float32) - 0.5) * 0.05
    burn = np.clip(1 - edge / 150, 0, 1) ** 2.1 * (0.42 + cloud(70, 0.5))      # browned, uneven edges
    stain = np.zeros((H, W), np.float32)
    for _ in range(3):                                                             # water rings and foxing
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(50, 190)
        d = np.hypot(xx - cx, yy - cy)
        stain += np.exp(-((d - r) / 9) ** 2) * 0.045 + np.clip(1 - d / r, 0, 1) * 0.03
    for _ in range(70):
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1.5, 5)
        stain += np.exp(-(np.hypot(xx - cx, yy - cy) / r) ** 2) * 0.12
    fibres = (np.asarray(Image.fromarray((rng.random((H, W // 30)) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float32) / 255 - 0.5) * 0.035
    light = 1 + tone + fibres - burn - stain + seed_shift
    base = np.array([233, 214, 172], np.float32)
    dark = np.array([112, 78, 40], np.float32)
    t = np.clip(light, 0, 1.15)[..., None]
    return dark + (base - dark) * np.clip(t, 0, 1) + (t - 1).clip(0) * 60

def leather():
    grain = cloud(6, 0.22) + cloud(30, 0.14) + cloud(140, 0.2) + (rng.random((H, W)).astype(np.float32) - 0.5) * 0.12
    wear = np.clip(1 - edge / 90, 0, 1) ** 1.5 * 0.35                              # scuffed pale edges
    vign = np.clip(np.hypot((xx - W / 2) / W, (yy - H / 2) / H) * 1.2, 0, 1) ** 2 * 0.45
    light = (0.62 + grain - vign)[..., None]
    col = np.array([92, 44, 30], np.float32) * np.clip(light, 0.15, 1.3)
    return col + wear[..., None] * np.array([70, 52, 34], np.float32)

PAGES = [data_uri(parchment(s)) for s in (0.0, -0.02, 0.015)]
LEATHER = data_uri(leather(), 80)

# ---------------------------------------------------------------- pages
esc = lambda s: html.escape(s, quote=False)
ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
ORNAMENT = "&#10086;"   # floral heart
pages = []
def page(inner, cls="", bg=None):
    n = len(pages)
    bg = bg if bg is not None else n % len(PAGES)
    flip = " flip" if n % 2 else ""
    pages.append(f'<section class="page {cls}{flip}"><img class="bg" src="{{BG{bg}}}"><div class="inner">{inner}</div></section>')

pages.append(f'''<section class="page cover"><img class="bg" src="{{LEATHER}}">
  <div class="frame"><div class="frame2">
    <div class="c-orn">{ORNAMENT}</div>
    <div class="c-title">The<br>Unburned<br>Library</div>
    <div class="c-rule"></div>
    <div class="c-sub">The Collected Tomes of Aldmere</div>
    <div class="c-foot">Being all that the Order of the Ashen Gate<br>could not find to burn</div>
  </div></div></section>''')

page(f'''<div class="half"><div class="orn">{ORNAMENT}</div><h1>The Unburned Library</h1>
  <p class="sub">Seventy-four tomes in eight collections,<br>gathered from chapels, ruins, drowned places<br>and the pockets of the dead</p>
  <div class="orn">{ORNAMENT}</div><p class="imprint">Catalogued by Archivist Pell,<br>formerly Novice of the Ashen Gate</p></div>''')

page(f'''<h2 class="center">To the Reader</h2><div class="rule"></div>
  <p class="body first">These are the books they burned. Forty-one portraits, every chronicle they could find, a mage's whole library. Yet a book is a hard thing to burn completely when the man holding the torch can read.</p>
  <p class="body">I have bound them here as I found them, and I have not corrected them, because they do not agree. A chronicler writes what his court tells him. An order of knights writes what it wants believed. A mage writes what he saw, and is burned for it. Ask three things of every page: who wrote it, who they were afraid of, and whether they were there.</p>
  <p class="body">The letters of the lighthouse keeper were in a cipher, and the hymns of the Choir run right to left in the old way. I have set both down plainly. Do not read the hymns aloud.</p>
  <p class="body">Six pages of the Surveyor's notes I have left blank. What they say is different for every reader, and you must find your own.</p>
  <p class="sign">Pell</p>
  <p class="warn">Whoever reads this book to the end will know the whole truth of Aldmere.<br>If you would rather find it out yourself, close it now.</p>''')

toc = "".join(f'<tr><td class="num">{ROMAN[i + 1]}</td><td>{esc(c["name"])}</td><td class="cnt">{c["count"]} tomes</td></tr>' for i, c in enumerate(data["collections"]))
page(f'<h2 class="center">The Collections</h2><div class="rule"></div><table class="toc">{toc}</table><div class="orn low">{ORNAMENT}</div>')

for ci, col in enumerate(data["collections"]):
    tomes = sorted([t for t in data["tomes"] if t["col"] == col["id"]], key=lambda t: t["n"])
    listing = "".join(f'<li><span>{t["n"]}.</span> {esc(t["title"])}</li>' for t in tomes)
    page(f'''<div class="divider"><div class="part">Collection {ROMAN[ci + 1]}</div><h1>{esc(col["name"])}</h1>
      <div class="rule"></div><p class="blurb">{esc(col["blurb"])}</p><ol class="list">{listing}</ol></div>''', cls="div")
    for t in tomes:
        note = ""
        if t.get("cipher"): note = "Deciphered with the brass wheel"
        if t.get("mirror"): note = "Written right to left; set down here plainly"
        paras = []
        for i, p in enumerate(t["pages"]):
            if p == "{SURVEY}":
                paras.append('<div class="blank"><span>This page is different in every world.<br>Find the notebook, and read your own.</span></div>')
            else:
                paras.append(f'<p class="body{" first" if i == 0 else ""}{" hymn" if t.get("mirror") else ""}">{esc(p)}</p>')
        page(f'''<div class="runhead">{esc(col["name"])} &middot; {t["n"]} of {col["count"]}</div>
          <h2>{esc(t["title"])}</h2><div class="author">{esc(t["author"])}</div>
          {f'<div class="note">{note}</div>' if note else ''}<div class="rule"></div>
          <div class="text">{"".join(paras)}</div><div class="orn end">{ORNAMENT}</div>''', cls="tome")

page(f'<div class="half"><div class="orn">{ORNAMENT}</div><p class="sub">Here the Library ends.</p><p class="imprint">Say their name.</p></div>')
pages.append('<section class="page cover"><img class="bg" src="{LEATHER}"><div class="frame"><div class="frame2"></div></div></section>')

CSS = '''
@page { size: 6in 9in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #2a1a12; }
.page { position: relative; width: 6in; height: 9in; overflow: hidden; page-break-after: always; break-after: page;
  font-family: "Bitstream Charter", "Caladea", "Liberation Serif", serif; color: #33210f; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.flip .bg { transform: scaleX(-1); }
.inner { position: absolute; inset: 0.72in 0.74in 0.7in 0.86in; }
.flip .inner { inset: 0.72in 0.86in 0.7in 0.74in; }
.page:not(.cover)::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 0.55in;
  background: linear-gradient(90deg, rgba(60,35,12,.42), rgba(60,35,12,0)); }
.flip:not(.cover)::after { left: auto; right: 0; background: linear-gradient(270deg, rgba(60,35,12,.42), rgba(60,35,12,0)); }
h1, h2 { font-family: "Caladea", "Bitstream Charter", serif; font-weight: 700; margin: 0; color: #3d1d10; }
h2 { font-size: 19pt; line-height: 1.15; letter-spacing: .01em; }
h2.center, .center { text-align: center; }
.runhead { font-size: 7.6pt; letter-spacing: .16em; text-transform: uppercase; color: #6f5230; text-align: center; margin-bottom: .34in; }
.author { font-style: italic; font-size: 10.5pt; color: #5a3d1e; margin-top: .07in; }
.note { font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: #7a4a2a; margin-top: .08in; }
.rule { height: 5px; margin: .16in 0 .2in; border-top: 1.2px solid #5a3a1c; border-bottom: .5px solid #5a3a1c; opacity: .75; }
.body { font-size: 12.5pt; line-height: 1.55; text-align: justify; hyphens: auto; margin: 0 0 .13in; text-indent: 1.4em; }
.body.first { text-indent: 0; }
.tome .body.first::first-letter { font-family: "Caladea", serif; font-weight: 700; font-size: 3.1em; float: left; line-height: .82;
  padding: .06em .08em 0 0; color: #7a1f14; }
.hymn { font-style: italic; text-align: center; text-indent: 0; hyphens: none; padding: 0 .2in; }
.tome .hymn.first::first-letter { float: none; font-size: 1.5em; padding: 0; }
.orn { text-align: center; font-size: 17pt; color: #7a1f14; opacity: .8; }
.orn.end { position: absolute; left: 0; right: 0; bottom: 0; font-size: 13pt; line-height: 1; }
.text { padding-bottom: .3in; }
.orn.low { margin-top: .5in; }
.blank { border: 1px dashed rgba(90,58,28,.55); height: 1.25in; margin: .1in 0 .2in; display: flex; align-items: center; justify-content: center;
  text-align: center; font-style: italic; font-size: 9.5pt; color: #6f5230; background: rgba(120,80,40,.07); }
.half { text-align: center; padding-top: 1.9in; }
.half h1 { font-size: 27pt; margin: .3in 0 .25in; letter-spacing: .02em; }
.sub { font-style: italic; font-size: 11.5pt; line-height: 1.6; margin: 0 0 .4in; }
.imprint { font-size: 9pt; letter-spacing: .12em; text-transform: uppercase; color: #6f5230; margin-top: .45in; line-height: 1.7; }
.sign { text-align: right; font-style: italic; font-size: 15pt; margin: .2in .3in 0 0; color: #3d1d10; }
.warn { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8.6pt; font-style: italic; color: #7a1f14; line-height: 1.5; }
.toc { width: 100%; border-collapse: collapse; margin-top: .25in; font-size: 12pt; }
.toc td { padding: .13in 0; border-bottom: .5px dotted rgba(90,58,28,.6); }
.toc .num { width: .55in; color: #7a1f14; font-weight: 700; } .toc .cnt { text-align: right; font-style: italic; font-size: 10pt; color: #6f5230; }
.divider { text-align: center; padding-top: .7in; }
.part { font-size: 9pt; letter-spacing: .28em; text-transform: uppercase; color: #7a1f14; margin-bottom: .22in; }
.divider h1 { font-size: 23pt; line-height: 1.15; }
.divider .rule { width: 2.2in; margin: .25in auto; }
.blurb { font-style: italic; font-size: 11pt; line-height: 1.5; margin: 0 .2in .35in; }
.list { list-style: none; padding: 0; margin: 0 auto; width: 3.6in; text-align: left; font-size: 9.8pt; line-height: 1.75; }
.list span { display: inline-block; width: .3in; color: #7a1f14; }
.cover .frame { position: absolute; inset: .42in; border: 2.5px solid #c9a24a; border-radius: 4px; padding: .09in; box-shadow: 0 0 0 1px rgba(40,20,10,.6), inset 0 0 0 1px rgba(40,20,10,.5); }
.cover .frame2 { height: 100%; border: 1px solid #c9a24a; text-align: center; color: #d9b65c; padding-top: 1.35in;
  font-family: "Caladea", "Bitstream Charter", serif; text-shadow: 0 1px 0 rgba(30,12,6,.9), 0 -1px 0 rgba(255,236,170,.25); }
.c-orn { font-size: 26pt; } .c-title { font-size: 39pt; font-weight: 700; line-height: 1.12; letter-spacing: .04em; margin: .35in 0 .3in; text-transform: uppercase; }
.c-rule { width: 1.6in; height: 5px; margin: 0 auto .3in; border-top: 1.5px solid #c9a24a; border-bottom: .6px solid #c9a24a; }
.c-sub { font-size: 13pt; font-style: italic; letter-spacing: .04em; }
.c-foot { position: absolute; left: 0; right: 0; bottom: 1.05in; font-size: 8.6pt; letter-spacing: .14em; text-transform: uppercase; line-height: 1.8; opacity: .85; }
'''
# Shrink the text of any tome that would run off its page
FIT = '''<script>
for (const page of document.querySelectorAll(".page.tome, .page.div")) {
  const inner = page.querySelector(".inner");
  let size = 12.5;
  while (inner.scrollHeight > inner.clientHeight + 1 && size > 8) {
    size -= 0.25;
    for (const p of inner.querySelectorAll(".body, .list")) p.style.fontSize = (p.classList.contains("list") ? size - 1.2 : size) + "pt";
  }
  if (inner.scrollHeight > inner.clientHeight + 1) document.title += " OVERFLOW:" + page.querySelector("h2, h1").textContent;
}
</script>'''
doc = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Unburned Library</title><style>{CSS}</style></head><body>{"".join(pages)}{FIT}</body></html>'
doc = doc.replace("{LEATHER}", LEATHER)
for i, uri in enumerate(PAGES): doc = doc.replace(f"{{BG{i}}}", uri)
html_path = os.path.join(WORK, "book.html")
open(html_path, "w", encoding="utf8").write(doc)
pdf_path = os.path.join(OUT_DIR, "The-Unburned-Library.pdf")
js = '''const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("file://" + process.argv[2]); await p.waitForTimeout(500);
  console.log("title:", await p.title());
  await p.pdf({ path: process.argv[3], width: "6in", height: "9in", printBackground: true, preferCSSPageSize: true });
  await b.close(); })();'''
js_path = os.path.join(WORK, "print.cjs")
open(js_path, "w").write(js)
print(subprocess.run(["node", js_path, html_path, pdf_path], capture_output=True, text=True))
print(len(pages), "pages ->", pdf_path, os.path.getsize(pdf_path) // 1024, "KB")
