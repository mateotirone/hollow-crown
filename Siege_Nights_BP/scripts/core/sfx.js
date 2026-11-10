// Every sound the scripts play goes through sfx(). One place decides what a sound is made of.
//
//   sfx(player, "random.levelup")                      only that player hears it
//   sfx(player, "block.bell.hit", { pitch: 0.5 })
//   sfx(dimension, "raid.horn", location, { volume: 4 })   everyone near that spot hears it
//
// The name is looked up in core/sfx_cues.js:
//   - a vanilla id with a recipe there is played reworked (lower, layered, never twice quite the same);
//   - a named cue (for example "sig.toll_317") plays its own recording when Mateo has installed one
//     (tools/install_sounds.py lists those in core/sfx_installed.js) and its vanilla stand-in until then;
//   - anything else is played exactly as given.
// The pitch and volume you pass multiply the recipe's own. Sounds are cosmetic: sfx never throws.

import { system } from "@minecraft/server";
import { CUES } from "./sfx_cues.js";
import { INSTALLED } from "./sfx_installed.js";

const isSpot = (v) => v && typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number";

/** The id of the recording a named cue plays, or undefined while it still uses its stand-in. */
export function installedId(name) {
  const custom = CUES[name]?.custom;
  return custom && INSTALLED[custom] ? custom : undefined;
}

export const hasCue = (name) => name in CUES;

/** What sfx() would play: [{ id, pitch, volume, delay }]. Pure, so the self-tests can look at it. */
export function resolve(name, { pitch = 1, volume = 1 } = {}, random = Math.random) {
  const cue = CUES[name];
  if (!cue) return [{ id: name, pitch, volume, delay: 0 }];
  const custom = installedId(name);
  if (custom) return [{ id: custom, pitch, volume: volume * (cue.customVolume ?? 1), delay: 0 }];
  // one small drift for the whole cue, so layers stay in tune with each other but no two plays match
  const drift = 1 + (random() * 2 - 1) * (cue.drift ?? 0.04);
  return cue.layers.map(([id, p = 1, v = 1, delay = 0]) => ({ id, pitch: p * pitch * drift, volume: v * volume, delay }));
}

function playOne(target, id, at, pitch, volume) {
  try {
    if (at && !target.typeId) target.playSound(id, at, { pitch, volume }); // a dimension
    else target.playSound(id, at ? { location: at, pitch, volume } : { pitch, volume }); // a player
  } catch {
    // cosmetic only
  }
}

/**
 * Play a sound. `target` is a player (private) or a dimension (then give the location).
 * Returns true when a custom recording was played rather than a stand-in.
 */
export function sfx(target, name, a, b) {
  if (!target || !name) return false;
  const at = isSpot(a) ? a : isSpot(a?.location) ? a.location : undefined;
  const opts = (isSpot(a) ? b : a) ?? {};
  for (const layer of resolve(name, opts)) {
    if (layer.delay > 0) system.runTimeout(() => playOne(target, layer.id, at, layer.pitch, layer.volume), layer.delay);
    else playOne(target, layer.id, at, layer.pitch, layer.volume);
  }
  return !!installedId(name);
}

/** Stop a named cue's recording for one player (used when a looping bed should end early). */
export function sfxStop(player, name) {
  const id = CUES[name]?.custom;
  if (!id) return;
  try { player.runCommand(`stopsound @s ${id}`); } catch { /* cosmetic */ }
}
