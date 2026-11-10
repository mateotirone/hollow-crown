// Public API of the economy. Other features import from here only.
//
//   import { charge, pay, funds, coins, fromEmeralds } from "../economy/api.js";
//
//   funds(player)            coins a shop here can take: pockets, plus the strongbox on the player's own land
//   charge(player, n, why?)  take n coins; false and nothing taken if short; always true (and free) in Creative
//   pay(player, n, why?)     give n new coins (a reward or a sale)
//   coins(n)                 "1 Regal" / "12 Regals", for menu text
//   fromEmeralds(e)          an old emerald price in coins (x8)
//   carried, banked, giveCoins, takeCoins   lower level: pockets and strongbox, not counted as new or spent money
//   WALLET                   ready for the Mason's setWallet(): setWallet(WALLET), then multiply its prices by 8
//   ECON, COIN, GOLD, JOBS   the numbers and item ids
//   spawnJobNpc(dim, location, jobId, region?)   put a Farmer, Moneyer ... somewhere (map builders: /scriptevent siege:economy_npc farmer)
// Events (on() from siege/api.js): "coinsPaid" and "coinsSpent" { player, amount, reason }, "goodsSold" { player, job, region, id, count, coins }.

import { ECON } from "./config.js";
import { funds, charge } from "./coins.js";

export { ECON, COIN, GOLD, JOBS, JOB_IDS, REGIONS } from "./config.js";
export { coins, fromEmeralds, payout, cost, regional } from "./rules.js";
export { funds, charge, pay, carried, banked, giveCoins, takeCoins, deposit, withdraw, atHome, totals } from "./coins.js";
export { spawnJobNpc, regionAt, JOB_TAG } from "./shops.js";

export const WALLET = { one: ECON.one, many: ECON.many, icon: ECON.icon, count: funds, take: (player, amount) => charge(player, amount, "mason") };
