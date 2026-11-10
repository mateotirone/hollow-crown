// Gloamwings: the Hollow's answer to anyone who overstays.
//
// They only exist in the Hollow. A visitor is left alone for the first five minutes. Then one
// Gloamwing finds them, and another joins every two minutes, up to six at once. They swoop, hit
// lightly and wheel away: pressure, not a death sentence. Kill them for their Gloamquills, or decide
// you've had enough and leave. Leaving resets the clock and the ones hunting you give up.
// They never hunt whoever rules the Hollow, and none arrive while you are safe in a mining village
// (the Hollow's own folk tag you siege_hollowfolk_safe there).

import { world } from "@minecraft/server";
import { onTick, addTests, assertEqual } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { sound } from "./util.js";

export const GLOAM_SETTINGS = {
  firstAfterSeconds: 300, // how long a visitor is left alone
  everySeconds: 120, // then one more this often
  maxHunting: 6, // most alive per player
  spawnAbove: [12, 20], // blocks above the player, inside the fog
  ceiling: 195, // never above this (the Hollow's roof is at 200)
};
const STEP_SECONDS = 10;
const GLOAM = "siege:gloamwing";
const RULER_TAG = "siege_hollow_ruler", SAFE_TAG = "siege_hollowfolk_safe";
const stays = new Map(); // player id -> { seconds in the Hollow this visit, nextAt }
const huntTag = (player) => `siege_gloam_${player.id}`.replace(/[^\w-]/g, "_");

// Pure: should one arrive now? Returns the next arrival time too, so a full sky doesn't bank arrivals.
export function gloamDue({ seconds, nextAt, alive, safe, ruler }) {
  if (ruler || seconds < nextAt) return { spawn: false, nextAt };
  if (safe || alive >= GLOAM_SETTINGS.maxHunting) return { spawn: false, nextAt: seconds + GLOAM_SETTINGS.everySeconds / 4 }; // look again soon
  return { spawn: true, nextAt: seconds + GLOAM_SETTINGS.everySeconds };
}

function callOff(dim, tag) {
  try {
    for (const g of dim.getEntities({ type: GLOAM, tags: [tag] })) g.remove();
  } catch {
    // dimension not loaded
  }
}

function gloamTick() {
  let hollow;
  try {
    hollow = world.getDimension(UNDERTOW_ID);
  } catch {
    return; // no Hollow in this world yet
  }
  const here = new Set();
  for (const p of world.getPlayers()) {
    try {
      if (p.dimension.id !== UNDERTOW_ID) continue;
      here.add(p.id);
      const stay = stays.get(p.id) ?? { seconds: 0, nextAt: GLOAM_SETTINGS.firstAfterSeconds, tag: huntTag(p) };
      stays.set(p.id, stay);
      stay.seconds += STEP_SECONDS;
      const ruler = p.hasTag(RULER_TAG);
      if (ruler) { callOff(hollow, stay.tag); continue; }
      const alive = hollow.getEntities({ type: GLOAM, tags: [stay.tag] }).length;
      const due = gloamDue({ seconds: stay.seconds, nextAt: stay.nextAt, alive, safe: p.hasTag(SAFE_TAG), ruler });
      stay.nextAt = due.nextAt;
      if (!due.spawn) continue;
      const [lo, hi] = GLOAM_SETTINGS.spawnAbove, a = Math.random() * Math.PI * 2;
      const y = Math.min(GLOAM_SETTINGS.ceiling, p.location.y + lo + Math.random() * (hi - lo));
      const g = hollow.spawnEntity(GLOAM, { x: p.location.x + Math.cos(a) * 10, y, z: p.location.z + Math.sin(a) * 10 });
      g.addTag(stay.tag);
      sound(hollow, "mob.phantom.swoop", p.location, 0.6, 0.8);
      if (alive === 0) p.onScreenDisplay.setActionBar("§5Something above you has noticed how long you've stayed.");
    } catch {
      // player mid-transfer
    }
  }
  for (const [id, stay] of stays) { // gone from the Hollow: the clock resets and the hunt is off
    if (here.has(id)) continue;
    callOff(hollow, stay.tag);
    stays.delete(id);
  }
}
onTick("bestiary_gloam", STEP_SECONDS * 20, gloamTick);

addTests("bestiary", {
  "Gloamwings leave new arrivals alone, then build up": () => {
    const S = GLOAM_SETTINGS, base = { alive: 0, safe: false, ruler: false };
    assertEqual(gloamDue({ ...base, seconds: 10, nextAt: S.firstAfterSeconds }).spawn, false); // a Slip never reaches this
    assertEqual(gloamDue({ ...base, seconds: S.firstAfterSeconds, nextAt: S.firstAfterSeconds }).spawn, true);
    assertEqual(gloamDue({ ...base, seconds: 300, nextAt: 300 }).nextAt, 300 + S.everySeconds);
    assertEqual(gloamDue({ ...base, seconds: 900, nextAt: 300, alive: S.maxHunting }).spawn, false);
    assertEqual(gloamDue({ ...base, seconds: 900, nextAt: 300, safe: true }).spawn, false);
    assertEqual(gloamDue({ ...base, seconds: 900, nextAt: 300, ruler: true }).spawn, false);
  },
});
