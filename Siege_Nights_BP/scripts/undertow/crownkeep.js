// Keeping the Hollow Crown in the world. There is only one Crown (leaveCrown in index.js puts it in
// the Seat's chest once), so it must never be lost for good.
//
// The Crown Stand (Mateo's idea): whenever the Crown is dropped (knocked off a head, dropped when
// the unworthy die, thrown, spilled on death, or given by hc:give_crown), it does not lie on the
// ground as an item. It comes to rest on a small floating stone stand where it fell. The stand
// cannot be hurt, burnt, pushed or cleared away; clicking it takes the Crown.
//   - dropped over lava, or over nothing (the void), there is nowhere to rest: the Crown goes home,
//     back into its chest at the Seat (the "crownLost" event; index.js does the putting back).
//   - if a stand cannot be made, the Crown stays an item and is still looked after: it is swapped
//     for a fresh item every 4 minutes so Minecraft's 5 minute clean-up never takes it, and if it is
//     destroyed while nobody holds it, it goes home.
//   - while its spot is unloaded, nothing happens: it waits there until someone comes back.
//
// All of this is a handful of lookups every 5 seconds, and only while a Crown is lying somewhere.

import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { emit, addMenuLabel } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { load, save } from "./data.js";
import { sfx } from "../core/sfx.js";

export const CROWN_ITEM = "siege:hollow_crown";
export const CROWN_STAND = "siege:crown_stand"; // built by studio/build_crown_stand.py
export const KEEP = {
  checkSeconds: 5, // how often a lying Crown is looked at
  refreshSeconds: 240, // swap it for a fresh item before Minecraft's 5 minute clean-up
  searchRadius: 12, // water or a push may move it; look this far from where it was last seen
  missesToLose: 2, // checks in a row it must be missing before it counts as lost
};
const K = "hc:crown_drops"; // [{ id, dim, x, y, z, age, misses }]

// What has become of a Crown we were keeping an eye on. Pure, so the self-test can check it.
//   found   an item for it is lying within reach of where it was
//   held    a player, a container next to it, or the absent ruler has a Crown, or another one lies about
//   loaded  its spot is loaded right now (if not, it is simply out of sight)
//   misses  how many checks in a row it has already been missing
export function crownFate({ found, held, loaded, misses }) {
  if (found) return "lying";
  if (held) return "held";
  if (!loaded) return "waiting";
  return misses + 1 >= KEEP.missesToLose ? "lost" : "missing";
}
// Where a dropped Crown comes to rest, from the first solid block under it (undefined: nothing
// under it at all). Pure, so the self-test can check it. Returns the stand's height, or undefined
// for "nowhere to rest, send it home".
export function standHeight(ground) {
  if (!ground) return undefined;
  if (/lava/.test(ground.typeId ?? "")) return undefined;
  return ground.y + 1.25;
}
// Seconds the item has been lying loaded -> time to swap it for a fresh one?
export const needsRefresh = (age) => age >= KEEP.refreshSeconds;

let drops = undefined;
const list = () => (drops ??= load(K, []));
const store = () => save(K, list());
const swapping = new Set(); // ids we removed ourselves while refreshing

const isCrown = (stack) => stack?.typeId === CROWN_ITEM;
function stackOf(entity) {
  try { return entity.getComponent("minecraft:item")?.itemStack; } catch { return undefined; }
}

function track(entity) {
  if (list().some((d) => d.id === entity.id)) return;
  const l = entity.location;
  list().push({ id: entity.id, dim: entity.dimension.id, x: l.x, y: l.y, z: l.z, age: 0, misses: 0 });
  store();
}

// The Crown has nowhere to be: unless another Crown is still about, it goes home.
function goHome(d) {
  drops = list().filter((x) => x !== d);
  if (!list().length) emit("crownLost", { dim: d.dim, x: d.x, y: d.y, z: d.z });
}

// The first block under a spot that a Crown could rest on (through air, water and plants), or
// lava, or undefined over the void. Throws if the column is not loaded.
function groundUnder(dim, at) {
  const min = dim.heightRange?.min ?? -64;
  const x = Math.floor(at.x), z = Math.floor(at.z);
  for (let y = Math.min(Math.floor(at.y), (dim.heightRange?.max ?? 320) - 1); y >= Math.max(min, Math.floor(at.y) - 96); y--) {
    const b = dim.getBlock({ x, y, z });
    if (!b) throw new Error("not loaded");
    if (b.isAir || b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water") continue;
    if (b.isLiquid || /lava/.test(b.typeId) || b.isSolid) return { y, typeId: b.typeId };
  }
  return undefined;
}

// Put a dropped Crown item onto a stand where it fell. False if no stand could be made.
function toStand(item) {
  const dim = item.dimension, at = item.location, stack = stackOf(item);
  const y = standHeight(groundUnder(dim, at));
  if (y === undefined) {
    swapping.add(item.id);
    item.remove();
    goHome({ dim: dim.id, x: at.x, y: at.y, z: at.z });
    store();
    return true;
  }
  const spot = { x: Math.floor(at.x) + 0.5, y, z: Math.floor(at.z) + 0.5 };
  const stand = dim.spawnEntity(CROWN_STAND, spot);
  try { stand.setDynamicProperty("hc:crown_lore", JSON.stringify(stack?.getLore() ?? [])); } catch { /* plain crown */ }
  swapping.add(item.id);
  item.remove();
  track(stand);
  try { sfx(dim, "block.amethyst_block.chime", spot, { volume: 1, pitch: 0.6 }); } catch { /* quiet */ }
  return true;
}

// Every Crown that turns into an item on the ground, however it got there.
world.afterEvents.entitySpawn.subscribe((e) => {
  const ent = e.entity;
  try {
    if (ent?.typeId !== "minecraft:item" || !isCrown(stackOf(ent))) return;
    let placed = false;
    try { placed = toStand(ent); } catch { /* not loaded enough: keep it as an item */ }
    if (!placed && ent.isValid) track(ent);
  } catch { /* gone again already */ }
});

// Clicking the stand takes the Crown, straight into your inventory.
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== CROWN_STAND) return;
  e.cancel = true;
  const p = e.player, stand = e.target;
  system.run(() => takeFromStand(p, stand));
});

function takeFromStand(p, stand) {
  if (!stand.isValid) return;
  const crown = new ItemStack(CROWN_ITEM, 1);
  try { const lore = JSON.parse(stand.getDynamicProperty("hc:crown_lore") ?? "[]"); if (lore.length) crown.setLore(lore); } catch { /* plain crown */ }
  const inv = p.getComponent("inventory")?.container;
  if (!inv || inv.emptySlotsCount === 0) return void p.onScreenDisplay.setActionBar("§5Your hands are full. Make room to take the Hollow Crown.");
  inv.addItem(crown);
  drops = list().filter((x) => x.id !== stand.id);
  store();
  swapping.add(stand.id);
  const at = stand.location;
  stand.remove();
  try { sfx(p.dimension, "block.amethyst_block.break", at, { volume: 1, pitch: 0.5 }); } catch { /* quiet */ }
  p.onScreenDisplay.setActionBar("§dYou take the Hollow Crown.");
}

addMenuLabel({ entity: CROWN_STAND, hint: "Click: take the Hollow Crown" });

// Picked up, burnt, unloaded...: look two ticks later, when a pickup has landed in an inventory.
world.afterEvents.entityRemove.subscribe((e) => {
  if (swapping.delete(e.removedEntityId)) return;
  const d = list().find((x) => x.id === e.removedEntityId);
  if (d) system.runTimeout(() => { if (list().includes(d)) check(d, 0); }, 2);
}, { entityTypes: ["minecraft:item", CROWN_STAND] });

function hasCrown(container) {
  if (!container) return false;
  for (let i = 0; i < container.size; i++) if (isCrown(container.getItem(i))) return true;
  return false;
}

function someoneHasIt(dim, at) {
  for (const p of world.getAllPlayers()) {
    try {
      if (hasCrown(p.getComponent("inventory")?.container)) return true;
      const eq = p.getComponent("equippable");
      if (isCrown(eq?.getEquipment(EquipmentSlot.Head)) || isCrown(eq?.getEquipment(EquipmentSlot.Offhand))) return true;
      if (isCrown(p.getComponent("cursor_inventory")?.item)) return true;
    } catch { /* leaving */ }
  }
  // The Hollow's ruler wears it; if they are offline, it is on their head somewhere.
  try {
    const w = load("hc:hollow_warden", {});
    if (w.id && !world.getAllPlayers().some((p) => p.id === w.id)) return true;
  } catch { /* no ruler */ }
  // A hopper or chest right where it lay may have taken it.
  if (dim && at) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -2; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      try {
        const b = dim.getBlock({ x: Math.floor(at.x) + dx, y: Math.floor(at.y) + dy, z: Math.floor(at.z) + dz });
        if (hasCrown(b?.getComponent("inventory")?.container)) return true;
      } catch { /* unloaded */ }
    }
  }
  return false;
}

function spotLoaded(dim, d) {
  try {
    const r = dim.heightRange ?? { min: -64, max: 320 };
    const y = Math.max(r.min, Math.min(r.max - 1, Math.floor(d.y)));
    return !!dim.getBlock({ x: Math.floor(d.x), y, z: Math.floor(d.z) });
  } catch {
    return false;
  }
}

function findNear(dim, d) {
  try {
    const taken = new Set(list().map((x) => x.id));
    const near = { location: { x: d.x, y: d.y, z: d.z }, maxDistance: KEEP.searchRadius };
    return dim.getEntities({ ...near, type: CROWN_STAND }).find((e) => !taken.has(e.id))
      ?? dim.getEntities({ ...near, type: "minecraft:item" }).find((e) => !taken.has(e.id) && isCrown(stackOf(e)));
  } catch {
    return undefined;
  }
}

// Swap a lying Crown for a fresh copy in the same spot, so Minecraft's item clean-up never takes it.
function refresh(ent, d) {
  const stack = stackOf(ent)?.clone() ?? new ItemStack(CROWN_ITEM, 1);
  const at = ent.location;
  const fresh = ent.dimension.spawnItem(stack, at);
  try { fresh.clearVelocity(); fresh.teleport(at); } catch { /* fine where it is */ }
  swapping.add(ent.id);
  ent.remove();
  d.id = fresh.id;
  d.age = 0;
}

function check(d, seconds) {
  let dim;
  try { dim = world.getDimension(d.dim); } catch { return; }
  let ent = world.getEntity(d.id);
  if (!ent?.isValid) ent = undefined;
  if (!ent && spotLoaded(dim, d)) {
    ent = findNear(dim, d);
    if (ent) d.id = ent.id;
  }
  const fate = crownFate({
    found: !!ent,
    held: !ent && someoneHasIt(dim, d),
    loaded: !!ent || spotLoaded(dim, d),
    misses: d.misses,
  });
  if (fate === "lying") {
    const l = ent.location;
    Object.assign(d, { x: l.x, y: l.y, z: l.z, misses: 0 });
    d.age += seconds;
    if (ent.typeId === "minecraft:item" && needsRefresh(d.age)) { try { refresh(ent, d); } catch { /* try again next time */ } }
  } else if (fate === "held") {
    drops = list().filter((x) => x !== d);
  } else if (fate === "missing") {
    d.misses++;
  } else if (fate === "lost") {
    goHome(d); // another Crown still lying about (a creative test copy, say) means the Crown is not lost
  }
  store();
}

onTick("undertow:crownkeep", KEEP.checkSeconds * 20, () => {
  if (!list().length) return;
  for (const d of [...list()]) {
    try { check(d, KEEP.checkSeconds); } catch { /* look again next time */ }
  }
});
