// Keeps: the banner block and the keep heart raiders attack.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { KEEP_BANNER, KEEP_HEART } from "./constants.js";
import { saveState, state } from "./state.js";
import { tierOf } from "./territory.js";
import { overworld, ownerOf, ownerTag, title } from "./util.js";
import { sfx } from "../core/sfx.js";

// ---------- Settlements and keeps ----------
// Each player founds one settlement by placing a Keep Banner. Custom blocks can only be
// placed inside your own settlement. During a siege an invisible "keep heart" stands at
// each banner. Raiders attack it, and if it falls, that settlement loses the siege.


export function keepCenter(keep) {
  return { x: keep.x + 0.5, y: keep.y, z: keep.z + 0.5 };
}

// Keep heart health: the tier's number, unless a feature changes it (addKeepHealthHook)
export function keepHealth(owner, keep) {
  return applyFilter("keepHealth", tierOf(keep).keepHealth, { owner, keep });
}

// The banner block, or undefined if it's not loaded right now. Returns null if it's gone.
export function keepBlock(keep) {
  try {
    const block = overworld().getBlock(keep);
    if (!block) return undefined;
    return block.typeId === KEEP_BANNER ? block : null;
  } catch {
    return undefined;
  }
}

export function heartsOf(owner) {
  return overworld().getEntities({ type: KEEP_HEART, tags: [ownerTag(owner)] });
}

export function raiseKeepHeart(owner) {
  for (const heart of heartsOf(owner)) heart.remove();
  const keep = state.keeps[owner];
  if (!keep || !keepBlock(keep)) return;
  const heart = overworld().spawnEntity(KEEP_HEART, keepCenter(keep));
  heart.addTag(ownerTag(owner));
  heart.getComponent("minecraft:health")?.setCurrentValue?.(keepHealth(owner, keep));
  updateKeepName(heart);
}

export function updateKeepName(heart) {
  const health = heart.getComponent("minecraft:health");
  const keep = state?.keeps[ownerOf(heart)];
  if (!health) return;
  const max = keep ? keepHealth(ownerOf(heart), keep) : health.effectiveMax;
  heart.nameTag = `§6${keep?.sovereign ? "Sovereign " : ""}${keep?.name ?? "The"}'s ${keep ? tierOf(keep).name : "Keep"} §f${Math.ceil(health.currentValue)}/${max}`;
}

world.afterEvents.entityHurt.subscribe((event) => updateKeepName(event.hurtEntity), { entityTypes: [KEEP_HEART] });

world.afterEvents.entityDie.subscribe((event) => {
  const owner = ownerOf(event.deadEntity);
  if (state?.active && owner) keepFallen(owner);
}, { entityTypes: [KEEP_HEART] });

export function keepFallen(owner) {
  const keep = state.keeps[owner];
  if (keep) {
    const block = keepBlock(keep);
    if (block) overworld().runCommand(`setblock ${keep.x} ${keep.y} ${keep.z} air destroy`);
  }
  delete state.keeps[owner];
  if (!state.fallen.includes(owner)) state.fallen.push(owner);
  saveState();

  for (const heart of heartsOf(owner)) heart.remove();
  for (const raider of overworld().getEntities({ tags: [ownerTag(owner)] })) raider.remove(); // they loot and leave
  for (const player of world.getPlayers()) {
    if (player.id === owner) {
      title(player, "§4Your Keep has fallen", "§7Raise a new Keep Banner and rebuild");
      sfx(player, "mob.wither.death", { volume: 0.5 });
    } else {
      player.sendMessage(`§c${keep?.name ?? "A"}'s keep has fallen to the raiders!`);
    }
  }
  emit("keepFallen", { owner, keep });
}

export function checkKeeps() {
  // A keep banner that got broken: during a siege that settlement falls, otherwise it's just gone
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (keepBlock(keep) !== null) continue;
    if (state.active) {
      keepFallen(owner);
    } else {
      delete state.keeps[owner];
      saveState();
      world.getPlayers().find((p) => p.id === owner)?.sendMessage("§7Your Keep Banner is gone, so your settlement has been abandoned.");
    }
  }
}
