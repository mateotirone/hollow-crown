// The Deep, pure rules: where things are, and the sums. No Minecraft here, so the self-tests run offline.
// The design itself (map/structures/hollow_deep.py) and every spot below are offsets from DEEP.origin.

import { HEART } from "../undertow/layout.js";
import { COMPANIES } from "./data/deep.js";

const VAULT = { x: HEART.center.x, y: HEART.center.y - 18, z: HEART.center.z }; // as hollowfolk/index.js

export const DEEP = {
  // Hung in the void under the Heart (below the Hollow's lowest floor, y 40), centred on the Vault so the whole
  // design (z -6..109) sits within about 60 blocks of a player standing at the Deep Door.
  origin: { x: VAULT.x, y: 26, z: VAULT.z - 52 },
  box: { x0: -17, x1: 17, y0: -8, y1: 11, z0: -6, z1: 109 },
  arrive: { x: 0, y: 0, z: 1 }, // where the Deep Door sets you down, facing south
  bell: { x: 0, y: 0, z: -3 }, // ring it to go back up
  up: { x: VAULT.x, y: VAULT.y, z: VAULT.z + 3 }, // in front of the Deep Door, in the Vault (a world spot)
  arena: { x: 0, y: -6, z: 63 }, // Ulfa's Bell Room: the middle of the floor
  arenaRadius: 14,
  seal: { x0: -2, x1: 2, y0: -6, y1: -2, z: 78 }, // siege:court_seal until Ulfa falls
  note: { x: 0, y: -6, z: 85 }, // the cracked bell-shaped hollow: Everwake's Hollow Note trial (Cloud City thread)
  tierZ0: 93,
  companyX: [-8, -4, 0, 4, 8], // the serjeant stands in the middle (x 0)
  guardsPerCompany: 2, // a company led out lets its leader's keep hold this many more guards
  ashPerRest: 16, // Veil Ash for laying a company to rest
  pointsLed: 2,
  pointsRest: 3,
  ulfaBackAfterDays: 1, // she rings again (a ranked-up rematch) from the day after she falls
};

export const toWorld = (p, o = DEEP.origin) => ({ x: o.x + p.x, y: o.y + p.y, z: o.z + p.z });
export const toLocal = (p, o = DEEP.origin) => ({ x: p.x - o.x, y: p.y - o.y, z: p.z - o.z });

// Is a world location inside the Deep (with a block or two of slack round the shell)?
export function inDeep(loc, o = DEEP.origin) {
  const l = toLocal(loc, o), b = DEEP.box;
  return l.x >= b.x0 - 2 && l.x <= b.x1 + 2 && l.y >= b.y0 - 2 && l.y <= b.y1 + 4 && l.z >= b.z0 - 2 && l.z <= b.z1 + 2;
}

// Is a world location in the Bell Room, on its floor?
export function inBellRoom(loc, o = DEEP.origin) {
  const l = toLocal(loc, o), a = DEEP.arena;
  return Math.hypot(l.x - a.x, l.z - a.z) <= DEEP.arenaRadius + 0.5 && l.y >= a.y - 1 && l.y <= a.y + 8;
}

// Company k (0 = the lowest tier) stands here: five spots, local offsets, the serjeant at index 2.
export const companySpots = (k) => DEEP.companyX.map((x) => ({ x, y: -5 + k, z: DEEP.tierZ0 + 3 * k + 1 }));
export const SERJEANT = 2;
export const companyIndex = (id) => COMPANIES.findIndex((c) => c.id === id);

// The body each of a company's five stands in: the serjeant in the middle, the company's two kinds round them.
export function companyBodies(c) {
  return DEEP.companyX.map((_, i) => (i === SERJEANT ? "siege:grey_serjeant" : c.statues[i % c.statues.length]));
}

// Extra guards a player's keep may hold for the companies they led out
export const guardBonus = (led, playerId) => DEEP.guardsPerCompany * Math.max(0, led?.[playerId] ?? 0);

// Which companies still stand (no fate yet), in tier order
export const standingCompanies = (fates = {}) => COMPANIES.filter((c) => !fates[c.id]);

// May Ulfa be woken now? Never while a fight is on; the first time any time; after she falls, from the next day on.
export function ulfaMayRise({ defeated = 0, fellOnDay = -1, today = 0, fighting = false }) {
  if (fighting) return false;
  if (!defeated) return true;
  return today >= fellOnDay + DEEP.ulfaBackAfterDays;
}
