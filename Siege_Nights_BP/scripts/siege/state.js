// Saved state. Dynamic properties are saved with the world, so a siege survives a reload.
// Other features: use getState()/saveState() from api.js, mutate the live object, and never keep a copy.

import { world } from "@minecraft/server";
import { emit } from "../core/events.js";
import { isTesting } from "../core/tests.js";
import { DESK } from "./constants.js";

export let state; // loaded on the first tick (the world isn't ready while the script first loads)
export let tracked; // machine blocks the script runs: type -> [{ dim, x, y, z }]

export function loadState() {
  const saved = world.getDynamicProperty("siege:state");
  state = saved ? JSON.parse(saved) : {};
  state.active ??= false;
  state.siegeNumber ??= 0;
  state.lastSiegeDay ??= -1;
  state.assaultsLeft ??= 0;
  state.nextAssaultTick ??= 0;
  state.keeps ??= {}; // owner player id -> { x, y, z, name }
  state.fallen ??= []; // owners whose keep fell during the current siege
  state.besieged ??= []; // owners who were attacked during the current siege
  state.spawnedAny ??= false;
  state.plans ??= {}; // owner -> this siege's war plan
  state.kills ??= {}; // owner -> how raiders died this siege
  const machines = world.getDynamicProperty("siege:machines");
  tracked = machines ? JSON.parse(machines) : {};
  tracked[DESK] ??= [];
  tracked["siege:barracks"] ??= [];
  state.guards ??= {}; // owner player id -> how many guards they have
}

export function saveState() {
  if (isTesting()) return;
  world.setDynamicProperty("siege:state", JSON.stringify(state));
}

export function saveTracked() {
  if (isTesting()) return;
  world.setDynamicProperty("siege:machines", JSON.stringify(tracked));
}

export const isReady = () => state !== undefined;

// The live state. Only call it once the world is ready (in an event, a tick, or on("ready")).
export function getState() {
  if (!state) loadState();
  return state;
}

// Runs before every loop task: load the state on the first tick, and announce "ready" once
let announced = false;
export function prepareTick() {
  if (!state) loadState();
  if (!announced) {
    announced = true;
    emit("ready");
  }
}

// Tests only: run fn with a made-up state, then put the real one back
export function withTestState(fakeState, fn, fakeTracked = {}) {
  const real = state, realTracked = tracked;
  state = fakeState;
  tracked = fakeTracked;
  try {
    return fn();
  } finally {
    state = real;
    tracked = realTracked;
  }
}
