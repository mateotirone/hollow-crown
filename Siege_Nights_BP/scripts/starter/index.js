// Starter clothes and weapon (Mateo 2026-11-13: "the player should get cheap starter armor that looks like clothes,
// (depending on the theme and region) and a starter weapon").
//
// A new player is dressed in the working clothes of the region they start in and handed that region's tool as a
// weapon, once, the first time they start:
//   - picking a plot in the welcome hall (event plotChosen): that plot's region;
//   - starting in Kingsrest with no plot (event startedHomeless): the Vale;
//   - a world that is not the Hollow Crown map (no welcome hall): at the end of their first join, the region of the
//     nearest Plot Stone, or the Vale. On the map a newcomer who arrives before the hall stands waits for it and
//     gets the kit with the start they choose (noHallGift).
// Each piece goes straight onto the body if that slot is empty, otherwise into the pack (or at their feet when the
// pack is full). The clothes are leather-weak (art: studio/art/build_starter_clothes.py) and Hunters sell them,
// Smiths the weapons, in their own region, for a few Regals (economy/config.js).
//
// Builder command:  /scriptevent siege:starter_kit [vale|frostmarch|saltreach|emberwaste|blackfen]
//   gives a kit again (the given region, or the one you are standing in), whether or not you had one.
// Saves: player property "hc:starter_kit" (the region key of the kit they were given).
//
// Starting purse (Mateo 2026-11-13: "we should give the player a starting amount of regals"): every player gets
// START_REGALS once, on their first join (or their next join, on a world from before this). Enough for seeds and
// bread from the Farmer, planks from the Woodcutter, or one guard, not enough to skip the first days.
// On a map, Old Elspeth hands it over when you first meet her by your hall's hearth (Act 1, newplayer/act1.js says
// so through the "joinPurse" filter); starting in Kingsrest without a plot, it comes at once.
// Saves: player property "hc:starting_purse".

import { system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { mapMode, hallBuilt } from "../plots/api.js";
import { setupState } from "../opening/setup.js";
import { regionAt } from "../economy/shops.js";
import { REGION_KEY } from "../economy/regional_armor.js";
import { pay, coins } from "../economy/api.js";

export const STARTER_REGIONS = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];
const GIVEN = "hc:starter_kit";
export const START_REGALS = 50;
const PURSE = "hc:starting_purse";
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
on("startedHomeless", ({ player }) => { later(player, "vale"); system.runTimeout(() => { try { givePurse(player); } catch { /* left */ } }, 60); });
// The starting purse, once per player, a moment after they join
export function givePurse(player) {
  if (!valid(player) || player.getDynamicProperty(PURSE) !== undefined) return false;
  player.setDynamicProperty(PURSE, START_REGALS);
  pay(player, START_REGALS, "starting purse");
  player.sendMessage(`§6You start with ${coins(START_REGALS)}.§7 Sell wheat to your Farmer for more, or take iron to the Moneyer in Kingsrest.`);
  return true;
}

on("joined", ({ player, first }) => {
  system.runTimeout(() => {
    try { if (applyFilter("joinPurse", true, { player })) givePurse(player); } catch (e) { console.warn(`[Hollow Crown] starting purse: ${e}`); }
  }, 60);
  if (!first) return;
  let hall = false;
  try {
    hall = mapMode() && hallBuilt();
  } catch {
    // no plots on this world
  }
  if (hall) return; // the welcome hall's choice gives it
  noHallGift(player, () => later(player, regionAt(player.location), 5));
});

// On the Hollow Crown map the welcome hall may still be going up when a newcomer's join sequence ends; they are
// brought up to it once it stands (plots/welcome.js), and their kit comes with the start they choose there.
// Only a world that is not the map (setup says "plain") hands it out at the end of the first join. Until setup
// knows which it is, look again every 10 seconds.
export function noHallGift(player, give, tries = 0) {
  let state = "plain";
  try { state = setupState(); } catch { /* no setup on this world */ }
  if (state === "map") return;
  if (state === "plain" || tries >= 60) return give();
  system.runTimeout(() => { if (valid(player)) noHallGift(player, give, tries + 1); }, 200);
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:starter_kit") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const asked = event.message.trim().toLowerCase();
  const region = STARTER_REGIONS.includes(asked) ? asked : regionAt(player.location);
  giveKit(player, region, { once: false });
});

addTests("starter", {
  "the starting purse buys a first useful thing but not a whole defence": () => {
    assert(START_REGALS >= 40 && START_REGALS < 80, `${START_REGALS}`);
  },
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
