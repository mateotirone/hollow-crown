# Output

Load when placing a build in a world or exporting it.

## Files

| File | What |
|---|---|
| `<name>.mcfunction` | merged `fill` commands (greedy boxes along x, then z, then y, each under 32,768 blocks) and `setblock` for single cells, relative to where the function runs: `~0 ~0 ~0` is the spec's 0,0,0. Full blocks first, then slabs and stairs, then thin blocks, then attachments (doors, signs, lanterns) so supports exist |
| `<name>_partN.mcfunction` | when there are more than 9,000 commands (Bedrock refuses files over 10,000); the main file calls each part |
| `summary.json` | size, min/max, block count, top blocks, blocks per stage, command count, files, warnings, seconds |
| `preview.png` | two isometric views (south-east, north-west) with real block shapes and texture colours |
| `stages.png` | one cumulative view per stage (`--stages`) |
| `scene.json` | logical scene for `map/structures/render/render.py` (the repo's three.js viewer) |
| `<name>.mcstructure` | with `--mcstructure`, written through the repo's `map/structures/bp.py` |

## Running it in game

- Bedrock: put the file in a behaviour pack's `functions/` folder (for example
  `Siege_Nights_BP/functions/builds/`), reload, stand where the spec's 0,0,0 should be and run
  `/function builds/<name>`. Or use `--mcstructure` and `/structure load`.
- Java: a datapack's `data/<ns>/function/` folder, `/reload`, `/function <ns>:<name>`.
- `offset` in the spec shifts every command; `clear: true` airs the bounding box first.
- Commands only change loaded chunks: stand near the build.

## Editions

Bedrock (default) writes block states in brackets: stairs `weirdo_direction` and `upside_down_bit` plus
`minecraft:corner` for corner stairs, slabs `minecraft:vertical_half`, trapdoors `direction`, `open_bit`,
`upside_down_bit`, walls and fences their connections, logs `pillar_axis`. In the repo every block and
state is checked against Mojang's list (`map/structures/bedrock_states.json`) so a typo fails at build time.
`--edition java` writes `minecraft:id[facing=...,half=...,shape=...]`.

## In-game checks still owed

- `minecraft:corner` on Bedrock stairs is written with Java's meaning (outer_left = the top quarter on the
  facing side and its left). Check once in game with a small dome; if corners come out mirrored, swap
  left and right in `emit.bedrock_state`.
- Trapdoor `direction` numbers (0 east, 1 west, 2 south, 3 north) are the repo's existing mapping, also
  flagged in `map/structures/README.md`.
