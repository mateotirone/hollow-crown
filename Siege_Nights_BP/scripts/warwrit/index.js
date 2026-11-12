// War Writs: declaring a siege on another player's settlement (Mateo, 2026-11-12).
//
//   Grounds   they hold a relic, attacked your settlement, or refused your demand (rules.js groundsFor)
//   Declare   click their Keep Banner, "Declare war": pay the fee, the whole server is told
//   Muster    until the next nightfall (at least 3 real minutes): their gates shut and stay shut
//   Assault   that one night: their walls, vault, Regal Safe and guards can be attacked whether or not they are
//             online, and the attackers are Wanted on their land so archers and Men-at-Arms go for them.
//             The Keep Banner can't be carried off. Crack the vault before dawn and the attackers win; the vault
//             stays open to them until dawn. Hold until dawn and the defenders win.
//   After     a few real days of peace between the two
//
// Leaving the game changes nothing: a declared siege runs to dawn. The attackers are the declarer and their
// allies; the defenders the settlement's owner and theirs.
//
//   /scriptevent siege:writ_status    every writ, demand and peace
//   /scriptevent siege:writ_night     (testing) skip to the assault of the writ you hold or face
//
// Events: writDeclared { attacker, defender, grounds, day }, writAssault { attacker, defender },
// writVaultCracked { attacker, defender, by }, writEnded { attacker, defender, winner },
// demandSent / demandAnswered { from, to, amount, paid }.

import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, onTick, moduleStore, emit, on, isAlly, keepOf, addKeepMenuButtons, recordWin } from "../siege/api.js";
import { addFilter } from "../core/events.js";
import { charge, giveCoins, banked, robBank } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { holdWanted } from "../siege/guards.js";
import { barGates } from "../settle/walls.js";
import { holdsRelic } from "../vault/index.js";
import { settlementAt } from "../siege/territory.js";
import { WRIT, assaultDay, phase, groundsFor, GROUNDS_TEXT, pairKey, demandAmount, cantDeclare } from "./rules.js";
import "./tests.js";

const store = moduleStore("siege:warwrit", () => ({ writs: {}, peace: {}, feuds: {}, refused: {}, demands: {} }));
const S = () => store.data;
const OVERWORLD = "minecraft:overworld";

const nameOf = (id) => keepOf(id)?.name ?? world.getPlayers().find((p) => p.id === id)?.name ?? "someone";
const online = (id) => world.getPlayers().find((p) => p.id === id);
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };
const now = () => Date.now();
const clock = () => ({ day: world.getDay(), tod: world.getTimeOfDay() });
const phaseOf = (writ) => { const c = clock(); return phase(writ, c.day, c.tod); };
const sideOf = (lead, id) => id === lead || isAlly(lead, id);

// ---------- what a writ changes elsewhere ----------

// During the assault the settlement can be attacked even with its keeper away (siege/util.js attackable)
addFilter("openToAttack", (open, { owner }) => open || phaseOf(S().writs[owner]) === "assault");
// Its gates stay shut from the declaration to dawn (settle/walls.js), and its Keep Banner can't be carried off
addFilter("gatesBarred", (barred, { owner }) => barred || !!S().writs[owner]);
addFilter("bannerShielded", (shielded, { owner }) => shielded || !!S().writs[owner]);

// Attacking someone's settlement gives them grounds on you
on("settlementAttacked", ({ owner, by }) => {
  if (!owner || !by || owner === by) return;
  S().feuds[`${owner}>${by}`] = now() + WRIT.feudMs;
  store.save();
});

function groundsOf(attacker, defender) {
  return groundsFor({
    relic: holdsRelic(defender),
    feudUntil: S().feuds[`${attacker}>${defender}`],
    refusedUntil: S().refused[`${attacker}>${defender}`],
    now: now(),
  });
}

function announce(text, discord) {
  world.sendMessage(text);
  emit("discordAlert", { kind: "warWrit", text: discord ?? text.replace(/§./g, ""), ping: [], hollow: false });
}

// ---------- declaring ----------

async function declareMenu(player, defender) {
  const attacker = player.id, s = S();
  const grounds = groundsOf(attacker, defender);
  const problem = cantDeclare({
    attacker, defender, hasKeep: !!keepOf(attacker), targetKeep: keepOf(defender),
    peaceUntil: s.peace[pairKey(attacker, defender)], writs: s.writs, now: now(), grounds,
  });
  if (problem) return say(player, `§7${problem}`);
  const c = clock(), day = assaultDay(c.day, c.tod);
  const when = day === c.day ? "tonight at nightfall" : "at nightfall tomorrow";
  const res = await new MessageFormData().title("War Writ")
    .body(`Declare war on §f${nameOf(defender)}§r?\n\nGrounds: ${GROUNDS_TEXT[grounds]}.\nThe fee: ${coins(WRIT.fee)}.\n\n`
      + `Their gates shut now. The assault comes ${when} and lasts until dawn, whether or not they are here. `
      + "Crack their vault before dawn to win. Their Keep Banner can't be taken, and afterwards there is peace between you for a few days.")
    .button1("Not now").button2(`Declare (${coins(WRIT.fee)})`).show(player);
  if (res.canceled || res.selection !== 1) return;
  if (cantDeclare({ attacker, defender, hasKeep: true, targetKeep: keepOf(defender), peaceUntil: s.peace[pairKey(attacker, defender)], writs: s.writs, now: now(), grounds })) return;
  if (!charge(player, WRIT.fee, "warWrit")) return say(player, `§cA War Writ costs ${coins(WRIT.fee)}.`);
  s.writs[defender] = { attacker, day, grounds, at: now() };
  delete s.feuds[`${attacker}>${defender}`];
  store.save();
  barGates(defender);
  announce(`§4§l${player.name} has declared war on ${nameOf(defender)}§r§4 (${GROUNDS_TEXT[grounds]}). The assault comes ${when}.`);
  emit("baseAttacked", { owner: defender, kind: "warWrit", text: `${player.name} has declared war on you. The assault comes ${when}; your gates are shut.`, by: attacker });
  emit("writDeclared", { attacker, defender, grounds, day });
}

// ---------- demands ----------

async function demandMenu(player, defender) {
  const s = S(), from = player.id;
  if (!keepOf(from)) return say(player, "§7You need a settlement of your own first.");
  if (s.demands[defender]) return say(player, "§7Someone is already waiting on an answer from them.");
  if ((s.peace[pairKey(from, defender)] ?? 0) > now()) return say(player, "§7You are at peace with them for now.");
  const amount = demandAmount(banked(defender));
  const res = await new MessageFormData().title("Send a demand")
    .body(`Demand ${coins(amount)} from §f${nameOf(defender)}§r?\n\nIf they pay, there is peace between you for a few days. If they refuse, or don't answer within a real day, you have grounds to declare war.`)
    .button1("Not now").button2("Send it").show(player);
  if (res.canceled || res.selection !== 1) return;
  s.demands[defender] = { from, amount, at: now() };
  store.save();
  say(player, `§6Your demand for ${coins(amount)} is on its way to ${nameOf(defender)}.`);
  say(online(defender), `§6${player.name} demands ${coins(amount)} from you. Answer it from your Keep Banner menu.`);
  emit("baseAttacked", { owner: defender, kind: "demand", text: `${player.name} demands ${coins(amount)} from you. Answer it from your Keep Banner.`, by: from });
  emit("demandSent", { from, to: defender, amount });
}

function settleDemand(to, paid) {
  const s = S(), d = s.demands[to];
  if (!d) return;
  delete s.demands[to];
  if (paid) s.peace[pairKey(d.from, to)] = now() + WRIT.peaceMs;
  else s.refused[`${d.from}>${to}`] = now() + WRIT.refusedMs;
  store.save();
  say(online(d.from), paid ? `§6${nameOf(to)} paid your demand: ${coins(d.amount)}. There is peace between you for now.` : `§c${nameOf(to)} refused your demand. You have grounds to declare war.`);
  emit("demandAnswered", { from: d.from, to, amount: d.amount, paid });
}

async function answerDemand(player) {
  const d = S().demands[player.id];
  if (!d) return;
  const res = await new MessageFormData().title("A demand")
    .body(`${nameOf(d.from)} demands ${coins(d.amount)} from you.\n\nPay, and there is peace between you for a few days. Refuse, and they have grounds to declare war on you.\n\nYou have ${coins(banked(player))}.`)
    .button1("Refuse").button2(`Pay ${coins(d.amount)}`).show(player);
  if (res.canceled || !S().demands[player.id]) return;
  if (res.selection === 1) {
    const taken = robBank(player.id, d.amount); // straight from the balance, Creative or not, so the demander gets real coins
    if (taken < d.amount) { giveCoins(player, taken); return say(player, `§cYou don't have ${coins(d.amount)}.`); }
    giveCoins(d.from, d.amount); // the balance is kept by id, online or not
    settleDemand(player.id, true);
    say(player, `§7You paid ${coins(d.amount)}.`);
  } else {
    settleDemand(player.id, false);
    say(player, "§7You refused.");
  }
}

// ---------- the Keep Banner menu ----------

function statusLines(viewer) {
  const s = S(), lines = [];
  for (const [defender, w] of Object.entries(s.writs)) {
    const p = phaseOf(w);
    const what = p === "assault" ? (w.cracked ? "§cassault, vault cracked" : "§cassault under way") : "§6mustering";
    if (sideOf(w.attacker, viewer) || sideOf(defender, viewer)) lines.push(`${nameOf(w.attacker)} against ${nameOf(defender)}: ${what}`);
  }
  for (const [key, until] of Object.entries(s.peace)) {
    if (until <= now() || !key.split("|").includes(viewer)) continue;
    const other = key.split("|").find((id) => id !== viewer);
    lines.push(`At peace with ${nameOf(other)} for ${Math.ceil((until - now()) / 3600000)} more real hours`);
  }
  return lines;
}

addKeepMenuButtons(({ player, owner, mine }) => {
  if (mine) {
    const out = [];
    if (S().demands[player.id]) out.push({ label: `Answer ${nameOf(S().demands[player.id].from)}'s demand`, icon: "textures/items/siege_writ", action: () => answerDemand(player).catch(() => {}) });
    const lines = statusLines(player.id);
    if (lines.length) out.push({ label: "War", icon: "textures/items/siege_writ", action: () => new ActionFormData().title("War").body(lines.join("\n")).button("Close").show(player).catch(() => {}) });
    return out;
  }
  if (!owner || !keepOf(player.id) || isAlly(owner, player.id)) return [];
  return [
    { label: "Declare war\n§8War Writ", icon: "textures/items/siege_writ", action: () => declareMenu(player, owner).catch((e) => console.warn(`[Hollow Crown] writ: ${e}`)) },
    { label: "Send a demand", icon: "textures/items/siege_writ", action: () => demandMenu(player, owner).catch(() => {}) },
  ];
});

// ---------- the siege itself ----------

on("vaultBreached", ({ owner, by }) => {
  const w = S().writs[owner];
  if (!w || w.cracked || phaseOf(w) !== "assault" || !by || !sideOf(w.attacker, by)) return;
  w.cracked = by;
  store.save();
  recordWin(w.attacker);
  announce(`§4§l${nameOf(by)} has cracked ${nameOf(owner)}'s vault!§r§4 ${nameOf(w.attacker)} wins the siege. The vault lies open to them until dawn.`);
  emit("writVaultCracked", { attacker: w.attacker, defender: owner, by });
});

function endWrit(defender, w) {
  const s = S();
  delete s.writs[defender];
  s.peace[pairKey(w.attacker, defender)] = now() + WRIT.peaceMs;
  store.save();
  const winner = w.cracked ? w.attacker : defender;
  if (!w.cracked) {
    recordWin(defender);
    announce(`§6§lDawn: ${nameOf(defender)} held against ${nameOf(w.attacker)}.§r§6 There is peace between them for a few days.`);
  } else {
    announce(`§7Dawn ends ${nameOf(w.attacker)}'s siege of ${nameOf(defender)}. There is peace between them for a few days.`);
  }
  emit("writEnded", { attacker: w.attacker, defender, winner });
}

onTick("warwrit", 20, () => {
  if (!isReady()) return;
  const s = S(), t = now();
  for (const [defender, w] of Object.entries(s.writs)) {
    if (!keepOf(defender)) { delete s.writs[defender]; store.save(); continue; } // their settlement is gone
    const p = phaseOf(w);
    if (p === "over") { endWrit(defender, w); continue; }
    if (p === "assault") {
      if (!w.started) {
        w.started = true;
        store.save();
        barGates(defender);
        announce(`§4§lNightfall: ${nameOf(w.attacker)}'s assault on ${nameOf(defender)} begins!§r§4 It lasts until dawn.`);
        emit("baseAttacked", { owner: defender, kind: "warWrit", text: `${nameOf(w.attacker)}'s assault on your settlement has begun. Hold until dawn.`, by: w.attacker });
        emit("writAssault", { attacker: w.attacker, defender });
      }
      // the attackers are Wanted on the defender's land: archers and Men-at-Arms go for them
      for (const player of world.getPlayers()) {
        try {
          if (player.dimension.id === OVERWORLD && sideOf(w.attacker, player.id) && !sideOf(defender, player.id) && settlementAt(player.location) === defender) holdWanted(player, defender, 400);
        } catch { /* fine */ }
      }
    }
  }
  // demands left unanswered for a real day count as refused; old peace, feud and refusal marks are cleared away
  for (const [to, d] of Object.entries(s.demands)) if (t - d.at > WRIT.demandMs) settleDemand(to, false);
  for (const book of ["peace", "feuds", "refused"]) {
    for (const [k, until] of Object.entries(s[book])) if (until <= t) { delete s[book][k]; store.save(); }
  }
});

// ---------- test commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (event.id === "siege:writ_status") {
    const s = S();
    const lines = Object.entries(s.writs).map(([d, w]) => `${nameOf(w.attacker)} -> ${nameOf(d)}: day ${w.day}, ${phaseOf(w)}${w.cracked ? ", cracked" : ""} (${w.grounds})`);
    lines.push(...Object.entries(s.demands).map(([to, d]) => `demand ${nameOf(d.from)} -> ${nameOf(to)}: ${coins(d.amount)}`));
    lines.push(...Object.keys(s.peace).map((k) => `peace ${k.split("|").map(nameOf).join(" & ")}`));
    say(player, lines.length ? `§6War Writs:§7\n${lines.join("\n")}` : "§7No writs, demands or peace.");
  } else if (event.id === "siege:writ_night") {
    const s = S();
    const entry = Object.entries(s.writs).find(([d, w]) => d === player.id || w.attacker === player.id);
    if (!entry) return say(player, "§7You hold no writ and face none.");
    world.getDimension(OVERWORLD).runCommand(`time set ${WRIT.nightfall}`);
    entry[1].day = world.getDay();
    store.save();
    say(player, "§7Skipped to the assault.");
  }
});
