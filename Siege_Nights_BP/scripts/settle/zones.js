// Build zones in the world: who may place a block where.
//
//   reserve   the ground your hall will grow into (nothing may be built there)
//   free      the rest of your land (build whatever you want)
//   wilds     outside any claim (no building, only making camp)
//
// Siege Nights' own protection still handles other players' land. This file adds the reserve and
// the wilds, and it is the only place those two rules are enforced.
//
// Other features can reserve ground too (the Citadel, a rail depot yard ...):
//   addFilter("settleReserves", (boxes, { owner }) => [...boxes, { x0, z0, x1, z1, label: "the Citadel" }])
//   addFilter("settleReservedAt", (found, { owner, location }) => found ?? (mine(location) ? { label: "your wall" } : undefined))
// and ask about a spot:
//   zoneAt(player, location)  ->  { zone: "free" | "reserve" | "wilds" | "foreign", owner?, label? }

import { world, system, GameMode, ItemStack, BlockTypes } from "@minecraft/server";
import { isReady, settlementAt, isAlly, homeOf, onTick, moduleStore } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { hallOf } from "../townhall/townhall.js";
import { mapMode } from "../plots/claims.js";
import { SETTLE } from "./config.js";
import { hallReserve, inBox, placeVerdict } from "./rules.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:settle_zones", () => ({ wilds: null }));

// "map" | "always" | "off": the world's own choice if one was made, else the setting
export const wildsMode = () => store.data.wilds ?? SETTLE.wilds;
export function setWildsMode(mode) {
  store.data.wilds = mode;
  store.save();
}
export function wildsClosed() {
  const mode = wildsMode();
  if (mode === "always") return true;
  if (mode !== "map") return false;
  try {
    return mapMode();
  } catch {
    return false;
  }
}

// Every reserved box on this owner's land
export function reservesOf(owner) {
  const boxes = [];
  const hall = hallOf(owner);
  if (hall && !hall.lost) boxes.push(hallReserve(hall));
  return applyFilter("settleReserves", boxes, { owner });
}

// Reserves that are not boxes (the line of the wall) answer through "settleReservedAt": return { label } or nothing
export const reserveAt = (owner, location) =>
  reservesOf(owner).find((box) => inBox(box, location)) ?? applyFilter("settleReservedAt", undefined, { owner, location });

export function zoneAt(player, location, dimensionId = OVERWORLD) {
  if (dimensionId !== OVERWORLD) return { zone: "free" };
  const owner = settlementAt(location);
  if (!owner) return { zone: "wilds" };
  if (owner !== player.id && !isAlly(owner, player.id)) return { zone: "foreign", owner };
  const reserve = reserveAt(owner, location);
  return reserve ? { zone: "reserve", owner, label: reserve.label } : { zone: "free", owner };
}

// Why this player can't place this block here, or undefined
export function placeProblem(player, location, dimensionId, typeId) {
  if (!isReady()) return undefined;
  const creative = player.getGameMode() === GameMode.Creative;
  if (creative || dimensionId !== OVERWORLD) return undefined;
  const land = settlementAt(location);
  const mine = !!land && (land === player.id || isAlly(land, player.id));
  return placeVerdict({
    creative, overworld: true, typeId, land, mine,
    reserve: mine ? reserveAt(land, location)?.label : undefined,
    wildsClosed: !land && wildsClosed(),
    hasKeep: !!homeOf(player.id), // own settlement, or one they are a writ ally of
  });
}

// ---------- enforcing it ----------

const before = world.beforeEvents.playerPlaceBlock;
if (before) {
  before.subscribe((event) => {
    const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
    if (!typeId) return;
    const player = event.player;
    const problem = placeProblem(player, event.block.location, event.block.dimension.id, typeId);
    if (!problem) return;
    event.cancel = true;
    system.run(() => player.onScreenDisplay.setActionBar(problem.message));
  });
} else {
  // Game versions without the "before place" event: take the block back out and return it
  world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
    const problem = placeProblem(player, block.location, block.dimension.id, block.typeId);
    if (!problem) return;
    let refund;
    try {
      refund = block.getItemStack(1);
    } catch {
      refund = new ItemStack(block.typeId, 1);
    }
    block.setType("minecraft:air");
    if (refund) player.getComponent("minecraft:inventory").container.addItem(refund);
    player.onScreenDisplay.setActionBar(problem.message);
  });
}

// ---------- showing the reserve ----------
// While you hold a block near the edge of a reserve on your land, its edge is drawn in blue flame.

function edgePoints(box, loc, reach = 10) {
  const pts = [];
  const xa = Math.max(box.x0, Math.floor(loc.x) - reach), xb = Math.min(box.x1 + 1, Math.floor(loc.x) + reach);
  const za = Math.max(box.z0, Math.floor(loc.z) - reach), zb = Math.min(box.z1 + 1, Math.floor(loc.z) + reach);
  for (const z of [box.z0, box.z1 + 1]) if (Math.abs(z - loc.z) <= reach) for (let x = xa; x <= xb; x++) pts.push({ x, z });
  for (const x of [box.x0, box.x1 + 1]) if (Math.abs(x - loc.x) <= reach) for (let z = za; z <= zb; z++) pts.push({ x, z });
  return pts;
}

export function drawBox(player, box, particle = "minecraft:blue_flame_particle", reach = 10) {
  const loc = player.location;
  for (const pt of edgePoints(box, loc, reach)) {
    try {
      player.spawnParticle(particle, { x: pt.x, y: Math.floor(loc.y) + 0.3, z: pt.z });
    } catch {
      // not loaded
    }
  }
}

function holdsBlock(player) {
  try {
    const held = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex);
    return !!held && !!BlockTypes.get(held.typeId);
  } catch {
    return false;
  }
}

function reserveTick() {
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== OVERWORLD || !holdsBlock(player)) continue;
    const owner = settlementAt(player.location);
    if (!owner || (owner !== player.id && !isAlly(owner, player.id))) continue;
    for (const box of reservesOf(owner)) drawBox(player, box);
  }
}

onTick("settle_reserve_edges", 20, () => {
  if (isReady()) reserveTick();
});

// /scriptevent siege:settle_zone            what zone you stand in
// /scriptevent siege:settle_wilds on|off|map   may people build outside their land in this world
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  if (event.id === "siege:settle_zone") {
    const z = zoneAt(player, player.location, player.dimension.id);
    const text = {
      free: z.owner ? "§aFree-build ground. Build whatever you want here." : "§aNo build rules in this dimension.",
      reserve: `§eReserve: kept clear for ${z.label} to grow into. Nothing can be built here.`,
      wilds: wildsClosed() ? "§7The wilds. No building here, only making camp." : "§7The wilds. Building is allowed here in this world (no Plot Stones yet).",
      foreign: "§cSomeone else's land.",
    }[z.zone];
    player.sendMessage(text);
    if (z.owner) for (const box of reservesOf(z.owner)) player.sendMessage(`§7Reserve for ${box.label}: x ${box.x0} to ${box.x1}, z ${box.z0} to ${box.z1}`);
  }
  if (event.id === "siege:settle_wilds") {
    const mode = { on: "always", always: "always", off: "off", map: "map" }[event.message.trim()];
    if (!mode) return player.sendMessage(`§7Building in the wilds is "${wildsMode()}". Use on, off or map.`);
    setWildsMode(mode);
    player.sendMessage({ always: "§6Nobody can build outside their own land now.", off: "§6Building in the wilds is allowed.", map: "§6Building in the wilds is forbidden once the map has Plot Stones." }[mode]);
  }
});
