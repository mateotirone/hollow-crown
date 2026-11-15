# World snapshot: update a played world instead of starting fresh

Mateo, 2026-11-15: before an update ships, take a complete snapshot of everyone and everything in the world (map
and buildings, where everyone is in the story, Regals, what's in chests, everything), and build the next playtest
on that world.

Bedrock scripts can't write files, so the snapshot is taken from the downloaded world itself.

## 1. In game (optional): save the latest

Run this as an operator, cheats not needed. It saves every online player's name, Regals, settlement and story steps
into the world at once and shows in chat what the report will say. (The add-on also saves this every two minutes
and whenever someone joins or leaves, so it is optional.)

```
/siege:snapshot
```

## 2. Download the Realm world and hand it over

1. In Minecraft: **Play**, **Realms**, the pencil next to the Realm, then **Download World** (on the Game page of the
   Realm settings). A copy appears in your Worlds list.
2. On that copy: the pencil, then **Game Settings**, scroll to the bottom, **Export World**. Save the `.mcworld` file.
3. Upload the file in the project chat.

Nobody should play on the Realm between the download and the upload of the updated world, or that play is lost.

## 3. The report (Claude does this)

```
python3 tools/world_snapshot.py THE-UPLOAD --base /mnt/project-files/siege-nights/hollow-crown-playtest.mcworld
```

`--base` is the world the Realm started from, so the report can list every block that changed. Leave it out for
everything else only. Writes `REPORT.md` (readable), `snapshot.json` (everything, machine-readable) and, with
`--base`, `blocks-changed.json.gz`:

- the world: day and time, game mode, difficulty, spawn, game rules, packs and their versions, the size of the map
- every player: name, Regals, mode, settlement and its level, the story steps on their tracker, last seen, place,
  health, hunger, XP, respawn point, inventory, armour, off hand, ender chest, tags, and everything the add-on
  saved on them (lore progress, starter kit, codex, Hollow trips ...)
- every settlement: owner, sieges held, warlords slain
- every chest, barrel, furnace, shulker box and other container with what is in it (shulkers opened up), every
  sign's writing, every lectern's book
- every creature, NPC, guard, horse and dragon by kind and place, named ones listed
- every saved data store of the add-on, decoded (siege state, economy, towns, story, Town Board, horses ...)
- the scoreboard, and the add-on's own blocks on the map by kind and place
- with `--base`: every block placed or removed, by area, with the nearest town or plot

Player names: Bedrock doesn't save names in the world. The add-on's roster (`siege:snapshot_roster`, in
`Siege_Nights_BP/scripts/snapshot/index.js`) does, so a world saved by any build with the roster names everyone,
offline players too. An older world shows players by id until they join once on a newer build.

## 4. The next playtest on that world

```
python3 tools/build.py
```

```
python3 tools/repack_world.py THE-UPLOAD --report
```

This swaps in the new build's packs and keeps everything else byte for byte (level.dat, every chunk, every player
save). Hand the `.mcworld` back. Mateo opens it on his device (it imports into the Worlds list), then in the Realm
settings: **Replace World**, and picks it.

Data shape changes still need an upgrade step in the add-on (core/store.js `version` and `upgrade`), so a new build
reads an old save.

Test: `python3 tools/world_snapshot_test.py` prints WORLD SNAPSHOT OK.
