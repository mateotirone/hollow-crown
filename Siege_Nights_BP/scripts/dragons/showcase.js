// Dragons in the test world (/scriptevent siege:showcase): a Roost, a wild Nest, the three growth stages
// as display dragons, and (if you have no dragon yet) a grown, saddled, trained one that is yours to fly.

import { on } from "../siege/api.js";
import { DRAGON, ROOST, NEST, HUES, newDragon } from "./data.js";
import { store, dragonOf, save, spawnDragon, roostDragon } from "./dragon.js";

const TAG = "siege_showcase";

on("showcase", ({ player, dim, nextSpot, label }) => {
  const roost = nextSpot();
  const nest = nextSpot();
  try {
    dim.getBlock(roost)?.setType(ROOST);
    label(roost, "Dragon Roost\nclick: train\negg: hatch");
    dim.getBlock(nest)?.setType(NEST);
    label(nest, "Dragon Nest\nclick: take\nan egg");
  } catch (e) {
    console.warn(`[Hollow Crown] dragons showcase blocks: ${e}`);
  }

  // Display dragons: no owner, so they just stand there
  [["hatchling", 1], ["fledgling", 2], ["adult", 3]].forEach(([stage, hue]) => {
    const at = nextSpot();
    if (stage === "adult") nextSpot(); // an adult with folded wings needs two spots
    try {
      const statue = dim.spawnEntity(DRAGON, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
      statue.addTag(TAG);
      statue.triggerEvent(`siege:stage_${stage}`);
      statue.setProperty("siege:hue", hue);
      statue.nameTag = `${HUES[hue]} ${stage}`;
      label(at, `Dragon\n${stage}\n${HUES[hue]}`);
    } catch (e) {
      console.warn(`[Hollow Crown] dragons showcase ${stage}: ${e}`);
    }
  });

  // Yours to fly
  let rec = dragonOf(player.id);
  if (rec?.showcase) {
    roostDragon(rec);
    rec = undefined;
  }
  if (rec) {
    return player.sendMessage("§6Dragons: a Roost, a Nest and three display dragons are behind you. You already have a dragon of your own, so no test dragon was added.");
  }
  const mine = nextSpot();
  nextSpot();
  rec = Object.assign(newDragon(player.id, player.name, 0), {
    showcase: true, name: "Cinder", hue: 0, stage: "adult", bond: 100, level: 12, tp: 4, bornAt: 0, saddled: true, order: "stay",
    stats: { wings: 3, speed: 2, vigor: 2, breath: 2 }, roost: { x: roost.x, y: roost.y, z: roost.z },
  });
  store.data.dragons[player.id] = rec;
  save();
  spawnDragon(rec, dim, { x: mine.x + 0.5, y: mine.y, z: mine.z + 0.5 }).addTag(TAG);
  label(mine, "Cinder (yours)\nclick: ride\njump: fly");
  player.sendMessage("§6Dragons: Cinder, behind you, is yours. Click to ride, press jump to take off, look where you want to go, and use the Dragon Horn (item chests) in the air to breathe fire. Sneak and click it for its sheet. The Roost next to it trains it.");
});
