// Guards: recruiting, placing, armor upgrades, Wanted players, and guard behaviour.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { applyFilter } from "../core/events.js";
import { BARRACKS, GUARD_GEAR, GUARD_TYPES, WANTED_TAG } from "./constants.js";
import { saveState, state, tracked } from "./state.js";
import { isAlly, settlementAt, tierOf } from "./territory.js";
import { countItem, isOnline, overworld, takeItems } from "./util.js";

// ---------- Guards: Archers hold the walls, Men-at-Arms wait in the Barracks ----------
// Bring an unemployed villager to your Barracks and click it with 5 emeralds to recruit a
// Man-at-Arms (sneak + click for an Archer). Sneak + click your own guard to pick them up,
// then place them wherever you want: Archers stay exactly where you put them, and Men-at-Arms
// report to your nearest Barracks and only come out to fight.

export const GUARD_COST = 5; // emeralds
export const GUARD_LIMIT = { Hamlet: 4, Town: 8, City: 12, Castle: 16 }; // a Sovereign gets 4 more
export const WANTED_TICKS = 6000; // 5 minutes
export const wanted = new Map(); // player id -> { owner, until }

export const guardTag = (owner) => `siege_guard_of_${owner}`;
export const isGuard = (entity) => !!GUARD_TYPES[entity?.typeId];

export function guardOwner(entity) {
  return entity.getTags().find((t) => t.startsWith("siege_guard_of_"))?.slice("siege_guard_of_".length);
}

export function guardCount(owner) {
  return state.guards[owner] ?? 0;
}

export function nearestBarracks(owner, dim, loc) {
  let best;
  let bestDist = Infinity;
  for (const t of tracked[BARRACKS]) {
    if (t.dim !== dim.id || settlementAt(t) !== owner) continue;
    const d = Math.hypot(t.x - loc.x, t.z - loc.z);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

// Give a guard its owner, colors and post
export function enlist(guard, owner, at) {
  guard.addTag(guardTag(owner));
  guard.setDynamicProperty("siege:post", JSON.stringify({ x: at.x, y: at.y, z: at.z }));
  guard.triggerEvent(`siege:color_${state.keeps[owner]?.color ?? 14}`);
}


export const guardLimit = (owner) => applyFilter("guardLimit",
  GUARD_LIMIT[tierOf(state.keeps[owner]).name] + (state.keeps[owner].sovereign ? 4 : 0), { owner });

export function recruitGuard(block, player, item, chosenType) {
  if (settlementAt(block.location) !== player.id) {
    return player.onScreenDisplay.setActionBar("§cOnly the settlement's owner can recruit here.");
  }
  if (countItem(player, "minecraft:emerald") < GUARD_COST && player.getGameMode() !== GameMode.Creative) {
    return player.onScreenDisplay.setActionBar(`§7Bring an unemployed villager here and ${GUARD_COST} emeralds.`);
  }
  const limit = guardLimit(player.id);
  if (guardCount(player.id) >= limit) {
    return player.onScreenDisplay.setActionBar(`§cYour settlement can only keep ${limit} guards. Grow it to recruit more.`);
  }
  const dim = block.dimension;
  const center = { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 };
  const recruit = dim.getEntities({ type: "minecraft:villager_v2", families: ["unskilled"], location: center, maxDistance: 4 })[0];
  if (!recruit) return player.onScreenDisplay.setActionBar("§7There's no unemployed villager next to the Barracks.");

  takeItems(player, "minecraft:emerald", GUARD_COST);
  const type = chosenType ?? (player.isSneaking ? "siege:archer" : "siege:man_at_arms");
  const at = { ...recruit.location };
  const name = recruit.nameTag;
  recruit.remove();
  const guard = dim.spawnEntity(type, at);
  if (name) guard.nameTag = name;
  enlist(guard, player.id, type === "siege:archer" ? at : block.location);
  state.guards[player.id] = guardCount(player.id) + 1;
  saveState();
  dim.playSound("random.levelup", at, { volume: 0.6 });
  dim.spawnParticle("minecraft:villager_happy", { x: at.x, y: at.y + 1.8, z: at.z });
  player.sendMessage(type === "siege:archer"
    ? "§6A new Archer has joined! Sneak + click to pick them up, then place them on your walls."
    : "§6A new Man-at-Arms has joined! They wait at the Barracks and charge out when you're attacked.");
}

// Sneak + click your guard to pick them up
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (!state || !isGuard(target)) return;
  if (!player.isSneaking) return upgradeGuard(target, player, event.beforeItemStack ?? event.itemStack);
  if (guardOwner(target) !== player.id) return player.onScreenDisplay.setActionBar("§cThat guard doesn't serve you.");
  const item = new ItemStack(GUARD_TYPES[target.typeId], 1);
  if (target.nameTag) item.nameTag = target.nameTag;
  const tier = armorTier(target);
  if (tier) item.setLore([`§7Armor: ${GUARD_ARMOR[tier].name}`]);
  target.remove();
  const leftover = player.getComponent("minecraft:inventory").container.addItem(item);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
});

// Placing a guard from your inventory: it serves whoever placed it, and only on their own land
world.afterEvents.entitySpawn.subscribe((event) => {
  const guard = event.entity;
  if (!state || !isGuard(guard) || guardOwner(guard)) return; // recruits are enlisted on the spot
  const player = guard.dimension.getPlayers({ location: guard.location, maxDistance: 8, closest: 1 })[0];
  const land = guard.dimension.id === "minecraft:overworld" ? settlementAt(guard.location) : undefined;
  if (!player || land !== player.id) {
    const token = new ItemStack(GUARD_TYPES[guard.typeId], 1);
    guard.remove();
    if (player) {
      player.getComponent("minecraft:inventory").container.addItem(token);
      player.onScreenDisplay.setActionBar("§cGuards can only be placed inside your own settlement.");
    }
    return;
  }
  const at = guard.typeId === "siege:archer" ? guard.location : nearestBarracks(player.id, guard.dimension, guard.location);
  if (!at) {
    guard.remove();
    player.getComponent("minecraft:inventory").container.addItem(new ItemStack(GUARD_TYPES[guard.typeId], 1));
    return player.onScreenDisplay.setActionBar("§cBuild a Barracks first. Men-at-Arms need somewhere to wait.");
  }
  enlist(guard, player.id, at);
  const placed = placingTier.get(player.id);
  if (placed && system.currentTick - placed.tick < 20) equipGuard(guard, placed.tier);
  placingTier.delete(player.id);
  if (guard.typeId === "siege:man_at_arms") {
    guard.teleport({ x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 });
    player.onScreenDisplay.setActionBar("§6Your Man-at-Arms reports to the Barracks.");
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  const owner = guardOwner(dead);
  if (!state || !owner) return;
  const dim = dead.dimension, at = dead.location;
  system.runTimeout(() => {
    // guard armor stays with the guard: clear any of it that dropped
    for (const drop of dim.getEntities({ type: "minecraft:item", location: at, maxDistance: 4 })) {
      if (drop.getComponent("minecraft:item")?.itemStack.typeId.startsWith(GUARD_GEAR)) drop.remove();
    }
  }, 2);
  state.guards[owner] = Math.max(0, guardCount(owner) - 1);
  saveState();
  world.getPlayers().find((p) => p.id === owner)?.sendMessage("§cOne of your guards has fallen.");
}, { entityTypes: Object.keys(GUARD_TYPES) });

// ---------- Guard armor: click your guard with materials to upgrade them, up to 4 times ----------

// Guards have their own armor line (siege:guardgear_*), never sold or craftable, so they never look like players
export const GUARD_ARMOR = [
  { name: "Gambeson" },
  { name: "Mail and Nasal Helm", item: "minecraft:iron_ingot", cost: 6, label: "6 iron ingots" },
  { name: "Brigandine and Sallet", item: "minecraft:iron_ingot", cost: 12, label: "12 iron ingots" },
  { name: "Half Plate and Bascinet", item: "minecraft:diamond", cost: 4, label: "4 diamonds" },
  { name: "Royal Guard Plate", item: "minecraft:netherite_ingot", cost: 1, label: "1 netherite ingot" },
];
export const ARMOR_SLOTS = { "slot.armor.head": "helmet", "slot.armor.chest": "chestplate", "slot.armor.legs": "leggings", "slot.armor.feet": "boots" };
export const placingTier = new Map(); // player id -> armor tier of the guard item they're placing

export const armorTier = (guard) => guard.getDynamicProperty("siege:armor") ?? 0;

export function equipGuard(guard, tier) {
  guard.setDynamicProperty("siege:armor", tier);
  if (!tier) return;
  for (const [slot, piece] of Object.entries(ARMOR_SLOTS)) guard.runCommand(`replaceitem entity @s ${slot} 0 ${GUARD_GEAR}${tier}_${piece}`);
}

export function upgradeGuard(guard, player, item) {
  if (guardOwner(guard) !== player.id) return player.onScreenDisplay.setActionBar("§cThat guard doesn't serve you.");
  const tier = armorTier(guard);
  const next = GUARD_ARMOR[tier + 1];
  if (!next) return player.onScreenDisplay.setActionBar("§6This guard already wears Royal Guard Plate, the best there is.");
  if (item?.typeId !== next.item) {
    return player.onScreenDisplay.setActionBar(`§7${GUARD_ARMOR[tier].name}. Next: §6${next.name}§7, click with ${next.label}.`);
  }
  if (!takeItems(player, next.item, next.cost)) return player.onScreenDisplay.setActionBar(`§cYou need ${next.label} for ${next.name}.`);
  equipGuard(guard, tier + 1);
  guard.dimension.playSound("armor.equip_netherite", guard.location);
  player.onScreenDisplay.setActionBar(`§6Your guard now wears ${next.name}!`);
}

// Remember the armor on a guard item as it's placed, so the guard comes back wearing it
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const item = event.itemStack;
  if (!item || !Object.values(GUARD_TYPES).includes(item.typeId)) return;
  const line = item.getLore().find((l) => l.startsWith("§7Armor: "));
  const tier = line ? GUARD_ARMOR.findIndex((a) => a.name === line.slice(9)) : 0;
  if (tier > 0) placingTier.set(event.player.id, { tier, tick: system.currentTick });
});

// Anyone who starts trouble on your land is Wanted there for 5 minutes, and your guards hunt them
export function markWanted(player, owner) {
  if (!owner || !state.keeps[owner] || owner === player.id || isAlly(owner, player.id)) return;
  if (!wanted.has(player.id) || wanted.get(player.id).owner !== owner) {
    player.onScreenDisplay.setActionBar(`§cYou are Wanted in ${state.keeps[owner].name}'s settlement! Their guards will attack you.`);
  }
  wanted.set(player.id, { owner, until: system.currentTick + WANTED_TICKS });
}

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;
  if (!state || attacker?.typeId !== "minecraft:player" || !target) return;
  if (isGuard(target)) return markWanted(attacker, guardOwner(target));
  if (target.typeId === "minecraft:player" && target.dimension.id === "minecraft:overworld") {
    const land = settlementAt(target.location);
    if (land && (land === target.id || isAlly(land, target.id))) markWanted(attacker, land);
  }
});

// A raid (or a Wanted player on your land) calls your Men-at-Arms out of the Barracks
export function underAttack(owner) {
  if (state.active && state.besieged.includes(owner)) return true;
  for (const [id, w] of wanted) if (w.owner === owner && w.until > system.currentTick && world.getPlayers().some((p) => p.id === id)) return true;
  return false;
}

export function guardTick() {
  // Wanted players are only fair game on the land they wronged
  for (const player of world.getPlayers()) {
    const w = wanted.get(player.id);
    if (w && w.until <= system.currentTick) wanted.delete(player.id);
    const hunted = w && w.until > system.currentTick && player.dimension.id === "minecraft:overworld"
      && settlementAt(player.location) === w.owner;
    if (hunted) player.addTag(WANTED_TAG);
    else player.removeTag(WANTED_TAG);
  }

  for (const type of Object.keys(GUARD_TYPES)) {
    for (const guard of overworld().getEntities({ type })) {
      try {
        const owner = guardOwner(guard);
        const keep = state.keeps[owner];
        if (!owner) continue;
        // Nobody can hurt your guards while you're away, same as your walls
        if (!isOnline(owner)) guard.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
        if (keep?.sovereign) guard.addEffect("strength", 60, { amplifier: 0, showParticles: false }); // royal guard
        if (keep && guard.getComponent("minecraft:variant")?.value !== keep.color) guard.triggerEvent(`siege:color_${keep.color ?? 14}`);

        const post = JSON.parse(guard.getDynamicProperty("siege:post") ?? "null");
        if (!post) continue;
        const loc = guard.location;
        const away = Math.hypot(loc.x - (post.x + 0.5), loc.z - (post.z + 0.5));
        if (guard.typeId === "siege:archer") {
          if (away > 1.5) guard.teleport({ x: post.x, y: post.y, z: post.z }); // archers hold their spot
        } else if (!underAttack(owner) ? away > 5 : !keep || settlementAt(loc) !== owner) {
          guard.teleport({ x: post.x + 0.5, y: post.y + 1, z: post.z + 0.5 }); // back to the Barracks
        }
      } catch {
        // guard unloaded or gone
      }
    }
  }
}
