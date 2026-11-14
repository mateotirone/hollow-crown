// Self-tests for the Reach's rules (all pure, so they run offline and in game).

import { addTests, assert, assertEqual } from "../core/tests.js";
import {
  REACH, STAGES, LONG, AFTER, stageFor, capReach, nightKind, isSiegeKind, profile, openTime, waveTime, waveRole, waveShare,
  hollowCount, hollowShare, tideLull, pressureMult, clock, nextSiege, duskLine, troopMix, SHAPES, pickShape, WAVES, hourLine, HONOURS,
  HOUR_LINES, HOUR_ACTS, DUSK_ACT, hourOmen, omenSide,
  musterGap, omenWait, duskSpeed, watchHint, watchBand, WATCH_HINTS, fightStage, OATH_STAGE,
} from "./rules.js";
import { ACTS } from "./omens.js";

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
    assertEqual(stageFor(99, { bosses: 6 }, 1), 4, "the Long Night needs the Rift to be opened");
    assertEqual(stageFor(99, { bosses: 6, choir: true }, 4), 4, "the Choir falling does not start it any more");
    assertEqual(stageFor(85, { bosses: 6, rift: true }, 1), 5);
    assertEqual(stageFor(30, { bosses: 2, rift: true }, 2), 5, "opening the Rift starts the Long Night whatever the count was");
    assertEqual(stageFor(0, { bosses: 6 }, 4), 4, "a falling Reach doesn't undo a stage");
    assertEqual(stageFor(10, { source: true }, 2), AFTER);
    assertEqual(stageFor(100, { bosses: 6, rift: true }, AFTER), AFTER);
  },
  "the Reach waits under a stage the story hasn't opened": () => {
    assertEqual(capReach(50, none), 19);
    assertEqual(capReach(50, { bosses: 1 }), 39);
    assertEqual(capReach(120, { bosses: 6 }), 84);
    assertEqual(capReach(120, { bosses: 6, rift: true }), 100);
    assertEqual(capReach(120, { bosses: 2, rift: true }), 100);
    assertEqual(capReach(-5, none), 0);
  },
  "stage 1 is exactly every third night": () => {
    for (let day = 0; day < 60; day++) assertEqual(nightKind(day, 1), day >= 3 && day % 3 === 0 ? "counted" : undefined, `day ${day}`);
  },
  "sieges come more often at every stage": () => {
    assertEqual(count(1, ["counted", "stolen"]), 100);
    assertEqual(count(2, ["counted", "stolen"]), 100);
    assert(count(2, ["probe"]) > 15 && count(2, ["probe"]) < 70, "some knocks at stage 2");
    assertEqual(count(3, ["counted", "stolen"]), 200, "two nights in three");
    assertEqual(count(4, ["counted", "stolen"]), 300, "every night");
    assertEqual(count(LONG, ["long"]), 300);
    assertEqual(count(AFTER, ["muster", "counted", "stolen", "long", "probe"]), 0, "after the story nothing comes by the count");
    assertEqual(nightKind(40, AFTER, { musterDay: 40 }), "muster");
    assertEqual(nightKind(41, AFTER, { musterDay: 40 }), undefined);
  },
  "a broken truce gives the third night back to the Hollow": () => {
    assertEqual(nightKind(42, AFTER, { oathbroken: true }), "oathbroken");
    assertEqual(nightKind(43, AFTER, { oathbroken: true }), undefined);
    assertEqual(nightKind(42, AFTER, { oathbroken: true, musterDay: 42 }), "muster", "a rival who chose the night keeps it");
    assertEqual(nightKind(42, AFTER), undefined, "kept or never broken: the third night stays quiet");
    assertEqual(nightKind(42, 2, { oathbroken: true }), "counted", "before the story the flag changes nothing");
    assertEqual(fightStage("oathbroken", AFTER), OATH_STAGE);
    assertEqual(fightStage("muster", AFTER), AFTER);
    assert(profile("oathbroken", AFTER).mult > profile("counted", 1).mult, "harder than the old counted nights");
    assert(isSiegeKind("oathbroken"));
    assert(duskLine("oathbroken", AFTER, 3).length > 0);
    assert(troopMix(fightStage("oathbroken", AFTER), true).hollow > 0, "the Hollow is back in the ranks");
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
    assertEqual(nextSiege(7, AFTER, { salt: 2, musterDay: 12 }), 12);
    assert(isSiegeKind("stolen") && !isSiegeKind("probe") && !isSiegeKind(undefined));
  },
  "no two sieges in a row have the same shape": () => {
    for (let id = 1; id <= 6; id++) {
      const waves = STAGES[id - 1].waves;
      const seen = new Set();
      let last = null;
      for (let day = 5; day < 305; day++) {
        const shape = pickShape(day, 77, id, waves, last);
        assert(shape !== last, `stage ${id} day ${day} repeated ${shape}`);
        assert(SHAPES[shape].from <= id, `${shape} too early for stage ${id}`);
        seen.add(shape);
        last = shape;
      }
      assert(seen.size >= 5, `stage ${id} only has ${seen.size} shapes`);
    }
  },
  "every shape is a real night: right length, ends on the toll, shares add up": () => {
    for (const [id, shape] of Object.entries(SHAPES)) {
      for (let waves = shape.min; waves <= 8; waves++) {
        const roles = shape.roles(waves);
        assertEqual(roles.length, waves, `${id} with ${waves} waves`);
        assertEqual(roles[waves - 1], "toll", `${id} ends on the toll`);
        for (const r of roles) assert(WAVES[r], `${id} uses unknown wave ${r}`);
        let sum = 0;
        for (let n = 1; n <= waves; n++) sum += waveShare(n, waves, id);
        assert(Math.abs(sum - 1) < 1e-9, `${id} shares ${sum}`);
      }
    }
    const distinct = new Set(Object.values(SHAPES).map((s) => s.roles(4).join(",")));
    assert(distinct.size >= 6, "shapes must actually differ");
    const kinds = ["fight", "mystery", "journey", "quiet", "social", "build"];
    for (const [id, sh] of Object.entries(SHAPES)) assert(kinds.includes(sh.kind), `${id} has no Storyteller kind`);
    const early = Object.values(SHAPES).filter((sh) => sh.from <= 1 && sh.min <= 3);
    assert(new Set(early.map((sh) => sh.kind)).size >= 3, "the first stage needs nights of at least three kinds");
  },
  "an evening never repeats an omen, and neither do two sieges running": () => {
    for (let day = 5; day < 60; day++) {
      const lines = new Set();
      for (let hour = 1; hour <= 8; hour++) lines.add(hourLine(day, 5, hour));
      assertEqual(lines.size, 8, `day ${day}`);
    }
    for (const gap of [1, 2, 3]) for (let day = 5; day < 40; day++) assert(duskLine("counted", 1, day) !== duskLine("counted", 1, day + gap));
  },
  "every shape has an honour to earn": () => {
    for (const id of Object.keys(SHAPES)) assert(HONOURS[`shape_${id}`], id);
    assert(Object.keys(HONOURS).length >= 14);
  },
  "after the story the rival towns come at random, never on a rhythm": () => {
    const gaps = [];
    let day = 50, last = 0;
    for (let i = 0; i < 60; i++) { last = musterGap(day, 9, last); gaps.push(last); day += last; }
    assert(gaps.every((g) => g >= REACH.muster.minGap && g <= REACH.muster.maxGap), "a gap out of range");
    assert(gaps.every((g, i) => i === 0 || g !== gaps[i - 1]), "the same wait twice running");
    assert(new Set(gaps).size >= 5, "the waits should really vary");
    const hours = new Set();
    for (let d = 0; d < 60; d++) {
      const open = openTime("muster", 4, d, 9);
      assert(open >= REACH.duskTime && open < 20000, `a raid at ${clock(open)}`);
      hours.add(open);
    }
    assert(hours.size >= 4, "raids should come at different hours");
    assert(!profile("muster", AFTER).clock, "people keep no clock");
  },
  "the wait before the horn is long at first and shorter later": () => {
    const full = openTime("counted", 3) - REACH.duskTime;
    assertEqual(omenWait(0, full), full);
    assertEqual(omenWait(2, full), full);
    assert(omenWait(3, full) < full && omenWait(6, full) < omenWait(3, full), "it should shorten in two steps");
    assertEqual(duskSpeed(0, openTime("counted", 3)), 1);
    assert(duskSpeed(10, openTime("counted", 3)) > 2);
    assertEqual(duskSpeed(10, REACH.duskTime + 900), 1, "an evening that is already short is left alone");
  },
  "the night watch gives a hint, never a date": () => {
    assertEqual(watchBand(0), "near");
    assertEqual(watchBand(3), "soon");
    assertEqual(watchBand(undefined), "far");
    for (const lines of Object.values(WATCH_HINTS)) {
      assert(lines.length >= 3);
      for (const l of lines) assert(!/\d|day|night after|tomorrow/i.test(l), `"${l}" gives the date away`);
    }
    for (let d = 0; d < 20; d++) assert(watchHint(1, d) !== watchHint(1, d + 1), "never yesterday's line");
  },
  "every omen line has something that happens with it": () => {
    assertEqual(HOUR_ACTS.length, HOUR_LINES.length, "one act per line");
    assertEqual(new Set(HOUR_ACTS).size, HOUR_ACTS.length, "no act is used for two lines");
    for (const id of [...HOUR_ACTS, DUSK_ACT]) assert(typeof ACTS[id] === "function", `no act called ${id}`);
    for (let day = 5; day < 25; day++) {
      const seen = new Set();
      for (let hour = 1; hour <= 9; hour++) {
        const omen = hourOmen(day, 3, hour);
        assert(omen.id && !seen.has(omen.id), `day ${day} repeats ${omen.id} in one evening`);
        seen.add(omen.id);
      }
      assert([0, 1, 2, 3].some((q) => Math.abs(omenSide(day, 3) - q * (Math.PI / 2)) < 1e-9), "the omens point at one of the four walls");
    }
  },
  "no omen names what is coming": () => {
    for (const kind of ["counted", "stolen", "long", "muster"]) {
      for (let id = 1; id <= 6; id++) assert(!/hollow|morvane|oswin/i.test(duskLine(kind, id, 3)), `${kind} ${id}`);
    }
  },
});
