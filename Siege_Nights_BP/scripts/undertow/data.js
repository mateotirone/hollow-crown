// Small saved-data helpers. All Undertow data lives in world dynamic properties starting "hc:".
import { world } from "@minecraft/server";

export function load(key, fallback) {
  try {
    const raw = world.getDynamicProperty(key);
    return raw === undefined ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  world.setDynamicProperty(key, JSON.stringify(value));
}

// Facing names -> unit vectors (x, z). "facing" is the way the wall's face points, toward the player.
export const FACING = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export function say(player, text) {
  try {
    player.sendMessage(text);
  } catch {}
}

export function runCmd(dim, cmd) {
  try {
    return dim.runCommand(cmd);
  } catch {
    return undefined;
  }
}
