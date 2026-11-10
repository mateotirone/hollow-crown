// Dragons: their voices and body language. Every species has its own throat (sounds made by
// studio/build_dragons.py); the young sound higher. Emotes are short animations set by an entity property.

import { system } from "@minecraft/server";
import { speciesOf } from "./data.js";
import { valid, setProp } from "./dragon.js";

const STAGE_PITCH = { hatchling: 1.7, fledgling: 1.25, adult: 1 };
export const EMOTES = { roar: 1, nuzzle: 2, snarl: 3, tilt: 4, shake: 5 };

export function speak(entity, rec, kind, volume = 1) {
  if (!valid(entity)) return;
  const young = rec.stage === "hatchling" && (kind === "idle" || kind === "purr" || kind === "roar");
  try {
    entity.dimension.playSound(`siege.dragon.${speciesOf(rec).key}.${young ? "chirp" : kind}`, entity.location,
      { volume: volume * (kind === "roar" || kind === "death" ? 3 : 1.2), pitch: (STAGE_PITCH[rec.stage] ?? 1) * (0.95 + Math.random() * 0.1) });
  } catch {
    // sound missing on this client
  }
}

export function noise(entity, kind, volume = 1, pitch = 1) {
  try {
    entity.dimension.playSound(`siege.dragon.${kind}`, entity.location, { volume, pitch });
  } catch {
    // sound missing
  }
}

export function emote(entity, name, ticks = 40) {
  if (!valid(entity)) return;
  setProp(entity, "siege:emote", EMOTES[name] ?? 0);
  system.runTimeout(() => valid(entity) && setProp(entity, "siege:emote", 0), ticks);
}
