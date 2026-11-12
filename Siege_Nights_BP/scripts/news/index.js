// World news in chat (the Crier). Which events and the words: rules.js.
// Each line goes out a tick after its event, so listeners that fill in the event (wallUpgrade's handled) have run.
// Test: /scriptevent siege:news_test   reads one sample of every line to you

import { world, system } from "@minecraft/server";
import { on, emit } from "../core/events.js";
import { placeName } from "../minimap/data.js";
import { NEWS, PREFIX, killerName } from "./rules.js";
import { moduleStore } from "../core/store.js";
import { settlementAt, keepOf } from "../siege/api.js";

const store = moduleStore("siege:news", () => ({ trains: {} })); // settlement owner id -> true once its first train ran
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

// Filling in an event before it is cried
const ENRICH = {
  enginePlaced(data) {
    const owner = data.owner ?? data.player?.id;
    if (!owner || !keepOf(owner) || store.data.trains[owner]) return;
    store.data.trains[owner] = true;
    store.save();
    data.firstFor = keepOf(owner).name;
  },
};

for (const [event, words] of Object.entries(NEWS)) {
  on(event, (data) => system.runTimeout(() => {
    ENRICH[event]?.(data);
    try { cry(words(data, ctx)); } catch (e) { console.warn(`[Hollow Crown] news ${event}: ${e}`); }
  }, 1));
}

// Notable deaths: to a boss, a creature of this add-on, or another player. Vanilla chat already reports the rest.
world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  if (deadEntity?.typeId !== "minecraft:player") return;
  try {
    const killer = damageSource.damagingEntity;
    if (!killer || killer.id === deadEntity.id) return;
    const isPlayer = killer.typeId === "minecraft:player";
    if (!isPlayer && !killer.typeId.startsWith("siege:")) return;
    const dim = deadEntity.dimension.id, { x, z } = deadEntity.location;
    if (dim === OVERWORLD && settlementAt(deadEntity.location)) return; // a fight on someone's land is the Messenger's news, not the Crier's
    let kind = isPlayer ? "player" : "creature";
    try { if (!isPlayer && killer.matches?.({ families: ["siege_boss"] })) kind = "boss"; } catch { /* old API */ }
    emit("playerFell", { victim: deadEntity.name, killer: isPlayer ? killer.name : killerName(killer.nameTag, killer.typeId), kind, dim, x, z });
  } catch { /* the killer is already gone */ }
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:news_test") return;
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const sample = { player: p, owner: p.id, ownerName: p.name, name: "The Pale Huntsman", first: true, handled: true, level: 3,
    dim: OVERWORLD, x: p.location.x, z: p.location.z, players: [p.name], plot: { name: "Thornfield" }, station: { name: "Kingsrest Station" },
    lord: { name: "Lord Aldric", plot: "Thornfield" }, winner: { name: "Lord Aldric" }, loser: { name: "Lady Wren" },
    firstFor: p.name, victim: p.name, killer: "The Pale Huntsman", kind: "boss" };
  for (const [event, words] of Object.entries(NEWS)) {
    const line = words(sample, ctx);
    if (line) p.sendMessage(`${PREFIX}${line} §8(${event})`);
  }
});
