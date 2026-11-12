// The Strongroom vault (Mateo, 2026-11-12). The town hall board's "Vault" button: pay, get the Vault Key, then use
// the key on the ground where the stairs should start, facing the way they go down. The staircase is carved, the
// entrance hall and the Wooden Strongroom are built underground, the Vault Lock sits in the wall beside the 3x3
// door. Rooms: rooms_data.js (map/structures/export_vaults.py). Numbers: data.js.
//
// The key on the lock swings the 3x3 door open the way gates swing (siege/gates.js planSwing), and shut again.
// Keys are cut for one vault: owner and allies open with any key, anyone else only with a key cut for it.
//
// Relics: holding one, click a plinth in your vault and it floats there on its stand; click the stand to take it.
//
// Still to come: reinforcing to the next tier, Vault Breakers on
// the lock, repair, and the offline open windows.
//
// What other features can use:
//   vaultOf(ownerId)  -> { x, y, z, fx, fz, tier, layout, built, lock: {x,y,z} } or undefined
//   on("vaultBuilt", ({ owner, tier, lock }))
//   on("relicTaken", ({ owner, by, kind }))   someone outside the settlement took a relic off a vault stand
//   on("vaultOpened", ({ owner, by }))   someone outside the settlement opened it with a key cut for it
//
// Test: /scriptevent siege:vault_build [tier] [layout]   raise one where you stand, facing the way you look (creative)

import { world, system, GameMode, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { isReady, settlementAt, onTick, moduleStore, emit, isAlly, keepOf, addMenuLabel } from "../siege/api.js";
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

// ---------- relic stands ----------
// Holding a relic, click a plinth in your vault: the relic comes to rest floating over it, the way a dropped
// Crown rests on its stand (the Crown uses that very stand, undertow/crownkeep.js, which also takes it back).
// Click a Heart or template stand to take the relic. A template on a stand counts as seen for the Cold Forge.

const RELICS = {
  crown: { item: "siege:hollow_crown", stand: "siege:crown_stand", name: "the Hollow Crown" },
  heart: { item: "siege:heart_of_the_hollow", stand: "siege:heart_stand", name: "the Heart" },
  template: { item: "siege:choirsteel_upgrade_template", stand: "siege:template_stand", name: "the Choirsteel template" },
};
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
