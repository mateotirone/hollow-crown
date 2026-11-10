// Horses: the Stables menu, the horse sheet, training, perks, breeding, revival, the rites and stalls.

import { world, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { countItem, takeItems } from "../siege/api.js";
import { funds, charge } from "../economy/coins.js";
import {
  HORSE_SETTINGS as S, STATS, STAT_NAMES, SPEED_BPS, JUMP_BLOCKS, HEALTH_VALUES, gallopTicks, MAX_TRAINED, TRAIN_COST,
  TRAITS, PERKS, SHOES, SADDLES, SPECIALS, STABLES_LEVELS, rosterCap, trainCap, xpToNext, effectiveStats, bonusesOf,
  breedFoal, newRecord, costText, CAPARISON, BREEDS, randomName,
} from "./data.js";
import { horsesOf, saveRecord, deleteRecord, newUid, meta, stablesLevelFor } from "./store.js";
import { entityOf, spawnSteed, stallSteed, refresh } from "./steed.js";
import { sfx } from "../core/sfx.js";

export const isBuilder = (player) => player.getGameMode() === GameMode.Creative;

export const canPay = (player, cost) => isBuilder(player) || cost.every((c) => (c.item === "coins" ? funds(player) : countItem(player, c.item)) >= c.count);
export function pay(player, cost) {
  if (!canPay(player, cost)) return false;
  for (const c of cost) c.item === "coins" ? charge(player, c.count, "horses") : takeItems(player, c.item, c.count);
  return true;
}

export function give(player, typeId, amount = 1) {
  const leftover = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(typeId, amount));
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}

const STATUS = { out: "§aout riding", stabled: "§7in the stalls", fallen: "§cfallen" };
const pathOf = (player) => {
  try {
    const raw = player.getDynamicProperty("siege:townhall_hero");
    const path = typeof raw === "string" ? JSON.parse(raw).path : undefined;
    if (path && path !== "none") return path;
  } catch {
    // no town hall data yet
  }
  return player.hasTag("siege_path_knight") ? "knight" : player.hasTag("siege_path_marked") ? "marked" : "none";
};

const statLine = (rec, stat, eff, bonus) => {
  const meaning = stat === "speed" ? `${SPEED_BPS[eff[stat] - 1]} blocks/s`
    : stat === "jump" ? `${JUMP_BLOCKS[eff[stat] - 1]} blocks`
      : stat === "health" ? `${HEALTH_VALUES[eff[stat] - 1] / 2} hearts`
        : `${gallopTicks(eff[stat]) / 20}s gallop`;
  return `§f${STAT_NAMES[stat]} §e${rec.stats[stat]}§7/5${bonus[stat] ? ` §a+${bonus[stat]}` : ""} §8(${meaning})`;
};

export function sheetText(rec) {
  const eff = effectiveStats(rec);
  const bonus = bonusesOf(rec);
  const special = SPECIALS[rec.special]?.name;
  const lines = [
    `§6${rec.name}§7, ${special ? `§d${special}§7, ` : ""}${rec.breedName}${rec.foal ? " §e(foal)" : ""}`,
    `§7Level §f${rec.level}§7${rec.level < S.maxLevel ? ` (${rec.xp}/${xpToNext(rec.level)} XP)` : " (max)"} · ${STATUS[rec.status]}`,
    `§7Training points §f${rec.tp}§7 · Perk points §f${rec.pp}`,
    "",
    ...STATS.map((s) => statLine(rec, s, eff, bonus)),
    "",
    `§7Traits: §f${rec.traits.map((t) => TRAITS[t].name).join(", ") || "none"}`,
    `§7Perks: §f${rec.perks.map((p) => PERKS[p].name).join(", ") || "none"}`,
    `§7Shoes: §f${SHOES[rec.shoes].name}§7 · Saddle kit: §f${SADDLES[rec.saddle].name}§7${rec.caparison ? " · Caparison" : ""}`,
  ];
  if (rec.sire) lines.push(`§7Sire §f${rec.sire}§7, dam §f${rec.dam}`);
  return lines.join("\n");
}

// A menu from a list of { label, action } (falsy entries are skipped). "Back"/"Close" is added last.
async function menu(player, titleText, body, entries, back) {
  const list = entries.filter(Boolean);
  const form = new ActionFormData().title(titleText).body(body);
  for (const e of list) form.button(e.label);
  form.button(back ? "Back" : "Close");
  const res = await form.show(player);
  if (res.canceled) return;
  const chosen = list[res.selection];
  if (chosen) await chosen.action();
  else if (back) await back();
}

async function confirm(player, titleText, body, yes = "Yes") {
  const res = await new MessageFormData().title(titleText).body(body).button1("Cancel").button2(yes).show(player);
  return !res.canceled && res.selection === 1;
}

// ---------- Where a menu is being used ----------
// ctx = { level, trainCap, at: { dimension, location }, label, back }.
// A Stables gives its level; a rail station gives stalls only (level 0).

function bringOut(player, rec, ctx) {
  if (entityOf(rec)) return player.sendMessage(`§7${rec.name} is already out.`);
  spawnSteed(rec, ctx.at.dimension, ctx.at.location);
  player.sendMessage(`§6${rec.name} is led out, rested and ready.`);
  sfx(player, "mob.horse.idle");
}

function putAway(player, rec, ctx) {
  const entity = entityOf(rec);
  if (entity) {
    const far = entity.dimension.id !== ctx.at.dimension.id
      || Math.hypot(entity.location.x - ctx.at.location.x, entity.location.z - ctx.at.location.z) > 24;
    if (far) return player.sendMessage(`§7Bring ${rec.name} within 24 blocks to stable it, or send a groom to fetch it.`);
    stallSteed(rec, entity);
    return player.sendMessage(`§6${rec.name} is in the stalls.`);
  }
  player.sendMessage(`§7${rec.name} isn't nearby. Send a groom to fetch it.`);
}

function fetch(player, rec) {
  const cost = [{ item: "coins", count: 32 }];
  if (!pay(player, cost)) return player.sendMessage(`§cA groom wants ${costText(cost)} to fetch ${rec.name}.`);
  stallSteed(rec, entityOf(rec));
  player.sendMessage(`§6A groom rides out and brings ${rec.name} back to the stalls.`);
}

// ---------- The horse menu ----------

export async function horseMenu(player, rec, ctx) {
  const again = () => horseMenu(player, rec, ctx);
  const mine = rec.owner === player.id;
  const cap = ctx?.trainCap ?? 0;
  const entries = [];
  if (mine && ctx && rec.status !== "fallen" && !rec.foal) {
    for (const stat of STATS) {
      const next = rec.stats[stat] + 1;
      if (next > MAX_TRAINED) continue;
      if (cap === 0) continue;
      const label = next > cap ? `§8Train ${STAT_NAMES[stat]} to ${next}\nneeds a better Stables`
        : `Train ${STAT_NAMES[stat]} to ${next}\n§81 point + ${costText(TRAIN_COST[next])}`;
      entries.push({ label, action: () => train(player, rec, stat, cap).then(again) });
    }
    if (rec.pp > 0 && cap > 0) entries.push({ label: `§5Choose a perk (${rec.pp})`, action: () => perkMenu(player, rec, again) });
  }
  if (mine && ctx) {
    if (rec.status === "stabled") entries.push({ label: "Bring out of the stalls", action: () => bringOut(player, rec, ctx) });
    if (rec.status === "out") {
      entries.push({ label: "Put in the stalls", action: () => putAway(player, rec, ctx) });
      entries.push({ label: "Send a groom to fetch it\n§832 Regals", action: () => fetch(player, rec) });
    }
    if (rec.status === "fallen") {
      entries.push({
        label: ctx.level >= 2 ? `§dRevive\n§8${costText(S.reviveCost)}` : "§8Revive\nneeds a level 2 Stables",
        action: () => revive(player, rec, ctx),
      });
    }
    if (ctx.level >= 3 && rec.special === "none" && rec.status !== "fallen") {
      const key = pathOf(player) === "knight" ? "warhorse" : pathOf(player) === "marked" ? "hollow" : undefined;
      if (key) entries.push({ label: `§dRite: ${SPECIALS[key].name}`, action: () => rite(player, rec, key, again) });
    }
  }
  if (mine) {
    entries.push({ label: "Rename", action: () => rename(player, rec).then(again) });
    if (rec.caparison) entries.push({ label: "Take off the Caparison", action: () => { rec.caparison = 0; refresh(rec); give(player, CAPARISON); } });
    entries.push({ label: "§cRelease this horse", action: () => release(player, rec) });
  }
  await menu(player, rec.name, sheetText(rec), entries, ctx?.back);
}

async function train(player, rec, stat, cap) {
  const next = rec.stats[stat] + 1;
  if (next > cap) return player.sendMessage(`§7Your Stables can only train to ${cap}. Upgrade it to go further.`);
  if (rec.tp < 1) return player.sendMessage(`§7${rec.name} has no training points. Ride to earn levels.`);
  if (!pay(player, TRAIN_COST[next])) return player.sendMessage(`§cTraining ${STAT_NAMES[stat]} to ${next} needs ${costText(TRAIN_COST[next])}.`);
  rec.tp--;
  rec.stats[stat] = next;
  refresh(rec);
  sfx(player, "random.levelup");
  player.sendMessage(`§6${rec.name}'s ${STAT_NAMES[stat]} is now ${next}.`);
}

async function perkMenu(player, rec, back) {
  const entries = Object.entries(PERKS).filter(([id]) => !rec.perks.includes(id)).map(([id, perk]) => ({
    label: `${perk.name}\n§8${perk.desc.slice(0, 44)}`,
    action: async () => {
      if (!(await confirm(player, perk.name, `${perk.desc}\n\nTeach ${rec.name} this perk? It can't be changed later.`, "Teach"))) return back();
      if (rec.pp < 1) return;
      rec.pp--;
      rec.perks.push(id);
      refresh(rec);
      sfx(player, "random.levelup");
      player.sendMessage(`§5${rec.name} learned ${perk.name}.`);
      return back();
    },
  }));
  await menu(player, `Perks for ${rec.name}`, `§7Perk points: §f${rec.pp}§7. A horse learns 4 perks in its life.`, entries, back);
}

async function rename(player, rec) {
  const res = await new ModalFormData().title(`Rename ${rec.name}`).textField("New name", rec.name).show(player);
  const name = String(res.formValues?.[0] ?? "").trim().slice(0, 24);
  if (res.canceled || !name) return;
  rec.name = name;
  refresh(rec);
}

function revive(player, rec, ctx) {
  if (ctx.level < 2) return player.sendMessage("§7Reviving a fallen horse needs a level 2 Stables.");
  if (!pay(player, S.reviveCost)) return player.sendMessage(`§cReviving ${rec.name} needs ${costText(S.reviveCost)}.`);
  rec.status = "stabled";
  saveRecord(rec);
  bringOut(player, rec, ctx);
  player.sendMessage(`§d${rec.name} breathes again.`);
}

async function rite(player, rec, key, back) {
  const special = SPECIALS[key];
  const needs = special.needs;
  const missing = [];
  if (rec.level < needs.level) missing.push(`horse level ${needs.level}`);
  for (const stat of STATS) if (needs[stat] && rec.stats[stat] < needs[stat]) missing.push(`${STAT_NAMES[stat]} trained to ${needs[stat]}`);
  if (horsesOf(player.id).some((r) => r.special !== "none")) missing.push("no other Warhorse or Glimstrider (one per rider)");
  const body = `${special.desc}\n\n§7Cost: §f${costText(special.cost)}${missing.length ? `\n\n§cStill needed: ${missing.join(", ")}` : ""}`;
  if (missing.length) return menu(player, special.name, body, [], back);
  if (!(await confirm(player, special.name, `${body}\n\nPerform the rite on ${rec.name}? This is forever.`, "Perform the rite"))) return back();
  if (!pay(player, special.cost)) return player.sendMessage(`§cThe rite needs ${costText(special.cost)}.`);
  rec.special = key;
  refresh(rec);
  world.sendMessage(`§d${player.name}'s ${rec.name} has become a ${special.name}.`);
  sfx(player, "random.totem");
}

async function release(player, rec) {
  if (!(await confirm(player, `Release ${rec.name}?`, `${rec.name} leaves your roster for good. Its horseshoes and saddle kit come back to you.`, "Release"))) return;
  const entity = entityOf(rec);
  if (SHOES[rec.shoes].item) give(player, SHOES[rec.shoes].item);
  if (SADDLES[rec.saddle].item) give(player, SADDLES[rec.saddle].item);
  if (rec.caparison) give(player, CAPARISON);
  if (!entity && rec.gearSaddle) give(player, "minecraft:saddle");
  if (!entity && rec.gearArmor) give(player, rec.gearArmor);
  if (entity) entity.setDynamicProperty("siege:horses_uid", undefined); // it stays in the world as a free horse
  deleteRecord(rec.uid);
  player.sendMessage(`§7${rec.name} is released.`);
}

// ---------- Roster, stalls and the Stables ----------

const rosterLabel = (rec) => `${rec.name} §8Lv ${rec.level}\n${STATUS[rec.status]}§8 · ${rec.breedName.slice(0, 28)}`;

// Stalls only (rail stations and depots): put a horse away or bring one out
export async function stallMenu(player, at, label, back) {
  const ctx = { level: 0, trainCap: 0, at, label, back: () => stallMenu(player, at, label, back) };
  const mine = horsesOf(player.id);
  const body = mine.length ? `§7Stalls at ${label}. Any stabled horse can be collected at any station or at your Stables.`
    : "§7You have no horses yet. Use a Halter on a tamed horse, or buy a foal at a Breeder's Post.";
  await menu(player, "Stalls", body, mine.map((rec) => ({ label: rosterLabel(rec), action: () => horseMenu(player, rec, ctx) })), back);
}

export async function stablesMenu(player, owner, at, ownerName) {
  const level = meta.data.stables[owner] ?? 1;
  const again = () => stablesMenu(player, owner, at, ownerName);
  const ctx = { level, trainCap: trainCap(level), at, label: "the Stables", back: again };
  const mine = horsesOf(player.id);
  const info = STABLES_LEVELS[level];
  const next = STABLES_LEVELS[level + 1];
  const body = [
    `§6${ownerName}'s Stables §7· level §f${level}`,
    `§7Your horses: §f${mine.length}§7/${rosterCap(Math.max(level, stablesLevelFor(player.id)))} · trains stats up to §f${info.trainCap}`,
    next ? `§7Level ${next.level}: ${next.unlocks} (${costText(next.cost)})` : "§7Fully upgraded.",
  ].join("\n");
  const entries = mine.map((rec) => ({ label: rosterLabel(rec), action: () => horseMenu(player, rec, ctx) }));
  entries.push({ label: `Breed two horses\n§8${costText(S.breedCost)}`, action: () => breedMenu(player, ctx) });
  if (next && player.id === owner) {
    entries.push({
      label: `§6Upgrade to level ${next.level}`,
      action: async () => {
        if (!pay(player, next.cost)) return player.sendMessage(`§cThe upgrade needs ${costText(next.cost)}.`);
        meta.data.stables[owner] = next.level;
        meta.save();
        sfx(player, "random.anvil_use");
        player.sendMessage(`§6Your Stables is now level ${next.level}: ${next.unlocks}.`);
        return again();
      },
    });
  }
  await menu(player, "Stables", body, entries);
}

async function breedMenu(player, ctx) {
  const now = world.getAbsoluteTime();
  const ready = horsesOf(player.id).filter((r) => !r.foal && r.status !== "fallen" && now - r.lastBred >= S.breedCooldownTicks);
  if (ready.length < 2) {
    return menu(player, "Breeding", "§7You need two grown horses that haven't bred today.", [], ctx.back);
  }
  if (horsesOf(player.id).length >= rosterCap(Math.max(ctx.level, stablesLevelFor(player.id)))) {
    return menu(player, "Breeding", "§7Your stalls are full. Upgrade the Stables or release a horse first.", [], ctx.back);
  }
  const pickOne = (list, prompt, then) => menu(player, "Breeding", prompt,
    list.map((rec) => ({ label: rosterLabel(rec), action: () => then(rec) })), ctx.back);
  await pickOne(ready, "§7Choose the sire.", (sire) => pickOne(ready.filter((r) => r !== sire), `§7Sire: §f${sire.name}§7. Choose the dam.`, (dam) => {
    if (!pay(player, S.breedCost)) return player.sendMessage(`§cBreeding needs ${costText(S.breedCost)}.`);
    const foal = makeFoal(player, sire, dam);
    sire.lastBred = dam.lastBred = now;
    saveRecord(sire);
    saveRecord(dam);
    spawnSteed(foal, ctx.at.dimension, ctx.at.location);
    sfx(player, "random.levelup");
    player.sendMessage(`§6A foal is born: §f${foal.name}§6, ${foal.breedName}. Traits: ${foal.traits.map((t) => TRAITS[t].name).join(", ") || "none"}. It grows up in a day.`);
  }));
}

export function makeFoal(player, sire, dam) {
  const born = breedFoal(sire, dam);
  const rec = newRecord({ uid: newUid(), owner: player.id, ownerName: player.name, stats: born.stats });
  Object.assign(rec, born, { foal: true, grownAt: world.getAbsoluteTime() + S.foalGrowTicks });
  return rec;
}

// A regional foal from a Breeder's Post
export function buyFoal(player, breed, at) {
  const rec = newRecord({ uid: newUid(), owner: player.id, ownerName: player.name, breed, name: randomName() });
  rec.foal = true;
  rec.grownAt = world.getAbsoluteTime() + S.foalGrowTicks;
  spawnSteed(rec, at.dimension, at.location);
  sfx(player, "random.levelup");
  player.sendMessage(`§6You bought §f${rec.name}§6, a ${BREEDS[breed].name} foal. ${TRAITS[BREEDS[breed].trait].name}: ${TRAITS[BREEDS[breed].trait].desc}`);
  return rec;
}
