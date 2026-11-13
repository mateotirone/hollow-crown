// Dragons: self-tests (pure ones run in Node and in game).

import { addTests, assert, assertEqual } from "../siege/api.js";
import { BlockTypes, ItemTypes } from "@minecraft/server";
import { DRAGON_SETTINGS as S, DAY, EGG, SADDLE, HORN, ROOST, HATCHERY, NEST, TRAINING, SPECIES, TEMPERS, newDragon, newMind, groundStep, airStep, healthStep, addXp, flightTicks, earnedStage, nextStageNeeds, trainProblem, train } from "./data.js";

import { drawDragonStable, BLOCK_BUILDS } from "../settle/blockdesigns.js";

const hatched = (extra = {}) => Object.assign(newDragon("p1", "Tester", 0), { stage: "hatchling", bornAt: 0, species: 0 }, extra);

addTests("dragons", {
  "the Dragon Roost raises the Dragon Stable, and its nursery holds three Hatching Braziers": () => {
    assertEqual(BLOCK_BUILDS[ROOST]?.draw, drawDragonStable, "the Roost is a building block");
    for (const style of ["emberwaste", "vale"]) {
      const plan = drawDragonStable(style);
      const ids = [...plan.cells.values()].map((c) => plan.style.roles[c.role]?.[0]);
      assertEqual(ids.filter((id) => id === HATCHERY).length, 3, `${style}: three braziers`);
      assert(!plan.get(0, 1, 0) && !plan.get(0, 2, 0), `${style}: the Roost's own spot is left free`);
      const b = plan.bounds();
      assert((b.x1 - b.x0 + 1) % 2 === 1, `${style}: odd width`);
    }
  },
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

addTests("dragons (species and minds)", {
  "four species, each different, all within the speed and health ladders": () => {
    assertEqual(SPECIES.length, 4);
    const seen = new Set();
    SPECIES.forEach((sp, i) => {
      seen.add(`${sp.flight},${sp.ground},${sp.air},${sp.vigor},${sp.breath}`);
      for (const level of [0, 5]) {
        const rec = hatched({ species: i, stats: { wings: 0, speed: level, vigor: level, breath: 0 } });
        for (const stepOf of [groundStep, airStep, healthStep]) assert(stepOf(rec) >= 0 && stepOf(rec) <= 7, `${sp.name} off the ladder`);
      }
      assert(flightTicks(hatched({ species: i })) >= 30 * 20, `${sp.name} can barely fly`);
    });
    assertEqual(seen.size, 4, "two species are the same");
  },
  "a new mind has a temperament and a favourite food to discover": () => {
    for (let i = 0; i < 20; i++) {
      const mind = newMind();
      assert(TEMPERS[mind.temper], "unknown temperament");
      assert(mind.fav && !mind.favKnown && mind.fav !== "minecraft:rotten_flesh");
    }
  },
});

addTests("dragons (pack)", {
  "the pack has the dragon's items and blocks": () => {
    for (const id of [EGG, SADDLE, HORN]) assert(ItemTypes.get(id), `missing item ${id}`);
    for (const id of [ROOST, NEST, HATCHERY]) assert(BlockTypes.get(id), `missing block ${id}`);
  },
}, { gameOnly: true });
