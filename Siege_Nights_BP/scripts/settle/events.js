// Town events, settler requests and site events: small things that happen in settlements, players' and Rival
// Lords' alike, so a town never goes quiet. The Storyteller picks them (decks "town_events" and
// "settler_requests"), so the same one never comes twice running and kinds take turns. At most one event and one
// request at a time per town; none on a siege night or the day after. Ignoring one costs nothing.
// Words and numbers: events_data.js. Rules: events_rules.js.
//
// Saved on the town record (founding.js): town.ev = { next, nextAsk, open?: { id, until, ... }, ask?: { id, n, until, baseline } }
// Events: on("townEvent", ({ owner, id })), on("settlerRequestDone", ({ owner, id, player }))
// Test: /scriptevent siege:townevent [list | <event id> | ask [<request id>] | site <site id>]

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { isReady, isNight, onTick, on, emit, moduleStore, keepOf, addFilter } from "../siege/api.js";
import { registerDeck, pick } from "../core/storyteller.js";
import { isSiegeNight } from "../reach/api.js";
import { bestiaryStore } from "../bestiary/bossCore.js";
import { EVENTS, TOWN_EVENTS, REQUESTS, REQUEST_LINES, SITE_EVENTS, FAIR_KINDS, HARVEST_BASKET, SPARE_TIMBER, PLAY_LINES, TROUPE } from "./events_data.js";
import { eventsFor, requestsFor, gap, quietDay, buildDone, fill, eventById, requestById } from "./events_rules.js";
import { REGION_TO_STYLE, SETTLERS } from "./config.js";
import { townOf, saveTowns, builtCounts } from "./founding.js";
import { townFor } from "./towns.js";
import { opensAt } from "./charters.js";
import { BUILDING } from "./buildings.js";
import { settlersOf, freeBeds, townsNear, dressSettler } from "./settlers.js";
import { charge, refund, coins } from "./wallet.js";
import { dressNpc, addNpcLook } from "../core/npc_skins.js";

const OVERWORLD = "minecraft:overworld";
const NPC_TYPE = "minecraft:npc";
const FAIR_TAG = "siege_fair";
const PLAYERS_TAG = "siege_troupe";
const STYLE_REGION = Object.fromEntries(Object.entries(REGION_TO_STYLE).map(([r, s]) => [s, r]));
const store = moduleStore("siege:settle_events", () => ({ lastSiege: -99 }));

registerDeck("town_events", TOWN_EVENTS.map((e) => ({ id: e.id, kind: e.kind })));
registerDeck("settler_requests", REQUESTS.map((r) => ({ id: r.id, kind: r.kind })));

on("siegeEnd", () => { store.data.lastSiege = world.getDay(); store.save(); });

// ---------- helpers ----------

const isLord = (owner) => String(owner).startsWith("npc:");
const ownerPlayer = (owner) => world.getPlayers().find((p) => p.id === owner);
const tell = (owner, text) => ownerPlayer(owner)?.sendMessage(text);
const townName = (owner) => keepOf(owner)?.name ?? townFor(townOf(owner)?.plot)?.name ?? "your settlement";
const nearTown = (town, range) => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - town.x, p.location.z - town.z) <= range);
// Lord towns: said to whoever is close enough to see it
const announce = (owner, text) => {
  if (!isLord(owner)) return tell(owner, text);
  const town = townOf(owner);
  if (town) for (const p of nearTown(town, SETTLERS.lordRange)) p.sendMessage(text);
};

function facts(owner) {
  const town = townOf(owner);
  return { tier: town?.tier ?? 0, counts: builtCounts(owner), settlers: settlersOf(owner).length, freeBeds: freeBeds(owner).length, lord: isLord(owner) };
}

// A spot on the square by the Plot Stone, on top of the ground
function squareSpot(town, dx = 2, dz = 2) {
  const x = town.x + dx, z = town.z + dz;
  try {
    const top = world.getDimension(OVERWORLD).getTopmostBlock({ x, z });
    if (top && Math.abs(top.location.y - town.y) <= 8) return { x: x + 0.5, y: top.location.y + 1, z: z + 0.5 };
  } catch { /* not loaded */ }
  return undefined;
}

function spawnNpc(at, name, tags, skin) { // skin: a key from core/npc_skins_data.js
  try {
    const e = world.getDimension(OVERWORLD).spawnEntity(NPC_TYPE, at);
    for (const t of tags) e.addTag(t);
    e.nameTag = name;
    dressNpc(e, skin);
    system.runTimeout(() => { try { const npc = e.getComponent("minecraft:npc"); if (npc) npc.name = name; } catch { /* gone */ } }, 5);
    return e;
  } catch {
    return undefined;
  }
}

// Fair traders and players spawned before they carried a skin tag: told apart by their names
addNpcLook((e) => {
  if (e.hasTag(FAIR_TAG)) {
    const region = String(e.nameTag).replace(/^Trader from /, "");
    return REGION_TO_STYLE[region] ? `fair_${REGION_TO_STYLE[region]}` : "fair_vale";
  }
  if (e.hasTag(PLAYERS_TAG)) { const i = Math.max(0, TROUPE.indexOf(e.nameTag)); return { key: `mummer_${i}`, name: TROUPE[i] }; }
  return undefined;
});

function removeTagged(tag) {
  try { for (const e of world.getDimension(OVERWORLD).getEntities({ type: NPC_TYPE, tags: [tag] })) e.remove(); } catch { /* not loaded */ }
}

function giveItems(player, list) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const [id, n] of list) {
    try {
      const left = inv?.addItem(new ItemStack(id, n));
      if (left) player.dimension.spawnItem(left, player.location);
    } catch { /* an item this build doesn't know */ }
  }
}

const words = (owner, extra = {}) => ({ town: townName(owner), ...extra });

// ---------- starting and ending events ----------

function startEvent(owner, id) {
  const town = townOf(owner);
  const ev = (town.ev ??= {});
  const e = eventById(id);
  const day = world.getDay();
  const list = settlersOf(owner);
  const w = words(owner);
  switch (id) {
    case "market_fair": {
      const styles = Object.values(REGION_TO_STYLE).filter((s) => s !== town.style);
      const style = styles[(day + town.x) % styles.length];
      const at = squareSpot(town);
      if (!at) return false;
      ev.open = { id, until: day + 1, style };
      spawnNpc(at, `Trader from ${STYLE_REGION[style]}`, [FAIR_TAG, `${FAIR_TAG}_${owner}`], `fair_${style}`);
      w.region = STYLE_REGION[style];
      break;
    }
    case "players":
      ev.open = { id, until: day + 1, played: false };
      break;
    case "wedding": {
      const free = list.filter((s) => s.spouse === undefined);
      if (free.length < 2) return false;
      const [a, b] = [free[day % free.length], free[(day + 1) % free.length]];
      if (a === b) return false;
      a.spouse = b.n; b.spouse = a.n;
      b.home = a.home; b.bed = a.bed; // one bed between them: theirs comes free
      Object.assign(w, { a: a.name, b: b.name });
      break;
    }
    case "lost_traveller":
      if (!freeBeds(owner).length) return false;
      system.runTimeout(() => emit("settleCensus", { owner, arrivals: 1 }), 40);
      break;
    case "harvest_day":
      ev.open = { id, until: day + 1, given: [] };
      break;
    case "spare_timber": {
      if (!placeChest(town, SPARE_TIMBER)) { const p = ownerPlayer(owner); if (!p) return false; giveItems(p, SPARE_TIMBER); }
      break;
    }
    case "footprints":
    case "supper_miscount":
      if (!list.length) return false;
      w.a = list[(day * 3) % list.length].name;
      break;
    default:
      return false;
  }
  announce(owner, `§6${e.name}.§7 ${fill(e.start, w)}`);
  emit("townEvent", { owner, id });
  saveTowns();
  return true;
}

function endEvent(owner) {
  const town = townOf(owner);
  const open = town?.ev?.open;
  if (!open) return;
  if (open.id === "market_fair") removeTagged(`${FAIR_TAG}_${owner}`);
  if (open.id === "players") removeTagged(`${PLAYERS_TAG}_${owner}`);
  const e = eventById(open.id);
  if (e?.end) announce(owner, `§7${fill(e.end, words(owner))}`);
  delete town.ev.open;
  saveTowns();
}

function placeChest(town, list) {
  const at = squareSpot(town, -2, 2);
  if (!at) return false;
  try {
    const b = world.getDimension(OVERWORLD).getBlock({ x: Math.floor(at.x), y: at.y, z: Math.floor(at.z) });
    if (!b?.isAir) return false;
    b.setType("minecraft:chest");
    const inv = b.getComponent("minecraft:inventory")?.container;
    for (const [id, n] of list) try { inv?.addItem(new ItemStack(id, n)); } catch { /* unknown item */ }
    return true;
  } catch {
    return false;
  }
}

// ---------- the travelling players at dusk ----------

function play(owner) {
  const town = townOf(owner);
  const open = town?.ev?.open;
  if (!open || open.id !== "players" || open.played) return;
  const at = squareSpot(town);
  if (!at) return;
  open.played = true;
  saveTowns();
  TROUPE.forEach((name, i) => spawnNpc({ x: at.x + i - 1, y: at.y, z: at.z }, name, [PLAYERS_TAG, `${PLAYERS_TAG}_${owner}`], `mummer_${i}`));
  PLAY_LINES.forEach((line, i) => system.runTimeout(() => {
    const t = townOf(owner);
    if (!t) return;
    const watching = nearTown(t, EVENTS.playersRange);
    for (const p of watching) p.sendMessage(fill(line, words(owner)));
    if (i === PLAY_LINES.length - 1) {
      for (const p of watching) emit("skillPoints", { player: p, amount: 0, source: "the travelling players", renown: EVENTS.playersRenown });
      system.runTimeout(() => removeTagged(`${PLAYERS_TAG}_${owner}`), 200);
    }
  }, 200 * i));
}

// ---------- requests ----------

function offerRequest(owner, id) {
  const town = townOf(owner);
  const list = settlersOf(owner).filter((s) => !s.idle);
  const r = requestById(id);
  if (!list.length || !r) return false;
  const day = world.getDay();
  const s = list[(day + list.length) % list.length];
  town.ev.ask = { id, n: s.n, until: day + EVENTS.requestDays, baseline: builtCounts(owner) };
  saveTowns();
  dressSettler(owner, s);
  tell(owner, fill(REQUEST_LINES.call, words(owner, { name: s.name })));
  return true;
}

function closeRequest(owner, done, player) {
  const town = townOf(owner);
  const ask = town?.ev?.ask;
  if (!ask) return;
  const s = settlersOf(owner).find((x) => x.n === ask.n);
  const r = requestById(ask.id);
  delete town.ev.ask;
  town.ev.nextAsk = world.getDay() + gap(EVENTS.requestGap);
  saveTowns();
  if (s) dressSettler(owner, s);
  if (!done) return tell(owner, fill(REQUEST_LINES.lapsed, { name: s?.name ?? "A settler" }));
  if (r.renown) emit("skillPoints", { player, amount: 0, source: `${s?.name ?? "a settler"}'s request`, renown: r.renown });
  if (r.coins) refund(player, r.coins);
  player.sendMessage(fill(REQUEST_LINES.done, { name: s?.name ?? "The", renown: r.renown, coins: r.coins ? ` and ${coins(r.coins)}` : "" }));
  emit("settlerRequestDone", { owner, id: r.id, player });
}

function countItem(player, id) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  let n = 0;
  for (let i = 0; i < (inv?.size ?? 0); i++) { const it = inv.getItem(i); if (it?.typeId === id) n += it.amount; }
  return n;
}
function takeItem(player, id, count) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; i < (inv?.size ?? 0) && count > 0; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== id) continue;
    const use = Math.min(count, it.amount);
    count -= use;
    if (use === it.amount) inv.setItem(i); else { it.amount -= use; inv.setItem(i, it); }
  }
}

// Talking to a settler who has asked for something, or the Farmer on harvest day
addFilter("settlerTalk", (handled, { player, owner, settler: s, town }) => {
  if (handled || !town) return handled;
  const open = town.ev?.open;
  if (open?.id === "harvest_day" && ["Farmer", "Gardener"].includes(s.role) && !open.given.includes(player.id)) {
    open.given.push(player.id);
    saveTowns();
    giveItems(player, HARVEST_BASKET);
    player.sendMessage(`§f${s.name}§7: Here, a basket from the harvest. Don't tell the others I gave you the good apples.`);
    return true;
  }
  const ask = town.ev?.ask;
  if (!ask || ask.n !== s.n) return false;
  const r = requestById(ask.id);
  if (!r) return false;
  let done = false;
  if (r.type === "build") done = buildDone(r, ask.baseline, builtCounts(owner));
  if (r.type === "bed" && freeBeds(owner).length) { done = true; system.runTimeout(() => emit("settleCensus", { owner, arrivals: 1 }), 20); }
  if (r.type === "bring" && countItem(player, r.item) >= r.count) { takeItem(player, r.item, r.count); done = true; }
  if (done) {
    player.sendMessage(`§f${s.name}§7: ${r.thanks}`);
    closeRequest(owner, true, player);
  } else {
    player.sendMessage(`§f${s.name}§7: ${r.ask}`);
    const left = ask.until - world.getDay();
    player.sendMessage(`§8${REQUEST_LINES.notYet} (${left} day${left === 1 ? "" : "s"} left)`);
  }
  return true;
});

// ---------- the fair trader ----------

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(FAIR_TAG)) return;
  event.cancel = true;
  system.run(() => {
    const owner = target.getTags().find((t) => t.startsWith(`${FAIR_TAG}_`))?.slice(FAIR_TAG.length + 1);
    const style = owner && townOf(owner)?.ev?.open?.style;
    if (!style) return;
    const idOf = (kind) => `siege:castle_${kind}${style === "vale" ? "" : `_${style}`}`;
    const form = new ActionFormData().title(`Trader from ${STYLE_REGION[style]}`).body(`§7Stone from ${STYLE_REGION[style]}, brought a long way. ${coins(EVENTS.fairPrice)} for 16.`);
    for (const k of FAIR_KINDS) form.button(`Castle ${k[0].toUpperCase()}${k.slice(1)} x16`);
    form.show(player).then((res) => {
      if (res.canceled || res.selection === undefined) return;
      if (!charge(player, EVENTS.fairPrice)) return player.sendMessage("§7You can't afford it.");
      giveItems(player, [[idOf(FAIR_KINDS[res.selection]), 16]]);
    }).catch(() => {});
  });
});

// ---------- site events: something turns up while a building rises ----------

function siteEvent(owner, building, id) {
  const choices = SITE_EVENTS.filter((e) => !e.after || bestiaryStore.data.hollowAwake);
  const e = id ? SITE_EVENTS.find((x) => x.id === id) : choices[Math.floor(Math.random() * choices.length)];
  const p = ownerPlayer(owner);
  if (!e || !p) return;
  const w = { building: BUILDING[building]?.name ?? building };
  if (e.coins) { const n = e.coins[0] + Math.floor(Math.random() * (e.coins[1] - e.coins[0] + 1)); refund(p, n); w.coins = coins(n); }
  if (e.items) giveItems(p, e.items);
  p.sendMessage(`§6On the building site.§7 ${fill(e.text, w)}`);
}

on("settleBuilt", ({ owner, building, slotId }) => {
  if (!slotId || isLord(owner) || Math.random() >= EVENTS.siteChance) return;
  system.runTimeout(() => siteEvent(owner, building), 60);
});

// ---------- the daily round ----------

let lastNight;
onTick("settle_events", 200, () => {
  if (!isReady()) return;
  const day = world.getDay();
  const night = isNight();
  const dusk = night && lastNight === false;
  lastNight = night;
  let siegeTonight = false;
  try { siegeTonight = isSiegeNight(); } catch { /* reach not ready */ }
  for (const owner of townsNear()) {
    const town = townOf(owner);
    if (!town) continue;
    const ev = (town.ev ??= { next: day + EVENTS.firstEventDay, nextAsk: day + 2 });
    if (dusk) play(owner);
    if (ev.open && ev.open.until <= day) endEvent(owner);
    if (ev.ask && ev.ask.until <= day) closeRequest(owner, false);
    if (ev.day === day) continue; // once a day from here on
    ev.day = day;
    saveTowns();
    if (!ev.open && day >= ev.next && !quietDay(day, { siegeTonight, lastSiege: store.data.lastSiege })) {
      const f = facts(owner);
      const ok = new Set(eventsFor(f));
      const choice = pick("town_events", owner, { exclude: TOWN_EVENTS.filter((e) => !ok.has(e.id)).map((e) => e.id) });
      ev.next = day + gap(EVENTS.eventGap);
      saveTowns();
      if (choice) startEvent(owner, choice.id);
    }
    if (!isLord(owner) && !ev.ask && day >= ev.nextAsk) {
      const ok = new Set(requestsFor(facts(owner), opensAt));
      const choice = ok.size ? pick("settler_requests", owner, { exclude: REQUESTS.filter((r) => !ok.has(r.id)).map((r) => r.id) }) : undefined;
      ev.nextAsk = day + gap(EVENTS.requestGap);
      saveTowns();
      if (choice) offerRequest(owner, choice.id);
    }
  }
});

// Fair traders and players left over from an event that ended while their town was unloaded
onTick("settle_events_tidy", 1200, () => {
  if (!isReady()) return;
  try {
    for (const e of world.getDimension(OVERWORLD).getEntities({ type: NPC_TYPE, tags: [FAIR_TAG] })) {
      const owner = e.getTags().find((t) => t.startsWith(`${FAIR_TAG}_`))?.slice(FAIR_TAG.length + 1);
      if (townOf(owner)?.ev?.open?.id !== "market_fair") e.remove();
    }
    for (const e of world.getDimension(OVERWORLD).getEntities({ type: NPC_TYPE, tags: [PLAYERS_TAG] })) {
      const owner = e.getTags().find((t) => t.startsWith(`${PLAYERS_TAG}_`))?.slice(PLAYERS_TAG.length + 1);
      if (townOf(owner)?.ev?.open?.id !== "players") e.remove();
    }
  } catch { /* not loaded */ }
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:townevent") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const town = townOf(player.id);
  if (!town) return player.sendMessage("§7You have no town layout.");
  town.ev ??= {};
  const [cmd = "list", arg] = event.message.trim().split(/\s+/);
  if (cmd === "list") {
    return player.sendMessage(`§6Town events:§7 open ${town.ev.open?.id ?? "none"}, next on day ${town.ev.next ?? "?"}; request ${town.ev.ask?.id ?? "none"}, next on day ${town.ev.nextAsk ?? "?"}. Could happen now: ${eventsFor(facts(player.id)).join(", ")}`);
  }
  if (cmd === "ask") {
    if (town.ev.ask) closeRequest(player.id, false);
    const id = arg ?? requestsFor(facts(player.id), opensAt)[0];
    return offerRequest(player.id, id) || player.sendMessage("§7No settler to ask (or no such request).");
  }
  if (cmd === "site") return siteEvent(player.id, "cottage", arg ?? "hoard");
  if (cmd === "dusk") return play(player.id);
  if (town.ev.open) endEvent(player.id);
  if (!eventById(cmd)) return player.sendMessage(`§7Events: ${TOWN_EVENTS.map((e) => e.id).join(", ")}`);
  if (!startEvent(player.id, cmd)) player.sendMessage("§7That can't happen in your town right now.");
});
