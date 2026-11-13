// Dragons in the test world (/scriptevent siege:showcase): a Roost, a Hatching Brazier, a wild Nest, the three growth stages
// and every species' other colours as display dragons, and (if you have no dragon yet) a grown, saddled, trained one that is yours to fly.

import { on } from "../siege/api.js";
import { DRAGON, ROOST, HATCHERY, SPECIES, newDragon } from "./data.js";
import { store, dragonOf, save, spawnDragon, roostDragon } from "./dragon.js";
import { buildNest } from "./nests.js";

const TAG = "siege_showcase";

on("showcase", ({ player, dim, origin, nextSpot, label }) => {
  const roost = nextSpot();
  // a whole wild nest (9x9) west of the "more" row, sunk into the ground like the wild ones
  const nest = { x: origin.x - 38, y: origin.y - 1, z: origin.z - 8 };
  try {
    dim.getBlock(roost)?.setType(ROOST);
    label(roost, "Dragon Roost\nclick: train\non your land:\nraises the stable");
    const brazier = nextSpot();
    dim.getBlock(brazier)?.setType(HATCHERY);
    label(brazier, "Hatching Brazier\negg: hatch");
    buildNest(dim, nest);
    label({ x: nest.x + 6, y: origin.y, z: nest.z }, "Dragon Nest (9x9)\nclick the eggs:\ntake one");
  } catch (e) {
    console.warn(`[Hollow Crown] dragons showcase blocks: ${e}`);
  }

  // Display dragons: no owner, so they just stand there
  // every species as an adult, a hatchling and a fledgling, one asleep, one unconscious, one dead
  [["adult", 0, 0], ["adult", 1, 0], ["adult", 2, 0], ["adult", 3, 0], ["hatchling", 1, 0], ["fledgling", 2, 0], ["adult", 0, 1], ["adult", 3, 2], ["adult", 2, 3]].forEach(([stage, hue, pose]) => {
    const at = nextSpot();
    if (stage === "adult") nextSpot(); // an adult needs two spots
    try {
      const statue = dim.spawnEntity(DRAGON, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
      statue.addTag(TAG);
      statue.triggerEvent(`siege:stage_${stage}`);
      statue.setProperty("siege:species", hue);
      if (pose) {
        statue.triggerEvent("siege:go_down");
        statue.setProperty("siege:pose", pose);
      }
      const state = ["", "asleep", "unconscious", "dead"][pose];
      statue.nameTag = pose === 3 ? "" : `${SPECIES[hue].name}${state ? ` (${state})` : ""}`;
      label(at, `${SPECIES[hue].name}\n${state || stage}`);
    } catch (e) {
      console.warn(`[Hollow Crown] dragons showcase ${stage}: ${e}`);
    }
  });

  // The other two colours of every species, as fledglings (colour 0 is the row above)
  SPECIES.forEach((sp, species) => [1, 2].forEach((hue) => {
    const at = nextSpot();
    try {
      const statue = dim.spawnEntity(DRAGON, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
      statue.addTag(TAG);
      statue.triggerEvent("siege:stage_fledgling");
      statue.setProperty("siege:species", species);
      statue.setProperty("siege:hue", hue);
      statue.nameTag = `${sp.colours[hue]} ${sp.name}`;
      label(at, `${sp.colours[hue]}\n${sp.name}`);
    } catch (e) {
      console.warn(`[Hollow Crown] dragons showcase colour: ${e}`);
    }
  }));

  // Yours to fly
  let rec = dragonOf(player.id);
  if (rec?.showcase) {
    roostDragon(rec);
    rec = undefined;
  }
  if (rec) {
    return player.sendMessage("§6Dragons: a Roost, a Nest and nine display dragons are behind you. You already have a dragon of your own, so no test dragon was added.");
  }
  const mine = nextSpot();
  nextSpot();
  rec = Object.assign(newDragon(player.id, player.name, 0), {
    showcase: true, name: "Cinder", species: 0, stage: "adult", bond: 100, level: 12, tp: 4, bornAt: 0, saddled: true, order: "stay",
    stats: { wings: 3, speed: 2, vigor: 2, breath: 2 }, roost: { x: roost.x, y: roost.y, z: roost.z },
  });
  store.data.dragons[player.id] = rec;
  save();
  spawnDragon(rec, dim, { x: mine.x + 0.5, y: mine.y, z: mine.z + 0.5 }).addTag(TAG);
  label(mine, "Cinder (yours)\nclick: ride\njump: fly");
  player.sendMessage("§6Dragons: Cinder, behind you, is yours. Click to ride, press jump to take off, look where you want to go, and use the Dragon Horn (item chests) in the air to breathe fire. Sneak and click it for its sheet. The Roost next to it trains it.");
});
