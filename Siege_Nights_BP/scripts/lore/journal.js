// The Old King's Journal: every player has one from their first minute in the world.
// It is an ordinary book. Reading it is optional; nothing is locked behind it.
//   /scriptevent siege:journal        another copy (if yours is lost)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { emit, on, addJoinStep, addTests, assertEqual } from "../siege/api.js";
import { mapMode } from "../plots/api.js";
import { JOURNAL, JOURNAL_CLUES } from "./data/journal.js";
import { REVEAL } from "./data/reveal.js";
import { progressOf, saveProgress, giveItem, learnClues } from "./player.js";

export const JOURNAL_ITEM = "siege:kings_journal";

export function makeJournal() {
  const item = new ItemStack(JOURNAL_ITEM, 1);
  item.setLore(["§r§7The name on the cover has been scraped away.", "§r§8You do not remember packing it."]);
  item.keepOnDeath = true;
  return item;
}

export function giveJournal(player, announce = true) {
  giveItem(player, makeJournal());
  if (announce) {
    player.sendMessage("§6There is an old journal in your pack.§r §7You do not remember putting it there. Use it to read it, or don't.");
    player.playSound("item.book.page_turn");
  }
}

// page -1 is the cover; 0..n-1 are the entries
export async function readJournal(player, page = -1) {
  // after the last fight the book has one more page, in another hand (data/reveal.js)
  const entries = progressOf(player).flags.includes("journal_last_page")
    ? [...JOURNAL.entries, { date: REVEAL.lastPage.date, text: `${REVEAL.lastPage.text}\n\n${REVEAL.lastPage.sign}` }]
    : JOURNAL.entries;
  const last = page >= entries.length - 1;
  const body = page < 0
    ? `§7${JOURNAL.cover}§r\n\n§8${entries.length} entries, in a careful hand that gets worse.`
    : `§7${entries[page].date}§r\n\n${entries[page].text}\n\n§8Entry ${page + 1} of ${entries.length}`;
  const form = new ActionFormData().title(JOURNAL.title).body(body);
  const buttons = [];
  if (!last) buttons.push("next");
  if (page >= 0) buttons.push("back");
  buttons.push("close");
  for (const b of buttons) form.button({ next: page < 0 ? "Open it" : "Next entry", back: "Previous entry", close: "Close the journal" }[b]);

  if (page >= JOURNAL.entries.length - 1) finishJournal(player);
  const answer = await form.show(player);
  if (answer.canceled) return;
  const picked = buttons[answer.selection];
  if (picked === "next") return readJournal(player, page + 1);
  if (picked === "back") return readJournal(player, page - 1);
}

function finishJournal(player) {
  const p = progressOf(player);
  if (p.flags.includes("journal_read")) return;
  p.flags.push("journal_read");
  saveProgress(player);
  learnClues(player, JOURNAL_CLUES);
  emit("loreFlag", { player, flag: "journal_read" });
}

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== JOURNAL_ITEM) return;
  readJournal(event.source).catch((e) => console.warn(`[Hollow Crown] journal: ${e}`));
});

// First time in the world: the journal is simply there. It is step 30 of the join sequence (core/firstjoin.js),
// after the look picker (10) and the welcome hall (20), so it never lands on top of either.
//   on a map with a welcome hall: once the player has read the Waystone's "How things stand"
//   ("waystoneRead" { player } from the plots feature), or after 20 seconds if they walk past it
//   with no hall (no Plot Stones on the map): 3 seconds after the picker
export const JOURNAL_WAIT = { read: 400, noHall: 60, afterRead: 40 };
export const journalWait = (hall) => (hall ? JOURNAL_WAIT.read : JOURNAL_WAIT.noHall);
const readers = new Map(); // player id -> resolve, while the journal step is waiting on the Waystone
on("waystoneRead", ({ player }) => readers.get(player?.id)?.());

addJoinStep(30, "journal", async (player, { wait }) => {
  const p = progressOf(player);
  if (p.flags.includes("journal_given")) return; // worlds from before the join sequence gave it already
  let hall = false;
  try { hall = mapMode(); } catch { /* plots not ready: treat as no hall */ }
  if (hall) {
    const read = new Promise((resolve) => readers.set(player.id, () => resolve(true)));
    const wasRead = await Promise.race([read, wait(journalWait(true))]);
    readers.delete(player.id);
    if (wasRead) await wait(JOURNAL_WAIT.afterRead); // let them close the Waystone first
  } else {
    await wait(journalWait(false));
  }
  if (!player.isValid) return; // left: the sequence runs again next time, and the flag is not set yet
  p.flags.push("journal_given");
  saveProgress(player);
  giveJournal(player);
}, { when: "first", timeout: 40 });

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id !== "siege:journal" || player?.typeId !== "minecraft:player") return;
  giveJournal(player, false);
  player.sendMessage("§aAnother copy of the Old King's Journal is in your pack.");
});

addTests("lore", {
  "the journal waits for the Waystone, or 20 seconds, or 3 seconds with no hall": () => {
    assertEqual(journalWait(true), 400);
    assertEqual(journalWait(false), 60);
  },
});
