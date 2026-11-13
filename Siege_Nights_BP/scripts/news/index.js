// World news in chat (the Crier). Which events and the words: rules.js.
// Each line goes out a tick after its event, so listeners that fill in the event (wallUpgrade's handled) have run.
// Test: /scriptevent siege:news_test   reads one sample of every line to you

import { world, system } from "@minecraft/server";
import { on } from "../core/events.js";
import { placeName } from "../minimap/data.js";
import { NEWS, PREFIX, killerName, deathLine, STREAK_LOSS } from "./rules.js";
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

// Siege-night streaks: after dawn, each besieged settlement whose streak hit a milestone or was broken
on("siegeEnd", ({ besieged = [] }) => system.runTimeout(() => {
  const was = (store.data.streaks ??= {});
  for (const owner of besieged) {
    const keep = keepOf(owner);
    if (!keep) continue;
    const now = keep.streak ?? 0, before = was[owner] ?? 0;
    was[owner] = now;
    const line = NEWS.siegeStreak({ settlement: keep.name, streak: now, lost: now === 0 && before >= STREAK_LOSS ? before : 0 }, ctx);
    cry(line);
  }
  store.save();
}, 2));

// Every player death, once. The game's own death messages are off (core/gamerules.js), so this line is the only one.
// Killed inside a settlement: everyone else hears only that they died (an attack is the Messenger's news), and the
// victim is told what killed them.
world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  if (deadEntity?.typeId !== "minecraft:player") return;
  let data;
  try {
    const victim = deadEntity.name, dim = deadEntity.dimension.id, { x, z } = deadEntity.location;
    data = { victim, cause: damageSource?.cause, dim, x, z, home: dim === OVERWORLD && !!settlementAt(deadEntity.location) };
    let killer;
    try { killer = damageSource?.damagingEntity; if (killer && !killer.isValid) killer = undefined; } catch { killer = undefined; }
    if (killer && killer.id !== deadEntity.id) {
      const isPlayer = killer.typeId === "minecraft:player";
      data.kind = isPlayer ? "player" : "creature";
      data.killer = isPlayer ? killer.name : killerName(killer.nameTag, killer.typeId);
      try { if (!isPlayer && killer.matches?.({ families: ["siege_boss"] })) data.kind = "boss"; } catch { /* old API */ }
    }
  } catch (e) { console.warn(`[Hollow Crown] news death: ${e}`); }
  if (!data) return;
  const id = deadEntity.id;
  system.run(() => {
    const all = deathLine(data, ctx), own = deathLine(data, ctx, { full: true });
    for (const p of world.getAllPlayers()) {
      try { p.sendMessage(PREFIX + (p.id === id ? own : all)); } catch { /* left */ }
    }
  });
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:news_test") return;
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const sample = { player: p, owner: p.id, ownerName: p.name, name: "The Pale Huntsman", first: true, handled: true, level: 3,
    dim: OVERWORLD, x: p.location.x, z: p.location.z, players: [p.name], plot: { name: "Thornfield" }, station: { name: "Kingsrest Station" },
    lord: { name: "Lord Aldric", plot: "Thornfield" }, winner: { name: "Lord Aldric" }, loser: { name: "Lady Wren" },
    settlement: p.name, streak: 10, firstFor: p.name, itemName: "gold ingots", count: 32, price: 600, normal: 300, by: p.name, victim: p.name, killer: "The Pale Huntsman", kind: "boss" };
  for (const [event, words] of Object.entries(NEWS)) {
    const line = words(sample, ctx);
    if (line) p.sendMessage(`${PREFIX}${line} §8(${event})`);
  }
  for (const d of [{ kind: "creature", killer: "Ash Scarab" }, { kind: "boss", killer: "The Pale Huntsman" }, { kind: "player", killer: p.name }, { cause: "fall" }, { cause: "drowning" }])
    p.sendMessage(`${PREFIX}${deathLine({ ...sample, ...d, victim: p.name }, ctx)} §8(death)`);
});
