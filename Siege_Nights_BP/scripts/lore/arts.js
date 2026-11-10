// "The Fourteen Arts": the book about the Sorcerer's powers, and the story steps that open some of them.
// Old Mag gives the book to anyone who has taken the Ember. It hints; it never explains.
//
//   /scriptevent siege:arts          another copy of the book
// Announces (the town hall's Tree of Oaths listens):
//   powerOriginInfo { gated: { skill: hint }, lines: { skill: line } }   once after load, and on "powerOriginsWanted"
//   powerOrigin     { player, skill }      this player has found where a gated power comes from
// Gated powers and what opens them:
//   arc_echo        reading any of the Surveyor's Field Notes
//   arc_step        the First Slip (you cannot lean toward a place that has never pulled you)
//   arc_choir       Sigrun Ashby's account of the bell under the ice, in Rimehold
//   arc_hollowstep  naming the real thin place in your Library

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { emit, on } from "../siege/api.js";
import { ARTS_BOOK, POWERS } from "./data/powers.js";
import { ROLE_LORE, ROLE_LINES } from "./data/roles.js";
import { TOME } from "./logic.js";
import { progressOf, saveProgress, giveItem, heroOf, learnLeads } from "./player.js";

export const ARTS_ITEM = "siege:fourteen_arts";
export const ART_IDS = Object.keys(POWERS);

export const GATED = {
  arc_echo: "Unknown. A surveyor of the Order could do this, and it ruined him. Find one of his field notes.",
  arc_step: "Unknown. They say this one cannot be taught, only remembered by someone the other place has already pulled.",
  arc_choir: "Unknown. An army once crossed the ice for this sound. Ask in Rimehold, where their grandmothers stayed.",
  arc_hollowstep: "Unknown. Find the one real door that is left, and name it in your Library.",
};
const infoNow = () => {
  emit("powerOriginInfo", { gated: GATED, lines: { ...Object.fromEntries(ART_IDS.map((id) => [id, POWERS[id].tree])), ...ROLE_LINES } });
  emit("roleLore", { roles: ROLE_LORE }); // why each region keeps its role, for the Tree of Oaths
};
on("roleLoreWanted", () => emit("roleLore", { roles: ROLE_LORE }));
on("powerOriginsWanted", infoNow);
system.run(infoNow);

function foundOrigin(player, skill) {
  if (!player || !GATED[skill]) return;
  const p = progressOf(player);
  const flag = `origin_${skill}`;
  if (!p.flags.includes(flag)) {
    p.flags.push(flag);
    saveProgress(player);
    player.sendMessage(`§5Something you did not understand before makes sense now.§7 (${POWERS[skill].art}: a new art can be sworn at the Tree of Oaths.)`);
  }
  emit("powerOrigin", { player, skill });
}
on("loreTomeRead", ({ player, tome }) => { if (TOME[tome]?.col === "survey") foundOrigin(player, "arc_echo"); });
on("loreFlag", ({ player, flag }) => {
  if (flag === "slipped_first") foundOrigin(player, "arc_step");
  if (flag === "heard_the_calling") foundOrigin(player, "arc_choir");
});
on("loreSourceNamed", ({ player }) => foundOrigin(player, "arc_hollowstep"));
// say it again whenever the player comes back, in case the Tree was not listening the first time
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    if (!player.isValid) return;
    for (const skill of Object.keys(GATED)) if (progressOf(player).flags.includes(`origin_${skill}`)) emit("powerOrigin", { player, skill });
  }, 60);
});

// ---------- the book ----------
export function makeArtsBook() {
  const item = new ItemStack(ARTS_ITEM, 1);
  item.setLore(["§r§7A child's copybook, swollen with damp.", "§r§8Mag, aged eleven"]);
  item.keepOnDeath = true;
  return item;
}

// page -1 cover and foreword, 0..13 the arts, 14 the last page
export async function readArts(player, page = -1) {
  const n = ART_IDS.length;
  const sworn = heroOf(player).skills ?? {};
  let title = ARTS_BOOK.title;
  let body;
  if (page < 0) body = `§7${ARTS_BOOK.cover}§r\n\n${ARTS_BOOK.intro}`;
  else if (page >= n) body = ARTS_BOOK.outro;
  else {
    const power = POWERS[ART_IDS[page]];
    title = `${page + 1}. ${power.art}`;
    body = `${power.page}${sworn[ART_IDS[page]] ? `\n\n§5${power.known}§r` : ""}\n\n§8${page + 1} of ${n}`;
    if (power.lead) learnLeads(player, [power.lead]);
  }
  const form = new ActionFormData().title(title).body(body);
  const buttons = [];
  if (page < n) buttons.push("next");
  if (page >= 0) buttons.push("back");
  buttons.push("close");
  for (const b of buttons) form.button({ next: page < 0 ? "Turn the page" : "Next", back: "Back", close: "Close the copybook" }[b]);
  if (page >= n) {
    const p = progressOf(player);
    if (!p.flags.includes("arts_read")) { p.flags.push("arts_read"); saveProgress(player); emit("loreFlag", { player, flag: "arts_read" }); }
  }
  const answer = await form.show(player);
  if (answer.canceled) return;
  const picked = buttons[answer.selection];
  if (picked === "next") return readArts(player, page + 1);
  if (picked === "back") return readArts(player, page - 1);
}

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== ARTS_ITEM) return;
  readArts(event.source).catch((e) => console.warn(`[Hollow Crown] arts book: ${e}`));
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: player }) => {
  if (id !== "siege:arts" || player?.typeId !== "minecraft:player") return;
  giveItem(player, makeArtsBook());
  player.sendMessage("§aThe Fourteen Arts is in your pack.");
});
