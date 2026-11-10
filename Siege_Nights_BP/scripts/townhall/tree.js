// The Tree of Oaths: the skill tree menu, path choice, and unbinding.

import { world, GameMode, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { SKILLS, SKILL, BRANCHES, RINGS, RANKS, ROLES, HALL_NAMES, LEVEL_UNLOCKS, canBranch, blockedReason, spentIn, rankOf, levelFromRenown, levelTitle, POWER_ORIGINS } from "./skills.js";
import { heroOf, saveHero, setPath, grantPoints } from "./hero.js";
import { hallLevelAt, setTreeLook } from "./townhall.js";
import { chargeE } from "../economy/coins.js";
import { worth } from "../economy/rules.js";

export const EMBER = "siege:hollow_ember"; // the fallen shard, before you choose
export const BOUND_EMBER = "siege:bound_ember"; // the Marked player's focus
export const OATH_BANNER = "siege:oath_banner"; // the Knight's banner

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const bar = (frac, width = 20) => {
  const full = Math.round(Math.max(0, Math.min(1, frac)) * width);
  return `§a${"|".repeat(full)}§8${"|".repeat(width - full)}§r`;
};

const has = (player, typeId) => api.countItem(player, typeId) > 0;
function give(player, typeId) {
  const left = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(typeId, 1));
  if (left) player.dimension.spawnItem(left, player.location);
}

export function treeMenu(player, hallLevel) {
  const hero = heroOf(player);
  const { into, need } = levelFromRenown(hero.renown);
  const rank = rankOf(hero.path, hero.skills);
  const nextUnlock = Object.entries(LEVEL_UNLOCKS).find(([lvl]) => Number(lvl) > hero.level);
  const pathLine = hero.path === "knight" ? `§6Oathsworn§r, ${rank.name}` : hero.path === "marked" ? `§5Marked§r, ${rank.name}` : "§7No path yet";
  const lines = [
    `§lRenown ${hero.level}§r  ${levelTitle(hero.level)}`,
    need ? `${bar(into / need)} ${into}/${need}` : "§6Renown is at its height.",
    `Path: ${pathLine}`,
    `§bSkill points: ${hero.points}§r   (earned ${hero.earned}, spent ${spentIn(hero.skills)})`,
    `This hall: ${HALL_NAMES[hallLevel]}, ${RINGS[Math.max(1, hallLevel)].name}`,
    nextUnlock ? `§7Renown ${nextUnlock[0]}: ${nextUnlock[1]}` : "",
  ];
  if (hero.path === "marked") lines.push(`Resonance: ${bar(hero.resonance / 100, 20).replace("§a", "§d")} ${Math.round(hero.resonance)}`);
  const form = new ActionFormData().title("Tree of Oaths").body(lines.filter(Boolean).join("\n"));
  const actions = [];
  for (const [id, branch] of Object.entries(BRANCHES)) {
    const open = canBranch(id, hero.path);
    const spent = spentIn(hero.skills, id);
    form.button(`${open ? "" : "§8"}${branch.name}${open ? `\n§8${spent} point${spent === 1 ? "" : "s"} sworn` : `\n§8${branch.who === "knight" ? "Knights only" : "The Marked only"}`}`, branch.icon);
    actions.push(() => branchMenu(player, hallLevel, id));
  }
  if (hero.victorOffer && !hero.victor) {
    form.button("§5The Hollow's offer\n§8the Sorcerer's path, with a head start", "textures/items/siege_bound_ember");
    actions.push(() => victorMenu(player, hallLevel));
  }
  if (hero.path === "none") {
    form.button("§6Choose your path", "textures/items/siege_hollow_ember");
    actions.push(() => pathMenu(player, hallLevel));
  } else {
    const item = hero.path === "knight" ? OATH_BANNER : BOUND_EMBER;
    if (!has(player, item)) {
      form.button(hero.path === "knight" ? "Take a new Oath Banner" : "Call the Ember back to your hand");
      actions.push(() => give(player, item));
    }
  }
  if (spentIn(hero.skills) > 0) {
    form.button("Unbind your oaths\n§8refund every point", "textures/items/shears");
    actions.push(() => respec(player, hallLevel));
  }
  form.button("Recent deeds", "textures/items/book_normal");
  actions.push(() => new ActionFormData().title("Recent deeds").body(hero.log.length ? hero.log.join("\n") : "Nothing yet. Hold a siege, raise your hall, face something new.").button("Back").show(player).then((r) => { if (!r.canceled) treeMenu(player, hallLevel); }).catch(() => {}));
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function branchMenu(player, hallLevel, branchId) {
  const hero = heroOf(player);
  const branch = BRANCHES[branchId];
  const list = SKILLS.filter((s) => s.branch === branchId);
  const form = new ActionFormData().title(branch.name).body(`${branch.blurb}\n§bSkill points: ${hero.points}`);
  for (const s of list) {
    const have = hero.skills[s.id] ?? 0;
    const why = blockedReason(s, hero, hallLevel);
    const color = have >= s.max ? "§6" : !why ? "§2" : have > 0 ? "" : "§8";
    form.button(`${color}${ROMAN[s.ring]} · ${s.name} ${have}/${s.max}\n§8${why ?? `${s.cost} point${s.cost === 1 ? "" : "s"}`}`);
  }
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled) return;
    if (r.selection >= list.length) return treeMenu(player, hallLevel);
    skillMenu(player, hallLevel, list[r.selection]);
  }).catch(() => {});
}

function skillMenu(player, hallLevel, skill) {
  const hero = heroOf(player);
  const have = hero.skills[skill.id] ?? 0;
  const why = blockedReason(skill, hero, hallLevel);
  const ring = RINGS[skill.ring];
  const body = [
    `§l${skill.name}§r  ${have}/${skill.max}${skill.power ? "  §d(power)" : ""}`,
    "",
    ...skill.desc,
    ...(POWER_ORIGINS.lines[skill.id] ? ["", `§5§o${POWER_ORIGINS.lines[skill.id]}§r`] : []),
    "",
    `§7${ring.name}: ${HALL_NAMES[ring.hall]}, Renown ${ring.level}${skill.needs ? `, after ${SKILL[skill.needs].name}` : ""}`,
    `§7Cost: ${skill.cost} point${skill.cost === 1 ? "" : "s"} per rank. You have ${hero.points}.`,
    why && why !== "Mastered" ? `§c${why}` : why ? "§6Mastered" : "",
  ].join("\n");
  new MessageFormData().title(skill.name).body(body)
    .button1(why ? "Back" : have ? `Deepen the oath (rank ${have + 1})` : "Swear this oath")
    .button2(why ? "Close" : "Back")
    .show(player).then((r) => {
      if (r.canceled) return;
      if (why) return r.selection === 0 ? branchMenu(player, hallLevel, skill.branch) : undefined;
      if (r.selection !== 0) return branchMenu(player, hallLevel, skill.branch);
      learn(player, skill, hallLevel);
      branchMenu(player, hallLevel, skill.branch);
    }).catch(() => {});
}

export function learn(player, skill, hallLevel) {
  const hero = heroOf(player);
  if (blockedReason(skill, hero, hallLevel)) return false;
  const before = rankOf(hero.path, hero.skills)?.name;
  hero.points -= skill.cost;
  hero.skills[skill.id] = (hero.skills[skill.id] ?? 0) + 1;
  if (skill.power && hero.skills[skill.id] === 1 && !hero.skills[hero.spell]) hero.spell = skill.id;
  saveHero(player);
  player.playSound("random.levelup", { pitch: 1.3 });
  player.sendMessage(`§b${skill.name}§7 ${hero.skills[skill.id]}/${skill.max} sworn.`);
  if (skill.id === "arc_warden") {
    api.title(player, "§5The Last Art", "§7It is waiting for you to claim it");
    api.emit("hollowClaimReady", { player });
  }
  const after = rankOf(hero.path, hero.skills)?.name;
  if (after && after !== before) {
    api.title(player, `§6${after}`, hero.path === "knight" ? "§7The Order raises your rank" : "§7The Ember sinks deeper");
    world.sendMessage(`§6${player.name} is now ${/^[AEIOU]/.test(after) ? "an" : "a"} ${after}.`);
    api.emit("rankUp", { player, path: hero.path, rank: after });
  }
  return true;
}

function respec(player, hallLevel) {
  const hero = heroOf(player);
  const price = player.getGameMode() === GameMode.Creative ? 0 : hero.level >= 10 ? 10 : 20;
  const refund = spentIn(hero.skills);
  new MessageFormData().title("Unbind your oaths")
    .body(`Every skill is forgotten and all ${refund} points come back to spend again. Your path, rank progress and Renown stay.\n\nThe Tree asks ${worth(price)}.`)
    .button1("Unbind").button2("Back")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return treeMenu(player, hallLevel);
      if (price && !chargeE(player, price, "respec")) return player.sendMessage(`§cYou need ${worth(price)}.`);
      hero.points += refund;
      hero.skills = {};
      saveHero(player);
      for (const effect of ["health_boost", "strength", "haste", "speed", "village_hero", "fire_resistance"]) player.removeEffect(effect);
      player.sendMessage(`§7Your oaths are unbound. ${refund} points returned.`);
      treeMenu(player, hallLevel);
    }).catch(() => {});
}

// ---------- the two paths ----------

function pathMenu(player, hallLevel) {
  const hero = heroOf(player);
  const holding = has(player, EMBER);
  const body = [
    "Two roads lead from here, and you can only walk one. §cThe choice is permanent.",
    "",
    "§6The Oathsworn (Knight).§r Give the Ember up and swear the Squire's Oath to the Order of the Ashen Gate. Power from steel, shield, horse and command: techniques, more health, guards that fight harder beside you. Ranks: " + RANKS.knight.map((r) => r.name).join(", ") + ".",
    "",
    "§5The Marked.§r Take the Ember into your hand. It gives you powers no one living understands: bolts of pale fire, a step through the air, a call that turns armies on themselves. Every casting raises your Resonance, and loud Resonance is heard. Stages: " + RANKS.marked.map((r) => r.name).join(", ") + ".",
    "",
    holding ? "§7The Ember hums in your pack." : "§7You need the Ember to choose. It falls near your keep the night you first hold a siege.",
  ].join("\n");
  const form = new ActionFormData().title("Choose your path").body(body);
  const choices = [];
  if (holding || hero.offers.includes("knight")) {
    form.button(holding ? "§6Swear the Squire's Oath\n§8give up the Ember" : "§6Swear the Squire's Oath\n§8the Order has offered it");
    choices.push("knight");
  }
  if (holding) {
    form.button("§5Take the Ember\n§8become Marked");
    choices.push("marked");
  }
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled) return;
    const role = choices[r.selection];
    if (!role) return treeMenu(player, hallLevel);
    confirmPath(player, role, () => treeMenu(player, hallLevel));
  }).catch(() => {});
}

export function confirmPath(player, path, back) {
  new MessageFormData().title(path === "knight" ? "The Squire's Oath" : "The Ember")
    .body(path === "knight"
      ? "\"I will hold the gate. I will keep the silence. I will not ask what lies beneath.\"\n\nIf you carry the Ember, it is taken from you and sealed. You become a Squire of the Ashen Gate. §cThis cannot be undone."
      : "It is not warm. It is not cold. It fits the hollow of your palm as if it had been cut from it.\n\nThe Ember fuses to your hand and you become Marked. §cThis cannot be undone.")
    .button1(path === "knight" ? "I swear it" : "Close your hand").button2("Not yet")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return back?.();
      choosePath(player, path);
    }).catch(() => {});
}

export function choosePath(player, path) {
  const hero = heroOf(player);
  if (path !== "none" && (hero.path !== "none" || !ROLES[path])) return false;
  api.takeItems(player, EMBER, api.countItem(player, EMBER));
  hero.ember = path === "marked" ? "taken" : path === "knight" ? "refused" : "none";
  setPath(player, path);
  setTreeLook(player.id);
  if (path === "knight") {
    give(player, OATH_BANNER);
    api.title(player, "§6Oathsworn", "§7Squire of the Ashen Gate");
    player.playSound("random.anvil_use");
    player.sendMessage("§6You are a Squire of the Ashen Gate.§7 The Blade branch of the Tree is open to you. Your §fOath Banner§7 is in your pack: once you learn Rallying Cry, use it to rally, sneak and use it to plant it.");
  } else if (path === "marked") {
    give(player, BOUND_EMBER);
    api.title(player, "§5Marked", "§7Something heard you");
    player.playSound("mob.wither.spawn", { volume: 0.4, pitch: 1.6 });
    player.addEffect("darkness", 80, { showParticles: false });
    player.sendMessage("§5The Ember is part of you now.§7 The Arcana branch of the Tree is open. Hold the §fBound Ember§7: use it to cast your chosen power, sneak and use it to choose another. Watch your Resonance.");
  }
  hero.offers = [];
  saveHero(player);
  api.emit("pathChosen", { player, path });
  if (path !== "none") api.emit("roleChosen", { player, role: path });
  if (path !== "none") world.sendMessage(path === "knight" ? `§6${player.name} has sworn the Squire's Oath.` : `§5${player.name} has been Marked.`);
  return true;
}

// ---------- the victor's offer ----------
// Whoever defeats the Hollow cannot wear its crown, but is offered the Sorcerer's path with a head start:
// 15 skill points, Arcana rings without the Renown climb, and powers that cost a quarter less Resonance.
export const VICTOR_POINTS = 15;

export function offerVictor(player) {
  const hero = heroOf(player);
  if (hero.victor) return;
  if (hero.path === "marked") return acceptVictor(player); // already on the path: the head start is simply theirs
  hero.victorOffer = true;
  saveHero(player);
  api.title(player, "§5The Hollow knows you", "§7It offers what it would not give its crown");
  player.sendMessage("§5You broke the Hollow, and it cannot crown you.§7 But it will teach you. Go to the Tree of Oaths and hear its offer: the Sorcerer's path, with a head start no one else gets.");
  api.emit("roleOffered", { player, role: "marked", victor: true });
}

function victorMenu(player, hallLevel) {
  const hero = heroOf(player);
  const knight = hero.path === "knight";
  new MessageFormData().title("The Hollow's offer")
    .body([
      "The crown would kill you. The Hollow does not answer to the one who broke it. It answers to the one who can hear it.",
      "",
      `Take the Sorcerer's path and you begin ahead: ${VICTOR_POINTS} skill points, every ring of Arcana open without the Renown climb (your hall must still be grand enough), and powers that cost a quarter less Resonance.`,
      knight ? "\n§cYou would lay down your Knight's oath. Every point sworn to the Blade comes back to you, and your rank in the Order is gone. This cannot be undone." : "\n§cThis cannot be undone.",
    ].join("\n"))
    .button1("Accept").button2("Not yet")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return treeMenu(player, hallLevel);
      acceptVictor(player);
    }).catch(() => {});
}

export function acceptVictor(player) {
  const hero = heroOf(player);
  if (hero.victor) return false;
  if (hero.path === "knight") {
    for (const id of Object.keys(hero.skills)) {
      if (SKILL[id]?.branch !== "blade") continue;
      hero.points += SKILL[id].cost * hero.skills[id];
      delete hero.skills[id];
    }
    for (const effect of ["health_boost", "strength"]) player.removeEffect(effect);
    api.takeItems(player, OATH_BANNER, api.countItem(player, OATH_BANNER));
    hero.path = "none";
  }
  hero.victor = true;
  hero.victorOffer = false;
  saveHero(player);
  if (hero.path === "none") choosePath(player, "marked");
  grantPoints(player, VICTOR_POINTS, "the Hollow's teaching");
  return true;
}

// Used by the Tree block and by the Keep Banner button
export function openTree(player, block) {
  const level = hallLevelAt(block.location, block.dimension.id);
  if (level < 1) return player.sendMessage("§7The Tree is quiet. It only wakes inside a settlement whose town hall stands on its cornerstone.");
  treeMenu(player, level);
}
