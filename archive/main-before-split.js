// Siege Nights: found a settlement with a Keep Banner, build a castle, and hold it against raiders at night.
// Everything you might want to tweak is in SETTINGS right below.

import { world, system, ItemStack, EntityDamageCause, EquipmentSlot, GameMode, MolangVariableMap, DisplaySlotId } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";

const SETTINGS = {
  firstSiegeDay: 5, // no sieges before this day, so a new world has time to prepare
  siegeEveryNNights: 3, // after that, a siege comes every 3rd night (set to 1 for every night)
  assaultsPerSiege: 3, // each siege night has this many attack waves
  ticksBetweenAssaults: 600, // 20 ticks = 1 second, so 600 = 30 seconds
  spawnDistance: 24, // how far from your keep (or you) the raiders appear (blocks)
  marchRange: 10, // raiders farther than this from the keep keep marching toward it
  ballistaRange: 16, // how far a ballista can shoot (blocks)
  ballistaDamage: 5, // 5 = two and a half hearts
  ballistaReloadTicks: 30, // time between shots
  trebuchetReloadTicks: 200, // 10 seconds between trebuchet shots
  chargeFuseTicks: 80, // Breaching Charge fuse (4 seconds)
  gateMaxSize: 64, // max gate blocks that open together
  breachersFromSiege: 2, // battering rams and sappers join from a settlement's 2nd siege on
  ramSwingTicks: 40, // your own Battering Ram can swing every 2 seconds
};

const RAIDER_TAG = "siege_raider";
const RAM_TAG = "siege_ram";
const SAPPER_TAG = "siege_sapper";
const WARLORD_TAG = "siege_warlord";
const KING_TAG = "siege_warlord_king";
const KEEP_BANNER = "siege:keep_banner";
const KEEP_HEART = "siege:keep_heart";
const QUARTERMASTER = "siege:quartermaster";
const DESK = "siege:quartermaster_desk";
const CHARGE = "siege:breaching_charge";

const GATES = ["siege:portcullis", "siege:castle_gate"];
const CASTLE_BLOCKS = [
  "siege:castle_stone", "siege:mossy_castle_stone", "siege:cracked_castle_stone",
  "siege:battlement", "siege:arrow_slit", "siege:portcullis",
];
const UNBREAKABLE = ["minecraft:bedrock", "minecraft:barrier", "minecraft:obsidian", KEEP_BANNER];

const title = (player, text, subtitle) =>
  player.onScreenDisplay.setTitle(text, { subtitle, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });

// ---------- Saved state ----------
// Dynamic properties are saved with the world, so a siege survives a reload.

let state; // loaded on the first tick (the world isn't ready while the script first loads)
let tracked; // machine blocks the script runs: type -> [{ dim, x, y, z }]

function loadState() {
  const saved = world.getDynamicProperty("siege:state");
  state = saved ? JSON.parse(saved) : {};
  state.active ??= false;
  state.siegeNumber ??= 0;
  state.lastSiegeDay ??= -1;
  state.assaultsLeft ??= 0;
  state.nextAssaultTick ??= 0;
  state.keeps ??= {}; // owner player id -> { x, y, z, name }
  state.fallen ??= []; // owners whose keep fell during the current siege
  state.besieged ??= []; // owners who were attacked during the current siege
  state.spawnedAny ??= false;
  state.plans ??= {}; // owner -> this siege's war plan
  state.kills ??= {}; // owner -> how raiders died this siege
  const machines = world.getDynamicProperty("siege:machines");
  tracked = machines ? JSON.parse(machines) : {};
  tracked[DESK] ??= [];
  tracked["siege:barracks"] ??= [];
  state.guards ??= {}; // owner player id -> how many guards they have
}

function saveState() {
  world.setDynamicProperty("siege:state", JSON.stringify(state));
}

function saveTracked() {
  world.setDynamicProperty("siege:machines", JSON.stringify(tracked));
}

// ---------- Settlements and keeps ----------
// Each player founds one settlement by placing a Keep Banner. Custom blocks can only be
// placed inside your own settlement. During a siege an invisible "keep heart" stands at
// each banner. Raiders attack it, and if it falls, that settlement loses the siege.

const ownerTag = (owner) => `siege_for_${owner}`;
const overworld = () => world.getDimension("overworld");

function keepCenter(keep) {
  return { x: keep.x + 0.5, y: keep.y, z: keep.z + 0.5 };
}

// The banner block, or undefined if it's not loaded right now. Returns null if it's gone.
function keepBlock(keep) {
  try {
    const block = overworld().getBlock(keep);
    if (!block) return undefined;
    return block.typeId === KEEP_BANNER ? block : null;
  } catch {
    return undefined;
  }
}

function settlementAt(location) {
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (Math.hypot(location.x - keep.x, location.z - keep.z) <= tierOf(keep).radius) return owner;
  }
  return undefined;
}

function ownerOf(entity) {
  const tag = entity.getTags().find((t) => t.startsWith("siege_for_"));
  return tag?.slice("siege_for_".length);
}

function heartsOf(owner) {
  return overworld().getEntities({ type: KEEP_HEART, tags: [ownerTag(owner)] });
}

function raiseKeepHeart(owner) {
  for (const heart of heartsOf(owner)) heart.remove();
  const keep = state.keeps[owner];
  if (!keep || !keepBlock(keep)) return;
  const heart = overworld().spawnEntity(KEEP_HEART, keepCenter(keep));
  heart.addTag(ownerTag(owner));
  heart.getComponent("minecraft:health")?.setCurrentValue?.(tierOf(keep).keepHealth);
  updateKeepName(heart);
}

function updateKeepName(heart) {
  const health = heart.getComponent("minecraft:health");
  const keep = state?.keeps[ownerOf(heart)];
  if (!health) return;
  const max = keep ? tierOf(keep).keepHealth : health.effectiveMax;
  heart.nameTag = `§6${keep?.sovereign ? "Sovereign " : ""}${keep?.name ?? "The"}'s ${keep ? tierOf(keep).name : "Keep"} §f${Math.ceil(health.currentValue)}/${max}`;
}

world.afterEvents.entityHurt.subscribe((event) => updateKeepName(event.hurtEntity), { entityTypes: [KEEP_HEART] });

world.afterEvents.entityDie.subscribe((event) => {
  const owner = ownerOf(event.deadEntity);
  if (state?.active && owner) keepFallen(owner);
}, { entityTypes: [KEEP_HEART] });

function keepFallen(owner) {
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
      player.playSound("mob.wither.death", { volume: 0.5 });
    } else {
      player.sendMessage(`§c${keep?.name ?? "A"}'s keep has fallen to the raiders!`);
    }
  }
}

// ---------- Siege waves ----------

function isNight() {
  const t = world.getTimeOfDay();
  return t >= 13000 && t < 23000;
}

function startSiege(provokedBy) {
  state.active = true;
  state.siegeNumber += 1;
  state.lastSiegeDay = world.getDay();
  state.assaultsLeft = SETTINGS.assaultsPerSiege;
  state.nextAssaultTick = system.currentTick + 100; // 5 seconds to get ready
  state.fallen = [];
  state.besieged = [];
  state.spawnedAny = false;
  saveState();
  state.plans = {};
  for (const owner of Object.keys(state.keeps)) {
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
}

function spawnRaider(dim, type, x, z, fallbackY, tags, name) {
  try {
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

function spawnAssault() {
  const assaultNumber = SETTINGS.assaultsPerSiege - state.assaultsLeft + 1;
  const share = [0.3, 0.33, 0.37][assaultNumber - 1] ?? 0.34; // each assault spends part of the budget
  const dim = overworld();

  // Each settlement gets its own army, marching on its keep
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (!isOnline(owner) || !keepBlock(keep)) continue; // owner away, or the area isn't loaded
    const plan = state.plans[owner] ?? planSiege(owner, false); // owner logged in mid-siege
    if (!state.besieged.includes(owner)) state.besieged.push(owner);
    const faction = FACTIONS[plan.faction];
    const center = keepCenter(keep);
    const tags = [ownerTag(owner)];
    // Raiders come from the planned side(s), spread a little like a real attack
    const spot = (i) => {
      const a = plan.sides[i % plan.sides.length] + (Math.random() - 0.5) * 0.6;
      const d = SETTINGS.spawnDistance + Math.random() * 6;
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
    if (plan.warlord && assaultNumber === SETTINGS.assaultsPerSiege) spawnWarlord(dim, plan, spot(0), center.y, tags);
  }

  for (const player of world.getPlayers()) {
    player.onScreenDisplay.setActionBar(`§6Assault ${assaultNumber} of ${SETTINGS.assaultsPerSiege} incoming!`);
    player.playSound("raid.horn");
  }
  state.assaultsLeft -= 1;
  state.nextAssaultTick = system.currentTick + SETTINGS.ticksBetweenAssaults;
  saveState();
}

function raidersLeft() {
  return overworld().getEntities({ tags: [RAIDER_TAG] });
}

function endSiege(outcome) {
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
      const emeralds = 2 + Math.round(threat / 5); // bigger armies pay better
      player.dimension.spawnItem(new ItemStack("minecraft:emerald", emeralds), player.location);
      player.addExperience(20 + threat * 2);
      title(player, "§aSiege Broken!", `§7You held the keep. +${emeralds} emeralds`);
      player.playSound("random.levelup");
    } else if (outcome === "won") {
      title(player, "§aThe siege is over", "§7The raiders have been driven off");
    } else if (outcome === "dawn") {
      title(player, "§eDawn breaks", "§7The raiders retreat... for now");
    }
  }
}

// Raiders who aren't busy fighting someone get pushed onward toward their target keep
function marchOnKeep(raiders) {
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

function checkKeeps() {
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

function siegeTick() {
  checkKeeps();
  const night = isNight();

  if (!state.active) {
    const day = world.getDay();
    const siegeDue = day >= SETTINGS.firstSiegeDay && day % SETTINGS.siegeEveryNNights === 0;
    const anySettlement = Object.keys(state.keeps).length > 0;
    if (night && siegeDue && anySettlement && day !== state.lastSiegeDay) startSiege();
    return;
  }

  if (!night) {
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

// ---------- Procedural raiders: every siege army is planned from what you've done ----------
// When a siege starts, each settlement gets its own war plan:
//   threat budget  = how rich, how well defended and how famous the settlement is
//   faction        = who's coming (each has its own units)
//   direction      = they probe your weakest side
//   modifiers      = a random twist, plus counters to how you won last time
//   warlord        = sometimes a named boss leads the final assault
// Each assault then "buys" raiders from the faction's list with its share of the budget.

const FACTIONS = {
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

const MODIFIERS = {
  pincer: { name: "Pincer Attack", note: "They come from two sides" },
  shields: { name: "Iron Shields", note: "Raiders are tougher" },
  march: { name: "Forced March", note: "Raiders move faster" },
  sappers: { name: "Sapper Corps", note: "Twice the sappers" },
  siegeTrain: { name: "Siege Train", note: "Battering rams from the first assault" },
  bloodlust: { name: "Bloodlust", note: "Raiders hit harder" },
};

// How you won last time decides what they bring this time
const COUNTERS = {
  ballista: { modifier: "shields", note: "They remember your ballistas. They come shielded." },
  archery: { modifier: "shields", note: "They remember your arrows. They come shielded." },
  guards: { modifier: "siegeTrain", note: "They remember your guards. They bring more rams." },
  melee: { modifier: "march", note: "They remember your blade. They come fast." },
};

const WARLORD_NAMES = ["Grimbald", "Morgath", "Vex", "Ulric", "Saska", "Dren", "Hask", "Ysolde", "Brannoc", "Kestra"];
const WARLORD_TITLES = ["the Ashen", "Wallbreaker", "the Red", "of the Long Night", "Ironjaw", "the Hungry", "Oathbreaker", "the Grey"];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Defense in each quarter around the keep (east, south, west, north): ballistas and archers count
function weakestSides(owner, keep, count) {
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

function planSiege(owner, provoked) {
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
  return state.plans[owner];
}

function announcePlan(player, plan) {
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
function buyArmy(plan, siegeCount, budget) {
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

function buff(raider, plan) {
  try {
    if (plan.modifiers.includes("shields")) raider.addEffect("resistance", 20 * 600, { amplifier: 0, showParticles: false });
    if (plan.modifiers.includes("march")) raider.addEffect("speed", 20 * 600, { amplifier: 0, showParticles: false });
    if (plan.modifiers.includes("bloodlust")) raider.addEffect("strength", 20 * 600, { amplifier: 0, showParticles: false });
  } catch {
    // raider gone already
  }
}

function spawnWarlord(dim, plan, at, fallbackY, tags) {
  const lord = spawnRaider(dim, FACTIONS[plan.faction].warlord, ...at, fallbackY, tags, `§4${plan.warlord}`);
  if (!lord) return;
  const king = plan.grand;
  lord.addTag(king ? KING_TAG : WARLORD_TAG);
  lord.addEffect("health_boost", 20 * 600, { amplifier: king ? 14 : 4, showParticles: false }); // +60 or +20 health
  lord.addEffect("instant_health", 1, { amplifier: 9, showParticles: false });
  lord.addEffect("resistance", 20 * 600, { amplifier: king ? 2 : 1, showParticles: false });
  lord.addEffect("strength", 20 * 600, { amplifier: 0, showParticles: false });
  for (const p of world.getPlayers()) p.sendMessage(`§4${plan.warlord} has taken the field!`);
}

// Track how raiders die, so the next army can adapt
const BALLISTA_HIT = "siege_ballista_hit";
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
  }
  if (raider.getTags().includes(WARLORD_TAG)) {
    const loc = raider.location;
    raider.dimension.spawnItem(new ItemStack("minecraft:emerald", 12), loc);
    raider.dimension.spawnItem(new ItemStack("minecraft:diamond", 2), loc);
    const keep = state.keeps[owner];
    if (keep) keep.warlordsSlain = (keep.warlordsSlain ?? 0) + 1;
    for (const p of world.getPlayers()) p.sendMessage(`§6${(raider.nameTag || "A warlord").replace(/§./g, "")} has been slain!`);
  }
});

// Beating the Grand Siege: the settlement's owner becomes its Sovereign
function crownSovereign(owner) {
  const keep = state.keeps[owner];
  keep.sovereign = true;
  const player = world.getPlayers().find((p) => p.id === owner);
  if (player) {
    title(player, "§6Long live the Sovereign!", `§7${keep.name}'s Castle has broken the Warlord King`);
    player.playSound("ui.toast.challenge_complete");
    for (const [id, n] of [["minecraft:emerald", 48], ["minecraft:netherite_ingot", 1], ["minecraft:totem_of_undying", 1]]) {
      player.dimension.spawnItem(new ItemStack(id, n), player.location);
    }
  }
  for (const p of world.getPlayers()) if (p.id !== owner) p.sendMessage(`§6${keep.name} has broken the Warlord King and rules as Sovereign!`);
}

// After a siege: remember the streak and the tactic that did the most killing
function rememberSiege(owner, won) {
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

// ---------- Breachers: battering rams and sappers ----------

function breachDirection(entity) {
  const keep = state.keeps[ownerOf(entity)];
  if (keep) {
    const center = keepCenter(keep);
    const dx = center.x - entity.location.x;
    const dz = center.z - entity.location.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d };
  }
  const v = entity.getViewDirection();
  const d = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / d, z: v.z / d };
}

// First solid block in front of an entity, at body height
function blockAhead(entity, reach, dir = breachDirection(entity)) {
  for (const dy of [0.5, 1.5]) {
    const loc = {
      x: Math.floor(entity.location.x + dir.x * reach),
      y: Math.floor(entity.location.y + dy),
      z: Math.floor(entity.location.z + dir.z * reach),
    };
    const block = entity.dimension.getBlock(loc);
    if (block && !block.isAir && !block.isLiquid && !UNBREAKABLE.includes(block.typeId)) return block;
  }
  return undefined;
}

function smash(block) {
  const { x, y, z } = block.location;
  block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}

function ramTick() {
  for (const ram of world.getDimension("overworld").getEntities({ tags: [RAM_TAG] })) {
    try {
      const block = blockAhead(ram, 1.8);
      if (!block) continue;
      ram.dimension.playSound("random.anvil_land", block.location, { volume: 0.8, pitch: 0.5 });
      hitWall(block, DAMAGE.ram);
    } catch {
      // ram unloaded or gone
    }
  }
}

function isBuilt(typeId) {
  return typeId.startsWith("siege:") || /brick|planks|cobblestone|wall|fence|door|gate|glass|log|slab|stairs/.test(typeId);
}

function sapperTick() {
  for (const sapper of world.getDimension("overworld").getEntities({ tags: [SAPPER_TAG] })) {
    try {
      const block = blockAhead(sapper, 1.2);
      if (!block || !isBuilt(block.typeId)) continue;
      // Plant a lit charge at the foot of the wall, then go back to fighting.
      // Break the charge before the fuse runs out to defuse it.
      const spot = sapper.dimension.getBlock({
        x: Math.floor(sapper.location.x), y: Math.floor(sapper.location.y), z: Math.floor(sapper.location.z),
      });
      if (!spot?.isAir) continue;
      spot.setType(CHARGE);
      sapper.removeTag(SAPPER_TAG);
      const dir = breachDirection(sapper);
      lightCharge(spot, { x: dir.x, y: 0, z: dir.z }, BLAST.sapper);
      const owner = ownerOf(sapper);
      const defender = world.getPlayers().find((p) => p.id === owner);
      defender?.onScreenDisplay.setActionBar("§cA sapper planted a charge at your wall! Break it to defuse it!");
    } catch {
      // sapper unloaded or gone
    }
  }
}

// ---------- Battering Ram: a siege engine you drive yourself ----------
// Place it, climb on (click it), steer with WASD, and punch the wall in front to swing the beam.

const RAM_ENGINE = "siege:ram_engine";
const ramReady = new Map(); // ram entity id -> tick when it can swing again

function ramUnder(player) {
  const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
  return mount?.typeId === RAM_ENGINE ? mount : undefined;
}

function facing(entity) {
  const yaw = (entity.getRotation().y * Math.PI) / 180;
  return { x: -Math.sin(yaw), z: Math.cos(yaw) };
}

function swingRam(ram, player) {
  if (system.currentTick < (ramReady.get(ram.id) ?? 0)) return;
  ramReady.set(ram.id, system.currentTick + SETTINGS.ramSwingTicks);
  const dim = ram.dimension;
  dim.runCommand(`playanimation @e[type=${RAM_ENGINE},r=0.5,x=${ram.location.x},y=${ram.location.y},z=${ram.location.z}] animation.siege_ram.strike`);
  const block = blockAhead(ram, 3, facing(ram)); // the ram is big, the beam reaches 3 blocks out
  if (!block) return dim.playSound("mob.ravager.attack", ram.location, { volume: 0.6, pitch: 0.6 });
  const owner = dim.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  if (owner && !isOnline(owner)) {
    return player.onScreenDisplay.setActionBar(`§c${state.keeps[owner]?.name ?? "The owner"} is away. Their walls can't be touched.`);
  }
  if (owner) markWanted(player, owner);
  system.runTimeout(() => {
    try {
      dim.playSound("random.anvil_land", block.location, { volume: 1, pitch: 0.4 });
      hitWall(block, DAMAGE.playerRam);
    } catch {
      // block area unloaded
    }
  }, 11); // lands when the beam swings forward
}

world.afterEvents.entityHitBlock.subscribe((event) => {
  const player = event.damagingEntity;
  if (!state || player.typeId !== "minecraft:player") return;
  const ram = ramUnder(player);
  if (ram) swingRam(ram, player);
});

// A freshly placed ram faces the way its builder is looking
world.afterEvents.entitySpawn.subscribe((event) => {
  const ram = event.entity;
  if (ram?.typeId !== RAM_ENGINE) return;
  const builder = ram.dimension.getPlayers({ location: ram.location, maxDistance: 8, closest: 1 })[0];
  if (builder) ram.setRotation({ x: 0, y: builder.getRotation().y });
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  if (event.target?.typeId !== RAM_ENGINE) return;
  event.player.onScreenDisplay.setActionBar("§6Steer with WASD. Punch the wall ahead to ram it. Sneak to get off.");
});

// ---------- Wall strength: reinforcement, damage and repair ----------
// Castle Stone and gates can be reinforced with iron, then diamond, then netherite.
// Siege weapons wear walls down instead of breaking them instantly, and cracks show the damage.

const REINFORCEABLE = ["siege:castle_stone", "siege:portcullis", "siege:castle_gate"];
const REINFORCE_ITEMS = { "minecraft:iron_ingot": 1, "minecraft:diamond": 2, "minecraft:netherite_scrap": 3 };
const TIER_NAMES = ["Stone", "Iron", "Diamond", "Netherite"];
const WALL_HP = { castle: [6, 10, 16, 26], gate: [2, 4, 7, 12], otherCastle: 6, other: 3 };
const DAMAGE = { ram: 1, playerRam: 2 };
// power = damage where it hits, radius = how far it reaches (blocks). Same numbers as the Siege Wall Lab.
const BLAST = { boulder: { power: 6.5, radius: 1.6 }, sapper: { power: 7, radius: 2 }, charge: { power: 10, radius: 2.3 } };

// Each block's mortar is a little stronger or weaker, fixed per position, so craters come out ragged
function toughness(loc) {
  const h = Math.sin(loc.x * 12.9898 + loc.y * 78.233 + loc.z * 37.719) * 43758.5453;
  return 0.75 + (h - Math.floor(h)) * 0.5;
}

// Strongest where it hits, fading with distance, reaching deeper in the direction it travelled
function blastDamage(dim, at, power, radius, intoWall, filter = () => true) {
  const cx = Math.round(at.x), cy = Math.round(at.y), cz = Math.round(at.z);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const block = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
    if (!block || block.isAir || block.isLiquid || UNBREAKABLE.includes(block.typeId) || !filter(block)) continue;
    const ox = block.location.x + 0.5 - at.x, oy = block.location.y + 0.5 - at.y, oz = block.location.z + 0.5 - at.z;
    const dist = Math.hypot(ox, oy, oz);
    const along = ox * intoWall.x + oy * intoWall.y + oz * intoWall.z;
    const reach = radius + Math.max(0, along) * 0.6;
    if (dist > reach) continue;
    const damage = (power * (1 - dist / (reach + 0.6)) * (0.55 + Math.random() * 0.9)) / toughness(block.location);
    if (damage >= 0.5) hitWall(block, damage);
  }
}

let wallDamage; // "x,y,z" -> damage taken

function damageMap() {
  wallDamage ??= JSON.parse(world.getDynamicProperty("siege:wall_damage") ?? "{}");
  return wallDamage;
}

function saveDamage() {
  world.setDynamicProperty("siege:wall_damage", JSON.stringify(wallDamage));
}

const blockKey = (b) => `${b.location.x},${b.location.y},${b.location.z}`;

function armorOf(block) {
  return REINFORCEABLE.includes(block.typeId) ? block.permutation.getState("siege:armor") ?? 0 : 0;
}

function wallHp(block) {
  if (block.typeId === "siege:castle_stone") return WALL_HP.castle[armorOf(block)];
  if (GATES.includes(block.typeId)) return WALL_HP.gate[armorOf(block)];
  if (CASTLE_BLOCKS.includes(block.typeId)) return WALL_HP.otherCastle;
  return WALL_HP.other;
}

function showCracks(block, damage) {
  if (block.typeId !== "siege:castle_stone") return;
  const frac = damage / wallHp(block);
  const cracks = frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0;
  if (block.permutation.getState("siege:cracks") !== cracks) {
    block.setPermutation(block.permutation.withState("siege:cracks", cracks));
  }
}

// Deal damage to a block. Returns true if it broke.
function hitWall(block, amount) {
  const map = damageMap();
  const key = blockKey(block);
  const damage = (map[key] ?? 0) + amount;
  const dim = block.dimension;
  const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  dim.spawnParticle("minecraft:large_explosion", center);
  if (damage >= wallHp(block)) {
    delete map[key];
    saveDamage();
    smash(block);
    return true;
  }
  map[key] = damage;
  saveDamage();
  showCracks(block, damage);
  return false;
}

function consumeHeld(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const inv = player.getComponent("minecraft:inventory").container;
  const held = inv.getItem(player.selectedSlotIndex);
  if (held && held.amount > 1) {
    held.amount -= 1;
    inv.setItem(player.selectedSlotIndex, held);
  } else {
    inv.setItem(player.selectedSlotIndex, undefined);
  }
}

// Returns true if the click was a reinforce or repair (so gates don't also toggle)
function workOnWall(block, player, item) {
  if (!item || !REINFORCEABLE.includes(block.typeId)) return false;
  const land = settlementAt(block.location);
  const yours = land && (land === player.id || isAlly(land, player.id));

  const tier = REINFORCE_ITEMS[item.typeId];
  if (tier !== undefined) {
    if (!yours) {
      player.onScreenDisplay.setActionBar("§cYou can only reinforce walls on your own land.");
      return true;
    }
    const current = armorOf(block);
    if (current >= tier) {
      player.onScreenDisplay.setActionBar(`§7Already reinforced with ${TIER_NAMES[current]}.`);
      return true;
    }
    if (current !== tier - 1) {
      player.onScreenDisplay.setActionBar(`§7Reinforce with ${TIER_NAMES[current + 1]} first.`);
      return true;
    }
    block.setPermutation(block.permutation.withState("siege:armor", tier));
    consumeHeld(player);
    block.dimension.playSound("random.anvil_use", block.location, { volume: 0.7 });
    player.onScreenDisplay.setActionBar(`§6Reinforced with ${TIER_NAMES[tier]}`);
    return true;
  }

  if (item.typeId === "minecraft:stone_bricks") {
    const map = damageMap();
    const key = blockKey(block);
    if (!map[key] || !yours) return false;
    map[key] = Math.max(0, map[key] - 3);
    if (map[key] === 0) delete map[key];
    saveDamage();
    showCracks(block, map[key] ?? 0);
    consumeHeld(player);
    block.dimension.playSound("dig.stone", block.location);
    player.onScreenDisplay.setActionBar(map[key] ? "§7Patched, but still damaged" : "§aWall fully repaired");
    return true;
  }
  return false;
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
  if (event.itemStack.typeId === WRIT) return useWrit(player);
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

// ---------- Clicking blocks: gates and banner dyeing ----------

const GATE_SOUNDS = {
  "siege:portcullis": { open: "random.door_open", close: "random.anvil_land" },
  "siege:castle_gate": { open: "random.door_open", close: "random.door_close" },
};

const COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const DYES = Object.fromEntries(COLORS.map((c, i) => [`minecraft:${c}_dye`, i]));
Object.assign(DYES, { "minecraft:ink_sac": 15, "minecraft:bone_meal": 0, "minecraft:lapis_lazuli": 11, "minecraft:cocoa_beans": 12 });

const lastClick = new Map(); // stops one click from counting twice

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);

  if (workOnWall(block, player, event.itemStack)) return;
  if (GATE_SOUNDS[block.typeId]) toggleGate(block);
  else if (block.typeId === KEEP_BANNER) {
    if (DYES[event.itemStack?.typeId] !== undefined) dyeBanner(block, player, event.itemStack);
    else keepMenu(block, player);
  } else if (block.typeId === BARRACKS) {
    if (event.itemStack?.typeId === "minecraft:emerald") recruitGuard(block, player, event.itemStack);
    else barracksMenu(block, player);
  }
});

function toggleGate(block) {
  const gateType = block.typeId;
  const open = !block.permutation.getState("siege:open");
  // Find every gate block of the same kind touching this one, so a big gate moves as one piece
  const dim = block.dimension;
  const seen = new Set();
  const queue = [block.location];
  const gate = [];
  while (queue.length > 0 && gate.length < SETTINGS.gateMaxSize) {
    const loc = queue.shift();
    const key = `${loc.x},${loc.y},${loc.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = dim.getBlock(loc);
    if (!b || b.typeId !== gateType) continue;
    gate.push(b);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      queue.push({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz });
    }
  }
  for (const b of gate) b.setPermutation(b.permutation.withState("siege:open", open));
  const sounds = GATE_SOUNDS[gateType];
  dim.playSound(open ? sounds.open : sounds.close, block.location, { volume: 0.6 });
}

function dyeBanner(block, player, item) {
  const color = item ? DYES[item.typeId] : undefined;
  if (color === undefined || block.permutation.getState("siege:color") === color) return;
  const keep = state.keeps[player.id];
  if (!keep || keep.x !== block.location.x || keep.y !== block.location.y || keep.z !== block.location.z) {
    return player.onScreenDisplay.setActionBar("§cOnly the owner can recolor a Keep Banner.");
  }
  if (colorTaken(color, player.id)) {
    return player.onScreenDisplay.setActionBar("§cAnother settlement already flies that color.");
  }
  keep.color = color;
  saveState();
  block.setPermutation(block.permutation.withState("siege:color", color));
  block.dimension.playSound("dye.use", block.location);
  if (player.getGameMode() !== GameMode.Creative) {
    const inv = player.getComponent("minecraft:inventory").container;
    const held = inv.getItem(player.selectedSlotIndex);
    if (held && held.amount > 1) {
      held.amount -= 1;
      inv.setItem(player.selectedSlotIndex, held);
    } else {
      inv.setItem(player.selectedSlotIndex, undefined);
    }
  }
}

// ---------- Settlement growth: Hamlet → Town → City ----------
// Every siege your keep survives counts as a win. Wins grow your settlement.

const TIERS = [
  { name: "Hamlet", wins: 0, radius: 32, keepHealth: 200 },
  { name: "Town", wins: 3, radius: 48, keepHealth: 300 },
  { name: "City", wins: 6, radius: 64, keepHealth: 400 },
  { name: "Castle", wins: 10, warlords: 2, radius: 80, keepHealth: 600 }, // also needs 2 warlords slain
];
const MAX_RADIUS = TIERS[TIERS.length - 1].radius;

function tierOf(keep) {
  return [...TIERS].reverse().find((t) => (keep.wins ?? 0) >= t.wins && (keep.warlordsSlain ?? 0) >= (t.warlords ?? 0));
}

function recordWin(owner) {
  const keep = state.keeps[owner];
  if (!keep) return;
  const before = TIERS.find((t) => t.name === keep.tier) ?? tierOf(keep); // warlord kills mid-siege can count too
  keep.wins = (keep.wins ?? 0) + 1;
  const after = tierOf(keep);
  keep.tier = after.name;
  saveState();
  if (after === before) return;
  if (after.name === "Castle") {
    for (const p of world.getPlayers()) p.sendMessage(`§4The Warlord King has heard of ${keep.name}'s Castle. Their next siege will be the Grand Siege.`);
  }
  for (const p of world.getPlayers()) {
    if (p.id === owner) {
      title(p, `§6Your ${before.name} is now a ${after.name}!`, `§7Your land reaches ${after.radius} blocks and your keep is tougher`);
      p.playSound("ui.toast.challenge_complete");
    } else {
      p.sendMessage(`§6${keep.name}'s ${before.name} has grown into a ${after.name}!`);
    }
  }
}

// ---------- Alliances: a Writ of Alliance lets a friend build on your land ----------

const WRIT = "siege:writ_of_alliance";

function isAlly(owner, playerId) {
  return state.keeps[owner]?.allies?.includes(playerId) ?? false;
}

function useWrit(player) {
  const keep = state.keeps[player.id];
  if (!keep) return player.sendMessage("§7You need a settlement before you can make alliances.");
  const target = player.getEntitiesFromViewDirection({ maxDistance: 8 })
    .map((hit) => hit.entity).find((e) => e.typeId === "minecraft:player");
  if (!target) return player.onScreenDisplay.setActionBar("§7Look at a player and use the writ to ally with them.");
  keep.allies ??= [];
  if (keep.allies.includes(target.id)) {
    keep.allies = keep.allies.filter((id) => id !== target.id);
    player.sendMessage(`§7${target.name} is no longer allied with your settlement.`);
    target.sendMessage(`§7${player.name} has ended your alliance. You can no longer build on their land.`);
  } else {
    keep.allies.push(target.id);
    player.sendMessage(`§6${target.name} is now your ally and can build on your land.`);
    target.sendMessage(`§6${player.name} has made you an ally. You can build on their land.`);
    player.playSound("random.levelup");
  }
  saveState();
}

// ---------- Trebuchet: hurl boulders at walls ----------
// A big machine you place anywhere. Stand behind it and look where you want to fire.
// Click it holding cobblestone (or stone) to load and fire one boulder. Sneak + click changes the range.

const TREBUCHET = "siege:trebuchet_engine";
const RANGES = [20, 30, 40];
const AMMO = ["minecraft:cobblestone", "minecraft:stone", "minecraft:cobbled_deepslate"];
const trebuchetReady = new Map(); // trebuchet entity id -> tick when it can fire again

function useTrebuchet(trebuchet, player, item) {
  const range = trebuchet.getDynamicProperty("siege:range") ?? 1;
  if (player.isSneaking) {
    const next = (range + 1) % RANGES.length;
    trebuchet.setDynamicProperty("siege:range", next);
    player.onScreenDisplay.setActionBar(`§6Trebuchet range: ${RANGES[next]} blocks`);
    trebuchet.dimension.playSound("random.click", trebuchet.location);
    return;
  }
  if (system.currentTick < (trebuchetReady.get(trebuchet.id) ?? 0)) {
    return player.onScreenDisplay.setActionBar("§7The trebuchet is still winding back...");
  }
  if (!item || !AMMO.includes(item.typeId)) {
    return player.onScreenDisplay.setActionBar("§7Hold cobblestone to load a boulder. Sneak + click to change range.");
  }
  if (player.getGameMode() !== GameMode.Creative) {
    const inv = player.getComponent("minecraft:inventory").container;
    const held = inv.getItem(player.selectedSlotIndex);
    if (held && held.amount > 1) {
      held.amount -= 1;
      inv.setItem(player.selectedSlotIndex, held);
    } else {
      inv.setItem(player.selectedSlotIndex, undefined);
    }
  }
  trebuchetReady.set(trebuchet.id, system.currentTick + SETTINGS.trebuchetReloadTicks);

  // Swing round to face where the player is looking, then let fly
  const view = player.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / flat, z: view.z / flat };
  trebuchet.setRotation({ x: 0, y: player.getRotation().y });
  const dim = trebuchet.dimension;
  const at = trebuchet.location;
  dim.runCommand(`playanimation @e[type=${TREBUCHET},r=0.5,x=${at.x},y=${at.y},z=${at.z}] animation.siege_trebuchet.fire`);
  dim.playSound("random.door_open", at, { volume: 1, pitch: 0.5 });
  system.runTimeout(() => {
    // the sling lets go near the top of the swing
    const start = { x: at.x + dir.x, y: at.y + 6, z: at.z + dir.z };
    launchBoulder(dim, start, dir, RANGES[range]);
  }, 9);
}

function launchBoulder(dim, start, dir, range) {
  dim.playSound("random.explode", start, { volume: 0.4, pitch: 1.6 });
  const flightTicks = 30;
  const apex = range / 3;
  let t = 0;
  const flight = system.runInterval(() => {
    t += 1;
    const f = t / flightTicks;
    const pos = {
      x: start.x + dir.x * range * f,
      y: start.y + 4 * apex * f * (1 - f),
      z: start.z + dir.z * range * f,
    };
    try {
      dim.spawnParticle("minecraft:large_explosion", pos);
      const block = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
      const landed = block && !block.isAir && !block.isLiquid && t > 3;
      if (!landed && t < flightTicks * 3) return;
      system.clearRun(flight);
      if (block) boulderImpact(dim, pos, dir);
    } catch {
      system.clearRun(flight); // flew into unloaded land
    }
  }, 1);
}

function boulderImpact(dim, pos, dir) {
  dim.createExplosion(pos, 2, { breaksBlocks: false, causesFire: false });
  blastDamage(dim, pos, BLAST.boulder.power, BLAST.boulder.radius, { x: dir.x, y: -0.3, z: dir.z }, offlineSafe);
}

// Nothing in a settlement whose owner is away can be damaged
function offlineSafe(block) {
  const owner = settlementAt(block.location);
  return !owner || isOnline(owner);
}

// ---------- Borders: see where land begins, and get told when you cross ----------

const lastLand = new Map(); // player id -> owner id of the land they're standing in

function borderTick() {
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const loc = player.location;

    const here = settlementAt(loc) ?? null;
    const before = lastLand.get(player.id) ?? null;
    if (here !== before) {
      lastLand.set(player.id, here);
      if (here) {
        const keep = state.keeps[here];
        const whose = here === player.id ? "your" : `${keep.name}'s`;
        player.onScreenDisplay.setActionBar(`§6Entering ${whose} ${tierOf(keep).name}`);
      } else if (before && state.keeps[before]) {
        player.onScreenDisplay.setActionBar("§7Entering the wilds");
      }
    }

    // Draw the nearby stretch of each border in that settlement's banner color
    for (const keep of Object.values(state.keeps)) {
      const r = tierOf(keep).radius;
      const cx = keep.x + 0.5;
      const cz = keep.z + 0.5;
      const d = Math.hypot(loc.x - cx, loc.z - cz);
      if (Math.abs(d - r) > 10) continue;
      const [cr, cg, cb] = DYE_RGB[COLORS[keep.color ?? 14]];
      const vars = new MolangVariableMap();
      vars.setColorRGB("variable.color", { red: cr / 255, green: cg / 255, blue: cb / 255 });
      const angle = Math.atan2(loc.z - cz, loc.x - cx);
      for (let k = -8; k <= 8; k++) {
        const a = angle + (k * 1.5) / r;
        for (const dy of [0.2, 1.2]) {
          try {
            player.spawnParticle("minecraft:redstone_wire_dust_particle",
              { x: cx + Math.cos(a) * r, y: loc.y + dy, z: cz + Math.sin(a) * r }, vars);
          } catch {
            // particle position not loaded
          }
        }
      }
    }
  }
}

// ---------- Land protection ----------
// Inside someone else's settlement you can't break, build or dig. The only ways in are
// through the gate, a Breaching Charge, or a raid's battering rams. While the owner is
// offline nothing in their settlement can be broken at all.

const isOnline = (owner) => world.getPlayers().some((p) => p.id === owner);

function foreignSettlement(player, location, dimensionId) {
  if (dimensionId !== "minecraft:overworld") return undefined;
  const owner = settlementAt(location);
  return owner && owner !== player.id && !isAlly(owner, player.id) ? owner : undefined;
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (!state) return;
  const { player, block } = event;
  const owner = foreignSettlement(player, block.location, block.dimension.id);
  if (!owner) return;
  // An enemy can carry off your Keep Banner, but only while you're online to defend it
  if (block.typeId === KEEP_BANNER && isOnline(owner)) return;
  event.cancel = true;
  const name = state.keeps[owner]?.name ?? "another player";
  system.run(() => player.onScreenDisplay.setActionBar(isOnline(owner)
    ? `§cThis is ${name}'s land. Use a Breaching Charge or come in through the gate.`
    : `§c${name} is away. Their settlement can't be touched until they return.`));
});

// Building inside someone else's settlement isn't allowed, except Breaching Charges while they're online
function placementAllowed(player, block, typeId) {
  const owner = foreignSettlement(player, block.location, block.dimension.id);
  if (!owner) return true;
  return typeId === CHARGE && isOnline(owner);
}

const placeBefore = world.beforeEvents.playerPlaceBlock;
if (placeBefore) {
  placeBefore.subscribe((event) => {
    if (!state) return;
    const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
    if (placementAllowed(event.player, event.block, typeId)) return;
    event.cancel = true;
    const player = event.player;
    system.run(() => player.onScreenDisplay.setActionBar("§cYou can't build on someone else's land."));
  });
}

// Explosions can't damage a settlement whose owner is offline
world.beforeEvents.explosion?.subscribe((event) => {
  if (!state || event.dimension.id !== "minecraft:overworld") return;
  const blocks = event.getImpactedBlocks();
  const safe = blocks.filter((b) => {
    const owner = settlementAt(b.location);
    return !owner || isOnline(owner);
  });
  if (safe.length !== blocks.length) event.setImpactedBlocks(safe);
});

// Taking someone's Keep Banner topples their settlement
world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (!state || event.brokenBlockPermutation.type.id !== KEEP_BANNER) return;
  const loc = event.block.location;
  const owner = Object.keys(state.keeps).find((o) => {
    const k = state.keeps[o];
    return k.x === loc.x && k.y === loc.y && k.z === loc.z;
  });
  if (!owner) return;
  const taker = event.player;
  if (owner === taker.id) return; // checkKeeps handles abandoning your own
  const name = state.keeps[owner].name;
  if (state.active) {
    keepFallen(owner);
  } else {
    delete state.keeps[owner];
    saveState();
  }
  for (const p of world.getPlayers()) {
    if (p.id === owner) title(p, "§4Your Keep Banner was taken!", `§7${taker.name} captured it. Raise a new one.`);
    else p.sendMessage(`§6${taker.name} captured ${name}'s Keep Banner!`);
  }
});

// ---------- Breaching Charge: blows a hole in enemy walls ----------

// facing: the way the blast drives (the way you faced when lighting it)
function lightCharge(block, facing, blast = BLAST.charge) {
  const dim = block.dimension;
  const at = { ...block.location };
  const center = { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 };
  dim.playSound("random.fuse", center);
  let ticks = 0;
  const fuse = system.runInterval(() => {
    ticks += 10;
    try {
      const b = dim.getBlock(at);
      if (!b || b.typeId !== CHARGE) return system.clearRun(fuse); // defused
      dim.spawnParticle("minecraft:basic_smoke_particle", { x: center.x, y: center.y + 0.6, z: center.z });
      if (ticks < SETTINGS.chargeFuseTicks) return;
      system.clearRun(fuse);
      b.setType("minecraft:air");
      dim.createExplosion(center, 2, { breaksBlocks: false, causesFire: false });
      blastDamage(dim, center, blast.power, blast.radius, facing, offlineSafe);
    } catch {
      system.clearRun(fuse);
    }
  }, 10);
}

// ---------- Settlement colors: unique per player, and Guard armor cloth matches ----------

function colorTaken(color, exceptOwner) {
  return Object.entries(state.keeps).some(([o, k]) => o !== exceptOwner && k.color === color);
}

function freeColor(preferred) {
  if (!colorTaken(preferred)) return preferred;
  return COLORS.findIndex((_, i) => !colorTaken(i));
}

const DYE_RGB = {
  white: [233, 236, 236], orange: [240, 118, 19], magenta: [189, 68, 179], light_blue: [58, 175, 217],
  yellow: [248, 197, 39], lime: [112, 185, 25], pink: [237, 141, 172], gray: [62, 68, 71],
  light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [121, 42, 172], blue: [53, 57, 157],
  brown: [114, 71, 40], green: [84, 109, 27], red: [161, 39, 34], black: [29, 29, 33],
};

function guardColorTick() {
  for (const player of world.getPlayers()) {
    const keep = state.keeps[player.id];
    if (!keep) continue;
    const [r, g, b] = DYE_RGB[COLORS[keep.color ?? 14]];
    const want = { red: r / 255, green: g / 255, blue: b / 255 };
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) continue;
    for (const [slot, id] of Object.entries(GUARD_SET)) {
      const item = gear.getEquipment(slot);
      if (item?.typeId !== id) continue;
      try {
        const dye = item.getComponent("minecraft:dyeable");
        const c = dye?.color;
        if (!dye || (c && Math.abs(c.red - want.red) < 0.01 && Math.abs(c.green - want.green) < 0.01 && Math.abs(c.blue - want.blue) < 0.01)) continue;
        dye.color = want;
        gear.setEquipment(slot, item);
      } catch {
        // dye colors not supported on this version; armor stays crimson
      }
    }
  }
}

// ---------- Placing blocks: settlements and building rights ----------

const PLACE_MESSAGES = {
  [DESK]: "§7Quartermaster's desk set up. Bring an unemployed villager to it and they'll take the job.",
  "siege:barracks": "§7Barracks built. Bring an unemployed villager here and click it with 5 emeralds to recruit a Man-at-Arms (sneak + click for an Archer).",
};

// Undo a placement and hand the block back
function refuse(player, block, message) {
  const typeId = block.typeId;
  block.setType("minecraft:air");
  if (player.getGameMode() !== GameMode.Creative) {
    const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(typeId, 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  }
  player.onScreenDisplay.setActionBar(message);
}

function foundSettlement(player, block) {
  if (block.dimension.id !== "minecraft:overworld") {
    return refuse(player, block, "§cA Keep Banner can only be raised in the Overworld.");
  }
  if (state.active && state.keeps[player.id]) {
    return refuse(player, block, "§cYou can't move your keep during a siege!");
  }
  const loc = block.location;
  for (const [owner, keep] of Object.entries(state.keeps)) {
    if (owner === player.id) continue;
    if (Math.hypot(loc.x - keep.x, loc.z - keep.z) < MAX_RADIUS * 2) {
      return refuse(player, block, `§cToo close to ${keep.name}'s settlement.`);
    }
  }

  const old = state.keeps[player.id];
  if (old && keepBlock(old)) overworld().runCommand(`setblock ${old.x} ${old.y} ${old.z} air destroy`);
  const color = old?.color ?? freeColor(block.permutation.getState("siege:color"));
  block.setPermutation(block.permutation.withState("siege:color", color));
  state.keeps[player.id] = { x: loc.x, y: loc.y, z: loc.z, name: player.name, color, wins: old?.wins ?? 0, allies: old?.allies ?? [] };
  saveState();
  title(player, old ? "§6Settlement moved" : "§6Settlement founded",
    `§7Your ${tierOf(state.keeps[player.id]).name} reaches ${tierOf(state.keeps[player.id]).radius} blocks from your banner`);
  player.playSound("random.levelup");
  if (!old) player.sendMessage("§6Your Keep is raised! Craft a Siege Workshop to make castle blocks. Raiders will march on this banner on siege nights. Use dye on it to change its color.");
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, player } = event;
  if (!state) return;

  // Fallback for game versions without the "before place" event: undo building on someone else's land
  if (!placeBefore && !placementAllowed(player, block, block.typeId)) {
    let refund;
    try {
      refund = block.getItemStack(1);
    } catch {
      refund = undefined;
    }
    block.setType("minecraft:air");
    if (refund && player.getGameMode() !== GameMode.Creative) {
      player.getComponent("minecraft:inventory").container.addItem(refund);
    }
    player.onScreenDisplay.setActionBar("§cYou can't build on someone else's land.");
    return;
  }

  if (!block.typeId.startsWith("siege:")) return;
  if (REINFORCEABLE.includes(block.typeId) && damageMap()[blockKey(block)]) {
    delete wallDamage[blockKey(block)]; // fresh block, no leftover damage
    saveDamage();
  }
  if (block.typeId === KEEP_BANNER) return foundSettlement(player, block);
  if (block.typeId === CHARGE) {
    const view = player.getViewDirection();
    const flat = Math.hypot(view.x, view.z) || 1;
    player.onScreenDisplay.setActionBar("§6Charge lit! Stand back!");
    if (block.dimension.id === "minecraft:overworld") markWanted(player, settlementAt(block.location));
    return lightCharge(block, { x: view.x / flat, y: 0, z: view.z / flat });
  }

  // Every other Siege Nights block can only be placed on your own or allied land
  const land = block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined;
  const yours = land && (land === player.id || isAlly(land, player.id));
  if (!yours) {
    return refuse(player, block, state.keeps[player.id]
      ? "§cYou can only build this inside your settlement."
      : "§cRaise a Keep Banner first to found your settlement.");
  }

  if (!tracked[block.typeId]) return;
  tracked[block.typeId].push({ dim: block.dimension.id, x: block.location.x, y: block.location.y, z: block.location.z });
  saveTracked();
  player.sendMessage(PLACE_MESSAGES[block.typeId]);
});

// Runs `work` on every loaded machine of one type, and forgets machines that were broken
function forEachMachine(typeId, work) {
  let changed = false;
  tracked[typeId] = tracked[typeId].filter((t) => {
    const dim = world.getDimension(t.dim);
    let block;
    try {
      block = dim.getBlock(t);
    } catch {
      return true; // chunk not loaded right now; keep it
    }
    if (!block) return true;
    if (block.typeId !== typeId) {
      changed = true; // it was broken or blown up
      return false;
    }
    work(block, dim);
    return true;
  });
  if (changed) saveTracked();
}

// ---------- Ballista: turns to face monsters in range and shoots them ----------

const BALLISTA = "siege:ballista_engine";
const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

function ballistasOf(owner) {
  return overworld().getEntities({ type: BALLISTA }).filter((b) => settlementAt(b.location) === owner);
}

function ballistaTick() {
  for (const id of DIMENSIONS) {
    const dim = world.getDimension(id);
    for (const ballista of dim.getEntities({ type: BALLISTA })) {
      try {
        const loc = ballista.location;
        const origin = { x: loc.x, y: loc.y + 1.2, z: loc.z };
        const targets = dim.getEntities({ location: origin, maxDistance: SETTINGS.ballistaRange, families: ["monster"] });
        const target = targets.find((e) => canSee(dim, origin, e));
        if (!target) continue;
        // Swing the turret round, release, and the bolt hits a moment later
        const yaw = (Math.atan2(-(target.location.x - loc.x), target.location.z - loc.z) * 180) / Math.PI;
        ballista.setRotation({ x: 0, y: yaw });
        dim.runCommand(`playanimation @e[type=${BALLISTA},r=0.5,x=${loc.x},y=${loc.y},z=${loc.z}] animation.siege_ballista.fire`);
        system.runTimeout(() => {
          try {
            if (target.isValid) shoot(dim, origin, target);
          } catch {
            // target gone
          }
        }, 2);
      } catch {
        // ballista unloaded
      }
    }
  }
}

// Placing a machine: it belongs to whoever set it down and faces the way they look.
// Ballistas only go on your own (or allied) land; a trebuchet can be rolled up to anyone's walls.
const MACHINES = { [BALLISTA]: "siege:ballista", [TREBUCHET]: "siege:trebuchet" };

world.afterEvents.entitySpawn.subscribe((event) => {
  const machine = event.entity;
  if (!state || !MACHINES[machine?.typeId] || machine.getDynamicProperty("siege:owner")) return;
  const player = machine.dimension.getPlayers({ location: machine.location, maxDistance: 8, closest: 1 })[0];
  if (machine.typeId === BALLISTA) {
    const land = machine.dimension.id === "minecraft:overworld" ? settlementAt(machine.location) : undefined;
    if (!player || !land || !(land === player.id || isAlly(land, player.id))) {
      machine.remove();
      if (player) {
        player.getComponent("minecraft:inventory").container.addItem(new ItemStack(MACHINES[BALLISTA], 1));
        player.onScreenDisplay.setActionBar(state.keeps[player.id]
          ? "§cYou can only build this inside your settlement."
          : "§cRaise a Keep Banner first to found your settlement.");
      }
      return;
    }
  }
  if (!player) return;
  machine.setDynamicProperty("siege:owner", player.id);
  machine.setRotation({ x: 0, y: player.getRotation().y });
  player.sendMessage(machine.typeId === BALLISTA
    ? "§7Ballista ready. It turns to face any monster in range and shoots. Sneak + click to pack it up."
    : "§7Trebuchet built. Hold cobblestone and click it to fire where you're looking. Sneak + click changes range.");
});

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (!state || !MACHINES[target?.typeId]) return;
  const owner = target.getDynamicProperty("siege:owner");
  const item = event.beforeItemStack ?? event.itemStack;
  // Sneak + click with an empty hand packs your machine back into an item
  if (player.isSneaking && !item && (!owner || owner === player.id)) {
    target.remove();
    const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(MACHINES[target.typeId], 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    return;
  }
  if (target.typeId === TREBUCHET) useTrebuchet(target, player, item);
  else player.onScreenDisplay.setActionBar("§6The ballista fires on its own. Sneak + click with an empty hand to pack it up.");
});

// Nobody can wreck your machines while you're away, same as your walls
function machineGuardTick() {
  for (const id of DIMENSIONS) {
    for (const machine of world.getDimension(id).getEntities({ families: ["siege_engine"] })) {
      try {
        const owner = machine.getDynamicProperty("siege:owner");
        if (owner && !isOnline(owner)) machine.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
      } catch {
        // gone
      }
    }
  }
}

function canSee(dim, from, entity) {
  const to = { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z };
  const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const dist = Math.hypot(dir.x, dir.y, dir.z);
  if (dist < 0.1) return true;
  const hit = dim.getBlockFromRay(from, { x: dir.x / dist, y: dir.y / dist, z: dir.z / dist }, {
    maxDistance: dist,
    includePassableBlocks: false,
  });
  // Shoots straight through portcullis bars and arrow slits, but not through solid walls
  return !hit || hit.block.typeId === "siege:portcullis" || hit.block.typeId === "siege:arrow_slit";
}

function shoot(dim, from, target) {
  const to = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    dim.spawnParticle("minecraft:basic_crit_particle", {
      x: from.x + (to.x - from.x) * f,
      y: from.y + (to.y - from.y) * f,
      z: from.z + (to.z - from.z) * f,
    });
  }
  dim.playSound("crossbow.shoot", from, { volume: 0.8 });
  target.addTag(BALLISTA_HIT);
  target.applyDamage(SETTINGS.ballistaDamage, { cause: EntityDamageCause.projectile });
}

// ---------- Quartermaster: a villager who takes the desk as their job ----------

function quartermasterTick() {
  // Unemployed villagers standing at a free desk take the job
  forEachMachine(DESK, (block, dim) => {
    const t = block.location;
    const center = { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
    if (dim.getEntities({ type: QUARTERMASTER, location: center, maxDistance: 8 }).length > 0) return;
    const recruit = dim.getEntities({ type: "minecraft:villager_v2", families: ["unskilled"], location: center, maxDistance: 3 })[0];
    if (!recruit) return;

    const at = { ...recruit.location };
    const name = recruit.nameTag;
    recruit.remove();
    const qm = dim.spawnEntity(QUARTERMASTER, at);
    if (name) qm.nameTag = name;
    qm.setDynamicProperty("siege:desk", JSON.stringify({ x: t.x, y: t.y, z: t.z }));
    dim.spawnParticle("minecraft:villager_happy", { x: at.x, y: at.y + 1.8, z: at.z });
    dim.playSound("random.levelup", at, { volume: 0.6 });
    for (const p of dim.getPlayers({ location: at, maxDistance: 16 })) {
      p.sendMessage("§6A villager has taken the post of Quartermaster! Spend your siege winnings with them.");
    }
  });

  // A quartermaster whose desk is broken goes back to being a plain villager
  const dim = world.getDimension("overworld");
  for (const qm of dim.getEntities({ type: QUARTERMASTER })) {
    try {
      const desk = JSON.parse(qm.getDynamicProperty("siege:desk") ?? "null");
      if (!desk) continue;
      const block = dim.getBlock(desk);
      if (!block || block.typeId === DESK) continue;
      const villager = dim.spawnEntity("minecraft:villager_v2", qm.location);
      if (qm.nameTag) villager.nameTag = qm.nameTag;
      qm.remove();
    } catch {
      // desk chunk not loaded; check again later
    }
  }
}

// ---------- Guards: Archers hold the walls, Men-at-Arms wait in the Barracks ----------
// Bring an unemployed villager to your Barracks and click it with 5 emeralds to recruit a
// Man-at-Arms (sneak + click for an Archer). Sneak + click your own guard to pick them up,
// then place them wherever you want: Archers stay exactly where you put them, and Men-at-Arms
// report to your nearest Barracks and only come out to fight.

const BARRACKS = "siege:barracks";
const GUARD_TYPES = { "siege:archer": "siege:archer_item", "siege:man_at_arms": "siege:man_at_arms_item" };
const GUARD_COST = 5; // emeralds
const GUARD_LIMIT = { Hamlet: 4, Town: 8, City: 12, Castle: 16 }; // a Sovereign gets 4 more
const WANTED_TAG = "siege_wanted";
const WANTED_TICKS = 6000; // 5 minutes
const wanted = new Map(); // player id -> { owner, until }

const guardTag = (owner) => `siege_guard_of_${owner}`;
const isGuard = (entity) => !!GUARD_TYPES[entity?.typeId];

function guardOwner(entity) {
  return entity.getTags().find((t) => t.startsWith("siege_guard_of_"))?.slice("siege_guard_of_".length);
}

function guardCount(owner) {
  return state.guards[owner] ?? 0;
}

function nearestBarracks(owner, dim, loc) {
  let best;
  let bestDist = Infinity;
  for (const t of tracked[BARRACKS]) {
    if (t.dim !== dim.id || settlementAt(t) !== owner) continue;
    const d = Math.hypot(t.x - loc.x, t.z - loc.z);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

// Give a guard its owner, colors and post
function enlist(guard, owner, at) {
  guard.addTag(guardTag(owner));
  guard.setDynamicProperty("siege:post", JSON.stringify({ x: at.x, y: at.y, z: at.z }));
  guard.triggerEvent(`siege:color_${state.keeps[owner]?.color ?? 14}`);
}

function countItem(player, typeId) {
  const inv = player.getComponent("minecraft:inventory").container;
  let have = 0;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === typeId) have += inv.getItem(i).amount;
  return have;
}

// Takes `amount` of an item from anywhere in the inventory; false (and takes nothing) if there isn't enough
function takeItems(player, typeId, amount) {
  if (player.getGameMode() === GameMode.Creative) return true;
  if (countItem(player, typeId) < amount) return false;
  const inv = player.getComponent("minecraft:inventory").container;
  let owed = amount;
  for (let i = 0; i < inv.size && owed > 0; i++) {
    const stack = inv.getItem(i);
    if (stack?.typeId !== typeId) continue;
    const take = Math.min(owed, stack.amount);
    owed -= take;
    if (take === stack.amount) inv.setItem(i, undefined);
    else {
      stack.amount -= take;
      inv.setItem(i, stack);
    }
  }
  return true;
}

const guardLimit = (owner) => GUARD_LIMIT[tierOf(state.keeps[owner]).name] + (state.keeps[owner].sovereign ? 4 : 0);

function recruitGuard(block, player, item, chosenType) {
  if (settlementAt(block.location) !== player.id) {
    return player.onScreenDisplay.setActionBar("§cOnly the settlement's owner can recruit here.");
  }
  if (countItem(player, "minecraft:emerald") < GUARD_COST && player.getGameMode() !== GameMode.Creative) {
    return player.onScreenDisplay.setActionBar(`§7Bring an unemployed villager here and ${GUARD_COST} emeralds.`);
  }
  const limit = guardLimit(player.id);
  if (guardCount(player.id) >= limit) {
    return player.onScreenDisplay.setActionBar(`§cYour settlement can only keep ${limit} guards. Grow it to recruit more.`);
  }
  const dim = block.dimension;
  const center = { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 };
  const recruit = dim.getEntities({ type: "minecraft:villager_v2", families: ["unskilled"], location: center, maxDistance: 4 })[0];
  if (!recruit) return player.onScreenDisplay.setActionBar("§7There's no unemployed villager next to the Barracks.");

  takeItems(player, "minecraft:emerald", GUARD_COST);
  const type = chosenType ?? (player.isSneaking ? "siege:archer" : "siege:man_at_arms");
  const at = { ...recruit.location };
  const name = recruit.nameTag;
  recruit.remove();
  const guard = dim.spawnEntity(type, at);
  if (name) guard.nameTag = name;
  enlist(guard, player.id, type === "siege:archer" ? at : block.location);
  state.guards[player.id] = guardCount(player.id) + 1;
  saveState();
  dim.playSound("random.levelup", at, { volume: 0.6 });
  dim.spawnParticle("minecraft:villager_happy", { x: at.x, y: at.y + 1.8, z: at.z });
  player.sendMessage(type === "siege:archer"
    ? "§6A new Archer has joined! Sneak + click to pick them up, then place them on your walls."
    : "§6A new Man-at-Arms has joined! They wait at the Barracks and charge out when you're attacked.");
}

// Sneak + click your guard to pick them up
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (!state || !isGuard(target)) return;
  if (!player.isSneaking) return upgradeGuard(target, player, event.beforeItemStack ?? event.itemStack);
  if (guardOwner(target) !== player.id) return player.onScreenDisplay.setActionBar("§cThat guard doesn't serve you.");
  const item = new ItemStack(GUARD_TYPES[target.typeId], 1);
  if (target.nameTag) item.nameTag = target.nameTag;
  const tier = armorTier(target);
  if (tier) item.setLore([`§7Armor: ${GUARD_ARMOR[tier].name}`]);
  target.remove();
  const leftover = player.getComponent("minecraft:inventory").container.addItem(item);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
});

// Placing a guard from your inventory: it serves whoever placed it, and only on their own land
world.afterEvents.entitySpawn.subscribe((event) => {
  const guard = event.entity;
  if (!state || !isGuard(guard) || guardOwner(guard)) return; // recruits are enlisted on the spot
  const player = guard.dimension.getPlayers({ location: guard.location, maxDistance: 8, closest: 1 })[0];
  const land = guard.dimension.id === "minecraft:overworld" ? settlementAt(guard.location) : undefined;
  if (!player || land !== player.id) {
    const token = new ItemStack(GUARD_TYPES[guard.typeId], 1);
    guard.remove();
    if (player) {
      player.getComponent("minecraft:inventory").container.addItem(token);
      player.onScreenDisplay.setActionBar("§cGuards can only be placed inside your own settlement.");
    }
    return;
  }
  const at = guard.typeId === "siege:archer" ? guard.location : nearestBarracks(player.id, guard.dimension, guard.location);
  if (!at) {
    guard.remove();
    player.getComponent("minecraft:inventory").container.addItem(new ItemStack(GUARD_TYPES[guard.typeId], 1));
    return player.onScreenDisplay.setActionBar("§cBuild a Barracks first. Men-at-Arms need somewhere to wait.");
  }
  enlist(guard, player.id, at);
  const placed = placingTier.get(player.id);
  if (placed && system.currentTick - placed.tick < 20) equipGuard(guard, placed.tier);
  placingTier.delete(player.id);
  if (guard.typeId === "siege:man_at_arms") {
    guard.teleport({ x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 });
    player.onScreenDisplay.setActionBar("§6Your Man-at-Arms reports to the Barracks.");
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  const owner = guardOwner(dead);
  if (!state || !owner) return;
  const dim = dead.dimension, at = dead.location;
  system.runTimeout(() => {
    // guard armor stays with the guard: clear any of it that dropped
    for (const drop of dim.getEntities({ type: "minecraft:item", location: at, maxDistance: 4 })) {
      if (drop.getComponent("minecraft:item")?.itemStack.typeId.startsWith(GUARD_GEAR)) drop.remove();
    }
  }, 2);
  state.guards[owner] = Math.max(0, guardCount(owner) - 1);
  saveState();
  world.getPlayers().find((p) => p.id === owner)?.sendMessage("§cOne of your guards has fallen.");
}, { entityTypes: Object.keys(GUARD_TYPES) });

// ---------- Guard armor: click your guard with materials to upgrade them, up to 4 times ----------

// Guards have their own armor line (siege:guardgear_*), never sold or craftable, so they never look like players
const GUARD_ARMOR = [
  { name: "Gambeson" },
  { name: "Mail and Nasal Helm", item: "minecraft:iron_ingot", cost: 6, label: "6 iron ingots" },
  { name: "Brigandine and Sallet", item: "minecraft:iron_ingot", cost: 12, label: "12 iron ingots" },
  { name: "Half Plate and Bascinet", item: "minecraft:diamond", cost: 4, label: "4 diamonds" },
  { name: "Royal Guard Plate", item: "minecraft:netherite_ingot", cost: 1, label: "1 netherite ingot" },
];
const GUARD_GEAR = "siege:guardgear_";
const ARMOR_SLOTS = { "slot.armor.head": "helmet", "slot.armor.chest": "chestplate", "slot.armor.legs": "leggings", "slot.armor.feet": "boots" };
const placingTier = new Map(); // player id -> armor tier of the guard item they're placing

const armorTier = (guard) => guard.getDynamicProperty("siege:armor") ?? 0;

function equipGuard(guard, tier) {
  guard.setDynamicProperty("siege:armor", tier);
  if (!tier) return;
  for (const [slot, piece] of Object.entries(ARMOR_SLOTS)) guard.runCommand(`replaceitem entity @s ${slot} 0 ${GUARD_GEAR}${tier}_${piece}`);
}

function upgradeGuard(guard, player, item) {
  if (guardOwner(guard) !== player.id) return player.onScreenDisplay.setActionBar("§cThat guard doesn't serve you.");
  const tier = armorTier(guard);
  const next = GUARD_ARMOR[tier + 1];
  if (!next) return player.onScreenDisplay.setActionBar("§6This guard already wears Royal Guard Plate, the best there is.");
  if (item?.typeId !== next.item) {
    return player.onScreenDisplay.setActionBar(`§7${GUARD_ARMOR[tier].name}. Next: §6${next.name}§7, click with ${next.label}.`);
  }
  if (!takeItems(player, next.item, next.cost)) return player.onScreenDisplay.setActionBar(`§cYou need ${next.label} for ${next.name}.`);
  equipGuard(guard, tier + 1);
  guard.dimension.playSound("armor.equip_netherite", guard.location);
  player.onScreenDisplay.setActionBar(`§6Your guard now wears ${next.name}!`);
}

// ---------- Menus: the Keep, the Barracks ----------

function nextSiegeDay() {
  let day = Math.max(world.getDay(), SETTINGS.firstSiegeDay);
  if (day === state.lastSiegeDay) day++;
  while (day % SETTINGS.siegeEveryNNights !== 0) day++;
  return day;
}

function nextTierText(keep) {
  const next = TIERS[TIERS.indexOf(tierOf(keep)) + 1];
  if (!next) return keep.sovereign ? "§6You rule as Sovereign." : "§4The Warlord King is coming. Win the Grand Siege to become Sovereign.";
  const wins = Math.max(0, next.wins - (keep.wins ?? 0));
  const lords = Math.max(0, (next.warlords ?? 0) - (keep.warlordsSlain ?? 0));
  return `Next: §6${next.name}§r in ${wins} more win${wins === 1 ? "" : "s"}${lords ? ` and ${lords} more warlord${lords === 1 ? "" : "s"} slain` : ""}`;
}

function keepMenu(block, player) {
  const owner = settlementAt(block.location);
  const keep = state.keeps[owner];
  if (!keep) return;
  const tier = tierOf(keep);
  const mine = owner === player.id;
  const allies = (keep.allies ?? []).map((id) => world.getPlayers().find((p) => p.id === id)?.name ?? "an ally (offline)");
  const until = nextSiegeDay() - world.getDay();
  const lines = [
    `§l${keep.sovereign ? "Sovereign " : ""}${keep.name}'s ${tier.name}§r`,
    `Banner: ${COLORS[keep.color ?? 14].replace(/_/g, " ")}   Land: ${tier.radius} blocks   Keep: ${tier.keepHealth} health`,
    `Sieges won: ${keep.wins ?? 0}   Win streak: ${keep.streak ?? 0}   Warlords slain: ${keep.warlordsSlain ?? 0}`,
    nextTierText(keep),
    "",
    state.active ? "§cA siege is happening right now!" : until === 0 ? "§cThe next siege comes tonight." : `Next siege: in ${until} day${until === 1 ? "" : "s"} (day ${nextSiegeDay()}).`,
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
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function barracksMenu(block, player) {
  if (settlementAt(block.location) !== player.id) return player.onScreenDisplay.setActionBar("§cOnly the settlement's owner can use these Barracks.");
  const count = guardCount(player.id), limit = guardLimit(player.id);
  const emeralds = countItem(player, "minecraft:emerald");
  const form = new ActionFormData().title("Barracks").body([
    `Guards: ${count}/${limit}   Your emeralds: ${emeralds}`,
    "",
    `Recruiting costs ${GUARD_COST} emeralds and needs an unemployed villager standing next to the Barracks.`,
    "Men-at-Arms wait here and charge out during sieges. Archers stay wherever you place them.",
  ].join("\n"));
  form.button(`Recruit a Man-at-Arms\n§8${GUARD_COST} emeralds`, "textures/items/siege_man_at_arms");
  form.button(`Recruit an Archer\n§8${GUARD_COST} emeralds`, "textures/items/siege_archer");
  form.button(`Your guards (${count})`, "textures/items/iron_sword");
  form.button("Close");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection === 0) recruitGuard(block, player, undefined, "siege:man_at_arms");
    if (r.selection === 1) recruitGuard(block, player, undefined, "siege:archer");
    if (r.selection === 2) guardList(player);
  }).catch(() => {});
}

function guardList(player) {
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

function guardMenu(guard, player) {
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

// ---------- Siege tracker: a sidebar while the siege is on ----------

const HUD = "siege_hud";
function siegeHud() {
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
  want.set("§7Waves sent", SETTINGS.assaultsPerSiege - state.assaultsLeft);
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

// Remember the armor on a guard item as it's placed, so the guard comes back wearing it
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const item = event.itemStack;
  if (!item || !Object.values(GUARD_TYPES).includes(item.typeId)) return;
  const line = item.getLore().find((l) => l.startsWith("§7Armor: "));
  const tier = line ? GUARD_ARMOR.findIndex((a) => a.name === line.slice(9)) : 0;
  if (tier > 0) placingTier.set(event.player.id, { tier, tick: system.currentTick });
});

// Anyone who starts trouble on your land is Wanted there for 5 minutes, and your guards hunt them
function markWanted(player, owner) {
  if (!owner || !state.keeps[owner] || owner === player.id || isAlly(owner, player.id)) return;
  if (!wanted.has(player.id) || wanted.get(player.id).owner !== owner) {
    player.onScreenDisplay.setActionBar(`§cYou are Wanted in ${state.keeps[owner].name}'s settlement! Their guards will attack you.`);
  }
  wanted.set(player.id, { owner, until: system.currentTick + WANTED_TICKS });
}

world.afterEvents.entityHitEntity.subscribe((event) => {
  const attacker = event.damagingEntity;
  const target = event.hitEntity;
  if (!state || attacker?.typeId !== "minecraft:player" || !target) return;
  if (isGuard(target)) return markWanted(attacker, guardOwner(target));
  if (target.typeId === "minecraft:player" && target.dimension.id === "minecraft:overworld") {
    const land = settlementAt(target.location);
    if (land && (land === target.id || isAlly(land, target.id))) markWanted(attacker, land);
  }
});

// A raid (or a Wanted player on your land) calls your Men-at-Arms out of the Barracks
function underAttack(owner) {
  if (state.active && state.besieged.includes(owner)) return true;
  for (const [id, w] of wanted) if (w.owner === owner && w.until > system.currentTick && world.getPlayers().some((p) => p.id === id)) return true;
  return false;
}

function guardTick() {
  // Wanted players are only fair game on the land they wronged
  for (const player of world.getPlayers()) {
    const w = wanted.get(player.id);
    if (w && w.until <= system.currentTick) wanted.delete(player.id);
    const hunted = w && w.until > system.currentTick && player.dimension.id === "minecraft:overworld"
      && settlementAt(player.location) === w.owner;
    if (hunted) player.addTag(WANTED_TAG);
    else player.removeTag(WANTED_TAG);
  }

  for (const type of Object.keys(GUARD_TYPES)) {
    for (const guard of overworld().getEntities({ type })) {
      try {
        const owner = guardOwner(guard);
        const keep = state.keeps[owner];
        if (!owner) continue;
        // Nobody can hurt your guards while you're away, same as your walls
        if (!isOnline(owner)) guard.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
        if (keep?.sovereign) guard.addEffect("strength", 60, { amplifier: 0, showParticles: false }); // royal guard
        if (keep && guard.getComponent("minecraft:variant")?.value !== keep.color) guard.triggerEvent(`siege:color_${keep.color ?? 14}`);

        const post = JSON.parse(guard.getDynamicProperty("siege:post") ?? "null");
        if (!post) continue;
        const loc = guard.location;
        const away = Math.hypot(loc.x - (post.x + 0.5), loc.z - (post.z + 0.5));
        if (guard.typeId === "siege:archer") {
          if (away > 1.5) guard.teleport({ x: post.x, y: post.y, z: post.z }); // archers hold their spot
        } else if (!underAttack(owner) ? away > 5 : !keep || settlementAt(loc) !== owner) {
          guard.teleport({ x: post.x + 0.5, y: post.y + 1, z: post.z + 0.5 }); // back to the Barracks
        }
      } catch {
        // guard unloaded or gone
      }
    }
  }
}

// ---------- Weapons: durability, and the warhammer staggers what it hits ----------

const WEAPONS = ["siege:longsword", "siege:warhammer"];

world.afterEvents.entityHitEntity.subscribe((event) => {
  const player = event.damagingEntity;
  if (player.typeId !== "minecraft:player") return;
  const gear = player.getComponent("minecraft:equippable");
  const weapon = gear?.getEquipment(EquipmentSlot.Mainhand);
  if (!weapon || !WEAPONS.includes(weapon.typeId)) return;

  if (weapon.typeId === "siege:warhammer") {
    try {
      event.hitEntity.addEffect("slowness", 40, { amplifier: 1 });
    } catch {
      // target already gone
    }
  }

  if (player.getGameMode() === GameMode.Creative) return;
  const durability = weapon.getComponent("minecraft:durability");
  if (!durability) return;
  if (durability.damage + 1 >= durability.maxDurability) {
    gear.setEquipment(EquipmentSlot.Mainhand, undefined);
    player.playSound("random.break");
  } else {
    durability.damage += 1;
    gear.setEquipment(EquipmentSlot.Mainhand, weapon);
  }
});

// ---------- Castle Guard armor: full set bonus during sieges ----------

const GUARD_SET = {
  [EquipmentSlot.Head]: "siege:guard_helmet",
  [EquipmentSlot.Chest]: "siege:guard_chestplate",
  [EquipmentSlot.Legs]: "siege:guard_leggings",
  [EquipmentSlot.Feet]: "siege:guard_boots",
};

function guardArmorTick() {
  if (!state.active) return;
  for (const player of world.getPlayers()) {
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) continue;
    const fullSet = Object.entries(GUARD_SET).every(([slot, id]) => gear.getEquipment(slot)?.typeId === id);
    if (fullSet) player.addEffect("resistance", 60, { amplifier: 0, showParticles: false });
  }
}

// ---------- Main loop ----------

function every(ticks, work) {
  system.runInterval(() => {
    try {
      if (!state) loadState();
      work();
    } catch (e) {
      console.warn(`[Siege Nights] ${e}`);
    }
  }, ticks);
}

every(20, siegeHud);
every(40, () => {
  siegeTick();
  guardArmorTick();
  guardColorTick();
  quartermasterTick();
  guardTick();
});
every(SETTINGS.ballistaReloadTicks, ballistaTick);
every(40, machineGuardTick);
every(20, borderTick);
every(20, () => {
  if (!state.active) return;
  ramTick();
  sapperTick();
});
