// Everwake Wings: the reward at the end of the Everwake storyline (design: everwake story doc, Mateo 2026-11-12).
//
// - Using the item puts the wings on. They are not an armour piece and take no slot, so any armour
//   (full Choirsteel included) is worn with them. They never break and are never lost.
// - Take them off at any Looking Glass (Mateo 2026-11-13: "I can't take the wings off"). They come back as the
//   item, locked in your inventory and kept on death, so they still can't be dropped or lost. Use it to wear them again.
// - They glide exactly like an elytra: jump, then press jump again in the air to open them; steer with your view.
// - Press jump again while gliding, or Use with an item in your hand (not looking at a block): a silent burst of
//   speed. No sound, no particles, nothing used up. Jump was added because the game sends no Use for most items
//   in the air (playtest 1.2.1546, Mateo: "the boost doesn't work").
// - In the Hollow they will not open, and say why (Mateo 2026-11-12). Third nights and sieges are fine.
//
// The player property siege:wings (0 none, 1 folded, 2 gliding, 3 boost, 4 landing) drives the resource pack's
// wing model and animations (animation.siege.everwake_wings.*, Siege_Nights_RP/animations/everwake_wings.animation.json).
// Test: /scriptevent siege:wings_give (creative) gives the item; /scriptevent siege:wings_unbind takes them back.

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { onTick } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { glideStep, boostStep, settle, BOOST_TICKS, STATE } from "./flight.js";
import "./tests.js";

export const WINGS_ITEM = "siege:everwake_wings";
const PROP = "siege:wings";
const BOUND = "siege:wings_bound";
const HOLLOW_LINE = "§7The wings won't open. Down here the note in them goes silent.";

const fly = new Map();   // player id -> live flight state (not saved: nobody is mid-air across a reload)

export const hasWings = (player) => { try { return player.getDynamicProperty(BOUND) === true; } catch { return false; } };
function show(player, s) {
  try { if (player.getProperty(PROP) !== s) player.setProperty(PROP, s); } catch { /* the pack's player file is missing */ }
}

export function bindWings(player) {
  player.setDynamicProperty(BOUND, true);
  show(player, STATE.folded);
  player.sendMessage("§fThe wings settle across your back and are gone from your hands.§7 They are yours now. A Looking Glass will take them off again.");
  player.onScreenDisplay?.setActionBar("§7Jump, then jump again in the air, to open them. Jump again while gliding for a burst of speed.");
}

/** The wings item as it comes off your back: locked in the inventory and kept on death, so it is never lost. */
export function wingsItem() {
  const it = new ItemStack(WINGS_ITEM, 1);
  try { it.lockMode = ItemLockMode.inventory; } catch { /* older game: plain item */ }
  try { it.keepOnDeath = true; } catch { /* */ }
  return it;
}

/** Take the wings off: they go back into the inventory as the item. Returns false (and says why) if there's no room. */
export function takeOffWings(player) {
  if (!hasWings(player)) return false;
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv || inv.emptySlotsCount < 1) { player.sendMessage("§7Make room in your pack first: the wings need a free slot."); return false; }
  inv.addItem(wingsItem());
  player.setDynamicProperty(BOUND, undefined);
  fly.delete(player.id);
  show(player, STATE.off);
  player.sendMessage("§7You fold the wings and take them off. Use them to put them on again.");
  return true;
}

const look = (p) => p.getViewDirection();
// Creative flight counts as not airborne: gliding on top of it made the two fight and the player jitter
// (playtest 1.2.1546, "glitchy"). In creative, step off a ledge and tap jump once while falling to open them.
const airborne = (p) => !p.isOnGround && !p.isInWater && !p.isSwimming && !p.isFlying && !(p.getComponent?.("minecraft:riding")?.entityRidingOn);
function groundBelow(p, depth) {
  const { x, y, z } = p.location;
  for (let d = 1; d <= depth; d++) {
    try { const b = p.dimension.getBlock({ x, y: y - d, z }); if (b && !b.isAir && !b.isLiquid) return true; } catch { return false; }
  }
  return false;
}
function cushion(p) {   // no fall damage from a glide: the slow fall resets it, hidden
  try { p.addEffect("slow_falling", 10, { amplifier: 0, showParticles: false }); } catch { /* effect refused */ }
}

function tickPlayer(p) {
  let f = fly.get(p.id);
  if (!f) fly.set(p.id, (f = { gliding: false, wasJumping: false, airTicks: 0, boost: 0, showBoost: 0, landing: 0, v: null, last: null, hollowAt: -99 }));
  const now = system.currentTick;
  const air = airborne(p), jumping = !!p.isJumping;
  const pressed = jumping && !f.wasJumping;
  f.wasJumping = jumping;
  f.airTicks = air ? f.airTicks + 1 : 0;

  if (!f.gliding) {
    if (f.landing > 0) { f.landing--; cushion(p); show(p, STATE.landing); return; }
    show(p, STATE.folded);
    if (!(pressed && air && f.airTicks > 3)) return;
    if (p.dimension.id === UNDERTOW_ID) {
      if (now - f.hollowAt > 60) { f.hollowAt = now; p.onScreenDisplay?.setActionBar(HOLLOW_LINE); }
      return;
    }
    const v0 = p.getVelocity();
    f.gliding = true; f.v = { x: v0.x, y: v0.y, z: v0.z }; f.last = { ...p.location }; f.boost = 0; f.since = now;
  } else if (pressed && now - (f.since ?? 0) > 5) {
    f.boost = BOOST_TICKS; f.showBoost = 5;   // jump again while gliding: the silent burst
  }

  // stop: on the ground, in water, mounted, or carried into the Hollow
  if (!air || p.dimension.id === UNDERTOW_ID) {
    f.gliding = false; f.boost = 0; f.landing = air ? 0 : 10; cushion(p);
    show(p, air ? STATE.folded : STATE.landing);
    return;
  }
  const L = look(p), pitch = p.getRotation().x;
  const moved = { x: p.location.x - f.last.x, y: p.location.y - f.last.y, z: p.location.z - f.last.z };
  f.last = { ...p.location };
  f.v = settle(f.v, moved);
  f.v = glideStep(f.v, L, pitch);
  if (f.boost > 0) { f.boost--; f.v = boostStep(f.v, L); }
  try { p.applyKnockback({ x: f.v.x, z: f.v.z }, f.v.y); } catch { /* can't be pushed right now */ }
  cushion(p);
  if (f.showBoost > 0) { f.showBoost--; show(p, STATE.boost); }
  else show(p, pitch < 25 && groundBelow(p, 3) ? STATE.landing : STATE.glide);
}

onTick("wings", 1, () => {
  for (const p of world.getAllPlayers()) {
    if (!hasWings(p)) { if (fly.has(p.id)) fly.delete(p.id); continue; }
    tickPlayer(p);
  }
});

// Use: bind the wings item, or boost while gliding
world.afterEvents.itemUse.subscribe(({ source: p, itemStack }) => {
  if (!p || p.typeId !== "minecraft:player") return;
  if (itemStack?.typeId === WINGS_ITEM) {
    if (hasWings(p)) { p.sendMessage("§7The wings are already yours."); return; }
    try { p.getComponent("minecraft:inventory").container.setItem(p.selectedSlotIndex, undefined); } catch { return; }
    bindWings(p);
    return;
  }
  const f = fly.get(p.id);
  if (!f?.gliding) return;
  let aimed;
  try { aimed = p.getBlockFromViewDirection({ maxDistance: 6 }); } catch { aimed = undefined; }
  if (aimed) return;
  f.boost = BOOST_TICKS; f.showBoost = 5;   // silent: no sound, no particles, nothing used up
});

// the property is the entity's, so set it again on every spawn from the saved bond
world.afterEvents.playerSpawn.subscribe(({ player }) => {
  fly.delete(player.id);
  show(player, hasWings(player) ? STATE.folded : STATE.off);
});
world.afterEvents.playerLeave?.subscribe(({ playerId }) => fly.delete(playerId));

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: p }) => {
  if (!p || p.typeId !== "minecraft:player") return;
  if (id === "siege:wings_give") {
    if (p.getGameMode?.() !== "Creative" && p.getGameMode?.() !== "creative") { p.sendMessage("§7Creative only: the wings are earned."); return; }
    system.run(() => { try { p.runCommand(`give @s ${WINGS_ITEM}`); } catch { /* */ } });
  } else if (id === "siege:wings_unbind") {
    p.setDynamicProperty(BOUND, undefined); fly.delete(p.id); show(p, STATE.off);
    p.sendMessage("§7The wings are gone (test).");
  }
});
