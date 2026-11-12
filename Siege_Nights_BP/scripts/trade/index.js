// Trade Outposts: standing trade routes between settlements, run by an unseen train.
// Design (approved by Mateo 2026-11-12): https://claude.ai/artifact/UkR4zp2NL5tzfrZKva2gWX
//
// A settlement owner raises the Outpost wing at their station (station menu, once they own an engine and have a line).
// Inside: the Trade Board (propose, review, routes), an Exports barrel and an Imports barrel. Two settlements agree
// terms ("20 iron for 4 gold, every day"); each run takes both loads out of both Exports at once and, after the
// real travel time along the laid track, drops them in the other side's Imports. A side that is short pauses the
// route. Rival Lords and the six towns trade too; Kingsrest buys any trade good for Regals at a set price.
//
// Barrels in unloaded chunks can't be opened by scripts, so each Outpost keeps a ledger of what its crates hold.
// Runs work on the ledgers; when a player is near the station again, the crates are corrected (sync below).
// Numbers: data.js. Rules: rules.js. Menus: menus.js. The building: wing.js.
//
// For other features:
//   supplyExports(settlementId, itemId, count) -> how many the Outpost took (the works' Supply Line; safe to call
//                                                  any time, returns 0 when there's no Outpost or nothing is needed)
//   tradePartyOf(playerId), outpostOf(party)
// Tests: /scriptevent siege:trade_test     an Outpost (board + crates) where you stand, on your settlement
//        /scriptevent siege:trade_day      jump every route a day ahead
//        /scriptevent siege:trade_reset    forget every offer and route

import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { onTick, isReady, moduleStore, keepOf, getState, isAlly, on, emit, COLORS, isNight } from "../siege/api.js";
import { addMenuLabel } from "../core/labels.js";
import { worldChapter } from "../core/storyteller.js";
import { TOWNS } from "../economy/config.js";
import * as ECON_CONFIG from "../economy/config.js";
import { regionAt } from "../economy/shops.js";
import { rivalLords, rivalById, relationOf, changeRelation } from "../rivals/index.js";
import { ROUTES } from "../trains/routes_data.js";
import { isBuilt, homeStop } from "../trains/route_game.js";
import { allSites } from "../trains/station_sites.js";
import { stationPlan } from "../trains/stations.js";
import { startBuild, buildFor, worldCells, worldMarks } from "../townhall/build.js";
import { TRADE, goodOf, DAY, COIN } from "./data.js";
import {
  pathLength, travelTicks, depart, afterTry, finished, npcMake, npcAnswer, capitalAnswer, npcOffer,
  needsOf, supplyTake, crateDelta, add, stacksOf, cargoOf, routesAllowed, niceGood, rateOf,
} from "./rules.js";
import { wingPlan, wingOrigin } from "./wing.js";
import "./tests.js";

export const TRADE_BOARD = "siege:trade_board";
const BARREL = "minecraft:barrel";
export const CAPITAL = "t:kingsrest";
const now = () => world.getAbsoluteTime();
const rates = () => ECON_CONFIG.REGION_RATES ?? {};

// outposts: { [party]: { owner, site, dim, stage (built), wagons, board, exports, imports ({x,y,z} world),
//             ex, im (ledgers), exSnap, imSnap (what the crates held at the last look) } }
// offers: [...] (rules.js), routes: [...], notices: { [party]: [{ text, at }] }, npc: { [party]: { stock, at } },
// pending: { [offer id]: tick } (NPC answers due), seq, nextNpcOffer: { [player party]: tick }, holdUps: { [route id]: {...} }
const store = moduleStore("siege:trade", () => ({ outposts: {}, offers: [], routes: [], notices: {}, npc: {}, pending: {}, seq: 0, nextNpcOffer: {}, holdUps: {}, seen: {} }));
const S = () => store.data;
export const S_ACCESS = () => store.data;
export const saveTrade = () => store.save();

// ---------- parties ----------

const DYE_CODE = { white: "§f", orange: "§6", magenta: "§d", light_blue: "§b", yellow: "§e", lime: "§a", pink: "§d", gray: "§8", light_gray: "§7", cyan: "§3", purple: "§5", blue: "§9", brown: "§6", green: "§2", red: "§c", black: "§0" };
const stopById = (id) => ROUTES.stops.find((s) => s.id === id);
const townOfStop = (stop) => TOWNS.find((t) => t.name === stop?.name);

export const tradePartyOf = (playerId) => (keepOf(playerId) ? `p:${playerId}` : undefined);
export const ownerOfParty = (party) => (party?.startsWith("p:") ? party.slice(2) : undefined);
export const isNpc = (party) => !party.startsWith("p:");

export function partyStop(party) {
  if (party.startsWith("p:")) return homeStop(party.slice(2));
  if (party.startsWith("t:")) return party.slice(2);
  const lord = rivalById(party.slice(2));
  return lord && ROUTES.stops.find((s) => s.plot === lord.plot)?.id;
}

export function partyName(party, { color = true } = {}) {
  const stop = stopById(partyStop(party));
  if (party.startsWith("p:")) {
    const keep = keepOf(party.slice(2));
    const c = color ? DYE_CODE[COLORS[keep?.color]] ?? "§f" : "";
    return `${c}${keep?.name ?? "Someone"}${stop ? ` of ${stop.name}` : ""}§r`;
  }
  if (party === CAPITAL) return `${color ? "§6" : ""}the Kingsrest Exchequer§r`;
  if (party.startsWith("t:")) return `${color ? "§e" : ""}${stop?.name ?? party.slice(2)}§r`;
  const lord = rivalById(party.slice(2));
  return `${color ? "§6" : ""}${lord?.name ?? "a lord"}${lord ? ` of ${lord.plot}` : ""}§r`;
}

export function partyRegion(party) {
  if (party.startsWith("p:")) { const k = keepOf(party.slice(2)); return k ? regionAt(k) : undefined; }
  if (party.startsWith("t:")) return townOfStop(stopById(party.slice(2)))?.region ?? "Aldmere Vale";
  return rivalById(party.slice(2))?.region;
}

const stageOfTier = (t) => ["halt", "station", "junction", "grand"][t] ?? "halt";
export function partyStage(party) {
  if (party.startsWith("p:")) return outpostOf(party)?.stage ?? "halt";
  if (party === CAPITAL) return "grand";
  if (party.startsWith("t:")) return "station";
  return stageOfTier(rivalById(party.slice(2))?.tier ?? 0);
}

export const outpostOf = (party) => S().outposts[party];
const npcTier = (party) => (party === CAPITAL ? 3 : party.startsWith("t:") ? 1 : rivalById(party.slice(2))?.tier ?? 0);

// Everyone this party's laid track reaches: [{ party, length }]
const builtMap = () => Object.fromEntries(ROUTES.segments.filter((s) => isBuilt(s.id)).map((s) => [s.id, true]));
export function partnersOf(party) {
  const home = partyStop(party);
  if (!home) return [];
  const built = builtMap();
  const out = [];
  const consider = (p) => {
    if (p === party) return;
    const length = pathLength(ROUTES, built, home, partyStop(p));
    if (Number.isFinite(length)) out.push({ party: p, length });
  };
  for (const p of Object.keys(S().outposts)) if (outpostOf(p)?.stage) consider(p);
  for (const lord of rivalLords()) consider(`l:${lord.id}`);
  for (const t of TOWNS) { const stop = ROUTES.stops.find((s) => s.name === t.name); if (stop) consider(`t:${stop.id}`); }
  return out.sort((a, b) => a.length - b.length);
}
export const lineLength = (a, b) => pathLength(ROUTES, builtMap(), partyStop(a), partyStop(b));

// ---------- notices ----------

export function notify(party, text, { chat = true } = {}) {
  if (isNpc(party)) return;
  (S().notices[party] ??= []).push({ text, at: now() });
  if (S().notices[party].length > 12) S().notices[party].shift();
  const owner = ownerOfParty(party);
  if (chat) for (const p of world.getPlayers()) if (p.id === owner || isAlly(owner, p.id)) { try { p.sendMessage(`§6[Trade] §r${text}`); } catch {} }
}
export const noticesOf = (party) => S().notices[party] ?? [];
export const clearNotices = (party) => { S().notices[party] = []; store.save(); };

// Offers waiting on this party's answer
export const waitingFor = (party) => S().offers.filter((o) => (o.from === party || o.to === party) && o.by !== party);
export const routesOf = (party) => S().routes.filter((r) => r.a === party || r.b === party);

// The text floating over a Trade Board
function boardText(block) {
  const party = Object.keys(S().outposts).find((p) => { const o = outpostOf(p); return o?.board && o.dim === block.dimension.id && o.board.x === block.location.x && o.board.y === block.location.y && o.board.z === block.location.z; });
  if (!party) return undefined;
  const asks = waitingFor(party);
  if (asks.length === 1) {
    const o = asks[0];
    const other = o.from === party ? o.to : o.from;
    return `§e${o.round ? "A counteroffer" : "A new trade request"} from\n${partyName(other)}`;
  }
  if (asks.length > 1) return `§e${asks.length} trade requests waiting\n§7Click the Trade Board`;
  const stuck = routesOf(party).find((r) => r.state !== "live");
  if (stuck) return `§6Trade Board\n§c${stuck.state === "dormant" ? "A route is dormant" : `Paused: ${whyText(stuck, party)}`}`;
  return undefined;
}
addMenuLabel({ block: TRADE_BOARD, name: "Trade Board", hint: "Click: trade routes", text: boardText });
addMenuLabel({ block: BARREL, name: "Exports", hint: "Goods for your routes to send", where: (b) => crateKind(b) === "exports" });
addMenuLabel({ block: BARREL, name: "Imports", hint: "What your routes bring back", where: (b) => crateKind(b) === "imports" });

function crateKind(block) {
  for (const o of Object.values(S().outposts)) {
    if (o.dim !== block.dimension.id) continue;
    for (const k of ["exports", "imports"]) if (o[k] && o[k].x === block.location.x && o[k].y === block.location.y && o[k].z === block.location.z) return k;
  }
  return undefined;
}
const outpostAtCrate = (block) => Object.entries(S().outposts).find(([, o]) => o.dim === block.dimension.id && ["exports", "imports", "board"].some((k) => o[k] && o[k].x === block.location.x && o[k].y === block.location.y && o[k].z === block.location.z));

export function whyText(route, party) {
  const w = route.why;
  if (!w) return "";
  if (w.what === "line") return "the line between you is broken";
  if (w.what === "siege") return "a siege";
  if (w.what === "imports") return `${w.short === "a" ? partyName(route.a) : partyName(route.b)}'s Imports are full`;
  if (w.what === "washout") return "a storm closed the line for a day";
  const side = w.short === "a" ? route.a : route.b;
  const who = side === party ? "your" : `${partyName(side)}'s`;
  return `${who} Exports are out of ${niceGood(w.what)}`;
}

// ---------- ledgers and the real crates ----------

function containerAt(dim, at) {
  try {
    const b = dim.getBlock(at);
    if (!b) return { loaded: false };
    if (b.typeId !== BARREL) return { loaded: true, missing: true };
    return { loaded: true, container: b.getComponent("minecraft:inventory")?.container };
  } catch {
    return { loaded: false };
  }
}

function countGoods(container) {
  const out = {};
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (it && goodOf(it.typeId)) out[it.typeId] = (out[it.typeId] ?? 0) + it.amount;
  }
  return out;
}

function takeFrom(container, id, n) {
  for (let i = 0; i < container.size && n > 0; i++) {
    const it = container.getItem(i);
    if (!it || it.typeId !== id) continue;
    const k = Math.min(n, it.amount);
    n -= k;
    if (k === it.amount) container.setItem(i, undefined);
    else { it.amount -= k; container.setItem(i, it); }
  }
  return n; // left over (couldn't take)
}

function putIn(container, id, n) {
  let left = 0;
  while (n > 0) {
    const k = Math.min(64, n);
    n -= k;
    const rest = container.addItem(new ItemStack(id, k));
    if (rest) left += rest.amount;
  }
  return left; // didn't fit
}

// Bring one crate and its ledger into line. Returns false when its chunk isn't loaded.
function syncCrate(o, kind) {
  const L = kind === "exports" ? "ex" : "im";
  const dim = world.getDimension(o.dim);
  const c = containerAt(dim, o[kind]);
  if (!c.loaded) return false;
  if (c.missing || !c.container) {
    // broken (an explosion: its goods spilled) — put an empty crate back and start the ledger again
    try { dim.getBlock(o[kind])?.setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 })); } catch {}
    o[L] = {}; o[`${L}Snap`] = {};
    return true;
  }
  const snap = o[`${L}Snap`] ?? {};
  const { add: adds, take: takes } = crateDelta(o[L] ?? {}, snap);
  for (const [id, n] of Object.entries(takes)) takeFrom(c.container, id, n);
  const unplaced = {};
  for (const [id, n] of Object.entries(adds)) { const left = putIn(c.container, id, n); if (left) unplaced[id] = left; }
  const real = countGoods(c.container);
  o[`${L}Snap`] = real;
  o[L] = { ...real };
  for (const [id, n] of Object.entries(unplaced)) add(o[L], id, n);
  return true;
}

export function syncOutpost(party) {
  const o = outpostOf(party);
  if (!o?.stage) return false;
  const a = syncCrate(o, "exports"), b = syncCrate(o, "imports");
  return a && b;
}

// Every two seconds: outposts with a player near are synced
onTick("trade_sync", 40, () => {
  if (!isReady()) return;
  const players = world.getPlayers();
  let changed = false;
  for (const [party, o] of Object.entries(S().outposts)) {
    if (!o.stage || !o.board) continue;
    if (!players.some((p) => p.dimension.id === o.dim && Math.hypot(p.location.x - o.board.x, p.location.z - o.board.z) < 48)) continue;
    if (syncOutpost(party)) changed = true;
  }
  if (changed) store.save();
});

// NPC stock, made up to now
function npcStock(party) {
  const rec = (S().npc[party] ??= { stock: {}, at: now() - DAY });
  const days = (now() - rec.at) / DAY;
  if (days > 0.01) {
    npcMake(rec.stock, partyRegion(party) ?? "Aldmere Vale", npcTier(party), days, rates());
    rec.at = now();
  }
  return rec.stock;
}
// What an NPC can spare of `id` for one run at this rate
const npcPerRun = (party) => (id, every) => {
  if (party === CAPITAL) return id === COIN ? Infinity : 0;
  const g = goodOf(id);
  if (!g?.make) return 0;
  return g.make * (npcTier(party) + 1) * rateOf(rates(), partyRegion(party), id) * (TRADE.every[every] / DAY);
};

const ledgerFor = (party, kind) => (isNpc(party) ? (party === CAPITAL ? { [COIN]: Infinity } : npcStock(party)) : outpostOf(party)?.[kind === "ex" ? "ex" : "im"] ?? {});

// ---------- offers ----------

const newId = () => `${(S().seq = (S().seq ?? 0) + 1)}`;
export const cargoFor = (party) => (isNpc(party) ? Infinity : cargoOf(partyStage(party), outpostOf(party)?.wagons ?? 0));
export const sameRoute = (a, b, give, get) => S().routes.some((r) => ((r.a === a && r.b === b) || (r.a === b && r.b === a)) && [r.give.id, r.get.id].some((id) => id === give.id || id === get.id));
export const roomFor = (party) => isNpc(party) || routesOf(party).length < routesAllowed(partyStage(party));

export function sendOffer(from, to, terms) {
  const offer = { id: newId(), from, to, give: terms.give, get: terms.get, every: terms.every, runs: terms.runs ?? 0, round: 0, by: from, at: now() };
  S().offers.push(offer);
  if (isNpc(to)) S().pending[offer.id] = now() + (to === CAPITAL ? 40 : TRADE.npcReplyTicks);
  else notify(to, `New trade request from ${partyName(from)}. Answer it at your Trade Board.`);
  store.save();
  return offer;
}

export function counterOffer(offer, by, give, get, every, runs) {
  offer.give = give; offer.get = get;
  if (every) offer.every = every;
  if (runs !== undefined) offer.runs = runs;
  offer.round += 1; offer.by = by; offer.at = now();
  const other = by === offer.from ? offer.to : offer.from;
  if (isNpc(other)) S().pending[offer.id] = now() + TRADE.npcReplyTicks;
  else notify(other, `${partyName(by)} sent a counteroffer. Review it at your Trade Board.`);
  store.save();
}

export function rejectOffer(offer, by, why) {
  S().offers = S().offers.filter((o) => o !== offer);
  delete S().pending[offer.id];
  const other = by === offer.from ? offer.to : offer.from;
  notify(other, `${partyName(by)} turned down your trade${why ? `: "${why}"` : "."}`);
  store.save();
}

// Both sides agree: the route goes live. Returns a problem string or undefined.
export function acceptOffer(offer, by) {
  for (const p of [offer.from, offer.to]) if (!roomFor(p)) return `${p === by || isNpc(by) ? "Your" : `${partyName(p)}'s`} station can't run another route yet. It grows with the settlement.`;
  const length = lineLength(offer.from, offer.to);
  if (!Number.isFinite(length)) return "No laid track joins your stations any more.";
  S().offers = S().offers.filter((o) => o !== offer);
  delete S().pending[offer.id];
  const route = { id: offer.id, a: offer.from, b: offer.to, give: offer.give, get: offer.get, every: offer.every, runs: offer.runs, proposer: offer.from, state: "live", nextAt: now() + 100, done: 0, missed: 0, onLine: null, clean: 0 };
  S().routes.push(route);
  const other = by === offer.from ? offer.to : offer.from;
  notify(other, `${partyName(by)} accepted. The route to ${partyName(by)} is live: the first run leaves shortly.`);
  if (!isNpc(by)) notify(by, `The route with ${partyName(other)} is live.`, { chat: false });
  emit("tradeRouteOpened", { route });
  store.save();
  return undefined;
}

export function cancelRoute(route, by) {
  S().routes = S().routes.filter((r) => r !== route);
  if (route.onLine) S().ended = [...(S().ended ?? []), route].slice(-20); // what's on the line still arrives
  const other = by === route.a ? route.b : route.a;
  notify(other, `${partyName(by)} ended the route between you.`);
  if (other.startsWith("l:")) { const lord = rivalById(other.slice(2)); const pid = ownerOfParty(by); if (lord && pid) changeRelation(lord, pid, -1); }
  store.save();
}

export function resumeRoute(route) {
  route.state = "paused";
  route.missedSince = undefined;
  route.missed = 0;
  route.nextAt = now();
  store.save();
}

// NPC answers that are due
function npcReplies() {
  const t = now();
  for (const [id, due] of Object.entries(S().pending)) {
    if (t < due) continue;
    delete S().pending[id];
    const offer = S().offers.find((o) => o.id === id);
    if (!offer) continue;
    const npc = offer.to;
    // seen from the NPC: they are offer.to when the player proposed; when the NPC proposed, flip the terms
    const asTo = npc === offer.to && isNpc(offer.to) ? offer : { ...offer, give: offer.get, get: offer.give };
    const who = isNpc(offer.to) ? offer.to : offer.from;
    const ans = who === CAPITAL ? capitalAnswer(asTo) : npcAnswer(npcView(who, isNpc(offer.from) ? offer.to : offer.from), asTo, rates());
    if (ans.kind === "accept") {
      const problem = acceptOffer(offer, who);
      if (problem) rejectOffer(offer, who, problem);
    } else if (ans.kind === "counter") {
      const [give, get] = who === offer.to ? [ans.give, ans.get] : [ans.get, ans.give];
      if (offer.round >= 6) rejectOffer(offer, who, "We'll leave it there.");
      else counterOffer(offer, who, give, get);
    } else rejectOffer(offer, who, ans.why);
  }
}

function npcView(party, withParty) {
  const pid = ownerOfParty(withParty);
  if (party.startsWith("l:")) {
    const lord = rivalById(party.slice(2));
    const rel = lord && pid ? relationOf(lord, pid) : 0;
    const besieged = rel <= -3;
    const clean = S().routes.filter((r) => (r.a === party || r.b === party) && (r.a === withParty || r.b === withParty)).reduce((s, r) => s + (r.clean ?? 0), 0);
    const bonus = Math.min(TRADE.relationMax, Math.floor(clean / TRADE.relationStep) * TRADE.relationBonus + Math.max(0, rel) * 0.01);
    return { region: lord?.region ?? "Aldmere Vale", temperament: lord?.temperament ?? "steady", bonus, refuses: besieged || (lord?.temperament === "proud" && rel < 0), makes: npcPerRun(party) };
  }
  return { region: partyRegion(party) ?? "Aldmere Vale", temperament: "steady", margin: TRADE.npcTownMargin, bonus: 0, makes: npcPerRun(party) };
}

// Now and then an NPC writes to a player who has an Outpost
function npcProposals() {
  const t = now();
  for (const [party, o] of Object.entries(S().outposts)) {
    if (!o.stage || !roomFor(party)) continue;
    const due = (S().nextNpcOffer[party] ??= t + TRADE.npcOfferEvery / 3); // the first letter comes a day after opening
    if (t < due) continue;
    S().nextNpcOffer[party] = t + TRADE.npcOfferEvery * (0.7 + Math.random() * 0.6);
    if (waitingFor(party).length >= 3) continue;
    const partners = partnersOf(party).filter((p) => p.party.startsWith("l:") || (p.party.startsWith("t:") && p.party !== CAPITAL));
    if (!partners.length) continue;
    const pick = partners[Math.floor(Math.random() * partners.length)].party;
    const view = npcView(pick, party);
    if (view.refuses) continue;
    const terms = npcOffer({ ...view, stock: npcStock(pick) }, { region: partyRegion(party) }, rates());
    if (!terms || sameRoute(pick, party, terms.give, terms.get)) continue;
    const cap = cargoFor(party);
    if (terms.get.n > cap || terms.give.n > cap) continue;
    sendOffer(pick, party, terms);
  }
}

function expireOffers() {
  const t = now();
  const old = S().offers.filter((o) => t - o.at > TRADE.offerExpires);
  for (const o of old) {
    S().offers = S().offers.filter((x) => x !== o);
    delete S().pending[o.id];
    notify(o.by, `Your offer to ${partyName(o.by === o.from ? o.to : o.from)} ran out with no answer.`, { chat: false });
  }
}

// ---------- runs ----------

const besieged = (party) => { const st = getState(); return !!st.active && !!ownerOfParty(party) && (st.besieged?.includes(ownerOfParty(party)) || !!st.plans?.[ownerOfParty(party)]); };
const ownerOnline = (party) => { const id = ownerOfParty(party); return !!id && world.getPlayers().some((p) => p.id === id); };
const seepBegun = () => { try { return worldChapter() >= 3; } catch { return false; } }; // "The Leaning": the seep is spreading

function deliver(party, load, kind = "im") {
  if (isNpc(party)) return; // an NPC uses what it gets
  const o = outpostOf(party);
  if (!o) return;
  add(o[kind] ??= {}, load.id, load.n);
  syncOutpost(party);
}

function tryRun(route, t) {
  const fail = (short, what) => { afterTry(route, { ok: false, short, what }, t); };
  if (!Number.isFinite(lineLength(route.a, route.b))) return fail("a", "line");
  if (besieged(route.a) || besieged(route.b)) return fail(besieged(route.a) ? "a" : "b", "siege");
  for (const [k, p, load] of [["a", route.a, route.get], ["b", route.b, route.give]]) {
    if (isNpc(p)) continue;
    const o = outpostOf(p);
    if (!o?.stage) return fail(k, "line");
    syncOutpost(p);
    if (stacksOf({ ...o.im, [load.id]: (o.im?.[load.id] ?? 0) + load.n }) > TRADE.barrelSlots + TRADE.dockStacks) return fail(k, "imports");
  }
  const length = lineLength(route.a, route.b);
  const sides = { a: { ledger: ledgerFor(route.a, "ex") }, b: { ledger: ledgerFor(route.b, "ex") } };
  const result = depart(route, sides);
  afterTry(route, result, t);
  if (!result.ok) {
    const short = result.short === "a" ? route.a : route.b;
    if (route.state === "dormant") { notify(route.a, `The route with ${partyName(route.b)} has gone dormant. Refill and press Resume at the Trade Board.`); notify(route.b, `The route with ${partyName(route.a)} has gone dormant.`); }
    else if (!route.toldShort) notify(short, `Your route with ${partyName(short === route.a ? route.b : route.a)} is paused: ${whyText(route, short)}.`);
    route.toldShort = true;
    return;
  }
  route.toldShort = false;
  for (const p of [route.a, route.b]) if (!isNpc(p)) syncOutpost(p);
  route.onLine = { arrives: t + travelTicks(length), toA: { ...route.get }, toB: { ...route.give } };
  lineEvents(route, length, t);
}

// Hold-ups, market rushes, washouts and strange cargo
function lineEvents(route, length, t) {
  const online = [route.a, route.b].filter((p) => !isNpc(p) && ownerOnline(p));
  if (!online.length) return;
  const r = Math.random();
  if (length >= TRADE.holdUpMin && r < TRADE.holdUpChance) return holdUp(route, online[0], t);
  if (r < TRADE.holdUpChance + TRADE.washoutChance) {
    route.onLine.arrives += DAY;
    for (const p of online) notify(p, `A storm washed out a stretch of the line. The goods to and from ${partyName(p === route.a ? route.b : route.a)} are held up a day.`);
    return;
  }
  const npc = [route.a, route.b].find(isNpc);
  if (npc && npc !== CAPITAL && Math.random() < TRADE.rushChance) {
    const toPlayer = npc === route.a ? "toB" : "toA";
    const extra = Math.max(1, Math.ceil(route.onLine[toPlayer].n * 0.2));
    route.onLine[toPlayer].n += extra;
    notify(npc === route.a ? route.b : route.a, `${partyName(npc)} is short of ${niceGood((npc === route.a ? route.get : route.give).id)} and keen: they put ${extra} more ${niceGood(route.onLine[toPlayer].id)} on this run.`);
    return;
  }
  if (isNight() && seepBegun() && Math.random() < TRADE.nightChance) {
    route.onLine.night = true;
  }
}

function holdUp(route, victim, t) {
  const path = pathPoint(route);
  if (!path) return;
  S().holdUps[route.id] = { victim, at: path, until: t + TRADE.holdUpSeconds * 20, spawned: false, side: victim === route.a ? "toA" : "toB" };
  notify(victim, `§cBandits have stopped the goods wagon from ${partyName(victim === route.a ? route.b : route.a)} near ${path.x}, ${path.z}! Get there within ${TRADE.holdUpSeconds / 60} minutes and beat them, or the load is lost.`);
}

// A spot on the track between two parties, about halfway (the middle of the longest laid stretch near the middle)
function pathPoint(route) {
  const a = stopById(partyStop(route.a)), b = stopById(partyStop(route.b));
  if (!a || !b) return undefined;
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  let best, bestD = Infinity;
  for (const seg of ROUTES.segments) {
    if (!isBuilt(seg.id)) continue;
    const blk = seg.blocks[Math.floor(seg.blocks.length / 2)];
    const d = Math.hypot(blk[0] - mid.x, blk[2] - mid.z);
    if (d < bestD) { best = { x: blk[0], y: blk[1], z: blk[2] }; bestD = d; }
  }
  return best;
}

const BANDITS = ["siege:grey_axeman", "siege:grey_spearman", "siege:grey_bowman"];
function holdUpTick(t) {
  for (const [id, h] of Object.entries(S().holdUps)) {
    const route = S().routes.find((r) => r.id === id) ?? (S().ended ?? []).find((r) => r.id === id);
    const tag = `siege_trade_holdup_${id}`;
    const dim = world.getDimension("minecraft:overworld");
    if (!route?.onLine) { delete S().holdUps[id]; continue; }
    if (!h.spawned) {
      const near = world.getPlayers().some((p) => Math.hypot(p.location.x - h.at.x, p.location.z - h.at.z) < 48);
      if (near) {
        try {
          if (dim.getBlock(h.at)) {
            for (let i = 0; i < 3; i++) {
              const e = dim.spawnEntity(BANDITS[i % BANDITS.length], { x: h.at.x + 2 * i - 2 + 0.5, y: h.at.y + 1, z: h.at.z + 0.5 });
              e.addTag(tag);
              e.nameTag = "Line Bandit";
            }
            h.spawned = true;
          }
        } catch {}
      }
    } else {
      let left = 0;
      try { left = dim.getEntities({ tags: [tag] }).length; } catch {}
      if (left === 0) {
        notify(h.victim, "§aYou drove off the bandits. The goods wagon rolls on.");
        delete S().holdUps[id];
        continue;
      }
    }
    if (t >= h.until) {
      try { for (const e of dim.getEntities({ tags: [tag] })) e.remove(); } catch {}
      route.onLine[h.side] = { ...route.onLine[h.side], n: 0 };
      notify(h.victim, "§cThe bandits got away with the load.");
      delete S().holdUps[id];
    }
  }
}

const ODD = ["minecraft:echo_shard", "minecraft:amethyst_shard", "minecraft:phantom_membrane"];

function arrive(route) {
  const ol = route.onLine;
  route.onLine = null;
  if (S().holdUps[route.id]) { // still being robbed: the wagon waits
    route.onLine = ol;
    return;
  }
  if (ol.toA.n > 0) deliver(route.a, ol.toA);
  if (ol.toB.n > 0) deliver(route.b, ol.toB);
  if (ol.night) {
    const p = [route.a, route.b].find((x) => !isNpc(x));
    if (p) {
      const o = outpostOf(p);
      if (Math.random() < 0.5 && o) { const id = ODD[Math.floor(Math.random() * ODD.length)]; add(o.im ??= {}, id, 1); }
      notify(p, "§7The night train came in late. The guard won't say what he saw on the line, and there's a crate in the wagon nobody loaded.", { chat: true });
    }
  }
  for (const p of [route.a, route.b]) if (!isNpc(p)) S().seen[p] = (S().seen[p] ?? 0) + 1;
  if (route.b.startsWith("l:") && route.clean && route.clean % TRADE.relationStep === 0) {
    const lord = rivalById(route.b.slice(2)); const pid = ownerOfParty(route.a);
    if (lord && pid) { changeRelation(lord, pid, 1); notify(route.a, `${partyName(route.b)} is pleased with how your route runs. Their terms will be kinder.`); }
  }
}

function runTick() {
  if (!isReady()) return;
  const t = now();
  for (const route of [...S().routes]) {
    if (route.onLine && t >= route.onLine.arrives) arrive(route);
    if (route.onLine) continue;
    if (finished(route)) {
      S().routes = S().routes.filter((r) => r !== route);
      for (const p of [route.a, route.b]) notify(p, `Your route with ${partyName(p === route.a ? route.b : route.a)} has run all its ${route.runs} runs and closed.`);
      continue;
    }
    if (route.state === "dormant" || t < (route.nextAt ?? 0)) continue;
    try { tryRun(route, t); } catch (e) { console.warn(`[Hollow Crown] trade route ${route.id}: ${e}`); }
  }
  for (const route of [...(S().ended ?? [])]) {
    if (route.onLine && t >= route.onLine.arrives) arrive(route);
    if (!route.onLine) S().ended = S().ended.filter((r) => r !== route);
  }
  holdUpTick(t);
  npcReplies();
  npcProposals();
  expireOffers();
  store.save();
}
onTick("trade_runs", 40, runTick);

// ---------- the works' Supply Line ----------

// The top tier of a works hands what it made to its settlement's Outpost. Returns how many the Outpost took.
export function supplyExports(settlementId, itemId, count) {
  try {
    if (!isReady() || !(count > 0)) return 0;
    const party = `p:${settlementId}`;
    const o = outpostOf(party);
    if (!o?.stage) return 0;
    const n = supplyTake(o.ex ??= {}, needsOf(S().routes, party), itemId, count);
    if (n > 0) { add(o.ex, itemId, n); store.save(); }
    return n;
  } catch {
    return 0;
  }
}

// ---------- the wing ----------

export const siteOfOwner = (owner) => allSites().find((s) => s.owner === owner);

// Why this player can't raise an Outpost, or undefined
export function wingProblem(player) {
  const site = siteOfOwner(player.id);
  if (!site?.built || !site.origin) return "Your settlement needs its station built first.";
  if (!partnersOf(`p:${player.id}`).length && !ROUTES.segments.some((s) => isBuilt(s.id) && (s.from === homeStop(player.id) || s.to === homeStop(player.id)))) return "Buy your first stretch of line first: an Outpost needs a railway to trade along.";
  return undefined;
}

function wingJob(owner) { return `tradewing:${owner}`; }

export function raiseWing(owner, keepItems = true) {
  const site = siteOfOwner(owner);
  if (!site?.origin || !site.built) return false;
  const party = `p:${owner}`;
  const o = (S().outposts[party] ??= { owner, wagons: 0, ex: {}, im: {}, exSnap: {}, imSnap: {} });
  const stage = site.built;
  const join = worldMarks(stationPlan(site.style, stage), site.origin, site.forward).trade_join;
  if (!join) return false;
  if (keepItems && o.stage) syncOutpost(party);
  const plan = wingPlan(site.style, stage);
  const origin = wingOrigin(join);
  const remove = o.stage && o.stage !== stage && o.origin ? worldCells(wingPlan(site.style, o.stage), o.origin, site.forward) : undefined;
  o.building = stage;
  store.save();
  startBuild({
    id: wingJob(owner), dimensionId: site.dim, origin, forward: site.forward, plan, style: plan.style, perTick: 48, remove,
    onDone: () => finishWing(owner, site, plan, origin, stage),
  });
  return true;
}

function finishWing(owner, site, plan, origin, stage) {
  const party = `p:${owner}`;
  const o = outpostOf(party);
  if (!o) return;
  const marks = worldMarks(plan, origin, site.forward);
  const dim = world.getDimension(site.dim);
  // the old crates' goods stay in the ledger and go into the new ones
  for (const k of ["board", "exports", "imports"]) {
    if (o[k] && (o[k].x !== marks[k].x || o[k].y !== marks[k].y || o[k].z !== marks[k].z)) {
      try { dim.getBlock(o[k])?.setPermutation(BlockPermutation.resolve("minecraft:air")); } catch {}
    }
  }
  try {
    dim.getBlock(marks.board)?.setPermutation(BlockPermutation.resolve(TRADE_BOARD));
    for (const k of ["exports", "imports"]) {
      const b = dim.getBlock(marks[k]);
      if (b && b.typeId !== BARREL) b.setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 }));
    }
  } catch (e) {
    console.warn(`[Hollow Crown] trade wing: ${e}`);
  }
  o.dim = site.dim; o.board = marks.board; o.exports = marks.exports; o.imports = marks.imports; o.origin = origin;
  o.stage = stage; o.building = undefined;
  o.exSnap = {}; o.imSnap = {}; // the next look puts everything in the ledger into the (new) crates
  store.save();
  syncOutpost(party);
  store.save();
  notify(party, stage === "halt" || !o.grown ? "Your Trade Outpost is open. Click the Trade Board inside to set up your first route." : "Your Trade Outpost has grown with your station: it can run more routes and carry more each run.");
  o.grown = true;
  emit("tradeOutpostBuilt", { owner, stage });
}

// Keep the wing the size of the station
onTick("trade_wings", 100, () => {
  if (!isReady()) return;
  for (const [party, o] of Object.entries(S().outposts)) {
    if (!party.startsWith("p:") || !o.stage || o.test) continue;
    const site = siteOfOwner(o.owner);
    if (!site?.built || site.built === o.stage || o.building || buildFor(wingJob(o.owner))) continue;
    if (!world.getPlayers().some((p) => p.dimension.id === site.dim && Math.hypot(p.location.x - site.post.x, p.location.z - site.post.z) < 160)) continue;
    raiseWing(o.owner);
  }
});

// The crates and board can't be broken, and only the owner and allies may open the crates
world.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (!isReady()) return;
  if (e.block.typeId !== BARREL && e.block.typeId !== TRADE_BOARD) return;
  const hit = outpostAtCrate(e.block);
  if (!hit) return;
  e.cancel = true;
  system.run(() => { try { e.player.onScreenDisplay.setActionBar("§7That belongs to the Trade Outpost."); } catch {} });
});
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.isFirstEvent === false || !isReady() || e.block.typeId !== BARREL) return;
  const hit = outpostAtCrate(e.block);
  if (!hit) return;
  const owner = hit[1].owner;
  if (e.player.id === owner || isAlly(owner, e.player.id)) {
    system.run(() => { const o = outpostOf(hit[0]); if (o) { syncOutpost(hit[0]); store.save(); } });
    return;
  }
  e.cancel = true;
  system.run(() => { try { e.player.onScreenDisplay.setActionBar("§7Only the settlement's people can open its trade crates."); } catch {} });
});

// A fallen keep cancels routes between the two; a moved or lost settlement keeps its ledger
on("keepFallen", ({ owner }) => {
  const party = `p:${owner}`;
  for (const r of routesOf(party)) notify(r.a === party ? r.b : r.a, `${partyName(party)}'s keep has fallen. Your route with them is paused until things settle.`);
});

import "./menus.js";

// ---------- tests in a world ----------

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
  if (!id.startsWith("siege:trade_")) return;
  if (id === "siege:trade_reset") { S().offers = []; S().routes = []; S().pending = {}; S().holdUps = {}; store.save(); p?.sendMessage?.("§7Every trade offer and route is gone."); return; }
  if (id === "siege:trade_day") {
    for (const r of S().routes) { r.nextAt = Math.min(r.nextAt ?? 0, now()); if (r.onLine) r.onLine.arrives = now(); }
    for (const k of Object.keys(S().pending)) S().pending[k] = now();
    for (const rec of Object.values(S().npc)) rec.at -= DAY;
    store.save();
    runTick();
    p?.sendMessage?.("§7Every trade route jumped a day ahead.");
    return;
  }
  if (id === "siege:trade_test" && p?.typeId === "minecraft:player") testOutpost(p);
});

// An Outpost where you stand: board in front, crates either side. Needs your own settlement.
export function testOutpost(p) {
  if (!keepOf(p.id)) return p.sendMessage("§7Found a settlement first (place a Keep Banner).");
  const v = p.getViewDirection();
  const f = Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x), z: 0 } : { x: 0, z: Math.sign(v.z) };
  const r = { x: -f.z, z: f.x };
  const base = { x: Math.floor(p.location.x) + 2 * f.x, y: Math.floor(p.location.y), z: Math.floor(p.location.z) + 2 * f.z };
  const at = (k) => ({ x: base.x + k * r.x, y: base.y, z: base.z + k * r.z });
  const dim = p.dimension;
  dim.getBlock(at(0))?.setPermutation(BlockPermutation.resolve(TRADE_BOARD));
  dim.getBlock(at(-2))?.setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 }));
  dim.getBlock(at(2))?.setPermutation(BlockPermutation.resolve(BARREL, { facing_direction: 1 }));
  const party = `p:${p.id}`;
  const old = S().outposts[party];
  S().outposts[party] = { owner: p.id, wagons: old?.wagons ?? 0, ex: old?.ex ?? {}, im: old?.im ?? {}, exSnap: {}, imSnap: {}, dim: dim.id, board: at(0), exports: at(-2), imports: at(2), stage: old?.stage ?? "station", test: true, grown: true };
  store.save();
  p.sendMessage("§6Test Trade Outpost placed: the Trade Board, Exports (left) and Imports (right). Routes still need laid track to a partner; /scriptevent siege:trade_day runs them a day ahead.");
}

on("showcase", ({ dim, nextSpot, label }) => {
  try {
    const at = nextSpot();
    dim.getBlock(at)?.setPermutation(BlockPermutation.resolve(TRADE_BOARD));
    label(at, "Trade Board");
  } catch {}
});

