// Settlers: the people who move into a settlement. Every settler needs a bed in a home (register.js counts
// them at dawn). At dawn, if a home has a free bed, one newcomer arrives: a finished work building's worker
// first (Smith, Groom, Trader, ...), then plain settlers for the homes. By day they stand by their work or
// their door; at dusk they go to bed. A worker whose building is knocked down stays, idle, until it's back.
// A settler whose bed is gone moves to another free bed, or leaves if there is still none a dawn later.
// Settlers are Bedrock's built-in NPC (minecraft:npc), so they work on a Realm.
//
//   settlersOf(owner) -> [{ n, name, role, home, work, bed, idle }]
//   on("settlerArrived", ({ owner, name, role }))
// Test: /scriptevent siege:settlers [list | dawn | dusk]   (dawn runs the bed count and an arrival now)

import { world, system, GameMode } from "@minecraft/server";
import { isReady, isNight, onTick, on, emit, moduleStore, keepOf } from "../siege/api.js";
import { SETTLERS, SETTLER_LINES, HOMES } from "./config.js";
import { townOf, layoutOf, saveTowns } from "./founding.js";
import { slotsOf, townFor } from "./towns.js";
import { countNow } from "./register.js";

const NPC_TYPE = "minecraft:npc";
const OVERWORLD = "minecraft:overworld";
export const SETTLER_TAG = "siege_settler";
const tagOf = (n) => `siege_settler_${n}`;
const counter = moduleStore("siege:settle_settlers", () => ({ next: 1 }));

export function settlersOf(owner) {
  const town = townOf(owner);
  return town ? (town.settlers ??= []) : [];
}
const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;

// ---------- who has room ----------

// Beds in homes nobody has claimed yet: [{ home, bed }]
export function freeBeds(owner) {
  const town = townOf(owner);
  const taken = settlersOf(owner).map((s) => s.bed);
  const out = [];
  for (const [id, st] of Object.entries(town?.slots ?? {})) {
    if (!HOMES.includes(st.building) || st.done === false || st.broken) continue;
    // the founder's own bed (basebuilds.js) is never given to a settler
    for (const bed of st.bedSpots ?? []) if (!taken.some((t) => same(t, bed)) && !(st.ownerBed && same(st.ownerBed, bed))) out.push({ home: id, bed });
  }
  return out;
}

// Finished work buildings with no worker yet: [slotId]
export function jobsOpen(owner) {
  const town = townOf(owner);
  const filled = new Set(settlersOf(owner).map((s) => s.work).filter(Boolean));
  return Object.entries(town?.slots ?? {})
    .filter(([id, st]) => SETTLERS.workers[st.building] && st.done !== false && !st.broken && !filled.has(id))
    .map(([id]) => id);
}

// Who comes next, or undefined: { role, work?, home, bed }
export function nextArrival(owner) {
  const beds = freeBeds(owner);
  if (!beds.length) return undefined;
  const town = townOf(owner);
  const job = jobsOpen(owner)[0];
  if (job) return { role: SETTLERS.workers[town.slots[job].building], work: job, ...beds[0] };
  return { role: "Settler", ...beds[0] };
}

// ---------- places ----------

function doorOf(owner, slotId) {
  const town = townOf(owner);
  const s = slotsOf(layoutOf(town)).find((x) => x.id === slotId);
  if (!s) return undefined;
  const x = town.x + s.step.x, z = town.z + s.step.z;
  let y = town.y + s.dy + 1;
  try {
    const top = world.getDimension(OVERWORLD).getTopmostBlock({ x, z });
    if (top && Math.abs(top.location.y + 1 - y) <= 6) y = top.location.y + 1;
  } catch { /* not loaded */ }
  return { x: x + 0.5, y, z: z + 0.5 };
}
const dayPlace = (owner, s) => doorOf(owner, s.work && !s.idle ? s.work : s.home);
const bedPlace = (s) => (s.bed ? { x: s.bed.x + 0.5, y: s.bed.y + 0.6, z: s.bed.z + 0.5 } : undefined);

const entityOf = (dim, s) => dim.getEntities({ type: NPC_TYPE, tags: [tagOf(s.n)] });

function dress(e, s) {
  try {
    if (!e?.isValid) return;
    const label = `${s.name}${s.role !== "Settler" ? `, ${s.role}` : ""}${s.idle ? " (idle)" : ""}`;
    if (e.nameTag !== label) e.nameTag = label;
    const npc = e.getComponent("minecraft:npc");
    if (npc && npc.skinIndex !== s.skin) npc.skinIndex = s.skin;
    if (npc && npc.name !== label) npc.name = label;
  } catch (err) {
    console.warn(`[Hollow Crown] settler looks: ${err}`);
  }
}

function spawn(owner, s, at) {
  if (!at) return undefined;
  const dim = world.getDimension(OVERWORLD);
  try {
    const e = dim.spawnEntity(NPC_TYPE, at);
    e.addTag(SETTLER_TAG);
    e.addTag(tagOf(s.n));
    e.addTag(`siege_settler_of_${owner}`);
    dress(e, s);
    system.runTimeout(() => dress(e, s), 10);
    return e;
  } catch {
    return undefined; // not loaded
  }
}

function moveAll(owner, night) {
  const dim = world.getDimension(OVERWORLD);
  for (const s of settlersOf(owner)) {
    const to = night ? bedPlace(s) : dayPlace(owner, s);
    if (!to) continue;
    for (const e of entityOf(dim, s)) try { e.teleport(to); dress(e, s); } catch { /* not loaded */ }
  }
}

// ---------- dawn: settle up, then one arrives ----------

function dawn(owner) {
  const town = townOf(owner);
  if (!town) return;
  const dim = world.getDimension(OVERWORLD);
  const list = settlersOf(owner);
  // beds that are gone: move to another, or leave
  for (const s of [...list]) {
    const st = town.slots[s.home];
    const still = st && HOMES.includes(st.building) && !st.broken && (st.bedSpots ?? []).some((b) => same(b, s.bed));
    if (still) { delete s.homeless; continue; }
    const spare = freeBeds(owner).find((b) => !list.some((o) => o !== s && same(o.bed, b.bed)));
    if (spare) { s.home = spare.home; s.bed = spare.bed; delete s.homeless; continue; }
    s.homeless = (s.homeless ?? 0) + 1; // one dawn's grace: a bed swapped or a room rebuilt overnight
    if (s.homeless < 2) continue;
    for (const e of entityOf(dim, s)) e.remove();
    list.splice(list.indexOf(s), 1);
    world.getPlayers().find((p) => p.id === owner)?.sendMessage(`§7${s.name} had no bed and has left the settlement.`);
  }
  // workers whose building is gone or broken go idle; back to work when it is fixed
  for (const s of list) {
    if (!s.work) continue;
    const st = town.slots[s.work];
    s.idle = !(st && SETTLERS.workers[st.building] && st.done !== false && !st.broken);
  }
  for (let i = 0; i < SETTLERS.perDawn; i++) {
    const next = nextArrival(owner);
    if (!next) break;
    const n = counter.data.next++;
    counter.save();
    const used = new Set(list.map((s) => s.name));
    const names = SETTLERS.names.filter((x) => !used.has(x));
    const name = names.length ? names[(n * 7) % names.length] : `${SETTLERS.names[n % SETTLERS.names.length]} ${n}`;
    const s = { n, name, role: next.role, work: next.work, home: next.home, bed: next.bed, skin: SETTLERS.skins[(n * 5) % SETTLERS.skins.length], idle: false };
    list.push(s);
    spawn(owner, s, dayPlace(owner, s));
    emit("settlerArrived", { owner, name, role: s.role });
    world.getPlayers().find((p) => p.id === owner)?.sendMessage(`§6${name}${s.role !== "Settler" ? `, a ${s.role.toLowerCase()},` : ""} has moved into your settlement.`);
  }
  saveTowns();
  moveAll(owner, false);
}

on("settleCensus", ({ owner }) => {
  try { dawn(owner); } catch (e) { console.warn(`[Hollow Crown] settlers: ${e}`); }
});

// ---------- dusk, and settlers that went missing ----------

let wasNight;
const missing = new Map();
onTick("settle_settlers", 100, () => {
  if (!isReady()) return;
  const night = isNight();
  const towns = Object.keys(world.getPlayers().reduce((o, p) => (townOf(p.id) ? { ...o, [p.id]: 1 } : o), {}));
  if (night !== wasNight && wasNight !== undefined && night) for (const owner of towns) moveAll(owner, true);
  wasNight = night;
  const dim = world.getDimension(OVERWORLD);
  for (const owner of towns) {
    for (const s of settlersOf(owner)) {
      const home = night ? bedPlace(s) : dayPlace(owner, s);
      if (!home) continue;
      let loaded;
      try { loaded = !!dim.getBlock({ x: Math.floor(home.x), y: Math.floor(home.y), z: Math.floor(home.z) }); } catch { loaded = false; }
      if (!loaded) continue;
      const here = entityOf(dim, s);
      for (const extra of here.slice(1)) extra.remove();
      if (here[0]) { missing.delete(s.n); dress(here[0], s); continue; }
      const k = (missing.get(s.n) ?? 0) + 1; // entities load after blocks: wait a few checks
      missing.set(s.n, k);
      if (k >= 4) { missing.delete(s.n); spawn(owner, s, home); }
    }
  }
});

// ---------- talking ----------

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(SETTLER_TAG)) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return; // builder: the normal NPC editor
  event.cancel = true;
  system.run(() => {
    const owner = target.getTags().find((t) => t.startsWith("siege_settler_of_"))?.slice("siege_settler_of_".length);
    const n = Number(target.getTags().find((t) => /^siege_settler_\d+$/.test(t))?.slice("siege_settler_".length));
    const s = owner && settlersOf(owner).find((x) => x.n === n);
    if (!s) return;
    const town = keepOf(owner)?.name ?? townFor(townOf(owner)?.plot)?.name ?? "this place";
    const lines = isNight() ? SETTLER_LINES.night : SETTLER_LINES.day;
    const line = s.idle ? SETTLER_LINES.idle : lines[(n + world.getDay()) % lines.length];
    player.sendMessage(`§f${s.name}${s.role !== "Settler" ? ` §7(${s.role})` : ""}§f: §7${line.replace("{town}", town)}`);
  });
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:settlers") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  if (!townOf(player.id)) return player.sendMessage("§7You have no town layout.");
  const cmd = event.message.trim() || "list";
  if (cmd === "dawn") { countNow(player.id).catch(() => {}); return player.sendMessage("§7Counting beds; a newcomer comes if there is room."); }
  if (cmd === "dusk") { moveAll(player.id, true); return player.sendMessage("§7Everyone to bed."); }
  const list = settlersOf(player.id);
  const beds = freeBeds(player.id).length;
  player.sendMessage(`§6${list.length} settler${list.length === 1 ? "" : "s"}, ${beds} free bed${beds === 1 ? "" : "s"}.§7 ${list.map((s) => `${s.name} (${s.role}${s.idle ? ", idle" : ""})`).join(", ")}`);
});
