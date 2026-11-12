// The Plan Book. You can only raise a building on a town plot if you know its plan (plotmarker.js asks
// plansFor). The Hamlet's basics are always known and the town hall teaches more as it grows (config.js PLANS);
// the rest are found as Plan Scrolls: toppled Rival Lords, bosses, Rumor jobs, and whatever other features hand
// out (ruins, traders, wonders). Using a scroll teaches its plan for good. Your Plan Book lists what you know and
// copies a plan onto a fresh scroll (coins and a paper) so plans can be traded. A found plan is in its region's
// style; raising a building in a style that isn't your town's costs more.
//
// What other features can use:
//   learnPlan(player, id, style?)        teach a plan now (style: a region style id, or none for the town's own)
//   givePlanScroll(player, id, style?)   hand over a Plan Scroll (a trader's ware, a ruin's find, a wonder's gift)
//   randomPlanScroll(player)             a scroll for a plan this player doesn't know yet (or a random one)
//   plansFor(playerIds, creative) -> Set of plan keys known between them
//   on("planLearned", ({ player, id, style }))
// Test: /scriptevent siege:plans [list | scroll <id> [style] | learn <id> [style] | forget]

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { isReady, on, emit, moduleStore } from "../siege/api.js";
import { hallOf } from "../townhall/townhall.js";
import { STYLES } from "../townhall/styles.js";
import { PLANS, REGION_TO_STYLE } from "./config.js";
import { BUILDINGS, BUILDING } from "./buildings.js";
import { knownPlans, planKey, parsePlan, unknownOf } from "./plandata.js";
import { purse, charge, coins, lot } from "./wallet.js";
import { townOf } from "./founding.js";
import { sfx } from "../core/sfx.js";

export const PLAN_BOOK = "siege:plan_book";
export const PLAN_SCROLL = "siege:plan_scroll";
const PLAN_PROP = "hc:plan";
const DESIGNS = BUILDINGS.map((b) => b.id);
const REGION_STYLES = [...new Set(Object.values(REGION_TO_STYLE))];

// plans: { playerId: [plan keys] }   books: { playerId: true } (given their first Plan Book)
const store = moduleStore("siege:settle_planbook", () => ({ plans: {}, books: {} }));
const stored = (id) => (store.data.plans[id] ??= []);

const styleName = (style) => STYLES[style]?.name ?? style;
export const planName = (id, style) => `${BUILDING[id]?.name ?? id}${style ? ` (${styleName(style)})` : ""}`;

export function plansFor(ids, creative = false) {
  const out = new Set();
  for (const id of ids) for (const k of knownPlans({ stored: store.data.plans[id] ?? [], hallLevel: hallOf(id)?.level ?? 0, creative, designs: DESIGNS })) out.add(k);
  return out;
}
const knownBy = (player) => plansFor([player.id], player.getGameMode?.() === GameMode.Creative);
const townStyleOf = (player) => townOf(player.id)?.style;

export function learnPlan(player, id, style) {
  if (!BUILDING[id]) return false;
  const home = !style || style === townStyleOf(player);
  const key = home ? id : planKey(id, style);
  const known = knownBy(player);
  if (known.has(key)) return false;
  stored(player.id).push(key);
  store.save();
  player.sendMessage(`§6You have learned the plan for the ${planName(id, home ? undefined : style)}.§7 It is in your Plan Book for good.`);
  sfx(player, "random.levelup");
  emit("planLearned", { player, id, style: home ? undefined : style });
  return true;
}

export function makePlanScroll(id, style) {
  const item = new ItemStack(PLAN_SCROLL, 1);
  try { item.setDynamicProperty(PLAN_PROP, planKey(id, style)); } catch { /* old engine */ }
  item.nameTag = `§ePlan: ${planName(id, style)}`;
  try { item.setLore(["§7Use it to learn this plan.", "§8Trade it, or keep it."]); } catch { /* plain scroll */ }
  return item;
}

export function givePlanScroll(player, id, style) {
  if (!BUILDING[id]) return false;
  const item = makePlanScroll(id, style);
  try {
    const left = player.getComponent("minecraft:inventory").container.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    return false;
  }
  player.sendMessage(`§6A Plan Scroll: ${planName(id, style)}.`);
  return true;
}

// A scroll this player can use: a plan they don't know, in a random region's style (their own town's if free)
export function randomPlanScroll(player, from = DESIGNS.map((id) => ({ id, style: REGION_STYLES[Math.floor(Math.random() * REGION_STYLES.length)] }))) {
  const fresh = unknownOf(knownBy(player), from, townStyleOf(player));
  const pool = fresh.length ? fresh : from;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick ? givePlanScroll(player, pick.id, pick.style) : false;
}

// ---------- the items ----------

world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (player?.typeId !== "minecraft:player" || !isReady() || !itemStack) return;
  if (itemStack.typeId === PLAN_SCROLL) return readScroll(player, itemStack);
  if (itemStack.typeId === PLAN_BOOK) system.run(() => openBook(player).catch((e) => console.warn(`[Hollow Crown] plan book: ${e}`)));
});

function readScroll(player, item) {
  let key;
  try { key = item.getDynamicProperty(PLAN_PROP); } catch { key = undefined; }
  if (!key) return player.sendMessage("§7The scroll is blank. Copy a plan onto one at your Plan Book.");
  const { id, style } = parsePlan(key);
  if (!learnPlan(player, id, style)) return player.sendMessage(`§7You already know the plan for the ${planName(id, style)}. Keep the scroll to trade.`);
  // used up
  try {
    const inv = player.getComponent("minecraft:inventory").container;
    const slot = player.selectedSlotIndex;
    const held = inv.getItem(slot);
    if (held?.typeId === PLAN_SCROLL) inv.setItem(slot, held.amount > 1 ? Object.assign(held, { amount: held.amount - 1 }) : undefined);
  } catch { /* it stays */ }
}

async function openBook(player) {
  const known = [...knownBy(player)].map(parsePlan).filter((p) => BUILDING[p.id]);
  const lines = known.map((p) => `§f${planName(p.id, p.style)}`);
  const unknown = DESIGNS.filter((id) => !known.some((p) => p.id === id)).map((id) => BUILDING[id].name);
  const price = Math.round(PLANS.scrollLots * lot());
  const res = await new ActionFormData().title("Plan Book")
    .body(`§7Plans you know:\n${lines.join("\n")}${unknown.length ? `\n\n§7Not found yet: §8${unknown.join(", ")}` : ""}\n\n§7Your town hall teaches more as it grows. Other plans come as Plan Scrolls.`)
    .button(`Copy a plan to a scroll\n§8${coins(price)} and a paper`).button("Close").show(player);
  if (res.canceled || res.selection !== 0) return;
  const form = new ActionFormData().title("Copy which plan?");
  for (const p of known) form.button(planName(p.id, p.style));
  const pick = await form.show(player);
  if (pick.canceled) return;
  const p = known[pick.selection];
  const creative = player.getGameMode() === GameMode.Creative;
  if (!creative) {
    const inv = player.getComponent("minecraft:inventory").container;
    let paper = -1;
    for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === "minecraft:paper") { paper = i; break; }
    if (paper < 0) return player.sendMessage("§7You need a paper to copy a plan onto.");
    if (purse(player) < price) return player.sendMessage(`§7Copying costs ${coins(price)}.`);
    if (!charge(player, price)) return;
    const it = inv.getItem(paper);
    inv.setItem(paper, it.amount > 1 ? Object.assign(it, { amount: it.amount - 1 }) : undefined);
  }
  givePlanScroll(player, p.id, p.style ?? townStyleOf(player));
}

// Every new town's owner gets a Plan Book once
on("townLaidOut", ({ owner, tier }) => {
  if (tier !== 0 || store.data.books[owner]) return;
  const player = world.getPlayers().find((p) => p.id === owner);
  if (!player) return;
  store.data.books[owner] = true;
  store.save();
  try {
    const left = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(PLAN_BOOK, 1));
    if (left) player.dimension.spawnItem(left, player.location);
    player.sendMessage("§6A Plan Book is in your pack.§7 It lists the buildings you can raise on your plots.");
  } catch { /* they can craft one */ }
});

// ---------- where plans come from ----------

// A toppled lord leaves plans of what stood in their town, in their region's style
on("rivalFallen", ({ lord, player }) => {
  if (!player) return;
  const style = REGION_TO_STYLE[lord.region];
  const town = townOf(`npc:${lord.id}`);
  const ids = [...new Set(Object.values(town?.slots ?? {}).map((s) => s.building).filter((id) => BUILDING[id]))];
  const from = (ids.length ? ids : DESIGNS).map((id) => ({ id, style }));
  for (let i = 0; i < PLANS.lordScrolls; i++) randomPlanScroll(player, from);
});

// Bosses: every player at the kill gets a scroll
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:boss_defeated") return;
  let data;
  try { data = JSON.parse(event.message); } catch { return; }
  for (const id of data?.players ?? []) {
    const player = world.getPlayers().find((p) => p.id === id);
    for (let i = 0; player && i < PLANS.bossScrolls; i++) randomPlanScroll(player);
  }
});

on("rumorDone", ({ player }) => {
  if (player?.isValid && Math.random() < PLANS.rumorChance) randomPlanScroll(player);
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:plans") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [cmd = "list", id, style] = event.message.trim().split(/\s+/);
  if (cmd === "scroll") return id ? givePlanScroll(player, id, style) : randomPlanScroll(player);
  if (cmd === "learn" && id) return learnPlan(player, id, style) || player.sendMessage("§7Already known (or no such building).");
  if (cmd === "forget") { store.data.plans[player.id] = []; store.save(); return player.sendMessage("§7Found plans forgotten (basics and the hall's stay)."); }
  player.sendMessage(`§6Plans: §7${[...knownBy(player)].join(", ")}. Buildings: ${DESIGNS.join(", ")}. Styles: ${REGION_STYLES.join(", ")}.`);
});
