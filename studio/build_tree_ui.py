#!/usr/bin/env python3
"""Builds the graphical Tree of Oaths screen for the resource pack.

  ui/server_form.json                 draws any form whose title carries the tree flag as a 6 x 6 grid of nodes
  textures/ui/hc/tree_<branch>.png    ring bands and the connector lines behind the nodes

The layout comes from scripts/townhall/tree_layout.js (run through studio/townhall_preview/dumplayout.mjs), so
rerun this whenever skills are added or moved:   python3 studio/build_tree_ui.py
Node frames (node_*.png), panel.png and slot.png are the textures thread's (studio/art/build_ui.py).
"""
import json, os, subprocess
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "Siege_Nights_RP")
CELL_W, CELL_H = 52, 29            # one grid cell, in UI pixels
FLAG = "§h§c"
BRANCH = {"keep": "§1", "wayfarer": "§2", "blade": "§3", "arcana": "§4"}
TINT = {"keep": (127, 178, 217), "wayfarer": (143, 201, 138), "blade": (217, 121, 106), "arcana": (180, 140, 240)}

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
                "bindings": title_bindings(f"((#title_text - '{FLAG}') = #title_text)"),
            }},
            {"hc_tree@server_form.hc_tree": {"layer": 2, "bindings": title_bindings(has(FLAG))}},
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
}
os.makedirs(os.path.join(RP, "ui"), exist_ok=True)
with open(os.path.join(RP, "ui/server_form.json"), "w") as f:
    json.dump(ui, f, indent=2, ensure_ascii=False)
print("tree screen:", W + 16, "x", H + 44, "ui pixels;", ", ".join(f"tree_{b}.png" for b in BRANCH))
