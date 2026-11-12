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

import { findPath, run, wetRuns, behind, swims } from "./route.js";
import { pickMarchers } from "./army.js";

// A small map: a river at x 10..14 with a bridge at z 30..32; a wall (y 20) along z = -10 except a gate at x 0..2
const riverMap = (x, z) => {
  if (x >= 10 && x <= 14 && !(z >= 30 && z <= 32)) return { y: 62, water: true };
  return { y: 64, water: false };
};

addTests("warwrit-route", {
  "soldiers ride round to the bridge instead of swimming the river": () => {
    const path = run(findPath({ x: 0, y: 64, z: 0 }, { x: 24, y: 64, z: 0 }, riverMap));
    assert(path, "a path is found");
    assertEqual(swims(path, riverMap), 0, "no swimming");
    assert(path.some((p) => p.z >= 30 && p.x >= 10 && p.x <= 14), "it crosses at the bridge");
  },
  "with no bridge in reach they swim after all": () => {
    const noBridge = (x) => (x >= 10 && x <= 14 ? { y: 62, water: true } : { y: 64, water: false });
    const path = run(findPath({ x: 0, y: 64, z: 0 }, { x: 24, y: 64, z: 0 }, noBridge));
    assert(path && swims(path, noBridge) > 0);
  },
  "walls are never climbed: they go through the gate": () => {
    const walled = (x, z) => (z === -10 && !(x >= 0 && x <= 2) ? { y: 70, water: false } : { y: 64, water: false });
    const path = run(findPath({ x: 1, y: 64, z: 0 }, { x: 20, y: 64, z: -24 }, walled));
    assert(path, "a path is found");
    const crossing = path.find((p) => p.z === -10);
    assert(crossing && crossing.x >= 0 && crossing.x <= 2, "crosses the wall line at the gate");
  },
  "wet stretches of a trail are found, and spacing goes back along it": () => {
    const trail = [0, 1, 2, 3, 4, 5].map((n) => ({ x: n * 2, y: 64, z: 0, wet: n === 2 || n === 3 }));
    assertEqual(JSON.stringify(wetRuns(trail)), JSON.stringify([[2, 3]]));
    const p = behind(trail, 5, 3);
    assertEqual(p.x, 7);
  },
  "the slider picks that share of the army, Men-at-Arms first": () => {
    const g = (typeId) => ({ typeId });
    const army = [g("siege:archer"), g("siege:man_at_arms"), g("siege:archer"), g("siege:man_at_arms")];
    assertEqual(pickMarchers(army, 0).length, 0);
    assertEqual(pickMarchers(army, 50).map((s) => s.typeId).join(), "siege:man_at_arms,siege:man_at_arms");
    assertEqual(pickMarchers(army, 100).length, 4);
  },
});
