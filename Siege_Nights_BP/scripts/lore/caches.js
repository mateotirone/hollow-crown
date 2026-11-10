// Where tomes come from: Dusty Tomes placed on the map, boss and mob drops, and builder commands.
//
// A Dusty Tome (hc:tome_cache) is a book lying in the world. The map builder binds it to one Lore
// Tome. Every player who clicks it gets their own copy, once, and the book stays for the next
// player, so nobody can strip the map bare on a shared Realm.
//
// Builder commands (creative / operators):
//   /scriptevent siege:lore_give <tome id | collection id | all>    put tomes in your inventory
//   /scriptevent siege:lore_list [collection id]                    list tome ids and where each belongs
//   /scriptevent siege:lore_mark_place <place id>                   record a place at your feet (for Ledger headings)
//   /scriptevent siege:lore_reset                                   wipe YOUR lore progress (for testing)
// To bind a Dusty Tome: place it, then click it in creative while holding the Lore Tome.

import { world, system, GameMode } from "@minecraft/server";
import { on, moduleStore } from "../siege/api.js";
import { TOME, TOMES, COLLECTION, tomesOf, blankProgress } from "./logic.js";
import { PLACES } from "./data/world.js";
import { tomeIdOf, makeTome, grantTome, giveItem, progressOf, saveProgress } from "./player.js";
import { markPlace } from "./ledger.js";

export const CACHE = "hc:tome_cache";
const caches = moduleStore("hc:lore_caches", () => ({ at: {} })); // "dim|x,y,z" -> tome id
const keyOf = (block) => `${block.dimension.id}|${block.location.x},${block.location.y},${block.location.z}`;

// Place a Dusty Tome bound to a tome (used by the showcase)
export function placeCache(block, id) {
  block.setType(CACHE);
  caches.data.at[keyOf(block)] = id;
  caches.save();
}

const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== CACHE) return;
  event.cancel = true;
  if (event.isFirstEvent === false) return;
  const now = system.currentTick;
  if (now - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, now);
  const heldId = tomeIdOf(event.itemStack);
  const creative = player.getGameMode() === GameMode.Creative;
  system.run(() => {
    try {
      const key = keyOf(block);
      if (creative && heldId) {
        caches.data.at[key] = heldId;
        caches.save();
        return player.sendMessage(`§aThis Dusty Tome now gives: §f${TOME[heldId].title}§a (${heldId}).`);
      }
      const id = caches.data.at[key];
      if (!id) return player.onScreenDisplay.setActionBar(creative ? "§eNot bound yet. Click it holding a Lore Tome." : "§7The pages have rotted away.");
      if (creative) return player.sendMessage(`§7This Dusty Tome gives: §f${TOME[id]?.title}§7 (${id}). Click with another tome to change it.`);
      if (!grantTome(player, id)) player.onScreenDisplay.setActionBar("§7You have already copied this one out.");
    } catch (e) {
      console.warn(`[Lore] tome cache: ${e}`);
    }
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== CACHE) return;
  const key = keyOf(event.block);
  if (!caches.data.at[key]) return;
  delete caches.data.at[key];
  caches.save();
});

// ---------- Drops ----------
// Bosses: everyone who helped gets their own copy at the boss's feet.
export const BOSS_TOMES = Object.fromEntries(TOMES.filter((t) => t.boss).map((t) => [t.boss, [t.id]]));
BOSS_TOMES.mother.push("scri_05"); // the Litany of the Crowned, until the Rift opens

// Mobs: chance per kill that the killer gets the first tome on the list they don't have yet.
export const MOB_TOMES = {
  tolling_shade: { chance: 0.25, tomes: ["surv_07", "scri_01"] },
  lost_villager: { chance: 0.15, tomes: ["scri_06", "test_09"] },
  changeling: { chance: 0.2, tomes: ["test_09", "scri_06"] },
  barrow_wight: { chance: 0.1, tomes: ["chron_07"] },
  inquisitor: { chance: 0.15, tomes: ["seal_06", "seal_11"] },
  ashen_knight: { chance: 0.08, tomes: ["seal_04", "seal_11"] },
};
const SIEGE_TOME = { chance: 0.2, id: "scri_03" }; // Canticle of the Lantern Keeps, from beaten raiders
const FIRST_WIN_TOME = "scri_08"; // falls with the Ember on your first siege win

const playerById = (id) => world.getAllPlayers().find((p) => p.id === id);

function parse(message) {
  try {
    return JSON.parse(message);
  } catch {
    return undefined;
  }
}

function bossDefeated(data) {
  const at = { x: data.x, y: data.y, z: data.z };
  for (const id of data.players ?? []) {
    const player = playerById(id);
    if (!player) continue;
    for (const tome of BOSS_TOMES[data.boss] ?? []) grantTome(player, tome, player.dimension.id === data.dimension ? at : undefined);
  }
}

function mobKilled(data) {
  const drop = MOB_TOMES[data.mob];
  const player = data.killer && playerById(data.killer);
  if (!drop || !player || Math.random() > drop.chance) return;
  const p = progressOf(player);
  const id = drop.tomes.find((t) => !p.got.includes(t));
  if (id) grantTome(player, id, { x: data.x, y: data.y, z: data.z });
}

on("siegeReward", ({ player }) => {
  if (!player) return;
  if (!grantTome(player, FIRST_WIN_TOME) && Math.random() < SIEGE_TOME.chance) grantTome(player, SIEGE_TOME.id);
});

// ---------- Script events ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const { id, message, sourceEntity: player } = event;
  if (id === "siege:boss_defeated") {
    const data = parse(message);
    if (data) bossDefeated(data);
    return;
  }
  if (id === "siege:mob_killed") {
    const data = parse(message);
    if (data) mobKilled(data);
    return;
  }
  if (!id.startsWith("siege:lore_") || player?.typeId !== "minecraft:player") return;
  const arg = message.trim();

  if (id === "siege:lore_give") {
    const ids = arg === "all" ? TOMES.map((t) => t.id) : COLLECTION[arg] ? tomesOf(arg).map((t) => t.id) : TOME[arg] ? [arg] : [];
    if (!ids.length) return player.sendMessage("§cUnknown tome or collection. Try /scriptevent siege:lore_list");
    for (const tome of ids) giveItem(player, makeTome(tome));
    player.sendMessage(`§aGave ${ids.length} Lore Tome(s).`);
  } else if (id === "siege:lore_list") {
    const list = COLLECTION[arg] ? tomesOf(arg) : undefined;
    if (!list) return player.sendMessage(`§6Collections:§r ${Object.values(COLLECTION).map((c) => `${c.id} (${c.count})`).join(", ")}\n§7/scriptevent siege:lore_list <collection> lists its tomes.`);
    player.sendMessage(list.map((t) => `§6${t.id}§r ${t.title}\n§7  ${t.where}`).join("\n"));
  } else if (id === "siege:lore_mark_place") {
    if (!PLACES[arg]) return player.sendMessage(`§cUnknown place. Places: ${Object.keys(PLACES).join(", ")}`);
    markPlace(arg, player.location);
    player.sendMessage(`§aMarked ${PLACES[arg].name} here.`);
  } else if (id === "siege:lore_reset") {
    Object.assign(progressOf(player), blankProgress(), { flags: ["journal_given"] });
    saveProgress(player);
    player.sendMessage("§aYour lore progress is wiped.");
  }
});
