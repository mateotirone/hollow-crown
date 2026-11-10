// The first sighting (Mateo, 2026-11-10: the raids become "actual Hollow soldiers, our first glimpse ... the first real
// 'what the heck is that' moment, before we really learn what's causing all of this").
// The siege raids feature stages the moment and emits "firstGlimpse" { owners }, once per settlement. This file is the morning after:
// what your own people say at first light, and a flag ("morning_after") that opens one new conversation with
// Sigrun, Brother Cael, Old Mag, Sir Aldous and Archivist Pell. Nobody explains it. Each of them knows one corner.
//   /scriptevent siege:morning_after     hear the morning now and open the five conversations (testing)

import { world, system } from "@minecraft/server";
import { on, onTick, moduleStore, settlementAt, isAlly, addTests, assert, assertEqual } from "../siege/api.js";
import { progressOf, setFlag } from "./player.js";
import { NPCS } from "./data/dialogue.js";
import { startNode, blankProgress } from "./logic.js";

const store = moduleStore("hc:lore_glimpse", () => ({ day: -1, days: {} })); // day: unused since sightings became per settlement

// Said by nobody in particular: the people who live inside your walls. One set for those who stood on the wall
// and saw it, one for those who slept through it or were away.
export const MORNING = {
  saw: [
    ["§7At first light nobody is talking about it. They are sweeping. Everybody has found something to sweep.",
     "§7The smith's boy asks you, quietly, whether you saw it too. He looks relieved, and then he doesn't.",
     "§8\"It didn't have a face,\" he says. \"So how was it looking at me?\""],
    ["§7Somebody has chalked a line across the inside of the gate. Nobody will say who, or what it is for.",
     "§7The old woman at the well says the raiders weren't frightened of it. That is the part she can't put down.",
     "§8\"They stood aside for it,\" she says. \"Like you do for a priest.\""],
    ["§7The dead raiders are where they fell. The other ones left nothing. No body, no blood, no prints going away.",
     "§7There are prints coming in. Long, and too far apart.",
     "§8A child has measured one with her arm and gone indoors."],
  ],
  told: [
    ["§7Your people are waiting for you at the gate, all of them, which they have never done.",
     "§7They tell it badly and all at once. The army stopped. It looked behind it. Something tall walked up through it.",
     "§8\"Not a man,\" they keep saying. \"We'd know a man.\""],
  ],
};
export const morningLines = (saw, roll = 0) => {
  const set = saw ? MORNING.saw : MORNING.told;
  return set[Math.abs(Math.floor(roll)) % set.length];
};
// it is told on the first morning after the night it happened, never the same night
export const morningDue = (glimpseDay, today, time) => glimpseDay >= 0 && today > glimpseDay && time < 6000;

function tell(player) {
  const saw = progressOf(player).flags.includes("saw_them");
  const lines = morningLines(saw, world.getDay() + player.name.length);
  lines.forEach((line, i) => system.runTimeout(() => { try { player.sendMessage(line); } catch { /* left */ } }, 60 + i * 80));
  setFlag(player, "morning_after");
}

// Every settlement gets its own first sighting (Mateo's decision card, 2026-11-10), so "firstGlimpse" { owners }
// fires once per settlement. Only that settlement's people are told: its owner, its allies, and anyone standing
// inside it that night. store.days = { owner id: the day it happened }.
export const concerns = (owners, playerId, standingIn, allyOf = () => false) =>
  owners.some((o) => o === playerId || o === standingIn || allyOf(o, playerId));
// the earliest of this player's settlements' sightings whose morning has come (undefined if none yet)
export const morningFor = (days, owners, today, time) =>
  owners.map((o) => days[o]).filter((d) => d !== undefined && morningDue(d, today, time)).sort((x, y) => x - y)[0];

const standingIn = (player) => { try { return settlementAt(player.location); } catch { return undefined; } };
const ownersOf = (player) => Object.keys(store.data.days ?? {}).filter((o) => concerns([o], player.id, standingIn(player), isAlly));

on("firstGlimpse", ({ owners = [] } = {}) => {
  const d = store.data;
  d.days ??= {};
  for (const owner of owners) d.days[owner] ??= world.getDay();
  store.save();
  for (const player of world.getAllPlayers()) {
    try { if (concerns(owners, player.id, standingIn(player), isAlly)) setFlag(player, "saw_them"); } catch { /* left the game */ }
  }
});

onTick("lore_glimpse", 200, () => {
  const days = store.data.days;
  if (!days || !Object.keys(days).length) return;
  const today = world.getDay(), time = world.getTimeOfDay();
  if (time >= 6000) return;
  for (const player of world.getAllPlayers()) {
    try {
      if (progressOf(player).flags.includes("morning_after")) continue;
      if (morningFor(days, ownersOf(player), today, time) !== undefined) tell(player);
    } catch { /* left the game */ }
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id !== "siege:morning_after" || player?.typeId !== "minecraft:player") return;
  setFlag(player, "saw_them");
  const p = progressOf(player);
  p.flags = p.flags.filter((f) => f !== "morning_after");
  tell(player);
});

addTests("lore", {
  "first sighting: the morning after is told once, the next morning, and five people have something to say": () => {
    assert(!morningDue(-1, 9, 100) && !morningDue(8, 8, 100) && morningDue(8, 9, 100) && !morningDue(8, 9, 13000));
    // per settlement: only its owner, allies and whoever stood inside it; and only after that settlement's own night
    assert(concerns(["a"], "a") && concerns(["a"], "b", "a") && concerns(["a"], "c", undefined, (o, p) => o === "a" && p === "c"));
    assert(!concerns(["a"], "b") && !concerns(["a"], "b", "z") && !concerns([], "a", "a"));
    assertEqual(morningFor({ a: 8, b: 20 }, ["a", "b"], 9, 100), 8);
    assertEqual(morningFor({ a: 8, b: 20 }, ["b"], 9, 100), undefined, "another settlement's sighting is not yours");
    assertEqual(morningFor({ a: 8 }, ["a"], 8, 100), undefined);
    assertEqual(morningLines(true, 1).length, 3);
    assert(morningLines(false, 7)[1].includes("Something tall"));
    for (const [id, met] of [["sigrun", "sigrun_met"], ["cael", "cael_met"], ["mag", "mag_believed"], ["aldous", "aldous_met"], ["sage", "pell_met"]]) {
      const npc = NPCS.find((n) => n.id === id);
      const p = blankProgress();
      p.flags.push(met);
      assert(startNode(npc, p, {}) !== "saw", `${id} speaks too early`);
      p.flags.push("morning_after");
      assertEqual(startNode(npc, p, {}), "saw");
      p.flags.push(`${id}_saw`);
      assert(startNode(npc, p, {}) !== "saw", `${id} says it twice`);
      for (const [key, node] of Object.entries(npc.nodes)) assert(!key.startsWith("saw") || !/Oswin|Morvane/.test(node.text), `${id} names him`);
    }
  },
});
