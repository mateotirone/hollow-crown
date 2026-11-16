// Siege nights: starting, assaults, the end of the siege, and the sidebar.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, DisplaySlotId } from "@minecraft/server";
import { emit, applyFilter } from "../core/events.js";
import { GATE_TAG, KEEP_HEART, RAIDER_TAG, RAM_TAG, SAPPER_TAG } from "./constants.js";
import { checkKeeps, keepBlock, keepCenter, marchPoint, raiseKeepHeart } from "./keep.js";
import { SETTINGS } from "./settings.js";
import { saveState, state } from "./state.js";
import { recordWin } from "./territory.js";
import { isOnline, overworld, ownerOf, ownerTag, title } from "./util.js";
import { pay } from "../economy/coins.js";
import { fromEmeralds, coins } from "../economy/rules.js";
import { FACTIONS, announcePlan, assaultSpot, buff, buyArmy, planSiege, rememberSiege, spawnWarlord } from "./warplan.js";
import { sfx } from "../core/sfx.js";
import { drillHolds } from "./drill.js";

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
    sfx(player, "sig.siege_horn");
  }
  emit("siegeStart", { provokedBy, defenders: Object.keys(state.plans) }); // defenders: ids of the players whose keeps are attacked
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
    // Raiders come from the planned side(s): up the road to the gate first, a flank spread out along its side
    const send = (type, i, more = [], name) => {
      const at = assaultSpot(owner, keep, plan, plan.sides[i % plan.sides.length]);
      return spawnRaider(dim, type, at.x, at.z, center.y, at.gate ? [...tags, ...more, GATE_TAG] : [...tags, ...more], name);
    };
    buyArmy(plan, keep.sieges, Math.round(plan.budget * share)).forEach((type, i) => buff(send(type, i), plan));

    if (keep.sieges >= SETTINGS.breachersFromSiege) {
      const rams = faction.ram && (assaultNumber >= 2 || plan.modifiers.includes("siegeTrain")) ? 1 : 0;
      const sappers = (faction.ram ? 1 : 2) * (plan.modifiers.includes("sappers") ? 2 : 1);
      for (let i = 0; i < rams; i++) send(faction.ram, i, [RAM_TAG], "§cBattering Ram");
      for (let i = 0; i < sappers; i++) buff(send(faction.sapper, i, [SAPPER_TAG], "§cSapper"), plan);
    }
    if (plan.warlord && assaultNumber === total) {
      const at = assaultSpot(owner, keep, plan, plan.sides[0]);
      spawnWarlord(dim, plan, [at.x, at.z], center.y, at.gate ? [...tags, GATE_TAG] : tags);
    }
  }

  for (const player of world.getPlayers()) {
    player.onScreenDisplay.setActionBar(`§6Assault ${assaultNumber} of ${total} incoming!`);
    sfx(player, "horn.assault");
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
      // the reward (and every hook on it) is still counted in the old unit; it is paid in coins, 8 to one
      if (emeralds > 0) pay(player, fromEmeralds(emeralds), "siege");
      player.addExperience(20 + threat * 2);
      title(player, "§aSiege Broken!", `§7You held the keep. +${coins(fromEmeralds(emeralds))}`);
      sfx(player, "random.levelup");
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
      if (drillHolds(raider)) continue; // in its place in the ranks at the gate (drill.js)
      const keep = state.keeps[ownerOf(raider)];
      if (!keep) continue;
      const center = marchPoint(raider, keep);
      const dx = center.x - raider.location.x;
      const dz = center.z - raider.location.z;
      const dist = Math.hypot(dx, dz);
      if (dist < (center.via ? 1 : SETTINGS.marchRange)) continue;
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
    // "holdSiege": Act 1 keeps a settlement's first raid waiting until its lord is home for supper, or midnight
    if (night && siegeDue && anySettlement && day !== state.lastSiegeDay && !applyFilter("holdSiege", false, { day })) startSiege();
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
