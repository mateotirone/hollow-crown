// Giving the five Choir Shards out, and swapping old faded shards in players' packs (rules: shards.js).

import { ItemStack, world } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { hasBeaten } from "./bossCore.js";
import { CHOIR_SHARDS, OLD_SHARD, SHARD_LORE, shardOf, shardsStatus, convertOld, listShards } from "./shards.js";
import { wrap } from "./util.js";

export function shardStack(id, n = 1) {
  try {
    const s = new ItemStack(id, n);
    s.setLore(wrap(SHARD_LORE, 34).map((l) => "§e" + l));
    return s;
  } catch {
    return undefined;
  }
}

function put(player, stack) {
  try {
    const left = player.getComponent("inventory")?.container?.addItem(stack);
    if (left) player.dimension.spawnItem(left, player.location);
    return true;
  } catch {
    return false;
  }
}

function packOf(player) {
  const counts = {};
  try {
    const inv = player.getComponent("inventory")?.container;
    for (let i = 0; inv && i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it) counts[it.typeId] = (counts[it.typeId] ?? 0) + it.amount;
    }
  } catch { /* gone */ }
  return counts;
}

// Everyone who fought gets their own shard (so nobody has to share one out of the chest)
export function giveShards(players, boss) {
  const s = shardOf(boss);
  if (!s) return;
  for (const p of players) {
    try {
      const before = shardsStatus(packOf(p));
      const st = shardStack(s.id);
      if (!st || !put(p, st)) continue;
      const after = shardsStatus({ ...packOf(p), [s.id]: 1 });
      p.sendMessage(`§d${s.who[0].toUpperCase()}${s.who.slice(1)} leaves a Choir Shard behind, and it's yours. §eKeep it!§7 The Tuning Fork needs one shard from each of the five, not two of the same.`
        + (after.missing.length ? ` §7Still to find: ${listShards(after.missing)}.` : " §aYou have all five now: take them to a Siege Workshop with an amethyst shard."));
      if (before.have.some((h) => h.id === s.id)) p.sendMessage("§7(You already had this one. A spare does no harm.)");
    } catch {
      // gone
    }
  }
}

// Old saves: each faded shard becomes a boss's own one the player doesn't have yet
function swapOld() {
  for (const p of world.getAllPlayers()) {
    let inv;
    try { inv = p.getComponent("inventory")?.container; } catch { continue; }
    if (!inv) continue;
    let old = 0;
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it?.typeId === OLD_SHARD) { old += it.amount; inv.setItem(i); }
    }
    if (!old) continue;
    const beaten = CHOIR_SHARDS.filter((s) => { try { return hasBeaten(p, s.boss); } catch { return false; } }).map((s) => s.boss);
    const ids = convertOld(old, beaten, packOf(p));
    for (const id of ids) { const st = shardStack(id); if (st) put(p, st); }
    if (ids.length) p.sendMessage(`§dYour Choir Shards have changed: each now carries the voice of the one it came from.§7 ${SHARD_LORE}`);
  }
}
onTick("bestiary:old_shards", 100, swapOld);

addTests("choir shards", {
  "five shards, one per regional boss, all different": () => {
    assertEqual(new Set(CHOIR_SHARDS.map((s) => s.id)).size, 5);
    for (const b of ["reeve", "huntsman", "bride", "seneschal", "mother"]) assert(shardOf(b), `${b} has no shard`);
  },
  "old shards turn into ones you don't have, beaten bosses first": () => {
    assertEqual(convertOld(2, ["bride"], { "siege:choir_shard_reeve": 1 }).join(), "siege:choir_shard_bride,siege:choir_shard_huntsman");
    assertEqual(convertOld(9, [], {}).length, 5);
    assertEqual(convertOld(1, [], Object.fromEntries(CHOIR_SHARDS.map((s) => [s.id, 1]))).length, 0);
  },
  "the shard list reads like English": () => {
    assertEqual(listShards(CHOIR_SHARDS.slice(0, 3)), "the Reeve's, the Huntsman's and the Bride's");
    assertEqual(listShards(CHOIR_SHARDS.slice(4)), "the Mother's");
  },
});
