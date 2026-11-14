// Local lore: each of the twelve settlement plots has its own past, three books of its own and a small
// mystery (data/plots.js), so no two settlements start the story from the same place.
//   On arrival      the player is told what stood here before them, gets a first lead, and the plot's first
//                   book is on the bottom shelf of the settlement Library (or in their pack, if no Library was built).
//                   Later books go on that shelf too; only if it is gone, full or out of reach for long do they go in the pack.
//   At Town tier    the second book turns up.   At City tier, the third.
// The Library building and its eight Archive Shelf bookcases (sixteen halves) belong to the settlement feature (settle/buildings.js);
// it tells us where the shelves are with "settleBuilt" { building: "library", owner, marks: { shelf0.. } }.
//   /scriptevent siege:local_lore            what this plot's lore is and which books you are owed
//   /scriptevent siege:local_lore <plot>     (creative) give that plot's three books, to read them

import { world, system } from "@minecraft/server";
import { on, keepOf, tierOf, TIERS } from "../siege/api.js";
import { plotOf, plotAt } from "../plots/api.js";
import { PLOT_LORE, PLOT_NAMES, slugOf } from "./data/plots.js";
import { grantTome, learnLeads, setFlag, progressOf, saveProgress, giveItem, makeTome } from "./player.js";
import { stockShelf, storedIn } from "./library.js";
import { moduleStore } from "../core/store.js";

export const localTomeIds = (plotName) => (PLOT_LORE[plotName] ? [1, 2, 3].map((n) => `loc_${slugOf(plotName)}_${n}`) : []);
// How many of its three books a settlement has earned: one on arrival, two as a Town, three as a City
export const booksOwed = (tierIndex) => Math.max(1, Math.min(3, 1 + (tierIndex ?? 0)));

// owner id -> { x, y, z } of their Library's bottom shelf (shelf0), so later books go there too
const store = moduleStore("siege:lore_local", () => ({ shelf: {} }));
const WAIT_TRIES = 40; // while the Library is going up (or its shelf is out of range), look again every 30 s for 20 minutes
const playerById = (id) => world.getAllPlayers().find((p) => p.id === id);

function plotNameOf(player) {
  try {
    const held = plotOf(player.id)?.name;
    if (held) return held;
    const keep = keepOf(player.id);
    if (keep) return plotAt(keep)?.name;
  } catch {}
  return undefined;
}

function tierIndexOf(player) {
  try {
    const keep = keepOf(player.id);
    return keep ? Math.max(0, TIERS.indexOf(tierOf(keep))) : 0;
  } catch {
    return 0;
  }
}

function tellPast(player, name) {
  const lore = PLOT_LORE[name];
  if (!lore || !setFlag(player, `local_arrived_${slugOf(name)}`)) return;
  player.sendMessage(`§6${name}.§r §7${lore.was}`);
  learnLeads(player, [lore.lead]);
}

// Books put on the Library shelf count as found, so one the player later takes off the shelf is not handed out again
function markFound(player, ids) {
  if (!player) return;
  const p = progressOf(player);
  for (const id of ids) if (!p.got.includes(id)) p.got.push(id);
  saveProgress(player);
}

// The Library's bottom shelf, if it stands and is loaded
function libraryShelf(owner) {
  const at = store.data.shelf[owner];
  if (!at) return undefined;
  try {
    const block = world.getDimension("overworld").getBlock(at);
    return block?.typeId === "siege:archive_shelf" ? block : undefined;
  } catch {
    return undefined;
  }
}

// Hand over whatever this player's settlement has earned and they do not yet have. The books belong on the
// Library's bottom shelf: every settlement's Library goes up on arrival, so while it is still rising they wait
// for it (settleBuilt below stocks them), and only a settlement that never got its Library gets them in the pack.
function sync(player, tries = 0) {
  if (!player?.isValid) return;
  const name = plotNameOf(player);
  if (!PLOT_LORE[name]) return;
  tellPast(player, name);
  const owner = player.id;
  let stored = [];
  try { stored = storedIn(owner); } catch {}
  const p = progressOf(player);
  const missing = localTomeIds(name).slice(0, booksOwed(tierIndexOf(player))).filter((id) => !p.got.includes(id) && !stored.includes(id));
  if (!missing.length) return;
  const shelf = libraryShelf(owner);
  if (shelf) {
    const before = stored.length;
    stockShelf(shelf, owner, missing);
    const placed = storedIn(owner).filter((id) => missing.includes(id));
    markFound(player, placed);
    if (storedIn(owner).length > before) {
      return player.sendMessage(`§7§oSomething turned up when the new foundations were dug at ${name}. It is on the bottom shelf of your Library.`);
    }
    // the bottom shelf is full: fall through to the pack
  } else if (tries < WAIT_TRIES) {
    // the Library is still going up, or its shelf is not loaded while the player is away: look again later
    return syncSoon(player, 600, tries + 1);
  }
  for (const [i, id] of missing.entries()) {
    if (grantTome(player, id) && i > 0) player.sendMessage(`§7§oSomething turned up when the new foundations were dug at ${name}.`);
  }
}
const syncSoon = (player, ticks = 200, tries = 0) => system.runTimeout(() => { try { sync(player, tries); } catch (e) { console.warn(`[Hollow Crown] local lore: ${e}`); } }, ticks);

on("plotChosen", ({ player, plot }) => {
  // the past is told at once; the book waits a moment so the Library can be raised with it already on the shelf
  system.runTimeout(() => { try { if (player?.isValid && PLOT_LORE[plot?.name]) tellPast(player, plot.name); } catch {} }, 60);
  syncSoon(player, 400);
});
on("keepFounded", ({ player }) => syncSoon(player, 400));
on("tierUp", ({ owner }) => { const player = playerById(owner); if (player) syncSoon(player, 100); });
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => { if (initialSpawn) syncSoon(player, 300); });

// The settlement's Library has just been built: its first local book is already on the bottom shelf.
on("settleBuilt", ({ building, owner, origin, marks }) => {
  if (building !== "library" || !marks?.shelf0) return;
  try {
    const name = plotAt(origin)?.name;
    const ids = localTomeIds(name);
    if (!ids.length) return;
    const dim = world.getDimension("overworld");
    const block = dim.getBlock(marks.shelf0);
    if (!block) return;
    store.data.shelf[owner] = { x: marks.shelf0.x, y: marks.shelf0.y, z: marks.shelf0.z };
    store.save();
    const p = playerById(owner) && progressOf(playerById(owner));
    // books the owner has already been handed stay in their pack; the rest wait on the shelf
    const waiting = ids.slice(0, booksOwed(playerById(owner) ? tierIndexOf(playerById(owner)) : 0)).filter((id) => !p?.got.includes(id));
    stockShelf(block, owner, waiting);
    const player = playerById(owner);
    markFound(player, storedIn(owner).filter((id) => waiting.includes(id)));
    if (player && waiting.length) player.sendMessage(`§6The Library at ${name} is not empty.§r §7Somebody left ${waiting.length === 1 ? "a book" : "books"} on the bottom shelf, a long time ago.`);
  } catch (e) {
    console.warn(`[Hollow Crown] local library: ${e}`);
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:local_lore" || player?.typeId !== "minecraft:player") return;
  const asked = PLOT_NAMES.find((n) => slugOf(n) === slugOf(message));
  if (asked) {
    for (const tome of localTomeIds(asked)) giveItem(player, makeTome(tome));
    return player.sendMessage(`§6${asked}.§r §7${PLOT_LORE[asked].was}\n§8Builder note: ${PLOT_LORE[asked].build}`);
  }
  const name = plotNameOf(player);
  if (!PLOT_LORE[name]) return player.sendMessage(`§7You hold no plot. Plots with their own books: ${PLOT_NAMES.join(", ")}. Try /scriptevent siege:local_lore harrowford`);
  sync(player);
  player.sendMessage(`§6${name}.§r §7${PLOT_LORE[name].was}\n§7Books earned so far: ${booksOwed(tierIndexOf(player))} of 3.`);
});
