// Goods Crates (Mateo picked "chests + send home from stations", 2026-11-13): a barrel beside the post of every
// station a settlement owns. What you put in goes home to your Storehouse on the next goods train: every few
// seconds a crate with something in it is emptied, and the lot arrives at the Storehouse's door the next time
// anyone is there to see it, then goes into the chests (storehouse.js putInStore). Nothing is lost on the way:
//   - the lot is packed into a stock keeper (the invisible 54-slot chest entity the gravestones use) at the crate,
//     and the keeper is saved as a structure in the world (structureManager, entities only, saved with the world)
//     so it can travel to a place that isn't loaded; then the keeper is removed;
//   - at the Storehouse the structure is placed at the door (the "goods" mark), the keeper is found by its tag and
//     emptied into the chests, and the structure is deleted. What doesn't fit waits at the door until it does.
// Moving items between containers keeps everything about them (enchantments, names, wear, contents).
// The crate is a plain barrel; only the one this file placed (its spot is saved) is a Goods Crate.
//
// Test: /scriptevent siege:goods_crate   put a Goods Crate at your feet for your settlement (creative)

import { world, system, BlockPermutation, StructureSaveMode } from "@minecraft/server";
import { onTick, isReady, moduleStore, addMenuLabel } from "../siege/api.js";
import { allSites } from "../trains/station_sites.js";
import { stationById } from "../rails/index.js";
import { storehouseOf, putInStore, waitAtDoor } from "./storehouse.js";
import { STORE, crateSpot } from "./storehouse_rules.js";

const BARREL = "minecraft:barrel";
const KEEPER = "siege:grave_keeper";
const keyOf = (dimId, at) => `${dimId}|${at.x},${at.y},${at.z}`;

// crates: { siteId: { dim, x, y, z, owner } }; lots: [{ id (structure), tag, owner, from (station name), n }]
const store = moduleStore("siege:goods_crates", () => ({ crates: {}, lots: [], next: 1 }));
const crateAt = new Map(); // dim|x,y,z -> siteId (rebuilt from the store)
const index = () => { crateAt.clear(); for (const [id, c] of Object.entries(store.data.crates)) crateAt.set(keyOf(c.dim, c), id); };
index();

const isCrate = (block) => crateAt.has(keyOf(block.dimension.id, block.location));
addMenuLabel({ block: BARREL, where: isCrate, name: "Goods Crate", hint: "Goes home to your Storehouse" });

const tell = (owner, text) => world.getPlayers().find((p) => p.id === owner)?.sendMessage(text);
const bagOf = (e) => e?.getComponent("minecraft:inventory")?.container;

function open(dim, at) {
  try {
    const here = dim.getBlock(at), under = dim.getBlock({ ...at, y: at.y - 1 });
    return !!here && !!under && here.isAir && under.isSolid;
  } catch { return false; }
}

// Put (or put back) the crate beside each built station of a settlement whose post is loaded
function placeCrates() {
  for (const site of allSites()) {
    if (!site.owner || !site.built || !site.forward) continue;
    const st = stationById(site.id);
    if (!st) continue;
    const dim = world.getDimension(site.dim);
    const have = store.data.crates[site.id];
    try {
      if (have) {
        const b = dim.getBlock(have);
        if (!b || b.typeId === BARREL) continue; // not loaded, or standing
        if (b.isAir) { b.setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 })); continue; } // knocked out: back
        delete store.data.crates[site.id]; // built over: find a new spot
      }
      if (!dim.getBlock(st)) continue;
      const at = crateSpot({ x: st.x, y: st.y, z: st.z }, site.forward, (p) => open(dim, p));
      if (!at) continue;
      dim.getBlock(at).setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 }));
      store.data.crates[site.id] = { dim: site.dim, ...at, owner: site.owner };
    } catch (e) { console.warn(`[Hollow Crown] goods crate ${site.id}: ${e}`); }
  }
  index();
  store.save();
}

// Send what's in a loaded crate home
function ship(siteId, c) {
  const dim = world.getDimension(c.dim);
  let block;
  try { block = dim.getBlock(c); } catch { return; }
  if (block?.typeId !== BARREL) return;
  const inv = block.getComponent("minecraft:inventory")?.container;
  if (!inv || inv.emptySlotsCount === inv.size) return;
  const n = store.data.next++;
  const tag = `hc_goods_${n}`, id = `hc_goods:lot_${n}`;
  const keeper = dim.spawnEntity(KEEPER, { x: c.x + 0.5, y: c.y + 0.2, z: c.z + 0.5 });
  keeper.addTag(tag);
  const bag = bagOf(keeper);
  let stacks = 0;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)) { inv.moveItem(i, i, bag); stacks++; }
  try {
    world.structureManager.createFromWorld(id, dim, { x: c.x, y: c.y, z: c.z }, { x: c.x, y: c.y, z: c.z },
      { includeBlocks: false, includeEntities: true, saveMode: StructureSaveMode.World });
  } catch (e) {
    // couldn't pack it for the journey: everything back in the crate
    for (let i = 0; i < bag.size; i++) if (bag.getItem(i)) bag.moveItem(i, i, inv);
    keeper.remove();
    console.warn(`[Hollow Crown] goods crate: ${e}`);
    return;
  }
  keeper.remove();
  const from = stationById(siteId)?.name ?? "your station";
  store.data.lots.push({ id, tag, owner: c.owner, from, n: stacks });
  store.save();
  const p = world.getPlayers().find((pl) => pl.id === c.owner);
  p?.onScreenDisplay.setActionBar(`§6${stacks} stack${stacks === 1 ? "" : "s"} on the goods train home.§7 They'll be in your Storehouse.`);
}

// Lots whose Storehouse is loaded arrive
function deliver() {
  const keep = [];
  for (const lot of store.data.lots) {
    const s = storehouseOf(lot.owner);
    let dim;
    try { dim = world.getDimension("minecraft:overworld"); if (!s || !dim.getBlock(s.goods)) { keep.push(lot); continue; } } catch { keep.push(lot); continue; }
    try {
      world.structureManager.place(lot.id, dim, s.goods, { includeBlocks: false, includeEntities: true });
      world.structureManager.delete(lot.id);
    } catch (e) { console.warn(`[Hollow Crown] goods lot ${lot.id}: ${e}`); keep.push(lot); continue; }
    const keeper = dim.getEntities({ type: KEEPER, tags: [lot.tag], location: s.goods, maxDistance: 4 })[0];
    if (!keeper) continue;
    putInStore(lot.owner, bagOf(keeper));
    const bag = bagOf(keeper);
    if (bag.emptySlotsCount === bag.size) keeper.remove();
    else waitAtDoor(lot.owner, lot.tag);
    tell(lot.owner, bag.emptySlotsCount === bag.size || !keeper.isValid
      ? `§6Goods from ${lot.from} are in your Storehouse.`
      : `§6Goods from ${lot.from} reached your Storehouse,§7 but it is full: what didn't fit waits at its door.`);
  }
  if (keep.length !== store.data.lots.length) { store.data.lots = keep; store.save(); }
}

let turn = 0;
onTick("goods_crates", STORE.crateEvery, () => {
  if (!isReady()) return;
  try {
    if (turn++ % 5 === 0) placeCrates();
    for (const [siteId, c] of Object.entries(store.data.crates)) ship(siteId, c);
    if (store.data.lots.length) deliver();
  } catch (e) { console.warn(`[Hollow Crown] goods crates: ${e}`); }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:goods_crate") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  try { player.dimension.getBlock(at).setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 })); } catch { return; }
  store.data.crates[`test:${at.x},${at.z}`] = { dim: player.dimension.id, ...at, owner: player.id };
  index(); store.save();
  player.sendMessage("§6A Goods Crate at your feet:§7 what you put in goes home to your Storehouse.");
});
