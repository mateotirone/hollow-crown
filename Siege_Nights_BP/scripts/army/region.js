// Every soldier wears his settlement's regional look and his armour tier's look (Mateo, 2026-11-12: "themed correctly for the region that
// they're in"). The art (PR #210) gives each soldier the int property siege:region and events siege:region_0..5;
// colour still comes from the Keep Banner (siege:color_N, siege/guards.js).
import { world } from "@minecraft/server";
import { onTick, keepOf } from "../siege/api.js";
import { guardOwner } from "../siege/guards.js";
import { regionAt } from "../economy/shops.js";
import { SOLDIER } from "./roster.js";

// economy/config.js REGIONS names -> the art's siege:region numbers (5 = the Hollow, never in the overworld)
export const REGION_INDEX = { "Aldmere Vale": 0, Frostmarch: 1, Saltreach: 2, Emberwaste: 3, Blackfen: 4 };

export function dressRegion(guard, owner = guardOwner(guard)) {
  const keep = owner && keepOf(owner);
  const at = keep ?? guard.location;
  const n = REGION_INDEX[regionAt(at)] ?? 0;
  try { if (guard.getProperty("siege:region") !== n) guard.triggerEvent(`siege:region_${n}`); } catch { /* an older model without regions */ }
}

// Armour look (siege:tier, the art's per-type armour): equipGuard fires siege:tier_N; guards from older worlds
// carry only the siege:armor dynamic property, so bring their look in line once they load
export function dressTier(guard) {
  const tier = Number(guard.getDynamicProperty("siege:armor") ?? 0);
  try { if (guard.getProperty("siege:tier") !== tier) guard.triggerEvent(`siege:tier_${tier}`); } catch { /* an older model */ }
}

// A soldier is never invisible (Mateo, 2026-11-14: "What about the invisible soldiers"). Invisibility hides the body
// but not the weapon in his hand, so all anyone sees is a floating sword. Nothing in the game hides a soldier on
// purpose, so whatever gave it (the old night rest, a stray potion or spell, an older save), take it off.
export function unhideSoldier(guard) {
  if (!SOLDIER[guard.typeId]) return false;
  try { if (guard.getEffect("invisibility")) { guard.removeEffect("invisibility"); return true; } } catch { /* gone */ }
  return false;
}

// at once when it lands (the 10-second sweep below catches anything this misses, and soldiers from older saves)
try {
  world.afterEvents.effectAdd?.subscribe((event) => {
    if (String(event.effect?.typeId ?? "").endsWith("invisibility")) unhideSoldier(event.entity);
  }, { entityTypes: Object.keys(SOLDIER) });
} catch { /* an engine without the event: the sweep still does it */ }

onTick("army-region", 200, () => {
  try { for (const g of world.getDimension("minecraft:overworld").getEntities({ families: ["siege_guard"] })) { dressRegion(g); dressTier(g); unhideSoldier(g); } } catch { /* fine */ }
});
