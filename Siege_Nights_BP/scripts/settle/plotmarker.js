// The Plot Marker: a post at the front of every open slot in a town laid out from its layout (founding.js).
// Use it to see what can go on that slot: only the buildings that fit it and that the settlement's tier has
// opened. Pick one and its outline shows on the slot; use the marker again to pay and raise it. Each building has
// one price in Regals (SETTLE.plotPrices), paid from the purse. Once a building stands, its marker moves beside the
// door and offers the owner to knock the building down (half the price comes back to the owner).
//
// Test: /scriptevent siege:town found dunehold   then walk to a marker and use it.

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, isAlly, on, emit, onTick } from "../siege/api.js";
import { purse, charge, refund, coins, lot } from "./wallet.js";
import { STYLES } from "../townhall/styles.js";
import { SETTLE, TAG_WORDS, HAND_NAMES, PLANS } from "./config.js";
import { planChoices } from "./plandata.js";
import { plansFor } from "./planbook.js";
import { BUILDINGS, BUILDING, drawBuilding } from "./buildings.js";
import { plotFit, opensAt, slotClass, CLASS_NAMES } from "./charters.js";
import { drawBox } from "./zones.js";
import { raiseOnSlot, risingAt, jobOf } from "./plans.js";
import { PLOT_MARKER, townOf, allTowns, layoutOf, markerAt, registerMarker, forgetMarker, placeMarker, clearMarker, slotState, saveTowns, tierName, slotClosed, keptFor } from "./founding.js";
import { slotsOf, seatOnSlot, seatedBox, SIZE_NAMES } from "./towns.js";
import { runScan } from "./register.js";
import { matches } from "./census.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
const isCreative = (player) => player.getGameMode() === GameMode.Creative;

const slotById = (owner, id) => slotsOf(layoutOf(townOf(owner))).find((s) => s.id === id);

// Where a design stands on a slot, in the world, or undefined if it doesn't fit
export function seatInWorld(owner, slot, buildingId, style) {
  const town = townOf(owner);
  const plan = drawBuilding(buildingId, style ?? town.style);
  const seat = seatOnSlot(slot, plan.bounds());
  if (!seat) return undefined;
  const origin = { x: town.x + seat.origin.dx, y: town.y + seat.origin.dy, z: town.z + seat.origin.dz };
  const box = seatedBox(seat, plan.bounds());
  return { origin, forward: seat.forward, box: { x0: town.x + box.x0, z0: town.z + box.z0, x1: town.x + box.x1, z1: town.z + box.z1 }, plan };
}

// The classes of the town's open plots that are still empty (for the barracks' plain-Medium fallback)
function freeClasses(owner, except) {
  const town = townOf(owner);
  const out = new Set();
  for (const s of slotsOf(layoutOf(town))) {
    if (s.id === except || s.tier > (town?.tier ?? 0) || slotClosed(owner, s)) continue;
    const st = town.slots[s.id];
    if (!st?.building) out.add(slotClass(s));
  }
  return out;
}

// What a player could put on a slot: [{ id, style, foreign, name, fits, open, why, tagged }]. Only buildings
// whose plan is known (planbook.js: the player's own plans and the town owner's), of the plot's size class
// (config.js PLOT_SIZE), that physically fit are listed; one that needs a different spot (PLOT_TAGS) or a later
// tier is listed greyed with the reason. Good spots for a building come first. A plan in another region's
// style is offered too, at a higher price. hidden: how many buildings would suit the plot without a plan.
export function choicesFor(owner, slot, player) {
  const town = townOf(owner);
  const tier = town?.tier ?? 0;
  const free = freeClasses(owner, slot.id);
  const known = plansFor([owner, player?.id].filter(Boolean), player ? isCreative(player) : false);
  const offers = planChoices(known, town.style, BUILDINGS.map((b) => b.id));
  const out = [];
  for (const { id, style, foreign } of offers) {
    const b = BUILDING[id];
    const rule = plotFit(id, slot, free);
    if (!rule.ok && !rule.tagged) continue; // not this plot's size
    if (!seatInWorld(owner, slot, id, style)) continue;
    const open = opensAt(id) <= tier;
    const kept = rule.ok && open ? keptFor(owner, slot, id) : undefined; // the plot is the last one a charter need can use
    const why = !rule.ok ? rule.why : !open ? `opens at ${tierName(opensAt(id))}` : kept ?? "";
    const name = foreign ? `${b.name} (${STYLES[style]?.name ?? style})` : b.name;
    out.push({ id, style, foreign, name, fits: true, open: open && rule.ok && !kept, why, tagged: rule.tagged && rule.ok });
  }
  out.hidden = BUILDINGS.filter((b) => !offers.some((o) => o.id === b.id) && plotFit(b.id, slot, free).ok).length;
  return out.sort((a, b) => (b.open - a.open) || (b.tagged - a.tagged) || (a.foreign - b.foreign));
}

// Ground the marker shouldn't stand on: roads, door steps, paving, water
const NOT_FOR_MARKER = /(path|slab|stairs|gravel|cobble|brick|planks|_wall|fence|water|lava|farmland|tiles|polished)/;
const SKIP_UP = /(air|grass$|short_grass|tall_grass|flower|fern|snow_layer|lantern|torch)/;

// Where the marker goes once a building stands: just outside the plot beside the door, never on the road or the
// door path. Tries two blocks either side of the door step, then three, then one block back from the road.
function besideDoor(owner, slot) {
  const town = townOf(owner);
  const R = { x: -slot.door.z, z: slot.door.x };
  const D = slot.door;
  const sx = town.x + slot.step.x, sz = town.z + slot.step.z;
  const walk = new Set((slot.walk ?? []).map((w) => `${town.x + w.x},${town.z + w.z}`));
  const box = { x0: town.x + slot.box.x0, z0: town.z + slot.box.z0, x1: town.x + slot.box.x1, z1: town.z + slot.box.z1 };
  const tries = [];
  for (const k of [2, -2, 3, -3, 4, -4]) tries.push({ x: sx + k * R.x, z: sz + k * R.z });
  for (const k of [2, -2]) tries.push({ x: sx + k * R.x + D.x, z: sz + k * R.z + D.z }); // a step out from the plot
  const dim = world.getDimension(OVERWORLD);
  let fallback;
  for (const { x, z } of tries) {
    if (walk.has(`${x},${z}`) || (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1)) continue;
    try {
      let block = dim.getTopmostBlock({ x, z });
      for (let i = 0; block && i < 12 && SKIP_UP.test(block.typeId); i++) block = block.below();
      if (!block) continue;
      const spot = { x, y: block.location.y + 1, z };
      if (!NOT_FOR_MARKER.test(block.typeId)) return spot;
      fallback ??= spot;
    } catch {
      // not loaded
    }
  }
  return fallback;
}

// ---------- the menus ----------

async function openSlot(player, owner, slot) {
  const state = slotState(owner, slot.id);
  const town = townOf(owner);
  if (slotClosed(owner, slot) && !state.building) { clearMarker(owner, slot); return player.sendMessage("§7The town hall has taken this ground. The plot is gone."); }
  if (state.building && risingAt(state.origin)) return player.onScreenDisplay.setActionBar(`§7The ${nameOf(state.building)} is still going up.`);
  if (state.building) return builtMenu(player, owner, slot, state);
  if (state.pick && system.currentTick - (state.pickedAt ?? 0) <= SETTLE.previewSeconds * 20 && state.by === player.id) return confirm(player, owner, slot, state);
  const size = `${slot.box.x1 - slot.box.x0 + 1} x ${slot.box.z1 - slot.box.z0 + 1}`;
  const choices = choicesFor(owner, slot, player);
  const form = new ActionFormData().title(`${CLASS_NAMES[slotClass(slot)] ?? SIZE_NAMES[slot.size]} plot`)
    .body(`${size} blocks, door to the road${slot.tags.length ? `, ${slot.tags.map((t) => TAG_WORDS[t]).filter(Boolean).join(", ")}` : ""}.\nBuildings you have plans for that fit here:${choices.hidden ? `\n§8(${choices.hidden} more would suit this plot. Find their plans: toppled lords, bosses, Rumor jobs, traders.)` : ""}`);
  const own = player.id === owner || isAlly(owner, player.id);
  if (!choices.length && !own) return player.sendMessage("§7Nothing we can raise fits this plot yet.");
  if (own) form.button("§2I built here myself\n§8Have it counted as a building");
  for (const c of choices) {
    form.button(c.open ? `${c.name}${c.tagged ? " §2(good spot)" : ""}\n§8${coins(plotPrice(c.id, c.foreign))}` : `§8${c.name}\n${c.why}`);
  }
  const res = await form.show(player);
  if (res.canceled) return;
  if (own && res.selection === 0) return registerOwn(player, owner, slot);
  const c = choices[res.selection - (own ? 1 : 0)];
  if (!c) return;
  if (!c.open) return player.sendMessage(/^Kept/.test(c.why) ? `§7${c.why}: this is the last plot it can go on. Raise that here, or another building on a different plot.` : `§7The ${c.name} ${c.why}.${/^opens/.test(c.why) ? " Win more sieges to grow the settlement." : " Try another plot."}`);
  Object.assign(state, { pick: c.id, pickStyle: c.style, pickedAt: system.currentTick, by: player.id });
  saveTowns();
  player.sendMessage(`§6${c.name} marked out.§7 Walk round the green outline, then use the marker again to raise it. ${BUILDING[c.id].blurb ?? ""}`);
}

// What a design costs on a plot, in coins (SETTLE.plotPrices is in lots)
export const plotPrice = (buildingId, foreign = false) => Math.round((SETTLE.plotPrices[buildingId] ?? 8) * lot() * (foreign ? PLANS.foreignMul : 1));

async function confirm(player, owner, slot, state) {
  const town = townOf(owner);
  const building = BUILDING[state.pick];
  const style = state.pickStyle ?? town.style;
  const foreign = style !== town.style;
  const seat = seatInWorld(owner, slot, building.id, style);
  if (!seat) { state.pick = undefined; saveTowns(); return player.sendMessage("§cThat building no longer fits here."); }
  const credit = (town.credits?.[slotClass(slot)] ?? 0) > 0; // the hall took a plot of this size: one is on the house
  const free = isCreative(player) || credit;
  const price = free ? 0 : plotPrice(building.id, foreign);
  const have = purse(player);
  const body = [`${building.blurb ?? ""}`, "", credit ? "§aFree: this makes up for the plot your town hall took." : free ? "§aFree in Creative." : `${have >= price ? "§a" : "§c"}${coins(price)}§7 from your purse (you have ${coins(have)}).`, "", "§7Builders raise it for you. It goes up a layer at a time."];
  const res = await new MessageFormData().title(`Raise the ${building.name}${foreign ? ` (${STYLES[style]?.name ?? style})` : ""}?`).body(body.join("\n"))
    .button1("Pick something else").button2(free || have >= price ? "Raise it" : "Not enough yet").show(player);
  if (res.canceled) return;
  if (res.selection === 0) { state.pick = undefined; saveTowns(); return openSlot(player, owner, slot); }
  if (!free) {
    if (have < price) return player.sendMessage(`§7You are ${coins(price - have)} short.`);
    if (!charge(player, price)) return;
  }
  clearMarker(owner, slot);
  const built = raiseOnSlot(owner, player.id, seat.origin, seat.forward, building.id, style, slot.id);
  if (!built) {
    placeMarker(owner, slot);
    if (price) refund(player, price);
    return player.sendMessage("§cSomething is already going up there.");
  }
  if (credit) { town.credits[slotClass(slot)]--; if (!town.credits[slotClass(slot)]) delete town.credits[slotClass(slot)]; }
  Object.assign(state, { building: building.id, style, origin: seat.origin, forward: seat.forward, box: seat.box, top: seat.plan.bounds().y1 + Math.max(0, built.lift ?? 0), paid: price, by: player.id, pick: undefined, pickStyle: undefined, done: false, lift: Math.max(0, built.lift ?? 0) });
  saveTowns();
  sfx(player, "random.anvil_use");
  player.sendMessage(`§6The ${building.name} is going up.`);
}

// A building the player made by hand on an empty plot: check what it holds and count it as that building
const nameOf = (id) => BUILDING[id]?.name ?? HAND_NAMES[id] ?? id;

async function registerOwn(player, owner, slot) {
  player.sendMessage("§7Looking over the plot...");
  const t = await runScan(owner, slot.id);
  if (!player.isValid) return;
  if (!t) return player.sendMessage("§7Part of the plot isn't loaded. Stand closer and try again.");
  const free = freeClasses(owner, slot.id);
  const fitsHere = (id) => plotFit(id, slot, free).ok && opensAt(id) <= (townOf(owner)?.tier ?? 0);
  const all = matches(t);
  const fitting = all.filter((m) => m.ok && fitsHere(m.id));
  const good = fitting.filter((m) => !keptFor(owner, slot, m.id)); // the same rule as the plot menu
  if (!good.length && fitting.length) return player.sendMessage(`§7This plot can't count as ${fitting.map((m) => nameOf(m.id)).join(" or ")}: ${keptFor(owner, slot, fitting[0].id)}, and it is the last plot that can hold it.`);
  if (!good.length) {
    const near = all.filter((m) => fitsHere(m.id)).sort((a, b) => a.missing.length - b.missing.length).slice(0, 3);
    const lines = near.map((m) => `§f${nameOf(m.id)}§7: needs ${m.says} (${m.missing.join(", ")})`);
    return player.sendMessage(`§7This doesn't count as a building yet.${lines.length ? "\n" + lines.join("\n") : " Nothing that suits this plot could be found."}`);
  }
  let pick = good[0];
  if (good.length > 1) {
    const form = new ActionFormData().title("What is it?").body("What you built here could count as:");
    for (const m of good) form.button(nameOf(m.id));
    const res = await form.show(player);
    if (res.canceled) return;
    pick = good[res.selection];
  }
  const town = townOf(owner);
  const state = slotState(owner, slot.id);
  if (state.building) return player.sendMessage("§7Something already stands on this plot.");
  const box = { x0: town.x + slot.box.x0, z0: town.z + slot.box.z0, x1: town.x + slot.box.x1, z1: town.z + slot.box.z1 };
  clearMarker(owner, slot);
  Object.assign(state, { building: pick.id, hand: true, done: true, box, origin: { x: box.x0, y: town.y + slot.dy, z: box.z0 }, by: player.id, pick: undefined, paid: 0 });
  saveTowns();
  sfx(player, "random.levelup");
  player.sendMessage(`§6Your ${nameOf(pick.id)} is counted.§7 Keep what it needs inside, or it stops counting.`);
  markerBesideDoor(owner, slot, state);
  emit("settleCharter", { owner });
}

async function builtMenu(player, owner, slot, state) {
  if (state.hand) return handMenu(player, owner, slot, state);
  const name = nameOf(state.building);
  if (player.id !== owner) return player.sendMessage(`§7This ${name} stands. Only the town's owner can knock it down.`);
  const back = Math.floor((state.paid ?? 0) / 2);
  const res = await new MessageFormData().title(name)
    .body(`This plot holds your ${name}.\n\nKnock it down to free the plot for something else. Everything above the floor is cleared${back ? `, and ${coins(back)} come back` : ""}.`)
    .button1("Leave it").button2("Knock it down").show(player);
  if (res.canceled || res.selection !== 1) return;
  demolish(owner, slot, state, player);
}

// Your own build: un-count it (the blocks stay) or check it again
async function handMenu(player, owner, slot, state) {
  const name = nameOf(state.building);
  if (player.id !== owner) return player.sendMessage(`§7This ${name} was built by hand${state.broken ? ", and is missing what it needs" : ""}.`);
  const res = await new ActionFormData().title(name)
    .body(`You built this ${name} yourself.${state.broken ? "\n\n§cIt doesn't count right now:§r something it needs is gone." : ""}`)
    .button("Check it again").button("Stop counting it\n§8The blocks stay").show(player);
  if (res.canceled) return;
  if (res.selection === 0) {
    const t = await runScan(owner, slot.id);
    if (!t) return player.sendMessage("§7Part of the plot isn't loaded. Stand closer and try again.");
    const m = matches(t).find((x) => x.id === state.building);
    state.broken = !m?.ok;
    saveTowns();
    emit("settleCharter", { owner });
    return player.sendMessage(m?.ok ? `§aThe ${name} counts.` : `§7The ${name} needs ${m?.says} (${m?.missing.join(", ")}).`);
  }
  const spot = state.marker;
  if (spot) {
    forgetMarker(spot);
    try { const b = world.getDimension(OVERWORLD).getBlock(spot); if (b?.typeId === PLOT_MARKER) b.setType("minecraft:air"); } catch { /* not loaded */ }
  }
  for (const k of Object.keys(state)) delete state[k];
  saveTowns();
  placeMarker(owner, slot);
  player.sendMessage("§7It is just a building again. The plot marker is back.");
}

// back: coins returned (half the price unless given). keep: a Set of "x,y,z" cells to leave alone (the hall
// that takes the plot). after: what happens once it is clear (default: the plot marker comes back).
export function demolish(owner, slot, state, player, { back = Math.floor((state.paid ?? 0) / 2), keep, after } = {}) {
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
        if (keep?.has(`${at.x},${at.y},${at.z}`)) continue;
        try { if (!b.isAir) b.setType("minecraft:air"); } catch { /* protected block */ }
      }
      cells = later;
      if (cells.length) for (let i = 0; i < 40; i++) yield; // ~2 s
    }
    if (after) { after(); return; }
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
  state.done = true; // counts toward the town's charter now (founding.js)
  saveTowns();
  emit("settleCharter", { owner });
  if (!state.fixed) markerBesideDoor(owner, slot, state); // the Mason's Yard stays (basebuilds.js)
});

function markerBesideDoor(owner, slot, state) {
  const spot = besideDoor(owner, slot);
  if (!spot) return;
  try {
    world.getDimension(OVERWORLD).getBlock(spot)?.setType(PLOT_MARKER);
    registerMarker(spot, owner, slot.id);
    state.marker = spot;
    saveTowns();
  } catch {
    // not loaded: the plot can still be managed from the town hall later
  }
}

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
      const seat = slot && seatInWorld(owner, slot, state.pick, state.pickStyle);
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
      player.onScreenDisplay.setActionBar(`§6${nameOf(state.building)} rising §f${Math.floor((job.index / job.cells.length) * 100)}%`);
    }
  }
}
onTick("settle_plot_outlines", 20, () => {
  if (!isReady()) return;
  outlines();
  progress();
});
