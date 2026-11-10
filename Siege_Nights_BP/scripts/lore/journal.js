// The Old King's Journal: every player has one from their first minute in the world.
// It is an ordinary book. Reading it is optional; nothing is locked behind it.
//   /scriptevent siege:journal        another copy (if yours is lost)

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { emit } from "../siege/api.js";
import { JOURNAL, JOURNAL_CLUES } from "./data/journal.js";
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
  const entries = JOURNAL.entries;
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

  if (last) finishJournal(player);
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

// First time in the world: the journal is simply there.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  const p = progressOf(player);
  if (p.flags.includes("journal_given")) return;
  p.flags.push("journal_given");
  saveProgress(player);
  system.runTimeout(() => {
    if (player.isValid) giveJournal(player);
  }, 100);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id !== "siege:journal" || player?.typeId !== "minecraft:player") return;
  giveJournal(player, false);
  player.sendMessage("§aAnother copy of the Old King's Journal is in your pack.");
});
