// Trade Outposts: the menus. The Trade Board (requests, proposing, your routes, Goods Wagons, how it works) and the
// station menu's "Trade Outpost" button that raises the wing.

import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, isAlly, keepOf } from "../siege/api.js";
import { charge, coins, funds } from "../economy/api.js";
import { sfx } from "../core/sfx.js";
import { stationMenuExtras } from "../rails/index.js";
import { hasUnlocked } from "../trains/index.js";
import { TRADE, GOODS, COIN } from "./data.js";
import { fairnessText, loadText, niceGood, offerProblem, travelTicks, freightOf, capitalPrice, routesAllowed, moneyIn } from "./rules.js";
import {
  TRADE_BOARD, CAPITAL, S_ACCESS, outpostOf, partyName, partyRegion, partyStage, partnersOf, routesOf, waitingFor, noticesOf, clearNotices,
  sendOffer, counterOffer, rejectOffer, acceptOffer, cancelRoute, resumeRoute, whyText, cargoFor, sameRoute, roomFor, isNpc,
  siteOfOwner, wingProblem, raiseWing, saveTrade, syncOutpost, lineLength,
} from "./index.js";

const say = (player, text) => { try { player.sendMessage(text); } catch {} };
const TRADABLE = GOODS.filter((g) => g.id !== "siege:gold_coin");
const goodLabel = (g) => niceGood(g.id).replace(/\b\w/g, (c) => c.toUpperCase());
const minutes = (ticks) => { const s = Math.round(ticks / 20); return s < 90 ? `${s} seconds` : `${Math.round(s / 60)} minutes`; };
const STRONG = { "Aldmere Vale": "farming and timber", Frostmarch: "diamonds (short of iron)", Saltreach: "iron and fish (short of gold)", Emberwaste: "gold (short of diamonds)", Blackfen: "herbs and mushrooms" };

// ---------- the board ----------

function boardOwner(block) {
  return Object.entries(S_ACCESS().outposts).find(([, o]) => o.board && o.dim === block.dimension.id && o.board.x === block.location.x && o.board.y === block.location.y && o.board.z === block.location.z);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady() || block.typeId !== TRADE_BOARD) return;
  event.cancel = true;
  system.run(() => {
    const hit = boardOwner(block);
    if (!hit) return player.onScreenDisplay.setActionBar("§7This Trade Board isn't part of a station's Outpost.");
    const [party, o] = hit;
    if (player.id !== o.owner && !isAlly(o.owner, player.id)) return player.onScreenDisplay.setActionBar("§7Only the settlement's people can use its Trade Board.");
    board(player, party).catch((e) => console.warn(`[Hollow Crown] trade board: ${e}`));
  });
});

async function board(player, party) {
  syncOutpost(party);
  saveTrade();
  const S = S_ACCESS();
  if (!S.seen?.[`intro:${player.id}`]) {
    (S.seen ??= {})[`intro:${player.id}`] = 1;
    saveTrade();
    await howItWorks(player);
  }
  const o = outpostOf(party);
  const asks = waitingFor(party);
  const routes = routesOf(party);
  const news = noticesOf(party).slice(-4).map((n) => `§7- ${n.text}`).join("\n");
  const lines = routes.map((r) => `${r.state === "live" ? "§a●" : r.state === "dormant" ? "§8●" : "§c●"}§r ${partyName(r.a === party ? r.b : r.a)}: ${routeTerms(r, party)}${r.state !== "live" ? `\n   §c${r.state === "dormant" ? "Dormant" : "Paused"}: ${whyText(r, party)}` : r.onLine ? "\n   §7Goods on the line" : ""}`);
  const body = [
    `Routes: ${routes.length} of ${routesAllowed(partyStage(party))} · Cargo a run: ${cargoFor(party)} of a thing each way`,
    `Exports hold ${moneyIn(o.ex ?? {})} Regals for freight.`,
    lines.length ? `\n${lines.join("\n")}` : "\n§7No routes yet. Propose one, or wait for an offer.",
    news ? `\n§fLatest:\n${news}` : "",
  ].join("\n");
  const entries = [
    asks.length && { label: `§e${asks.length === 1 ? "1 trade request" : `${asks.length} trade requests`} waiting`, action: () => requests(player, party) },
    { label: "Propose a trade\n§8pick a partner and terms", action: () => propose(player, party) },
    routes.length && { label: "Your routes\n§8see, resume or end them", action: () => routeList(player, party) },
    { label: `Goods Wagons (${o.wagons ?? 0} of ${TRADE.maxWagons})\n§8+${TRADE.wagonStacks} stacks a run each`, action: () => wagons(player, party) },
    { label: "How trade routes work", action: () => howItWorks(player) },
  ].filter(Boolean);
  const form = new ActionFormData().title("Trade Board").body(body);
  for (const e of entries) form.button(e.label);
  form.button("Close");
  const res = await form.show(player);
  if (res.canceled || res.selection >= entries.length) { clearNotices(party); return; }
  await entries[res.selection].action();
}

// Terms of a route seen from `party`
function routeTerms(r, party) {
  const [send, back] = r.a === party ? [r.give, r.get] : [r.get, r.give];
  return `you send ${loadText(send)}, get ${loadText(back)}, ${TRADE.everyNames[r.every]}${r.runs ? ` (${r.done ?? 0}/${r.runs} runs)` : ""}`;
}
// Terms of an offer seen from `party`
function offerTerms(o, party) {
  const [send, back] = o.from === party ? [o.give, o.get] : [o.get, o.give];
  return { send, back };
}

async function howItWorks(player) {
  await new ActionFormData().title("Trade routes").body([
    "§fA trade route§r is a standing deal with another settlement: \"I send 20 iron, you send 4 gold, every day.\" Both sides must accept the same terms. Either side can send a counteroffer.",
    "",
    "§fYour train runs it for you.§r You won't see it. Each run takes your side out of your §fExports§r barrel and theirs out of their Exports at the same moment, and after the trip (the real track distance) drops each load in the other side's §fImports§r barrel.",
    "",
    "§fKeep your Exports stocked.§r If either side is short, nothing leaves and the route pauses until it's refilled. After 3 days paused it goes dormant: refill and press Resume.",
    "",
    "§fFreight:§r whoever proposed the route pays a few Regals a run, taken from Regals in their Exports barrel.",
    "",
    "§fRival Lords and towns§r trade too, and will write to you. §fKingsrest§r buys any trade good for Regals at a set price.",
    "",
    "Routes keep running while you're away. Your station grows with your settlement, and so do the routes it can run and what each run carries.",
  ].join("\n")).button("Got it").show(player);
}

// ---------- requests ----------

async function requests(player, party) {
  const asks = waitingFor(party);
  if (!asks.length) return board(player, party);
  const form = new ActionFormData().title("Trade requests").body("Offers waiting for your answer:");
  for (const o of asks) {
    const other = o.from === party ? o.to : o.from;
    const { send, back } = offerTerms(o, party);
    form.button(`${o.round ? "Counteroffer" : "Request"} from ${partyName(other, { color: false })}\n§8you send ${loadText(send)}, get ${loadText(back)}`);
  }
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const o = asks[res.selection];
  if (!o) return board(player, party);
  await review(player, party, o);
}

async function review(player, party, o) {
  const other = o.from === party ? o.to : o.from;
  const { send, back } = offerTerms(o, party);
  const ex = outpostOf(party)?.ex ?? {};
  const length = lineLength(party, other);
  const mine = { give: send, get: back, every: o.every };
  const body = [
    `${o.round ? "A counteroffer" : "A trade request"} from ${partyName(other)} (${partyRegion(other) ?? "?"}).`,
    "",
    `§fYou send:§r ${loadText(send)} ${TRADE.everyNames[o.every]}  §7(you have ${ex[send.id] ?? 0} in Exports)`,
    `§fYou get:§r ${loadText(back)}`,
    o.runs ? `For ${o.runs} runs.` : "Until either side ends it.",
    `By the Moneyer's ladder this is ${fairnessText(mine)}§r.`,
    Number.isFinite(length) ? `§7Each trip takes about ${minutes(travelTicks(length))}.${o.from !== party ? ` Freight (${coins(freightOf(length))} a run) is theirs to pay.` : ` Freight is ${coins(freightOf(length))} a run, from your Exports.`}` : "§cNo laid track joins you right now.",
  ].join("\n");
  const res = await new ActionFormData().title("Review the trade").body(body)
    .button("§aAccept").button("Counteroffer").button("§cReject").button("Back").show(player);
  if (res.canceled || res.selection === 3) return requests(player, party);
  if (res.selection === 0) {
    const problem = acceptOffer(o, party);
    if (problem) say(player, `§c${problem}`);
    else { sfx(player, "random.levelup"); say(player, `§6The route with ${partyName(other)} is live.`); }
    return;
  }
  if (res.selection === 1) {
    const terms = await termsForm(player, party, other, { give: send, get: back, every: o.every, runs: o.runs }, "Counteroffer");
    if (!terms) return review(player, party, o);
    const [give, get] = o.from === party ? [terms.give, terms.get] : [terms.get, terms.give];
    counterOffer(o, party, give, get, terms.every, terms.runs);
    say(player, `§6Counteroffer sent to ${partyName(other)}.`);
    return;
  }
  const why = await new ModalFormData().title("Reject").dropdown("Tell them why (optional)", ["(say nothing)", "Not enough in return", "We can't spare that", "Too often", "Not now"]).show(player);
  const reasons = [undefined, "Not enough in return", "We can't spare that", "Too often", "Not now"];
  rejectOffer(o, party, why.canceled ? undefined : reasons[why.formValues?.[0] ?? 0]);
  say(player, "§7Turned down.");
}

// ---------- proposing ----------

async function propose(player, party) {
  if (!roomFor(party)) {
    say(player, `§7Your station runs ${routesAllowed(partyStage(party))} route(s) at most. It grows with your settlement, or end a route first.`);
    return board(player, party);
  }
  const partners = partnersOf(party);
  if (!partners.length) {
    await new ActionFormData().title("Propose a trade").body("No other settlement's station is joined to yours by laid track yet.\n\nBuy stretches of line at your station (Extend the line) to reach other settlements, the towns and Kingsrest.").button("Back").show(player);
    return board(player, party);
  }
  const form = new ActionFormData().title("Who with?").body("Every station your laid track reaches:");
  for (const p of partners) {
    const region = partyRegion(p.party);
    const what = p.party === CAPITAL ? "buys anything for Regals" : STRONG[region] ?? region ?? "";
    form.button(`${partyName(p.party, { color: false })}\n§8${what} · ${p.length} blocks`);
  }
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const pick = partners[res.selection];
  if (!pick) return board(player, party);
  const terms = await termsForm(player, party, pick.party, undefined, "Propose");
  if (!terms) return propose(player, party);
  const problem = offerProblem({ from: party, to: pick.party, ...terms }, { cargoFrom: cargoFor(party), cargoTo: cargoFor(pick.party), sameRoute: sameRoute(party, pick.party, terms.give, terms.get) });
  if (problem) { say(player, `§c${problem}`); return propose(player, party); }
  const length = pick.length;
  const ok = await new ActionFormData().title("Send this offer?").body([
    `To ${partyName(pick.party)}:`,
    "",
    `§fYou send:§r ${loadText(terms.give)} ${TRADE.everyNames[terms.every]}`,
    `§fYou get:§r ${loadText(terms.get)}`,
    terms.runs ? `For ${terms.runs} runs.` : "Until either side ends it.",
    `By the Moneyer's ladder this is ${fairnessText(terms)}§r.`,
    `§7Freight: ${coins(freightOf(length))} a run, from Regals in your Exports. Each trip about ${minutes(travelTicks(length))}.`,
    isNpc(pick.party) ? "§7They will answer in a few hours." : "§7They'll see it over their Trade Board.",
  ].join("\n")).button("§aSend").button("Back").show(player);
  if (ok.canceled || ok.selection !== 0) return propose(player, party);
  sendOffer(party, pick.party, terms);
  sfx(player, "random.orb");
  say(player, `§6Offer sent to ${partyName(pick.party)}.`);
}

// The terms form. `start` is from the player's side ({ give: they send, get: they receive }).
async function termsForm(player, party, other, start, title) {
  const ids = TRADABLE.map((g) => g.id);
  const names = TRADABLE.map(goodLabel);
  const every = Object.keys(TRADE.every);
  const capital = other === CAPITAL;
  const form = new ModalFormData().title(`${title}: ${partyName(other, { color: false })}`)
    .dropdown("You send", names, { defaultValueIndex: Math.max(0, ids.indexOf(start?.give.id ?? "minecraft:iron_ingot")) })
    .textField(capital ? "How many a run (Kingsrest pays Regals at its set price)" : "How many a run", "e.g. 20", { defaultValue: String(start?.give.n ?? 16) });
  if (!capital) form.dropdown("You get", names, { defaultValueIndex: Math.max(0, ids.indexOf(start?.get.id ?? "minecraft:gold_ingot")) })
    .textField("How many a run", "e.g. 4", { defaultValue: String(start?.get.n ?? 4) });
  form.dropdown("How often", every.map((k) => TRADE.everyNames[k]), { defaultValueIndex: Math.max(0, every.indexOf(start?.every ?? "day")) })
    .dropdown("For how long", TRADE.maxRunsChoice.map((n) => (n ? `${n} runs` : "until someone ends it")), { defaultValueIndex: Math.max(0, TRADE.maxRunsChoice.indexOf(start?.runs ?? 0)) });
  const res = await form.show(player);
  if (res.canceled) return undefined;
  const v = res.formValues ?? [];
  const num = (s) => Math.max(0, Math.floor(Number(String(s).trim()) || 0));
  if (capital) {
    const give = { id: ids[v[0]], n: num(v[1]) };
    return { give, get: { id: COIN, n: capitalPrice(give) }, every: every[v[2]], runs: TRADE.maxRunsChoice[v[3]] };
  }
  return { give: { id: ids[v[0]], n: num(v[1]) }, get: { id: ids[v[2]], n: num(v[3]) }, every: every[v[4]], runs: TRADE.maxRunsChoice[v[5]] };
}

// ---------- routes ----------

async function routeList(player, party) {
  const routes = routesOf(party);
  const form = new ActionFormData().title("Your routes");
  for (const r of routes) form.button(`${partyName(r.a === party ? r.b : r.a, { color: false })}\n§8${r.state}${r.onLine ? " · on the line" : ""}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  const r = routes[res.selection];
  if (!r) return board(player, party);
  const other = r.a === party ? r.b : r.a;
  const f = new ActionFormData().title("Route").body([
    `With ${partyName(other)}: ${routeTerms(r, party)}.`,
    r.state === "live" ? "§aRunning." : `§c${r.state === "dormant" ? "Dormant" : "Paused"}: ${whyText(r, party)}.`,
    r.onLine ? "§7Goods are on the line now." : "",
    `Runs so far: ${r.done ?? 0}.`,
  ].join("\n"));
  const acts = [];
  if (r.state === "dormant") { f.button("Resume"); acts.push(() => { resumeRoute(r); say(player, "§6The route will try again now."); }); }
  f.button("§cEnd this route"); acts.push(async () => {
    const sure = await new ActionFormData().title("End the route?").body(`End your route with ${partyName(other)}? Anything already on the line still arrives.`).button("§cEnd it").button("Back").show(player);
    if (!sure.canceled && sure.selection === 0) { cancelRoute(r, party); say(player, "§7Route ended."); }
  });
  f.button("Back"); acts.push(() => routeList(player, party));
  const pick = await f.show(player);
  if (pick.canceled) return;
  await acts[pick.selection]?.();
}

async function wagons(player, party) {
  const o = outpostOf(party);
  const n = o.wagons ?? 0;
  if (n >= TRADE.maxWagons) {
    await new ActionFormData().title("Goods Wagons").body("Your train already pulls every Goods Wagon it can.").button("Back").show(player);
    return board(player, party);
  }
  const res = await new ActionFormData().title("Goods Wagons").body(`A Goods Wagon adds ${TRADE.wagonStacks} stacks to what every run carries each way.\n\nYou have ${n} of ${TRADE.maxWagons}. You can spend ${coins(funds(player))}.`)
    .button(`Buy one for ${coins(TRADE.wagonPrice)}`).button("Back").show(player);
  if (res.canceled || res.selection !== 0) return board(player, party);
  if (!charge(player, TRADE.wagonPrice, "goods wagon")) return say(player, "§cNot enough Regals.");
  o.wagons = n + 1;
  saveTrade();
  sfx(player, "random.anvil_use");
  say(player, `§6A Goods Wagon joins your train: each run now carries ${cargoFor(party)} of a thing each way.`);
}

// ---------- the station menu ----------

stationMenuExtras.push({
  label: (player) => {
    const site = siteOfOwner(player.id);
    if (!site || !keepOf(player.id)) return undefined;
    const o = outpostOf(`p:${player.id}`);
    if (o?.stage && !o.test) return undefined; // built: the board is inside
    if (o?.building) return "Trade Outpost\n§8going up";
    return `Build a Trade Outpost\n§8${coins(TRADE.wingPrice)} · standing trades by train`;
  },
  action: async (player) => {
    const o = outpostOf(`p:${player.id}`);
    if (o?.building) return say(player, "§7Your Trade Outpost is still going up beside the station.");
    const problem = wingProblem(player);
    const engine = hasUnlocked(player.id, "engine");
    const body = [
      "A Trade Outpost is a wing on your station where you set up standing trades with other settlements, Rival Lords and the towns. Your train carries the goods back and forth while you're away.",
      "",
      `Cost: ${coins(TRADE.wingPrice)}. You can spend ${coins(funds(player))}.`,
      engine ? "§aYou own an engine." : "§cYou need to own a Train Engine first (made at the Siege Workshop, or bought at a station).",
      problem ? `§c${problem}` : "§aYour station is on the line.",
    ].join("\n");
    const res = await new ActionFormData().title("Trade Outpost").body(body).button(problem || !engine ? "Back" : `Build it for ${coins(TRADE.wingPrice)}`).button("Close").show(player);
    if (res.canceled || res.selection !== 0 || problem || !engine) return;
    if (!charge(player, TRADE.wingPrice, "trade outpost")) return say(player, "§cNot enough Regals.");
    if (!raiseWing(player.id)) return say(player, "§cThe ground by your station isn't ready. Try again from the station when you're close.");
    say(player, "§6Your Trade Outpost is going up beside the station.");
  },
});
