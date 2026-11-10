// Lore exhibits for the test world (/scriptevent siege:showcase): a small Library, a Dusty Tome,
// the reading tools, and all eight story characters standing in a row.

import { ItemStack } from "@minecraft/server";
import { on } from "../siege/api.js";
import { tomesOf } from "./logic.js";
import { NPCS } from "./data/dialogue.js";
import { LEDGER, CIPHER_WHEEL, MIRROR_GLASS, makeTome, giveItem, progressOf, saveProgress } from "./player.js";
import { stockShelf } from "./library.js";
import { placeCache } from "./caches.js";
import { spawnNpc } from "./npcs.js";
import { makeJournal } from "./journal.js";

on("showcase", ({ player, dim, nextSpot, label }) => {
  const owner = player.id;
  const block = (at) => dim.getBlock(at);

  // A Library: two full shelves of the Chronicles, a half-full one, and an empty one to fill yourself
  const chronicles = tomesOf("chronicles").map((t) => t.id);
  const shelves = [
    [chronicles.slice(0, 6), "Archive Shelf\nfull (click it)"],
    [chronicles.slice(6, 12), "Archive Shelf\nfull"],
    [["test_01", "test_03", "seal_01"], "Archive Shelf\nhalf full"],
    [[], "Archive Shelf\nempty: click it\nholding a tome"],
  ];
  for (const [ids, text] of shelves) {
    const at = nextSpot();
    const b = block(at);
    if (!b) continue;
    stockShelf(b, owner, ids);
    label(at, text);
  }

  // A Dusty Tome that hands out one of the Lighthouse Letters (in cipher)
  const cacheAt = nextSpot();
  if (block(cacheAt)) {
    placeCache(block(cacheAt), "lett_01");
    label(cacheAt, "Dusty Tome\nclick in survival\nfor a ciphered letter");
  }

  // The story characters
  for (const npc of NPCS) {
    const at = nextSpot();
    try {
      spawnNpc(dim, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, npc.id).addTag("siege_showcase");
      label(at, `${npc.name}\nclick to talk`);
    } catch (e) {
      console.warn(`[Hollow Crown] lore showcase could not spawn ${npc.id}: ${e}`);
    }
  }

  // Tools and a few tomes to try: a field note, a backward hymn, a boss confession
  const p = progressOf(player);
  if (!p.flags.includes("has_ledger")) p.flags.push("has_ledger");
  saveProgress(player);
  for (const typeId of [LEDGER, CIPHER_WHEEL, MIRROR_GLASS]) giveItem(player, new ItemStack(typeId, 1));
  giveItem(player, makeJournal());
  for (const id of ["surv_01", "scri_01", "fall_01", "corv_01"]) giveItem(player, makeTome(id));
  player.sendMessage("§6Lore:§r the Library shelves, a Dusty Tome and the eight characters are in the back row. You have the Old King's Journal (every player starts with one), a Ledger of Whispers, a Cipher Wheel, a Tide Glass and four tomes. More: /scriptevent siege:lore_give all");
});
