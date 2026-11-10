// Menus: the Keep Banner, the Barracks, and your guards.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { applyFilter } from "../core/events.js";
import { COLORS, GUARD_TYPES } from "./constants.js";
import { GUARD_ARMOR, GUARD_COST, armorTier, guardCount, guardLimit, guardTag, recruitGuard, upgradeGuard } from "./guards.js";
import { keepHealth } from "./keep.js";
import { nextSiegeDay } from "./siege.js";
import { state } from "./state.js";
import { TIERS, settlementAt, tierOf, landRadius } from "./territory.js";
import { countItem, overworld } from "./util.js";
import { funds } from "../economy/coins.js";
import { coins, worth } from "../economy/rules.js";

// ---------- Menus: the Keep, the Barracks ----------

export function nextTierText(keep) {
  const next = TIERS[TIERS.indexOf(tierOf(keep)) + 1];
  if (!next) return keep.sovereign ? "§6You rule as Sovereign." : "§4The Warlord King is coming. Win the Grand Siege to become Sovereign.";
  const wins = Math.max(0, next.wins - (keep.wins ?? 0));
  const lords = Math.max(0, (next.warlords ?? 0) - (keep.warlordsSlain ?? 0));
  return `Next: §6${next.name}§r in ${wins} more win${wins === 1 ? "" : "s"}${lords ? ` and ${lords} more warlord${lords === 1 ? "" : "s"} slain` : ""}`;
}

export function keepMenu(block, player) {
  const owner = settlementAt(block.location);
  const keep = state.keeps[owner];
  if (!keep) return;
  const tier = tierOf(keep);
  const mine = owner === player.id;
  const allies = (keep.allies ?? []).map((id) => world.getPlayers().find((p) => p.id === id)?.name ?? "an ally (offline)");
  const until = nextSiegeDay() - world.getDay();
  const lines = [
    `§l${keep.sovereign ? "Sovereign " : ""}${keep.name}'s ${tier.name}§r`,
    `Banner: ${COLORS[keep.color ?? 14].replace(/_/g, " ")}   Land: ${landRadius(keep, owner)} blocks   Keep: ${keepHealth(owner, keep)} health`,
    `Sieges won: ${keep.wins ?? 0}   Win streak: ${keep.streak ?? 0}   Warlords slain: ${keep.warlordsSlain ?? 0}`,
    nextTierText(keep),
    "",
    state.active ? "§cA siege is happening right now!" : applyFilter("nextSiegeLine", until === 0 ? "§cThe next siege comes tonight." : `Next siege: in ${until} day${until === 1 ? "" : "s"} (day ${nextSiegeDay()}).`, { until, day: nextSiegeDay(), owner, keep }),
    keep.lastSiege ? `Last siege: ${keep.lastSiege.faction}, threat ${keep.lastSiege.threat}, ${keep.lastSiege.won ? "§aheld§r" : "§cnot held§r"}` : "No sieges faced yet.",
    keep.lastTactic ? `They remember your ${keep.lastTactic === "archery" ? "archers" : keep.lastTactic === "melee" ? "sword" : keep.lastTactic}. Expect a counter.` : "",
    "",
    `Guards: ${guardCount(owner)}/${guardLimit(owner)}   Allies: ${allies.length ? allies.join(", ") : "none"}`,
  ];
  const form = new ActionFormData().title(`${keep.name}'s ${tier.name}`).body(lines.filter((l, i) => l || lines[i - 1]).join("\n"));
  const actions = [];
  if (mine) {
    form.button("Your guards", "textures/items/siege_man_at_arms"); actions.push(() => guardList(player));
    form.button("How to change the banner color", "textures/items/dye_powder_red_new"); actions.push(() => player.sendMessage("§7Click your Keep Banner holding any dye. Each settlement needs its own color."));
    form.button("How to add an ally", "textures/items/siege_writ"); actions.push(() => player.sendMessage("§7Look at another player and use a Writ of Alliance. Allies can build on your land and your guards leave them alone."));
  }
  for (const extra of applyFilter("keepMenuButtons", [], { player, keep, owner, mine })) { // addKeepMenuButtons
    form.button(extra.label, extra.icon); actions.push(extra.action);
  }
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

export function barracksMenu(block, player) {
  if (settlementAt(block.location) !== player.id) return player.onScreenDisplay.setActionBar("§cOnly the settlement's owner can use these Barracks.");
  const count = guardCount(player.id), limit = guardLimit(player.id);
  const form = new ActionFormData().title("Barracks").body([
    `Guards: ${count}/${limit}   You have ${coins(funds(player))}`,
    "",
    `Recruiting costs ${worth(GUARD_COST)} and needs an unemployed villager standing next to the Barracks.`,
    "Men-at-Arms wait here and charge out during sieges. Archers stay wherever you place them.",
  ].join("\n"));
  form.button(`Recruit a Man-at-Arms\n§8${worth(GUARD_COST)}`, "textures/items/siege_man_at_arms");
  form.button(`Recruit an Archer\n§8${worth(GUARD_COST)}`, "textures/items/siege_archer");
  form.button(`Your guards (${count})`, "textures/items/iron_sword");
  form.button("Close");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection === 0) recruitGuard(block, player, undefined, "siege:man_at_arms");
    if (r.selection === 1) recruitGuard(block, player, undefined, "siege:archer");
    if (r.selection === 2) guardList(player);
  }).catch(() => {});
}

export function guardList(player) {
  const guards = Object.keys(GUARD_TYPES).flatMap((type) => overworld().getEntities({ type, tags: [guardTag(player.id)] }));
  const form = new ActionFormData().title("Your guards");
  form.body(guards.length ? "Pick a guard to see them or upgrade their armor." : "You have no guards nearby. Guards far away in unloaded land don't show here.");
  for (const g of guards) {
    const kind = g.typeId === "siege:archer" ? "Archer" : "Man-at-Arms";
    const where = `${Math.round(g.location.x)}, ${Math.round(g.location.y)}, ${Math.round(g.location.z)}`;
    form.button(`${g.nameTag || kind}\n§8${GUARD_ARMOR[armorTier(g)].name} · ${where}`, g.typeId === "siege:archer" ? "textures/items/siege_archer" : "textures/items/siege_man_at_arms");
  }
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled || r.selection >= guards.length) return;
    guardMenu(guards[r.selection], player);
  }).catch(() => {});
}

export function guardMenu(guard, player) {
  const tier = armorTier(guard);
  const next = GUARD_ARMOR[tier + 1];
  const health = guard.getComponent("minecraft:health");
  const body = [
    `Armor: ${GUARD_ARMOR[tier].name} (${tier}/4)`,
    health ? `Health: ${Math.ceil(health.currentValue)}/${health.effectiveMax}` : "",
    next ? `Next upgrade: §6${next.name}§r for ${next.label}. You have ${countItem(player, next.item)}.` : "§6Fully upgraded.",
  ].filter(Boolean).join("\n");
  const form = new MessageFormData().title(guard.nameTag || (guard.typeId === "siege:archer" ? "Archer" : "Man-at-Arms")).body(body)
    .button1(next ? `Upgrade to ${next.name}` : "OK").button2("Back");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection === 0 && next) upgradeGuard(guard, player, new ItemStack(next.item, 1));
    if (r.selection === 1) guardList(player);
  }).catch(() => {});
}
