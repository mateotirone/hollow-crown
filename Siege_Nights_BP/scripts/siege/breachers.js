// Battering rams and sappers in raids, and the Battering Ram players drive.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system } from "@minecraft/server";
import { CHARGE, RAM_ENGINE, RAM_TAG, SAPPER_TAG, UNBREAKABLE } from "./constants.js";
import { markWanted } from "./guards.js";
import { keepCenter } from "./keep.js";
import { SETTINGS } from "./settings.js";
import { state } from "./state.js";
import { settlementAt } from "./territory.js";
import { isOnline, ownerOf } from "./util.js";
import { BLAST, DAMAGE, hitWall, lightCharge } from "./walls.js";
import { sfx } from "../core/sfx.js";

// ---------- Breachers: battering rams and sappers ----------

export function breachDirection(entity) {
  const keep = state.keeps[ownerOf(entity)];
  if (keep) {
    const center = keepCenter(keep);
    const dx = center.x - entity.location.x;
    const dz = center.z - entity.location.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d };
  }
  const v = entity.getViewDirection();
  const d = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / d, z: v.z / d };
}

// First solid block in front of an entity, at body height
export function blockAhead(entity, reach, dir = breachDirection(entity)) {
  for (const dy of [0.5, 1.5]) {
    const loc = {
      x: Math.floor(entity.location.x + dir.x * reach),
      y: Math.floor(entity.location.y + dy),
      z: Math.floor(entity.location.z + dir.z * reach),
    };
    const block = entity.dimension.getBlock(loc);
    if (block && !block.isAir && !block.isLiquid && !UNBREAKABLE.includes(block.typeId)) return block;
  }
  return undefined;
}

export function smash(block) {
  const { x, y, z } = block.location;
  block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}

export function ramTick() {
  for (const ram of world.getDimension("overworld").getEntities({ tags: [RAM_TAG] })) {
    try {
      const block = blockAhead(ram, 1.8);
      if (!block) continue;
      sfx(ram.dimension, "random.anvil_land", block.location, { volume: 0.8, pitch: 0.5 });
      hitWall(block, DAMAGE.ram);
    } catch {
      // ram unloaded or gone
    }
  }
}

export function isBuilt(typeId) {
  return typeId.startsWith("siege:") || /brick|planks|cobblestone|wall|fence|door|gate|glass|log|slab|stairs/.test(typeId);
}

export function sapperTick() {
  for (const sapper of world.getDimension("overworld").getEntities({ tags: [SAPPER_TAG] })) {
    try {
      const block = blockAhead(sapper, 1.2);
      if (!block || !isBuilt(block.typeId)) continue;
      // Plant a lit charge at the foot of the wall, then go back to fighting.
      // Break the charge before the fuse runs out to defuse it.
      const spot = sapper.dimension.getBlock({
        x: Math.floor(sapper.location.x), y: Math.floor(sapper.location.y), z: Math.floor(sapper.location.z),
      });
      if (!spot?.isAir) continue;
      spot.setType(CHARGE);
      sapper.removeTag(SAPPER_TAG);
      const dir = breachDirection(sapper);
      lightCharge(spot, { x: dir.x, y: 0, z: dir.z }, BLAST.sapper);
      const owner = ownerOf(sapper);
      const defender = world.getPlayers().find((p) => p.id === owner);
      defender?.onScreenDisplay.setActionBar("§cA sapper planted a charge at your wall! Break it to defuse it!");
    } catch {
      // sapper unloaded or gone
    }
  }
}

// ---------- Battering Ram: a siege engine you drive yourself ----------
// Place it, climb on (click it), steer with WASD, and punch the wall in front to swing the beam.

export const ramReady = new Map(); // ram entity id -> tick when it can swing again

export function ramUnder(player) {
  const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
  return mount?.typeId === RAM_ENGINE ? mount : undefined;
}

export function facing(entity) {
  const yaw = (entity.getRotation().y * Math.PI) / 180;
  return { x: -Math.sin(yaw), z: Math.cos(yaw) };
}

export function swingRam(ram, player) {
  if (system.currentTick < (ramReady.get(ram.id) ?? 0)) return;
  ramReady.set(ram.id, system.currentTick + SETTINGS.ramSwingTicks);
  const dim = ram.dimension;
  dim.runCommand(`playanimation @e[type=${RAM_ENGINE},r=0.5,x=${ram.location.x},y=${ram.location.y},z=${ram.location.z}] animation.siege_ram.strike`);
  const block = blockAhead(ram, 3, facing(ram)); // the ram is big, the beam reaches 3 blocks out
  if (!block) return sfx(dim, "mob.ravager.attack", ram.location, { volume: 0.6, pitch: 0.6 });
  const owner = dim.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  if (owner && !isOnline(owner)) {
    return player.onScreenDisplay.setActionBar(`§c${state.keeps[owner]?.name ?? "The owner"} is away. Their walls can't be touched.`);
  }
  if (owner) markWanted(player, owner);
  system.runTimeout(() => {
    try {
      sfx(dim, "random.anvil_land", block.location, { volume: 1, pitch: 0.4 });
      hitWall(block, DAMAGE.playerRam);
    } catch {
      // block area unloaded
    }
  }, 11); // lands when the beam swings forward
}

world.afterEvents.entityHitBlock.subscribe((event) => {
  const player = event.damagingEntity;
  if (!state || player.typeId !== "minecraft:player") return;
  const ram = ramUnder(player);
  if (ram) swingRam(ram, player);
});

// A freshly placed ram faces the way its builder is looking
world.afterEvents.entitySpawn.subscribe((event) => {
  const ram = event.entity;
  if (ram?.typeId !== RAM_ENGINE) return;
  const builder = ram.dimension.getPlayers({ location: ram.location, maxDistance: 8, closest: 1 })[0];
  if (builder) ram.setRotation({ x: 0, y: builder.getRotation().y });
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  if (event.target?.typeId !== RAM_ENGINE) return;
  event.player.onScreenDisplay.setActionBar("§6Steer with WASD. Punch the wall ahead to ram it. Sneak to get off.");
});
