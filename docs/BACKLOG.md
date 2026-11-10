# Update backlog

What is planned for future updates, in rough priority order. The reasoning and the long-term expansion plan live in the "Updates and expansion plan" design doc; this file is the working list.

How to use it:

- One line per item: what the player gets, which area owns it, and a target version if there is one.
- When work starts, add the branch or pull request. When it merges, remove the line here and add a line to `CHANGELOG.md` under "Unreleased".
- Bugs found in play go under "Fixes". Anything bigger than a line gets a GitHub issue, linked from here.

## Next release

| Item | Area | Notes |
|---|---|---|
| First in-game playtest of the whole add-on | All | Nothing has run in a real game yet. See `TESTING.md`. |
| Bring both packs to one version number | Foundation | See `docs/RELEASING.md`. |

## Fixes

| Item | Area | Notes |
|---|---|---|
| Keep health capped at 400, Castle tier wants 600 | Siege | Reported by `tools/check.mjs`. |

## Later updates

To be filled from the expansion plan.
