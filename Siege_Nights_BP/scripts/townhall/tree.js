// The Tree of Oaths: the skill tree menu, path choice, and unbinding.

import { world, GameMode, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { SKILLS, SKILL, BRANCHES, RINGS, RANKS, ROLES, HALL_NAMES, LEVEL_UNLOCKS, canBranch, blockedReason, spentIn, rankOf, levelFromRenown, levelTitle, POWER_ORIGINS, ROLE_LORE } from "./skills.js";
import { STYLES } from "./styles.js";
import { treeCells, TREE_FLAG, BRANCH_FLAG, SPACER } from "./tree_layout.js";
import { heroOf, saveHero, setPath, grantPoints } from "./hero.js";
import { hallLevelAt, setTreeLook } from "./townhall.js";
import { chargeE } from "../economy/coins.js";
import { worth } from "../economy/rules.js";
import { sfx } from "../core/sfx.js";
import { applyFilter } from "../core/events.js";
import { ROLE_DEEDS } from "./roles.js";

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
  const pathLine = hero.path === "knight" ? `§6Oathsworn§r, ${rank.name}` : hero.path === "marked" ? `§5Marked§r, ${rank.name}` : ROLES[hero.path] ? `${ROLES[hero.path].color ?? "§6"}${ROLES[hero.path].name}§r, ${rank.name}` : "§7No path yet";
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
    if (branch.regional && !open) continue;
    const spent = spentIn(hero.skills, id);
    form.button(`${open ? "" : "§8"}${branch.name}${open ? `\n§8${spent} point${spent === 1 ? "" : "s"} sworn` : `\n§8${ROLES[branch.who]?.noun ?? "Others"} only`}`, branch.icon);
    actions.push(() => branchMenu(player, hallLevel, id));
  }
  form.button(hero.plainTree ? "Show branches as a tree\n§8now: plain lists" : "Show branches as plain lists\n§8now: the tree screen", "textures/items/painting");
  actions.push(() => { hero.plainTree = !hero.plainTree; saveHero(player); treeMenu(player, hallLevel); });
  if (hero.victorOffer && !hero.victor) {
    form.button("§5The Hollow's offer\n§8the Sorcerer's path, with a head start", "textures/items/siege_bound_ember");
    actions.push(() => victorMenu(player, hallLevel));
  }
  if (hero.path === "none") {
    form.button("§6Choose your path", "textures/items/siege_hollow_ember");
    actions.push(() => pathMenu(player, hallLevel));
  } else if (hero.path === "knight" || hero.path === "marked") {
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
  // Other features add pages here (the role trials add "Your trial"): addFilter("treeButtons", (list, { player }) => [...list, { label, icon?, open(player, back) }])
  for (const extra of applyFilter("treeButtons", [], { player }) ?? []) {
    form.button(extra.label, extra.icon);
    actions.push(() => extra.open(player, () => treeMenu(player, hallLevel)));
  }
  form.button("Recent deeds", "textures/items/book_normal");
  actions.push(() => new ActionFormData().title("Recent deeds").body(hero.log.length ? hero.log.join("\n") : "Nothing yet. Hold a siege, raise your hall, face something new.").button("Back").show(player).then((r) => { if (!r.canceled) treeMenu(player, hallLevel); }).catch(() => {}));
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

// The graphical tree: the same choices as the list, laid out on a grid that the resource pack draws as a tree
// (ui/server_form.json looks for TREE_FLAG in the title). Players can switch back to plain lists.
const NODE = "textures/ui/hc/node_";
// One painted 16x16 icon per skill, by id (textures thread, studio/art/build_skill_icons.py)
export const skillIcon = (skill) => `textures/ui/hc/skill/${skill.id}`;

function branchGrid(player, hallLevel, branchId) {
  const hero = heroOf(player);
  const branch = BRANCHES[branchId];
  const cells = treeCells(branchId);
  const last = cells.reduce((n, c, i) => (c ? i : n), 0);
  const form = new ActionFormData().title(`${TREE_FLAG}${BRANCH_FLAG[branchId]}§r${branch.name}`).body(`§bSkill points: ${hero.points}§r   ${branch.blurb}`);
  for (let i = 0; i <= last; i++) {
    const c = cells[i];
    if (!c) form.button(SPACER);
    else if (c === "back") form.button("Back", "textures/ui/hc/slot");
    else {
      const have = hero.skills[c.id] ?? 0, why = blockedReason(c, hero, hallLevel);
      const unknown = !have && POWER_ORIGINS.gated[c.id] && !hero.origins?.[c.id];
      // a skill you hold or can swear now shows its own painted icon; the rest keep the state frame
      const shown = have || (!why && !unknown);
      form.button(`${have >= c.max ? "§6" : ""}${c.name}`, shown ? skillIcon(c) : NODE + (unknown ? "unknown" : "locked"));
    }
  }
  form.show(player).then((r) => {
    if (r.canceled) return;
    const c = cells[r.selection];
    if (c === "back") return treeMenu(player, hallLevel);
    if (!c) return branchGrid(player, hallLevel, branchId);
    skillMenu(player, hallLevel, c);
  }).catch(() => {});
}

function branchMenu(player, hallLevel, branchId) {
  const hero = heroOf(player);
  if (!hero.plainTree && BRANCH_FLAG[branchId]) return branchGrid(player, hallLevel, branchId);
  const branch = BRANCHES[branchId];
  const list = SKILLS.filter((s) => s.branch === branchId);
  const form = new ActionFormData().title(branch.name).body(`${branch.blurb}\n§bSkill points: ${hero.points}`);
  for (const s of list) {
    const have = hero.skills[s.id] ?? 0;
    const why = blockedReason(s, hero, hallLevel);
    const color = have >= s.max ? "§6" : !why ? "§2" : have > 0 ? "" : "§8";
    form.button(`${color}${ROMAN[s.ring]} · ${s.name} ${have}/${s.max}\n§8${why ?? `${s.cost} point${s.cost === 1 ? "" : "s"}`}`, skillIcon(s));
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
  sfx(player, "random.levelup", { pitch: 1.3 });
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
    "",
    "§fOther roads, earned later in the regions.§7 Choosing the Ember's road closes these, because a person holds one role. There is no hurry: keep the Ember and come back to the Tree whenever you like.",
    ...Object.keys(ROLES).filter((id) => ROLES[id].region).map((id) => `${ROLES[id].color}${ROLES[id].name}§7: ${ROLE_DEEDS[id]?.deed ?? "a deed in " + STYLES[ROLES[id].region].name}.`),
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
  for (const role of hero.offers) {
    if (role === "knight" || !ROLES[role]?.region) continue;
    form.button(`${ROLES[role].color}Become a ${ROLES[role].name}\n§8offered to you in ${STYLES[ROLES[role].region].name}`);
    choices.push(role);
  }
  form.button("Back");
  form.show(player).then((r) => {
    if (r.canceled) return;
    const role = choices[r.selection];
    if (!role) return treeMenu(player, hallLevel);
    confirmPath(player, role, () => treeMenu(player, hallLevel));
  }).catch(() => {});
}

function roleHistory(path) {
  const lore = ROLE_LORE[path];
  if (!lore) return "";
  return (lore.saying ? `\n§7§o${lore.saying}§r` : "") + (lore.before ? `\n\n§8${lore.before}` : "") + (lore.why ? `\n§8${lore.why}` : "") + "§r";
}

export function confirmPath(player, path, back) {
  if (ROLES[path]?.region) {
    return void new MessageFormData().title(ROLES[path].name)
      .body(`${ROLES[path].oath}${roleHistory(path)}\n\nYou become a ${ROLES[path].name} and the ${BRANCHES[ROLES[path].branch].name} branch of the Tree opens to you. You can hold only one role. §cThis cannot be undone.`)
      .button1("I will").button2("Not yet")
      .show(player).then((r) => {
        if (r.canceled || r.selection !== 0) return back?.();
        choosePath(player, path);
      }).catch(() => {});
  }
  new MessageFormData().title(path === "knight" ? "The Squire's Oath" : "The Ember")
    .body(path === "knight"
      ? "\"I will hold the gate. I will keep the silence. I will not ask what lies beneath.\"\n\nIf you carry the Ember, it is taken from you and sealed. You become a Squire of the Ashen Gate, and the regional roles close to you. §cThis cannot be undone."
      : "It is not warm. It is not cold. It fits the hollow of your palm as if it had been cut from it.\n\nThe Ember fuses to your hand and you become Marked, and the regional roles close to you. §cThis cannot be undone.")
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
    sfx(player, "random.anvil_use");
    player.sendMessage("§6You are a Squire of the Ashen Gate.§7 The Blade branch of the Tree is open to you. Your §fOath Banner§7 is in your pack: once you learn Rallying Cry, use it to rally, sneak and use it to plant it.");
  } else if (path === "marked") {
    give(player, BOUND_EMBER);
    api.title(player, "§5Marked", "§7Something heard you");
    sfx(player, "mob.wither.spawn", { volume: 0.4, pitch: 1.6 });
    player.addEffect("darkness", 80, { showParticles: false });
    player.sendMessage("§5The Ember is part of you now.§7 The Arcana branch of the Tree is open. Hold the §fBound Ember§7: use it to cast your chosen power, sneak and use it to choose another. Watch your Resonance.");
  }
  if (ROLES[path]?.region) {
    api.title(player, `${ROLES[path].color}${ROLES[path].name}`, `§7${RANKS[path][0].name}`);
    sfx(player, "random.levelup");
    player.sendMessage(`${ROLES[path].color}You are a ${ROLES[path].name} now.§7 The ${BRANCHES[ROLES[path].branch].name} branch of the Tree of Oaths is open to you.`);
  }
  hero.offers = [];
  saveHero(player);
  api.emit("pathChosen", { player, path });
  if (path !== "none") api.emit("roleChosen", { player, role: path });
  if (path !== "none") world.sendMessage(path === "knight" ? `§6${player.name} has sworn the Squire's Oath.` : path === "marked" ? `§5${player.name} has been Marked.` : `${ROLES[path].color}${player.name} has become a ${ROLES[path].name}.`);
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
