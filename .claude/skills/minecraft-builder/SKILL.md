---
name: minecraft-builder
description: Design and build Minecraft structures from a small JSON spec. Shapes as maths (sphere, egg, cylinder, cone, torus, arch, lathe, boxes) with add/subtract, plus building parts that follow The Hollow Crown's build-instructions (plinth, frame, jetties, doors, windows, shutters, arches, roofs, chimney). A script voxelizes, fits slabs and stairs, matches colours in OKLab, and writes a .mcfunction, a JSON summary and an isometric preview. Use for any Minecraft build, house, tower, dome, statue-like shape or palette question, and to recreate a building from a screenshot or photo.
---

# Minecraft builder

You never place blocks by eye. You write a short JSON spec; `scripts/build.py` does every block, colour
and command. You read only the printed summary (a few hundred bytes) and look at the preview PNG.
A 50,000-block castle costs about the same tokens as a hut.

## Cost rules

1. **Tiering.** Only the spec design needs the main model. Running `build.py`, regenerating the palette,
   re-rendering and checking file sizes are plain shell commands: run them directly, with no subagent.
   If a long mechanical chain must be delegated, give it to the cheapest model.
2. **Caching.** This file is fixed. Load a reference file only when the spec needs it:
   `reference/shapes.md` (shape maths, CSG, smoothing), `reference/parts.md` (every building part and the
   rule it follows), `reference/colour.md` (materials, gradients, palette, regeneration),
   `reference/house-rules.md` (Mateo's rules, region styles, where build-instructions/ says more),
   `reference/output.md` (commands, editions, limits, in-game checks),
   `reference/from-picture.md` (rebuilding a building from a screenshot or photo),
   `regions/<region>.md` (the full style guide of each region; read before any build there).
3. **Compression.** Never read the `.mcfunction` or `scene.json`, never print block lists. Read the summary,
   look at the PNG, change the spec, rebuild.

## Workflow

0. **From a picture?** Follow `reference/from-picture.md`: grid, read the parts, measure, sample colours
   with `scripts/picture.py`, then the steps below, comparing against the picture each round.
1. **Region first.** For any build in Mateo's world, read its region's page in `regions/` (index
   `regions/README.md`): theme, buildings, roofs, weather, paths, blocks, the preset to start from.
2. **Plan (stage 0).** Odd dimensions, storey height 4 or 5, region style, roof type, where the door and
   chimney go. For a building in the project, read the matching `build-instructions/` stage files first.
3. **Write the spec** (format below). Massing and curves go in `shapes`; anything a builder does by rule
   goes in `parts`; one-off blocks go in `place`.
4. **Build:** `python3 scripts/build.py spec.json OUT --stages`
5. **Look.** Open `OUT/preview.png` (two isometric views) and `OUT/stages.png` (one picture per stage:
   foundation, frame, floors, walls, openings, roof, details). In the hollow-crown repo, add
   `--hifi <bedrock textures/blocks> <three@0.170.0>` for real-texture renders.
6. **Fix and repeat at least 3 times before showing anyone.** Check against `build-instructions/09-final-check`
   and the "look for" list in `reference/house-rules.md`. Then show the preview, not the commands.

## Spec format

```json
{
  "name": "gate_tower",
  "edition": "bedrock",
  "materials": {
    "wall": {"ladder": "VAL-01", "axis": "y"},
    "copper": {"ladder": ["waxed_cut_copper", "waxed_exposed_cut_copper", "waxed_oxidized_cut_copper"], "axis": "y"},
    "accent": "#7a4b2a"
  },
  "shapes": [
    {"shape": "cylinder", "at": [0, 0, 0], "r": 3.5, "h": 14, "material": "wall"},
    {"shape": "cone", "at": [0, 14, 0], "r": 4.5, "h": 5, "material": "copper"},
    {"op": "sub", "shape": "arch", "at": [0, 0, 3], "width": 3, "height": 4, "depth": 3, "axis": "x"}
  ],
  "parts": [
    {"part": "house", "style": "vale_timber", "rect": [6, -4, 14, 4], "storeys": [5, 4], "jetty": ["n", "s"],
     "door": {"side": "s"}, "roof": {"type": "gable"}}
  ],
  "place": [[0, 4, 4, "lantern", {"hanging": true}]]
}
```

- Coordinates: x east, y up, z south. Integer x/z are block centres (radius n+0.5 = odd width 2n+1),
  y is the floor of a layer. `rect` and box `min`/`max` are inclusive block indices.
- `shapes` run in order: `op` add (default), `sub`, `intersect`, `paint` (recolour only). Options:
  `quality` (samples per block axis, 4), `hollow` (shell thickness in blocks, 1; 0 = solid),
  `thin` (allow trapdoor/wall edges in shapes, false).
- `parts` run after shapes, in order, and overwrite. `place` runs last.
- **Interiors** (Mateo 2026-11-12: every building has one): each `house` part ends with the interior stage
  (`scripts/interiors.py`): stairs between storeys, rooms by `"interior"` use (home, townhouse, farmhouse,
  inn, shop, mint, smithy, guildhall, hall, chapel, tower, mill, barracks, library, storage), a one-block
  walkway kept everywhere, lanterns, region flavour. `"attic": true` floors the roof space as a room.
  Rules and the use table: `build-instructions/08-interiors`. Check them cut open with
  `map/structures/build_interiors_viewer.py` (Roof off / per-floor buttons).
- Optional: `offset` [x, y, z] added to every command, `clear` true to air the bounding box first.

## One engine for every build

Mateo (2026-11-12): every build in the project uses this skill. Map code calls `scripts/engine.py`
(`compute(spec)`, `into_blueprint(bp, spec, offset, upto=stage | only=stage)`) instead of placing blocks
itself, so a rule fixed here reaches every build. New building rules go into `parts.py` and the
reference files, not into a builder of their own.

## Commands

    python3 scripts/build.py SPEC OUT [--stages] [--edition java] [--mcstructure] [--no-preview] [--hifi TEX THREE]
    python3 scripts/picture.py grid|palette|sample|measure|compare ...                       # from a picture
    python3 scripts/build_palette.py --bedrock <resource pack | textures folder | .mcpack>     # or --java <client.jar>

Outputs in OUT: `<name>.mcfunction` (merged fills, relative coords), `summary.json`, `preview.png`,
`stages.png`, `scene.json` (for the repo's 3D viewer), `<name>.mcstructure` with `--mcstructure`.
