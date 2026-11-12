# The Hollow Crown: rules every Claude session in this repo follows

Claude Code reads this file at the start of every session in the repo. Keep it short, and point to the real
documents instead of copying them.

## Before you build anything (Mateo, 2026-11-12)

This applies to any building, structure, town, wall, station, boss site or Hollow site, whether it's for the map,
a settlement plot or the showcase. Before the first block, read these, in this order:

1. **The building skill:** `.claude/skills/minecraft-builder/SKILL.md`. It is the ONE engine for every build
   (Mateo, 2026-11-12). Write a spec and build it with `scripts/engine.py` (`into_blueprint`, `compute`), not
   with hand-placed blocks or a new one-off builder. A rule the skill lacks goes into `scripts/parts.py`, not
   your own code.
2. **The region's style guide:** `.claude/skills/minecraft-builder/regions/<region>.md` (index
   `regions/README.md`): vale, frostmarch, saltreach, emberwaste, blackfen, hollow. Start from the preset it
   names, and follow its roofs, blocks, paths and detail rules.
3. **The staged build instructions:** `build-instructions/README.md`. Go stage by stage, 00-planning to
   09-final-check, and check each stage before the next.
4. **Mateo's house rules:** `.claude/skills/minecraft-builder/reference/house-rules.md`.
5. **Towers** (any tower, spire, belfry or clock): `build-instructions/towers/README.md`.

Then check the build in 3D (render it, or use the live asset viewer) before showing Mateo. If your build settles
a rule the region page doesn't have yet, add it to that page in the same PR.

Worked examples: `map/structures/review/specs/` (the run-through pass and the settlement plot buildings, all
five regions, written by `gen_settle.py`).

## Always

- One branch and one PR per piece of work. `node tools/check.mjs` must print ALL OK before you push.
- Changes players will notice get a line in `CHANGELOG.md`.
- Every size is odd ("work in threes"). Interiors stay empty except the inn and custom builds.
