// The Storehouse (Mateo, 2026-11-13): "a custom storage building at your home, because you're not gonna be able to
// carry everything", "it's gonna have to upgrade with the town", and "right now the storage building spawns
// immediately, so it's usable instantly".
//
// Every settlement gets one with its Hamlet, raised like the Mason's Yard (basebuilds.js raiseBase): on the
// starter village's own "storehouse" ground (a 15 x 15 fixture the town generator keeps beside the Mason's yard),
// or, in a layout that has none, on the nearest free long Medium or Large plot. When the town grows a tier it is
// rebuilt on the same ground at the next level (designs: storehouse_data.js, map/structures/storehouse_skill.py):
//   level 1 Hamlet  Store Shed         27 chests
//   level 2 Town    Storehouse         54 chests
//   level 3 City    Storehouse        108 chests (99 in the Emberwaste)
//   level 4 Castle  Great Storehouse  144 chests (135 in the Emberwaste)
// Inside, the chests stand sideways in 3 x 3 bays between stone pillars (the skill's "storehouse" interior).
//
// Nothing is lost when it grows: before the old building comes down, everything in its chests is carried out
// into stock keepers (invisible, unbreakable 54-slot chest entities, the same siege:grave_keeper the gravestones
// and arena lockers use) waiting at its door, chest by chest; when the new level is up, chest k of the old level
// fills chest k of the new one, slot for slot. Moving items between containers keeps everything about them
// (enchantments, names, wear, contents). The move is saved, so a restart halfway picks it up again.
//
// Goods sent home from a station's Goods Crate (storecrates.js) arrive at the door (the "goods" mark) and go into
// the chests: onto matching stacks first, then into empty slots. What doesn't fit waits at the door until it does.
//
// What other features can use:
//   storehouseOf(owner) -> { level, slotId, origin, forward, style, chests: [{x,y,z}], goods: {x,y,z} } | undefined
//   putInStore(owner, container) -> number of stacks moved from that container into the Storehouse (loaded only)
//   on("storehouseBuilt", ({ owner, level, chests }))
//
// Test: /scriptevent siege:storehouse [info | grow | fill]   (grow: rebuild at the next level; fill: a test stack in every chest)

import { world, system, ItemStack } from "@minecraft/server";
import { on, emit, onTick, isReady, moduleStore } from "../siege/api.js";
import { frameFor, toWorld } from "../townhall/halls.js";
import { risingAt } from "./plans.js";
import { STOREHOUSE_DESIGNS } from "./storehouse_data.js";
import { townOf, layoutOf, saveTowns, allTowns } from "./founding.js";
import { slotsOf, fixturesOf, seatOnSlot } from "./towns.js";
import { raiseBase } from "./basebuilds.js";
import { drawBuilding } from "./buildings.js";
import { STORE, levelFor, storeId, levelOf, chestOrder, fixtureBox, pickStoreSlot } from "./storehouse_rules.js";

const OVERWORLD = "minecraft:overworld";
const KEEPER = "siege:grave_keeper";
const KEEPER_TAG = "hc_store_keeper";
const DIRS = { s: { x: 0, z: 1 }, n: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
const keeperTag = (owner, n) => `hc_store_${owner}_${n}`;

// owner -> { moving?: { from, to, keepers: [n] }, waiting?: [entity tag] } (the Storehouse's own slot lives in the town)
const store = moduleStore("siege:storehouse", () => ({ towns: {} }));
const mine = (owner) => (store.data.towns[owner] ??= {});

const regionOf = (style) => (STOREHOUSE_DESIGNS[style] ? style : "vale");
const tell = (owner, text) => world.getPlayers().find((p) => p.id === owner)?.sendMessage(text);

// The town's Storehouse slot: [slotId, slot state] or undefined
function slotEntry(owner) {
  const town = townOf(owner);
  return Object.entries(town?.slots ?? {}).find(([, s]) => levelOf(s.building));
}
function slotObject(town, id) {
  return town.extraSlots?.[id] ?? slotsOf(layoutOf(town)).find((s) => s.id === id);
}

export function storehouseOf(owner) {
  const town = townOf(owner);
  const e = slotEntry(owner);
  if (!town || !e) return undefined;
  const [slotId, st] = e;
  if (!st.origin || !st.forward) return undefined;
  const level = levelOf(st.building);
  const style = regionOf(st.style ?? town.style);
  const d = STOREHOUSE_DESIGNS[style][storeId(level)];
  const frame = frameFor(st.forward);
  const chests = chestOrder(d).map(([x, y, z]) => toWorld(frame, st.origin, x, y, z));
  const g = d.marks.goods;
  return { level, slotId, origin: st.origin, forward: st.forward, style, chests, goods: toWorld(frame, st.origin, g[0], g[1], g[2]) };
}

const dim = () => world.getDimension(OVERWORLD);
const containerAt = (at) => {
  try { const b = dim().getBlock(at); return b?.typeId === "minecraft:chest" ? b.getComponent("minecraft:inventory")?.container : undefined; } catch { return undefined; }
};
const loaded = (at) => { try { return !!dim().getBlock(at); } catch { return false; } };
const keeperBag = (e) => e?.getComponent("minecraft:inventory")?.container;
function findKeeper(tag, near) {
  try {
    return dim().getEntities({ type: KEEPER, tags: [tag], location: near, maxDistance: 24 })[0];
  } catch { return undefined; }
}
function spawnKeeper(tag, at) {
  const e = dim().spawnEntity(KEEPER, { x: at.x + 0.5, y: at.y + 0.2, z: at.z + 0.5 });
  e.addTag(KEEPER_TAG); e.addTag(tag);
  return e;
}

// Everything in one container into the Storehouse's chests: matching stacks first, then empty slots
export function putInStore(owner, from) {
  const s = storehouseOf(owner);
  if (!s || !from || mine(owner).moving) return 0;
  const bags = s.chests.map(containerAt).filter(Boolean);
  if (!bags.length) return 0;
  let moved = 0;
  for (let i = 0; i < from.size; i++) {
    let item = from.getItem(i);
    if (!item) continue;
    // onto a matching stack
    for (const bag of bags) {
      for (let j = 0; j < bag.size && item; j++) {
        const there = bag.getItem(j);
        if (!there || there.amount >= there.maxAmount || !there.isStackableWith(item)) continue;
        const n = Math.min(item.amount, there.maxAmount - there.amount);
        there.amount += n; bag.setItem(j, there);
        if (n >= item.amount) { from.setItem(i); item = undefined; } else { item.amount -= n; from.setItem(i, item); item = from.getItem(i); }
      }
      if (!item) break;
    }
    // into an empty slot, whole (keeps everything about it)
    if (item) {
      outer: for (const bag of bags) {
        if (!bag.emptySlotsCount) continue;
        for (let j = 0; j < bag.size; j++) if (!bag.getItem(j)) { from.moveItem(i, j, bag); item = undefined; break outer; }
      }
    }
    if (!item) moved++;
  }
  return moved;
}

// ---------- raising ----------

function raiseLevel(owner, level) {
  const town = townOf(owner);
  if (!town || town.lord) return false;
  const id = storeId(level);
  const have = slotEntry(owner);
  if (have) {
    const slot = slotObject(town, have[0]);
    return !!slot && raiseBase(owner, id, slot, { fixed: true, storeLevel: level });
  }
  // a new one: the village's own ground, else a free long Medium or Large plot
  const layout = layoutOf(town);
  const f = fixturesOf(layout, 0).find((x) => x.kind === STORE.fixture);
  if (f) {
    const out = DIRS[f.rotation] ?? DIRS.s;
    const slot = { id: STORE.fixture, size: "L", tier: 0, tags: [], dy: f.dy ?? 0, side: f.rotation, door: out, box: fixtureBox(f, out) };
    town.extraSlots = { ...(town.extraSlots ?? {}), [STORE.fixture]: slot };
    if (raiseBase(owner, id, slot, { fixed: true, storeLevel: level })) return true;
  }
  const taken = new Set(Object.entries(town.slots).filter(([, s]) => s.building || s.base).map(([sid]) => sid));
  const bounds = drawBuilding(id, town.style).bounds();
  const slot = pickStoreSlot(slotsOf(layout), taken, town.tier ?? 0, (s) => !!seatOnSlot(s, bounds));
  return !!slot && raiseBase(owner, id, slot, { fixed: true, storeLevel: level });
}

// Grow to the level the town's tier calls for: carry the stock out first, then rebuild
function grow(owner, { force = false } = {}) {
  const town = townOf(owner);
  if (!town || town.lord) return;
  const m = mine(owner);
  if (m.moving) return;
  const e = slotEntry(owner);
  if (!e) { raiseLevel(owner, levelFor(town.tier ?? 0)); return; }
  const st = e[1];
  const now = levelOf(st.building), want = force ? Math.min(STORE.levels, now + 1) : levelFor(town.tier ?? 0);
  if (want <= now || !st.origin) return;
  if (risingAt(st.origin)) return;
  const s = storehouseOf(owner);
  if (!s || !loaded(s.goods) || s.chests.some((c) => !loaded(c))) { m.wantGrow = true; store.save(); return; } // when someone is there
  m.moving = { from: now, to: want, keepers: [] };
  m.wantGrow = false;
  store.save();
  // carry the stock out: two chests to a keeper, a few chests a tick
  system.runJob((function* () {
    for (let k = 0; k < s.chests.length; k++) {
      const c = containerAt(s.chests[k]);
      if (c && c.emptySlotsCount < c.size) {
        const n = k >> 1, tag = keeperTag(owner, n);
        let keeper = findKeeper(tag, s.goods);
        if (!keeper) { keeper = spawnKeeper(tag, s.goods); m.moving.keepers.push(n); }
        const bag = keeperBag(keeper), off = (k & 1) * 27;
        for (let i = 0; i < c.size; i++) if (c.getItem(i)) c.moveItem(i, off + i, bag);
      }
      if (k % 4 === 3) yield;
    }
    store.save();
    const ok = raiseLevel(owner, want);
    if (!ok) { // no room after all: everything back where it was
      m.moving.to = now;
      unpack(owner);
      return;
    }
    tell(owner, `§6Your Storehouse is being rebuilt bigger.§7 Your stock has been carried out to its door and goes back into the same chests when it is done.`);
  })());
}

// Fill the standing level's chests from the keepers, chest k from keeper k >> 1
function unpack(owner) {
  const m = mine(owner);
  const s = storehouseOf(owner);
  if (!m.moving || !s) return false;
  if (!loaded(s.goods) || s.chests.some((c) => !loaded(c))) return false;
  const keepers = [...m.moving.keepers];
  const found = keepers.map((n) => [n, findKeeper(keeperTag(owner, n), s.goods)]);
  if (found.some(([, e]) => !e)) return false; // not loaded yet
  system.runJob((function* () {
    for (const [n, e] of found) {
      const bag = keeperBag(e);
      for (const half of [0, 1]) {
        const k = n * 2 + half;
        const c = containerAt(s.chests[k]);
        for (let i = 0; i < 27; i++) {
          if (!bag.getItem(half * 27 + i)) continue;
          if (c && !c.getItem(i)) bag.moveItem(half * 27 + i, i, c);
        }
      }
      // anything that found no place (a chest knocked out by hand) goes in by the usual rules
      if (bag.emptySlotsCount < bag.size) putInStore(owner, bag);
      if (bag.emptySlotsCount === bag.size) e.remove();
      else (m.waiting ??= []).push(keeperTag(owner, n));
      yield;
    }
    const to = m.moving.to;
    m.moving = undefined;
    store.save();
    emit("storehouseBuilt", { owner, level: to, chests: s.chests.length });
  })());
  return true;
}

on("settleBuilt", ({ owner, building }) => {
  const level = levelOf(building);
  if (!level) return;
  const st = slotEntry(owner)?.[1];
  if (st) { st.storeLevel = level; saveTowns(); }
  const m = mine(owner);
  if (m.moving) {
    if (!unpack(owner)) m.unpackLater = true;
    store.save();
  } else emit("storehouseBuilt", { owner, level, chests: storehouseOf(owner)?.chests.length ?? 0 });
  const n = storehouseOf(owner)?.chests.length ?? 0;
  tell(owner, level === 1
    ? `§6Your Store Shed is up beside the square:§7 ${n} chests for everything you can't carry. It grows with your town.`
    : `§6Your Storehouse has grown:§7 ${n} chests now, and your stock is back where it was.`);
});

// A new Hamlet raises its Store Shed with the other base buildings; a town that grows a tier rebuilds it
on("townLaidOut", ({ owner, tier }) => {
  const town = townOf(owner);
  if (!town || town.lord) return;
  system.runTimeout(() => {
    try { grow(owner); } catch (e) { console.warn(`[Hollow Crown] storehouse: ${e}`); }
  }, tier === 0 ? 6 : 40);
});

// Every 10 s, for towns whose owner is online: a move waiting to finish, a growth waiting for the ground to load,
// keepers waiting at the door, and settlements founded before the Storehouse existed
onTick("storehouse", 200, () => {
  if (!isReady()) return;
  for (const p of world.getPlayers()) {
    const owner = p.id, town = allTowns()[owner];
    if (!town || town.lord) continue;
    const m = mine(owner);
    try {
      if (m.moving && m.unpackLater && unpack(owner)) m.unpackLater = false;
      else if (m.wantGrow || !slotEntry(owner)) grow(owner);
      else if ((slotEntry(owner)?.[1]?.storeLevel ?? 1) < levelFor(town.tier ?? 0)) grow(owner);
      if (m.waiting?.length && !m.moving) {
        const s = storehouseOf(owner);
        m.waiting = m.waiting.filter((tag) => {
          const e = s && findKeeper(tag, s.goods);
          if (!e) return !!s && !loaded(s.goods); // gone: drop it; not loaded: keep waiting
          putInStore(owner, keeperBag(e));
          if (keeperBag(e).emptySlotsCount === keeperBag(e).size) { e.remove(); return false; }
          return true;
        });
        store.save();
      }
    } catch (e) { console.warn(`[Hollow Crown] storehouse tick: ${e}`); }
  }
});

// Goods waiting at the door (from a station crate) that didn't fit
export function waitAtDoor(owner, tag) {
  const m = mine(owner);
  (m.waiting ??= []).push(tag);
  store.save();
}

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:storehouse") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const cmd = event.message.trim() || "info";
  const owner = player.id;
  const s = storehouseOf(owner);
  if (cmd === "grow") { grow(owner, { force: true }); return player.sendMessage("§7Storehouse: growing a level (if there is one)."); }
  if (cmd === "fill" && s) {
    let n = 0;
    for (const at of s.chests) { const c = containerAt(at); if (c) { c.setItem(0, new ItemStack("minecraft:cobblestone", 1 + (n % 64))); n++; } }
    return player.sendMessage(`§7Storehouse: a test stack in ${n} chests.`);
  }
  const m = mine(owner);
  player.sendMessage(s ? `§7Storehouse level ${s.level} (${s.style}), ${s.chests.length} chests at ${s.origin.x} ${s.origin.y} ${s.origin.z}.${m.moving ? ` Moving to level ${m.moving.to}.` : ""}${m.waiting?.length ? ` ${m.waiting.length} lots waiting at the door.` : ""}`
    : "§7No Storehouse yet.");
});
