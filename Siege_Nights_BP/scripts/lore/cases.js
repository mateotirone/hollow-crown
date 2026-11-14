// The hidden Returned, the lore side: the four families who ask the player to find out.
// The villagers and their tells belong to the mobs feature (bestiary/returned.js). This file places
// the named suspects for the map builder, and handles the one case that is not a villager:
// Hesper Lowe, who asks about her husband and is the copy herself.
//   /scriptevent siege:lore_case <id>     (creative) put that case's suspect where you stand: harl, bram, pip, hesper
//   /scriptevent siege:lore_case list
// The askers are ordinary story characters: /scriptevent siege:lore_npc nessa | jorund | tilly | hesper

import { world, system } from "@minecraft/server";
import { markReturned } from "../bestiary/returned.js";
import { CASES } from "./data/returned.js";
import { setFlag, awardPoints } from "./player.js";

const CASE = Object.fromEntries(CASES.map((c) => [c.id, c]));
const HESPER_TAG = "siege_lore_npc_hesper";
const BELL_RANGE = 16;

function placeSuspect(player, id) {
  const c = CASE[id];
  if (!c) return player.sendMessage(`§7Cases: ${CASES.map((x) => `${x.id} (${x.suspect}, ${x.village})`).join(", ")}`);
  // vanilla villager on purpose: the suspects may be Returned, and a Returned must pass for any villager
  const villager = player.dimension.spawnEntity("minecraft:villager_v2", player.location);
  villager.nameTag = c.suspect;
  if (c.returned) markReturned(villager, { name: c.suspect, quest: c.id });
  player.sendMessage(`§a${c.suspect} placed.§r §7${c.returned ? "This one did not come back the same." : "This one is exactly who they say they are."} Put ${c.asker} nearby with /scriptevent siege:lore_npc ${c.asker}`);
}

// What the mobs feature tells us about a named case
function caseEvent(id, data) {
  const c = CASE[data?.quest];
  const player = data?.player && world.getAllPlayers().find((p) => p.id === data.player || p.name === data.player);
  if (!c || !player) return;
  if (id === "siege:returned_exposed") {
    // the bell is proof: the Ledger does not wait for the conversation
    const flag = c.flags.right ?? c.flags.told;
    if (flag && setFlag(player, flag)) player.sendMessage(`§7§o${c.bell}`);
  }
}

// Hesper is a story character, not a villager, so her bell is ours.
world.afterEvents.playerInteractWithBlock.subscribe(({ block, player }) => {
  if (block?.typeId !== "minecraft:bell") return;
  let hesper;
  try {
    [hesper] = block.dimension.getEntities({ type: "minecraft:npc", tags: [HESPER_TAG], location: block.location, maxDistance: BELL_RANGE });
  } catch {}
  if (!hesper || hesper.hasTag("siege_showcase")) return;
  const dim = hesper.dimension, at = { ...hesper.location };
  for (const p of dim.getPlayers({ location: at, maxDistance: 32 })) {
    p.sendMessage("§fHesper Lowe§7 stops, quite still.\n§f\"Oh. It's time, is it.\"§7\nShe sets the cup down with her left hand, and walks out into the fen.");
  }
  if (setFlag(player, CASE.hesper.flags.right)) {
    setFlag(player, CASE.hesper.flags.other);
    awardPoints(player, 2, "story", 30);
  }
  system.runTimeout(() => {
    try {
      dim.spawnParticle("minecraft:large_explosion", { x: at.x, y: at.y + 1, z: at.z });
      hesper.remove();
    } catch {}
  }, 60);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id === "siege:lore_case") {
    if (player?.typeId === "minecraft:player") {
      try { placeSuspect(player, message.trim()); } catch (e) { player.sendMessage(`§cCould not place: ${e}`); }
    }
    return;
  }
  if (!id.startsWith("siege:returned_")) return;
  try { caseEvent(id, JSON.parse(message)); } catch { /* not ours */ }
});
