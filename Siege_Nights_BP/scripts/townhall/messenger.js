// The Messenger: word reaches a keeper when their settlement is attacked while they are away.
// Rules and words: messenger_rules.js. The skill is keep_messenger on the Tree of Oaths (a skill point, or
// MESSENGER.coins Regals at the Tree).
//
// Any feature can report an attack on a settlement:
//   emit("baseAttacked", { owner, kind?, text?, by? })   kind picks the cooldown bucket (rules.js); text overrides the words
// It already listens to: settlementAttacked (siege/guards.js markWanted: a player hit your guards, walls, people or
// keep), assaultSpawned, lordRaid, keepFallen, and the vault's vaultDrilled / vaultBreached / relicTaken / vaultOpened.
//
// Test: /scriptevent siege:messenger_test [player|raid|lord|fallen|drill|breach]   news about your own settlement
//       /scriptevent siege:messenger_news                                           read out what is waiting for you

import { world, system } from "@minecraft/server";
import * as api from "../siege/api.js";
import { heroOf } from "./hero.js";
import { moduleStore } from "../core/store.js";
import { onTick } from "../core/loop.js";
import { sfx } from "../core/sfx.js";
import { MESSENGER, route, cooling, bucket, newsText, wayHome, keepNews, homecoming } from "./messenger_rules.js";

const store = moduleStore("siege:messenger", () => ({ news: {} })); // owner id -> [{ text, when }] waiting for their return
const sent = new Map(); // owner id -> { bucket: tick last handled }

export const hasMessenger = (player) => (heroOf(player).skills[MESSENGER.skill] ?? 0) > 0;
const online = (id) => world.getPlayers().find((p) => p.id === id);
const nameOf = (id) => (id ? online(id)?.name : undefined);

function atHome(player) {
  try {
    return player.dimension.id === "minecraft:overworld" && api.settlementAt(player.location) === player.id;
  } catch {
    return false;
  }
}

function keepSpot(owner) {
  const keep = api.keepOf(owner);
  if (!keep) return undefined;
  try {
    return api.keepCenter(keep);
  } catch {
    return keep;
  }
}

// The messenger rides up
function ride(player, lines, owner) {
  const spot = keepSpot(owner);
  const way = spot && player.dimension.id === "minecraft:overworld" ? ` Home lies ${wayHome(player.location, spot)}.` : "";
  api.title(player, "§cYour base is under attack!", "§7A messenger has found you");
  player.sendMessage(`§6A messenger rides up, out of breath:§f "${lines.join(" ")}"§7${way}`);
  sfx(player, "mob.horse.gallop", { pitch: 0.9 });
  system.runTimeout(() => { try { sfx(player, "note.bell", { pitch: 0.6 }); } catch { /* gone */ } }, 10);
}

// News about an attack on a settlement
export function report(owner, kind, words = {}, text) {
  if (!owner || !api.keepOf(owner)) return;
  const now = system.currentTick;
  const b = bucket(kind);
  const key = text ? `${b}:${text}` : b;
  const last = sent.get(owner) ?? {};
  if (cooling(last, b, now, key)) return;
  last[key] = now;
  sent.set(owner, last);
  const line = text ?? newsText(kind, { name: api.keepOf(owner).name, ...words });
  const player = online(owner);
  const way = route({ online: !!player, atHome: !!player && atHome(player), hasMessenger: !!player && hasMessenger(player) });
  if (way === "home") {
    if (kind === "raid" || kind === "lord" || kind === "fallen") return; // the siege horns already said so
    player.sendMessage(`§c${line}`);
    return sfx(player, "note.bass", { pitch: 0.6 });
  }
  if (way === "messenger") return ride(player, [line], owner);
  store.data.news[owner] = keepNews(store.data.news[owner], line, world.getDay());
  store.save();
}

api.on("baseAttacked", ({ owner, kind = "other", text, by }) => report(owner, kind, { who: nameOf(by) }, text));
api.on("settlementAttacked", ({ owner, by }) => report(owner, "player", { who: nameOf(by) }));
api.on("assaultSpawned", ({ assault, total }) => {
  for (const owner of api.getState().besieged ?? []) report(owner, "raid", { assault, total });
});
api.on("lordRaid", ({ name, owners }) => { for (const owner of owners ?? []) report(owner, "lord", { lord: name }); });
api.on("keepFallen", ({ owner }) => report(owner, "fallen"));
api.on("vaultDrilled", ({ owner, by }) => report(owner, "drill", { who: nameOf(by) }));
api.on("vaultBreached", ({ owner, by }) => report(owner, "breach", { who: nameOf(by) }));
api.on("relicTaken", ({ owner, by }) => report(owner, "relic", { who: nameOf(by) }));
api.on("vaultOpened", ({ owner, by }) => report(owner, "key", { who: nameOf(by) }));

// Read out the waiting news to a keeper (on coming home, or by messenger when they log in)
function readOut(player, byMessenger) {
  const list = store.data.news[player.id];
  if (!list?.length) return false;
  delete store.data.news[player.id];
  store.save();
  if (byMessenger) ride(player, ["While you were gone:", ...list.map((n) => n.text)], player.id);
  else {
    for (const line of homecoming(list)) player.sendMessage(line);
    sfx(player, "note.bass", { pitch: 0.5 });
  }
  return true;
}

// Without a messenger, you find out when you get back
onTick("messenger-home", 40, () => {
  const news = store.data.news;
  if (!Object.keys(news).length) return;
  for (const player of world.getPlayers()) if (news[player.id] && atHome(player)) readOut(player, false);
});

// With one, a messenger is waiting for you when you come back to the world
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    try {
      if (player.isValid && store.data.news[player.id]?.length && hasMessenger(player) && !atHome(player)) readOut(player, true);
    } catch { /* left again */ }
  }, 200);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !event.id.startsWith("siege:messenger_")) return;
  if (event.id === "siege:messenger_news") {
    if (!readOut(player, hasMessenger(player))) player.sendMessage("§7No news is waiting for you.");
    return;
  }
  if (event.id !== "siege:messenger_test") return;
  if (!api.keepOf(player.id)) return player.sendMessage("§cYou need a settlement (a Keep Banner) first.");
  const kind = event.message.trim() || "player";
  sent.delete(player.id);
  player.sendMessage(`§8Messenger test: ${kind}. You are ${atHome(player) ? "at home" : "away"}, ${hasMessenger(player) ? "with" : "without"} a Messenger.`);
  report(player.id, kind, { who: "A test raider", assault: 1, total: 3, lord: "Lord Test" });
});
