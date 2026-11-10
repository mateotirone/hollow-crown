// The reveal of who Morvane was: hands the words to the fight, and adds the journal's last page.
//   emit("revealWordsWanted")            -> "revealWords" { journalLine, journalLineBy, lookUp, bells, lastPage }
//   emit("journalLastPage", { player })  the cutscene calls this at the beat where the journal changes
//   scriptevent siege:boss_defeated {"boss":"morvane",players}   safety net: everyone who fought gets the page
//   /scriptevent siege:journal_last_page   testing

import { world, system } from "@minecraft/server";
import { emit, on } from "../siege/api.js";
import { REVEAL } from "./data/reveal.js";
import { setFlag } from "./player.js";

const send = () => emit("revealWords", REVEAL);
on("revealWordsWanted", send);
system.run(send);

const playerOf = (player) => (typeof player === "string" ? world.getAllPlayers().find((p) => p.id === player) : player);

export function addLastPage(who) {
  const player = playerOf(who);
  if (!player?.isValid) return false;
  if (!setFlag(player, "journal_last_page")) return false;
  try {
    player.sendMessage("§7§oThe old journal in your pack is heavier than it was. By about one page.");
    player.playSound("item.book.page_turn", { pitch: 0.6 });
  } catch {}
  return true;
}
on("journalLastPage", ({ player }) => addLastPage(player));

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  if (id === "siege:journal_last_page" && sourceEntity?.typeId === "minecraft:player") {
    if (!addLastPage(sourceEntity)) sourceEntity.sendMessage("§7Your journal already has its last page.");
    return;
  }
  if (id !== "siege:boss_defeated") return;
  let data;
  try { data = JSON.parse(message); } catch { return; }
  if (data?.boss !== "morvane") return;
  for (const pid of data.players ?? []) {
    const player = playerOf(pid);
    if (!player) continue;
    setFlag(player, "morvane_fallen");
    addLastPage(player);
  }
});
