// What the Codex keeps, and small helpers the other codex files share.
//
// World (moduleStore "siege:codex"): { writs: { region: [playerId] }, braziers: ["x,y,z"], banners: { owner: lastDay } }
// Each player (dynamic property siege:codex_found): JSON { f: [short id], d: { short id: day }, n: [new, unread short ids] }
//   (short id = the item id without "siege:")

import { world, ItemStack, EquipmentSlot, GameMode } from "@minecraft/server";
import { moduleStore, getState } from "../siege/api.js";
import { regionAt } from "../economy/shops.js";

export const store = moduleStore("siege:codex", () => ({ writs: {}, braziers: [], banners: {} }));

const PROP = "siege:codex_found";
const live = new Map();
export function foundOf(player) {
  if (!live.has(player.id)) {
    let v = { f: [], d: {}, n: [] };
    try {
      const raw = player.getDynamicProperty(PROP);
      if (typeof raw === "string") v = { f: [], d: {}, n: [], ...JSON.parse(raw) };
    } catch {
      // a broken record starts again
    }
    live.set(player.id, v);
  }
  return live.get(player.id);
}
export function saveFound(player) {
  try {
    player.setDynamicProperty(PROP, JSON.stringify(foundOf(player)));
  } catch {
    // player gone
  }
}
export const forgetLive = (id) => live.delete(id);
export const short = (id) => String(id).replace(/^siege:/, "");

// The region a player's settlement stands in (their own keep, or the keep they are an ally of)
export function homeRegion(playerId) {
  try {
    const keeps = getState().keeps ?? {};
    const own = keeps[playerId] ? playerId : Object.keys(keeps).find((o) => keeps[o].allies?.includes(playerId));
    return own ? regionAt(keeps[own]) : undefined;
  } catch {
    return undefined;
  }
}

export function grantWrit(region, playerId) {
  const list = (store.data.writs[region] ??= []);
  if (!list.includes(playerId)) list.push(playerId);
  store.save();
}
export function revokeWrit(region, playerId) {
  store.data.writs[region] = (store.data.writs[region] ?? []).filter((id) => id !== playerId);
  store.save();
}

// ---------- small helpers ----------
export const SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Mainhand, EquipmentSlot.Offhand];
export function gearOf(player) {
  const out = {};
  try {
    const eq = player.getComponent("equippable");
    for (const s of SLOTS) out[s] = eq?.getEquipment(s)?.typeId;
  } catch {
    // player gone
  }
  return out;
}
export const mainOf = (p) => gearOf(p)[EquipmentSlot.Mainhand];
export function effect(e, name, ticks, amp = 0) {
  try { e.addEffect(name, ticks, { amplifier: amp, showParticles: false }); } catch { /* gone, or no such effect */ }
}
export function hurt(e, amount, cause, by) {
  try { e.applyDamage(amount, by ? { cause, damagingEntity: by } : { cause }); } catch { /* gone */ }
}
export function heal(e, amount) {
  try {
    const hp = e.getComponent("health");
    hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + amount));
  } catch {
    // gone
  }
}
export function particle(dim, id, loc) {
  try { dim.spawnParticle(id, loc); } catch { /* unloaded */ }
}
export const isCreative = (p) => {
  try { return p.getGameMode() === GameMode.Creative; } catch { return false; }
};
export function give(player, id, amount = 1) {
  let stack;
  try { stack = new ItemStack(id, amount); } catch { return false; }
  try {
    const left = player.getComponent("inventory")?.container?.addItem(stack);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    return false;
  }
  return true;
}
export const valid = (e) => {
  try { return !!e && e.isValid !== false; } catch { return false; }
};
export const players = () => world.getAllPlayers().filter(valid);
export const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// "north-east, 212 blocks" from a to b
export function bearing(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.round(Math.hypot(dx, dz));
  const ang = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return { dist: d, dir: names[(Math.round(((ang + 360) % 360) / 45)) % 8] };
}
