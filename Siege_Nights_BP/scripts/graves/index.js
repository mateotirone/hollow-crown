// Gravestones (Mateo, 2026-11-12). When a player dies, everything they dropped goes into a gravestone where they
// fell, instead of lying on the ground to burn or vanish. Click the headstone to gather it all back.
//
// Sealed: the grave opens only for its owner for LOCK_MINUTES (data.js); after that, for anyone. The candle beside
// it burns while it is sealed and goes out when it opens. A player killed by another player leaves a grave that is
// open to anyone at once (the killer is told where it is).
//
// How the items get in: vanilla drops them as usual (keepInventory still keeps them), and a moment later every item
// that appeared beside the body since the death is swept into the grave's keeper (siege:grave_keeper, a model-less
// entity with an inventory, like the Sorcerer's satchel). That includes the satchel's hotbar, which
// townhall/spellbar.js drops at the body, so nothing is dropped or kept twice. Items lost to lava or the void before
// they land are gone, as in vanilla.
//
// The build is map/structures/gravestone_build.py (the minecraft-builder skill): headstone, a mound of pale moss, a
// candle and dry grass. Parts only go where the cell is free; the headstone always goes in. Every part is put back
// to air when the grave is emptied, and none of them can be broken while the grave stands.
//
// What other features can use:
//   on("graveDug", ({ player, grave, killer }))       a grave was made (player: the owner, killer: a Player or undefined)
//   on("graveOpened", ({ player, grave, emptied }))   someone gathered from a grave
//   graveCount()                                      graves standing in the world
//
// Test: /scriptevent siege:grave         list the graves in the world
//       /scriptevent siege:grave test    dig a sealed grave of a stranger's in front of you, with a few things in it
//       /scriptevent siege:grave pvp     the same, but open (as if killed by a player)

import { world, system, ItemStack, BlockPermutation, EquipmentSlot } from "@minecraft/server";
import { emit, onTick, moduleStore } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import {
  LOCK_MINUTES, KEEPER, STONE, keeperTag, SWEEP_RADIUS, SWEEP_TICKS, REPLACEABLE, DIM_NAMES,
  facingOf, partsAt, findSpot, mayOpen, waitText, armorSlotOf, killerOf, newGrave,
} from "./data.js";
import "./tests.js";

const store = moduleStore("hc:graves", () => ({ next: 1, graves: {} }));
const graves = () => store.data.graves;

let cellIndex; // "dim|x|y|z" -> grave id, for every block a standing grave placed
const cellKey = (dim, x, y, z) => `${dim}|${x}|${y}|${z}`;
function cells() {
  if (!cellIndex) {
    cellIndex = new Map();
    for (const g of Object.values(graves())) for (const c of g.cells ?? []) cellIndex.set(cellKey(g.dim, c[0], c[1], c[2]), g.id);
  }
  return cellIndex;
}

export const graveCount = () => Object.keys(graves()).length;

function dimOf(id) {
  try {
    return world.getDimension(id);
  } catch {
    return undefined;
  }
}

const say = (player, text) => {
  try {
    player.sendMessage(text);
  } catch {
    // gone
  }
};
const onlinePlayer = (id) => world.getPlayers().find((p) => p.id === id);
const where = (g) => `§f${g.x} ${g.y} ${g.z}§7${DIM_NAMES[g.dim] ?? ""}`;

// ---------- where a player last stood on dry ground (for deaths in lava, deep water or the void) ----------

const lastSafe = new Map(); // player id -> { dim, x, y, z }
onTick("graves", 40, () => {
  for (const p of world.getPlayers()) {
    try {
      if (!p.isOnGround || p.isInWater) continue;
      const feet = p.dimension.getBlock(p.location);
      if (feet?.typeId === "minecraft:lava") continue;
      lastSafe.set(p.id, { dim: p.dimension.id, x: p.location.x, y: p.location.y, z: p.location.z });
    } catch {
      // unloaded
    }
  }
  unsealDue();
});

// ---------- catching what a player dropped ----------

const freshItems = new Map(); // item entity id -> tick it appeared
world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  try {
    if (entity?.typeId !== "minecraft:item") return;
    freshItems.set(entity.id, system.currentTick);
    if (freshItems.size > 400) {
      const old = system.currentTick - 100;
      for (const [id, t] of freshItems) if (t < old) freshItems.delete(id);
    }
  } catch {
    // ignore
  }
});

function itemsBeside(dim, at, since) {
  let found = [];
  try {
    found = dim.getEntities({ type: "minecraft:item", location: at, maxDistance: SWEEP_RADIUS });
  } catch {
    return [];
  }
  return found.filter((e) => (freshItems.get(e.id) ?? -1) >= since);
}

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  if (deadEntity?.typeId !== "minecraft:player") return;
  const player = deadEntity;
  try {
    const death = {
      ownerId: player.id, name: player.name, dim: player.dimension.id,
      at: { x: player.location.x, y: player.location.y, z: player.location.z },
      facing: facingOf(player.getRotation?.().y),
      killer: killerOf(player.id, damageSource?.damagingEntity),
      since: system.currentTick - 1, grave: undefined,
    };
    for (const t of SWEEP_TICKS) system.runTimeout(() => sweep(death, player), t);
  } catch (e) {
    console.warn(`[Hollow Crown] graves: ${e}`);
  }
});

function sweep(death, player) {
  const dim = dimOf(death.dim);
  if (!dim) return;
  const items = itemsBeside(dim, death.at, death.since);
  if (!items.length) return;
  let g = death.grave && graves()[death.grave];
  if (!g) {
    g = dig(death, dim);
    if (!g) return;
    death.grave = g.id;
  }
  const bag = keeperOf(g)?.getComponent("minecraft:inventory")?.container;
  if (!bag) return;
  for (const e of items) {
    try {
      const stack = e.getComponent("minecraft:item")?.itemStack;
      if (!stack) continue;
      const left = bag.addItem(stack);
      if (left) continue; // the grave is full: it stays on the ground
      e.remove();
      freshItems.delete(e.id);
    } catch {
      // picked up or gone already
    }
  }
  if (death.told) return;
  death.told = true;
  tellDug(g, death, player);
}

// ---------- digging and filling in ----------

function kindOf(block) {
  if (!block) return "other";
  const id = block.typeId;
  if (REPLACEABLE.has(id)) return "free";
  if (block.isLiquid || id === "minecraft:water" || id === "minecraft:lava") return "liquid";
  if (block.isAir) return "free";
  return block.isSolid === false ? "other" : "solid";
}

function makeKindAt(dim) {
  return (x, y, z) => {
    try {
      return kindOf(dim.getBlock({ x, y, z }));
    } catch {
      return "other"; // outside the world or unloaded
    }
  };
}

function place(dim, c, states) {
  try {
    const block = dim.getBlock(c);
    if (!block) return false;
    block.setPermutation(BlockPermutation.resolve(c.id, states));
    return true;
  } catch {
    return false;
  }
}

function dig(death, dim) {
  const taken = (x, y, z) => cells().has(cellKey(death.dim, x, y, z));
  let spot = findSpot(death.at, makeKindAt(dim), taken);
  let gdim = dim, gdimId = death.dim;
  const safe = lastSafe.get(death.ownerId);
  if (!spot && safe) {
    const sd = dimOf(safe.dim);
    if (sd) {
      spot = findSpot(safe, makeKindAt(sd), (x, y, z) => cells().has(cellKey(safe.dim, x, y, z)));
      if (spot) { gdim = sd; gdimId = safe.dim; }
    }
  }
  if (!spot) {
    // nowhere good: put the headstone where they fell, over whatever is there (never into the void)
    const r = dim.heightRange ?? { min: -64, max: 320 };
    const y = Math.min(r.max - 2, Math.max(r.min + 1, Math.floor(death.at.y)));
    spot = { x: Math.floor(death.at.x), y, z: Math.floor(death.at.z) };
  }
  const kindAt = makeKindAt(gdim);
  const placed = [];
  for (const c of partsAt(spot, death.facing)) {
    if (c.role !== "stone") {
      if (kindAt(c.x, c.y, c.z) !== "free" || kindAt(c.x, c.y - 1, c.z) !== "solid" || taken(c.x, c.y, c.z)) continue;
    }
    const states = c.role === "stone" ? { "minecraft:cardinal_direction": death.facing } : c.role === "candle" ? { lit: !death.killer, candles: 0 } : {};
    if (place(gdim, c, states)) placed.push([c.x, c.y, c.z, c.id, c.role]);
  }
  if (!placed.some((c) => c[4] === "stone")) return undefined;
  let keeper;
  try {
    keeper = gdim.spawnEntity(KEEPER, { x: spot.x + 0.5, y: spot.y + 0.2, z: spot.z + 0.5 });
  } catch {
    for (const c of placed) place(gdim, { x: c[0], y: c[1], z: c[2], id: "minecraft:air" }, {});
    return undefined;
  }
  const id = store.data.next++;
  keeper.addTag(keeperTag(id));
  keeper.addTag("hc_grave");
  const g = newGrave(id, {
    owner: death.ownerId, name: death.name, dim: gdimId, at: spot, facing: death.facing, cells: placed,
    killer: death.killer?.name, now: Date.now(),
  });
  graves()[id] = g;
  for (const c of placed) cells().set(cellKey(gdimId, c[0], c[1], c[2]), id);
  store.save();
  return g;
}

function keeperOf(g) {
  const dim = dimOf(g.dim);
  try {
    return dim?.getEntities({ type: KEEPER, tags: [keeperTag(g.id)], location: { x: g.x + 0.5, y: g.y + 0.5, z: g.z + 0.5 }, maxDistance: 3 })[0];
  } catch {
    return undefined;
  }
}

function fillIn(g) {
  const dim = dimOf(g.dim);
  for (const [x, y, z, id] of g.cells ?? []) {
    cells().delete(cellKey(g.dim, x, y, z));
    try {
      const b = dim?.getBlock({ x, y, z });
      if (b && b.typeId === id) b.setPermutation(BlockPermutation.resolve("minecraft:air"));
    } catch {
      // unloaded: the parts stay as plain blocks
    }
  }
  try {
    keeperOf(g)?.remove();
  } catch {
    // gone
  }
  delete graves()[g.id];
  store.save();
}

function tellDug(g, death, player) {
  const owner = player?.isValid ? player : onlinePlayer(death.ownerId);
  if (death.killer) {
    if (owner) say(owner, `§7Killed by §f${death.killer.name}§7. Your things lie in a grave at ${where(g)}, §copen to anyone§7. Get there first.`);
    try {
      if (death.killer.isValid) say(death.killer, `§7${death.name}'s grave lies at ${where(g)}. It is open to anyone.`);
    } catch {
      // gone
    }
  } else if (owner) {
    say(owner, `§7Your things lie in a grave at ${where(g)}. Click the headstone to gather them. Only you can open it for §f${LOCK_MINUTES} minutes§7; after that, anyone can.`);
  }
  emit("graveDug", { player: owner, grave: g, killer: death.killer });
}

// ---------- the seal running out ----------

function unsealDue() {
  const now = Date.now();
  let changed = false;
  for (const g of Object.values(graves())) {
    if (!g.openAt || now < g.openAt || g.unsealed) continue;
    const dim = dimOf(g.dim);
    const candle = (g.cells ?? []).find((c) => c[4] === "candle");
    if (candle) {
      let block;
      try {
        block = dim?.getBlock({ x: candle[0], y: candle[1], z: candle[2] });
      } catch {
        block = undefined;
      }
      if (!block) continue; // not loaded: try again later, so the candle goes out
      if (block.typeId === candle[3]) {
        try {
          block.setPermutation(block.permutation.withState("lit", false));
        } catch {
          // fine
        }
      }
    }
    g.unsealed = true;
    changed = true;
    const owner = onlinePlayer(g.owner);
    if (owner) say(owner, `§7Your grave at ${where(g)} is no longer sealed. Anyone can open it now.`);
  }
  if (changed) store.save();
}

// ---------- opening ----------

const SLOT = { Head: EquipmentSlot?.Head ?? "Head", Chest: EquipmentSlot?.Chest ?? "Chest", Legs: EquipmentSlot?.Legs ?? "Legs", Feet: EquipmentSlot?.Feet ?? "Feet" };

function graveAt(block) {
  const id = cells().get(cellKey(block.dimension.id, block.location.x, block.location.y, block.location.z));
  return id !== undefined ? graves()[id] : undefined;
}

function gather(player, g) {
  const bag = keeperOf(g)?.getComponent("minecraft:inventory")?.container;
  if (!bag) {
    say(player, "§7The grave is empty.");
    fillIn(g);
    return;
  }
  const inv = player.getComponent("minecraft:inventory")?.container;
  const eq = player.getComponent("minecraft:equippable");
  const own = player.id === g.owner;
  let moved = 0, left = 0;
  for (let i = 0; i < bag.size; i++) {
    const item = bag.getItem(i);
    if (!item) continue;
    // your own armour goes straight back on, if that slot is bare
    const slot = own ? armorSlotOf(item.typeId) : undefined;
    try {
      if (slot && eq && !eq.getEquipment(SLOT[slot])) {
        eq.setEquipment(SLOT[slot], item);
        bag.setItem(i, undefined);
        moved++;
        continue;
      }
    } catch {
      // fall through to the pack
    }
    const rest = inv?.addItem(item);
    bag.setItem(i, rest);
    if (rest) left++;
    if (!rest || rest.amount < item.amount) moved++;
  }
  if (moved) sfx(player.dimension, "dig.stone", player.location, { pitch: 0.7 });
  const emptied = left === 0;
  if (emptied) {
    say(player, own ? "§7You gather your things. The grave settles back into the earth." : `§7You take what ${g.name} left behind. The grave settles back into the earth.`);
    fillIn(g);
  } else if (moved) say(player, "§7Your pack is full. The rest stays in the grave.");
  else say(player, "§7Your pack is full.");
  if (!own && moved) {
    const owner = onlinePlayer(g.owner);
    if (owner) say(owner, `§7${player.name} has opened your grave at ${where(g)}.`);
  }
  if (moved) emit("graveOpened", { player, grave: g, emptied });
}

world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  if (block?.typeId !== STONE) return;
  const g = graveAt(block);
  if (!g) return say(player, "§7An old headstone. The name has worn away.");
  const now = Date.now();
  if (!mayOpen(g, player.id, now)) {
    return say(player, `§7This is ${g.name}'s grave. It is sealed: only they can open it for another §f${waitText(g.openAt - now)}§7. After that, anyone can.`);
  }
  gather(player, g);
});

// grave parts can't be broken or blown up while the grave stands
world.beforeEvents.playerBreakBlock.subscribe((e) => {
  try {
    const b = e.block;
    if (cells().has(cellKey(b.dimension.id, b.location.x, b.location.y, b.location.z))) {
      e.cancel = true;
      system.run(() => say(e.player, "§7Leave the grave be. Click the headstone instead."));
    }
  } catch {
    // ignore
  }
});

world.beforeEvents.explosion.subscribe((e) => {
  try {
    if (!cells().size) return;
    const id = e.dimension.id;
    const hit = e.getImpactedBlocks();
    const keep = hit.filter((b) => !cells().has(cellKey(id, b.location.x, b.location.y, b.location.z)));
    if (keep.length !== hit.length) e.setImpactedBlocks(keep);
  } catch {
    // ignore
  }
});

// ---------- test and report ----------

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:grave") return;
  const player = e.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const arg = (e.message ?? "").trim();
  if (arg === "test" || arg === "pvp") {
    const rot = player.getRotation?.().y ?? 0;
    const f = facingOf(rot);
    const ahead = { north: [0, -3], south: [0, 3], east: [3, 0], west: [-3, 0] }[f];
    const death = {
      ownerId: "hc_test_stranger", name: "A stranger", dim: player.dimension.id,
      at: { x: player.location.x + ahead[0], y: player.location.y, z: player.location.z + ahead[1] },
      facing: f === "north" ? "south" : f === "south" ? "north" : f === "east" ? "west" : "east", // facing you
      killer: arg === "pvp" ? player : undefined, since: system.currentTick,
    };
    const g = dig(death, player.dimension);
    if (!g) return say(player, "§7No room for a grave there.");
    const bag = keeperOf(g)?.getComponent("minecraft:inventory")?.container;
    for (const [id, n] of [["minecraft:iron_sword", 1], ["minecraft:bread", 12], ["minecraft:iron_helmet", 1], ["minecraft:torch", 32]]) {
      try {
        bag?.addItem(new ItemStack(id, n));
      } catch {
        // fine
      }
    }
    return say(player, arg === "pvp" ? `§7Dug an open grave at ${where(g)}. Click it to take what is inside.` : `§7Dug a stranger's sealed grave at ${where(g)}. It opens to you in ${LOCK_MINUTES} minutes.`);
  }
  const list = Object.values(graves());
  if (!list.length) return say(player, "§7No graves stand in the world.");
  const now = Date.now();
  say(player, `§7${list.length} grave${list.length === 1 ? "" : "s"}:`);
  for (const g of list.slice(0, 20)) say(player, `§7 ${g.name} at ${where(g)}: ${mayOpen(g, "", now) ? "open to anyone" : `sealed for ${waitText(g.openAt - now)}`}`);
});
