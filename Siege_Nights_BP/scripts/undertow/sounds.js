// The Hollow's second sound layer (Mateo, 2026-11-13). Under the ambience bed (sound/index.js BEDS) and the
// thunder (index.js "undertow:sky"), now and then a single far-off sound reaches each player from a direction
// they can't see: singing a long way off, water dripping from the roof, wind in a crack, rock settling. Near a
// light river it hums; at the Drowned Court a bell rings under the water; the Seat is almost silent (mood.js).
// Every sound is a named cue in core/sfx_cues.js ("hollow.*"), built from vanilla layers. Private to the player,
// placed 10 to 28 blocks off, never the same one twice running. The Standing Ranks stay silent.
//
// pickSound() is pure (the tests run in Node).

import { world } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { addTests, assert } from "../core/tests.js";
import { sfx, hasCue } from "../core/sfx.js";
import { UNDERTOW_ID } from "./layout.js";
import { moodAt } from "./mood.js";
import { riverDistance } from "./rivers.js";
import { columnAt } from "./terrain.js";

export const HOLLOW_SOUNDS = {
  everySeconds: 4, // how often each player gets a roll
  chance: 0.3, // so about one sound every 13 seconds
  // [cue, weight, volume]
  anywhere: [["hollow.far_singing", 1, 1], ["hollow.drip", 3, 1], ["hollow.crack_wind", 2, 1], ["hollow.rock_settle", 1.5, 1]],
  river: [["hollow.river_hum", 4, 1]], // added within RIVER_NEAR blocks of a light river
  court: [["hollow.sunk_bell", 2.5, 1], ["hollow.drip", 2, 1.2]], // added at the Drowned Court
  seat: [["hollow.seat_hush", 1, 1]], // the Seat has only this, and rarely
  seatChance: 0.08,
  riverNear: 18,
  near: 10, far: 28,
};

// Which sound to play, or null. mood from moodAt, river = distance to the nearest light river,
// last = the cue played last time (never repeated), rolls = [chance roll, pick roll].
export function pickSound({ mood, river = Infinity, last = null }, rolls = [Math.random(), Math.random()]) {
  const S = HOLLOW_SOUNDS;
  const atSeat = mood.id === "seat" && mood.strength >= 0.2;
  if (rolls[0] >= (atSeat ? S.seatChance : S.chance)) return null;
  let pool;
  if (atSeat) pool = S.seat;
  else {
    pool = [...S.anywhere];
    if (river < S.riverNear) pool.push(...S.river);
    if (mood.id === "court" && mood.strength >= 0.2) pool.push(...S.court);
  }
  pool = pool.filter(([cue]) => cue !== last);
  if (!pool.length) return null;
  const total = pool.reduce((t, [, w]) => t + w, 0);
  let r = rolls[1] * total;
  for (const [cue, w, volume] of pool) {
    if ((r -= w) < 0) return { cue, volume };
  }
  const [cue, , volume] = pool[pool.length - 1];
  return { cue, volume };
}

const lastCue = new Map(); // player id -> the cue played last

onTick("undertow:sounds", HOLLOW_SOUNDS.everySeconds * 20, () => {
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== UNDERTOW_ID) { lastCue.delete(p.id); continue; }
    try {
      const l = p.location, x = Math.floor(l.x), z = Math.floor(l.z);
      if (columnAt(x, z)?.site === "standing_ranks") continue; // the Standing Ranks are silent
      const pick = pickSound({ mood: moodAt(l.x, l.z), river: riverDistance(x, z), last: lastCue.get(p.id) ?? null });
      if (!pick) continue;
      lastCue.set(p.id, pick.cue);
      const a = Math.random() * Math.PI * 2, d = HOLLOW_SOUNDS.near + Math.random() * (HOLLOW_SOUNDS.far - HOLLOW_SOUNDS.near);
      const up = pick.cue === "hollow.drip" ? 6 + Math.random() * 10 : (Math.random() - 0.3) * 6; // drips fall from above
      sfx(p, pick.cue, { x: l.x + Math.cos(a) * d, y: l.y + up, z: l.z + Math.sin(a) * d }, { volume: pick.volume });
    } catch { /* mid-teleport */ }
  }
});

addTests("undertow", {
  "the Hollow's second sound layer: by place, never twice running, the Seat almost silent": () => {
    const plain = { id: null, strength: 0 }, court = { id: "court", strength: 1 }, seat = { id: "seat", strength: 1 };
    const all = [...HOLLOW_SOUNDS.anywhere, ...HOLLOW_SOUNDS.river, ...HOLLOW_SOUNDS.court, ...HOLLOW_SOUNDS.seat];
    for (const [cue] of all) assert(hasCue(cue), `${cue} is not a named cue`);
    assert(pickSound({ mood: plain }, [0.9, 0.5]) === null, "most rolls are quiet");
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const p = pickSound({ mood: plain }, [0, i / 200]);
      seen.add(p.cue);
      assert(pickSound({ mood: plain, last: p.cue }, [0, i / 200]).cue !== p.cue, "never the same sound twice running");
    }
    assert(!seen.has("hollow.river_hum") && !seen.has("hollow.sunk_bell") && !seen.has("hollow.seat_hush"), "place sounds stay in their place");
    let hum = false, bell = false;
    for (let i = 0; i < 200; i++) {
      if (pickSound({ mood: plain, river: 5 }, [0, i / 200]).cue === "hollow.river_hum") hum = true;
      if (pickSound({ mood: court }, [0, i / 200]).cue === "hollow.sunk_bell") bell = true;
    }
    assert(hum && bell, "the river hums and the Court's bell rings");
    assert(pickSound({ mood: seat }, [0.2, 0.5]) === null, "the Seat is quieter than anywhere");
    assert(pickSound({ mood: seat }, [0.01, 0.5]).cue === "hollow.seat_hush");
  },
});
