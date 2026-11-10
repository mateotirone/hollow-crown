// Coins in hand and in the strongbox.
//
// Coins are real items: the Regal (siege:coin) and the Gold Regal (siege:gold_coin, worth 64). You can drop
// them, hand them over and lose them. The strongbox is a number kept on the player; it is opened from the
// Keep Banner menu, and shops on your own land draw on it once your pockets are empty.

import { GameMode, ItemStack } from "@minecraft/server";
// siege/ files import this one, so nothing from siege/api.js may be used while this file loads (only inside functions)
import { countItem, takeItems, settlementAt, keepOf } from "../siege/api.js";
import { moduleStore } from "../core/store.js";
import { emit } from "../core/events.js";
import { COIN, GOLD, ECON } from "./config.js";
import { asCoins, fromEmeralds } from "./rules.js";

const BANK = "siege:economy_bank";
const ledger = moduleStore("siege:economy", () => ({ minted: 0, sunk: 0 })); // world totals, for tuning

const creative = (player) => player.getGameMode() === GameMode.Creative;

// Coins carried, counted in Regals
export const carried = (player) => countItem(player, COIN) + ECON.goldWorth * countItem(player, GOLD);

export const banked = (player) => Number(player.getDynamicProperty(BANK) ?? 0);
const setBank = (player, amount) => player.setDynamicProperty(BANK, Math.max(0, Math.floor(amount)));

// On your own land the strongbox is within reach
export function atHome(player) {
  try {
    return player.dimension.id === "minecraft:overworld" && !!keepOf(player.id) && settlementAt(player.location) === player.id;
  } catch {
    return false;
  }
}

// What a shop here can take from you: pockets, plus the strongbox on your own land
export const funds = (player) => carried(player) + (atHome(player) ? banked(player) : 0);

function hand(player, typeId, count) {
  const inv = player.getComponent("minecraft:inventory").container;
  while (count > 0) {
    const n = Math.min(64, count);
    count -= n;
    const left = inv.addItem(new ItemStack(typeId, n));
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

// Puts coins in the player's pockets, as few items as possible. Not counted as new money.
export function giveCoins(player, amount) {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  const { gold, coin } = asCoins(amount);
  if (gold) hand(player, GOLD, gold);
  if (coin) hand(player, COIN, coin);
}

// Takes coins from the pockets, breaking Gold Regals for change. false (and takes nothing) if short.
export function takeCoins(player, amount) {
  amount = Math.floor(amount);
  if (amount <= 0) return true;
  const have = carried(player);
  if (have < amount) return false;
  const small = countItem(player, COIN);
  if (small >= amount) return takeItems(player, COIN, amount);
  const gold = countItem(player, GOLD);
  takeItems(player, COIN, small);
  takeItems(player, GOLD, gold);
  giveCoins(player, have - amount);
  return true;
}

// ---------- what every feature uses ----------

// charge(player, amount): takes the price, pockets first and then the strongbox when on your own land.
// true if paid (always true in Creative, which pays nothing). The coins leave the world.
export function charge(player, amount, reason = "shop") {
  amount = Math.ceil(amount);
  if (amount <= 0 || creative(player)) return true;
  if (funds(player) < amount) return false;
  const pocket = Math.min(carried(player), amount);
  takeCoins(player, pocket);
  if (amount > pocket) setBank(player, banked(player) - (amount - pocket));
  ledger.data.sunk += amount;
  ledger.save();
  emit("coinsSpent", { player, amount, reason });
  return true;
}

// pay(player, amount): new coins into the player's pockets (a sale, a reward, a bounty).
export function pay(player, amount, reason = "sale") {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  giveCoins(player, amount);
  ledger.data.minted += amount;
  ledger.save();
  emit("coinsPaid", { player, amount, reason });
}

// dropCoins(dimension, location, amount): new coins on the ground (boss and warlord drops).
export function dropCoins(dimension, location, amount, reason = "drop") {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  const { gold, coin } = asCoins(amount);
  for (let left = gold; left > 0; left -= 64) dimension.spawnItem(new ItemStack(GOLD, Math.min(64, left)), location);
  if (coin) dimension.spawnItem(new ItemStack(COIN, coin), location);
  ledger.data.minted += amount;
  ledger.save();
  emit("coinsPaid", { amount, reason });
}

// Coin stacks for a loot list: coinStacks(200) -> [ItemStack(gold x3), ItemStack(coin x8)]
export function coinStacks(amount) {
  const { gold, coin } = asCoins(Math.floor(amount));
  const out = [];
  for (let left = gold; left > 0; left -= 64) out.push(new ItemStack(GOLD, Math.min(64, left)));
  if (coin) out.push(new ItemStack(COIN, coin));
  return out;
}

// Prices that were written in emeralds (one emerald = ECON.perEmerald coins): the same calls, in the old unit
export const fundsE = (player) => Math.floor(funds(player) / ECON.perEmerald);
export const chargeE = (player, emeralds, reason) => charge(player, fromEmeralds(emeralds), reason);
export const payE = (player, emeralds, reason) => pay(player, fromEmeralds(emeralds), reason);

// Pockets to strongbox and back. Both return the amount actually moved.
export function deposit(player, amount) {
  amount = Math.min(Math.floor(amount), carried(player));
  if (amount <= 0 || !takeCoins(player, amount)) return 0;
  setBank(player, banked(player) + amount);
  return amount;
}

export function withdraw(player, amount) {
  amount = Math.min(Math.floor(amount), banked(player));
  if (amount <= 0) return 0;
  setBank(player, banked(player) - amount);
  giveCoins(player, amount);
  return amount;
}

export const totals = () => ({ ...ledger.data });
