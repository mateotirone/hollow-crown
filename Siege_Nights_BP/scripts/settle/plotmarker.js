// The Plot Marker: a post at the front of every open slot in a town laid out from its layout (founding.js).
// Use it to see what can go on that slot: only the buildings that fit it and that the settlement's tier has
// opened. Pick one and its outline shows on the slot; use the marker again to pay and raise it. Each building has
// one price in Regals (SETTLE.plotPrices), paid from the purse. Once a building stands, its marker moves beside the
// door and offers the owner to knock the building down (half the price comes back to the owner).
//
// Test: /scriptevent siege:town found dunehold   then walk to a marker and use it.

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, isAlly, on, onTick } from "../siege/api.js";
import { purse, charge, refund, coins, lot } from "./wallet.js";
import { STYLES } from "../townhall/styles.js";
import { SETTLE } from "./config.js";
import { BUILDINGS, BUILDING, drawBuilding } from "./buildings.js";
import { SLOTS } from "./layout.js";
import { drawBox } from "./zones.js";
import { raiseOnSlot, risingAt, jobOf } from "./plans.js";
import { PLOT_MARKER, townOf, allTowns, layoutOf, markerAt, registerMarker, forgetMarker, placeMarker, clearMarker, slotState, saveTowns, tierName } from "./founding.js";
import { slotsOf, seatOnSlot, seatedBox, SIZE_NAMES } from "./towns.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
const isCreative = (player) => player.getGameMode() === GameMode.Creative;

// The tier that opens each building: the earliest slot it had in the old fixed layout
export const OPENS_AT = Object.fromEntries(BUILDINGS.map((b) => [b.id, Math.min(...SLOTS.filter((s) => s.building === b.id).map((s) => s.tier), 3)]));

const slotById = (owner, id) => slotsOf(layoutOf(townOf(owner))).find((s) => s.id === id);

// Where a design stands on a slot, in the world, or undefined if it doesn't fit
export function seatInWorld(owner, slot, buildingId) {
  const town = townOf(owner);
  const plan = drawBuilding(buildingId, town.style);
  const seat = seatOnSlot(slot, plan.bounds());
  if (!seat) return undefined;
  const origin = { x: town.x + seat.origin.dx, y: town.y + seat.origin.dy, z: town.z + seat.origin.dz };
  const box = seatedBox(seat, plan.bounds());
  return { origin, forward: seat.forward, box: { x0: town.x + box.x0, z0: town.z + box.z0, x1: town.x + box.x1, z1: town.z + box.z1 }, plan };
}

// What a player could put on a slot: [{ id, name, fits, open, why }]
export function choicesFor(owner, slot) {
  const tier = townOf(owner)?.tier ?? 0;
  return BUILDINGS.map((b) => {
    const fits = !!seatInWorld(owner, slot, b.id);
    const open = OPENS_AT[b.id] <= tier;
    return { id: b.id, name: b.name, fits, open, why: !fits ? "too big for this plot" : !open ? `opens at ${tierName(OPENS_AT[b.id])}` : "" };
  }).filter((c) => c.fits);
}

// Where the marker goes once a building stands: just outside the plot, two blocks to the side of the door
function besideDoor(owner, slot) {
  const town = townOf(owner);
  const R = { x: -slot.door.z, z: slot.door.x };
  const x = town.x + slot.step.x + 2 * R.x, z = town.z + slot.step.z + 2 * R.z;
  const dim = world.getDimension(OVERWORLD);
  try {
    let block = dim.getTopmostBlock({ x, z });
    for (let i = 0; block && i < 12 && /(air|grass$|short_grass|flower|fern|snow_layer|lantern|fence)/.test(block.typeId); i++) block = block.below();
    return block ? { x, y: block.location.y + 1, z } : undefined;
  } catch {
    return undefined;
  }
}

// ---------- the menus ----------

async function openSlot(player, owner, slot) {
  const state = slotState(owner, slot.id);
  const town = townOf(owner);
  if (state.building && risingAt(state.origin)) return player.onScreenDisplay.setActionBar(`§7The ${BUILDING[state.building].name} is still going up.`);
  if (state.building) return builtMenu(player, owner, slot, state);
  if (state.pick && system.currentTick - (state.pickedAt ?? 0) <= SETTLE.previewSeconds * 20 && state.by === player.id) return confirm(player, owner, slot, state);
  const size = `${slot.box.x1 - slot.box.x0 + 1} x ${slot.box.z1 - slot.box.z0 + 1}`;
  const choices = choicesFor(owner, slot);
  const form = new ActionFormData().title(`${SIZE_NAMES[slot.size]} plot`)
    .body(`${size} blocks, door to the road${slot.tags.length ? ` (${slot.tags.join(", ")})` : ""}.\nBuildings in the §f${STYLES[town.style]?.name ?? town.style}§r style that fit here:`);
  if (!choices.length) return player.sendMessage("§7Nothing we can raise fits this plot yet. You can build here by hand.");
  for (const c of choices) {
    form.button(c.open ? `${c.name}\n§8${coins(plotPrice(c.id))}` : `§8${c.name}\n${c.why}`);
  }
  const res = await form.show(player);
  if (res.canceled) return;
  const c = choices[res.selection];
  if (!c.open) return player.sendMessage(`§7The ${c.name} ${c.why}. Win more sieges to grow the settlement.`);
  Object.assign(state, { pick: c.id, pickedAt: system.currentTick, by: player.id });
  saveTowns();
  player.sendMessage(`§6${c.name} marked out.§7 Walk round the green outline, then use the marker again to raise it. ${BUILDING[c.id].blurb ?? ""}`);
}

// What a design costs on a plot, in coins (SETTLE.plotPrices is in lots)
export const plotPrice = (buildingId) => Math.round((SETTLE.plotPrices[buildingId] ?? 8) * lot());

async function confirm(player, owner, slot, state) {
  const town = townOf(owner);
  const building = BUILDING[state.pick];
  const seat = seatInWorld(owner, slot, building.id);
  if (!seat) { state.pick = undefined; saveTowns(); return player.sendMessage("§cThat building no longer fits here."); }
  const free = isCreative(player);
  const price = free ? 0 : plotPrice(building.id);
  const have = purse(player);
  const body = [`${building.blurb ?? ""}`, "", free ? "§aFree in Creative." : `${have >= price ? "§a" : "§c"}${coins(price)}§7 from your purse (you have ${coins(have)}).`, "", "§7Builders raise it for you. It goes up a layer at a time."];
  const res = await new MessageFormData().title(`Raise the ${building.name}?`).body(body.join("\n"))
    .button1("Pick something else").button2(free || have >= price ? "Raise it" : "Not enough yet").show(player);
  if (res.canceled) return;
  if (res.selection === 0) { state.pick = undefined; saveTowns(); return openSlot(player, owner, slot); }
  if (!free) {
    if (have < price) return player.sendMessage(`§7You are ${coins(price - have)} short.`);
    if (!charge(player, price)) return;
  }
  clearMarker(owner, slot);
  const built = raiseOnSlot(owner, player.id, seat.origin, seat.forward, building.id, town.style, slot.id);
  if (!built) {
    placeMarker(owner, slot);
    if (price) refund(player, price);
    return player.sendMessage("§cSomething is already going up there.");
  }
  Object.assign(state, { building: building.id, style: town.style, origin: seat.origin, forward: seat.forward, box: seat.box, top: seat.plan.bounds().y1 + Math.max(0, built.lift ?? 0), paid: price, by: player.id, pick: undefined });
  saveTowns();
  sfx(player, "random.anvil_use");
  player.sendMessage(`§6The ${building.name} is going up.`);
}

async function builtMenu(player, owner, slot, state) {
  const name = BUILDING[state.building]?.name ?? "building";
  if (player.id !== owner) return player.sendMessage(`§7This ${name} stands. Only the town's owner can knock it down.`);
  const back = Math.floor((state.paid ?? 0) / 2);
  const res = await new MessageFormData().title(name)
    .body(`This plot holds your ${name}.\n\nKnock it down to free the plot for something else. Everything above the floor is cleared${back ? `, and ${coins(back)} come back` : ""}.`)
    .button1("Leave it").button2("Knock it down").show(player);
  if (res.canceled || res.selection !== 1) return;
  demolish(owner, slot, state, player);
}

export function demolish(owner, slot, state, player) {
  const back = Math.floor((state.paid ?? 0) / 2);
  const { box, origin, top = 12 } = state;
  const spot = state.marker;
  if (spot) {
    forgetMarker(spot);
    try { const b = world.getDimension(OVERWORLD).getBlock(spot); if (b?.typeId === PLOT_MARKER) b.setType("minecraft:air"); } catch { /* not loaded */ }
  }
  for (const k of Object.keys(state)) delete state[k];
  saveTowns();
  const payee = player?.id === owner ? player : world.getPlayers().find((p) => p.id === owner);
  if (back && payee) refund(payee, back);
  system.runJob((function* clear() {
    const dim = world.getDimension(OVERWORLD);
    let cells = [];
    for (let y = origin.y; y <= origin.y + top + 1; y++) for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) cells.push({ x, y, z });
    let n = 0;
    for (let pass = 0; pass < 60 && cells.length; pass++) { // unloaded chunks: try again a little later
      const later = [];
      for (const at of cells) {
        if (++n % 300 === 0) yield;
        let b;
        try { b = dim.getBlock(at); } catch { b = undefined; }
        if (!b) { later.push(at); continue; }
        try { if (!b.isAir) b.setType("minecraft:air"); } catch { /* protected block */ }
      }
      cells = later;
      if (cells.length) for (let i = 0; i < 40; i++) yield; // ~2 s
    }
    placeMarker(owner, slot);
    if (player?.isValid) player.sendMessage("§7The plot is clear.");
  })());
}

// ---------- the block ----------

const lastClick = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== PLOT_MARKER || event.isFirstEvent === false) return;
  if (system.currentTick - (lastClick.get(player.id) ?? -100) < 8) return;
  lastClick.set(player.id, system.currentTick);
  event.cancel = true;
  const at = { ...block.location };
  system.run(() => {
    if (!isReady()) return;
    const mark = markerAt(at);
    if (!mark) return player.sendMessage("§7This marker belongs to no town.");
    if (mark.owner !== player.id && !isAlly(mark.owner, player.id)) return player.sendMessage("§7This is not your town to build in.");
    const slot = slotById(mark.owner, mark.slot);
    if (!slot) return;
    openSlot(player, mark.owner, slot).catch((e) => console.warn(`[Hollow Crown] plot marker: ${e}`));
  });
});

// When a building on a slot is finished, its marker goes up beside the door
on("settleBuilt", ({ owner, slotId }) => {
  if (!slotId || !townOf(owner)) return;
  const slot = slotById(owner, slotId);
  const state = slotState(owner, slotId);
  if (!slot || !state.building) return;
  const spot = besideDoor(owner, slot);
  if (!spot) return;
  try {
    world.getDimension(OVERWORLD).getBlock(spot)?.setType(PLOT_MARKER);
    registerMarker(spot, owner, slotId);
    state.marker = spot;
    saveTowns();
  } catch {
    // not loaded: the plot can still be managed from the town hall later
  }
});

// Every town starts with its library (the lore feature stocks it from settleBuilt): on the slot tagged for it, else the square
on("townLaidOut", ({ owner, tier }) => {
  const town = townOf(owner);
  if (tier !== 0 || !town || !BUILDING.library || Object.values(town.slots).some((s) => s.building === "library")) return;
  const slots = slotsOf(layoutOf(town)).filter((s) => s.tier === 0 && !town.slots[s.id]?.building && seatInWorld(owner, s, "library"));
  const slot = slots.find((s) => s.tags.includes("library")) ?? slots.find((s) => s.tags.includes("square")) ?? slots[0];
  if (!slot) return;
  const seat = seatInWorld(owner, slot, "library");
  clearMarker(owner, slot);
  const built = raiseOnSlot(owner, owner, seat.origin, seat.forward, "library", town.style, slot.id, { quiet: true });
  if (!built) return placeMarker(owner, slot);
  Object.assign(slotState(owner, slot.id), { building: "library", style: town.style, origin: seat.origin, forward: seat.forward, box: seat.box, top: seat.plan.bounds().y1 + Math.max(0, built.lift ?? 0), paid: 0 });
  saveTowns();
});

// The outline of a picked building, for the player who picked it
function outlines() {
  const now = system.currentTick;
  for (const [owner, town] of Object.entries(allTowns())) {
    for (const [id, state] of Object.entries(town.slots)) {
      if (!state.pick || state.building) continue;
      if (now - (state.pickedAt ?? now) > SETTLE.previewSeconds * 20 || now < (state.pickedAt ?? 0)) { state.pick = undefined; continue; }
      const player = world.getPlayers().find((p) => p.id === state.by);
      const slot = player && slotById(owner, id);
      const seat = slot && seatInWorld(owner, slot, state.pick);
      if (seat && player.dimension.id === OVERWORLD) drawBox(player, seat.box, "minecraft:villager_happy", 40);
    }
  }
}
// How far each building on a plot has got, on the action bar of whoever paid for it while they are near
function progress() {
  for (const [owner, town] of Object.entries(allTowns())) {
    for (const state of Object.values(town.slots)) {
      if (!state.building || !state.origin) continue;
      const job = jobOf(state.origin);
      if (!job?.cells?.length) continue;
      const player = world.getPlayers().find((p) => p.id === (state.by ?? owner));
      if (!player || Math.hypot(player.location.x - state.origin.x, player.location.z - state.origin.z) > 64) continue;
      player.onScreenDisplay.setActionBar(`§6${BUILDING[state.building]?.name ?? "Building"} rising §f${Math.floor((job.index / job.cells.length) * 100)}%`);
    }
  }
}
onTick("settle_plot_outlines", 20, () => {
  if (!isReady()) return;
  outlines();
  progress();
});
