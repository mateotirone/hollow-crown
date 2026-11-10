// The Crown: winning it, the Citadel, ruling, usurping, banishment and the exile's road back.
// Design: the "Crown, Citadel and Usurpation" doc. Numbers to tweak: crown/config.js.

import { world, system, ItemStack } from "@minecraft/server";
import { isReady, on, getState, keepOf } from "../siege/api.js";
import { IDS, CROWN } from "./config.js";
import { crown, saveCrown, giveItem, addClaim, ruler, lords, resetCrown } from "./state.js";
import { clickCornerstone, raiseCitadel, citadel } from "./citadel.js";
import { throneMenu, crownPlayer, addHollowing, crownStatus } from "./reign.js";
import { restHeart } from "./heart.js";
import { claimantWins, lordChallenge, npcWins } from "./usurp.js";
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
  if (!CROWN.heartBosses.includes(data?.boss)) return;
  if (crown().resting && data.boss !== CROWN.heartBosses[0]) return; // only the final boss moves a Heart that is already lying somewhere
  const killer = world.getPlayers().find((p) => p.id === data.killer); // the Heart comes to rest where the killing blow was struck
  if (killer) return restHeart(killer.location, killer.dimension.id);
  if (typeof data.x === "number") restHeart(data, data.dimension ?? "siege:undertow");
}
on("siege:boss_defeated", bossDefeated);

// ---------- Commands for testing (need cheats): /scriptevent siege:crown_<something> ----------

const COMMANDS = {
  // Lay the Heart at your feet, as if the final boss had just died here. Click it to reach for it.
  crown_offer: (player) => restHeart(player.location, player.dimension.id),
  crown_me: (player) => crownPlayer(player),
  crown_claim: (player, n) => addClaim(player, Number(n) || CROWN.claimNeeded, "test command"),
  crown_shard: (player) => giveItem(player, new ItemStack(IDS.shardItem, 1)),
  crown_gauntlet: (player) => giveItem(player, new ItemStack(IDS.gauntlet, 1)),
  crown_hollow: (player, n) => { addHollowing((Number(n) || 0) - (ruler()?.hollowing ?? 0)); },
  crown_grace: () => { crown().graceUntil = 0; saveCrown(); },
  // End a running Storm in the claimant's favor
  crown_usurp: () => claimantWins("a test command broke the Seal"),
  // Rival lords. crown_rival: a lord throws down the Gauntlet against the ruler (their army comes next siege night).
  // crown_lord: a lord takes the throne from you right now, so you can try winning it back.
  crown_rival: (player) => {
    const c = crown();
    if (!c.ruler || c.ruler.npc) return player.sendMessage("§7A player has to hold the throne first (/scriptevent siege:crown_me).");
    if (c.challenge) return player.sendMessage("§7A Gauntlet is already down.");
    c.graceUntil = 0;
    lordChallenge(lords()[0]);
  },
  crown_lord: (player) => {
    const c = crown();
    if (c.ruler?.id !== player.id) return player.sendMessage("§7You have to hold the throne first (/scriptevent siege:crown_me).");
    if (!c.challenge?.npc) lordChallenge(lords()[0]);
    npcWins("a test command opened the gates");
  },
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
  crown_reset: () => { resetCrown(); world.sendMessage("§7High Throne data wiped."); },
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
