// Dragons: brought down. A dragon beaten to its last strength (or shot out of the sky) does not die: it
// falls unconscious. You can see it breathing, and bleeding. Its owner or an ally can tend it with a golden
// apple and it wakes a minute later; left alone it bleeds out; an enemy can finish it where it lies.
// A dead dragon stays where it fell, not breathing, until the fighting is over, then crumbles to ash.

import { world, system } from "@minecraft/server";
import { getState, isAlly, isOnline, consumeHeld, emit } from "../siege/api.js";
import { DRAGON_SETTINGS as S, DRAGON, DAY, RESERVE } from "./data.js";
import { store, dragonOf, ownerIdOf, valid, save, entityOf, applyRecord, roostDragon, fire, setProp } from "./dragon.js";
import { speak, noise } from "./voice.js";
import { rideOf } from "./flight.js";
import { rememberAttacker, shiftMood, tell } from "./mind.js";
import { sfx } from "../core/sfx.js";

const CORPSE = "siege:dragons_corpse"; // on a dead body: the time it crumbles
const ownerOf = (rec) => world.getPlayers().find((p) => p.id === rec.owner);

export function goDown(rec, entity, attacker) {
  if (rec.down || !valid(entity)) return;
  rec.down = { life: S.downedLife, bled: 0, tended: false };
  rec.asleep = false;
  rememberAttacker(rec, attacker);
  try {
    entity.getComponent("minecraft:rideable")?.ejectRiders();
  } catch {
    // nobody on it
  }
  applyRecord(entity, rec); // lays it down
  try {
    entity.getComponent("minecraft:health")?.setCurrentValue(RESERVE);
    entity.addEffect("slow_falling", 200, { showParticles: false });
  } catch {
    // already on the ground
  }
  speak(entity, rec, "death", 0.7);
  save();
  const owner = ownerOf(rec);
  owner?.onScreenDisplay.setTitle(`§c${rec.name} is down`, { subtitle: "§7It is still breathing", fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20 });
  owner?.sendMessage(`§c${rec.name} has fallen unconscious. §7Tend it with a golden apple before it bleeds out (about ${Math.round(S.bleedOutTicks / 1200)} minutes), and keep its enemies off it.`);
}

function wake(rec, entity) {
  delete rec.down;
  fire(entity, "siege:get_up");
  applyRecord(entity, rec);
  system.runTimeout(() => {
    if (!valid(entity)) return;
    try {
      const health = entity.getComponent("minecraft:health");
      health.setCurrentValue(RESERVE + (health.effectiveMax - RESERVE) * S.wakeHealth);
    } catch {
      // it wakes with whatever it has
    }
  }, 5);
  rideOf(rec).groundedUntil = system.currentTick + S.wakeGroundedTicks;
  rideOf(rec).stamina = 0;
  speak(entity, rec, "whimper");
  save();
  tell(ownerOf(rec), rec, "{n} drags its head up, finds you, and breathes out. It is awake. It will not fly for a while.");
}

// What its death costs its owner. The body (if there is one) is handled by the caller.
export function lose(rec, how) {
  const now = world.getAbsoluteTime();
  const owner = ownerOf(rec);
  if (S.permadeath) {
    try { emit("dragonDied", { owner: rec.owner, ownerName: rec.ownerName, name: rec.name, how }); } catch { /* nobody listening */ }
    delete store.data.dragons[rec.owner];
    store.data.mourning[rec.owner] = now + S.mournDays * DAY;
    save();
    owner?.onScreenDisplay.setTitle(`§c${rec.name} is dead`, { subtitle: "§7The nests will be silent for you a while", fadeInDuration: 10, stayDuration: 80, fadeOutDuration: 30 });
    for (const p of world.getPlayers()) if (p.id !== rec.owner) p.sendMessage(`§7${rec.ownerName}'s dragon ${rec.name} ${how}.`);
  } else {
    delete rec.down;
    rec.woundedUntil = now + S.woundedDays * DAY;
    roostDragon(rec, "wounded");
    owner?.sendMessage(`§c${rec.name} ${how}. §7It is carried back to its Roost and will need ${S.woundedDays} days.`);
  }
}

function die(rec, entity, how) {
  speak(entity, rec, "death");
  if (S.permadeath && valid(entity)) {
    // The body stays: no owner any more, so nothing treats it as a living dragon
    entity.setDynamicProperty("siege:dragons_owner", undefined);
    entity.setDynamicProperty(CORPSE, world.getAbsoluteTime() + S.corpseTicks);
    setProp(entity, "siege:pose", 3);
    entity.nameTag = "";
  }
  lose(rec, how);
}

// A blow landed on an unconscious dragon (the game itself can't hurt it; we count)
function strike(entity, attacker, amount) {
  const rec = dragonOf(ownerIdOf(entity));
  if (!rec?.down || !attacker) return;
  if (attacker.id === rec.owner || !isOnline(rec.owner)) return; // its owner can't finish it by accident; nothing dies while its owner is away
  if (attacker.typeId === "minecraft:player" && isAlly(rec.owner, attacker.id)) return;
  rec.down.life -= amount;
  rec.down.tended = false; // a wound reopened
  rec.down.wakeAt = undefined;
  rememberAttacker(rec, attacker, 10);
  try {
    entity.dimension.spawnParticle("minecraft:critical_hit_emitter", { x: entity.location.x, y: entity.location.y + 0.8, z: entity.location.z });
  } catch {
    // looks only
  }
  speak(entity, rec, "whimper", 0.6);
  if (rec.down.life <= 0) die(rec, entity, `was killed where it lay${attacker.typeId === "minecraft:player" ? ` by ${attacker.name}` : ""}`);
  else save();
}

world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (hitEntity?.typeId === DRAGON) strike(hitEntity, damagingEntity, 4);
});
world.afterEvents.projectileHitEntity.subscribe((event) => {
  const hit = event.getEntityHit()?.entity;
  if (hit?.typeId === DRAGON) strike(hit, event.source, 3);
});

// Golden apple on an unconscious dragon. Returns true if the click was about that.
export function tend(player, entity, rec, item) {
  if (!rec.down) return false;
  if (player.id !== rec.owner && !isAlly(rec.owner, player.id)) {
    player.onScreenDisplay.setActionBar(`§7${rec.name} is unconscious. It is breathing.`);
    return true;
  }
  if (!S.tendItems.includes(item)) {
    player.onScreenDisplay.setActionBar(rec.down.tended ? `§7${rec.name} is resting. It will wake soon.` : `§c${rec.name} is bleeding. §7Tend it with a golden apple.`);
    return true;
  }
  if (rec.down.tended) {
    player.onScreenDisplay.setActionBar(`§7${rec.name} has been tended. Let it rest.`);
    return true;
  }
  consumeHeld(player);
  rec.down.tended = true;
  rec.down.life = S.downedLife;
  rec.down.wakeAt = system.currentTick + (item === "minecraft:enchanted_golden_apple" ? 100 : S.wakeTicks);
  shiftMood(rec, 20);
  if (player.id === rec.owner) rec.bond = Math.min(100, rec.bond + 5);
  sfx(entity.dimension, "random.eat", entity.location, { pitch: 0.6 });
  save();
  player.sendMessage(`§6You tend ${rec.name}'s wounds. §7The bleeding stops. Stay with it until it wakes.`);
  return true;
}

// Once a second: breathing, bleeding, waking, bleeding out; and bodies crumbling when their time is up
export function downedTick() {
  const now = system.currentTick;
  for (const rec of Object.values(store.data.dragons)) {
    if (!rec.down) continue;
    const entity = entityOf(rec);
    if (!entity) continue;
    const at = entity.location;
    if (now % 60 < 20) noise(entity, "breathe", 1, rec.down.tended ? 0.8 : 1.3); // you can hear it breathing: fast and shallow until tended
    if (rec.down.tended) {
      if (rec.down.wakeAt === undefined) rec.down.wakeAt = now + S.wakeTicks; // (the world was reloaded while it rested)
      if (now >= rec.down.wakeAt) wake(rec, entity);
      continue;
    }
    try {
      entity.dimension.spawnParticle("minecraft:redstone_ore_dust_particle", { x: at.x + Math.random() - 0.5, y: at.y + 0.3, z: at.z + Math.random() - 0.5 });
    } catch {
      // particle name differs on this version
    }
    if (!isOnline(rec.owner)) continue;
    rec.down.bled += 20;
    if (rec.down.bled === Math.floor(S.bleedOutTicks / 2 / 20) * 20) ownerOf(rec)?.sendMessage(`§c${rec.name}'s breathing is getting shallow. §7It needs tending.`);
    if (rec.down.bled >= S.bleedOutTicks) die(rec, entity, "bled out");
    else if (rec.down.bled % 600 === 0) save();
  }

  // The dead
  const day = world.getAbsoluteTime();
  let fighting = false;
  try {
    fighting = !!getState().active;
  } catch {
    // state not ready
  }
  let bodies = [];
  try {
    bodies = world.getDimension("overworld").getEntities({ type: DRAGON });
  } catch {
    return;
  }
  for (const body of bodies) {
    const until = body.getDynamicProperty(CORPSE);
    if (until === undefined) continue;
    setProp(body, "siege:pose", 3);
    if (fighting || day < until) continue; // bodies stay on the field until the battle is over
    try {
      const at = body.location;
      for (let i = 0; i < 12; i++) body.dimension.spawnParticle("minecraft:basic_smoke_particle", { x: at.x + Math.random() * 3 - 1.5, y: at.y + Math.random(), z: at.z + Math.random() * 3 - 1.5 });
      sfx(body.dimension, "dig.sand", at, { pitch: 0.5 });
    } catch {
      // looks only
    }
    body.remove();
  }
}

export const isCorpse = (entity) => {
  try {
    return entity.getDynamicProperty(CORPSE) !== undefined;
  } catch {
    return false;
  }
};
