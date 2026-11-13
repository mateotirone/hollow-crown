// The reveal: who Morvane was. A staged scene of about a minute between stage 6 (the Fall) and stage 7 of his
// fight (design: the Hollow design thread and the lore thread, for Mateo: "a huge poetic cinematic staged reveal").
// Every player's camera is taken and their controls are locked. Nobody says a name.
//
//   black, one far bell  ->  a small warm room, a boy of nine writing at a desk, his back to us
//   ->  the journal's line writes itself across the screen, word by word
//   ->  the camera comes round to his grey eyes and his right hand
//   ->  one unbroken shot: the room ages, the boy is a king, the king is Morvane, same pose, pen become sword
//   ->  he looks up and says one line  ->  the journal gains its last page  ->  every bell rings, for everyone
//   ->  black, and stage 7 begins on the Seat
//
// WORDS are the lore thread's: emit("revealWordsWanted") and they answer with "revealWords".
// THE ROOM is the Hollow build thread's: a pocket called "room" in undertow/finale.js, where `entry` is where the
// players are parked (out of shot) and `face` is where the desk stands (built: he faces +z, players behind a partition). Without it the scene is played on the spot
// if the fight is on open ground (testing), or as words over black if it is not.
// THE ACTORS are three stand-in models in one pose: siege:reveal_boy, siege:reveal_king, siege:reveal_morvane.
// Each beat is announced so the room can change with it:
//   siege:morvane_reveal {"beat": "black"|"room"|"words"|"eyes"|"age_king"|"age_morvane"|"look_up"|"page"|"bells"|"end", "x","y","z","dimension"}
// The first time, nobody can skip it. If every player in the fight has already seen it, they get the short cut.
// Testing: /scriptevent siege:reveal_test        plays it for you where you stand
//          /scriptevent siege:reveal_forget      makes you a first-time viewer again

import { world, system } from "@minecraft/server";
import { on, emit, addTests, assert, assertEqual } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { pocket, pocketReady } from "../undertow/finale.js";
import { announce } from "./util.js";
import { sfx } from "../core/sfx.js";

// When each beat happens, in ticks from the start (20 = 1 second)
export const BEATS = { black: 0, room: 30, words: 140, eyes: 470, age: 620, age_king: 710, age_morvane: 810, look_up: 930, page: 1010, bells: 1070, out: 1150, end: 1185 };
export const SCENE = { perWord: 9, lineWidth: 46, shortCut: 120 };
const SEEN = "siege:seen_reveal";
const ACTORS = { boy: "siege:reveal_boy", king: "siege:reveal_king", morvane: "siege:reveal_morvane" };

// ---------- pure (self-tested) ----------
// The part of the line that has been written by tick t
export function wordsAt(line, t, start = BEATS.words, perWord = SCENE.perWord) {
  const words = String(line ?? "").split(/\s+/).filter(Boolean);
  return words.slice(0, Math.max(0, Math.min(words.length, Math.floor((t - start) / perWord) + 1))).join(" ");
}
// Break a long line so it sits in the middle of the screen instead of running off it
export function wrapLine(text, width = SCENE.lineWidth) {
  const out = [""];
  for (const w of String(text).split(" ")) {
    if ((out[out.length - 1] + " " + w).trim().length > width) out.push(w);
    else out[out.length - 1] = (out[out.length - 1] + " " + w).trim();
  }
  return out.join("\n");
}
// The three camera positions, from where the desk is and which way the figure faces (a flat unit vector)
export function cameras(desk, fwd) {
  const right = { x: -fwd.z, z: fwd.x }; // his right hand side
  const at = (f, r, up) => ({ x: desk.x + fwd.x * f + right.x * r, y: desk.y + up, z: desk.z + fwd.z * f + right.z * r });
  return {
    behind: { pos: at(-5.5, 0.6, 2.4), look: at(0.6, 0, 1.0) }, // over his shoulder, the page just visible
    eyes: { pos: at(3.4, 1.7, 1.5), look: at(0, 0.3, 1.25) }, // round to the front: his eyes, and the hand that writes
    close: { pos: at(2.1, 0.5, 1.45), look: at(0, 0, 1.3) }, // the long push in while the room ages
  };
}
// The figure faces straight down the room, away from where the players are parked (the parking spot is off to one side)
export function facingFrom(entry, desk) {
  const dx = desk.x - entry.x, dz = desk.z - entry.z;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
}
const yawOf = (fwd) => (Math.atan2(-fwd.x, fwd.z) * 180) / Math.PI;

// ---------- the words ----------
let words = {};
on("revealWords", (w) => { words = w ?? {}; });

// ---------- helpers ----------
const each = (players, fn) => { for (const p of players) { try { if (p.isValid !== false) fn(p); } catch { /* left the game */ } } };
function lock(p, on_) {
  try { p.inputPermissions.setPermissionCategory(2, !on_); } catch { /* older engine */ } // movement
  try { p.inputPermissions.setPermissionCategory(1, !on_); } catch { /* older engine */ } // camera
}
function release(p) {
  lock(p, false);
  try { p.camera.clear(); } catch { /* gone */ }
  for (const e of ["invisibility", "resistance"]) { try { p.removeEffect(e); } catch { /* gone */ } }
}
const fade = (p, inS, holdS, outS) => p.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: inS, holdTime: holdS, fadeOutTime: outS } });
const shot = (p, cam, easeSeconds) =>
  p.camera.setCamera("minecraft:free", { location: cam.pos, facingLocation: cam.look, ...(easeSeconds ? { easeOptions: { easeTime: easeSeconds, easeType: "InOutSine" } } : {}) });
const seen = (p) => { try { return !!p.getDynamicProperty(SEEN); } catch { return false; } };

let running; // one scene at a time: { id, players, actor, timers }
export const revealRunning = () => !!running;

// Where it is staged: the room if it is built; else on the spot (open ground only); else nowhere (words over black)
function stageFor(dim, center, openGround) {
  try {
    const p = pocket("room");
    if (p && pocketReady("room")) {
      return { dim: world.getDimension(UNDERTOW_ID), desk: { x: p.face.x, y: p.entry.y, z: p.face.z }, fwd: facingFrom(p.entry, p.face), park: p.entry };
    }
  } catch { /* arenas unavailable */ }
  return openGround ? { dim, desk: { x: center.x, y: center.y, z: center.z }, fwd: { x: 0, z: -1 } } : undefined;
}

function setActor(stage, kind) {
  const s = running;
  if (!s || !stage) return;
  try { s.actor?.remove(); } catch { /* gone */ }
  try {
    s.actor = stage.dim.spawnEntity(ACTORS[kind], stage.desk);
    s.actor.setRotation({ x: 0, y: yawOf(stage.fwd) });
    s.actor.addTag("siege_showcase"); // nothing treats it as part of a fight
  } catch { s.actor = undefined; }
}

function finish(done) {
  const s = running;
  if (!s) return;
  running = undefined;
  for (const t of s.timers) system.clearRun(t);
  try { s.actor?.remove(); } catch { /* gone */ }
  each(s.players, (p) => { release(p); p.setDynamicProperty(SEEN, true); });
  done?.();
}

// Play it for these players. `center`/`dim` are where the fight is; `openGround` says the on-the-spot stand-in is safe.
// `onStage(stage)` is told where the scene is (so the fight can follow the players there). `done` runs at the end, always.
export function playReveal(players, { dim, center, openGround = false, onStage, done } = {}) {
  if (running || !players.length) { done?.(); return false; }
  emit("revealWordsWanted");
  const stage = stageFor(dim, center, openGround);
  const s = (running = { players, timers: [], actor: undefined });
  const at = (tick, fn) => s.timers.push(system.runTimeout(() => { if (running === s) { try { fn(); } catch (e) { console.warn(`[Bestiary] reveal: ${e}`); } } }, tick));
  const beat = (name) => announce("siege:morvane_reveal", { beat: name, x: Math.floor((stage?.desk ?? center).x), y: Math.floor((stage?.desk ?? center).y), z: Math.floor((stage?.desk ?? center).z), dimension: (stage?.dim ?? dim).id });
  const cams = stage ? cameras(stage.desk, stage.fwd) : undefined;

  // Everyone has seen it before: the short cut. Black, his one line, and on.
  if (players.every(seen)) {
    each(players, (p) => { lock(p, true); fade(p, 0.5, SCENE.shortCut / 20 - 1.5, 1); });
    at(30, () => { each(players, (p) => p.onScreenDisplay.setTitle("§r", { subtitle: `§7${words.lookUp ?? ""}`, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 })); emit("morvaneSays", { players, id: "look_up" }); });
    at(SCENE.shortCut, () => finish(done));
    return true;
  }

  // black, and one far bell
  beat("black");
  each(players, (p) => {
    lock(p, true);
    fade(p, 1, stage ? 3 : (BEATS.end - 40) / 20, 1.5); // with nowhere to stage it, the words are shown over black
    sfx(p, "block.bell.hit", { pitch: 0.5, volume: 0.35 });
    p.addEffect("resistance", BEATS.end + 100, { amplifier: 255, showParticles: false });
  });

  // the room, the boy, his back to us
  at(BEATS.room, () => {
    beat("room");
    if (!stage) return;
    onStage?.(stage);
    setActor(stage, "boy");
    each(players, (p) => {
      if (stage.park) p.teleport(stage.park, { dimension: stage.dim, facingLocation: stage.desk });
      p.addEffect("invisibility", BEATS.end + 100, { showParticles: false });
      shot(p, cams.behind);
    });
  });

  // the journal's line, word by word
  beat("words");
  const line = words.journalLine ?? "";
  const count = line.split(/\s+/).filter(Boolean).length;
  const lineEnds = BEATS.words + count * SCENE.perWord;
  for (let t = BEATS.words; t < BEATS.eyes + 100; t += SCENE.perWord) {
    at(t, () => {
      const by = t >= lineEnds + 20 && words.journalLineBy ? `\n§8${words.journalLineBy}` : "";
      each(players, (p) => p.onScreenDisplay.setActionBar(`§f§o${wrapLine(wordsAt(line, t))}§r${by}`));
    });
  }

  // round to his eyes and his right hand
  at(BEATS.eyes, () => { beat("eyes"); if (stage) each(players, (p) => shot(p, cams.eyes, (BEATS.age - BEATS.eyes - 20) / 20)); });

  // one unbroken shot: the room ages around the same pose
  at(BEATS.age, () => { if (stage) each(players, (p) => shot(p, cams.close, (BEATS.look_up - BEATS.age - 20) / 20)); });
  at(BEATS.age_king, () => { beat("age_king"); setActor(stage, "king"); });
  at(BEATS.age_morvane, () => { beat("age_morvane"); setActor(stage, "morvane"); each(players, (p) => sfx(p, "mob.wither.ambient", { pitch: 0.5, volume: 0.4 })); });

  // he looks up
  at(BEATS.look_up, () => {
    beat("look_up");
    try { if (stage && s.actor) s.actor.setRotation({ x: -12, y: yawOf(stage.fwd) }); } catch { /* gone */ }
    each(players, (p) => p.onScreenDisplay.setTitle("§r", { subtitle: `§f${words.lookUp ?? ""}`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 15 }));
    emit("morvaneSays", { players, id: "look_up" }); // his voice, the same one they have heard since their first dusk
  });

  // the journal changes
  at(BEATS.page, () => {
    beat("page");
    each(players, (player) => { emit("journalLastPage", { player }); sfx(player, "item.book.page_turn", { volume: 1 }); });
  });

  // every bell, for everyone on the server
  at(BEATS.bells, () => {
    beat("bells");
    for (const p of world.getAllPlayers()) { try { sfx(p, "block.bell.hit", { pitch: 0.7, volume: 0.9 }); } catch { /* gone */ } }
    if (words.bells) world.sendMessage(`§5${words.bells}`);
  });
  at(BEATS.bells + 25, () => { for (const p of world.getAllPlayers()) { try { sfx(p, "block.bell.hit", { pitch: 0.6, volume: 0.7 }); } catch { /* gone */ } } });

  at(BEATS.out, () => { if (stage) each(players, (p) => fade(p, 1, 1.5, 1)); });
  at(BEATS.end, () => { beat("end"); finish(done); });
  return true;
}

// A player who left in the middle comes back with their controls
world.afterEvents.playerSpawn.subscribe(({ player }) => {
  if (running?.players.some((p) => p.id === player.id)) return;
  lock(player, false);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const p = event.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  if (event.id === "siege:reveal_forget") { p.setDynamicProperty(SEEN, undefined); p.sendMessage("§7You have not seen it."); }
  if (event.id === "siege:reveal_test") {
    const f = p.getViewDirection(), d = Math.hypot(f.x, f.z) || 1;
    playReveal([p], { dim: p.dimension, center: { x: p.location.x + (f.x / d) * 8, y: p.location.y, z: p.location.z + (f.z / d) * 8 }, openGround: true });
  }
});

addTests("bestiary", {
  "the journal line writes itself a word at a time": () => {
    assertEqual(wordsAt("He is nine", BEATS.words - 1), "");
    assertEqual(wordsAt("He is nine", BEATS.words), "He");
    assertEqual(wordsAt("He is nine", BEATS.words + SCENE.perWord * 2), "He is nine");
    assertEqual(wordsAt("He is nine", 99999), "He is nine");
    assert(wrapLine("a".repeat(30) + " " + "b".repeat(30)).includes("\n"), "long lines are broken");
  },
  "the reveal's beats come in order and the cameras watch the desk": () => {
    const order = ["black", "room", "words", "eyes", "age", "age_king", "age_morvane", "look_up", "page", "bells", "out", "end"];
    for (let i = 1; i < order.length; i++) assert(BEATS[order[i]] > BEATS[order[i - 1]], `${order[i]} comes too early`);
    assert(BEATS.end >= 1200 - 40 && BEATS.end <= 1500, "about a minute");
    const c = cameras({ x: 0, y: 64, z: 0 }, { x: 0, z: -1 });
    assert(c.behind.pos.z > 0, "the first shot is from behind him");
    assertEqual(facingFrom({ x: 1204.5, z: 101.5 }, { x: 1200.5, z: 109.5 }), { x: 0, z: 1 }, "in the built room he faces +z");
    assert(c.eyes.pos.z < 0 && c.eyes.pos.x > 0, "the second is in front, on his right-hand side");
  },
});
