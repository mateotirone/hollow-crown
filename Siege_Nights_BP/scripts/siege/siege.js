// Siege nights: starting, assaults, the end of the siege, and the sidebar.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, ItemStack, DisplaySlotId } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { KEEP_HEART, RAIDER_TAG, RAM_TAG, SAPPER_TAG } from "./constants.js";
import { checkKeeps, keepBlock, keepCenter, raiseKeepHeart } from "./keep.js";
import { SETTINGS } from "./settings.js";
import { saveState, state } from "./state.js";
import { recordWin } from "./territory.js";
import { isOnline, overworld, ownerOf, ownerTag, title } from "./util.js";
import { FACTIONS, announcePlan, buff, buyArmy, planSiege, rememberSiege, spawnWarlord } from "./warplan.js";

// ---------- Siege waves ----------

export function isNight() {
  const t = world.getTimeOfDay();
  return t >= 13000 && t < 23000;
}

// How many assaults this siege has. Features can change it with the "assaultCount" filter (scripts/reach does).
export const assaultsTotal = () => state.assaultsTotal ?? SETTINGS.assaultsPerSiege;

export function startSiege(provokedBy) {
  state.active = true;
  state.siegeNumber += 1;
  state.lastSiegeDay = world.getDay();
  state.assaultsTotal = applyFilter("assaultCount", SETTINGS.assaultsPerSiege, { provokedBy });
  state.assaultsLeft = state.assaultsTotal;
  state.nextAssaultTick = system.currentTick + applyFilter("assaultDelay", 100, { assault: 1, total: state.assaultsTotal }); // 5 seconds to get ready
  state.fallen = [];
  state.besieged = [];
  state.spawnedAny = false;
  saveState();
  state.plans = {};
  for (const owner of Object.keys(state.keeps)) {
    if (applyFilter("skipSiege", false, { owner, keep: state.keeps[owner] })) continue;
    raiseKeepHeart(owner);
    if (isOnline(owner)) planSiege(owner, owner === provokedBy);
  }
  saveState();

  for (const player of world.getPlayers()) {
    const plan = state.plans[player.id];
    if (plan) announcePlan(player, plan);
    else title(player, "§cSiege Night", "§7The settlements are under attack!");
    player.playSound("raid.horn");
  }
  emit("siegeStart", { provokedBy });
}

export function spawnRaider(dim, type, x, z, fallbackY, tags, name) {
  try {
    type = applyFilter("raiderType", type, { tags, name }); // addRaiderTypeHook can swap the mob
    const ground = dim.getTopmostBlock({ x, z });
    const y = ground ? ground.location.y + 1 : fallbackY;
    const raider = dim.spawnEntity(type, { x: x + 0.5, y, z: z + 0.5 });
    raider.addTag(RAIDER_TAG);
    for (const tag of tags) raider.addTag(tag);
    if (name) raider.nameTag = name;
    state.spawnedAny = true;
    return raider;
  } catch {
    // That spot wasn't loaded or wasn't valid; skip it
  }
}

export function spawnAssault() {
  const total = assaultsTotal();
  const assaultNumber = total - state.assaultsLeft + 1;
  const share = applyFilter("assaultShare", [0.3, 0.33, 0.37][assaultNumber - 1] ?? 0.34, { assault: assaultNumber, total }); // each assault spends part of the budget
  const dim = overworld();
  emit("assaultIncoming", { assault: assaultNumber, total }); // listeners may adjust state.plans for this assault

  // Each settlement gets its own army, marching on its keep
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (!isOnline(owner) || !keepBlock(keep)) continue; // owner away, or the area isn't loaded
    if (applyFilter("skipSiege", false, { owner, keep })) continue;
    const plan = state.plans[owner] ?? planSiege(owner, false); // owner logged in mid-siege
    if (!state.besieged.includes(owner)) state.besieged.push(owner);
    const faction = FACTIONS[plan.faction];
    const center = keepCenter(keep);
    const tags = [ownerTag(owner)];
    // Raiders come from the planned side(s), spread a little like a real attack
    const spot = (i) => {
      const a = plan.sides[i % plan.sides.length] + (Math.random() - 0.5) * 0.6;
      const d = applyFilter("spawnDistance", SETTINGS.spawnDistance, { owner, keep }) + Math.random() * 6; // a walled settlement is attacked from outside its wall
      return [Math.floor(center.x + Math.cos(a) * d), Math.floor(center.z + Math.sin(a) * d)];
    };
    buyArmy(plan, keep.sieges, Math.round(plan.budget * share))
      .forEach((type, i) => buff(spawnRaider(dim, type, ...spot(i), center.y, tags), plan));

    if (keep.sieges >= SETTINGS.breachersFromSiege) {
      const rams = faction.ram && (assaultNumber >= 2 || plan.modifiers.includes("siegeTrain")) ? 1 : 0;
      const sappers = (faction.ram ? 1 : 2) * (plan.modifiers.includes("sappers") ? 2 : 1);
      for (let i = 0; i < rams; i++) spawnRaider(dim, faction.ram, ...spot(i), center.y, [...tags, RAM_TAG], "§cBattering Ram");
      for (let i = 0; i < sappers; i++) buff(spawnRaider(dim, faction.sapper, ...spot(i), center.y, [...tags, SAPPER_TAG], "§cSapper"), plan);
    }
    if (plan.warlord && assaultNumber === total) spawnWarlord(dim, plan, spot(0), center.y, tags);
  }

  for (const player of world.getPlayers()) {
    player.onScreenDisplay.setActionBar(`§6Assault ${assaultNumber} of ${total} incoming!`);
    player.playSound("raid.horn");
  }
  state.assaultsLeft -= 1;
  state.nextAssaultTick = system.currentTick + applyFilter("assaultDelay", SETTINGS.ticksBetweenAssaults, { assault: assaultNumber + 1, total });
  saveState();
  emit("assaultSpawned", { assault: assaultNumber, total });
}

export function raidersLeft() {
  return overworld().getEntities({ tags: [RAIDER_TAG] });
}

export function endSiege(outcome) {
  state.active = false;
  state.assaultsLeft = 0;
  saveState();

  for (const raider of raidersLeft()) raider.remove(); // any stragglers retreat
  for (const heart of overworld().getEntities({ type: KEEP_HEART })) heart.remove();
  const plans = state.plans;
  for (const owner of state.besieged) rememberSiege(owner, outcome === "won");
  if (outcome === "won") for (const owner of state.besieged) recordWin(owner);
  state.plans = {};
  state.kills = {};
  saveState();

  for (const player of world.getPlayers()) {
    const defended = state.besieged.includes(player.id) && !!state.keeps[player.id];
    if (outcome === "won" && defended) {
      const threat = plans[player.id]?.budget ?? 12;
      const emeralds = applyFilter("siegeReward", 2 + Math.round(threat / 5), { player, threat }); // bigger armies pay better
      if (emeralds > 0) player.dimension.spawnItem(new ItemStack("minecraft:emerald", emeralds), player.location);
      player.addExperience(20 + threat * 2);
      title(player, "§aSiege Broken!", `§7You held the keep. +${emeralds} emeralds`);
      player.playSound("random.levelup");
      emit("siegeReward", { player, emeralds, threat });
    } else if (outcome === "won") {
      title(player, "§aThe siege is over", "§7The raiders have been driven off");
    } else if (outcome === "dawn") {
      title(player, "§eDawn breaks", "§7The raiders retreat... for now");
    }
  }
  emit("siegeEnd", { outcome, besieged: [...state.besieged] });
}

// Raiders who aren't busy fighting someone get pushed onward toward their target keep
export function marchOnKeep(raiders) {
  for (const raider of raiders) {
    try {
      const keep = state.keeps[ownerOf(raider)];
      if (!keep) continue;
      const center = keepCenter(keep);
      const dx = center.x - raider.location.x;
      const dz = center.z - raider.location.z;
      const dist = Math.hypot(dx, dz);
      if (dist < SETTINGS.marchRange) continue;
      const fighting = raider.dimension.getPlayers({ location: raider.location, maxDistance: 8 }).length > 0;
      if (!fighting) raider.applyImpulse({ x: (dx / dist) * 0.3, y: 0, z: (dz / dist) * 0.3 });
    } catch {
      // raider unloaded or gone
    }
  }
}

export function siegeTick() {
  checkKeeps();
  const night = isNight();

  if (!state.active) {
    const day = world.getDay();
    const siegeDue = applyFilter("siegeDue", day >= SETTINGS.firstSiegeDay && day % SETTINGS.siegeEveryNNights === 0, { day });
    const anySettlement = Object.keys(state.keeps).length > 0;
    if (night && siegeDue && anySettlement && day !== state.lastSiegeDay) startSiege();
    return;
  }

  if (!night && applyFilter("dawnEndsSiege", true, {})) {
    endSiege("dawn");
    return;
  }

  if (state.assaultsLeft > 0 && system.currentTick >= state.nextAssaultTick) spawnAssault();

  const raiders = raidersLeft();
  if (state.assaultsLeft === 0 && raiders.length === 0) {
    endSiege(state.spawnedAny ? "won" : "empty");
    return;
  }
  marchOnKeep(raiders);
  for (const player of world.getPlayers()) {
    if (raiders.length > 0) player.onScreenDisplay.setActionBar(`§cRaiders remaining: ${raiders.length}`);
  }
}

// ---------- No sleeping during a siege ----------

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!state?.active || event.block.typeId !== "minecraft:bed") return;
  event.cancel = true;
  const player = event.player;
  system.run(() => player.onScreenDisplay.setActionBar("§cYou can't sleep while the keep is under siege!"));
});

// ---------- War Horn: call the siege early ----------

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  if (!state) return;
  if (event.itemStack.typeId !== "siege:war_horn") return;
  if (!state.keeps[player.id]) {
    player.sendMessage("§7You need a settlement before you can call the raiders. Raise a Keep Banner first.");
  } else if (state.active) {
    player.sendMessage("§7The siege is already underway!");
  } else if (!isNight()) {
    player.sendMessage("§7The raiders only march at night. Sound the horn after dusk.");
  } else {
    startSiege(player.id); // provoking them makes them angrier
  }
});

export function nextSiegeDay() {
  let day = Math.max(world.getDay(), SETTINGS.firstSiegeDay);
  if (day === state.lastSiegeDay) day++;
  while (day % SETTINGS.siegeEveryNNights !== 0) day++;
  return applyFilter("nextSiegeDay", day, {});
}

// ---------- Siege tracker: a sidebar while the siege is on ----------

export const HUD = "siege_hud";
export function siegeHud() {
  const board = world.scoreboard;
  let obj = board.getObjective(HUD);
  if (!state.active) {
    if (obj) board.removeObjective(obj);
    return;
  }
  if (!obj) {
    obj = board.addObjective(HUD, "§cSiege Night");
    board.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: obj });
  }
  const want = new Map();
  want.set("§7Waves sent", assaultsTotal() - state.assaultsLeft);
  want.set("§7Waves left", state.assaultsLeft);
  want.set("§cRaiders", raidersLeft().length);
  for (const heart of overworld().getEntities({ type: KEEP_HEART })) {
    const keep = state.keeps[ownerOf(heart)];
    const hp = heart.getComponent("minecraft:health");
    if (keep && hp) want.set(`§6${keep.name}'s keep`, Math.ceil(hp.currentValue));
  }
  for (const p of obj.getParticipants()) if (!want.has(p.displayName)) obj.removeParticipant(p);
  for (const [name, value] of want) obj.setScore(name, value);
}
