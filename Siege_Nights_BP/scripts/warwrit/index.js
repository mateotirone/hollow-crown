// War Writs: declaring a siege on another player's settlement (Mateo, 2026-11-12).
//
//   Grounds   they hold a relic, attacked your settlement, refused your demand, or are an Oathbreaker
//             (rules.js groundsFor). No grounds is allowed but unjust: triple fee, the defence twice as strong,
//             and the attacker an Oathbreaker for 3 real days, whom anyone may declare on.
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

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, onTick, moduleStore, emit, on, isAlly, keepOf, addKeepMenuButtons, recordWin } from "../siege/api.js";
import { addFilter } from "../core/events.js";
import { charge, giveCoins, banked, robBank } from "../economy/coins.js";
import { coins } from "../economy/rules.js";
import { holdWanted, guardCount } from "../siege/guards.js";
import { barGates } from "../settle/walls.js";
import { holdsRelic, keeperAway } from "../vault/index.js";
import { guardTag } from "../siege/guards.js";
import { settlementAt } from "../siege/territory.js";
import { WRIT, assaultDay, phase, groundsFor, GROUNDS_TEXT, UNJUST_TEXT, feeFor, pairKey, demandAmount, cantDeclare } from "./rules.js";
import { ARMY, startMarch, endMarch, resumeMarch, assaultTick, musterTick, clearTeams, freeSlot, sweepStragglers } from "./army.js";
import "./tests.js";

const store = moduleStore("siege:warwrit", () => ({ writs: {}, peace: {}, feuds: {}, refused: {}, demands: {}, oaths: {}, ghosts: {} }));
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
// fallen soldiers of either side wait in the Barracks until the assault is over
addFilter("guardRetrainHeld", (held, { owner }) => held || Object.entries(S().writs).some(([d, w]) => phaseOf(w) === "assault" && (sideOf(d, owner) || sideOf(w.attacker, owner))));
// in the assault the defenders' Men-at-Arms come out of the Barracks whether or not an attacker is online
addFilter("underAttack", (under, { owner }) => under || phaseOf(S().writs[owner]) === "assault");
addFilter("bannerShielded", (shielded, { owner }) => shielded || !!S().writs[owner]);
// An unjust war (no grounds): the defender's walls, vault, Keep and guards are twice as strong for it
// (not on top of the away keeper's doubling, vault/index.js)
const unjustOn = (owner) => { const w = S().writs[owner]; return !!w?.unjust && !keeperAway(owner); };
addFilter("wallHp", (hp, { block }) => { try { const o = settlementAt(block.location); return o && unjustOn(o) ? hp * 2 : hp; } catch { return hp; } });
addFilter("keepHealth", (hp, { owner }) => (unjustOn(owner) ? hp * 2 : hp));
onTick("warwrit-unjust-guards", 200, () => {
  if (!isReady()) return;
  const dim = world.getDimension(OVERWORLD);
  for (const owner of Object.keys(S().writs)) {
    if (!unjustOn(owner)) continue;
    for (const g of dim.getEntities({ tags: [guardTag(owner)] })) {
      try { g.addEffect("resistance", 260, { amplifier: 1, showParticles: false }); g.addEffect("strength", 260, { amplifier: 1, showParticles: false }); } catch { /* gone */ }
    }
  }
});

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
    oathUntil: S().oaths?.[defender],
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
  const grounds = groundsOf(attacker, defender), fee = feeFor(grounds), why = grounds ? GROUNDS_TEXT[grounds] : UNJUST_TEXT;
  const problem = cantDeclare({
    attacker, defender, hasKeep: !!keepOf(attacker), targetKeep: keepOf(defender),
    peaceUntil: s.peace[pairKey(attacker, defender)], writs: s.writs, now: now(),
  });
  if (problem) return say(player, `§7${problem}`);
  const c = clock(), day = assaultDay(c.day, c.tod);
  const when = day === c.day ? "tonight at nightfall" : "at nightfall tomorrow";
  const res = await new MessageFormData().title("War Writ")
    .body(`Declare war on §f${nameOf(defender)}§r?\n\nGrounds: ${why}.\nThe fee: ${coins(fee)}.\n\n`
      + (grounds ? "" : "§cWith no grounds this is an unjust war: it costs three times as much, their walls, vault, Keep and guards are twice as strong for it, and you are branded an Oathbreaker for three days. Anyone may declare war on an Oathbreaker.§r\n\n")
      + `Their gates shut now. The assault comes ${when} and lasts until dawn, whether or not they are here. `
      + "Crack their vault before dawn to win. Their Keep Banner can't be taken, and afterwards there is peace between you for a few days.")
    .button1("Not now").button2(`Declare (${coins(fee)})`).show(player);
  if (res.canceled || res.selection !== 1) return;
  const slot = freeSlot(s.writs);
  if (slot === undefined) return say(player, "§7Too many wars are being fought at once. Wait for one to end.");
  // the army slider: what share of your soldiers rides with you (Mateo: 0, 25, 50, 75 or 100%)
  const army = new ModalFormData().title("Your army")
    .slider(`How much of your army marches with you? ${guardCount(attacker)} soldiers. The rest guard home.\nThe marchers ride with you from now until the siege ends.`, 0, 100, { valueStep: 25, defaultValue: 50 });
  army.submitButton?.(`Declare (${coins(fee)})`);
  const pick = await army.show(player);
  if (pick.canceled) return;
  const picked = Number((pick.formValues ?? []).find((v) => typeof v === "number") ?? 0);
  const share = ARMY.shares.reduce((best, v) => (Math.abs(v - picked) < Math.abs(best - picked) ? v : best), 0);
  if (cantDeclare({ attacker, defender, hasKeep: true, targetKeep: keepOf(defender), peaceUntil: s.peace[pairKey(attacker, defender)], writs: s.writs, now: now() })) return;
  if (freeSlot(s.writs) === undefined) return;
  if (!charge(player, fee, "warWrit")) return say(player, `§cThis War Writ costs ${coins(fee)}.`);
  const n = declareWrit(attacker, defender, { grounds: grounds ?? "none", share, day, by: player.name });
  if (share > 0 && typeof n === "number") say(player, n ? `§6${n} soldiers mount up and ride with you. They follow you until the siege ends.` : "§7None of your soldiers are near enough to ride with you.");
}

// Issue a writ (the menu above, once paid; also the battle test, battletest/). grounds: a GROUNDS_TEXT key or "none"
// (unjust). share: % of the attacker's soldiers who march. dismounted: they start on foot where they stand and walk to
// the gate (an army with no leader on the road). by: the declarer's name for the announcement.
// Returns how many soldiers march, or a reason it can't be issued.
export function declareWrit(attacker, defender, { grounds = "none", share = 0, day, by, dismounted = false } = {}) {
  const s = S();
  if (s.writs[defender]) return "A War Writ is already out against them.";
  const slot = freeSlot(s.writs);
  if (slot === undefined) return "Too many wars are being fought at once.";
  const c = clock();
  day ??= assaultDay(c.day, c.tod);
  const unjust = !GROUNDS_TEXT[grounds];
  const when = day === c.day ? "tonight at nightfall" : "at nightfall tomorrow";
  const who = by ?? nameOf(attacker);
  s.writs[defender] = { attacker, day, grounds: unjust ? "none" : grounds, unjust, at: now(), slot, share };
  delete s.feuds[`${attacker}>${defender}`];
  if (unjust) { s.oaths ??= {}; s.oaths[attacker] = now() + WRIT.oathMs; }
  store.save();
  barGates(defender);
  announce(!unjust
    ? `§4§l${who} has declared war on ${nameOf(defender)}§r§4 (${GROUNDS_TEXT[grounds]}). The assault comes ${when}.`
    : `§4§l${who} has declared an unjust war on ${nameOf(defender)}!§r§4 The assault comes ${when}. ${who} is an Oathbreaker for three days: anyone may declare war on them.`);
  emit("baseAttacked", { owner: defender, kind: "warWrit", text: `${who} has declared war on you. The assault comes ${when}; your gates are shut.`, by: attacker });
  const n = share > 0 ? startMarch(s.writs[defender], defender, share, { dismounted }) : 0;
  emit("writDeclared", { attacker, defender, grounds: unjust ? undefined : grounds, day, share });
  return n;
}

// End a writ now (the battle test's stand-in leader falling, or clearing the test). how: "dawn" | "leader"
export function endWritFor(defender, how = "dawn") {
  const w = S().writs[defender];
  if (w) endWrit(defender, w, how);
  return !!w;
}

// The writ an owner is in, as attacker or defender: { defender, writ, phase } or undefined
export function writOf(owner) {
  const e = Object.entries(S().writs).find(([d, w]) => d === owner || w.attacker === owner);
  return e && { defender: e[0], writ: e[1], phase: phaseOf(e[1]) };
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
  if ((s.oaths?.[viewer] ?? 0) > now()) lines.push(`§cYou are an Oathbreaker for ${Math.ceil((s.oaths[viewer] - now()) / 3600000)} more real hours: anyone may declare war on you.§r`);
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

// How it ended: "dawn" (the defenders held, unless the vault was cracked) or "leader" (the attacking leader fell)
function endWrit(defender, w, how = "dawn") {
  const s = S();
  delete s.writs[defender];
  endMarch(defender);
  clearTeams(w.slot ?? 0);
  s.peace[pairKey(w.attacker, defender)] = now() + WRIT.peaceMs;
  store.save();
  const winner = w.cracked ? w.attacker : defender;
  const over = w.cracked ? `${nameOf(w.attacker)} won` : `${nameOf(defender)} held`;
  if (!w.cracked) recordWin(defender);
  if (how === "leader" && !w.cracked) announce(`§6§l${nameOf(w.attacker)} has fallen, and the assault on ${nameOf(defender)} collapses.§r§6 The siege is over: ${nameOf(defender)} held.`);
  else if (!w.cracked) announce(`§6§lDawn. The siege is over: ${nameOf(defender)} held against ${nameOf(w.attacker)}.`);
  else announce(`§7${how === "leader" ? `${nameOf(w.attacker)} has fallen` : "Dawn"}. The siege of ${nameOf(defender)} is over: ${nameOf(w.attacker)} won.`);
  for (const p of world.getPlayers()) {
    if (sideOf(w.attacker, p.id) || sideOf(defender, p.id)) {
      try { p.onScreenDisplay.setTitle("§6The siege is over", { subtitle: `§7${over}. Peace for three days.`, fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 }); } catch { /* left */ }
    }
  }
  // fallen leaders come back
  for (const id of [w.attacker, defender]) if (s.ghosts[id]) raise(id);
  emit("writEnded", { attacker: w.attacker, defender, winner, how });
}

// ---------- fallen leaders stay dead until the siege ends (Mateo, 2026-11-12) ----------
// The declarer and the defending owner, killed in the assault, watch as ghosts (spectators) until it is over.
// If the attacking leader falls, the attack collapses and the defenders win.

function raise(id) {
  const s = S(), g = s.ghosts[id], player = online(id);
  if (!g || !player) return; // offline: on their next spawn
  delete s.ghosts[id];
  store.save();
  try {
    player.setGameMode(g.mode === "creative" ? GameMode.Creative : GameMode.Survival);
    const k = keepOf(id), home = k ? { x: k.x + 0.5, y: k.y + 1, z: k.z + 1.5 } : player.getSpawnPoint?.();
    if (home) player.teleport(home, { dimension: world.getDimension(OVERWORLD) });
    player.sendMessage("§7The siege is over. You are back at your keep.");
  } catch { /* fine */ }
}

world.afterEvents.entityDie.subscribe(({ deadEntity: dead }) => {
  if (!isReady()) return;
  const s = S();
  for (const [defender, w] of Object.entries(s.writs)) {
    if (phaseOf(w) !== "assault" || (dead.id !== w.attacker && dead.id !== defender)) continue;
    let mode = "survival";
    try { if (dead.getGameMode() === GameMode.Creative) mode = "creative"; } catch { /* fine */ }
    s.ghosts[dead.id] = { mode, writ: defender };
    store.save();
    if (dead.id === w.attacker) {
      endWrit(defender, w, "leader");
    } else {
      announce(`§4${nameOf(defender)} has fallen defending their settlement, and can't return until the siege is over.`);
    }
    return;
  }
}, { entityTypes: ["minecraft:player"] });

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  const s = S(), g = s.ghosts[player.id];
  if (!g) return;
  if (!s.writs[g.writ]) return system.run(() => raise(player.id)); // the siege ended while they were away or dead
  system.run(() => {
    try {
      player.setGameMode(GameMode.Spectator);
      player.onScreenDisplay.setTitle("§4You have fallen", { subtitle: "§7You can watch, but not return, until the siege is over.", fadeInDuration: 10, stayDuration: 80, fadeOutDuration: 20 });
    } catch { /* fine */ }
  });
  void initialSpawn;
});

// Everyone in a siege sees how long it has left, on the action bar
function siegeBar(defender, w) {
  const left = Math.max(0, WRIT.dawn - world.getTimeOfDay());
  const mins = Math.floor(left / 1200), secs = Math.floor((left % 1200) / 20);
  const text = `§4Siege of ${nameOf(defender)}§7: ${mins}:${String(secs).padStart(2, "0")} until dawn${w.cracked ? " §c(vault cracked)" : ""}`;
  for (const p of world.getPlayers()) {
    if (sideOf(w.attacker, p.id) || sideOf(defender, p.id) || s_ghostOf(p.id) === defender) {
      try { p.onScreenDisplay.setActionBar(text); } catch { /* left */ }
    }
  }
}
const s_ghostOf = (id) => S().ghosts[id]?.writ;

onTick("warwrit", 20, () => {
  if (!isReady()) return;
  const s = S(), t = now();
  for (const [defender, w] of Object.entries(s.writs)) {
    if (!keepOf(defender)) { delete s.writs[defender]; store.save(); continue; } // their settlement is gone
    const p = phaseOf(w);
    if (p === "over") { endWrit(defender, w); continue; }
    if (w.share > 0) resumeMarch(w, defender); // after a restart, pick the marchers up again
    if (p !== "assault") musterTick(defender);
    if (p === "assault") {
      if (!w.started) {
        w.started = true;
        store.save();
        barGates(defender);
        announce(`§4§lNightfall: ${nameOf(w.attacker)}'s assault on ${nameOf(defender)} begins!§r§4 It lasts until dawn.`);
        emit("baseAttacked", { owner: defender, kind: "warWrit", text: `${nameOf(w.attacker)}'s assault on your settlement has begun. Hold until dawn.`, by: w.attacker });
        emit("writAssault", { attacker: w.attacker, defender });
      }
      if (system.currentTick % 40 < 20) siegeBar(defender, w);
      assaultTick(defender, w, sideOf);
      // the attackers are Wanted on the defender's land: archers and Men-at-Arms go for them
      for (const player of world.getPlayers()) {
        try {
          if (player.dimension.id === OVERWORLD && sideOf(w.attacker, player.id) && !sideOf(defender, player.id) && settlementAt(player.location) === defender) holdWanted(player, defender, 400);
        } catch { /* fine */ }
      }
    }
  }
  if (system.currentTick % 200 < 20) sweepStragglers((owner) => Object.values(s.writs).some((w) => w.attacker === owner));
  // demands left unanswered for a real day count as refused; old peace, feud and refusal marks are cleared away
  for (const [to, d] of Object.entries(s.demands)) if (t - d.at > WRIT.demandMs) settleDemand(to, false);
  s.oaths ??= {};
  for (const book of ["peace", "feuds", "refused", "oaths"]) {
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
