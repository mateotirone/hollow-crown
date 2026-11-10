// The NPC ruler of the Hollow (Mateo, 2026-11-10): the game must be fully playable alone and
// forever, so when no PLAYER wears the Hollow Crown, someone else does. To get Choir ore you
// deal with them, exactly as you would with a player ruler: pay their price, work for them,
// steal and be punished, or overthrow them.
//
//   When     Two in-game days after the Hollow's lord falls, if no player rules. If the Regent is
//            killed and still no player takes the Crown, another rises a week later. Forever.
//   Where    They stand at the centre of the Choir's Heart. Talk to them there.
//   Temper   Each Regent has a temperament (TEMPERS) that sets the permit price and the tithe.
//   Permits  Buy one with emeralds, or earn one with a job (bring what they ask for). A permit
//            lasts a few days: no alarm, you keep what the tithe leaves you.
//   Thieves  Mine without a permit and the Regent notices: a warning, then the Hollow strikes
//            you if you keep at it. ("oreAlarm" with regent: true also lets the mobs thread send guardians.)
//   Overthrow  Strike the Regent and they stop talking and fight: a top-tier Rival Sorcerer from the
//            mobs thread's champions (bolts, marked ground, blinks, potions), with Hollow guardians.
//            Kill them to end their rule. Walk away and they return to their seat, fully healed.
//            While one lives, the Hollow Crown will not answer to a player.
//
// The lore thread owns the Regent's name and words: call setRegentVoice({ names, lines }) to replace VOICE.
// In code a player ruler is the "Warden" (warden.js) and the NPC is the "Regent"; players read "the Hollow Crown".
// Testing (creative): /scriptevent hc:regent_now [greedy|fair|zealot]     /scriptevent hc:regent_clear

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick } from "../core/loop.js";
import { emit, countItem, takeItems } from "../siege/api.js";
import { UNDERTOW_ID, HEART, TEXT } from "./layout.js";
import { load, save, say } from "./data.js";
import { spawnChampion } from "../bestiary/champions.js";

export const REGENT = {
  riseAfterDays: 2, // days after the Hollow's lord falls with no player ruler
  returnAfterDays: 7, // days after a Regent is killed before the next one
  permitDays: 3,
  strikeAfterSeconds: 10, // a thief who is still at the ore this long after the warning is struck
  strikeDamage: 8,
};

export const TEMPERS = {
  greedy: { title: "the Grasping", price: 48, tithe: 50, sells: true },
  fair: { title: "the Even-Handed", price: 16, tithe: 25, sells: true },
  zealot: { title: "the Devout", price: 0, tithe: 10, sells: false }, // will not sell: work for it
};

// What a Regent may ask for in return for a permit: [item, amount, how they ask]
export const JOBS = [
  ["minecraft:amethyst_shard", 16, "Bring me sixteen shards of amethyst. They hold a note the way nothing else does."],
  ["minecraft:echo_shard", 2, "Two echo shards. I want to hear what the deep remembers."],
  ["minecraft:diamond", 6, "Six diamonds. The surface has so little that is worth keeping."],
  ["minecraft:bell", 2, "Two bells from your villages. We are short of voices down here."],
  ["minecraft:goat_horn", 1, "A horn that has been sounded in the open air. I have forgotten what that is like."],
];

let VOICE = {
  names: ["Maren", "Ysolde", "Corvin", "Aldreth", "Brannoch", "Sefa"],
  lines: {
    greet: { greedy: "Everything here has a price. Yours is higher than most.", fair: "You may take from the Hollow what you pay for. No more.", zealot: "The ore is not for sale. It is sung for. What will you give the song?" },
    permitSold: "Then mine, and be quick about it. The Hollow keeps count.",
    jobDone: "It will do. Mine while my patience lasts.",
    noCoin: "Come back when you can pay.",
    thief: "Thief. I can hear every swing.",
    dying: "It will find another head. It always does.",
  },
};
export function setRegentVoice(voice) {
  VOICE = { names: voice.names ?? VOICE.names, lines: { ...VOICE.lines, ...(voice.lines ?? {}) } };
}

const ENTITY = "siege:hollow_regent";
const K = "hc:hollow_regent"; // { active, name, temper, since, fellOn, permits: { playerId: expiryDay }, job }
const K_PROGRESS = "hc:undertow_progress";
const K_WARDEN = "hc:hollow_warden";
const blank = () => ({ active: false, name: undefined, temper: "fair", since: undefined, fellOn: undefined, permits: {}, job: 0 });
export const regentData = () => ({ ...blank(), ...load(K, {}) });
export const regentRules = () => regentData().active;
export const regentPermit = (playerId, day = today()) => (regentData().permits[playerId] ?? -1) >= day;
const today = () => { try { return world.getDay(); } catch { return 0; } };

// Should a Regent rise today? Pure, so it can be tested.
export function shouldRise({ choirDead, choirFellOn, playerRules, regent, day }) {
  if (!choirDead || playerRules || regent.active) return false;
  if (regent.fellOn !== undefined) return day - regent.fellOn >= REGENT.returnAfterDays;
  return day - (choirFellOn ?? day) >= REGENT.riseAfterDays;
}

export function raiseRegent(temper) {
  const r = { ...blank(), ...regentData(), active: true, permits: {} };
  r.temper = TEMPERS[temper] ? temper : Object.keys(TEMPERS)[Math.floor(Math.random() * 3)];
  r.name = VOICE.names[Math.floor(Math.random() * VOICE.names.length)];
  r.job = Math.floor(Math.random() * JOBS.length);
  r.since = today();
  save(K, r);
  world.sendMessage(`§5Word comes up through the Rift: someone has put on the Hollow Crown. §d${r.name} ${TEMPERS[r.temper].title}§5 rules ${TEXT.name} now.`);
  emit("regentChanged", { active: true, name: r.name, temper: r.temper });
  return r;
}

function endRegent(killed) {
  const r = regentData();
  r.active = false;
  r.fellOn = killed ? today() : undefined;
  r.permits = {};
  save(K, r);
  try {
    const d = world.getDimension(UNDERTOW_ID);
    for (const e of [...d.getEntities({ type: ENTITY }), ...d.getEntities({ tags: ["siege_hollow_regent_body"] })]) e.remove();
  } catch { /* not loaded */ }
  emit("regentChanged", { active: false, name: r.name, temper: r.temper, killed });
}

const seat = () => ({ x: HEART.center.x + 0.5, y: HEART.center.y, z: HEART.center.z + 3.5 });

onTick("undertow:regent", 100, () => {
  const prog = load(K_PROGRESS, {}), r = regentData(), day = today();
  const playerRules = !!load(K_WARDEN, {}).id;
  if (prog.morvane && prog.morvaneFellOn === undefined) { prog.morvaneFellOn = day; save(K_PROGRESS, prog); }
  if (!prog.morvane && prog.morvaneFellOn !== undefined) { delete prog.morvaneFellOn; save(K_PROGRESS, prog); }
  if (r.active && (playerRules || !prog.morvane)) return endRegent(false); // a player took the Crown, or the Hollow's lord is back
  if (shouldRise({ choirDead: !!prog.morvane, choirFellOn: prog.morvaneFellOn, playerRules, regent: r, day })) raiseRegent();
  if (!regentData().active) return;
  // Keep the Regent standing in the Heart whenever someone is near enough to see them.
  try {
    const d = world.getDimension(UNDERTOW_ID), at = seat();
    if (!d.getPlayers({ location: at, maxDistance: 56 }).length) return;
    if (d.getEntities({ type: ENTITY, location: at, maxDistance: 80 }).length) return;
    if (d.getEntities({ tags: ["siege_hollow_regent_body"] }).length) return; // they are busy fighting
    const e = d.spawnEntity(ENTITY, at);
    e.nameTag = `§d${regentData().name} ${TEMPERS[regentData().temper].title}`;
  } catch { /* not loaded yet */ }
});

// ---- talking to the Regent -------------------------------------------------------------------
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== ENTITY) return;
  e.cancel = true;
  const p = e.player;
  system.run(() => audience(p));
});

function audience(p) {
  const r = regentData(), t = TEMPERS[r.temper], day = today();
  if (!r.active) return;
  const job = JOBS[r.job % JOBS.length];
  const held = regentPermit(p.id, day);
  const form = new ActionFormData().title(`${r.name} ${t.title}`)
    .body(`"${VOICE.lines.greet[r.temper]}"\n\nPermit: ${t.sells ? `${t.price} emeralds` : "not for sale"} for ${REGENT.permitDays} days\nTithe: ${t.tithe}% of what you dig\n` + (held ? `\n§2You hold a permit until day ${r.permits[p.id]}.` : "\n§7You hold no permit."));
  const acts = [];
  if (t.sells) { form.button(`Buy a permit\n${t.price} emeralds`); acts.push(() => buy(p)); }
  form.button(`Earn a permit\n${job[1]} × ${job[0].replace("minecraft:", "").replace(/_/g, " ")}`); acts.push(() => work(p));
  form.button("Leave"); acts.push(() => {});
  form.show(p).then((res) => { if (!res.canceled && res.selection !== undefined) acts[res.selection](); });
}

function grant(p) {
  const r = regentData();
  r.permits[p.id] = Math.max(r.permits[p.id] ?? 0, today()) + REGENT.permitDays;
  save(K, r);
  emit("regentPermit", { player: p.id, until: r.permits[p.id] });
}
function buy(p) {
  const r = regentData(), t = TEMPERS[r.temper];
  if (!takeItems(p, "minecraft:emerald", t.price)) return say(p, `§d${r.name}: §f"${VOICE.lines.noCoin}"`);
  grant(p);
  say(p, `§d${r.name}: §f"${VOICE.lines.permitSold}"`);
}
function work(p) {
  const r = regentData(), job = JOBS[r.job % JOBS.length];
  if (countItem(p, job[0]) < job[1] && p.getGameMode() !== GameMode.Creative) return say(p, `§d${r.name}: §f"${job[2]}"`);
  takeItems(p, job[0], job[1]);
  grant(p);
  r.job = (r.job + 1 + Math.floor(Math.random() * (JOBS.length - 1))) % JOBS.length; // a different ask next time
  save(K, { ...regentData(), job: r.job });
  say(p, `§d${r.name}: §f"${VOICE.lines.jobDone}"`);
}

// ---- thieves -----------------------------------------------------------------------------------
const warned = new Map(); // player id -> tick warned
// Called by warden.js when someone hits Choir ore and no player rules. Returns true if it raised an alarm.
export function regentNotices(p, block) {
  const r = regentData();
  if (!r.active || regentPermit(p.id) || p.getGameMode() === GameMode.Creative) return false;
  const now = system.currentTick, last = warned.get(p.id);
  if (last !== undefined && now - last < 900) return false;
  warned.set(p.id, now);
  p.onScreenDisplay.setTitle("§5The Hollow has noticed you", { subtitle: `§7${r.name}: "${VOICE.lines.thief}"`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  p.playSound("block.bell.hit", { volume: 1, pitch: 0.4 });
  emit("oreAlarm", { miner: p.id, minerName: p.name, x: block.x, y: block.y, z: block.z, wardenOnline: false, regent: true });
  system.runTimeout(() => {
    try {
      const l = p.location;
      if (p.dimension.id !== UNDERTOW_ID || regentPermit(p.id) || !regentData().active) return;
      if (Math.hypot(l.x - block.x, l.y - block.y, l.z - block.z) > 10) return; // they backed off
      p.dimension.spawnEntity("minecraft:lightning_bolt", l);
      p.applyDamage(REGENT.strikeDamage, { cause: "magic" });
      p.addEffect("slowness", 100, { amplifier: 1 });
      say(p, `§d${r.name}: §f"I did warn you."`);
    } catch { /* gone */ }
  }, REGENT.strikeAfterSeconds * 20);
  return true;
}

// What one ore gives a miner while a Regent rules: "ore" or "tithe" (lost to the Regent)
export function regentOutcome(hasPermit, temper, roll) {
  return hasPermit && roll * 100 < TEMPERS[temper].tithe ? "tithe" : "ore";
}

// ---- overthrowing them ----------------------------------------------------------------------
const BODY_TAG = "siege_hollow_regent_body";
const fighter = () => {
  try { return world.getDimension(UNDERTOW_ID).getEntities({ tags: [BODY_TAG] })[0]; } catch { return undefined; }
};

// The first blow ends the audience: the seated Regent is replaced by a fighter who plays like a player.
world.afterEvents.entityHurt.subscribe((e) => {
  if (e.hurtEntity.typeId !== ENTITY) return;
  const by = e.damageSource.damagingEntity;
  if (by?.typeId !== "minecraft:player") return;
  const r = regentData(), seatAt = e.hurtEntity.location, dim = e.hurtEntity.dimension;
  if (!r.active || fighter()) return;
  system.run(() => {
    try {
      const body = spawnChampion(dim, seatAt, { role: "sorcerer", tier: 5, name: `§d${r.name} ${TEMPERS[r.temper].title}`, stance: "hostile", tags: [BODY_TAG] });
      if (!body) return;
      e.hurtEntity.remove();
      dim.spawnParticle("minecraft:sonic_explosion", seatAt);
      for (const p of dim.getPlayers({ location: seatAt, maxDistance: 40 })) {
        p.onScreenDisplay.setTitle(`§5${r.name} rises`, { subtitle: "§7The audience is over", fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
        p.playSound("mob.wither.spawn", { volume: 0.6, pitch: 0.7 });
      }
    } catch { /* champions not available: the seated Regent simply stays killable */ }
    emit("regentAttacked", { player: by.id, x: seatAt.x, y: seatAt.y, z: seatAt.z });
  });
});

// If everyone leaves the fight, the Regent sits back down (the seat tick then respawns them, healed).
onTick("undertow:regent_fight", 100, () => {
  const body = fighter();
  if (!body) return;
  try {
    if (!regentData().active) return void body.remove();
    if (body.dimension.getPlayers({ location: body.location, maxDistance: 48 }).length) { body.setDynamicProperty("hc:alone", 0); return; }
    const alone = (body.getDynamicProperty("hc:alone") ?? 0) + 1;
    if (alone >= 6) body.remove(); // 30 seconds with nobody near
    else body.setDynamicProperty("hc:alone", alone);
  } catch { /* unloaded */ }
});

function overthrown(byId, byName) {
  const r = regentData();
  if (!r.active) return;
  world.sendMessage(`§5${r.name} ${TEMPERS[r.temper].title} is dead${byName ? `, by ${byName}'s hand` : ""}. §7"${VOICE.lines.dying}"`);
  endRegent(true);
  emit("regentOverthrown", { by: byId, name: r.name });
}

// The fighter's death comes from the champions code as a script event; the seated body can also be killed outright.
system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:champion_defeated") return;
  let d;
  try { d = JSON.parse(e.message); } catch { return; }
  if (!d.tags?.includes(BODY_TAG)) return;
  const killer = world.getAllPlayers().find((p) => d.players?.includes(p.id));
  overthrown(killer?.id, killer?.name);
});
world.afterEvents.entityDie.subscribe((e) => {
  if (e.deadEntity.typeId !== ENTITY) return;
  const by = e.damageSource.damagingEntity;
  system.run(() => overthrown(by?.typeId === "minecraft:player" ? by.id : undefined, by?.typeId === "minecraft:player" ? by.name : undefined));
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player" || p.getGameMode() !== GameMode.Creative) return;
  if (e.id === "hc:regent_now") {
    const prog = load(K_PROGRESS, {});
    if (!prog.morvane) { prog.morvane = true; save(K_PROGRESS, prog); say(p, "§7(Marked the Hollow's lord as fallen so a Regent can rule.)"); }
    raiseRegent(e.message.trim());
  }
  if (e.id === "hc:regent_clear") endRegent(false);
});

