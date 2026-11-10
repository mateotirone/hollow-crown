// Ids, tags and lists shared by many files. No logic here.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { EquipmentSlot } from "@minecraft/server";

export const RAIDER_TAG = "siege_raider";
export const RAM_TAG = "siege_ram";
export const SAPPER_TAG = "siege_sapper";
export const WARLORD_TAG = "siege_warlord";
export const KING_TAG = "siege_warlord_king";
export const KEEP_BANNER = "siege:keep_banner";
export const KEEP_HEART = "siege:keep_heart";
export const QUARTERMASTER = "siege:quartermaster";
export const DESK = "siege:quartermaster_desk";
export const CHARGE = "siege:breaching_charge";

export const GATES = ["siege:portcullis", "siege:castle_gate"];
export const CASTLE_BLOCKS = [
  "siege:castle_stone", "siege:mossy_castle_stone", "siege:cracked_castle_stone",
  "siege:battlement", "siege:arrow_slit", "siege:portcullis",
];
export const UNBREAKABLE = ["minecraft:bedrock", "minecraft:barrier", "minecraft:obsidian", KEEP_BANNER];

export const BALLISTA_HIT = "siege_ballista_hit";
export const RAM_ENGINE = "siege:ram_engine";
export const WRIT = "siege:writ_of_alliance";
export const TREBUCHET = "siege:trebuchet_engine";
export const BALLISTA = "siege:ballista_engine";
export const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
export const BARRACKS = "siege:barracks";
export const GUARD_TYPES = { "siege:archer": "siege:archer_item", "siege:man_at_arms": "siege:man_at_arms_item" };
export const WANTED_TAG = "siege_wanted";
export const GUARD_GEAR = "siege:guardgear_";
export const WEAPONS = ["siege:longsword", "siege:warhammer"];

export const REINFORCEABLE = ["siege:castle_stone", "siege:portcullis", "siege:castle_gate"];

export const COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];

export const DYE_RGB = {
  white: [233, 236, 236], orange: [240, 118, 19], magenta: [189, 68, 179], light_blue: [58, 175, 217],
  yellow: [248, 197, 39], lime: [112, 185, 25], pink: [237, 141, 172], gray: [62, 68, 71],
  light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [121, 42, 172], blue: [53, 57, 157],
  brown: [114, 71, 40], green: [84, 109, 27], red: [161, 39, 34], black: [29, 29, 33],
};

export const GUARD_SET = {
  [EquipmentSlot.Head]: "siege:guard_helmet",
  [EquipmentSlot.Chest]: "siege:guard_chestplate",
  [EquipmentSlot.Legs]: "siege:guard_leggings",
  [EquipmentSlot.Feet]: "siege:guard_boots",
};
