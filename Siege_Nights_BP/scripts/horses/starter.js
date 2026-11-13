// The starter horse (Mateo 2026-11-13: "a better early game mechanic to get around the map ... you should get a
// starter horse that's slow and doesn't jump high and its skin matches the theme").
//
// Every new player is given a working cob of their own region once, saddled and tame, with a Horse Whistle:
//   - picking a plot in the welcome hall (event plotChosen): that plot's region;
//   - starting in Kingsrest with no plot (event startedHomeless): the Vale;
//   - a world with no welcome hall: at the end of their first join, the region they stand in;
//   - players who started before this existed (they already have their starter clothes): on their next join.
// The cob's numbers and rules are in data.js (COB, STARTER_COBS): slower than any horse you can earn, a jump too
// weak for a fence, no training or gear, no stall taken. It always answers its Horse Whistle, and a fallen cob
// limps home after a day (index.js). The quest tracker points it out until it is first ridden (cobFacts).
//
// Builder command:  /scriptevent siege:starter_horse [vale|frostmarch|saltreach|emberwaste|blackfen]
//   gives a new cob (the given region, or the one you stand in), replacing any cob you had.
// Saves: player property "hc:starter_horse" (the uid of the cob they were given).

import { world, system } from "@minecraft/server";
import { on, countItem, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode, hallBuilt } from "../plots/api.js";
import { regionAt } from "../economy/shops.js";
import { starterRegion, STARTER_REGIONS } from "../starter/index.js";
import { newCob, isCob, effectiveStats, STARTER_COBS, COB, SPEED_VALUES, JUMP_VALUES, WHISTLE, rosterCap, countsToRoster, cobBack, newRecord } from "./data.js";
import { horsesOf, newUid, deleteRecord } from "./store.js";
import { spawnSteed, entityOf, valid } from "./steed.js";
import { give } from "./menus.js";
import { sfx } from "../core/sfx.js";

const GIVEN = "hc:starter_horse";

export const cobOf = (playerId) => horsesOf(playerId).find(isCob);

// Hand this player their cob. once = false gives a new one, replacing the old (builder command).
export function giveCob(player, region, { once = true } = {}) {
  if (!valid(player)) return false;
  if (once && player.getDynamicProperty(GIVEN) !== undefined) return false;
  if (player.dimension.id !== "minecraft:overworld") return false; // they get it next time they join up top
  for (const old of horsesOf(player.id).filter(isCob)) {
    if (once) return false; // already has one (from a builder command)
    try { entityOf(old)?.remove(); } catch { /* already gone */ }
    deleteRecord(old.uid);
  }
  const rec = newCob({ uid: newUid(), owner: player.id, ownerName: player.name, region: starterRegion(region) });
  const at = player.location;
  rec.pos = { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), dim: player.dimension.id };
  try {
    spawnSteed(rec, player.dimension, at, player.getRotation().y);
  } catch (e) {
    console.warn(`[Hollow Crown] starter horse for ${player.name}: ${e}`);
    deleteRecord(rec.uid);
    return false;
  }
  if (countItem(player, WHISTLE) === 0) give(player, WHISTLE);
  player.setDynamicProperty(GIVEN, rec.uid);
  sfx(player, "mob.horse.idle");
  player.sendMessage(`§6${rec.name}§7, ${aCob(rec)}, is yours: saddled and ready. Slow and no jumper, but it gets you about.`);
  player.sendMessage("§7Blow your §fHorse Whistle§7 and it comes from anywhere. Sneak and click it with an empty hand to see its sheet.");
  return true;
}

const aCob = (rec) => `${/^[AEIOU]/.test(rec.breedName) ? "an" : "a"} ${rec.breedName}`;
const later = (player, region, ticks) => system.runTimeout(() => {
  try { giveCob(player, region); } catch (e) { console.warn(`[Hollow Crown] starter horse: ${e}`); }
}, ticks);

on("plotChosen", ({ player, plot }) => later(player, plot?.region, 60)); // after the teleport and the starter clothes
on("startedHomeless", ({ player }) => later(player, "vale", 60));
on("joined", ({ player, first }) => {
  if (!first) {
    // Started before the cob existed: their starter clothes say which region they began in
    const kit = player.getDynamicProperty("hc:starter_kit");
    if (kit !== undefined && player.getDynamicProperty(GIVEN) === undefined) later(player, kit, 100);
    return;
  }
  let hall = false;
  try {
    hall = mapMode() && hallBuilt();
  } catch {
    // no plots on this world
  }
  if (hall) return; // the welcome hall's choice gives it
  later(player, regionAt(player.location), 20);
});

// For the quest tracker: { name, at: { x, z }, dim } until the cob has first been ridden, else undefined
export function cobFacts(player) {
  const rec = cobOf(player.id);
  if (!rec || rec.lastRidden || (rec.status === "fallen" && !cobBack(rec, world.getAbsoluteTime()))) return undefined;
  const e = entityOf(rec);
  const at = e ? e.location : rec.pos;
  return { name: rec.name, at: at ? { x: Math.floor(at.x), z: Math.floor(at.z) } : undefined, dim: e?.dimension.id ?? rec.pos?.dim };
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:starter_horse") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const asked = event.message.trim().toLowerCase();
  giveCob(player, STARTER_REGIONS.includes(asked) ? asked : regionAt(player.location), { once: false });
});

addTests("horses_starter", {
  "every region has its own cob, with a painted coat after the breeds'": () => {
    const props = new Set();
    for (const r of STARTER_REGIONS) {
      const cob = newCob({ uid: r, owner: "p", ownerName: "P", region: r, rand: () => 0 });
      assert(isCob(cob), r);
      assertEqual(cob.region, r);
      assertEqual(cob.breedName, STARTER_COBS[r].name);
      assert(cob.prop >= 7 && cob.prop <= 11, `${r} prop ${cob.prop}`);
      props.add(cob.prop);
      assert(cob.gearSaddle, "comes saddled");
    }
    assertEqual(props.size, 5);
    assertEqual(newCob({ uid: "x", owner: "p", ownerName: "P", region: "kingsrest" }).region, "vale", "off the map: the Vale");
  },
  "the cob is slower and a worse jumper than any horse you can earn, and gear can't change that": () => {
    assert(COB.speed < SPEED_VALUES[0], "slower than a level 1 horse");
    assert(COB.jump < JUMP_VALUES[0], "lower jump than a level 1 horse");
    const cob = newCob({ uid: "c", owner: "p", ownerName: "P", region: "vale" });
    Object.assign(cob, { shoes: "netherite", saddle: "royal", perks: ["fleet", "skyleap"] });
    const eff = effectiveStats(cob);
    assertEqual(eff.speed, 0);
    assertEqual(eff.jump, 0);
    const horse = newRecord({ uid: "h", owner: "p", ownerName: "P" });
    assert(effectiveStats(horse).speed > eff.speed && effectiveStats(horse).jump > eff.jump, "a common horse beats it");
  },
  "the cob takes no stall, so a first earned horse still fits": () => {
    const cob = newCob({ uid: "c", owner: "p", ownerName: "P", region: "vale" });
    assert(!countsToRoster(cob));
    assertEqual(rosterCap(0), 1);
  },
  "a fallen cob is back after a day": () => {
    const cob = newCob({ uid: "c", owner: "p", ownerName: "P", region: "vale" });
    Object.assign(cob, { status: "fallen", fallenAt: 1000 });
    assert(!cobBack(cob, 1000 + COB.recoverTicks - 1), "not yet");
    assert(cobBack(cob, 1000 + COB.recoverTicks), "back");
    assert(!cobBack({ ...cob, starter: false }, 1e9), "only cobs come back on their own");
  },
});
