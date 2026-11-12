// World news in chat (the Crier). Which events and the words: rules.js.
// Each line goes out a tick after its event, so listeners that fill in the event (wallUpgrade's handled) have run.
// Test: /scriptevent siege:news_test   reads one sample of every line to you

import { world, system } from "@minecraft/server";
import { on } from "../core/events.js";
import { placeName } from "../minimap/data.js";
import { NEWS, PREFIX } from "./rules.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";

export const ctx = {
  where(dim, x, z) {
    if (dim !== OVERWORLD || typeof x !== "number") return "somewhere no map shows";
    try { return `near ${placeName(x, z)}`; } catch { return "out in the wilds"; }
  },
  nameOf: (id) => world.getAllPlayers().find((p) => p.id === id)?.name,
};

function cry(text) {
  if (!text) return;
  try { world.sendMessage(PREFIX + text); } catch { /* nobody to hear */ }
}

for (const [event, words] of Object.entries(NEWS)) {
  on(event, (data) => system.runTimeout(() => {
    try { cry(words(data, ctx)); } catch (e) { console.warn(`[Hollow Crown] news ${event}: ${e}`); }
  }, 1));
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:news_test") return;
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const sample = { player: p, owner: p.id, ownerName: p.name, name: "The Pale Huntsman", first: true, handled: true, level: 3,
    dim: OVERWORLD, x: p.location.x, z: p.location.z, players: [p.name], plot: { name: "Thornfield" }, station: { name: "Kingsrest Station" },
    lord: { name: "Lord Aldric", plot: "Thornfield" }, winner: { name: "Lord Aldric" }, loser: { name: "Lady Wren" } };
  for (const [event, words] of Object.entries(NEWS)) {
    const line = words(sample, ctx);
    if (line) p.sendMessage(`${PREFIX}${line} §8(${event})`);
  }
});
