// The soundtrack. Each player hears the music of where they stand: their region's pool by day or by night, the
// Hollow's down there, a boss's own theme in its fight, the siege piece on a siege night. What plays when is in
// data.js; the recordings are installed by tools/install_music.py (music/installed.js lists them).
//
// Music is played to each player alone (stereo, category music, so Minecraft's own Music slider sets its volume),
// never to the whole world, because players on a Realm stand in different places.
//
//   /scriptevent siege:music            what you are hearing and why
//   /scriptevent siege:music <track>    play one piece now (vale_theme, boss_bride ...)
//   /scriptevent siege:music stop       stop it (the next piece comes after the usual short breath)
//
// The music never stops for good: a piece ends, a few seconds pass, the next one starts. Cross into another region
// and stay there a few seconds and its music takes over. Changing dimension cuts every sound in Bedrock, so the
// music starts again right after (otherwise the script would think a piece was still playing).

import { world, system } from "@minecraft/server";
import { on, onTick } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { regionAt } from "../minimap/data.js";
import { activeFights } from "../bestiary/bossCore.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { INSTALLED_MUSIC } from "./installed.js";
import { MUSIC, MAIN_THEME, soundId, poolFor, poolKey, overrideFor, pickTrack, between, keepLoop } from "./data.js";
import "./tests.js";

const SECOND = 20;
const MAIN_HEARD = "siege:music_main";
const listeners = new Map(); // player id -> { track, mode: "piece" | "loop" | "quiet", until (tick), last, key, newKey, newSince }
let siege = false;
on("siegeStart", () => { siege = true; });
on("siegeEnd", () => { siege = false; });

const lengthOf = (track) => INSTALLED_MUSIC[soundId(track)]?.seconds ?? 0;

function stop(player, s) {
  if (s.track) { try { player.runCommand(`stopsound @s ${soundId(s.track)}`); } catch {} }
  s.track = undefined;
}

// Every piece, not just the one the script thinks is playing: after a script reload, a rejoin or a dimension change
// that did not cut the sound, an old piece can still be running, and starting another on top of it doubles the music.
function stopAll(player) {
  for (const id of Object.keys(INSTALLED_MUSIC)) { try { player.runCommand(`stopsound @s ${id}`); } catch {} }
}

function play(player, s, track, mode) {
  stopAll(player);
  sfx(player, soundId(track));
  Object.assign(s, { track, mode, last: track, until: system.currentTick + Math.max(1, lengthOf(track)) * SECOND });
}

function quiet(s, range) {
  s.mode = "quiet";
  s.until = system.currentTick + between(range, Math.random()) * SECOND;
}

function situation(player) {
  const hollow = player.dimension.id === UNDERTOW_ID;
  const { x, z } = player.location;
  const fight = activeFights().find((f) => { try { return f.players().some((p) => p.id === player.id); } catch { return false; } });
  return { hollow, region: hollow ? "" : regionAt(x, z), timeOfDay: world.getTimeOfDay(), fightBoss: fight?.def.id, siege };
}

function listen(player) {
  let s = listeners.get(player.id);
  if (!s) {
    s = { track: undefined, mode: "quiet", until: system.currentTick + between(MUSIC.firstGap, Math.random()) * SECOND, last: undefined };
    listeners.set(player.id, s);
    if (!player.getDynamicProperty(MAIN_HEARD) && INSTALLED_MUSIC[soundId(MAIN_THEME)]) {
      player.setDynamicProperty(MAIN_HEARD, true);
      play(player, s, MAIN_THEME, "piece");
      return;
    }
  }
  const now = system.currentTick;
  const where = situation(player);
  const must = overrideFor(where);
  if (must && INSTALLED_MUSIC[soundId(must)]) {
    s.mustAt = now;
    if (s.track !== must || s.mode !== "loop" || now >= s.until) play(player, s, must, "loop"); // start, or go round again
    return;
  }
  if (s.mode === "loop") {
    // a fight that drops you for a moment (you stepped out of its ring, a teleport) keeps its music: no restart from the top
    if (keepLoop(now - (s.mustAt ?? 0), MUSIC.overrideGrace * SECOND)) { if (now >= s.until) play(player, s, s.track, "loop"); return; }
    stop(player, s); return quiet(s, MUSIC.afterFight);
  }
  // walked into another region (or the Hollow): once you have stayed a few seconds, its music takes over
  const key = poolKey(where);
  if (s.key === undefined) s.key = key;
  if (key !== s.key) {
    if (s.newKey !== key) { s.newKey = key; s.newSince = now; }
    if (now - s.newSince >= MUSIC.regionSettle * SECOND) {
      s.key = key; s.newKey = undefined;
      if (s.mode === "piece" && s.track !== MAIN_THEME) { stop(player, s); return quiet(s, MUSIC.switchGap); }
      if (s.mode === "quiet") s.until = Math.min(s.until, now + MUSIC.switchGap[1] * SECOND);
    }
  } else s.newKey = undefined;
  if (now < s.until) return;
  if (s.mode === "piece") { s.track = undefined; return quiet(s, MUSIC.gap); }
  const next = pickTrack(poolFor(where), s.last, INSTALLED_MUSIC, Math.random());
  if (next) play(player, s, next, "piece");
  else quiet(s, MUSIC.gap);
}

onTick("music", MUSIC.checkTicks, () => {
  if (!Object.keys(INSTALLED_MUSIC).length) return;
  const here = new Set();
  for (const player of world.getAllPlayers()) {
    here.add(player.id);
    try { listen(player); } catch (e) { console.warn(`[Music] ${e}`); }
  }
  for (const id of listeners.keys()) if (!here.has(id)) listeners.delete(id);
});

// A dimension change silences every sound the player hears, so start the music again instead of waiting out a piece
// that is no longer playing.
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
  const s = listeners.get(player.id);
  if (!s) return;
  stopAll(player);
  s.track = undefined;
  s.key = undefined;
  quiet(s, MUSIC.afterDimension);
});

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "siege:music") return;
  const player = ev.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const arg = ev.message.trim();
  const s = listeners.get(player.id) ?? { mode: "quiet", until: 0 };
  listeners.set(player.id, s);
  if (arg === "stop") { stop(player, s); quiet(s, MUSIC.gap); return player.sendMessage("§7Music stopped."); }
  if (arg) {
    if (!INSTALLED_MUSIC[soundId(arg)]) return player.sendMessage(`§c${arg} is not an installed piece. Installed: ${Object.keys(INSTALLED_MUSIC).map((k) => k.slice(13)).join(", ")}`);
    play(player, s, arg, "piece");
    return player.sendMessage(`§7Playing ${arg} (${lengthOf(arg)} s).`);
  }
  const w = situation(player);
  player.sendMessage(`§6Music:§7 ${s.track ? `playing ${s.track}` : `quiet for ${Math.max(0, Math.round((s.until - system.currentTick) / SECOND))} s`}. ` +
    `You are in ${w.hollow ? "the Hollow" : w.region || "no region"}${w.fightBoss ? `, fighting ${w.fightBoss}` : ""}${w.siege ? ", on a siege night" : ""}. ` +
    `Pool: ${poolFor(w).join(", ")}. ${Object.keys(INSTALLED_MUSIC).length} pieces installed.`);
});
