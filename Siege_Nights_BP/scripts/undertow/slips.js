// Slips: long before anyone finds the Rift, the Hollow finds them (Mateo's idea, after Will's
// flashes into the Upside Down).
//
// The Hollow is NOT a mirror of our world (Mateo, 2026-11-10): it is a separate world seeping into
// ours. So a Slip never shows a copy of the room you were in. It drops you somewhere real in the
// Hollow, and then you are back.
//
//   Slip     The sound cuts out, the screen snaps dark, and you are standing on a ledge in the
//            Hollow, looking out over the valley: purple fog, lightning, no sky. A few seconds
//            later you are back exactly where you were. Where the heck was that?
//   Flicker  The cheap version, with no teleport: Hollow fog, sound and shapes for 2 to 5 seconds.
//
// The lore thread decides WHEN these happen. It calls us through core/events.js:
//   emit("slip", { player, id, npc?, returnTo?, seconds?, item? })   -> we answer "slipStarted" or "slipRefused", later "slipEnded"
//   emit("flicker", { player, seconds? })
// or imports startSlip() / flicker() directly. Testing: /scriptevent hc:slip [seconds]   /scriptevent hc:flicker [seconds]
//
// Slips never start during a siege or a boss fight, and grow longer each time (SLIPS below).

import { world, system, ItemStack } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { on, emit, isReady, getState } from "../siege/api.js";
import { activeFights } from "../bestiary/bossCore.js";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L } from "./layout.js";
import { arrivalReady } from "./builder.js";
import { runCmd, say } from "./data.js";
import { sfx } from "../core/sfx.js";

export const SLIPS = {
  firstSeconds: 10,
  growBy: 4, // each Slip a player has had makes the next one this much longer
  maxSeconds: 30,
  leash: 10, // wander further than this from where you landed and the Slip ends early
};

const FOG_ID = "siege:undertow_fog";
const FLICKER_FOG = "siege:hollow_flicker_fog";
const FOG_LAYER = "hc_slip";
const P_ORIGIN = "hc:slip_origin"; // on the player while slipping: where to put them back
const P_COUNT = "hc:slips"; // on the player: how many Slips they have had

const active = new Map(); // player id -> slip
export const isSlipping = (player) => active.has(player.id);
const flickering = new Set();
export const isFlickering = (player) => flickering.has(player.id);

// Where a Slip lands: on the Wound's ledge (always loaded and built), a little apart from the
// arrival point and facing out over the valley, away from the return crack.
export function slipLanding(n = Math.random()) {
  const side = n < 0.5 ? -1 : 1;
  return { x: side * (4 + Math.floor(n * 97) % 7) + 0.5, y: L.woundLedgeY + 1, z: 4.5 + (Math.floor(n * 53) % 4) };
}

export function slipSeconds(count) {
  return Math.min(SLIPS.maxSeconds, SLIPS.firstSeconds + SLIPS.growBy * count);
}

function resolvePlayer(p) {
  if (typeof p === "string") return world.getAllPlayers().find((x) => x.id === p || x.name === p);
  return p;
}

export function canSlip(player) {
  try {
    if (!player?.isValid) return "the player is gone";
    if (active.has(player.id)) return "already slipping";
    if (player.dimension.id === UNDERTOW_ID) return "already in the Hollow";
    if (isReady() && getState().active) return "a siege is on";
    for (const f of activeFights()) if (f.players(16).some((p) => p.id === player.id)) return "in a boss fight";
    if (player.getComponent("riding")?.entityRidingOn) return "riding";
    if (player.isSleeping) return "asleep";
  } catch {
    return "not ready";
  }
  return undefined;
}

// Start a Slip. Returns true if it started. opts: { id, seconds, returnTo, item }
export function startSlip(playerOrId, opts = {}) {
  const player = resolvePlayer(playerOrId);
  const id = opts.id ?? "slip";
  const why = canSlip(player) ?? (arrivalReady() ? undefined : "the Hollow is not ready yet");
  if (why) {
    emit("slipRefused", { player: player?.id, id, why });
    return false;
  }
  const count = player.getDynamicProperty(P_COUNT) ?? 0;
  const seconds = Math.max(3, Math.min(60, opts.seconds ?? slipSeconds(count)));
  const from = player.location, rot = player.getRotation();
  const back = opts.returnTo && typeof opts.returnTo.x === "number" ? opts.returnTo : from;
  const origin = { x: back.x, y: back.y, z: back.z, dim: player.dimension.id, rx: rot.x, ry: rot.y };
  player.setDynamicProperty(P_ORIGIN, JSON.stringify(origin));
  const s = { player, id, seconds, origin, land: slipLanding(), state: "dark", t: 0, item: opts.item };
  active.set(player.id, s);
  emit("slipStarted", { player: player.id, id, seconds });

  // The sound cuts out and the screen snaps dark. The black hides the change of worlds.
  runCmd(player, "stopsound @s");
  runCmd(player, "camera @s fade time 0.15 1.6 0.8 color 0 0 0");
  sfx(player, "block.bell.hit", { volume: 0.6, pitch: 0.3 });
  return true;
}

function arrive(s) {
  const d = world.getDimension(UNDERTOW_ID), p = s.player;
  p.addEffect("resistance", s.seconds * 20 + 100, { amplifier: 4, showParticles: false });
  p.teleport(s.land, { dimension: d, facingLocation: { x: s.land.x * 0.5, y: s.land.y - 12, z: 80 } });
  runCmd(p, `fog @s push ${FOG_ID} ${FOG_LAYER}`);
  if (s.item) {
    try {
      s.itemEntity = d.spawnItem(new ItemStack(s.item, 1), { x: s.land.x, y: s.land.y + 0.5, z: s.land.z + 2 });
      s.itemType = s.item;
    } catch { /* unknown item */ }
  }
  s.state = "inside";
  s.t = 0;
}

function atmosphere(s) {
  const p = s.player, l = p.location;
  // Something moving out there: shapes at the edge of sight, and sounds with no source.
  const a = Math.random() * Math.PI, r = 9 + Math.random() * 6;
  const at = { x: l.x + Math.cos(a) * r, y: l.y + Math.random() * 2, z: l.z + Math.sin(a) * r };
  try {
    for (let h = 0; h < 3; h++) p.spawnParticle("minecraft:sculk_soul_particle", { x: at.x, y: at.y + h * 0.7, z: at.z });
    if (s.t % 40 === 0) sfx(p, s.t % 80 ? "mob.warden.heartbeat" : "ambient.cave", { volume: 1, pitch: 0.6, location: at });
    if (s.t === 60) sfx(p, "ambient.weather.thunder", { volume: 0.5, pitch: 0.5 });
    if (s.t === 100) sfx(p, "block.bell.hit", { volume: 0.4, pitch: 0.3 }); // far off, something tolls
    if (s.t === 30 || s.t === 130) {
      // Something huge, moving far below the ledge
      const below = { x: l.x, y: l.y - 25, z: l.z + 30 };
      sfx(p, "mob.ravager.roar", { volume: 2, pitch: 0.3, location: below });
      runCmd(p, "camerashake add @s 0.15 1.5 positional");
    }
  } catch { /* not loaded */ }
}

function sendBack(s, early) {
  const p = s.player;
  active.delete(p.id);
  let tookItem = false;
  try {
    if (s.itemType) {
      tookItem = !(s.itemEntity?.isValid);
      if (!tookItem) s.itemEntity.remove();
    }
    runCmd(p, "camera @s fade time 0.1 0.5 0.6 color 0 0 0");
    runCmd(p, `fog @s remove ${FOG_LAYER}`);
    p.teleport({ x: s.origin.x, y: s.origin.y, z: s.origin.z }, { dimension: world.getDimension(s.origin.dim), rotation: { x: s.origin.rx, y: s.origin.ry } });
    p.setDynamicProperty(P_ORIGIN, undefined);
    p.setDynamicProperty(P_COUNT, (p.getDynamicProperty(P_COUNT) ?? 0) + 1);
    p.removeEffect("resistance");
    sfx(p, "random.orb", { volume: 0.3, pitch: 0.4 });
  } catch { /* player left mid-Slip: put back when they next join (see playerSpawn below) */ }
  emit("slipEnded", { player: p.id, id: s.id, early, tookItem });
}

onTick("undertow:slips", 5, () => {
  for (const s of [...active.values()]) {
    s.t += 5;
    let valid = false;
    try { valid = s.player.isValid; } catch { /* gone */ }
    if (!valid) { active.delete(s.player.id); emit("slipEnded", { player: s.player.id, id: s.id, early: true, tookItem: false }); continue; }
    if (s.state === "dark") {
      if (s.t < 10) continue; // let the screen go fully black first
      try {
        arrive(s);
      } catch {
        if (s.t > 40) { // the Hollow would not take them: a Flicker instead
          active.delete(s.player.id);
          s.player.setDynamicProperty(P_ORIGIN, undefined);
          flicker(s.player, 4);
          emit("slipEnded", { player: s.player.id, id: s.id, early: true, tookItem: false });
        }
      }
      continue;
    }
    atmosphere(s);
    const l = s.player.location;
    const out = s.player.dimension.id !== UNDERTOW_ID || Math.hypot(l.x - s.land.x, l.z - s.land.z) > SLIPS.leash || l.y < s.land.y - 4;
    if (out || s.t >= s.seconds * 20) sendBack(s, out);
  }
});

// Anyone who logged out (or crashed) mid-Slip is put back where they were.
world.afterEvents.playerSpawn.subscribe((e) => {
  const p = e.player;
  let raw;
  try { raw = p.getDynamicProperty(P_ORIGIN); } catch { return; }
  if (typeof raw !== "string" || active.has(p.id)) return;
  system.runTimeout(() => {
    try {
      const o = JSON.parse(raw);
      p.setDynamicProperty(P_ORIGIN, undefined);
      runCmd(p, `fog @s remove ${FOG_LAYER}`);
      p.teleport({ x: o.x, y: o.y, z: o.z }, { dimension: world.getDimension(o.dim) });
    } catch { /* try again next join */ }
  }, 20);
});

// ---- Flickers -------------------------------------------------------------------------------
export function flicker(playerOrId, seconds = 3) {
  const p = resolvePlayer(playerOrId);
  if (!p || canSlip(p)) return false;
  const ticks = Math.round(Math.max(2, Math.min(5, seconds)) * 20);
  flickering.add(p.id);
  runCmd(p, `fog @s push ${FLICKER_FOG} hc_flicker`); // the old thick Hollow fog: a Flicker is only a glimpse
  try {
    p.addEffect("darkness", ticks, { amplifier: 0, showParticles: false });
    sfx(p, "block.bell.hit", { volume: 0.5, pitch: 0.3 });
    sfx(p, "ambient.cave", { volume: 1, pitch: 0.5 });
  } catch { /* gone */ }
  for (let t = 5; t < ticks; t += 10) {
    system.runTimeout(() => {
      try {
        const l = p.location, a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 6;
        const at = { x: l.x + Math.cos(a) * r, y: l.y + 0.5, z: l.z + Math.sin(a) * r };
        for (let h = 0; h < 3; h++) p.spawnParticle("minecraft:sculk_soul_particle", { x: at.x, y: at.y + h * 0.7, z: at.z }); // a tall shape only this player sees
      } catch { /* gone */ }
    }, t);
  }
  system.runTimeout(() => { flickering.delete(p.id); runCmd(p, "fog @s remove hc_flicker"); }, ticks);
  emit("flickered", { player: p.id, seconds: ticks / 20 });
  return true;
}

// ---- hooks -----------------------------------------------------------------------------------
on("slip", (data) => startSlip(data.player, data));
on("flicker", (data) => flicker(data.player, data.seconds));

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "hc:slip" && e.id !== "hc:flicker") return;
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const n = parseFloat(e.message);
  if (e.id === "hc:slip") {
    if (!startSlip(p, { id: "test", seconds: Number.isFinite(n) ? n : undefined })) say(p, `§7No Slip: ${canSlip(p) ?? "too many at once"}.`);
  } else flicker(p, Number.isFinite(n) ? n : 3);
});
