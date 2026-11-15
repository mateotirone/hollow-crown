# Town Upgrade Simulator

A one-file 3D page that founds a settlement plot as a Hamlet and grows it to a Castle, block by block, with real
block shapes and Mojang textures: groundwork per tier, plot buildings (click a plot), town hall levels 1-5, wall
levels 1-10 on every ring, and the station from Halt to Grand Station. Published page (Oakmere):
https://claude.ai/artifact/HhZrXjUXfHHRXn8R4S3zKG

Everything comes from the add-on's own code, loaded in Node with `tools/mock-minecraft.mjs`, so the page changes
when the game does: rerun the three steps after a layout, design, hall, wall or station change.

    node studio/town_sim/dump.mjs [plot=oakmere] [layout=0]                   # -> out/sim.json
    python3 studio/town_sim/mesh.py studio/town_sim/out/sim.json <bedrock-samples>/resource_pack/textures/blocks studio/town_sim/out/lib.json
    python3 studio/town_sim/mkpage.py studio/town_sim/out/sim.json studio/town_sim/out/lib.json <page.html>

For the page with every plot (the picker), run dump.mjs and mesh.py once per plot into `<dir>/<plot>/sim.json` and
`<dir>/<plot>/lib.json`, then `mkpage.py <home sim.json> <home lib.json> <page.html> <dir>`: it writes `plots/<id>.txt`
next to the page, to publish with it. Map plots are founded as their starter village (the layout's `start` slots
stand from the start, the one tagged `founder` is your house, and the wall follows the town's `outline`).

- `dump.mjs` reads the map's pre-town heights (`HEIGHTS`, default the project file `hollow-crown-full-map-heights-pretown.npy`)
  and plays the founding the way `founding.js` does it: wall level 1, groundwork, blendGround, the gate road, fixtures,
  plot markers, the hall from its cornerstone, the library, Mason's Yard and founder's cottage, then each tier's ring
  and band. Plans go through `buildOrder` and `resolveRole`, walls through `wallColumns` / `columnKinds` / `permFor`,
  stations through `stationPlan`. Block states are checked against `map/structures/bedrock_states.json`, so a
  spelling the game refuses is refused here too.
- `mesh.py` meshes every block with the catalogue's mesher (`map/structures/render/mesher.py`) and grows the
  layout's trees and the forest round the plot with `map/trees/grow.py`.
- The page ships `settle/charters.js` and the plot rules from `settle/config.js` as their own source: plot menus,
  "kept for the charter", the charter lines and the auto-builder (`lordPick`, the Rival Lords' picker) are the game's.

Not modelled in the building part: siege wins (growing is by button, or "Grow anyway" to skip a charter), prices
beyond the menu figure, NPCs, the Works plots' machines, and the map's own roads (the gate road runs to the station
instead).

## Siege night

The Siege night card plays a real siege on the town as it stands in the page. Nothing in it is a copy of a rule:

- `siege/build.mjs` bundles the add-on's own scripts (`Siege_Nights_BP/scripts/main.js` and all it imports) into one
  file, and packs the behaviour pack's blocks and entities and the resource pack's client entities, models,
  animations, controllers and textures. Run it again after any change to the add-on and the page plays the new code.
- `siege/engine.mjs` is a small Minecraft the scripts run in unchanged: `@minecraft/server` 2.x over the page's block
  world, with timers, events, dynamic properties, scoreboards, commands and forms. `siege/ai.mjs` gives every
  creature its body and its goals from the pack's entity files (health, speed, attack, families, target filters and
  ranges, melee and ranged attacks, damage sensors, events, component groups).
- `siege/setup.mjs` stands the settlement up the way the game saves it (Keep Banner, town record, wall record,
  watchtowers, Barracks, soldiers enlisted and posted, ballistas), with the game's own functions, like
  `/scriptevent siege:battle_test` does. `siege/night.mjs` runs the night in the page and `siege/models.mjs` draws
  the creatures from the resource pack.

So who comes, when and where, the war plan, wall damage and collapse, rams, sappers and their charges, ballistas,
guard posts and leashes, the Keep's health, win and loss are the game's. What Minecraft itself does is ours, written
to its rules, and can differ from the real thing in small ways: walking and path-finding (A* over the real blocks:
gates, doors, steps, drops; ladders only for creatures that can climb), hit timing, arrow flight, knockback. Not
drawn: items held in hands, the game's particles (shown as puffs) and sounds. The Keep Banner is stood by the Plot
Stone, since a player sets it where they like. A block the game sets that the town never had (the Emberwaste dragon
nest, say) is drawn as the nearest block the page has a picture of.

    node studio/town_sim/siege/build.mjs                       # -> out/siege/ (needs `npm ci` in tools/ once, for esbuild)
    python3 studio/town_sim/mkpage.py <sim.json> <lib.json> <page.html> <plots dir or -> studio/town_sim/out/siege

`mkpage.py` copies the four siege files to `siege/` next to the page (publish them with it). The night is seeded
(the Dice box): the same town, garrison and dice play the same night. Ending the night puts every block back.
The command box sends `/scriptevent …` and other commands to the running game.
