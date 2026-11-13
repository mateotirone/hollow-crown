// Morvane's voice. Mateo (2026-11-13): "i want morvane to have voicelines, and i want the player to hear him
// before they know who he is".
//
// Before the Rift he is a voice with no speaker: far off and filtered, heard by one player at a time, each line
// once, with the words in grey italics and no name on them. Nothing he says up here names the Hollow, a king,
// Morvane or Oswin (a self-test checks), but every line echoes his father's journal or his own last page, so it
// clicks when he looks up in the reveal and says "You kept my father's book." In the Hollow he is closer. In the
// fight the voice belongs to the one in front of you: bestiary/morvane.js and reveal.js emit("morvaneSays", { players, id }).
//
// The words are in studio/voices/morvane.json; tools/install_voices.py writes data/morvane_lines.js and installs
// the recordings (siege.voice.morvane.<id>). A line with no recording yet still shows its words.
//
//   /scriptevent siege:morvane_voice <id>       hear one line now (it is not marked as heard)
//   /scriptevent siege:morvane_voice list       which lines you have heard
//   /scriptevent siege:morvane_voice forget     hear them all again, as if new

import { world, system } from "@minecraft/server";
import { on, onTick, isNight, addTests, assert, assertEqual } from "../siege/api.js";
import { progressOf, setFlag, saveProgress } from "./player.js";
import { isThirdNight } from "./singing.js";
import { storyOver } from "../reach/api.js";
import { fallenCount } from "./data/spine.js";
import { REVEAL } from "./data/reveal.js";
import { MORVANE_LINES, VOICE_PREFIX } from "./data/morvane_lines.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
const HOLLOW = "siege:undertow";
const LINE = Object.fromEntries(MORVANE_LINES.map((l) => [l.id, l]));
const FLAG = (id) => `mv_${id}`;
export const VOICE = {
  gap: 60, // ticks of quiet after a line before the next one may start
  thirdChance: 0.5, // on a third night, the chance he says anything at all
  thirdDelay: [600, 3600], // ticks into the night before he might
  dusk: [12000, 13800], // time of day that counts as dusk
};
export const THIRD = MORVANE_LINES.filter((l) => l.id.startsWith("third_")).map((l) => l.id);
const BOSSES = ["reeve", "huntsman", "bride", "seneschal", "mother"];

// How the words look in chat: grey and far before the Rift, lighter in the Hollow. The fight prints its own.
export function subtitle(line) {
  if (!line || line.fx === "dry") return "";
  return `${line.fx === "far" ? "§8" : "§7"}§o"${line.text}"`;
}

const heard = (player, id) => progressOf(player).flags.includes(FLAG(id));
const busy = new Map(); // player id -> tick until which he is talking

function play(player, id) {
  const line = LINE[id];
  if (!line || !player?.isValid) return;
  if (line.seconds > 0) sfx(player, VOICE_PREFIX + id);
  const text = subtitle(line);
  if (text) { try { player.sendMessage(text); } catch { /* offline */ } }
}

// Say a line to one player after `delay` ticks, never over another of his lines
function queue(player, id, delay = 0) {
  const line = LINE[id];
  if (!line) return;
  const now = system.currentTick;
  const at = Math.max(now + delay, busy.get(player.id) ?? 0);
  busy.set(player.id, at + Math.ceil((line.seconds || 3) * 20) + VOICE.gap);
  system.runTimeout(() => play(player, id), Math.max(0, at - now));
}

/** Say a line to a player once in their whole game. Returns true if it will be said. */
export function speakOnce(player, id, delay = 0) {
  if (!player?.isValid || !LINE[id] || heard(player, id)) return false;
  setFlag(player, FLAG(id));
  queue(player, id, delay);
  return true;
}

/** The fight: he is in front of them, so the voice plays every time the line is said. The words are printed by the fight. */
export function morvaneSpeaks(players, id, delay = 0) {
  if (!LINE[id]) return;
  for (const p of players ?? []) { try { if (p?.isValid) queue(p, id, delay); } catch { /* gone */ } }
}

// the fight and the reveal ask by event, so they need not import the lore feature
on("morvaneSays", ({ players, id, delay }) => morvaneSpeaks(players, id, delay));

const playerOf = (pid) => world.getAllPlayers().find((p) => p.id === pid);
const inDim = (dim) => world.getAllPlayers().filter((p) => { try { return p.dimension.id === dim; } catch { return false; } });

// ---------- before the Rift ----------
on("loreFlag", ({ player, flag }) => {
  if (flag === "journal_read") return void speakOnce(player, "journal_done", 60);
  const boss = flag?.startsWith("fell_") ? flag.slice(5) : undefined;
  if (BOSSES.includes(boss)) speakOnce(player, `fell_${boss}`, 200);
});
on("emberFell", ({ player }) => speakOnce(player, "ember", 120));
on("warlordSlain", ({ king }) => { if (king) for (const p of inDim(OVERWORLD)) speakOnce(p, "warlord", 100); });

const spokeTonight = new Map(); // player id -> the day he last spoke to them at night
on("siegeStart", () => {
  for (const p of inDim(OVERWORLD)) if (speakOnce(p, "siege_first", 100)) spokeTonight.set(p.id, world.getDay());
});
on("siegeEnd", ({ outcome }) => {
  if (outcome !== "won") return;
  for (const p of inDim(OVERWORLD)) if (heard(p, "siege_first")) speakOnce(p, "siege_held", 200);
});

// The next third-night line for a player, or undefined when he has said them all (then he is quiet on those nights)
export function nextThird(flags, roll = Math.random()) {
  const left = THIRD.filter((id) => !flags.includes(FLAG(id)));
  return left.length ? left[Math.floor(roll * left.length) % left.length] : undefined;
}

const rolled = new Map(); // player id -> the third night already rolled for
onTick("morvane voice", 100, () => {
  const day = world.getDay(), time = world.getTimeOfDay();
  const third = isThirdNight() && !storyOver();
  for (const p of world.getAllPlayers()) {
    let dim;
    try { dim = p.dimension.id; } catch { continue; }
    if (dim === HOLLOW) { speakOnce(p, "hollow_first", 100); continue; }
    if (dim !== OVERWORLD) continue;
    if (time >= VOICE.dusk[0] && time <= VOICE.dusk[1]) speakOnce(p, "first_dusk", 40);
    if (!third || rolled.get(p.id) === day) continue;
    rolled.set(p.id, day);
    if (spokeTonight.get(p.id) === day || Math.random() >= VOICE.thirdChance) continue;
    const id = nextThird(progressOf(p).flags);
    if (!id) continue;
    const [lo, hi] = VOICE.thirdDelay;
    const wait = lo + Math.floor(Math.random() * (hi - lo));
    system.runTimeout(() => { if (p.isValid && isNight() && isThirdNight()) speakOnce(p, id); }, wait);
  }
});

// ---------- the door, the Hollow, the end ----------
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  if (id === "siege:undertow_rift_opened") {
    for (const p of inDim(OVERWORLD)) if (fallenCount(progressOf(p).flags) >= 5) speakOnce(p, "rift_open", 120);
    return;
  }
  if (id === "siege:boss_defeated") {
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const who = (data?.players ?? []).map(playerOf).filter(Boolean);
    if (data?.boss === "choir") for (const p of who.length ? who : inDim(HOLLOW)) speakOnce(p, "choir_silenced", 160);
    if (data?.boss === "morvane") {
      morvaneSpeaks(who, "last", 20);
      for (const p of who) system.runTimeout(() => { try { p.sendMessage(`§3"${LINE.last.text}"`); } catch { /* gone */ } }, 20);
    }
    return;
  }
  if (id !== "siege:morvane_voice" || sourceEntity?.typeId !== "minecraft:player") return;
  const player = sourceEntity, arg = (message ?? "").trim();
  if (arg === "list") {
    const flags = progressOf(player).flags;
    const got = MORVANE_LINES.filter((l) => flags.includes(FLAG(l.id))).map((l) => l.id);
    return void player.sendMessage(`§7Heard ${got.length} of ${MORVANE_LINES.length}: ${got.join(", ") || "none"}. Recorded: ${MORVANE_LINES.filter((l) => l.seconds > 0).length}.`);
  }
  if (arg === "forget") {
    const p = progressOf(player);
    p.flags = p.flags.filter((f) => !f.startsWith("mv_"));
    saveProgress(player);
    return void player.sendMessage("§7You will hear every line again, as if new.");
  }
  if (!LINE[arg]) return void player.sendMessage(`§7Lines: ${MORVANE_LINES.map((l) => l.id).join(", ")}`);
  queue(player, arg);
  if (LINE[arg].fx === "dry") player.sendMessage(`§3"${LINE[arg].text}"`);
});

addTests("lore", {
  "Morvane's voice: every line has words, a place and a unique id": () => {
    assertEqual(new Set(MORVANE_LINES.map((l) => l.id)).size, MORVANE_LINES.length);
    for (const l of MORVANE_LINES) assert(l.text && ["far", "mid", "dry"].includes(l.fx), l.id);
    assert(THIRD.length >= 6, "enough third-night lines that they are never the same");
  },
  "Morvane's voice: before the door he names nothing": () => {
    for (const l of MORVANE_LINES.filter((x) => x.fx === "far")) {
      assert(!/\b(hollow|kings?|morvane|oswin|truce|choir|crown|undertow|edda)\b/i.test(l.text), `${l.id} gives it away`);
    }
    for (const l of MORVANE_LINES) assert(!/oswin/i.test(l.text), `${l.id} says the name`);
  },
  "Morvane's voice: the fight's lines are the words the fight prints": () => {
    REVEAL.fall.forEach((line, i) => {
      const spoken = line.replace(/, \{name\}\./g, ".").replace(/\{name\}\. /g, "");
      assertEqual(LINE[`fall_${i + 1}`]?.text, spoken, `fall_${i + 1}`);
    });
    assertEqual(LINE.look_up?.text, REVEAL.lookUp);
  },
  "Morvane's voice: third nights run out instead of repeating": () => {
    const flags = [];
    for (let i = 0; i < THIRD.length; i++) { const id = nextThird(flags, 0.5); assert(id && !flags.includes(FLAG(id))); flags.push(FLAG(id)); }
    assertEqual(nextThird(flags), undefined);
  },
  "Morvane's voice: subtitles are grey and nameless up top, absent in the fight": () => {
    assertEqual(subtitle({ fx: "far", text: "x" }), '§8§o"x"');
    assertEqual(subtitle({ fx: "dry", text: "x" }), "");
  },
});
