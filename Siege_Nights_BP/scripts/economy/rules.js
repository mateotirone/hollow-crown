// The arithmetic of the economy. Pure functions, no Minecraft: they run in Node and in the self-tests.

import { ECON, JOBS } from "./config.js";

// How a region shifts a job's prices: { pays, charges } multipliers
export function regional(job, region) {
  if (job.mint || !region) return { pays: 1, charges: 1 };
  if (job.home?.includes(region)) return { pays: ECON.homePays, charges: ECON.homeCharges };
  if (job.scarce?.includes(region)) return { pays: ECON.scarcePays, charges: ECON.scarceCharges };
  return { pays: 1, charges: 1 };
}

// Appetite: the share of the full price paid for a unit when `before` units were already sold today
export function appetite(good, before) {
  const want = good.want ?? good.lot * ECON.wantLots;
  if (before < want) return 1;
  const step = good.step ?? good.lot * ECON.stepLots;
  const steps = Math.floor((before - want) / step) + 1;
  return Math.max(good.floor ?? ECON.floor, 1 - (good.drop ?? ECON.drop) * steps);
}

// Units of a good one player can sell to one trader in a day before it stops buying: past the point where the price
// hits its floor, ECON.stopLots more lots (or the good's own `stop`). Keeps farms from printing coins forever.
export function stopAt(good) {
  if (good.stop) return good.stop;
  const want = good.want ?? good.lot * ECON.wantLots;
  const step = good.step ?? good.lot * ECON.stepLots;
  const steps = Math.ceil((1 - (good.floor ?? ECON.floor)) / (good.drop ?? ECON.drop) - 1e-9);
  return want + step * steps + good.lot * ECON.stopLots;
}

// Coins paid for selling `count` units when `before` were already sold today (whole coins, rounded down)
export function payout(good, count, before = 0, pays = 1) {
  const unit = (good.price / good.lot) * pays;
  let total = 0;
  for (let i = 0; i < count; i++) total += unit * appetite(good, before + i);
  return Math.floor(total + 1e-9);
}

// Coins charged for `lots` lots (rounded up, never less than 1 a lot)
export const cost = (good, lots, charges = 1) => Math.max(lots, Math.ceil(good.price * charges * lots - 1e-9));

// Coins as the fewest items: { gold, coin }
export const asCoins = (amount) => ({ gold: Math.floor(amount / ECON.goldWorth), coin: amount % ECON.goldWorth });

export const coins = (n) => `${n} ${n === 1 ? ECON.one : ECON.many}`;

// An old emerald price in coins
export const fromEmeralds = (emeralds) => Math.round(emeralds * ECON.perEmerald);

// "16 Regals" for a price that was written as 2 emeralds
export const worth = (emeralds) => coins(fromEmeralds(emeralds));

export const niceName = (id) => id.replace(/^[a-z]+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Every way to buy something from one NPC and sell it straight back to the same kind of NPC in the same
// region at a profit. Must be empty: the self-tests check it.
export function loopholes() {
  const found = [];
  for (const [buyer, a] of Object.entries(JOBS)) {
    for (const [seller, b] of Object.entries(JOBS)) {
      for (const sold of b.sells) {
        const bought = a.buys.find((x) => x.id === sold.id);
        if (!bought) continue;
        for (const region of [undefined, ...new Set([...(a.home ?? []), ...(a.scarce ?? []), ...(b.home ?? []), ...(b.scarce ?? [])])]) {
          const pays = (bought.price / bought.lot) * regional(a, region).pays;
          const charges = (sold.price / sold.lot) * regional(b, region).charges;
          if (pays >= charges) found.push(`${sold.id}: ${seller} charges ${charges}, ${buyer} pays ${pays} in ${region ?? "any region"}`);
        }
      }
    }
  }
  return found;
}
