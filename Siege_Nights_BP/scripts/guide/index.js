// The Settler's Almanac: every mechanic explained in game, in two layers.
//
//   1. A tip: the first time a player meets something (places a block, clicks an NPC, carries an item,
//      sees a creature, lives through a kind of night) they get one line in chat about it.
//   2. The book: siege:almanac, given on the first join (and craftable from a book and a feather),
//      or /siege:guide for anyone. Chapters of full pages; pages met but not yet read wear a gold dot.
//
// Words are in data.js, rules in rules.js. To explain a new mechanic, add an entry to data.js (see the
// notes at its top); nothing in this file needs to change.
//
// Test commands (cheats on):
//   /scriptevent siege:guide            open the book
//   /scriptevent siege:guide give       another copy
//   /scriptevent siege:guide reset      forget every page you have met and read
//   /scriptevent siege:guide all        meet every page at once (shows the hidden ones)
//   /scriptevent siege:guide tip <id>   say that page's tip, as if you had just met it

import { world, system, ItemStack, BlockTypes, ItemTypes, EntityTypes, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, onTick, addJoinStep, addKeepMenuButtons } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { ALMANAC, ENTRIES } from "./data.js";
import { ENTRY, WORLD_EVENTS, buildIndex, entriesFor, readMarks, writeMarks, visible, isNew, chapterList, chapterPages } from "./rules.js";
import "./tests.js";

const PROP = "siege:guide";
const TIP_DELAY = 30; // ticks after meeting a thing before its tip, so it doesn't land on a menu opening
const TIP_GAP = 120; // ticks between two tips to the same player
const NEAR = 14; // blocks, for near: entries
const index = buildIndex();

// ---------- does this build have it? (pages for features still waiting to be merged stay away) ----------
const existsCache = new Map();
export function exists(id) {
  if (!existsCache.has(id)) {
    let found = false;
    try {
      found = !!(ItemTypes.get(id) ?? BlockTypes.get(id) ?? EntityTypes.get(id));
    } catch {
      found = false;
    }
    existsCache.set(id, found);
  }
  return existsCache.get(id);
}

// ---------- marks ----------
const live = new Map(); // player id -> marks
function marksOf(player) {
  if (!live.has(player.id)) {
    let raw;
    try {
      raw = player.getDynamicProperty(PROP);
    } catch {
      raw = undefined;
    }
    live.set(player.id, readMarks(raw));
  }
  return live.get(player.id);
}
function saveMarks(player) {
  try {
    player.setDynamicProperty(PROP, writeMarks(marksOf(player)));
  } catch {
    // left meanwhile; saved next time
  }
}
world.afterEvents.playerLeave?.subscribe(({ playerId }) => live.delete(playerId));

// ---------- tips ----------
const queue = new Map(); // player id -> [entry ids waiting for their tip]
const nextTip = new Map(); // player id -> earliest tick for the next tip

export function meet(player, ids, { quiet = false } = {}) {
  if (!player || !ids?.length) return;
  const marks = marksOf(player);
  let changed = false;
  for (const id of ids) {
    const e = ENTRY[id];
    if (!e || marks.m.includes(id) || (e.needs && !exists(e.needs))) continue;
    marks.m.push(id);
    changed = true;
    if (!quiet && !marks.off && e.tip) {
      if (!queue.has(player.id)) queue.set(player.id, []);
      queue.get(player.id).push(id);
    }
  }
  if (changed) saveMarks(player);
}

function sayTip(player, id) {
  const e = ENTRY[id];
  if (!e) return;
  player.sendMessage(`§6[Almanac] §f${e.title}:§r §7${e.tip}`);
  sfx(player, "item.book.page_turn");
}

onTick("guide_tips", 10, () => {
  const now = system.currentTick;
  for (const player of world.getPlayers()) {
    const waiting = queue.get(player.id);
    if (!waiting?.length || now < (nextTip.get(player.id) ?? 0)) continue;
    sayTip(player, waiting.shift());
    nextTip.set(player.id, now + TIP_GAP);
  }
});

const meetLater = (player, kind, names) => {
  const ids = entriesFor(index, kind, names);
  if (!ids.length) return;
  const marks = marksOf(player);
  if (ids.every((id) => marks.m.includes(id))) return;
  system.runTimeout(() => {
    try {
      if (player.isValid) meet(player, ids);
    } catch {
      // gone
    }
  }, TIP_DELAY);
};

// ---------- meeting things ----------
world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  try {
    meetLater(player, "place", [block.typeId]);
  } catch {
    // block gone already
  }
});

// Read-only: other features cancel these clicks to open their menus, so listen before they do
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.isFirstEvent === false) return;
  const { player, block } = event;
  let type;
  try {
    type = block.typeId;
  } catch {
    return;
  }
  system.run(() => meetLater(player, "click", [type]));
});

world.beforeEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  let names;
  try {
    names = [target.typeId, ...target.getTags().map((t) => `tag:${t}`)];
  } catch {
    return;
  }
  system.run(() => meetLater(player, "talk", names));
});

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!source || source.typeId !== "minecraft:player" || !itemStack) return;
  if (itemStack.typeId === ALMANAC.item) return openAlmanac(source);
  meetLater(source, "use", [itemStack.typeId]);
});

world.afterEvents.entityHitBlock?.subscribe(({ damagingEntity, hitBlock }) => {
  if (damagingEntity?.typeId !== "minecraft:player") return;
  try {
    meetLater(damagingEntity, "hit", [hitBlock.typeId]);
  } catch {
    // gone
  }
});

// What is in their pack, and what is near them: one look every 5 seconds, a few players at a time
const SCAN_EVERY = 100;
const lookAround = (player) => {
  const carried = new Set();
  const container = player.getComponent("minecraft:inventory")?.container;
  if (container) {
    for (let i = 0; i < container.size; i++) {
      const it = container.getItem(i);
      if (it) carried.add(it.typeId);
    }
  }
  if (carried.size) meet(player, entriesFor(index, "carry", [...carried]));
  if (index.near.exact.size || index.near.prefix.length) {
    const seen = new Set();
    for (const e of player.dimension.getEntities({ location: player.location, maxDistance: NEAR })) seen.add(e.typeId);
    if (seen.size) meet(player, entriesFor(index, "near", [...seen]));
  }
};
let scanTurn = 0;
onTick("guide_scan", 20, () => {
  // each player is looked at once every SCAN_EVERY ticks, spread over the turns
  const players = world.getPlayers();
  const turns = SCAN_EVERY / 20;
  scanTurn = (scanTurn + 1) % turns;
  players.forEach((player, i) => {
    if (i % turns !== scanTurn) return;
    try {
      lookAround(player);
    } catch {
      // left, or the area isn't loaded
    }
  });
});

// Game events: the ones naming a player tell that player; world events tell everyone online
const playerFrom = (value) => {
  if (!value) return undefined;
  if (typeof value === "object" && typeof value.sendMessage === "function") return value;
  if (typeof value === "string") return world.getPlayers().find((p) => p.id === value);
  return undefined;
};
const EVENTS = [...index.event.exact.keys()];
for (const name of EVENTS) {
  on(name, (data = {}) => {
    const ids = entriesFor(index, "event", [name]);
    const who = WORLD_EVENTS.has(name)
      ? world.getPlayers()
      : [playerFrom(data.player) ?? playerFrom(data.owner) ?? playerFrom(data.id)].filter(Boolean);
    for (const player of who) system.runTimeout(() => {
      try {
        if (player.isValid) meet(player, ids);
      } catch {
        // gone
      }
    }, TIP_DELAY);
  });
}

// ---------- the book ----------
export function makeAlmanac() {
  const item = new ItemStack(ALMANAC.item, 1);
  item.setLore(["§r§7How things are done in Aldmere.", "§r§8Use it to read."]);
  return item;
}

export function giveAlmanac(player) {
  const left = player.getComponent("minecraft:inventory")?.container?.addItem(makeAlmanac());
  if (left) player.dimension.spawnItem(left, player.location);
}

const dot = (on) => (on ? "§6• §r" : "");

export async function openAlmanac(player) {
  const marks = marksOf(player);
  meet(player, ["almanac"], { quiet: true });
  const chapters = chapterList(marks, exists);
  const fresh = chapters.reduce((n, c) => n + c.fresh, 0);
  const form = new ActionFormData().title(ALMANAC.title)
    .body(`§7${ALMANAC.cover}§r\n\n${fresh ? `§6${fresh} new page${fresh === 1 ? "" : "s"}§r marked with a gold dot.` : "Nothing new since you last looked."}`);
  for (const c of chapters) form.button(`${dot(c.fresh)}${c.name}\n§8${c.pages.length} page${c.pages.length === 1 ? "" : "s"}${c.fresh ? `, ${c.fresh} new` : ""}`, c.icon);
  form.button(marks.off ? "Tips in chat: §coff§r\n§8click to turn them on" : "Tips in chat: §aon§r\n§8click to turn them off");
  form.button("Close");
  const r = await form.show(player);
  if (r.canceled) return;
  if (r.selection < chapters.length) return openChapter(player, chapters[r.selection].id, chapters[r.selection].name);
  if (r.selection === chapters.length) {
    marks.off = !marks.off;
    saveMarks(player);
    return openAlmanac(player);
  }
}

async function openChapter(player, chapterId, name) {
  const marks = marksOf(player);
  const pages = chapterPages(chapterId, marks, exists);
  const form = new ActionFormData().title(name).body("Choose a page.");
  for (const e of pages) form.button(`${dot(isNew(e, marks))}${e.title}`);
  form.button("Back");
  const r = await form.show(player);
  if (r.canceled) return;
  if (r.selection < pages.length) return openPage(player, pages[r.selection], chapterId, name);
  return openAlmanac(player);
}

async function openPage(player, entry, chapterId, name) {
  const marks = marksOf(player);
  if (!marks.m.includes(entry.id)) marks.m.push(entry.id);
  if (!marks.r.includes(entry.id)) marks.r.push(entry.id);
  saveMarks(player);
  const r = await new ActionFormData().title(entry.title).body(entry.page).button("Back").button("Close").show(player);
  if (!r.canceled && r.selection === 0) return openChapter(player, chapterId, name);
}

const openSoon = (player) => system.run(() => openAlmanac(player).catch((e) => console.warn(`[Hollow Crown] almanac: ${e}`)));

// On the Keep menu too
addKeepMenuButtons(({ player }) => [{ label: "Almanac", icon: "textures/items/siege_almanac", action: () => openSoon(player) }]);

// First join: after the look picker (10), the welcome hall (20) and the journal (30)
addJoinStep(35, "almanac", async (player, { wait }) => {
  giveAlmanac(player);
  player.sendMessage("§6A clerk has pressed a small book into your hands: the Settler's Almanac.§r §7Use it whenever you are not sure what something does.");
  meet(player, ["almanac", "first_days"], { quiet: true });
  await wait(40);
}, { when: "first" });

// /siege:guide for everyone, cheats or not
system.beforeEvents.startup.subscribe((e) => {
  const registry = e.customCommandRegistry;
  if (!registry?.registerCommand) return;
  registry.registerCommand(
    { name: "siege:guide", description: "Open the Settler's Almanac", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only a player can read the Almanac." };
      openSoon(player);
      return { status: CustomCommandStatus.Success };
    },
  );
});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:guide") return;
  const player = e.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  const [cmd, arg] = (e.message ?? "").trim().split(/\s+/);
  const marks = marksOf(player);
  if (cmd === "give") return giveAlmanac(player);
  if (cmd === "reset") {
    marks.m = [];
    marks.r = [];
    saveMarks(player);
    return player.sendMessage("§7Almanac: every page forgotten.");
  }
  if (cmd === "all") {
    meet(player, ENTRIES.map((x) => x.id), { quiet: true });
    return player.sendMessage(`§7Almanac: ${ENTRIES.filter((x) => visible(x, marks, exists)).length} pages open.`);
  }
  if (cmd === "tip") return ENTRY[arg] ? sayTip(player, arg) : player.sendMessage(`§7No page "${arg}". Ids: ${ENTRIES.map((x) => x.id).join(", ")}`);
  openSoon(player);
});

