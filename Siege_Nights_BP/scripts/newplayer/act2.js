// Act 2, part 1, in the world (story-and-gameplay pass, Mateo 2026-11-14). The rules are in act2_rules.js; this file
// gathers the facts for them and makes the moments happen:
//   - Sir Aldous asks for the Ember, you keep it, and he sends you to the Tree of Oaths in your hall (lore dialogue).
//   - Touching the Tree with the Ember in your pack plays the choosing scene: the camera eases in on the Tree, three
//     tall panels (Give it up / Close your hand / Not yet, studio/build_tree_ui.py), a confirm in that road's voice,
//     then the moment: Aldous comes in and boxes the Ember for a Knight; three knocks from below and "Something
//     heard you" for the Marked; Elspeth's "Good. Keep it covered." for Not yet. Then the road pins.
//   - The first night after the choice, whatever the road, a far voice: "Keep it safe for me."
//   - A light pillar, seen only by you, stands over the chapterhouse or Mag's hut while that is your road.
//   - Part 2: the morning after the choice Elspeth sends you to the Moneyer with your iron; selling him a bar has him
//     tell you to build an Ironworks (pinned at your Works yard's marker); taking its first iron ends the part.
//   - Part 3: your plot's first local book names a place on your land ("That's here. That's my land."); riding to
//     the plot's old landmark you remember what the Order says happened there, and see it can't be so.
//
// Builder commands (creative / operators):
//   /scriptevent siege:act2           your Act 2 stage, its facts and the tracker's line
//   /scriptevent siege:act2 choose    play the choosing scene at your hall's Tree now (you need the Ember)
//   /scriptevent siege:act2 voice     hear the voice now

import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { on, addFilter } from "../core/events.js";
import { onTick, homeOf, getState, addTests, assert, assertEqual } from "../siege/api.js";
import { progressOf, setFlag } from "../lore/player.js";
import { addLoreContext } from "../lore/npcs.js";
import { aldousAt, aldousWitness, aldousRidesOn, elspethSpot } from "../lore/places.js";
import { markedPlaces } from "../lore/ledger.js";
import { heroOf } from "../townhall/hero.js";
import { hallOf } from "../townhall/townhall.js";
import { EMBER, choosePath } from "../townhall/tree.js";
import { WARDS, PLOT_PLAN } from "../plots/config.js";
import { plotOf } from "../plots/claims.js";
import { PLOT_LORE } from "../lore/data/plots.js";
import { localTomeIds, libraryShelfOf } from "../lore/local.js";
import { TOWNS } from "../economy/config.js";
import { ironworksFacts } from "../ironworks/index.js";
import { fallen } from "../quests/rules.js";
import { sfx } from "../core/sfx.js";
import { act2Stage, act2Step, inAct2, F2, PILLAR2, CHOICE_FLAG, ROADS, ROAD_ORDER, panelText, MOMENT, VOICE, voiceDue, choiceCamera, morningAfter, MONEYER_LINE, BOOK_PLACES, BOOK_NEAR, BOOK_THOUGHT } from "./act2_rules.js";

const OVERWORLD = "minecraft:overworld";
const CHOSE = "hc:act2_chose"; // absolute time of the choice at the Tree (the voice comes the first night after)

// ---------- facts ----------

const homeId = (player) => { try { return homeOf(player.id) ?? player.id; } catch { return player.id; } };
function carries(player, id) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it?.typeId === id) n += it.amount; }
  return n;
}
const mirelight = () => { const w = WARDS.find((x) => x.name === "Mirelight"); return w ? { x: w.x, z: w.z } : undefined; };
// Part 3: this player's plot's first local book { plot, title, read }, for a plot with its own books and landmark
function bookOf(player, p) {
  let plot;
  try { plot = plotOf(player.id)?.name; } catch { /* no plots */ }
  const lore = PLOT_LORE[plot];
  if (!lore || !BOOK_PLACES[plot] || !PLOT_PLAN.find((x) => x.name === plot)?.relic) return undefined;
  const id = localTomeIds(plot)[0];
  return { plot, title: lore.tomes[0].title, read: p.read.includes(id) };
}

// The nearest town with a Moneyer (economy/config.js TOWNS): his NPC carries the marker; the pin is his counter where
// the town gives him one (`at`, every town but Kingsrest, 2026-11-14), else the town
export function nearestMoneyer(pos) {
  let best;
  for (const t of TOWNS) {
    if (!t.jobs.includes("moneyer")) continue;
    const w = WARDS.find((x) => x.name === t.name);
    if (!w) continue;
    const d = Math.hypot(w.x - pos.x, w.z - pos.z);
    const at = t.at?.moneyer;
    if (!best || d < best.d) best = { name: t.name, x: at?.x ?? w.x, z: at?.z ?? w.z, d };
  }
  return best;
}

export function act2Facts(player) {
  const p = progressOf(player);
  const chose = player.getDynamicProperty(CHOSE);
  const f = {
    flags: p.flags, morvane: p.flags.includes("morvane_fallen"), path: heroOf(player).path ?? "none",
    ember: carries(player, EMBER) > 0, down: fallen(p.flags).length, chose: typeof chose === "number" ? chose : undefined,
    now: world.getAbsoluteTime(),
  };
  if (!inAct2(f)) return { f };
  const home = homeId(player);
  if (morningAfter(f.chose, f.now)) {
    try { f.ironworks = ironworksFacts(home); } catch { f.ironworks = { standing: false, built: 0 }; }
    f.haveIngot = carries(player, "minecraft:iron_ingot") > 0;
    f.book = bookOf(player, p);
  }
  const marked = (() => { try { return markedPlaces(); } catch { return {}; } })();
  const tree = hallOf(home)?.marks?.tree;
  const places = {
    aldous: aldousAt(home) ?? marked.ashen_chapterhouse, tree, chapterhouse: marked.ashen_chapterhouse, mag: marked.mags_hut ?? mirelight(),
    hearth: elspethSpot(home), moneyer: nearestMoneyer(player.location), works: f.ironworks?.at,
    shelf: libraryShelfOf(home), relic: f.book ? PLOT_PLAN.find((x) => x.name === f.book.plot)?.relic : undefined,
  };
  return { f, places, home };
}

const STAGE_EVERY = 40;
const cache = new Map(); // player id -> { at, stage, step, f, places, home }
export function act2Of(player, fresh = false) {
  const now = system.currentTick;
  const had = cache.get(player.id);
  if (!fresh && had && now - had.at < STAGE_EVERY) return had;
  let out = { at: now };
  try {
    const facts = act2Facts(player);
    const stage = act2Stage(facts.f);
    out = { at: now, ...facts, stage, on: stage !== undefined, step: stage ? act2Step(stage, facts.f, facts.places ?? {}) : undefined };
  } catch (e) { console.warn(`[Act 2] ${player.name}: ${e}`); }
  cache.set(player.id, out);
  return out;
}
const forget = (player) => { if (player?.id) cache.delete(player.id); };
for (const name of ["loreFlag", "pathChosen", "loreTomeRead"]) on(name, (d) => forget(d?.player));

// Part 2: the first bar sold to the Moneyer while he is your step, and the Ironworks' first iron taken
on("goodsSold", ({ player, job, id }) => {
  if (job !== "moneyer" || !String(id).endsWith("iron_ingot") || !player) return;
  if (act2Of(player, true).stage !== "moneyer") return;
  say(player, "Moneyer", MONEYER_LINE);
  setFlag(player, F2.sold);
});
on("ironworksTaken", ({ player }) => {
  if (!player || act2Of(player, true).stage !== "collect") return;
  setFlag(player, F2.collected);
  player.sendMessage("§7Iron you didn't dig yourself. It still looks like iron.");
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => { cache.delete(playerId); scenes.delete(playerId); });

// For the quest tracker (quests/index.js): { on, step }; the step is shown as the main step
export const act2Quest = (player) => { const a = act2Of(player); return { on: !!a.on, step: a.step }; };

// Aldous's scene reads the stage ("act2:talk_aldous": you left before he sent you to the Tree)
addLoreContext((player) => ({ act2: act2Of(player).stage }));

// ---------- the choosing scene ----------

const scenes = new Map(); // player id -> { timers }
const each = (fn) => { try { fn(); } catch (e) { console.warn(`[Act 2] scene: ${e}`); } };
function lock(player, on_) {
  try { player.inputPermissions.setPermissionCategory(2, !on_); } catch { /* older engine */ } // movement
  try { player.inputPermissions.setPermissionCategory(1, !on_); } catch { /* older engine */ } // camera
}
function release(player) {
  const s = scenes.get(player.id);
  for (const t of s?.timers ?? []) system.clearRun(t);
  scenes.delete(player.id);
  try { lock(player, false); } catch { /* left */ }
  try { player.camera.clear(); } catch { /* left */ }
  forget(player);
}
const later = (player, ticks, fn) => {
  const s = scenes.get(player.id);
  const t = system.runTimeout(() => { if (scenes.get(player.id) === s && player.isValid !== false) each(fn); }, ticks);
  s?.timers.push(t);
};
const shot = (player, cam, easeSeconds) => player.camera.setCamera("minecraft:free", {
  location: cam.pos, facingLocation: cam.look, ...(easeSeconds ? { easeOptions: { easeTime: easeSeconds, easeType: "InOutSine" } } : {}),
});
function say(player, who, line) {
  player.sendMessage(`§6${who}:§f ${line}`);
  try { player.onScreenDisplay.setActionBar(`§7${who}: §f${line}`); } catch { /* cosmetic */ }
}
function hum(player, tree) {
  for (let i = 0; i < 6; i++) {
    try { player.spawnParticle("minecraft:end_rod", { x: tree.x + 0.5 + (Math.random() - 0.5) * 1.6, y: tree.y + 1 + Math.random() * 2, z: tree.z + 0.5 + (Math.random() - 0.5) * 1.6 }); } catch { /* not loaded */ }
  }
}

// Start the scene at this Tree (block location). False when it can't (no Ember, already chosen, a scene running).
export function playChoice(player, tree) {
  if (!tree || scenes.has(player.id) || heroOf(player).path !== "none" || carries(player, EMBER) <= 0) return false;
  scenes.set(player.id, { timers: [], tree });
  lock(player, true);
  const cam = choiceCamera(tree, player.location);
  each(() => shot(player, cam, 1.6));
  sfx(player, "beacon.ambient", { volume: 0.7, pitch: 1.4 });
  for (let t = 0; t <= 30; t += 10) later(player, t, () => hum(player, tree));
  later(player, 36, () => showPanels(player));
  return true;
}

function showPanels(player) {
  const form = new ActionFormData().title(`${CHOICE_FLAG}The Ember`)
    .body("It hums in your hand. Aldous wants it. Elspeth said: give him nothing you haven't read.");
  for (const id of ROAD_ORDER) form.button(panelText(id), ROADS[id].art);
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return release(player); // walked away: the step stays
    confirmRoad(player, ROAD_ORDER[r.selection]);
  }).catch(() => release(player));
}

function confirmRoad(player, id) {
  const c = ROADS[id]?.confirm;
  if (!c) return release(player);
  new MessageFormData().title(c.title).body(c.text + (c.warn ? "\n\n§cThis cannot be undone." : ""))
    .button1(c.go).button2("Back")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return showPanels(player);
      moment(player, id);
    }).catch(() => release(player));
}

function lines(player, id, start = 0) {
  let t = start;
  for (const [who, line, wait] of MOMENT[id]) { t += wait; later(player, t, () => say(player, who, line)); }
  return t;
}

function moment(player, id) {
  const s = scenes.get(player.id);
  const tree = s?.tree;
  const owner = homeId(player);
  player.setDynamicProperty(CHOSE, world.getAbsoluteTime());
  if (id === "knight") {
    // Aldous comes in: he stands between you and the Tree, takes the Ember into a lead box, and rides on
    let aldous;
    each(() => {
      const dx = player.location.x - (tree.x + 0.5), dz = player.location.z - (tree.z + 0.5), d = Math.hypot(dx, dz) || 1;
      aldous = aldousWitness(owner, { x: tree.x + 0.5 + (dx / d) * 1.5, y: tree.y, z: tree.z + 0.5 + (dz / d) * 1.5 });
      aldous?.lookAt?.(player.getHeadLocation());
    });
    later(player, 20, () => choosePath(player, "knight")); // the Ember is sealed, the Oath Banner is yours, "Oathsworn"
    const end = lines(player, "knight", 20);
    later(player, end + 40, () => player.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.6, holdTime: 0.4, fadeOutTime: 0.8 } }));
    later(player, end + 55, () => { aldousRidesOn(owner); release(player); });
  } else if (id === "marked") {
    // the Ember sinks in, the hall goes dark, three knocks from far below, then "Something heard you"
    sfx(player, "beacon.activate", { volume: 0.6, pitch: 1.8 });
    later(player, 4, () => player.addEffect("darkness", 120, { showParticles: false }));
    for (const t of [24, 40, 56]) later(player, t, () => sfx(player, "random.door_close", { volume: 1, pitch: 0.45 }));
    later(player, 80, () => choosePath(player, "marked"));
    const end = lines(player, "marked", 80);
    later(player, end + 40, () => release(player));
  } else {
    // Not yet: the camera pulls back from the Tree, and Elspeth speaks from the hearth
    setFlag(player, F2.wait);
    each(() => shot(player, { pos: player.getHeadLocation(), look: { x: tree.x + 0.5, y: tree.y + 1.4, z: tree.z + 0.5 } }, 1.4));
    const end = lines(player, "wait", 10);
    later(player, end + 40, () => release(player));
  }
}

// The Tree: holding the Ember (in your pack) while you are still on no road plays the scene instead of the menu
addFilter("treeScene", (done, { player, block }) => {
  if (done) return done;
  try {
    const at = block?.location ?? hallOf(homeId(player))?.marks?.tree;
    return playChoice(player, at);
  } catch (e) { console.warn(`[Act 2] tree: ${e}`); return false; }
});

// ---------- the loop: the pillar and the voice ----------

function pillar(player, target) {
  if (!target || player.dimension.id !== OVERWORLD) return;
  const l = player.location;
  if (Math.hypot(target.x - l.x, target.z - l.z) > 192) return;
  const base = target.y ?? l.y - 8;
  for (let h = 0; h <= 60; h += 3) {
    try { player.spawnParticle("minecraft:end_rod", { x: target.x + 0.5, y: base + h, z: target.z + 0.5 }); } catch { /* not loaded */ }
  }
}

// The book's place: the thought when the step begins (the book may have been read long before), then, standing
// there, what the Order says and what you see
function thought(player, line) {
  player.sendMessage(`§7§o${line}`);
  try { player.onScreenDisplay.setActionBar(`§7§o${line}`); } catch { /* cosmetic */ }
}
function bookPlace(player, a) {
  const b = a.f.book, there = a.places?.relic, words = BOOK_PLACES[b?.plot];
  if (!b || !words) return;
  if (!a.f.flags.includes(F2.bookThought)) { thought(player, BOOK_THOUGHT); setFlag(player, F2.bookThought); forget(player); return; }
  if (!there || player.dimension.id !== OVERWORLD || Math.hypot(player.location.x - there.x, player.location.z - there.z) > BOOK_NEAR) return;
  setFlag(player, F2.bookSeen);
  forget(player);
  thought(player, `The Order says ${words.order}`);
  system.runTimeout(() => { try { thought(player, words.see); sfx(player, "ambient.cave", { volume: 0.3, pitch: 1.2 }); } catch { /* left */ } }, 80);
}

export function speakVoice(player) {
  sfx(player, "ambient.cave", { volume: 0.5, pitch: 0.7 });
  try { player.onScreenDisplay.setTitle("§r", { subtitle: `§7§o${VOICE}`, fadeInDuration: 30, stayDuration: 60, fadeOutDuration: 40 }); } catch { /* cosmetic */ }
  setFlag(player, F2.voice);
}

onTick("act2", 20, () => {
  for (const player of world.getAllPlayers()) {
    try {
      const a = act2Of(player);
      if (!a.f) continue;
      if (a.on && PILLAR2.has(a.stage)) pillar(player, { chapterhouse: a.places?.chapterhouse, mag: a.places?.mag, book_place: a.places?.relic }[a.stage]);
      if (a.stage === "book_place") bookPlace(player, a);
      if (scenes.has(player.id) || player.dimension.id !== OVERWORLD) continue;
      if (voiceDue(a.f, world.getAbsoluteTime(), world.getTimeOfDay()) && !getState().active) { speakVoice(player); forget(player); }
    } catch (e) { console.warn(`[Act 2] ${e}`); }
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:act2" || player?.typeId !== "minecraft:player") return;
  const arg = message.trim();
  if (arg === "voice") return speakVoice(player);
  if (arg === "choose") {
    const tree = hallOf(homeId(player))?.marks?.tree;
    if (!tree) return player.sendMessage("§cYour hall has no Tree of Oaths yet.");
    return player.sendMessage(playChoice(player, tree) ? "§6The choosing scene is playing." : "§cNo scene: you need the Ember in your pack and no road chosen yet.");
  }
  const a = act2Of(player, true);
  const f = a.f ?? {};
  player.sendMessage(`§6Act 2 stage:§f ${a.stage ?? "none"}\n§7path ${f.path} ember ${f.ember} bosses down ${f.down} chose ${f.chose ?? "-"} voice ${f.flags?.includes(F2.voice)} ironworks ${f.ironworks ? `${f.ironworks.standing}/${f.ironworks.built}` : "-"}`);
  if (a.step) player.sendMessage(`§6${a.step.title}§7 ${a.step.hint}`);
});

addTests("act2", {
  "Act 2: Aldous, the Tree, then the road you chose": () => {
    const met = { flags: [F2.aldous], path: "none", ember: true, down: 0, chose: 30000, now: 31000 }; // before the morning after
    assertEqual(act2Stage({ ...met, flags: [] }), undefined, "Act 2 starts with Sir Aldous");
    assertEqual(act2Stage(met), "talk_aldous");
    const sent = { ...met, flags: [F2.aldous, F2.tree] };
    assertEqual(act2Stage(sent), "tree");
    assertEqual(act2Stage({ ...sent, ember: false }), undefined, "no Ember, no Tree step");
    assertEqual(act2Stage({ ...sent, flags: [...sent.flags, F2.wait], chose: 30000, now: 31000 }), undefined, "Not yet: no road, and the bills wait for morning");
    assertEqual(act2Stage({ ...sent, path: "knight" }), "chapterhouse");
    assertEqual(act2Stage({ ...sent, path: "knight", flags: [...sent.flags, F2.cael] }), undefined);
    assertEqual(act2Stage({ ...sent, path: "marked" }), "mag");
    assertEqual(act2Stage({ ...sent, path: "marked", flags: [...sent.flags, F2.mag] }), undefined);
    assertEqual(act2Stage({ ...sent, path: "witch" }), undefined, "a regional role: no Ember road");
    assertEqual(act2Stage({ ...sent, down: 1 }), undefined, "worlds past their first boss keep their story");
  },
  "Act 2: the morning after, Elspeth's bills, the Moneyer, the Ironworks": () => {
    const done = { flags: [F2.aldous, F2.tree, F2.wait], path: "none", down: 0, chose: 30000 };
    assertEqual(act2Stage({ ...done, now: 40000 }), undefined, "the bills wait for the morning after the choice");
    assertEqual(act2Stage({ ...done, now: 48000 }), "talk_bills");
    assertEqual(act2Stage({ ...done, chose: undefined, now: 0 }), "talk_bills", "a choice from before this counts as long ago");
    const kn = { ...done, path: "knight", flags: [F2.aldous, F2.tree], now: 99000 };
    assertEqual(act2Stage(kn), "chapterhouse", "your road comes first");
    const billed = { ...done, now: 50000, flags: [...done.flags, F2.bills] };
    assertEqual(act2Stage(billed), "moneyer");
    const sold = { ...billed, flags: [...billed.flags, F2.sold] };
    assertEqual(act2Stage({ ...sold, ironworks: { standing: false, built: 0 } }), "ironworks");
    assertEqual(act2Stage({ ...sold, ironworks: { standing: true, built: 0 } }), "ironworks", "still rising");
    assertEqual(act2Stage({ ...sold, ironworks: { standing: true, built: 1 } }), "collect");
    assertEqual(act2Stage({ ...sold, ironworks: { standing: true, built: 1 }, flags: [...sold.flags, F2.collected] }), undefined);
  },
  "Act 2: the book's place, after the Ironworks": () => {
    const base = { flags: [F2.aldous, F2.tree, F2.wait, F2.bills, F2.sold, F2.collected], path: "none", down: 0, now: 99000, ironworks: { standing: true, built: 1 } };
    assertEqual(act2Stage(base), undefined, "a plot without its own books has no book step");
    const book = { plot: "Harrowford", title: "The Ferryman's Tally", read: false };
    assertEqual(act2Stage({ ...base, book }), "read_book");
    assertEqual(act2Stage({ ...base, book: { ...book, read: true } }), "book_place");
    assertEqual(act2Stage({ ...base, book: { ...book, read: true }, flags: [...base.flags, F2.bookSeen] }), undefined);
    for (const plot of Object.keys(PLOT_LORE)) {
      const w = BOOK_PLACES[plot];
      assert(w?.place && w.order && w.see, `${plot} has a place, the Order's word and what you see`);
      assert(!/hollow|truce|oswin|edda|morvane/i.test(w.place + w.order + w.see), `${plot}'s lines name nothing Act 2 keeps back`);
      assert(PLOT_PLAN.find((x) => x.name === plot)?.relic, `${plot} has a landmark to ride to`);
    }
  },
  "Act 2: every step names its source and pins a place": () => {
    const p = { aldous: { x: 1, z: 2 }, tree: { x: 3, z: 4 }, chapterhouse: { x: 5, z: 6 }, mag: { x: 7, z: 8 }, hearth: { x: 9, z: 9 }, moneyer: { x: 0, z: 0, name: "Kingsrest" }, works: { x: 2, z: 2 }, shelf: { x: 1, z: 1 }, relic: { x: 3, z: 3 } };
    const f = { book: { plot: "Harrowford", title: "The Ferryman's Tally", read: true } };
    for (const stage of ["talk_aldous", "tree", "chapterhouse", "mag", "talk_bills", "moneyer", "ironworks", "collect", "read_book", "book_place"]) {
      const s = act2Step(stage, f, p);
      assert(s?.title && s.hint && s.target, `${stage} has a line, a hint and a pin`);
      assert(/Aldous|Elspeth|Moneyer|morning|night|book|Somebody/.test(s.hint), `${stage} says who sent you`);
    }
    assert(nearestMoneyer({ x: 0, z: 0 })?.name, "there is a Moneyer to send you to");
    for (const id of ROAD_ORDER) assert(panelText(id).includes(ROADS[id].name) && ROADS[id].confirm.go && MOMENT[id].length, `${id} has a panel, a confirm and a moment`);
  },
  "Act 2: the voice comes the first deep night after the choice, once": () => {
    const f = { flags: [], chose: 1000 };
    assertEqual(voiceDue(f, 1100, 18000), false, "not in the same breath as the scene");
    assertEqual(voiceDue(f, 5000, 8000), false, "not by day");
    assertEqual(voiceDue(f, 5000, 18000), true);
    assertEqual(voiceDue({ ...f, flags: [F2.voice] }, 5000, 18000), false, "only once");
    assertEqual(voiceDue({ flags: [] }, 5000, 18000), false, "not before any choice");
  },
  "Act 2: the walk-up camera stands between you and the Tree": () => {
    const cam = choiceCamera({ x: 0, y: 64, z: 0 }, { x: 10, y: 64, z: 0.5 });
    assert(cam.pos.x > 0.5 && cam.pos.x <= 4.1, "toward the player, a few blocks off");
    assertEqual(cam.look.x, 0.5);
  },
});
