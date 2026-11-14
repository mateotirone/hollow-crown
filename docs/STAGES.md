# Settlement stages: every building has a stage, a plot and a story step

Mateo's rules (2026-11-14). Every act, every new building and every map or town-layout rebuild follows them.

1. **No building is placed with a block.** A building goes up when the player picks it at a plot's Plot Marker. No recipe makes a block that raises a building.
2. **Every placeable building has a plot that fits it,** open by the stage it belongs to, in every town layout the game can pick.
3. **To level up, build every building of your stage** (plus the stage's homes in all), as well as holding the sieges.
4. **The story is the tutorial.** For each stage building, a person sends the player to build it (an NPC line, a book or a cutscene, never from nowhere), and the tracker pins its plot.

Plan with every building, its cost, plot and story source: <https://claude.ai/artifact/MHAFrsXtYdx4dEwjFJu5X8>

## Where the rules live

| What | Where |
|---|---|
| The stage table: each building's stage, name, story step (`act2:mint`) and who sends you; homes per stage; what is given | `Siege_Nights_BP/scripts/settle/config.js` `STAGES` |
| The level-up charters, made from that table | `config.js` `CHARTERS` (checked by `settle/charters.js charterCheck`) |
| Plot sizes and which plots a building may take | `config.js` `PLOT_SIZE`, `PLOT_ALSO`, `PLOT_MIN_BOX`, `PLOT_TAGS` |
| Seating every stage's buildings on a layout's plots | `settle/stages.js` `seatStages` |
| The story steps of each written act | `quests/acts.js` `ACT_STEPS` |
| The town generator's copy (so a map rebuild lays the plots each stage needs) | `map/structures/stages.json`, written by `node tools/export_stages.mjs`, read by `towngen_settle.py` `charter()` |
| Blocks that raise buildings, and any recipe left for a reason | `config.js` `RAISING_BLOCKS`, `CRAFT_LEFT` |

## What fails `node tools/check.mjs`

- A stage building has no plot of its own, open by its stage, in some town layout (self-test "settle stages").
- A building can be raised but stands in no stage.
- A stage building opens later than its stage, has no plot size, or names no story step or source.
- An act listed in `ACT_STEPS` has no step for a building it should send you to.
- A recipe crafts a building-raising block (unless that building is still `pending` a plot, or is in `CRAFT_LEFT`).
- `map/structures/stages.json` is out of date.

The check lists as notes (not failures): buildings still waiting for a plot (`pending`), and the steps an act must write before it exists.

## Doing the next thing

- **Writing an act:** add its step function to `quests/acts.js` `ACT_STEPS`. The check then fails until the act has a step for every building whose `step` names it. Each step comes from someone and pins the plot.
- **Adding a building:** give it a `PLOT_SIZE`, put it in its stage in `STAGES` with its step and source, then run `node tools/export_stages.mjs`. If any layout has no plot for it, re-run the town generator (it reads `stages.json`) or move it to a later stage.
- **Re-running the town generator:** `towngen_settle.py` marks a layout as passing only when every stage's buildings and homes have slots. The self-test seats the real buildings on the exported layouts.
- **Moving a block building onto a plot:** once its plot type exists, remove `pending` from its `STAGES` entry and delete its recipe. The check makes sure every layout has its plot.
