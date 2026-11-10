// Dragons: self-tests (pure ones run in Node and in game).

import { addTests, assert, assertEqual } from "../siege/api.js";
import { BlockTypes, ItemTypes } from "@minecraft/server";
import { DRAGON_SETTINGS as S, DAY, EGG, SADDLE, HORN, ROOST, NEST, TRAINING, newDragon, addXp, flightTicks, earnedStage, nextStageNeeds, trainProblem, train } from "./data.js";

const hatched = (extra = {}) => Object.assign(newDragon("p1", "Tester", 0), { stage: "hatchling", bornAt: 0 }, extra);

addTests("dragons", {
  "flight lasts 45 seconds untrained and 60 fully trained": () => {
    const rec = hatched();
    assertEqual(flightTicks(rec), 45 * 20);
    rec.stats.wings = TRAINING.wings.max;
    assertEqual(flightTicks(rec), 60 * 20);
  },
  "a hatchling needs both time and bond to grow, and never shrinks": () => {
    const rec = hatched();
    assertEqual(earnedStage(rec, S.fledgeDays * DAY), "hatchling", "no bond yet");
    rec.bond = S.fledgeBond;
    assertEqual(earnedStage(rec, DAY), "hatchling", "too young");
    assertEqual(earnedStage(rec, S.fledgeDays * DAY), "fledgling");
    rec.stage = "fledgling";
    rec.bond = 0;
    assertEqual(earnedStage(rec, S.adultDays * DAY), "fledgling", "stays a fledgling");
    rec.bond = S.adultBond;
    assertEqual(earnedStage(rec, S.adultDays * DAY), "adult");
    assert(nextStageNeeds(hatched(), 0).includes("Fledgling"));
    assertEqual(earnedStage(newDragon("p", "T", 0), 99 * DAY), "egg", "an egg only hatches on a Roost");
  },
  "levels give training points and stop at the cap": () => {
    const rec = hatched();
    assertEqual(addXp(rec, 45), 1);
    assertEqual(rec.tp, 1);
    addXp(rec, 1e6);
    assertEqual(rec.level, S.maxLevel);
    assertEqual(rec.tp, S.maxLevel - 1);
  },
  "training spends points, respects caps, and keeps flying lessons for adults": () => {
    const rec = hatched({ tp: 10 });
    assert(trainProblem(rec, "wings"), "a hatchling can't train Wings");
    assert(train(rec, "vigor"));
    rec.stage = "adult";
    for (let i = 0; i < TRAINING.breath.max; i++) assert(train(rec, "breath"));
    assert(!train(rec, "breath"), "Breath is capped");
    assertEqual(rec.tp, 10 - 1 - TRAINING.breath.max);
    rec.tp = 0;
    assert(!train(rec, "wings"), "no points left");
    assertEqual(S.breathDamage.length, TRAINING.breath.max + 1);
  },
});

addTests("dragons (pack)", {
  "the pack has the dragon's items and blocks": () => {
    for (const id of [EGG, SADDLE, HORN]) assert(ItemTypes.get(id), `missing item ${id}`);
    for (const id of [ROOST, NEST]) assert(BlockTypes.get(id), `missing block ${id}`);
  },
}, { gameOnly: true });
