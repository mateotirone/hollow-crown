// Runs the self-tests when the world loads, and on demand with /scriptevent siege:selftest.
// If something fails, players are told when they join (and the details go to the content log).

import { world, system } from "@minecraft/server";
import { on } from "./events.js";
import { runTestsJob } from "./tests.js";
import { tickTasks } from "./loop.js";

let lastResult;

function report(result, player) {
  const total = result.passed + result.failed.length;
  const say = (text) => (player ? player.sendMessage(text) : console.warn(text.replace(/§./g, "")));
  if (!result.failed.length) {
    say(`§a[Hollow Crown] Self-test passed: ${total} checks, ${tickTasks().length} loop tasks running.`);
    return;
  }
  say(`§c[Hollow Crown] Self-test: ${result.failed.length} of ${total} checks failed.`);
  for (const f of result.failed.slice(0, 12)) say(`§c - ${f.group}: ${f.name}§7 (${f.error})`);
  if (result.failed.length > 12) say(`§7 ...and ${result.failed.length - 12} more (see the content log)`);
}

// Tests run as a job (a few per tick), never all at once: see runTestsJob.
function runInBackground(then) {
  system.runJob(runTestsJob({ inGame: true }, (result) => {
    lastResult = result;
    then(result);
  }));
}

on("ready", () => {
  if (globalThis.__siegeOffline) return; // tools/check.mjs runs the tests itself
  runInBackground((result) => {
    report(result); // to the content log
    if (result.failed.length) for (const p of world.getPlayers()) report(result, p);
  });
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn && lastResult?.failed.length) {
    const player = event.player;
    system.runTimeout(() => report(lastResult, player), 60);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:selftest") return;
  const player = event.sourceEntity?.typeId === "minecraft:player" ? event.sourceEntity : undefined;
  player?.sendMessage("§7[Hollow Crown] Running the self-test...");
  runInBackground((result) => {
    if (player?.isValid) report(result, player);
    else report(result);
  });
});
