// A gentle start (Mateo, 2026-11-12: "cool off on the mobs at the beginning, and then let us move into it").
//
// A new player's first days are quiet: none of our wild monsters (toads, scarabs, wolves, wights...) come near
// them, and nothing from the Hollow walks their nights. From then on a growing share is let through, and after
// the first week the world is at full strength. It is per player, so a friend who joins late gets the same
// start, and a veteran standing next to a newcomer is spared with them.
// Sieges, bosses and vanilla monsters are not touched: this is only the wildlife and the night walkers.
//   /scriptevent siege:gentle        shows your day and how much of the wild is let through
//   /scriptevent siege:gentle_end    ends your quiet start now (for testing)

import { world, system, GameMode } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../siege/api.js";

export const GENTLE = {
  quietDays: 2, // days 0 and 1: nothing wild comes for you
  firstShare: 0.25, // on the first day after that, a quarter of what would have spawned does
  fullByDay: 8, // from this day on, everything does
  radius: 64, // a spawn counts as "near" a player inside this many blocks
};
const FIRST_DAY = "siege:bestiary_first_day";
// The monsters with natural spawn rules (spawn_rules/bestiary_*.json)
export const WILD = ["siege:mire_toad", "siege:ash_scarab", "siege:rimewolf", "siege:barrow_wight", "siege:bog_hag", "siege:brine_lurker", "siege:dune_wyrm"];

// Pure: how much of the wild reaches a player who has been in the world this many days (0 to 1).
export function wildShare(days, g = GENTLE) {
  if (!(days >= g.quietDays)) return 0;
  if (days >= g.fullByDay) return 1;
  return g.firstShare + ((1 - g.firstShare) * (days - g.quietDays)) / (g.fullByDay - g.quietDays);
}

// Days since this player's start. The clock starts the first time we see them, so worlds older than this rule get the quiet start too.
export function daysIn(player) {
  try {
    const today = world.getDay();
    let first = player.getDynamicProperty(FIRST_DAY);
    if (typeof first !== "number" || first > today) { first = today; player.setDynamicProperty(FIRST_DAY, first); }
    return today - first;
  } catch {
    return GENTLE.fullByDay; // can't tell: don't hold anything back
  }
}
export const shareFor = (player) => wildShare(daysIn(player));

// The share for a spot: the newest survival player near it decides. undefined = nobody near, leave it alone.
export function shareNear(dim, location) {
  let share;
  for (const p of dim.getPlayers({ location, maxDistance: GENTLE.radius })) {
    try { if (p.getGameMode() === GameMode.Creative || p.getGameMode() === GameMode.Spectator) continue; } catch { continue; }
    share = Math.min(share ?? 1, shareFor(p));
  }
  return share;
}

world.afterEvents.playerSpawn.subscribe(({ player }) => { daysIn(player); });

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  let type;
  try { type = entity.typeId; } catch { return; }
  if (!WILD.includes(type)) return;
  system.run(() => { // a tick later, so whoever spawned it on purpose (a boss, the showcase) has put its tags on
    try {
      if (!entity.isValid || entity.getTags().length || entity.nameTag) return;
      const share = shareNear(entity.dimension, entity.location);
      if (share === undefined || Math.random() < share) return;
      entity.remove();
    } catch { /* gone already */ }
  });
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const p = event.sourceEntity;
  if (!p || p.typeId !== "minecraft:player") return;
  if (event.id === "siege:gentle") {
    const days = daysIn(p), share = wildShare(days);
    p.sendMessage(`§6Gentle start:§7 day ${days + 1} for you. ${share >= 1 ? "The wild is at full strength." : share === 0 ? `Nothing wild comes for you yet (quiet for ${GENTLE.quietDays} days, full strength from day ${GENTLE.fullByDay + 1}).` : `${Math.round(share * 100)}% of the wild reaches you (full strength from day ${GENTLE.fullByDay + 1}).`}`);
  } else if (event.id === "siege:gentle_end") {
    try { p.setDynamicProperty(FIRST_DAY, world.getDay() - GENTLE.fullByDay); } catch { /* not now */ }
    p.sendMessage("§6Gentle start:§7 over for you. The wild is at full strength.");
  }
});

addTests("bestiary", {
  "a new player's first days are quiet, then the wild comes in step by step": () => {
    assertEqual(wildShare(0), 0);
    assertEqual(wildShare(1), 0);
    assertEqual(wildShare(2), 0.25);
    assert(wildShare(3) > wildShare(2) && wildShare(7) > wildShare(6) && wildShare(7) < 1, "it grows each day");
    assertEqual(wildShare(8), 1);
    assertEqual(wildShare(400), 1);
    assertEqual(wildShare(undefined), 0);
  },
});
