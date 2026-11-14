"""Hearts, armour, hunger and air sit right on top of the hotbar (Mateo, 2026-11-14: "Why is this spacing weird").

    python3 tools/minimap_ui.py      (that script owns Siege_Nights_RP/ui/hud_screen.json and pulls entries() from here)

Why: we hide the vanilla XP bar (scripts/core/noxpbar.js, /hud hide progress_bar). Bedrock hides the bar but keeps
its strip, so a row of empty space was left between the hotbar and the hearts and hunger rows. The game has no
setting that closes it, so the resource pack moves the rows down by DROP pixels itself.

Riding: on a horse, donkey, mule, camel or one of our steeds the strip is still needed, because the jump bar (the
camel's dash bar) fills there while you hold jump. So while the game shows a mount's hearts the rows keep the
vanilla height, and the strip is the jump bar's. Everything else (on foot, in a boat, on a dragon) gets the low rows.

How: the two vanilla panels that place these rows (desktop/console and touch) are written out again here with the
same controls as vanilla, in two copies inside panels that show or hide on the mount-hearts bindings. Offsets are
copied from Mojang's bedrock-samples resource_pack/ui/hud_screen.json; only the y of each row changes.
"""

DROP = 7   # the empty XP strip under the rows: vanilla leaves 9 px between hearts and hotbar, this leaves 2 px

RIDING = "(#survival_horse_hearts or #creative_horse_hearts)"


def rows(width, drop):
    """The vanilla row renderers for a panel `width` wide, moved down by `drop` pixels."""
    def at(x, y, **extra):
        return {"offset": [x, y + drop], "anchor_from": "bottom_left", "anchor_to": "bottom_left", **extra}

    def vis(name):
        return {"bindings": [{"binding_name": name, "binding_name_override": "#visible"}]}

    return [
        {"heart_rend@hud.heart_renderer": at(-1, -40)},
        {"horse_heart_rend_0@hud.horse_heart_renderer": at(width, -56, **vis("#creative_horse_hearts"))},
        {"horse_heart_rend_1@hud.horse_heart_renderer": at(width, -50, **vis("#survival_horse_hearts"))},
        {"armor_rend@hud.armor_renderer": at(-1, -40)},
        {"hunger_rend@hud.hunger_renderer": at(width, -40)},
        {"bubbles_rend_0@hud.bubbles_renderer": at(width, -50, **vis("#is_not_riding_bubbles"))},
        {"bubbles_rend_1@hud.bubbles_renderer": at(width, -50, **vis("#is_riding_bubbles"))},
    ]


def layer(name, width, drop, show):
    """A full-size panel holding one copy of the rows, shown when the expression `show` is true."""
    return {name: {
        "type": "panel", "size": ["100%", "100%"],
        "controls": rows(width, drop),
        "bindings": [
            {"binding_name": "#survival_horse_hearts", "binding_type": "global"},
            {"binding_name": "#creative_horse_hearts", "binding_type": "global"},
            {"binding_type": "view", "source_property_name": show, "target_property_name": "#visible"},
        ],
    }}


def panel(width, visible_binding):
    return {
        "type": "panel",
        "anchor_from": "bottom_middle",
        "anchor_to": "bottom_middle",
        "size": [width, 50],
        "controls": [
            layer("hc_rows_low", width, DROP, f"(not {RIDING})"),
            layer("hc_rows_mounted", width, 0, RIDING),
            {"exp_rend@hud.exp_progress_bar_and_hotbar": {}},
        ],
        "bindings": [{"binding_name": visible_binding, "binding_name_override": "#visible", "binding_type": "global"}],
    }


def entries():
    """The hud_screen.json keys for the rows (merged in by tools/minimap_ui.py)."""
    return {
        "centered_gui_elements_at_bottom_middle": panel(180, "#hud_visible_centered"),
        "centered_gui_elements_at_bottom_middle_touch": panel(200, "#hud_visible_centered_touch"),
    }
