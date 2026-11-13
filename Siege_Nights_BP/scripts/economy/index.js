// The world currency and economy of The Hollow Crown. See config.js for every number and api.js for
// what other features may use.
//
//   /scriptevent siege:economy_npc <job> [region]   place a job NPC (farmer, woodcutter, quarryman, smith, fisher, hunter, herbalist, moneyer)
//   /scriptevent siege:economy_give <coins>         Regals onto your balance (testing)
//   /scriptevent siege:economy_stats                coins paid out and taken in so far, world-wide
//   /scriptevent siege:economy_towns [reset <town|all>]   the traders placed in the map's towns (towns.js)

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { addKeepMenuButtons } from "../siege/api.js";
import { ECON } from "./config.js";
import { coins } from "./rules.js";
import { carried, banked, giveCoins, absorb, totals } from "./coins.js";
import "./shops.js";
import "./golems.js";
import "./towns.js";
import "./showcase.js";
import "./hud.js";
import "./tests.js";

// ---------- your Regals, on the Keep Banner menu ----------
// One number, no deposit or withdrawal (Mateo, 2026-11-12). The Regal Safe in your vault is where a thief robs it.

export async function strongbox(player) {
  await new ActionFormData().title("Your Regals")
    .body(`You have ${coins(carried(player))}.\n\nEvery Regal you own is one sum: shops take from it and rewards add to it, wherever you are. Coins you pick up are counted in at once.\n\nYour Regals sit in the Regal Safe in your vault. A thief who breaks in can rob it a blow at a time.`)
    .button("Close").show(player);
}

// Coins picked up from loot are counted into the balance
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      const n = absorb(player);
      if (n) player.onScreenDisplay.setActionBar(`§6+${coins(n)}§7  (you have ${coins(banked(player))})`);
    } catch { /* left */ }
  }
}, 20);

// Strongboxes moved from the player to the world (so a vault can be robbed while its keeper is away): move each
// player's over as soon as they are here
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => { if (initialSpawn) try { banked(player); } catch { /* fine */ } });

addKeepMenuButtons(({ player, mine }) => (mine ? [{
  label: "Regals", icon: ECON.icon,
  action: () => strongbox(player).catch((e) => console.warn(`[Hollow Crown] strongbox: ${e}`)),
}] : []));

// ---------- test commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (event.id === "siege:economy_give") {
    const amount = Math.max(1, Math.min(64 * 64, parseInt(event.message) || 64));
    giveCoins(player, amount);
    player.sendMessage(`§a${coins(amount)} added. You have ${coins(banked(player))}.`);
  } else if (event.id === "siege:economy_stats") {
    const t = totals();
    player.sendMessage(`§6Economy:§7 ${coins(t.minted)} paid out to players, ${coins(t.sunk)} spent at shops. You have ${coins(carried(player))}.`);
  }
});
