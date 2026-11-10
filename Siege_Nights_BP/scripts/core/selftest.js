// Runs the self-tests when the world loads, and on demand with /scriptevent siege:selftest.
// If something fails, players are told when they join (and the details go to the content log).

import { world, system } from "@minecraft/server";
import { on } from "./events.js";
import { runTests } from "./tests.js";
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

on("ready", () => {
  if (globalThis.__siegeOffline) return; // tools/check.mjs runs the tests itself
  lastResult = runTests({ inGame: true });
  report(lastResult); // to the content log
  if (lastResult.failed.length) for (const p of world.getPlayers()) report(lastResult, p);
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn && lastResult?.failed.length) {
    const player = event.player;
    system.runTimeout(() => report(lastResult, player), 60);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:selftest") return;
  lastResult = runTests({ inGame: true });
  const player = event.sourceEntity?.typeId === "minecraft:player" ? event.sourceEntity : undefined;
  report(lastResult, player);
  if (!player) report(lastResult);
});
