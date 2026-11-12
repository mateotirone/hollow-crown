// Trade Outposts: the rules. Pure (no Minecraft imports), so every piece is tested in Node.
//
// An offer:  { id, from, to, give: { id, n } (from -> to each run), get: { id, n } (to -> from each run),
//              every: "half"|"day"|"two", runs (0 = until cancelled), round, by (who wrote these terms), at }
// A route:   the same terms once both sides said yes, plus { a: from, b: to, state: "live"|"paused"|"dormant",
//              why, nextAt, missed, done, onLine: { arrives, toA: {id, n}, toB: {id, n} } | null, clean }
// A ledger:  { [item id]: count }, what a crate holds (or, for an NPC, what it has spare)

import { TRADE, GOODS, goodOf, COIN, GOLD_COIN, GOLD_WORTH, REGION_RATES_DEFAULT, DAY, SECOND } from "./data.js";

// ---------- worth ----------

export function rateOf(rates, region, id) {
  const g = goodOf(id);
  if (!g) return 1;
  if (g.metal) return rates?.[region]?.[g.metal] ?? REGION_RATES_DEFAULT[region]?.[g.metal] ?? 1;
  return g.home?.includes(region) ? 2 : 1;
}

// What one of `id` is worth to a settlement in `region`, in iron ingots: plenty makes it cheap, want makes it dear
export const valueTo = (rates, region, id) => (goodOf(id)?.worth ?? 0) / Math.sqrt(rateOf(rates, region, id));
export const worthOf = (load) => (goodOf(load.id)?.worth ?? 0) * load.n;

// The deal by the Moneyer's ladder: 1 is even, above 1 the proposer does well. For the fairness bar on the board.
export function fairness(offer) {
  const give = worthOf(offer.give), get = worthOf(offer.get);
  return give > 0 ? get / give : Infinity;
}
export function fairnessText(offer) {
  const f = fairness(offer);
  if (f > 1.6) return "§cvery much in your favour";
  if (f > 1.15) return "§ein your favour";
  if (f >= 0.87) return "§afair";
  if (f >= 0.6) return "§ein their favour";
  return "§cvery much in their favour";
}

// ---------- capacity ----------

export const stacksOf = (ledger) => Object.values(ledger).reduce((s, n) => s + Math.ceil(Math.max(0, n) / 64), 0);
export const cargoOf = (stage, wagons = 0) => 64 * ((TRADE.stacksByStage[stage] ?? TRADE.stacksByStage.halt) + TRADE.wagonStacks * Math.min(TRADE.maxWagons, wagons));
export const routesAllowed = (stage) => TRADE.routesByStage[stage] ?? TRADE.routesByStage.halt;

// Why these terms can't be offered, or undefined. ctx: { cargoFrom, cargoTo (items a run), sameRoute (bool) }
export function offerProblem(offer, ctx = {}) {
  if (offer.from === offer.to) return "You can't trade with yourself.";
  for (const side of [offer.give, offer.get]) {
    if (!side || !goodOf(side.id)) return "Only trade goods can go on a route.";
    if (!(side.n >= 1) || side.n !== Math.floor(side.n)) return "Each side needs at least 1 of something.";
  }
  if (offer.give.id === offer.get.id) return "Trading a thing for itself goes nowhere.";
  if (!TRADE.every[offer.every]) return "Pick how often it runs.";
  const cap = Math.min(ctx.cargoFrom ?? Infinity, ctx.cargoTo ?? Infinity);
  if (offer.give.n > cap || offer.get.n > cap) return `A run carries at most ${cap} of a thing each way at these stations.`;
  if (ctx.sameRoute) return "You already have a route with them for that.";
  return undefined;
}

// ---------- the line ----------

// Track length between two stops along laid stretches (Dijkstra), or Infinity when they aren't joined
export function pathLength(data, built, from, to) {
  if (!from || !to) return Infinity;
  if (from === to) return 0;
  const dist = new Map([[from, 0]]);
  const done = new Set();
  for (;;) {
    let at, best = Infinity;
    for (const [k, d] of dist) if (!done.has(k) && d < best) { at = k; best = d; }
    if (at === undefined) return Infinity;
    if (at === to) return best;
    done.add(at);
    for (const seg of data.segments) {
      if (!built[seg.id]) continue;
      const next = seg.from === at ? seg.to : seg.to === at ? seg.from : undefined;
      if (next === undefined || done.has(next)) continue;
      const d = best + (seg.length ?? seg.blocks?.length ?? 0);
      if (d < (dist.get(next) ?? Infinity)) dist.set(next, d);
    }
  }
}

export const travelTicks = (length) => Math.ceil((length / TRADE.trainSpeed + 2 * TRADE.loadSeconds) * SECOND);
export const freightOf = (length) => TRADE.freightBase + Math.ceil(length / TRADE.freightPer);

// ---------- ledgers ----------

export const has = (ledger, id, n) => (ledger[id] ?? 0) >= n;
export function add(ledger, id, n) {
  ledger[id] = (ledger[id] ?? 0) + n;
  if (ledger[id] <= 0) delete ledger[id];
}
export const moneyIn = (ledger) => (ledger[COIN] ?? 0) + GOLD_WORTH * (ledger[GOLD_COIN] ?? 0);

// Take `amount` Regals out of a ledger's coins, breaking a Gold Regal for change. false (and nothing taken) if short.
export function takeMoney(ledger, amount, reserve = {}) {
  const coins = (ledger[COIN] ?? 0) - (reserve[COIN] ?? 0), golds = (ledger[GOLD_COIN] ?? 0) - (reserve[GOLD_COIN] ?? 0);
  if (coins + GOLD_WORTH * golds < amount) return false;
  const fromCoins = Math.min(coins, amount);
  let left = amount - fromCoins;
  add(ledger, COIN, -fromCoins);
  if (left > 0) {
    const g = Math.ceil(left / GOLD_WORTH);
    add(ledger, GOLD_COIN, -g);
    add(ledger, COIN, g * GOLD_WORTH - left);
  }
  return true;
}

// ---------- a run ----------

// Try to send one run. sides: { a: { ledger, pays (freight it owes) }, b: {...} }. Returns { ok, short: "a"|"b",
// what } and, when ok, takes both loads (and the freight) out of the ledgers.
export function depart(route, sides) {
  const need = { a: route.give, b: route.get };
  for (const k of ["a", "b"]) {
    const s = sides[k];
    if (!has(s.ledger, need[k].id, need[k].n)) return { ok: false, short: k, what: need[k].id };
    if (s.pays) {
      const reserve = { [need[k].id]: need[k].n };
      const copy = { ...s.ledger };
      if (!takeMoney(copy, s.pays, reserve)) return { ok: false, short: k, what: "freight" };
    }
  }
  for (const k of ["a", "b"]) {
    add(sides[k].ledger, need[k].id, -need[k].n);
    if (sides[k].pays) takeMoney(sides[k].ledger, sides[k].pays);
  }
  return { ok: true };
}

// After a run leaves (ok) or doesn't (short), where the route stands. Mutates and returns the route.
export function afterTry(route, result, now) {
  if (result.ok) {
    route.state = "live";
    route.why = undefined;
    route.missed = 0;
    route.missedSince = undefined;
    route.clean = (route.clean ?? 0) + 1;
    route.done = (route.done ?? 0) + 1;
    route.nextAt = now + TRADE.every[route.every];
    return route;
  }
  route.state = "paused";
  route.why = result;
  route.clean = 0;
  route.missedSince ??= now;
  route.missed = Math.floor((now - route.missedSince) / DAY);
  if (route.missed >= TRADE.dormantAfter) route.state = "dormant";
  route.nextAt = now + TRADE.retryTicks;
  return route;
}
export const finished = (route) => route.runs > 0 && (route.done ?? 0) >= route.runs;

// ---------- NPC partners ----------

// What an NPC settlement makes in `days`, added to its stock and capped at TRADE.npcStockDays of making
export function npcMake(stock, region, tier, days, rates) {
  for (const g of GOODS) {
    if (!g.make) continue;
    const perDay = g.make * (tier + 1) * rateOf(rates, region, g.id);
    const cap = Math.ceil(perDay * TRADE.npcStockDays);
    stock[g.id] = Math.min(cap, (stock[g.id] ?? 0) + perDay * days);
  }
  return stock;
}

// How an NPC answers terms where it is offer.to (it gets offer.give and pays offer.get).
// npc: { region, temperament, margin? (overrides temperament), bonus (relation, 0..0.15), stock, tier, refuses? }
// -> { kind: "accept" } | { kind: "counter", give, get } | { kind: "reject", why }
export function npcAnswer(npc, offer, rates) {
  if (npc.refuses) return { kind: "reject", why: "They won't deal with you after what happened." };
  const margin = (npc.margin ?? TRADE.npcMargin[npc.temperament] ?? 0.1) - (npc.bonus ?? 0);
  const need = 1 + margin;
  const gets = valueTo(rates, npc.region, offer.give.id) * offer.give.n;
  const unit = valueTo(rates, npc.region, offer.get.id);
  const pays = unit * offer.get.n;
  if (pays <= 0) return { kind: "reject", why: "They have no use for that." };
  // what they can spare each run: a run every half day takes from half a day's making
  const perRun = npc.makes?.(offer.get.id, offer.every);
  if (perRun !== undefined && perRun < 1) return { kind: "reject", why: "They don't have that to spare." };
  const ratio = gets / pays;
  const fair = Math.floor(gets / (need * unit));
  const capN = perRun === undefined ? Infinity : Math.floor(perRun);
  if (npc.temperament === "grasping" && offer.round === 0 && ratio >= need && offer.get.n <= capN) {
    // always counters the first time, shaving a little off
    const n = Math.max(1, Math.floor(offer.get.n * 0.9));
    if (n < offer.get.n) return { kind: "counter", give: { ...offer.give }, get: { id: offer.get.id, n } };
    return { kind: "accept" };
  }
  if (ratio >= need && offer.get.n <= capN) return { kind: "accept" };
  if (npc.temperament === "proud" && ratio < need) return { kind: "reject", why: "They take that as an insult." };
  if (ratio < need * 0.6 && npc.temperament !== "grasping") return { kind: "reject", why: "That's nowhere near worth it to them." };
  let n = Math.min(fair, capN);
  if (n >= 1) return { kind: "counter", give: { ...offer.give }, get: { id: offer.get.id, n } };
  // even one is too much for what's offered: ask for more of what they get instead
  const giveUnit = valueTo(rates, npc.region, offer.give.id);
  const more = Math.ceil((need * unit) / giveUnit);
  return { kind: "counter", give: { id: offer.give.id, n: more }, get: { id: offer.get.id, n: 1 } };
}

// Kingsrest buys any trade good for Regals at a set price (Mateo, 2026-11-12). The price for a load:
export const capitalPrice = (load) => Math.floor(worthOf(load) * TRADE.capitalRate);
export function capitalAnswer(offer) {
  if (offer.get.id !== COIN) return { kind: "counter", give: { ...offer.give }, get: { id: COIN, n: Math.max(1, capitalPrice(offer.give)) } };
  if (goodOf(offer.give.id)?.money) return { kind: "reject", why: "The Exchequer doesn't buy money with money." };
  const price = capitalPrice(offer.give);
  if (price < 1) return { kind: "reject", why: "That load isn't worth a single Regal." };
  if (offer.get.n <= price) return { kind: "accept" };
  return { kind: "counter", give: { ...offer.give }, get: { id: COIN, n: price } };
}

// An offer an NPC writes to a player: its surplus for something it lacks, a little in its favour
export function npcOffer(npc, player, rates) {
  const surplus = GOODS.filter((g) => g.make && !g.money && rateOf(rates, npc.region, g.id) > 1 && (npc.stock?.[g.id] ?? 0) >= 8)
    .sort((x, y) => valueTo(rates, npc.region, y.id) * (npc.stock[y.id] ?? 0) - valueTo(rates, npc.region, x.id) * (npc.stock[x.id] ?? 0))[0];
  if (!surplus) return undefined;
  const wants = GOODS.filter((g) => g.metal && g.metal !== "netherite" && rateOf(rates, npc.region, g.id) < 1 && rateOf(rates, player.region, g.id) >= 1 && !g.id.includes("raw_"))[0]
    ?? GOODS.find((g) => g.id === "minecraft:iron_ingot");
  if (!wants || wants.id === surplus.id) return undefined;
  const margin = (TRADE.npcMargin[npc.temperament] ?? 0.1) / 2;
  const n = Math.max(1, Math.min(64, Math.floor(16 * goodOf(wants.id).worth / goodOf(surplus.id).worth) || 1));
  const giveValue = valueTo(rates, npc.region, surplus.id) * n;
  const getN = Math.max(1, Math.round((giveValue * (1 + margin)) / valueTo(rates, npc.region, wants.id)));
  return { give: { id: surplus.id, n }, get: { id: wants.id, n: getN }, every: "day", runs: 0 };
}

// ---------- the works' Supply Line ----------

// How much of what each run takes from a party's Exports: { [id]: n }
export function needsOf(routes, party) {
  const out = {};
  for (const r of routes) {
    if (r.a === party) out[r.give.id] = (out[r.give.id] ?? 0) + r.give.n;
    if (r.b === party) out[r.get.id] = (out[r.get.id] ?? 0) + r.get.n;
  }
  return out;
}

// The works offers `count` of `id`: how many the Exports takes (up to TRADE.supplyRuns runs of need, minus what's in)
export function supplyTake(ledger, needs, id, count) {
  const want = (needs[id] ?? 0) * TRADE.supplyRuns - (ledger[id] ?? 0);
  return Math.max(0, Math.min(count, Math.floor(want)));
}

// ---------- syncing a real crate ----------

// The crate in the world holds `real`; the ledger says it should hold `ledger`; `snap` is what it held at the last
// sync. Returns { add: {id: n}, take: {id: n} } to apply to the crate: whatever runs and the Supply Line changed
// since then. Afterwards: snap = what the crate really holds, ledger = snap + whatever couldn't be put in.
export function crateDelta(ledger, snap) {
  const out = { add: {}, take: {} };
  const ids = new Set([...Object.keys(ledger), ...Object.keys(snap)]);
  for (const id of ids) {
    const d = (ledger[id] ?? 0) - (snap[id] ?? 0);
    if (d > 0) out.add[id] = d;
    else if (d < 0) out.take[id] = -d;
  }
  return out;
}

// ---------- names ----------

export const niceGood = (id) => id.replace(/^[a-z]+:/, "").replace(/^siege:/, "").replace(/_/g, " ").replace(/\bcoin\b/, "Regal").replace(/\bgold Regal\b/, "Gold Regal");
export const loadText = (load) => `${load.n} ${niceGood(load.id)}`;
export const termsText = (offer, giver = "you", taker = "they") => `${giver} send ${loadText(offer.give)}, ${taker} send ${loadText(offer.get)}, ${TRADE.everyNames[offer.every] ?? offer.every}${offer.runs ? `, for ${offer.runs} runs` : ""}`;
