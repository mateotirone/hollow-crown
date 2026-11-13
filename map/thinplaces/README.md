# The land at the seven thin places

Mateo (2026-11-12): "it's designing the actual map itself". Each thin place is a whole place on the real map, not a
cave dropped on a hill. `map/genworld.py` shapes the land here once its heights and water are settled; the add-on
then builds each cave into that land.

| File | What it does |
|---|---|
| `shape.mjs` | The seven shapes, in each site's local frame (u right of the mouth, v out of it): heights, water, surface and face blocks, set pieces (stones, stacks, the cliff stair, the boardwalk). |
| `shape_grid.mjs` | Runs one shape over a square of the real map: blends it back into the map by 96 blocks, keeps roads and rivers, floods nothing, picks the probes. |
| `shape_cli.mjs` | The same, as a command for Python (JSON in, JSON out). |
| `land.py` | Called by `genworld.py` (`shape_sites`). Run alone to check a change without writing a world. |
| `test_shapes.mjs` | Run by `node tools/check.mjs`: every place holds its water on level, sloping and rolling ground. |

## Rules the shapes keep

- **Water stays where it is put.** No dry column may lie under the water beside it: in the game that water pours out
  the first time a block changes. A place's water lies at or under the ground round it (the Witchroot hollow takes
  the lowest ground on its rim; the barrow's ditch has a bank; the quarry's flooded end is cut deeper than its floor).
- **The cave floor is never under water that stands near the mouth.** `floor` is the ground outside the mouth.
- **Paths are walkable and open to the sky.** The chapel's cliff stair cuts each flight further back than the one
  below it, so no flight runs under another. The quarry's ramp reaches the floor by a haul road cut across the benches.
- **Roads and rivers keep their own ground** (a river keeps its whole valley). Trails ride the new land.
- **Fen pools near a place are filled in** (they are pits with water far below the fen).

## Checking a change

```
node map/thinplaces/test_shapes.mjs
python3 map/thinplaces/land.py HEIGHTS.npy WATER.npy --js Siege_Nights_BP/scripts/undertow/thin_land.js
```

`HEIGHTS.npy` / `WATER.npy` are genworld's `-heights-pretown.npy` and `-water.npy` from a run made WITHOUT this
step's changes applied twice (use an unshaped run, or the shapes stack). `--js` rewrites the add-on's copy of the
facts: the ground height outside each mouth and five probe columns. The game builds on the shaped land only where
it finds those probes (`thinplaces.js` `landOf`), so an older world still gets the old outcrop.

When the full map is generated, set `GW_THIN_JS=Siege_Nights_BP/scripts/undertow/thin_land.js` so the generator
refreshes that file from the heights it really wrote, and commit it with the new world.

The 3D view (https://claude.ai/artifact/6ZakAdwcfFErttCM1V2xs7) is built from `land.py --save`, so it shows what
the generator will write. Its sources are in `/mnt/project-files/rift/viewer-src/`.
