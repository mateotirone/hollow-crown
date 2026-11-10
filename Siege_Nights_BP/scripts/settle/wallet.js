// What the Mason and the Foundation Stone charge in. Today that is emeralds. The world currency
// (its own design thread) replaces it in one call, and every price in config.js is then in that unit:
//   setWallet({ one: "mark", many: "marks", icon, count: (player) => n, take: (player, n) => true | false })

import { countItem, takeItems } from "../siege/api.js";

let wallet = {
  one: "emerald", many: "emeralds", icon: "textures/items/emerald",
  count: (player) => countItem(player, "minecraft:emerald"),
  take: (player, amount) => takeItems(player, "minecraft:emerald", amount), // free in Creative
};

export const setWallet = (next) => { wallet = { ...wallet, ...next }; };
export const purse = (player) => wallet.count(player);
export const charge = (player, amount) => amount <= 0 || wallet.take(player, amount);
export const coins = (n) => `${n} ${n === 1 ? wallet.one : wallet.many}`;
export const coinName = () => wallet.many;
export const coinIcon = () => wallet.icon;
