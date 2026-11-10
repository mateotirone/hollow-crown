// Character looks: the add-on carries a set of character skins (made on the creator page) and draws
// each player as the one they picked, so nobody has to import a skin and it works on every device.
//
// How it fits together: the player entity has one synced number, hc:look (0 = your own skin).
// The resource pack's player file swaps the texture when it is above 0. The list of looks is data.js,
// written by studio/build_looks.mjs. A look with a `player` is reserved for that gamertag.
//
// Players choose on their first join, at a Looking Glass block, or from their Keep Banner menu.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, addKeepMenuButtons } from "../siege/api.js";
import { LOOKS } from "./data.js";
import "./tests.js";

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
  let res;
  try {
    res = await form.show(player);
  } catch {
    return false;
  }
  if (res.canceled || res.selection === undefined) return false;
  const look = mine[res.selection];
  if (!setLook(player, look)) {
    player.sendMessage("§cLooks are not working in this world. Tell whoever runs it that the player file from the add-on is missing.");
    return true;
  }
  player.sendMessage(look ? `§7You are §f${look.name}§7 here.` : "§7You look like yourself again.");
  player.playSound("armor.equip_leather");
  return true;
}

// First join: a reserved look is put on straight away, everyone else is asked once.
function welcome(player, triesLeft = 5) {
  if (!player.isValid) return;
  const chosen = player.getDynamicProperty(CHOSEN);
  if (typeof chosen === "string") {
    // Keep the number in step with the id, in case the list was rebuilt
    const look = LOOKS.find((l) => l.id === chosen);
    const n = look && (!look.player || same(look.player, player.name)) ? look.n : 0;
    try {
      if (player.getProperty(PROP) !== n) player.setProperty(PROP, n);
    } catch { /* no player file: nothing to keep in step */ }
    return;
  }
  const reserved = reservedFor(player.name);
  if (reserved) {
    if (setLook(player, reserved)) player.sendMessage(`§7You arrive as §f${reserved.name}§7. Any Looking Glass will let you change.`);
    return;
  }
  chooseLook(player).then((answered) => {
    // The form can't open while the loading screen or another menu is up: try again a few times
    if (!answered && triesLeft > 0) system.runTimeout(() => welcome(player, triesLeft - 1), 100);
  });
}
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) system.runTimeout(() => welcome(player), 80);
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
