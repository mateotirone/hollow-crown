// The Homecomings (Act V, the endless layer; Mateo picked it to build first with the Five Chairs, 2026-11-11).
// With Morvane gone nothing below holds on to the people the Hollow took, and they start coming back up:
// one stranger every 5 to 9 days, at dawn, beside a player in the overworld. Each is put together from the
// pools in data/homecomings.js (rules.js makeStranger), never like the one before.
//
//   Talk to them   They say who they were, how they went down, who they are looking for, and what they want.
//   Bring it       Give them the thing and their story ends one of four ways (the twist):
//                    true   exactly who they say: they stay in your settlement, or go on their way
//                    kin    true, and a family of their name still lives at another settlement: they go there
//                    back   true, but everyone they knew is below now: they go back down
//                    copy   one of the Returned, and it doesn't know. It stays if you let it. A bell shows the truth
//                           (bestiary/returned.js does the walking off).
//   Thanks         Whoever helps gets a keepsake with the stranger's name on it, and a story skill point.
//   Nobody helps   After 4 days they give up and walk off.
//
// Events out:  "homecoming" { player, name, twist, ending }   ending: "stay" | "kin" | "back" | "away" | "exposed" | "left"
// Test (creative): /scriptevent siege:homecoming_now [seed]   a stranger appears beside you now
//                  /scriptevent siege:homecoming               status

import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick, moduleStore, emit, countItem, takeItems, getState, isReady, isNight, settlementAt } from "../siege/api.js";
import { markReturned } from "../bestiary/returned.js";
import { giveItem, awardPoints } from "../lore/player.js";
import { sfx } from "../core/sfx.js";
import { ENDING, KEEPSAKE } from "./data/homecomings.js";
import { AFTER, makeStranger, strangerStory, askOf, fill, freshLine, nextHomecoming } from "./rules.js";
import { morvaneFallen } from "./chairs.js";

const TYPE = "minecraft:villager_v2";
const TAG = "siege_after_stranger";

export const homes = moduleStore("siege:after_home", () => ({ nextDay: undefined, current: undefined, names: [], last: undefined, count: 0, said: {} }));
const today = () => { try { return world.getDay(); } catch { return 0; } };
const timeOfDay = () => { try { return world.getTimeOfDay(); } catch { return 0; } };

function say(pool, s, extra) {
  const d = homes.data, list = ENDING[pool];
  const i = freshLine(list, d.said[pool], Math.random());
  d.said[pool] = i;
  return fill(list[i], s, extra);
}

// Another settlement's name for a stranger who still has family: anyone else's keep, else a town of the old map.
function kinSettlement(ownerId) {
  try {
    const names = Object.entries(getState().keeps ?? {}).filter(([owner]) => owner !== ownerId).map(([, k]) => k.name).filter(Boolean);
    if (names.length) return names[Math.floor(Math.random() * names.length)];
  } catch { /* not ready */ }
  return ["Millbrook", "Gull's Rest", "Rimehold", "Sunscar", "Mirelight"][Math.floor(Math.random() * 5)];
}

function arrive(player, seed) {
  const d = homes.data;
  const s = makeStranger(seed ?? Math.floor(Math.random() * 2 ** 31), { names: d.names, last: d.last });
  const v = player.getViewDirection(), l = player.location;
  const at = { x: l.x + v.x * 6, y: l.y, z: l.z + v.z * 6 };
  // vanilla villager on purpose: one in four strangers is a Returned copy, and must look like any villager (bestiary/returned.js)
  const e = player.dimension.spawnEntity(TYPE, at);
  e.addTag(TAG);
  e.nameTag = s.name;
  if (s.twist === "copy") markReturned(e, { name: s.name, quest: "homecoming" });
  d.count += 1;
  d.names = [...d.names, s.name].slice(-AFTER.nameMemory);
  d.last = { when: s.when, ask: s.ask, twist: s.twist };
  d.current = { stranger: s, day: today(), owner: player.id, at, dim: player.dimension.id, entity: e.id, met: false };
  homes.save();
  let where = "the road";
  try { if (isReady()) where = getState().keeps[settlementAt(at)]?.name ?? where; } catch { /* not ready */ }
  player.sendMessage(`§7Someone is standing at the edge of ${where}, looking at everything as if they had never seen grass. They are soaked to the skin.`);
  sfx(player, "block.bell.hit", { volume: 0.2, pitch: 0.6 });
  return e;
}

function finish(ending, player, extra = {}) {
  const d = homes.data, c = d.current;
  if (!c) return;
  d.current = undefined;
  d.nextDay = nextHomecoming(today(), Math.random());
  homes.save();
  emit("homecoming", { player: player?.id, name: c.stranger.name, twist: c.stranger.twist, ending, ...extra });
}

const strangerEntity = () => {
  const c = homes.data.current;
  if (!c) return undefined;
  try { return world.getDimension(c.dim).getEntities({ tags: [TAG] }).find((e) => e.nameTag === c.stranger.name); } catch { return undefined; }
};

function release(e, keep) {
  try {
    e.removeTag(TAG);
    if (!keep) {
      e.dimension.spawnParticle("minecraft:soul_particle", { x: e.location.x, y: e.location.y + 1, z: e.location.z });
      e.remove();
    }
  } catch { /* gone */ }
}

function thank(player, s) {
  const [item, label] = KEEPSAKE[s.keepsake % KEEPSAKE.length];
  try {
    const keepsake = new ItemStack(item, 1);
    keepsake.nameTag = `§f${fill(label, s)}`;
    keepsake.setLore([`§7${s.name} came home.`]);
    giveItem(player, keepsake);
  } catch { /* the thanks is the words */ }
  awardPoints(player, 1, "story", 15);
}

// ---------- talking to them ----------
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target.typeId !== TYPE || !ev.target.hasTag(TAG)) return;
  ev.cancel = true;
  const p = ev.player, e = ev.target;
  system.run(() => talk(p, e));
});

function talk(p, e) {
  const c = homes.data.current;
  if (!c || e.nameTag !== c.stranger.name) return release(e, true); // an old stranger from a lost save: let them be a villager
  const s = c.stranger, a = askOf(s);
  const lines = c.met ? [`"${a.line}"`] : strangerStory(s);
  if (!c.met) { c.met = true; homes.save(); }
  const has = countItem(p, a.item) >= a.n || p.getGameMode() === GameMode.Creative;
  const thing = `${a.n} × ${a.item.replace("minecraft:", "").replace(/_/g, " ")}`;
  const form = new ActionFormData().title(s.name).body(lines.join("\n\n"));
  const acts = [];
  if (has) { form.button(`Give them ${thing}`); acts.push(() => give(p, e)); }
  else { form.button(`§8You have no ${thing}`); acts.push(() => p.sendMessage(`§f${s.name}: "${say("noItem", s)}"`)); }
  form.button("Leave them be"); acts.push(() => {});
  form.show(p).then((r) => { if (!r.canceled && r.selection !== undefined) acts[r.selection]?.(); }).catch(() => {});
}

function give(p, e) {
  const c = homes.data.current;
  if (!c) return;
  const s = c.stranger, a = askOf(s);
  if (p.getGameMode() !== GameMode.Creative) {
    if (countItem(p, a.item) < a.n) return;
    takeItems(p, a.item, a.n);
  }
  p.sendMessage(`§f${s.name}: "${say("thanks", s)}"`);
  thank(p, s);
  if (s.twist === "kin") {
    const town = kinSettlement(c.owner);
    p.sendMessage(`§f${s.name}: "${say("kin", s, { settlement: town })}"`);
    release(e, false);
    return finish("kin", p, { settlement: town });
  }
  if (s.twist === "back") {
    p.sendMessage(`§f${s.name}: "${say("back", s)}"`);
    p.sendMessage(`§8${s.name} walks toward the nearest water, and does not look back.`);
    release(e, false);
    return finish("back", p);
  }
  // true or copy: they ask where to go.
  const form = new ActionFormData().title(s.name).body(`"Where should I go now?"`);
  form.button("Stay here, with us");
  form.button("Go wherever you like");
  form.show(p).then((r) => {
    if (r.canceled || r.selection === undefined || r.selection === 0) {
      p.sendMessage(`§f${s.name}: "${say(s.twist === "copy" ? "copyStay" : "stay", s)}"`);
      release(e, true); // they become one of your villagers (a copy stays marked: watch it)
      return finish("stay", p);
    }
    p.sendMessage(`§8${s.name} thanks you again and sets off down the road.`);
    release(e, false);
    finish("away", p);
  }).catch(() => {});
}

// A bell rung near a true stranger: they flinch, and remember. (A copy is bestiary/returned.js's business.)
world.afterEvents.playerInteractWithBlock.subscribe(({ block, player }) => {
  if (block?.typeId !== "minecraft:bell") return;
  const c = homes.data.current, e = strangerEntity();
  if (!c || !e || c.stranger.twist === "copy") return;
  try {
    const dl = e.location, bl = block.location;
    if (Math.hypot(dl.x - bl.x, dl.y - bl.y, dl.z - bl.z) > 16) return;
  } catch { return; }
  player.sendMessage(`§f${c.stranger.name}§7 flinches, then laughs at themselves. §f"They rang them like that the night I went down. I'm all right. I'm all right."`);
});

// A copy the bell gave away
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "siege:returned_exposed") return;
  let data;
  try { data = JSON.parse(ev.message); } catch { return; }
  const c = homes.data.current;
  if (data.quest !== "homecoming" || !c || data.name !== c.stranger.name) return;
  const player = world.getAllPlayers().find((p) => p.id === data.player || p.name === data.player);
  for (const p of world.getPlayers()) if (p.dimension.id === c.dim) p.sendMessage(`§f${c.stranger.name}§7 stops in the middle of a word, turns to face the dark, and starts walking.`);
  finish("exposed", player);
});

// ---------- the loop ----------
onTick("after:homecomings", 100, () => {
  if (!morvaneFallen()) return;
  const d = homes.data, day = today();
  if (!d.current) {
    if (d.nextDay === undefined) { d.nextDay = day + AFTER.homecomingFirstAfterDays; homes.save(); return; }
    if (day < d.nextDay || isNight() || timeOfDay() > 4000) return; // they come up with the morning
    const above = world.getPlayers().filter((p) => p.dimension.id === "minecraft:overworld");
    if (!above.length) return;
    try { arrive(above[Math.floor(Math.random() * above.length)]); } catch { /* try again next tick */ }
    return;
  }
  const c = d.current;
  if (day - c.day >= AFTER.strangerWaitDays) {
    const e = strangerEntity();
    everyone(`§8${fill(ENDING.leaving[day % ENDING.leaving.length], c.stranger)}`);
    if (e) release(e, false);
    return finish("left");
  }
  // Gone without a word (killed, or a copy that walked home): only noticed when someone is near enough to see.
  try {
    const dim = world.getDimension(c.dim);
    if (dim.getPlayers({ location: c.at, maxDistance: 24 }).length && !strangerEntity()) finish("left");
  } catch { /* not loaded */ }
});
const everyone = (text) => { for (const p of world.getPlayers()) p.sendMessage(text); };

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const p = ev.sourceEntity;
  if (!ev.id.startsWith("siege:homecoming") || p?.typeId !== "minecraft:player") return;
  if (p.getGameMode() !== GameMode.Creative) return p.sendMessage("§7Creative only.");
  const d = homes.data;
  if (ev.id === "siege:homecoming_now") {
    const old = strangerEntity();
    if (old) release(old, false);
    d.current = undefined;
    const seed = parseInt(ev.message, 10);
    arrive(p, Number.isFinite(seed) ? seed : undefined);
  } else if (ev.id === "siege:homecoming") {
    const c = d.current;
    p.sendMessage(c ? `§6Homecoming:§7 ${c.stranger.name} (${c.stranger.twist}), wants ${askOf(c.stranger).id}, here since day ${c.day}. ${d.count} so far.`
      : `§6Homecoming:§7 nobody now. Next on day ${d.nextDay ?? "?"} (today ${today()}). ${d.count} so far.${morvaneFallen() ? "" : " Nobody comes home until Morvane has fallen."}`);
  }
});
