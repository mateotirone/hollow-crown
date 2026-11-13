// Shared machinery for the boss unlocks after the Reeve: a set piece that builds itself near players (or, on the
// full map, is already baked into it: baked.js, map/bake_sites.mjs, and is only finished off on approach), NPCs that
// stay at their spots, a summon scene played as timed cues, and the fight gate (start the fight once someone is in
// the arena, count wins, allow a rematch once a siege night has passed after a win).
//
// A boss file calls defineSite({...}) once. Builder commands for every site:
//   /scriptevent siege:unlock <site> status|build|here|tp|item
//   (here: build with the site's centre at your feet, for a flat test world; item: the key it wants)

import { world, system, BlockPermutation, ItemStack, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, onTick, moduleStore, addMenuLabel } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { OVERWORLD } from "../plots/config.js";
import { isBuilder } from "../plots/claims.js";
import { startBoss, fightOf } from "../bestiary/bossCore.js";
import { LANDMARKS, stampOps } from "./landmarks.js";
import { clearTrees } from "../core/clearing.js";
import { approachWave, approachCount } from "./puzzles.js";
import { markSocketed } from "../bestiary/relics.js";
import { bakedFor, bakedState } from "./baked.js";

export const overworld = () => world.getDimension(OVERWORLD);
export const say = (player, text) => { try { player.sendMessage(text); } catch { /* gone */ } };
export const actionbar = (player, text) => { try { player.onScreenDisplay.setActionBar(text); } catch { /* gone */ } };
export const nearby = (c, r = 48) => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - c.x, p.location.z - c.z) <= r);
export const abs = (c, o) => ({ x: c.x + o.dx, y: c.y + o.dy, z: c.z + o.dz });
export const mid = (c, o) => ({ x: c.x + o.dx + 0.5, y: c.y + o.dy, z: c.z + o.dz + 0.5 });
export const sameSpot = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;

// ---------- reading the ground ----------
const SOFT = /air|grass(?!_block)|fern|flower|tulip|poppy|dandelion|bush|snow_layer|leaves|log|vine|sapling|mushroom|torch|sign|reeds|sugar_cane|kelp|seagrass|lily|roots|moss_carpet|propagule/;
/** { top, water, ground } at a column: y of the topmost block, of the water surface (if any), of the first solid block. */
export function column(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  if (!b) return undefined;
  const top = b.location.y;
  let water;
  for (let i = 0; b && i < 80; i++) {
    if (b.typeId === "minecraft:gold_block") { b.setType("minecraft:air"); b = b.below(); continue; } // genworld's marker
    if (/water|ice/.test(b.typeId) && b.typeId !== "minecraft:packed_ice" && b.typeId !== "minecraft:blue_ice") { water ??= b.location.y; b = b.below(); continue; }
    if (b.typeId === "minecraft:packed_ice" && water === undefined) { water = b.location.y; b = b.below(); continue; }
    if (!SOFT.test(b.typeId)) return { top, water, ground: b.location.y };
    b = b.below();
  }
  return undefined;
}

const perms = new Map();
export function perm(o) {
  const k = o.block + JSON.stringify(o.states ?? {});
  if (!perms.has(k)) {
    let p;
    try { p = BlockPermutation.resolve(o.block, o.states); } catch { try { p = BlockPermutation.resolve(o.block); } catch { p = undefined; } }
    perms.set(k, p);
  }
  return perms.get(k);
}
export function put(dim, c, o) {
  const p = perm(o);
  const where = abs(c, o);
  if (p) dim.setBlockPermutation(where, p);
  else dim.setBlockType(where, o.block);
}
export function setState(dim, at, state, value) {
  try {
    const b = dim.getBlock(at);
    if (b) b.setPermutation(b.permutation.withState(state, value));
  } catch { /* not loaded */ }
}

// ---------- items ----------
export function inventoryHas(player, id) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === id) return true;
  return false;
}
export function give(player, id) {
  const left = player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, 1));
  if (left) player.dimension.spawnItem(left, player.location);
}
export const holding = (player) => { try { return player.getComponent("equippable").getEquipment(EquipmentSlot.Mainhand)?.typeId; } catch { return undefined; } };
export function takeFromHand(player) {
  if (isBuilder(player)) return;
  const eq = player.getComponent("equippable");
  const s = eq.getEquipment(EquipmentSlot.Mainhand);
  if (!s) return;
  if (s.amount > 1) { s.amount--; eq.setEquipment(EquipmentSlot.Mainhand, s); } else eq.setEquipment(EquipmentSlot.Mainhand);
}

// ---------- scenes ----------
/** Play [tick, fn] cues; done() after the last. */
export function play(cues, done) {
  let last = 0;
  for (const [tick, fn] of cues) {
    last = Math.max(last, tick);
    system.runTimeout(() => { try { fn(); } catch (e) { console.warn(`[Hollow Crown] unlock scene: ${e}`); } }, Math.max(1, tick));
  }
  system.runTimeout(() => done?.(), last + 2);
}
export const sound = (name, at, opts) => sfx(overworld(), name, at, opts);
export function ring(c, r, y, particle = "minecraft:basic_smoke_particle", n = 24) {
  const dim = overworld();
  for (let a = 0; a < n; a++) {
    const t = (a / n) * Math.PI * 2;
    try { dim.spawnParticle(particle, { x: c.x + 0.5 + Math.sin(t) * r, y, z: c.z + 0.5 + Math.cos(t) * r }); } catch { /* unloaded */ }
  }
}

// ---------- approach fights ----------
/**
 * A stretch on the way in to a boss where its lesser things come for whoever walks through, then rest five minutes.
 *   mid(site) -> { x, z } and r: where to look for players;  inZone(site, loc);  when?(site) -> bool
 *   mob, count? ({ base, per, max }), line (chat), cry (sound id), spots(site, players, n, now) -> [{ x, y, z }]
 * Returns the function to call from the site's tick. Never fires during the summon scene or the fight.
 */
export function makeApproach(a) {
  let last;
  return (site) => {
    const d = site.data;
    if (!d.built || (a.when && !a.when(site))) return;
    const inside = nearby(a.mid(site), a.r).filter((p) => a.inZone(site, p.location));
    const now = system.currentTick;
    if (!approachWave({ players: inside.length, fighting: d.fighting || !!site.scene, now, last })) return;
    last = now;
    const n = approachCount(inside.length, a.count);
    for (const p of inside) { say(p, a.line); if (a.cry) sound(a.cry, p.location, a.cryOpts ?? { volume: 1 }); }
    const dim = overworld();
    for (const at of a.spots(site, inside, n, now)) { try { dim.spawnEntity(a.mob, at); } catch { /* unloaded */ } }
  };
}

// ---------- the rematch rule (pure) ----------
// What clicking the socket does. `when` is the site's own condition (a siege night, a dark moon) and its reason.
export function socketAnswer({ armed, holdingKey, hasKey, scene, fighting, pending, wins, siegesSinceWin, whenOk }) {
  if (scene) return "busy";
  if (fighting) return "fighting";
  if (pending) return "waiting";
  if (!armed) {
    if (!holdingKey) return hasKey ? "hold" : "empty";
    return whenOk ? "summon" : "notnow";
  }
  if (wins > 0 && siegesSinceWin < 1) return "stiff";
  return whenOk ? "rematch" : "notnow";
}

// ---------- NPCs ----------
const npcHandlers = new Map(); // tag -> (player, entity) => void
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== "minecraft:npc") return;
  const tag = target.getTags().find((t) => npcHandlers.has(t));
  if (!tag) return;
  if (player.isSneaking && isBuilder(player)) return; // builder: the normal NPC editor
  event.cancel = true;
  system.run(() => { try { npcHandlers.get(tag)(player, target); } catch (e) { console.warn(`[Hollow Crown] unlock npc: ${e}`); } });
});
/** Keep one NPC with this tag at `spot` (spawn if missing, bring back if moved). */
export function keepNpc(dim, { tag, name, skin, spot }) {
  let found;
  try { found = dim.getEntities({ type: "minecraft:npc", tags: [tag], location: spot, maxDistance: 48 }); } catch { return; }
  for (const extra of found.slice(1)) extra.remove();
  try {
    if (found[0]) {
      if (Math.hypot(found[0].location.x - spot.x, found[0].location.z - spot.z) > 2) found[0].teleport(spot);
      return;
    }
    const e = dim.spawnEntity("minecraft:npc", spot);
    e.addTag(tag);
    e.nameTag = name;
    const npc = e.getComponent("minecraft:npc");
    if (npc) { npc.name = name; npc.skinIndex = skin; }
  } catch { /* not loaded */ }
}
export function removeNpc(dim, tag, near) {
  try { for (const e of dim.getEntities({ type: "minecraft:npc", tags: [tag], location: near, maxDistance: 64 })) e.remove(); } catch { /* unloaded */ }
}
export function talk(player, title, body, buttons = ["Thank you."]) {
  const form = new ActionFormData().title(title).body(body);
  for (const b of buttons) form.button(b);
  return form.show(player).then((r) => (r.canceled ? -1 : r.selection)).catch(() => -1);
}

// ---------- sites ----------
const sites = new Map();
// Has this unlock site been built in this world yet? (the Faceless statues wait for the Gate's precinct: statues/index.js)
export const siteBuilt = (id) => !!sites.get(id)?.data?.built;
const blockHandlers = new Map(); // block type -> (player, block) => void
world.afterEvents.playerInteractWithBlock.subscribe(({ player, block }) => {
  const fn = blockHandlers.get(block.typeId);
  if (fn) { try { fn(player, block); } catch (e) { console.warn(`[Hollow Crown] unlock block: ${e}`); } }
});

/**
 * def: {
 *   id, name, boss (bossCore id), key (item id), anchor: { x, z }, reach (half size, for the ticking area),
 *   *plan(dim, anchor, seed) -> { center, ops, info } | undefined   (a generator: reads the ground, yielding; undefined = not loaded)
 *   afterBuild(site, dim), npcs(site) -> [{ tag, name, skin, spot }], onNpc: { tag: fn(site, player, entity) },
 *   blocks: { typeId: fn(site, player, block) }, inArena(site, loc), spawnAt(site), onWin(site), tick(site)
 * }
 * Returns the site: { def, store, data, save, busy, scene }.
 */
export function defineSite(def) {
  const store = moduleStore(`siege:unlock_${def.id}`, () => ({
    built: false, center: null, seed: null, info: {}, armed: false, pending: false, fighting: false, wins: 0, siegesSinceWin: 0, state: {},
  }));
  const site = {
    def, store,
    get data() { return store.data; },
    save: () => store.save(),
    busy: false,
    scene: false,
    seed() {
      if (store.data.seed === null) { store.data.seed = Math.floor(Math.random() * 2 ** 31); store.save(); }
      return store.data.seed;
    },
  };
  sites.set(def.id, site);
  if (def.key) markSocketed(def.key);
  for (const [type, fn] of Object.entries(def.blocks ?? {})) blockHandlers.set(type, (p, b) => fn(site, p, b));
  for (const [tag, fn] of Object.entries(def.onNpc ?? {})) {
    npcHandlers.set(tag, (p, e) => fn(site, p, e));
    addMenuLabel({ entity: "minecraft:npc", tag, hint: "Click to talk" });
  }

  site.build = (anchor, by) => {
    if (site.busy) return { ok: false, why: "it is already being built" };
    const dim = overworld();
    site.busy = true;
    system.runJob((function* () {
      // plan() is a generator: it reads the ground a row at a time, yielding between rows, and returns the plan
      let plan;
      try { plan = yield* def.plan(dim, anchor, site.seed()); } catch (e) { console.warn(`[Hollow Crown] ${def.id} plan: ${e}`); }
      if (!plan) {
        site.busy = false;
        if (by) say(by, `§c${def.name}: the ground there is not loaded yet. Stand closer.`);
        return;
      }
      const ops = [...stampOps(LANDMARKS[def.id]), ...plan.ops]; // the landmark first, the site's own cells on top
      // the map's trees out of the whole build and the air over it first, so none stand in its dead space or float
      // over it (Mateo 2026-11-12). Sites in a town square keep the town's trees (their stamp says clear: false).
      if (ops.length && LANDMARKS[def.id]?.clear !== false) {
        const c = plan.center, b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
        for (const o of ops) {
          b.x0 = Math.min(b.x0, c.x + o.dx); b.x1 = Math.max(b.x1, c.x + o.dx);
          b.y0 = Math.min(b.y0, c.y + o.dy); b.y1 = Math.max(b.y1, c.y + o.dy);
          b.z0 = Math.min(b.z0, c.z + o.dz); b.z1 = Math.max(b.z1, c.z + o.dz);
        }
        yield* clearTrees(dim, b);
      }
      let failed = 0, n = 0;
      for (const o of ops) {
        try { put(dim, plan.center, o); } catch { failed++; }
        if (++n % 64 === 0) yield;
      }
      if (failed > ops.length * 0.02) {
        site.busy = false;
        if (by) say(by, `§c${def.name}: ${failed} blocks were not loaded. It will try again when someone comes near.`);
        return;
      }
      Object.assign(store.data, { built: true, center: plan.center, info: plan.info ?? {}, armed: false, pending: false, fighting: false, state: {} });
      store.save();
      yield;
      try { def.afterBuild?.(site, dim); } catch (e) { console.warn(`[Hollow Crown] ${def.id} after build: ${e}`); }
      site.keepNpcs();
      site.busy = false;
      if (by) say(by, `§6${def.name} is built (${ops.length} blocks) at ${plan.center.x} ${plan.center.y} ${plan.center.z}.`);
    })());
    return { ok: true };
  };

  site.keepNpcs = () => {
    if (!store.data.built || !def.npcs) return;
    const dim = overworld();
    for (const n of def.npcs(site)) keepNpc(dim, n);
  };

  // A site baked into the map: its blocks already stand. Take its centre and seed and finish it as a build would.
  site.adopt = (bake) => {
    const dim = overworld();
    Object.assign(store.data, { built: true, center: { ...bake.center }, seed: bake.seed ?? store.data.seed, info: bake.info ?? {},
      armed: false, pending: false, fighting: false, state: {}, baked: true });
    store.save();
    try { def.afterBuild?.(site, dim); } catch (e) { console.warn(`[Hollow Crown] ${def.id} after build: ${e}`); }
    site.keepNpcs();
  };

  // Build the first time someone comes near; keep NPCs in place
  let area = false, baked;
  const AREA = `hc_unlock_${def.id}`;
  onTick(`unlock_${def.id}_build`, 100, () => {
    const dim = overworld();
    if (store.data.built || site.busy) {
      if (area && !site.busy) { try { dim.runCommand(`tickingarea remove ${AREA}`); } catch { /* none */ } area = false; }
      if (store.data.built && nearby(store.data.center, 48).length) site.keepNpcs();
      return;
    }
    if (!nearby(def.anchor, 56).length) return;
    // baked into the map (baked_sites.js): take it as it stands, add only its signs, keepers and fight
    const bake = baked === undefined ? bakedFor(def.id, def.anchor) : baked;
    if (bake) {
      const state = bakedState(bake, (x, y, z) => { try { return dim.getBlock({ x, y, z })?.typeId; } catch { return undefined; } });
      if (state === "wait") return;
      if (state === "yes") return site.adopt(bake);
      baked = null; // not this world's: build it the old way
    }
    if (!area) {
      const L = LANDMARKS[def.id], half = L?.size ? Math.ceil(Math.max(L.size[0], L.size[2]) / 2) + 2 : 0;
      const r = Math.max(def.reach ?? 24, half), a = def.anchor; // hold the landmark loaded too
      try { dim.runCommand(`tickingarea add ${a.x - r} 0 ${a.z - r} ${a.x + r} 0 ${a.z + r} ${AREA} true`); } catch { /* full */ }
      area = true;
    }
    site.build(def.anchor);
  });

  // The fight gate
  let missing = 0;
  if (def.boss) onTick(`unlock_${def.id}_fight`, 10, () => {
    const d = store.data;
    if (!d.built) return;
    try { def.tick?.(site); } catch (e) { console.warn(`[Hollow Crown] ${def.id} tick: ${e}`); }
    if (d.pending && !d.fighting) {
      if (!world.getPlayers().some((p) => p.dimension.id === OVERWORLD && def.inArena(site, p.location))) return;
      try {
        startBoss(def.boss, overworld(), def.spawnAt(site));
        d.pending = false;
        d.fighting = true;
        missing = 0;
        store.save();
      } catch (e) {
        console.warn(`[Hollow Crown] ${def.id}: could not start the fight: ${e}`);
      }
      return;
    }
    if (d.fighting) {
      if (fightOf(def.boss)) { missing = 0; return; }
      if (++missing < 3) return;
      d.fighting = false;
      d.pending = true; // lost or left: waits for the next try
      store.save();
    }
  });

  site.summon = (cues) => {
    site.scene = true;
    play(cues, () => {
      store.data.pending = true;
      store.save();
      site.scene = false;
    });
  };

  // Click on the socket: the common answers; the site supplies the scene and its condition
  site.socket = (player, block, { whenOk, notNow, first, again }) => {
    const d = store.data;
    const answer = socketAnswer({
      armed: d.armed, holdingKey: holding(player) === def.key, hasKey: inventoryHas(player, def.key), scene: site.scene,
      fighting: d.fighting || !!fightOf(def.boss), pending: d.pending, wins: d.wins, siegesSinceWin: d.siegesSinceWin, whenOk,
    });
    switch (answer) {
      case "busy": return;
      case "fighting": return actionbar(player, "§7It is already awake.");
      case "waiting": return actionbar(player, "§7It is waiting for you.");
      case "hold": return actionbar(player, "§7Hold it to use it here.");
      case "empty": return say(player, def.emptyText);
      case "notnow": return say(player, notNow);
      case "stiff": return say(player, "§7Nothing answers. Not until another siege night has passed.");
      case "summon":
        takeFromHand(player);
        d.armed = true;
        store.save();
        return first(player, block);
      case "rematch": return again(player, block);
      default: return undefined;
    }
  };
  return site;
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:boss_defeated") {
    let data;
    try { data = JSON.parse(event.message); } catch { return; }
    for (const site of sites.values()) {
      if (site.def.boss !== data?.boss || !site.data.built) continue;
      Object.assign(site.data, { fighting: false, pending: false, wins: site.data.wins + 1, siegesSinceWin: 0 });
      site.save();
      try { site.def.onWin?.(site); } catch (e) { console.warn(`[Hollow Crown] ${site.def.id} win: ${e}`); }
    }
    return;
  }
  if (event.id !== "siege:unlock") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isBuilder(player)) return;
  const [id, cmd = "status"] = event.message.trim().split(/\s+/);
  const site = sites.get(id);
  if (!site) return say(player, `§7Use: /scriptevent siege:unlock <${[...sites.keys()].join("|")}> status|build|here|tp|item`);
  const d = site.data;
  if (cmd === "status") {
    return say(player, [
      `§6${site.def.name}:§r ${d.built ? `built at ${d.center.x} ${d.center.y} ${d.center.z}` : "not built yet"}`,
      `§7${site.def.answer?.(site) ?? ""}`,
      `§7Key placed: §f${d.armed}§7, waiting: §f${d.pending}§7, fighting: §f${d.fighting}§7, wins: §f${d.wins}§7, siege nights since: §f${d.siegesSinceWin}`,
    ].join("\n"));
  }
  if (cmd === "build" || cmd === "here") {
    const l = player.location;
    const r = site.build(cmd === "here" ? { x: Math.floor(l.x), z: Math.floor(l.z), y: Math.floor(l.y) - 1, here: true } : site.def.anchor, player);
    return say(player, r.ok ? `§7Building ${site.def.name}...` : `§c${r.why}`);
  }
  if (cmd === "tp") {
    const c = d.center ?? { ...site.def.anchor, y: 120 };
    const to = site.def.tpAt?.(site) ?? { x: c.x + 0.5, y: c.y + 2, z: c.z + 0.5 };
    return player.teleport(to, { dimension: overworld() });
  }
  if (cmd === "item") return give(player, site.def.key);
  if (site.def.command?.(site, cmd, player)) return undefined;
  return say(player, "§7status, build, here, tp, item");
});

on("siegeEnd", () => {
  for (const site of sites.values()) {
    if (!site.data.built || site.data.wins === 0) continue;
    site.data.siegesSinceWin++;
    site.save();
  }
});

export const allSites = () => [...sites.values()];
