// Quest marks: the person a player's current step sends them to talk to gets a gold "!" floating over their head
// (only that player sees it: Player.spawnParticle), and the quest's pin on the minimap moves onto them while they
// are close. Which person comes from the step's npc (rules.js: a tag their NPC carries).
//
// Cheap on purpose: one entity lookup per player every LOOK ticks, near the player only, and nothing at all for a
// player whose step names nobody.

import { system } from "@minecraft/server";

export const MARK = "siege:quest_mark"; // Siege_Nights_RP/particles/quest_mark.particle.json, art by tools/minimap_pins.py
export const NEAR = 96; // blocks: look for the person this close (about the minimap's reach)
const LIFT = 2.35; // blocks above their feet
const KEEP = 30; // ticks a found person stays the minimap's pin after they were last seen

const found = new Map(); // player id -> { x, y, z, at }

// Look for the person and mark them. Returns their spot or undefined.
export function markTalk(player, npc) {
  if (!npc?.tag) { found.delete(player.id); return undefined; }
  let who;
  try {
    who = player.dimension.getEntities({ tags: [npc.tag], location: player.location, maxDistance: NEAR, closest: 1 })[0];
  } catch { /* their ground isn't loaded */ }
  if (!who) return undefined;
  const at = who.location;
  try { player.spawnParticle(MARK, { x: at.x, y: at.y + LIFT, z: at.z }); } catch { /* particle pack missing */ }
  const spot = { x: at.x, y: at.y, z: at.z, at: system.currentTick };
  found.set(player.id, spot);
  return spot;
}

// Where the person was last seen, if lately.
export function talkSpot(playerId) {
  const s = found.get(playerId);
  return s && system.currentTick - s.at <= KEEP ? s : undefined;
}

export const forget = (playerId) => found.delete(playerId);
