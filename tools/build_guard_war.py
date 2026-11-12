#!/usr/bin/env python3
"""Lets guards fight each other in a War Writ siege (tools/build_guard_war.py). Run from the repo root; safe to run again.

Guards normally only attack monsters and players tagged siege_wanted. In a War Writ siege (scripts/warwrit/) each side
is tagged for that writ's slot: siege_w<n>_a (the attackers: their players and marching soldiers) and siege_w<n>_b
(the defenders: their players and guards). A guard tagged with one side attacks anything tagged with the other.
WAR_SLOTS writs can run at once; keep in step with WAR_SLOTS in scripts/warwrit/army.js.
Also: guards avoid water when they path (they swim only when nothing else reaches).
"""
import json, os, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
BP = os.path.join(ROOT, "Siege_Nights_BP")
WAR_SLOTS = 4


def team_filters():
    out = []
    for n in range(WAR_SLOTS):
        for me, foe in (("a", "b"), ("b", "a")):
            out.append({"all_of": [
                {"test": "has_tag", "subject": "self", "value": f"siege_w{n}_{me}"},
                {"test": "has_tag", "subject": "other", "value": f"siege_w{n}_{foe}"},
            ]})
    return out


def patch(name):
    path = os.path.join(BP, "entities", f"{name}.json")
    if not os.path.exists(path):
        return print(f"{name}: no entity yet, skipped")
    data = json.load(open(path, encoding="utf8"))
    comps = data["minecraft:entity"]["components"]
    target = comps["minecraft:behavior.nearest_attackable_target"]
    for entry in target["entity_types"]:
        any_of = entry["filters"]["any_of"]
        any_of[:] = [f for f in any_of if not (isinstance(f, dict) and "all_of" in f and any(t.get("value", "").startswith("siege_w") for t in f["all_of"]))]
        any_of.extend(team_filters())
    comps["minecraft:navigation.walk"]["avoid_water"] = True
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"{name}: {WAR_SLOTS} war slots")


# every soldier type (the new ones are made by the soldiers art thread; missing files are skipped)
for n in ("man_at_arms", "archer", "pikeman", "shieldbearer", "crossbowman", "knight", "ram_crew", "trebuchet_crew", "sapper"):
    patch(n)
