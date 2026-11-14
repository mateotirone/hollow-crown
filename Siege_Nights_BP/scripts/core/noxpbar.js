// No vanilla XP bar (Mateo, 2026-11-14: "Remove the vanilla xp bar"). The green bar above the hotbar and the level
// number on it are hidden for every player, all the time. Our own HUD (Regal balance beside the hotbar, the minimap
// and quest tracker top right) never sat on that strip. The game keeps the empty strip, so the resource pack moves
// the hearts, armour, hunger and air rows down onto the hotbar (tools/hud_rows_ui.py), except while riding a mount
// whose jump bar needs it.
//
// How: the script HUD call setHudVisibility(Hide, [ProgressBar]), the same switch as `/hud @s hide progress_bar`.
// It works on a Realm with no Beta and no resource pack change. The game forgets it when a player rejoins, so it is
// put back on every spawn, and again now and then in case anything (an admin's /hud reset) turned it back on.
//
// The one exception: Bedrock draws the horse jump bar (and the camel dash bar) in that same slot, and the same switch
// hides it. A horse with no jump bar can't be charged for a jump, so while a player rides something that jumps the
// slot is handed back to the game. The game shows the jump bar there instead of the XP bar, so XP still never shows.
//
// XP itself still works: orbs, Bottles o' Enchanting, siege wins (+XP) and anvils and enchanting tables all go on
// as in vanilla. Those screens show the level cost and grey out what you can't afford; only the bar is gone.

import { world, system, HudElement, HudVisibility } from "@minecraft/server";
import { onTick } from "./loop.js";
import { addTests, assert } from "./tests.js";

const POLL = 10; // ticks between looks at what each player rides
const REAPPLY = 600; // ticks: set it again now and then, in case it was reset

// Pure: does riding this entity need the bar slot back (for its jump or dash bar)?
const JUMPERS = /^minecraft:(horse|donkey|mule|skeleton_horse|zombie_horse|camel)$|^siege:steed$/;
export const needsSlot = (typeId) => typeof typeId === "string" && JUMPERS.test(typeId);

const shown = new Map(); // player id -> { hidden, at }

function mountOf(player) {
  try { return player.getComponent("minecraft:riding")?.entityRidingOn?.typeId; } catch { return undefined; }
}

function apply(player, force = false) {
  const hide = !needsSlot(mountOf(player));
  const last = shown.get(player.id);
  const now = system.currentTick;
  if (!force && last && last.hidden === hide && now - last.at < REAPPLY) return;
  player.onScreenDisplay.setHudVisibility(hide ? HudVisibility.Hide : HudVisibility.Reset, [HudElement.ProgressBar]);
  shown.set(player.id, { hidden: hide, at: now });
}

onTick("no_xp_bar", POLL, () => {
  for (const player of world.getAllPlayers()) {
    try { apply(player); } catch { /* a player mid-respawn or leaving */ }
  }
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  shown.delete(player.id);
  try { apply(player, true); } catch { /* the next poll picks them up */ }
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => shown.delete(playerId));

addTests("no_xp_bar", {
  "horses, donkeys, mules, camels and our steeds get the jump bar slot; nothing else does": () => {
    for (const id of ["minecraft:horse", "minecraft:donkey", "minecraft:mule", "minecraft:camel", "siege:steed", "minecraft:skeleton_horse"]) assert(needsSlot(id), id);
    for (const id of ["siege:dragon", "minecraft:boat", "minecraft:minecart", "minecraft:pig", "minecraft:strider", "minecraft:horse_armor", undefined, ""]) assert(!needsSlot(id), String(id));
  },
});
