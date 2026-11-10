// The shared main loop. Every feature registers its repeating work here:
//
//   onTick("horses", 40, horseTick);     // run horseTick every 40 ticks (2 seconds)
//
// Each task runs inside its own try/catch, so one broken feature can't stop the others.

import { system } from "@minecraft/server";

const tasks = [];
let beforeEach = () => {};
let started = false;

export function onTick(name, everyTicks, fn) {
  const task = { name, everyTicks, fn };
  tasks.push(task);
  if (started) start(task);
}

function start(task) {
  system.runInterval(() => {
    try {
      beforeEach();
      task.fn();
    } catch (e) {
      console.warn(`[Siege Nights] ${task.name}: ${e}`);
    }
  }, task.everyTicks);
}

// main.js calls this once, after every file has been imported
export function startLoop(prepare) {
  beforeEach = prepare;
  started = true;
  for (const task of tasks) start(task);
}

export const tickTasks = () => tasks.map((t) => ({ name: t.name, everyTicks: t.everyTicks }));
