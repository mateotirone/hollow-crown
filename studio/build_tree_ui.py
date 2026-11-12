#!/usr/bin/env python3
"""Builds the graphical Tree of Oaths screen for the resource pack.

  ui/server_form.json                 draws any form whose title carries the tree flag as a 6 x 6 grid of nodes
  textures/ui/hc/tree_<branch>.png    ring bands and the connector lines behind the nodes

The layout comes from scripts/townhall/tree_layout.js (run through studio/townhall_preview/dumplayout.mjs), so
rerun this whenever skills are added or moved:   python3 studio/build_tree_ui.py
Node frames (node_*.png), panel.png and slot.png are the textures thread's (studio/art/build_ui.py).

The Plan Book screen (scripts/settle/planbook.js): forms whose title carries PLAN_FLAG show a grid of building cards,
one form button per card; the cards are studio/build_plans.py's.

It also draws the Hall Map (scripts/townhall/hallmap.js): forms whose title carries MAP_FLAG show the painted realm
with a 16 x 16 grid of cells over it, one form button per cell. Its art comes from studio/build_hallmap.py.
"""
import json, os, subprocess
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "Siege_Nights_RP")
CELL_W, CELL_H = 52, 29            # one grid cell, in UI pixels
FLAG = "§h§c"
MAP_FLAG = "§h§m"                  # hallmap.js MAP_FLAG
MAP_GRID, MAP_CELL = 16, 12        # hallmap.js GRID; UI pixels per cell
MAP_W = MAP_GRID * MAP_CELL
PLAN_FLAG = "§h§p"                 # settle/planbook.js PLAN_FLAG
PLAN_COLS = 5                      # planbook.js PLAN_COLS; one card per pre-designed building, then the "copy" card
PLAN_N = 1 + int(subprocess.check_output(["node", "-e", 'import("./Siege_Nights_BP/scripts/settle/buildings.js").then((m) => console.log(m.BUILDINGS.length))'], cwd=ROOT))
PLAN_ROWS = -(-PLAN_N // PLAN_COLS)
PCARD_W, PCARD_H, PCELL_W, PCELL_H = 46, 36, 52, 54   # card picture (studio/build_plans.py) and one grid cell
PLAN_W, PLAN_H = PLAN_COLS * PCELL_W, PLAN_ROWS * PCELL_H
BRANCH = {"keep": "§1", "wayfarer": "§2", "blade": "§3", "arcana": "§4", "wing": "§5", "forge": "§6", "helm": "§7", "hex": "§8"}
TINT = {"keep": (127, 178, 217), "wayfarer": (143, 201, 138), "blade": (217, 121, 106), "arcana": (180, 140, 240),
        "wing": (232, 140, 80), "forge": (150, 200, 225), "helm": (90, 170, 190), "hex": (120, 190, 110)}

layout = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "studio/townhall_preview/dumplayout.mjs")]))
COLS, ROWS = layout["COLS"], layout["ROWS"]
W, H = COLS * CELL_W, ROWS * CELL_H
S = 2  # art is drawn at twice the UI size so lines stay crisp

def backdrop(branch):
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = TINT[branch]
    for r in range(5):
        d.rectangle([2 * S, (r * CELL_H + 1) * S, (W - 2) * S, ((r + 1) * CELL_H - 1) * S], fill=(t[0], t[1], t[2], 22 if r % 2 == 0 else 12))
    cx = lambda c: (c * CELL_W + CELL_W // 2) * S
    for n in layout["branches"][branch]:
        if not n["needs"]: continue
        a, b = n["needs"], n
        y0 = (a["row"] * CELL_H + 22) * S; y1 = (b["row"] * CELL_H + 1) * S; ym = (b["row"] * CELL_H - 1) * S
        for seg in ([cx(a["col"]), y0, cx(a["col"]), ym], [cx(a["col"]), ym, cx(b["col"]), ym], [cx(b["col"]), ym, cx(b["col"]), y1]):
            d.line(seg, fill=(t[0], t[1], t[2], 170), width=2 * S)
    return im

os.makedirs(os.path.join(RP, "textures/ui/hc"), exist_ok=True)
for b in BRANCH:
    backdrop(b).save(os.path.join(RP, f"textures/ui/hc/tree_{b}.png"))

has = lambda flag: f"(not ((#title_text - '{flag}') = #title_text))"
title_bindings = lambda expr: [{"binding_name": "#title_text"}, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]
cell = {"binding_type": "collection", "binding_collection_name": "form_buttons"}

ui = {
    "namespace": "server_form",
    # The stock long form, shown for every form without the flag, plus our tree for those with it.
    "long_form": {
        "type": "panel",
        "size": ["100%", "100%"],
        "controls": [
            {"long_form@common_dialogs.main_panel_no_buttons": {
                "$title_panel": "common_dialogs.standard_title_label",
                "$title_size": ["100% - 14px", 10],
                "size": [225, 200],
                "$text_name": "#title_text",
                "$title_text_binding_type": "none",
                "$child_control": "server_form.long_form_panel",
                "layer": 2,
                "bindings": title_bindings(f"(((#title_text - '{FLAG}') = #title_text) and ((#title_text - '{MAP_FLAG}') = #title_text) and ((#title_text - '{PLAN_FLAG}') = #title_text))"),
            }},
            {"hc_tree@server_form.hc_tree": {"layer": 2, "bindings": title_bindings(has(FLAG))}},
            {"hc_map@server_form.hc_map": {"layer": 2, "bindings": title_bindings(has(MAP_FLAG))}},
            {"hc_plans@server_form.hc_plans": {"layer": 2, "bindings": title_bindings(has(PLAN_FLAG))}},
        ],
    },
    "hc_tree": {
        "type": "panel",
        "size": [W + 16, H + 44],
        "controls": [
            {"hc_bg": {"type": "image", "texture": "textures/ui/hc/panel", "nineslice_size": 8, "size": ["100%", "100%"], "layer": 1}},
            {"hc_title": {"type": "label", "text": "#title_text", "color": [0.89, 0.73, 0.35], "shadow": True, "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 7], "layer": 3,
                          "bindings": [{"binding_name": "#title_text"}]}},
            {"hc_body": {"type": "label", "text": "#form_text", "font_size": "small", "color": [0.85, 0.83, 0.78], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 21], "size": [W, 10], "text_alignment": "center", "layer": 3,
                         "bindings": [{"binding_name": "#form_text"}]}},
            *[{f"hc_lines_{b}": {"type": "image", "texture": f"textures/ui/hc/tree_{b}", "size": [W, H], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 36], "layer": 2,
                                 "bindings": title_bindings(has(FLAG + f))}} for b, f in BRANCH.items()],
            {"hc_grid": {"type": "grid", "size": [W, H], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 36], "layer": 4,
                         "grid_dimensions": [COLS, ROWS], "grid_item_template": "server_form.hc_node", "grid_fill_direction": "horizontal", "grid_rescaling_type": "none",
                         "collection_name": "form_buttons",
                         "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#maximum_grid_items"}]}},
        ],
    },
    # One cell: a clickable slot, the node's state picture over it, its name under it. A cell whose text is "-" is empty.
    "hc_node": {
        "type": "panel",
        "size": [CELL_W, CELL_H],
        "bindings": [{**cell, "binding_name": "#form_button_text"},
                     {"binding_type": "view", "source_property_name": "(not (#form_button_text = '-'))", "target_property_name": "#visible"}],
        "controls": [
            {"form_button@common.button": {
                "$pressed_button_name": "button.form_button_click",
                "size": [22, 22], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 0], "layer": 1,
                "controls": [
                    {"default": {"type": "image", "texture": "textures/ui/hc/slot"}},
                    {"hover": {"type": "image", "texture": "textures/ui/hc/slot_hover"}},
                    {"pressed": {"type": "image", "texture": "textures/ui/hc/slot_hover"}},
                ],
                "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}],
            }},
            {"hc_state": {"type": "image", "size": [20, 20], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 1], "layer": 3,
                          "bindings": [{**cell, "binding_name": "#form_button_texture", "binding_name_override": "#texture"},
                                       {**cell, "binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system"}]}},
            {"hc_name": {"type": "label", "text": "#form_button_text", "font_scale_factor": 0.6, "color": [0.92, 0.9, 0.86], "shadow": True, "size": [CELL_W - 2, 8], "text_alignment": "center",
                         "anchor_from": "bottom_middle", "anchor_to": "bottom_middle", "offset": [0, 0], "layer": 3,
                         "bindings": [{**cell, "binding_name": "#form_button_text"}]}},
        ],
    },
    # The Hall Map: the realm, the cells over it, a title and a close button. No form button outside the grid.
    "hc_map": {
        "type": "panel",
        "size": [MAP_W + 16, MAP_W + 40],
        "controls": [
            {"hc_bg": {"type": "image", "texture": "textures/ui/hc/panel", "nineslice_size": 8, "size": ["100%", "100%"], "layer": 1}},
            {"hc_title": {"type": "label", "text": "#title_text", "color": [0.89, 0.73, 0.35], "shadow": True, "font_scale_factor": 0.8, "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 6], "size": [MAP_W - 20, 10], "text_alignment": "center", "layer": 3,
                          "bindings": [{"binding_name": "#title_text"}]}},
            {"hc_body": {"type": "label", "text": "#form_text", "font_scale_factor": 0.7, "color": [0.85, 0.83, 0.78], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 17], "size": [MAP_W, 8], "text_alignment": "center", "layer": 3,
                         "bindings": [{"binding_name": "#form_text"}]}},
            {"hc_close@common.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": [-3, 3], "layer": 5}},
            {"hc_realm": {"type": "image", "texture": "textures/ui/hc/map/realm", "size": [MAP_W, MAP_W], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 30], "layer": 2}},
            {"hc_cells": {"type": "grid", "size": [MAP_W, MAP_W], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 30], "layer": 4,
                          "grid_dimensions": [MAP_GRID, MAP_GRID], "grid_item_template": "server_form.hc_mcell", "grid_fill_direction": "horizontal", "grid_rescaling_type": "none",
                          "collection_name": "form_buttons",
                          "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#maximum_grid_items"}]}},
        ],
    },
    # One map cell: its picture (fog, open land or a mark), an invisible button over it, and the mark's name on hover.
    "hc_mcell": {
        "type": "panel",
        "size": [MAP_CELL, MAP_CELL],
        "controls": [
            {"hc_mpic": {"type": "image", "size": [MAP_CELL, MAP_CELL], "layer": 1,
                         "bindings": [{**cell, "binding_name": "#form_button_texture", "binding_name_override": "#texture"},
                                      {**cell, "binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system"}]}},
            {"form_button@common.button": {
                "$pressed_button_name": "button.form_button_click",
                "size": [MAP_CELL, MAP_CELL], "layer": 2,
                "controls": [
                    {"default": {"type": "panel"}},
                    {"hover": {"type": "panel", "controls": [
                        {"hc_frame": {"type": "image", "texture": "textures/ui/hc/map/hover", "size": [MAP_CELL, MAP_CELL], "layer": 1}},
                        {"hc_tip": {"type": "label", "text": "#form_button_text", "font_scale_factor": 0.7, "color": [1.0, 0.95, 0.82], "shadow": True,
                                    "anchor_from": "top_middle", "anchor_to": "bottom_middle", "offset": [0, -1], "size": ["default", 8], "layer": 30,
                                    "bindings": [{**cell, "binding_name": "#form_button_text"}]}},
                    ]}},
                    {"pressed": {"type": "image", "texture": "textures/ui/hc/map/hover"}},
                ],
                "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}],
            }},
        ],
    },
    # The Plan Book: a grid of building cards (bright: plan known; grey: not found yet), the name and a short line under each
    "hc_plans": {
        "type": "panel",
        "size": [PLAN_W + 16, PLAN_H + 50],
        "controls": [
            {"hc_bg": {"type": "image", "texture": "textures/ui/hc/panel", "nineslice_size": 8, "size": ["100%", "100%"], "layer": 1}},
            {"hc_title": {"type": "label", "text": "#title_text", "color": [0.89, 0.73, 0.35], "shadow": True, "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 6], "size": [PLAN_W - 20, 10], "text_alignment": "center", "layer": 3,
                          "bindings": [{"binding_name": "#title_text"}]}},
            {"hc_body": {"type": "label", "text": "#form_text", "font_scale_factor": 0.7, "color": [0.85, 0.83, 0.78], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 18], "size": [PLAN_W, 16], "text_alignment": "center", "layer": 3,
                         "bindings": [{"binding_name": "#form_text"}]}},
            {"hc_close@common.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": [-3, 3], "layer": 5}},
            {"hc_cards": {"type": "grid", "size": [PLAN_W, PLAN_H], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 40], "layer": 4,
                          "grid_dimensions": [PLAN_COLS, PLAN_ROWS], "grid_item_template": "server_form.hc_pcell", "grid_fill_direction": "horizontal", "grid_rescaling_type": "none",
                          "collection_name": "form_buttons",
                          "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#maximum_grid_items"}]}},
        ],
    },
    # One card: its picture, a button over it (a gold frame on hover), and its two lines of text under it. "-" is an empty cell.
    "hc_pcell": {
        "type": "panel",
        "size": [PCELL_W, PCELL_H],
        "bindings": [{**cell, "binding_name": "#form_button_text"},
                     {"binding_type": "view", "source_property_name": "(not (#form_button_text = '-'))", "target_property_name": "#visible"}],
        "controls": [
            {"hc_ppic": {"type": "image", "size": [PCARD_W, PCARD_H], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 1], "layer": 1,
                         "bindings": [{**cell, "binding_name": "#form_button_texture", "binding_name_override": "#texture"},
                                      {**cell, "binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system"}]}},
            {"form_button@common.button": {
                "$pressed_button_name": "button.form_button_click",
                "size": [PCARD_W, PCARD_H], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, 1], "layer": 2,
                "controls": [
                    {"default": {"type": "panel"}},
                    {"hover": {"type": "image", "texture": "textures/ui/hc/plans/hover", "nineslice_size": 3}},
                    {"pressed": {"type": "image", "texture": "textures/ui/hc/plans/hover", "nineslice_size": 3}},
                ],
                "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}],
            }},
            {"hc_pname": {"type": "label", "text": "#form_button_text", "font_scale_factor": 0.6, "color": [0.92, 0.9, 0.86], "shadow": True, "size": [PCELL_W - 2, 14], "text_alignment": "center",
                          "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, PCARD_H + 2], "layer": 3,
                          "bindings": [{**cell, "binding_name": "#form_button_text"}]}},
        ],
    },
}
os.makedirs(os.path.join(RP, "ui"), exist_ok=True)
with open(os.path.join(RP, "ui/server_form.json"), "w") as f:
    json.dump(ui, f, indent=2, ensure_ascii=False)
# the card hover frame: a gold edge, clear inside
hv = Image.new("RGBA", (12, 12), (0, 0, 0, 0)); ImageDraw.Draw(hv).rectangle([0, 0, 11, 11], outline=(232, 190, 90, 255), width=2)
os.makedirs(os.path.join(RP, "textures/ui/hc/plans"), exist_ok=True); hv.save(os.path.join(RP, "textures/ui/hc/plans/hover.png"))
print("plan book:", PLAN_W + 16, "x", PLAN_H + 50, "ui pixels,", PLAN_COLS, "x", PLAN_ROWS, "cards")
print("hall map:", MAP_W + 16, "x", MAP_W + 40, "ui pixels")
print("tree screen:", W + 16, "x", H + 44, "ui pixels;", ", ".join(f"tree_{b}.png" for b in BRANCH))
