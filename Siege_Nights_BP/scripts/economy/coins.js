// Regals: one number per player (Mateo, 2026-11-12).
//
// Every Regal a player owns is one virtual balance, kept in the world (not on the player) so it can be robbed
// from their vault's Regal Safe while they are away (vault/index.js). There is no deposit or withdrawal: shops,
// rewards and fees all use the same number. Coin items (siege:coin, siege:gold_coin = 64) still exist as loot on
// the ground and in chests; picked up, they are counted into the balance straight away (absorb()).

import { GameMode, ItemStack } from "@minecraft/server";
// siege/ files import this one, so nothing from siege/api.js may be used while this file loads (only inside functions)
import { countItem, takeItems, settlementAt, keepOf } from "../siege/api.js";
import { moduleStore } from "../core/store.js";
import { emit, applyFilter } from "../core/events.js";
import { COIN, GOLD, ECON } from "./config.js";
import { asCoins, fromEmeralds } from "./rules.js";

const BANK = "siege:economy_bank";
const ledger = moduleStore("siege:economy", () => ({ minted: 0, sunk: 0 })); // world totals, for tuning

const creative = (player) => player.getGameMode() === GameMode.Creative;

// Coin items in the pockets, counted in Regals (only until absorb() turns them into balance)
const inPockets = (player) => countItem(player, COIN) + ECON.goldWorth * countItem(player, GOLD);

const banks = moduleStore("siege:economy_banks", () => ({ of: {} }));
const idOf = (who) => (typeof who === "string" ? who : who.id);
// The balance. Old worlds kept a strongbox number on the player: moved over on first look.
export function banked(who) {
  const id = idOf(who), of = banks.data.of;
  if (of[id] === undefined && typeof who !== "string") {
    let old = 0;
    try { old = Number(who.getDynamicProperty(BANK) ?? 0); who.setDynamicProperty(BANK, undefined); } catch { /* fine */ }
    of[id] = old;
    banks.save();
  }
  return of[id] ?? 0;
}
function setBank(who, amount) {
  banks.data.of[idOf(who)] = Math.max(0, Math.floor(amount));
  banks.save();
}
// Coin items in the pockets become balance. Returns how many Regals came in.
export function absorb(player) {
  if (creative(player)) return 0; // takeItems takes nothing in Creative: don't print money
  const n = inPockets(player);
  if (n <= 0) return 0;
  const small = countItem(player, COIN), gold = countItem(player, GOLD);
  if (small) takeItems(player, COIN, small);
  if (gold) takeItems(player, GOLD, gold);
  setBank(player, banked(player) + n);
  return n;
}
// What the player owns: the one balance (any coin items still in the pockets count too)
export const carried = (player) => banked(player) + inPockets(player);
export const balance = carried;
// Take up to amount out of someone's balance (online or not). Returns what came out.
export function robBank(id, amount) {
  const have = banks.data.of[id] ?? 0;
  const take = Math.max(0, Math.min(have, Math.floor(amount)));
  if (take) setBank(id, have - take);
  return take;
}

// On your own land (kept for callers that ask; the balance itself is reachable anywhere)
export function atHome(player) {
  try {
    return player.dimension.id === "minecraft:overworld" && !!keepOf(player.id) && settlementAt(player.location) === player.id;
  } catch {
    return false;
  }
}

// What a shop can take from you: your whole balance
export const funds = (player) => carried(player);

// Adds to the balance. Not counted as new money.
export function giveCoins(player, amount) {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  setBank(player, banked(player) + amount);
}

// Takes from the balance. false (and takes nothing) if short.
export function takeCoins(player, amount) {
  amount = Math.floor(amount);
  if (amount <= 0) return true;
  absorb(player);
  if (banked(player) < amount) return false;
  setBank(player, banked(player) - amount);
  return true;
}

// ---------- what every feature uses ----------

// charge(player, amount): takes the price from the balance.
// true if paid (always true in Creative, which pays nothing). The coins leave the world.
// A feature may lower or raise the price through the "chargeAmount" filter ({ player, reason }), e.g. a wonder.
export function charge(player, amount, reason = "shop") {
  amount = Math.ceil(amount);
  if (amount <= 0 || creative(player)) return true;
  amount = Math.max(1, Math.ceil(applyFilter("chargeAmount", amount, { player, reason })));
  if (!takeCoins(player, amount)) return false;
  ledger.data.sunk += amount;
  ledger.save();
  emit("coinsSpent", { player, amount, reason });
  return true;
}

// pay(player, amount): new Regals onto the player's balance (a sale, a reward, a bounty).
// A feature may change the amount through the "payAmount" filter ({ player, reason }), e.g. a wonder.
export function pay(player, amount, reason = "sale") {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  amount = Math.max(0, Math.floor(applyFilter("payAmount", amount, { player, reason })));
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

export const totals = () => ({ ...ledger.data });
