// Local lore: each of the twelve settlement plots has its own past, three books of its own and a small
// mystery (data/plots.js), so no two settlements start the story from the same place.
//   On arrival      the player is told what stood here before them, gets a first lead, and the plot's first
//                   book is on the bottom shelf of the settlement Library (or in their pack, if no Library was built).
//   At Town tier    the second book turns up.   At City tier, the third.
// The Library building and its eight Archive Shelves belong to the settlement feature (settle/buildings.js);
// it tells us where the shelves are with "settleBuilt" { building: "library", owner, marks: { shelf0.. } }.
//   /scriptevent siege:local_lore            what this plot's lore is and which books you are owed
//   /scriptevent siege:local_lore <plot>     (creative) give that plot's three books, to read them

import { world, system } from "@minecraft/server";
import { on, keepOf, tierOf, TIERS } from "../siege/api.js";
import { plotOf, plotAt } from "../plots/api.js";
import { PLOT_LORE, PLOT_NAMES, slugOf } from "./data/plots.js";
import { grantTome, learnLeads, setFlag, progressOf, giveItem, makeTome } from "./player.js";
import { stockShelf, shelvedIn } from "./library.js";

export const localTomeIds = (plotName) => (PLOT_LORE[plotName] ? [1, 2, 3].map((n) => `loc_${slugOf(plotName)}_${n}`) : []);
// How many of its three books a settlement has earned: one on arrival, two as a Town, three as a City
export const booksOwed = (tierIndex) => Math.max(1, Math.min(3, 1 + (tierIndex ?? 0)));

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

// Hand over whatever this player's settlement has earned and they do not yet have
function sync(player) {
  if (!player?.isValid) return;
  const name = plotNameOf(player);
  if (!PLOT_LORE[name]) return;
  tellPast(player, name);
  const ids = localTomeIds(name).slice(0, booksOwed(tierIndexOf(player)));
  let onShelf = [];
  try { onShelf = shelvedIn(player.id); } catch {}
  const p = progressOf(player);
  for (const [i, id] of ids.entries()) {
    if (p.got.includes(id) || onShelf.includes(id)) continue;
    if (grantTome(player, id) && i > 0) player.sendMessage(`§7§oSomething turned up when the new foundations were dug at ${name}.`);
  }
}
const syncSoon = (player, ticks = 200) => system.runTimeout(() => { try { sync(player); } catch (e) { console.warn(`[Hollow Crown] local lore: ${e}`); } }, ticks);

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
    const p = playerById(owner) && progressOf(playerById(owner));
    // books the owner has already been handed stay in their pack; the rest wait on the shelf
    const waiting = ids.slice(0, booksOwed(playerById(owner) ? tierIndexOf(playerById(owner)) : 0)).filter((id) => !p?.got.includes(id));
    stockShelf(block, owner, waiting);
    const player = playerById(owner);
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
