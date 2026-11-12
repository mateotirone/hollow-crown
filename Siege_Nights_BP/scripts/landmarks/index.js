// The world's landmarks build themselves (sites.js, designs from map/structures/landmarks.py).
//
// Each site is built the first time a player comes within BUILD_NEAR of it, on whatever map the world has: the
// ground is read where the pieces stand, each piece is planned against it (plan.js), then placed a few dozen
// blocks a tick through system.runJob, so a Realm never stalls. Only in map mode (a world with the 12 plots).
// A site whose design version goes up is built again over the old one.
// Pieces that seek a shore or a cliff use the spot worked out from the map (spots_data.js); if a world has none,
// they look for it themselves inside the loaded area.
//
// Commands (creative/op):
//   /scriptevent hc:landmark_status            which sites are built
//   /scriptevent hc:landmark_tp <id>           go to a site
//   /scriptevent hc:landmark_build <id>        build (or rebuild) it now; you must be near it

import { world, system, BlockPermutation } from "@minecraft/server";
import { mapMode } from "../plots/api.js";
import { markPlace } from "../lore/ledger.js";
import { spawnNpc } from "../lore/npcs.js";
import { onTick } from "../core/loop.js";
import { emit } from "../core/events.js";
import { load, save, say, runCmd } from "../undertow/data.js";
import { DESIGNS } from "./designs_data.js";
import { SPOTS } from "./spots_data.js";
import { LANDMARKS, BUILD_NEAR } from "./sites.js";
import { planPiece, seekSpot, AIR, KEEP_TOP } from "./plan.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
const K_BUILT = "hc:landmarks_built"; // { site id: version }
const PER_STEP = 40;
const AREA = "hc_landmark";

const SOFT = /leaves|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|log|vine|sapling|mushroom|azalea|dead_bush|torch|reeds|sugar_cane|kelp|seagrass|lily|wood/;
function groundY(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  let y = b?.location?.y;
  if (y === undefined) return undefined;
  for (let i = 0; i < 48; i++) {
    const here = dim.getBlock({ x, y, z });
    if (!here) return undefined;
    if (!here.isAir && !here.isLiquid && !SOFT.test(here.typeId)) return y;
    y--;
  }
  return y;
}
function waterY(dim, x, z) {
  try {
    const b = dim.getTopmostBlock({ x, z });
    return b && b.typeId.includes("water") ? b.location.y : undefined;
  } catch { return undefined; }
}

const permCache = new Map();
function perm(id, states) {
  const k = id + JSON.stringify(states);
  if (!permCache.has(k)) {
    let p;
    try { p = BlockPermutation.resolve(id, states); } catch { try { p = BlockPermutation.resolve(id); } catch { p = undefined; } }
    permCache.set(k, p);
  }
  return permCache.get(k);
}
let AIR_PERM;

const builtMap = () => load(K_BUILT, {});
const designId = (piece, face) => (piece.turns ? `${piece.d}@${face ?? "n"}` : piece.d);

// where a piece goes: { x, z, d }, or undefined (a seeking piece with no spot that found nothing near)
function placePiece(site, k, height, water) {
  const piece = site.pieces[k];
  let x = site.x + (piece.dx ?? 0), z = site.z + (piece.dz ?? 0), face = piece.face;
  if (piece.seek) {
    const s = SPOTS[site.id]?.[k] ?? seekSpot({ x, z }, { ...piece.seek, max: Math.min(piece.seek.max ?? 40, 40) }, height, water);
    if (!s) return undefined;
    ({ x, z, face } = s);
  }
  const d = DESIGNS[designId(piece, face)];
  return d ? { x, z, d } : undefined;
}

// the anchor spot of a piece before its design is known (for loading the ground round it)
const spotOf = (site, k) => SPOTS[site.id]?.[k] ?? { x: site.x + (site.pieces[k].dx ?? 0), z: site.z + (site.pieces[k].dz ?? 0) };

function loaded(dim, x0, z0, x1, z1) {
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) >> 1, (z0 + z1) >> 1]]) {
    try { if (!dim.getBlock({ x, y: 64, z })) return false; } catch { return false; }
  }
  return true;
}

let busy = false;
const R = 44; // ground held loaded round each piece's spot while it builds (every design fits inside)

export function buildSite(site, by) {
  if (busy) return { ok: false, why: "another landmark is still being built" };
  busy = true;
  AIR_PERM ??= BlockPermutation.resolve("minecraft:air");
  const dim = world.getDimension(OVERWORLD);
  let failed = 0, total = 0, missing = 0;
  system.runJob((function* () {
    for (let k = 0; k < site.pieces.length; k++) {
      // 0. hold this piece's ground loaded, and wait for it (about a minute at most)
      const c = spotOf(site, k);
      runCmd(dim, `tickingarea remove ${AREA}`);
      runCmd(dim, `tickingarea add ${c.x - R} 0 ${c.z - R} ${c.x + R} 0 ${c.z + R} ${AREA} true`);
      let waited = 0;
      while (!loaded(dim, c.x - R + 2, c.z - R + 2, c.x + R - 2, c.z + R - 2) && waited < 1200) { waited++; yield; }
      const p = placePiece(site, k, (x, z) => groundY(dim, x, z), (x, z) => waterY(dim, x, z));
      if (!p || waited >= 1200) { missing++; continue; }
      // 1. read the ground (and the top block that is there, for grading) under and round the piece
      const pad = (p.d.ease ?? 3) + 1;
      const heights = new Map(), waters = new Map(), tops = new Map();
      for (let x = p.x + p.d.box.x0 - pad; x <= p.x + p.d.box.x1 + pad; x++) {
        for (let z = p.z + p.d.box.z0 - pad; z <= p.z + p.d.box.z1 + pad; z++) {
          const y = groundY(dim, x, z);
          if (y === undefined) continue;
          heights.set(x * 4096 + z, y);
          const w = waterY(dim, x, z);
          if (w !== undefined) waters.set(x * 4096 + z, w);
          try { tops.set(x * 4096 + z, dim.getBlock({ x, y, z })?.permutation); } catch { /* unloaded */ }
        }
        yield;
      }
      // 2. plan it
      const { ops, G } = planPiece(p.d, p.x, p.z, (x, z) => heights.get(x * 4096 + z), (x, z) => waters.get(x * 4096 + z));
      const pal = p.d.palette.map(([id, st]) => perm(id, st));
      const near = (x, z) => tops.get(x * 4096 + z) ?? tops.get(p.x * 4096 + p.z);
      yield;
      // 3. place it
      let n = 0;
      for (const [x, y, z, i] of ops) {
        total++;
        try {
          const at = { x, y, z };
          if (i === AIR) {
            const here = dim.getBlock(at);
            if (here && !here.isAir) here.setPermutation(AIR_PERM);
          } else {
            const pm = i === KEEP_TOP ? near(x, z) : pal[i];
            if (pm) dim.setBlockPermutation(at, pm);
          }
        } catch { failed++; }
        if (++n % PER_STEP === 0) yield;
      }
      // 4. what the game writes after: sign texts, animals, the Ledger's mark
      const yAt = (dx, dy, dz) => (p.d.mode === "drape" ? (heights.get((p.x + dx) * 4096 + (p.z + dz)) ?? G ?? 64) : G ?? 64) + dy;
      for (const [dx, dy, dz, text] of p.d.signs ?? []) {
        try { dim.getBlock({ x: p.x + dx, y: yAt(dx, dy, dz), z: p.z + dz })?.getComponent("minecraft:sign")?.setText(text); } catch { /* not a sign */ }
      }
      for (const [dx, dy, dz, type] of p.d.spawns ?? []) {
        try { dim.spawnEntity(type, { x: p.x + dx + 0.5, y: yAt(dx, dy, dz), z: p.z + dz + 0.5 }); } catch { /* unloaded */ }
      }
      // story characters who live here: stood there once (never a second one if they are already about)
      for (const [dx, dy, dz, id] of p.d.npcs ?? []) {
        const at = { x: p.x + dx + 0.5, y: yAt(dx, dy, dz), z: p.z + dz + 0.5 };
        try {
          if (!dim.getEntities({ tags: [`siege_lore_npc_${id}`], location: at, maxDistance: 64 }).length) spawnNpc(dim, at, id);
        } catch { /* unloaded */ }
      }
      if (p.d.mark && site.place) {
        const [dx, dy, dz] = p.d.mark;
        markPlace(site.place, { x: p.x + dx, y: yAt(dx, dy, dz), z: p.z + dz });
      }
      yield;
    }
    runCmd(dim, `tickingarea remove ${AREA}`);
    if (missing || failed > total * 0.02) {
      if (by) say(by, `§c${site.name}: part of it was not loaded (${failed} blocks missed, ${missing} pieces). It will try again when someone comes near.`);
    } else {
      const built = builtMap();
      built[site.id] = site.version;
      save(K_BUILT, built);
      if (by) say(by, `§a${site.name} built (${total} blocks).`);
    }
    busy = false;
  })());
  return { ok: true };
}

// Every two seconds: when someone comes near an unbuilt site, build it (one site at a time).
let retryAt = 0;
function tick() {
  if (busy || !mapMode() || system.currentTick < retryAt) return;
  const built = builtMap();
  const players = world.getAllPlayers().filter((p) => p.dimension.id === OVERWORLD);
  if (!players.length) return;
  // someone standing at a built landmark has found it (the Almanac's page)
  for (const p of players) {
    const s = LANDMARKS.find((l) => built[l.id] && Math.hypot(p.location.x - l.x, p.location.z - l.z) < 16);
    if (s) emit("landmarkFound", { player: p, site: s.id });
  }
  for (const site of LANDMARKS) {
    if (built[site.id] === site.version) continue;
    if (!players.some((p) => Math.hypot(p.location.x - site.x, p.location.z - site.z) < BUILD_NEAR)) continue;
    buildSite(site);
    retryAt = system.currentTick + 1200; // if it could not finish, try again in a minute
    return;
  }
}
onTick("landmarks", 40, () => tick());

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (!e.id.startsWith("hc:landmark_")) return;
  const player = e.sourceEntity?.typeId === "minecraft:player" ? e.sourceEntity : undefined;
  if (!player) return;
  const arg = (e.message ?? "").trim();
  if (e.id === "hc:landmark_status") {
    const built = builtMap();
    say(player, LANDMARKS.map((s) => `§f${s.name}§7 (${s.id}) at ${s.x} ${s.z}: ${built[s.id] === s.version ? "§abuilt" : built[s.id] ? "§eold version" : "§cnot yet"}`).join("\n"));
    return;
  }
  const site = LANDMARKS.find((s) => s.id === arg);
  if (!site) return say(player, `§cUse one of: ${LANDMARKS.map((s) => s.id).join(", ")}`);
  if (e.id === "hc:landmark_tp") {
    const dim = world.getDimension(OVERWORLD);
    player.teleport({ x: site.x + 0.5, y: (groundY(dim, site.x, site.z) ?? 150) + 2, z: site.z + 12.5 }, { dimension: dim, facingLocation: { x: site.x, y: 80, z: site.z } });
    return say(player, `§d${site.name}.`);
  }
  if (e.id === "hc:landmark_build") {
    const r = buildSite(site, player);
    if (!r.ok) say(player, `§c${site.name}: ${r.why}`);
  }
});
