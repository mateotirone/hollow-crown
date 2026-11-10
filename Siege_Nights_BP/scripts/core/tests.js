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
export function runTests({ inGame = true } = {}) {
  const result = { passed: 0, skipped: 0, failed: [] };
  testing = true;
  try {
    for (const t of tests) {
      if (t.gameOnly && !inGame) {
        result.skipped++;
        continue;
      }
      try {
        t.fn();
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
