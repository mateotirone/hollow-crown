// Wall strength: reinforcement, damage, cracks, repair, blasts and Breaching Charges.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system } from "@minecraft/server";
import { smash } from "./breachers.js";
import { CASTLE_BLOCKS, CHARGE, GATES, REINFORCEABLE, UNBREAKABLE } from "./constants.js";
import { SETTINGS } from "./settings.js";
import { isAlly, settlementAt } from "./territory.js";
import { consumeHeld, isOnline } from "./util.js";

// ---------- Wall strength: reinforcement, damage and repair ----------
// Castle Stone and gates can be reinforced with iron, then diamond, then netherite.
// Siege weapons wear walls down instead of breaking them instantly, and cracks show the damage.

export const REINFORCE_ITEMS = { "minecraft:iron_ingot": 1, "minecraft:diamond": 2, "minecraft:netherite_scrap": 3 };
export const TIER_NAMES = ["Stone", "Iron", "Diamond", "Netherite"];
export const WALL_HP = { castle: [6, 10, 16, 26], gate: [2, 4, 7, 12], otherCastle: 6, other: 3 };
export const DAMAGE = { ram: 1, playerRam: 2 };
// power = damage where it hits, radius = how far it reaches (blocks). Same numbers as the Siege Wall Lab.
export const BLAST = { boulder: { power: 6.5, radius: 1.6 }, sapper: { power: 7, radius: 2 }, charge: { power: 10, radius: 2.3 } };

// Each block's mortar is a little stronger or weaker, fixed per position, so craters come out ragged
export function toughness(loc) {
  const h = Math.sin(loc.x * 12.9898 + loc.y * 78.233 + loc.z * 37.719) * 43758.5453;
  return 0.75 + (h - Math.floor(h)) * 0.5;
}

// Strongest where it hits, fading with distance, reaching deeper in the direction it travelled
export function blastDamage(dim, at, power, radius, intoWall, filter = () => true) {
  const cx = Math.round(at.x), cy = Math.round(at.y), cz = Math.round(at.z);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const block = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
    if (!block || block.isAir || block.isLiquid || UNBREAKABLE.includes(block.typeId) || !filter(block)) continue;
    const ox = block.location.x + 0.5 - at.x, oy = block.location.y + 0.5 - at.y, oz = block.location.z + 0.5 - at.z;
    const dist = Math.hypot(ox, oy, oz);
    const along = ox * intoWall.x + oy * intoWall.y + oz * intoWall.z;
    const reach = radius + Math.max(0, along) * 0.6;
    if (dist > reach) continue;
    const damage = (power * (1 - dist / (reach + 0.6)) * (0.55 + Math.random() * 0.9)) / toughness(block.location);
    if (damage >= 0.5) hitWall(block, damage);
  }
}

export let wallDamage; // "x,y,z" -> damage taken

export function damageMap() {
  wallDamage ??= JSON.parse(world.getDynamicProperty("siege:wall_damage") ?? "{}");
  return wallDamage;
}

export function saveDamage() {
  world.setDynamicProperty("siege:wall_damage", JSON.stringify(wallDamage));
}

export const blockKey = (b) => `${b.location.x},${b.location.y},${b.location.z}`;

export function armorOf(block) {
  return REINFORCEABLE.includes(block.typeId) ? block.permutation.getState("siege:armor") ?? 0 : 0;
}

export function wallHp(block) {
  if (block.typeId === "siege:castle_stone") return WALL_HP.castle[armorOf(block)];
  if (GATES.includes(block.typeId)) return WALL_HP.gate[armorOf(block)];
  if (CASTLE_BLOCKS.includes(block.typeId)) return WALL_HP.otherCastle;
  return WALL_HP.other;
}

export function showCracks(block, damage) {
  if (block.typeId !== "siege:castle_stone") return;
  const frac = damage / wallHp(block);
  const cracks = frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0;
  if (block.permutation.getState("siege:cracks") !== cracks) {
    block.setPermutation(block.permutation.withState("siege:cracks", cracks));
  }
}

// Deal damage to a block. Returns true if it broke.
export function hitWall(block, amount) {
  const map = damageMap();
  const key = blockKey(block);
  const damage = (map[key] ?? 0) + amount;
  const dim = block.dimension;
  const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  dim.spawnParticle("minecraft:large_explosion", center);
  if (damage >= wallHp(block)) {
    delete map[key];
    saveDamage();
    smash(block);
    return true;
  }
  map[key] = damage;
  saveDamage();
  showCracks(block, damage);
  return false;
}

// Returns true if the click was a reinforce or repair (so gates don't also toggle)
export function workOnWall(block, player, item) {
  if (!item || !REINFORCEABLE.includes(block.typeId)) return false;
  const land = settlementAt(block.location);
  const yours = land && (land === player.id || isAlly(land, player.id));

  const tier = REINFORCE_ITEMS[item.typeId];
  if (tier !== undefined) {
    if (!yours) {
      player.onScreenDisplay.setActionBar("§cYou can only reinforce walls on your own land.");
      return true;
    }
    const current = armorOf(block);
    if (current >= tier) {
      player.onScreenDisplay.setActionBar(`§7Already reinforced with ${TIER_NAMES[current]}.`);
      return true;
    }
    if (current !== tier - 1) {
      player.onScreenDisplay.setActionBar(`§7Reinforce with ${TIER_NAMES[current + 1]} first.`);
      return true;
    }
    block.setPermutation(block.permutation.withState("siege:armor", tier));
    consumeHeld(player);
    block.dimension.playSound("random.anvil_use", block.location, { volume: 0.7 });
    player.onScreenDisplay.setActionBar(`§6Reinforced with ${TIER_NAMES[tier]}`);
    return true;
  }

  if (item.typeId === "minecraft:stone_bricks") {
    const map = damageMap();
    const key = blockKey(block);
    if (!map[key] || !yours) return false;
    map[key] = Math.max(0, map[key] - 3);
    if (map[key] === 0) delete map[key];
    saveDamage();
    showCracks(block, map[key] ?? 0);
    consumeHeld(player);
    block.dimension.playSound("dig.stone", block.location);
    player.onScreenDisplay.setActionBar(map[key] ? "§7Patched, but still damaged" : "§aWall fully repaired");
    return true;
  }
  return false;
}

// Nothing in a settlement whose owner is away can be damaged
export function offlineSafe(block) {
  const owner = settlementAt(block.location);
  return !owner || isOnline(owner);
}

// ---------- Breaching Charge: blows a hole in enemy walls ----------

// facing: the way the blast drives (the way you faced when lighting it)
export function lightCharge(block, facing, blast = BLAST.charge) {
  const dim = block.dimension;
  const at = { ...block.location };
  const center = { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 };
  dim.playSound("random.fuse", center);
  let ticks = 0;
  const fuse = system.runInterval(() => {
    ticks += 10;
    try {
      const b = dim.getBlock(at);
      if (!b || b.typeId !== CHARGE) return system.clearRun(fuse); // defused
      dim.spawnParticle("minecraft:basic_smoke_particle", { x: center.x, y: center.y + 0.6, z: center.z });
      if (ticks < SETTINGS.chargeFuseTicks) return;
      system.clearRun(fuse);
      b.setType("minecraft:air");
      dim.createExplosion(center, 2, { breaksBlocks: false, causesFire: false });
      blastDamage(dim, center, blast.power, blast.radius, facing, offlineSafe);
    } catch {
      system.clearRun(fuse);
    }
  }, 10);
}
