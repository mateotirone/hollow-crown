# Versions and releases

## Version numbers

The Hollow Crown uses one version number, `MAJOR.MINOR.PATCH`, shared by both packs.

| Part | Goes up when | Example |
|---|---|---|
| MAJOR | An update that needs a new world, or breaks saved progress | 2.0.0 |
| MINOR | New content or features that are safe on an existing world | 1.2.0 |
| PATCH | Fixes and balance changes only | 1.2.1 |

The number lives in three places that must match: `header.version` in `Siege_Nights_BP/manifest.json`, `header.version` in `Siege_Nights_RP/manifest.json`, and the behavior pack's dependency on the resource pack. Bedrock only swaps in a new pack on a Realm when the version goes up, so every release must raise it.

Both packs are at 1.2 (aligned 2026-11-11; `node tools/check.mjs` now fails if they or their links to each other disagree). `tools/build.py` stamps the commit count as the patch number into the packed manifests, so every build has its own version: Minecraft silently keeps an already imported pack when the uuid and version are the same, so without this a tester keeps playing an old build.

## Safe on an existing world

The Realm world is meant to last for years, so an update must not break it. Before merging, check that the change does not:

- rename or remove an id (`siege:...` block, item, entity) that may already be placed or held in the world;
- rename or change the shape of a saved world or player property without code that upgrades the old data;
- change pack UUIDs.

If a change must do one of these, it is a MAJOR version and needs a migration note in the changelog.

## Making a release

1. `main` passes `node tools/check.mjs`, and the changes have been playtested following `TESTING.md`.
2. Raise the version in both manifests (and the dependency).
3. In `CHANGELOG.md`, rename "Unreleased" to the new version and date, and start a fresh empty "Unreleased".
4. Merge that as its own pull request.
5. Tag the merge commit `vMAJOR.MINOR.PATCH` and create a GitHub release from the tag, with the changelog section as its notes and `hollow-crown.mcaddon` (from `python3 tools/build.py`) attached.

Players update by downloading the `.mcaddon` from the newest GitHub release.
