#!/usr/bin/env python3
"""Test for tools/world_snapshot.py on a tiny made-up world: a level.dat and one LevelDB log holding what a played
Realm world holds (the add-on's saved stores, a player with an inventory and their own saved properties, an entity
placed by its chunk list, a chest). Run: python3 tools/world_snapshot_test.py   (prints WORLD SNAPSHOT OK)"""
import json, os, struct, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_snapshot as ws  # noqa: E402


# --- a little-endian NBT writer, just for the test
def s(x):
    b = x.encode(); return struct.pack("<H", len(b)) + b


def tag(v):
    if isinstance(v, bool) or (isinstance(v, tuple) and v[0] == "b"): return 1, struct.pack("<b", v[1] if isinstance(v, tuple) else int(v))
    if isinstance(v, tuple) and v[0] == "s": return 2, struct.pack("<h", v[1])
    if isinstance(v, tuple) and v[0] == "l": return 4, struct.pack("<q", v[1])
    if isinstance(v, int): return 3, struct.pack("<i", v)
    if isinstance(v, float): return 5, struct.pack("<f", v)
    if isinstance(v, str): return 8, s(v)
    if isinstance(v, list):
        if not v: return 9, bytes([10]) + struct.pack("<i", 0)
        t = tag(v[0])[0]
        return 9, bytes([t]) + struct.pack("<i", len(v)) + b"".join(tag(x)[1] for x in v)
    if isinstance(v, dict):
        out = b""
        for k, x in v.items():
            t, body = tag(x); out += bytes([t]) + s(k) + body
        return 10, out + b"\x00"
    raise TypeError(v)


def root(v):
    t, body = tag(v); return bytes([t]) + s("") + body


def varint(n):
    out = b""
    while True:
        b = n & 0x7f; n >>= 7
        if n: out += bytes([b | 0x80])
        else: return out + bytes([b])


def log(entries):
    batch = struct.pack("<QI", 1, len(entries))
    for k, v in entries: batch += b"\x01" + varint(len(k)) + k + varint(len(v)) + v
    assert len(batch) < 32000
    return struct.pack("<IHB", 0, len(batch), 1) + batch


def main():
    pid = 4294967297
    stores = {"siege:economy_banks": json.dumps({"of": {str(pid): 345}}),
              "siege:state": json.dumps({"keeps": {str(pid): {"name": "Wrenfield", "wins": 2, "center": {"x": -200, "y": 70, "z": 220}}}}),
              ws.ROSTER: json.dumps({"players": {str(pid): {"name": "Mateo", "steps": ["Talk to Old Elspeth about the wall"], "mode": "Story Mode",
                                                           "settlement": "Wrenfield (Hamlet)", "seen": "day 5"}}})}
    player = {"UniqueID": ("l", pid), "Pos": [-190.5, 71.0, 225.5], "DimensionId": 0, "PlayerGameMode": 0, "PlayerLevel": 3,
              "Attributes": [{"Name": "minecraft:health", "Current": 18.0}],
              "Inventory": [{"Name": "minecraft:bread", "Count": ("b", 7), "Slot": ("b", 0), "Damage": ("s", 0)},
                            {"Name": "siege:lore_tome", "Count": ("b", 1), "Slot": ("b", 1), "Damage": ("s", 0),
                             "tag": {"display": {"Name": "The Long Winter"}}}],
              "EnderChestInventory": [], "Armor": [], "Offhand": [],
              "DynamicProperties": {"4009658f-d02c-499a-8280-80fb76713ee9": {"hc:lore_progress": json.dumps({"flags": ["wren_met"]})}}}
    actor_id = struct.pack("<q", 99)
    npc = {"identifier": "minecraft:npc", "Pos": [-201.0, 70.0, 219.0], "CustomName": "Old Elspeth", "UniqueID": ("l", 99)}
    chest = {"id": "Chest", "x": -195, "y": 70, "z": 222, "Items": [{"Name": "minecraft:iron_ingot", "Count": ("b", 12), "Slot": ("b", 0), "Damage": ("s", 0)}]}
    cx, cz = -195 >> 4, 222 >> 4
    entries = [(b"DynamicProperties", root({"4009658f-d02c-499a-8280-80fb76713ee9": stores})),
               (b"player_server_abc", root(player)),
               (b"actorprefix" + actor_id, root(npc)),
               (b"digp" + struct.pack("<ii", cx, cz), actor_id),
               (struct.pack("<ii", cx, cz) + bytes([49]), root(chest)),
               (b"scoreboard", root({"Objectives": [], "Entries": []}))]
    with tempfile.TemporaryDirectory() as t:
        os.makedirs(os.path.join(t, "db"))
        open(os.path.join(t, "db", "000001.log"), "wb").write(log(entries))
        lvl = root({"LevelName": "Test Realm", "Time": ("l", 24000 * 4 + 6000), "GameType": 0, "Difficulty": 2, "SpawnX": -754, "SpawnY": 283, "SpawnZ": 26})
        open(os.path.join(t, "level.dat"), "wb").write(struct.pack("<ii", 10, len(lvl)) + lvl)
        snap = ws.snapshot(t)
        text = ws.report(snap)
    bad = []
    def check(c, what):
        if not c: bad.append(what)
    check(snap["stores"].get("siege:economy_banks") == {"of": {str(pid): 345}}, "world store decoded")
    p = snap["players"][0] if snap["players"] else {}
    check(p.get("name") == "Mateo" and p.get("id") == str(pid), "player named from the roster")
    check(p.get("dynamic_properties", {}).get("hc:lore_progress") == {"flags": ["wren_met"]}, "player's own properties decoded")
    check([e["count"] for e in p.get("inventory", [])] == [7, 1], "inventory read")
    check(snap["entities"] and snap["entities"][0]["name"] == "Old Elspeth" and snap["entities"][0]["dimension"] == "Overworld", "entity read and placed")
    check(snap["block_entities"] and snap["block_entities"][0]["items"][0]["count"] == 12, "chest read")
    for line in ("Regals: 345", "Talk to Old Elspeth about the wall", "Day 5", "iron_ingot x12", '"The Long Winter"', "**Wrenfield**", "Old Elspeth (minecraft:npc)"):
        check(line in text, f"report says {line!r}")
    if bad:
        print("WORLD SNAPSHOT FAILED:\n  " + "\n  ".join(bad)); print(text); sys.exit(1)
    print("WORLD SNAPSHOT OK")


if __name__ == "__main__":
    main()
