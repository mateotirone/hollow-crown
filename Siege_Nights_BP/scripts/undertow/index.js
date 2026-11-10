// The Undertow: the final-quest dimension of The Hollow Crown.
//
//   source.js   the secret Source pick, the 7 cave seams, the Tuning Fork
//   rift.js     the crack that tears open in a cave wall
//   terrain.js  the land, generated from a fixed seed (custom dimensions are void only)
//   builder.js  builds terrain and set pieces near players, a little each tick
//   layout.js   fixed numbers and places (other threads import COURT and UNDERTOW_ID from here)
//
// Needs Bedrock 26.30+ and @minecraft/server 2.8.0 (custom dimensions became stable there).
// Commands (creative/op):
//   /scriptevent hc:mark_source_site <id>   record a candidate shrine (look at the wall)
//   /scriptevent hc:open_rift               open the Rift at the picked site without a fork
//   /scriptevent hc:reveal_source           tell only you which site was picked (spoils it!)
//   /scriptevent hc:undertow_go             go to the Undertow now (testing)
//   /scriptevent hc:undertow_status         build progress
//   /scriptevent hc:slip [seconds]          a Slip: a few seconds in the Hollow, then back where you stood
//   /scriptevent hc:flicker [seconds]       a Flicker: Hollow fog and shapes, no teleport

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { onTick } from "../core/loop.js";
import { addTests, assert } from "../core/tests.js";
import { on, isNight } from "../siege/api.js";
import { UNDERTOW_ID, UNDERTOW_LAYOUT as L, COURT, HEART, TEXT, stageAt, pathX } from "./layout.js";
import { getSourceSite, getSites, markSite, openRift, riftExit, sourceSignsTick, SITE_NAMES, SOURCE_SITE_IDS } from "./source.js";
import { VEIL, planCrack } from "./rift.js";
import { buildTick, piecesTick, flush, pieces, openCourtGate, waystoneSpot, WAYSTONE, isBuilt } from "./builder.js";
import { heightAt, planChunk, isRiver } from "./terrain.js";
import { load, save, say, runCmd } from "./data.js";
import { choirTick, singerSpot, CHOIR } from "./choir.js";
import { slipSeconds, slipLanding, isSlipping } from "./slips.js";
import { shouldAlarm, oreOutcome, noteEntry, crownTick, crownVerdict, WARDEN } from "./warden.js";
import { oreChance } from "./terrain.js";

const IN_TAG = "siege_undertow_in";
const FOG_ID = "siege:undertow_fog";
const FOG_LAYER = "hc_undertow";
const FLOW = "siege:glimmerflow";
const K_PLAYERS = "hc:undertow_players"; // { playerId: { lit: [waystone indexes], stage } }
const K_PROGRESS = "hc:undertow_progress"; // { oswin: bool, choir: bool }

// ---- the dimension ------------------------------------------------------------------------
system.beforeEvents.startup.subscribe((e) => {
  e.dimensionRegistry.registerCustomDimension(UNDERTOW_ID);
});

const undertow = () => world.getDimension(UNDERTOW_ID);
const inUndertow = (p) => p.dimension.id === UNDERTOW_ID;
const isBuilder = (p) => p.getGameMode() === GameMode.Creative;
const progress = () => load(K_PROGRESS, { oswin: false, choir: false });

on("ready", () => {
  getSourceSite(); // make the secret pick now if nobody has yet
  // Keep the arrival area loaded so it gets built before anyone arrives.
  runCmd(undertow(), "tickingarea add -32 60 -48 31 130 47 hc_undertow_wound true");
});

// ---- going in and out ---------------------------------------------------------------------
const cooldown = new Map();

function enter(player) {
  cooldown.set(player.id, system.currentTick + 60);
  if (!isBuilt(0, 0) || !isBuilt(-1, -1)) {
    say(player, "§5The Rift shudders but will not take you yet. Try again in a moment.");
    return;
  }
  player.addEffect("slow_falling", 300, { amplifier: 0, showParticles: false });
  player.addEffect("resistance", 300, { amplifier: 4, showParticles: false });
  player.addEffect("darkness", 60, { amplifier: 0, showParticles: false });
  player.teleport(L.arrival, { dimension: undertow(), facingLocation: { x: 0, y: 95, z: 60 } });
  noteEntry(player, "rift");
  system.runTimeout(() => {
    player.onScreenDisplay.setTitle("§5" + cap(TEXT.name), { subtitle: "§7The Wound", fadeInDuration: 20, stayDuration: 60, fadeOutDuration: 30 });
    player.playSound("ambient.cave", { volume: 1, pitch: 0.5 });
  }, 20);
}

function leave(player) {
  cooldown.set(player.id, system.currentTick + 60);
  const exit = riftExit();
  const ow = world.getDimension("minecraft:overworld");
  player.addEffect("resistance", 100, { amplifier: 4, showParticles: false });
  if (exit) player.teleport(exit, { dimension: ow });
  else player.teleport(world.getDefaultSpawnLocation(), { dimension: ow });
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function blockAt(p, dy) {
  try {
    const l = p.location;
    return p.dimension.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y + dy), z: Math.floor(l.z) });
  } catch {
    return undefined;
  }
}

// Every 5 ticks: veil contact, glimmerflow slowing.
onTick("undertow:contact", 5, () => {
  for (const p of world.getAllPlayers()) {
    const feet = blockAt(p, 0.1), head = blockAt(p, 1.2);
    const touching = feet?.typeId === VEIL || head?.typeId === VEIL;
    if (touching && !isSlipping(p) && (cooldown.get(p.id) ?? 0) < system.currentTick) {
      if (inUndertow(p)) leave(p);
      else if (p.dimension.id === "minecraft:overworld") enter(p);
    }
    if (inUndertow(p) && (feet?.typeId === FLOW || head?.typeId === FLOW)) {
      p.addEffect("slowness", 30, { amplifier: 1, showParticles: false });
    }
  }
});

// Every 2 seconds: fog on/off (catches deaths and any other teleport), beds, stage titles.
onTick("undertow:fog", 40, () => {
  const players = load(K_PLAYERS, {});
  let changed = false;
  for (const p of world.getAllPlayers()) {
    const inside = inUndertow(p), tagged = p.hasTag(IN_TAG);
    if (inside && !tagged) {
      p.addTag(IN_TAG);
      runCmd(p, `fog @s push ${FOG_ID} ${FOG_LAYER}`);
    } else if (!inside && tagged) {
      p.removeTag(IN_TAG);
      runCmd(p, `fog @s remove ${FOG_LAYER}`);
    }
    if (!inside) continue;
    if (isSlipping(p)) continue; // no place names during a Slip: they shouldn't know where they are
    const st = stageAt(Math.floor(p.location.z));
    const rec = (players[p.id] ??= { lit: [], stage: "" });
    if (st && rec.stage !== st.id) {
      rec.stage = st.id;
      changed = true;
      p.onScreenDisplay.setTitle(" ", { subtitle: "§d" + st.name, fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 20 });
    }
  }
  if (changed) save(K_PLAYERS, players);
});

// No sleeping or setting spawn below reality.
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.player.dimension.id !== UNDERTOW_ID) return;
  const id = e.block.typeId;
  if (id.endsWith("_bed") || id === "minecraft:bed" || id === "minecraft:respawn_anchor") {
    e.cancel = true;
    system.run(() => say(e.player, "§7Nothing sleeps down here. Not safely."));
  }
});

// ---- building -----------------------------------------------------------------------------
onTick("undertow:build", 1, () => {
  const players = world.getAllPlayers().filter(inUndertow);
  buildTick(players);
});
onTick("undertow:pieces", 40, () => piecesTick());
onTick("undertow:save", 200, () => flush());

// ---- atmosphere: lightning in the fog above, blue motes along the rivers --------------------
const nextFlash = new Map();
onTick("undertow:sky", 20, () => {
  for (const p of world.getAllPlayers()) {
    if (!inUndertow(p)) continue;
    const l = p.location, d = p.dimension;
    // Blue energy motes drifting up from the land
    for (let i = 0; i < 4; i++) {
      const x = l.x + (Math.random() - 0.5) * 40, z = l.z + (Math.random() - 0.5) * 40;
      const h = heightAt(Math.floor(x), Math.floor(z));
      if (h === null) continue;
      try { d.spawnParticle(isRiver(Math.floor(x), Math.floor(z)) ? "minecraft:soul_particle" : "minecraft:end_rod", { x, y: h + 1.5 + Math.random() * 6, z }); } catch {}
    }
    // Lightning in the fog above: thunder, and now and then a real bolt striking the land far off.
    const due = nextFlash.get(p.id) ?? system.currentTick + 200;
    if (system.currentTick < due) { nextFlash.set(p.id, due); continue; }
    nextFlash.set(p.id, system.currentTick + 160 + Math.floor(Math.random() * 340));
    p.playSound("ambient.weather.thunder", { volume: 0.5, pitch: 0.6 + Math.random() * 0.3 });
    if (Math.random() < 0.4) {
      const ang = Math.random() * Math.PI * 2, far = 24 + Math.random() * 20;
      const x = Math.floor(l.x + Math.cos(ang) * far), z = Math.floor(l.z + Math.sin(ang) * far);
      const h = heightAt(x, z);
      if (h !== null) {
        try { d.spawnEntity("minecraft:lightning_bolt", { x: x + 0.5, y: h + 1, z: z + 0.5 }); } catch {}
      }
    }
  }
});

// ---- waystones ----------------------------------------------------------------------------
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== WAYSTONE || !e.isFirstEvent) return;
  e.cancel = true;
  const player = e.player, loc = e.block.location;
  system.run(() => useWaystone(player, loc));
});

function waystoneIndexAt(loc) {
  return L.waystoneZ.findIndex((_, i) => {
    const s = waystoneSpot(i);
    return s.x === loc.x && s.y === loc.y && s.z === loc.z;
  });
}

function useWaystone(player, loc) {
  const i = waystoneIndexAt(loc);
  if (i < 0) return;
  const players = load(K_PLAYERS, {});
  const fresh = [];
  for (const p of player.dimension.getPlayers({ location: loc, maxDistance: 8 })) {
    const rec = (players[p.id] ??= { lit: [], stage: "" });
    if (!rec.lit.includes(i)) { rec.lit.push(i); fresh.push(p); }
  }
  save(K_PLAYERS, players);
  try {
    player.dimension.playSound("block.amethyst_block.chime", loc, { volume: 1.5, pitch: 0.6 });
    player.dimension.spawnParticle("minecraft:totem_particle", { x: loc.x + 0.5, y: loc.y + 1.2, z: loc.z + 0.5 });
  } catch {}
  for (const p of fresh) say(p, "§dThe waystone takes your light. You can return here from the Wound.");
  if (fresh.length) return;
  // Already lit: offer travel to your other lit waystones.
  const lit = (players[player.id]?.lit ?? []).filter((n) => n !== i).sort((a, b) => a - b);
  if (!lit.length) return say(player, "§7No other waystone holds your light yet.");
  const form = new ActionFormData().title("Waystones").body("Step to a waystone you have lit.");
  for (const n of lit) form.button(`${stageAt(L.waystoneZ[n])?.name ?? "Waystone"} (${n + 1})`);
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const s = waystoneSpot(lit[r.selection]);
    player.teleport({ x: s.x + 0.5, y: s.y, z: s.z + 1.5 }, { dimension: undertow() });
  });
}

// ---- the Drowned Court and the Choir's Heart ---------------------------------------------
let courtOccupied = false, courtEmptySince = 0;
onTick("undertow:arenas", 20, () => {
  const prog = progress();
  const d = undertow();
  const inCourt = world.getAllPlayers().filter((p) => inUndertow(p) && dist2(p.location, COURT.center) < (COURT.radius - 4) ** 2);
  if (!prog.oswin && pieces().court) {
    if (inCourt.length && !courtOccupied) {
      courtOccupied = true;
      sendEvent("siege:undertow_arena_ready", COURT.bossId);
    } else if (!inCourt.length && courtOccupied) {
      if (!courtEmptySince) courtEmptySince = system.currentTick;
      if (system.currentTick - courtEmptySince > 1200) { courtOccupied = false; courtEmptySince = 0; } // re-arm after 60 s empty
    } else courtEmptySince = 0;
  }
  choirTick(); // the Hollow Choir wakes when someone walks into the Heart
  crownTick(); // the Hollow Crown: a Sorcerer who wears it rules, anyone else dies
});

function sendEvent(id, message) {
  try { system.sendScriptEvent(id, message); } catch { runCmd(undertow(), `scriptevent ${id} ${message}`); }
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

// ---- script events --------------------------------------------------------------------------
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const player = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  switch (e.id) {
    case "siege:boss_defeated": {
      let boss;
      try { boss = JSON.parse(e.message).boss; } catch { boss = e.message.trim(); }
      if (boss === COURT.bossId) {
        const prog = progress();
        if (!prog.oswin) {
          prog.oswin = true;
          save(K_PROGRESS, prog);
          openCourtGate();
          world.sendMessage("§5The Drowned Court falls silent. Behind the throne, the sealed gate cracks open.");
        }
      }
      break;
    }
    case "hc:mark_source_site":
      if (player && isBuilder(player)) markSite(player, e.message.trim());
      break;
    case "hc:open_rift": {
      if (!player || !isBuilder(player)) break;
      const r = openRift(player);
      if (!r.ok) say(player, `§cCan't open the Rift: ${r.why}.`);
      break;
    }
    case "hc:reveal_source":
      if (player && isBuilder(player)) {
        const id = getSourceSite(), s = getSites()[id];
        say(player, `§dThe Source is at ${SITE_NAMES[id]} (${id})` + (s ? ` ${s.x} ${s.y} ${s.z}` : ", not marked yet") + ". Keep it secret.");
      }
      break;
    case "hc:undertow_go":
      if (player && isBuilder(player)) enter(player);
      break;
    case "hc:undertow_status":
      if (player) {
        const p = pieces(), marked = Object.keys(getSites()).length;
        say(player, `§dThe Hollow: wound ${p.wound ? "built" : "pending"}, court ${p.court ? "built" : "pending"}, heart ${p.heart ? "built" : "pending"}, waystones ${p.waystones.length}/${L.waystoneZ.length}. Source sites marked ${marked}/7. Court boss ${progress().oswin ? "defeated" : "waiting"}.`);
      }
      break;
  }
});

// ---- showcase exhibits (/scriptevent siege:showcase) ------------------------------------------
on("showcase", ({ player, dim, nextSpot, label }) => {
  const at = nextSpot();
  try {
    const singer = dim.spawnEntity("siege:choir_singer", { x: at.x + 0.5, y: at.y, z: at.z + 0.5 });
    singer.addTag("siege_showcase");
    singer.addTag("siege_boss_shielded");
  } catch { /* entity missing */ }
  label(at, "Singer\n(Hollow Choir)");
  say(player, "§dThe Hollow: step into the Rift Veil block, or type §f/scriptevent hc:undertow_go§d, to visit it. §f/scriptevent hc:slip§d gives you a Slip. The Hollow Choir wakes when you walk into the Heart at the far end (z 2400).");
});

// ---- signs at the real Source -----------------------------------------------------------
onTick("undertow:source", 600, () => sourceSignsTick(isNight()));

// ---- self-tests ---------------------------------------------------------------------------
addTests("undertow", {
  "site ids match the lore list": () => assert(SOURCE_SITE_IDS.length === 7),
  "terrain is deterministic": () => assert(JSON.stringify(planChunk(2, 5)) === JSON.stringify(planChunk(2, 5))),
  "arrival ledge is solid": () => assert(heightAt(0, 0) === L.woundLedgeY),
  "path is walkable (no step over 1)": () => {
    for (let z = 41; z < 2328; z++) {
      const a = heightAt(pathX(z), z), b = heightAt(pathX(z + 1), z + 1);
      assert(Math.abs(a - b) <= 1, `step of ${Math.abs(a - b)} at z ${z}`);
    }
  },
  "no fill is too big": () => {
    for (let cx = -10; cx < 10; cx += 3) for (let cz = -3; cz < 154; cz += 11)
      for (const op of planChunk(cx, cz)) {
        const v = (Math.abs(op.b[0] - op.a[0]) + 1) * (Math.abs(op.b[1] - op.a[1]) + 1) * (Math.abs(op.b[2] - op.a[2]) + 1);
        assert(v <= 32768, `fill of ${v} blocks`);
      }
  },
  "slips grow, and land on the ledge": () => {
    assert(slipSeconds(0) === 10 && slipSeconds(1) === 14 && slipSeconds(99) === 30);
    for (const n of [0, 0.2, 0.49, 0.5, 0.77, 0.999]) {
      const s = slipLanding(n);
      assert(heightAt(Math.floor(s.x), Math.floor(s.z)) === L.woundLedgeY, `landing ${s.x},${s.z} is not on the ledge`);
    }
  },
  "the ore alarm spares the Warden and permit holders": () => {
    const w = { id: "w", permits: { friend: "Friend" }, tithe: 25 };
    assert(shouldAlarm("thief", w, 1000, undefined) && !shouldAlarm("w", w, 1000, undefined) && !shouldAlarm("friend", w, 1000, undefined));
    assert(!shouldAlarm("thief", w, 1000, 900), "one alarm per miner at a time");
    assert(!shouldAlarm("thief", { id: undefined, permits: {} }, 1000, undefined), "no Warden, no alarm");
  },
  "the Hollow Crown only suffers a Sorcerer": () => {
    assert(crownVerdict(true, false, 0) === "claims" && crownVerdict(true, true, 99) === "rules");
    assert(crownVerdict(false, false, 0) === "warned" && crownVerdict(false, false, 4) === "warned" && crownVerdict(false, false, 5) === "dies");
  },
  "the tithe and the offline yield": () => {
    const w = { id: "w", permits: { friend: "Friend" }, tithe: 25 };
    assert(oreOutcome(w, "friend", true, 0.1) === "tithe" && oreOutcome(w, "friend", true, 0.9) === "ore");
    assert(oreOutcome(w, "thief", false, 0.9) === "nothing" && oreOutcome(w, "thief", false, 0.1) === "ore" && oreOutcome(w, "thief", true, 0.9) === "ore");
    assert(oreOutcome(w, "w", false, 0.99) === "ore" && WARDEN.offlineYield === 0.5);
  },
  "ore is in the cliffs, more of it deeper in": () => {
    assert(oreChance(0) === 0 && oreChance(2000) > oreChance(200));
    let n = 0;
    for (let cx = -10; cx < 10; cx++) for (let cz = 30; cz < 60; cz++) n += planChunk(cx, cz).filter((o) => o.block === "siege:choir_ore").length;
    assert(n > 20 && n < 2000, `${n} ore in 600 chunks`);
  },
  "seven singers stand on the ring": () => {
    for (let i = 0; i < 7; i++) {
      const s = singerSpot(i), r = Math.hypot(s.x - 0.5 - HEART.center.x, s.z - 0.5 - HEART.center.z);
      assert(r > HEART.innerRadius + 4 && r < CHOIR.fallBands[1], `singer ${i} at radius ${r}`);
    }
  },
  "rift crack is 14 tall": () => {
    const ys = planCrack({ x: 0, y: 0, z: 0 }, "south").filter((c) => c.block === VEIL).map((c) => c.y);
    assert(Math.min(...ys) === 0 && Math.max(...ys) === 13);
  },
});
