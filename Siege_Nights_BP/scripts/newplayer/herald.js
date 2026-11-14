// Act 2, step 8: the herald (story pass, Mateo 2026-11-14; plan doc "Act 2, step by step"). The morning after the
// second win (once the family's chest is home) a Rival Lord's herald rides up the road to your gate on his lord's
// region's horse under a caparison of the lord's colours, in his lord's region's tabard (core/npc_skins_data.js
// herald_<region>). The gate lookout calls him. Click him: he asks tribute (rivals/court.js heraldDemand). Pay, and
// the lord leaves you be; refuse, and the lord's soldiers ride with the next siege night (a march). Then he rides
// back the way he came.
//
// Per settlement (owner), saved: { state: "due" | "riding" | "here" | "leaving" | "done", due, lord, road, t, caller }.
//   heraldOf(owner) -> { state, at: { x, z }, caller } | undefined
//   heraldDue(owner, now)   the next fitting morning, he sets off
//   startHerald(owner)      he sets off now (the test command); true if he did
// newplayer/act2.js decides when he is due and sets the flag when he has his answer ("heraldAnswered").
// Test: /scriptevent siege:act2 herald

import { world, system } from "@minecraft/server";
import { MessageFormData } from "@minecraft/server-ui";
import { onTick, moduleStore, keepOf, emit, addTests, assert, assertEqual } from "../siege/api.js";
import { on } from "../core/events.js";
import { wallRing } from "../settle/walls.js";
import { gateGuard } from "../guardposts/index.js";
import { rivalLords, rivalById, lordFullName } from "../rivals/index.js";
import { pactOf, heraldDemand, heraldAnswer } from "../rivals/court.js";
import { coins } from "../economy/api.js";
import { dressNpc } from "../core/npc_skins.js";
import { sfx } from "../core/sfx.js";
import { DYE_RGB } from "../siege/constants.js";
import { roadFrom, roadPoint, yawToward, groundY, playersNear } from "./family.js";
import { HERALD, fillHerald, CART_ROAD, cartDue } from "./act2_rules.js";

const OVERWORLD = "minecraft:overworld";
const store = moduleStore("hc:act2_herald", () => ({ v: 1, by: {} }));
const save = () => store.save();
export const HERALD_TAG = "hc_herald";
const ownTag = (owner) => `hc_herald_${owner}`;
const RIDE = { from: CART_ROAD.from + 6, to: CART_ROAD.to + 1, speed: 0.16 }; // a rider, quicker than the cart
// The lord's region: the herald's tabard, his horse's breed (horses/data.js BREEDS prop) and caparison colour
export const LORD_LOOK = {
  "Aldmere Vale": { skin: "herald_vale", breed: 1, cap: "green" },
  Frostmarch: { skin: "herald_frostmarch", breed: 2, cap: "blue" },
  Saltreach: { skin: "herald_saltreach", breed: 3, cap: "cyan" },
  Emberwaste: { skin: "herald_emberwaste", breed: 4, cap: "red" },
  Blackfen: { skin: "herald_blackfen", breed: 5, cap: "purple" },
};

export function heraldOf(owner) {
  const r = store.data.by[owner];
  if (!r) return undefined;
  const at = r.road ? roadPoint(r.road, r.t ?? RIDE.from) : undefined;
  return { state: r.state, at: at ? { x: at.x, z: at.z } : undefined, caller: r.caller, lord: r.lord };
}
export function heraldDue(owner, now) {
  if (store.data.by[owner]) return false;
  store.data.by[owner] = { state: "due", due: now };
  save();
  return true;
}

// Which lord sends him: the nearest one not sworn to you, or undefined (no lords on the map)
export function pickLord(lords, at, playerId, pact = () => undefined) {
  return lords.filter((l) => !pact(l, playerId)).map((l) => [Math.hypot(l.x - at.x, l.z - at.z), l]).sort((a, b) => a[0] - b[0])[0]?.[1];
}

// ---------- riding ----------

const dimension = () => world.getDimension(OVERWORLD);
function partsOf(owner) {
  const out = {};
  try {
    for (const e of dimension().getEntities({ tags: [ownTag(owner)] })) {
      const role = e.typeId === "minecraft:npc" ? "herald" : "horse";
      if (!out[role]) out[role] = e; else try { e.remove(); } catch { /* gone */ }
    }
  } catch { /* not loaded */ }
  return out;
}
function spawnParts(owner, r, loc) {
  const dim = dimension();
  const look = LORD_LOOK[rivalById(r.lord)?.region] ?? LORD_LOOK["Aldmere Vale"];
  const horse = dim.spawnEntity("siege:steed", loc);
  horse.addTag(ownTag(owner));
  try {
    horse.setProperty("siege:breed", look.breed);
    horse.setProperty("siege:cap", true);
    const [cr, cg, cb] = DYE_RGB[look.cap] ?? [255, 255, 255];
    horse.setProperty("siege:cap_r", cr / 255); horse.setProperty("siege:cap_g", cg / 255); horse.setProperty("siege:cap_b", cb / 255);
  } catch { /* an older steed without the property */ }
  try { horse.addEffect("resistance", 20000000, { amplifier: 255, showParticles: false }); horse.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false }); } catch { /* fine */ }
  const herald = dim.spawnEntity("minecraft:npc", { x: loc.x, y: loc.y + 0.9, z: loc.z });
  herald.addTag(ownTag(owner));
  herald.addTag(HERALD_TAG);
  herald.nameTag = "Herald";
  dressNpc(herald, look.skin, "Herald");
  try { horse.getComponent("minecraft:rideable")?.addRider(herald); } catch { /* he walks beside it, then */ }
  return { horse, herald };
}
function riderAt(parts, spot, yaw) {
  try { parts.horse?.teleport(spot, { rotation: { x: 0, y: yaw } }); } catch { /* not loaded */ }
  // a rider follows his horse; if he could not mount, he is kept at its side
  try {
    const on = parts.herald?.getComponent("minecraft:riding")?.entityRidingOn;
    if (parts.herald && !on) parts.herald.teleport({ x: spot.x + 0.9, y: spot.y, z: spot.z }, { rotation: { x: 0, y: yaw } });
  } catch { /* not loaded */ }
}

export function startHerald(owner) {
  const ring = wallRing(owner);
  const keep = keepOf(owner);
  if (!ring?.gate || !keep) return false;
  const lord = pickLord(rivalLords(), keep, owner, pactOf);
  const r = store.data.by[owner] = { ...(store.data.by[owner] ?? {}) };
  if (!lord) { r.state = "done"; r.none = true; save(); emit("heraldAnswered", { owner, answer: "none" }); return true; }
  Object.assign(r, { state: "riding", lord: lord.id, road: roadFrom(ring.gate), t: RIDE.from });
  const guard = gateGuard(owner);
  r.caller = guard?.name;
  save();
  const line = guard ? `§e<${guard.name}, at the gate lookout>§f ${HERALD.call}` : `§7A shout from the wall:§f ${HERALD.call}`;
  for (const p of playersNear(r.road, 160)) p.sendMessage(line);
  try { sfx(world.getPlayers().find((p) => p.id === owner), "mob.horse.idle", { volume: 0.8, pitch: 1 }); } catch { /* cosmetic */ }
  return true;
}

function ride(owner, r) {
  const dim = dimension();
  const out = r.state === "leaving";
  const t = out ? r.t + RIDE.speed : Math.max(RIDE.to, r.t - RIDE.speed);
  const at = roadPoint(r.road, t);
  const y = groundY(dim, at.x, at.z, r.road.y);
  if (y === undefined) { if (out) finish(owner, r); return; } // off into ground nobody has loaded: he is gone
  let parts = partsOf(owner);
  if (!parts.horse) parts = spawnParts(owner, r, { x: at.x, y, z: at.z });
  riderAt(parts, { x: at.x, y, z: at.z }, out ? yawToward(r.road.dx, r.road.dz) : r.road.yaw);
  r.t = t;
  if (!out && t <= RIDE.to) { r.state = "here"; save(); }
  if (out && t >= RIDE.from) finish(owner, r);
}
function finish(owner, r) {
  for (const e of Object.values(partsOf(owner))) try { e.remove(); } catch { /* gone */ }
  r.state = "done";
  save();
}

// ---------- his errand ----------

function answer(player, owner, r) {
  const lord = rivalById(r.lord);
  if (!lord) { r.state = "leaving"; save(); emit("heraldAnswered", { owner, player, answer: "none" }); return; }
  if (!lord.demands?.[player.id]) heraldDemand(lord, player);
  const amount = lord.demands[player.id].coins;
  const w = { lord: lordFullName(lord), plot: lord.plot, coins: coins(amount) };
  new MessageFormData().title(HERALD.title).body(fillHerald(HERALD.speech, w))
    .button1(fillHerald(HERALD.pay, w)).button2(HERALD.refuse)
    .show(player).then((res) => {
      if (res.canceled) return;
      const out = heraldAnswer(player, lord, res.selection === 0);
      if (out === "short") return player.sendMessage(`§fHerald: §7${HERALD.short}`);
      if (!out) return;
      player.sendMessage(`§fHerald: §7${out === "paid" ? HERALD.paid : HERALD.refused}`);
      r.state = "leaving";
      save();
      emit("heraldAnswered", { owner, player, answer: out, lord });
    }).catch(() => { /* closed */ });
}
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== "minecraft:npc" || !target.hasTag(HERALD_TAG)) return;
  if (player.isSneaking && player.getGameMode() === "Creative") return;
  event.cancel = true;
  const owner = Object.keys(store.data.by).find((o) => target.hasTag(ownTag(o)));
  const r = owner && store.data.by[owner];
  if (!r || (r.state !== "here" && r.state !== "riding")) return;
  system.run(() => { try { answer(player, owner, r); } catch (e) { console.warn(`[Act 2] herald: ${e}`); } });
});
// Answered at the lord's own court instead: his errand is done, and he rides home
on("rivalTribute", ({ lord, player }) => {
  for (const [owner, r] of Object.entries(store.data.by)) {
    if (r.lord !== lord?.id || owner !== player?.id || (r.state !== "here" && r.state !== "riding")) continue;
    r.state = "leaving";
    save();
    emit("heraldAnswered", { owner, player, answer: "court", lord });
  }
});

onTick("act2_herald", 1, () => {
  for (const [owner, r] of Object.entries(store.data.by)) {
    if (r.state !== "riding" && r.state !== "leaving") continue;
    try { ride(owner, r); } catch (e) { console.warn(`[Act 2] herald ride: ${e}`); }
  }
});
onTick("act2_herald_due", 40, () => {
  const now = world.getAbsoluteTime(), time = world.getTimeOfDay();
  for (const [owner, r] of Object.entries(store.data.by)) {
    try {
      if (r.state === "due") {
        const ring = wallRing(owner);
        if (cartDue(r.due, now, time) && ring?.gate && playersNear(ring.gate, 96).some((p) => p.id === owner)) startHerald(owner);
      } else if (r.state === "here") {
        // waiting at the gate: if he has gone missing (unloaded and cleared), stand him there again
        const parts = partsOf(owner);
        const at = roadPoint(r.road, r.t);
        if (!parts.horse && playersNear(at, 48).length) {
          const y = groundY(dimension(), at.x, at.z, r.road.y);
          if (y !== undefined) riderAt(spawnParts(owner, r, { x: at.x, y, z: at.z }), { x: at.x, y, z: at.z }, r.road.yaw);
        }
      }
    } catch (e) { console.warn(`[Act 2] herald: ${e}`); }
  }
});

addTests("act2_herald", {
  "Act 2: the herald comes from the nearest lord not sworn to you, in that lord's colours": () => {
    const lords = [{ id: "a", x: 500, z: 0, region: "Frostmarch" }, { id: "b", x: 100, z: 0, region: "Saltreach" }];
    assertEqual(pickLord(lords, { x: 0, z: 0 }, "p").id, "b");
    assertEqual(pickLord(lords, { x: 0, z: 0 }, "p", (l) => (l.id === "b" ? "truce" : undefined)).id, "a", "a sworn lord sends no herald");
    assertEqual(pickLord([], { x: 0, z: 0 }, "p"), undefined);
    for (const look of Object.values(LORD_LOOK)) assert(DYE_RGB[look.cap] && look.skin.startsWith("herald_"), `${look.skin} has a colour`);
    const w = { lord: "Ser Bram Holt", plot: "Westmarch", coins: "64 Regals" };
    const text = fillHerald(HERALD.speech, w);
    assert(text.includes("Ser Bram Holt") && text.includes("64 Regals") && !text.includes("{"), "the speech names the lord and the tribute");
    assert(!/hollow|truce with|oswin|edda|morvane/i.test(Object.values(HERALD).join(" ")), "the herald names nothing Act 2 keeps back");
  },
});
