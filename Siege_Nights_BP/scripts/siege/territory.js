// Land: who owns where, settlement tiers, alliances and banner colors.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { COLORS, WRIT } from "./constants.js";
import { saveState, state } from "./state.js";
import { title } from "./util.js";

// ---------- Settlement growth: Hamlet → Town → City ----------
// Every siege your keep survives counts as a win. Wins grow your settlement.

export const TIERS = [
  { name: "Hamlet", wins: 0, radius: 32, keepHealth: 200 },
  { name: "Town", wins: 3, radius: 48, keepHealth: 300 },
  { name: "City", wins: 6, radius: 64, keepHealth: 400 },
  { name: "Castle", wins: 10, warlords: 2, radius: 80, keepHealth: 600 }, // also needs 2 warlords slain
];
export const MAX_RADIUS = TIERS[TIERS.length - 1].radius;

export function tierOf(keep) {
  return [...TIERS].reverse().find((t) => (keep.wins ?? 0) >= t.wins && (keep.warlordsSlain ?? 0) >= (t.warlords ?? 0));
}

const ownerOfKeep = (keep) => Object.keys(state.keeps).find((id) => state.keeps[id] === keep);

// How far a settlement's land reaches from its banner: the tier's radius, unless a feature fixes it
// (filter "landRadius": on a mapped plot the land is full size from day one and wins do not grow it)
export const landRadius = (keep, owner = ownerOfKeep(keep)) => applyFilter("landRadius", tierOf(keep).radius, { keep, owner });

export function recordWin(owner) {
  const keep = state.keeps[owner];
  if (!keep) return;
  const before = TIERS.find((t) => t.name === keep.tier) ?? tierOf(keep); // warlord kills mid-siege can count too
  keep.wins = (keep.wins ?? 0) + 1;
  const after = tierOf(keep);
  keep.tier = after.name;
  saveState();
  if (after === before) return;
  emit("tierUp", { owner, before, after });
  if (after.name === "Castle") {
    for (const p of world.getPlayers()) p.sendMessage(`§4The Warlord King has heard of ${keep.name}'s Castle. Their next siege will be the Grand Siege.`);
  }
  for (const p of world.getPlayers()) {
    if (p.id === owner) {
      const grew = landRadius(keep, owner) === after.radius && after.radius !== before.radius;
      title(p, `§6Your ${before.name} is now a ${after.name}!`, grew ? `§7Your land reaches ${after.radius} blocks and your keep is tougher` : "§7Your keep is tougher, and there is more to build");
      p.playSound("ui.toast.challenge_complete");
    } else {
      p.sendMessage(`§6${keep.name}'s ${before.name} has grown into a ${after.name}!`);
    }
  }
}

// ---------- Alliances: a Writ of Alliance lets a friend build on your land ----------


export function isAlly(owner, playerId) {
  return state.keeps[owner]?.allies?.includes(playerId) ?? false;
}

export function useWrit(player) {
  const keep = state.keeps[player.id];
  if (!keep) return player.sendMessage("§7You need a settlement before you can make alliances.");
  const target = player.getEntitiesFromViewDirection({ maxDistance: 8 })
    .map((hit) => hit.entity).find((e) => e.typeId === "minecraft:player");
  if (!target) return player.onScreenDisplay.setActionBar("§7Look at a player and use the writ to ally with them.");
  keep.allies ??= [];
  if (keep.allies.includes(target.id)) {
    keep.allies = keep.allies.filter((id) => id !== target.id);
    player.sendMessage(`§7${target.name} is no longer allied with your settlement.`);
    target.sendMessage(`§7${player.name} has ended your alliance. You can no longer build on their land.`);
  } else {
    keep.allies.push(target.id);
    player.sendMessage(`§6${target.name} is now your ally and can build on your land.`);
    target.sendMessage(`§6${player.name} has made you an ally. You can build on their land.`);
    player.playSound("random.levelup");
  }
  saveState();
}

world.afterEvents.itemUse.subscribe((event) => {
  if (!state) return;
  if (event.itemStack.typeId === WRIT) useWrit(event.source);
});

// Which settlement a spot belongs to (owner id), or undefined in the wilds
export function settlementAt(location) {
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (Math.hypot(location.x - keep.x, location.z - keep.z) <= landRadius(keep, owner)) return owner;
  }
  return applyFilter("landOwner", undefined, { location }); // extra land from addLandClaim; undefined if none
}

export function foreignSettlement(player, location, dimensionId) {
  if (dimensionId !== "minecraft:overworld") return undefined;
  const owner = settlementAt(location);
  return owner && owner !== player.id && !isAlly(owner, player.id) ? owner : undefined;
}

// ---------- Settlement colors: unique per player, and Guard armor cloth matches ----------

export function colorTaken(color, exceptOwner) {
  return Object.entries(state.keeps).some(([o, k]) => o !== exceptOwner && k.color === color);
}

export function freeColor(preferred) {
  if (!colorTaken(preferred)) return preferred;
  return COLORS.findIndex((_, i) => !colorTaken(i));
}
