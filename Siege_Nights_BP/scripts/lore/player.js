// Each player's lore progress (the Ledger of Whispers), saved on the player.

import { world, system, ItemStack } from "@minecraft/server";
import { emit, settlementAt, isReady, isNight } from "../siege/api.js";
import { isTesting } from "../core/tests.js";
import { blankProgress, addClues, TOME, COLLECTION, loadSaved, stampSaved } /* saves carry a version: SAVE_VERSION in logic.js */ from "./logic.js";
import { SITE_IDS, PLACES } from "./data/world.js";

export const TOME_ITEM = "siege:lore_tome";
export const LEDGER = "siege:ledger";
export const CIPHER_WHEEL = "siege:cipher_wheel";
export const MIRROR_GLASS = "siege:mirror_glass";
const PROP = "hc:lore_progress";
const HERO_PROP = "siege:townhall_hero"; // written by the town hall feature
const K_SITE = "hc:source_site"; // shared with the Undertow feature, which normally sets it

const cache = new Map(); // player id -> progress

export function progressOf(player) {
  let p = cache.get(player.id);
  if (p) return p;
  p = blankProgress();
  try {
    const raw = player.getDynamicProperty(PROP);
    Object.assign(p, loadSaved("progress", raw));
  } catch (e) {
    console.warn(`[Lore] bad progress for ${player.name}: ${e}`);
  }
  cache.set(player.id, p);
  return p;
}

export function saveProgress(player) {
  if (isTesting()) return;
  const p = cache.get(player.id);
  if (p) player.setDynamicProperty(PROP, stampSaved("progress", p));
}

world.afterEvents.playerLeave.subscribe((event) => cache.delete(event.playerId));

// The real Source site. The Undertow feature picks it; if that hasn't happened yet, pick here
// with the same key and list so both features always agree.
export function sourceSite() {
  let id = world.getDynamicProperty(K_SITE);
  if (typeof id !== "string" || !SITE_IDS.includes(id)) {
    id = SITE_IDS[Math.floor(Math.random() * SITE_IDS.length)];
    if (!isTesting()) world.setDynamicProperty(K_SITE, id);
  }
  return id;
}

export function heroOf(player) {
  try {
    const raw = player.getDynamicProperty(HERO_PROP);
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {}
  return {};
}

export function hasItem(player, typeId) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  for (let i = 0; i < container.size; i++) if (container.getItem(i)?.typeId === typeId) return true;
  return false;
}

// What this player can read: ciphers with a Cipher Wheel; the Hollow's right-to-left writing with Tide Glass (item id siege:mirror_glass),
// as a Marked player, or while standing in the Undertow.
export function readingPowers(player) {
  return {
    cipher: hasItem(player, CIPHER_WHEEL),
    mirror: hasItem(player, MIRROR_GLASS) || ["marked", "sorcerer"].includes(heroOf(player).path) || player.dimension.id.includes("undertow"),
  };
}

export function giveItem(player, item) {
  const left = player.getComponent("minecraft:inventory")?.container?.addItem(item);
  if (left) player.dimension.spawnItem(left, player.location);
}

// ---------- Tome items ----------
export function makeTome(id) {
  const tome = TOME[id];
  if (!tome) return undefined;
  const col = COLLECTION[tome.col];
  const item = new ItemStack(TOME_ITEM, 1);
  item.setDynamicProperty("hc:lore_id", id);
  item.nameTag = `§r${col.color}${tome.title}`;
  item.setLore([`§r§7${col.name}, no. ${tome.n}`, `§r§8${tome.author}`]);
  return item;
}
export const tomeIdOf = (item) => (item?.typeId === TOME_ITEM ? item.getDynamicProperty("hc:lore_id") : undefined);

// Give a tome once per player. how: "inventory" or a location to drop it at. Returns true if given.
export function grantTome(player, id, at) {
  const p = progressOf(player);
  if (p.got.includes(id) || !TOME[id]) return false;
  const item = makeTome(id);
  if (at) player.dimension.spawnItem(item, at);
  else giveItem(player, item);
  p.got.push(id);
  saveProgress(player);
  player.sendMessage(`§6You found a Lore Tome: §f${TOME[id].title}`);
  player.playSound("item.book.page_turn");
  return true;
}

// ---------- Ledger entries ----------
export function ensureLedger(player) {
  const p = progressOf(player);
  if (p.flags.includes("has_ledger")) return;
  p.flags.push("has_ledger");
  giveItem(player, new ItemStack(LEDGER, 1));
  player.sendMessage("§6You start a §fLedger of Whispers§6. It copies down every clue you read. Use it to see your mysteries and leads.");
}

export function learnClues(player, clues) {
  if (!clues?.length) return;
  const touched = addClues(progressOf(player), clues);
  if (!touched.length) return;
  ensureLedger(player);
  saveProgress(player);
  system.run(() => player.onScreenDisplay.setActionBar(`§6Ledger updated: §f${touched.join(", ")}`));
}

export function learnLeads(player, leads) {
  const p = progressOf(player);
  const fresh = (leads ?? []).filter((id) => PLACES[id] && !p.leads.includes(id));
  if (!fresh.length) return;
  p.leads.push(...fresh);
  ensureLedger(player);
  saveProgress(player);
  player.sendMessage(`§6New lead: §f${fresh.map((id) => PLACES[id].name).join(", ")}`);
}

export function awardPoints(player, amount, source, renown = 0) {
  if (amount > 0 || renown > 0) emit("skillPoints", { player, amount, source, renown });
}

export function setFlag(player, flag) {
  const p = progressOf(player);
  if (p.flags.includes(flag)) return false;
  p.flags.push(flag);
  saveProgress(player);
  emit("loreFlag", { player, flag });
  return true;
}

// Context for dialogue conditions
export function contextOf(player, shelved = 0) {
  const hero = heroOf(player);
  return { path: hero.path ?? "none", resonance: hero.resonance ?? 0, night: isNight(), shelved };
}

export const landOwnerAt = (block) => (isReady() && block.dimension.id === "minecraft:overworld" ? settlementAt(block.location) : undefined);
