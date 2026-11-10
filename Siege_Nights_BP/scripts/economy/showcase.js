// The economy in the test world (/scriptevent siege:showcase): one of each job NPC in a row, and a purse to spend.

import { on } from "../siege/api.js";
import { JOBS, JOB_IDS, REGIONS } from "./config.js";
import { giveCoins } from "./coins.js";
import { spawnJobNpc } from "./shops.js";

on("showcase", ({ player, dim, nextSpot, label }) => {
  JOB_IDS.forEach((id, i) => {
    const spot = nextSpot();
    // each stands in a different region so the regional prices can be compared
    const region = JOBS[id].mint ? undefined : REGIONS[i % REGIONS.length];
    try {
      spawnJobNpc(dim, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, id, region)?.addTag("siege_showcase");
    } catch (e) {
      console.warn(`[Hollow Crown] economy showcase: ${e}`);
    }
    label(spot, `${JOBS[id].name}\n${region ?? "the Mint"}\nClick to trade`);
  });
  giveCoins(player, 200);
  player.sendMessage("§6Economy:§7 the job NPCs are in the row behind you, and you have 200 Regals. Sell the Farmer wheat, take iron to the Moneyer. Your Keep Banner menu has a Strongbox.");
});
