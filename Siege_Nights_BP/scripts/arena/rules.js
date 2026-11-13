// Pure rules of the arena: who goes in which room, who has won, what a mob fight pays.
// No Minecraft calls here, so tests.js can check all of it in Node.

import { DIFFICULTIES, ARENA_MOBS, REPEAT_PAY } from "./config.js";

// Formats a challenger can pick. teams: 0 = everyone for themselves, else the number of sides.
export const FORMATS = [
  { id: "ffa", name: "One on one, or everyone for themselves", teams: 0 },
  { id: "two", name: "Two teams", teams: 2 },
  { id: "three", name: "Three teams", teams: 3 },
  { id: "four", name: "Four teams", teams: 4 },
];

// Rooms spread evenly round the ring for n sides: 2 sides face each other, 3 make a triangle, and so on.
export function spreadRooms(n, total = 12) {
  const rooms = [];
  for (let i = 0; i < n; i++) rooms.push(Math.round((i * total) / n) % total);
  return rooms;
}

// sides: [[playerId, ...], ...] in the order picked. Returns playerId -> room index.
export function assignRooms(sides, total = 12) {
  const live = sides.filter((s) => s.length);
  const rooms = spreadRooms(live.length, total);
  const out = {};
  live.forEach((side, i) => { for (const id of side) out[id] = rooms[i]; });
  return out;
}

// fighters: { id: { side, out } } where out = defeated or gone. The sides still standing.
export function sidesStanding(fighters) {
  const s = new Set();
  for (const f of Object.values(fighters)) if (!f.out) s.add(f.side);
  return [...s];
}

// What the fight's state says should happen now. kind "pvp" | "mob"; mobsLeft only for mob fights.
//   "on"     keep fighting
//   "won"    pvp: one side left (winner = that side); mob: every mob down while someone still stands
//   "lost"   mob: every fighter down
//   "draw"   pvp: nobody left standing (they fell together), or time ran out
export function verdict({ kind, fighters, mobsLeft = 0, timeUp = false }) {
  const standing = sidesStanding(fighters);
  if (kind === "mob") {
    if (!standing.length) return { result: "lost" };
    if (mobsLeft <= 0) return { result: "won" };
    return timeUp ? { result: "lost", timeUp: true } : { result: "on" };
  }
  if (standing.length === 1) return { result: "won", winner: standing[0] };
  if (!standing.length) return { result: "draw" };
  return timeUp ? { result: "draw", timeUp: true } : { result: "on" };
}

// Regals for beating `mobType` at `difficultyId`, given how many times this player already beat that pair today.
export function mobReward(mobType, difficultyId, winsToday = 0) {
  const mob = ARENA_MOBS.find((m) => m.type === mobType);
  const diff = DIFFICULTIES.find((d) => d.id === difficultyId);
  if (!mob || !diff) return 0;
  const repeat = REPEAT_PAY[Math.min(winsToday, REPEAT_PAY.length - 1)];
  return Math.max(1, Math.round(mob.base * diff.pay * repeat));
}

// Where each saved item goes back to: inventory slots 0-35, then the four armour slots and the off hand.
export const LOCKER_SLOTS = { inventory: 36, armor: ["Head", "Chest", "Legs", "Feet"], offhand: 40 };
export const armorLockerSlot = (slot) => 36 + LOCKER_SLOTS.armor.indexOf(slot);

// Is `at` inside the box from..to (inclusive, any corner order)?
export function inBox(at, from, to, pad = 0) {
  const lo = (a, b) => Math.min(a, b) - pad, hi = (a, b) => Math.max(a, b) + pad;
  return at.x >= lo(from.x, to.x) && at.x <= hi(from.x, to.x) + 1
    && at.y >= lo(from.y, to.y) - 1 && at.y <= hi(from.y, to.y) + 1
    && at.z >= lo(from.z, to.z) && at.z <= hi(from.z, to.z) + 1;
}

export const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Has a fighter left the fight? Too far from the floor's centre (and not in their own room), or far above/below.
export function hasLeft(at, arena, room, margin) {
  if (Math.abs(at.y - arena.center.y) > 24) return true;
  if (flat(at, arena.center) <= arena.floorRadius + margin) return false;
  return !(room && flat(at, room.spawn) <= 8);
}

// A day number (Minecraft days) for "same day" counting.
export const dayOf = (absoluteTicks) => Math.floor(absoluteTicks / 24000);

// The gate's cells, bottom row first, so lifting clears from the bottom up and dropping fills from the top down.
export function gateRows(gate) {
  const rows = [];
  const [x0, x1] = [Math.min(gate.from.x, gate.to.x), Math.max(gate.from.x, gate.to.x)];
  const [y0, y1] = [Math.min(gate.from.y, gate.to.y), Math.max(gate.from.y, gate.to.y)];
  const [z0, z1] = [Math.min(gate.from.z, gate.to.z), Math.max(gate.from.z, gate.to.z)];
  for (let y = y0; y <= y1; y++) {
    const row = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) row.push({ x, y, z });
    rows.push(row);
  }
  return rows;
}
