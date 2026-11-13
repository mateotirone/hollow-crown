// The Strongroom vault (Mateo, 2026-11-12). The town hall board's "Vault" button: pay and get the Vault Key, and
// the vault is dug out as an add-on to the town hall (Mateo, 2026-11-12: "when you buy it, it automatically builds
// it, you don't place where it goes"). The stairs go down through the hall's own floor (seat.js finds the spot in
// every hall design), to the entrance hall and the Wooden Strongroom underground; the Vault Lock sits in the wall
// beside the 3x3 door. When the hall is rebuilt bigger the stairs are laid again, and if the new hall has its
// Tree or its furniture where they were, the vault moves to a spot that fits (relics move with it). Vaults placed
// by hand before this keep their spot. Rooms: rooms_data.js (map/structures/export_vaults.py). Numbers: data.js.
//
// The key on the lock swings the 3x3 door open the way gates swing (siege/gates.js planSwing), and shut again.
// Keys are cut for one vault: owner and allies open with any key, anyone else only with a key cut for it.
//
// Relics: holding one, click a plinth in your vault and it floats there on its stand; click the stand to take it.
// Reinforcing: click the lock with the next tier's material (iron ingot, diamond, netherite ingot, Choirsteel ingot),
// confirm the cost, and the room is rebuilt bigger round it while the lock sparks.
//
// Breaking in: set a Vault Breaker against the lock and it strikes once a second (data.js LOCK_HP, BREAKER_POWER);
// only while the keeper is online or the vault lies open. When the lock breaks the door falls with it; the owner
// rebuilds both from the Vault menu. Cracked locks and doors mend with the tier's material, like walls.
//
// Away keepers: after a full real day offline (DISPATCH.vaultOpenHours) a vault holding a relic can be broken into
// without them, but only in two random 30-minute windows a real day (data.js WINDOW); each window is announced in
// game and on Discord. While away, the settlement's walls, vault and Keep take twice the damage to break and its
// guards fight harder. Any login starts the day again; a break-in already under way carries on.
//
// What other features can use:
//   vaultOf(ownerId)  -> { x, y, z, fx, fz, tier, layout, built, hall, lock: {x,y,z} } or undefined   hall: under the town hall
//   on("vaultBuilt", ({ owner, tier, lock, from }))   from: the tier it was reinforced from (undefined when new)
//   on("relicTaken", ({ owner, by, kind }))   someone outside the settlement took a relic off a vault stand
//   on("vaultDrilled", ({ owner, by })) / on("vaultBreached", ({ owner, by }))   a break-in started / the door fell
//   on("vaultOpened", ({ owner, by }))   someone outside the settlement opened it with a key cut for it
//
// Test: /scriptevent siege:vault_build [tier] [layout]   raise one where you stand, facing the way you look (creative)

import { world, system, GameMode, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, settlementAt, onTick, moduleStore, emit, on, isAlly, keepOf, addMenuLabel } from "../siege/api.js";
import { planSwing, SWEPT } from "../siege/gates.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { Plan, drawHall } from "../townhall/halls.js";
import { STYLES } from "../townhall/styles.js";
import { styleFor, drawDesigned } from "../settle/buildings.js";
import { hallMenuExtras, countMatching, takeMatching, hallOf } from "../townhall/townhall.js";
import { spotSearch, spotProblem, vaultFrameAt, spotOfVault } from "./seat.js";
import { sfx } from "../core/sfx.js";
import { VAULT_ROOMS } from "./rooms_data.js";
import { WINDOW, awayState, SAFE, safeBlow, safeCells } from "./data.js";
import { robBank, giveCoins, banked } from "../economy/coins.js";
import { strongbox } from "../economy/index.js";
import { coins } from "../economy/rules.js";
import { attackable } from "../siege/util.js";
import { DISPATCH } from "../dispatch/config.js";
import { addFilter } from "../core/events.js";
import { guardTag } from "../siege/guards.js";
import { VAULT_KEY, TIERS, TIER_NAME, LAYOUT, COSTS, UPGRADE_ITEM, nextTier, worldOf, groundBox, LOCK_HP, DOOR_HP, BREAKER_POWER, MEND, REBUILD } from "./data.js";
import { registerDamageable, hitWall, workOnWall } from "../siege/walls.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// vaults: { ownerId: { paid, hall, x, y, z, fx, fz, tier, layout, built, pending, moveFrom } }
//   hall: dug under the town hall (moves with it); moveFrom: { x, y, z, fx, fz, tier, layout } the room it is leaving
const store = moduleStore("siege:vault", () => ({ vaults: {} }));
const vaults = () => store.data.vaults;
const jobId = (owner) => `vault:${owner}`;
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };
const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });
const creative = (player) => player.getGameMode() === GameMode.Creative;
const roomOf = (tier, layout) => VAULT_ROOMS[tier]?.[layout] ?? VAULT_ROOMS[tier].treasury;
const KEY_OWNER = "hc:vault_owner";

// A Vault Key is cut for one settlement's vault: the owner and allies open it with any key, anyone else
// only with a key cut for it (a stolen or spare one).
function keyFor(owner) {
  const key = new ItemStack(VAULT_KEY, 1);
  try { key.setDynamicProperty(KEY_OWNER, owner); } catch { /* old game: an uncut key */ }
  try { key.setLore([`§7Opens ${keepOf(owner)?.name ?? "a settlement"}'s vault`]); } catch { /* fine */ }
  return key;
}
const giveKey = (player, owner) => player.getComponent("minecraft:inventory").container.addItem(keyFor(owner));
function keyOpens(player, stack, owner) {
  if (player.id === owner || isAlly(owner, player.id)) return true;
  try { return stack?.getDynamicProperty(KEY_OWNER) === owner; } catch { return false; }
}

export function vaultOf(owner) {
  const v = vaults()[owner];
  if (!v?.built) return undefined;
  const d = roomOf(v.built, v.layout);
  return { ...v, lock: worldOf(v, ...d.marks.lock) };
}

// Dig a vault for a settlement straight away, free (the battle test, battletest/): the stairs start at `at` and go
// down the way `forward` points. Replaces any vault the owner had on record. false if one is already being dug.
export function raiseVaultFor(owner, at, forward, tier = "iron") {
  if (buildFor(jobId(owner)) || !TIERS.includes(tier)) return false;
  const v = vaults()[owner] = { paid: true, x: at.x, y: at.y, z: at.z, fx: forward.x, fz: forward.z, layout: LAYOUT[tier] ?? "treasury" };
  store.save();
  start(owner, v, tier);
  return true;
}
// An owner's vault record as saved, and putting one back (or forgetting it, with none). The blocks stay.
export const vaultRecord = (owner) => vaults()[owner];
export function setVaultRecord(owner, record) { if (record) vaults()[owner] = record; else delete vaults()[owner]; store.save(); }

const plans = new Map();
function planFor(tier, layout) {
  const key = `${tier}|${layout}`;
  if (!plans.has(key)) {
    const p = drawDesigned(new Plan(styleFor("vale")), roomOf(tier, layout), `vault:${key}`);
    p.columns.clear(); // underground: nothing reaches down to the ground
    plans.set(key, p);
  }
  return plans.get(key);
}

// ---------- raising ----------

// Blocks of one room the next room does not cover (a deeper tier moves the stairs and entrance hall down)
function leftOver(from, to, layout) {
  const keys = (d, solid) => {
    const out = new Set();
    for (const [y, z, x0, n, i] of d.rows) {
      if (solid && d.palette[i][0] === "minecraft:air") continue;
      for (let x = x0; x < x0 + n; x++) out.add(`${x},${y},${z}`);
    }
    return out;
  };
  const now = keys(roomOf(to, layout), false);
  return [...keys(roomOf(from, layout), true)].filter((k) => !now.has(k)).map((k) => k.split(",").map(Number));
}

// Every block of a room in the world, with its height in the room's frame (fy)
function roomCells(v, tier, layout) {
  const out = [];
  for (const [y, z, x0, n] of roomOf(tier, layout).rows) for (let x = x0; x < x0 + n; x++) out.push({ ...worldOf(v, x, y, z), fy: y });
  return out;
}

// A vault moving to a new spot under the hall: the old room's blocks the new one does not cover. Underground they
// are filled in with stone (no hollow left under the town); the old stairs' hole in the floor gets earth unless
// the hall has already laid its floor over it; anything higher stays as the hall left it.
function movedLeftover(old, v, tier) {
  const now = new Set(roomCells(v, tier, v.layout).map((c) => `${c.x},${c.y},${c.z}`));
  return roomCells(old, old.tier, old.layout).filter((c) => !now.has(`${c.x},${c.y},${c.z}`) && c.fy <= 0).sort((a, b) => b.y - a.y);
}
const STONE = () => BlockPermutation.resolve("minecraft:stone");
const EARTH = () => BlockPermutation.resolve("minecraft:dirt");
const fillMoved = (at, block) => (at.fy < 0 ? STONE() : block.isAir || block.typeId.endsWith("_stairs") ? EARTH() : null);

// Laying a room again as it stands (the hall was rebuilt over its stairs): the door, the lock and the safe keep
// whatever state they are in (open, broken, cracked)
function keepAsIs(v) {
  const keep = new Set();
  const add = (p) => keep.add(`${p.x},${p.y},${p.z}`);
  const d = roomOf(v.built, v.layout);
  doorCells(v).forEach(add);
  add(worldOf(v, ...d.marks.lock));
  for (const [, , , tx, ty, tz] of v.open ?? []) add({ x: tx, y: ty, z: tz });
  if (d.marks.safe) safeCells(d.marks.safe).forEach((c) => add(worldOf(v, ...c)));
  return (x, y, z) => keep.has(`${x},${y},${z}`);
}

function start(owner, v, tier) {
  if (buildFor(jobId(owner))) return;
  const plan = planFor(tier, v.layout);
  const from = v.built && v.built !== tier ? v.built : undefined;
  const moved = v.moveFrom;
  const again = !from && !moved && v.built === tier; // the same room laid again where it is
  v.pending = tier;
  store.save();
  let remove, removeAs, skip;
  if (from) remove = leftOver(from, tier, v.layout).map(([x, y, z]) => worldOf(v, x, y, z));
  if (moved) { remove = movedLeftover(moved, v, tier); removeAs = fillMoved; }
  if (again) skip = keepAsIs(v);
  startBuild({
    id: jobId(owner), dimensionId: OVERWORLD, origin: { x: v.x, y: v.y, z: v.z }, forward: { x: v.fx, z: v.fz },
    plan, style: plan.style, perTick: Math.max(6, Math.ceil(plan.cells.size / 200)), remove, removeAs, skip,
    onProgress(fraction) {
      if (!from) return;
      // reinforcing: the lock hums and sparks while the room grows round it
      try {
        const dim = world.getDimension(OVERWORLD), at = worldOf(v, ...roomOf(tier, v.layout).marks.lock);
        dim.spawnParticle("minecraft:basic_crit_particle", { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 });
        if (Math.random() < 0.05) sfx(dim, "random.anvil_use", at, { volume: 0.4, pitch: 0.6 + fraction * 0.6 });
      } catch { /* unloaded */ }
    },
    onDone() {
      v.built = tier;
      if (!again) {
        v.safe = undefined; // a new safe comes with the new room
        v.broken = false; // a rebuild hangs a whole new door and lock
      }
      v.pending = undefined;
      v.moveFrom = undefined;
      store.save();
      const lock = worldOf(v, ...roomOf(tier, v.layout).marks.lock);
      if (from) moveStands(v, from, v, tier);
      if (moved) moveStands(moved, moved.tier, v, tier);
      if (!again) emit("vaultBuilt", { owner, tier, lock, from });
      const player = world.getPlayers().find((p) => p.id === owner);
      if (player && !again) {
        say(player, from ? `§6Your vault is reinforced: it is a ${TIER_NAME[tier]} now.`
          : moved ? "§6Your vault has moved to fit the new town hall: the stairs down are inside the hall. Relics on their stands came with it; barrels were rebuilt empty."
            : `§6Your ${TIER_NAME[tier]} is finished. The stairs down are inside your town hall; the Vault Lock is in the wall beside the door at the bottom.`);
        sfx(player, "random.levelup", { volume: 0.5 });
      }
    },
  });
}

// ---------- an add-on to the town hall: where the stairs go down ----------

const hallPlans = new Map();
function hallPlan(style, level) {
  const key = `${style}:${level}`;
  if (!hallPlans.has(key)) hallPlans.set(key, drawHall(level, STYLES[style]));
  return hallPlans.get(key);
}
const spotLists = new Map();
// The hall's stairs spots, best first, worked out a little each tick (one search per hall design)
function hallSpots(style, level) {
  const key = `${style}:${level}`;
  if (spotLists.has(key)) return spotLists.get(key);
  const job = new Promise((resolve) => {
    system.runJob((function* () {
      try {
        const plans = [];
        for (let l = level; l <= 5; l++) { plans.push(hallPlan(style, l)); yield; }
        resolve(yield* spotSearch(plans[0], plans.slice(1)));
      } catch (e) {
        console.warn(`[Vault] stairs search for ${key}: ${e}`);
        spotLists.delete(key);
        resolve([]);
      }
    })());
  });
  spotLists.set(key, job);
  return job;
}

// The room (this tier) stays on the settlement's own land
function offLand(owner, at, tier) {
  const b = groundBox(at, roomOf(tier, at.layout).box);
  return ![[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].every(([x, z]) => settlementAt({ x, y: at.y, z }) === owner);
}

const tell = (owner, text) => say(world.getPlayers().find((p) => p.id === owner), text);
const seating = new Set();

// Dig the vault under the town hall, or lay its stairs again after the hall was rebuilt (moving it when the new
// hall has something where they were)
async function seatInHall(owner) {
  const v = vaults()[owner];
  if (!v?.paid || v.pending || buildFor(jobId(owner)) || seating.has(owner)) return;
  if (v.built && !v.hall) return; // placed by hand before vaults came with the hall: it stays where it is
  const hall = hallOf(owner);
  if (!hall || hall.lost || hall.building || !(hall.level > 0) || !STYLES[hall.style]) {
    if (!v.built) tell(owner, "§7Your vault will be dug out under the town hall as soon as the hall is finished.");
    return;
  }
  // the stairs stay where they are while they still fit the hall
  if (v.built && !spotProblem(hallPlan(hall.style, hall.level), spotOfVault(hall, v))) return start(owner, v, v.built);
  seating.add(owner);
  let spots;
  try { spots = await hallSpots(hall.style, hall.level); } finally { seating.delete(owner); }
  const now = vaults()[owner], still = hallOf(owner);
  if (now !== v || v.pending || buildFor(jobId(owner)) || still?.building || still?.level !== hall.level) return;
  const tier = v.built ?? "wood";
  for (const spot of spots) {
    const at = { ...vaultFrameAt(hall, spot), layout: v.layout ?? LAYOUT.wood };
    if (offLand(owner, at, tier)) continue;
    if (v.built) {
      v.moveFrom = { x: v.x, y: v.y, z: v.z, fx: v.fx, fz: v.fz, tier: v.built, layout: v.layout };
      v.open = undefined;
    }
    Object.assign(v, at, { hall: true });
    start(owner, v, tier);
    return;
  }
  tell(owner, "§cThere is no room for the vault's stairs in this town hall, on your own land. Talk to the Town Board again once the hall has grown.");
}

// A hall raised, grown or moved: dig the vault paid for, or lay its stairs again (the new hall was built over them)
on("hallBuilt", ({ owner }) => { system.run(() => seatInHall(owner).catch((e) => console.warn(`[Vault] ${e}`))); });

// A build cut short by the world closing carries on when it loads again
onTick("vault", 200, () => {
  if (!isReady()) return;
  for (const [owner, v] of Object.entries(vaults())) if (v.pending && !buildFor(jobId(owner))) start(owner, v, v.pending);
});

// ---------- the town hall button ----------

const costLines = (player, tier) => COSTS[tier].map(([label, amount, match]) => ({ label, amount, match, have: countMatching(player, match) }));

function vaultMenu(player, owner) {
  const v = vaults()[owner];
  const mine = player.id === owner;
  const form = new ActionFormData().title("Vault");
  const actions = [];
  const lines = [];
  if (v?.built || v?.pending) {
    const tier = v.built ?? v.pending;
    lines.push(`§l${TIER_NAME[tier]}§r`, v.pending ? "§6It is being dug out right now." : v.hall ? "§7Down the stairs inside the town hall. Use the Vault Key on the lock to open the door." : `§7Down the stairs at ${v.x}, ${v.z}. Use the Vault Key on the lock to open the door.`);
    if (v.broken) {
      lines.push("", "§cThe vault door has been broken in. Anyone can walk in until you rebuild it.");
      const cost = REBUILD[v.built].map(([label, amount, match]) => ({ label, amount, match, have: countMatching(player, match) }));
      const free = creative(player);
      for (const c of cost) lines.push(`${free || c.have >= c.amount ? "§a" : "§c"}${c.amount} ${c.label}§7 (you have ${c.have})`);
      if (mine || isAlly(owner, player.id)) {
        const canPay = free || cost.every((c) => c.have >= c.amount);
        form.button(canPay ? "§2Rebuild the vault door\n§8and its lock" : "§8Rebuild the vault door\n(missing materials)", "textures/items/iron_pickaxe");
        actions.push(() => (canPay ? rebuildDoor(player, owner, v, free ? [] : cost) : say(player, "§cYou don't have the materials yet.")));
      }
    }
    if (mine && !v.pending) {
      form.button("A spare Vault Key\n§8for you or a trusted ally", "textures/items/vault/vault_key");
      actions.push(() => { giveKey(player, owner); say(player, "§7Here is a spare Vault Key, cut for your vault. Anyone holding it can open the door."); });
    }
  } else if (v?.paid) {
    lines.push("§lA vault, paid for§r", "§7It is dug out under the town hall, with the stairs down inside the hall, as soon as the hall is finished.");
    if (mine) {
      form.button("§2Dig it under the town hall\n§8now", "textures/items/iron_pickaxe");
      actions.push(() => { v.hall = true; store.save(); seatInHall(owner).catch(() => {}); });
      form.button("I lost the key\n§8get another", "textures/items/vault/vault_key");
      actions.push(() => giveKey(player, owner));
    }
  } else {
    lines.push("§lNo vault yet§r", "§7A vault keeps your relics behind a locked door underground. Attackers have to break in to take them.", "§7It is dug out under the town hall, with the stairs down inside the hall.", "", "§lCosts:§r");
    const cost = costLines(player, "wood");
    const free = creative(player);
    for (const c of cost) lines.push(`${free || c.have >= c.amount ? "§a" : "§c"}${c.amount} ${c.label}§7 (you have ${c.have})`);
    if (mine) {
      const canPay = free || cost.every((c) => c.have >= c.amount);
      form.button(canPay ? "§2Add Vault" : "§8Add Vault\n(missing materials)", "textures/items/vault/vault_key");
      actions.push(() => (canPay ? buy(player, owner, free ? [] : cost) : say(player, "§cYou don't have the materials yet. They are listed in the Vault menu.")));
    }
  }
  form.body(lines.join("\n"));
  form.button("Close");
  form.show(player).then((r) => { if (!r.canceled) actions[r.selection]?.(); }).catch(() => {});
}

function buy(player, owner, cost) {
  if (vaults()[owner]?.paid) return;
  for (const c of cost) if (countMatching(player, c.match) < c.amount) return say(player, "§cYou don't have the materials any more.");
  for (const c of cost) takeMatching(player, c.match, c.amount);
  vaults()[owner] = { paid: true, hall: true };
  store.save();
  giveKey(player, owner);
  sfx(player, "random.orb");
  say(player, "§6Here is your Vault Key. Masons are digging your vault out under the town hall: the stairs go down inside the hall. Keep the key, it opens the door.");
  seatInHall(owner).catch((e) => console.warn(`[Vault] ${e}`));
}

hallMenuExtras.push({ label: "Vault\n§8keep your relics under the town hall", icon: "textures/items/vault/vault_key", action: (player, owner) => vaultMenu(player, owner) });

// ---------- the door: the key on the lock swings it open (the gates' swing) ----------

const DOOR = /^siege:vault_door_(plate_)?(wood|iron|diamond|netherite|choirsteel)$/;
const isLock = (id) => /^siege:vault_lock_/.test(id);

// The vault whose lock this is
function vaultAtLock(block) {
  const l = block.location;
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.built) continue;
    const at = worldOf(v, ...roomOf(v.built, v.layout).marks.lock);
    if (at.x === l.x && at.y === l.y && at.z === l.z) return [owner, v];
  }
  return [];
}

// The 3x3 door's blocks, closed: the lock is two to the right of the door's edge, at the door's middle height
function doorCells(v) {
  const [lx, ly, lz] = roomOf(v.built, v.layout).marks.lock;
  const out = [];
  for (let dx = -4; dx <= -2; dx++) for (let dy = -1; dy <= 1; dy++) out.push(worldOf(v, lx + dx, ly + dy, lz));
  return out;
}

const freeAt = (dim, p) => {
  try { const b = dim.getBlock(p); return !!b && (b.isAir || SWEPT.has(b.typeId) || b.typeId.endsWith("_carpet")); } catch { return false; }
};

function swingDoor(player, owner, v) {
  const dim = world.getDimension(OVERWORLD);
  const air = BlockPermutation.resolve("minecraft:air");
  if (v.open) {
    const moves = v.open.map(([fx, fy, fz, tx, ty, tz]) => ({ from: { x: fx, y: fy, z: fz }, to: { x: tx, y: ty, z: tz } }));
    if (moves.some((m) => !freeAt(dim, m.from))) return player.onScreenDisplay.setActionBar("§7Something is standing in the doorway.");
    const perms = moves.map((m) => { const b = dim.getBlock(m.to); return DOOR.test(b?.typeId ?? "") ? b.permutation : undefined; });
    moves.forEach((m, i) => { if (perms[i]) dim.getBlock(m.to).setPermutation(air); });
    moves.forEach((m, i) => { if (perms[i]) dim.getBlock(m.from).setPermutation(perms[i].withState("minecraft:cardinal_direction", v.facing)); });
    v.open = undefined;
    store.save();
    sfx(player, "random.door_close", { volume: 1, pitch: 0.6 });
    return;
  }
  const cells = doorCells(v);
  const blocks = cells.map((c) => dim.getBlock(c));
  if (!blocks.some((b) => DOOR.test(b?.typeId ?? ""))) return player.onScreenDisplay.setActionBar("§7The vault door is broken. Repair it at the lock.");
  const centre = blocks[4];
  const facing = centre?.permutation.getState("minecraft:cardinal_direction") ?? "south";
  const plan = planSwing(cells, facing, cells[4], player.location, (p) => freeAt(dim, p));
  if (!plan) return player.onScreenDisplay.setActionBar("§7Something is in the way of the vault door.");
  const perms = plan.moves.map((m) => { const b = dim.getBlock(m.from); return DOOR.test(b?.typeId ?? "") ? b.permutation : undefined; });
  plan.moves.forEach((m, i) => { if (perms[i]) dim.getBlock(m.from).setPermutation(air); });
  plan.moves.forEach((m, i) => { if (perms[i]) dim.getBlock(m.to).setPermutation(perms[i].withState("minecraft:cardinal_direction", plan.face)); });
  v.facing = facing;
  v.open = plan.moves.filter((m, i) => perms[i]).map((m) => [m.from.x, m.from.y, m.from.z, m.to.x, m.to.y, m.to.z]);
  store.save();
  sfx(player, "random.door_open", { volume: 1, pitch: 0.6 });
  if (player.id !== owner && !isAlly(owner, player.id)) emit("vaultOpened", { owner, by: player.id });
}

function useLock(player, block, stack) {
  const [owner, v] = vaultAtLock(block);
  if (!owner) return player.onScreenDisplay.setActionBar("§7This lock belongs to no vault.");
  if (v.broken) return player.onScreenDisplay.setActionBar("§7The vault door is broken. Rebuild it from the Vault menu at the town hall.");
  if (stack && stack.typeId !== VAULT_KEY && workOnWall(block, player, stack)) return; // mending a cracked lock
  if (stack && stack.typeId !== VAULT_KEY && Object.values(UPGRADE_ITEM).includes(stack.typeId)) return reinforce(player, owner, v, stack);
  if (!stack || stack.typeId !== VAULT_KEY) return player.onScreenDisplay.setActionBar("§7Locked. It takes this vault's key.");
  if (!keyOpens(player, stack, owner)) return player.onScreenDisplay.setActionBar("§7This key was cut for another vault.");
  swingDoor(player, owner, v);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (event.isFirstEvent === false || !isReady() || !isLock(block.typeId)) return;
  event.cancel = true;
  system.run(() => useLock(player, block, itemStack));
});

// ---------- breaking in: Vault Breakers on the lock; a broken lock takes the door with it ----------

const DIR_NAME = { "0,-1": "north", "0,1": "south", "1,0": "east", "-1,0": "west" };
const doorFacing = (v) => DIR_NAME[`${-v.fx},${-v.fz}`]; // the door and lock face back up the stairs

for (const t of TIERS) {
  registerDamageable(`siege:vault_lock_${t}`, { hp: LOCK_HP[t], repair: MEND[t] });
  registerDamageable(`siege:vault_door_${t}`, { hp: DOOR_HP[t], repair: MEND[t] });
  registerDamageable(`siege:vault_door_plate_${t}`, { hp: DOOR_HP[t], repair: MEND[t] });
}

// Every vault whose lock is gone is breached: the door falls with it (Mateo: destroying the lock destroys only the door)
function breach(owner, v, by) {
  if (v.broken) return;
  const dim = world.getDimension(OVERWORLD);
  const spots = v.open ? v.open.map(([, , , tx, ty, tz]) => ({ x: tx, y: ty, z: tz })) : doorCells(v);
  for (const at of spots) {
    try {
      const b = dim.getBlock(at);
      if (b && DOOR.test(b.typeId)) { b.setType("minecraft:air"); dim.spawnParticle("minecraft:large_explosion", { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 }); }
    } catch { /* unloaded */ }
  }
  v.broken = true;
  v.open = undefined;
  store.save();
  const name = keepOf(owner)?.name ?? "A settlement";
  const thief = by && world.getPlayers().find((p) => p.id === by)?.name;
  emit("vaultBreached", { owner, by });
  emit("discordAlert", { kind: "vaultBreached", text: `${name}'s vault has been broken into${thief ? ` by ${thief}` : ""}.`, ping: [], hollow: false });
  try { sfx(dim, "random.explode", doorCells(v)[4], { volume: 1, pitch: 0.6 }); } catch { /* quiet */ }
}

function rebuildDoor(player, owner, v, cost) {
  if (!v.broken) return;
  for (const c of cost) if (countMatching(player, c.match) < c.amount) return say(player, "§cYou don't have the materials any more.");
  const dim = world.getDimension(OVERWORLD);
  const facing = doorFacing(v);
  const cells = doorCells(v);
  if (cells.some((at) => { try { const b = dim.getBlock(at); return !b || !(b.isAir || SWEPT.has(b.typeId)); } catch { return true; } })) {
    return say(player, "§7Something is in the doorway. Clear it and try again.");
  }
  for (const c of cost) takeMatching(player, c.match, c.amount);
  const tier = v.built;
  cells.forEach((at, i) => {
    const id = i === 4 ? `siege:vault_door_${tier}` : `siege:vault_door_plate_${tier}`;
    dim.getBlock(at).setPermutation(BlockPermutation.resolve(id, { "minecraft:cardinal_direction": facing }));
  });
  const lock = worldOf(v, ...roomOf(tier, v.layout).marks.lock);
  try { dim.getBlock(lock).setPermutation(BlockPermutation.resolve(`siege:vault_lock_${tier}`, { "minecraft:cardinal_direction": facing })); } catch { /* unloaded */ }
  v.broken = false;
  v.facing = facing;
  store.save();
  sfx(player, "random.anvil_use", { volume: 0.8 });
  say(player, "§6The vault door and its lock are back in place.");
}

// Running drills: { "x,y,z" of the breaker: { lock: {x,y,z}, owner, by } } (not saved: a reload stops them)
const drills = new Map();

function lockNextTo(block) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    const at = { x: block.location.x + dx, y: block.location.y + dy, z: block.location.z + dz };
    const b = block.dimension.getBlock(at);
    if (b && isLock(b.typeId)) return b;
  }
  return undefined;
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady() || !BREAKER_POWER[block.typeId]) return;
  const lock = lockNextTo(block);
  if (!lock) return player.onScreenDisplay.setActionBar("§7A Vault Breaker works only set right against a Vault Lock.");
  const [owner, v] = vaultAtLock(lock);
  if (!owner) return player.onScreenDisplay.setActionBar("§7This lock belongs to no vault.");
  if (player.id === owner || isAlly(owner, player.id)) return player.onScreenDisplay.setActionBar("§7That's your own vault. Use the key.");
  if (!attackable(owner)) return player.onScreenDisplay.setActionBar("§7The vault's keeper is away. It can only be broken into while they are here, while it lies open, or in a War Writ siege.");
  drills.set(`${block.location.x},${block.location.y},${block.location.z}`, { at: { ...block.location }, lock: { ...lock.location }, owner, by: player.id });
  emit("vaultDrilled", { owner, by: player.id });
  player.onScreenDisplay.setActionBar("§6The breaker bites into the lock...");
});

onTick("vault-drills", 20, () => {
  if (!drills.size) return;
  const dim = world.getDimension(OVERWORLD);
  for (const [k, d] of drills) {
    try {
      const breaker = dim.getBlock(d.at), lock = dim.getBlock(d.lock);
      if (!breaker || !lock) continue; // unloaded: wait
      if (!BREAKER_POWER[breaker.typeId] || !isLock(lock.typeId)) { drills.delete(k); continue; }
      sfx(dim, "random.anvil_land", d.lock, { volume: 0.5, pitch: 1.4 });
      if (hitWall(lock, BREAKER_POWER[breaker.typeId])) {
        drills.delete(k);
        breaker.setType("minecraft:air"); // the breaker is spent
        const v = vaults()[d.owner];
        if (v) breach(d.owner, v, d.by);
      }
    } catch { drills.delete(k); }
  }
});

// A lock lost any other way (a blast, a trebuchet) breaches the vault too
onTick("vault-locks", 40, () => {
  if (!isReady()) return;
  const dim = world.getDimension(OVERWORLD);
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.built || v.broken || v.pending) continue;
    try {
      const b = dim.getBlock(worldOf(v, ...roomOf(v.built, v.layout).marks.lock));
      if (b && !isLock(b.typeId)) breach(owner, v);
    } catch { /* unloaded */ }
  }
});

// ---------- a keeper away a full real day: the vault lies open in short random windows ----------

const awayOf = (owner, v) => awayState(owner, v.leftAt, Date.now(), DISPATCH.vaultOpenHours);
// Is this settlement's keeper away long enough that its defences stand twice as strong? (Mateo: an AFK village
// is twice as hard to attack)
// Does this keeper hold a relic: on a stand in their vault, or carried (grounds for a War Writ, warwrit/index.js)?
export function holdsRelic(owner) {
  const v = vaults()[owner];
  if (v && Object.values(v.stands ?? {}).some(Boolean)) return true;
  const player = world.getPlayers().find((p) => p.id === owner);
  if (!player) return !!v?.carried;
  if (player.hasTag(DISPATCH.holderTag)) return true;
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (let i = 0; inv && i < inv.size; i++) if (KIND_OF_ITEM[inv.getItem(i)?.typeId]) return true;
  return false;
}

export function keeperAway(owner) {
  const v = vaults()[owner];
  return !!v?.leftAt && awayOf(owner, v).away;
}

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  try {
    const id = player.id;
    if (!vaults()[id]) return;
    // a relic carried away counts as one kept (the template holder's tag, or a relic in their bags)
    let carried = player.hasTag(DISPATCH.holderTag);
    try {
      const inv = player.getComponent("minecraft:inventory").container;
      for (let i = 0; i < inv.size && !carried; i++) carried = !!KIND_OF_ITEM[inv.getItem(i)?.typeId];
    } catch { /* fine */ }
    system.run(() => { const v = vaults()[id]; if (v) { v.leftAt = Date.now(); v.carried = carried; store.save(); } });
  } catch { /* leaving */ }
});

// Any login, even for a second, starts the day again. Breakers already drilling keep going (no escaping a siege).
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  const v = vaults()[player.id];
  if (!v?.leftAt) return;
  v.leftAt = undefined;
  v.openWindow = false;
  store.save();
});

onTick("vault-away", 1200, () => {
  if (!isReady()) return;
  const now = Date.now();
  let changed = false;
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.built || !v.leftAt) continue;
    const st = awayOf(owner, v);
    const relic = Object.values(v.stands ?? {}).some(Boolean) || v.carried;
    const open = !!(st.away && st.window && relic);
    if (open !== !!v.openWindow) {
      v.openWindow = open;
      changed = true;
      const name = keepOf(owner)?.name ?? "A settlement";
      if (open && v.announced !== st.window.start) {
        v.announced = st.window.start;
        emit("vaultWindow", { owner, open: true, until: st.window.end });
        emit("discordAlert", { kind: "vaultWindow", text: `${name}'s vault is open for the next ${WINDOW.minutes} minutes. Its keeper has been away a full day.`, ping: [], hollow: false });
        for (const p of world.getPlayers()) if (p.id !== owner && !isAlly(owner, p.id)) say(p, `§6${name}'s vault lies open for the next ${WINDOW.minutes} minutes. Its keeper is away, and its defences stand twice as strong.`);
      } else if (!open) emit("vaultWindow", { owner, open: false });
    }
  }
  if (changed) store.save();
});

// Twice as strong while the keeper is away: walls, gates, the vault door and lock take twice the blows,
// the Keep twice the damage, and the settlement's guards fight harder.
addFilter("wallHp", (hp, { block }) => {
  try { const owner = settlementAt(block.location); return owner && keeperAway(owner) ? hp * 2 : hp; } catch { return hp; }
});
addFilter("keepHealth", (hp, { owner }) => (keeperAway(owner) ? hp * 2 : hp));
// While a window is open the settlement can be attacked at all: walls, gates, guards and engines lose the
// away protection (siege/util.js attackable) and fight at double strength instead
addFilter("openToAttack", (open, { owner }) => open || !!vaults()[owner]?.openWindow);
onTick("vault-away-guards", 200, () => {
  if (!isReady()) return;
  const dim = world.getDimension(OVERWORLD);
  for (const owner of Object.keys(vaults())) {
    if (!keeperAway(owner)) continue;
    for (const g of dim.getEntities({ tags: [guardTag(owner)] })) {
      try { g.addEffect("resistance", 260, { amplifier: 1, showParticles: false }); g.addEffect("strength", 260, { amplifier: 1, showParticles: false }); } catch { /* gone */ }
    }
  }
});

// ---------- the Regal Safe: the owner's Regals, robbed a blow at a time ----------
// Regals are one virtual sum per player (economy/coins.js). The safe exists only so that sum can be robbed.

const SAFE_BLOCK = "siege:regal_safe";
const lastBlow = new Map(); // player id -> tick of their last blow (one blow counts every 8 ticks)

function safeAt(block) {
  const l = block.location;
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.built) continue;
    const m = roomOf(v.built, v.layout).marks.safe;
    if (!m) continue;
    const cells = safeCells(m).map((c) => worldOf(v, ...c));
    if (cells.some((c) => c.x === l.x && c.y === l.y && c.z === l.z)) return { owner, v, cells };
  }
  return undefined;
}

function showSafeCracks(cells, frac) {
  const dim = world.getDimension(OVERWORLD);
  const cracks = frac >= 1 ? 2 : frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0;
  for (const at of cells) {
    try { const b = dim.getBlock(at); if (b?.typeId === SAFE_BLOCK && b.permutation.getState("siege:cracks") !== cracks) b.setPermutation(b.permutation.withState("siege:cracks", cracks)); } catch { /* unloaded */ }
  }
}

world.afterEvents.entityHitBlock.subscribe(({ damagingEntity: player, hitBlock: block }) => {
  if (player?.typeId !== "minecraft:player" || block?.typeId !== SAFE_BLOCK || !isReady()) return;
  const found = safeAt(block);
  if (!found) return;
  const { owner, v, cells } = found;
  if (player.id === owner || isAlly(owner, player.id)) return player.onScreenDisplay.setActionBar("§7Your Regal Safe. It holds all your Regals: click it to see how many.");
  if (!attackable(owner)) return player.onScreenDisplay.setActionBar("§7The safe's keeper is away. It can't be touched until they return or the vault lies open.");
  const now = system.currentTick;
  if (now - (lastBlow.get(player.id) ?? -100) < 8) return;
  lastBlow.set(player.id, now);
  v.safe ??= { hits: 0, broken: false };
  if (v.safe.broken) return player.onScreenDisplay.setActionBar("§7The safe hangs open. Nothing is left in it.");
  const inside = banked(owner);
  const blow = safeBlow(v.built, inside, v.safe.hits);
  const took = robBank(owner, blow.take);
  if (took) giveCoins(player, took);
  v.safe.hits += 1;
  const dim = block.dimension;
  try { sfx(dim, "random.anvil_land", block.location, { volume: 0.7, pitch: 1.2 }); } catch { /* quiet */ }
  if (blow.broken) {
    v.safe.broken = true;
    showSafeCracks(cells, 1);
    player.onScreenDisplay.setActionBar(`§6The safe bursts open! +${coins(took)}`);
    const name = keepOf(owner)?.name ?? "A settlement";
    emit("safeBroken", { owner, by: player.id, took });
    emit("discordAlert", { kind: "safeBroken", text: `${player.name} broke open ${name}'s Regal Safe and took ${took} Regals.`, ping: [], hollow: false });
    emit("baseAttacked", { owner, kind: "vault", text: `${player.name} broke open your Regal Safe.`, by: player.id });
    world.sendMessage(`§c§l${player.name} broke open the Regal Safe of ${name}§r§c and took ${coins(took)}!`); // the whole server hears it (Mateo, 2026-11-12)
  } else {
    showSafeCracks(cells, v.safe.hits / SAFE[v.built].hits);
    player.onScreenDisplay.setActionBar(`§6+${coins(took)}§7  (blow ${v.safe.hits} of ${SAFE[v.built].hits})`);
    if (v.safe.hits === 1) emit("baseAttacked", { owner, kind: "vault", text: "Someone is robbing your Regal Safe.", by: player.id });
  }
  store.save();
});

// The owner (or an ally) clicks it: how many Regals they have; a broken safe is shut and locked again first
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (event.isFirstEvent === false || !isReady() || block.typeId !== SAFE_BLOCK) return;
  event.cancel = true;
  system.run(() => {
    const found = safeAt(block);
    if (!found) return;
    const { owner, v, cells } = found;
    if (player.id !== owner && !isAlly(owner, player.id)) return player.onScreenDisplay.setActionBar("§7Locked. Break it open, a blow at a time.");
    if (v.safe?.hits) {
      v.safe = { hits: 0, broken: false };
      store.save();
      showSafeCracks(cells, 0);
      say(player, "§7You hammer the safe straight and lock it again.");
    }
    if (player.id === owner) strongbox(player).catch(() => {});
  });
});

// ---------- reinforcing: click the lock with the next tier's material ----------

// Relic stands keep their relic and move to the new room's plinths (a bigger room, or a room moved with the hall)
function moveStands(a0, from, b0, to) {
  const dim = world.getDimension(OVERWORLD);
  const old = roomOf(from, a0.layout).marks, now = roomOf(to, b0.layout).marks;
  for (const kind of Object.keys(RELICS)) {
    if (!old[`stand_${kind}`] || !now[`stand_${kind}`]) continue;
    const a = worldOf(a0, ...old[`stand_${kind}`]), b = worldOf(b0, ...now[`stand_${kind}`]);
    const stand = standOn(dim, a);
    try { stand?.teleport({ x: b.x + 0.5, y: b.y + 0.25, z: b.z + 0.5 }); } catch { /* unloaded */ }
  }
}

function reinforce(player, owner, v, stack) {
  const next = nextTier(v.built);
  if (!next) return player.onScreenDisplay.setActionBar("§7This vault is as strong as a vault can be.");
  if (stack.typeId !== UPGRADE_ITEM[next]) {
    const want = Object.entries(UPGRADE_ITEM).find(([, id]) => id === stack.typeId)?.[0];
    return player.onScreenDisplay.setActionBar(want ? `§7Reinforce it one step at a time: next is ${TIER_NAME[next]}.` : "§7Locked. It takes this vault's key.");
  }
  if (player.id !== owner) return player.onScreenDisplay.setActionBar("§7Only the vault's owner can reinforce it.");
  if (v.broken) return player.onScreenDisplay.setActionBar("§7Rebuild the broken door first, from the Vault menu.");
  if (buildFor(jobId(owner))) return player.onScreenDisplay.setActionBar("§7The vault is already being worked on.");
  const free = creative(player);
  const cost = costLines(player, next);
  const lines = [`Reinforce your vault into a §l${TIER_NAME[next]}§r? The room is rebuilt bigger, the door and lock stronger.`, "", "§lCosts:§r"];
  for (const c of cost) lines.push(`${free || c.have >= c.amount ? "§a" : "§c"}${c.amount} ${c.label}§7 (you have ${c.have})`);
  lines.push("", "§7Barrels are rebuilt empty, so take your things out first. Relics on their stands move with the room.");
  const canPay = free || cost.every((c) => c.have >= c.amount);
  new MessageFormData().title("Reinforce the vault").body(lines.join("\n"))
    .button1(canPay ? "Reinforce it" : "Not enough yet").button2("Not now")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0 || !canPay) return;
      if (!free) {
        for (const c of cost) if (countMatching(player, c.match) < c.amount) return say(player, "§cYou don't have the materials any more.");
        for (const c of cost) takeMatching(player, c.match, c.amount);
      }
      if (v.open) v.open = undefined; // the rebuild hangs a new door, shut
      start(owner, v, next);
      sfx(player, "random.anvil_use", { volume: 0.8, pitch: 0.7 });
      say(player, `§6Masons are reinforcing your vault into a ${TIER_NAME[next]}. Stand clear of the works.`);
    }).catch(() => {});
}

// ---------- relic stands ----------
// Holding a relic, click a plinth in your vault: the relic comes to rest floating over it, the way a dropped
// Crown rests on its stand (the Crown uses that very stand, undertow/crownkeep.js, which also takes it back).
// Click a Heart or template stand to take the relic. A template on a stand counts as seen for the Cold Forge.

const RELICS = {
  crown: { item: "siege:hollow_crown", stand: "siege:crown_stand", name: "the Hollow Crown" },
  heart: { item: "siege:heart_of_the_hollow", stand: "siege:heart_stand", name: "the Heart" },
  template: { item: "siege:choirsteel_upgrade_template", stand: "siege:template_stand", name: "the Choirsteel template" },
};
addMenuLabel({ block: "siege:regal_safe", name: "Regal Safe", hint: "Click: your Regals" });
addMenuLabel({ entity: RELICS.heart.stand, hint: "Click: take the Heart" });
addMenuLabel({ entity: RELICS.template.stand, hint: "Click: take the Choirsteel template" });
for (const t of TIERS) addMenuLabel({ block: `siege:vault_lock_${t}`, name: "Vault Lock", hint: "Click with the Vault Key: open or shut" });

const KIND_OF_ITEM = Object.fromEntries(Object.entries(RELICS).map(([k, r]) => [r.item, k]));
const KIND_OF_STAND = Object.fromEntries(Object.entries(RELICS).map(([k, r]) => [r.stand, k]));
const LORE = "hc:relic_lore";

// The vault and stand kind whose plinth (the block under a stand mark) this is
function plinthAt(block) {
  const l = block.location;
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.built) continue;
    const marks = roomOf(v.built, v.layout).marks;
    for (const kind of Object.keys(RELICS)) {
      const m = marks[`stand_${kind}`];
      if (!m) continue;
      const at = worldOf(v, m[0], m[1] - 1, m[2]);
      if (at.x === l.x && at.y === l.y && at.z === l.z) return { owner, v, kind, spot: worldOf(v, ...m) };
    }
  }
  return undefined;
}

function standOn(dim, spot) {
  try {
    return dim.getEntities({ location: { x: spot.x + 0.5, y: spot.y + 0.5, z: spot.z + 0.5 }, maxDistance: 1.2 })
      .find((e) => KIND_OF_STAND[e.typeId]);
  } catch { return undefined; }
}

function placeRelic(player, block, stack) {
  const found = plinthAt(block);
  if (!found) return false;
  const { owner, v, spot } = found;
  if (player.id !== owner && !isAlly(owner, player.id)) { player.onScreenDisplay.setActionBar("§7Not your vault."); return true; }
  const kind = KIND_OF_ITEM[stack?.typeId];
  if (!kind) { player.onScreenDisplay.setActionBar("§7A relic rests here: the Hollow Crown, the Heart or the Choirsteel template."); return true; }
  const dim = block.dimension;
  if (standOn(dim, spot)) { player.onScreenDisplay.setActionBar("§7Something already rests on this plinth."); return true; }
  const inv = player.getComponent("minecraft:inventory").container;
  const slot = player.selectedSlotIndex;
  const held = inv.getItem(slot);
  if (held?.typeId !== stack.typeId) return true;
  const where = { x: spot.x + 0.5, y: spot.y + 0.25, z: spot.z + 0.5 };
  const stand = dim.spawnEntity(RELICS[kind].stand, where);
  const lore = JSON.stringify(held.getLore() ?? []);
  try { stand.setDynamicProperty(kind === "crown" ? "hc:crown_lore" : LORE, lore); } catch { /* plain */ }
  if (held.amount > 1) { held.amount -= 1; inv.setItem(slot, held); } else inv.setItem(slot, undefined);
  v.stands = { ...(v.stands ?? {}), [kind]: true };
  store.save();
  if (kind === "template") emit("templateSeen", { owner });
  try { sfx(dim, "block.amethyst_block.chime", where, { volume: 1, pitch: 0.7 }); } catch { /* quiet */ }
  player.onScreenDisplay.setActionBar(`§dYou set ${RELICS[kind].name} to rest in your vault.`);
  return true;
}

function takeRelic(player, stand) {
  if (!stand.isValid) return;
  const kind = KIND_OF_STAND[stand.typeId];
  const item = new ItemStack(RELICS[kind].item, 1);
  try { const lore = JSON.parse(stand.getDynamicProperty(LORE) ?? "[]"); if (lore.length) item.setLore(lore); } catch { /* plain */ }
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv || inv.emptySlotsCount === 0) return void player.onScreenDisplay.setActionBar(`§7Your hands are full. Make room to take ${RELICS[kind].name}.`);
  inv.addItem(item);
  const at = stand.location;
  stand.remove();
  for (const [owner, v] of Object.entries(vaults())) {
    if (!v.stands?.[kind]) continue;
    const m = v.built && roomOf(v.built, v.layout).marks[`stand_${kind}`];
    const spot = m && worldOf(v, ...m);
    if (spot && Math.abs(spot.x + 0.5 - at.x) < 1.5 && Math.abs(spot.z + 0.5 - at.z) < 1.5) {
      v.stands[kind] = false;
      store.save();
      if (player.id !== owner && !isAlly(owner, player.id)) emit("relicTaken", { owner, by: player.id, kind });
    }
  }
  try { sfx(player.dimension, "block.amethyst_block.break", at, { volume: 1, pitch: 0.5 }); } catch { /* quiet */ }
  player.onScreenDisplay.setActionBar(`§dYou take ${RELICS[kind].name}.`);
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target.typeId !== RELICS.heart.stand && e.target.typeId !== RELICS.template.stand) return;
  e.cancel = true;
  const p = e.player, stand = e.target;
  system.run(() => takeRelic(p, stand));
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (event.isFirstEvent === false || !isReady() || !KIND_OF_ITEM[itemStack?.typeId] || block.dimension.id !== OVERWORLD) return;
  if (!plinthAt(block)) return;
  event.cancel = true;
  system.run(() => placeRelic(player, block, itemStack));
});

// A template resting in a vault is not lost: tell the Cold Forge it was seen (undertow/forge.js, PR #144)
onTick("vault-relics", 1200, () => {
  if (!isReady()) return;
  for (const [owner, v] of Object.entries(vaults())) if (v.stands?.template) emit("templateSeen", { owner });
});

// ---------- test ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:vault_build") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [tier = "wood", layout = LAYOUT.wood] = (event.message || "").trim().split(/\s+/).filter(Boolean);
  if (!TIERS.includes(tier) || !VAULT_ROOMS[tier][layout]) return say(player, `§7Tiers: ${TIERS.join(", ")}. Layouts: treasury, hall, crypt.`);
  const f = cardinal(player.getViewDirection());
  const at = player.location;
  const plan = planFor(tier, layout);
  startBuild({ id: `vault:test:${Math.floor(at.x)},${Math.floor(at.z)}`, dimensionId: player.dimension.id,
    origin: { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) }, forward: f, plan, style: plan.style,
    perTick: Math.max(6, Math.ceil(plan.cells.size / 200)), onDone: () => say(player, `§6Test ${TIER_NAME[tier]} (${layout}) finished.`) });
  say(player, `§7Digging a test ${TIER_NAME[tier]} (${layout}) ahead of you.`);
});
