"""Story places the storyline needs indoors (storyline audit, Mateo 2026-11-12: "ask the building threads to
make it"): Rimehold's net sheds by Hallowmere, Sunscar's warden's office and Millbrook's bakery. Each is a spec
in story_specs/ built by the minecraft-builder skill's engine; the towns place them like civic buildings
(towngen_regions CIVIC / towngen SITES civic), the net sheds on the street nearest the lake.
"""
import harbour

DOORS = {"net_sheds": (0, 7), "warden_office": (0, 6), "bakery": (0, 6)}
NEAR = {"net sheds": (60, -1130)}            # Hallowmere's middle (map/draw_map.py lakes)

def build(name):
    return harbour.skill_build(name, DOORS[name], folder="story_specs")
