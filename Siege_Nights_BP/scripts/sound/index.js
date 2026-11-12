// Sound: the looping beds that need a driver, and the sound board for hearing every cue in game.
// What each sound is made of lives in core/sfx_cues.js. The list for Mateo is SOUND-LIST.md.
//
//   /scriptevent siege:sound            opens the sound board
//   /scriptevent siege:sound <cue>      plays one, for example  /scriptevent siege:sound sig.toll_317
//   /scriptevent siege:sound signature  plays every signature sound in turn, named on screen

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { sfx, sfxStop, resolve, installedId, hasCue } from "../core/sfx.js";
import { CUES, SIGNATURE_CUES, NAMED_CUES, REWORKED_IDS } from "../core/sfx_cues.js";
import { INSTALLED } from "../core/sfx_installed.js";

// ---------- Looping beds ----------
// A bed is a recording with a fade at each end, started again a little before it runs out, so the
// fades overlap into one unbroken sound. Each has a stand-in of "nothing": the Hollow already has its
// thunder and its hum, so there is no bed until Mateo's recording is installed.
export const BEDS = [
  { cue: "sig.hollow_ambience", overlap: 3, volume: 0.6, where: (player) => player.dimension.id === "siege:undertow" },
];

/** Ticks between restarts of a bed that is `seconds` long: its length less the overlap, never under 2 s. */
export const bedPeriod = (seconds, overlap) => Math.max(40, Math.round((seconds - overlap) * 20));

const playing = new Map(); // `${player.id}|${cue}` -> tick the bed is due again

onTick("sound beds", 20, () => {
  for (const bed of BEDS) {
    const id = installedId(bed.cue);
    if (!id) continue;
    for (const player of world.getAllPlayers()) {
      const key = `${player.id}|${bed.cue}`;
      let inside = false;
      try { inside = bed.where(player); } catch { /* player is mid-teleport */ }
      if (!inside) {
        if (playing.delete(key)) sfxStop(player, bed.cue);
        continue;
      }
      if (system.currentTick < (playing.get(key) ?? 0)) continue;
      sfx(player, bed.cue, { volume: bed.volume });
      playing.set(key, system.currentTick + bedPeriod(INSTALLED[id].seconds ?? 20, bed.overlap));
    }
  }
});

// ---------- The sound board ----------
const label = (name) => `${CUES[name]?.what ?? name}\n§8${name}${installedId(name) ? " §2(recording)" : ""}`;

function audition(player, name) {
  const real = sfx(player, name);
  player.onScreenDisplay.setActionBar(`§7${CUES[name]?.what ?? name} §8${name}${real ? " §2recording" : hasCue(name) ? " §6stand-in" : ""}`);
}

async function board(player, group) {
  const groups = { "Signature sounds": SIGNATURE_CUES, "Named cues": NAMED_CUES, "Reworked vanilla sounds": REWORKED_IDS };
  if (!group) {
    const form = new ActionFormData().title("Sound board").body("Pick a group. Recordings that are installed say so; everything else plays its stand-in.");
    for (const g of Object.keys(groups)) form.button(g);
    const r = await form.show(player);
    if (r.canceled) return;
    return board(player, Object.keys(groups)[r.selection]);
  }
  const names = groups[group];
  const form = new ActionFormData().title(group);
  for (const n of names) form.button(label(n));
  form.button("Back");
  const r = await form.show(player);
  if (r.canceled) return;
  if (r.selection >= names.length) return board(player);
  audition(player, names[r.selection]);
  system.runTimeout(() => board(player, group).catch(() => {}), 60); // stay on the board to try the next one
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:sound") return;
  const player = event.sourceEntity?.typeId === "minecraft:player" ? event.sourceEntity : undefined;
  if (!player) return;
  const arg = event.message.trim();
  if (!arg) return void board(player).catch(() => {});
  if (arg === "signature") {
    SIGNATURE_CUES.forEach((name, i) => system.runTimeout(() => { try { audition(player, name); } catch { /* left */ } }, i * 160));
    return;
  }
  audition(player, arg);
});

on("showcase", ({ player }) => {
  const done = SIGNATURE_CUES.filter((n) => installedId(n)).length;
  player.sendMessage(`§6Sounds:§7 /scriptevent siege:sound opens the sound board (${done} of ${SIGNATURE_CUES.length} signature recordings installed; the rest play stand-ins). /scriptevent siege:sound signature plays them all in turn.`);
});

// ---------- Self-tests ----------
addTests("sound", {
  "every cue has a name and well-formed layers": () => {
    for (const [name, cue] of Object.entries(CUES)) {
      assert(typeof cue.what === "string" && cue.what, `${name} has no description`);
      assert(Array.isArray(cue.layers), `${name} has no layers`);
      for (const [id, pitch = 1, volume = 1, delay = 0] of cue.layers) {
        assert(typeof id === "string" && id && !CUES[id]?.custom, `${name}: bad layer id ${id}`);
        assert(pitch > 0.05 && pitch <= 4, `${name}: pitch ${pitch}`);
        assert(volume > 0 && volume <= 4, `${name}: volume ${volume}`);
        assert(Number.isInteger(delay) && delay >= 0 && delay <= 200, `${name}: delay ${delay}`);
      }
    }
  },
  "signature cues map to siege.sig.* recordings": () => {
    assertEqual(SIGNATURE_CUES.length, 27); // 14, plus four for the role storylines (bell-tongue, roll drum, the forty rowing, the fen), plus nine for the Rift
    for (const name of SIGNATURE_CUES) assertEqual(CUES[name].custom, `siege.${name}`);
  },
  "installed recordings are all known": () => {
    const known = new Set([...SIGNATURE_CUES.map((n) => CUES[n].custom), "siege.choir.hum"]);
    for (const id of Object.keys(INSTALLED)) assert(known.has(id) || id.startsWith("siege.dragon."), `unknown installed sound ${id}`);
  },
  "an unknown name is played as it is": () => {
    assertEqual(JSON.stringify(resolve("mob.horse.idle", { pitch: 0.7 })), JSON.stringify([{ id: "mob.horse.idle", pitch: 0.7, volume: 1, delay: 0 }]));
  },
  "the caller's pitch and volume carry into every layer": () => {
    const flat = resolve("block.bell.hit", { pitch: 0.5, volume: 2 }, () => 0.5); // 0.5 = no drift
    assertEqual(flat[0].pitch, 0.5);
    assertEqual(flat[0].volume, 2);
    assertEqual(flat[1].pitch, 0.25);
    assert(flat.length >= 2, "the bell is layered");
  },
  "no two plays of a cue are the same": () => {
    const a = resolve("random.levelup", {}, () => 0)[0].pitch, b = resolve("random.levelup", {}, () => 1)[0].pitch;
    assert(a < b && b / a < 1.2, "drift is small but real");
  },
  "layers of one play stay in tune with each other": () => {
    const [x, y] = resolve("block.bell.hit", {}, () => 0.9);
    assertEqual(Math.round((x.pitch / y.pitch) * 1000), 2000);
  },
  "a bed restarts before it runs out": () => {
    assertEqual(bedPeriod(24, 3), 420);
    assertEqual(bedPeriod(2, 3), 40);
  },
});
