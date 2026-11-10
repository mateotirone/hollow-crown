// Rival Lords as active neighbours: what they do to players and to each other. Rules and numbers: deeds.js.
//
// One lord acts every other day, in turn, and never does the same kind of thing twice running:
//   march   declares war on a player. Their soldiers join the next siege night at that settlement (through the
//           siege's war plan), unless the player buys them off first. Beaten off, they pay spoils and keep the
//           peace for days; if the keep falls they take tribute and grow.
//   feud    rides against another lord. Settled a day later; the loser kneels (a vassal marches with their liege).
//           Players can pay to back either side.
//   demand  asks a player for tribute. Pay for peace, or refuse and be marked for it.
//   gift, pact, wares, rumor, breach   coin for a friend, an offered truce or alliance, new goods to trade, word of
//           something strange (the lore's rumor lines), a broken oath.
// Players can also trade with a lord, send gifts, swear or break a truce or an alliance, from the lord's menu.
// Nothing here touches a player who is offline: a march waits, a demand's clock stops, a siege skips them anyway.
//
// Events: "rivalDeed" { lord, kind, player?, foe? }
//         "rivalMarch" { lord, player, manner }   "rivalMarchEnded" { lord, playerId, outcome: "beaten" | "won" | "draw" | "bought" | "called_off" }
//         "rivalFeud" { lord, foe }   "rivalFeudEnded" { winner, loser, freed }
//         "rivalDemand" { lord, player, coins }   "rivalTribute" { lord, player, paid }
//         "rivalPact" { lord, player, kind }   "rivalPactBroken" { lord, playerId, by: "player" | "lord" }
// Commands: /scriptevent siege:rivals deed [march|feud|demand|gift|pact|wares|rumor|breach] [lord id]   make a lord act now
//           /scriptevent siege:rivals feud_end | court | relation <lord id> <number>

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, getState, keepOf, keepCenter, onTick, on, emit, addFilter, addPlanHook, isOnline, ownerTag, title, pick, countItem, takeItems, RAIDER_TAG, SETTINGS } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { funds, charge, pay, coins } from "../economy/api.js";
import { reachStage, AFTER } from "../reach/api.js";
import { rivalLords, rivalById, relationOf, changeRelation, rivalData, saveRivals, lordSays, lordFullName } from "./index.js";
import { DEEDS, MANNERS, WARES, COMMISSIONS, pickDeed, nextToAct, pickManner, marchHost, buyOffPrice, settleMarch, vassalsOf, pickFoe, settleFeud, pickWares, warePrice, pactsOpen, tributeOf } from "./deeds.js";
import { TIER_NAMES, LINES } from "./data.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
const AID_TAG = "siege_rival_aid";
const court = () => (rivalData().court ??= { lastDay: -1, lastKind: undefined, feud: null, oaths: {}, gifts: {}, owed: {} });
const day = () => world.getDay();
const seed = () => `${rivalData().seed}|${day()}`;
const playerById = (id) => world.getPlayers().find((p) => p.id === id);
const nice = (id) => id.replace(/^[a-z]+:/, "").replace(/_/g, " ");
const speak = (player, lord, kind) => { const line = lordSays(lord, kind, player); if (line) player.sendMessage(`§7${lord.name}: §f${line}`); };
const everyone = (text, except) => { for (const p of world.getPlayers()) if (p.id !== except) p.sendMessage(text); };
const oathsOf = (id) => court().oaths[id] ?? 0;
export const pactOf = (lord, playerId) => lord.pacts?.[playerId];
const atPeace = (lord, id) => (lord.peace?.[id] ?? -1) >= day() || !!rivalById(lord.liege)?.pacts?.[id]; // a vassal honours their liege's oaths
const keepPeace = (lord, id, days) => { (lord.peace ??= {})[id] = day() + days; };

// ---------- one deed a day ----------

function targetFor(lord) {
  const players = world.getPlayers().filter((p) => keepOf(p.id));
  const fresh = players.filter((p) => p.id !== lord.lastTarget);
  const pool = fresh.length ? fresh : players;
  return pool[Math.floor(Math.random() * pool.length)];
}

function contextFor(lord, player) {
  const feud = court().feud;
  return {
    hasTarget: !!player, relation: player ? relationOf(lord, player.id) : 0, pact: player && pactOf(lord, player.id),
    peace: player && atPeace(lord, player.id), grudge: player && !!lord.grudge?.[player.id],
    atWar: player && rivalLords().some((l) => l.march?.target === player.id), pressed: player && rivalLords().some((l) => l.demands?.[player.id]),
    noMarch: reachStage() >= AFTER, // after the story the Reach picks which lord raids and when ("lordRaid"); before it, marches are ours
    oaths: player ? oathsOf(player.id) : 0, lords: rivalLords().length, feud: !!feud, realmLast: court().lastKind,
  };
}

const DO = {
  march(lord, player) {
    const manner = pickManner(lord, seed());
    lord.march = { target: player.id, name: player.name, manner, day: day(), state: "declared" };
    title(player, `§4${lord.name} marches on you`, "§7They come with the next siege night");
    speak(player, lord, "war");
    player.sendMessage(`§c${lordFullName(lord)} has declared war on you. §7Their soldiers will come ${MANNERS[manner].name} at the next siege night. Ride to ${lord.plot} to buy them off (${coins(buyOffPrice(lord, oathsOf(player.id)))}), or be ready.`);
    sfx(player, "raid.horn");
    everyone(`§6${lordFullName(lord)} has declared war on ${player.name}.`, player.id);
    emit("rivalMarch", { lord, player, manner });
  },
  feud(lord) {
    const foe = pickFoe(lord, rivalLords(), seed());
    if (!foe) return false;
    court().feud = { a: lord.id, b: foe.id, due: day() + DEEDS.feudDays, backing: {}, backers: {} };
    const rebel = lord.liege === foe.id;
    everyone(`§6${lordFullName(lord)} has ${rebel ? "risen against their liege," : "sent riders against"} ${lordFullName(foe)}. §7It will be settled within the day. Either would welcome coin for their cause.`);
    emit("rivalFeud", { lord, foe });
    return true;
  },
  demand(lord, player) {
    const amount = tributeOf(lord, oathsOf(player.id));
    (lord.demands ??= {})[player.id] = { coins: amount, due: day() + DEEDS.demandDays };
    speak(player, lord, "demand");
    player.sendMessage(`§6${lordFullName(lord)} demands a tribute of ${coins(amount)}. §7Answer them at ${lord.plot} within ${DEEDS.demandDays} days: pay for peace, or refuse and take what follows.`);
    emit("rivalDemand", { lord, player, coins: amount });
  },
  gift(lord, player) {
    const amount = DEEDS.gift[lord.tier];
    pay(player, amount, "lord's gift");
    changeRelation(lord, player.id, 6);
    player.sendMessage(`§aA rider from ${lord.plot} brings ${coins(amount)}, with ${lord.name}'s regards.`);
  },
  pact(lord, player) {
    const open = pactsOpen(lord, relationOf(lord, player.id), oathsOf(player.id));
    if (!open.length) return false;
    const kind = open[open.length - 1];
    (lord.offers ??= {})[player.id] = { kind, day: day() };
    player.sendMessage(`§6${lordFullName(lord)} offers you ${kind === "alliance" ? "an alliance: their soldiers on your wall on siege nights, and yours never at their gate" : "a truce: neither of you marches on the other"}. §7Speak to them at ${lord.plot} to swear it.`);
    return true;
  },
  wares(lord) {
    lord.wares = pickWares(lord, seed());
    everyone(`§7Word from ${lord.plot}: ${lord.name} is selling ${lord.wares.sell.map(nice).join(", ")}, and is buying ${nice(lord.wares.want)}.`);
  },
  rumor(lord, player) {
    const line = lordSays(lord, "rumor", player) ?? pick(LINES[lord.temperament] ?? LINES.steady);
    player.sendMessage(`§7A rider from ${lord.plot} brings word from ${lord.name}: §f"${line}"`);
  },
  breach(lord, player) {
    const kind = pactOf(lord, player.id);
    delete lord.pacts[player.id];
    (lord.grudge ??= {})[player.id] = true;
    speak(player, lord, "foe");
    everyone(`§c${lordFullName(lord)} has torn up their ${kind} with ${player.name}.`);
    emit("rivalPactBroken", { lord, playerId: player.id, by: "lord" });
  },
};

function act(lord, forced) {
  const player = targetFor(lord);
  const kind = forced ?? pickDeed(lord, contextFor(lord, player), seed());
  lord.deedDay = day();
  court().lastDay = day();
  if (!kind || !DO[kind] || (kind !== "feud" && kind !== "wares" && !player)) return saveRivals();
  if (DO[kind](lord, player) === false) return saveRivals();
  lord.lastDeed = kind;
  court().lastKind = kind;
  if (player && kind !== "feud" && kind !== "wares") lord.lastTarget = player.id;
  saveRivals();
  emit("rivalDeed", { lord, kind, player: kind !== "feud" && kind !== "wares" ? player : undefined, foe: kind === "feud" ? rivalById(court().feud?.b) : undefined });
}

function courtTick() {
  const lords = rivalLords();
  const c = court();
  if (!lords.length || getState().active) return;
  const today = day();
  let changed = false;

  // coin owed to players who were away when it was won
  for (const [id, amount] of Object.entries(c.owed)) {
    const player = playerById(id);
    if (!player) continue;
    pay(player, amount, "lord's share");
    player.sendMessage(`§aA purse was left for you while you were away: ${coins(amount)}.`);
    delete c.owed[id];
    changed = true;
  }

  for (const lord of lords) {
    // a demand's clock only runs while the player is here to answer it
    for (const [id, demand] of Object.entries(lord.demands ?? {})) {
      const player = playerById(id);
      if (!player || today < demand.due) continue;
      if (!demand.warned) {
        demand.warned = true; demand.due = today + 1;
        player.sendMessage(`§6${lord.name} is still waiting on ${coins(demand.coins)}. §7One more day.`);
      } else answerDemand(player, lord, false);
      changed = true;
    }
    for (const [id, offer] of Object.entries(lord.offers ?? {})) if (today - offer.day > 3) { delete lord.offers[id]; changed = true; }
    // a march that never finds its target at home goes home
    if (lord.march?.state === "declared" && today - lord.march.day > DEEDS.marchWaitDays) { endMarch(lord, "called_off"); changed = true; }
  }

  if (c.feud && today >= c.feud.due) { endFeud(); changed = true; }
  if (today - c.lastDay >= DEEDS.everyDays || today < c.lastDay) act(nextToAct(lords));
  else if (changed) saveRivals();
}

// ---------- marches ----------

function endMarch(lord, outcome) {
  const id = lord.march?.target;
  lord.lastManner = lord.march?.manner ?? lord.lastManner;
  delete lord.march;
  saveRivals();
  emit("rivalMarchEnded", { lord, playerId: id, outcome });
}

// The siege plans its army for a settlement: a lord at war with it adds their own
addPlanHook((plan, owner) => {
  if (!isReady()) return;
  for (const lord of rivalLords()) {
    if (lord.march?.target !== owner || lord.march.state !== "declared") continue;
    if (pactOf(lord, owner)) { endMarch(lord, "called_off"); continue; } // sworn since they declared
    MANNERS[lord.march.manner]?.apply(plan);
    plan.rival = lord.id;
    lord.march.state = "marching";
    saveRivals();
    const player = playerById(owner);
    if (player) system.runTimeout(() => { if (player.isValid) player.sendMessage(`§4${lord.name}'s banners are among them. They come ${MANNERS[lord.march?.manner]?.name ?? "in force"}.`); }, 60);
  }
});

// After the story ends the Reach sends raids "from the CPU towns": it picks the lord and the night and says so here.
// We make it that lord's march, so their own soldiers come too and the night leaves the same lasting result.
on("lordRaid", ({ lord: sent, owners = [] }) => {
  const lord = sent && rivalById(sent.id);
  if (!isReady() || !lord || lord.march) return;
  const player = owners.map(playerById).find((p) => p && keepOf(p.id) && !pactOf(lord, p.id));
  if (!player) return;
  lord.march = { target: player.id, name: player.name, manner: pickManner(lord, seed()), day: day(), state: "marching", sent: true };
  lord.lastDeed = "march";
  court().lastKind = "march";
  saveRivals();
  emit("rivalMarch", { lord, player, manner: lord.march.manner });
});

function surface(dim, x, z, fallback) {
  try {
    return (dim.getTopmostBlock({ x, z })?.y ?? fallback - 1) + 1;
  } catch {
    return undefined;
  }
}

// One soldier, from whoever supplies better fighters (the bestiary's champions), or plain ones without
function soldier(dim, at, { role, tier, name, tags, lord, stance }) {
  let e;
  try {
    e = applyFilter("rivalSoldier", undefined, { dim, at, role, tier, name, tags, lord, stance });
  } catch {
    e = undefined;
  }
  if (e) return e;
  try {
    e = dim.spawnEntity(stance === "realm" ? "minecraft:iron_golem" : role === "retainer" ? "minecraft:vindicator" : "minecraft:pillager", at);
    for (const t of tags) e.addTag(t);
    e.nameTag = name;
    return e;
  } catch {
    return undefined; // that spot is not loaded
  }
}

function ring(dim, keep, angle, distance, i) {
  const a = angle + ((i % 5) - 2) * 0.12, d = distance + Math.floor(i / 5) * 2;
  const x = Math.floor(keep.x + Math.cos(a) * d), z = Math.floor(keep.z + Math.sin(a) * d);
  const y = surface(dim, x, z, keep.y + 1);
  return y === undefined ? undefined : { x: x + 0.5, y, z: z + 0.5 };
}

on("assaultSpawned", ({ assault, total }) => {
  if (!isReady()) return;
  const dim = world.getDimension(OVERWORLD);
  const plans = getState().plans ?? {};
  for (const lord of rivalLords()) {
    // a marching lord's own soldiers: the men-at-arms with the first assault, the captain with the last
    const march = lord.march;
    if (march?.state === "marching" && isOnline(march.target) && keepOf(march.target)) {
      const keep = keepCenter(keepOf(march.target));
      const side = plans[march.target]?.sides?.[0] ?? 0;
      const distance = applyFilter("spawnDistance", SETTINGS.spawnDistance, { owner: march.target, keep: keepOf(march.target) }) + 3;
      const host = marchHost(lord, march.manner, vassalsOf(lord, rivalLords()).length);
      host.forEach((man, i) => {
        if (total > 1 && (man.captain ? assault !== total : assault !== 1)) return;
        const at = ring(dim, keep, side, distance, i);
        if (at) soldier(dim, at, { role: man.role, tier: lord.tier + 1, name: man.name, tags: [RAIDER_TAG, ownerTag(march.target)], lord, stance: "hostile" });
      });
    }
    // a sworn ally sends soldiers to stand on your side
    if (assault !== 1) continue;
    for (const [id, kind] of Object.entries(lord.pacts ?? {})) {
      if (kind !== "alliance" || !plans[id] || !isOnline(id) || !keepOf(id)) continue;
      const keep = keepCenter(keepOf(id));
      let sent = 0;
      for (let i = 0; i < DEEDS.aid[lord.tier]; i++) {
        const at = ring(dim, keep, (plans[id].sides?.[0] ?? 0), 7, i);
        if (at && soldier(dim, at, { role: i === 0 ? "knight" : "retainer", tier: lord.tier + 1, name: `${lord.plot} Sworn Sword`, tags: [AID_TAG], lord, stance: "realm" })) sent++;
      }
      if (sent) playerById(id)?.sendMessage(`§a${lord.name} keeps their word: ${sent} of their soldiers ${sent === 1 ? "stands" : "stand"} with you tonight.`);
    }
  }
});

on("siegeEnd", ({ outcome, besieged = [] }) => {
  if (!isReady()) return;
  try {
    for (const e of world.getDimension(OVERWORLD).getEntities({ tags: [AID_TAG] })) e.remove(); // the sworn swords go home
  } catch {
    // not loaded
  }
  const fallen = getState().fallen ?? [];
  for (const lord of rivalLords()) {
    const march = lord.march;
    if (march?.state !== "marching") continue;
    if (!besieged.includes(march.target)) { march.state = "declared"; continue; } // they never reached the wall; next time
    const how = fallen.includes(march.target) ? "won" : outcome === "won" ? "beaten" : "draw";
    const id = march.target;
    const result = settleMarch(lord, how);
    changeRelation(lord, id, result.relation);
    keepPeace(lord, id, result.peaceDays);
    if (lord.grudge) delete lord.grudge[id];
    const player = playerById(id);
    if (how === "beaten") {
      everyone(`§6${march.name} has beaten off ${lordFullName(lord)}.`, id);
      if (player) {
        speak(player, lord, "beaten");
        pay(player, result.spoils, "beat off a lord");
        player.sendMessage(`§a${lord.name}'s soldiers are broken. §7They left ${coins(result.spoils)} behind, and will leave you be for ${result.peaceDays} days.`);
        emit("skillPoints", { player, amount: 1, source: `beat off ${lord.name}`, renown: 40 * (lord.tier + 1) });
      } else court().owed[id] = (court().owed[id] ?? 0) + result.spoils;
    } else if (how === "won") {
      everyone(`§c${lordFullName(lord)} has broken ${march.name}'s keep.`, id);
      if (player) {
        speak(player, lord, "won");
        const taken = Math.min(funds(player), tributeOf(lord) * 2);
        if (taken > 0) charge(player, taken, "lord's plunder");
        player.sendMessage(`§c${lord.name} took your keep${taken > 0 ? ` and ${coins(taken)} from your stores` : ""}. §7They have what they came for, and will leave you be for ${result.peaceDays} days.`);
      }
      if (result.rose) {
        emit("rivalRose", { lord, tier: lord.tier });
        everyone(`§6${lordFullName(lord)} now rules a ${TIER_NAMES[lord.tier]}.`);
      }
    } else if (player) {
      player.sendMessage(`§7Dawn sends ${lord.name}'s soldiers home with nothing settled.`);
    }
    emit("rivalMarchEnded", { lord, playerId: id, outcome: how });
  }
  saveRivals();
});

function buyOff(player, lord) {
  const price = buyOffPrice(lord, oathsOf(player.id));
  if (lord.march?.target !== player.id || lord.march.state !== "declared") return;
  if (!charge(player, price, "bought off a march")) return player.sendMessage(`§7You need ${coins(price)}.`);
  keepPeace(lord, player.id, DEEDS.peaceDays.bought);
  changeRelation(lord, player.id, 5);
  endMarch(lord, "bought");
  player.sendMessage(`§a${lord.name} calls the march off. §7They will leave you be for ${DEEDS.peaceDays.bought} days.`);
  everyone(`§6${lordFullName(lord)} has called off the march on ${player.name}.`, player.id);
}

// ---------- feuds ----------

function endFeud() {
  const c = court();
  const feud = c.feud;
  c.feud = null;
  const a = rivalById(feud?.a), b = rivalById(feud?.b);
  if (!a || !b) return;
  const wasRebel = a.liege === b.id || b.liege === a.id;
  const { winner, loser, rose } = settleFeud(a, b, feud, rivalLords(), seed());
  const freed = wasRebel && loser.liege !== winner.id;
  everyone(freed
    ? `§6${lordFullName(winner)} has thrown off ${loser.name}. ${winner.plot} answers to nobody now.`
    : `§6${lordFullName(winner)} has broken ${loser.name}'s riders. ${loser.plot} now answers to ${winner.plot}.`);
  if (rose) {
    emit("rivalRose", { lord: winner, tier: winner.tier });
    everyone(`§6${lordFullName(winner)} now rules a ${TIER_NAMES[winner.tier]}.`);
  }
  // those who backed the winner share in it
  for (const [id, side] of Object.entries(feud.backers ?? {})) {
    if (side !== winner.id) continue;
    changeRelation(winner, id, 10);
    const share = Math.round(DEEDS.backing[feud.tiers?.[side] ?? winner.tier] * 1.5);
    const player = playerById(id);
    if (player) {
      pay(player, share, "backed a lord");
      player.sendMessage(`§a${winner.name} remembers who stood with them: ${coins(share)}.`);
    } else c.owed[id] = (c.owed[id] ?? 0) + share;
  }
  emit("rivalFeudEnded", { winner, loser, freed });
}

function backInFeud(player, lord) {
  const feud = court().feud;
  if (!feud || ![feud.a, feud.b].includes(lord.id) || feud.backers[player.id]) return;
  const price = DEEDS.backing[lord.tier];
  if (!charge(player, price, "backed a lord")) return player.sendMessage(`§7You need ${coins(price)}.`);
  const other = rivalById(feud.a === lord.id ? feud.b : feud.a);
  feud.backers[player.id] = lord.id;
  feud.backing[lord.id] = (feud.backing[lord.id] ?? 0) + 1;
  (feud.tiers ??= {})[lord.id] = lord.tier;
  changeRelation(lord, player.id, 15);
  if (other) changeRelation(other, player.id, -15);
  saveRivals();
  player.sendMessage(`§aYour coin rides with ${lord.name}. §7${other?.name ?? "The other side"} will hear of it.`);
}

// A lord who is gone takes their quarrels with them
function forget(lord, player) {
  const c = court();
  if (c.feud && [c.feud.a, c.feud.b].includes(lord.id)) c.feud = null;
  for (const l of rivalLords()) {
    if (l.liege !== lord.id) continue;
    delete l.liege;
    if (player) changeRelation(l, player.id, 10); // freed vassals remember who freed them
  }
  saveRivals();
}
on("rivalFallen", ({ lord, player }) => forget(lord, player));
on("rivalStoodDown", ({ lord }) => forget(lord));

// ---------- tribute ----------

function answerDemand(player, lord, paying) {
  const demand = lord.demands?.[player.id];
  if (!demand) return;
  if (paying && !charge(player, demand.coins, "tribute")) return player.sendMessage(`§7You need ${coins(demand.coins)}.`);
  delete lord.demands[player.id];
  if (paying) {
    changeRelation(lord, player.id, 10);
    keepPeace(lord, player.id, DEEDS.peaceDays.paid);
    player.sendMessage(`§7${lord.name} takes the tribute. They will leave you be for ${DEEDS.peaceDays.paid} days.`);
  } else {
    changeRelation(lord, player.id, -20);
    (lord.grudge ??= {})[player.id] = true;
    player.sendMessage(`§c${lord.name} has had no tribute from you, and will not forget it.`);
  }
  saveRivals();
  emit("rivalTribute", { lord, player, paid: paying });
}

// ---------- oaths ----------

function swear(player, lord, kind, { free = false } = {}) {
  if (!free && !pactsOpen(lord, relationOf(lord, player.id), oathsOf(player.id)).includes(kind)) {
    speak(player, lord, "refuse");
    return player.sendMessage(`§7${lord.name} does not think well enough of you for that yet.`);
  }
  const price = kind === "alliance" && !free ? DEEDS.alliancePrice[lord.tier] : 0;
  if (price && !charge(player, price, "alliance")) return player.sendMessage(`§7Sealing an alliance takes ${coins(price)}.`);
  (lord.pacts ??= {})[player.id] = kind;
  if (lord.offers) delete lord.offers[player.id];
  if (lord.demands) delete lord.demands[player.id];
  if (lord.march?.target === player.id && lord.march.state === "declared") endMarch(lord, "called_off");
  changeRelation(lord, player.id, kind === "alliance" ? 10 : 5);
  sfx(player, "random.levelup");
  everyone(`§6${player.name} and ${lordFullName(lord)} have sworn ${kind === "alliance" ? "an alliance" : "a truce"}.`);
  emit("rivalPact", { lord, player, kind });
}

function breakPact(player, lord) {
  const kind = pactOf(lord, player.id);
  if (!kind) return;
  delete lord.pacts[player.id];
  court().oaths[player.id] = oathsOf(player.id) + 1;
  changeRelation(lord, player.id, DEEDS.breakPact.lord);
  for (const other of rivalLords()) if (other !== lord) changeRelation(other, player.id, DEEDS.breakPact.others);
  (lord.grudge ??= {})[player.id] = true;
  saveRivals();
  everyone(`§c${player.name} has broken their ${kind} with ${lordFullName(lord)}. §7Every lord will ask more of them from now on.`);
  emit("rivalPactBroken", { lord, playerId: player.id, by: "player" });
}

// Laying siege to a lord you are sworn to breaks your word
on("rivalBesieged", ({ lord, player }) => { if (player && pactOf(lord, player.id)) breakPact(player, lord); });

function sendGift(player, lord) {
  const key = `${lord.id}|${player.id}`;
  if (court().gifts[key] === day()) return player.sendMessage(`§7${lord.name} has had your gift today.`);
  const price = DEEDS.playerGift[lord.tier];
  if (!charge(player, price, "gift to a lord")) return player.sendMessage(`§7A gift worth their notice costs ${coins(price)}.`);
  court().gifts[key] = day();
  changeRelation(lord, player.id, DEEDS.playerGiftGain);
  player.sendMessage(`§7${lord.name} accepts your gift.`);
}

// ---------- trade ----------

async function trade(player, lord) {
  lord.wares ??= pickWares(lord, `${rivalData().seed}|first`);
  for (;;) {
    const r = relationOf(lord, player.id), pact = pactOf(lord, player.id);
    const sell = lord.wares.sell.map((id) => WARES.find((w) => w.id === id)).filter(Boolean);
    if (sell.some((w) => warePrice(lord, w, r, pact) === undefined)) {
      speak(player, lord, "refuse");
      return player.sendMessage(`§7${lord.name} will not trade with you.`);
    }
    const want = COMMISSIONS.find((w) => w.id === lord.wares.want);
    const left = DEEDS.commissionLots - (lord.wares.bought ?? 0);
    const form = new ActionFormData().title(`${lord.name}: trade`)
      .body(`§o"${lordSays(lord, "trade", player) ?? "Look, and buy if you like."}"§r\n\n§7You have ${coins(funds(player))}.${pact || r >= 40 ? " Your standing with them lowers their prices." : ""}`);
    for (const w of sell) form.button(`${w.count} ${nice(w.id)}\n${coins(warePrice(lord, w, r, pact))}`);
    if (want) form.button(left > 0 ? `Sell them ${want.count} ${nice(want.id)}\n${coins(want.pays)} · they want ${left} more lot${left === 1 ? "" : "s"}` : `They have all the ${nice(want.id)} they need`);
    form.button("Done");
    const res = await form.show(player);
    if (res.canceled || !player.isValid || !rivalById(lord.id)) return;
    if (res.selection < sell.length) {
      const w = sell[res.selection], price = warePrice(lord, w, r, pact);
      if (!charge(player, price, "lord's wares")) { player.sendMessage(`§7You need ${coins(price)}.`); continue; }
      const over = player.getComponent("minecraft:inventory").container.addItem(new ItemStack(w.id, w.count));
      if (over) player.dimension.spawnItem(over, player.location);
    } else if (want && res.selection === sell.length) {
      if (left <= 0) continue;
      if (!takeItems(player, want.id, want.count)) { player.sendMessage(`§7You do not have ${want.count} ${nice(want.id)} (you have ${countItem(player, want.id)}).`); continue; }
      pay(player, want.pays, "lord's commission");
      lord.wares.bought = (lord.wares.bought ?? 0) + 1;
      if (lord.wares.bought === DEEDS.commissionLots) changeRelation(lord, player.id, 4); // filling an order is remembered
      saveRivals();
    } else return;
  }
}

async function oaths(player, lord) {
  const pact = pactOf(lord, player.id);
  const open = pactsOpen(lord, relationOf(lord, player.id), oathsOf(player.id));
  const options = [];
  options.push({ label: `Send a gift\n${coins(DEEDS.playerGift[lord.tier])}`, run: () => sendGift(player, lord) });
  if (!pact) options.push({ label: open.includes("truce") ? "Swear a truce" : "Ask for a truce\n§8they do not know you well enough", run: () => swear(player, lord, "truce") });
  if (pact !== "alliance") options.push({ label: `Seal an alliance\n${open.includes("alliance") ? coins(DEEDS.alliancePrice[lord.tier]) : "§8only with a friend"}`, run: () => swear(player, lord, "alliance") });
  if (pact) options.push({
    label: `Break your ${pact}`,
    run: async () => {
      const sure = await new MessageFormData().title(`Break your ${pact}?`)
        .body(`${lord.name} will not forgive it, every other lord will think less of you, and every oath after this one will be harder to win.`)
        .button1("Keep my word").button2("Break it").show(player);
      if (sure.selection === 1) breakPact(player, lord);
    },
  });
  const form = new ActionFormData().title(`${lord.name}: gifts and oaths`).body([
    pact ? `§aYou are sworn to ${pact === "alliance" ? "an alliance" : "a truce"}.` : "§7No oath stands between you.",
    "§7A truce: neither marches on the other. An alliance: their soldiers stand on your wall on siege nights, and their prices drop.",
    oathsOf(player.id) ? `§cYou have broken ${oathsOf(player.id)} oath${oathsOf(player.id) === 1 ? "" : "s"}. Lords ask more of you.` : "",
  ].filter(Boolean).join("\n"));
  for (const o of options) form.button(o.label);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled || res.selection >= options.length || !rivalById(lord.id)) return;
  await options[res.selection].run();
}

const guard = (fn) => () => Promise.resolve().then(fn).catch((e) => console.warn(`[Hollow Crown] rival court: ${e}`));

// The lord's menu: what is pressing first, then trade and oaths
addFilter("rivalMenu", (buttons, { lord, player }) => {
  const mine = [];
  const id = player.id;
  if (lord.march?.target === id && lord.march.state === "declared") mine.push({ label: `Pay them to turn back\n${coins(buyOffPrice(lord, oathsOf(id)))}`, action: guard(() => buyOff(player, lord)) });
  const demand = lord.demands?.[id];
  if (demand) {
    mine.push({ label: `Pay the tribute\n${coins(demand.coins)}`, action: guard(() => answerDemand(player, lord, true)) });
    mine.push({ label: "Refuse the tribute", action: guard(() => answerDemand(player, lord, false)) });
  }
  const offer = lord.offers?.[id];
  if (offer && !pactOf(lord, id)) mine.push({ label: `Swear the ${offer.kind} they offer`, action: guard(() => swear(player, lord, offer.kind, { free: true })) });
  const feud = court().feud;
  if (feud && [feud.a, feud.b].includes(lord.id) && !feud.backers[id]) {
    const other = rivalById(feud.a === lord.id ? feud.b : feud.a);
    mine.push({ label: `Back them against ${other?.name ?? "their foe"}\n${coins(DEEDS.backing[lord.tier])}`, action: guard(() => backInFeud(player, lord)) });
  }
  mine.push({ label: "Trade", action: guard(() => trade(player, lord)) });
  mine.push({ label: "Gifts and oaths", action: guard(() => oaths(player, lord)) });
  return [...buttons, ...mine];
});

// Extra lines under a lord's greeting: where you stand with them and what they are in the middle of
addFilter("rivalTalkLines", (lines, { lord, player }) => {
  const out = [...lines];
  const id = player.id;
  const pact = pactOf(lord, id);
  if (pact) out.push(`§aSworn to you: ${pact === "alliance" ? "an alliance" : "a truce"}`);
  if (lord.march?.target === id) out.push("§cAt war with you: they march with the next siege night");
  else if (lord.march) out.push(`§7At war with ${lord.march.name}`);
  else if ((lord.peace?.[id] ?? -1) >= day()) out.push(`§7Has promised you peace for ${lord.peace[id] - day() + 1} more day${lord.peace[id] === day() ? "" : "s"}`);
  const liege = rivalById(lord.liege);
  if (liege) out.push(`§7Kneels to ${liege.name} of ${liege.plot}`);
  const vassals = vassalsOf(lord, rivalLords());
  if (vassals.length) out.push(`§7Holds the fealty of ${vassals.map((v) => v.plot).join(", ")}`);
  const feud = court().feud;
  if (feud && [feud.a, feud.b].includes(lord.id)) out.push(`§6Riding against ${rivalById(feud.a === lord.id ? feud.b : feud.a)?.name ?? "a neighbour"}`);
  return out;
});

onTick("rivals_court", 200, () => { if (isReady()) courtTick(); });

// ---------- commands ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:rivals") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [cmd, a, b] = event.message.trim().split(/\s+/);
  if (cmd === "deed") {
    const lord = rivalById(b) ?? rivalById(a) ?? nextToAct(rivalLords());
    if (!lord) return;
    act(lord, DO[a] ? a : undefined);
    player.sendMessage(`§7${lord.name}: ${lord.lastDeed ?? "a quiet day"}.`);
  } else if (cmd === "feud_end") {
    if (court().feud) { endFeud(); saveRivals(); }
  } else if (cmd === "relation" && rivalById(a)) {
    changeRelation(rivalById(a), player.id, Number(b) || 0);
    player.sendMessage(`§7${rivalById(a).name}: ${relationOf(rivalById(a), player.id)}`);
  } else if (cmd === "court") {
    const c = court();
    player.sendMessage([`§6Court: last deed ${c.lastKind ?? "none"} on day ${c.lastDay}, feud ${c.feud ? `${c.feud.a} against ${c.feud.b}` : "none"}`,
      ...rivalLords().map((l) => `§7${l.id}: last ${l.lastDeed ?? "-"}, you ${relationOf(l, player.id)}${pactOf(l, player.id) ? `, ${pactOf(l, player.id)}` : ""}${l.march ? `, marching on ${l.march.name} (${l.march.manner})` : ""}${l.liege ? `, kneels to ${l.liege}` : ""}`)].join("\n"));
  }
});
