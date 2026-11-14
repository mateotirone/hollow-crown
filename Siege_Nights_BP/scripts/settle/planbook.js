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
import { isReady, on, emit, moduleStore, homeOf } from "../siege/api.js";
import { hallOf, hallMenuExtras } from "../townhall/townhall.js";
import { STYLES } from "../townhall/styles.js";
import { PLANS, REGION_TO_STYLE, PLOT_SIZE, PLOT_TAGS, TAG_WORDS, SETTLERS, CHARTERS, HOMES, HAND_NAMES } from "./config.js";
import { CLASS_NAMES, opensAt } from "./charters.js";
import { plotPrice } from "./plotmarker.js";
import { BUILDINGS, BUILDING } from "./buildings.js";
import { knownPlans, planKey, parsePlan, unknownOf, planCards, whereFrom } from "./plandata.js";
import { purse, charge, coins, lot } from "./wallet.js";
import { townOf, tierName } from "./founding.js";
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
  if (itemStack.typeId === PLAN_BOOK) system.run(() => openPlanScreen(player, homeOf(player.id) ?? player.id).catch((e) => console.warn(`[Hollow Crown] plan book: ${e}`)));
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

// ---------- the Plan Book screen ----------
// The town hall's "Plan Book" button and the Plan Book item open it: a grid of building cards (ui/server_form.json,
// studio/build_tree_ui.py draws it for forms whose title carries PLAN_FLAG). A found plan is bright, one not found
// yet is greyed with where to look. Click a card for the details. Without the resource pack it is a plain list.
export const PLAN_FLAG = "§h§p";
export const PLAN_COLS = 5; // studio/build_tree_ui.py PLAN_COLS
const HAND = Object.keys(HAND_NAMES).map((id) => HAND_NAMES[id]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const styleOfTown = (owner) => townOf(owner)?.style ?? hallOf(owner)?.style ?? "vale";

export async function openPlanScreen(player, owner = player.id) {
  const creative = player.getGameMode?.() === GameMode.Creative;
  const known = plansFor([...new Set([owner, player.id])], creative);
  const townStyle = styleOfTown(owner);
  const cards = planCards(known, townStyle, DESIGNS, REGION_STYLES);
  const form = new ActionFormData().title(`${PLAN_FLAG}Plan Book`)
    .body(`§7${cards.filter((c) => c.known).length} of ${cards.length} plans found. ${HAND.join(", ")}: build those by hand and register them at the plot.`);
  for (const c of cards) {
    const b = BUILDING[c.id];
    const line = c.home ? `§7${cap(CLASS_NAMES[PLOT_SIZE[c.id]] ?? "")} plot` : c.known ? `§7${styleName(c.foreign[0])} style` : `§8${whereFrom(c.id).short}`;
    form.button(`${c.known ? "§f" : "§7"}${b.name}\n${line}`, c.texture);
  }
  form.button("§fCopy a plan\n§7to a scroll", "textures/ui/hc/plans/copy");
  const cells = Math.ceil((cards.length + 1) / PLAN_COLS) * PLAN_COLS;
  for (let i = cards.length + 1; i < cells; i++) form.button("-");
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === cards.length) return copyMenu(player, owner, known);
  const c = cards[res.selection];
  if (c) return planDetails(player, owner, c, townStyle);
}

async function planDetails(player, owner, c, townStyle) {
  const b = BUILDING[c.id];
  const tags = PLOT_TAGS[c.id];
  const where = tags?.needs ? ` It must stand ${tags.needs.map((t) => TAG_WORDS[t]).join(" or ")}.` : tags?.prefer ? ` Best ${tags.prefer.map((t) => TAG_WORDS[t]).join(" or ")}.` : "";
  const worker = SETTLERS.workers[c.id];
  const charters = CHARTERS.flatMap((lines, t) => lines.filter((l) => l.ids.includes(c.id) && t < CHARTERS.length - 1).map((l) => `§7Counts toward the §f${tierName(t)}§7 charter (to become a ${tierName(t + 1)}): ${l.count ? `${l.count} ` : ""}${l.what}.`));
  const others = REGION_STYLES.filter((s) => s !== townStyle);
  const body = [
    `§7${b.blurb ?? ""}`,
    "",
    `§7Plot: §f${CLASS_NAMES[PLOT_SIZE[c.id]] ?? "any"}§7.${where}${opensAt(c.id) > 0 ? ` Opens once you are a ${tierName(opensAt(c.id))}.` : ""}`,
    worker ? `§7Brings a §f${worker}§7 to live and work there.` : HOMES.includes(c.id) ? "§7A home: its beds take in settlers." : "",
    ...charters,
    "",
    c.home ? `§aYou know it in your own style (${styleName(townStyle)}): ${coins(plotPrice(c.id))}.` : `§8Not found in your own style (${styleName(townStyle)}).`,
    ...others.map((s) => (c.foreign.includes(s) ? `§a${styleName(s)} style known: ${coins(plotPrice(c.id, true))}.` : `§8${styleName(s)} style: ${coins(plotPrice(c.id, true))} if you find it.`)),
    "§8A style that isn't your town's costs half as much again.",
    ...(c.known ? [] : ["", `§7Where to look: ${whereFrom(c.id).long}`]),
  ].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0));
  const form = new ActionFormData().title(b.name).body(body.join("\n")).button("Back to the Plan Book");
  const copyable = [...(c.home ? [undefined] : []), ...c.foreign];
  for (const s of copyable) form.button(`Copy to a scroll${s ? ` (${styleName(s)})` : ""}\n§8${coins(copyPrice())} and a paper`);
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === 0) return openPlanScreen(player, owner);
  const s = copyable[res.selection - 1];
  return copyPlan(player, { id: c.id, style: s });
}

const copyPrice = () => Math.round(PLANS.scrollLots * lot());

async function copyMenu(player, owner, known) {
  const plans = [...known].map(parsePlan).filter((p) => BUILDING[p.id]);
  const form = new ActionFormData().title("Copy which plan?").body(`§7A copy costs ${coins(copyPrice())} and a paper. Trade it, or give it to a friend.`);
  for (const p of plans) form.button(planName(p.id, p.style));
  form.button("Back to the Plan Book");
  const pick = await form.show(player);
  if (pick.canceled) return;
  if (pick.selection === plans.length) return openPlanScreen(player, owner);
  return copyPlan(player, plans[pick.selection]);
}

function copyPlan(player, p) {
  const price = copyPrice();
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

hallMenuExtras.push({ label: "Plan Book\n§8buildings you can raise, and where to find more", icon: "textures/items/siege_plan_book", action: (player, owner) => openPlanScreen(player, owner) });

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
