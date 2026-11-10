// Procedural raiders: each settlement's war plan, warlords, and learning from the last siege.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, ItemStack, EntityDamageCause } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { BALLISTA_HIT, KING_TAG, RAIDER_TAG, WARLORD_TAG } from "./constants.js";
import { guardCount, guardTag, isGuard } from "./guards.js";
import { keepCenter } from "./keep.js";
import { ballistasOf } from "./machines.js";
import { spawnRaider } from "./siege.js";
import { state } from "./state.js";
import { tierOf } from "./territory.js";
import { overworld, ownerOf, pick, title } from "./util.js";
import { dropCoins } from "../economy/coins.js";
import { fromEmeralds } from "../economy/rules.js";
import { sfx } from "../core/sfx.js";

// ---------- Procedural raiders: every siege army is planned from what you've done ----------
// When a siege starts, each settlement gets its own war plan:
//   threat budget  = how rich, how well defended and how famous the settlement is
//   faction        = who's coming (each has its own units)
//   direction      = they probe your weakest side
//   modifiers      = a random twist, plus counters to how you won last time
//   warlord        = sometimes a named boss leads the final assault
// Each assault then "buys" raiders from the faction's list with its share of the budget.

export const FACTIONS = {
  warband: {
    name: "Pillager Warband",
    units: [
      { type: "minecraft:pillager", cost: 3, from: 1 },
      { type: "minecraft:vindicator", cost: 4, from: 1 },
      { type: "minecraft:witch", cost: 6, from: 3 },
      { type: "minecraft:evocation_illager", cost: 9, from: 5 },
    ],
    ram: "minecraft:ravager", sapper: "minecraft:vindicator", warlord: "minecraft:vindicator",
  },
  undead: {
    name: "Undead Horde",
    units: [
      { type: "minecraft:zombie", cost: 1, from: 1 },
      { type: "minecraft:skeleton", cost: 2, from: 1 },
      { type: "minecraft:husk", cost: 2, from: 2 },
      { type: "minecraft:stray", cost: 3, from: 3 },
      { type: "minecraft:wither_skeleton", cost: 6, from: 5 },
    ],
    ram: undefined, sapper: "minecraft:zombie", warlord: "minecraft:wither_skeleton", // no rams, but twice the sappers
  },
  mercenaries: {
    name: "Mercenary Host",
    units: [
      { type: "minecraft:skeleton", cost: 2, from: 1 },
      { type: "minecraft:pillager", cost: 3, from: 1 },
      { type: "minecraft:vindicator", cost: 4, from: 2 },
      { type: "minecraft:witch", cost: 6, from: 3 },
    ],
    ram: "minecraft:ravager", sapper: "minecraft:vindicator", warlord: "minecraft:vindicator",
  },
};

FACTIONS.grand = {
  name: "Grand Army of the Warlord King",
  units: [...new Map(Object.values(FACTIONS).flatMap((f) => f.units).map((u) => [u.type, u])).values()],
  ram: "minecraft:ravager", sapper: "minecraft:vindicator", warlord: "minecraft:vindicator",
};

export const MODIFIERS = {
  pincer: { name: "Pincer Attack", note: "They come from two sides" },
  shields: { name: "Iron Shields", note: "Raiders are tougher" },
  march: { name: "Forced March", note: "Raiders move faster" },
  sappers: { name: "Sapper Corps", note: "Twice the sappers" },
  siegeTrain: { name: "Siege Train", note: "Battering rams from the first assault" },
  bloodlust: { name: "Bloodlust", note: "Raiders hit harder" },
};

// How you won last time decides what they bring this time
export const COUNTERS = {
  ballista: { modifier: "shields", note: "They remember your ballistas. They come shielded." },
  archery: { modifier: "shields", note: "They remember your arrows. They come shielded." },
  guards: { modifier: "siegeTrain", note: "They remember your guards. They bring more rams." },
  melee: { modifier: "march", note: "They remember your blade. They come fast." },
};

export const WARLORD_NAMES = ["Grimbald", "Morgath", "Vex", "Ulric", "Saska", "Dren", "Hask", "Ysolde", "Brannoc", "Kestra"];
export const WARLORD_TITLES = ["the Ashen", "Wallbreaker", "the Red", "of the Long Night", "Ironjaw", "the Hungry", "Oathbreaker", "the Grey"];


// Defense in each quarter around the keep (east, south, west, north): ballistas and archers count
export function weakestSides(owner, keep, count) {
  const score = [0, 0, 0, 0];
  const quarter = (loc) => {
    const a = Math.atan2(loc.z - keep.z, loc.x - keep.x);
    return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
  };
  for (const b of ballistasOf(owner)) score[quarter(b.location)] += 3;
  for (const archer of overworld().getEntities({ type: "siege:archer", tags: [guardTag(owner)] })) score[quarter(archer.location)] += 2;
  const order = [0, 1, 2, 3].sort((a, b) => score[a] - score[b] || Math.random() - 0.5);
  return order.slice(0, count).map((q) => q * (Math.PI / 2));
}

export function planSiege(owner, provoked) {
  const keep = state.keeps[owner];
  keep.sieges = (keep.sieges ?? 0) + 1;
  const center = keepCenter(keep);
  const dim = overworld();

  // Threat budget
  const villagers = dim.getEntities({ type: "minecraft:villager_v2", location: center, maxDistance: tierOf(keep).radius }).length;
  const ballistas = ballistasOf(owner).length;
  const prosperity = villagers + (keep.wins ?? 0) * 3;
  const defenses = ballistas * 3 + guardCount(owner) * 2;
  const reputation = (keep.streak ?? 0) * 3 + (provoked ? 6 : 0);
  const budget = Math.round((12 + keep.sieges * 6 + prosperity + defenses + reputation) * (0.85 + Math.random() * 0.3));

  // Twists: one random modifier from the second siege on, plus a counter to last time's tactics
  const modifiers = [];
  const counter = COUNTERS[keep.lastTactic];
  if (counter && keep.sieges > 1) modifiers.push(counter.modifier);
  if (keep.sieges > 1 && Math.random() < 0.6) {
    const extra = pick(Object.keys(MODIFIERS).filter((m) => !modifiers.includes(m)));
    modifiers.push(extra);
  }

  // A Castle that hasn't beaten the Warlord King yet faces the Grand Siege: every faction at once
  const grand = tierOf(keep).name === "Castle" && !keep.sovereign;
  const factionId = grand ? "grand" : pick(Object.keys(FACTIONS).filter((f) => f !== "grand"));
  const warlord = grand ? "The Warlord King"
    : keep.sieges >= 3 && (keep.sieges % 5 === 0 || Math.random() < 0.3) ? `${pick(WARLORD_NAMES)} ${pick(WARLORD_TITLES)}` : undefined;
  if (grand && !modifiers.includes("pincer")) modifiers.push("pincer");

  state.plans[owner] = {
    faction: factionId, budget: grand ? budget * 2 : budget, modifiers, warlord, grand,
    sides: weakestSides(owner, keep, modifiers.includes("pincer") ? 2 : 1),
    counterNote: counter && keep.sieges > 1 ? counter.note : undefined,
  };
  state.kills[owner] = { ballista: 0, archery: 0, guards: 0, melee: 0 };
  applyFilter("plan", state.plans[owner], { owner, keep }); // addPlanHook can adjust the plan
  return state.plans[owner];
}

export function announcePlan(player, plan) {
  const faction = FACTIONS[plan.faction];
  const twists = plan.modifiers.map((m) => MODIFIERS[m].name).join(", ");
  title(player, "§cSiege Night", `§7The ${faction.name} marches on your keep!`);
  player.sendMessage(`§c${faction.name}§7, threat ${plan.budget}${twists ? `. §6${twists}` : ""}`);
  for (const m of plan.modifiers) player.sendMessage(`§6 - ${MODIFIERS[m].name}: §7${MODIFIERS[m].note}`);
  if (plan.counterNote) player.sendMessage(`§7${plan.counterNote}`);
  if (plan.grand) title(player, "§4The Grand Siege", "§7The Warlord King comes for your Castle");
  else if (plan.warlord) player.sendMessage(`§4The warlord ${plan.warlord} leads them.`);
}

// Spend one assault's share of the budget on raiders
export function buyArmy(plan, siegeCount, budget) {
  const units = FACTIONS[plan.faction].units.filter((u) => siegeCount >= u.from);
  const army = [];
  let left = budget;
  while (army.length < 24) {
    const affordable = units.filter((u) => u.cost <= left);
    if (!affordable.length) break;
    const unit = pick(affordable);
    army.push(unit.type);
    left -= unit.cost;
  }
  return army;
}

export function buff(raider, plan) {
  try {
    if (plan.modifiers.includes("shields")) raider.addEffect("resistance", 20 * 600, { amplifier: 0, showParticles: false });
    if (plan.modifiers.includes("march")) raider.addEffect("speed", 20 * 600, { amplifier: 0, showParticles: false });
    if (plan.modifiers.includes("bloodlust")) raider.addEffect("strength", 20 * 600, { amplifier: 0, showParticles: false });
  } catch {
    // raider gone already
  }
}

export function spawnWarlord(dim, plan, at, fallbackY, tags) {
  const king = plan.grand;
  const lord = spawnRaider(dim, FACTIONS[plan.faction].warlord, ...at, fallbackY, [...tags, king ? KING_TAG : WARLORD_TAG], `§4${plan.warlord}`);
  if (!lord) return;
  lord.addEffect("health_boost", 20 * 600, { amplifier: king ? 14 : 4, showParticles: false }); // +60 or +20 health
  lord.addEffect("instant_health", 1, { amplifier: 9, showParticles: false });
  lord.addEffect("resistance", 20 * 600, { amplifier: king ? 2 : 1, showParticles: false });
  lord.addEffect("strength", 20 * 600, { amplifier: 0, showParticles: false });
  for (const p of world.getPlayers()) p.sendMessage(`§4${plan.warlord} has taken the field!`);
}


// Track how raiders die, so the next army can adapt
world.afterEvents.entityDie.subscribe((event) => {
  const raider = event.deadEntity;
  if (!state?.active) return;
  let owner;
  try {
    if (!raider.getTags().includes(RAIDER_TAG)) return;
    owner = ownerOf(raider);
  } catch {
    return;
  }
  emit("raiderKilled", { entity: raider, killer: event.damageSource.damagingEntity, owner });
  const kills = state.kills[owner];
  if (!kills) return;
  const killer = event.damageSource.damagingEntity;
  let how;
  if (killer && isGuard(killer)) how = "guards";
  else if (killer?.typeId === "minecraft:player") how = event.damageSource.cause === EntityDamageCause.projectile ? "archery" : "melee";
  else if (!killer && raider.getTags().includes(BALLISTA_HIT)) how = "ballista";
  if (how) kills[how] += 1;

  if (raider.getTags().includes(KING_TAG)) {
    const keep = state.keeps[owner];
    if (keep) keep.kingSlain = true; // they become Sovereign if they also hold the keep
    for (const p of world.getPlayers()) p.sendMessage("§6The Warlord King has fallen! Hold the keep to claim victory!");
    emit("warlordSlain", { owner, name: raider.nameTag, king: true });
  }
  if (raider.getTags().includes(WARLORD_TAG)) {
    const loc = raider.location;
    dropCoins(raider.dimension, loc, fromEmeralds(12), "warlord");
    raider.dimension.spawnItem(new ItemStack("minecraft:diamond", 2), loc);
    const keep = state.keeps[owner];
    if (keep) keep.warlordsSlain = (keep.warlordsSlain ?? 0) + 1;
    for (const p of world.getPlayers()) p.sendMessage(`§6${(raider.nameTag || "A warlord").replace(/§./g, "")} has been slain!`);
    emit("warlordSlain", { owner, name: raider.nameTag, king: false });
  }
});

// Beating the Grand Siege: the settlement's owner becomes its Sovereign
export function crownSovereign(owner) {
  const keep = state.keeps[owner];
  keep.sovereign = true;
  const player = world.getPlayers().find((p) => p.id === owner);
  if (player) {
    title(player, "§6Long live the Sovereign!", `§7${keep.name}'s Castle has broken the Warlord King`);
    sfx(player, "ui.toast.challenge_complete");
    dropCoins(player.dimension, player.location, fromEmeralds(48), "sovereign");
    for (const [id, n] of [["minecraft:netherite_ingot", 1], ["minecraft:totem_of_undying", 1]]) {
      player.dimension.spawnItem(new ItemStack(id, n), player.location);
    }
  }
  for (const p of world.getPlayers()) if (p.id !== owner) p.sendMessage(`§6${keep.name} has broken the Warlord King and rules as Sovereign!`);
  emit("sovereignCrowned", { owner });
}

// After a siege: remember the streak and the tactic that did the most killing
export function rememberSiege(owner, won) {
  const keep = state.keeps[owner];
  if (!keep) return;
  keep.streak = won ? (keep.streak ?? 0) + 1 : 0;
  const plan = state.plans[owner];
  if (plan) keep.lastSiege = { faction: FACTIONS[plan.faction].name, threat: plan.budget, won };
  if (won && keep.kingSlain && !keep.sovereign) crownSovereign(owner);
  delete keep.kingSlain;
  const kills = state.kills[owner];
  if (kills) {
    const best = Object.entries(kills).sort((a, b) => b[1] - a[1])[0];
    keep.lastTactic = best[1] > 0 ? best[0] : undefined;
  }
}
