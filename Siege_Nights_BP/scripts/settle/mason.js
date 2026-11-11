// The Mason: sells building blocks for coins, so building doesn't mean weeks of quarrying.
//
// A mason is Bedrock's built-in NPC (minecraft:npc), so it works on a Realm. Two ways to get one:
//   - place a Mason's Bench on your land (Siege Workshop recipe): a mason sets up beside it
//   - map builders: /scriptevent siege:settle_mason   puts a town mason where you stand
// Stock and prices are in config.js. Your own region's materials are cheaper.

import { world, system, GameMode, ItemStack, ItemTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { chooseWallLook } from "./walls.js";
import { isReady, settlementAt, keepOf, isAlly, isNight, onTick, moduleStore, pick, emit, STONE_KINDS, stoneId, regionalId } from "../siege/api.js";
import { STYLES } from "../townhall/styles.js";
import { SETTLE, CATALOG, LOCAL_ROLES, LOCAL_RATE, STONE_RATE, MASON_LINES } from "./config.js";
import { purse, charge, coins, coinName, coinIcon, lot } from "./wallet.js";
import { styleOf, FOUNDATION } from "./plans.js";
import { sfx } from "../core/sfx.js";

export const BENCH = "siege:mason_bench";
export const MASON_TAG = "siege_mason";
const NPC_TYPE = "minecraft:npc";
const OVERWORLD = "minecraft:overworld";

// benches: [{ x, y, z, owner }]
const store = moduleStore("siege:settle_masons", () => ({ benches: [] }));
const benches = () => store.data.benches;
const benchTag = (b) => `siege_mason_at_${b.x}_${b.y}_${b.z}`;
const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;

export const niceName = (id) => id.replace(/^[a-z]+:/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  .replace(/^Castle (Stone|Tiles|Bricks|Cobbled|Smooth)( \w+)?$/, (_, kind, region) => `${region ? `${region.trim()} ` : ""}${{ Stone: "Castle Stone", Tiles: "Castle Stone Tiles", Bricks: "Castle Stone Bricks", Cobbled: "Cobbled Castle Stone", Smooth: "Smooth Castle Stone" }[kind]}`)
  .replace(/^Wooden Door$/, "Oak Door").replace(/^Trapdoor$/, "Oak Trapdoor").replace(/^Fence Gate$/, "Oak Fence Gate").replace(/^Brick Block$/, "Bricks");

// ---------- stock ----------

const known = (id) => {
  try {
    return !!ItemTypes.get(id);
  } catch {
    return false;
  }
};

const listed = new Map(CATALOG.flatMap((c) => c.stock)); // id -> blocks per emerald

// The local materials of a regional style: [id, per emerald] with the local bonus already in
export function localStock(styleId, isKnown = known) {
  const style = STYLES[styleId];
  if (!style) return [];
  const out = new Map();
  for (const role of LOCAL_ROLES) {
    const id = (style.roles[role] ?? []).find((i) => i.startsWith("minecraft:") && isKnown(i));
    if (id && !out.has(id)) out.set(id, Math.round((listed.get(id) ?? LOCAL_RATE) * SETTLE.localBonus));
  }
  return [...out];
}

// The Castle Stone family of a region: [id, per coin]. Your own region's is cheaper, like its other materials.
export function stoneStock(styleId, local = true, isKnown = known) {
  return STONE_KINDS.map((kind) => [stoneId(kind, styleId), Math.round(STONE_RATE[kind] * (local ? SETTLE.localBonus : 1))]).filter(([id]) => isKnown(id));
}

// A region's own wall and roof blocks: [id, per coin]
export const WALL_RATE = { palisade: 12, wall_planks: 32, roof_shingles: 12, castle_gate: 4, portcullis: 2 };
export function wallStock(styleId, isKnown = known) {
  return Object.entries(WALL_RATE).map(([name, rate]) => [regionalId(name, styleId), rate]).filter(([id]) => isKnown(id));
}

function shelves(styleId) {
  const out = CATALOG.map((c) => ({ ...c, stock: c.stock.filter(([id]) => known(id)) })).filter((c) => c.stock.length);
  const far = Object.keys(STYLES).filter((id) => id !== styleId).flatMap((id) => stoneStock(id, false));
  if (far.length) out.unshift({ name: "Castle Stone from other regions", icon: "textures/blocks/siege_castle_bricks", stock: far });
  const local = localStock(styleId);
  if (local.length) out.unshift({ name: `${STYLES[styleId].name} materials (local price)`, icon: coinIcon(), stock: local });
  const walling = wallStock(styleId);
  if (walling.length) out.unshift({ name: `${STYLES[styleId].name} gates, palisade and shingles`, icon: "textures/blocks/siege_castle_gate", stock: walling });
  const stone = stoneStock(styleId);
  if (stone.length) out.unshift({ name: `${STYLES[styleId].name} Castle Stone`, icon: "textures/blocks/siege_castle_stone", stock: stone });
  return out;
}

// ---------- the shop ----------

function hand(player, typeId, count) {
  const inv = player.getComponent("minecraft:inventory").container;
  const max = new ItemStack(typeId, 1).maxAmount;
  while (count > 0) {
    const n = Math.min(max, count);
    count -= n;
    const left = inv.addItem(new ItemStack(typeId, n));
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

async function buy(player, shelf, [typeId, per], mason) {
  const carried = purse(player);
  const have = player.getGameMode() === GameMode.Creative ? SETTLE.maxSpend : Math.floor(carried / lot()); // lots they can pay for
  if (have < 1) {
    player.sendMessage(`§7Mason: §fThat takes ${coinName()}. Come back when you have some.`);
    return;
  }
  const most = Math.min(have, SETTLE.maxSpend);
  const res = await new ModalFormData()
    .title(niceName(typeId))
    .slider(`${per} for ${coins(lot())}. You carry ${coins(carried)}.\n\nHow many lots of ${per}`, 1, most, { valueStep: 1, defaultValue: Math.min(most, 4) })
    .show(player);
  if (res.canceled) return openShelf(player, shelf, mason);
  const spend = Math.max(1, Math.min(most, Math.floor(res.formValues[0])));
  if (!charge(player, spend * lot())) return;
  hand(player, typeId, spend * per);
  sfx(player, "random.orb");
  player.onScreenDisplay.setActionBar(`§6${spend * per} ${niceName(typeId)}§7 for ${coins(spend * lot())}`);
  openShelf(player, shelf, mason);
}

async function openShelf(player, shelf, mason) {
  const form = new ActionFormData().title(shelf.name).body(`You carry ${coins(purse(player))}.`);
  for (const [id, per] of shelf.stock) form.button(`${niceName(id)}\n§8${per} for ${coins(lot())}`);
  form.button("Back");
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === shelf.stock.length) return openShop(player, mason);
  buy(player, shelf, shelf.stock[res.selection], mason);
}

export async function openShop(player, mason) {
  const land = player.dimension.id === OVERWORLD ? settlementAt(player.location) : undefined;
  const home = keepOf(player.id) ? player.id : land && isAlly(land, player.id) ? land : undefined;
  const styleId = home ? styleOf(home, undefined) : land ? styleOf(land, undefined) : "vale";
  const line = !home ? MASON_LINES.noLand : pick(isNight() ? MASON_LINES.night : MASON_LINES.day);
  const all = shelves(styleId);
  const form = new ActionFormData().title("Mason").body(`§o"${line}"§r\n\nYou carry ${coins(purse(player))}.`);
  for (const shelf of all) form.button(shelf.name, shelf.icon);
  form.button(`Foundation Stone\n§8Places a pre-designed building. ${coins(SETTLE.stonePrice * lot())}`);
  if (home) form.button("Mend the wall\n§8The masons survey it and name a price");
  if (home) form.button("Choose what the wall is built in\n§8Any stone, any region's timber. Free");
  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection < all.length) return openShelf(player, all[res.selection], mason);
  if (res.selection === all.length + 1) return emit("wallRepair", { owner: home, player }); // repair.js
  if (res.selection === all.length + 2) return chooseWallLook(player, home); // walls.js
  const stonePrice = SETTLE.stonePrice * lot();
  if (purse(player) < stonePrice && player.getGameMode() !== GameMode.Creative || !charge(player, stonePrice)) return player.sendMessage(`§7Mason: §fA Foundation Stone is ${coins(stonePrice)}.`);
  hand(player, FOUNDATION, 1);
  player.sendMessage("§7Mason: §fSet it where the front should be, facing the way the building runs. Click it and choose. You get the stone back after.");
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(MASON_TAG)) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return; // builder: the normal NPC editor
  event.cancel = true;
  system.run(() => {
    if (isReady()) openShop(player, target).catch((e) => console.warn(`[Hollow Crown] mason shop: ${e}`));
  });
});

// ---------- masons and their benches ----------

export function spawnMason(dim, location, bench) {
  const mason = dim.spawnEntity(NPC_TYPE, location);
  mason.addTag(MASON_TAG);
  if (bench) mason.addTag(benchTag(bench));
  mason.nameTag = "Mason";
  try {
    const npc = mason.getComponent("minecraft:npc");
    npc.name = "Mason";
    npc.skinIndex = 12;
  } catch {
    // looks are optional
  }
  return mason;
}

const masonsOf = (dim, bench) => dim.getEntities({ type: NPC_TYPE, tags: [benchTag(bench)] });

export function registerBench(block, owner) {
  const at = { x: block.location.x, y: block.location.y, z: block.location.z };
  if (!benches().some((b) => same(b, at))) benches().push({ ...at, owner });
  store.save();
  if (!masonsOf(block.dimension, at).length) spawnMason(block.dimension, { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 }, at);
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== BENCH || !isReady()) return;
  const at = { ...block.location };
  const dim = block.dimension;
  system.run(() => {
    const placed = dim.getBlock(at);
    if (placed?.typeId !== BENCH) return; // Siege Nights took it back: not your land
    const owner = settlementAt(at);
    if (!owner) return;
    if (benches().filter((b) => b.owner === owner).length >= SETTLE.maxBenches) {
      placed.setType("minecraft:air");
      if (player.getGameMode() !== GameMode.Creative) hand(player, BENCH, 1);
      return player.onScreenDisplay.setActionBar(`§cA settlement keeps at most ${SETTLE.maxBenches} masons.`);
    }
    registerBench(placed, owner);
    player.sendMessage("§6A mason has set up at the bench.§7 Talk to them to buy building blocks.");
  });
});

// A bench that is gone takes its mason with it; a mason that is gone comes back
function benchTick() {
  const dim = world.getDimension(OVERWORLD);
  let changed = false;
  store.data.benches = benches().filter((bench) => {
    let block;
    try {
      block = dim.getBlock(bench);
    } catch {
      return true;
    }
    if (!block) return true; // not loaded
    const here = masonsOf(dim, bench);
    if (block.typeId !== BENCH) {
      for (const mason of here) mason.remove();
      changed = true;
      return false;
    }
    if (!here.length) spawnMason(dim, { x: bench.x + 0.5, y: bench.y + 1, z: bench.z + 0.5 }, bench);
    return true;
  });
  if (changed) store.save();
}
onTick("settle_mason_benches", 100, () => {
  if (isReady()) benchTick();
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:settle_mason") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  spawnMason(player.dimension, player.location);
  player.sendMessage(`§aTown mason placed. Sneak + click in Creative to edit, or /kill @e[tag=${MASON_TAG},c=1] to remove.`);
});
