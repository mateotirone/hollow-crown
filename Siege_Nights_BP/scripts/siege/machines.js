// Siege machines: the trebuchet and the ballista.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, ItemStack, EntityDamageCause, GameMode } from "@minecraft/server";
import { BALLISTA, BALLISTA_HIT, DIMENSIONS, PORTCULLISES, TREBUCHET } from "./constants.js";
import { SETTINGS } from "./settings.js";
import { state } from "./state.js";
import { isAlly, settlementAt } from "./territory.js";
import { isOnline, overworld, attackable } from "./util.js";
import { BLAST, blastDamage, offlineSafe } from "./walls.js";
import { PASSABLE } from "./collapse.js";
import { markWanted } from "./guards.js";
import { TREBUCHET as THROW, impactPower, launchVelocity, releaseAngle, stepFlight, throwDistance } from "./structure.js";
import { sfx } from "../core/sfx.js";
import { addTests, assert, assertEqual } from "../core/tests.js";

// ---------- Trebuchet: hurl boulders at walls ----------
// A big machine you place anywhere. Stand behind it, look where you want to fire, and click it holding
// cobblestone. It swings round to face where you look; how high you look sets the release angle
// (look up to lob it high, level for a flat fast throw). Sneak + click changes the counterweight
// (Light, Medium, Heavy): heavier throws faster and further. The boulder flies with real gravity
// (structure.js, same numbers as the Siege Wall Lab) and hits harder the faster it lands.
// Only the owner and their allies can fire it. Hitting someone's settlement makes you Wanted there.

export const AMMO = ["minecraft:cobblestone", "minecraft:stone", "minecraft:cobbled_deepslate"];
export const trebuchetReady = new Map(); // trebuchet entity id -> tick when it can fire again

function weightOf(trebuchet) {
  const w = trebuchet.getDynamicProperty("siege:weight");
  return typeof w === "number" && w >= 0 && w <= 2 ? w : 1;
}

export function useTrebuchet(trebuchet, player, item) {
  const owner = trebuchet.getDynamicProperty("siege:owner");
  if (owner && owner !== player.id && !isAlly(owner, player.id)) {
    return player.onScreenDisplay.setActionBar("§cThis trebuchet isn't yours. Only its owner and their allies can use it.");
  }
  const weight = weightOf(trebuchet);
  const angle = releaseAngle(player.getRotation().x);
  if (player.isSneaking) {
    const next = (weight + 1) % 3;
    trebuchet.setDynamicProperty("siege:weight", next);
    player.onScreenDisplay.setActionBar(`§6${THROW.weightNames[next]} counterweight: about ${Math.round(throwDistance(angle, next))} blocks at ${Math.round(angle)}°`);
    sfx(trebuchet.dimension, "random.click", trebuchet.location);
    return;
  }
  if (system.currentTick < (trebuchetReady.get(trebuchet.id) ?? 0)) {
    return player.onScreenDisplay.setActionBar("§7The trebuchet is still winding back...");
  }
  if (!item || !AMMO.includes(item.typeId)) {
    return player.onScreenDisplay.setActionBar("§7Hold cobblestone and click to fire. Look higher to throw higher. Sneak + click changes the counterweight.");
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
  const yaw = player.getRotation().y;
  trebuchet.setRotation({ x: 0, y: yaw });
  const dim = trebuchet.dimension;
  const at = trebuchet.location;
  player.onScreenDisplay.setActionBar(`§6${THROW.weightNames[weight]} counterweight, ${Math.round(angle)}°: about ${Math.round(throwDistance(angle, weight))} blocks`);
  dim.runCommand(`playanimation @e[type=${TREBUCHET},r=0.5,x=${at.x},y=${at.y},z=${at.z}] animation.siege_trebuchet.fire`);
  sfx(dim, "random.door_open", at, { volume: 1, pitch: 0.5 });
  const shooter = player.id;
  system.runTimeout(() => {
    // the sling lets go near the top of the swing
    const vel = launchVelocity(yaw, angle, weight);
    const flat = Math.hypot(vel.x, vel.z) || 1;
    const start = { x: at.x + (vel.x / flat) * 1.2, y: at.y + THROW.releaseHeight, z: at.z + (vel.z / flat) * 1.2 };
    launchBoulder(dim, start, vel, shooter);
  }, 9);
}

// vel in blocks per second. shooter: player id (for Wanted), optional.
export function launchBoulder(dim, start, vel, shooter) {
  sfx(dim, "random.explode", start, { volume: 0.4, pitch: 1.6 });
  const pos = { ...start }, v = { ...vel };
  const dt = 1 / 20 / THROW.substeps;
  let t = 0;
  const flight = system.runInterval(() => {
    t++;
    try {
      for (let s = 0; s < THROW.substeps; s++) {
        stepFlight(pos, v, dt);
        const block = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
        if (!block) { system.clearRun(flight); return; } // flew out of the world or into unloaded land
        if (PASSABLE.test(block.typeId)) continue;
        system.clearRun(flight);
        boulderImpact(dim, pos, v, shooter);
        return;
      }
      if (t % 2 === 0) dim.spawnParticle("minecraft:large_explosion", pos);
      if (t > 200 || pos.y < -64) system.clearRun(flight);
    } catch {
      system.clearRun(flight);
    }
  }, 1);
}

// vel: the boulder's velocity when it hit (blocks per second)
export function boulderImpact(dim, pos, vel, shooter) {
  const speed = Math.hypot(vel.x, vel.y, vel.z) || 1;
  const dir = { x: vel.x / speed, y: vel.y / speed, z: vel.z / speed };
  dim.createExplosion(pos, 2, { breaksBlocks: false, causesFire: false });
  blastDamage(dim, pos, impactPower(BLAST.boulder.power, speed), BLAST.boulder.radius, dir, offlineSafe);
  // a trebuchet hit on someone's settlement makes the shooter Wanted there, same as ramming their wall
  const land = dim.id === "minecraft:overworld" ? settlementAt(pos) : undefined;
  const player = shooter && land ? world.getPlayers().find((p) => p.id === shooter) : undefined;
  if (player && isOnline(land)) markWanted(player, land);
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
    : "§7Trebuchet built. Hold cobblestone and click it to fire where you're looking: look higher to throw higher. Sneak + click changes the counterweight.");
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
        if (owner && !attackable(owner)) machine.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
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

addTests("siege", {
  "trebuchet: heavier counterweights throw further, and 45° beats a flat throw": () => {
    const d = [0, 1, 2].map((w) => throwDistance(40, w));
    assert(d[0] < d[1] && d[1] < d[2], `light ${d[0]}, medium ${d[1]}, heavy ${d[2]}`);
    assert(d[2] > 45 && d[2] < 60, `heavy reaches about 50 blocks (${d[2]})`);
    assert(throwDistance(45, 1) > throwDistance(15, 1), "a lob at 45° goes further than a flat throw");
  },
  "trebuchet: looking level still throws at the lowest angle, looking straight up is capped": () => {
    assertEqual(releaseAngle(0), THROW.minAngle);
    assertEqual(releaseAngle(-90), THROW.maxAngle);
    assertEqual(releaseAngle(-40), 40);
  },
  "trebuchet: it throws the way you face (yaw 0 is south, 90 is west)": () => {
    const south = launchVelocity(0, 30, 1), west = launchVelocity(90, 30, 1);
    assert(south.z > 0 && Math.abs(south.x) < 1e-6 && south.y > 0);
    assert(west.x < 0 && Math.abs(west.z) < 1e-6);
  },
  "trebuchet: a faster landing hits harder, within limits": () => {
    assert(impactPower(6.5, 31) > impactPower(6.5, 22));
    assertEqual(impactPower(6.5, 1), 6.5 * 0.35);
    assertEqual(impactPower(6.5, 100), 6.5 * 1.8);
  },
});
