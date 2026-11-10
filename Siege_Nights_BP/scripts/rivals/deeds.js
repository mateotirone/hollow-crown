import { roll, tierForWins } from "./data.js";

// What Rival Lords DO: the pure part (who does what next, what it costs, who wins). Runs in Node too.
// The world side (messages, soldiers, menus) is court.js.
//
// One lord acts every DEEDS.everyDays days, in turn. A deed is one of:
//   march    declares war on a player; their soldiers join the next siege night at that settlement
//   feud     rides against another lord; settled a day later, and players can pay to back a side
//   demand   asks a player for tribute; refuse and they hold a grudge
//   gift     sends a player coin, to win them over
//   pact     offers a player a truce (or an alliance, to a friend)
//   wares    puts new goods on their stall and a new commission on their board
//   rumor    sends a player word of something they have seen or heard (the lore's lines)
//   breach   breaks a pact with a player who has turned on them
// The rule that keeps it fresh: a lord never does the same kind of deed twice running, the realm
// never sees the same kind twice running when there is anything else to do, and a march never comes
// the same way twice running.

export const DEEDS = {
  everyDays: 2, // one deed in the realm per this many days
  marchBuyOff: [48, 96, 160, 256], // coins to turn a march back, by the lord's tier
  marchSpoils: [32, 64, 96, 160], // coins a player wins by beating a march off
  marchHost: [2, 3, 4, 5], // the lord's own soldiers in a march, by tier (the siege army comes too)
  marchWaitDays: 8, // a march that never finds its target at home is called off after this long
  tribute: [24, 48, 80, 128], // coins a demand asks for, by tier
  demandDays: 2, // days to answer a demand
  gift: [12, 20, 32, 48], // coins a lord sends as a gift
  playerGift: [16, 24, 32, 48], // coins a player's gift costs
  playerGiftGain: 8, // relation won by a gift, once a day per lord
  backing: [32, 64, 96, 128], // coins to back a lord in a feud, by that lord's tier
  backingWeight: 3, // how much one player's backing counts (a tier counts 2)
  feudDays: 1, // a feud is settled this many days after it starts
  aid: [1, 2, 3, 4], // soldiers an allied lord sends to your siege night, by tier
  peaceDays: { paid: 4, bought: 4, beaten: 6, won: 4, draw: 2 }, // how long a lord leaves a player alone afterwards
  truceAt: 15, allianceAt: 40, // relation a lord needs before they will swear
  alliancePrice: [40, 80, 120, 200], // coins to seal an alliance, by tier
  oathPenalty: 10, // each oath a player has broken raises what every lord asks of them by this much relation
  breakPact: { lord: -50, others: -10 }, // what breaking your word costs
  commissionLots: 4, // lots a lord buys of their commission before the next wares
};

// How much each temperament likes each kind of deed (data.js temperaments and the lore's tempers)
const W = {
  //           march feud demand gift pact wares
  steady:   [1, 2, 1, 2, 3, 2],
  proud:    [3, 3, 3, 1, 1, 2],
  grasping: [2, 3, 4, 0, 2, 4],
  kindly:   [0, 1, 0, 4, 3, 2],
  kind:     [0, 1, 0, 4, 3, 2],
  devout:   [2, 2, 1, 2, 2, 2],
  wary:     [1, 1, 0, 1, 2, 2],
  bold:     [4, 3, 1, 2, 1, 2],
};
export const DEED_KINDS = ["march", "feud", "demand", "gift", "pact", "wares", "rumor"];
export const TEMPERS = Object.keys(W);

const weighted = (options, seed) => {
  const total = options.reduce((sum, o) => sum + o.w, 0);
  let at = roll(seed) * total;
  for (const o of options) { at -= o.w; if (at < 0) return o.kind; }
  return options[options.length - 1]?.kind;
};

// What this lord could do now. ctx: { relation, pact, peace, atWar, pressed, grudge, hasTarget, lords, feud, oaths }
//   noMarch: someone else decides when lords attack (after the story, the Reach sends them: court.js "lordRaid")
//   atWar: some lord is already marching on that player (one war at a time); pressed: some lord is already waiting on tribute from them
//   relation: with the player they would deal with; pact: "truce" | "alliance" | undefined; peace: true while they have promised to leave that player be
export function deedOptions(lord, ctx) {
  const w = W[lord.temperament] ?? W.steady;
  const r = ctx.relation ?? 0;
  const out = [];
  const add = (kind, weight) => { if (weight > 0) out.push({ kind, w: weight }); };
  if (ctx.hasTarget) {
    if (ctx.pact && r < 0) add("breach", 6);
    if (!ctx.pact && !ctx.peace && !ctx.atWar && !ctx.noMarch && !lord.march && r < 30) {
      const angry = 1 + Math.max(0, -r) / 40 + (ctx.grudge ? 2 : 0);
      // the kind strike nobody first, and are terrible once wronged
      add("march", (w[0] || (r <= -40 || ctx.grudge ? 3 : 0)) * angry);
    }
    if (!ctx.pact && !ctx.peace && !ctx.pressed && !ctx.atWar && !lord.march && r < 40) add("demand", w[2]);
    if (r >= -10) add("gift", w[3] * (r >= 20 ? 1.5 : 1));
    if (r > -40) add("rumor", 2);
    if (!ctx.pact && r >= DEEDS.truceAt + (ctx.oaths ?? 0) * DEEDS.oathPenalty) add("pact", w[4] * 1.5);
  }
  if ((ctx.lords ?? 0) >= 2 && !ctx.feud) add("feud", w[1]);
  add("wares", w[5]);
  return out;
}

// The lord's next deed, or undefined for a quiet day. Never the kind they did last.
export function pickDeed(lord, ctx, seed) {
  let options = deedOptions(lord, ctx).filter((o) => o.kind !== lord.lastDeed);
  const fresh = options.filter((o) => o.kind !== ctx.realmLast);
  if (fresh.length) options = fresh;
  return options.length ? weighted(options, `${seed}|${lord.id}|deed`) : undefined;
}

// Whose turn it is: the lord who has waited longest
export const nextToAct = (lords) => [...lords].sort((a, b) => (a.deedDay ?? -1) - (b.deedDay ?? -1) || (a.id < b.id ? -1 : 1))[0];

// ---------- marches ----------
// How a march comes. `plan` is the siege's war plan for that settlement (siege/warplan.js).
export const MANNERS = {
  gate: { name: "straight at the gate", note: "more of their own soldiers", host: 2, apply() {} },
  hired: {
    name: "with hired swords", note: "a bigger army", host: 0,
    apply(plan) { plan.budget = Math.round(plan.budget * 1.4); if (!plan.grand) plan.faction = "mercenaries"; },
  },
  night: {
    name: "by forced march, from two sides", note: "fast, and from two sides", host: 0,
    apply(plan) {
      for (const m of ["march", "pincer"]) if (!plan.modifiers.includes(m)) plan.modifiers.push(m);
      if (plan.sides.length < 2) plan.sides.push(plan.sides[0] + Math.PI);
    },
  },
};
export const MANNER_IDS = Object.keys(MANNERS);
export function pickManner(lord, seed) {
  const options = MANNER_IDS.filter((m) => m !== lord.lastManner);
  return options[Math.floor(roll(`${seed}|${lord.id}|manner`) * options.length)];
}

// The lord's own soldiers in a march: [{ role, name }], captain last (they come with the final assault)
export function marchHost(lord, manner, vassals = 0) {
  const count = DEEDS.marchHost[lord.tier] + (MANNERS[manner]?.host ?? 0) + Math.min(2, vassals);
  const host = [];
  for (let i = 0; i < count - 1; i++) host.push({ role: "retainer", name: `${lord.plot} Man-at-arms` });
  host.push({ role: lord.role === "marked" ? "sorcerer" : "knight", name: `${lord.name}'s Captain`, captain: true });
  return host;
}

// A proud lord's honour costs more to buy
export const buyOffPrice = (lord, oaths = 0) => Math.round(DEEDS.marchBuyOff[lord.tier] * (lord.temperament === "proud" ? 1.5 : 1) * (1 + 0.5 * oaths));

// What a finished march leaves behind. how: "beaten" (the keep held) | "won" (it fell) | "draw" (dawn came first)
// Returns { relation, peaceDays, spoils, rose }; changes the lord.
export function settleMarch(lord, how) {
  lord.lastManner = lord.march?.manner ?? lord.lastManner;
  delete lord.march;
  const out = { relation: 0, peaceDays: DEEDS.peaceDays[how] ?? 0, spoils: 0, rose: false };
  if (how === "beaten") {
    lord.routs = (lord.routs ?? 0) + 1;
    out.relation = lord.temperament === "bold" ? 20 : -5; // the bold respect whoever gives a good fight
    out.spoils = DEEDS.marchSpoils[lord.tier];
  } else if (how === "won") {
    lord.wins++;
    const tier = tierForWins(lord.wins);
    out.rose = tier !== lord.tier;
    lord.tier = tier;
    out.relation = -10;
  }
  return out;
}

// ---------- feuds ----------
export const vassalsOf = (lord, lords) => lords.filter((l) => l.liege === lord.id);
export const strength = (lord, lords = [], backing = 0) =>
  2 + lord.tier * 2 + lord.wins * 0.3 + (lord.held ?? 0) + vassalsOf(lord, lords).length * 1.5 + backing * DEEDS.backingWeight;

// Who a lord rides against: never the foe they fought last, a rebel goes for their liege first
export function pickFoe(lord, lords, seed) {
  const others = lords.filter((l) => l.id !== lord.id && l.liege !== lord.id); // nobody rides against their own vassal
  const fresh = others.filter((l) => l.id !== lord.lastFoe);
  const pool = fresh.length ? fresh : others;
  if (!pool.length) return undefined;
  const liege = pool.find((l) => l.id === lord.liege);
  if (liege && roll(`${seed}|${lord.id}|rebel`) < 0.5) return liege;
  return pool[Math.floor(roll(`${seed}|${lord.id}|foe`) * pool.length)];
}

// Settle a feud. feud: { a, b, backing: { [lordId]: players who paid } }. Changes both lords; returns { winner, loser, rose }.
export function settleFeud(a, b, feud, lords, seed) {
  const sa = strength(a, lords, feud.backing?.[a.id] ?? 0), sb = strength(b, lords, feud.backing?.[b.id] ?? 0);
  const [winner, loser] = roll(`${seed}|${a.id}|${b.id}|feud`) < sa / (sa + sb) ? [a, b] : [b, a];
  winner.wins++;
  const tier = tierForWins(winner.wins);
  const rose = tier !== winner.tier;
  winner.tier = tier;
  if (winner.liege === loser.id) delete winner.liege; // a rebel who wins is free, and that is all they wanted
  else loser.liege = winner.id; // otherwise the loser kneels: they march when their liege marches
  for (const l of lords) if (l.liege === loser.id && l.id !== winner.id) delete l.liege; // a beaten liege loses their own vassals
  a.lastFoe = b.id; b.lastFoe = a.id;
  return { winner, loser, rose };
}

// ---------- wares ----------
// What lords sell (things the job NPCs do not), and what they commission (paid a little over the job NPCs, a few lots only).
// [item, how many, coins]
export const WARES = [
  ["minecraft:spyglass", 1, 40], ["minecraft:saddle", 1, 96], ["minecraft:name_tag", 1, 64], ["minecraft:lantern", 4, 12],
  ["minecraft:golden_carrot", 8, 40], ["minecraft:ender_pearl", 2, 48], ["minecraft:shield", 1, 24], ["minecraft:book", 4, 16],
  ["minecraft:experience_bottle", 4, 48], ["minecraft:crossbow", 1, 40], ["minecraft:bell", 1, 120], ["minecraft:compass", 1, 30],
  ["minecraft:cake", 1, 16], ["minecraft:candle", 4, 12], ["minecraft:empty_map", 1, 16],
].map(([id, count, price]) => ({ id, count, price }));
export const COMMISSIONS = [
  ["minecraft:wheat", 16, 8], ["minecraft:oak_log", 16, 10], ["minecraft:leather", 8, 11], ["minecraft:cod", 16, 13],
  ["minecraft:coal", 16, 11], ["minecraft:cobblestone", 64, 6], ["minecraft:string", 16, 8], ["minecraft:honey_bottle", 4, 11],
  ["minecraft:bone", 16, 6], ["minecraft:pumpkin", 16, 11],
].map(([id, count, pays]) => ({ id, count, pays }));

// New goods for a lord's stall: three wares and one commission, none of them what they had last time
export function pickWares(lord, seed) {
  const had = new Set([...(lord.wares?.sell ?? []), lord.wares?.want].filter(Boolean));
  const order = (list, salt) => list.map((g) => g.id).filter((id) => !had.has(id))
    .sort((x, y) => roll(`${seed}|${lord.id}|${salt}|${x}`) - roll(`${seed}|${lord.id}|${salt}|${y}`));
  return { sell: order(WARES, "sell").slice(0, 3), want: order(COMMISSIONS, "want")[0], bought: 0 };
}

// What this lord charges this player: friends and sworn allies pay less, the grasping charge more, enemies are turned away
export function warePrice(lord, ware, relation, pact) {
  if (relation <= -40) return undefined;
  const cut = pact === "alliance" ? 0.75 : pact === "truce" || relation >= 40 ? 0.85 : 1;
  return Math.max(1, Math.round(ware.price * cut * (lord.temperament === "grasping" ? 1.15 : 1)));
}

// ---------- pacts ----------
// Which pacts this lord would swear with this player now: [] | ["truce"] | ["truce", "alliance"]
export function pactsOpen(lord, relation, oaths = 0) {
  const need = oaths * DEEDS.oathPenalty;
  if (lord.temperament === "devout" && relation < DEEDS.allianceAt + need) return relation >= DEEDS.truceAt + need ? ["truce"] : [];
  return [relation >= DEEDS.truceAt + need && "truce", relation >= DEEDS.allianceAt + need && "alliance"].filter(Boolean);
}
export const tributeOf = (lord, oaths = 0) => Math.round(DEEDS.tribute[lord.tier] * (1 + 0.5 * oaths));
