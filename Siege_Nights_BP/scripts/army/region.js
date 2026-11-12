// Every soldier wears his settlement's regional look (Mateo, 2026-11-12: "themed correctly for the region that
// they're in"). The art (PR #210) gives each soldier the int property siege:region and events siege:region_0..5;
// colour still comes from the Keep Banner (siege:color_N, siege/guards.js).
import { world } from "@minecraft/server";
import { onTick, keepOf } from "../siege/api.js";
import { guardOwner } from "../siege/guards.js";
import { regionAt } from "../economy/shops.js";

// economy/config.js REGIONS names -> the art's siege:region numbers (5 = the Hollow, never in the overworld)
export const REGION_INDEX = { "Aldmere Vale": 0, Frostmarch: 1, Saltreach: 2, Emberwaste: 3, Blackfen: 4 };

export function dressRegion(guard, owner = guardOwner(guard)) {
  const keep = owner && keepOf(owner);
  const at = keep ?? guard.location;
  const n = REGION_INDEX[regionAt(at)] ?? 0;
  try { if (guard.getProperty("siege:region") !== n) guard.triggerEvent(`siege:region_${n}`); } catch { /* an older model without regions */ }
}

onTick("army-region", 200, () => {
  try { for (const g of world.getDimension("minecraft:overworld").getEntities({ families: ["siege_guard"] })) dressRegion(g); } catch { /* fine */ }
});
