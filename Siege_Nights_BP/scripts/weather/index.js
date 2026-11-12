// Weather: each region has its own. Mist on the Blackfen, wind and sea fret on the Saltreach coast,
// dust and sandstorms in the Emberwaste, flurries and blizzards over the Frostmarch, morning mist in the
// Vale (which otherwise keeps Minecraft's rain). The Hollow's weather is its own, kept in undertow/index.js:
// an eternal thunderstorm with no rain (thunder in the roof, now and then a bolt striking the land far off).
// What each kind is and when it comes: data.js. The rules are pure and tested there.
//
// It is all fog, particles and sound, seen by each player for where they stand: nothing is placed in
// the world, so it costs nothing on a Realm and works on any world. Under a roof it thins to a grey
// light; down a cave or cellar it is gone.
//
//   /scriptevent siege:weather              what every region's sky is doing
//   /scriptevent siege:weather <kind>       start that kind now in its region (fen_mist, sandstorm ...)
//   /scriptevent siege:weather clear        end every spell now
//
// Events: "weatherMet" { player } the first time a player stands in a thick spell (the Almanac page),
// "weather" { region, kind, started } when a spell starts (kind) or ends (kind undefined).

import { world, system, MolangVariableMap } from "@minecraft/server";
import { on, emit, onTick, moduleStore } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { regionAt } from "../minimap/data.js";
import {
  LAYER, KIND, KINDS, REGIONS, REGION_OF_PLACE, SKY, fogId, pickKind, newSpell, between, minutes,
  fullStep, stepFor, nextShown, windVector,
} from "./data.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("siege:weather", () => ({ clock: 0, regions: {}, raining: false }));

// The feature's own clock (ticks), so spells keep their length across reloads and paused daylight.
let clockAt = 0; // system tick when store.data.clock was last moved on
const clock = () => store.data.clock + Math.max(0, system.currentTick - clockAt);

// ---------- the sky over each region ----------
function region(name) {
  const r = store.data.regions;
  r[name] ??= { spell: undefined, next: store.data.clock + minutes(between(SKY.firstQuiet)), last: undefined };
  return r[name];
}

function startSpell(name, kind, now = clock()) {
  const r = region(name);
  r.spell = newSpell(kind, now);
  r.last = kind.id;
  emit("weather", { region: name, kind: kind.id, started: true });
}

function endSpell(name, now = clock()) {
  const r = region(name);
  if (!r.spell) return;
  r.spell = undefined;
  r.next = now + minutes(between(SKY.quiet));
  emit("weather", { region: name, kind: undefined, started: false });
}

onTick("weather sky", SKY.checkTicks, () => {
  const d = store.data;
  d.clock = clock();
  clockAt = system.currentTick;
  const ctx = { time: world.getTimeOfDay(), raining: !!d.raining };
  for (const name of REGIONS) {
    const r = region(name);
    if (r.spell && d.clock >= r.spell.until) endSpell(name, d.clock);
    if (!r.spell && d.clock >= r.next) {
      const kind = pickKind(name, ctx, r.last);
      if (kind) startSpell(name, kind, d.clock);
      else r.next = d.clock + SKY.checkTicks * 4; // nothing wants to come now (say, mist away from dawn): look again soon
    }
  }
  store.save();
});

// Minecraft's own rain makes some weather likelier (and is snow in the Frostmarch)
world.afterEvents.weatherChange.subscribe((event) => {
  if (event.dimension !== OVERWORLD) return;
  const raining = String(event.newWeather) !== "Clear";
  if (store.data.raining === raining) return;
  store.data.raining = raining;
  store.save();
});

// ---------- what each player sees ----------
const seen = new Map(); // player id -> { shown: { kind, step }, stepAt, covered, depth, sounds: {}, lastCue, pausedUntil, told: Set, met }
const stateOf = (p) => {
  let s = seen.get(p.id);
  if (!s) seen.set(p.id, (s = { shown: { kind: undefined, step: 0 }, stepAt: 0, covered: false, depth: 0, sounds: {}, lastCue: undefined, pausedUntil: 0, told: new Set(), met: false }));
  return s;
};

const cmd = (p, c) => { try { p.runCommand(c); } catch { /* left */ } };

function show(p, s, next) {
  const before = s.shown;
  if (before.kind === next.kind && before.step === next.step) return;
  if (before.step > 0) cmd(p, `fog @s remove ${LAYER}`);
  if (next.step > 0) cmd(p, `fog @s push ${fogId(next.kind, next.step)} ${LAYER}`);
  s.shown = next;
}

/** Whose sky is this player under, and what should they see of it. */
function targetFor(p, s) {
  if (p.dimension.id !== OVERWORLD) return { kind: undefined, step: 0 };
  const name = REGION_OF_PLACE[regionAt(p.location.x, p.location.z)];
  const spell = name ? store.data.regions[name]?.spell : undefined;
  if (!spell) return { kind: undefined, step: 0 };
  return { kind: spell.kind, step: stepFor(fullStep(spell, clock()), s), spell };
}

function lookUp(p, s) {
  try {
    const head = Math.floor(p.location.y + 1.6);
    const top = p.dimension.getTopmostBlock({ x: Math.floor(p.location.x), z: Math.floor(p.location.z) });
    s.covered = !!top && top.location.y > head;
    s.depth = top ? Math.max(0, top.location.y - head) : 0;
  } catch {
    s.covered = false; s.depth = 0; // not loaded: assume the open sky
  }
}

onTick("weather players", 40, () => {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    try {
      const s = stateOf(p);
      if (now < s.pausedUntil) continue; // a Flicker owns their fog for a moment
      if (p.dimension.id !== OVERWORLD) { // gone through: the weather does not follow
        if (s.shown.step > 0) show(p, s, { kind: undefined, step: 0 });
        continue;
      }
      lookUp(p, s);
      const target = targetFor(p, s);
      if (now - s.stepAt >= SKY.stepTicks) {
        const next = nextShown(s.shown, target);
        if (next.step !== s.shown.step || next.kind !== s.shown.kind) {
          const arriving = s.shown.step === 0 && next.step > 0;
          show(p, s, next);
          s.stepAt = now;
          const key = target.spell ? `${target.kind}|${target.spell.from}` : "";
          if (arriving && key && !s.told.has(key)) {
            s.told.add(key);
            try { p.onScreenDisplay.setActionBar(KIND[next.kind].arrive); } catch { /* busy */ }
          }
          if (next.step >= 2 && !s.met) { s.met = true; emit("weatherMet", { player: p }); }
        }
      }
      sounds(p, s, now);
    } catch {
      // mid-teleport or leaving
    }
  }
});

function sounds(p, s, now) {
  const kind = KIND[s.shown.kind];
  if (!kind || s.shown.step === 0 || s.depth >= SKY.deep) return;
  const strength = s.shown.step / kind.steps.length;
  for (const snd of kind.sounds) {
    const due = s.sounds[snd.cue];
    if (due === undefined) { s.sounds[snd.cue] = now + Math.round(between(snd.every) * 20 * Math.random()); continue; }
    if (now < due) continue;
    s.sounds[snd.cue] = now + Math.round(between(snd.every) * 20);
    if (snd.cue === s.lastCue && kind.sounds.length > 1) continue; // never the same sound twice running
    s.lastCue = snd.cue;
    sfx(p, snd.cue, { volume: (s.covered ? 0.45 : 0.8) * (0.5 + strength / 2) });
    break; // one at a time
  }
}

// What blows past: once a second, around each player out in it (only they see their own)
onTick("weather particles", 20, () => {
  for (const p of world.getAllPlayers()) {
    try {
      const s = seen.get(p.id);
      if (!s || s.shown.step === 0 || s.covered || system.currentTick < s.pausedUntil) continue;
      const kind = KIND[s.shown.kind];
      const spell = store.data.regions[kind.region]?.spell;
      const w = windVector(spell?.wind ?? kind.wind);
      const vars = new MolangVariableMap();
      vars.setFloat("variable.wind_x", w.x);
      vars.setFloat("variable.wind_z", w.z);
      vars.setFloat("variable.density", s.shown.step / kind.steps.length);
      p.spawnParticle(kind.particle.id, p.location, vars);
    } catch {
      // not loaded
    }
  }
});

// A Flicker pushes its own fog: leave the stack alone until it is over
on("flickered", ({ player, seconds = 5 } = {}) => {
  const s = seen.get(player);
  if (s) s.pausedUntil = system.currentTick + Math.round((seconds + 1) * 20);
});

// A fresh login starts with an empty fog stack
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  seen.delete(player.id);
  cmd(player, `fog @s remove ${LAYER}`);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => seen.delete(playerId));

// ---------- builder commands ----------
const describe = () => REGIONS.map((name) => {
  const r = region(name), now = clock();
  if (r.spell) return `§f${name}§7: ${KIND[r.spell.kind].name}, ${Math.max(0, Math.round((r.spell.until - now) / 1200))} min left`;
  return `§f${name}§7: clear, next in about ${Math.max(0, Math.round((r.next - now) / 1200))} min`;
}).join("\n");

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:weather") return;
  const player = event.sourceEntity?.typeId === "minecraft:player" ? event.sourceEntity : undefined;
  const reply = (m) => (player ? player.sendMessage(m) : console.warn(`[Hollow Crown] ${m}`));
  const arg = event.message.trim().toLowerCase();
  const d = store.data;
  d.clock = clock();
  clockAt = system.currentTick;
  if (!arg) return reply(`§6Weather\n${describe()}\n§8Kinds: ${KINDS.map((k) => k.id).join(", ")}`);
  if (arg === "clear") {
    for (const name of REGIONS) endSpell(name, d.clock);
    store.save();
    return reply("§7Every region's sky is clear.");
  }
  const kind = KIND[arg];
  if (!kind) return reply(`§cNo weather called "${arg}". Kinds: ${KINDS.map((k) => k.id).join(", ")}`);
  endSpell(kind.region, d.clock);
  startSpell(kind.region, kind, d.clock);
  store.save();
  reply(`§7${kind.name} over ${kind.region} for ${Math.round((region(kind.region).spell.until - d.clock) / 1200)} min.`);
});
