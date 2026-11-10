// Self-tests for the Reach's rules (all pure, so they run offline and in game).

import { addTests, assert, assertEqual } from "../core/tests.js";
import {
  REACH, STAGES, LONG, AFTER, stageFor, capReach, nightKind, isSiegeKind, profile, openTime, waveTime, waveRole, waveShare,
  hollowCount, hollowShare, tideLull, pressureMult, clock, nextSiege, duskLine, troopMix,
} from "./rules.js";

const none = { bosses: 0, choir: false, source: false };
const count = (stageId, kinds, salt = 11) => {
  let n = 0;
  for (let day = 30; day < 330; day++) if (kinds.includes(nightKind(day, stageId, { salt }))) n++;
  return n;
};

addTests("reach", {
  "the story gates the stages, and they never go back": () => {
    assertEqual(stageFor(99, none, 1), 1, "no boss, no change");
    assertEqual(stageFor(25, { bosses: 1 }, 1), 2);
    assertEqual(stageFor(99, { bosses: 6 }, 1), 4, "the Long Night needs the Choir to fall");
    assertEqual(stageFor(85, { bosses: 6, choir: true }, 1), 5);
    assertEqual(stageFor(0, { bosses: 6, choir: true }, 4), 4, "a falling Reach doesn't undo a stage");
    assertEqual(stageFor(10, { source: true }, 2), AFTER);
    assertEqual(stageFor(100, { bosses: 6, choir: true }, AFTER), AFTER);
  },
  "the Reach waits under a stage the story hasn't opened": () => {
    assertEqual(capReach(50, none), 19);
    assertEqual(capReach(50, { bosses: 1 }), 39);
    assertEqual(capReach(120, { bosses: 6 }), 84);
    assertEqual(capReach(120, { bosses: 6, choir: true }), 100);
    assertEqual(capReach(-5, none), 0);
  },
  "stage 1 is exactly every third night": () => {
    for (let day = 0; day < 60; day++) assertEqual(nightKind(day, 1), day >= 5 && day % 3 === 0 ? "counted" : undefined, `day ${day}`);
  },
  "sieges come more often at every stage": () => {
    assertEqual(count(1, ["counted", "stolen"]), 100);
    assertEqual(count(2, ["counted", "stolen"]), 100);
    assert(count(2, ["probe"]) > 15 && count(2, ["probe"]) < 70, "some knocks at stage 2");
    assertEqual(count(3, ["counted", "stolen"]), 200, "two nights in three");
    assertEqual(count(4, ["counted", "stolen"]), 300, "every night");
    assertEqual(count(LONG, ["long"]), 300);
    assertEqual(count(AFTER, ["muster"]), 60, "one night in five after the story");
    assertEqual(count(AFTER, ["counted", "stolen", "long", "probe"]), 0);
  },
  "the stolen night moves about": () => {
    const offsets = new Set();
    for (let day = 30; day < 130; day++) if (nightKind(day, 3, { salt: 4 }) === "stolen") offsets.add(day % 3);
    assertEqual([...offsets].sort(), [1, 2]);
  },
  "a night's fate is fixed once the day starts": () => {
    for (let day = 5; day < 40; day++) assertEqual(nightKind(day, 2, { salt: 9 }), nightKind(day, 2, { salt: 9 }));
  },
  "the last wave is always at 3:17 and the waves are an hour apart": () => {
    assertEqual(clock(REACH.tollTime), "3:17");
    for (const s of STAGES) {
      assertEqual(waveTime(s.waves, s.waves), REACH.tollTime);
      assertEqual(waveTime(2, s.waves) - waveTime(1, s.waves), REACH.hour);
      assert(openTime("counted", s.waves) >= REACH.nightTime, `${s.name} starts after nightfall`);
    }
    assertEqual(clock(waveTime(1, 3)), "1:17");
    assert(openTime("probe", 1, 12, 3) >= REACH.nightTime && openTime("probe", 1, 12, 3) < REACH.tollTime);
  },
  "every night ends on the toll and its shares add up": () => {
    for (let waves = 1; waves <= 8; waves++) {
      assertEqual(waveRole(waves, waves), "toll");
      let sum = 0;
      for (let n = 1; n <= waves; n++) sum += waveShare(n, waves);
      assert(Math.abs(sum - 1) < 1e-9, `${waves} waves share ${sum}`);
    }
    assertEqual(waveRole(7, 6), "tide");
    assertEqual(waveShare(7, 6), REACH.long.tideShare);
    assertEqual(waveRole(1, 6), "knock");
  },
  "every stage is harder than the one before, until it is over": () => {
    for (let id = 2; id <= LONG; id++) {
      const a = profile("counted", id - 1), b = profile(id === LONG ? "long" : "counted", id);
      assert(b.mult > a.mult && b.waves >= a.waves, `stage ${id}`);
      assert(hollowCount(id, "toll") > hollowCount(id - 1, "toll"), `more Hollow soldiers at stage ${id}`);
      assert(hollowShare(id) >= hollowShare(id - 1));
    }
    assertEqual(hollowCount(1, "toll"), 0, "stage 1 is only men");
    assertEqual(hollowCount(AFTER, "toll"), 0);
    assertEqual(hollowShare(AFTER), 0);
    assertEqual(troopMix(4, false).hollow, 0, "no Hollow soldiers in the ranks before the first glimpse");
    assertEqual(troopMix(LONG, true), { grey: 0, hollow: 1 });
    assertEqual(troopMix(AFTER, true).swap, 0);
    for (let id = 1; id <= 6; id++) assert(troopMix(id, true).grey + troopMix(id, true).hollow <= 1);
    assert(profile("stolen", 3).mult < profile("counted", 3).mult, "the third night is still the worst");
    assert(profile("probe", 3).waves === 1 && !profile("probe", 3).warlord);
  },
  "the Long Night tightens with pressure, up to a limit": () => {
    assert(pressureMult(5) > pressureMult(0));
    assertEqual(pressureMult(99), pressureMult(REACH.long.maxPressure));
    assertEqual(tideLull(0), REACH.long.lull);
    assertEqual(tideLull(REACH.long.maxPressure), REACH.long.minLull);
  },
  "the banner can say when the next siege is": () => {
    assertEqual(nextSiege(7, 1), 9);
    assertEqual(nextSiege(7, 4), 7);
    assert(nextSiege(7, AFTER, { salt: 2 }) - 7 < 10);
    assert(isSiegeKind("stolen") && !isSiegeKind("probe") && !isSiegeKind(undefined));
  },
  "no omen names what is coming": () => {
    for (const kind of ["counted", "stolen", "long", "muster"]) {
      for (let id = 1; id <= 6; id++) assert(!/hollow|morvane|oswin/i.test(duskLine(kind, id, 3)), `${kind} ${id}`);
    }
  },
});
