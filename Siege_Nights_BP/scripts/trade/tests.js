import { addTests, assert, assertEqual } from "../core/tests.js";
import { REGIONS } from "../economy/config.js";
import { TRADE_OUTPOST_DESIGNS } from "./outpost_data.js";
import { wingPlan } from "./wing.js";
import { TRADE, GOODS, GOOD_IDS, COIN, GOLD_COIN, DAY, REGION_RATES_DEFAULT } from "./data.js";
import {
  valueTo, fairness, offerProblem, pathLength, travelTicks, takeMoney, moneyIn, depart, afterTry, finished,
  npcMake, npcAnswer, capitalAnswer, capitalPrice, npcOffer, needsOf, supplyTake, crateDelta, cargoOf, loadText, regalWorth, balanceText,
  specialProblem, specialNormal, specialPremium, specialPayFor, npcFill,
} from "./rules.js";

const offer = (give, get, extra = {}) => ({ from: "p:a", to: "l:b", give, get, every: "day", runs: 0, round: 0, ...extra });
const IRON = "minecraft:iron_ingot", GOLD = "minecraft:gold_ingot", DIA = "minecraft:diamond";

addTests("trade", {
  "every region has rates, every good a worth, no good twice": () => {
    for (const r of REGIONS) assert(REGION_RATES_DEFAULT[r], r);
    assertEqual(new Set(GOOD_IDS).size, GOODS.length);
    assert(GOODS.every((g) => g.worth > 0), "worth");
    assert(!GOOD_IDS.some((id) => /choir|crown|heart|sword|pickaxe|helmet|chestplate/.test(id)), "no story items or gear");
  },
  "plenty makes a thing cheap and want makes it dear": () => {
    assert(valueTo({}, "Emberwaste", GOLD) < valueTo({}, "Aldmere Vale", GOLD), "gold in the Emberwaste");
    assert(valueTo({}, "Frostmarch", IRON) > valueTo({}, "Aldmere Vale", IRON), "iron in Frostmarch");
    assertEqual(valueTo({}, "Blackfen", DIA), 32);
  },
  "fairness is by the Moneyer's ladder": () => {
    assertEqual(fairness(offer({ id: IRON, n: 8 }, { id: GOLD, n: 2 })), 1);
    assert(fairness(offer({ id: IRON, n: 8 }, { id: DIA, n: 1 })) > 1, "a steal");
  },
  "bad offers are turned away with a reason": () => {
    assert(offerProblem({ ...offer({ id: IRON, n: 1 }, { id: GOLD, n: 1 }), to: "p:a" }), "self");
    assert(offerProblem(offer({ id: "minecraft:diamond_sword", n: 1 }, { id: GOLD, n: 1 })), "not a good");
    assert(offerProblem(offer({ id: IRON, n: 0 }, { id: GOLD, n: 1 })), "nothing");
    assert(offerProblem(offer({ id: IRON, n: 2 }, { id: IRON, n: 1 })), "same thing");
    assert(offerProblem(offer({ id: IRON, n: 200 }, { id: GOLD, n: 1 }), { cargoFrom: cargoOf("halt"), cargoTo: cargoOf("grand") }), "too big for a halt");
    assertEqual(offerProblem(offer({ id: IRON, n: 20 }, { id: GOLD, n: 4 }), { cargoFrom: 128, cargoTo: 128 }), undefined);
  },
  "the line: shortest laid path, and travel time by distance": () => {
    const data = { segments: [
      { id: "ab", from: "a", to: "b", length: 400 }, { id: "bc", from: "b", to: "c", length: 300 },
      { id: "ac", from: "a", to: "c", length: 1000 }, { id: "cd", from: "c", to: "d", length: 100 },
    ] };
    assertEqual(pathLength(data, { ab: 1, bc: 1, ac: 1 }, "a", "c"), 700);
    assertEqual(pathLength(data, { ac: 1 }, "a", "c"), 1000);
    assertEqual(pathLength(data, { ab: 1, bc: 1 }, "a", "d"), Infinity);
    assertEqual(pathLength(data, {}, "a", "a"), 0);
    assertEqual(travelTicks(1600), (50 + 60) * 20);
    assert(travelTicks(3000) > travelTicks(600), "further takes longer");
  },
  "money comes out of the coins, breaking a Gold Regal for change": () => {
    const l = { [COIN]: 3, [GOLD_COIN]: 1 };
    assert(takeMoney(l, 10), "paid");
    assertEqual(moneyIn(l), 57);
    assertEqual(l[GOLD_COIN], undefined);
    assert(!takeMoney(l, 100), "short");
    assertEqual(moneyIn(l), 57);
  },
  "a run is a fair swap: nothing leaves unless both sides can pay": () => {
    const route = { a: "p:a", b: "p:b", give: { id: IRON, n: 20 }, get: { id: GOLD, n: 4 }, every: "day", runs: 2 };
    const a = { [IRON]: 30 }, b = { [GOLD]: 3 };
    let r = depart(route, { a: { ledger: a }, b: { ledger: b } });
    assert(!r.ok && r.short === "b", "b short");
    assertEqual(a[IRON], 30);
    b[GOLD] = 8;
    r = depart(route, { a: { ledger: a }, b: { ledger: b } });
    assert(r.ok, "sent");
    assertEqual(a[IRON], 10); assertEqual(b[GOLD], 4);
  },
  "a short route pauses, retries, and goes dormant after three days": () => {
    const route = { every: "day", runs: 2, done: 1 };
    afterTry(route, { ok: false, short: "a", what: IRON }, 1000);
    assertEqual(route.state, "paused");
    assertEqual(route.nextAt, 1000 + TRADE.retryTicks);
    afterTry(route, { ok: false, short: "a" }, 1000 + 3 * DAY);
    assertEqual(route.state, "dormant");
    afterTry(route, { ok: true }, 1000 + 4 * DAY);
    assertEqual(route.state, "live");
    assertEqual(route.missed, 0);
    assert(finished(route), "two runs done");
  },
  "NPCs make their region's strengths and keep a week at most": () => {
    const s = npcMake({}, "Emberwaste", 1, 1, {});
    assertEqual(s[GOLD], 6 * 2 * 3);
    assert(s[DIA] < 1, "few diamonds in the Emberwaste");
    npcMake(s, "Emberwaste", 1, 100, {});
    assertEqual(s[GOLD], 36 * TRADE.npcStockDays);
  },
  "NPCs answer by temperament": () => {
    const lord = (temperament, extra = {}) => ({ region: "Emberwaste", temperament, bonus: 0, ...extra });
    const good = offer({ id: IRON, n: 20 }, { id: GOLD, n: 6 }); // gold is cheap to them
    assertEqual(npcAnswer(lord("kindly"), good, {}).kind, "accept");
    assertEqual(npcAnswer(lord("grasping"), good, {}).kind, "counter");
    const cheeky = offer({ id: IRON, n: 2 }, { id: GOLD, n: 6 });
    assertEqual(npcAnswer(lord("proud"), cheeky, {}).kind, "reject");
    const close = offer({ id: IRON, n: 12 }, { id: GOLD, n: 6 });
    const c = npcAnswer(lord("steady"), close, {});
    assertEqual(c.kind, "counter");
    assert(c.get.n < 6 && c.get.n >= 1, "asks to send less");
    assertEqual(npcAnswer(lord("steady", { refuses: true }), good, {}).kind, "reject");
    assertEqual(npcAnswer(lord("kindly", { makes: () => 2 }), good, {}).kind, "counter");
  },
  "Kingsrest buys anything for Regals at the set price": () => {
    assertEqual(capitalPrice({ id: GOLD, n: 2 }), 56);
    assertEqual(capitalAnswer(offer({ id: GOLD, n: 2 }, { id: COIN, n: 50 })).kind, "accept");
    const c = capitalAnswer(offer({ id: GOLD, n: 2 }, { id: COIN, n: 90 }));
    assertEqual(c.kind, "counter"); assertEqual(c.get.n, 56);
    assertEqual(capitalAnswer(offer({ id: GOLD, n: 2 }, { id: DIA, n: 1 })).get.id, COIN);
    assertEqual(capitalAnswer(offer({ id: GOLD_COIN, n: 1 }, { id: COIN, n: 10 })).kind, "reject");
  },
  "NPCs write offers out of their surplus for what they lack": () => {
    const npc = { region: "Emberwaste", temperament: "steady", stock: npcMake({}, "Emberwaste", 1, 2, {}) };
    const o = npcOffer(npc, { region: "Saltreach" }, {});
    assert(o, "an offer");
    assertEqual(o.give.id, GOLD);
    assertEqual(o.get.id, DIA);
  },
  "the Supply Line fills Exports only up to three runs of need": () => {
    const routes = [{ a: "p:a", b: "l:x", give: { id: IRON, n: 20 }, get: { id: GOLD, n: 4 } }, { a: "l:y", b: "p:a", give: { id: DIA, n: 1 }, get: { id: IRON, n: 10 } }];
    const needs = needsOf(routes, "p:a");
    assertEqual(needs[IRON], 30);
    assertEqual(supplyTake({ [IRON]: 50 }, needs, IRON, 100), 40);
    assertEqual(supplyTake({ [IRON]: 95 }, needs, IRON, 100), 0);
    assertEqual(supplyTake({}, needs, GOLD, 10), 0);
  },
  "the Regal worth of each side, and who the deal favours": () => {
    assertEqual(regalWorth({ id: IRON, n: 30 }), 240);
    assertEqual(regalWorth({ id: GOLD, n: 8 }), 256);
    const t = balanceText(offer({ id: IRON, n: 30 }, { id: GOLD, n: 8 })).replace(/§./g, "");
    assert(t.includes("240") && t.includes("256") && t.includes("16 Regals in your favour") && t.includes("fair"), t);
  },
  "loads read naturally": () => {
    assertEqual(loadText({ id: IRON, n: 8 }), "8 iron ingots");
    assertEqual(loadText({ id: COIN, n: 56 }), "56 Regals");
    assertEqual(loadText({ id: COIN, n: 1 }), "1 Regal");
    assertEqual(loadText({ id: "minecraft:wheat", n: 30 }), "30 wheat");
  },
  "a crate is corrected by what changed since the last look": () => {
    assertEqual(crateDelta({ [IRON]: 10, [GOLD]: 8 }, { [IRON]: 30 }), { add: { [GOLD]: 8 }, take: { [IRON]: 20 } });
    assertEqual(crateDelta({ [IRON]: 5 }, { [IRON]: 5 }), { add: {}, take: {} });
  },
  "special offers: normal worth, premium, fair shares": () => {
    const sp = { item: GOLD, total: 8, left: 8, price: 320 };
    assertEqual(specialNormal(sp), 256);
    assertEqual(specialPremium(sp), 25);
    assertEqual(specialPayFor(sp, 4), 160);
    assertEqual(specialPayFor({ ...sp, price: 321 }, 3), 120);
    assertEqual(specialProblem(sp, { cargo: 128, open: 0 }), undefined);
    assert(specialProblem({ ...sp, price: 200 }, {}), "under the normal worth");
    assert(specialProblem({ ...sp, total: 200 }, { cargo: 128 }), "more than a train load");
    assert(specialProblem({ ...sp, item: COIN, price: 999 }, {}), "money is not a good");
    assert(specialProblem(sp, { open: TRADE.specialsPerOutpost }), "too many open");
    assert(specialProblem(sp, { funds: 100 }), "can't afford it");
  },
  "towns fill a special offer only when it beats their worth, and only from stock": () => {
    const npc = { region: "Emberwaste", temperament: "steady" };
    const cheap = { item: GOLD, total: 10, left: 10, price: regalWorth({ id: GOLD, n: 10 }) };
    assert(npcFill(npc, cheap, { [GOLD]: 50 }, {}) === 10, "gold is cheap in the Emberwaste, so the normal price is plenty");
    assertEqual(npcFill({ region: "Saltreach", temperament: "grasping" }, cheap, { [GOLD]: 50 }, {}), 0);
    assertEqual(npcFill(npc, cheap, { [GOLD]: 4 }, {}), 4);
    assertEqual(npcFill(npc, { ...cheap, left: 3 }, { [GOLD]: 50 }, {}), 3);
  },
  "the Outpost building: every region and stage, marks inside, nothing in front of the step": () => {
    for (const region of ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"]) {
      for (const stage of ["halt", "station", "junction", "grand"]) {
        const d = TRADE_OUTPOST_DESIGNS[region]?.[stage];
        assert(d, `${region} ${stage}`);
        assert(d.box.z0 >= 0, `${region} ${stage} reaches toward the station`);
        const p = wingPlan(region, stage);
        for (const k of ["board", "exports", "imports"]) assert(p.marks[k], `${region} ${stage} ${k}`);
      }
    }
  },
});
