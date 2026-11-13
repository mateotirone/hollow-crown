"""Install the Everwake Wings into the packs (idempotent; run again after changing studio/wings/).

    python3 tools/build_everwake_wings.py

Writes: RP model + texture + animations + controller + render controller + item icon, patches
RP entity/player.entity.json (wing geometry drawn over any armour, driven by siege:wings) and BP entities/player.json
(the siege:wings property), the BP item, item_texture.json and both lang files. The script is BP scripts/wings/.
"""
import json, os, shutil, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "Siege_Nights_RP"), os.path.join(ROOT, "Siege_Nights_BP")
ST = os.path.join(ROOT, "studio", "wings")
ITEM = "siege:everwake_wings"
PROP = "siege:wings"
SHOWN = f"(query.has_property('{PROP}') ? query.property('{PROP}') : 0) >= 1"


def jload(p): return json.load(open(p, encoding="utf-8"))
def jsave(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    ind = 2
    if os.path.exists(p):                      # keep the file's own indent so diffs stay small
        lines = open(p, encoding="utf-8").read().splitlines()
        if len(lines) > 1: ind = (len(lines[1]) - len(lines[1].lstrip(" "))) or 2
    with open(p, "w", encoding="utf-8") as f: json.dump(d, f, indent=ind, ensure_ascii=False); f.write("\n")


tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, os.path.join(ST, "build_wings.py"), tmp], check=True, stdout=subprocess.DEVNULL)
subprocess.run([sys.executable, os.path.join(ST, "build_anim.py"), ROOT, tmp, tmp], check=True, stdout=subprocess.DEVNULL)
shutil.copy(os.path.join(tmp, "everwake_wings.png"), os.path.join(RP, "textures/entity/everwake_wings.png"))
jsave(os.path.join(RP, "models/entity/everwake_wings.geo.json"), jload(os.path.join(tmp, "everwake_wings.geo.json")))
jsave(os.path.join(RP, "animations/everwake_wings.animation.json"), jload(os.path.join(tmp, "everwake_wings.animation.json")))
jsave(os.path.join(RP, "animation_controllers/everwake_wings.animation_controllers.json"),
      jload(os.path.join(tmp, "everwake_wings.animation_controllers.json")))
jsave(os.path.join(RP, "render_controllers/everwake_wings.render_controllers.json"), {
    "format_version": "1.8.0", "render_controllers": {"controller.render.siege.everwake_wings": {
        "geometry": "Geometry.everwake_wings", "materials": [{"*": "Material.everwake_wings"}],
        "textures": ["Texture.everwake_wings"]}}})
ANIMS = jload(os.path.join(tmp, "everwake_wings.animation.json"))["animations"]
shutil.rmtree(tmp)

# ---- player.entity.json: the wings are their own geometry drawn over the player (and any armour), not an armour slot
pe_path = os.path.join(RP, "entity/player.entity.json")
pe = jload(pe_path); d = pe["minecraft:client_entity"]["description"]
d["materials"]["everwake_wings"] = "entity_alphatest"
d["textures"]["everwake_wings"] = "textures/entity/everwake_wings"
d["geometry"]["everwake_wings"] = "geometry.siege.everwake_wings"
d["animations"]["everwake_wings"] = "controller.animation.siege.everwake_wings"
for k in ANIMS: d["animations"]["everwake_" + k.split(".")[-1]] = k
anim = d["scripts"].setdefault("animate", [])
if "everwake_wings" not in anim: anim.append("everwake_wings")
rc = d["render_controllers"]
rc[:] = [r for r in rc if "controller.render.siege.everwake_wings" not in (r if isinstance(r, dict) else {r: 1})]
rc.append({"controller.render.siege.everwake_wings": f"!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && {SHOWN}"})
jsave(pe_path, pe)

# ---- BP player: the synced number the animations read
pb_path = os.path.join(BP, "entities/player.json")
pb = jload(pb_path)
pb["minecraft:entity"]["description"].setdefault("properties", {})[PROP] = {"type": "int", "range": [0, 4], "default": 0, "client_sync": True}
jsave(pb_path, pb)

# ---- the item (used once: binds the wings to you)
jsave(os.path.join(BP, "items/everwake_wings.json"), {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": ITEM, "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": "siege_everwake_wings", "minecraft:display_name": {"value": f"item.{ITEM}.name"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True, "minecraft:rarity": "epic"}}})
# icon: a pair of white wings with glowing gold tips, 16x16
ic = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); px = ic.load()
WHITE, CREAM, GOLD, BRASS = (250, 247, 238, 255), (226, 213, 184, 255), (246, 222, 150, 255), (196, 168, 102, 255)
rows = ["................", "..##........##..", ".####......####.", "######....######", "#######..#######",
        "#######..#######", ".######..######.", ".######..######.", "..#####..#####..", "..#####..#####..",
        "...####..####...", "...###....###...", "....##....##....", "....#......#....", "................", "................"]
for y, r in enumerate(rows):
    for x, ch in enumerate(r):
        if ch != "#": continue
        tip = y + 1 >= len(rows) or rows[y + 1][x] != "#"
        px[x, y] = GOLD if tip else (CREAM if x % 2 else WHITE)
for x, y in ((7, 4), (8, 4), (7, 5), (8, 5)): px[x, y] = BRASS
ic.save(os.path.join(RP, "textures/items/everwake_wings.png"))
it_path = os.path.join(RP, "textures/item_texture.json")
it = jload(it_path); it["texture_data"]["siege_everwake_wings"] = {"textures": "textures/items/everwake_wings"}
jsave(it_path, it)
for lang in (os.path.join(RP, "texts/en_US.lang"), os.path.join(BP, "texts/en_US.lang")):
    lines = open(lang, encoding="utf-8").read().splitlines()
    lines = [l for l in lines if not l.startswith(f"item.{ITEM}.name=")] + [f"item.{ITEM}.name=Everwake Wings"]
    open(lang, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("everwake wings installed")
