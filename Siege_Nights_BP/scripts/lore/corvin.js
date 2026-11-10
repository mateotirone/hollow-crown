// Corvin Hale's voice (words in data/corvin.js). Only a Sorcerer hears him.
//   The first time: Resonance 70 or more, on a third night above or anywhere in the Hollow.
//   After that: one remark the first time the Sorcerer has each of the fourteen arts.
// He can be spoken to in the Hollow: /scriptevent siege:lore_npc corvin (place him in still water there).
//   /scriptevent siege:corvin        hear the first lines now (testing)

import { world, system } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { CORVIN } from "./data/corvin.js";
import { POWERS } from "./data/powers.js";
import { heroOf, progressOf, setFlag } from "./player.js";
import { isThirdNight } from "./singing.js";

const HOLLOW = "siege:undertow";
const LOUD = 70;
export const isSorcerer = (hero) => hero?.path === "marked" || hero?.path === "sorcerer";
export const canFirstHear = ({ sorcerer, resonance, inHollow, thirdNight }) => !!sorcerer && (resonance ?? 0) >= LOUD && (!!inHollow || !!thirdNight);
// The next art he has something to say about: one the Sorcerer has and has not yet been told off for
export const nextLesson = (skills, flags) => Object.keys(CORVIN.lessons).find((id) => (skills?.[id] ?? 0) > 0 && !flags.includes(`corvin_${id}`));

function sayFirst(player) {
  CORVIN.first.forEach((line, i) => system.runTimeout(() => { try { player.sendMessage(line); } catch {} }, i * 50));
  try { player.playSound("siege.choir.hum", { volume: 0.5, pitch: 1.12 }); } catch {}
}

function tick() {
  const third = isThirdNight();
  for (const player of world.getAllPlayers()) {
    try {
      const hero = heroOf(player);
      if (!isSorcerer(hero)) continue;
      const flags = progressOf(player).flags;
      if (!flags.includes("corvin_heard")) {
        if (canFirstHear({ sorcerer: true, resonance: hero.resonance, inHollow: player.dimension.id === HOLLOW, thirdNight: third }) && setFlag(player, "corvin_heard")) sayFirst(player);
        continue;
      }
      const lesson = nextLesson(hero.skills, flags);
      if (lesson && setFlag(player, `corvin_${lesson}`)) player.sendMessage(`§8A voice, a little off the note: §7§o${CORVIN.lessons[lesson]}`);
    } catch { /* left the game */ }
  }
}
onTick("lore_corvin", 200, tick);

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id === "siege:corvin" && player?.typeId === "minecraft:player") sayFirst(player);
});

addTests("lore", {
  "Corvin: only a loud Sorcerer hears him first, and he has a word for every art": () => {
    assert(canFirstHear({ sorcerer: true, resonance: 80, inHollow: true }));
    assert(canFirstHear({ sorcerer: true, resonance: 70, thirdNight: true }));
    assert(!canFirstHear({ sorcerer: true, resonance: 80 }), "not on an ordinary night above");
    assert(!canFirstHear({ sorcerer: false, resonance: 100, inHollow: true }), "a Knight never hears him");
    assert(!canFirstHear({ sorcerer: true, resonance: 20, inHollow: true }), "too quiet");
    assertEqual(Object.keys(CORVIN.lessons).sort(), Object.keys(POWERS).sort());
    assertEqual(nextLesson({ arc_bolt: 1, arc_ward: 2 }, ["corvin_arc_bolt"]), "arc_ward");
    assertEqual(nextLesson({ arc_bolt: 1 }, ["corvin_arc_bolt"]), undefined);
    for (const line of [...CORVIN.first, ...Object.values(CORVIN.lessons)]) assert(!/Oswin|Morvane/.test(line), "he does not say who it is");
  },
});
