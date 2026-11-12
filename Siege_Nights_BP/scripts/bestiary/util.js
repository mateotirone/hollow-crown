// Small helpers shared by the bestiary files. No gameplay here.

import { world, system, ItemStack, EquipmentSlot, GameMode } from "@minecraft/server";
import { ITEMS } from "./data.js";
import { sfx } from "../core/sfx.js";

export const rand = (a, b) => a + Math.random() * (b - a);
export const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
export const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z); // distance ignoring height
export const alive = (entity) => {
  try {
    return !!entity && entity.isValid !== false && (typeof entity.isValid !== "function" || entity.isValid());
  } catch {
    return false;
  }
};

// Every dimension that has a player in it right now (mobs elsewhere aren't loaded anyway)
export function activeDimensions() {
  const seen = new Map();
  for (const p of world.getPlayers()) {
    try {
      seen.set(p.dimension.id, p.dimension);
    } catch {
      // player mid-transfer
    }
  }
  return [...seen.values()];
}

export function particle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch {
    // unloaded spot or unknown particle: cosmetic only
  }
}

export function ring(dim, center, radius, id, count = Math.max(8, Math.round(radius * 6))) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    particle(dim, id, { x: center.x + Math.cos(a) * radius, y: center.y + 0.2, z: center.z + Math.sin(a) * radius });
  }
}

export function line(dim, from, to, id, step = 0.8) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const n = Math.max(1, Math.floor(Math.hypot(dx, dy, dz) / step));
  for (let i = 0; i <= n; i++) particle(dim, id, { x: from.x + (dx * i) / n, y: from.y + (dy * i) / n, z: from.z + (dz * i) / n });
}

export function sound(dim, id, loc, pitch = 1, volume = 1) {
  sfx(dim, id, loc, { pitch, volume });
}

export function effect(entity, name, ticks, amplifier = 0, showParticles = false) {
  try {
    entity.addEffect(name, ticks, { amplifier, showParticles });
  } catch {
    // entity gone
  }
}

// Bosses that come back stronger (bossCore.js, rank) scale what their attacks do to players through this
let hurtScale = () => 1;
export const setHurtScale = (fn) => { hurtScale = fn; };

export function hurt(entity, amount, cause = "magic", by) {
  try {
    if (entity.typeId === "minecraft:player") amount = Math.round(amount * hurtScale() * 10) / 10;
    // "void" damage kills through Creative and Spectator, so bosses never deal it: it lands as magic
    if (cause === "void") cause = "magic";
    // Creative players can't be hurt, so playtesters at least see what would have landed
    if (entity.typeId === "minecraft:player" && entity.getGameMode?.() === GameMode.Creative) entity.onScreenDisplay.setActionBar(`§7(Creative) That hit you for §c${amount}§7.`);
    entity.applyDamage(amount, by ? { cause, damagingEntity: by } : { cause });
  } catch {
    // entity gone
  }
}

export function heal(entity, amount) {
  try {
    const hp = entity.getComponent("health");
    hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + amount));
  } catch {
    // entity gone
  }
}

export function healthOf(entity) {
  try {
    const hp = entity.getComponent("health");
    return { now: hp.currentValue, max: hp.effectiveMax };
  } catch {
    return { now: 0, max: 1 };
  }
}

// Push an entity along (dx, dz) with the given strength, and up by `up`
export function shove(entity, dx, dz, strength, up = 0.3) {
  const d = Math.hypot(dx, dz) || 1;
  try {
    entity.applyKnockback({ x: (dx / d) * strength, z: (dz / d) * strength }, up);
  } catch {
    try {
      entity.applyImpulse({ x: (dx / d) * strength * 0.5, y: up, z: (dz / d) * strength * 0.5 });
    } catch {
      // can't be pushed
    }
  }
}

// Is `viewer` looking roughly at `target`? (pure maths: view direction vs. the direction to the target)
export function isLookingAt(viewLoc, viewDir, targetLoc, minDot = 0.55) {
  const dx = targetLoc.x - viewLoc.x, dy = targetLoc.y - viewLoc.y, dz = targetLoc.z - viewLoc.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  return (dx * viewDir.x + dy * viewDir.y + dz * viewDir.z) / d >= minDot;
}

export function watchedBy(entity, players, range = 32) {
  for (const p of players) {
    try {
      const head = p.getHeadLocation();
      const mid = { x: entity.location.x, y: entity.location.y + 1.2, z: entity.location.z };
      if (Math.hypot(mid.x - head.x, mid.y - head.y, mid.z - head.z) > range) continue;
      if (isLookingAt(head, p.getViewDirection(), mid)) return p;
    } catch {
      // player gone
    }
  }
  return undefined;
}

export function held(player, slot = EquipmentSlot.Mainhand) {
  try {
    return player.getComponent("equippable")?.getEquipment(slot)?.typeId;
  } catch {
    return undefined;
  }
}

// The town hall thread keeps each player's path and Resonance here
export function heroOf(player) {
  try {
    const raw = player.getDynamicProperty("siege:townhall_hero");
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {
    // no hero data yet
  }
  return { path: "none", resonance: 0 };
}

// Tell the other features something happened (they listen with system.afterEvents.scriptEventReceive)
export function announce(id, data) {
  const message = typeof data === "string" ? data : JSON.stringify(data);
  try {
    system.sendScriptEvent(id, message);
  } catch {
    try {
      world.getDimension("overworld").runCommand(`scriptevent ${id} ${message}`);
    } catch {
      // nobody to tell
    }
  }
}

// An item stack with its story text on it. Returns undefined if the item doesn't exist (another feature's item, not built yet).
export function makeItem(id, amount = 1) {
  try {
    const stack = new ItemStack(id, amount);
    const text = ITEMS[id]?.lore;
    if (text) stack.setLore(wrap(text, 34).map((l) => "§7" + l));
    return stack;
  } catch {
    return undefined;
  }
}

export function wrap(text, width) {
  const lines = [""];
  for (const word of text.split(" ")) {
    if ((lines[lines.length - 1] + " " + word).trim().length > width) lines.push(word);
    else lines[lines.length - 1] = (lines[lines.length - 1] + " " + word).trim();
  }
  return lines;
}

export function give(player, stack) {
  if (!stack) return;
  try {
    const left = player.getComponent("inventory").container.addItem(stack);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    try {
      player.dimension.spawnItem(stack, player.location);
    } catch {
      // player gone
    }
  }
}

// A list saved on a player (things they have seen or beaten)
export function playerList(player, prop) {
  try {
    const raw = player.getDynamicProperty(prop);
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function addToPlayerList(player, prop, value) {
  const list = playerList(player, prop);
  if (list.includes(value)) return false;
  list.push(value);
  try {
    player.setDynamicProperty(prop, JSON.stringify(list));
  } catch {
    // player gone
  }
  return true;
}
