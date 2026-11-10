// The world currency and economy of The Hollow Crown. See config.js for every number and api.js for
// what other features may use.
//
//   /scriptevent siege:economy_npc <job> [region]   place a job NPC (farmer, woodcutter, quarryman, smith, fisher, hunter, herbalist, moneyer)
//   /scriptevent siege:economy_give <coins>         coins into your pockets (testing)
//   /scriptevent siege:economy_stats                coins paid out and taken in so far, world-wide

import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { addKeepMenuButtons } from "../siege/api.js";
import { ECON } from "./config.js";
import { coins } from "./rules.js";
import { carried, banked, deposit, withdraw, giveCoins, totals } from "./coins.js";
import "./shops.js";
import "./showcase.js";
import "./tests.js";

// ---------- the strongbox, on the Keep Banner menu ----------

async function strongbox(player) {
  const inBox = banked(player), inHand = carried(player);
  const res = await new ActionFormData().title("Strongbox")
    .body(`Coins kept here are safe: they can't be dropped, lost or taken. Shops on your own land draw on them.\n\nIn the strongbox: ${coins(inBox)}\nIn your pockets: ${coins(inHand)}`)
    .button("Put coins in").button("Take coins out").button("Close").show(player);
  if (res.canceled || res.selection === 2) return;
  const putting = res.selection === 0;
  const most = putting ? inHand : inBox;
  if (most < 1) {
    player.onScreenDisplay.setActionBar(putting ? "§7Your pockets are empty." : "§7The strongbox is empty.");
    return strongbox(player);
  }
  const res2 = await new ModalFormData().title(putting ? "Put coins in" : "Take coins out")
    .slider(`How many ${ECON.many}`, 1, most, { valueStep: 1, defaultValue: most }).show(player);
  if (!res2.canceled) {
    const amount = Math.max(1, Math.min(most, Math.floor(res2.formValues[0])));
    const moved = putting ? deposit(player, amount) : withdraw(player, amount);
    player.onScreenDisplay.setActionBar(`§6${coins(moved)}§7 ${putting ? "locked away" : "taken out"}`);
  }
  strongbox(player);
}

addKeepMenuButtons(({ player, mine }) => (mine ? [{
  label: "Strongbox", icon: ECON.icon,
  action: () => strongbox(player).catch((e) => console.warn(`[Hollow Crown] strongbox: ${e}`)),
}] : []));

// ---------- test commands ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  if (event.id === "siege:economy_give") {
    const amount = Math.max(1, Math.min(64 * 64, parseInt(event.message) || 64));
    giveCoins(player, amount);
    player.sendMessage(`§a${coins(amount)} in your pockets.`);
  } else if (event.id === "siege:economy_stats") {
    const t = totals();
    player.sendMessage(`§6Economy:§7 ${coins(t.minted)} paid out to players, ${coins(t.sunk)} spent at shops. You carry ${coins(carried(player))}, strongbox ${coins(banked(player))}.`);
  }
});
