// Character looks: the add-on carries a set of character skins (made on the creator page) and draws
// each player as the one they picked, so nobody has to import a skin and it works on every device.
//
// How it fits together: the player entity has one synced number, hc:look (0 = your own skin).
// The resource pack's player file swaps the texture when it is above 0. The list of looks is data.js,
// written by studio/build_looks.mjs. A look with a `player` is reserved for that gamertag.
//
// Players choose on their first join (step 10 of the join sequence), at a Looking Glass block, or from their Keep Banner menu.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, addKeepMenuButtons, addJoinStep } from "../siege/api.js";
import { LOOKS } from "./data.js";
import "./tests.js";
import { sfx } from "../core/sfx.js";
import { hasWings, takeOffWings } from "../wings/index.js";

export const LOOKING_GLASS = "hc:looking_glass";
const PROP = "hc:look";
const CHOSEN = "hc:looks_chosen"; // the look's id, or "own". Unset = this player has never chosen.

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
/** The look reserved for this gamertag, if any. */
export const reservedFor = (name, looks = LOOKS) => looks.find((l) => l.player && same(l.player, name));
/** The looks this gamertag may wear: their own reserved one first, then every unreserved one. */
export const looksFor = (name, looks = LOOKS) => [
  ...looks.filter((l) => l.player && same(l.player, name)),
  ...looks.filter((l) => !l.player),
];
/** The look a player is wearing, or undefined for their own skin. */
export function lookOf(player) {
  try {
    const n = player.getProperty(PROP);
    return LOOKS.find((l) => l.n === n);
  } catch {
    return undefined;
  }
}
/** Dress a player as a look (undefined = back to their own skin). Returns false if the pack's player file is missing. */
export function setLook(player, look) {
  try {
    player.setProperty(PROP, look ? look.n : 0);
    player.setDynamicProperty(CHOSEN, look ? look.id : "own");
    return true;
  } catch (e) {
    console.warn(`[Hollow Crown] looks: could not set a look on ${player.name}: ${e}`);
    return false;
  }
}

export async function chooseLook(player) {
  const mine = looksFor(player.name);
  const wearing = lookOf(player);
  const form = new ActionFormData().title("Who steps off the coach?")
    .body("Pick who you are in this world. Everyone here sees you this way. You can change at any Looking Glass.");
  for (const l of mine) form.button(`${l.name}${l.player ? "\n§8made for you" : l === wearing ? "\n§8wearing now" : ""}`);
  form.button("My own skin");
  const wings = hasWings(player);
  if (wings) form.button("Take off the Everwake Wings\n§8they go back in your pack");
  let res;
  try {
    res = await form.show(player);
  } catch {
    return false;
  }
  if (res.canceled && res.cancelationReason === "UserBusy") return "busy";
  if (res.canceled || res.selection === undefined) return false;
  if (wings && res.selection === mine.length + 1) {
    if (takeOffWings(player)) sfx(player, "armor.equip_elytra");
    return true;
  }
  const look = mine[res.selection];
  if (!setLook(player, look)) {
    player.sendMessage("§cLooks are not working in this world. Tell whoever runs it that the player file from the add-on is missing.");
    return true;
  }
  player.sendMessage(look ? `§7You are §f${look.name}§7 here.` : "§7You look like yourself again.");
  sfx(player, "armor.equip_leather");
  return true;
}

// On every spawn, quietly keep the number in step with the chosen id, in case the list was rebuilt.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  const chosen = player.getDynamicProperty(CHOSEN);
  if (typeof chosen !== "string") return;
  const look = LOOKS.find((l) => l.id === chosen);
  const n = look && (!look.player || same(look.player, player.name)) ? look.n : 0;
  try {
    if (player.getProperty(PROP) !== n) player.setProperty(PROP, n);
  } catch { /* no player file: nothing to keep in step */ }
});

// First join, first step of the join sequence (see MODULES.md): a reserved look is put on straight
// away, everyone else is asked once. The step ends when the player has picked or closed the menu,
// so the welcome that follows never lands on top of it.
addJoinStep(10, "look picker", async (player, { wait }) => {
  if (typeof player.getDynamicProperty(CHOSEN) === "string") return;
  const reserved = reservedFor(player.name);
  if (reserved) {
    if (setLook(player, reserved)) player.sendMessage(`§7You arrive as §f${reserved.name}§7. Any Looking Glass will let you change.`);
    return;
  }
  // The menu can't open while another screen (chat, pause, loading) is up: wait and try again
  for (let tries = 0; tries < 8 && player.isValid; tries++) {
    if ((await chooseLook(player)) !== "busy") return;
    await wait(40);
  }
}, { when: "first", timeout: 120 });

// A newcomer who waited at Kingsrest for the welcome hall and never got to pick (the menu couldn't open while the
// world was loading) is asked again once they are up in the hall
on("newcomerInHall", ({ player }) => {
  system.runTimeout(async () => {
    try {
      if (!player.isValid || typeof player.getDynamicProperty(CHOSEN) === "string" || reservedFor(player.name)) return;
      for (let tries = 0; tries < 8 && player.isValid; tries++) {
        if ((await chooseLook(player)) !== "busy") return;
        await new Promise((r) => system.runTimeout(r, 40));
      }
    } catch { /* they left */ }
  }, 60);
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.isFirstEvent === false || event.block.typeId !== LOOKING_GLASS) return;
  event.cancel = true;
  const { player } = event;
  system.run(() => chooseLook(player));
});

addKeepMenuButtons(({ player, mine }) => (mine ? [{ label: "Change my look", action: () => chooseLook(player) }] : []));

// The test world (/scriptevent siege:showcase)
on("showcase", ({ player, dim, nextSpot, label }) => {
  try {
    const at = nextSpot();
    dim.getBlock(at)?.setType(LOOKING_GLASS);
    label(at, `Looking Glass\n${LOOKS.length} looks\nclick it`);
    player.sendMessage("§6Looks: click the Looking Glass to become one of the built-in characters, then press F5 to see yourself.");
  } catch (e) {
    console.warn(`[Hollow Crown] showcase looks: ${e}`);
  }
});
