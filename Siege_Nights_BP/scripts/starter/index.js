// Starter clothes and weapon (Mateo 2026-11-13: "the player should get cheap starter armor that looks like clothes,
// (depending on the theme and region) and a starter weapon").
//
// A new player is dressed in the working clothes of the region they start in and handed that region's tool as a
// weapon, once, the first time they start:
//   - picking a plot in the welcome hall (event plotChosen): that plot's region;
//   - starting in Kingsrest with no plot (event startedHomeless): the Vale;
//   - a world with no welcome hall (no map, or the hall not raised yet): at the end of their first join, the region
//     of the nearest Plot Stone, or the Vale.
// Each piece goes straight onto the body if that slot is empty, otherwise into the pack (or at their feet when the
// pack is full). The clothes are leather-weak (art: studio/art/build_starter_clothes.py) and Hunters sell them,
// Smiths the weapons, in their own region, for a few Regals (economy/config.js).
//
// Builder command:  /scriptevent siege:starter_kit [vale|frostmarch|saltreach|emberwaste|blackfen]
//   gives a kit again (the given region, or the one you are standing in), whether or not you had one.
// Saves: player property "hc:starter_kit" (the region key of the kit they were given).

import { system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode, hallBuilt } from "../plots/api.js";
import { regionAt } from "../economy/shops.js";
import { REGION_KEY } from "../economy/regional_armor.js";

export const STARTER_REGIONS = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];
const GIVEN = "hc:starter_kit";
const SLOTS = [["helmet", EquipmentSlot.Head], ["chestplate", EquipmentSlot.Chest], ["leggings", EquipmentSlot.Legs], ["boots", EquipmentSlot.Feet]];
const WORDS = {
  vale: { folk: "a Vale farmhand", weapon: "billhook" },
  frostmarch: { folk: "a Frostmarch trapper", weapon: "hatchet" },
  saltreach: { folk: "a Saltreach deckhand", weapon: "cutlass" },
  emberwaste: { folk: "an Emberwaste caravaneer", weapon: "sickle-sword" },
  blackfen: { folk: "a Blackfen fen-walker", weapon: "reed spear" },
};

// "Aldmere Vale", "Frostmarch", ... or a key ("vale") -> the kit's region key. Anything else (Kingsrest, no map) is the Vale.
export function starterRegion(region) {
  if (STARTER_REGIONS.includes(region)) return region;
  return REGION_KEY[region] ?? "vale";
}

// The item ids of one region's kit
export function kitFor(region) {
  const r = starterRegion(region);
  return {
    region: r,
    clothes: SLOTS.map(([piece]) => `siege:starter_${r}_${piece}`),
    weapon: `siege:starter_${r}_weapon`,
  };
}

const valid = (player) => {
  try {
    return player.isValid;
  } catch {
    return false;
  }
};

function stow(player, item) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const left = inv ? inv.addItem(item) : item;
  if (left) player.dimension.spawnItem(left, player.location);
}

// Dress the player and hand them the weapon. once = false gives it again (builder command).
export function giveKit(player, region, { once = true } = {}) {
  if (!valid(player)) return false;
  if (once && player.getDynamicProperty(GIVEN) !== undefined) return false;
  const kit = kitFor(region);
  const gear = player.getComponent("minecraft:equippable");
  try {
    SLOTS.forEach(([, slot], i) => {
      const item = new ItemStack(kit.clothes[i], 1);
      if (gear && !gear.getEquipment(slot)) gear.setEquipment(slot, item);
      else stow(player, item);
    });
    stow(player, new ItemStack(kit.weapon, 1));
  } catch (e) {
    console.warn(`[Hollow Crown] starter kit for ${player.name}: ${e}`);
    return false;
  }
  player.setDynamicProperty(GIVEN, kit.region);
  const w = WORDS[kit.region];
  player.sendMessage(`§7You are dressed as ${w.folk}, with a ${w.weapon} at your belt. Better armour can wait for the Smith.`);
  return true;
}

const later = (player, region, ticks = 40) => system.runTimeout(() => giveKit(player, region), ticks); // after the teleport lands

on("plotChosen", ({ player, plot }) => later(player, plot?.region));
on("startedHomeless", ({ player }) => later(player, "vale"));
on("joined", ({ player, first }) => {
  if (!first) return;
  let hall = false;
  try {
    hall = mapMode() && hallBuilt();
  } catch {
    // no plots on this world
  }
  if (hall) return; // the welcome hall's choice gives it
  later(player, regionAt(player.location), 5);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:starter_kit") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const asked = event.message.trim().toLowerCase();
  const region = STARTER_REGIONS.includes(asked) ? asked : regionAt(player.location);
  giveKit(player, region, { once: false });
});

addTests("starter", {
  "every region's kit is four clothes and a weapon, named for the region": () => {
    for (const r of STARTER_REGIONS) {
      const kit = kitFor(r);
      assertEqual(kit.region, r);
      assertEqual(kit.clothes.length, 4);
      assert(kit.clothes.every((id) => id.startsWith(`siege:starter_${r}_`)), r);
      assertEqual(kit.weapon, `siege:starter_${r}_weapon`);
      assert(WORDS[r], `${r} has words`);
    }
  },
  "plot regions map to their kit, and Kingsrest or no map is the Vale": () => {
    assertEqual(kitFor("Aldmere Vale").region, "vale");
    assertEqual(kitFor("Frostmarch").region, "frostmarch");
    assertEqual(kitFor("Saltreach").region, "saltreach");
    assertEqual(kitFor("Emberwaste").region, "emberwaste");
    assertEqual(kitFor("Blackfen").region, "blackfen");
    assertEqual(kitFor(undefined).region, "vale");
    assertEqual(kitFor("Kingsrest").region, "vale");
  },
});
