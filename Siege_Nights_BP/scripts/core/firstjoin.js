// The join conductor: everything that greets a player when they join runs here, one step after
// another, so forms, titles, teleports and gifts never land on top of each other.
//
//   addJoinStep(20, "welcome hall", async (player, { first, wait }) => {
//     ...teleport, title, message...
//     await wait(60);                       // 3 seconds before the next step starts
//   }, { when: "first" });
//
// order   lower runs earlier. Agreed slots: 10 look picker, 20 welcome hall, 30 journal,
//         40 and up returning-player notices (unspent skill points and so on).
// when    "first" (the player's first ever join), "returning", or "always" (default).
// timeout seconds before the conductor stops waiting for this step and moves on (default 30),
//         so a form left open can't hold up the rest. The step itself is not cancelled.
//
// A step is awaited: return (or resolve) only when the player is done with it, for example after
// form.show() resolves. Don't subscribe to playerSpawn for greetings yourself; use a step.
// When every step has run, on("joined", ({ player, first }) => ...) fires.

import { world, system } from "@minecraft/server";
import { emit } from "./events.js";
import { addTests, assert, assertEqual } from "./tests.js";

const JOINED = "siege:joined"; // player dynamic property: set once their first join sequence has finished
const START_DELAY = 60; // ticks after spawning before the first step, so the world has drawn
const steps = [];
const running = new Set(); // player ids mid-sequence

export function addJoinStep(order, name, run, { when = "always", timeout = 30 } = {}) {
  if (typeof order !== "number" || typeof run !== "function") throw new Error(`addJoinStep("${name}") needs an order number and a function`);
  if (!["always", "first", "returning"].includes(when)) throw new Error(`addJoinStep("${name}"): when must be "always", "first" or "returning"`);
  if (steps.some((s) => s.name === name)) throw new Error(`join step "${name}" is added twice`);
  steps.push({ order, name, run, when, timeout, added: steps.length });
}

// The steps a player gets, in the order they run (ties keep the order they were added in)
export function joinPlan(first, list = steps) {
  return list
    .filter((s) => s.when === "always" || (s.when === "first") === first)
    .sort((a, b) => a.order - b.order || a.added - b.added);
}

export const wait = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

const here = (player) => {
  try {
    return player.isValid;
  } catch {
    return false;
  }
};

async function conduct(player) {
  if (running.has(player.id)) return;
  running.add(player.id);
  try {
    await wait(START_DELAY);
    if (!here(player)) return;
    const first = player.getDynamicProperty(JOINED) === undefined;
    for (const step of joinPlan(first)) {
      if (!here(player)) return; // they left; the whole sequence runs again next time
      try {
        await Promise.race([
          Promise.resolve(step.run(player, { first, wait })),
          wait(step.timeout * 20),
        ]);
      } catch (e) {
        console.warn(`[Hollow Crown] join step "${step.name}" failed: ${e}`);
      }
    }
    if (!here(player)) return;
    if (first) player.setDynamicProperty(JOINED, 1);
    emit("joined", { player, first });
  } finally {
    running.delete(player.id);
  }
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  try {
    if (player.hasTag("hc_relay")) return; // the Discord relay account (dispatch/) gets no greeting
  } catch { /* fine */ }
  conduct(player);
});

export const joinSteps = () => steps.map(({ order, name, when }) => ({ order, name, when }));

addTests("core", {
  "join steps run in order, whatever order they were added in": () => {
    const list = [
      { order: 30, name: "journal", when: "first", added: 0 },
      { order: 10, name: "looks", when: "first", added: 1 },
      { order: 40, name: "skill points", when: "returning", added: 2 },
      { order: 20, name: "welcome", when: "first", added: 3 },
      { order: 20, name: "news", when: "always", added: 4 },
    ];
    assertEqual(joinPlan(true, list).map((s) => s.name), ["looks", "welcome", "news", "journal"]);
    assertEqual(joinPlan(false, list).map((s) => s.name), ["news", "skill points"]);
  },
  "the real join steps are in order and named once": () => {
    for (const first of [true, false]) {
      const plan = joinPlan(first);
      for (let i = 1; i < plan.length; i++) assert(plan[i].order >= plan[i - 1].order, plan[i].name);
    }
    assertEqual(new Set(steps.map((s) => s.name)).size, steps.length);
  },
  "a join step needs a known 'when'": () => {
    let refused = false;
    try {
      addJoinStep(99, "test bad when", () => {}, { when: "sometimes" });
    } catch {
      refused = true;
    }
    assert(refused);
  },
});
