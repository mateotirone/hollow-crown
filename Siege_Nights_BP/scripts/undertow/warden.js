// Ruling the Hollow (Mateo's idea): one player owns it and its ore: the Sorcerer who wears the
// Hollow Crown. Players read "the Hollow Crown"; this code still calls that player the Warden.
//
//   Choir ore   Found only in the Hollow's cliff faces. Slow to mine (a diamond or netherite
//               pickaxe helps). Smelts into Choirsteel.
//   The ping    The moment anyone starts mining it, the Warden is told who and where, and the
//               miner is told the Hollow has noticed. The Warden has 60 seconds to Descend:
//               teleport straight to the thief, from anywhere in either world.
//   Permits     The Warden can let chosen players mine without the alarm, for a tithe: a share
//               of what they dig goes to the Warden's hoard. The price is whatever the Warden says.
//   Offline     While the Warden is away the ore yields half, so nobody strips the place overnight.
//   Hollow Step Step into the Hollow from anywhere and back out to where you left (a late Marked
//               skill; the Warden always has it through the Warden's Bell).
//
// Who becomes Warden is decided elsewhere (the Claiming). Other threads talk to this file with:
//   (normally a Sorcerer becomes Warden by putting on the Hollow Crown: see crownTick below)
//   emit("wardenClaimed", { player })     make that player the Warden (gives them the Warden's Bell)
//   emit("wardenVacated", {})             nobody rules the Hollow
//   emit("hollowStep", { player })        step in, or back out          (or import hollowStep)
// and can listen for: "oreAlarm" { miner, minerName, x, y, z }, "wardenDescended" { warden, miner },
//   "hollowEntered" { player, how }, "wardenChanged" { warden, name }.
// Testing (creative): /scriptevent hc:give_crown    /scriptevent hc:set_warden    /scriptevent hc:clear_warden    /scriptevent hc:hollow_step

import { world, system, ItemStack, GameMode, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { on, emit } from "../siege/api.js";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, TEXT } from "./layout.js";
import { isBuilt } from "./builder.js";
import { isSlipping } from "./slips.js";
import { load, save, say, runCmd } from "./data.js";
import { regentRules, regentNotices, regentPermit, regentOutcome, regentData } from "./regent.js";
import { sfx } from "../core/sfx.js";

export const WARDEN = {
  descendSeconds: 60, // how long the Warden has to teleport to a thief
  alarmQuietSeconds: 45, // one alarm per miner per this long
  offlineYield: 0, // Mateo: while the ruler is offline nothing can be stolen; ore comes only from the village store
  defaultTithe: 25, // percent of a permit-holder's ore that goes to the Warden
  stepCooldownSeconds: 20,
};

export const ORE = "siege:choir_ore";
const RAW = "siege:raw_choir_ore";
const BELL = "siege:wardens_bell";
const K = "hc:hollow_warden"; // { id, name, permits: { playerId: name }, tithe, hoard }
const P_STEP = "hc:step_origin"; // on a player: where Hollow Step took them from
const RULER_TAG = "siege_hollow_ruler"; // Hollow creatures never turn on a player with this tag (mobs thread)
const P_HERO = "siege:townhall_hero"; // the skill tree's save; skills.arc_warden > 0 = may claim the Hollow

const blank = () => ({ id: undefined, name: undefined, permits: {}, tithe: WARDEN.defaultTithe, hoard: 0 });
export const wardenData = () => ({ ...blank(), ...load(K, {}) });
export const wardenOnline = () => {
  const w = wardenData();
  return w.id ? world.getAllPlayers().find((p) => p.id === w.id) : undefined;
};
export const isWarden = (player) => wardenData().id === player.id;
export const hasPermit = (player) => !!wardenData().permits[player.id];

function resolve(p) {
  return typeof p === "string" ? world.getAllPlayers().find((x) => x.id === p || x.name === p) : p;
}

export function setWarden(playerOrId) {
  const p = resolve(playerOrId);
  if (!p) return false;
  const w = { ...blank(), id: p.id, name: p.name };
  save(K, w);
  for (const other of world.getAllPlayers()) other.removeTag(RULER_TAG);
  p.addTag(RULER_TAG);
  giveBell(p);
  world.sendMessage(`§d${p.name}§5 wears the Hollow Crown. ${cap(TEXT.name)} and its ore are theirs now.`);
  emit("wardenChanged", { warden: p.id, name: p.name });
  return true;
}
export function clearWarden() {
  save(K, blank());
  for (const other of world.getAllPlayers()) other.removeTag(RULER_TAG);
  world.sendMessage(`§5No one wears the Hollow Crown. ${cap(TEXT.name)}'s ore lies unguarded.`);
  emit("wardenChanged", { warden: undefined, name: undefined });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function giveBell(p) {
  try {
    const inv = p.getComponent("inventory").container;
    for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === BELL) return;
    const bell = new ItemStack(BELL, 1);
    bell.keepOnDeath = true;
    bell.setLore(["§7Use it to rule the Hollow."]);
    if (inv.addItem(bell)) p.dimension.spawnItem(bell, p.location);
  } catch { /* inventory not ready */ }
}

// ---- the ping -------------------------------------------------------------------------------
const lastAlarm = new Map(); // miner id -> tick
let alarm; // { miner, minerName, x, y, z, dim, until }

export function shouldAlarm(minerId, w, now, last) {
  if (!w.id || w.id === minerId || w.permits[minerId]) return false;
  return last === undefined || now - last >= WARDEN.alarmQuietSeconds * 20;
}

world.afterEvents.entityHitBlock.subscribe((e) => {
  const p = e.damagingEntity;
  if (p?.typeId !== "minecraft:player" || e.hitBlock.typeId !== ORE) return;
  const w = wardenData(), now = system.currentTick;
  if (!w.id) return void regentNotices(p, e.hitBlock.location); // no player rules: the NPC ruler, if any, is listening
  if (!shouldAlarm(p.id, w, now, lastAlarm.get(p.id))) return;
  lastAlarm.set(p.id, now);
  const b = e.hitBlock.location;
  alarm = { miner: p.id, minerName: p.name, x: b.x, y: b.y, z: b.z, dim: p.dimension.id, until: now + WARDEN.descendSeconds * 20 };
  p.onScreenDisplay.setTitle("§5The Hollow has noticed you", { subtitle: `§7${w.name} knows you are here`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  sfx(p, "block.bell.hit", { volume: 1, pitch: 0.4 });
  const warden = wardenOnline();
  if (warden) {
    warden.onScreenDisplay.setTitle("§cChoir ore is being taken", { subtitle: `§f${p.name}§7 is mining at ${b.x}, ${b.y}, ${b.z}`, fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 15 });
    sfx(warden, "block.bell.hit", { volume: 1, pitch: 0.7 });
    say(warden, `§c${p.name} is mining your Choir ore. §7Ring your bell within ${WARDEN.descendSeconds} seconds to Descend on them.`);
  }
  emit("oreAlarm", { miner: p.id, minerName: p.name, x: b.x, y: b.y, z: b.z, wardenOnline: !!warden });
});

export function descend(warden) {
  if (!alarm || alarm.until < system.currentTick) return "Nobody is at the ore right now.";
  const miner = world.getAllPlayers().find((p) => p.id === alarm.miner);
  if (!miner) return "The thief is gone.";
  const m = miner.location;
  runCmd(warden, "camera @s fade time 0.1 0.4 0.4 color 40 10 70");
  rememberOrigin(warden);
  warden.teleport({ x: m.x - miner.getViewDirection().x * 3, y: m.y, z: m.z - miner.getViewDirection().z * 3 }, { dimension: miner.dimension, facingLocation: m });
  try {
    miner.dimension.spawnEntity("minecraft:lightning_bolt", { x: m.x + 4, y: m.y, z: m.z + 4 });
    sfx(miner, "mob.wither.spawn", { volume: 0.6, pitch: 1.4 });
    miner.onScreenDisplay.setTitle("§cThe Hollow Crown is here", { fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
  } catch { /* cosmetic */ }
  emit("wardenDescended", { warden: warden.id, miner: miner.id });
  alarm = undefined;
  return undefined;
}

// ---- mining the ore --------------------------------------------------------------------------
// what the miner gets from one ore: "ore", "tithe" (it goes to the Warden's hoard) or "nothing"
export function oreOutcome(w, minerId, wardenIsOnline, roll) {
  if (!w.id || w.id === minerId) return "ore";
  if (w.permits[minerId]) return roll * 100 < w.tithe ? "tithe" : "ore";
  if (!wardenIsOnline && roll >= WARDEN.offlineYield) return "nothing";
  return "ore";
}

world.afterEvents.playerBreakBlock.subscribe((e) => {
  if (e.brokenBlockPermutation.type.id !== ORE) return;
  const p = e.player;
  if (p.getGameMode() === GameMode.Creative) return;
  const tool = p.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId ?? "";
  const at = { x: e.block.location.x + 0.5, y: e.block.location.y + 0.5, z: e.block.location.z + 0.5 };
  if (!/(diamond|netherite)_pickaxe$/.test(tool)) {
    say(p, "§7The ore crumbles to dust. It takes a diamond or netherite pickaxe to free it whole.");
    return;
  }
  const w = wardenData();
  const outcome = !w.id && regentRules()
    ? regentOutcome(regentPermit(p.id), regentData().temper, Math.random())
    : oreOutcome(w, p.id, !!wardenOnline(), Math.random());
  if (outcome === "ore") {
    e.dimension.spawnItem(new ItemStack(RAW, 1), at);
  } else if (outcome === "tithe") {
    w.hoard++;
    save(K, w);
    p.onScreenDisplay.setActionBar("§dThe Crown's tithe takes this one.");
  } else {
    p.onScreenDisplay.setActionBar("§7The vein gives nothing. The Hollow guards it while its Crown sleeps.");
  }
});

// ---- Hollow Step -----------------------------------------------------------------------------
const stepAt = new Map();
function rememberOrigin(p) {
  if (p.dimension.id === UNDERTOW_ID) return;
  const l = p.location;
  p.setDynamicProperty(P_STEP, JSON.stringify({ x: l.x, y: l.y, z: l.z, dim: p.dimension.id }));
}

// Step into the Hollow (to the Wound's ledge) or, if already there, back to where you stepped from.
// Returns undefined on success or a reason it can't be done. The skill's own rules (who has it) are the caller's.
export function hollowStep(playerOrId, { ignoreCooldown = false } = {}) {
  const p = resolve(playerOrId);
  if (!p) return "no such player";
  if (isSlipping(p)) return "The Hollow already has hold of you.";
  const now = system.currentTick, last = stepAt.get(p.id);
  if (!ignoreCooldown && last !== undefined && now - last < WARDEN.stepCooldownSeconds * 20) return `You can step again in ${Math.ceil((WARDEN.stepCooldownSeconds * 20 - (now - last)) / 20)} seconds.`;
  if (p.dimension.id === UNDERTOW_ID) {
    let o;
    try { o = JSON.parse(p.getDynamicProperty(P_STEP)); } catch { /* none */ }
    if (!o) return "You did not step in, so there is nowhere to step back to. Leave by the Rift.";
    runCmd(p, "camera @s fade time 0.1 0.4 0.5 color 40 10 70");
    p.teleport({ x: o.x, y: o.y, z: o.z }, { dimension: world.getDimension(o.dim) });
    p.setDynamicProperty(P_STEP, undefined);
    runCmd(p, `fog @s remove hc_undertow`);
    p.removeTag("siege_undertow_in");
  } else {
    if (!isBuilt(0, 0) || !isBuilt(-1, 0)) return "The Hollow is not ready yet.";
    rememberOrigin(p);
    runCmd(p, "camera @s fade time 0.1 0.4 0.5 color 40 10 70");
    p.addEffect("resistance", 60, { amplifier: 4, showParticles: false });
    p.teleport({ x: 6.5, y: L.woundLedgeY + 1, z: 2.5 }, { dimension: world.getDimension(UNDERTOW_ID), facingLocation: { x: 0, y: 90, z: 80 } });
    noteEntry(p, "step");
  }
  stepAt.set(p.id, now);
  sfx(p, "mob.endermen.portal", { volume: 0.7, pitch: 0.5 });
  return undefined;
}

// The Warden senses everyone who enters.
export function noteEntry(player, how) {
  emit("hollowEntered", { player: player.id, how });
  const warden = wardenOnline();
  if (warden && warden.id !== player.id) say(warden, `§5You feel §d${player.name}§5 enter ${TEXT.name}.`);
}

// ---- the Warden's Bell ---------------------------------------------------------------------
world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack.typeId !== BELL) return;
  const p = e.source;
  if (!isWarden(p)) return say(p, "§7The bell makes no sound for you.");
  bellMenu(p);
});

function bellMenu(p) {
  const w = wardenData();
  const live = alarm && alarm.until >= system.currentTick;
  const inside = p.dimension.id === UNDERTOW_ID;
  const form = new ActionFormData().title("The Hollow Crown")
    .body(`Tithe: ${w.tithe}% of permitted mining\nHoard waiting: ${w.hoard} raw Choir ore\nPermits: ${Object.values(w.permits).join(", ") || "none"}` + (live ? `\n\n§c${alarm.minerName} is at your ore!` : ""));
  const actions = [];
  const add = (label, fn) => { form.button(label); actions.push(fn); };
  if (live) add(`§cDescend on ${alarm.minerName}`, () => { const why = descend(p); if (why) say(p, `§7${why}`); });
  add(inside ? "Step out of the Hollow" : "Step into the Hollow", () => { const why = hollowStep(p, { ignoreCooldown: true }); if (why) say(p, `§7${why}`); });
  if (w.hoard > 0) add(`Collect the hoard (${w.hoard})`, () => collect(p));
  add("Grant or revoke a permit", () => permitMenu(p));
  add("Set the tithe", () => titheMenu(p));
  form.show(p).then((r) => { if (!r.canceled && r.selection !== undefined) actions[r.selection]?.(); });
}

function collect(p) {
  const w = wardenData();
  let n = w.hoard;
  w.hoard = 0;
  save(K, w);
  while (n > 0) {
    const take = Math.min(64, n);
    p.dimension.spawnItem(new ItemStack(RAW, take), p.location);
    n -= take;
  }
}

function permitMenu(p) {
  const w = wardenData();
  const others = world.getAllPlayers().filter((x) => x.id !== p.id);
  const rows = [...others.map((x) => ({ id: x.id, name: x.name })), ...Object.entries(w.permits).filter(([id]) => !others.some((x) => x.id === id)).map(([id, name]) => ({ id, name }))];
  if (!rows.length) return say(p, "§7Nobody else is here to grant a permit to.");
  const form = new ActionFormData().title("Mining permits").body("Permit holders mine without the alarm and pay your tithe.");
  for (const r of rows) form.button(`${r.name}\n${w.permits[r.id] ? "§2permitted (tap to revoke)" : "§8no permit (tap to grant)"}`);
  form.show(p).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const row = rows[r.selection], now = wardenData();
    if (now.permits[row.id]) delete now.permits[row.id];
    else now.permits[row.id] = row.name;
    save(K, now);
    const them = world.getAllPlayers().find((x) => x.id === row.id);
    if (them) say(them, now.permits[row.id] ? `§dThe Hollow Crown permits you to mine Choir ore, for a tithe of ${now.tithe}%.` : "§cThe Hollow Crown has revoked your mining permit.");
    say(p, now.permits[row.id] ? `§d${row.name} may mine.` : `§7${row.name}'s permit is revoked.`);
  });
}

function titheMenu(p) {
  const w = wardenData();
  new ModalFormData().title("The tithe").slider("Your share of permitted mining (%)", 0, 100, { valueStep: 5, defaultValue: w.tithe }).show(p).then((r) => {
    if (r.canceled) return;
    const now = wardenData();
    now.tithe = Math.round(r.formValues[0]);
    save(K, now);
    world.sendMessage(`§5The Hollow Crown sets the tithe at §d${now.tithe}%§5.`);
  });
}

// Keep the ruler tag honest when people join (the title may have changed while they were away).
world.afterEvents.playerSpawn.subscribe((e) => {
  if (!e.initialSpawn) return;
  try {
    if (isWarden(e.player)) { e.player.addTag(RULER_TAG); giveBell(e.player); }
    else e.player.removeTag(RULER_TAG);
  } catch { /* not ready */ }
});

// The Hollow Crown (Mateo, 2026-11-10): it is the crown of the Hollow's ruler, and it is left behind
// when the Hollow Choir falls. Only a Sorcerer (the top of the magic path) can wear it: putting it
// on makes them the Warden. Anyone else who puts it on is warned, and then it kills them. Ruling is
// optional: the crown can sit in its chest forever. The title passes to the next Sorcerer who wears
// it, so the way to unseat a Warden is to take the crown off them.
export const CROWN = "siege:hollow_crown";
const CROWN_GRACE = 5; // seconds a non-Sorcerer has to take it off

export function mayClaim(player) {
  try {
    const hero = JSON.parse(player.getDynamicProperty(P_HERO) ?? "{}");
    return hero.rank === "Sorcerer" || (hero.skills?.arc_warden ?? 0) > 0;
  } catch {
    return false;
  }
}

// What wearing the crown does to this wearer right now. `worn` = seconds they have had it on.
export function crownVerdict(isSorcerer, isCurrentWarden, worn) {
  if (isSorcerer) return isCurrentWarden ? "rules" : "claims";
  return worn >= CROWN_GRACE ? "dies" : "warned";
}

// Taking the Crown (Mateo, 2026-11-10): only one person can hold it. It can sit in its chest for as
// long as everyone agrees to leave it. The moment anyone puts it on, EVERYONE is told
// ("X is trying to take the Hollow Crown"), and the taking is slow: a Sorcerer must keep it on for
// CLAIM_SECONDS. Any player who hits them in that time knocks the Crown off their head onto the
// ground, where anyone can grab it. So a group either agrees on one person, or it becomes a fight.
export const CLAIM_SECONDS = 30;
const wornFor = new Map(); // player id -> seconds wearing it without the right
const claiming = new Map(); // player id -> seconds into taking the Crown
export const isClaiming = (player) => claiming.has(player.id);

function announceAttempt(p) {
  const l = p.location;
  const where = p.dimension.id === UNDERTOW_ID ? `in ${TEXT.name}` : `at ${Math.floor(l.x)}, ${Math.floor(l.y)}, ${Math.floor(l.z)}`;
  world.sendMessage(`§5§l${p.name} is trying to take the Hollow Crown§r§5, ${where}.`);
  for (const other of world.getAllPlayers()) {
    try {
      sfx(other, "block.bell.hit", { volume: 1, pitch: 0.5 });
      if (other.id !== p.id) other.onScreenDisplay.setTitle("§5The Hollow Crown", { subtitle: `§d${p.name}§7 is trying to take it`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
    } catch { /* gone */ }
  }
  emit("crownAttempt", { player: p.id, name: p.name });
}

function knockOff(p, by) {
  try {
    const eq = p.getComponent("equippable");
    if (eq.getEquipment(EquipmentSlot.Head)?.typeId !== CROWN) return;
    eq.setEquipment(EquipmentSlot.Head, undefined);
    const item = p.dimension.spawnItem(new ItemStack(CROWN, 1), { x: p.location.x, y: p.location.y + 1.6, z: p.location.z });
    try { item.applyImpulse({ x: (Math.random() - 0.5) * 0.4, y: 0.35, z: (Math.random() - 0.5) * 0.4 }); } catch { /* fine */ }
    sfx(p.dimension, "random.anvil_land", p.location, { volume: 1, pitch: 1.4 });
  } catch { /* gone */ }
  claiming.delete(p.id);
  wornFor.delete(p.id);
  world.sendMessage(`§5The Hollow Crown is knocked from §d${p.name}§5's head${by ? ` by §d${by.name}§5` : ""}. It lies where it fell.`);
  emit("crownKnockedOff", { player: p.id, by: by?.id });
}

world.afterEvents.entityHurt.subscribe((e) => {
  const p = e.hurtEntity;
  if (p.typeId !== "minecraft:player" || !claiming.has(p.id)) return;
  const by = e.damageSource.damagingEntity;
  if (by?.typeId === "minecraft:player" && by.id !== p.id) knockOff(p, by);
});

export function crownTick() {
  for (const p of world.getAllPlayers()) {
    let head;
    try { head = p.getComponent("equippable")?.getEquipment(EquipmentSlot.Head)?.typeId; } catch { continue; }
    if (head !== CROWN || p.getGameMode() === GameMode.Creative) { wornFor.delete(p.id); claiming.delete(p.id); continue; }
    const worn = wornFor.get(p.id) ?? 0;
    const verdict = crownVerdict(mayClaim(p), isWarden(p), worn);
    if (verdict === "rules") continue;
    if (worn === 0 && !claiming.has(p.id)) announceAttempt(p); // everyone hears about it, whoever they are
    if (verdict === "claims") {
      // While an NPC wears the Crown's power, it will not answer to anyone else: overthrow them first.
      if (regentRules()) { wornFor.set(p.id, 1); p.onScreenDisplay.setActionBar(`§5The Crown is cold on your head. ${regentData().name} still rules below.`); continue; }
      const t = (claiming.get(p.id) ?? 0) + 1;
      if (t >= CLAIM_SECONDS) { claiming.delete(p.id); setWarden(p); continue; }
      claiming.set(p.id, t);
      p.onScreenDisplay.setActionBar(`§dThe Crown is taking hold: ${CLAIM_SECONDS - t}  §7(a blow from another player will knock it off)`);
      try {
        for (let h = 0; h < 4; h++) p.dimension.spawnParticle("minecraft:totem_particle", { x: p.location.x, y: p.location.y + 2 + h, z: p.location.z });
        if (t % 5 === 0) sfx(p.dimension, "block.bell.hit", p.location, { volume: 2, pitch: 0.5 + t / 60 });
      } catch { /* not loaded */ }
    } else if (verdict === "warned") {
      wornFor.set(p.id, worn + 1);
      p.onScreenDisplay.setTitle("§4The Crown is not yours", { subtitle: `§cTake it off. ${CROWN_GRACE - worn}`, fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 5 });
      sfx(p, "block.bell.hit", { volume: 1, pitch: 0.3 + worn * 0.1 });
      p.addEffect("wither", 30, { amplifier: 0, showParticles: false });
    } else if (verdict === "dies") {
      wornFor.delete(p.id);
      world.sendMessage(`§4${p.name} put on the Hollow Crown without the power to bear it.`);
      try {
        // The crown falls where they stood, whatever the world's keep-inventory rule says.
        p.getComponent("equippable").setEquipment(EquipmentSlot.Head, undefined);
        p.dimension.spawnItem(new ItemStack(CROWN, 1), p.location);
        p.kill();
      } catch { /* gone */ }
    }
  }
}

on("hollowClaimReady", (d) => {
  const p = resolve(d.player);
  if (p && !wardenData().id) say(p, "§5You can hear it now: a crown with no one under it, somewhere below. It would not kill you.");
});

// ---- hooks ------------------------------------------------------------------------------------
on("wardenClaimed", (d) => setWarden(d.player));

// A village store or the Vault is being robbed (the hollowfolk code sends this, and only while the
// ruler is online). The ruler is told and carried there at once to defend it.
on("hollowRobbery", (req) => {
  const ruler = wardenOnline();
  if (!ruler || ruler.id === req.robber) return;
  const where = req.place === "vault" ? "your Vault" : `the village of ${req.villageName ?? req.village}`;
  ruler.onScreenDisplay.setTitle("§cYou are being robbed", { subtitle: `§f${req.robberName}§7 is in ${where}`, fadeInDuration: 0, stayDuration: 60, fadeOutDuration: 15 });
  say(ruler, `§c${req.robberName} is robbing ${where}. §7The Hollow carries you there.`);
  try {
    runCmd(ruler, "camera @s fade time 0.1 0.4 0.4 color 40 10 70");
    if (ruler.dimension.id !== UNDERTOW_ID) rememberOrigin(ruler);
    ruler.teleport({ x: req.x + 2.5, y: req.y, z: req.z + 2.5 }, { dimension: world.getDimension(UNDERTOW_ID), facingLocation: { x: req.x, y: req.y, z: req.z } });
    const robber = world.getAllPlayers().find((p) => p.id === req.robber);
    robber?.onScreenDisplay.setTitle("§cThe Hollow Crown is here", { fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
    sfx(robber, "mob.wither.spawn", { volume: 0.6, pitch: 1.4 });
  } catch { return; } // could not move them: leave it unhandled so the sender can try
  req.handled = true;
  emit("wardenDescended", { warden: ruler.id, miner: req.robber, robbery: req.place });
});
on("wardenVacated", () => clearWarden());
// The skill tree thread casts Hollow Step with a request object and reads the answer straight back:
// we set request.handled = true, or request.refused = "why" (then it charges nothing).
on("hollowStep", (request) => {
  const why = hollowStep(request.player, { ignoreCooldown: true }); // the skill has its own cooldown
  if (why) request.refused = why;
  else request.handled = true;
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  if (e.id === "hc:hollow_step") { const why = hollowStep(p, { ignoreCooldown: true }); if (why) say(p, `§7${why}`); }
  if (p.getGameMode() !== GameMode.Creative) return;
  if (e.id === "hc:set_warden") setWarden(e.message.trim() || p);
  if (e.id === "hc:clear_warden") clearWarden();
  if (e.id === "hc:give_crown") p.dimension.spawnItem(new ItemStack(CROWN, 1), p.location);
});
