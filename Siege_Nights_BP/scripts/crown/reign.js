// The reign: who wears the Crown, what the Crown lets them do, and what it does to them.

import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, getState, keepOf, overworld, title, onTick, on, emit, countItem, addSiegeSkipHook, addPlanHook, addRewardHook, FACTIONS, isGuard, guardOwner, guardCount, guardLimit, isOnline } from "../siege/api.js";
import { CROWN, IDS } from "./config.js";
import { chargeE, giveCoins } from "../economy/coins.js";
import { worth, fromEmeralds } from "../economy/rules.js";
import { hollowStage, nightfall, tithed, claimNeeded, clamp, npcDecreeTarget, freshPick, lordApproach, cleanCitadelName } from "./rules.js";
import {
  crown, saveCrown, ruler, isRuler, isCourt, rulerLabel, playerById, announce, giveItem, claimOf, seat, lords, lordOf, citadelName,
} from "./state.js";
import { citadel, inCitadel, throneSpots } from "./citadel.js";
import { sfx } from "../core/sfx.js";

const doom = () => CROWN.hunger === "full"; // does the Hunger have teeth, or is it only for show?

// ---------- Regalia ----------

function regalia(typeId, name, lore) {
  const item = new ItemStack(typeId, 1);
  item.nameTag = name;
  item.setLore(lore);
  item.keepOnDeath = true;
  item.lockMode = ItemLockMode.inventory; // can't be dropped, traded or put in a chest
  return item;
}

export function giveRegalia(player) {
  stripRegalia(player);
  giveItem(player, regalia(IDS.scepter, `§6${CROWN.relicName}`, ["§7Cut from the thing on the throne. It is still beating.", "§7Use: Kneel", "§7Sneak + use: Rally", "§7Look straight up + use: Return to the Throne", "§8Carry it inside your walls."]));
}

export function stripRegalia(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (inv) {
    for (let i = 0; i < inv.size; i++) {
      const id = inv.getItem(i)?.typeId;
      if (id === IDS.scepter) inv.setItem(i, undefined);
    }
  }
}

const carriesRelic = (player) => countItem(player, IDS.scepter) > 0;

// ---------- Coronation ----------

export function crownPlayer(player, { hollowing = 0, restored = false, victor = false } = {}) {
  const c = crown();
  c.ruler = { id: player.id, name: player.name, title: "Heartbearer", sinceDay: world.getDay(), hollowing, restored };
  c.names[player.id] = player.name;
  c.pendingCrown = null;
  c.vacant = false;
  c.decrees = { siege: null, peace: null, lastTarget: null };
  delete c.exiles[player.id];
  saveCrown();
  giveRegalia(player);
  if (!c.citadel) giveItem(player, new ItemStack(IDS.cornerstone, 1));
  title(player, `§6${CROWN.relicName} is yours`, "§7Choose how you will be known");
  sfx(player, "ui.toast.challenge_complete");

  const proclaim = () => {
    announce(`§6§lAll hail ${rulerLabel()} of ${citadelName()}!§r ${restored ? "§7The rightful ruler has returned." : `§7${CROWN.relicName} beats in a new hand.`}`, "raid.horn");
    if (!c.citadel) player.sendMessage(`§6Place the Citadel Cornerstone within ${CROWN.keepMaxFromBanner} blocks of your Keep Banner to raise ${citadelName()}.`);
    emit("crowned", { ruler: player.id, name: player.name, title: c.ruler.title, citadel: citadelName() });
    // Whoever beat the Hollow is offered the Sorcerer's road, with a head start (the town hall thread's side)
    if (victor) emit("hollowVictor", { player });
  };
  const renames = !!c.citadel; // taking a Citadel that already stands: it gets a new name with its new ruler
  if (renames) c.citadelName = null;
  const form = new ModalFormData().title("How will you be known?").dropdown("Title", CROWN.titles);
  if (renames) form.textField(`Name your Citadel (everyone will see it; leave it empty for ${CROWN.citadelName}):`, CROWN.citadelName);
  form.show(player).then((r) => {
    if (!r.canceled && isRuler(player.id)) {
      c.ruler.title = CROWN.titles[r.formValues[0]] ?? "Heartbearer";
      if (renames) c.citadelName = cleanCitadelName(r.formValues[1]); // a new ruler names the Citadel they took
      saveCrown();
    }
    proclaim();
  }).catch(proclaim);
}

// Closes the current reign and writes it into the Annals. Does not choose a successor.
export function endReign(how) {
  const c = crown();
  const r = c.ruler;
  if (!r) return undefined;
  c.annals.push({ name: r.name, title: r.title, seat: c.citadel ? citadelName() : undefined, from: r.sinceDay, to: world.getDay(), how, hollowing: r.hollowing, restored: r.restored });
  c.annals = c.annals.slice(-30);
  c.ruler = null;
  c.decrees = { siege: null, peace: null, lastTarget: null };
  c.tithe = 0;
  c.unrest = Math.floor(c.unrest / 2);
  saveCrown();
  const player = playerById(r.id);
  if (player) {
    stripRegalia(player);
    player.nameTag = player.name;
  }
  return r;
}

// ---------- Who takes the relic when the Hollow is beaten ----------

// Crown them now, or hold the Crown until they have a keep to rule from
export function award(id, others) {
  const c = crown();
  const player = playerById(id);
  if (player && keepOf(id)) return crownPlayer(player, { victor: true });
  c.pendingCrown = { id, name: player?.name ?? c.names[id] ?? "someone", untilDay: world.getDay() + 3, others };
  saveCrown();
  announce(`§6${CROWN.relicName} has chosen ${c.pendingCrown.name}, but a ruler needs a keep. They have 3 days to raise a Keep Banner.`);
}

on("keepFounded", ({ player }) => {
  if (crown().pendingCrown?.id === player.id) crownPlayer(player, { victor: true });
});

function pendingTick() {
  const c = crown();
  const wait = c.pendingCrown;
  if (!wait || c.ruler) return;
  const chosen = playerById(wait.id);
  if (chosen && keepOf(wait.id)) return crownPlayer(chosen, { victor: true });
  if (world.getDay() < wait.untilDay) return;
  const next = wait.others.find((id) => playerById(id));
  c.pendingCrown = null;
  saveCrown();
  if (next) {
    announce(`§7${wait.name} raised no keep. ${CROWN.relicName} passes on.`);
    award(next, wait.others.filter((id) => id !== next));
  } else {
    vacate(`${wait.name} raised no keep`);
  }
}

// Nobody holds the Crown: it waits in the Undertow to be won again
export function vacate(why) {
  const c = crown();
  c.vacant = true;
  c.challenge = null;
  c.storm = null;
  saveCrown();
  announce(`§5${why}. ${CROWN.relicName} sinks back into the Hollow, and waits.`, "mob.wither.death");
  emit("crownVacant", {});
}

// ---------- Hooks into sieges ----------

// Command of the Host: raiders never march on the ruler (until the Crown turns on them). A Decree of Peace spares one settlement.
addSiegeSkipHook((owner) => {
  const c = crown();
  if (c.ruler?.id === owner) {
    if (c.challenge?.npc && isOnline(owner)) return false; // a rival lord's army does not answer to the Heart
    return !(doom() && c.ruler.hollowing >= 100);
  }
  return c.decrees.peace === owner;
});

addPlanHook((plan, owner) => {
  const c = crown();
  if (c.ruler?.id === owner && doom() && c.ruler.hollowing >= 100) plan.budget *= 2; // the Choir turns on its host
  const lord = c.ruler?.id === owner && c.challenge?.npc && lordOf(c.challenge.claimant);
  if (lord) { // a rival lord marches on the throne in person
    const approach = lordApproach(Math.max(0, (lord.tries ?? 1) - 1)); // never the same army twice
    plan.budget = Math.round(plan.budget * approach.threat);
    for (const m of approach.modifiers) if (!plan.modifiers.includes(m)) plan.modifiers.push(m);
    if (!plan.grand) plan.warlord = `${lord.title} ${lord.name}`;
    plan.npcStorm = true;
  }
  const decree = c.decrees.siege;
  if (!decree || decree.target !== owner || !c.ruler) return;
  plan.budget = Math.round(plan.budget * CROWN.decreeSiegeThreat);
  if (!plan.grand && FACTIONS[decree.faction]) plan.faction = decree.faction;
  plan.decreed = c.ruler.id;
});

// Royal Tithe
addRewardHook(({ player, emeralds }) => {
  const c = crown();
  if (!c.ruler || !c.tithe || isRuler(player.id) || isCourt(player.id)) return emeralds;
  const { kept, cut } = tithed(emeralds, c.tithe);
  if (cut > 0) {
    c.treasury += cut;
    saveCrown();
    player.sendMessage(`§5The Royal Tithe takes ${worth(cut)} of your ${worth(emeralds)} for ${rulerLabel()}.`);
  }
  return kept;
});

const WHISPERS = [
  "§8§oYou hold the ground. We like those who hold the ground.",
  "§8§oHe sat where you sit. He thought he was different too.",
  "§8§oSend them. They are yours to send. They were always going to be yours.",
  "§8§oThe bell is not under the keep any more. Listen. It is closer than that.",
  "§8§oDo you hear every keep in the land yet? You will.",
  "§8§oYou counted the towers again tonight. You did not need to. You knew.",
  "§8§oIt is warm in your hand. Was it warm when you picked it up?",
  "§8§oThey kneel so easily. Have you noticed how easily?",
  "§8§oSomeone wrote to you, once, and left it where you would sit. Not yet. Later.",
  "§8§oThe third night is yours now. It was someone's before. It will be someone's after.",
  "§8§oYou have stopped hearing the bell. That is not the same as the bell stopping.",
];

on("siegeStart", () => {
  const c = crown();
  const r = c.ruler;
  if (!r) return;
  const decree = c.decrees.siege;
  const target = decree && playerById(decree.target);
  if (target && getState().plans[decree.target]) {
    title(target, "§4By Royal Decree", `§7${rulerLabel()} has sent this army against you`);
  }
  const player = playerById(r.id);
  if (player && r.hollowing >= 25) { // each whisper is heard once in a reign, and then it goes quiet
    r.heard ??= [];
    const i = freshPick(WHISPERS.length, r.heard, Math.random());
    if (i >= 0) {
      r.heard.push(i);
      saveCrown();
      player.sendMessage(WHISPERS[i]);
    }
  }
});

on("siegeEnd", () => {
  const c = crown();
  const r = c.ruler;
  if (!r) return;
  const before = hollowStage(r.hollowing);
  const next = nightfall({ hollowing: r.hollowing, unrest: c.unrest, tithe: c.tithe });
  if (!r.npc) r.hollowing = next.hollowing;
  c.unrest = next.unrest;
  c.decrees.siege = null;
  c.decrees.peace = null;
  if (r.npc) lordDecree();
  saveCrown();
  stageChanged(before);
  creep();
});

// A ruling lord does what a ruling player would: sends the raiders at someone for the next siege night
function lordDecree() {
  const c = crown();
  const st = getState();
  const owners = Object.keys(st.keeps).filter((o) => isOnline(o));
  const target = npcDecreeTarget(owners, c.decrees.lastTarget, Math.random());
  c.decrees.lastTarget = target ?? null;
  if (!target) return;
  const factions = Object.keys(FACTIONS).filter((f) => f !== "grand");
  const fresh = factions.filter((f) => f !== c.decrees.lastFaction); // never the same host twice running
  const faction = fresh[Math.floor(Math.random() * fresh.length)] ?? factions[0];
  c.decrees.lastFaction = faction;
  c.decrees.siege = { target, faction };
  c.names[target] = st.keeps[target].name;
  announce(`§4By decree of ${rulerLabel()}, the ${FACTIONS[faction].name} marches on ${st.keeps[target].name} next siege night.`, "raid.horn");
}

export function addHollowing(amount) {
  const r = ruler();
  if (!r || r.npc || CROWN.hunger === "off") return;
  const before = hollowStage(r.hollowing);
  r.hollowing = clamp(r.hollowing + amount, 0, 100);
  saveCrown();
  stageChanged(before);
}

function stageChanged(before) {
  const r = ruler();
  const now = hollowStage(r.hollowing);
  if (now === before || now.at < before.at) return;
  const player = playerById(r.id);
  // The Hunger is a secret (Mateo's rule): nothing here names it or shows a number. Players only get
  // symptoms, and have to work out for themselves what the Crown is doing to whoever wears it.
  if (now.name === "Whispering") player?.sendMessage("§8§oYou slept badly. Someone was counting keeps, all night, in a voice a little like yours.");
  if (now.name === "Hollowing") {
    player?.sendMessage("§8§oThe throne feels different under you. Something is tucked beneath the seat.");
    for (const p of world.getPlayers()) sfx(p, "block.bell.hit", { pitch: 0.4, volume: 0.5 });
  }
  if (now.name === "Hollow Monarch" && doom()) announce(`§5The bell tolled twice tonight. People say ${rulerLabel()} no longer blinks. Lesser Claims feel heavier than they did.`, "block.bell.hit");
  if (now.name === "The New Source" && doom()) {
    announce(`§4§lThe bell is ringing from inside ${citadelName()}.§r §4The raiders have turned around. They are marching on ${rulerLabel()}.`, "mob.warden.nearby_closest");
  }
}

// From "Hollowing" on, the land around the throne sickens a little each siege night
function creep() {
  const c = citadel();
  const r = ruler();
  if (!c || !r || r.hollowing < 50) return;
  const dim = overworld();
  const patches = doom() ? (r.hollowing >= 75 ? 60 : 30) : 3; // for show only: a few bare patches, never a blight
  for (let i = 0; i < patches; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * CROWN.citadelRadius;
    const x = Math.floor(c.x + Math.cos(a) * d), z = Math.floor(c.z + Math.sin(a) * d);
    try {
      const block = dim.getTopmostBlock({ x, z });
      const soil = doom() ? ["minecraft:grass_block", "minecraft:dirt", "minecraft:podzol", "minecraft:coarse_dirt"] : ["minecraft:grass_block"];
      if (block && soil.includes(block.typeId)) {
        block.setType(!doom() ? "minecraft:coarse_dirt" : Math.random() < 0.7 ? "minecraft:sculk" : "minecraft:soul_soil");
      }
    } catch { /* not loaded */ }
  }
}

// ---------- The Scepter ----------

const cooldowns = new Map(); // "playerId:power" -> tick it's ready again

function ready(player, power, ticks) {
  const key = `${player.id}:${power}`;
  const left = (cooldowns.get(key) ?? 0) - system.currentTick;
  if (left > 0) {
    player.onScreenDisplay.setActionBar(`§7${power} is ready in ${Math.ceil(left / 20)}s`);
    return false;
  }
  cooldowns.set(key, system.currentTick + ticks);
  return true;
}

const onMySide = (entity, r) => entity.id === r.id || (entity.typeId === "minecraft:player" && isCourt(entity.id)) || (isGuard(entity) && guardOwner(entity) === r.id);

function useScepter(player) {
  const r = ruler();
  if (!r || r.id !== player.id) return;
  const dim = player.dimension;
  if (player.getRotation().x < -75) return returnToThrone(player);

  if (player.isSneaking) {
    if (!ready(player, "Rally", CROWN.rallyCooldown)) return;
    let n = 0;
    for (const e of dim.getEntities({ location: player.location, maxDistance: CROWN.rallyRange })) {
      if (!onMySide(e, r)) continue;
      e.addEffect("strength", CROWN.rallyTicks, { amplifier: 0 });
      e.addEffect("regeneration", CROWN.rallyTicks, { amplifier: 1 });
      n++;
    }
    sfx(dim, "raid.horn", player.location, { pitch: 1.3 });
    return player.onScreenDisplay.setActionBar(`§6Rally! ${n - 1} of your people answer.`);
  }

  if (!ready(player, "Kneel", CROWN.kneelCooldown)) return;
  const range = doom() && r.hollowing >= 50 ? 12 : CROWN.kneelRange;
  for (const e of dim.getEntities({ location: player.location, maxDistance: range, excludeTypes: ["minecraft:item", "minecraft:xp_orb", IDS.seal, "siege:keep_heart"] })) {
    if (onMySide(e, r)) continue;
    try {
      e.addEffect("slowness", CROWN.kneelTicks, { amplifier: 4 });
      e.addEffect("weakness", CROWN.kneelTicks, { amplifier: 1 });
      if (doom() && r.hollowing >= 75) e.addEffect("wither", CROWN.kneelTicks, { amplifier: 0 });
    } catch { /* not something that can kneel */ }
  }
  sfx(dim, "block.bell.hit", player.location, { pitch: 0.5 });
  player.onScreenDisplay.setActionBar("§6Kneel.");
}

function returnToThrone(player) {
  const spots = throneSpots();
  if (!spots || !citadel().built) return player.onScreenDisplay.setActionBar(`§7${citadelName()} isn't standing yet.`);
  if (getState().active) return player.onScreenDisplay.setActionBar("§cNot on a siege night.");
  if (player.dimension.id !== "minecraft:overworld") return player.onScreenDisplay.setActionBar("§cThe throne can't hear you from here.");
  if (!ready(player, "Return to the Throne", CROWN.returnCooldown)) return;
  player.teleport(spots.seal, { dimension: overworld() });
  sfx(player, "mob.endermen.portal");
}

world.afterEvents.itemUse.subscribe((event) => {
  if (!isReady()) return;
  if (event.itemStack.typeId === IDS.scepter) useScepter(event.source);
});

// ---------- The Throne menu ----------

// Found under the throne. Mateo's rule: the twist is never stated outright, so this only hints.
// It is unsigned, and the lines that would explain everything are scraped away.
const OSWIN_LETTER = [
  "§o...for whoever sits here after me.",
  "",
  "§oThey will tell you I bargained. §r§8[the next three lines have been scraped off the page]",
  "",
  "§oIt asks for so little at first. A siege sent somewhere you need not watch. A tenth of what they earn.",
  "",
  "§oI used to hear the bell from under the keep. I do not hear it from there any more.",
  "",
  "§oIf the grass has begun to die, pour what you have into the dark beneath this seat. It buys quiet. It does not buy much.",
  "",
  "§r§8[There is no name. The wax seal has been pressed flat with a thumb.]",
].join("\n");

// Costs and the Treasury are counted in the old unit (CROWN config, saved state); one is 8 coins.
const pay = (player, cost) => {
  const c = crown();
  const fromTreasury = Math.min(c.treasury, cost);
  if (!chargeE(player, cost - fromTreasury, "throne")) return false;
  c.treasury -= fromTreasury;
  saveCrown();
  return true;
};

export function crownStatus(viewer) {
  const c = crown();
  const r = c.ruler;
  if (!r) return [c.vacant ? `§5${CROWN.relicName} waits in the Hollow for someone to win it.` : "No one has beaten the Hollow yet. The High Throne stands empty.", "", ...annalLines().slice(0, 6)];
  const lines = [
    `§l${rulerLabel()}§r of ${citadelName()}${r.restored ? " §7(restored)" : ""}`,
    `Reigning since day ${r.sinceDay} (${world.getDay() - r.sinceDay} days)`,
    `Royal Tithe: ${c.tithe}%   Unrest: ${c.unrest}`,
    c.challenge ? `§c${c.challenge.name} has thrown down the Gauntlet. The Storm comes on the next siege night both are here.` : `Grace: ${Math.max(0, c.graceUntil - getState().siegeNumber)} siege nights`,
  ];
  if (CROWN.npcRivals && !r.npc) lines.push(`Rival lords: ${lords().map((l) => `${l.name} §5${l.claim}§r`).join(", ")}`);
  if (r.npc) lines.push(`§7${r.title} ${r.name} answers to no player. Earn a Claim and throw down the Gauntlet to unseat them.`);
  if (viewer && !isRuler(viewer.id)) {
    lines.push("", isCourt(viewer.id) ? "§6You are in the Court." : `Your Claim: §5${claimOf(viewer.id)}§r of ${claimNeeded(r.hollowing)}`);
  }
  return lines;
}

export function annalLines() {
  const list = [...crown().annals].reverse();
  if (!list.length) return ["The Annals of the High Throne are empty."];
  return ["§lThe Annals of the High Throne§r", ...list.map((a) => `${a.title} ${a.name}${a.seat ? ` of ${a.seat}` : ""}${a.restored ? " (restored)" : ""}: day ${a.from} to ${a.to}, ${a.how}`)];
}

function show(player, form, actions) {
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

export function throneMenu(player) {
  const c = crown();
  const r = c.ruler;
  if (!r || r.id !== player.id) {
    const form = new ActionFormData().title("The Throne").body([...crownStatus(player), "", ...annalLines()].join("\n")).button("Close");
    return show(player, form, []);
  }
  const body = [...crownStatus(player), `Royal Treasury: §a${worth(c.treasury)}§r`, `Royal Guard: ${guardCount(r.id)}/${guardLimit(r.id)}`,
    c.decrees.siege ? `§cDecree of Siege: ${c.names[c.decrees.siege.target] ?? "a settlement"} (${FACTIONS[c.decrees.siege.faction]?.name ?? "any"})` : "",
    c.decrees.peace ? `§aDecree of Peace: ${c.names[c.decrees.peace] ?? "a settlement"}` : ""].filter((l, i, all) => l || all[i - 1]);
  const form = new ActionFormData().title(`${rulerLabel()}`).body(body.join("\n"));
  const actions = [];
  const add = (label, action, icon) => { form.button(label, icon); actions.push(action); };
  add(`Decree of Siege (${worth(CROWN.decreeSiegeCost)})`, () => decreeMenu(player, "siege"), "textures/items/siege_war_horn");
  add(`Decree of Peace (${worth(CROWN.decreePeaceCost)})`, () => decreeMenu(player, "peace"), "textures/items/siege_writ");
  add(`Royal Tithe: ${c.tithe}% (change)`, () => {
    c.tithe = CROWN.titheSteps[(CROWN.titheSteps.indexOf(c.tithe) + 1) % CROWN.titheSteps.length];
    saveCrown();
    announce(c.tithe ? `§5By royal decree, ${c.tithe}% of all siege winnings now go to ${rulerLabel()}.` : "§aThe Royal Tithe has been lifted.");
    throneMenu(player);
  }, "textures/items/siege_gold_coin");
  add(`Withdraw the Treasury (${worth(c.treasury)})`, () => {
    if (!c.treasury) return player.sendMessage("§7The Treasury is empty.");
    let left = c.treasury;
    c.treasury = 0;
    saveCrown();
    giveCoins(player, fromEmeralds(left)); // coins that were already paid in as tithes and decrees
  }, "textures/items/siege_gold_coin");
  // Hidden until the ruler has found and read the letter: only then do they know there is something to quiet
  if (doom() && r.readLetter) add(`Quiet it (${worth(CROWN.purifyCost)})`, () => {
    if (c.purifiedDay === world.getDay()) return player.sendMessage("§7It will not be quieted twice in one day.");
    if (!pay(player, CROWN.purifyCost)) return player.sendMessage("§cNot enough coin in the Treasury or your pack.");
    c.purifiedDay = world.getDay();
    r.hollowing = clamp(r.hollowing - CROWN.purifyAmount, 0, 100);
    saveCrown();
    sfx(player, "random.totem");
    player.sendMessage("§7You pour coin into the dark under the throne. §aThe whispers fade a little.");
  });
  if (r.hollowing >= 50 || r.readLetter) add("§8Something is tucked under the seat", () => {
    r.readLetter = true;
    saveCrown();
    show(player, new ActionFormData().title("A letter, very old").body(OSWIN_LETTER).button("Close"), []);
  });
  add("The Annals of the High Throne", () => show(player, new ActionFormData().title("The Annals").body(annalLines().join("\n")).button("Close"), []));
  form.button("Close");
  show(player, form, actions);
}

function decreeMenu(player, kind) {
  const c = crown();
  const st = getState();
  const targets = Object.entries(st.keeps).filter(([owner]) => owner !== player.id && (kind === "peace" || (!isCourt(owner) && owner !== c.decrees.lastTarget)));
  if (c.decrees[kind]) return player.sendMessage("§7You have already made that decree for the next siege night.");
  if (!targets.length) return player.sendMessage(kind === "siege" ? "§7There is no settlement you can send them against (never the same one twice in a row, never your Court)." : "§7There is no other settlement to spare.");
  const form = new ActionFormData().title(kind === "siege" ? "Decree of Siege" : "Decree of Peace")
    .body(kind === "siege" ? "Choose who the raiders march on next siege night. Their army will be half again as large." : "Choose a settlement the raiders will pass by next siege night.");
  for (const [, keep] of targets) form.button(`${keep.name}`);
  form.show(player).then((r) => {
    if (r.canceled) return;
    const [owner, keep] = targets[r.selection];
    c.names[owner] = keep.name;
    if (kind === "peace") {
      if (!pay(player, CROWN.decreePeaceCost)) return player.sendMessage("§cNot enough coin.");
      c.decrees.peace = owner;
      c.unrest = Math.max(0, c.unrest - 1);
      saveCrown();
      return announce(`§a${rulerLabel()} decrees peace for ${keep.name}. The raiders will pass them by.`);
    }
    const factions = Object.keys(FACTIONS).filter((f) => f !== "grand");
    const pickForm = new ActionFormData().title("Who marches?").body(`Which host do you send against ${keep.name}?`);
    for (const f of factions) pickForm.button(FACTIONS[f].name);
    pickForm.show(player).then((p) => {
      if (p.canceled) return;
      if (!pay(player, CROWN.decreeSiegeCost)) return player.sendMessage("§cNot enough coin.");
      c.decrees.siege = { target: owner, faction: factions[p.selection] };
      c.decrees.lastTarget = owner;
      c.unrest += CROWN.unrestPerDecree;
      saveCrown();
      addHollowing(CROWN.hollowPerDecree);
      announce(`§4By royal decree, the ${FACTIONS[factions[p.selection]].name} marches on ${keep.name} next siege night.`, "raid.horn");
    }).catch(() => {});
  }).catch(() => {});
}

// ---------- Every few seconds: crown buffs, name tags, stray regalia ----------

function reignTick() {
  pendingTick();
  const r = ruler();
  for (const player of world.getPlayers()) {
    if (r?.id === player.id) {
      r.name = player.name;
      const stage = hollowStage(r.hollowing);
      const tag = `${doom() && stage.at >= 75 ? "§5" : "§6"}${r.title} ${player.name}§r`;
      if (player.nameTag !== tag) player.nameTag = tag;
      const home = player.dimension.id === "minecraft:overworld" && (inCitadel(player.location) || nearSeat(player.location));
      if (carriesRelic(player) && home) {
        player.addEffect("strength", 100, { amplifier: 0, showParticles: false });
        player.addEffect("resistance", 100, { amplifier: 0, showParticles: false });
      }
      if ((carriesRelic(player) && home) || (doom() && r.hollowing >= 25)) player.addEffect("night_vision", 300, { amplifier: 0, showParticles: false });
      continue;
    }
    if (carriesRelic(player)) stripRegalia(player);
    if (r && isCourt(player.id) && player.dimension.id === "minecraft:overworld" && inCitadel(player.location)) {
      player.addEffect("resistance", 100, { amplifier: 0, showParticles: false });
    }
  }
}

function nearSeat(loc) {
  const s = seat();
  return !!s && !citadel() && Math.hypot(loc.x - s.x, loc.z - s.z) <= 32;
}

onTick("crown reign", 60, reignTick);
