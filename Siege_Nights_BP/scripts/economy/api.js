// Public API of the economy. Other features import from here only.
//
//   import { charge, pay, funds, coins, fromEmeralds } from "../economy/api.js";
//
//   funds(player)            the player's Regals: one balance, no pockets or strongbox (Mateo, 2026-11-12)
//   charge(player, n, why?)  take n coins; false and nothing taken if short; always true (and free) in Creative
//   pay(player, n, why?)     give n new coins (a reward or a sale)
//   coins(n)                 "1 Regal" / "12 Regals", for menu text
//   fromEmeralds(e)          an old emerald price in coins (x8); worth(e) is the same as menu text ("16 Regals")
//   chargeE, payE, fundsE    charge / pay / funds for a price still written in emeralds
//   dropCoins(dim, loc, n)   new coins on the ground; coinStacks(n) gives ItemStacks for a loot list
//   carried/balance, giveCoins, takeCoins   lower level: the balance, not counted as new or spent money
//   WALLET                   ready for the Mason's setWallet(): setWallet(WALLET), then multiply its prices by 8
//   ECON, COIN, GOLD, JOBS   the numbers and item ids
//   spawnJobNpc(dim, location, jobId, region?)   put a Farmer, Moneyer ... somewhere (map builders: /scriptevent siege:economy_npc farmer)
// Events (on() from siege/api.js): "coinsPaid" and "coinsSpent" { player, amount, reason }, "goodsSold" { player, job, region, id, count, coins }.

import { ECON } from "./config.js";
import { funds, charge } from "./coins.js";

export { ECON, COIN, GOLD, JOBS, JOB_IDS, REGIONS } from "./config.js";
export { coins, worth, fromEmeralds, payout, cost, regional } from "./rules.js";
export { funds, charge, pay, fundsE, chargeE, payE, dropCoins, coinStacks, carried, balance, banked, robBank, absorb, giveCoins, takeCoins, atHome, totals } from "./coins.js";
export { spawnJobNpc, regionAt, JOB_TAG } from "./shops.js";

export const WALLET = { one: ECON.one, many: ECON.many, icon: ECON.icon, count: funds, take: (player, amount) => charge(player, amount, "mason") };
