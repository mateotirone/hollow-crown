"""Write Siege_Nights_RP/ui/hud_screen.json: the minimap, the quest tracker and the Regal balance on the HUD (and the boss bars
from tools/bossbar_ui.py).

    python3 tools/minimap_ui.py

How it works (no Beta features needed): the script (scripts/minimap/) sends each player a hidden
title that starts with "hcm:". The HUD keeps a copy of the last such title (the "preserve title"
pattern from the Bedrock Wiki), so the map stays up while real titles come and go, and the vanilla
title box ignores titles that start with "hcm:".

The hidden title is fixed width at the front:
    hcm:  D  P  TTTTTT  C  R  K  |  label
    D       arrow direction, "q r s t u v w y" (north, then clockwise)
    P       arrow spot inside the middle tile, "a".."p" (row by row, 4 x 4); anything else hides it
    TTTTTT  map texture: "xXXzZZ" tile, "none__" for uncharted, "off___" hides the whole minimap
    C R     quest pin cell on the 9 x 9 grid over the view: column "a".."i", row "j".."r" (own letters, so
            the row can be cut from the column)
    K       pin kind and texture pK.png: "g" the quest's place, "e" held on the rim, "t" a person to talk to;
            "_" no pin
    label   place name under the map (no digits)
The quest tracker (scripts/quests/) works the same way with titles that start with "hcq:":
    hcq:  SS  text
    SS      where the panel sits: "_b" under the minimap, "_t" in its place (minimap hidden), "_h" hidden
    text    the panel's lines (colour codes and line breaks allowed; it never holds "hcq:" or a spot marker)
The Regal balance (scripts/economy/hud.js) sits right of the hotbar, fed by titles that start with "hcr:":
    hcr:  SS  text
    SS      "_s" shown, "_h" hidden
    text    the coloured number, e.g. "\u00a761,234" (always starts with a colour code, so never all digits)
core/hudtitle.js sends all three kinds and keeps them from cutting a real title short.

No piece that is cut out may be all digits: JSON UI turns a string like "1717" into a number. The first
version did that and its tiles were also palette PNGs; the map showed black (playtest 2026-11-11).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Siege_Nights_RP", "ui", "hud_screen.json")
TEX = "textures/ui/hc/minimap/"
KEY = "hcm:"
PX = 24          # pixels per tile; must match tools/minimap_tiles.py
MAP = 3 * PX     # the map picture, shown 1:1
RIM = 4
ARROW = 9

# string pieces, written as JSON UI expressions over #preserved_text (the kept copy of the title)
S = f"(#preserved_text - '{KEY}')"                 # D P TTTT | label
DP = f"('%.2s' * {S})"
D = f"('%.1s' * {S})"
P = f"({DP} - {D})"
R = f"({S} - {DP})"                                # TTTTTT | label (the label may lose letters here; unused)
T = f"('%.6s' * {R})"
LABEL = f"({S} - ('%.12s' * {S}))"                # everything after D P TTTTTT C R K |
X = f"({S} - ('%.8s' * {S}))"                      # C R K | label
CR = f"('%.2s' * {X})"
C = f"('%.1s' * {X})"
ROW = f"({CR} - {C})"
CRK = f"('%.3s' * {X})"                          # C R K
K = f"({CRK} - {CR})"
PIN = 9          # pin cells per side; must match PIN_COLS in scripts/minimap/data.js
CELL = MAP // PIN
PIN_SIZE = 7
HAS = f"(not ({S} = #preserved_text))"
ON = f"({HAS} and (not ({T} = 'off___')))"


def view(expr, target):
    return {"binding_type": "view", "source_control_name": "hc_minimap_data", "resolve_sibling_scope": True,
            "source_property_name": expr, "target_property_name": target}


def image(texture, size, offset, layer, bindings):
    return {"type": "image", "texture": texture, "size": size, "offset": offset, "layer": layer,
            "anchor_from": "top_left", "anchor_to": "top_left", "bindings": bindings}


box = []
box.append({"hc_minimap_data": {
    "type": "panel", "size": [0, 0], "$update_string": KEY,
    "property_bag": {"#preserved_text": ""},
    "bindings": [
        {"binding_name": "#hud_title_text_string"},
        {"binding_name": "#hud_title_text_string", "binding_name_override": "#preserved_text", "binding_condition": "visibility_changed"},
        {"binding_type": "view", "target_property_name": "#visible",
         "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))"},
    ]}})
box.append({"hc_minimap_frame": image(TEX + "frame", [MAP + 2 * RIM, MAP + 2 * RIM], [0, 0], 1, [view(ON, "#visible")])})
box.append({"hc_minimap_map": image("#texture", [MAP, MAP], [RIM, RIM], 2,
                                    [view(ON, "#visible"), view(f"('{TEX}m' + {T})", "#texture")])})
letters = "abcdefghijklmnop"
for i, letter in enumerate(letters):
    cx = PX + (i % 4) * (PX // 4) + PX // 8
    cy = PX + (i // 4) * (PX // 4) + PX // 8
    off = [RIM + cx - ARROW / 2, RIM + cy - ARROW / 2]
    box.append({f"hc_minimap_arrow_{letter}": image("#texture", [ARROW, ARROW], off, 4, [
        view(f"({ON} and ({P} = '{letter}'))", "#visible"),
        view(f"('{TEX}a' + {D})", "#texture"),
    ])})
# the quest pin (scripts/minimap/data.js pinCode): one pin per cell, each a direct sibling of hc_minimap_data.
# Not nested in column panels: a view binding's source_control_name is only found among siblings, so pins one
# level down could not read the data, stayed visible and drew 81 missing-texture squares (playtest 1.2.1519).
# The grid came back in playtest 1.2.1619 with the map itself hidden, so the pins' long four-part "and" could not
# be worked out either. Now each pin starts hidden ("visible": false, so a binding that fails leaves it hidden),
# its test is one short comparison of the three letters C R K, and its picture is that cut minus its own cell.
for ci, col in enumerate("abcdefghi"):
    for ri, row in enumerate("jklmnopqr"):
        off = [RIM + CELL * ci + (CELL - PIN_SIZE) / 2, RIM + CELL * ri + (CELL - PIN_SIZE) / 2]
        cell = col + row
        shown = f"(({CRK} = '{cell}g') or (({CRK} = '{cell}e') or ({CRK} = '{cell}t')))"
        pin = image("#texture", [PIN_SIZE, PIN_SIZE], off, 3, [
            view(shown, "#visible"),
            view(f"('{TEX}p' + ({CRK} - '{cell}'))", "#texture"),
        ])
        pin["visible"] = False
        pin["property_bag"] = {"#texture": TEX + "p_"}
        box.append({f"hc_minimap_pin_{cell}": pin})
box.append({"hc_minimap_north": {
    "type": "label", "text": "N", "color": [0.93, 0.78, 0.42], "shadow": True, "layer": 5,
    "font_scale_factor": 0.75, "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 0],
    "size": ["default", "default"], "bindings": [view(ON, "#visible")]}})
box.append({"hc_minimap_place": {
    "type": "label", "text": "#text", "color": [0.95, 0.93, 0.86], "shadow": True, "layer": 5,
    "font_scale_factor": 0.75, "text_alignment": "center", "localize": False,
    "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, MAP + 2 * RIM + 1],
    "size": [MAP + 2 * RIM + 40, "default"],
    "bindings": [view(ON, "#visible"), view(LABEL, "#text")]}})

# ---------- the quest tracker ----------
QKEY = "hcq:"
QW = 168        # panel width; lines wrap inside it
QS = "(#preserved_text - 'hcq:')"
QSPOT = f"('%.2s' * {QS})"
QTEXT = f"(({QS} - '_b') - '_t')"
QHAS = f"(not ({QS} = #preserved_text))"


def qview(expr, target):
    return {"binding_type": "view", "source_control_name": "hc_quests_data", "resolve_sibling_scope": True,
            "source_property_name": expr, "target_property_name": target}


def quest_label(name, spot, y):
    return {name: {
        "type": "label", "text": "#text", "color": [1.0, 1.0, 1.0], "shadow": True, "layer": 5,
        "font_scale_factor": 0.75, "text_alignment": "right", "localize": False,
        "anchor_from": "top_right", "anchor_to": "top_right", "offset": [0, y], "size": [QW, "default"],
        "bindings": [qview(f"({QHAS} and ({QSPOT} = '{spot}'))", "#visible"), qview(QTEXT, "#text")]}}


quests = [
    {"hc_quests_data": {
        "type": "panel", "size": [0, 0], "$update_string": QKEY,
        "property_bag": {"#preserved_text": ""},
        "bindings": [
            {"binding_name": "#hud_title_text_string"},
            {"binding_name": "#hud_title_text_string", "binding_name_override": "#preserved_text", "binding_condition": "visibility_changed"},
            {"binding_type": "view", "target_property_name": "#visible",
             "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))"},
        ]}},
    quest_label("hc_quests_below", "_b", MAP + 2 * RIM + 14),
    quest_label("hc_quests_top", "_t", 0),
]

# ---------- the Regal balance ----------
RKEY = "hcr:"
RS = "(#preserved_text - 'hcr:')"
RSPOT = f"('%.2s' * {RS})"
RTEXT = f"(({RS} - '_s') - '_h')"
RON = f"((not ({RS} = #preserved_text)) and ({RSPOT} = '_s'))"
COIN = 8         # the 8x8 menu coin, shown 1:1
HOTBAR = 182     # the vanilla hotbar's width; the balance sits just right of it


def rview(expr, target):
    return {"binding_type": "view", "source_control_name": "hc_regals_data", "resolve_sibling_scope": True,
            "source_property_name": expr, "target_property_name": target}


regals = [
    {"hc_regals_data": {
        "type": "panel", "size": [0, 0], "$update_string": RKEY,
        "property_bag": {"#preserved_text": ""},
        "bindings": [
            {"binding_name": "#hud_title_text_string"},
            {"binding_name": "#hud_title_text_string", "binding_name_override": "#preserved_text", "binding_condition": "visibility_changed"},
            {"binding_type": "view", "target_property_name": "#visible",
             "source_property_name": "(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - $update_string) = #hud_title_text_string))"},
        ]}},
    {"hc_regals_coin": {**image("textures/ui/hc/coin", [COIN, COIN], [0, 1], 4, [rview(RON, "#visible")])}},
    {"hc_regals_amount": {
        "type": "label", "text": "#text", "color": [1.0, 0.85, 0.35], "shadow": True, "layer": 5,
        "text_alignment": "left", "localize": False,
        "anchor_from": "top_left", "anchor_to": "top_left", "offset": [COIN + 3, 0], "size": [80, "default"],
        "bindings": [rview(RON, "#visible"), rview(RTEXT, "#text")]}},
]

ui = {
    "namespace": "hud",
    "hc_regals": {
        "type": "panel",
        "controls": [{"hc_regals_box": {
            "type": "panel", "size": [92, 10],
            "anchor_from": "bottom_middle", "anchor_to": "bottom_left", "offset": [HOTBAR // 2 + 5, -6],
            "controls": regals}}],
    },
    "hc_quests": {
        "type": "panel",
        "controls": [{"hc_quests_box": {
            "type": "panel", "size": [QW, 200],
            "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-4, 3],
            "controls": quests}}],
    },
    "hc_minimap": {
        "type": "panel",
        "controls": [{"hc_minimap_box": {
            "type": "panel", "size": [MAP + 2 * RIM, MAP + 2 * RIM + 12],
            "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-3, 3],
            "controls": box}}],
    },
    "root_panel": {"modifications": [
        {"array_name": "controls", "operation": "insert_front", "value": {"hc_minimap@hud.hc_minimap": {}}},
        {"array_name": "controls", "operation": "insert_front", "value": {"hc_quests@hud.hc_quests": {}}},
        {"array_name": "controls", "operation": "insert_front", "value": {"hc_regals@hud.hc_regals": {}}},
    ]},
    # the vanilla title box stays hidden while the title is one of ours
    "hud_title_text": {"bindings": [
        {"binding_name": "#hud_title_text_string", "binding_type": "global"},
        {"binding_type": "view", "target_property_name": "#visible",
         "source_property_name": f"(((#hud_title_text_string - '{KEY}') = #hud_title_text_string) and ((#hud_title_text_string - '{QKEY}') = #hud_title_text_string) and ((#hud_title_text_string - '{RKEY}') = #hud_title_text_string))"},
    ]},
}

# the boss health bars live in this file too (tools/bossbar_ui.py draws them and says how they work)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bossbar_ui
ui.update(bossbar_ui.entries())

# hearts, armour, hunger and air rows sit on the hotbar now the XP bar is hidden (tools/hud_rows_ui.py says how)
import hud_rows_ui
ui.update(hud_rows_ui.entries())

with open(OUT, "w") as f:
    f.write(json.dumps(ui, indent=2) + "\n")
print("wrote", os.path.relpath(OUT, ROOT))
