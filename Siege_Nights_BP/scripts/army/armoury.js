// The Armoury (Mateo, 2026-11-12: "the armor should be upgradable somehow, and the texture changes").
//
// From the Barracks menu, "Armoury" upgrades a whole type of soldier at once: every one of that type you have gets
// the next armour (each tier has its own look, siege/guards.js GUARD_ARMOR), and every one trained or retrained
// later comes out wearing it. It costs the same materials as upgrading them one by one: the tier's price times the
// number of soldiers of that type (at least one). Clicking a single guard with the material still works too.

import { world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { moduleStore, emit, onTick } from "../siege/api.js";
import { GUARD_ARMOR, armorTier, equipGuard, guardTag } from "../siege/guards.js";
import { takeItems, countItem } from "../siege/util.js";
import { SOLDIERS } from "./roster.js";

const store = moduleStore("siege:armoury", () => ({ tiers: {} }));
const OVERWORLD = "minecraft:overworld";
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };

export const typeTier = (owner, type) => store.data.tiers[owner]?.[type] ?? 0;

// Pure: what the next tier costs for a type with `count` soldiers
export function armouryCost(tier, count) {
  const next = GUARD_ARMOR[tier + 1];
  if (!next) return undefined;
  return { tier: tier + 1, name: next.name, item: next.item, amount: next.cost * Math.max(1, count) };
}
const itemName = (id) => id.replace("minecraft:", "").replace(/_/g, " ");

function ofType(owner, type) {
  try { return world.getDimension(OVERWORLD).getEntities({ type, tags: [guardTag(owner)] }); } catch { return []; }
}

// Bring a new or retrained soldier up to its type's armour
export function dressForType(guard, owner) {
  const t = typeTier(owner, guard.typeId);
  if (t > armorTier(guard)) try { equipGuard(guard, t); } catch { /* gone */ }
}

export async function armouryMenu(player, owner = player.id) {
  const types = SOLDIERS.filter((s) => s.at === "barracks" && ofType(owner, s.id).length + typeTier(owner, s.id) > 0);
  if (!types.length) return say(player, "§7Train some soldiers first.");
  const form = new ActionFormData().title("Armoury").body("Upgrade the armour of a whole type of soldier at once. Those trained later wear it too.");
  const rows = types.map((s) => {
    const have = ofType(owner, s.id), tier = typeTier(owner, s.id), cost = armouryCost(tier, have.length);
    form.button(cost ? `${s.name}: ${GUARD_ARMOR[tier].name}\n§8Next ${cost.name}: ${cost.amount} ${itemName(cost.item)}` : `${s.name}: ${GUARD_ARMOR[tier].name}\n§8The best there is`);
    return { s, have, tier, cost };
  });
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  const { s, have, cost } = rows[res.selection];
  if (!cost) return say(player, `§7Your ${s.name}s already wear the best armour there is.`);
  const ok = await new MessageFormData().title(`Armoury: ${s.name}`)
    .body(`Every ${s.name} (${have.length}) gets §f${cost.name}§r, and so does every one trained later.\n\nCost: §6${cost.amount} ${itemName(cost.item)}§r (you have ${countItem(player, cost.item)}).`)
    .button1("Not now").button2("Upgrade").show(player);
  if (ok.canceled || ok.selection !== 1) return;
  if (!takeItems(player, cost.item, cost.amount)) return say(player, `§cYou need ${cost.amount} ${itemName(cost.item)}.`);
  (store.data.tiers[owner] ??= {})[s.id] = cost.tier;
  store.save();
  for (const g of ofType(owner, s.id)) dressForType(g, owner);
  say(player, `§6Your ${s.name}s now wear ${cost.name}.`);
  emit("armouryUpgraded", { owner, type: s.id, tier: cost.tier });
}

// Soldiers who joined later (retrained, placed from an item) catch up with their type's armour
onTick("armoury", 100, () => {
  for (const [owner, types] of Object.entries(store.data.tiers)) {
    for (const type of Object.keys(types)) for (const g of ofType(owner, type)) dressForType(g, owner);
  }
});
