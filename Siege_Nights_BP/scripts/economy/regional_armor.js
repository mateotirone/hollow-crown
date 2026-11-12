// Regional player armour (Mateo 2026-11-12: "custom armor textures per region for each type of armor").
// Pure data and rules, loads in Node. Items, looks and recipes: studio/art/build_regional_armor.py.
//
// Every player armour type (iron, chainmail, diamond, netherite, Choirsteel) has a version in each region's look,
// siege:<material>_<region>_<piece>, with the same protection, durability, enchanting and repair as the plain piece.
// How to get one:
//   - any region's Smith reforges a piece you carry or wear into that region's style, for REFORGE_PRICE Regals, and
//     keeps its enchantments, wear and name (shops.js reforgeMenu). A regional piece can be reforged again elsewhere.
//   - at the Workshop: the plain piece + that region's Castle Stone (Vale: plain Castle Stone). Crafting starts fresh.
//   - smithing table upgrades (diamond -> netherite, netherite -> Choirsteel) keep the region.

export const ARMOUR_MATERIALS = ["iron", "chainmail", "diamond", "netherite", "choirsteel"];
export const ARMOUR_REGIONS = ["vale", "frostmarch", "saltreach", "emberwaste", "blackfen"];
export const ARMOUR_PIECES = ["helmet", "chestplate", "leggings", "boots"];
// economy region name (config.js REGIONS) -> the key in the item ids
export const REGION_KEY = { "Aldmere Vale": "vale", Frostmarch: "frostmarch", Saltreach: "saltreach", Emberwaste: "emberwaste", Blackfen: "blackfen" };

// Regals per piece at the Smith: a small fee, more for the dearer metals. No regional markup.
export const REFORGE_PRICE = { iron: 6, chainmail: 6, diamond: 16, netherite: 32, choirsteel: 48 };

const plainId = (mat, piece) => (mat === "choirsteel" ? `siege:choirsteel_${piece}` : `minecraft:${mat}_${piece}`);
export const regionalId = (mat, region, piece) => `siege:${mat}_${region}_${piece}`;

// What an armour id is: { mat, region (undefined for the plain piece), piece }, or undefined if it is none of these
export function armourOf(id) {
  if (typeof id !== "string") return undefined;
  for (const mat of ARMOUR_MATERIALS) {
    for (const piece of ARMOUR_PIECES) {
      if (id === plainId(mat, piece)) return { mat, region: undefined, piece };
      if (!id.startsWith(`siege:${mat}_`) || !id.endsWith(`_${piece}`)) continue;
      const region = id.slice(`siege:${mat}_`.length, -`_${piece}`.length);
      if (ARMOUR_REGIONS.includes(region)) return { mat, region, piece };
    }
  }
  return undefined;
}

// The plain piece a regional piece stands for (so set bonuses and checks treat them alike); other ids unchanged
export function plainArmour(id) {
  const a = armourOf(id);
  return a ? plainId(a.mat, a.piece) : id;
}

// The id a Smith in `regionName` (config.js REGIONS name) turns `id` into, or undefined if he can't (not armour,
// already that region's, or no region)
export function reforgeTarget(id, regionName) {
  const region = REGION_KEY[regionName], a = armourOf(id);
  if (!region || !a || a.region === region) return undefined;
  return regionalId(a.mat, region, a.piece);
}

export const reforgePrice = (id) => REFORGE_PRICE[armourOf(id)?.mat] ?? 0;

const CAP = (s) => s[0].toUpperCase() + s.slice(1);
const CHOIR_NAME = { helmet: "Helm", chestplate: "Cuirass", leggings: "Greaves", boots: "Treads" };
// "Frostmarch Iron Helmet", "Iron Helmet" (the names in en_US.lang, for menus)
export function armourName(id) {
  const a = armourOf(id);
  if (!a) return id;
  const piece = a.mat === "choirsteel" ? CHOIR_NAME[a.piece] : CAP(a.piece);
  return `${a.region ? CAP(a.region) + " " : ""}${CAP(a.mat)} ${piece}`;
}
