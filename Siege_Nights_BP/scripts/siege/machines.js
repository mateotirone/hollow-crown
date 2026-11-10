// Siege machines: the trebuchet and the ballista.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, ItemStack, EntityDamageCause, GameMode } from "@minecraft/server";
import { BALLISTA, BALLISTA_HIT, DIMENSIONS, PORTCULLISES, TREBUCHET } from "./constants.js";
import { SETTINGS } from "./settings.js";
import { state } from "./state.js";
import { isAlly, settlementAt } from "./territory.js";
import { isOnline, overworld } from "./util.js";
import { BLAST, blastDamage, offlineSafe } from "./walls.js";
import { sfx } from "../core/sfx.js";

// ---------- Trebuchet: hurl boulders at walls ----------
// A big machine you place anywhere. Stand behind it and look where you want to fire.
// Click it holding cobblestone (or stone) to load and fire one boulder. Sneak + click changes the range.

export const RANGES = [20, 30, 40];
export const AMMO = ["minecraft:cobblestone", "minecraft:stone", "minecraft:cobbled_deepslate"];
export const trebuchetReady = new Map(); // trebuchet entity id -> tick when it can fire again

export function useTrebuchet(trebuchet, player, item) {
  const range = trebuchet.getDynamicProperty("siege:range") ?? 1;
  if (player.isSneaking) {
    const next = (range + 1) % RANGES.length;
    trebuchet.setDynamicProperty("siege:range", next);
    player.onScreenDisplay.setActionBar(`§6Trebuchet range: ${RANGES[next]} blocks`);
    sfx(trebuchet.dimension, "random.click", trebuchet.location);
    return;
  }
  if (system.currentTick < (trebuchetReady.get(trebuchet.id) ?? 0)) {
    return player.onScreenDisplay.setActionBar("§7The trebuchet is still winding back...");
  }
  if (!item || !AMMO.includes(item.typeId)) {
    return player.onScreenDisplay.setActionBar("§7Hold cobblestone to load a boulder. Sneak + click to change range.");
  }
  if (player.getGameMode() !== GameMode.Creative) {
    const inv = player.getComponent("minecraft:inventory").container;
    const held = inv.getItem(player.selectedSlotIndex);
    if (held && held.amount > 1) {
      held.amount -= 1;
      inv.setItem(player.selectedSlotIndex, held);
    } else {
      inv.setItem(player.selectedSlotIndex, undefined);
    }
  }
  trebuchetReady.set(trebuchet.id, system.currentTick + SETTINGS.trebuchetReloadTicks);

  // Swing round to face where the player is looking, then let fly
  const view = player.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / flat, z: view.z / flat };
  trebuchet.setRotation({ x: 0, y: player.getRotation().y });
  const dim = trebuchet.dimension;
  const at = trebuchet.location;
  dim.runCommand(`playanimation @e[type=${TREBUCHET},r=0.5,x=${at.x},y=${at.y},z=${at.z}] animation.siege_trebuchet.fire`);
  sfx(dim, "random.door_open", at, { volume: 1, pitch: 0.5 });
  system.runTimeout(() => {
    // the sling lets go near the top of the swing
    const start = { x: at.x + dir.x, y: at.y + 6, z: at.z + dir.z };
    launchBoulder(dim, start, dir, RANGES[range]);
  }, 9);
}

export function launchBoulder(dim, start, dir, range) {
  sfx(dim, "random.explode", start, { volume: 0.4, pitch: 1.6 });
  const flightTicks = 30;
  const apex = range / 3;
  let t = 0;
  const flight = system.runInterval(() => {
    t += 1;
    const f = t / flightTicks;
    const pos = {
      x: start.x + dir.x * range * f,
      y: start.y + 4 * apex * f * (1 - f),
      z: start.z + dir.z * range * f,
    };
    try {
      dim.spawnParticle("minecraft:large_explosion", pos);
      const block = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
      const landed = block && !block.isAir && !block.isLiquid && t > 3;
      if (!landed && t < flightTicks * 3) return;
      system.clearRun(flight);
      if (block) boulderImpact(dim, pos, dir);
    } catch {
      system.clearRun(flight); // flew into unloaded land
    }
  }, 1);
}

export function boulderImpact(dim, pos, dir) {
  dim.createExplosion(pos, 2, { breaksBlocks: false, causesFire: false });
  blastDamage(dim, pos, BLAST.boulder.power, BLAST.boulder.radius, { x: dir.x, y: -0.3, z: dir.z }, offlineSafe);
}

// ---------- Ballista: turns to face monsters in range and shoots them ----------


export function ballistasOf(owner) {
  return overworld().getEntities({ type: BALLISTA }).filter((b) => settlementAt(b.location) === owner);
}

export function ballistaTick() {
  for (const id of DIMENSIONS) {
    const dim = world.getDimension(id);
    for (const ballista of dim.getEntities({ type: BALLISTA })) {
      try {
        const loc = ballista.location;
        const origin = { x: loc.x, y: loc.y + 1.2, z: loc.z };
        const targets = dim.getEntities({ location: origin, maxDistance: SETTINGS.ballistaRange, families: ["monster"] });
        const target = targets.find((e) => canSee(dim, origin, e));
        if (!target) continue;
        // Swing the turret round, release, and the bolt hits a moment later
        const yaw = (Math.atan2(-(target.location.x - loc.x), target.location.z - loc.z) * 180) / Math.PI;
        ballista.setRotation({ x: 0, y: yaw });
        dim.runCommand(`playanimation @e[type=${BALLISTA},r=0.5,x=${loc.x},y=${loc.y},z=${loc.z}] animation.siege_ballista.fire`);
        system.runTimeout(() => {
          try {
            if (target.isValid) shoot(dim, origin, target);
          } catch {
            // target gone
          }
        }, 2);
      } catch {
        // ballista unloaded
      }
    }
  }
}

// Placing a machine: it belongs to whoever set it down and faces the way they look.
// Ballistas only go on your own (or allied) land; a trebuchet can be rolled up to anyone's walls.
export const MACHINES = { [BALLISTA]: "siege:ballista", [TREBUCHET]: "siege:trebuchet" };

world.afterEvents.entitySpawn.subscribe((event) => {
  const machine = event.entity;
  if (!state || !MACHINES[machine?.typeId] || machine.getDynamicProperty("siege:owner")) return;
  const player = machine.dimension.getPlayers({ location: machine.location, maxDistance: 8, closest: 1 })[0];
  if (machine.typeId === BALLISTA) {
    const land = machine.dimension.id === "minecraft:overworld" ? settlementAt(machine.location) : undefined;
    if (!player || !land || !(land === player.id || isAlly(land, player.id))) {
      machine.remove();
      if (player) {
        player.getComponent("minecraft:inventory").container.addItem(new ItemStack(MACHINES[BALLISTA], 1));
        player.onScreenDisplay.setActionBar(state.keeps[player.id]
          ? "§cYou can only build this inside your settlement."
          : "§cRaise a Keep Banner first to found your settlement.");
      }
      return;
    }
  }
  if (!player) return;
  machine.setDynamicProperty("siege:owner", player.id);
  machine.setRotation({ x: 0, y: player.getRotation().y });
  player.sendMessage(machine.typeId === BALLISTA
    ? "§7Ballista ready. It turns to face any monster in range and shoots. Sneak + click to pack it up."
    : "§7Trebuchet built. Hold cobblestone and click it to fire where you're looking. Sneak + click changes range.");
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (!state || !MACHINES[target?.typeId]) return;
  const owner = target.getDynamicProperty("siege:owner");
  const item = event.beforeItemStack ?? event.itemStack;
  // Sneak + click with an empty hand packs your machine back into an item
  if (player.isSneaking && !item && (!owner || owner === player.id)) {
    target.remove();
    const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(MACHINES[target.typeId], 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    return;
  }
  if (target.typeId === TREBUCHET) useTrebuchet(target, player, item);
  else player.onScreenDisplay.setActionBar("§6The ballista fires on its own. Sneak + click with an empty hand to pack it up.");
});

// Nobody can wreck your machines while you're away, same as your walls
export function machineGuardTick() {
  for (const id of DIMENSIONS) {
    for (const machine of world.getDimension(id).getEntities({ families: ["siege_engine"] })) {
      try {
        const owner = machine.getDynamicProperty("siege:owner");
        if (owner && !isOnline(owner)) machine.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
      } catch {
        // gone
      }
    }
  }
}

export function canSee(dim, from, entity) {
  const to = { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z };
  const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const dist = Math.hypot(dir.x, dir.y, dir.z);
  if (dist < 0.1) return true;
  const hit = dim.getBlockFromRay(from, { x: dir.x / dist, y: dir.y / dist, z: dir.z / dist }, {
    maxDistance: dist,
    includePassableBlocks: false,
  });
  // Shoots straight through portcullis bars and arrow slits, but not through solid walls
  return !hit || PORTCULLISES.includes(hit.block.typeId) || hit.block.typeId === "siege:arrow_slit";
}

export function shoot(dim, from, target) {
  const to = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    dim.spawnParticle("minecraft:basic_crit_particle", {
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
      z: from.z + (to.z - from.z) * f,
    });
  }
  sfx(dim, "crossbow.shoot", from, { volume: 0.8 });
  target.addTag(BALLISTA_HIT);
  target.applyDamage(SETTINGS.ballistaDamage, { cause: EntityDamageCause.projectile });
}
