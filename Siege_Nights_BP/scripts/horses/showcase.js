// Horses in the test world (/scriptevent siege:showcase): one of every breed, both special steeds,
// a foal and a Breeder's Post, all yours, with a level 3 Stables so every menu option is open.

import { on } from "../siege/api.js";
import { BREEDS, REGIONAL_BREEDS, TRAITS, newRecord, breedFoal, HORSE_SETTINGS as S } from "./data.js";
import { horsesOf, deleteRecord, newUid, meta } from "./store.js";
import { spawnSteed, bannerColorOf } from "./steed.js";

const TAG = "siege_showcase";

on("showcase", ({ player, dim, nextSpot, label }) => {
  for (const old of horsesOf(player.id)) if (old.showcase) deleteRecord(old.uid); // from an earlier run
  meta.data.stables[player.id] = 3;

  const show = (rec, sign) => {
    const at = nextSpot();
    Object.assign(rec, { showcase: true, gearSaddle: !rec.foal });
    spawnSteed(rec, dim, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }).addTag(TAG);
    label(at, sign);
    return rec;
  };
  const make = (breed, name, extra = {}) => Object.assign(
    newRecord({ uid: newUid(), owner: player.id, ownerName: player.name, breed, name }), extra);

  const byBreed = {};
  for (const breed of REGIONAL_BREEDS) {
    const info = BREEDS[breed];
    byBreed[breed] = show(make(breed, info.short, { level: 6, tp: 5, pp: 1, stats: { speed: 2, jump: 2, health: 2, stamina: 2 } }),
      `${info.name}\n${TRAITS[info.trait].name}\n5 points to train`);
  }
  show(make("courser", "Valiant", {
    level: 20, tp: 3, stats: { speed: 5, jump: 4, health: 5, stamina: 4 }, special: "warhorse", shoes: "netherite", saddle: "royal",
    caparison: bannerColorOf(player.id), perks: ["trample", "sprint_burst", "fleet", "loyal"], gearArmor: "minecraft:diamond_horse_armor",
  }), "Knight Warhorse\nGallop into mobs\nfull gear");
  show(make("mirepony", "Whisper", {
    level: 20, tp: 3, stats: { speed: 4, jump: 5, health: 4, stamina: 5 }, special: "hollow", shoes: "diamond", saddle: "cavalry",
    perks: ["second_wind", "fearless", "skyleap", "loyal"],
  }), "Hollow Steed\nWhistle while\nriding: Step");
  const born = breedFoal(byBreed.courser, byBreed.destrier);
  show(Object.assign(make("common", "Sprout"), born, { foal: true, grownAt: Number.MAX_SAFE_INTEGER / 2 }),
    "Crossbred foal\nCourser x\nDestrier");

  const post = nextSpot();
  try {
    dim.getBlock(post)?.setType("hc:breeder_post");
    meta.data.posts[`${post.x},${post.y},${post.z}`] = "sandstrider";
    label(post, `Breeder's Post\nfoal: ${S.breederPostPrice} emeralds`);
  } catch (e) {
    console.warn(`[Hollow Crown] showcase breeder post: ${e}`);
  }
  meta.save();
  player.sendMessage("§6Horses: 8 steeds behind you are yours (5 breeds, a Warhorse, a Hollow Steed, a foal). Use the Riding Crop from the item chests to gallop, and click the Stables block to train them.");
});
