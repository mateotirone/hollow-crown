// Claimable plots. The map builder places a Plot Stone (siege:plot_stone, Creative only) in the
// middle of each plot and picks its name. From then on a Keep Banner can only be raised on top of
// a free Plot Stone, so every settlement lives on a plot. Friends share a plot with a Writ of
// Alliance, or each claim their own. A world with no Plot Stones keeps the old rule (banner
// anywhere), so test worlds still work.
//
// Who holds a plot is never stored here: it's read from Siege Nights' keeps. A plot is claimed
// when a keep sits on the block above its stone, so a keep that falls, is captured or is moved
// frees its plot by itself.

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, getState, on, emit, addKeepMenuButtons, addFoundingCheck } from "../siege/api.js";
import { onTick } from "../core/loop.js";
import { MAP, PLOT_PLAN, REGION_STYLE, PLOT_STONE, KEEP_BANNER, OVERWORLD, DAY_TICKS } from "./config.js";

export const isBuilder = (player) => player.getGameMode() === GameMode.Creative;

// ---------- Saved plots ----------
// [{ name, region, x, y, z, lastOwner?, lastOwnerName?, reservedFor?, reservedName?, reservedUntil? }]

let plots;

export function allPlots() {
  if (!plots) {
    // Saved as { v, plots }. Worlds from before versioning saved the bare list: read that too.
    const saved = JSON.parse(world.getDynamicProperty("siege:plots_registry") ?? "[]");
    plots = Array.isArray(saved) ? saved : saved.plots ?? [];
  }
  return plots;
}

const REGISTRY_VERSION = 1; // raise it, and upgrade older saves in allPlots(), whenever a plot's saved shape changes
function savePlots() {
  world.setDynamicProperty("siege:plots_registry", JSON.stringify({ v: REGISTRY_VERSION, plots }));
}

export const mapMode = () => allPlots().length > 0;
const plotAtStone = (loc) => allPlots().find((p) => p.x === loc.x && p.y === loc.y && p.z === loc.z);

export function plotAt(loc) {
  return allPlots().find((p) => Math.hypot(loc.x - (p.x + 0.5), loc.z - (p.z + 0.5)) <= MAP.plotRadius);
}

const keeps = () => getState().keeps; // read only

// Owner id of the keep standing on this plot's stone, if any
export function holderOf(plot) {
  for (const [owner, k] of Object.entries(keeps())) {
    if (k.x === plot.x && k.y === plot.y + 1 && k.z === plot.z) return owner;
  }
  return undefined;
}

// ---------- NPC lords ----------
// For single-player and half-empty Realms, an NPC Rival Lord can hold a plot. This file only
// records who holds it; the settlement-building feature builds and runs the lord's settlement.
// npc = { id: "any unique string", name: "Lord Garrick" }

export const npcOf = (plot) => plot.npc;
export const isFree = (plot) => !holderOf(plot) && !plot.npc;

// Returns the plot, or undefined if it doesn't exist or isn't free
export function giveToNpc(plotName, npc) {
  const plot = allPlots().find((p) => p.name === plotName);
  if (!plot || !isFree(plot) || !npc?.id) return undefined;
  plot.npc = { id: String(npc.id), name: String(npc.name ?? "a rival lord") };
  plot.reservedFor = undefined;
  savePlots();
  emit("plotNpcClaimed", { plot, npc: plot.npc });
  return plot;
}

// Frees an NPC's plot (the lord was beaten, bought out or left). Returns the plot or undefined.
export function releaseNpc(plotName) {
  const plot = allPlots().find((p) => p.name === plotName);
  if (!plot?.npc) return undefined;
  const npc = plot.npc;
  plot.npc = undefined;
  savePlots();
  emit("plotNpcReleased", { plot, npc });
  return plot;
}

export const plotOf = (playerId) => allPlots().find((p) => holderOf(p) === playerId);
const isHeldAgainst = (plot, playerId) =>
  !!plot.reservedFor && plot.reservedFor !== playerId && world.getAbsoluteTime() < plot.reservedUntil;
export const freePlots = (player) => allPlots().filter((p) => isFree(p) && !isHeldAgainst(p, player.id));

export function compass(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"]; // +z is south in Minecraft
  const i = Math.round(Math.atan2(dz, dx) / (Math.PI / 4));
  return `${Math.round(Math.hypot(dx, dz))} blocks ${dirs[(i + 8) % 8]}`;
}

// ---------- Claiming: Keep Banners only go on free Plot Stones ----------

// Why this player can't raise a banner here, or undefined if they can
export function claimProblem(player, block) {
  if (!mapMode() || block.dimension.id !== OVERWORLD) return undefined;
  const below = block.below();
  const plot = below?.typeId === PLOT_STONE ? plotAtStone(below.location) : undefined;
  if (!plot) return "§cKeep Banners can only be raised on a Plot Stone. Click any Plot Stone to see the free plots.";
  const holder = holderOf(plot);
  if (holder && holder !== player.id) {
    return `§c${keeps()[holder].name} holds ${plot.name}. Ask them for a Writ of Alliance to build here together.`;
  }
  if (plot.npc) return `§c${plot.npc.name} holds ${plot.name}. Deal with them first.`;
  if (isHeldAgainst(plot, player.id)) {
    const days = Math.ceil((plot.reservedUntil - world.getAbsoluteTime()) / DAY_TICKS);
    return `§c${plot.name} is held for ${plot.reservedName} for ${days} more day${days === 1 ? "" : "s"}.`;
  }
  return undefined;
}

// Siege Nights asks this before founding (or moving) a settlement
addFoundingCheck((player, block) => claimProblem(player, block));

// Stop the banner going down at all where the game supports it, so it doesn't pop back out
world.beforeEvents.playerPlaceBlock?.subscribe((event) => {
  if (!isReady()) return;
  const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
  const player = event.player;
  if (typeId === PLOT_STONE && !isBuilder(player)) {
    event.cancel = true;
    return;
  }
  if (typeId !== KEEP_BANNER) return;
  const problem = claimProblem(player, event.block);
  if (!problem) return;
  event.cancel = true;
  system.run(() => player.onScreenDisplay.setActionBar(problem));
});

on("keepFounded", ({ player, keep }) => {
  const plot = allPlots().find((p) => keep.x === p.x && keep.y === p.y + 1 && keep.z === p.z);
  if (!plot) return;
  plot.reservedFor = undefined;
  plot.lastOwner = player.id;
  plot.lastOwnerName = player.name;
  savePlots();
  for (const p of world.getPlayers()) {
    if (p.id !== player.id) p.sendMessage(`§6${player.name} has claimed ${plot.name} in ${plot.region}.`);
  }
  player.sendMessage(`§6You hold ${plot.name}, ${plot.region}. Its building style: ${REGION_STYLE[plot.region] ?? "your own"}.`);
});

// ---------- Builder tools: placing, naming and removing Plot Stones ----------

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== PLOT_STONE) return;
  if (!isBuilder(player)) {
    block.setType("minecraft:air");
    return player.onScreenDisplay.setActionBar("§cPlot Stones are placed by the map builder in Creative.");
  }
  if (block.dimension.id !== OVERWORLD) {
    block.setType("minecraft:air");
    return player.sendMessage("§cPlot Stones only work in the Overworld.");
  }
  const loc = block.location;
  const tooClose = allPlots().find((p) => Math.hypot(p.x - loc.x, p.z - loc.z) < MAP.minPlotSpacing);
  if (tooClose) {
    block.setType("minecraft:air");
    return player.sendMessage(`§c${tooClose.name} is only ${Math.round(Math.hypot(tooClose.x - loc.x, tooClose.z - loc.z))} blocks away. Plots need at least ${MAP.minPlotSpacing}.`);
  }
  // Name it after the nearest unused planned plot
  const used = new Set(plots.map((p) => p.name));
  const pick = PLOT_PLAN.filter((n) => !used.has(n.name))
    .sort((a, b) => Math.hypot(a.x - loc.x, a.z - loc.z) - Math.hypot(b.x - loc.x, b.z - loc.z))[0];
  const plot = { name: pick?.name ?? `Plot ${plots.length + 1}`, region: pick?.region ?? "Uncharted", x: loc.x, y: loc.y, z: loc.z };
  plots.push(plot);
  savePlots();

  const near = plots.filter((p) => p !== plot && Math.hypot(p.x - loc.x, p.z - loc.z) < MAP.goodPlotSpacing);
  player.sendMessage(`§aPlot Stone set as ${plot.name} (${plot.region}) at ${loc.x} ${loc.y} ${loc.z}. ${plots.length} plot${plots.length === 1 ? "" : "s"} on the map. Click it to change which plot it is.`);
  if (near.length) player.sendMessage(`§eHeads up: ${near.map((p) => p.name).join(", ")} is closer than ${MAP.goodPlotSpacing} blocks.`);
  if (plots.length === 1) player.sendMessage("§eMap mode is on: Keep Banners now only go on Plot Stones, and the map edge is enforced.");
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (event.brokenBlockPermutation.type.id !== PLOT_STONE) return;
  const plot = plotAtStone(event.block.location);
  if (!plot) return;
  plots.splice(plots.indexOf(plot), 1);
  savePlots();
  event.player.sendMessage(`§ePlot ${plot.name} removed. ${plots.length} plot${plots.length === 1 ? "" : "s"} left.`);
});

// Plot Stones can't be mined or blown up (see the block file). If anything else moves one, put it back.
function restoreStones() {
  const dim = world.getDimension(OVERWORLD);
  for (const plot of allPlots()) {
    try {
      const block = dim.getBlock(plot);
      if (block && block.typeId !== PLOT_STONE) block.setType(PLOT_STONE);
    } catch {
      // not loaded
    }
  }
}

async function builderMenu(player, plot) {
  const used = new Set(plots.filter((p) => p !== plot).map((p) => p.name));
  const choices = PLOT_PLAN.filter((n) => !used.has(n.name));
  const form = new ModalFormData()
    .title(`Plot Stone: ${plot.name}`)
    .dropdown("Which plot is this?", choices.map((c) => `${c.name} (${c.region}, planned at ${c.x} ${c.z})`),
      { defaultValueIndex: Math.max(0, choices.findIndex((c) => c.name === plot.name)) });
  const res = await form.show(player);
  const pick = choices[res.formValues?.[0]];
  if (res.canceled || !pick) return;
  plot.name = pick.name;
  plot.region = pick.region;
  savePlots();
  player.sendMessage(`§aThis Plot Stone is now ${plot.name} (${plot.region}).`);
}

// ---------- Plot Stone menu and the Plot Atlas ----------

function statusOf(plot, viewer) {
  const holder = holderOf(plot);
  if (holder) {
    const keep = keeps()[holder];
    const n = keep.allies?.length ?? 0;
    const allies = n ? ` + ${n} all${n === 1 ? "y" : "ies"}` : "";
    return holder === viewer.id ? "§ayours" : `§6held by ${keep.name}${allies}`;
  }
  if (plot.npc) return `§cheld by ${plot.npc.name}`;
  if (isHeldAgainst(plot, viewer.id)) return `§7held for ${plot.reservedName}`;
  return "§afree";
}

export function showAtlas(player) {
  const lines = allPlots().map((p) => `§f${p.name}§7, ${p.region}: ${statusOf(p, player)}§7, ${compass(player.location, p)}`);
  new ActionFormData()
    .title("Plot Atlas")
    .body(`${freePlots(player).length} of ${plots.length} plots are free.\n\n${lines.join("\n")}\n\n§7Raise your Keep Banner on a free Plot Stone to claim it. Friends can share one plot with a Writ of Alliance.`)
    .button("Close")
    .show(player);
}

async function plotMenu(player, plot) {
  const holder = holderOf(plot);
  const body = [
    `§7Region: §f${plot.region}`,
    `§7Building style: §f${REGION_STYLE[plot.region] ?? "your own"}`,
    `§7Status: ${statusOf(plot, player)}`,
    `§7Land: grows to ${MAP.plotRadius} blocks from this stone when your settlement becomes a Castle`,
    "",
    holder
      ? "§7Its Keep Banner stands on this stone."
      : plot.npc
        ? `§7${plot.npc.name} rules here.`
      : plotOf(player.id)
        ? "§7You already hold a plot. Raising your banner here would move your settlement and leave your old plot."
        : "§7Place your Keep Banner on top of this stone to claim it.",
  ];
  const form = new ActionFormData().title(plot.name).body(body.join("\n")).button("Plot Atlas").button("Close");
  if (isBuilder(player)) form.button("Builder: set which plot this is");
  const res = await form.show(player);
  if (res.selection === 0) showAtlas(player);
  if (res.selection === 2) builderMenu(player, plot);
}

const lastClick = new Map();
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || block.typeId !== PLOT_STONE) return;
  if (system.currentTick - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, system.currentTick);
  const plot = plotAtStone(block.location);
  if (plot) plotMenu(player, plot);
  else if (isBuilder(player)) player.sendMessage("§eThis Plot Stone is only for show. Place one yourself in Creative to make a real plot.");
});

addKeepMenuButtons(({ player }) => (mapMode() ? [{ label: "Plot Atlas", action: () => showAtlas(player) }] : []));

// ---------- Held plots: a fallen or captured keep keeps its plot for a while ----------

function holdTick() {
  let changed = false;
  const now = world.getAbsoluteTime();
  for (const plot of allPlots()) {
    const holder = holderOf(plot);
    if (plot.lastOwner && !holder) {
      plot.reservedFor = plot.lastOwner;
      plot.reservedName = plot.lastOwnerName ?? "its old lord";
      plot.reservedUntil = now + MAP.reserveDays * DAY_TICKS;
      plot.lastOwner = undefined;
      changed = true;
      world.getPlayers().find((p) => p.id === plot.reservedFor)?.sendMessage(
        `§6${plot.name} is held for you for ${MAP.reserveDays} days. Raise a new Keep Banner on its Plot Stone to take it back.`);
    } else if (holder && (holder !== plot.lastOwner || plot.lastOwnerName !== keeps()[holder].name)) {
      plot.lastOwner = holder;
      plot.lastOwnerName = keeps()[holder].name;
      plot.reservedFor = undefined;
      changed = true;
    }
    // A hold ends when time runs out, or early if that player settles another plot
    if (plot.reservedFor && (now >= plot.reservedUntil || plotOf(plot.reservedFor))) {
      plot.reservedFor = undefined;
      changed = true;
    }
  }
  if (changed) savePlots();
}

// ---------- Walking the map: see free plots' edges and know where you are ----------

const lastPlot = new Map(); // player id -> name of the plot they're standing in

function plotEdgeTick() {
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== OVERWORLD) continue;
    const loc = player.location;
    const here = plotAt(loc);
    if ((here?.name ?? null) !== (lastPlot.get(player.id) ?? null)) {
      lastPlot.set(player.id, here?.name ?? null);
      // Claimed plots get Siege Nights' own "Entering X's Hamlet" message instead
      if (here && !holderOf(here)) {
        player.onScreenDisplay.setActionBar(`§fEntering ${here.name}, ${here.region} §7(${statusOf(here, player)}§7)`);
      }
    }
    // A free plot shows its full 80-block edge in green sparks near where you stand
    for (const plot of plots) {
      if (!isFree(plot)) continue; // claimed plots show their settlement border instead
      const cx = plot.x + 0.5;
      const cz = plot.z + 0.5;
      const r = MAP.plotRadius;
      if (Math.abs(Math.hypot(loc.x - cx, loc.z - cz) - r) > 12) continue;
      const angle = Math.atan2(loc.z - cz, loc.x - cx);
      for (let k = -8; k <= 8; k++) {
        const a = angle + (k * 1.5) / r;
        try {
          player.spawnParticle("minecraft:villager_happy", { x: cx + Math.cos(a) * r, y: loc.y + 0.5, z: cz + Math.sin(a) * r });
        } catch {
          // not loaded
        }
      }
    }
  }
}

onTick("plots_edges", 20, () => {
  if (isReady() && mapMode()) plotEdgeTick();
});
onTick("plots_holds", 40, () => {
  if (isReady() && mapMode()) holdTick();
});
onTick("plots_restore", 200, () => {
  if (isReady() && mapMode()) restoreStones();
});

// ---------- Showcase ----------
// A display Plot Stone. It's set by script, so it isn't registered and doesn't turn map mode on
// in the test world. Place your own in Creative to try claiming.
on("showcase", ({ dim, nextSpot, label }) => {
  const at = nextSpot();
  dim.getBlock(at)?.setType(PLOT_STONE);
  label(at, "Plot Stone\n(display only)\nPlace your own");
});
