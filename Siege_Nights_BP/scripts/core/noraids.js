// No vanilla raids (Mateo, 2026-11-12 playtest). The Hollow Crown's sieges are its own raids, so a
// vanilla raid (horn, "Raid" boss bar, pillager waves) must never start. A vanilla raid needs a
// player carrying Bad Omen (from an Ominous Bottle) who walks into a village, where it turns into
// Raid Omen and the raid starts 30 seconds later. Real villagers live in the settlements (recruits
// for the Quartermaster, Lost Travellers), so we take both omens off every player as soon as they
// get one, before Raid Omen can run out. Trial Omen (trial chambers) is left alone.
//
// Nothing in the add-on uses these effects: the siege system, the Choir's "Echo of the Siege" and the
// rumor captors summon their own mobs and never start a vanilla raid.

import { world } from "@minecraft/server";
import { onTick } from "./loop.js";
import { addTests, assertEqual } from "./tests.js";

export const RAID_OMENS = ["bad_omen", "raid_omen"];

// Takes the raid omens off one player. Returns how many it removed.
export function clearRaidOmens(player) {
  let removed = 0;
  for (const id of RAID_OMENS) {
    try {
      if (!player.getEffect(id)) continue;
      player.removeEffect(id);
      removed++;
    } catch { /* this game version has no such effect, or the player left */ }
  }
  return removed;
}

// Once a second: Raid Omen lasts 30 s, so this always wins.
onTick("noraids", 20, () => {
  for (const p of world.getAllPlayers()) {
    if (clearRaidOmens(p)) p.sendMessage("§7The omen fades. No raid comes here: the keeps' own nights are war enough.");
  }
});

addTests("noraids", {
  "Bad Omen and Raid Omen come off, other effects stay": () => {
    const effects = new Set(["bad_omen", "raid_omen", "trial_omen", "speed"]);
    const fake = { getEffect: (id) => (effects.has(id) ? { typeId: id } : undefined), removeEffect: (id) => effects.delete(id) };
    assertEqual(clearRaidOmens(fake), 2);
    assertEqual([...effects].sort().join(","), "speed,trial_omen");
    assertEqual(clearRaidOmens(fake), 0);
  },
  "a player without getEffect (left the game) does not throw": () => {
    assertEqual(clearRaidOmens({}), 0);
  },
});
