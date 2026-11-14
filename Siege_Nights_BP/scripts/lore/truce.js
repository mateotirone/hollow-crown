// The hidden third ending: the truce of the third night, renewed (rules and words: data/truce.js).
//
// For other features
//   import { truceState, breakTruce } from "../lore/truce.js"
//   truceState()                    "none" (never made) | "kept" (holding) | "broken" (rung broken at Bellhollow)
//   breakTruce({ by, cause })       break it from code (cause "player" | anything else, e.g. "order"); by = a name or ""
//   on("truceChanged", ({ state, before, by, cause, times }) => ...)   every time it is made or broken
//   addFilter("truceReady", (ok, { player }) => ok && ...)            say "not yet" to an offer at the Seat
// The Reach listens to truceChanged: while it is broken every third night after the story is an "oathbroken" siege.
//
// Builder commands (creative / operators):
//   /scriptevent siege:truce_status          what state it is in, and since when
//   /scriptevent siege:truce_know            give yourself the name and every mystery (flags true_name, all_mysteries) to try the Seat
//   /scriptevent siege:truce_keep            keep it as if you had said the name at the Seat (plays the scene)
//   /scriptevent siege:truce_break           break it as if you had rung the bell at Bellhollow
//   /scriptevent siege:truce_guests          bring tonight's guests up now, round you (and at the Even Market)
//   /scriptevent siege:truce_explain        show the "what changed" panel again
//   /scriptevent siege:truce_reset           back to never made

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { on, emit, onTick, moduleStore, addTests, assert, assertEqual, isNight, getState, keepCenter, SETTINGS } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { sfx } from "../core/sfx.js";
import { progressOf, setFlag, awardPoints } from "./player.js";
import { storyOver } from "../reach/api.js";
import { setReturnedGentle } from "../bestiary/returned.js";
import { UNDERTOW_ID, HEART } from "../undertow/layout.js";
import { load } from "../undertow/data.js";
import { PLOT_PLAN, WARDS } from "../plots/config.js";
import {
  TRUCE, STATES, nameIsSpoken, offerVerdict, isGuestNight, guestsFor, guestSpot, WARES, waresOf, freshPick,
  SEAT_PROMPT, REPLIES, answerFor, KEPT_NEWS, BREAK_ASK, BROKEN_NEWS, DUSK_GUEST, DAWN_GUEST, GUESTS, MARKET_KEEPER, EXPLAIN,
} from "./data/truce.js";
import { dressNpc, addNpcLook } from "../core/npc_skins.js";

const NPC_TYPE = "minecraft:npc";
const GUEST_NPC_TAG = "siege_truce_guest_npc"; // on the guests themselves
const MARKET_TAG = "siege_truce_market";
const PLAYER_TAG = "siege_truce_guest"; // on players in the Hollow while it holds (Gloamwings leave them be)
const GUEST_PROP = "siege:truce_guest"; // which guest an NPC is
const TOLD_PROP = "siege:truce_told"; // on players: which truce change they have had explained ("kept:2", "broken:2")

const store = moduleStore("siege:truce", () => ({
  state: "none", times: 0, by: "", day: -1, brokenDay: -1, brokenBy: "",
  guestDay: -1, placed: [], marketDay: -1, duskDay: -1, dawnDay: -1, lastDusk: "", lastDawn: "",
}));

export const truceState = () => {
  try { return STATES.includes(store.data.state) ? store.data.state : "none"; } catch { return "none"; }
};

const BELL_WARD = WARDS.find((w) => w.name === TRUCE.wardName);
const MARKET = (() => {
  const plot = PLOT_PLAN.find((p) => p.name === TRUCE.marketPlot);
  return plot ? (plot.relic ?? { x: plot.x, z: plot.z }) : undefined;
})();

const morvaneDown = () => {
  let fallen = false;
  try { fallen = storyOver(); } catch { /* the Reach has nothing saved yet */ }
  const prog = load("hc:undertow_progress", {});
  // the Reach says he fell once; the Hollow says whether somebody has taken the Seat again since
  return (fallen || !!prog.morvane) && prog.morvane !== false;
};
const flagsOf = (player) => { try { return progressOf(player).flags ?? []; } catch { return []; } };
const everyone = () => world.getAllPlayers();
const tell = (lines) => { for (const p of everyone()) for (const l of lines) p.sendMessage(l); };

function changed(before, extra = {}) {
  const d = store.data;
  setReturnedGentle(d.state === "kept");
  emit("truceChanged", { state: d.state, before, times: d.times, ...extra });
}

// ---------- making it ----------
export function keepTruce(player) {
  const d = store.data;
  if (d.state === "kept") return false;
  const before = d.state;
  const lines = answerFor(d.times);
  d.state = "kept";
  d.times += 1;
  d.by = player?.name ?? "";
  d.day = world.getDay();
  d.sceneEnds = system.currentTick + 40 + lines.length * 60;
  store.save();
  if (player) {
    setFlag(player, "truce_kept");
    if (d.times === 1) awardPoints(player, 10, "story:truce", 200);
  }
  // the scene: the Choir answers, a line at a time, to everyone below; chat carries it to everyone above
  const hollow = () => everyone().filter((p) => p.dimension.id === UNDERTOW_ID);
  for (const p of hollow()) {
    try { p.addEffect("darkness", 20 * (lines.length * 3 + 2), { amplifier: 0, showParticles: false }); } catch { /* cosmetic */ }
  }
  lines.forEach((line, i) => system.runTimeout(() => {
    for (const p of hollow()) {
      try {
        p.onScreenDisplay.setTitle(" ", { subtitle: line, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 });
        sfx(p, i === 0 ? "block.bell.resonate" : "block.amethyst_block.chime", { volume: 1, pitch: 0.5 + i * 0.05 });
      } catch { /* left the Hollow */ }
    }
  }, 20 + i * 60));
  system.runTimeout(() => {
    tell(KEPT_NEWS(d.by || "Someone"));
    for (const p of everyone()) { try { sfx(p, "random.levelup", { volume: 0.5, pitch: 0.6 }); } catch {} }
  }, 20 + lines.length * 60);
  changed(before, { by: d.by, cause: "player" });
  return true;
}

// ---------- breaking it ----------
export function breakTruce({ by = "", cause = "player" } = {}) {
  const d = store.data;
  if (d.state !== "kept") return false;
  const before = d.state;
  d.state = "broken";
  d.brokenDay = world.getDay();
  d.brokenBy = by;
  store.save();
  removeGuests();
  tell(BROKEN_NEWS(by));
  for (const p of everyone()) {
    try { sfx(p, "block.bell.use", { volume: 1, pitch: 0.5 }); sfx(p, "ambient.cave", { volume: 0.6 }); } catch { /* cosmetic */ }
  }
  changed(before, { by, cause });
  return true;
}

// ---------- the Seat: say the name ----------
const asked = new Map(); // player id -> tick the Seat may ask again
function nearSeat(p) {
  if (p.dimension.id !== UNDERTOW_ID) return false;
  const c = HEART.center, l = p.location;
  return (l.x - c.x) ** 2 + (l.z - c.z) ** 2 <= TRUCE.seatRadius ** 2 && Math.abs(l.y - c.y) < 12;
}
function verdictFor(p) {
  const d = store.data, flags = flagsOf(p);
  let ready = true;
  try { ready = applyFilter("truceReady", true, { player: p }); } catch { /* nobody filters */ }
  return offerVerdict({
    morvaneDown: morvaneDown(), state: d.state, knowsName: flags.includes("true_name"),
    solvedAll: flags.includes("all_mysteries"), day: world.getDay(), brokenDay: d.brokenDay, ready,
  });
}
const lastReply = new Map();
function reply(p, kind) {
  const line = freshPick(REPLIES[kind], lastReply.get(p.id), Math.random());
  lastReply.set(p.id, line);
  p.sendMessage(line);
}
function askAtSeat(p) {
  const form = new ModalFormData().title(SEAT_PROMPT.title).textField(`${SEAT_PROMPT.body}\n\n${SEAT_PROMPT.field}`, "");
  form.show(p).then((r) => {
    asked.set(p.id, system.currentTick + TRUCE.askAgainTicks);
    if (r.canceled || !r.formValues) return;
    const said = String(r.formValues[0] ?? "").trim();
    if (!said) return;
    const verdict = verdictFor(p); // again: things may have changed while the form was open
    if (!nameIsSpoken(said)) return reply(p, "wrong");
    if (verdict === "ready") return keepTruce(p);
    if (REPLIES[verdict]) reply(p, verdict);
  }).catch(() => asked.set(p.id, system.currentTick + TRUCE.askAgainTicks));
}
onTick("lore:truce_seat", 20, () => {
  for (const p of everyone()) {
    if (!nearSeat(p) || (asked.get(p.id) ?? 0) > system.currentTick) continue;
    const verdict = verdictFor(p);
    // only someone who knows the name is asked; to everyone else the empty Seat is just an empty Seat
    if (!["ready", "half", "soon", "blocked"].includes(verdict)) continue;
    asked.set(p.id, Number.MAX_SAFE_INTEGER); // not again while the form is open
    askAtSeat(p);
  }
});

// ---------- the Bellhollow bell ----------
const inBellhollow = (block) =>
  !!BELL_WARD && block.dimension.id === "minecraft:overworld" && (block.location.x - BELL_WARD.x) ** 2 + (block.location.z - BELL_WARD.z) ** 2 <= BELL_WARD.r ** 2;
const asking = new Set();
world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  if (block?.typeId !== "minecraft:bell" || truceState() !== "kept" || !inBellhollow(block) || asking.has(player.id)) return;
  asking.add(player.id);
  new ActionFormData().title(BREAK_ASK.title).body(BREAK_ASK.body).button(BREAK_ASK.ring).button(BREAK_ASK.leave)
    .show(player).then((r) => {
      asking.delete(player.id);
      if (!r.canceled && r.selection === 0) breakTruce({ by: player.name, cause: "player" });
    }).catch(() => asking.delete(player.id));
});

// ---------- Guest Nights ----------
const guestNightNow = () =>
  isGuestNight(world.getDay(), truceState(), { firstDay: SETTINGS.firstSiegeDay, every: SETTINGS.siegeEveryNNights });

// Each guest has their own face; the Even Market keeper is Seneth, the last guest
const guestSkin = (market, index) => `guest_${market ? 11 : Math.abs(Number(index) || 0) % 12}`;
addNpcLook((e) => {
  if (!e.hasTag(GUEST_NPC_TAG)) return undefined;
  const market = e.hasTag(MARKET_TAG), i = Number(e.getDynamicProperty(GUEST_PROP)) || 0;
  return { key: guestSkin(market, i), name: `§d${market ? MARKET_KEEPER.name : GUESTS[i % GUESTS.length].name}` };
});

function spawnGuest(dimension, spot, index, market = false) {
  const top = dimension.getTopmostBlock({ x: spot.x, z: spot.z });
  if (!top) return false;
  const e = dimension.spawnEntity(NPC_TYPE, { x: spot.x, y: top.location.y + 1, z: spot.z });
  e.addTag(GUEST_NPC_TAG);
  if (market) e.addTag(MARKET_TAG);
  e.setDynamicProperty(GUEST_PROP, index);
  e.nameTag = `§d${market ? MARKET_KEEPER.name : GUESTS[index].name}`;
  dressNpc(e, guestSkin(market, index));
  return true;
}
function removeGuests() {
  try {
    for (const e of world.getDimension("minecraft:overworld").getEntities({ tags: [GUEST_NPC_TAG] })) e.remove();
  } catch { /* nothing loaded */ }
}
// Bring the guests up. Keeps out of loaded ground are tried again on the next pass, until dawn.
function placeGuests(around) {
  const d = store.data, day = world.getDay(), over = world.getDimension("minecraft:overworld");
  if (d.guestDay !== day) { d.guestDay = day; d.placed = []; d.marketDay = -1; }
  const keeps = Object.entries(getState().keeps ?? {});
  const per = guestsFor(keeps.length);
  let next = (day * 5) % GUESTS.length; // a different set of faces each Guest Night
  keeps.forEach(([owner, keep], k) => {
    if (d.placed.includes(owner)) return;
    try {
      const c = keepCenter(keep);
      for (let i = 0; i < per; i++) spawnGuest(over, guestSpot(c, i, per), (next + k * per + i) % GUESTS.length);
      d.placed.push(owner);
    } catch { /* not loaded: next pass */ }
  });
  if (MARKET && d.marketDay !== day) {
    try {
      spawnGuest(over, { x: MARKET.x + 0.5, z: MARKET.z + 0.5 }, 0, true);
      spawnGuest(over, guestSpot(MARKET, 0, 2, TRUCE.marketRadius), (next + 7) % GUESTS.length);
      spawnGuest(over, guestSpot(MARKET, 1, 2, TRUCE.marketRadius), (next + 8) % GUESTS.length);
      d.marketDay = day;
    } catch { /* not loaded: next pass */ }
  }
  if (around) for (let i = 0; i < 2; i++) { try { spawnGuest(over, guestSpot(around, i, 2, 3), (next + 3 + i) % GUESTS.length); } catch {} }
  store.save();
}
onTick("lore:truce_guests", 100, () => {
  if (!world.getAllPlayers().length) return;
  const d = store.data, day = world.getDay(), state = truceState();
  // players in the Hollow are guests there while it holds
  for (const p of everyone()) {
    const guest = state === "kept" && p.dimension.id === UNDERTOW_ID;
    if (guest !== p.hasTag(PLAYER_TAG)) guest ? p.addTag(PLAYER_TAG) : p.removeTag(PLAYER_TAG);
  }
  const night = isNight();
  if (guestNightNow() && night) {
    if (d.duskDay !== day) {
      d.duskDay = day;
      d.lastDusk = freshPick(DUSK_GUEST, d.lastDusk, Math.random());
      tell([d.lastDusk]);
    }
    placeGuests();
  } else if (d.guestDay >= 0 && (!night || state !== "kept")) {
    removeGuests();
    if (d.dawnDay !== d.guestDay && state === "kept") {
      d.dawnDay = d.guestDay;
      d.lastDawn = freshPick(DAWN_GUEST, d.lastDawn, Math.random());
      tell([d.lastDawn]);
    }
    d.guestDay = -1;
    store.save();
  }
});

// ---------- telling everyone what changed, once each (and on their next login if they were away) ----------
const explaining = new Set();
function explainTo(p) {
  const state = truceState(), info = EXPLAIN[state];
  if (!info || explaining.has(p.id)) return;
  const key = `${state}:${store.data.times}`;
  if (p.getDynamicProperty(TOLD_PROP) === key) return;
  explaining.add(p.id);
  new ActionFormData().title(info.title).body(info.body).button("I understand").show(p).then((r) => {
    explaining.delete(p.id);
    if (r.canceled && r.cancelationReason === "UserBusy") return; // another menu was open: try again soon
    p.setDynamicProperty(TOLD_PROP, key);
  }).catch(() => explaining.delete(p.id));
}
onTick("lore:truce_explain", 100, () => {
  const d = store.data;
  if (truceState() === "none") return;
  // after a change, let the Choir's scene play out before the explanation
  if (system.currentTick < (d.sceneEnds ?? 0)) return;
  for (const p of everyone()) explainTo(p);
});

// ---------- talking and trading with a guest ----------
const count = (p, item) => {
  const inv = p.getComponent("inventory")?.container;
  let n = 0;
  for (let i = 0; i < (inv?.size ?? 0); i++) { const s = inv.getItem(i); if (s?.typeId === item) n += s.amount; }
  return n;
};
function take(p, item, amount) {
  const inv = p.getComponent("inventory")?.container;
  for (let i = 0; i < inv.size && amount > 0; i++) {
    const s = inv.getItem(i);
    if (s?.typeId !== item) continue;
    const used = Math.min(amount, s.amount);
    amount -= used;
    if (used === s.amount) inv.setItem(i); else { s.amount -= used; inv.setItem(i, s); }
  }
}
function give(p, item, amount) {
  const stack = new ItemStack(item, amount);
  const left = p.getComponent("inventory")?.container?.addItem(stack);
  if (left) p.dimension.spawnItem(left, p.location);
}
function mendHeld(p) {
  const eq = p.getComponent("equippable"), slot = eq?.getEquipmentSlot?.("Mainhand");
  const held = slot?.getItem();
  const dur = held?.getComponent("durability");
  if (!dur || dur.damage === 0) return false;
  dur.damage = 0;
  slot.setItem(held);
  return true;
}
const plain = (id) => id.replace(/^\w+:/, "").replace(/_/g, " ");
const shownLine = new Map();
function audience(p, guest) {
  const market = guest.hasTag(MARKET_TAG);
  const index = Number(guest.getDynamicProperty(GUEST_PROP) ?? 0);
  const who = market ? MARKET_KEEPER : GUESTS[index % GUESTS.length];
  const key = `${p.id}/${market ? "market" : index}`;
  const line = freshPick(who.lines, shownLine.get(key), Math.random());
  shownLine.set(key, line);
  const wares = waresOf(index, world.getDay(), market).map((id) => WARES.find((w) => w.id === id));
  const form = new ActionFormData().title(who.name)
    .body(`"${line}"\n\n§7Guests trade a thing for a thing, never coins. Pick a trade: you hand over what it says and get the thing named. Guests leave at first light.`);
  for (const w of wares) form.button(`${w.name}\n§8for ${w.give.count} ${plain(w.give.item)}`);
  form.button("Leave");
  form.show(p).then((r) => {
    if (r.canceled || r.selection === undefined || r.selection >= wares.length) return;
    const w = wares[r.selection];
    if (count(p, w.give.item) < w.give.count) return p.sendMessage(`§d${who.name}: §f"That is not enough. ${w.give.count} ${plain(w.give.item)}, and I will."`);
    if (w.mend) {
      if (!mendHeld(p)) return p.sendMessage(`§d${who.name}: §f"Hold up the thing you want mended. It must be something that wears." §7(Hold a damaged tool, weapon or armour piece in your main hand.)`);
      take(p, w.give.item, w.give.count);
      sfx(p, "block.amethyst_block.chime", { volume: 1, pitch: 0.7 });
      return p.sendMessage(`§d${who.name} hums one low note at it. The cracks close along the old lines.`);
    }
    take(p, w.give.item, w.give.count);
    give(p, w.get.item, w.get.count);
    sfx(p, "random.orb", { volume: 0.6, pitch: 0.8 });
    p.sendMessage(`§d${who.name}: §f"A thing for a thing."`);
  }).catch(() => {});
}
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target?.typeId !== NPC_TYPE || !e.target.hasTag(GUEST_NPC_TAG)) return;
  e.cancel = true; // no NPC editor, even for operators: sneak-click is not needed, guests leave at dawn
  const p = e.player, guest = e.target;
  system.run(() => audience(p, guest));
});

on("ready", () => { try { setReturnedGentle(truceState() === "kept"); } catch { /* nothing saved yet */ } });

// ---------- builder commands ----------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (!e.id.startsWith("siege:truce_")) return;
  const p = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  const d = store.data;
  const say = (t) => (p ? p.sendMessage(t) : console.warn(t));
  switch (e.id) {
    case "siege:truce_status":
      say(`§6Truce: ${truceState()} (made ${d.times} time(s); last by ${d.by || "nobody"} on day ${d.day}; broken on day ${d.brokenDay}${d.brokenBy ? ` by ${d.brokenBy}` : ""}). Morvane down: ${morvaneDown()}. Guest Night tonight: ${guestNightNow()}.`);
      if (p) say(`§7You: ${verdictFor(p)} (true_name ${flagsOf(p).includes("true_name")}, all_mysteries ${flagsOf(p).includes("all_mysteries")}).`);
      break;
    case "siege:truce_know":
      if (!p) break;
      setFlag(p, "true_name");
      setFlag(p, "all_mysteries");
      say("§7You know the name and the whole story. Stand at the middle of the empty Seat once Morvane has fallen.");
      break;
    case "siege:truce_keep":
      if (!keepTruce(p)) say("§7The truce already holds.");
      break;
    case "siege:truce_break":
      if (!breakTruce({ by: p?.name ?? "", cause: p ? "player" : "command" })) say("§7There is no truce to break.");
      break;
    case "siege:truce_guests":
      if (truceState() !== "kept") { say("§7Keep the truce first (/scriptevent siege:truce_keep)."); break; }
      if (!isNight()) world.setTimeOfDay(13000); // guests only stay the night
      placeGuests(p?.location);
      say("§7Guests are up. They leave at the next dawn (or when the truce breaks).");
      break;
    case "siege:truce_explain":
      if (p) { p.setDynamicProperty(TOLD_PROP, undefined); explainTo(p); }
      break;
    case "siege:truce_reset": {
      const before = d.state;
      Object.assign(d, { state: "none", times: 0, by: "", day: -1, brokenDay: -1, brokenBy: "" });
      store.save();
      removeGuests();
      changed(before, { by: p?.name ?? "", cause: "reset" });
      say("§7The truce is back to never made.");
      break;
    }
  }
});

addTests("lore truce", {
  "the name is heard however it is written": () => {
    for (const s of ["Hallowmere", "hallowmere.", "The Hallowmere", "HOLLOWMERE", "Hallowmere. Hallowmere.", " hallow mere "]) assert(nameIsSpoken(s), s);
    for (const s of ["", "Aldmere", "hallow", "hallowmeres", "Morvane"]) assert(!nameIsSpoken(s), s);
  },
  "only someone who knows the whole story can make it, and only once he has fallen": () => {
    const base = { morvaneDown: true, state: "none", knowsName: true, solvedAll: true, day: 50 };
    assertEqual(offerVerdict(base), "ready");
    assertEqual(offerVerdict({ ...base, morvaneDown: false }), "standing");
    assertEqual(offerVerdict({ ...base, state: "kept" }), "kept");
    assertEqual(offerVerdict({ ...base, knowsName: false, solvedAll: false }), "unknown");
    assertEqual(offerVerdict({ ...base, solvedAll: false }), "half");
    assertEqual(offerVerdict({ ...base, state: "broken", brokenDay: 45 }), "soon");
    assertEqual(offerVerdict({ ...base, state: "broken", brokenDay: 50 - TRUCE.renewAfterDays }), "ready");
    assertEqual(offerVerdict({ ...base, ready: false }), "blocked");
  },
  "guest nights are the third nights, and only while it holds": () => {
    assert(isGuestNight(9, "kept") && !isGuestNight(10, "kept") && !isGuestNight(9, "broken") && !isGuestNight(9, "none"));
    assert(!isGuestNight(0, "kept") && isGuestNight(3, "kept"), "never before the first siege day, which is day 3");
    assertEqual(guestsFor(1), TRUCE.guestsPerKeep);
    assert(guestsFor(12) * 12 <= TRUCE.maxGuests && guestsFor(12) >= 1);
    assertEqual(guestsFor(0), 0);
  },
  "guests carry different wares, the market carries all, and every ware is a thing for a thing": () => {
    assertEqual(waresOf(0, 0, true).length, WARES.length);
    const seen = new Set();
    for (let g = 0; g < GUESTS.length; g++) for (const id of waresOf(g, 3)) { seen.add(id); assert(WARES.some((w) => w.id === id), id); }
    assertEqual(seen.size, WARES.length, "every ware turns up somewhere");
    for (let g = 0; g < GUESTS.length; g++) assertEqual(waresOf(g, 4).length, 2, `guest ${g} carries two`);
    for (const w of WARES) assert(w.give.count > 0 && (w.mend || w.get?.count > 0), w.id);
  },
  "the words never repeat back to back and the Choir's answer changes each time": () => {
    assert(freshPick(DUSK_GUEST, DUSK_GUEST[0], 0) !== DUSK_GUEST[0]);
    assert(answerFor(0) !== answerFor(1) && answerFor(1) !== answerFor(2) && answerFor(9) === answerFor(2));
    for (const g of GUESTS) assert(g.lines.length >= 2 && g.name.length > 0, g.name);
    for (const s of ["kept", "broken"]) assert(EXPLAIN[s]?.title && EXPLAIN[s].body.length > 200, `explained: ${s}`);
    const spots = new Set([0, 1, 2].map((i) => JSON.stringify(guestSpot({ x: 0, z: 0 }, i, 3))));
    assertEqual(spots.size, 3, "guests stand apart");
  },
  "the places it needs are on the map": () => {
    assert(!!BELL_WARD, "Bellhollow ward");
    assert(!!MARKET, "Reedmoor's Even Market");
  },
});
