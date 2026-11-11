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


// The Castle Stone family: every region has Castle Stone, Tiles, Bricks, Cobbled and Smooth (blocks/stone/).
// The Vale's have no region in their id. Castle Stone itself can be reinforced; all of them show cracks.
export const STONE_REGIONS = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];
export const STONE_KINDS = ["stone", "tiles", "bricks", "cobbled", "smooth"];
export const stoneId = (kind, region = "vale") => `siege:castle_${kind}${region === "vale" ? "" : `_${region}`}`;
export const CASTLE_STONES = STONE_REGIONS.map((r) => stoneId("stone", r));
export const STONE_FAMILY = STONE_REGIONS.flatMap((r) => STONE_KINDS.map((k) => stoneId(k, r)));


// Regional gates, portcullises, palisades, wall planks and roof shingles (blocks/regional/). The Vale's have no
// region in their id: siege:castle_gate, siege:portcullis, siege:palisade, siege:wall_planks, siege:roof_shingles.
export const regionalId = (name, region = "vale") => `siege:${name}${region === "vale" ? "" : `_${region}`}`;
export const PORTCULLISES = STONE_REGIONS.map((r) => regionalId("portcullis", r));
export const CASTLE_GATES = STONE_REGIONS.map((r) => regionalId("castle_gate", r));
export const GATES = [...PORTCULLISES, ...CASTLE_GATES];

export const CASTLE_BLOCKS = [
  ...STONE_FAMILY, "siege:mossy_castle_stone", "siege:cracked_castle_stone",
  "siege:battlement", "siege:arrow_slit", ...PORTCULLISES,
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

export const REINFORCEABLE = [...CASTLE_STONES, ...GATES];

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

// Castle Guard armor of any region and tier (siege:guard_vale_helmet, siege:guard_frostmarch_diamond_boots ...)
// counts the same as the plain set: banner-coloured, and part of the siege set bonus. Never the guards' own guardgear_.
const GUARD_PIECE = /^siege:guard_(?:[a-z]+_){0,2}(helmet|chestplate|leggings|boots)$/;
export const GUARD_PIECE_FOR = {
  [EquipmentSlot.Head]: "helmet", [EquipmentSlot.Chest]: "chestplate", [EquipmentSlot.Legs]: "leggings", [EquipmentSlot.Feet]: "boots",
};
export function isGuardPiece(typeId, slot) {
  const m = GUARD_PIECE.exec(typeId ?? "");
  return !!m && (slot === undefined || m[1] === GUARD_PIECE_FOR[slot]);
}
