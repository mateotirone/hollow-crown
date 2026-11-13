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
  "settle base: the founder's cottage has room for a bed indoors",
  "undertow: the Needlehold: its tiles hold every block once, each inside its own tile, all inside its site",
  "wonders: each stage draws into a build plan, every block with a known role",
  "wonders: every wonder has a design, cut into six stages that hold every block",
  "landmarks: tomes laid in designs are real tomes, each laid once, each on something solid",
  "plot caves: a plot cave: each tier opens more, all of it reached from the shaft, ore only on open faces, a door at Castle",
  "trains: stations: at the end of a line the track stops at a buffer and an end wall, on the side away from the line",
  "settle ground: terraform: a floor on a slope cuts in at most 3, and the groundwork blends the land round it",
  "undertow: the Wound: the cliff behind it runs right across the valley, never lower than the first wall, and is built up into the roof",
  "undertow: the Wound: the cave is sealed in rock, you can walk from the ledge to the tear, and the tear runs from the floor to the roof",
  "undertow: the arrival: you can walk from the ledge down to the valley a block at a time, and every step is a stair block",
  "undertow: the arrival: an old world has the first box and ramp taken away",
  "undertow: the Wound: the cliff the mouth opens in is never one flat wall, and its rock is laid in beds",
  "settle charters: a lord fills every layout's plots and meets each charter with the designs there are",
  "undertow: a chunk built under the low roof has it taken away and the high roof built",
  "settle plans: the Plan Book card pictures match the buildings as they are designed now",
  "after: Deep: the halls are open where players and the Host stand, with floor under them",
  "trains: routes: the planned railway has no mistakes, and no works stand in a train's way",
  "trains: stations: nothing floats (roofs sit on their beams, lanterns hang from something)",
  "warwrit-route: soldiers ride round to the bridge instead of swimming the river",
  "warwrit-route: with no bridge in reach they swim after all",
  "warwrit-route: walls are never climbed: they go through the gate",
  "hollow arenas: the Court's floor is whole and open to the fight's outer ring, with the Singers' spots clear",
  "hollow arenas: the Court's water stays in its channels: every water block is closed on four sides and below (it once ran over the floor)",
  "hollow arenas: the Court never writes the gate's cells (the seal and openCourtGate own them)",
  "hollow arenas: the Seat: disc and ring floors, Morvane's spot clear, everything that falls inside the dropped band",
  "hollow arenas: the cliff before the Seat is ragged, and the story path still reaches its edge",
  "hollow arenas: the cavern: the pit is walled in up to the roof all round, and the wall keeps clear of the Seat",
  "hollow arenas: the chasm under the Seat: a floor everywhere, the pool held in, spires clear of everything above",
  "hollow arenas: the chasm's falls spring from the cliff and its chunk plans stay inside their chunk",
  "hollow arenas: the way to the Seat can be walked from the cliff to the ring without a jump, and none of it falls or sits in the land",
  "landmarks: on flat ground a rigid design stands whole at the ground height, clear of trees",
  "landmarks: a rigid design on a slope is filled under and cut into, never floating",
  "hall build: every hall has a Town Board just inside, off the aisle, before the Tree",
  "vault: every hall of every region and tier has room for the vault's stairs, over its floor and under its roof",
  "guard posts: every wall a guard can stand on has its flights of steps, each top step beside the walk",
  "settle walls: the ring has no holes, one gate, and follows the ground",
  "undertow: rebuilt sites stamp again over the old look, clearing only inside their site, and keep the Carter's spot clear",
  "settle: every building draws in every style with known roles",
  "settle towns: groundwork decodes into rows near the plot, in each tier",
  "hall build: the clear box holds every block of the old hall above the ground",
  "horses: the stable grows with the Stables and keeps odd sizes",
  "horses: every level has as many stalls as the Stables holds",
  "settle: the Barracks and Quartermaster's buildings draw in every style behind their block",
  "undertow: thin places: each cave shows exactly Fennick's features for it",
  "undertow: thin places: the seam has room to tear open and the camp holds the Field Note",
  "undertow: thin places: every cave is walkable from the mouth down to its chamber, one step at a time",
  "undertow: thin places: nothing the planner builds stands in front of a cave mouth",
  "undertow: thin places: standing water beside a cave is walled off, never left against open air",
  "undertow: thin places: no two caves are the same, and the land covers every one",
  "undertow: the seep: veins are connected, reach out from the mouth, and growing never moves them",
  "undertow: thin places: low, wide hills, never taller than they are wide",
  "hollowfolk: giant Veilcaps stand in the fens and groves, rare elsewhere, and are tree sized",
  "undertow: ore is in the cliffs, more of it deeper in",
  "undertow: no fill is too big",
  "undertow: open country has all four kinds of land",
  "undertow: roads are dry and gentle, and cross rivers on bridges a boat fits under",
  "undertow: terrain is deterministic",
  "undertow: path is walkable (no step over 1)",
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
