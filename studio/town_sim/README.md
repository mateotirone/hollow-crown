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

Not modelled: siege wins (growing is by button, or "Grow anyway" to skip a charter), prices beyond the menu figure,
NPCs, the Works plots' machines, and the map's own roads (the gate road runs to the station instead).

## Siege night

`siege_night.mjs` plays siege nights through the game's own siege code: `startSiege`/`spawnAssault`, `planSiege`/`buyArmy`, the reach feature's waves, the bestiary's creature swaps and the wall's spawn distance. The fake Minecraft gets one player on the Plot Stone, a Keep Banner, the town's wall record, villagers (one per charter home) and ballistas from a defence preset. Every spawned creature is recorded. Math.random is seeded, which gives 144 fixed nights: siege 1–12 × the four sizes × three defence presets. The page's Siege night card plays one at game pace. The first wave comes 5 s after the horn and the rest 30 s apart. Raiders march to the wall, and rams go round it to the gate.
