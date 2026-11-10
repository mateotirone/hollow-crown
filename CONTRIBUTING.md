# Working in this repo

This repo is the home of The Hollow Crown, a Bedrock add-on that grew out of Siege Nights (folder names and the `siege:` namespace keep the old name).

## Layout

| Path | What it is |
|---|---|
| `Siege_Nights_BP/` | Behavior pack: blocks, entities, items, recipes, loot, scripts |
| `Siege_Nights_RP/` | Resource pack: models, textures, animations, text |
| `tools/` | Offline check (`check.mjs`) and the `.mcaddon` builder (`build.py`) |
| `studio/` | Generators for textures, models and bestiary files |
| `art/` | Style guide, reference art, backups of placeholder textures |
| `map/`, `lab/` | Map image and the wall-damage lab page |
| `archive/` | The original single-file `main.js` from before the module split |
| `docs/` | Links to the design docs, the update backlog, how releases work |
| `wiki/`, `lore-book/`, `design/`, `character-creator/` | Player wiki pages, the lore book, layout data and the character creator |

## Check and build

```
cd tools && npm install     # once
node tools/check.mjs        # must end with ALL OK
python3 tools/build.py      # writes hollow-crown.mcaddon (not committed)
```

In game, `/scriptevent siege:selftest` runs the self-tests (they also run at world load).

## Rules

1. `main` always passes `node tools/check.mjs`.
2. One branch and one pull request per piece of work. Keep a pull request to your own feature folder (`scripts/<feature>/` plus that feature's blocks, items, entities and textures).
3. Feature code imports from `scripts/siege/api.js` and `scripts/core/` only. Need something else from `siege/`? Ask for a hook, as described in `MODULES.md`.
4. Shared files many features touch (`scripts/main.js`, `manifest.json`, `texts/*.lang`, `terrain_texture.json`, `item_texture.json`, `blocks.json`, `TEXTURE-LIST.md`) get small, additive edits: add your lines, don't reorder or reformat. Rebase on `main` just before merging.
5. Generated files are committed along with the generator change that produced them.
6. Build output (`*.mcaddon`) and `node_modules/` stay out of git.
7. A pull request that changes what players see adds a line to `CHANGELOG.md` under "Unreleased". Planned work is listed in `docs/BACKLOG.md`. Versions and releases: `docs/RELEASING.md`.
8. Never rename or remove an id or saved property that may already be in a live world without a migration. See "Safe on an existing world" in `docs/RELEASING.md`.
