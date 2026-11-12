// Dispatch: the alerts that go out to the group's Discord.
//
// A Realm can't make web requests, so alerts can't be posted from here. Instead every alert goes into a
// numbered queue saved in the world, and leaves through a RELAY: a second Minecraft account, run by
// tools/discord-relay/relay.mjs, that drops into the world now and then. When a player with the tag
// hc_relay is online, the queue is sent to them as private chat lines ("HCA1|{json}") that nobody else
// sees, and the relay program posts each one to Discord. Every alert is also printed to the content log
// as "[HC-ALERT] {json}", so on a dedicated server the same program can read the server log instead.
// With no relay and no server, the queue just fills and the oldest alerts drop off. Nothing in the game
// waits on Discord, so single player plays the same.
//
//   emit("discordAlert", { kind: "vaultOpen", text: "Mateo's vault is open.", ping: [playerName], hollow: false })
//
// kind    a short word, for the relay's log
// text    the line posted to Discord, plain words (colour codes are stripped)
// ping    player names to @-mention on Discord (the relay's config pairs gamertags with Discord accounts)
// hollow  true for anything that names the Hollow or what comes from it: held back until someone in this
//         world has entered the Hollow, so Discord never spoils it before the story does.
//
// While the relay is the ONLY one online, the day cycle is frozen and no siege night can start, so its
// short visits never move the world forward. Setup for Mateo: docs/DISCORD.md. Test: /scriptevent hc:dispatch_test

import { world, system, GameMode } from "@minecraft/server";
import { on, addFilter } from "../core/events.js";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { DISPATCH } from "./config.js";

export const RELAY_TAG = "hc_relay";
const PREFIX = "HCA1|";

const store = moduleStore("hc:dispatch", () => ({
  n: 0, // number of the last alert queued
  sent: 0, // number of the last alert handed to a relay
  queue: [], // [{ n, t, kind, text, ping }]
  hollowSeen: false, // someone in this world has entered the Hollow
  away: {}, // template holders who left: id -> { name, left, warned, opened }
  frozeDay: false, // we turned the day cycle off for a relay-only visit
}));

// ---------- pure helpers (tested in Node) ----------

export const plain = (text) => String(text ?? "").replace(/§./g, "").replace(/\s+/g, " ").trim();

// Add an alert to a queue object; returns the alert, or null when it is held back.
export function enqueue(q, { kind = "note", text, ping = [], hollow = false }, now = Date.now(), max = DISPATCH.queueSize) {
  const line = plain(text);
  if (!line) return null;
  if (hollow && !q.hollowSeen) return null;
  q.n += 1;
  const alert = { n: q.n, t: now, kind: String(kind), text: line.slice(0, 1800), ping: [...new Set(ping.filter(Boolean).map(String))] };
  q.queue.push(alert);
  if (q.queue.length > max) q.queue.splice(0, q.queue.length - max);
  return alert;
}

export const encode = (alert) => PREFIX + JSON.stringify(alert);

// The relay side reads lines back with the same rule (tools/discord-relay/relay.mjs keeps a copy).
export function decode(line) {
  const at = String(line).indexOf(PREFIX);
  if (at < 0) return null;
  try {
    const a = JSON.parse(String(line).slice(at + PREFIX.length));
    return typeof a.n === "number" && typeof a.text === "string" ? a : null;
  } catch {
    return null;
  }
}

// What an away template holder should trigger now: "warn", "open" or nothing.
export function awayStep(rec, now, { openHours = DISPATCH.vaultOpenHours, warnHours = DISPATCH.warnHoursBefore } = {}) {
  const gone = (now - rec.left) / 3600000;
  if (!rec.opened && gone >= openHours) return "open";
  if (!rec.warned && !rec.opened && warnHours > 0 && gone >= openHours - warnHours) return "warn";
  return null;
}

// ---------- in the world ----------

const isRelay = (p) => {
  try {
    return p.hasTag(RELAY_TAG);
  } catch {
    return false;
  }
};
const relays = () => world.getPlayers().filter(isRelay);
export const onlyRelaysOnline = () => {
  const all = world.getPlayers();
  return all.length > 0 && all.every(isRelay);
};

export function dispatch(alert) {
  const q = store.data;
  const a = enqueue(q, alert);
  if (!a) return null;
  store.save();
  console.log(`[HC-ALERT] ${JSON.stringify(a)}`);
  deliver();
  return a;
}

// Hand every alert the relay hasn't had yet to each relay online. The relay program drops repeats by number.
function deliver() {
  const q = store.data;
  const to = relays();
  if (!to.length) return;
  const fresh = q.queue.filter((a) => a.n > q.sent);
  if (!fresh.length) return;
  for (const p of to) for (const a of fresh) {
    try {
      p.sendMessage(encode(a));
    } catch {
      return; // they left mid-way; the rest go next visit
    }
  }
  q.sent = fresh.at(-1).n;
  store.save();
}

// Freeze the world while only the relay is here; give it back the moment anyone else joins.
function holdStill() {
  const q = store.data;
  const still = onlyRelaysOnline();
  if (still && !q.frozeDay) {
    let on = true;
    try {
      on = world.gameRules.doDayLightCycle;
    } catch { /* older API: assume it was on */ }
    if (!on) return;
    try {
      world.getDimension("overworld").runCommand("gamerule dodaylightcycle false");
      q.frozeDay = true;
      store.save();
    } catch { /* not allowed here */ }
  } else if (!still && q.frozeDay) {
    try {
      world.getDimension("overworld").runCommand("gamerule dodaylightcycle true");
    } catch { /* try again next check */ return; }
    q.frozeDay = false;
    store.save();
  }
}
addFilter("siegeDue", (due) => (due && onlyRelaysOnline() ? false : undefined));

// Template holders who are away: warn them, then tell everyone. The siege thread's Strongroom vault
// will make "open" mean something in game; until then the line says they've been away with it.
function checkAway() {
  const q = store.data;
  const now = Date.now();
  let changed = false;
  for (const rec of Object.values(q.away)) {
    const step = awayStep(rec, now);
    if (step === "warn") {
      rec.warned = true;
      changed = true;
      dispatch({ kind: "vaultWarning", text: DISPATCH.text.vaultWarning(rec.name, DISPATCH.warnHoursBefore), ping: [rec.name], hollow: true });
    } else if (step === "open") {
      rec.opened = true;
      changed = true;
      dispatch({ kind: "vaultOpen", text: DISPATCH.text.vaultOpen(rec.name), ping: [], hollow: true });
    }
  }
  if (changed) store.save();
}

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  try {
    if (isRelay(player) || !player.hasTag(DISPATCH.holderTag)) return;
    const rec = { name: player.name, left: Date.now(), warned: false, opened: false };
    const id = player.id;
    system.run(() => {
      store.data.away[id] = rec;
      store.save();
    });
  } catch { /* leaving */ }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  if (isRelay(player)) {
    try {
      player.setGameMode(GameMode.Spectator); // out of the way: mobs, raiders and pressure plates ignore it
    } catch { /* fine */ }
    system.runTimeout(() => {
      checkAway();
      deliver();
      holdStill();
    }, 40);
    return;
  }
  const rec = store.data.away[player.id];
  if (rec) {
    delete store.data.away[player.id];
    store.save();
    if (rec.opened) dispatch({ kind: "vaultClosed", text: DISPATCH.text.vaultClosed(player.name), hollow: true });
  }
  system.runTimeout(holdStill, 20);
});

world.afterEvents.playerLeave.subscribe(() => system.runTimeout(holdStill, 20));

onTick("dispatch", 1200, () => {
  checkAway();
  deliver();
  holdStill();
}); // once a minute

// ---------- what goes out ----------

const nameOf = (id) => world.getPlayers().find((p) => p.id === id)?.name;
const T = DISPATCH.text;
const send = (kind, text, extra = {}) => dispatch({ kind, text, ...extra });

on("discordAlert", (a) => dispatch(a ?? {}));
on("hollowEntered", () => {
  if (store.data.hollowSeen) return;
  store.data.hollowSeen = true;
  store.save();
});
on("siegeStart", () => send("siegeStart", T.siegeStart()));
on("siegeEnd", ({ outcome, besieged }) => {
  if (outcome === "test") return;
  send("siegeEnd", T.siegeEnd(besieged?.length ?? 0));
});
on("keepFallen", ({ owner }) => {
  const name = nameOf(owner);
  send("keepFallen", T.keepFallen(name), { ping: [name] });
});
on("keepFounded", ({ player, moved }) => {
  if (!moved) send("keepFounded", T.keepFounded(player?.name));
});
on("tierUp", ({ owner, after }) => send("tierUp", T.tierUp(nameOf(owner), after)));
on("rivalMarch", ({ lord, player }) => {
  const name = typeof player === "string" ? nameOf(player) : player?.name;
  send("rivalMarch", T.rivalMarch(lord?.name, name), { ping: [name] });
});
on("crowned", ({ name }) => send("crowned", T.crowned(name)));
on("crownVacant", () => send("crownVacant", T.crownVacant()));
on("stormStart", ({ ruler }) => send("stormStart", T.stormStart(), { ping: [nameOf(ruler)] }));
on("stormEnd", ({ winner, usurped }) => send("stormEnd", T.stormEnd(nameOf(winner), usurped)));
on("forgeTemplateTaken", () => send("templateTaken", T.templateTaken(), { hollow: true }));
on("dragonDied", ({ ownerName, name }) => send("dragonDied", T.dragonDied(name), { ping: [ownerName] }));
on("hollowRobbery", ({ robberName, village }) => send("hollowRobbery", T.hollowRobbery(robberName, village), { hollow: true }));

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id !== "hc:dispatch_test") return;
  const a = dispatch({ kind: "test", text: "A test alert from the Hollow Crown. If you can read this on Discord, the relay works." });
  try {
    sourceEntity?.sendMessage?.(a ? `§7Queued test alert #${a.n}. Relays online: ${relays().length}.` : "§7Nothing queued.");
  } catch { /* console */ }
});

addTests("dispatch", {
  "alerts are numbered, cleaned of colour codes and capped": () => {
    const q = { n: 0, queue: [], hollowSeen: false };
    for (let i = 0; i < 5; i++) enqueue(q, { kind: "x", text: `§cline ${i}`, ping: ["A", "A", null] }, 1000, 3);
    assertEqual(q.queue.map((a) => a.n), [3, 4, 5]);
    assertEqual(q.queue.at(-1).text, "line 4");
    assertEqual(q.queue.at(-1).ping, ["A"]);
    assertEqual(enqueue(q, { text: "  " }), null);
  },
  "Hollow alerts wait until someone has entered the Hollow": () => {
    const q = { n: 0, queue: [], hollowSeen: false };
    assertEqual(enqueue(q, { text: "the template is gone", hollow: true }), null);
    q.hollowSeen = true;
    assert(enqueue(q, { text: "the template is gone", hollow: true }));
  },
  "a relay line reads back as the same alert": () => {
    const a = { n: 7, t: 5, kind: "siegeStart", text: "Siege night | all \"settlements\"", ping: ["Mateo"] };
    assertEqual(decode(`<Server> ${encode(a)}`), a);
    assertEqual(decode("hello"), null);
    assertEqual(decode("HCA1|{broken"), null);
  },
  "an away holder is warned before the vault opens, once each": () => {
    const h = 3600000;
    const rec = { left: 0, warned: false, opened: false };
    const o = { openHours: 24, warnHours: 2 };
    assertEqual(awayStep(rec, 21 * h, o), null);
    assertEqual(awayStep(rec, 22 * h, o), "warn");
    rec.warned = true;
    assertEqual(awayStep(rec, 23 * h, o), null);
    assertEqual(awayStep(rec, 24 * h, o), "open");
    rec.opened = true;
    assertEqual(awayStep(rec, 99 * h, o), null);
    assertEqual(awayStep({ left: 0, warned: false, opened: false }, 30 * h, o), "open"); // nobody was on to warn: go straight to open
  },
  "every alert line reads well with names missing": () => {
    for (const [k, fn] of Object.entries(DISPATCH.text)) {
      const line = plain(fn(undefined, undefined));
      assert(line.length > 5 && !/undefined|null|NaN/.test(line), `${k}: ${line}`);
    }
  },
});
