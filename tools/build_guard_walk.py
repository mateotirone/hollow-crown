#!/usr/bin/env python3
"""Lets guards walk to their posts (tools/build_guard_walk.py). Run from the repo root; safe to run again.

Bedrock has no "walk to this spot" for scripts, so a guard walks by chasing a hidden marker entity
(siege:post_marker) that scripts/guardposts/walk.js keeps a little way ahead of it on the way to its post.
Each walking guard gets one of WALK_SLOTS numbered walk groups; the group makes it target only the marker
tagged siege_mark_<n> (it can't be hurt), so two guards never chase each other's markers.

  Archer: shooting moves into the group "siege:fight" (added on spawn, and by the script for archers from older
          worlds), so a walking archer doesn't shoot its marker. When an enemy shows up the script puts "siege:fight"
          back at once and the archer shoots from where it stands, then walks on.
  Man-at-Arms: keeps its sword; its enemy targeting (priority 1) wins over the marker (priority 3), so it fights
          whatever it meets on the way and then carries on.
  Both: follow_range 48 so they can path far enough to reach the marker.

Writes Siege_Nights_BP/entities/post_marker.json and Siege_Nights_RP/entity/post_marker.entity.json too.
"""
import json, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
BP = os.path.join(ROOT, "Siege_Nights_BP")
RP = os.path.join(ROOT, "Siege_Nights_RP")
WALK_SLOTS = 24  # keep in step with WALK.slots in scripts/guardposts/walk.js


def walk_group(n, archer):
    g = {
        "minecraft:behavior.nearest_prioritized_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 64,
            "entity_types": [{"filters": {"test": "has_tag", "subject": "other", "value": f"siege_mark_{n}"}, "max_dist": 64, "priority": 0}],
        },
    }
    if archer:
        g["minecraft:attack"] = {"damage": 0}
        g["minecraft:behavior.melee_attack"] = {"priority": 2, "speed_multiplier": 1.1, "track_target": True}
    return g


def patch(name, archer):
    path = os.path.join(BP, "entities", f"{name}.json")
    with open(path) as f:
        data = json.load(f)
    e = data["minecraft:entity"]
    comps, groups, events = e["components"], e.setdefault("component_groups", {}), e.setdefault("events", {})
    comps["minecraft:follow_range"] = {"value": 48, "max": 48}
    for k in [k for k in groups if k.startswith("siege:walk_")]:
        del groups[k]
    walks = [f"siege:walk_{n}" for n in range(WALK_SLOTS)]
    if archer:
        fight = groups.get("siege:fight", {})
        for c in ("minecraft:shooter", "minecraft:behavior.ranged_attack"):
            if c in comps:
                fight[c] = comps.pop(c)
        groups["siege:fight"] = fight
    for n in range(WALK_SLOTS):
        groups[f"siege:walk_{n}"] = walk_group(n, archer)
    for k in [k for k in events if k.startswith("siege:walk_")]:
        del events[k]
    for n in range(WALK_SLOTS):
        ev = {"remove": {"component_groups": [w for w in walks if w != walks[n]] + (["siege:fight"] if archer else [])},
              "add": {"component_groups": [walks[n]]}}
        events[f"siege:walk_{n}"] = ev
    events["siege:fight"] = {"remove": {"component_groups": walks}, **({"add": {"component_groups": ["siege:fight"]}} if archer else {})}
    if archer:
        spawned = events.setdefault("minecraft:entity_spawned", {})
        add = spawned.setdefault("add", {}).setdefault("component_groups", [])
        if "siege:fight" not in add:
            add.append("siege:fight")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("wrote", os.path.relpath(path, ROOT))


MARKER_BP = {
    "format_version": "1.21.60",
    "minecraft:entity": {
        "description": {"identifier": "siege:post_marker", "is_spawnable": False, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["siege_post_marker", "inanimate"]},
            "minecraft:health": {"value": 20, "max": 20},
            "minecraft:collision_box": {"width": 0.2, "height": 0.2},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:movement": {"value": 0},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"breathes_solids": True, "suffocate_time": 0, "total_supply": 15},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        },
    },
}
MARKER_RP = {
    "format_version": "1.10.0",
    "minecraft:client_entity": {"description": {
        "identifier": "siege:post_marker", "materials": {"default": "entity_alphatest"},
        "textures": {"default": "textures/entity/siege_invisible"}, "geometry": {"default": "geometry.siege_invisible"},
        "render_controllers": ["controller.render.default"],
    }},
}

if __name__ == "__main__":
    patch("archer", True)
    patch("man_at_arms", False)
    patch("crossbowman", True)  # shoots like the archer
    for name in ("pikeman", "shieldbearer", "knight", "ram_crew", "trebuchet_crew", "sapper"):
        patch(name, False)
    for path, data in ((os.path.join(BP, "entities", "post_marker.json"), MARKER_BP), (os.path.join(RP, "entity", "post_marker.entity.json"), MARKER_RP)):
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print("wrote", os.path.relpath(path, ROOT))
