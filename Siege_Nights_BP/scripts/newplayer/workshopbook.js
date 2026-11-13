// The Siege Workshop book (new-player audit, Mateo 2026-11-13): the Workshop's own screen is the vanilla crafting grid
// with a recipe book of 260-odd recipes in no order. Sneak-click a Workshop for a short book instead: the main
// things it makes, by category, each with what it does and what it takes. A plain click still opens the grid.
// Data: workshop_book_data.js (tools/workshop_book.py, from the recipe files).

import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { addTests, assert } from "../siege/api.js";
import { WORKSHOP_BOOK, WORKSHOP_RECIPES } from "./workshop_book_data.js";

const WORKSHOP = "siege:workshop";
const TOLD = "hc:workshop_book_told";

export async function openBook(player) {
  const top = new ActionFormData().title("Siege Workshop")
    .body(`Everything here is crafted in the Workshop's grid (a plain click opens it). Its recipe book holds all ${WORKSHOP_RECIPES} recipes; these are the ones to know first.`);
  for (const cat of WORKSHOP_BOOK) top.button(`${cat.name}\n§8${cat.items.length} things`);
  const r = await top.show(player);
  if (r.canceled || r.selection === undefined) return;
  const cat = WORKSHOP_BOOK[r.selection];
  const list = new ActionFormData().title(cat.name);
  for (const it of cat.items) list.button(`${it.name}\n§8${it.needs}`);
  list.button("Back");
  const pick = await list.show(player);
  if (pick.canceled || pick.selection === undefined) return;
  if (pick.selection >= cat.items.length) return openBook(player);
  const it = cat.items[pick.selection];
  const page = await new MessageFormData().title(it.name)
    .body(`${it.what}\n\n§7Takes: §f${it.needs}\n\n§7Find it in the Workshop's recipe book by name, or lay it out in the grid.`)
    .button1("Back").button2("Close").show(player);
  if (!page.canceled && page.selection === 0) return openBook(player);
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== WORKSHOP || !e.player.isSneaking || !e.isFirstEvent) return;
  e.cancel = true;
  const player = e.player;
  system.run(() => openBook(player).catch(() => {}));
});

// The first plain click: say the book is there
world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  if (block.typeId !== WORKSHOP || player.isSneaking || player.getDynamicProperty(TOLD)) return;
  player.setDynamicProperty(TOLD, true);
  system.runTimeout(() => { try { player.sendMessage("§6[Workshop]§7 Sneak and click the Workshop for its book: what it makes, what each thing does and what it takes."); } catch { /* left */ } }, 30);
});

addTests("newplayer workshop book", {
  "the Workshop book lists the Barracks with stone bricks and planks, and every entry says what it takes": () => {
    const all = WORKSHOP_BOOK.flatMap((c) => c.items);
    const b = all.find((i) => i.id === "siege:barracks");
    assert(b && /stone bricks/.test(b.needs) && /planks/.test(b.needs), "Barracks from stone bricks and planks");
    for (const i of all) assert(i.needs && i.what && i.name, `${i.id} is complete`);
  },
});
