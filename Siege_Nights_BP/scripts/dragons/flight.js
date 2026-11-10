// Dragons in the air: take-off, flight stamina, landing, fire breath, and the ballistas and archers
// of a defended settlement shooting a dragon down.
//
// How flying works: on the ground the dragon is driven like a horse. Jump (with enough stamina) switches the
// entity to its air components, the same ones the vanilla happy ghast uses: you fly where the camera looks,
// jump climbs, look down to descend. When stamina runs out gravity comes back and it glides down.

import { world, system, InputButton, ButtonState, EntityDamageCause } from "@minecraft/server";
import { settlementAt, isAlly, guardTag, keepOf, BALLISTA } from "../siege/api.js";
import { DRAGON_SETTINGS as S, DRAGON, addXp, addBond, flightTicks, bar } from "./data.js";
import { dragonOf, ownerIdOf, valid, save, setFlying, isFlying, canHarness } from "./dragon.js";

const STEP = 2; // the flight loop runs every 2 ticks
const rides = new Map(); // owner id -> { stamina, airTicks, groundedUntil, breathAt, last, carry, bondCarry, warned, dirty }
const shotAt = new Map(); // ballista entity id -> tick it may fire at a dragon again

export function rideOf(rec) {
  let ride = rides.get(rec.owner);
  if (!ride) {
    ride = { stamina: flightTicks(rec), airTicks: 0, groundedUntil: 0, breathAt: 0, last: null, carry: 0, bondCarry: 0, warned: false, dirty: false };
    rides.set(rec.owner, ride);
  }
  return ride;
}

export const mountOf = (player) => {
  try {
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    return mount?.typeId === DRAGON ? mount : undefined;
  } catch {
    return undefined;
  }
};

// The player steering this dragon (the first rider), if any
function pilotOf(entity) {
  try {
    const riders = entity.getComponent("minecraft:rideable")?.getRiders() ?? [];
    return riders.find((r) => r.typeId === "minecraft:player");
  } catch {
    return undefined;
  }
}

const jumping = (player) => {
  try {
    return player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed;
  } catch {
    return false;
  }
};

function nearGround(entity) {
  try {
    const hit = entity.dimension.getBlockFromRay(entity.location, { x: 0, y: -1, z: 0 }, { maxDistance: 1.6, includeLiquidBlocks: true, includePassableBlocks: false });
    return !!hit;
  } catch {
    return false;
  }
}

const say = (player, text) => player.onScreenDisplay.setActionBar(text);

export function takeOff(player, entity, rec) {
  const ride = rideOf(rec);
  const now = system.currentTick;
  if (rec.stage !== "adult") return say(player, `§7${rec.name} is too young to fly. It will carry you on foot.`);
  if (!canHarness(player)) return say(player, `§7${rec.name} will not leave the ground for someone from outside the ${S.homeRegion}.`);
  if (now < ride.groundedUntil) return say(player, `§c${rec.name} is shaken and won't fly yet (${Math.ceil((ride.groundedUntil - now) / 20)}s).`);
  if (ride.stamina < flightTicks(rec) * S.takeoffAt) return say(player, `§c${rec.name} is spent. Let it rest.`);
  setFlying(entity, rec, true);
  ride.airTicks = 0;
  ride.warned = false;
  try {
    entity.applyImpulse({ x: 0, y: 0.9, z: 0 });
    entity.dimension.playSound("mob.enderdragon.flap", entity.location, { volume: 1.5, pitch: 0.8 });
  } catch {
    // the lift and the sound are niceties
  }
}

export function land(entity, rec, reason) {
  setFlying(entity, rec, false);
  try {
    entity.addEffect("slow_falling", 400, { amplifier: 0, showParticles: false }); // glide down, never drop
  } catch {
    // fall damage is off for dragons anyway
  }
  const ride = rideOf(rec);
  ride.airTicks = 0;
  if (reason === "shot") ride.groundedUntil = system.currentTick + S.groundedTicks;
}

// Dragon Horn while flying: a cone of fire ahead. Burns monsters, never blocks.
export function breathe(player, entity, rec) {
  const ride = rideOf(rec);
  const level = rec.stats.breath;
  const now = system.currentTick;
  if (!level) return say(player, `§7${rec.name} hasn't learned to breathe fire. Train Breath at your Roost.`);
  if (now < ride.breathAt) return say(player, `§7${rec.name} is drawing breath (${Math.ceil((ride.breathAt - now) / 20)}s).`);
  ride.breathAt = now + S.breathCooldownTicks;
  ride.stamina = Math.max(0, ride.stamina - S.breathStaminaTicks);
  const view = player.getViewDirection();
  const from = { x: entity.location.x, y: entity.location.y + 1.5, z: entity.location.z };
  const dim = entity.dimension;
  try {
    entity.setProperty("siege:breath", true);
    system.runTimeout(() => valid(entity) && entity.setProperty("siege:breath", false), 20);
    dim.playSound("mob.blaze.shoot", from, { volume: 2, pitch: 0.6 });
    for (let d = 2; d <= S.breathRange; d += 1.5) {
      dim.spawnParticle("minecraft:mobflame_single", { x: from.x + view.x * d, y: from.y + view.y * d, z: from.z + view.z * d });
    }
  } catch {
    // looks only
  }
  let burned = 0;
  for (const target of dim.getEntities({ location: from, maxDistance: S.breathRange, families: ["monster"] })) {
    const to = { x: target.location.x - from.x, y: target.location.y + 0.8 - from.y, z: target.location.z - from.z };
    const dist = Math.hypot(to.x, to.y, to.z) || 1;
    if ((to.x * view.x + to.y * view.y + to.z * view.z) / dist < 0.8) continue; // outside the cone
    try {
      target.applyDamage(S.breathDamage[level], { cause: EntityDamageCause.fire, damagingEntity: player });
      target.setOnFire(4 + level * 2, true);
      burned++;
    } catch {
      // target gone
    }
  }
  if (burned && addXp(rec, burned * 2)) announceLevel(player, rec);
  ride.dirty = true;
}

export function announceLevel(player, rec) {
  player.onScreenDisplay.setTitle(`§6${rec.name} reached level ${rec.level}`, {
    subtitle: "§7A training point to spend at your Roost", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20,
  });
  player.playSound("random.levelup");
  save();
}

export function flightTick() {
  const seen = new Set();
  let dragons;
  try {
    dragons = world.getDimension("overworld").getEntities({ type: DRAGON });
  } catch {
    return;
  }
  for (const entity of dragons) {
    const rec = dragonOf(ownerIdOf(entity));
    if (!rec || rec.status !== "out") continue;
    seen.add(rec.owner);
    const ride = rideOf(rec);
    const max = flightTicks(rec);
    const flying = isFlying(entity);
    const pilot = pilotOf(entity);

    if (flying) {
      ride.airTicks += STEP;
      ride.stamina -= STEP;
      const press = pilot && jumping(pilot);
      if (!pilot) {
        land(entity, rec, "empty");
        try {
          // whoever just slid off its back floats down instead of dropping
          for (const p of entity.dimension.getPlayers({ location: entity.location, maxDistance: 6 })) p.addEffect("slow_falling", 300, { showParticles: false });
        } catch {
          // nobody near
        }
      }
      else if (ride.stamina <= 0) {
        ride.stamina = 0;
        land(entity, rec, "spent");
        pilot.playSound("mob.ravager.stun");
        say(pilot, `§c${rec.name} is spent and glides down.`);
      } else if (ride.airTicks > 30 && !press && nearGround(entity)) land(entity, rec, "ground");
      else if (!ride.warned && ride.stamina < max * 0.25) {
        ride.warned = true;
        pilot.playSound("note.bass");
      }
    } else {
      ride.stamina = Math.min(max, ride.stamina + STEP * S.restFactor);
      if (pilot && jumping(pilot) && nearGround(entity)) takeOff(pilot, entity, rec);
    }

    if (!pilot) {
      ride.last = null;
      continue;
    }
    // XP and bond for distance, for the owner only
    const at = entity.location;
    if (ride.last && pilot.id === rec.owner) {
      const moved = Math.hypot(at.x - ride.last.x, at.z - ride.last.z);
      if (moved < 30) ride.carry += moved;
      const xp = Math.floor(ride.carry / S.blocksPerXp);
      if (xp > 0) {
        ride.carry -= xp * S.blocksPerXp;
        ride.dirty = true;
        if (addXp(rec, xp)) announceLevel(pilot, rec);
      }
      ride.bondCarry += STEP;
      if (ride.bondCarry >= 1200) {
        ride.bondCarry = 0;
        addBond(rec, S.rideBondPerMinute);
        ride.dirty = true;
      }
    }
    ride.last = { x: at.x, z: at.z };
    const grounded = system.currentTick < ride.groundedUntil;
    const state = isFlying(entity) ? (ride.stamina < max * 0.25 ? " §ctiring" : " §bFLYING") : grounded ? " §cshaken" : rec.stage === "adult" ? " §7jump to fly" : "";
    say(pilot, `§f${rec.name} §7Lv ${rec.level}  §7Flight ${bar(ride.stamina, max)}${state}`);
    if (ride.dirty && system.currentTick % 200 < STEP) {
      ride.dirty = false;
      save();
    }
  }
  // Dragons that are away keep their stamina as it was (sending one to roost is not a free refill)
  for (const [owner, ride] of rides) {
    if (seen.has(owner) || !ride.dirty) continue;
    ride.dirty = false;
    save();
  }
}

// Once a second: a dragon flying over a settlement that isn't its rider's (or an ally's) is fair game.
export function defenceTick() {
  let dragons;
  try {
    dragons = world.getDimension("overworld").getEntities({ type: DRAGON });
  } catch {
    return;
  }
  const now = system.currentTick;
  for (const entity of dragons) {
    const rec = dragonOf(ownerIdOf(entity));
    if (!rec || !isFlying(entity)) continue;
    const pilot = pilotOf(entity);
    if (!pilot) continue;
    const at = entity.location;
    const lord = settlementAt(at);
    if (!lord || lord === pilot.id || isAlly(lord, pilot.id)) continue;
    const ride = rideOf(rec);
    const max = flightTicks(rec);
    const dim = entity.dimension;
    let bolts = 0;
    for (const ballista of dim.getEntities({ type: BALLISTA, location: at, maxDistance: S.ballistaReach })) {
      if (settlementAt(ballista.location) !== lord || (shotAt.get(ballista.id) ?? 0) > now) continue;
      shotAt.set(ballista.id, now + S.ballistaTicks);
      try {
        const b = ballista.location;
        ballista.setRotation({ x: 0, y: (Math.atan2(-(at.x - b.x), at.z - b.z) * 180) / Math.PI });
        dim.runCommand(`playanimation @e[type=${BALLISTA},r=0.5,x=${b.x},y=${b.y},z=${b.z}] animation.siege_ballista.fire`);
        dim.playSound("crossbow.shoot", b, { volume: 2, pitch: 0.6 });
      } catch {
        // looks only
      }
      bolts++;
    }
    let archers = 0;
    try {
      archers = Math.min(4, dim.getEntities({ type: "siege:archer", tags: [guardTag(lord)], location: at, maxDistance: S.archerReach }).length);
    } catch {
      // no guards loaded
    }
    if (!bolts && !archers) continue;
    ride.stamina -= max * (bolts * S.ballistaStamina + archers * S.archerStamina);
    try {
      entity.applyDamage(bolts * S.ballistaDamage + archers * S.archerDamage, { cause: EntityDamageCause.projectile });
    } catch {
      continue; // it died of it
    }
    if (!valid(entity)) continue;
    if (bolts) {
      pilot.playSound("random.anvil_land", { volume: 0.6, pitch: 1.4 });
      pilot.sendMessage(`§c${keepOf(lord)?.name ?? "The settlement"}'s ballista hits ${rec.name}!`);
    }
    if (ride.stamina <= 0) {
      ride.stamina = 0;
      land(entity, rec, "shot");
      pilot.onScreenDisplay.setTitle("§cShot down", { subtitle: `§7${rec.name} is falling`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    }
  }
  if (shotAt.size > 60) for (const [id, until] of shotAt) if (until < now) shotAt.delete(id);
}
