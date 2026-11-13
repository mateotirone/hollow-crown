// Battle test: one command stamps a full Castle-tier settlement and two armies, and runs a siege on it, so every
// battle mechanic can be watched in one go (Mateo, 2026-11-13: "an army for me, an army for the defending settlement,
// and i want to see EVERY battle mechanic ... a way to see attacking and defending").
//
//   /scriptevent siege:battle_test attack [manual] [unjust]   you attack the Test Castle with your army (a War Writ)
//   /scriptevent siege:battle_test defend [unjust]            the Test Warband attacks your castle (a War Writ)
//   /scriptevent siege:battle_test raid                       a Siege Night on your castle: blow the War Horn
//   /scriptevent siege:battle_test status                     who is left on each side, and where the siege stands
//   /scriptevent siege:battle_test watch                      the list of things to watch for, again
//   /scriptevent siege:battle_test clear                      ends the siege, removes the soldiers and stand-ins
//
// Use a flat Creative world and stand where the castle's middle should be: it clears about 145 x 145 blocks round
// you and a field 135 blocks south to the camp. It takes a minute or two to build (the Crown Wall, nine buildings,
// an Iron Strongroom, a Barracks, four ballistas), then the soldiers come out and the siege starts.
// It moves your Keep Banner (like the showcase does) and puts your old keep back on `clear`.
//
// The stand-ins (hc_test_castle, hc_test_warband) are settlements with no player: they have a Keep Banner, Regals,
// soldiers, a wall and a vault, and the real War Writ, army, crew, guard and retrain code runs them. Layout and
// armies: plan.js.

import { world, system, ItemStack } from "@minecraft/server";
import { isReady, getState, saveState, saveTracked, onTick, moduleStore, on, emit, addFilter, freeColor, isNight, endSiege, raidersLeft, KEEP_BANNER, BARRACKS, BALLISTA } from "../siege/api.js";
import { addTests, assert, assertEqual } from "../core/tests.js";
import { tracked } from "../siege/state.js";
import { enlist, equipGuard, guardTag, dropRetrain } from "../siege/guards.js";
import { raiseWall, wallRising, wallOf, wallRing, setWallRecord } from "../settle/walls.js";
import { WALLS } from "../settle/walldata.js";
import { raiseFree } from "../settle/plans.js";
import { drawBuilding } from "../settle/buildings.js";
import { footprint, boxesTouch } from "../settle/rules.js";
import { raiseVaultFor, vaultOf, vaultRecord, setVaultRecord } from "../vault/index.js";
import { VAULT_ROOMS } from "../vault/rooms_data.js";
import { groundBox } from "../vault/data.js";
import { emptyPost, station } from "../guardposts/index.js";
import { dressForType } from "../army/armoury.js";
import { dressRegion } from "../army/region.js";
import { declareWrit, endWritFor, writOf } from "../warwrit/index.js";
import { giveCoins } from "../economy/coins.js";
import { TEST, TEST_OWNERS, BUILDINGS, VAULT, BARRACKS_AT, CAMP_BARRACKS, BALLISTAS, DEFENDERS, ATTACKERS, WATCH, roll, rankSpot, campAt, areas, chunksIn, columns } from "./plan.js";

const OVERWORLD = "minecraft:overworld";
const TAG = "siege_battletest";              // everything the test spawns
const LEADER_TAG = "siege_battletest_leader"; // the Test Warband's warlord: kill him and their attack collapses
const AREAS = ["hc_battletest_castle", "hc_battletest_field"];
const store = moduleStore("siege:battletest", () => ({ run: null }));
const dim = () => world.getDimension(OVERWORLD);
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };
const run = () => store.data.run;
let busy = false;

const cmd = (text) => { try { dim().runCommand(text); return true; } catch { return false; } };
const at = (C, d, dy = 0) => ({ x: C.x + d.dx, y: C.y + dy, z: C.z + d.dz });
const after = (ticks, fn) => system.runTimeout(() => { try { fn(); } catch (e) { fail(e); } }, ticks);
function fail(e) {
  busy = false;
  console.warn(`[Hollow Crown] battle test: ${e}${e?.stack ? `\n${e.stack}` : ""}`);
  world.sendMessage(`§c[Battle test] Something went wrong: ${e}`);
}
// Every 20 ticks until cond() holds (or `max` ticks pass), then then()
function waitFor(cond, then, max, waited = 0) {
  let ok = false;
  try { ok = cond(); } catch { /* not yet */ }
  if (ok || waited >= max) return after(1, () => then(ok));
  after(20, () => waitFor(cond, then, max, waited + 20));
}
const job = (gen, done) => {
  system.runJob((function* () { try { yield* gen; } catch (e) { fail(e); return; } try { done(); } catch (e) { fail(e); } })());
};

// ---------- clearing the ground ----------

const loaded = (x, y, z) => { try { return !!dim().getBlock({ x, y, z }); } catch { return false; } };
// One 16x16 column a tick; a column not loaded yet (the ticking area is still coming in) is tried again shortly
function clearBox(box, y, done, cols = columns(box), i = 0, tries = 0) {
  if (i >= cols.length) return after(1, done);
  const c = cols[i];
  if (!(loaded(c.x0, y, c.z0) && loaded(c.x1, y, c.z1)) && tries < 40) return after(5, () => clearBox(box, y, done, cols, i, tries + 1));
  cmd(`fill ${c.x0} ${y} ${c.z0} ${c.x1} ${y + TEST.clearHeight} ${c.z1} air`);
  cmd(`fill ${c.x0} ${y - 1} ${c.z0} ${c.x1} ${y - 1} ${c.z1} grass_block [] replace air`); // no holes in the floor
  after(1, () => clearBox(box, y, done, cols, i + 1, 0));
}

// ---------- settlements ----------

function setBanner(p, color) {
  const b = dim().getBlock(p);
  b.setType(KEEP_BANNER);
  b.setPermutation(b.permutation.withState("siege:color", color));
}

function setKeep(owner, p, record) {
  const state = getState();
  setBanner(p, record.color);
  state.keeps[owner] = { allies: [], ...record, x: p.x, y: p.y, z: p.z };
  saveState();
}

function addBarracks(p) {
  dim().getBlock(p)?.setType(BARRACKS);
  if (!tracked[BARRACKS].some((t) => t.x === p.x && t.y === p.y && t.z === p.z)) tracked[BARRACKS].push({ dim: OVERWORLD, x: p.x, y: p.y, z: p.z });
  saveTracked();
  run().barracks.push({ x: p.x, y: p.y, z: p.z });
  store.save();
}

// The castle: Castle-tier Keep Banner, Crown Wall, buildings, vault, Barracks, ballistas
function stampCastle(r, owner, player) {
  const C = r.C, state = getState();
  const mine = owner === player.id;
  const prev = mine ? r.prev : state.keeps[owner]; // (your old banner may have been cleared away with the ground)
  const color = mine ? prev?.color ?? freeColor(14) : freeColor(r.color === 11 ? 3 : 11);
  if (mine) r.color = color;
  setKeep(owner, C, {
    ...(prev ?? {}),
    name: mine ? prev?.name ?? player.name : TEST.castleName,
    color, wins: Math.max(prev?.wins ?? 0, 10), warlordsSlain: Math.max(prev?.warlordsSlain ?? 0, 2), tier: "Castle",
    sieges: Math.max(prev?.sieges ?? 0, 2), streak: prev?.streak ?? 0,
  });
  const wall = raiseWall(owner, TEST.wallLevel, { center: { ...C }, style: "vale", bearing: TEST.gateBearing, radius: WALLS.radius });
  if (wall !== true) say(player, `§7[Battle test] The wall: ${wall}`);
  addBarracks(at(C, BARRACKS_AT));
  for (const b of BUILDINGS) raiseFree({ id: owner }, at(C, b), b.f, b.id, "vale");
  raiseVaultFor(owner, at(C, VAULT), VAULT.f, TEST.vaultTier);
  for (const d of BALLISTAS) {
    try {
      const e = dim().spawnEntity(BALLISTA, { x: C.x + d.dx + 0.5, y: C.y, z: C.z + d.dz + 0.5 });
      e.addTag(TAG);
      e.setDynamicProperty("siege:owner", owner);
    } catch { /* not loaded */ }
  }
}

// The camp: a Hamlet Keep Banner and a Barracks where the attackers muster
function stampCamp(r, owner, player) {
  const mine = owner === player.id, prev = mine ? r.prev : undefined;
  const color = mine ? prev?.color ?? freeColor(14) : freeColor(r.color === 3 ? 11 : 3);
  setKeep(owner, r.camp, {
    ...(prev ?? {}),
    name: mine ? prev?.name ?? player.name : TEST.warbandName,
    color, wins: 0, warlordsSlain: 0, tier: "Hamlet", sieges: 0,
  });
  addBarracks(at(r.camp, CAMP_BARRACKS));
}

// ---------- soldiers ----------

function soldier(owner, s, spot, home) {
  const g = dim().spawnEntity(s.type, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 });
  g.addTag(TAG);
  enlist(g, owner, home);
  g.setDynamicProperty("siege:barracks", JSON.stringify(home));
  dressForType(g, owner);
  dressRegion(g, owner);
  equipGuard(g, s.tier);
  const state = getState();
  state.guards[owner] = (state.guards[owner] ?? 0) + 1;
  saveState();
  return g;
}

function* spawnDefenders(r) {
  const owner = r.defender, home = r.barracks[0], C = r.C;
  let n = 0;
  for (const s of roll(DEFENDERS)) {
    const spot = s.post === "wall" ? { ...rankSpot({ x: C.x, z: C.z + 6 }, n), y: C.y } : { ...rankSpot({ x: home.x, z: home.z + 3 }, n), y: C.y };
    n++;
    try {
      const g = soldier(owner, s, spot, s.post === "wall" ? spot : home);
      if (s.post === "wall") { const post = emptyPost(owner); if (post) station(g, owner, post); }
    } catch (e) { console.warn(`[Hollow Crown] battle test defender: ${e}`); }
    yield;
  }
}

function* spawnAttackers(r) {
  const owner = r.attacker, home = r.barracks[1] ?? r.barracks[0];
  const toward = Math.sign(r.C.z - r.camp.z) || -1; // the castle side of the camp
  let leader = r.mode === "defend";
  for (const s of roll(ATTACKERS)) {
    const p = rankSpot({ x: r.camp.x, z: r.camp.z + toward * 8 }, s.i, toward);
    try {
      const g = soldier(owner, s, { ...p, y: r.camp.y }, home);
      if (leader && s.type === "siege:knight") { g.addTag(LEADER_TAG); g.nameTag = `§4Warlord of ${TEST.warbandName}`; leader = false; }
    } catch (e) { console.warn(`[Hollow Crown] battle test attacker: ${e}`); }
    yield;
  }
}

// ---------- the run ----------

function begin(player, mode, flags) {
  if (busy) return say(player, "§7[Battle test] Still building the last one. Wait for it to finish.");
  if (player.dimension.id !== OVERWORLD) return say(player, "§c[Battle test] Only in the Overworld.");
  const state = getState();
  if (state.active) return say(player, "§7[Battle test] A Siege Night is under way. Let it end (or /scriptevent siege:battle_test clear) first.");
  if (run()) clearTest(player, true);
  busy = true;
  const C = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const defender = mode === "attack" ? TEST.castle : player.id;
  const attacker = mode === "attack" ? player.id : mode === "defend" ? TEST.warband : undefined;
  const prev = state.keeps[player.id];
  // your keep, wall and vault records as they were, for clear to put back (defend and raid build yours here)
  const copy = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);
  store.data.run = { mode, flags, by: player.id, C, defender, attacker, prev: copy(prev), prevWall: copy(wallOf(player.id)), prevVault: copy(vaultRecord(player.id)), barracks: [], color: prev?.color ?? 14 };
  store.save();
  for (const id of TEST_OWNERS) giveCoins(id, TEST.purse);
  // if the old Keep Banner is out of the way, it stays standing for clear to hand back; the keep moves here
  cmd("gamerule dodaylightcycle false");
  world.setTimeOfDay(6000);
  const r = run();
  const box = areas(C, campAt(C, { x: C.x, z: C.z + 1 })).castle;
  cmd(`tickingarea remove ${AREAS[0]}`);
  cmd(`tickingarea add ${box.x0} ${C.y} ${box.z0} ${box.x1} ${C.y} ${box.z1} ${AREAS[0]}`);
  say(player, `§6[Battle test] Building the castle round you (${mode}). Give it a minute or two; stay near the middle.`);
  after(40, () => clearBox(box, C.y, () => {
    stampCastle(r, defender, player);
    say(player, "§7[Battle test] The Crown Wall, the town and the Strongroom are rising...");
    waitFor(() => !wallRising(defender) && wallOf(defender)?.level === TEST.wallLevel && !!vaultOf(defender), (ok) => {
      if (!ok) say(player, "§7[Battle test] The wall or vault is taking long; starting anyway.");
      r.camp = campAt(C, wallRing(defender)?.gate?.outside);
      store.save();
      if (mode === "raid") return job(spawnDefenders(r), () => go(player, r));
      const field = areas(C, r.camp).field;
      cmd(`tickingarea remove ${AREAS[1]}`);
      cmd(`tickingarea add ${field.x0} ${C.y} ${field.z0} ${field.x1} ${C.y} ${field.z1} ${AREAS[1]}`);
      after(40, () => clearBox(field, C.y, () => {
        stampCamp(r, attacker, player);
        job((function* () { yield* spawnDefenders(r); yield* spawnAttackers(r); })(), () => go(player, r));
      }));
    }, TEST.buildWaitTicks);
  }));
}

function kit(player, mode) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const give = (id, n = 1) => { try { const left = inv.addItem(new ItemStack(id, n)); if (left) player.dimension.spawnItem(left, player.location); } catch { /* not in this pack */ } };
  if (mode === "attack") {
    give("siege:vault_breaker_iron"); give("siege:vault_breaker_netherite"); give("siege:breaching_charge", 16);
    give("siege:trebuchet"); give("siege:battering_ram"); give("minecraft:cobblestone", 64);
  } else if (mode === "raid") {
    give("siege:war_horn");
  }
  give("minecraft:bow"); give("minecraft:arrow", 64); give("siege:vault_key");
}

function mountUp(player) {
  try {
    const horse = dim().spawnEntity("minecraft:horse", player.location);
    horse.addTag(TAG);
    try { horse.getComponent("minecraft:tameable")?.tame?.(player); } catch { /* fine */ }
    horse.runCommand("replaceitem entity @s slot.saddle 0 saddle");
  } catch { /* fine */ }
}

function go(player, r) {
  busy = false;
  const C = r.C, today = world.getDay();
  cmd("gamerule dodaylightcycle true");
  if (r.mode === "attack") {
    player.teleport({ x: r.camp.x + 0.5, y: r.camp.y, z: r.camp.z - 3.5 }, { dimension: dim(), facingLocation: { x: C.x, y: C.y, z: C.z } });
    mountUp(player);
    world.setTimeOfDay(13000 - TEST.musterAttack);
    if (r.flags.includes("manual")) {
      emit("settlementAttacked", { owner: player.id, by: TEST.castle }); // they attacked you: grounds for a writ
      say(player, "§6[Battle test] Ready. Click the Test Castle's Keep Banner (in the middle of the castle) and pick Declare war. Slide the army to 100%.");
    } else {
      const n = declareWrit(player.id, TEST.castle, { grounds: r.flags.includes("unjust") ? "none" : "feud", share: 100, day: today, by: player.name });
      say(player, typeof n === "number" ? `§6[Battle test] War declared. ${n} soldiers mount up and ride with you. Ride north to the castle; nightfall in about ${Math.round(TEST.musterAttack / 20)} seconds.` : `§c[Battle test] ${n}`);
    }
  } else if (r.mode === "defend") {
    const gate = wallRing(r.defender)?.gate;
    const stand = gate ? { x: C.x + 0.5, y: C.y, z: C.z + (gate.z - C.z) * 0.6 } : { x: C.x + 0.5, y: C.y, z: C.z + 30 };
    player.teleport(stand, { dimension: dim(), facingLocation: { x: r.camp.x, y: C.y, z: r.camp.z } });
    world.setTimeOfDay(13000 - TEST.musterDefend);
    const n = declareWrit(TEST.warband, player.id, { grounds: r.flags.includes("unjust") ? "none" : "feud", share: 100, day: today, by: TEST.warbandName, dismounted: true });
    say(player, typeof n === "number" ? `§6[Battle test] ${TEST.warbandName} (${n} soldiers) marches on your castle. Nightfall in about ${Math.round(TEST.musterDefend / 20)} seconds. Climb the wall to watch.` : `§c[Battle test] ${n}`);
  } else {
    player.teleport({ x: C.x + 0.5, y: C.y, z: C.z + 3.5 }, { dimension: dim() });
    world.setTimeOfDay(13000);
    say(player, "§6[Battle test] Night has fallen on your castle. Blow the War Horn to call the Siege Night.");
  }
  kit(player, r.mode);
  watch(player, r.mode);
}

function watch(player, mode) {
  say(player, `§6[Battle test] Watch for:§7\n${(WATCH[mode] ?? []).map((l, i) => `${i + 1}. ${l}`).join("\n")}`);
}

// ---------- while it runs ----------

// Kill the Test Warband's warlord and their attack collapses (the rule for an attacking leader who falls)
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  try {
    if (!isReady() || !deadEntity.hasTag(LEADER_TAG)) return;
    const r = run();
    if (r?.mode === "defend") endWritFor(r.defender, "leader");
  } catch { /* fine */ }
});

// A raid on the test castle brings everything: rams and sappers from the first wave (the Castle's Grand Siege already
// brings the Warlord King and attacks from two sides)
addFilter("plan", (plan, { owner }) => {
  const r = run();
  if (r?.mode === "raid" && owner === r.defender) for (const m of ["siegeTrain", "sappers"]) if (!plan.modifiers.includes(m)) plan.modifiers.push(m);
  return plan;
});

// ...and a wingman dragon circles the keep, burning raiders
onTick("battletest-wingman", 100, () => {
  if (!isReady()) return;
  const r = run();
  if (r?.mode !== "raid" || !getState().active) return;
  emit("npcDragonFly", { key: "battletest", name: "§bWingman", dimension: OVERWORLD, center: { x: r.C.x, y: r.C.y, z: r.C.z }, radius: 30, height: 20, every: 30, damage: 8, ttl: 200 });
});
on("siegeEnd", () => { if (run()?.mode === "raid") emit("npcDragonLand", { key: "battletest" }); });

// ---------- status and clearing ----------

function status(player) {
  const r = run();
  if (!r) return say(player, "§7[Battle test] Nothing running. /scriptevent siege:battle_test attack | defend | raid");
  const count = (owner) => {
    if (!owner) return "";
    const by = {};
    try { for (const g of dim().getEntities({ tags: [guardTag(owner)] })) by[g.typeId] = (by[g.typeId] ?? 0) + 1; } catch { /* fine */ }
    return Object.entries(by).map(([t, n]) => `${n} ${t.replace("siege:", "").replace(/_/g, " ")}`).join(", ") || "none";
  };
  const lines = [`§6[Battle test] ${r.mode}${busy ? " (still building)" : ""}`];
  lines.push(`§7Defenders: ${count(r.defender)}`);
  if (r.attacker) lines.push(`§7Attackers: ${count(r.attacker)}`);
  const w = writOf(r.defender);
  if (w) lines.push(`§7War Writ: ${w.phase}${w.writ.cracked ? ", vault cracked" : ""}${w.writ.unjust ? ", unjust" : ""}`);
  if (r.mode === "raid") lines.push(getState().active ? `§7Siege Night: ${raidersLeft().length} raiders left, ${getState().assaultsLeft} waves to come` : "§7No Siege Night yet: blow the War Horn after dusk");
  const v = vaultOf(r.defender);
  lines.push(`§7Vault: ${v ? `${v.built}${v.broken ? ", broken into" : ""}` : "not built yet"}  §7Wall level: ${wallOf(r.defender)?.level ?? 0}  §7Time: ${world.getTimeOfDay()}${isNight() ? " (night)" : ""}`);
  say(player, lines.join("\n"));
}

function clearTest(player, quiet = false) {
  const r = run();
  if (!r) return quiet || say(player, "§7[Battle test] Nothing to clear.");
  const state = getState();
  if (writOf(r.defender)) endWritFor(r.defender, "dawn");
  if (state.active && r.mode === "raid") endSiege("dawn");
  // your own test soldiers: the ones it spawned, and any that retrained at its Barracks since
  const testBarracks = (g) => { try { const b = JSON.parse(g.getDynamicProperty("siege:barracks") ?? "null"); return !!b && r.barracks.some((t) => t.x === b.x && t.z === b.z); } catch { return false; } };
  let mine = 0;
  try { for (const g of dim().getEntities({ tags: [guardTag(r.by)] })) if (g.hasTag(TAG) || testBarracks(g)) { g.remove(); mine++; } } catch { /* fine */ }
  try { for (const e of dim().getEntities({ tags: [TAG] })) e.remove(); } catch { /* fine */ }
  for (const id of TEST_OWNERS) {
    try { for (const g of dim().getEntities({ tags: [guardTag(id)] })) g.remove(); } catch { /* fine */ }
    const k = state.keeps[id];
    if (k) { try { dim().getBlock(k)?.setType("minecraft:air"); } catch { /* unloaded */ } delete state.keeps[id]; }
    delete state.guards[id];
    setVaultRecord(id, null);
    setWallRecord(id, null);
  }
  if (r.mode !== "attack") { setWallRecord(r.by, r.prevWall); setVaultRecord(r.by, r.prevVault); }
  dropRetrain((q) => TEST_OWNERS.includes(q.owner) || (q.owner === r.by && r.barracks.some((b) => q.barracks && b.x === q.barracks.x && b.z === q.barracks.z)));
  // your soldier count loses the test soldiers; your keep goes back as it was
  state.guards[r.by] = Math.max(0, (state.guards[r.by] ?? 0) - mine);
  const k = state.keeps[r.by];
  if (r.prev) {
    if (k && (k.x !== r.prev.x || k.z !== r.prev.z)) try { dim().getBlock(k)?.setType("minecraft:air"); } catch { /* unloaded */ }
    state.keeps[r.by] = { ...r.prev };
    try { setBanner(r.prev, r.prev.color ?? 14); } catch { /* unloaded: it comes back when loaded */ }
  } else if (k) {
    try { dim().getBlock(k)?.setType("minecraft:air"); } catch { /* unloaded */ }
    delete state.keeps[r.by];
  }
  saveState();
  tracked[BARRACKS] = tracked[BARRACKS].filter((t) => !r.barracks.some((b) => b.x === t.x && b.y === t.y && b.z === t.z));
  saveTracked();
  for (const a of AREAS) cmd(`tickingarea remove ${a}`);
  cmd("gamerule dodaylightcycle true");
  store.data.run = null;
  store.save();
  busy = false;
  if (!quiet) say(player, "§6[Battle test] Cleared: the siege is over, the soldiers and stand-ins are gone and your keep is back. The castle's blocks stay where they are.");
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:battle_test") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [what = "", ...flags] = event.message.trim().toLowerCase().split(/\s+/);
  try {
    if (["attack", "defend", "raid"].includes(what)) begin(player, what, flags);
    else if (what === "status") status(player);
    else if (what === "watch") watch(player, run()?.mode ?? "attack");
    else if (what === "clear") clearTest(player);
    else say(player, "§7/scriptevent siege:battle_test attack [manual] [unjust] | defend [unjust] | raid | status | watch | clear");
  } catch (e) { fail(e); }
});

// ---------- self-tests ----------

addTests("battle test", {
  "the castle town's buildings and vault sit inside the wall, clear of each other and of the gate road": () => {
    const C = { x: 0, y: 64, z: 0 };
    const inner = WALLS.radius - 4 - WALLS.wobble.in - WALLS.reserve; // inside the thickest wall and its reserve
    const boxes = BUILDINGS.map((b) => ({ id: b.id, box: footprint(at(C, b), b.f, drawBuilding(b.id, "vale").bounds()) }));
    boxes.push({ id: "vault", box: groundBox({ x: VAULT.dx, y: 64, z: VAULT.dz, fx: VAULT.f.x, fz: VAULT.f.z }, VAULT_ROOMS[TEST.vaultTier].treasury.box) });
    for (const { id, box } of boxes) {
      for (const [x, z] of [[box.x0, box.z0], [box.x1, box.z0], [box.x0, box.z1], [box.x1, box.z1]]) assert(Math.hypot(x, z) < inner, `${id} reaches ${Math.round(Math.hypot(x, z))} from the middle`);
      assert(!boxesTouch(box, { x0: -3, z0: 6, x1: 3, z1: WALLS.radius }), `${id} stands on the gate road`);
      assert(!boxesTouch(box, { x0: -2, z0: -2, x1: 2, z1: 2 }), `${id} covers the Keep Banner`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      assert(!boxesTouch(boxes[i].box, boxes[j].box), `${boxes[i].id} and ${boxes[j].id} overlap`);
    }
    for (const p of [BARRACKS_AT, ...BALLISTAS]) for (const { id, box } of boxes) assert(!boxesTouch(box, { x0: p.dx, z0: p.dz, x1: p.dx, z1: p.dz }), `${id} covers a Barracks or ballista`);
  },
  "every soldier type fights, on both sides where it makes sense": () => {
    const types = new Set([...DEFENDERS, ...ATTACKERS].map((r) => r.type));
    for (const t of ["siege:man_at_arms", "siege:archer", "siege:pikeman", "siege:shieldbearer", "siege:crossbowman", "siege:knight", "siege:trebuchet_crew", "siege:ram_crew", "siege:sapper"]) assert(types.has(t), t);
    const tiers = new Set(roll(ATTACKERS).map((s) => s.tier));
    assertEqual(tiers.size, 5);
  },
  "the camp is out past the dismount line, and the ticking areas fit": () => {
    const C = { x: 7, y: 64, z: -5 };
    const camp = campAt(C, { x: 7, z: 70 });
    assertEqual(camp.x, 7);
    assert(camp.z - C.z > WALLS.radius + WALLS.landBeyond + 40, "the army rides before it dismounts");
    const { castle, field } = areas(C, camp);
    assert(chunksIn(castle) <= 100 && chunksIn(field) <= 100, `${chunksIn(castle)} and ${chunksIn(field)} chunks`);
    assert(field.z1 >= camp.z + 20 && field.z0 <= castle.z1 + 1, "the field reaches from the wall to past the camp");
    assertEqual(columns({ x0: 0, z0: 0, x1: 31, z1: 16 }).length, 4);
  },
});
