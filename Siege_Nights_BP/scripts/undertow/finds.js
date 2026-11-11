// One find at each of the small centre sites (Mateo, 2026-11-11: "One find per site"). Each site has a
// chest in its building (map/structures/hollow_kit.py, SITE_FINDS); the first time each player opens
// it they are handed what was left there, once per player, so on a Realm everyone gets their own.
// The chest itself stays empty for players to use.
//
// Saved: hc:site_finds { playerId: [siteId, ...] }
// Test:  /scriptevent hc:finds_reset   forget your finds (so you can open them again)

import * as mc from "@minecraft/server";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { sfx } from "../core/sfx.js";
import { UNDERTOW_ID } from "./layout.js";
import { SITES } from "./roads.js";
import { SITE_DESIGNS } from "./sites_data.js";
import { load, save, say } from "./data.js";

const { world, system, ItemStack } = mc;
const K_FINDS = "hc:site_finds";

// What each site holds. `at` is the chest's offset from the site's middle (y = 1 is the floor); the
// design must have a chest there (self-test). Items: [id, count, name?, lore?, enchantments?].
export const FINDS = {
  wound_dock: {
    at: [-9, 1, -2],
    line: "Under a tarp at the back of the shed: a Latticewood boat, finished and never launched. Whoever built it is not coming back for it.",
    items: [["siege:lattice_boat", 1, "Unlaunched Boat", "Built on the Wound landing. Never wet."]],
  },
  lattice_gate: {
    at: [-6, 1, -6],
    line: "Hung on two nails in the lodge: an axe kept sharper than anything else here.",
    items: [["minecraft:iron_axe", 1, "Woodcutter's Axe", "Latticewood dulls a blade in a day. Not this one.", [["efficiency", 3], ["unbreaking", 2]]]],
  },
  pilgrims_cross: {
    at: [-10, 1, -3],
    line: "Under the candle ledge, coins left by pilgrims who prayed that the Door would stay shut. Nobody ever came back for them.",
    items: [["siege:coin", 12], ["minecraft:soul_lantern", 1, "Pilgrim's Lantern", "Carried to the Door, and back."]],
  },
  cartmeet: {
    at: [-7, 1, -8],
    line: "In the tally-house: the last load, weighed and never chalked. The Tally will not miss it.",
    items: [["siege:raw_choir_ore", 8]],
  },
  the_seams: {
    at: [0, 1, -8],
    line: "In the winch house, wrapped in oilcloth: a miner's pick, the handle worn to the shape of one hand.",
    items: [["minecraft:iron_pickaxe", 1, "Seamcutter", "It knows where the ore runs.", [["efficiency", 2], ["fortune", 2]]]],
  },
};

// Which find, if any, has its chest at this block. Pure.
export function findAt(x, y, z, sites = SITES) {
  for (const [id, f] of Object.entries(FINDS)) {
    const s = sites.find((q) => q.id === id);
    if (s && s.y !== undefined && s.x + f.at[0] === x && s.y + f.at[1] === y && s.z + f.at[2] === z) return id;
  }
  return undefined;
}

// Whether this player still has this find to collect, and the saved state after they take it. Pure.
export function claim(state, playerId, id) {
  const had = state[playerId] ?? [];
  if (had.includes(id)) return { fresh: false, state };
  return { fresh: true, state: { ...state, [playerId]: [...had, id] } };
}

function makeItem([id, n, name, lore, ench]) {
  const it = new ItemStack(id, n);
  if (name) it.nameTag = `§r§d${name}`;
  if (lore) { try { it.setLore([`§7${lore}`]); } catch { /* plain */ } }
  for (const [type, level] of ench ?? []) {
    try { it.getComponent("minecraft:enchantable")?.addEnchantment({ type: mc.EnchantmentTypes.get(type), level }); } catch { /* left plain */ }
  }
  return it;
}

function give(player, id) {
  const f = FINDS[id], inv = player.getComponent("inventory")?.container;
  for (const spec of f.items) {
    const it = makeItem(spec), left = inv?.addItem(it) ?? it;
    if (left) player.dimension.spawnItem(left, player.location);
  }
  say(player, `§5${f.line}`);
  try { sfx(player.dimension, "random.levelup", player.location, { pitch: 0.6, volume: 0.6 }); } catch { /* quiet */ }
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (!e.isFirstEvent || e.player.dimension.id !== UNDERTOW_ID || e.block.typeId !== "minecraft:chest") return;
  const { x, y, z } = e.block.location, id = findAt(x, y, z);
  if (!id) return;
  const player = e.player;
  system.run(() => {
    const r = claim(load(K_FINDS, {}), player.id, id);
    if (!r.fresh) return;
    save(K_FINDS, r.state);
    give(player, id);
  });
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "hc:finds_reset" || e.sourceEntity?.typeId !== "minecraft:player") return;
  const p = e.sourceEntity, state = load(K_FINDS, {});
  delete state[p.id];
  save(K_FINDS, state);
  say(p, "§7Your finds at the Hollow's sites are forgotten: each chest will give you its find again.");
});

addTests("undertow", {
  "site finds: every find has a chest in its site's design, and gives real items": () => {
    for (const [id, f] of Object.entries(FINDS)) {
      const d = SITE_DESIGNS[id];
      assert(d, `${id} has no design`);
      let chest = false;
      for (const [y, z, x0, n, i] of d.rows) if (y === f.at[1] && z === f.at[2] && x0 <= f.at[0] && f.at[0] < x0 + n && d.palette[i][0] === "minecraft:chest") chest = true;
      assert(chest, `${id}: no chest at ${f.at}`);
      assert(f.items.length > 0 && f.line.length > 20, `${id}: empty find`);
      const s = SITES.find((q) => q.id === id);
      assertEqual(findAt(s.x + f.at[0], s.y + f.at[1], s.z + f.at[2]), id);
    }
  },
  "site finds: once per player, every player gets their own": () => {
    let r = claim({}, "a", "cartmeet");
    assert(r.fresh);
    r = claim(r.state, "a", "cartmeet");
    assert(!r.fresh, "taken twice");
    assert(claim(r.state, "b", "cartmeet").fresh, "a second player gets nothing");
    assert(claim(r.state, "a", "the_seams").fresh, "one find blocks another site");
  },
});
