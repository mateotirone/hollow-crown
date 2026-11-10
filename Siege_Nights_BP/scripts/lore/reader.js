// Reading a Lore Tome: use the item, or pick it from a Library catalog.

import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { emit } from "../siege/api.js";
import { TOME, COLLECTION, pagesFor, readable } from "./logic.js";
import { TOME_ITEM, tomeIdOf, progressOf, saveProgress, sourceSite, readingPowers, learnClues, learnLeads, ensureLedger } from "./player.js";

export async function readTome(player, id, page = 0) {
  const tome = TOME[id];
  if (!tome) return;
  const can = readingPowers(player);
  const pages = pagesFor(tome, sourceSite(), can);
  const clear = readable(tome, can);
  const col = COLLECTION[tome.col];
  const last = page >= pages.length - 1;

  let body = `§7${tome.author}§r\n\n${pages[page]}\n\n§8Page ${page + 1} of ${pages.length}`;
  if (!clear) {
    body += tome.cipher
      ? "\n\n§cThis is written in a cipher. You need a Cipher Wheel in your pack to read it."
      : "\n\n§cThe writing runs right to left, in the old way. You need Tide Glass in your pack to read it.";
  }
  const form = new ActionFormData().title(`${col.color}${tome.title}`).body(body);
  const buttons = [];
  if (!last) buttons.push("next");
  if (page > 0) buttons.push("back");
  buttons.push("close");
  for (const b of buttons) form.button({ next: "Next page", back: "Previous page", close: "Close the book" }[b]);

  if (last && clear) finishTome(player, tome);
  const answer = await form.show(player);
  if (answer.canceled) return;
  const picked = buttons[answer.selection];
  if (picked === "next") return readTome(player, id, page + 1);
  if (picked === "back") return readTome(player, id, page - 1);
}

function finishTome(player, tome) {
  const p = progressOf(player);
  if (p.read.includes(tome.id)) return;
  p.read.push(tome.id);
  saveProgress(player);
  ensureLedger(player);
  learnClues(player, tome.clues);
  learnLeads(player, tome.leads);
  emit("loreTomeRead", { player, tome: tome.id, total: p.read.length });
}

world.afterEvents.itemUse.subscribe((event) => {
  const { source: player, itemStack } = event;
  if (itemStack?.typeId !== TOME_ITEM) return;
  const id = tomeIdOf(itemStack);
  if (!id) {
    player.sendMessage("§7The pages are blank. (Lore Tomes are found in the world, or given with /scriptevent siege:lore_give <id>.)");
    return;
  }
  readTome(player, id).catch((e) => console.warn(`[Lore] reader: ${e}`));
});
