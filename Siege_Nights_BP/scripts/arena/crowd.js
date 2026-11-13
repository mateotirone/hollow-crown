// The crowd (Mateo, 2026-11-13: "an NPC crowd with crowd noise, jumping and cheering, but only when you're
// fighting so that it doesn't lag the game").
//
// The stands are empty until a fight starts. Then up to ARENA_RULES.maxCrowd siege:arena_crowd NPCs fill a
// spread of the seats, a few per tick. They have no brain at all (no AI, no gravity, no collision), so they cost
// almost nothing: the bobbing, arm-waving and jumping is all animation on the players' screens. A roar (bigger
// jumps for a few seconds) goes up when the gates lift, when someone lands a big hit, when a fighter falls, and
// at the end. Crowd noise comes from the middle of the arena: a murmur that loops while the fight is on, and
// cheers and groans on top. When the fight ends they're all removed, and a sweep every few seconds removes any
// that a restart left behind.

import { system } from "@minecraft/server";
import { sfx } from "../core/sfx.js";

export const CROWD = "siege:arena_crowd";
export const CROWD_TAG = "hc_arena_crowd";
const SKINS = 40;

let roarUntil = 0;
let spawning = false;

// Every n-th seat, so they're spread round the whole bowl. Pure.
export function pickSeats(seats, max) {
  if (seats.length <= max) return seats.slice();
  const step = seats.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(seats[Math.floor(i * step)]);
  return out;
}

export function fillStands(dim, arena, max) {
  if (spawning) return;
  spawning = true;
  const seats = pickSeats(arena.seats ?? [], max);
  system.runJob((function* () {
    try {
      for (const s of seats) {
        try {
          const e = dim.spawnEntity(CROWD, { x: s.x + 0.5, y: s.y, z: s.z + 0.5 });
          e.addTag(CROWD_TAG);
          e.setProperty("siege:skin", Math.floor(Math.random() * SKINS));
          e.setProperty("siege:phase", Math.floor(Math.random() * 8));
          e.teleport(e.location, { facingLocation: { x: arena.center.x + 0.5, y: arena.center.y + 1, z: arena.center.z + 0.5 } });
        } catch { /* seat in an unloaded chunk, or inside a block */ }
        yield;
      }
    } finally {
      spawning = false;
    }
  })());
}

export function emptyStands(dim) {
  let crowd = [];
  try { crowd = dim.getEntities({ type: CROWD }); } catch { return; }
  system.runJob((function* () {
    for (const e of crowd) {
      try { e.remove(); } catch { /* gone */ }
      yield;
    }
  })());
}

function setRoar(dim, on) {
  let crowd = [];
  try { crowd = dim.getEntities({ type: CROWD }); } catch { return; }
  system.runJob((function* () {
    for (const e of crowd) {
      try { e.setProperty("siege:roar", on); } catch { /* gone */ }
      if (Math.random() < 0.5) yield; // two or so per tick: no single tick does all of them
    }
  })());
}

// kind: "cheer" (a big moment), "groan" (someone fell), "fanfare" (the gates lift / a winner)
export function roar(dim, arena, kind = "cheer", seconds = 3) {
  const now = system.currentTick;
  const at = { x: arena.center.x + 0.5, y: arena.center.y + 6, z: arena.center.z + 0.5 };
  sfx(dim, kind === "groan" ? "sig.crowd_groan" : "sig.crowd_cheer", at, { volume: 4 });
  if (kind === "fanfare") sfx(dim, "sig.arena_fanfare", at, { volume: 4 });
  if (roarUntil <= now) setRoar(dim, true);
  roarUntil = Math.max(roarUntil, now + seconds * 20);
}

// Called every second while a fight is on: the murmur, and settling down after a roar.
let murmurNext = 0;
export function crowdTick(dim, arena) {
  const now = system.currentTick;
  if (roarUntil && now >= roarUntil) { roarUntil = 0; setRoar(dim, false); }
  if (now >= murmurNext) {
    murmurNext = now + 160; // the loop is 8 seconds long
    sfx(dim, "sig.crowd_murmur", { x: arena.center.x + 0.5, y: arena.center.y + 6, z: arena.center.z + 0.5 }, { volume: 4 });
  }
}
