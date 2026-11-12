// The third night's toll for dragons (Mateo, decision card 2026-11-12: "Only around 3:17").
// On a siege night no dragon will fly from 03:00 to 03:30: she won't take off, and one already up glides down.
// The Dragonlord's Unflown Night: a top-rank Dragon Rider's dragon flies through it, every siege night, and from up
// there the siege host shows itself (every raider glows for 30 seconds, once a night). Kesh tells them at the top rank.
// Uses the dragons feature's "dragonCanFly" filter, and reach/api.js isSiegeNight().

import { world } from "@minecraft/server";
import { addFilter, title, RAIDER_TAG, addTests, assertEqual } from "../siege/api.js";
import { isSiegeNight } from "../reach/api.js";
import { sfx } from "../core/sfx.js";
import { tollRule } from "./logic.js";
import { atTop } from "./stand.js";
import { trialsOf, save, heroOf } from "./saves.js";

const GROUNDED = [
  "folds her wings and puts her head under one. Not at this hour.",
  "won't leave the ground. She's watching the north, very still.",
  "lies flat and goes quiet as a stone. It's nearly seventeen past three.",
];

function revealHost(player) {
  try {
    for (const raider of player.dimension.getEntities({ tags: [RAIDER_TAG], location: player.location, maxDistance: 256 })) {
      raider.addEffect("glowing", 600, { showParticles: false });
    }
  } catch { /* nothing out there */ }
}

addFilter("dragonCanFly", (no, { player, rec }) => {
  if (no || !player) return no;
  let siegeNight = false;
  try { siegeNight = isSiegeNight(); } catch { return no; }
  const t = trialsOf(player);
  const today = Math.floor(world.getAbsoluteTime() / 24000);
  const rule = tollRule({ siegeNight, timeOfDay: world.getTimeOfDay(), dragonlord: atTop(heroOf(player), "rider"), unflownDay: t.unflown, today });
  if (rule === "fly") return no;
  if (rule === "unflown") {
    t.unflown = today;
    save(player);
    title(player, "§cThe Unflown Night", "§7She flies when no other dragon will");
    sfx(player, "sig.toll_317", { volume: 0.6 });
    player.sendMessage(`§c${rec?.name ?? "Your dragon"} looks at you for a long moment, and then spreads her wings.§7 From up here you can see them: the whole host, gathering in the dark before it marches.`);
    revealHost(player);
    return no;
  }
  return `§7${rec?.name ?? "Your dragon"} ${GROUNDED[Math.floor(Math.random() * GROUNDED.length)]}`;
});

addTests("roletrials", {
  "dragons and the 3:17 toll": () => {
    const base = { siegeNight: true, timeOfDay: 21283, dragonlord: false, unflownDay: -1, today: 9 };
    assertEqual(tollRule(base), "grounded");
    assertEqual(tollRule({ ...base, siegeNight: false }), "fly");
    assertEqual(tollRule({ ...base, timeOfDay: 20000 }), "fly");
    assertEqual(tollRule({ ...base, timeOfDay: 21600 }), "fly");
    assertEqual(tollRule({ ...base, dragonlord: true }), "unflown");
    assertEqual(tollRule({ ...base, dragonlord: true, unflownDay: 9 }), "fly", "the rest of that night, no second reveal");
    assertEqual(tollRule({ ...base, dragonlord: true, unflownDay: 4 }), "unflown", "every siege night");
  },
});
