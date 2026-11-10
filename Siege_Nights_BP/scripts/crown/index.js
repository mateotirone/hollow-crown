// The Crown: winning it, the Citadel, ruling, usurping, banishment and the exile's road back.
// Design: the "Crown, Citadel and Usurpation" doc. Numbers to tweak: crown/config.js.

import { world, system, ItemStack } from "@minecraft/server";
import { isReady, on, getState, keepOf } from "../siege/api.js";
import { IDS, CROWN } from "./config.js";
import { crown, saveCrown, giveItem, addClaim, ruler } from "./state.js";
import { clickCornerstone, raiseCitadel, citadel } from "./citadel.js";
import { throneMenu, offerCrown, crownPlayer, addHollowing, crownStatus } from "./reign.js";
import { claimantWins } from "./usurp.js";
import "./exile.js";
import "./tests.js";

// ---------- Clicking the Cornerstone and the Throne ----------

const lastClick = new Map();
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (!isReady() || event.isFirstEvent === false) return;
  if (block.typeId !== IDS.cornerstone && block.typeId !== IDS.throne) return;
  if (system.currentTick - (lastClick.get(player.id) ?? -100) < 6) return;
  lastClick.set(player.id, system.currentTick);
  if (block.typeId === IDS.cornerstone) clickCornerstone(block, player);
  else throneMenu(player);
});

// ---------- The handoff from the Undertow: the Hollow Choir is dead ----------

function bossDefeated(data) {
  if (data?.boss !== "hollow_choir") return;
  offerCrown([data.killer, ...(data.allies ?? [])].filter(Boolean)).catch((e) => console.warn(`[Hollow Crown] crown offer: ${e}`));
}
on("siege:boss_defeated", bossDefeated);

// ---------- Commands for testing (need cheats): /scriptevent siege:crown_<something> ----------

const COMMANDS = {
  // Offer the Crown to you and every player within 48 blocks, as if you had just killed the final boss
  crown_offer: (player) => { offerCrown(player.dimension.getPlayers({ location: player.location, maxDistance: 48 }).map((p) => p.id)).catch((e) => player.sendMessage(`§c${e}`)); },
  crown_me: (player) => crownPlayer(player),
  crown_claim: (player, n) => addClaim(player, Number(n) || CROWN.claimNeeded, "test command"),
  crown_shard: (player) => giveItem(player, new ItemStack(IDS.shardItem, 1)),
  crown_gauntlet: (player) => giveItem(player, new ItemStack(IDS.gauntlet, 1)),
  crown_hollow: (player, n) => { addHollowing((Number(n) || 0) - (ruler()?.hollowing ?? 0)); },
  crown_grace: () => { crown().graceUntil = 0; saveCrown(); },
  // End a running Storm in the claimant's favor
  crown_usurp: () => claimantWins("a test command broke the Seal"),
  // Drop a Crown Shard 6 blocks east of you
  crown_shardfall: (player) => {
    crown().shards.push({ x: Math.floor(player.location.x) + 6, z: Math.floor(player.location.z), placed: false });
    saveCrown();
  },
  // The only place the hidden Hollowing number is ever shown
  crown_status: (player) => player.sendMessage([...crownStatus(player), `Siege number: ${getState().siegeNumber}`, `Hollowing (secret): ${ruler()?.hollowing ?? "-"}`].join("\n")),
  // For the test world: crown you and raise the Citadel around your keep in about 30 seconds,
  // with the Great Keep 38 blocks south of your Keep Banner (clear of the showcase exhibits)
  crown_showcase: (player) => {
    const keep = keepOf(player.id);
    if (!keep) return player.sendMessage("§7Run /scriptevent siege:showcase first (you need a Keep Banner).");
    if (citadel()) return player.sendMessage("§7The Citadel already stands. /scriptevent siege:crown_reset wipes the High Throne's data.");
    if (ruler()?.id !== player.id) crownPlayer(player);
    raiseCitadel(player, { x: keep.x, y: keep.y, z: keep.z + 38 }, { fast: true });
  },
  crown_reset: () => { world.setDynamicProperty("siege:crown", undefined); world.sendMessage("§7High Throne data wiped. Reload the world."); },
};

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:boss_defeated") {
    try { bossDefeated(JSON.parse(event.message)); } catch { /* not for us */ }
    return;
  }
  const command = COMMANDS[event.id.replace("siege:", "")];
  const player = event.sourceEntity;
  if (!command || !isReady() || player?.typeId !== "minecraft:player") return;
  try {
    command(player, event.message);
  } catch (e) {
    player.sendMessage(`§c${event.id}: ${e}`);
  }
});

// ---------- The test world: /scriptevent siege:showcase ----------
// The Crown's blocks and items are already in the showcase rows and chests. This adds the Throne Seal
// and a sign for the one thing too big to put in a row.

on("showcase", ({ dim, nextSpot, label }) => {
  const sealAt = nextSpot();
  try {
    const seal = dim.spawnEntity(IDS.seal, { x: sealAt.x + 0.5, y: sealAt.y, z: sealAt.z + 0.5 });
    seal.addTag("siege_showcase");
    seal.nameTag = "§5Throne Seal §f1000/1000";
  } catch { /* not loaded */ }
  label(sealAt, "Throne Seal\nOnly a claimant\ncan hurt it");
  const sign = nextSpot();
  dim.getBlock(sign)?.setType("minecraft:gold_block");
  label(sign, "The Citadel\n/scriptevent\nsiege:\ncrown_showcase");
});
