// Siege Nights self-tests. Pure checks run everywhere; gameOnly ones need the real world.

import { world, BlockTypes, EntityTypes, ItemTypes } from "@minecraft/server";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { applyFilter, hasFilters } from "../core/events.js";
import { tickTasks } from "../core/loop.js";
import * as ids from "./constants.js";
import { SETTINGS } from "./settings.js";
import { withTestState } from "./state.js";
import { TIERS, tierOf, settlementAt, isAlly, colorTaken, freeColor, foreignSettlement } from "./territory.js";
import { FACTIONS, MODIFIERS, COUNTERS, buyArmy } from "./warplan.js";
import { GUARD_LIMIT, GUARD_ARMOR } from "./guards.js";
import { toughness, wallHp, WALL_HP, REINFORCE_ITEMS, TIER_NAMES } from "./walls.js";
import { isBuilt } from "./breachers.js";
import { DYES } from "./block_clicks.js";
import { nextSiegeDay } from "./siege.js";
import { nextTierText } from "./menus.js";
import { MACHINES } from "./machines.js";

const keepAt = (x, z, extra = {}) => ({ x, y: 64, z, name: "Test", color: 14, wins: 0, allies: [], ...extra });
const fakeState = (keeps = {}) => ({ active: false, lastSiegeDay: -1, keeps, guards: {}, plans: {}, kills: {}, besieged: [], fallen: [] });
const fakeBlock = (typeId, armor = 0) => ({ typeId, permutation: { getState: () => armor } });

addTests("siege", {
  "regional Castle Guard armor counts as Castle Guard armor": () => {
    const [head, , , feet] = Object.keys(ids.GUARD_SET);
    assert(ids.isGuardPiece("siege:guard_helmet", head), "plain helmet");
    assert(ids.isGuardPiece("siege:guard_frostmarch_helmet", head), "regional helmet");
    assert(ids.isGuardPiece("siege:guard_blackfen_boots", feet), "regional boots");
    assert(ids.isGuardPiece("siege:guard_saltreach_netherite_helmet", head), "netherite regional helmet");
    assert(!ids.isGuardPiece("siege:guard_frostmarch_boots", head), "boots are not a helmet");
    assert(!ids.isGuardPiece("siege:guardgear_2_helmet", head), "the guards' own armor is not players' armor");
    assert(!ids.isGuardPiece("minecraft:iron_helmet", head), "vanilla armor");
  },
  "settings are sensible numbers": () => {
    for (const [k, v] of Object.entries(SETTINGS)) assert(typeof v === "number" && v > 0, `${k} = ${v}`);
    assert(SETTINGS.firstSiegeDay >= SETTINGS.siegeEveryNNights, "first siege day before the first siege night");
  },
  "settlement tiers grow in order": () => {
    for (let i = 1; i < TIERS.length; i++) {
      assert(TIERS[i].wins > TIERS[i - 1].wins, `${TIERS[i].name} wins`);
      assert(TIERS[i].radius > TIERS[i - 1].radius, `${TIERS[i].name} radius`);
      assert(TIERS[i].keepHealth > TIERS[i - 1].keepHealth, `${TIERS[i].name} keep health`);
    }
  },
  "tierOf picks the right tier": () => {
    assertEqual(tierOf({}).name, "Hamlet");
    assertEqual(tierOf({ wins: 2 }).name, "Hamlet");
    assertEqual(tierOf({ wins: 3 }).name, "Town");
    assertEqual(tierOf({ wins: 6 }).name, "City");
    assertEqual(tierOf({ wins: 12, warlordsSlain: 1 }).name, "City", "Castle needs 2 warlords");
    assertEqual(tierOf({ wins: 10, warlordsSlain: 2 }).name, "Castle");
  },
  "every tier has a guard limit": () => {
    for (const t of TIERS) assert(GUARD_LIMIT[t.name] > 0, t.name);
  },
  "next tier text": () => {
    assert(nextTierText({ wins: 1 }).includes("2 more wins"), nextTierText({ wins: 1 }));
    assert(nextTierText({ wins: 10, warlordsSlain: 2, sovereign: true }).includes("Sovereign"));
  },
  "armies never overspend and respect unlock sieges": () => {
    for (const [id, faction] of Object.entries(FACTIONS)) {
      for (const siege of [1, 3, 6]) {
        for (const budget of [0, 5, 20, 80, 400]) {
          const army = buyArmy({ faction: id }, siege, budget);
          const cost = army.reduce((sum, type) => sum + faction.units.find((u) => u.type === type).cost, 0);
          assert(cost <= budget, `${id} spent ${cost} of ${budget}`);
          assert(army.length <= 24, `${id} army of ${army.length}`);
          for (const type of army) assert(faction.units.find((u) => u.type === type).from <= siege, `${type} too early`);
        }
      }
    }
  },
  "the Grand Army has every unit once": () => {
    const types = FACTIONS.grand.units.map((u) => u.type);
    assertEqual(types.length, new Set(types).size, "duplicates");
    for (const f of ["warband", "undead", "mercenaries"]) for (const u of FACTIONS[f].units) assert(types.includes(u.type), u.type);
  },
  "counters point at real modifiers": () => {
    for (const [k, c] of Object.entries(COUNTERS)) assert(MODIFIERS[c.modifier], k);
  },
  "every banner color has a dye and an RGB": () => {
    assertEqual(ids.COLORS.length, 16);
    for (const c of ids.COLORS) assert(ids.DYE_RGB[c]?.length === 3, c);
    for (const [dye, i] of Object.entries(DYES)) assert(i >= 0 && i < 16, dye);
  },
  "wall strength by block and reinforcement": () => {
    assertEqual(wallHp(fakeBlock("siege:castle_stone", 0)), WALL_HP.castle[0]);
    assertEqual(wallHp(fakeBlock("siege:castle_stone", 3)), WALL_HP.castle[3]);
    assertEqual(wallHp(fakeBlock("siege:portcullis", 2)), WALL_HP.gate[2]);
    assertEqual(wallHp(fakeBlock("siege:battlement")), WALL_HP.otherCastle);
    assertEqual(wallHp(fakeBlock("minecraft:cobblestone")), WALL_HP.other);
    assertEqual(Object.keys(REINFORCE_ITEMS).length + 1, TIER_NAMES.length);
  },
  "mortar toughness stays in range": () => {
    for (let i = 0; i < 200; i++) {
      const t = toughness({ x: i * 7 - 300, y: i % 90, z: i * 13 });
      assert(t >= 0.75 && t <= 1.25, `toughness ${t}`);
    }
  },
  "sappers only target built blocks": () => {
    assert(isBuilt("siege:castle_stone") && isBuilt("minecraft:oak_planks") && isBuilt("minecraft:stone_bricks"));
    assert(!isBuilt("minecraft:dirt") && !isBuilt("minecraft:grass_block"));
  },
  "guard armor has 4 upgrades": () => {
    assertEqual(GUARD_ARMOR.length, 5);
    for (const a of GUARD_ARMOR.slice(1)) assert(a.item && a.cost > 0 && a.label, a.name);
  },
  "land ownership, allies and borders": () => {
    const keeps = { alice: keepAt(0, 0, { allies: ["bob"] }), carol: keepAt(500, 0, { color: 11, wins: 3 }) };
    withTestState(fakeState(keeps), () => {
      assertEqual(settlementAt({ x: 10, y: 64, z: 10 }), "alice");
      assertEqual(settlementAt({ x: 40, y: 64, z: 0 }), undefined, "outside a Hamlet's 32 blocks");
      assertEqual(settlementAt({ x: 540, y: 64, z: 0 }), "carol", "inside a Town's 48 blocks");
      assert(isAlly("alice", "bob") && !isAlly("alice", "carol") && !isAlly("nobody", "bob"));
      const player = (id) => ({ id });
      assertEqual(foreignSettlement(player("bob"), { x: 1, y: 64, z: 1 }, "minecraft:overworld"), undefined, "allies may build");
      assertEqual(foreignSettlement(player("carol"), { x: 1, y: 64, z: 1 }, "minecraft:overworld"), "alice");
      assertEqual(foreignSettlement(player("carol"), { x: 1, y: 64, z: 1 }, "minecraft:nether"), undefined);
    });
  },
  "banner colors stay unique": () => {
    withTestState(fakeState({ alice: keepAt(0, 0, { color: 14 }), bob: keepAt(500, 0, { color: 0 }) }), () => {
      assert(colorTaken(14) && !colorTaken(14, "alice") && !colorTaken(3));
      assertEqual(freeColor(3), 3);
      assertEqual(freeColor(14), 1, "red taken, white taken, so orange");
    });
  },
  "next siege day is a siege night": () => {
    withTestState(fakeState(), () => {
      const day = nextSiegeDay();
      assert(day >= SETTINGS.firstSiegeDay && day % SETTINGS.siegeEveryNNights === 0, `day ${day}`);
    });
  },
  "hooks are untouched unless a feature adds one": () => {
    for (const name of ["landOwner", "foundCheck", "skipSiege", "plan", "raiderType", "siegeReward", "guardLimit", "keepHealth", "keepMenuButtons"]) {
      if (hasFilters(name)) continue; // a feature is using it, which is fine
      const value = { probe: name };
      assert(applyFilter(name, value, {}) === value, name);
    }
  },
  "machine items are set": () => {
    for (const [entity, item] of Object.entries(MACHINES)) assert(entity.startsWith("siege:") && item.startsWith("siege:"), entity);
  },
});

// ----- in game only: everything the script refers to exists in the packs -----

const BLOCKS = [ids.KEEP_BANNER, ids.DESK, ids.CHARGE, ids.BARRACKS, ...ids.GATES, ...ids.CASTLE_BLOCKS, ...ids.REINFORCEABLE];
const ENTITIES = [ids.KEEP_HEART, ids.QUARTERMASTER, ids.RAM_ENGINE, ids.TREBUCHET, ids.BALLISTA, ...Object.keys(ids.GUARD_TYPES)];
const ITEMS = [ids.WRIT, "siege:war_horn", "siege:battering_ram", ...Object.values(ids.GUARD_TYPES), ...Object.values(MACHINES),
  ...Object.values(ids.GUARD_SET), ...ids.WEAPONS,
  ...[1, 2, 3, 4].flatMap((t) => ["helmet", "chestplate", "leggings", "boots"].map((p) => `${ids.GUARD_GEAR}${t}_${p}`))];

addTests("siege", {
  "all Siege Nights blocks are in the pack": () => {
    const missing = [...new Set(BLOCKS)].filter((id) => !BlockTypes.get(id));
    assert(!missing.length, `missing ${missing.join(", ")}`);
  },
  "all Siege Nights entities are in the pack": () => {
    const missing = [...new Set(ENTITIES)].filter((id) => !EntityTypes.get(id));
    assert(!missing.length, `missing ${missing.join(", ")}`);
  },
  "all Siege Nights items are in the pack": () => {
    const missing = [...new Set(ITEMS)].filter((id) => !ItemTypes.get(id));
    assert(!missing.length, `missing ${missing.join(", ")}`);
  },
  "saved data can be read": () => {
    for (const key of ["siege:state", "siege:machines", "siege:wall_damage"]) {
      const raw = world.getDynamicProperty(key);
      if (raw !== undefined) JSON.parse(raw);
    }
  },
  "every keep has a position and a name": () => {
    const keeps = JSON.parse(world.getDynamicProperty("siege:state") ?? "{}").keeps ?? {};
    for (const [owner, k] of Object.entries(keeps)) {
      assert([k.x, k.y, k.z].every(Number.isInteger) && typeof k.name === "string", `keep of ${owner}`);
    }
  },
  "the main loop is running": () => {
    assert(tickTasks().length >= 10, `${tickTasks().length} tasks`);
  },
}, { gameOnly: true });
