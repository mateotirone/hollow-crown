// Job NPCs: the Farmer, Woodcutter, Quarryman, Smith, Fisher, Hunter, Herbalist and the Moneyer.
//
// Each is our own siege:job_npc entity (villager shape, one painted skin per job, picked by the siege:job
// property), so it works on a Realm and alone and never shares a look with a lore NPC. Job NPCs placed before
// the skins existed were Bedrock's built-in NPC: those still trade, and turn into the new kind on the first click.
// They buy the raw goods of their trade for coins and sell the finished ones. Goods and prices: config.js. Price rules: rules.js.
//   Map builders: /scriptevent siege:economy_npc farmer      puts one where you stand
//   The region (for regional prices) is taken from the nearest Plot Stone, or name it:
//                 /scriptevent siege:economy_npc farmer Frostmarch

import { world, system, GameMode, ItemStack, ItemTypes, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, isNight, countItem, takeItems, pick, emit } from "../siege/api.js";
import { allPlots } from "../plots/claims.js"; // same function plots/api.js re-exports; claims.js exists in every snapshot of the repo
import { ECON, JOBS, JOB_IDS, LINES, REGIONS, EXCHANGE } from "./config.js";
import { regional, appetite, payout, cost, coins, niceName, stopAt } from "./rules.js";
import { funds, charge, pay } from "./coins.js";
import { sfx } from "../core/sfx.js";
import { onTick } from "../core/loop.js";
import { guildMenu } from "../guild/index.js";
import { reforgeTarget, reforgePrice, armourName } from "./regional_armor.js";

export const JOB_TAG = "siege_job";
const jobTag = (id) => `siege_job_${id}`;
const regionTag = (region) => `siege_region_${REGIONS.indexOf(region)}`;
const NPC_TYPE = "siege:job_npc";
const OLD_NPC_TYPE = "minecraft:npc"; // job NPCs placed before the painted skins
const JOB_PROP = "siege:job"; // which skin: the job's place in JOB_IDS
const SOLD = "siege:economy_sold"; // per player: { day, n: { "<region>|<item>": units sold today } }

const known = (id) => {
  try {
    return !!ItemTypes.get(id);
  } catch {
    return false;
  }
};

// On sale here: the item exists in this pack, and a region-only good is sold only by that region's NPCs
const forSale = (good, region) => known(good.id) && (!good.region || good.region === region);

// The region a spot belongs to: that of the nearest Plot Stone (undefined on a world with no map)
export function regionAt(location) {
  let best, bestD = Infinity;
  try {
    for (const plot of allPlots()) {
      const d = (plot.x - location.x) ** 2 + (plot.z - location.z) ** 2;
      if (d < bestD && REGIONS.includes(plot.region)) [best, bestD] = [plot.region, d];
    }
  } catch {
    // no map yet
  }
  return best;
}

const jobOf = (npc) => JOB_IDS.find((id) => npc.hasTag(jobTag(id)));
const regionOf = (npc) => REGIONS.find((r) => npc.hasTag(regionTag(r))) ?? regionAt(npc.location);

export function spawnJobNpc(dim, location, jobId, region = regionAt(location)) {
  const job = JOBS[jobId];
  if (!job) return undefined;
  const npc = dim.spawnEntity(NPC_TYPE, location);
  npc.addTag(JOB_TAG);
  npc.addTag(jobTag(jobId));
  if (region && REGIONS.includes(region)) npc.addTag(regionTag(region));
  npc.nameTag = job.name;
  try {
    npc.setProperty(JOB_PROP, JOB_IDS.indexOf(jobId));
  } catch {
    // looks are optional
  }
  return npc;
}

// A job NPC from before the painted skins: put the new kind in its place, same job, same region, same spot
function renew(old) {
  const jobId = jobOf(old);
  if (!jobId) return old;
  try {
    const npc = spawnJobNpc(old.dimension, old.location, jobId, REGIONS.find((r) => old.hasTag(regionTag(r))) ?? null);
    if (!npc) return old;
    for (const tag of old.getTags()) if (!npc.hasTag(tag)) npc.addTag(tag);
    try {
      npc.setRotation(old.getRotation());
    } catch {
      // facing is optional
    }
    old.remove();
    return npc;
  } catch (e) {
    console.warn(`[Hollow Crown] job NPC renew: ${e}`);
    return old;
  }
}

// ---------- today's sales ----------

function soldToday(player) {
  let rec;
  try {
    rec = JSON.parse(player.getDynamicProperty(SOLD) ?? "null");
  } catch {
    rec = undefined;
  }
  const day = world.getDay();
  return rec?.day === day ? rec : { day, n: {} };
}
const soldKey = (region, id) => `${region ?? "-"}|${id}`;

function hand(player, typeId, count) {
  const inv = player.getComponent("minecraft:inventory").container;
  const max = new ItemStack(typeId, 1).maxAmount;
  while (count > 0) {
    const n = Math.min(max, count);
    count -= n;
    const left = inv.addItem(new ItemStack(typeId, n));
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

// ---------- selling to the NPC ----------

// Sells `count` of a good. Returns the coins paid (0 if nothing was sold).
export function sell(player, jobId, region, good, count) {
  const job = JOBS[jobId];
  const rec = soldToday(player);
  const key = soldKey(region, good.id);
  const before = rec.n[key] ?? 0;
  count = Math.min(count, countItem(player, good.id), Math.max(0, stopAt(good) - before)); // the daily stop
  if (count <= 0) return 0;
  const earned = payout(good, count, before, regional(job, region).pays);
  if (earned < 1) return 0;
  if (player.getGameMode() === GameMode.Creative) {
    // takeItems is free in Creative; take them by hand so a Creative test still shows the trade
    player.runCommand(`clear @s ${good.id} -1 ${count}`);
  } else if (!takeItems(player, good.id, count)) return 0;
  rec.n[key] = before + count;
  player.setDynamicProperty(SOLD, JSON.stringify(rec));
  pay(player, earned, jobId);
  emit("goodsSold", { player, job: jobId, region, id: good.id, count, coins: earned });
  return earned;
}

async function sellMenu(player, npc, jobId, region) {
  const job = JOBS[jobId];
  const rec = soldToday(player);
  const { pays } = regional(job, region);
  const offers = job.buys.filter((good) => known(good.id)).map((good) => {
    const before = rec.n[soldKey(region, good.id)] ?? 0, room = Math.max(0, stopAt(good) - before);
    const have = Math.min(countItem(player, good.id), room);
    return { good, have, before, full: room === 0, worth: payout(good, have, before, pays), share: appetite(good, before) };
  });
  const mine = offers.filter((o) => o.have > 0);
  const form = new ActionFormData().title(`${job.name}: selling`);
  const wants = offers.map(({ good, share, full }) => full
    ? `${niceName(good.id)}: §8no more today, come back tomorrow§r`
    : `${niceName(good.id)}: ${coins(Math.max(1, Math.round(good.price * pays * share)))} for ${good.lot}${share < 1 ? " §8(they have plenty today)§r" : ""}`).join("\n");
  form.body(`${job.name} buys:\n${wants}\n\n${mine.length ? "Choose what to sell." : "§7You carry none of these."}`);
  for (const o of mine) form.button(`${niceName(o.good.id)} x${o.have}\n§8${coins(o.worth)}${o.have < countItem(player, o.good.id) ? " (all they'll take today)" : " for the lot"}`);
  if (mine.length > 1) form.button(`Sell all of it\n§8${coins(mine.reduce((sum, o) => sum + o.worth, 0))}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const all = mine.length > 1 ? mine.length : -1;
  if (res.selection === all) {
    let total = 0;
    for (const o of mine) total += sell(player, jobId, region, o.good, o.have);
    done(player, total ? `§6Sold the lot§7 for ${coins(total)}` : "§7Not enough there to be worth a coin.");
    return sellMenu(player, npc, jobId, region);
  }
  const o = mine[res.selection];
  if (!o) return openShop(player, npc);
  const res2 = await new ModalFormData().title(niceName(o.good.id))
    .slider(`You carry ${o.have}. All of it fetches ${coins(o.worth)}.\n\nHow many to sell`, 1, o.have, { valueStep: 1, defaultValue: o.have })
    .show(player);
  if (res2.canceled) return sellMenu(player, npc, jobId, region);
  const count = Math.max(1, Math.min(o.have, Math.floor(res2.formValues[0])));
  const earned = sell(player, jobId, region, o.good, count);
  done(player, earned ? `§6${count} ${niceName(o.good.id)}§7 sold for ${coins(earned)}` : `§7${count} ${niceName(o.good.id)} isn't worth a coin. Bring more.`);
  sellMenu(player, npc, jobId, region);
}

function done(player, text) {
  sfx(player, "random.orb");
  player.onScreenDisplay.setActionBar(text);
}

// ---------- buying from the NPC ----------

async function buyMenu(player, npc, jobId, region) {
  const job = JOBS[jobId];
  const { charges } = regional(job, region);
  const stock = job.sells.filter((good) => forSale(good, region));
  const charge_ = (good) => (good.flat ? 1 : charges); // a region's own make has no regional markup
  const form = new ActionFormData().title(`${job.name}: buying`).body(`You have ${coins(funds(player))}.`);
  for (const good of stock) form.button(`${niceName(good.id)}${good.lot > 1 ? ` x${good.lot}` : ""}\n§8${coins(cost(good, 1, charge_(good)))}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const good = stock[res.selection];
  if (!good) return openShop(player, npc);
  const each = cost(good, 1, charge_(good));
  const have = player.getGameMode() === GameMode.Creative ? each * ECON.maxLots : funds(player);
  const most = Math.min(ECON.maxLots, Math.floor(have / each));
  if (most < 1) {
    player.sendMessage(`§7${job.name}: §fThat's ${coins(each)}. You have ${coins(have)}.`);
    return buyMenu(player, npc, jobId, region);
  }
  let lots = 1;
  if (most > 1) {
    const res2 = await new ModalFormData().title(niceName(good.id))
      .slider(`${good.lot} for ${coins(each)}. You have ${coins(have)}.\n\nHow many lots`, 1, most, { valueStep: 1, defaultValue: 1 })
      .show(player);
    if (res2.canceled) return buyMenu(player, npc, jobId, region);
    lots = Math.max(1, Math.min(most, Math.floor(res2.formValues[0])));
  }
  const price = cost(good, lots, charge_(good));
  if (!charge(player, price, jobId)) return;
  hand(player, good.id, lots * good.lot);
  done(player, `§6${lots * good.lot} ${niceName(good.id)}§7 for ${coins(price)}`);
  buyMenu(player, npc, jobId, region);
}

async function exchangeMenu(player, npc) {
  const form = new ActionFormData().title("Moneyer: trade up")
    .body("Any metal can be traded up one step. It is dear: digging it yourself, or winning it, is always cheaper.");
  for (const step of EXCHANGE) {
    const have = countItem(player, step.from);
    form.button(`${step.n} ${niceName(step.from)} → 1 ${niceName(step.to)}\n§8you have ${have}, enough for ${Math.floor(have / step.n)}`);
  }
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const step = EXCHANGE[res.selection];
  if (!step) return openShop(player, npc);
  const most = Math.min(64, Math.floor(countItem(player, step.from) / step.n));
  if (most < 1) {
    player.onScreenDisplay.setActionBar(`§7You need ${step.n} ${niceName(step.from)} for one ${niceName(step.to)}.`);
    return exchangeMenu(player, npc);
  }
  let count = 1;
  if (most > 1) {
    const res2 = await new ModalFormData().title(`Trade up to ${niceName(step.to)}`)
      .slider(`How many ${niceName(step.to)} (${step.n} ${niceName(step.from)} each)`, 1, most, { valueStep: 1, defaultValue: 1 }).show(player);
    if (res2.canceled) return exchangeMenu(player, npc);
    count = Math.max(1, Math.min(most, Math.floor(res2.formValues[0])));
  }
  const creative = player.getGameMode() === GameMode.Creative;
  if (creative) player.runCommand(`clear @s ${step.from} -1 ${count * step.n}`);
  else if (!takeItems(player, step.from, count * step.n)) return exchangeMenu(player, npc);
  hand(player, step.to, count);
  sfx(player, "random.orb");
  emit("goodsExchanged", { player, from: step.from, to: step.to, count });
  return exchangeMenu(player, npc);
}

// ---------- the Smith's reforge: any armour into this region's style (regional_armor.js) ----------

const WORN = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

// Every piece the player wears or carries that this region's Smith can reforge: { stack, to, price, put(stack) }
function reforgeable(player, region) {
  const found = [];
  const eq = player.getComponent("minecraft:equippable");
  for (const slot of WORN) {
    const stack = eq?.getEquipment(slot);
    const to = stack && reforgeTarget(stack.typeId, region);
    if (to && known(to)) found.push({ stack, to, price: reforgePrice(stack.typeId), worn: true, put: (s) => eq.setEquipment(slot, s) });
  }
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) {
    const stack = inv.getItem(i);
    const to = stack && reforgeTarget(stack.typeId, region);
    if (to && known(to)) found.push({ stack, to, price: reforgePrice(stack.typeId), worn: false, put: (s) => inv.setItem(i, s) });
  }
  return found;
}

// The same piece in the new style: enchantments, wear, name and lore come along (trims do not: the API can't read them)
export function reforged(stack, toId) {
  const out = new ItemStack(toId, 1);
  if (stack.nameTag) out.nameTag = stack.nameTag;
  try {
    const lore = stack.getLore();
    if (lore.length) out.setLore(lore);
  } catch {
    // no lore
  }
  try {
    const to = out.getComponent("minecraft:enchantable");
    for (const e of stack.getComponent("minecraft:enchantable")?.getEnchantments() ?? []) {
      try {
        to?.addEnchantment(e);
      } catch {
        // an enchantment this piece can't hold
      }
    }
  } catch {
    // not enchantable
  }
  try {
    const from = stack.getComponent("minecraft:durability"), to = out.getComponent("minecraft:durability");
    if (from && to) to.damage = Math.min(to.maxDurability - 1, Math.round((from.damage / from.maxDurability) * to.maxDurability));
  } catch {
    // no wear
  }
  return out;
}

async function reforgeMenu(player, npc, region) {
  const pieces = reforgeable(player, region);
  const form = new ActionFormData().title(`Smith: ${region} style`)
    .body(`Any armour you wear or carry, reforged in the ${region} style. It keeps its enchantments, its wear and its name.\n\nYou have ${coins(funds(player))}.`
      + (pieces.length ? "" : "\n\n§7You have no armour he could reforge here."));
  for (const p of pieces) form.button(`${armourName(p.stack.typeId)}${p.worn ? " (worn)" : ""}\n§8${coins(p.price)} → ${armourName(p.to)}`);
  const total = pieces.reduce((sum, p) => sum + p.price, 0);
  if (pieces.length > 1) form.button(`Reforge all of it\n§8${coins(total)}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const chosen = pieces.length > 1 && res.selection === pieces.length ? pieces : pieces[res.selection] ? [pieces[res.selection]] : undefined;
  if (!chosen) return openShop(player, npc);
  const price = chosen.reduce((sum, p) => sum + p.price, 0);
  if (!charge(player, price, "smith")) {
    player.sendMessage(`§7Smith: §fThat's ${coins(price)}. You have ${coins(funds(player))}.`);
    return reforgeMenu(player, npc, region);
  }
  for (const p of chosen) p.put(reforged(p.stack, p.to));
  sfx(player, "random.anvil_use");
  player.onScreenDisplay.setActionBar(`§6Reforged in the ${region} style§7 for ${coins(price)}`);
  emit("armourReforged", { player, region, count: chosen.length, coins: price });
  return reforgeMenu(player, npc, region);
}

// ---------- the shop ----------

export async function openShop(player, npc) {
  const jobId = jobOf(npc);
  const job = JOBS[jobId];
  if (!job) return;
  const region = regionOf(npc);
  if (job.guild) return guildMenu(player, npc, region);
  const mood = regional(job, region);
  const line = pick(isNight() ? LINES[jobId].night : LINES[jobId].day);
  const note = job.mint
    ? `Iron in: ${coins(ECON.ironBuys)} an ingot, as many as you bring. Iron out: ${coins(ECON.ironSells)}.`
    : mood.pays < 1 ? `§7${region} has plenty of this trade's goods: prices are low here.`
    : mood.pays > 1 ? `§7${region} is short of this trade's goods: prices are high here.` : "";
  const form = new ActionFormData().title(job.name).body(`§o"${line}"§r\n\n${note ? note + "\n\n" : ""}You have ${coins(funds(player))}.`);
  const acts = [];
  form.button("Sell"); acts.push(() => sellMenu(player, npc, jobId, region));
  if (job.sells.some((good) => forSale(good, region))) { form.button("Buy"); acts.push(() => buyMenu(player, npc, jobId, region)); }
  if (jobId === "smith" && region) { form.button(`Reforge armour\n§8in the ${region} style`); acts.push(() => reforgeMenu(player, npc, region)); }
  if (job.mint) { form.button("Trade up metal\n§8iron → gold → diamond → netherite"); acts.push(() => exchangeMenu(player, npc)); }
  form.button("Leave");
  const res = await form.show(player);
  if (!res.canceled) await acts[res.selection]?.();
}

// An old job NPC near a player turns into the new kind straight away, so nobody sees it in the wrong skin until
// they happen to click it (Mateo 2026-11-14: every NPC has a skin)
onTick("economy_renew_old_npcs", 100, () => {
  const seen = new Set();
  for (const p of world.getPlayers()) {
    let olds = [];
    try { olds = p.dimension.getEntities({ type: OLD_NPC_TYPE, tags: [JOB_TAG], location: p.location, maxDistance: 64 }); } catch { continue; }
    for (const old of olds) {
      if (seen.has(old.id)) continue;
      seen.add(old.id);
      renew(old);
    }
  }
});

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  const old = target.typeId === OLD_NPC_TYPE;
  if ((target.typeId !== NPC_TYPE && !old) || !target.hasTag(JOB_TAG)) return;
  if (old && player.isSneaking && player.getGameMode() === GameMode.Creative) return; // builder: the normal NPC editor
  event.cancel = true;
  system.run(() => {
    if (!target.isValid) return;
    const npc = old ? renew(target) : target;
    if (isReady()) openShop(player, npc).catch((e) => console.warn(`[Hollow Crown] job shop: ${e}`));
  });
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:economy_npc") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const [jobId, ...rest] = event.message.trim().split(/\s+/);
  const named = rest.join(" ").toLowerCase();
  const region = REGIONS.find((r) => r.toLowerCase() === named || r.toLowerCase().split(" ").includes(named)) ?? regionAt(player.location);
  if (!JOBS[jobId]) return player.sendMessage(`§cWhich job? One of: ${JOB_IDS.join(", ")}. Add a region name for regional prices.`);
  spawnJobNpc(player.dimension, player.location, jobId, region);
  player.sendMessage(`§a${JOBS[jobId].name} placed${region ? ` (${region} prices)` : " (no region: plain prices)"}. Remove with /kill @e[tag=${jobTag(jobId)},c=1] to remove.`);
});
