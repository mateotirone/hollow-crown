#!/usr/bin/env python3
"""Portraits and paintings that hang on walls (entity siege:portrait).

Reads Siege_Nights_BP/scripts/lore/data/portraits.js (through node) and writes:
  BP entities/lore/portrait.json, RP entity + geometry + render controller,
  textures/entity/portrait/<id>.png   placeholder portraits (32x64), NEVER overwriting a PNG that exists,
                                      and the eight gallery paintings cut down from lore-book/plates/art/*.jpg
  studio/art/PORTRAIT-BRIEF.md        who to paint, for the textures thread
Run:  python3 studio/build_lore_portraits.py [--plates]   (--plates redoes the eight paintings)
"""
import json, os, subprocess, sys, hashlib
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "Siege_Nights_BP"), os.path.join(ROOT, "Siege_Nights_RP")
TEX = os.path.join(RP, "textures/entity/portrait")
os.makedirs(TEX, exist_ok=True)

js = "import('%s').then(m=>console.log(JSON.stringify(m.PICS)))" % os.path.join(BP, "scripts/lore/data/portraits.js")
PICS = json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)

# size -> (blocks wide, blocks tall, texture w, texture h)
SIZES = {0: (1, 2, 32, 64), 1: (3, 2, 96, 64), 2: (2, 3, 64, 96)}
FRAME = (58, 40, 24)

def framed(img):
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle([0, 0, w - 1, h - 1], outline=FRAME)
    d.rectangle([1, 1, w - 2, h - 2], outline=(94, 68, 40))
    img.putpixel((0, 0), FRAME)
    return img

def placeholder(pic):
    """A dim figure on a dark ground, different for each sitter, so a wall of them reads as portraits until they are painted."""
    w, h = SIZES[pic["size"]][2:]
    seed = hashlib.md5(pic["id"].encode()).digest()
    ground = (30 + seed[0] % 30, 26 + seed[1] % 24, 22 + seed[2] % 22)
    coat = (50 + seed[3] % 90, 40 + seed[4] % 70, 40 + seed[5] % 70)
    skin = (150 + seed[6] % 50, 115 + seed[7] % 40, 90 + seed[8] % 30)
    img = Image.new("RGBA", (w, h), ground + (255,))
    d = ImageDraw.Draw(img)
    for y in range(h):  # a little light from the upper left
        for x in range(w):
            if (x * 7 + y * 13 + seed[9]) % 11 == 0:
                img.putpixel((x, y), tuple(min(255, c + 8) for c in ground) + (255,))
    if "No sitter" not in pic.get("sub", "") and "still life" not in pic.get("sub", "").lower():
        cx = w // 2 + (seed[10] % 5 - 2)
        d.polygon([(cx - 11, h - 3), (cx - 8, 34), (cx - 3, 30), (cx + 3, 30), (cx + 8, 34), (cx + 11, h - 3)], fill=coat)
        d.ellipse([cx - 5, 17, cx + 5, 31], fill=skin)
        hair = (40 + seed[11] % 160,) * 3 if seed[12] % 3 == 0 else (40 + seed[11] % 60, 30 + seed[12] % 40, 20)
        d.pieslice([cx - 6, 14, cx + 6, 28], 180, 360, fill=hair)
        d.point([(cx - 2, 24), (cx + 2, 24)], fill=(30, 30, 34))
    else:
        d.rectangle([5, 30, w - 6, 34], fill=(96, 70, 44))
        d.ellipse([10, 42, 22, 54], fill=(170, 160, 140))
    return framed(img)

made = kept = 0
for i, pic in enumerate(PICS):
    path = os.path.join(TEX, pic["id"] + ".png")
    if pic["id"].startswith("plate_"):
        src = os.path.join(ROOT, "lore-book/plates/art", pic["id"] + ".jpg")
        if os.path.exists(src) and ("--plates" in sys.argv or not os.path.exists(path)):
            w, h = SIZES[pic["size"]][2:]
            framed(Image.open(src).convert("RGBA").resize((w, h), Image.LANCZOS)).save(path); made += 1
        elif not os.path.exists(path):
            placeholder(pic).save(path); made += 1
        continue
    if os.path.exists(path): kept += 1; continue
    placeholder(pic).save(path); made += 1

def panel(name, bw, bh, tw, th):
    w, h = bw * 16, bh * 16
    edge = {"uv": [0, 0], "uv_size": [1, 1]}
    return {"description": {"identifier": f"geometry.siege_portrait_{name}", "texture_width": tw, "texture_height": th,
                            "visible_bounds_width": bw + 2, "visible_bounds_height": bh + 2, "visible_bounds_offset": [0, bh / 2, 0]},
            "bones": [{"name": "picture", "pivot": [0, 0, 0], "cubes": [{
                "origin": [-w / 2, 0, -0.5], "size": [w, h, 1],
                "uv": {"north": {"uv": [0, 0], "uv_size": [tw, th]}, "south": {"uv": [tw, 0], "uv_size": [-tw, th]},
                       "east": edge, "west": edge, "up": edge, "down": edge}}]}]}

def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(data, open(path, "w"), indent=2)

dump(os.path.join(RP, "models/entity/lore/portrait.geo.json"), {"format_version": "1.12.0", "minecraft:geometry": [
    panel("tall", *SIZES[0]), panel("wide", *SIZES[1]), panel("grand", *SIZES[2])]})
dump(os.path.join(RP, "entity/lore/portrait.entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "siege:portrait", "materials": {"default": "entity_alphatest"},
    "textures": {f"p{i}": f"textures/entity/portrait/{p['id']}" for i, p in enumerate(PICS)},
    "geometry": {"tall": "geometry.siege_portrait_tall", "wide": "geometry.siege_portrait_wide", "grand": "geometry.siege_portrait_grand"},
    "render_controllers": ["controller.render.siege_portrait"]}}})
dump(os.path.join(RP, "render_controllers/siege_portrait.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {
    "controller.render.siege_portrait": {
        "arrays": {"textures": {"Array.pics": [f"Texture.p{i}" for i in range(len(PICS))]},
                   "geometries": {"Array.shapes": ["Geometry.tall", "Geometry.wide", "Geometry.grand"]}},
        "geometry": "Array.shapes[q.property('siege:size')]",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.pics[q.property('siege:pic')]"]}}})
no = lambda cause: {"cause": cause, "deals_damage": "no"}
dump(os.path.join(BP, "entities/lore/portrait.json"), {"format_version": "1.21.60", "minecraft:entity": {
    "description": {"identifier": "siege:portrait", "is_spawnable": False, "is_summonable": True, "properties": {
        "siege:pic": {"type": "int", "range": [0, 127], "default": 0, "client_sync": True},
        "siege:size": {"type": "int", "range": [0, 2], "default": 0, "client_sync": True}}},
    "components": {
        "minecraft:type_family": {"family": ["siege_portrait", "inanimate"]},
        "minecraft:health": {"value": 20, "max": 20},
        "minecraft:collision_box": {"width": 0.6, "height": 1.6},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1}, "minecraft:movement": {"value": 0},
        "minecraft:persistent": {}, "minecraft:fire_immune": {},
        "minecraft:damage_sensor": {"triggers": [{"on_damage": {"filters": {"test": "has_ability", "subject": "other", "value": "instabuild"}}, "deals_damage": "yes"}, no("all")]}}}})

lang = os.path.join(RP, "texts/en_US.lang")
lines = [l for l in open(lang).read().splitlines() if not l.startswith("entity.siege:portrait.name=")]
open(lang, "w").write("\n".join(lines + ["entity.siege:portrait.name=Portrait"]) + "\n")

brief = ["# Portraits to paint (lore thread, for the textures thread)", "",
         "Each settlement's Library shows the three people who held that ground before the player. Files are `Siege_Nights_RP/textures/entity/portrait/<file>.png`, **32 x 64**, one block wide and two tall.",
         "Keep the two-pixel dark frame, and keep pixel (0,0) the frame colour: the edges of the panel use it. Paint over the placeholders with the same names; `studio/build_lore_portraits.py` never overwrites a PNG that exists.",
         "Style: old oil portraits, dark ground, light from the upper left, each region's ramps for clothes. They should look painted centuries apart: the 700-year-old ones stiff and flat, the later ones softer.",
         "",
         "**The secret.** None of these may show the last king's adult face. `redmesa_3` (Under the Bench) must show only a wrapped bundle. `wrenfield_2` is the princess as a child and may show her pale hair and the grey smudge on her LEFT palm. `oakmere_1` is King Aldric, the grandfather, and is safe to paint in full. `wolfcairn_2` is Vorlund young and is safe. `tidewatch_3` is one of the Returned: perfectly pleasant, slightly too smooth, cup in the RIGHT hand.",
         "", "| File | Settlement | Who | When | What to paint |", "|---|---|---|---|---|"]
for p in PICS:
    if p.get("plot"):
        brief.append(f"| `{p['id']}.png` | {p['plot']} | {p['title']} | {p['sub'].split(', ')[-1].rstrip('.')} | {p['look']} |")
brief += ["", "The eight gallery paintings (`plate_1.png` to `plate_8.png`, 96 x 64 and one 64 x 96) are cut down from Mateo's own paintings and need no repainting."]
open(os.path.join(ROOT, "studio/art/PORTRAIT-BRIEF.md"), "w").write("\n".join(brief) + "\n")
print(f"portraits: {len(PICS)} pictures, {made} textures written, {kept} kept")
