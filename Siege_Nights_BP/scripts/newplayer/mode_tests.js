// Self-tests for Story Mode and Settlement Mode (mode_rules.js, the Settlement Mode stages in act1_rules.js, the
// tracker in quests/rules.js and Old Elspeth's Settlement Mode scenes in lore/data/dialogue.js).

import { addTests, assert, assertEqual } from "../core/tests.js";
import { STORY, SETTLEMENT, modeFrom, isStory, choiceOpen, guideFlagsToClear, storyStepCounts } from "./mode_rules.js";
import { act1Stage, act1Step, growStep, growFlag, inAct1, F, TALK } from "./act1_rules.js";
import { questsFor } from "../quests/rules.js";
import { NPCS } from "../lore/data/dialogue.js";
import { startNode, blankProgress } from "../lore/logic.js";

const STORY_STAGES = ["wren", "ride_home", "find_ember", "ask_ember", "sleep", "aldous"];
// A settlement-mode player after the first raid, everything of days 1-3 done
const after = (more = {}) => ({ mode: SETTLEMENT, flags: [F.met, F.raid, F.mine], keep: true, sieges: 1, mine: true, ore: true, smelted: true, grow: { tier: 0, wins: 1, winsNeed: 3, build: [] }, ...more });
const withFlags = (f, ...flags) => ({ ...f, flags: [...f.flags, ...flags] });

addTests("mode", {
  "modes: every old save is Story Mode; the choice opens only once the story is finished on the world": () => {
    assertEqual(modeFrom(undefined), STORY);
    assertEqual(modeFrom("anything"), STORY);
    assertEqual(modeFrom(SETTLEMENT), SETTLEMENT);
    assert(isStory(undefined) && !isStory(SETTLEMENT));
    assert(!choiceOpen({}) && !choiceOpen({ ownDone: false, worldDone: false }), "a first play never sees the choice");
    assert(choiceOpen({ ownDone: true }) && choiceOpen({ worldDone: true }));
    assertEqual(guideFlagsToClear(["elspeth_met", "wren_met", "elspeth_grow_1", "fell_reeve"]).join(","), "elspeth_met,elspeth_grow_1", "only Elspeth's guide flags are cleared");
    assert(storyStepCounts(STORY) && !storyStepCounts(SETTLEMENT), "a story step never holds a Settlement Mode charter");
  },
  "Settlement Mode: the same first days, then Elspeth grows the hall instead of sending you to Wren": () => {
    assertEqual(act1Stage({ mode: SETTLEMENT, flags: [], keep: false, sieges: 0 }), "meet", "the same first meeting");
    assertEqual(act1Stage({ mode: SETTLEMENT, flags: [F.met], keep: true, sieges: 1 }), "talk_raid_won", "the same raid talk (her Settlement Mode words)");
    assertEqual(act1Stage(after({ keep: false, lost: true })), "rebanner");
    assertEqual(act1Stage(after({ wall: true })), "mend", "mend the wall first");
    assertEqual(act1Stage(after({ wall: true, mended: true, flags: [F.met, F.raid] })), "talk_mine", "a mine left on day 2 comes next");
    assertEqual(act1Stage(after()), "talk_grow_0");
    const grow0 = withFlags(after(), growFlag(0));
    assertEqual(act1Stage(grow0), "grow");
    assertEqual(act1Stage({ ...grow0, grow: { tier: 1 } }), "talk_grow_1", "each new tier opens with a talk");
    assertEqual(act1Stage(withFlags({ ...grow0, grow: { tier: 1 } }, growFlag(1))), "grow");
    assertEqual(act1Stage({ ...grow0, grow: { tier: 3 } }), "talk_grow_3");
    assertEqual(act1Stage(withFlags({ ...grow0, grow: { tier: 3 } }, growFlag(3))), "rest", "a Castle: nothing more to grow");
    assert(inAct1(after({ flags: [F.aldous, "morvane_fallen"], morvane: true })), "her guide stays on in Settlement Mode, even for someone who finished the story");
    // walk every combination a settlement-mode player can be in: never a story stage
    for (const keep of [true, false]) for (const wall of [true, false]) for (const mended of [true, false]) for (const tier of [0, 1, 2, 3]) for (const extra of [[], [growFlag(tier)], [F.wrenLead, F.ember, F.wrenMet]]) {
      const s = act1Stage(after({ keep, wall, mended, lost: !keep, flags: [F.met, F.raid, F.mine, ...extra], grow: { tier }, ember: "fallen", aldousHere: true }));
      assert(!STORY_STAGES.includes(s), `story stage ${s} in Settlement Mode`);
    }
    assertEqual(act1Stage({ ...withFlags(after(), F.mine), mode: STORY, flags: [F.met, F.raid, F.mine] }), "wren", "Story Mode is unchanged");
  },
  "Settlement Mode: the growing step names the next tier, the nights and what the charter still wants": () => {
    const s = growStep({ grow: { tier: 0, wins: 1, winsNeed: 3, build: ["Ironworks"] } });
    assertEqual(s.title, "Grow to a Town");
    assert(/1 of 3/.test(s.note) && /Ironworks/.test(s.note) && /Elspeth said/.test(s.hint), s.note);
    const c = growStep({ grow: { tier: 2, wins: 7, winsNeed: 10, warlords: 1, warlordsNeed: 2, build: [] } });
    assert(c.title === "Grow to a Castle" && /1 of 2/.test(c.note) && /Every building/.test(c.note), c.note);
    for (const t of [0, 1, 2, 3]) {
      assert(TALK.has(`talk_grow_${t}`), `talk_grow_${t} reads "Talk to Old Elspeth"`);
      const step = act1Step(`talk_grow_${t}`, {}, { hearth: { x: 1, z: 1 } });
      assert(step?.npc?.name === "Old Elspeth" && step.target, `talk_grow_${t} pins Elspeth`);
    }
    assert(!/raid|siege|attack/i.test(act1Step("talk_grow_0", {}, {}).hint), "no new foreknowledge in the hint");
  },
  "Settlement Mode: the tracker never shows a story step": () => {
    const f = { flags: [], solved: [], got: [], items: {}, keep: true, dim: "minecraft:overworld", pos: { x: 0, z: 0 }, hollow: {}, plot: "Lanternbog", mode: SETTLEMENT };
    const story = /^(wren|mystery|boss_|field_notes|name_place|fork|strike|rift|seat|carter|court|act1_(wren|ride_home|find_ember|ask_ember|sleep|aldous))/;
    for (const more of [{}, { flags: ["wren_met"] }, { flags: ["fell_reeve", "fell_huntsman", "fell_bride"] }, { act1: { on: false } }, { act1: { on: true, step: undefined } }]) {
      const ids = questsFor({ ...f, ...more }).map((q) => q.id);
      assert(!ids.some((id) => story.test(id)), `story step in Settlement Mode: ${ids.join(",")}`);
    }
    const farmer = { at: { x: 1, z: 1 }, sold: 0 };
    assert(questsFor({ ...f, farmer }).some((q) => q.id === "farmer"), "the settlement's own steps still show");
    assert(questsFor({ ...f, mode: STORY }).some((q) => q.id === "wren"), "Story Mode still leads to Wren");
  },
  "Settlement Mode: Old Elspeth has a scene for every stage, and none of them speaks of the story": () => {
    const elspeth = NPCS.find((n) => n.id === "elspeth");
    const p = blankProgress();
    const scene = (stage, mode) => startNode(elspeth, p, { act1: stage, mode });
    assertEqual(scene("talk_raid_won", SETTLEMENT), "raid_won_s");
    assertEqual(scene("talk_raid_lost", SETTLEMENT), "raid_lost_s");
    assertEqual(scene("talk_raid_won", STORY), "raid_won", "Story Mode keeps the Wren lead");
    assertEqual(scene("talk_raid_won", undefined), "raid_won", "no mode is Story Mode");
    for (const t of [0, 1, 2, 3]) assertEqual(scene(`talk_grow_${t}`, SETTLEMENT), `grow_${t}`);
    assertEqual(scene("grow", SETTLEMENT), "grow_wait");
    const ids = ["raid_won_s", "raid_won2_s", "raid_lost_s", "grow_0", "grow_1", "grow_2", "grow_3", "grow_wait", "stuck_grow", "stuck2_grow"];
    for (const id of ids) {
      const n = elspeth.nodes[id];
      assert(n, `node ${id}`);
      const words = [n.text, ...(n.greets ?? []), ...n.opts.map((o) => o[0])].join(" ");
      assert(!/Wren|Millbrook|Ember|Aldous|Hollow|Morvane|\bKing\b|\bknights?\b/i.test(words), `${id} speaks of the story`);
      for (const [, next] of n.opts) assert(next === "end" || elspeth.nodes[next], `${id} leads to ${next}`);
    }
    for (const t of [0, 1, 2, 3]) assert(elspeth.nodes[`grow_${t}`].opts.some((o) => (o[2] ?? []).includes(`flag:${growFlag(t)}`)), `grow_${t} leaves its flag`);
  },
});
