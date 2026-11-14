// Act 2, step 6: the family at the gate (story pass, Mateo 2026-11-14; plan doc "Act 2, step by step").
// The morning after a siege a cart comes up the road to your gate: Tobin walking at the mule's head, Marta beside the
// load, the boy asleep on the sacks. The guard up the gate lookout calls it ("Cart on the road! Families, by the
// look."). Tobin tells you the Order's riders blamed raiders, but the doors were barred from outside and nothing was
// taken. "There's room in the Longhouse": the two of them move in by the hearth, and the cart is parked by the
// Longhouse door for good.
//
// Per settlement (owner), saved: { due, state: "due" | "rolling" | "here" | "housed", road, t, caller, spots }.
// newplayer/act2.js decides when the cart is due (the story) and asks for the scene; this file moves the cart.
//
//   familyOf(owner) -> { state, cart: { x, z }, caller, housedAt, tobin: { x, z } } | undefined
//   familyDue(owner, now)        the next fitting morning, the cart sets off
//   startCart(owner)             it sets off now (the test command); true if it did
//   houseFamily(owner)           Tobin and Marta into the Longhouse, the cart to its door
// Test: /scriptevent siege:act2 family

import { world, system } from "@minecraft/server";
import { onTick, moduleStore, addTests, assert, assertEqual } from "../siege/api.js";
import { wallRing } from "../settle/walls.js";
import { gateGuard } from "../guardposts/index.js";
import { hallOf } from "../townhall/townhall.js";
import { elspethSpot } from "../lore/places.js";
import { spawnNpc } from "../lore/npcs.js";
import { CART_CALL, CART_ROAD, FAMILY_TAGS, cartDue } from "./act2_rules.js";

const OVERWORLD = "minecraft:overworld";
const CART = "siege:family_cart";
const store = moduleStore("hc:family_cart", () => ({ v: 1, by: {} }));
const save = () => store.save();
const ownTag = (owner) => `hc_family_${owner}`;
const ROLES = { cart: CART, mule: "minecraft:mule", tobin: "minecraft:npc", marta: "minecraft:npc" };
const roleTag = (role) => `hc_family_${role}`;

export function familyOf(owner) {
  const r = store.data.by[owner];
  if (!r) return undefined;
  const at = r.spots?.cart ?? (r.road ? roadPoint(r.road, r.t ?? CART_ROAD.from) : undefined);
  const t = r.spots?.tobin;
  return { state: r.state, cart: at ? { x: at.x, z: at.z } : undefined, caller: r.caller, housedAt: r.housedAt, tobin: t ? { x: t.x, z: t.z } : undefined };
}

export function familyDue(owner, now) {
  const r = store.data.by[owner];
  if (r && r.state !== "due") return false;
  store.data.by[owner] = { state: "due", due: now };
  save();
  return true;
}

// ---------- the road (pure) ----------

// Straight out of the gate: gate { x, y, z, outside }, the unit vector out, and the yaw that faces the gate
export function roadFrom(gate) {
  let dx = gate.outside.x - gate.x, dz = gate.outside.z - gate.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d; dz /= d;
  return { x: gate.x + 0.5, y: gate.y, z: gate.z + 0.5, dx, dz, yaw: yawToward(-dx, -dz) };
}
export const yawToward = (dx, dz) => (Math.atan2(-dx, dz) * 180) / Math.PI; // Bedrock yaw: 0 faces +z
export const roadPoint = (road, t) => ({ x: road.x + road.dx * t, z: road.z + road.dz * t });
// Where each of them walks while the cart rolls, t blocks out: the mule ahead, Tobin at its head, Marta by the load
export function procession(road, t) {
  const side = { x: -road.dz, z: road.dx }; // to the cart's left as it faces the gate
  const at = (ahead, across) => ({ x: road.x + road.dx * (t - ahead) + side.x * across, z: road.z + road.dz * (t - ahead) + side.z * across });
  return { cart: at(0, 0), mule: at(2.4, 0), tobin: at(2.6, 1.2), marta: at(0.2, -1.4) };
}

// ---------- ground and spawning ----------

const dimension = () => world.getDimension(OVERWORLD);
const passable = (b) => !!b && (b.isAir || /snow_layer|short_grass|tall_grass|fern|flower|carpet|torch|lantern/.test(b.typeId));
// The y to stand at over (x, z), searching from `near` up and down; undefined when not loaded
function groundY(dim, x, z, near) {
  const bx = Math.floor(x), bz = Math.floor(z);
  for (let dy = 6; dy >= -10; dy--) {
    const y = Math.floor(near) + dy;
    let below, here, above;
    try { below = dim.getBlock({ x: bx, y: y - 1, z: bz }); here = dim.getBlock({ x: bx, y, z: bz }); above = dim.getBlock({ x: bx, y: y + 1, z: bz }); } catch { return undefined; }
    if (!below || !here || !above) return undefined;
    if (!passable(below) && !below.isLiquid && passable(here) && passable(above)) return y;
  }
  return Math.floor(near);
}

function entitiesOf(owner) {
  const out = {};
  try {
    for (const e of dimension().getEntities({ tags: [ownTag(owner)] })) {
      const role = Object.keys(ROLES).find((r) => e.hasTag(roleTag(r)));
      if (role && !out[role]) out[role] = e;
      else if (role) try { e.remove(); } catch { /* gone */ } // never two of anyone
    }
  } catch { /* not loaded */ }
  return out;
}

function spawnRole(owner, role, loc, yaw) {
  const dim = dimension();
  let e;
  if (role === "tobin" || role === "marta") {
    e = spawnNpc(dim, loc, role);
  } else {
    e = dim.spawnEntity(ROLES[role], loc);
    if (role === "mule") {
      try { e.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false }); } catch { /* fine */ }
    }
  }
  e.addTag(ownTag(owner));
  e.addTag(roleTag(role));
  try { e.setRotation({ x: 0, y: yaw }); } catch { /* fine */ }
  return e;
}

function place(owner, role, e, spot, yaw) {
  const loc = { x: spot.x, y: spot.y, z: spot.z };
  if (!e?.isValid) return spawnRole(owner, role, loc, yaw);
  try { e.teleport(loc, { rotation: { x: 0, y: yaw } }); } catch { /* not loaded */ }
  return e;
}

// ---------- the cart sets off ----------

const playersNear = (at, r) => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - at.x, p.location.z - at.z) <= r);

export function startCart(owner) {
  const ring = wallRing(owner);
  if (!ring?.gate) return false;
  const road = roadFrom(ring.gate);
  const r = store.data.by[owner] = { ...(store.data.by[owner] ?? {}), state: "rolling", road, t: CART_ROAD.from };
  delete r.spots;
  const guard = gateGuard(owner);
  r.caller = guard?.name;
  save();
  const line = guard ? `§e<${guard.name}, at the gate lookout>§f ${CART_CALL}` : `§7A shout from the wall:§f ${CART_CALL}`;
  for (const p of playersNear(road, 160)) p.sendMessage(line);
  if (guard) try { guard.entity.setRotation({ x: 0, y: yawToward(road.dx, road.dz) }); } catch { /* fine */ }
  return true;
}

function roll(owner, r) {
  const dim = dimension();
  const ents = entitiesOf(owner);
  const t = Math.max(CART_ROAD.to, r.t - CART_ROAD.speed);
  const where = procession(r.road, t);
  const y = groundY(dim, where.cart.x, where.cart.z, r.road.y);
  if (y === undefined) return; // the road is not loaded: the cart waits where it is
  for (const role of Object.keys(ROLES)) {
    const at = where[role];
    const gy = groundY(dim, at.x, at.z, y) ?? y;
    ents[role] = place(owner, role, ents[role], { x: at.x, y: gy, z: at.z }, r.road.yaw);
  }
  r.t = t;
  const arrived = t <= CART_ROAD.to;
  try { ents.cart?.setProperty("siege:rolling", !arrived); } catch { /* fine */ }
  if (arrived) {
    r.state = "here";
    r.spots = Object.fromEntries(Object.keys(ROLES).map((role) => [role, { ...where[role], y: groundY(dim, where[role].x, where[role].z, y) ?? y }]));
    save();
  }
}

// ---------- the Longhouse ----------

const LONGHOUSE = { family: [[3, 0], [-3, 0], [0, 3], [0, -3], [3, 2], [-3, 2]], cartOut: 4, cartSide: 4 };
export function houseFamily(owner) {
  const r = store.data.by[owner];
  const hall = hallOf(owner);
  if (!r || !hall?.marks?.hearth) return false;
  const dim = dimension();
  const h = hall.marks.hearth, seat = elspethSpot(owner) ?? h;
  const free = LONGHOUSE.family.map(([dx, dz]) => ({ x: h.x + dx + 0.5, z: h.z + dz + 0.5 })).filter((s) => Math.hypot(s.x - seat.x - 0.5, s.z - seat.z - 0.5) > 1.6);
  const face = (s) => yawToward(h.x + 0.5 - s.x, h.z + 0.5 - s.z);
  const spots = {};
  ["tobin", "marta"].forEach((role, i) => {
    const s = free[i] ?? { x: h.x + 0.5, z: h.z + 0.5 };
    const y = groundY(dim, s.x, s.z, h.y + 1);
    spots[role] = { x: s.x, y: y ?? h.y + 1, z: s.z, yaw: face(s) };
  });
  // the cart: out of the door, a little to one side
  const door = hall.marks.door ?? { x: hall.x, y: hall.y, z: hall.z };
  let ox = door.x - hall.x, oz = door.z - hall.z;
  const d = Math.hypot(ox, oz) || 1;
  ox /= d; oz /= d;
  const c = { x: door.x + 0.5 + ox * LONGHOUSE.cartOut - oz * LONGHOUSE.cartSide, z: door.z + 0.5 + oz * LONGHOUSE.cartOut + ox * LONGHOUSE.cartSide };
  const cy = groundY(dim, c.x, c.z, door.y);
  const along = yawToward(-oz, ox); // parked along the Longhouse wall
  spots.cart = { ...c, y: cy ?? door.y, yaw: along };
  const fwd = { x: -Math.sin((along * Math.PI) / 180), z: Math.cos((along * Math.PI) / 180) }; // the way the shafts point
  const m = { x: c.x + fwd.x * 2.4, z: c.z + fwd.z * 2.4 };
  spots.mule = { ...m, y: groundY(dim, m.x, m.z, door.y) ?? door.y, yaw: along };
  r.state = "housed";
  r.housedAt = world.getAbsoluteTime();
  r.spots = spots;
  save();
  keep(owner, r, true);
  return true;
}

// ---------- keeping them where they belong ----------

// Anyone missing is stood back at their spot; anyone wandered off (the mule) is brought back
function keep(owner, r, force = false) {
  if (!r.spots) return;
  const ents = entitiesOf(owner);
  for (const role of Object.keys(ROLES)) {
    const s = r.spots[role];
    if (!s) continue;
    const e = ents[role];
    const yaw = s.yaw ?? r.road?.yaw ?? 0;
    if (e?.isValid && !force) {
      const l = e.location;
      if (Math.hypot(l.x - s.x, l.z - s.z) > (role === "mule" ? 3 : 1.5)) try { e.teleport(s, { rotation: { x: 0, y: yaw } }); } catch { /* not loaded */ }
      continue;
    }
    try { place(owner, role, e, s, yaw); } catch { /* not loaded */ }
  }
  try { ents.cart?.setProperty("siege:rolling", false); } catch { /* fine */ }
}

onTick("family_cart", 1, () => {
  for (const [owner, r] of Object.entries(store.data.by)) {
    if (r.state !== "rolling") continue;
    try { roll(owner, r); } catch (e) { console.warn(`[Act 2] family cart: ${e}`); }
  }
});

// Each settlement's cart, if it is due and the morning has come, and the family wherever they are standing
onTick("family_keep", 40, () => {
  const now = world.getAbsoluteTime(), time = world.getTimeOfDay();
  for (const [owner, r] of Object.entries(store.data.by)) {
    try {
      if (r.state === "due") {
        const ring = wallRing(owner);
        if (cartDue(r.due, now, time) && ring?.gate && playersNear(ring.gate, 96).some((p) => p.id === owner)) startCart(owner);
        continue;
      }
      if (r.state === "here" || r.state === "housed") {
        const at = r.spots?.cart;
        if (at && playersNear(at, 48).length) keep(owner, r);
      }
    } catch (e) { console.warn(`[Act 2] family: ${e}`); }
  }
});

addTests("family", {
  "Act 2: the family's cart comes up the road to the gate, mule first": () => {
    const road = roadFrom({ x: 10, y: 64, z: 10, outside: { x: 10, y: 64, z: 19 } }); // gate looks +z
    assertEqual(road.dz, 1);
    const p = procession(road, 20);
    assert(p.mule.z < p.cart.z, "the mule walks ahead of the cart, toward the gate");
    assert(Math.abs(p.tobin.x - p.marta.x) > 2, "Tobin and Marta walk on either side");
    const yaw = road.yaw;
    assert(Math.abs(Math.abs(yaw) - 180) < 1e-6, "the cart faces back toward the gate (-z)");
    assert(CART_ROAD.from > CART_ROAD.to && CART_ROAD.to >= 5, "it stops outside the gate, clear of the gateway");
    assertEqual(Object.keys(FAMILY_TAGS).sort(), ["marta", "tobin"]);
  },
});
