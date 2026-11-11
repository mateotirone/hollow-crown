// Menu blocks must count as "interactable" for Minecraft to report an empty-hand click on them.
// Without this, playerInteractWithBlock only fires when the player holds an item (found in the
// first real-map playtest, 2026-11-11: the Waystone did nothing until clicked with something in hand).
// Each menu block lists "siege:clickable": {} in its components; the handlers that open the menus
// stay where they are (they listen to world.afterEvents.playerInteractWithBlock).
import { system } from "@minecraft/server";

export const CLICKABLE = "siege:clickable";

system.beforeEvents.startup.subscribe((e) => {
  e.blockComponentRegistry?.registerCustomComponent(CLICKABLE, { onPlayerInteract() {} });
});
