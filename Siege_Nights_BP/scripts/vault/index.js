// The Strongroom vault (Mateo, 2026-11-12). The town hall board's "Vault" button: pay, get the Vault Key, then use
// the key on the ground where the stairs should start, facing the way they go down. The staircase is carved, the
// entrance hall and the Wooden Strongroom are built underground, the Vault Lock sits in the wall beside the 3x3
// door. Rooms: rooms_data.js (map/structures/export_vaults.py). Numbers: data.js.
//
// The key on the lock swings the 3x3 door open the way gates swing (siege/gates.js planSwing), and shut again.
// Keys are cut for one vault: owner and allies open with any key, anyone else only with a key cut for it.
//
// Still to come: relic stands, reinforcing to the next tier, Vault Breakers on
// the lock, repair, and the offline open windows.
//
// What other features can use:
//   vaultOf(ownerId)  -> { x, y, z, fx, fz, tier, layout, built, lock: {x,y,z} } or undefined
//   on("vaultBuilt", ({ owner, tier, lock }))
//   on("vaultOpened", ({ owner, by }))   someone outside the settlement opened it with a key cut for it
//
// Test: /scriptevent siege:vault_build [tier] [layout]   raise one where you stand, facing the way you look (creative)

import { world, system, GameMode, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, settlementAt, onTick, moduleStore, emit, isAlly, keepOf } from "../siege/api.js";
import { planSwing, SWEPT } from "../siege/gates.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { Plan } from "../townhall/halls.js";
import { styleFor, drawDesigned } from "../settle/buildings.js";
import { siteProblem } from "../settle/plans.js";
import { hallMenuExtras, countMatching, takeMatching } from "../townhall/townhall.js";
import { sfx } from "../core/sfx.js";
import { VAULT_ROOMS } from "./rooms_data.js";
import { VAULT_KEY, TIERS, TIER_NAME, LAYOUT, COSTS, worldOf, groundBox } from "./data.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
// vaults: { ownerId: { paid, x, y, z, fx, fz, tier, layout, built, pending } }
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

function start(owner, v, tier) {
  if (buildFor(jobId(owner))) return;
  const plan = planFor(tier, v.layout);
  v.pending = tier;
  store.save();
  startBuild({
    id: jobId(owner), dimensionId: OVERWORLD, origin: { x: v.x, y: v.y, z: v.z }, forward: { x: v.fx, z: v.fz },
    plan, style: plan.style, perTick: Math.max(6, Math.ceil(plan.cells.size / 200)),
    onDone() {
      v.built = tier;
      v.pending = undefined;
      store.save();
      const lock = worldOf(v, ...roomOf(tier, v.layout).marks.lock);
      emit("vaultBuilt", { owner, tier, lock });
      const player = world.getPlayers().find((p) => p.id === owner);
      if (player) {
        say(player, `§6Your ${TIER_NAME[tier]} is finished. Go down the stairs; the Vault Lock is in the wall beside the door.`);
        sfx(player, "random.levelup", { volume: 0.5 });
      }
    },
  });
}

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
    lines.push(`§l${TIER_NAME[tier]}§r`, v.pending ? "§6It is being dug out right now." : `§7Down the stairs at ${v.x}, ${v.z}. Use the Vault Key on the lock to open the door.`);
    if (mine && !v.pending) {
      form.button("A spare Vault Key\n§8for you or a trusted ally", "textures/items/vault/vault_key");
      actions.push(() => { giveKey(player, owner); say(player, "§7Here is a spare Vault Key, cut for your vault. Anyone holding it can open the door."); });
    }
  } else if (v?.paid) {
    lines.push("§lA vault, paid for§r", "§7Take the Vault Key to where the stairs should start, on your own land, face the way they should go down, and use the key on the ground.");
    if (mine) {
      form.button("I lost the key\n§8get another", "textures/items/vault/vault_key");
      actions.push(() => giveKey(player, owner));
    }
  } else {
    lines.push("§lNo vault yet§r", "§7A vault keeps your relics behind a locked door underground. Attackers have to break in to take them.", "", "§lCosts:§r");
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
  vaults()[owner] = { paid: true };
  store.save();
  giveKey(player, owner);
  sfx(player, "random.orb");
  say(player, "§6Here is your Vault Key. Walk to where the stairs should start, face the way they should go down into the ground, and use the key on the ground there.");
}

hallMenuExtras.push({ label: "Vault\n§8keep your relics underground", icon: "textures/items/vault/vault_key", action: (player, owner) => vaultMenu(player, owner) });

// ---------- choosing the spot with the key ----------

function placeProblem(owner, v, tier) {
  return siteProblem(owner, groundBox(v, roomOf(tier, v.layout).box));
}

function chooseSpot(player, block) {
  const owner = settlementAt(block.location);
  if (!owner || owner !== player.id) return player.onScreenDisplay.setActionBar("§7Dig your vault on your own settlement's land.");
  const v = vaults()[owner];
  if (!v?.paid || v.built || v.pending) return; // nothing to place (opening the door comes later)
  const f = cardinal(player.getViewDirection());
  const spot = { ...v, x: block.location.x, y: block.location.y + 1, z: block.location.z, fx: f.x, fz: f.z, layout: LAYOUT.wood };
  const problem = placeProblem(owner, spot, "wood");
  if (problem) return say(player, `§7No room for the vault here: ${problem}`);
  new MessageFormData().title("Dig your vault here?")
    .body("The stairs go down from where you stand, the way you are facing, to an entrance hall and the Wooden Strongroom below. Make sure nothing you've built is in the way underground.")
    .button1("Dig it").button2("Not here")
    .show(player).then((r) => {
      if (r.canceled || r.selection !== 0) return;
      const now = vaults()[owner];
      if (!now?.paid || now.built || now.pending) return;
      Object.assign(now, spot);
      start(owner, now, "wood");
      say(player, "§6Your vault is being dug out. Keep the key: it opens the door.");
    }).catch(() => {});
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (event.isFirstEvent === false || !isReady() || itemStack?.typeId !== VAULT_KEY || block.dimension.id !== OVERWORLD) return;
  if (block.typeId.startsWith("siege:vault_")) return; // the lock and door: their own handler
  event.cancel = true;
  system.run(() => chooseSpot(player, block));
});

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
