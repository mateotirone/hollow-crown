import { addTests, assert, assertEqual } from "../core/tests.js";
import { PLOT_PLAN } from "../plots/config.js";
import { BUILDING, drawBuilding } from "../settle/buildings.js";
import { hallReserve, footprint, boxesTouch } from "../settle/rules.js";
import { STYLE_IDS } from "../townhall/styles.js";
import { DEEDS, DEED_KINDS, TEMPERS, MANNERS, WARES, COMMISSIONS, deedOptions, pickDeed, nextToAct, pickManner, marchHost, settleMarch, settleFeud, pickFoe, strength, pickWares, warePrice, pactsOpen, buyOffPrice, tributeOf } from "./deeds.js";
import { RIVALS, STAGES, LINES, TEMPERAMENTS, makeLord, wanted, night, nextPiece, tierForWins, partKey, hallSpot, partSpot, estateOf, winsForEstate, takeEstate } from "./data.js";

addTests("rivals", {
  "every planned plot gets a different lord": () => {
    const names = [];
    for (const plot of PLOT_PLAN) names.push(makeLord({ ...plot, y: 64 }, "seed", names).name);
    assertEqual(new Set(names).size, PLOT_PLAN.length);
  },
  "a lord is the same for the same seed": () => {
    assertEqual(makeLord({ ...PLOT_PLAN[0], y: 64 }, "a").name, makeLord({ ...PLOT_PLAN[0], y: 64 }, "a").name);
  },
  "plots are always left for players": () => {
    assertEqual(wanted("none", 12, 0), 0);
    assertEqual(wanted("few", 12, 0), RIVALS.few);
    assertEqual(wanted("all", 12, 0), 12 - RIVALS.leaveFree);
    assertEqual(wanted("all", RIVALS.leaveFree, 4), 4);
  },
  "lords climb the tiers over many nights": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    for (let n = 0; n < 40; n++) night(lord, n);
    assertEqual(lord.tier, 3);
    assertEqual(tierForWins(5), 1);
  },
  "every temperament has lines and a hold chance": () => {
    for (const t of TEMPERAMENTS) assert(LINES[t]?.length >= 3 && RIVALS.holdChance[t] > 0, t);
  },
  "stage buildings exist, miss each other and miss the hall, whichever way the gate faces": () => {
    for (const gate of ["north", "east", "south", "west"]) {
      const at = { x: 0, z: 0 }, h = hallSpot(at, gate);
      const halls = STYLE_IDS.map((style) => hallReserve({ x: h.x, z: h.z, fx: h.forward.x, fz: h.forward.z, style }, 1));
      const boxes = [];
      for (const stage of STAGES) for (const part of stage) {
        assert(BUILDING[part.building], part.building);
        const spot = partSpot(at, gate, part);
        const box = footprint(spot, spot.forward, drawBuilding(part.building, "vale").bounds());
        assert(!halls.some((hall) => boxesTouch(box, hall)), `${part.id} (${gate}) stands where the hall grows`);
        for (const other of boxes) assert(!boxesTouch(box, other), `${part.id} (${gate}) overlaps another building`);
        assert(Math.max(Math.abs(box.x0), Math.abs(box.x1), Math.abs(box.z0), Math.abs(box.z1)) <= 44, `${part.id} is too near the wall`);
        boxes.push(box);
      }
    }
  },
  "a settlement is handed on as the lord left it": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    lord.tier = 2; lord.wins = 7; lord.built = { hall: 2, parts: [partKey(0, 0), partKey(1, 1)] };
    const estate = estateOf(lord);
    assertEqual(estate.tier, 2);
    assertEqual(winsForEstate(estate, 1), 7);
    assertEqual(winsForEstate(estate, 12), 12, "a player never loses wins by taking a settlement over");
    assertEqual(winsForEstate({ tier: 3 }, 0), RIVALS.tierWins[3]);
    const heir = takeEstate(makeLord({ ...PLOT_PLAN[0], y: 64 }, "other"), estate);
    assertEqual(heir.built.hall, 2);
    assertEqual(nextPiece(heir).part?.id ?? nextPiece(heir).hall, STAGES[0][1].id, "the heir builds what is still missing");
  },
  "a settlement is built hall first, stage by stage": () => {
    const lord = makeLord({ ...PLOT_PLAN[0], y: 64 }, "seed");
    assertEqual(nextPiece(lord).hall, 1);
    lord.built.hall = 1;
    assertEqual(nextPiece(lord).part.id, STAGES[0][0].id);
    lord.built.parts = STAGES[0].map((_, i) => partKey(0, i));
    assertEqual(nextPiece(lord), undefined);
    lord.tier = 1;
    assertEqual(nextPiece(lord).hall, 2);
  },
});

// ---------- what lords do (deeds.js) ----------
const lordAt = (i, more = {}) => Object.assign(makeLord({ ...PLOT_PLAN[i], y: 64 }, "seed"), more);
const open = { hasTarget: true, relation: 0, lords: 3 };

addTests("rival deeds", {
  "a lord never does the same kind of thing twice running, whatever their temper": () => {
    for (const temperament of TEMPERS) {
      const lord = lordAt(0, { temperament });
      const seen = new Set();
      for (let day = 0; day < 60; day++) {
        const kind = pickDeed(lord, { ...open, relation: (day % 7) * 10 - 20 }, `s|${day}`);
        if (!kind) continue;
        assert(kind !== lord.lastDeed, `${temperament} did ${kind} twice running`);
        lord.lastDeed = kind;
        seen.add(kind);
      }
      assert(seen.size >= 4, `${temperament} only ever does ${[...seen].join(", ")}`);
    }
  },
  "the realm does not see the same kind twice running when a lord has another choice": () => {
    const lord = lordAt(0);
    for (const realmLast of DEED_KINDS) for (let n = 0; n < 20; n++) assert(pickDeed(lord, { ...open, realmLast }, `r|${n}`) !== realmLast, realmLast);
  },
  "lords take turns": () => {
    const lords = [lordAt(0, { deedDay: 4 }), lordAt(1, { deedDay: 2 }), lordAt(2)];
    assertEqual(nextToAct(lords).id, lords[2].id);
    lords[2].deedDay = 5;
    assertEqual(nextToAct(lords).id, lords[1].id);
  },
  "nobody marches on a sworn player, a player at peace, or a friend": () => {
    const kinds = (ctx, more) => deedOptions(lordAt(0, { temperament: "bold", ...more }), { ...open, ...ctx }).map((o) => o.kind);
    assert(kinds({}).includes("march"));
    assert(!kinds({ pact: "truce" }).includes("march") && !kinds({ pact: "truce" }).includes("demand"), "sworn");
    assert(!kinds({ peace: true }).includes("march") && !kinds({ peace: true }).includes("demand"), "at peace");
    assert(!kinds({ relation: 30 }).includes("march"), "a friend");
    assert(!kinds({ hasTarget: false }).some((k) => !["feud", "wares"].includes(k)), "with nobody home, lords only deal with each other");
    assert(!kinds({}, { march: { target: "x" } }).includes("march"), "one war at a time");
    assert(!kinds({ atWar: true }).includes("march") && !kinds({ atWar: true }).includes("demand"), "a player is only at war with one lord at a time");
    assert(!kinds({ pressed: true }).includes("demand"), "one demand at a time");
  },
  "the kind strike nobody first, and do once wronged": () => {
    const kinds = (ctx) => deedOptions(lordAt(0, { temperament: "kind" }), { ...open, ...ctx }).map((o) => o.kind);
    assert(!kinds({}).includes("march"));
    assert(kinds({ grudge: true }).includes("march") && kinds({ relation: -50 }).includes("march"));
  },
  "a pact is only broken by a lord you have turned on": () => {
    const kinds = (relation) => deedOptions(lordAt(0), { ...open, pact: "alliance", relation }).map((o) => o.kind);
    assert(!kinds(10).includes("breach") && kinds(-5).includes("breach"));
  },
  "a march never comes the same way twice running": () => {
    const lord = lordAt(0);
    for (let n = 0; n < 30; n++) {
      const manner = pickManner(lord, `m|${n}`);
      assert(MANNERS[manner] && manner !== lord.lastManner, manner);
      lord.lastManner = manner;
    }
  },
  "each way of marching changes the siege": () => {
    const plan = () => ({ faction: "warband", budget: 100, modifiers: [], sides: [0] });
    const hired = plan(); MANNERS.hired.apply(hired);
    assert(hired.budget > 100 && hired.faction === "mercenaries");
    const night = plan(); MANNERS.night.apply(night);
    assert(night.modifiers.includes("pincer") && night.sides.length === 2);
    const lord = lordAt(0, { tier: 2 });
    assert(marchHost(lord, "gate").length > marchHost(lord, "hired").length);
    assertEqual(marchHost(lord, "gate").filter((m) => m.captain).length, 1);
    assert(marchHost(lord, "gate", 2).length > marchHost(lord, "gate").length, "vassals march with their liege");
  },
  "a march leaves something behind, however it ends": () => {
    const beaten = settleMarch(lordAt(0, { march: { manner: "gate" } }), "beaten");
    assert(beaten.spoils > 0 && beaten.peaceDays >= 4);
    assertEqual(settleMarch(lordAt(0, { temperament: "bold", march: {} }), "beaten").relation > 0, true, "the bold respect a good fight");
    const lord = lordAt(0, { wins: 2, march: { manner: "night" } });
    const won = settleMarch(lord, "won");
    assert(won.rose && lord.tier === 1 && !lord.march && lord.lastManner === "night");
    assert(settleMarch(lordAt(0, { march: {} }), "draw").peaceDays > 0);
  },
  "a feud ends with a liege and a vassal, and a rebel who wins goes free": () => {
    const a = lordAt(0, { tier: 3, wins: 12 }), b = lordAt(1);
    const { winner, loser } = settleFeud(a, b, { backing: {} }, [a, b], "x1");
    assertEqual(loser.liege, winner.id);
    assertEqual(a.lastFoe, b.id);
    assertEqual(pickFoe(winner, [a, b], "x"), undefined, "nobody rides against their own vassal");
    let freed = false;
    for (let n = 0; n < 40 && !freed; n++) {
      const liege = lordAt(0), rebel = lordAt(1, { liege: liege.id, tier: 3, wins: 20 });
      const r = settleFeud(rebel, liege, { backing: {} }, [liege, rebel], `f|${n}`);
      if (r.winner === rebel) { freed = true; assertEqual(rebel.liege, undefined); assertEqual(liege.liege, undefined); }
    }
    assert(freed);
  },
  "a player's coin can turn a feud": () => {
    const a = lordAt(0), b = lordAt(1);
    assert(strength(a, [a, b], 2) > strength(a, [a, b], 0) + 4);
    let plain = 0, backed = 0;
    for (let n = 0; n < 200; n++) {
      if (settleFeud(lordAt(0), lordAt(1), { backing: {} }, [], `p|${n}`).winner.id === a.id) plain++;
      if (settleFeud(lordAt(0), lordAt(1), { backing: { [a.id]: 2 } }, [], `p|${n}`).winner.id === a.id) backed++;
    }
    assert(backed > plain + 30, `${plain} unbacked, ${backed} backed`);
  },
  "wares change every time and are priced by standing": () => {
    const lord = lordAt(0);
    for (let n = 0; n < 10; n++) {
      const next = pickWares(lord, `w|${n}`);
      assertEqual(next.sell.length, 3);
      assert(COMMISSIONS.some((c) => c.id === next.want));
      for (const id of next.sell) assert(!lord.wares?.sell.includes(id), `${id} two times running`);
      assert(next.want !== lord.wares?.want, "the same commission two times running");
      lord.wares = next;
    }
    const ware = WARES[0];
    assert(warePrice(lord, ware, 0, "alliance") < warePrice(lord, ware, 50) && warePrice(lord, ware, 50) < warePrice(lord, ware, 0));
    assertEqual(warePrice(lord, ware, -40), undefined, "an enemy is turned away");
    for (const c of COMMISSIONS) assert(!WARES.some((w) => w.id === c.id), `${c.id} is both sold and bought: free money`);
  },
  "oaths take standing, and broken ones make the next harder": () => {
    const lord = lordAt(0, { temperament: "steady" });
    assertEqual(pactsOpen(lord, 0), []);
    assertEqual(pactsOpen(lord, DEEDS.truceAt), ["truce"]);
    assertEqual(pactsOpen(lord, DEEDS.allianceAt), ["truce", "alliance"]);
    assertEqual(pactsOpen(lord, DEEDS.allianceAt, 1), ["truce"]);
    assert(buyOffPrice(lord, 2) > buyOffPrice(lord) && tributeOf(lord, 1) > tributeOf(lord));
    assert(buyOffPrice(lordAt(0, { temperament: "proud" })) > buyOffPrice(lord), "a proud lord's honour costs more");
  },
  "every number has all four tiers": () => {
    for (const key of ["marchBuyOff", "marchSpoils", "marchHost", "tribute", "gift", "playerGift", "backing", "aid", "alliancePrice"]) assertEqual(DEEDS[key].length, 4, key);
  },
});
