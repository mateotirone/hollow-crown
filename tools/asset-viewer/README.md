# Live asset viewer

Every build and every 3D model of the add-on in one browser page, kept up to date by itself.

**Start it:** double-click `start-viewer.command` (Mac) or `start-viewer.bat` (Windows), or run
`node tools/asset-viewer/serve.mjs`. Your browser opens <http://localhost:4747>. Leave the window open.

## What it shows

| Tab | What | Where it comes from |
| --- | --- | --- |
| Builds | Every catalogue build in 3D: map towns, every settlement building and hall tier per region, stations, walls, the Hollow, the Citadel | `map/structures/build_full_catalogue.py --viewer3d`, built on every branch that has it and merged (newest branch wins per build) |
| Mobs & NPCs | Every client entity (bestiary, bosses, NPCs, steeds, dragons, engines, trains) with each texture and shape | `Siege_Nights_RP/entity`, `models`, `textures` |
| Armour & worn | Every attachable set on a mannequin (3D armour, guard sets, Choirsteel, mantles) | `Siege_Nights_RP/attachables` |
| Blocks | Every custom block with its shape and textures | `Siege_Nights_BP/blocks`, `terrain_texture.json`, `blocks.json` |
| Item icons, All textures | Every icon and every texture file, by folder | `item_texture.json`, `Siege_Nights_RP/textures` |

Anything marked **new** (orange) is on a branch that is not merged yet; the info line names the branch and
its last commit. Switch to "Only what is merged" at the top to see main alone.

## How it stays live

It never changes your checkout. Every minute it runs `git fetch`, then reads the packs straight from git:
main, then every unmerged branch from the last 30 days on top, newest change winning per file. When a
thread pushes, the Models tabs reload within a minute, and the Builds tab rebuilds that branch (about
20 s) and reloads. "Check now" fetches straight away.

New asset kinds show up by themselves as long as they live in the packs. Builds also takes in other 3D
builders: `EXTRAS` in `serve.mjs` runs a script on a catalogue branch (the trees, `map/trees/build_trees.py`),
and `IMPORTS` copies scripts from a branch without the kit into the newest catalogue branch and runs them
there (the build-instruction test houses). Every `scene.json` a builder leaves becomes a build; their
render and screenshot calls are skipped (`run_scenes.py`), and `mesh_scenes.py` meshes the scenes.

## What it needs

- git and Node.js 18 or newer.
- For the Builds tab: Python 3. On the first run it makes a private Python environment with Pillow and numpy,
  downloads Mojang's block textures and vanilla models (about 25 MB, from `Mojang/bedrock-samples`) and
  three.js. All of that lives in `.asset-viewer/` at the repo root (ignored by git); delete the folder to
  start fresh.

Options: `--port N`, `--main-only`, `--every SECONDS`, `--no-fetch`, `--no-open`.
