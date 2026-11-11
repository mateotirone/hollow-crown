// Self-tests. Each feature adds a few:
//
//   addTests("horses", {
//     "a foal inherits speed": () => assertEqual(breed(a, b).speed > 0, true),
//   });
//   addTests("horses", { "horse entity exists": () => ... }, { gameOnly: true });
//
// Tests run when the world loads, with /scriptevent siege:selftest, and offline with tools/check.mjs.
// Keep them synchronous and harmless: while tests run, saving to the world is switched off.

const tests = [];

// Tests too heavy to run inside Minecraft: its script engine is far slower than Node, and one long test
// trips the watchdog, which shuts the world down (first playtest, 2026-11-11). They still run in
// tools/check.mjs, which fails if a slow test is missing from this list. Written as "group: name".
export const OFFLINE_ONLY = new Set([
  "hall build: every hall has a spot for the cornerstone beside the path, never in it",
  "hall build: the clear box holds every block of the old hall above the ground",
  "horses: the stable grows with the Stables and keeps odd sizes",
  "horses: every level has as many stalls as the Stables holds",
  "settle: the Barracks and Quartermaster's buildings draw in every style behind their block",
  "undertow: thin places: each cave shows exactly Fennick's features for it",
  "undertow: thin places: the seam has room to tear open and the camp holds the Field Note",
  "undertow: thin places: a dry cave is walkable from the mouth down to the seam",
  "undertow: thin places: low, wide hills, never taller than they are wide",
  "hollowfolk: giant Veilcaps stand in the fens and groves, rare elsewhere, and are tree sized",
  "undertow: ore is in the cliffs, more of it deeper in",
  "undertow: no fill is too big",
  "undertow: open country has all four kinds of land",
  "undertow: roads are dry and gentle, and cross rivers on bridges a boat fits under",
  "undertow: terrain is deterministic",
  "undertow: the roof covers the land everywhere, 30 or more blocks up, under its unbreakable shell",
  "undertow: the roof is never flat: domes, sags and mixed rock",
  "undertow: the ground mixes several blocks in every kind of land",
  "hollowfolk: giant Veilcaps stand in the fens and groves, rare elsewhere, and are tree sized",
  "undertow: the drowned towers stand off the water and the roads, each a different design",
  "undertow: light rivers are one boatable network",
  "townhall: every hall draws in every style",
  "settle walls: walls vary along their length and from one settlement to the next, the same way every time",
  "settle walls: repair: every level lists what should stand, and the price follows the damage",
  "settle: the reserve covers every hall tier in every style",
  "crown: the gate is a real gate",
  "crown: the throne and the Seal stand inside the Great Keep",
  "crown: the Citadel plan is big, tall and always the same",
  "crown: walls stay inside Citadel land",
  "crown: the Citadel never builds over its Keep Banner",
  "crown: hangings and carpet carry the ruler's color",
  "rivals: stage buildings exist, miss each other and miss the hall, whichever way the gate faces",
  "hollowfolk: giant Veilcaps stand in the fens and groves, rare elsewhere, and are tree sized",
]);
export const testNames = () => tests.map((t) => `${t.group}: ${t.name}`);
let testing = false;

export const isTesting = () => testing;

export function addTests(group, cases, { gameOnly = false } = {}) {
  for (const [name, fn] of Object.entries(cases)) tests.push({ group, name, fn, gameOnly });
}

export function assert(condition, message = "expected true") {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = "") {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message ? message + ": " : ""}got ${a}, expected ${b}`);
}

// inGame: false skips the gameOnly tests (used by the offline check)
export function runTests({ inGame = true, slow } = {}) {
  const result = { passed: 0, skipped: 0, failed: [] };
  testing = true;
  try {
    for (const t of tests) {
      if (t.gameOnly && !inGame) {
        result.skipped++;
        continue;
      }
      try {
        const began = Date.now();
        t.fn();
        slow?.(`${t.group}: ${t.name}`, Date.now() - began);
        result.passed++;
      } catch (e) {
        result.failed.push({ group: t.group, name: t.name, error: String(e?.message ?? e) });
      }
    }
  } finally {
    testing = false;
  }
  return result;
}

// The in-game tests as a generator for system.runJob: one test per step, so the game spreads them over
// ticks. Run all at once in Minecraft's script engine they take far longer than in Node, long enough
// for the watchdog to stop the scripts (or a Realm). Saving is off only while each single test runs.
export function* runTestsJob({ inGame = true } = {}, done = () => {}) {
  const result = { passed: 0, skipped: 0, failed: [] };
  for (const t of tests) {
    // In the game only the gameOnly tests run: they ask the real game whether the pack's blocks, items and
    // entities loaded. Every other test checks rules and numbers, which tools/check.mjs already proves before
    // a build; running hundreds of them inside Minecraft froze and crashed worlds in the first playtest.
    if (inGame ? !t.gameOnly : t.gameOnly) {
      result.skipped++;
      continue;
    }
    testing = true;
    try {
      t.fn();
      result.passed++;
    } catch (e) {
      result.failed.push({ group: t.group, name: t.name, error: String(e?.message ?? e) });
    } finally {
      testing = false;
    }
    yield;
  }
  done(result);
}
