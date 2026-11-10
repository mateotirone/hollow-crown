// The Hollow's mining villages, their Tallies (ore stores) and the Vault under the Seat.
// Numbers and rules: rules.js. Design: the "Design the Hollow as its own world" thread.
//
// What happens in game
//   Four villages are built beside the story path the first time a player comes near each one.
//   Each has a Foreman (keeps the Tally) and three miners. They are Bedrock's built-in NPC entity,
//   but we answer the click ourselves, so what they say can follow who rules the Hollow.
//   Every in-game dawn each village digs ore into its Tally and half is carted to the Vault.
//   Visitors buy ore from a Foreman for coins, or rob the Tally. The Vault is reached from the
//   Vault Stair, a copper pad on the path just before the Seat: stand on it and sneak.
//
// Other threads
//   emit("hollowRobbery", { robber, robberName, place: "village" | "vault", village, x, y, z, handled })
//       fired the moment a robbery starts. The Hollow dimension thread tells the ruler and brings
//       them there; if nobody sets handled = true we do a plain teleport ourselves.
//   emit("oreAlarm", { miner, minerName, x, y, z, regent: true })   when the NPC ruler is robbed,
//       so its guardians come (same event the ore cliffs use).
//   inVillage(location), vaultStock(), takeFromVault(ore, emeralds), villageSpot(id) are exported.
//   Players standing in a village carry the tag siege_hollowfolk_safe (Gloamwings must not hunt them).
// Testing (creative): /scriptevent hc:folk_go <village|vault>   hc:folk_dawn   hc:folk_freed   hc:folk_status   hc:folk_happen

import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { on, emit, onTick, moduleStore, addTests, assert, assertEqual, registerDeck, storyPick, note, markDone } from "../siege/api.js";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, HEART, pathX } from "../undertow/layout.js";
import { RIVER_NODES, riverDistance } from "../undertow/rivers.js";
import { SITES } from "../undertow/roads.js";
import { heightAt, B, shardAt, giantCapAt, strandsAt } from "../undertow/terrain.js";
import { isBuilt } from "../undertow/builder.js";
import { wardenData, wardenOnline, hollowStep } from "../undertow/warden.js";
import { regentRules } from "../undertow/regent.js";
import { say, runCmd } from "../undertow/data.js";
import { FOLK, LINES, moodOf, robVerdict, dig, cart, priceOf, vaultLoot, HAPPENINGS, HAPPENING_GAP_SECONDS, ERRAND_ORE, ERRAND_ASKS, happeningsFor, freshLine } from "./rules.js";
// Prices and the Vault's takings (vault.emeralds, saved) are counted in the old unit: one is 8 coins.
import { funds, chargeE, giveCoins } from "../economy/coins.js";
import { coins, worth, fromEmeralds } from "../economy/rules.js";
import { ECON } from "../economy/config.js";

export { setFolkVoice } from "./rules.js";
import { setHollowAir } from "./ambience.js";
export { setHollowAir };

const RAW = "siege:raw_choir_ore";
const BOAT = "siege:lattice_boat";
const NPC = "minecraft:npc";
const TAG = "siege_hollowfolk";
const TAG_FOREMAN = "siege_hollowfolk_foreman";
const TAG_SAFE = "siege_hollowfolk_safe";
const VAULT_BLOCK = "minecraft:reinforced_deepslate";

const store = moduleStore("hc:hollowfolk", () => ({
  v: 1, // version of this saved data: raise it and convert old saves when the shape changes
  deepDoor: false, // the sealed door in the Vault is in place
  errands: {}, // player id -> id of the errand a miner has asked of them
  built: {}, // village id -> true once its huts stand
  vaultBuilt: false,
  stock: {}, // village id -> raw ore in its Tally
  vault: { ore: 0, emeralds: 0 },
  price: FOLK.price,
  day: -1,
  morvaneFallen: false,
  robbedAt: {}, // village id -> tick of the last robbery
}));

// ---- where things are ----------------------------------------------------------------------
// Where each village stands is pinned in undertow/roads.js SITES: the Hollow's generator flattens
// those sites and runs its roads to them, so both sides read the same numbers.
export function landingOf(id) {
  return RIVER_NODES.find((n) => n.id === id);
}
export function villageSpot(id) {
  if (!FOLK.villages.some((v) => v.id === id)) return undefined;
  const s = SITES.find((x) => x.id === id);
  return s ? { x: s.x, y: s.y + 1, z: s.z } : undefined;
}
export function inVillage(loc) {
  for (const v of FOLK.villages) {
    const c = villageSpot(v.id);
    if (!c) continue;
    const dx = loc.x - c.x, dz = loc.z - c.z;
    if (dx * dx + dz * dz <= FOLK.safeRadius * FOLK.safeRadius) return v.id;
  }
  return undefined;
}
// The Vault hangs in the rock under the Seat. The Stair is a pad on the path a little before it.
const VAULT = { x: HEART.center.x, y: HEART.center.y - 18, z: HEART.center.z };
const STAIR_Z = 2312;
function stairSpot() {
  const x = pathX(STAIR_Z) + 5;
  const y = heightAt(x, STAIR_Z);
  return y === null ? undefined : { x, y: y + 1, z: STAIR_Z };
}

export const vaultStock = () => ({ ...store.data.vault });
export function takeFromVault(ore, emeralds = 0) {
  const v = store.data.vault;
  const got = { ore: Math.min(v.ore, Math.max(0, ore)), emeralds: Math.min(v.emeralds, Math.max(0, emeralds)) };
  v.ore -= got.ore;
  v.emeralds -= got.emeralds;
  store.save();
  return got;
}

// ---- who rules ------------------------------------------------------------------------------
function mood() {
  return moodOf({ morvaneFallen: store.data.morvaneFallen, rulerId: wardenData().id, regent: regentRules() });
}
on("siege:boss_defeated", (d) => {
  if (d?.boss !== "morvane") return;
  store.data.morvaneFallen = true;
  store.save();
});
on("wardenChanged", ({ warden }) => {
  if (!warden) return;
  store.data.morvaneFallen = true; // nobody can wear the Crown while Morvane holds it
  store.save();
});

// ---- building -------------------------------------------------------------------------------
const hollow = () => world.getDimension(UNDERTOW_ID);
const fill = (dim, x1, y1, z1, x2, y2, z2, block) => runCmd(dim, `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}`);
const areaBuilt = (x, z, r) => {
  for (let cx = Math.floor((x - r) / 16); cx <= Math.floor((x + r) / 16); cx++)
    for (let cz = Math.floor((z - r) / 16); cz <= Math.floor((z + r) / 16); cz++) if (!isBuilt(cx, cz)) return false;
  return true;
};

// The look follows Mateo's mining village picture: stone and timber cottages with lit windows and
// dark tiled roofs, timbered mine mouths cut into the hillside with cart rails running out, an
// ore-sorting shed, a smithy with a smoking chimney, a fire in the middle, lantern posts and fences.
// Offsets are from the village centre; nothing lines up on purpose.
const V = {
  stone: "minecraft:polished_blackstone_bricks",
  stone2: "minecraft:cobbled_deepslate",
  beam: "minecraft:dark_oak_log",
  plank: "minecraft:dark_oak_planks",
  roof: "minecraft:deepslate_tiles",
  window: "minecraft:ochre_froglight",
  fence: "minecraft:dark_oak_fence",
  lantern: "minecraft:lantern",
  yard: "minecraft:coarse_dirt",
  air: "minecraft:air",
};
const COTTAGES = [
  { dx: -9, dz: -6, w: 7, d: 5, door: "south" },
  { dx: 0, dz: -9, w: 5, d: 5, door: "south" },
  { dx: 8, dz: -4, w: 5, d: 7, door: "west" },
  { dx: -8, dz: 7, w: 7, d: 5, door: "north" },
];

// One cottage: w blocks along x, d along z, centred on (x, z). Stone walls, timber corners, a lit
// window in each wall, a stepped gable roof with a one-block overhang.
function cottage(dim, x, y, z, w, d, door) {
  const x1 = x - (w >> 1), x2 = x + (w >> 1), z1 = z - (d >> 1), z2 = z + (d >> 1);
  fill(dim, x1, y - 1, z1, x2, y - 1, z2, V.stone2);
  fill(dim, x1, y, z1, x2, y + 2, z2, V.stone);
  fill(dim, x1 + 1, y, z1 + 1, x2 - 1, y + 2, z2 - 1, V.air);
  for (const [cx, cz] of [[x1, z1], [x1, z2], [x2, z1], [x2, z2]]) fill(dim, cx, y, cz, cx, y + 2, cz, V.beam);
  for (const [wx, wz] of [[x, z1], [x, z2], [x1, z], [x2, z]]) fill(dim, wx, y + 1, wz, wx, y + 1, wz, V.window);
  const [ox, oz] = { east: [x2, z], west: [x1, z], south: [x, z2], north: [x, z1] }[door];
  fill(dim, ox, y, oz, ox, y + 1, oz, V.air);
  const alongX = w >= d; // the ridge runs along the longer side
  const half = (alongX ? d : w) >> 1;
  for (let i = 0; i <= half + 1; i++) {
    const inset = i - 1; // -1 = the overhang
    if (alongX) fill(dim, x1 - 1, y + 3 + i, z1 + inset, x2 + 1, y + 3 + i, z2 - inset, V.roof);
    else fill(dim, x1 + inset, y + 3 + i, z1 - 1, x2 - inset, y + 3 + i, z2 + 1, V.roof);
  }
  fill(dim, x1 + 1, y + 3, z1 + 1, x2 - 1, y + 3, z2 - 1, V.plank); // ceiling, so the roof is not hollow from inside
}

function lampPost(dim, x, y, z) {
  fill(dim, x, y, z, x, y + 2, z, V.fence);
  fill(dim, x, y + 3, z, x, y + 3, z, V.lantern);
}

function buildVillage(v) {
  const c = villageSpot(v.id);
  if (!c) return false;
  const dim = hollow(), y = c.y, { x, z } = c;
  // level ground: a stone terrace sunk into the hillside with a trodden yard on top, headroom above
  fill(dim, x - 14, y - 4, z - 13, x + 14, y - 2, z + 13, B.floor);
  fill(dim, x - 14, y - 1, z - 13, x + 14, y - 1, z + 13, V.stone2);
  fill(dim, x - 9, y - 1, z - 3, x + 9, y - 1, z + 4, V.yard);
  fill(dim, x - 2, y - 1, z - 12, x + 2, y - 1, z + 12, V.yard);
  fill(dim, x - 14, y, z - 13, x + 14, y + 9, z + 13, V.air);

  for (const h of COTTAGES) cottage(dim, x + h.dx, y, z + h.dz, h.w, h.d, h.door);

  // the fire in the middle, with the Tally beside it: a copper counting block and a barrel under an awning
  fill(dim, x - 3, y, z + 1, x - 3, y, z + 1, "minecraft:campfire");
  fill(dim, x, y, z, x, y, z, B.copper);
  fill(dim, x + 1, y, z, x + 1, y, z, "minecraft:barrel");
  for (const [px, pz] of [[-1, -1], [2, -1], [-1, 1], [2, 1]]) fill(dim, x + px, y, z + pz, x + px, y + 2, z + pz, V.fence);
  fill(dim, x - 1, y + 3, z - 1, x + 2, y + 3, z + 1, "minecraft:purple_wool");

  // the smithy: open-fronted, a blast furnace and anvil, and a chimney that smokes
  fill(dim, x + 7, y, z + 6, x + 12, y + 2, z + 11, V.stone);
  fill(dim, x + 8, y, z + 6, x + 11, y + 2, z + 10, V.air);
  fill(dim, x + 6, y + 3, z + 5, x + 13, y + 3, z + 12, V.roof);
  fill(dim, x + 11, y, z + 10, x + 11, y, z + 10, "minecraft:blast_furnace");
  fill(dim, x + 9, y, z + 9, x + 9, y, z + 9, "minecraft:anvil");
  fill(dim, x + 12, y, z + 11, x + 12, y + 5, z + 11, V.stone2);
  fill(dim, x + 12, y + 6, z + 11, x + 12, y + 6, z + 11, "minecraft:campfire");

  // two timbered mine mouths in the west face, ore showing inside, cart rails running out to a sorting shed
  for (const mz of [z - 2, z + 4]) {
    fill(dim, x - 18, y, mz - 1, x - 15, y + 2, mz + 1, V.air);
    fill(dim, x - 19, y, mz - 1, x - 19, y + 2, mz + 1, B.ore);
    fill(dim, x - 15, y, mz - 2, x - 15, y + 3, mz - 2, V.beam);
    fill(dim, x - 15, y, mz + 2, x - 15, y + 3, mz + 2, V.beam);
    fill(dim, x - 15, y + 3, mz - 2, x - 15, y + 3, mz + 2, V.beam);
    fill(dim, x - 16, y + 2, mz, x - 16, y + 2, mz, V.lantern);
    fill(dim, x - 18, y, mz, x - 11, y, mz, "minecraft:rail");
  }
  fill(dim, x - 13, y, z + 9, x - 9, y, z + 12, V.air);
  for (const [px, pz] of [[-13, 9], [-9, 9], [-13, 12], [-9, 12]]) fill(dim, x + px, y, z + pz, x + px, y + 2, z + pz, V.fence);
  fill(dim, x - 14, y + 3, z + 8, x - 8, y + 3, z + 13, V.plank);
  fill(dim, x - 12, y, z + 10, x - 10, y, z + 11, B.ore);

  // lantern posts and a low fence along the open edges
  for (const [px, pz] of [[-4, -3], [4, 3], [-11, 2], [6, -9], [0, 11]]) lampPost(dim, x + px, y, z + pz);
  fill(dim, x - 14, y, z - 13, x + 14, y, z - 13, V.fence);
  fill(dim, x + 14, y, z - 13, x + 14, y, z + 13, V.fence);
  fill(dim, x - 1, y, z - 13, x + 1, y, z - 13, V.air); // gates
  fill(dim, x + 14, y, z - 1, x + 14, y, z + 1, V.air);

  // a plank walk from the yard down to the landing, ending in a short dock with a lantern
  const n = landingOf(v.id);
  if (n) {
    const len = Math.hypot(n.x - x, n.z - z), ux = (n.x - x) / len, uz = (n.z - z) / len;
    let wy = L.seaY; // walk up from the dock, one step at a time, cutting into the bank where it is steep
    for (let t = Math.floor(len - 2); t >= 15; t--) {
      const wx = Math.round(x + ux * t), wz = Math.round(z + uz * t);
      const wet = riverDistance(wx, wz) < 5;
      wy = wet ? L.seaY : Math.min(wy + 1, Math.max(heightAt(wx, wz) ?? L.seaY, L.seaY), y - 1);
      if (!wet) fill(dim, wx, wy - 3, wz, wx, wy - 1, wz, V.stone2);
      fill(dim, wx, wy, wz, wx, wy, wz, V.plank);
      fill(dim, wx, wy + 1, wz, wx, wy + 3, wz, V.air);
    }
    const ex = Math.round(x + ux * (len - 2)), ez = Math.round(z + uz * (len - 2));
    lampPost(dim, ex, L.seaY + 1, ez);
  }

  store.data.built[v.id] = true;
  store.data.stock[v.id] ??= 0;
  store.save();
  return true;
}

const FOLK_SPOTS = [{ dx: 0, dz: 2, foreman: true }, { dx: -5, dz: 1 }, { dx: 4, dz: -1 }, { dx: -11, dz: 9 }];
function staffVillage(v) {
  const c = villageSpot(v.id);
  if (!c) return;
  const dim = hollow();
  let here;
  try { here = dim.getEntities({ type: NPC, tags: [TAG, `hollowfolk_${v.id}`] }); } catch { return; }
  if (here.length >= FOLK_SPOTS.length) return;
  for (const e of here) try { e.remove(); } catch { /* gone */ }
  for (const s of FOLK_SPOTS) {
    try {
      const e = dim.spawnEntity(NPC, { x: c.x + s.dx + 0.5, y: c.y, z: c.z + s.dz + 0.5 });
      e.addTag(TAG);
      e.addTag(`hollowfolk_${v.id}`);
      if (s.foreman) e.addTag(TAG_FOREMAN);
      e.nameTag = s.foreman ? `§bForeman of ${v.name}` : "§7Miner";
    } catch { /* the chunk is not loaded yet; the next pass tries again */ }
  }
}

function buildVault() {
  const dim = hollow(), v = VAULT;
  fill(dim, v.x - 5, v.y - 1, v.z - 5, v.x + 5, v.y + 5, v.z + 5, B.ceiling);
  fill(dim, v.x - 4, v.y, v.z - 4, v.x + 4, v.y + 4, v.z + 4, "minecraft:air");
  fill(dim, v.x - 4, v.y - 1, v.z - 4, v.x + 4, v.y - 1, v.z + 4, B.polished);
  fill(dim, v.x, v.y, v.z, v.x, v.y, v.z, VAULT_BLOCK);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) fill(dim, v.x + dx, v.y, v.z + dz, v.x + dx, v.y, v.z + dz, B.glimbulb);
  fill(dim, v.x, v.y - 1, v.z - 3, v.x, v.y - 1, v.z - 3, B.copper); // the way back up
  const s = stairSpot();
  if (s) {
    fill(dim, s.x - 1, s.y - 1, s.z - 1, s.x + 1, s.y - 1, s.z + 1, B.copper);
    fill(dim, s.x - 1, s.y, s.z - 1, s.x + 1, s.y + 3, s.z + 1, "minecraft:air");
    fill(dim, s.x - 2, s.y, s.z - 2, s.x - 2, s.y + 2, s.z - 2, B.polished);
    fill(dim, s.x - 2, s.y + 3, s.z - 2, s.x - 2, s.y + 3, s.z - 2, B.glimbulb);
  }
  store.data.vaultBuilt = true;
  buildDeepDoor();
  store.save();
}

// The Deep Door: a sealed arch in the Vault's north wall. It does not open. It is a hook for a later
// expansion (the Deep), so nothing may depend on what is behind it yet.
const DEEP_LINES = [
  "Sealed stone, colder than the rest of the wall. It does not open.",
  "You press your ear to it. Far below, something answers your breathing a moment late.",
  "There is no handle on this side. There are scratches, low down, at the height of a hand.",
  "The seal hums one note under the Vault's. Whatever is down there is not finished.",
];
const deepDoorAt = (l) => l.z === VAULT.z + 5 && Math.abs(l.x - VAULT.x) <= 1 && l.y >= VAULT.y && l.y <= VAULT.y + 2;
function buildDeepDoor() {
  const dim = hollow(), v = VAULT;
  fill(dim, v.x - 2, v.y, v.z + 5, v.x + 2, v.y + 3, v.z + 5, B.polished);
  fill(dim, v.x - 1, v.y, v.z + 5, v.x + 1, v.y + 2, v.z + 5, B.seal);
  fill(dim, v.x, v.y + 3, v.z + 5, v.x, v.y + 3, v.z + 5, B.copper);
  store.data.deepDoor = true;
}

const hollowPlayers = () => world.getAllPlayers().filter((p) => p.dimension.id === UNDERTOW_ID);

onTick("hollowfolk:build", 60, () => {
  const players = hollowPlayers();
  if (!players.length) return;
  for (const v of FOLK.villages) {
    const c = villageSpot(v.id);
    if (!c) continue;
    const near = players.some((p) => Math.abs(p.location.x - c.x) < 64 && Math.abs(p.location.z - c.z) < 64);
    if (!near) continue;
    if (!store.data.built[v.id]) {
      if (!areaBuilt(c.x, c.z, 40)) continue; // wait for the ground and the river themselves
      if (!buildVillage(v)) continue;
    }
    staffVillage(v);
  }
  if (!store.data.vaultBuilt && players.some((p) => p.location.z > STAIR_Z - 80) && areaBuilt(pathX(STAIR_Z) + 5, STAIR_Z, 4)) buildVault();
  // Vaults built before the Deep Door existed get theirs when someone is next down there.
  if (store.data.vaultBuilt && !store.data.deepDoor && players.some((p) => Math.abs(p.location.x - VAULT.x) < 12 && Math.abs(p.location.z - VAULT.z) < 12 && Math.abs(p.location.y - VAULT.y) < 8)) { buildDeepDoor(); store.save(); }
});

// ---- the day: digging and the dawn cart -------------------------------------------------------
function dawn() {
  const m = mood(), d = store.data;
  let carted = 0;
  for (const v of FOLK.villages) {
    const dug = dig(d.stock[v.id] ?? 0, m);
    const [left, moved] = cart(dug, m);
    d.stock[v.id] = left;
    carted += moved;
  }
  d.vault.ore += carted;
  store.save();
  const ruler = wardenOnline();
  if (ruler && carted > 0) say(ruler, `§dThe dawn carts brought §f${carted}§d raw Choir Ore to your Vault. It holds §f${d.vault.ore}§d.`);
  return carted;
}
onTick("hollowfolk:day", 200, () => {
  let day;
  try { day = world.getDay(); } catch { return; }
  const d = store.data;
  if (d.day === day) return;
  const first = d.day < 0;
  d.day = day;
  if (first) { store.save(); return; }
  dawn();
});

// ---- safe ground and the Vault Stair -----------------------------------------------------------
onTick("hollowfolk:safe", 40, () => {
  for (const p of world.getAllPlayers()) {
    const safe = p.dimension.id === UNDERTOW_ID && !!inVillage(p.location);
    if (safe !== p.hasTag(TAG_SAFE)) {
      safe ? p.addTag(TAG_SAFE) : p.removeTag(TAG_SAFE);
      if (safe) arrive(p, FOLK.villages.find((v) => v.id === inVillage(p.location)));
    }
    if (p.dimension.id === UNDERTOW_ID) errandTick(p);
  }
});

// ---- village happenings: something different is going on each time you walk in ------------------
registerDeck("hollow_village", HAPPENINGS);
const lastHappening = new Map(); // player id -> tick of their last one
const deals = new Map(); // player id -> { village, until } : the Foreman's half price
const lastLine = new Map(); // player id -> index of the miner line they heard last
const dealFor = (player, v) => { const d = deals.get(player.id); return !!d && d.village === v.id && system.currentTick < d.until; };
const priceFor = (player, v, m) => { const p = priceOf(m, store.data.price); return dealFor(player, v) ? Math.max(1, Math.floor(p / 2)) : p; };
function minerLine(player, m) {
  const [line, i] = freshLine(LINES[m], lastLine.get(player.id) ?? -1);
  lastLine.set(player.id, i);
  return line;
}

function arrive(player, v) {
  if (!v) return;
  const now = system.currentTick, last = lastHappening.get(player.id);
  if (last !== undefined && now - last < HAPPENING_GAP_SECONDS * 20) return;
  const m = mood(), mine = wardenData().id === player.id, d = store.data;
  const fits = happeningsFor(m, mine).filter((h) => !h.site || !d.errands[player.id]).map((h) => h.id);
  const h = storyPick("hollow_village", player, { exclude: HAPPENINGS.filter((x) => !fits.includes(x.id)).map((x) => x.id) });
  if (!h) return;
  lastHappening.set(player.id, now);
  if (h.site) {
    d.errands[player.id] = h.id;
    store.save();
    return say(player, `§7A miner of ${v.name} stops you: §f"${ERRAND_ASKS[h.id]}"`);
  }
  if (h.id === "rich_seam") {
    d.stock[v.id] = Math.min(FOLK.tallyCap, (d.stock[v.id] ?? 0) + 6);
    store.save();
    say(player, `§bShouting from the mine mouth of ${v.name}: they have broken into a rich seam. Six more ore go into the Tally while you watch.`);
  } else if (h.id === "half_price") {
    deals.set(player.id, { village: v.id, until: now + 20 * 300 });
    say(player, `§bThe Foreman of ${v.name} is in a rare mood. §f"Half price for you, for as long as this pipe lasts."§b (5 minutes, at this Tally.)`);
  } else if (h.id === "fireside") {
    try { player.addEffect("regeneration", 20 * 20, { amplifier: 0, showParticles: false }); } catch { /* effect ids differ on old builds */ }
    say(player, `§7The miners of ${v.name} make room at the fire. Nobody asks you anything. For a while nothing hunts you.`);
    note(player, "quiet");
  } else if (h.id === "seam_mites") {
    const c = villageSpot(v.id);
    for (let i = 0; i < 3; i++) try { hollow().spawnEntity("minecraft:endermite", { x: c.x - 11 + i, y: c.y + 1, z: c.z + 9 }); } catch { /* chunk not ready */ }
    say(player, `§cA shout from the seam at ${v.name}: the picks have broken into a nest. Things are coming out of the rock.`);
    note(player, "fight");
  } else if (h.id === "bound_scrap") {
    give(player, RAW, 1);
    say(player, "§8A miner brushes past and something drops into your hand. §7\"He counts the stone. He does not count the dust. Go.\"");
  } else if (h.id === "bound_cart") {
    say(player, `§8The cart is leaving ${v.name}. Every miner stands with their back to it until it is gone. Nobody watches where it goes.`);
  } else if (h.id === "bound_warning") {
    say(player, "§7A miner, not looking at you: §f\"If you hear the note change, stop walking. Do not run. He hears running.\"");
  }
}

function errandTick(player) {
  const d = store.data, id = d.errands[player.id];
  if (!id) return;
  const h = HAPPENINGS.find((x) => x.id === id), s = h && SITES.find((x) => x.id === h.site);
  if (!s) { delete d.errands[player.id]; return store.save(); }
  if (Math.hypot(player.location.x - s.x, player.location.z - s.z) > s.r + 8) return;
  delete d.errands[player.id];
  store.save();
  markDone(player, "hollow_village", id);
  note(player, h.kind);
  give(player, RAW, ERRAND_ORE);
  say(player, `§b${s.name}. You have seen it for the one who asked. Tucked in your pack you find what they pressed on you before you left: ${ERRAND_ORE} raw Choir Ore.`);
}

const onPad = (p, s) => Math.abs(p.location.x - (s.x + 0.5)) < 1.5 && Math.abs(p.location.z - (s.z + 0.5)) < 1.5 && Math.abs(p.location.y - s.y) < 1.5;
onTick("hollowfolk:stair", 10, () => {
  if (!store.data.vaultBuilt) return;
  const up = stairSpot(), down = { x: VAULT.x, y: VAULT.y, z: VAULT.z - 3 };
  if (!up) return;
  for (const p of hollowPlayers()) {
    const atTop = onPad(p, up), atBottom = onPad(p, down);
    if (!atTop && !atBottom) continue;
    if (!p.isSneaking) {
      try { p.onScreenDisplay.setActionBar(atTop ? "§bSneak to go down to the Vault" : "§bSneak to go back up"); } catch { /* cosmetic */ }
      continue;
    }
    const to = atTop ? { x: down.x + 0.5, y: down.y, z: down.z + 1.5 } : { x: up.x + 2.5, y: up.y, z: up.z + 0.5 };
    runCmd(p, "camera @s fade time 0.1 0.3 0.4 color 40 10 70");
    p.teleport(to, { dimension: p.dimension });
  }
});

// ---- robbery -----------------------------------------------------------------------------------
function raiseAlarm(robber, place, village, at) {
  const m = mood();
  if (m === "regent") {
    emit("oreAlarm", { miner: robber.id, minerName: robber.name, x: at.x, y: at.y, z: at.z, regent: true });
    return;
  }
  const req = { robber: robber.id, robberName: robber.name, place, village, villageName: FOLK.villages.find((v) => v.id === village)?.name, x: at.x, y: at.y, z: at.z, handled: false };
  emit("hollowRobbery", req);
  if (req.handled) return;
  const ruler = wardenOnline();
  if (!ruler) return;
  const where = place === "vault" ? "your Vault" : `the Tally at ${FOLK.villages.find((v) => v.id === village)?.name}`;
  say(ruler, `§c${robber.name} is robbing ${where}! The Hollow carries you there.`);
  const go = () => {
    try {
      runCmd(ruler, "camera @s fade time 0.1 0.4 0.4 color 40 10 70");
      ruler.teleport({ x: at.x + 2, y: at.y, z: at.z + 2 }, { dimension: hollow(), facingLocation: at });
    } catch { /* ruler left this instant */ }
  };
  if (ruler.dimension.id === UNDERTOW_ID) go();
  else { hollowStep(ruler, { ignoreCooldown: true }); system.runTimeout(go, 10); }
}

function verdictFor(player) {
  const w = wardenData();
  return robVerdict({ mood: mood(), isRuler: w.id === player.id, rulerOnline: !!wardenOnline() });
}

function give(player, typeId, n) {
  for (let left = n; left > 0; left -= 64) player.dimension.spawnItem(new ItemStack(typeId, Math.min(64, left)), player.location);
}

function robTally(player, v) {
  const verdict = verdictFor(player);
  if (!verdict.ok) return say(player, `§7${verdict.why}`);
  const d = store.data, now = system.currentTick, last = d.robbedAt[v.id];
  if (last !== undefined && now >= last && now - last < FOLK.robCooldownSeconds * 20) return say(player, "§7The miners have hidden what is left. Come back later.");
  const n = Math.min(FOLK.robGrab, d.stock[v.id] ?? 0);
  if (n <= 0) return say(player, "§7The Tally is empty.");
  d.stock[v.id] -= n;
  d.robbedAt[v.id] = now;
  store.save();
  give(player, RAW, n);
  say(player, `§cYou take ${n} raw Choir Ore from the Tally. The miners do not stop you. They only look up, at something that is not there yet.`);
  raiseAlarm(player, "village", v.id, villageSpot(v.id) ?? player.location);
}

const cracking = new Map(); // player id -> tick the Vault opens
function startVault(player) {
  const verdict = verdictFor(player);
  if (!verdict.ok) return say(player, `§7${verdict.why}`);
  if (cracking.has(player.id)) return;
  const loot = vaultLoot(store.data.vault);
  if (loot.ore <= 0 && loot.emeralds <= 0) return say(player, "§7The Vault is all but empty. It is not worth the noise.");
  cracking.set(player.id, system.currentTick + FOLK.vaultSeconds * 20);
  say(player, `§cYou set to work on the Vault. Stay beside it for ${FOLK.vaultSeconds} seconds.`);
  raiseAlarm(player, "vault", undefined, VAULT);
}
onTick("hollowfolk:vault", 10, () => {
  if (!cracking.size) return;
  for (const [id, until] of cracking) {
    const p = world.getAllPlayers().find((x) => x.id === id);
    const l = p?.location;
    const close = p && p.dimension.id === UNDERTOW_ID && Math.abs(l.x - VAULT.x) <= FOLK.vaultReach && Math.abs(l.z - VAULT.z) <= FOLK.vaultReach && Math.abs(l.y - VAULT.y) <= FOLK.vaultReach;
    if (!close) {
      cracking.delete(id);
      if (p) say(p, "§7You let go of the Vault. It seals itself again.");
      continue;
    }
    if (system.currentTick < until) {
      try { p.onScreenDisplay.setActionBar(`§cBreaking the Vault: ${Math.ceil((until - system.currentTick) / 20)}s`); } catch { /* cosmetic */ }
      continue;
    }
    cracking.delete(id);
    const loot = vaultLoot(store.data.vault);
    const got = takeFromVault(loot.ore, loot.emeralds);
    if (got.ore) give(p, RAW, got.ore);
    if (got.emeralds) giveCoins(p, fromEmeralds(got.emeralds));
    world.sendMessage(`§c${p.name} has broken the Vault of the Hollow and carried off ${got.ore} ore and ${worth(got.emeralds)}.`);
  }
});

// ---- talking: miners and the Foreman's Tally -----------------------------------------------------
function tallyMenu(player, v) {
  const d = store.data, m = mood(), w = wardenData();
  const mine = w.id === player.id;
  const stock = d.stock[v.id] ?? 0;
  const price = priceFor(player, v, m);
  const rulerLine = m === "crowned" ? (wardenOnline() ? `§a${w.name} wears the Crown and is here.` : `§7${w.name} wears the Crown but is away. Nothing can be stolen until they return.`)
    : m === "regent" ? "§dThe Crown is worn. It is watching."
    : m === "free" ? "§7Nobody wears the Crown."
    : "§8Everything here belongs to the one below.";
  const greeting = mine ? "Crown-wearer! Whatever you need, it is yours." : minerLine(player, m);
  const form = new ActionFormData().title(`The Tally of ${v.name}`)
    .body(`§o"${greeting}"§r\n\nIn the Tally: §f${stock}§r raw Choir Ore\n${m === "bound" ? "" : `Price: §f${worth(price)}§r each\n`}${rulerLine}${mine ? `\n\nYour Vault holds §f${d.vault.ore}§r ore and §f${worth(d.vault.emeralds)}§r.` : ""}`);
  const acts = [];
  const add = (label, fn) => { form.button(label); acts.push(fn); };
  if (mine) {
    add("Set the price", () => priceMenu(player));
    if (stock > 0) add(`Send all ${stock} to the Vault now`, () => {
      d.vault.ore += stock;
      d.stock[v.id] = 0;
      store.save();
      say(player, `§dThe miners load the cart at once. ${stock} ore is on its way to your Vault.`);
    });
  } else if (m !== "bound") {
    if (stock >= 1) add(`Buy 1 (${worth(price)})`, () => buy(player, v, 1));
    if (stock >= 8) add(`Buy 8 (${worth(price * 8)})`, () => buy(player, v, 8));
    add("§cRob the Tally", () => robTally(player, v));
  }
  if (mine) add("Have a boat brought to the dock", () => { give(player, BOAT, 1); say(player, "§dA Latticewood Boat, and gladly."); });
  else if (m !== "bound") add(`Buy a boat (${worth(FOLK.boatPrice)})`, () => {
    if (!chargeE(player, FOLK.boatPrice, "boat")) return say(player, `§7A boat is ${worth(FOLK.boatPrice)}.`);
    give(player, BOAT, 1);
    say(player, "§bThe Foreman points you to a Latticewood Boat. The light rivers reach every village.");
  });
  add("Leave", () => {});
  form.show(player).then((r) => { if (!r.canceled) acts[r.selection]?.(); }).catch(() => {});
}

function buy(player, v, n) {
  const d = store.data, m = mood();
  if ((d.stock[v.id] ?? 0) < n) return say(player, "§7The Tally does not hold that much.");
  const cost = priceFor(player, v, m) * n;
  if (!chargeE(player, cost, "choir ore")) return say(player, `§7That is ${worth(cost)}. You have ${coins(funds(player))}.`);
  d.stock[v.id] -= n;
  if (m === "crowned" || m === "regent") d.vault.emeralds += cost;
  store.save();
  give(player, RAW, n);
  say(player, `§bThe Foreman counts out ${n} raw Choir Ore.`);
}

function priceMenu(player) {
  const d = store.data;
  new ModalFormData().title("Price of Choir Ore")
    .slider(`${ECON.many} for one raw ore, at every Tally`, fromEmeralds(FOLK.minPrice), fromEmeralds(FOLK.maxPrice), { valueStep: ECON.perEmerald, defaultValue: fromEmeralds(priceOf("crowned", d.price)) })
    .show(player).then((r) => {
      if (r.canceled) return;
      d.price = priceOf("crowned", Number(r.formValues[0]) / ECON.perEmerald);
      store.save();
      say(player, `§dEvery Tally now sells at ${worth(d.price)}.`);
    }).catch(() => {});
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  const t = e.target;
  if (t?.typeId !== NPC || !t.hasTag(TAG)) return;
  e.cancel = true;
  const player = e.player;
  const v = FOLK.villages.find((x) => t.hasTag(`hollowfolk_${x.id}`));
  const foreman = t.hasTag(TAG_FOREMAN);
  system.run(() => {
    if (!v) return;
    if (foreman) return tallyMenu(player, v);
    const m = mood();
    const line = wardenData().id === player.id ? "Crown-wearer. We are yours. Say the word." : minerLine(player, m);
    say(player, `§7Miner: §f"${line}"`);
  });
});

const deepTries = new Map(); // player id -> how many times they have tried the Deep Door this session
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== B.seal || e.block.dimension.id !== UNDERTOW_ID || !deepDoorAt(e.block.location)) return;
  if (e.isFirstEvent === false) return;
  e.cancel = true;
  const player = e.player, n = deepTries.get(player.id) ?? 0;
  deepTries.set(player.id, n + 1);
  system.run(() => say(player, `§8${DEEP_LINES[Math.min(n, DEEP_LINES.length - 1)]}`));
});

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== VAULT_BLOCK || e.block.dimension.id !== UNDERTOW_ID) return;
  const l = e.block.location;
  if (l.x !== VAULT.x || l.y !== VAULT.y || l.z !== VAULT.z) return;
  if (e.isFirstEvent === false) return;
  e.cancel = true;
  const player = e.player;
  system.run(() => {
    const d = store.data, mine = wardenData().id === player.id;
    const form = new ActionFormData().title("The Vault of the Hollow")
      .body(mine ? `Yours. It holds §f${d.vault.ore}§r raw Choir Ore and §f${worth(d.vault.emeralds)}§r.` : "A block of dark stone with no door and no lock. Something inside it hums.");
    const acts = [];
    if (mine) { form.button("Take everything"); acts.push(() => {
      const got = takeFromVault(d.vault.ore, d.vault.emeralds);
      if (got.ore) give(player, RAW, got.ore);
      if (got.emeralds) giveCoins(player, fromEmeralds(got.emeralds));
      say(player, `§dThe Vault gives up ${got.ore} ore and ${worth(got.emeralds)}.`);
    }); } else { form.button("§cBreak it open"); acts.push(() => startVault(player)); }
    form.button("Leave"); acts.push(() => {});
    form.show(player).then((r) => { if (!r.canceled) acts[r.selection]?.(); }).catch(() => {});
  });
});

// ---- test commands and the test world --------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  switch (e.id) {
    case "hc:folk_go": {
      if (!p) return;
      const id = (e.message || "glimwade").trim().toLowerCase();
      const at = id === "vault" ? stairSpot() : villageSpot(id);
      if (!at) return say(p, `§7No such place. Try: ${FOLK.villages.map((v) => v.id).join(", ")}, vault`);
      if (p.dimension.id !== UNDERTOW_ID) hollowStep(p, { ignoreCooldown: true });
      system.runTimeout(() => { try { p.teleport({ x: at.x + 3.5, y: at.y + 1, z: at.z + 3.5 }, { dimension: hollow() }); } catch { /* not ready */ } }, 10);
      break;
    }
    case "hc:folk_happen": { // something happens at the village you are standing in, ignoring the wait
      const v = p && FOLK.villages.find((x) => x.id === inVillage(p.location));
      if (!v) { if (p) say(p, "§7Stand inside a mining village first."); break; }
      lastHappening.delete(p.id);
      arrive(p, v);
      break;
    }
    case "hc:hollow_air": { // /scriptevent hc:hollow_air off   (or on): the Hollow's drifting particles
      setHollowAir(e.message.trim() !== "off");
      if (p) say(p, `§dThe Hollow's air is ${e.message.trim() === "off" ? "still" : "moving"}.`);
      break;
    }
    case "hc:folk_dawn": {
      const n = dawn();
      if (p) say(p, `§dA day's digging done. ${n} ore carted to the Vault.`);
      break;
    }
    case "hc:folk_freed":
      store.data.morvaneFallen = true;
      store.save();
      if (p) say(p, "§dThe miners are free of Morvane.");
      break;
    case "hc:folk_status": {
      if (!p) return;
      const d = store.data;
      say(p, `§dMiners: ${mood()}. Price ${d.price}. Vault ${d.vault.ore} ore, ${worth(d.vault.emeralds)}.\n` + FOLK.villages.map((v) => `${v.name}: ${d.stock[v.id] ?? 0} ore${d.built[v.id] ? "" : " (not built yet)"}`).join("\n"));
      break;
    }
  }
});

on("showcase", ({ player, dim, nextSpot, label }) => {
  const at = nextSpot();
  try {
    const e = dim.spawnEntity(NPC, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    e.addTag("siege_showcase");
    e.nameTag = "§bForeman";
  } catch { /* entity missing */ }
  label(at, "Mining village\nForeman");
  const b = nextSpot();
  try { dim.spawnEntity(BOAT, { x: b.x + 0.5, y: b.y, z: b.z + 0.5 }).addTag("siege_showcase"); } catch { /* entity missing */ }
  label(b, "Latticewood Boat");
  say(player, "§dMining villages: §f/scriptevent hc:folk_go glimwade§d (or lowseam, tollrest, highcut, vault). §f/scriptevent hc:folk_freed§d frees the miners, §f/scriptevent hc:folk_dawn§d runs a day, §f/scriptevent hc:folk_status§d shows the Tallies.");
});

// ---- self-tests ---------------------------------------------------------------------------------
addTests("hollowfolk", {
  "giant Veilcaps stand in the fens and groves, rare elsewhere, and are tree sized": () => {
    const count = (kind) => { let n = 0; for (let x = -500; x < 500; x += 1) for (let z = 200; z < 700; z += 1) { const g = giantCapAt(x, z, kind); if (g) { n++; assert(g.tall >= 4 && g.tall <= 9 && (g.wide === 2 || g.wide === 3), "odd shape"); } } return n; };
    const fen = count("fen"), waste = count("waste");
    assert(fen > 1000 && fen < 3500, `fens: ${fen} giant Veilcaps in 500,000 columns`);
    assert(waste < fen / 8, "the wastes should be nearly bare of them");
  },
  "moss hangs from ledges but never past the foot of the cliff, and not in the wastes": () => {
    for (let x = 0; x < 300; x++) for (let side = 0; side < 4; side++) for (const drop of [1, 2, 3, 4, 9]) {
      const len = strandsAt(x, 500, side, drop, "wood");
      assert(len === 0 || (drop >= 3 && len <= drop - 1 && len <= 3), `strands ${len} long on a drop of ${drop}`);
      assertEqual(strandsAt(x, 500, side, drop, "waste"), 0);
    }
  },
  "amethyst grows in patches across the Hollow, at every stage, and never carpets it": () => {
    const stages = new Set();
    let grown = 0, total = 0;
    for (let x = -600; x < 600; x += 3) for (let z = 100; z < 2200; z += 3) {
      const s = shardAt(x, z, "wood");
      total++;
      if (s >= 0) { grown++; stages.add(s); }
    }
    assert(stages.size === 4, `only ${stages.size} of 4 growth stages appear`);
    assert(grown / total > 0.005 && grown / total < 0.06, `amethyst covers ${(100 * grown / total).toFixed(1)}% of the ground`);
  },
  "every errand leads to a real place, and has its ask written": () => {
    for (const h of HAPPENINGS.filter((x) => x.site)) {
      assert(SITES.some((s) => s.id === h.site), `${h.id} points at a site that does not exist (${h.site})`);
      assert(ERRAND_ASKS[h.id], `${h.id} has no words`);
    }
  },
  "a village always has several kinds of thing going on, whoever rules": () => {
    for (const m of ["bound", "free", "crowned", "regent"]) {
      const fit = happeningsFor(m, false);
      assert(fit.length >= 5, `${m}: only ${fit.length} happenings`);
      assert(new Set(fit.map((h) => h.kind)).size >= 3, `${m}: too few kinds`);
    }
  },
  "a miner never says the same line twice running": () => {
    let last = -1;
    for (let i = 0; i < 50; i++) {
      const [, n] = freshLine(LINES.free, last);
      assert(n !== last, "repeated a line");
      last = n;
    }
  },
  "villages stand on real ground inside the valley": () => {
    for (const v of FOLK.villages) assert(villageSpot(v.id), `${v.id} is over the void`);
  },
  "villages stand on the bank, clear of the water, each at its own landing": () => {
    for (const v of FOLK.villages) {
      const c = villageSpot(v.id), n = landingOf(v.id);
      assert(n?.village, `${v.id} has no landing`);
      assert(riverDistance(c.x, c.z) > 20, `${v.id} is in the river (${riverDistance(c.x, c.z)})`);
      assert(c.y > L.seaY, `${v.id} is under water`);
    }
  },
  "slaves keep nothing, freed miners keep their ore": () => {
    assertEqual(dig(10, "bound"), 0);
    assertEqual(dig(10, "free"), 10 + FOLK.perDay);
    assertEqual(cart(20, "free")[1], 0);
    assertEqual(cart(20, "crowned")[1], 10);
    assertEqual(dig(FOLK.tallyCap, "crowned"), FOLK.tallyCap);
  },
  "no robbing while the ruling Sorcerer is offline": () => {
    assert(!robVerdict({ mood: "crowned", isRuler: false, rulerOnline: false }).ok);
    assert(robVerdict({ mood: "crowned", isRuler: false, rulerOnline: true }).ok);
    assert(robVerdict({ mood: "regent", isRuler: false, rulerOnline: false }).ok);
    assert(!robVerdict({ mood: "crowned", isRuler: true, rulerOnline: true }).ok);
    assert(!robVerdict({ mood: "bound", isRuler: false, rulerOnline: false }).ok);
  },
  "who the miners answer to": () => {
    assertEqual(moodOf({ morvaneFallen: false }), "bound");
    assertEqual(moodOf({ morvaneFallen: true }), "free");
    assertEqual(moodOf({ morvaneFallen: true, regent: true }), "regent");
    assertEqual(moodOf({ morvaneFallen: true, regent: true, rulerId: "p" }), "crowned");
  },
  "prices stay in range": () => {
    assertEqual(priceOf("crowned", 999), FOLK.maxPrice);
    assertEqual(priceOf("crowned", 0), FOLK.minPrice);
    assertEqual(priceOf("free", 3), FOLK.freePrice);
  },
});
