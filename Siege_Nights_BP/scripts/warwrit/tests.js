import { addTests, assert, assertEqual } from "../core/tests.js";
import { WRIT, assaultDay, phase, groundsFor, cantDeclare, demandAmount, pairKey, feeFor } from "./rules.js";

addTests("warwrit", {
  "the assault falls on tonight's night if the muster fits, else tomorrow's": () => {
    assertEqual(assaultDay(5, 1000), 5);
    assertEqual(assaultDay(5, WRIT.nightfall - WRIT.musterTicks), 5);
    assertEqual(assaultDay(5, WRIT.nightfall - WRIT.musterTicks + 1), 6);
    assertEqual(assaultDay(5, 20000), 6, "declared at night: the next night");
  },
  "a writ musters, assaults for one night, then is over": () => {
    const w = { day: 6 };
    assertEqual(phase(w, 5, 20000), "muster");
    assertEqual(phase(w, 6, 12999), "muster");
    assertEqual(phase(w, 6, 13000), "assault");
    assertEqual(phase(w, 6, 22999), "assault");
    assertEqual(phase(w, 6, 23000), "over");
    assertEqual(phase(w, 7, 100), "over");
    assertEqual(phase(undefined, 6, 15000), "over");
  },
  "grounds: a relic, a feud or a refused demand": () => {
    assertEqual(groundsFor({ relic: true, now: 10 }), "relic");
    assertEqual(groundsFor({ feudUntil: 11, now: 10 }), "feud");
    assertEqual(groundsFor({ feudUntil: 9, refusedUntil: 11, now: 10 }), "refused");
    assertEqual(groundsFor({ oathUntil: 11, now: 10 }), "oathbreaker", "anyone may declare on an Oathbreaker");
    assertEqual(groundsFor({ feudUntil: 9, now: 10 }), undefined);
  },
  "a war with no grounds is allowed but unjust, at three times the fee": () => {
    assertEqual(feeFor("relic"), WRIT.fee);
    assertEqual(feeFor(undefined), WRIT.fee * 3);
  },
  "a writ needs a keep, no peace and no other writ": () => {
    const base = { attacker: "a", defender: "b", hasKeep: true, targetKeep: {}, writs: {}, now: 10, grounds: "relic" };
    assertEqual(cantDeclare(base), undefined);
    assert(cantDeclare({ ...base, hasKeep: false }), "no keep");
    assertEqual(cantDeclare({ ...base, grounds: undefined }), undefined, "no grounds is no bar");
    assert(cantDeclare({ ...base, peaceUntil: 11 }), "peace");
    assert(cantDeclare({ ...base, writs: { b: { attacker: "c" } } }), "one writ per target");
    assert(cantDeclare({ ...base, writs: { c: { attacker: "a" } } }), "one writ per attacker");
    assert(cantDeclare({ ...base, writs: { a: { attacker: "b" } } }), "not back at someone marching on you");
  },
  "demands ask a tenth, at least 50; pair keys are order-free": () => {
    assertEqual(demandAmount(1000), 100);
    assertEqual(demandAmount(10), WRIT.demandMin);
    assertEqual(pairKey("b", "a"), pairKey("a", "b"));
  },
});
