// The arena at Kingsrest (Mateo, 2026-11-13). Fight other Kings, or a mob, for glory or Regals.
//
// How a fight goes:
//   1. Click the "Start a battle" lectern in the entrance hall. Pick "Battle a King" or "Battle a mob".
//      Against Kings: pick how (everyone for themselves, or two, three or four teams) and who. Each one invited
//      gets a message to accept or decline; accepting takes them straight to their own room (one per settlement
//      colour, twelve round the floor), wherever they are in the world. Against a mob: pick the mob and how
//      hard, and bring friends along if you like.
//   2. In your room, choose: fight with your own things, or take the arena kit (the same for everyone; your own
//      things wait in a locker and come back after). Then press Start Battle. Click the lectern in the room
//      to open that menu again.
//   3. When everyone is ready: 3, 2, 1, the gates lift and the fight is on. The crowd fills the stands.
//      Mob fights: the mob comes out in the middle of the floor.
//   4. Last side standing wins. Falling, logging off or leaving the floor puts you out; you come back in your
//      room to watch. Mob fights pay Regals by mob and difficulty (less for the same win again on the same day).
//   5. Everyone gets their health back, their own things back and their game mode back, and goes back where
//      they came from.
//
// Everyone fights in Adventure mode, so Creative players can fight too (and nobody breaks the arena).
//
// Test: /scriptevent siege:arena               open the battle menu wherever you are
//       /scriptevent siege:arena_test          put a rough test arena around you and use it (clear: back to the real one)
//       /scriptevent siege:arena_status        what the arena is doing
//       /scriptevent siege:arena_end           stop the fight now (a draw) and send everyone back

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { isReady, onTick, moduleStore, on, addFilter, setGate } from "../siege/api.js";
import { addMenuLabel } from "../core/labels.js";
import { sfx } from "../core/sfx.js";
import { pay, coins } from "../economy/api.js";
import { ARENA, ringLayout, COLOR_CODE, colorName, GATE_BLOCK } from "./layout.js";
import { ARENA_RULES as R, ARENA_MOBS, DIFFICULTIES } from "./config.js";
import { FORMATS, spreadRooms, verdict, mobReward, hasLeft, dayOf, inBox, flat } from "./rules.js";
import { stash, giveKit, stripKit, restore, sweepDrops, clearLooseKit } from "./locker.js";
import { fillStands, emptyStands, roar, crowdTick, CROWD } from "./crowd.js";
import { buildTestArena } from "./scaffold.js";
import "./tests.js";

export const MOB_TAG = "hc_arena_mob";

const store = moduleStore("hc:arena", () => ({
  pending: {},   // playerId -> { origin: { dim, x, y, z }, gm, room, name }: has to be sent back and given their things
  records: {},   // playerId -> { name, wins, losses, draws, mobWins }
  mobDay: { day: -1, wins: {} }, // "playerId|mob|difficulty" -> wins today
  seen: {},      // playerId -> true once they've read how it works
  testCenter: null,
}));

// ---------- where things are ----------

export function layout() {
  const t = store.data.testCenter;
  return t ? ringLayout(t, ARENA.name, ARENA.dim) : ARENA;
}
const arenaName = () => layout().name || "the Arena";
const Title = () => { const n = arenaName(); return n[0].toUpperCase() + n.slice(1); };
const dimOf = (id) => { try { return world.getDimension(id); } catch { return undefined; } };
const arenaDim = () => dimOf(layout().dim);
const mid = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });
const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
const say = (p, text) => { try { p.sendMessage(text); } catch { /* left */ } };
const online = (id) => world.getPlayers().find((p) => p.id === id);
const roomLabel = (i) => { const c = layout().rooms[i].color; return `${COLOR_CODE[c] ?? "§f"}${colorName(c)}§r`; };

// Show a form, waiting a moment if another screen is still open (the chat after a command, another menu)
async function showWhenFree(player, form, tries = 10) {
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await form.show(player); } catch { return { canceled: true }; }
    if (!(r.canceled && r.cancelationReason === "UserBusy")) return r;
    await new Promise((res) => system.runTimeout(res, 10));
  }
  return { canceled: true };
}

// ---------- the match ----------
//
// match = { kind: "pvp" | "mob", host, phase: "invite" | "ready" | "countdown" | "fight" | "over",
//           fighters: { id: { name, side, room, kit: undefined | true | false, ready, out, why } },
//           invites: { id: { name, side, room, until } }, sides: [label], mob?: { type, difficulty },
//           readyBy, endsAt, gatesOpenAt, mobs: [entity ids] }

let match;
const fresh = new Map(); // item entity id -> tick it appeared (for sweeping a fallen fighter's drops)

export const arenaMatch = () => match;
const fighterIds = () => (match ? Object.keys(match.fighters) : []);
const tellAll = (text) => { for (const id of fighterIds()) { const p = online(id); if (p) say(p, text); } };

function remember(player, room) {
  if (store.data.pending[player.id]) { store.data.pending[player.id].room = room; store.save(); return; }
  const l = player.location;
  let gm;
  try { gm = player.getGameMode(); } catch { gm = GameMode.Survival; }
  store.data.pending[player.id] = { origin: { dim: player.dimension.id, x: l.x, y: l.y, z: l.z }, gm, room, name: player.name };
  store.save();
}

function sendToRoom(player, room) {
  const a = layout(), r = a.rooms[room], dim = arenaDim();
  if (!dim) return;
  player.teleport(mid(r.spawn), { dimension: dim, facingLocation: mid(r.out) });
  try { player.setGameMode(GameMode.Adventure); } catch { /* fine */ }
}

// The room's portcullis, worked the way every castle portcullis is (siege/gates.js setGate: it rises leaving its
// top row in sight, with the portcullis sounds). Any one of its blocks moves the whole thing.
function gateBlock(dim, room) {
  const g = layout().rooms[room].gate;
  try {
    return dim.getBlock({ x: Math.min(g.from.x, g.to.x), y: Math.max(g.from.y, g.to.y), z: Math.min(g.from.z, g.to.z) });
  } catch {
    return undefined; // unloaded
  }
}
const isGate = (b) => b?.typeId === GATE_BLOCK;

function closeGate(dim, room) {
  const b = gateBlock(dim, room);
  if (isGate(b)) setGate(b, false);
}

function liftGate(dim, room) {
  const b = gateBlock(dim, room);
  if (isGate(b)) setGate(b, true);
}

// Is this block part of one of the arena's room gates?
function arenaGateAt(block) {
  const a = layout();
  if (block.dimension.id !== a.dim || block.typeId !== GATE_BLOCK) return false;
  return a.rooms.some((r) => inBox(block.location, r.gate.from, r.gate.to));
}

// Nobody clicks an arena gate open: it lifts when the fight starts and drops behind the fighters.
addFilter("gateLock", (why, { block }) => (why ?? (arenaGateAt(block) ? `The ${arenaName()} gates lift when the fight starts.` : undefined)));

const usedRooms = () => [...new Set([...Object.values(match?.fighters ?? {}), ...Object.values(match?.invites ?? {})].map((f) => f.room))];

function newMatch(host, kind, extra) {
  match = { kind, host: host.id, phase: "invite", fighters: {}, invites: {}, mobs: [], startedAt: system.currentTick, ...extra };
  fresh.clear();
}

function join(player, side, room) {
  remember(player, room);
  match.fighters[player.id] = { name: player.name, side, room };
  delete match.invites[player.id];
  sendToRoom(player, room);
  sfx(player, "random.levelup", { pitch: 0.7, volume: 0.5 });
  system.runTimeout(() => roomMenu(player), 30);
}

// ---------- the sign: start a battle ----------

async function howItWorks(player) {
  store.data.seen[player.id] = true;
  store.save();
  const body = [
    `§l${Title()}§r: fight other Kings, or a beast, in front of a crowd.`,
    "",
    "§6Battle a King§r: pick who to fight, one on one, everyone for themselves, or in teams. They get an invite wherever they are; saying yes brings them straight to their own room here.",
    "§6Battle a mob§r: pick a beast and how hard. Win and you're paid in Regals: harder fights and fiercer beasts pay more. The same win again on the same day pays less.",
    "",
    "In your room you choose: §efight with your own things§r, or §etake the arena kit§r (iron armour, sword, axe, bow, shield and food, the same for everyone). If you take the kit, your own things wait safely in a locker and come back the moment the fight ends.",
    "Press §eStart Battle§r. When everyone is ready the gates lift.",
    "",
    "Falling, leaving the floor or logging off puts you out; you'll be back in your room to watch. Nothing you own is lost in here: what you drop when you fall is picked up for you.",
    "Afterwards everyone is healed, given their things back and sent back to where they came from. Everyone fights in Adventure mode, even Creative players.",
  ].join("\n");
  await showWhenFree(player, new ActionFormData().title(Title()).body(body).button("Got it"));
}

export async function mainMenu(player) {
  if (!store.data.seen[player.id]) await howItWorks(player);
  if (match) {
    const f = match.fighters[player.id];
    if (f) return roomMenu(player);
    const who = Object.values(match.fighters).map((x) => x.name).join(", ");
    const what = match.kind === "mob" ? `against ${mobName(match.mob.type)} (${diffName(match.mob.difficulty)})` : "between Kings";
    return showWhenFree(player, new ActionFormData().title(Title())
      .body(`A fight ${what} is on: ${who}.\n\nFind a seat in the stands and watch. The arena is free again when it ends.`)
      .button("Close"));
  }
  const r = await showWhenFree(player, new ActionFormData().title(Title())
    .body("What will it be?")
    .button("Battle a King\n§8fight other players")
    .button("Battle a mob\n§8win Regals")
    .button("Records")
    .button("How it works"));
  if (r.canceled) return;
  if (r.selection === 0) return battleKings(player);
  if (r.selection === 1) return battleMob(player);
  if (r.selection === 2) return records(player);
  return howItWorks(player).then(() => mainMenu(player));
}

async function battleKings(host) {
  const others = world.getPlayers().filter((p) => p.id !== host.id);
  if (!others.length) return say(host, "§7Nobody else is here to fight. Try a mob instead, or come back when another King is on.");
  const f = await showWhenFree(host, FORMATS.reduce((form, x) => form.button(x.name), new ActionFormData().title("Battle a King").body("How do you want to fight?")));
  if (f.canceled) return;
  const format = FORMATS[f.selection];
  const rooms = spreadRooms(format.teams || 2);
  const teamNames = rooms.map((room) => roomLabel(room));
  const form = new ModalFormData().title(format.name);
  if (format.teams) {
    form.dropdown("Your team", teamNames, { defaultValueIndex: 0 });
    for (const p of others.slice(0, 11)) form.dropdown(p.name, ["Not invited", ...teamNames], { defaultValueIndex: 0 });
  } else {
    for (const p of others.slice(0, 11)) form.toggle(`Invite ${p.name}`, { defaultValue: others.length === 1 });
  }
  form.submitButton("Send the invites");
  const res = await showWhenFree(host, form);
  if (res.canceled || match) return res.canceled ? undefined : say(host, "§cSomeone else started a fight first.");
  const v = res.formValues;
  const sides = []; // side index per player id
  let hostSide = 0;
  if (format.teams) {
    hostSide = v[0];
    others.slice(0, 11).forEach((p, i) => { if (v[i + 1] > 0) sides.push([p, v[i + 1] - 1]); });
  } else {
    others.slice(0, 11).forEach((p, i) => { if (v[i]) sides.push([p, sides.length + 1]); });
  }
  if (!sides.length) return say(host, "§7You didn't invite anyone.");
  if (format.teams && !sides.some(([, s]) => s !== hostSide)) return say(host, "§cEveryone is on your team. Put someone on another team.");
  // rooms: teams use their team's room; everyone-for-themselves spreads one room each round the ring
  const ffaRooms = format.teams ? undefined : spreadRooms(sides.length + 1);
  const roomOf = (side) => (format.teams ? rooms[side] : ffaRooms[side]);
  newMatch(host, "pvp", { format: format.id, sides: format.teams ? teamNames : undefined });
  const until = system.currentTick + R.inviteSeconds * 20;
  for (const [p, side] of sides) match.invites[p.id] = { name: p.name, side, room: roomOf(side), until };
  resetGates();
  join(host, hostSide, roomOf(hostSide));
  say(host, `§7Invites sent. You're in the ${roomLabel(roomOf(hostSide))} §7room. They have ${R.inviteSeconds} seconds to answer.`);
  for (const [p, side] of sides) invite(p, host, format, format.teams ? `on the ${teamNames[side]} team` : "");
}

async function invite(player, host, format, team) {
  const pvp = match?.kind === "pvp";
  const body = pvp
    ? `§e${host.name}§r challenges you to a fight in ${arenaName()} (${format.name.toLowerCase()}) ${team}.\n\nSay yes and you go straight to your room there. You can fight with your own things or take the arena kit, and you'll be sent back here afterwards with everything you had.`
    : `§e${host.name}§r asks you to fight ${mobName(match.mob.type)} (${diffName(match.mob.difficulty)}) with them in ${arenaName()}.\n\nWin and you're each paid ${coins(mobReward(match.mob.type, match.mob.difficulty, winsToday(player.id)))}. You'll be sent back here afterwards with everything you had.`;
  sfx(player, "random.orb", { pitch: 0.6 });
  const r = await showWhenFree(player, new ActionFormData().title(`${Title()}: a challenge`).body(body).button("§2Accept").button("Decline"), R.inviteSeconds * 2);
  const inv = match?.invites[player.id];
  if (!inv) return say(player, "§7That invite has closed.");
  if (r.canceled || r.selection !== 0) {
    delete match.invites[player.id];
    const h = online(match.host);
    if (h) say(h, `§7${player.name} declined.`);
    return checkInvitesDone();
  }
  if (system.currentTick > inv.until) return say(player, "§7Too late: that invite has closed.");
  join(player, inv.side, inv.room);
  tellAll(`§a${player.name} is in, in the ${roomLabel(inv.room)}§a room.`);
  checkInvitesDone();
}

function checkInvitesDone() {
  if (!match || match.phase !== "invite") return;
  const now = system.currentTick;
  for (const [id, inv] of Object.entries(match.invites)) if (now > inv.until) {
    delete match.invites[id];
    const h = online(match.host);
    if (h) say(h, `§7${inv.name} didn't answer in time.`);
  }
  if (Object.keys(match.invites).length) return;
  const sides = new Set(Object.values(match.fighters).map((f) => f.side));
  if (match.kind === "pvp" && sides.size < 2) {
    tellAll("§7Nobody took up the challenge. Maybe next time.");
    return finishMatch(undefined, true);
  }
  match.phase = "ready";
  match.readyBy = now + R.readySeconds * 20;
  tellAll(`§eEveryone's here. Pick your kit and press Start Battle (§7you have ${R.readySeconds} seconds§e).`);
  maybeStart();
}

// ---------- in your room ----------

async function roomMenu(player) {
  const f = match?.fighters[player.id];
  if (!f) return;
  if (match.phase === "fight" || match.phase === "over") {
    return showWhenFree(player, new ActionFormData().title(Title()).body(f.out ? "You're out of this one. Watch from here; you'll be sent back when it ends." : "The fight is on!").button("Close"));
  }
  if (f.ready) {
    const r = await showWhenFree(player, new ActionFormData().title(Title()).body(waitingText()).button("Close").button("§cI'm not ready after all"));
    if (!r.canceled && r.selection === 1 && match?.fighters[player.id] && match.phase !== "countdown") { f.ready = false; tellAll(`§7${player.name} isn't ready yet.`); }
    return;
  }
  const kitText = "Iron armour, iron sword and axe, bow and 24 arrows, a shield, food and a golden apple";
  const form = new ActionFormData().title(`${Title()}: ${colorName(layout().rooms[f.room].color)} room`)
    .body([
      match.kind === "mob" ? `You'll fight ${mobName(match.mob.type)} (${diffName(match.mob.difficulty)}).` : `${Object.values(match.fighters).map((x) => x.name).join(", ")} ${match.phase === "invite" ? "(more may still be coming)" : ""}`,
      "",
      `§7Your things:§r ${f.kit === true ? "§ethe arena kit§r" : f.kit === false ? "§eyour own things§r" : "not picked yet"}`,
      `§7Arena kit:§r ${kitText}. Your own things wait in a locker and come back after.`,
    ].join("\n"))
    .button(`Fight with my own things${f.kit === false ? " §2(picked)" : ""}`)
    .button(`Take the arena kit${f.kit === true ? " §2(picked)" : ""}`)
    .button(f.kit === undefined ? "§8Start Battle (pick first)" : "§2Start Battle")
    .button("§cLeave the fight");
  const r = await showWhenFree(player, form);
  if (r.canceled || !match?.fighters[player.id] || f.ready) return;
  if (r.selection === 0) {
    if (f.kit === true) takeKitBack(player, f);
    f.kit = false;
    return roomMenu(player);
  }
  if (r.selection === 1) {
    if (f.kit !== true) {
      try {
        stash(player, arenaDim(), layout().rooms[f.room].spawn);
        markLocker(player.id, true);
        giveKit(player);
        f.kit = true;
      } catch (e) {
        console.warn(`[Hollow Crown] arena: kit: ${e}`);
        return say(player, "§cThe locker wouldn't open. Fight with your own things, or try again.");
      }
    }
    return roomMenu(player);
  }
  if (r.selection === 2) {
    if (f.kit === undefined) return roomMenu(player);
    f.ready = true;
    sfx(player, "random.anvil_use", { pitch: 1.4, volume: 0.4 });
    tellAll(`§a${player.name} is ready.`);
    return maybeStart();
  }
  if (r.selection === 3) return leave(player, "left before it began");
}

function takeKitBack(player, f) {
  stripKit(player);
  if (restore(player, arenaDim(), layout().rooms[f.room].spawn)) markLocker(player.id, false);
}

function markLocker(id, on) {
  const rec = store.data.pending[id];
  if (!rec || !!rec.locker === on) return;
  rec.locker = on;
  store.save();
}

function waitingText() {
  const lines = Object.values(match.fighters).map((x) => `${x.ready ? "§2ready" : "§7picking"}§r  ${x.name}`);
  for (const inv of Object.values(match.invites)) lines.push(`§8invited§r  ${inv.name}`);
  return `Waiting for everyone:\n\n${lines.join("\n")}`;
}

function leave(player, why) {
  const f = match?.fighters[player.id];
  if (!f) return;
  if (match.phase === "fight") { f.out = true; f.why = why; return; }
  delete match.fighters[player.id];
  tellAll(`§7${player.name} ${why}.`);
  sendHome(player);
  if (match.kind === "pvp" && new Set(Object.values(match.fighters).map((x) => x.side)).size < 2 && !Object.keys(match.invites).length) {
    tellAll("§7Not enough fighters left. The fight is off.");
    return finishMatch(undefined, true);
  }
  if (!Object.keys(match.fighters).length) return finishMatch(undefined, true);
  maybeStart();
}

function maybeStart() {
  if (!match || match.phase !== "ready") return;
  const fs = Object.values(match.fighters);
  if (!fs.length || !fs.every((f) => f.ready)) return;
  countdown();
}

// ---------- the fight ----------

function countdown() {
  match.phase = "countdown";
  const dim = arenaDim();
  const a = layout();
  fillStands(dim, a, R.maxCrowd);
  for (const id of fighterIds()) {
    const p = online(id);
    if (!p) continue;
    try { p.getComponent("minecraft:health")?.resetToMaxValue(); p.addEffect("saturation", 2, { amplifier: 10, showParticles: false }); p.extinguishFire?.(); } catch { /* fine */ }
  }
  for (let s = R.countdown; s >= 1; s--) {
    system.runTimeout(() => {
      for (const id of fighterIds()) { const p = online(id); if (p) { p.onScreenDisplay.setTitle(`§6${s}`, { fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 2 }); sfx(p, "note.pling", { pitch: 0.8 }); } }
    }, (R.countdown - s) * 20 + 20);
  }
  system.runTimeout(openGates, R.countdown * 20 + 20);
}

function openGates() {
  if (!match || match.phase !== "countdown") return;
  const dim = arenaDim(), a = layout();
  match.phase = "fight";
  match.gatesOpenAt = system.currentTick;
  match.endsAt = system.currentTick + (match.kind === "mob" ? R.mobMinutes : R.pvpMinutes) * 1200;
  for (const room of usedRooms()) liftGate(dim, room);
  for (const id of fighterIds()) { const p = online(id); if (p) p.onScreenDisplay.setTitle("§cFight!", { subtitle: match.kind === "mob" ? mobName(match.mob.type) : "", fadeInDuration: 0, stayDuration: 30, fadeOutDuration: 10 }); }
  roar(dim, a, "fanfare", 4);
  if (match.kind === "mob") system.runTimeout(spawnMobs, 30);
  system.runTimeout(dropGatesBehind, R.gateCloseSeconds * 20);
}

function spawnMobs() {
  if (!match || match.phase !== "fight") return;
  const dim = arenaDim(), a = layout();
  const diff = DIFFICULTIES.find((d) => d.id === match.mob.difficulty);
  const party = Object.keys(match.fighters).length;
  const count = diff.count + Math.max(0, party - 1); // one more for each extra friend
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const at = { x: a.center.x + 0.5 + (count > 1 ? Math.cos(ang) * 2 : 0), y: a.center.y, z: a.center.z + 0.5 + (count > 1 ? Math.sin(ang) * 2 : 0) };
    try {
      const e = dim.spawnEntity(match.mob.type, at);
      e.addTag(MOB_TAG); // tagged: the no-monsters and gentle-start sweeps leave it alone
      for (const [effect, amp] of diff.effects) e.addEffect(effect, 20 * 60 * 20, { amplifier: amp, showParticles: false });
      match.mobs.push(e.id);
    } catch (err) {
      console.warn(`[Hollow Crown] arena: couldn't spawn ${match.mob.type}: ${err}`);
    }
  }
  try { dim.spawnParticle("minecraft:huge_explosion_emitter", { x: a.center.x + 0.5, y: a.center.y + 1, z: a.center.z + 0.5 }); } catch { /* cosmetic */ }
  sfx(dim, "mob.ravager.roar", mid(a.center), { volume: 3, pitch: 0.8 });
}

function dropGatesBehind() {
  if (!match || match.phase !== "fight") return;
  const dim = arenaDim(), a = layout();
  // anyone still standing in their room (and not out) is walked onto the floor first
  for (const [id, f] of Object.entries(match.fighters)) {
    if (f.out) continue;
    const p = online(id), r = a.rooms[f.room];
    if (p && flat(p.location, r.spawn) <= 5) p.teleport(mid(r.out), { dimension: dim, facingLocation: mid(a.center) });
  }
  for (const room of usedRooms()) closeGate(dim, room);
}

function mobsLeft() {
  const dim = arenaDim(), a = layout();
  let n = 0;
  for (const e of dim?.getEntities({ tags: [MOB_TAG] }) ?? []) {
    if (!match.mobs.includes(e.id)) continue;
    n++;
    if (flat(e.location, a.center) > a.floorRadius + 12) e.teleport(mid(a.center)); // wandered off: back in you go
  }
  return n;
}

function fallOut(id, why) {
  const f = match?.fighters[id];
  if (!f || f.out) return;
  f.out = true;
  f.why = why;
  tellAll(`§c${f.name} ${why}.`);
}

function fightTick() {
  if (!match) return;
  const now = system.currentTick;
  if (match.phase === "invite") return checkInvitesDone();
  if (match.phase === "ready") {
    if (now > match.readyBy) {
      for (const [id, f] of Object.entries(match.fighters)) if (!f.ready) { const p = online(id); if (p) { say(p, "§cOut of time to get ready."); leave(p, "wasn't ready in time"); } }
      maybeStart();
    }
    return;
  }
  if (match.phase !== "fight") return;
  const dim = arenaDim(), a = layout();
  crowdTick(dim, a);
  for (const [id, f] of Object.entries(match.fighters)) {
    if (f.out) continue;
    const p = online(id);
    if (!p) { fallOut(id, "left the game"); continue; }
    if (p.dimension.id !== a.dim || hasLeft(p.location, a, a.rooms[f.room], R.leaveMargin)) fallOut(id, "left the floor");
  }
  const v = verdict({ kind: match.kind, fighters: match.fighters, mobsLeft: match.kind === "mob" ? mobsLeft() : 0, timeUp: now >= match.endsAt });
  if (v.result !== "on") endFight(v);
}

function endFight(v) {
  match.phase = "over";
  const dim = arenaDim(), a = layout();
  const rec = (id) => (store.data.records[id] ??= { name: match.fighters[id].name, wins: 0, losses: 0, draws: 0, mobWins: 0 });
  let headline, sub = "";
  if (match.kind === "pvp") {
    if (v.result === "won") {
      const winners = Object.entries(match.fighters).filter(([, f]) => f.side === v.winner);
      headline = match.sides ? `${match.sides[v.winner]} §6team wins!` : `§6${winners[0][1].name} wins!`;
      sub = winners.map(([, f]) => f.name).join(", ");
      for (const [id, f] of Object.entries(match.fighters)) { const r = rec(id); r.name = f.name; if (f.side === v.winner) r.wins++; else r.losses++; }
    } else {
      headline = "§7A draw";
      sub = v.timeUp ? "Time ran out" : "They fell together";
      for (const id of fighterIds()) rec(id).draws++;
    }
  } else if (v.result === "won") {
    headline = `§6${mobName(match.mob.type)} is beaten!`;
    for (const id of fighterIds()) {
      const p = online(id);
      const n = winsToday(id);
      const amount = mobReward(match.mob.type, match.mob.difficulty, n);
      bumpWins(id);
      rec(id).mobWins++;
      if (p) { pay(p, amount, "arena"); say(p, `§6+${coins(amount)}§7 for beating ${mobName(match.mob.type)} (${diffName(match.mob.difficulty)})${n ? " (less: you've won this one today already)" : ""}.`); }
    }
  } else {
    headline = `§c${mobName(match.mob.type)} wins`;
    sub = v.timeUp ? "Time ran out" : "Better luck next time";
  }
  store.save();
  for (const id of fighterIds()) { const p = online(id); if (p) p.onScreenDisplay.setTitle(headline, { subtitle: sub, fadeInDuration: 5, stayDuration: 80, fadeOutDuration: 20 }); }
  roar(dim, a, v.result === "lost" ? "groan" : "fanfare", 5);
  system.runTimeout(() => finishMatch(dim), R.endHoldSeconds * 20);
}

// Everyone home, crowd gone, gates down. quiet: called off before it began.
function finishMatch(dim = arenaDim(), quiet = false) {
  if (!match) return;
  const ids = fighterIds();
  match = undefined;
  if (dim) {
    for (const e of dim.getEntities({ tags: [MOB_TAG] })) { try { e.remove(); } catch { /* gone */ } } // this fight's, and any a restart left
    if (!quiet) emptyStands(dim);
    resetGates();
    const a = layout();
    clearLooseKit(dim, a.center, a.floorRadius + 10);
  }
  fresh.clear();
  for (const id of ids) { const p = online(id); if (p) sendHome(p); }
}

function resetGates() {
  const dim = arenaDim();
  if (!dim) return;
  layout().rooms.forEach((_, i) => closeGate(dim, i));
}

// Give a player back everything the arena changed: kit off, own things back, health, game mode, home.
// Their locker is under their room, so they're taken there first if they're elsewhere (respawned at home after
// a fall, or logged back in later); if it still can't be found it tries again, and the record stays until it has.
export function sendHome(player, tries = 0) {
  const rec = store.data.pending[player.id];
  if (!rec) return;
  try { if (player.getComponent("minecraft:health")?.currentValue <= 0) return; } catch { return; } // dead: done on respawn
  const a = layout(), dim = arenaDim();
  const room = a.rooms[rec.room] ?? a.rooms[0];
  const near = player.dimension.id === a.dim && flat(player.location, room.spawn) < 24;
  if (rec.locker && !near && dim) player.teleport(mid(room.spawn), { dimension: dim });
  system.runTimeout(() => {
    try {
      if (!player.isValid) return;
      stripKit(player);
      if (rec.locker) {
        if (dim && restore(player, dim, room.spawn)) rec.locker = false;
        else if (tries < 5) return sendHome(player, tries + 1);
        else {
          say(player, "§cYour things are still safe in the arena locker; you'll be taken back for them the next time you join.");
          store.save();
        }
      }
      player.getComponent("minecraft:health")?.resetToMaxValue();
      player.extinguishFire?.();
      player.setGameMode(rec.gm ?? GameMode.Survival);
      const o = rec.origin, od = dimOf(o.dim);
      if (od) player.teleport({ x: o.x, y: o.y, z: o.z }, { dimension: od });
      if (!rec.locker) delete store.data.pending[player.id];
      store.save();
      say(player, rec.locker ? "§7Back where you were." : "§7Back where you were, with everything you had.");
    } catch (e) {
      console.warn(`[Hollow Crown] arena: sending ${player.name} home: ${e}`);
    }
  }, near || !rec.locker ? 2 : 20 + tries * 20);
}

// ---------- mob fights ----------

const mobName = (type) => ARENA_MOBS.find((m) => m.type === type)?.name ?? type;
const diffName = (id) => DIFFICULTIES.find((d) => d.id === id)?.name ?? id;

function winsToday(id, mob = match?.mob) {
  const day = dayOf(world.getAbsoluteTime?.() ?? 0);
  if (store.data.mobDay.day !== day) store.data.mobDay = { day, wins: {} };
  return mob ? store.data.mobDay.wins[`${id}|${mob.type}|${mob.difficulty}`] ?? 0 : 0;
}
function bumpWins(id) {
  winsToday(id);
  const k = `${id}|${match.mob.type}|${match.mob.difficulty}`;
  store.data.mobDay.wins[k] = (store.data.mobDay.wins[k] ?? 0) + 1;
}

async function battleMob(host) {
  const m = await showWhenFree(host, ARENA_MOBS.reduce((form, x) => form.button(`${x.name}\n§8from ${coins(mobReward(x.type, "squire"))}`),
    new ActionFormData().title("Battle a mob").body("Which beast?")));
  if (m.canceled) return;
  const mob = ARENA_MOBS[m.selection];
  const d = await showWhenFree(host, DIFFICULTIES.reduce((form, x) => {
    const n = winsToday(host.id, { type: mob.type, difficulty: x.id });
    return form.button(`${x.name}: ${x.count === 1 ? "one" : x.count}${x.effects.length ? ", stronger" : ""}\n§8pays ${coins(mobReward(mob.type, x.id, n))}${n ? " (won today)" : ""}`);
  }, new ActionFormData().title(mob.name).body("How hard?")));
  if (d.canceled) return;
  const diff = DIFFICULTIES[d.selection];
  const others = world.getPlayers().filter((p) => p.id !== host.id).slice(0, 11);
  let friends = [];
  if (others.length) {
    const form = new ModalFormData().title("Bring friends?");
    for (const p of others) form.toggle(`Invite ${p.name}`, { defaultValue: false });
    form.submitButton("Go");
    const r = await showWhenFree(host, form);
    if (r.canceled) return;
    friends = others.filter((_, i) => r.formValues[i]);
  }
  if (match) return say(host, "§cSomeone else started a fight first.");
  newMatch(host, "mob", { mob: { type: mob.type, difficulty: diff.id } });
  const rooms = spreadRooms(friends.length + 1);
  const until = system.currentTick + R.inviteSeconds * 20;
  friends.forEach((p, i) => { match.invites[p.id] = { name: p.name, side: 0, room: rooms[i + 1], until }; });
  resetGates();
  join(host, 0, rooms[0]);
  for (const p of friends) invite(p, host, FORMATS[0], "");
  checkInvitesDone();
}

// ---------- records ----------

function records(player) {
  const rows = Object.values(store.data.records).sort((a, b) => b.wins - a.wins || b.mobWins - a.mobWins).slice(0, 10);
  const body = rows.length
    ? rows.map((r, i) => `${i + 1}. §e${r.name}§r  ${r.wins} won, ${r.losses} lost${r.draws ? `, ${r.draws} drawn` : ""}  §7(${r.mobWins} beasts)`).join("\n")
    : "No fights yet. Be the first!";
  return showWhenFree(player, new ActionFormData().title(`${Title()}: records`).body(body).button("Close"));
}

// ---------- events ----------

function isArenaBlock(block) {
  const a = layout();
  if (block.dimension.id !== a.dim) return undefined;
  const l = block.location;
  if (same(l, a.sign)) return { sign: true };
  const room = a.rooms.findIndex((r) => same(l, r.board));
  return room >= 0 ? { room } : undefined;
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  let hit;
  try { hit = isArenaBlock(e.block); } catch { return; }
  if (!hit) return;
  e.cancel = true; // no book goes on the lectern
  if (e.isFirstEvent === false) return;
  const player = e.player;
  system.run(() => {
    if (!isReady()) return;
    if (hit.sign) return mainMenu(player);
    if (match?.fighters[player.id]) return roomMenu(player);
    say(player, `§7This is the ${roomLabel(hit.room)}§7 room. Start a battle at the board in the entrance hall.`);
  });
});

addMenuLabel({
  block: "minecraft:lectern", name: "Arena", hint: "Click",
  where: (b) => !!isArenaBlock(b),
  text: (b) => (isArenaBlock(b)?.sign ? `§6${Title()}\n§7Click: start a battle` : "§6Your room\n§7Click: pick your kit, Start Battle"),
});

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  if (!match || match.phase !== "fight") return;
  try { if (entity.typeId === "minecraft:item") fresh.set(entity.id, system.currentTick); } catch { /* gone */ }
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (!match) return;
  let id, type;
  try { id = deadEntity.id; type = deadEntity.typeId; } catch { return; }
  if (type !== "minecraft:player") {
    if (match.mobs.includes(id)) roar(arenaDim(), layout(), "cheer", 3);
    return;
  }
  const f = match.fighters[id];
  if (!f || match.phase !== "fight" && match.phase !== "over") return;
  const dim = deadEntity.dimension, at = { ...deadEntity.location }, since = system.currentTick - 1;
  const lockerAt = layout().rooms[f.room].spawn;
  for (const t of [1, 10, 19]) system.runTimeout(() => { if (sweepDrops(dim, at, id, lockerAt, fresh, since).kept) markLocker(id, true); }, t); // before the gravestones (2 and 20)
  if (match.phase === "fight") {
    fallOut(id, match.kind === "mob" ? `was beaten by ${mobName(match.mob.type)}` : "has fallen");
    roar(dim, layout(), "groan", 2);
  }
});

let lastCheer = 0;
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  if (!match || match.phase !== "fight" || damage < 6) return;
  const now = system.currentTick;
  if (now - lastCheer < 80) return;
  try {
    const by = damageSource?.damagingEntity?.id;
    if (!match.fighters[by] && !match.fighters[hurtEntity.id]) return;
  } catch { return; }
  lastCheer = now;
  roar(arenaDim(), layout(), "cheer", 2);
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  system.runTimeout(() => {
    if (!isReady()) return;
    try {
      if (!store.data.pending[player.id]) return;
      const f = match?.fighters[player.id];
      if (f && match.phase !== "over") { // fell (or logged off) mid-fight: back to the room to watch
        sendToRoom(player, f.room);
        if (!f.out) fallOut(player.id, "left the game");
        return say(player, "§7You're out of this one. Watch from your room; you'll be sent back when it ends.");
      }
      sendHome(player);
    } catch (e) {
      console.warn(`[Hollow Crown] arena: ${e}`);
    }
  }, 20);
});

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  let id;
  try { id = player.id; } catch { return; }
  system.run(() => {
    const f = match?.fighters[id];
    if (!f) { if (match?.invites[id]) delete match.invites[id]; return; }
    if (match.phase === "fight") fallOut(id, "left the game");
    else if (match.phase !== "over") {
      delete match.fighters[id];
      tellAll(`§7${f.name} left the game.`);
      if (!Object.keys(match.fighters).length) finishMatch(undefined, true);
      else maybeStart();
    }
  });
});

onTick("arena", 20, () => {
  if (!isReady()) return;
  if (match) return fightTick();
});

// crowd a restart left in the stands: cleared when no fight is on
onTick("arena crowd sweep", 200, () => {
  if (!isReady() || match) return;
  const dim = arenaDim();
  let left = [];
  try { left = dim?.getEntities({ type: CROWD, location: mid(layout().center), maxDistance: 160 }) ?? []; } catch { return; }
  if (left.length) emptyStands(dim);
});

on("ready", () => {
  // a fight the restart interrupted is over: send its fighters home as they turn up
  for (const p of world.getPlayers()) if (store.data.pending[p.id]) sendHome(p);
});

// ---------- test commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (!event.id.startsWith("siege:arena")) return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const arg = event.message.trim().toLowerCase();
  try {
    if (event.id === "siege:arena") return void system.run(() => mainMenu(player));
    if (event.id === "siege:arena_test") {
      if (arg === "clear") { store.data.testCenter = null; store.save(); return say(player, "§7Back to the real arena (layout.js). The test blocks stay where they are."); }
      if (match) return say(player, "§cNot while a fight is on.");
      const l = player.location;
      store.data.testCenter = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
      store.save();
      buildTestArena(player.dimension, layout());
      return say(player, "§eA test arena is going up around you (rough blocks, not the real build). The board to start a fight is the lectern north of the ring. /scriptevent siege:arena_test clear to go back to the real one.");
    }
    if (event.id === "siege:arena_status") {
      const a = layout();
      const lines = [`§6${Title()}§r at ${a.center.x} ${a.center.y} ${a.center.z}${store.data.testCenter ? " §e(test arena)" : ""}`];
      if (!match) lines.push("No fight on.");
      else {
        lines.push(`${match.kind} fight, ${match.phase}${match.mob ? `: ${mobName(match.mob.type)} (${diffName(match.mob.difficulty)}), ${mobsLeft()} left` : ""}`);
        for (const f of Object.values(match.fighters)) lines.push(` ${roomLabel(f.room)} ${f.name}: ${f.kit === true ? "kit" : f.kit === false ? "own things" : "picking"}${f.ready ? ", ready" : ""}${f.out ? `, out (${f.why})` : ""}`);
        for (const inv of Object.values(match.invites)) lines.push(` §8invited ${inv.name}`);
      }
      lines.push(`Waiting to be sent back: ${Object.values(store.data.pending).map((p) => p.name).join(", ") || "nobody"}`);
      return say(player, lines.join("\n"));
    }
    if (event.id === "siege:arena_end") {
      if (!match) return say(player, "§7No fight on.");
      tellAll("§7The fight was stopped.");
      return finishMatch();
    }
  } catch (e) {
    console.warn(`[Hollow Crown] arena: ${e}`);
    say(player, `§cArena: ${e}`);
  }
});
