// Boss Summons: creative-menu items for playtests (Equipment tab, "Hollow Crown: Boss Summons").
// Use one and that boss appears 6 blocks in front of you with its whole fight (the same start as
// /scriptevent siege:bestiary_summon). Not craftable or sold; items, icons and the menu group are made
// by studio/build_creative.py, whose BOSSES list must match SUMMONS here.
//
//   The Choir only sings in the Court of the Hollow (its attacks are drawn around the Court), so its
//   summon takes you to the Court first, if the Court has been built (/scriptevent hc:undertow_status).
//   A Pretender is rolled fresh each time (same as /scriptevent siege:pretender_rise).

import { world, system, EquipmentSlot, GameMode } from "@minecraft/server";
import { addTests, assert } from "../core/tests.js";
import { bossDefs, startBoss, activeFights, fightOf } from "../bestiary/bossCore.js";
import { UNDERTOW_ID, COURT } from "../undertow/layout.js";
import { pieces } from "../undertow/builder.js";

export const SUMMONS = {
  "siege:summon_reeve": "reeve",
  "siege:summon_huntsman": "huntsman",
  "siege:summon_bride": "bride",
  "siege:summon_seneschal": "seneschal",
  "siege:summon_mother": "mother",
  "siege:summon_warlord_king": "warlord_king",
  "siege:summon_choir": "choir",
  "siege:summon_morvane": "morvane",
  "siege:summon_pretender": "pretender",
};

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const tell = (player, text) => { try { player.onScreenDisplay.setActionBar(text); } catch { /* left */ } };

export function spotAhead(location, view, distance = 6) {
  const d = Math.hypot(view.x, view.z) || 1;
  return { x: location.x + (view.x / d) * distance, y: location.y, z: location.z + (view.z / d) * distance };
}

function useUp(player, typeId) {
  if (player.getGameMode() === GameMode.Creative) return;
  const eq = player.getComponent("equippable");
  const stack = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (stack?.typeId === typeId) eq.setEquipment(EquipmentSlot.Mainhand, stack.amount > 1 ? (stack.amount--, stack) : undefined);
}

function summonChoir(player) {
  if (fightOf("choir")) return tell(player, "§7The Choir is already singing.");
  if (!pieces().court) return tell(player, "§7The Court of the Hollow isn't built yet (/scriptevent hc:undertow_status).");
  const dim = world.getDimension(UNDERTOW_ID);
  const centre = { x: COURT.center.x + 0.5, y: COURT.floorY, z: COURT.center.z + 0.5 };
  player.teleport({ x: centre.x, y: centre.y + 1, z: centre.z - 14 }, { dimension: dim, facingLocation: centre });
  player.sendMessage("§5Boss Summon:§7 the Choir only sings in the Court. It wakes in a moment.");
  system.runTimeout(() => {
    if (fightOf("choir")) return; // the Court woke it on its own
    try { startBoss("choir", dim, centre); } catch (e) { console.warn(`[Creative] could not wake the Choir: ${e}`); }
  }, 60);
  return true;
}

function summon(player, typeId) {
  const id = SUMMONS[typeId];
  if (id === "pretender") {
    player.runCommand("scriptevent siege:pretender_rise");
    return true;
  }
  if (id === "choir") return summonChoir(player);
  const def = bossDefs().find((d) => d.id === id);
  if (!def) return tell(player, `§7${typeId} has no boss to call.`);
  if (activeFights().some((f) => f.def.id === id && f.dim.id === player.dimension.id && flat(f.center, player.location) < 96)) {
    return tell(player, `§7${def.name} is already here.`);
  }
  try {
    startBoss(id, player.dimension, spotAhead(player.location, player.getViewDirection()));
  } catch {
    return tell(player, "§7Nothing answers. Try somewhere more open.");
  }
  return true;
}

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const typeId = event.itemStack?.typeId;
  if (!SUMMONS[typeId] || player?.typeId !== "minecraft:player") return;
  try {
    if (summon(player, typeId) === true) useUp(player, typeId);
  } catch (e) {
    console.warn(`[Creative] ${typeId}: ${e}`);
  }
});

addTests("creative", {
  "every Boss Summon calls a boss that has a fight": () => {
    const known = new Set(bossDefs().map((d) => d.id));
    for (const [item, id] of Object.entries(SUMMONS)) {
      if (id === "pretender") continue; // rolled by pretenders.js, not a fixed boss
      assert(known.has(id), `${item} points at "${id}", which has no fight`);
    }
  },
  "every boss with a fight has a Boss Summon": () => {
    const summoned = new Set(Object.values(SUMMONS));
    for (const d of bossDefs()) assert(summoned.has(d.id.startsWith("pretender_") ? "pretender" : d.id), `boss "${d.id}" has no Boss Summon item (add it here and in studio/build_creative.py)`);
  },
  "a summoned boss lands in front of you": () => {
    const at = spotAhead({ x: 0, y: 64, z: 0 }, { x: 0, y: -0.5, z: 2 });
    assert(Math.abs(at.z - 6) < 1e-9 && at.x === 0 && at.y === 64, `landed at ${JSON.stringify(at)}`);
  },
});
