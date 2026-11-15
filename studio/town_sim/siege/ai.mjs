// What Minecraft itself does to a creature, for the siege simulator: read its entity file, pick targets, find a path,
// walk, jump, fall, fight, shoot. engine.mjs owns the world and the script API; this file owns the bodies.
//
// Taken from the pack's own entity files (so a change there changes the simulator):
//   health, movement speed, collision box, families, target goals and their filters and ranges, melee and ranged
//   goals (speed multipliers, intervals, radius), attack damage, shooter projectile, damage sensors, knockback
//   resistance, physics flags, stroll, avoid, fire immunity.
// Minecraft's own rules, written here from the published numbers (the game's engine is closed, so these are OURS):
//   - walking: each tick a creature gains 0.98 x speed^2 along its heading, moves, then keeps 54.6% of its sideways
//     speed on the ground (91% in the air); gravity 0.08 a tick with 2% drag; jump 0.42; step-up 0.6.
//     That makes speed 0.32 x 1.25 about 6.9 blocks a second, and one applyImpulse(0.3) about two thirds of a block.
//   - path-finding: A* over standable cells (4 ways + corners, up one block, down three, through doors it may open),
//     no further than the creature's follow range, 900 cells a search; if the goal can't be reached it walks to the
//     cell nearest to it (that is why raiders gather under a wall with a barred gate).
//   - melee: reach^2 = (2 x width)^2 + target width, one blow a second, line of sight needed, 0.4 knockback.
//   - target scan every 10 ticks, nearest first; hurt-by target wins while the attacker lives.
//   - arrows: speed 1.6, gravity 0.05, damage ceil(2 x speed); other projectiles from their own file.
//   - fall damage (distance - 3), fire 1 and lava 4 every half second.

const OUT = { pass: false, h: 1, out: true };
const rad = Math.PI / 180;

export function createAi({ blocks, permAt, entities, isPlayer, damage, heal, spawn, remove, setBlock, fire, now, hud = {} }) {
  void heal;
  const cols = [];
  const colAt = (idx) => (cols[idx] ??= permAt(idx).collision);
  const cell = (x, y, z) => (blocks.inside(x, y, z) ? colAt(blocks.get(x, y, z)) : OUT);
  const idAt = (x, y, z) => (blocks.inside(x, y, z) ? permAt(blocks.get(x, y, z)).typeId : "minecraft:air");
  const brains = new Set();
  let changes = [];

  // ---------- filters (the "filters" objects in entity files) ----------
  function testFilter(f, self, other) {
    if (!f) return true;
    if (Array.isArray(f)) return f.every((x) => testFilter(x, self, other));
    if (f.all_of) return f.all_of.every((x) => testFilter(x, self, other));
    if (f.any_of) return f.any_of.some((x) => testFilter(x, self, other));
    if (f.none_of) return !f.none_of.some((x) => testFilter(x, self, other));
    if (!f.test) return true;
    const subj = (f.subject ?? "self") === "self" ? self : other;
    const op = f.operator ?? "==";
    const cmp = (got, want) => {
      switch (op) {
        case "!=": case "<>": case "not": return got !== want;
        case "<": return got < want; case "<=": return got <= want; case ">": return got > want; case ">=": return got >= want;
        default: return got === want;
      }
    };
    const flag = (has) => (op === "!=" || op === "not" || op === "<>" ? !has : has) === (f.value === undefined || f.value === true || typeof f.value !== "boolean" ? true : false);
    if (!subj) return op === "!=" || op === "not";
    switch (f.test) {
      case "is_family": { const has = subj.families.includes(f.value); return op === "!=" || op === "not" || op === "<>" ? !has : has; }
      case "has_tag": { const has = subj.tags.has(f.value); return op === "!=" || op === "not" || op === "<>" ? !has : has; }
      case "is_sneak_held": case "is_sneaking": return cmp(!!subj._sneak, f.value ?? true);
      case "enum_property": case "int_property": case "bool_property": case "float_property": return cmp(subj.properties?.[f.domain], f.value);
      case "is_variant": return cmp(subj.comp?.["minecraft:variant"]?.value ?? 0, f.value);
      case "is_mark_variant": return cmp(subj.comp?.["minecraft:mark_variant"]?.value ?? 0, f.value);
      case "has_mob_effect": return flag(subj.effectLevel?.(String(f.value).replace("minecraft:", "")) > 0);
      case "has_component": return flag(!!subj.comp?.[f.value]);
      case "has_target": return flag(!!subj.ai?.target);
      case "is_riding": return flag(!!subj.ridingOn);
      case "on_ground": return flag(!!subj.onGround);
      case "in_water": case "is_underwater": return flag(!!subj.inWater);
      case "in_lava": return flag(false);
      case "is_daytime": return flag(false);
      case "has_equipment": case "is_in_village": case "has_ability": case "is_baby": return flag(false);
      default: return true;
    }
  }

  // ---------- rays ----------
  function raycast(o, d, maxDist, { passable = false, liquid = false } = {}) {
    const l = Math.hypot(d.x, d.y, d.z) || 1;
    const dx = d.x / l, dy = d.y / l, dz = d.z / l;
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tx = dx ? ((dx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity, ty = dy ? ((dy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity, tz = dz ? ((dz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
    let face = "Up", t = 0;
    for (let n = 0; n < 400 && t <= maxDist; n++) {
      if (blocks.inside(x, y, z)) {
        const idx = blocks.get(x, y, z);
        if (idx !== 0) { const c = colAt(idx); if (c.liquid ? liquid : passable || !c.pass) return { x, y, z, face, t }; }
      }
      if (tx <= ty && tx <= tz) { x += sx; t = tx; tx += tdx; face = sx > 0 ? "West" : "East"; } else if (ty <= tz) { y += sy; t = ty; ty += tdy; face = sy > 0 ? "Down" : "Up"; } else { z += sz; t = tz; tz += tdz; face = sz > 0 ? "North" : "South"; }
    }
    return undefined;
  }
  const eye = (e) => ({ x: e.pos.x, y: e.pos.y + e.height * 0.85, z: e.pos.z });
  function canSee(a, b) {
    const o = eye(a), t = { x: b.pos.x, y: b.pos.y + b.height * 0.6, z: b.pos.z };
    const d = { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z }, len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.01) return true;
    return !raycast(o, d, len - 0.01);
  }

  // ---------- where a creature can stand ----------
  // The height of the floor in cell (x, y, z) for a creature `tall` high, or NaN if it can't stand there.
  let doorsOk = false, climbOk = false;
  const open = (c) => c.pass || (doorsOk && c.door);
  function stand(x, y, z, tall) {
    const c = cell(x, y, z);
    if (c === OUT) return NaN;
    let fy;
    if (open(c)) {
      const b = cell(x, y - 1, z);
      if (b === OUT) return NaN;
      if (b.pass) { if (!(c.climb && climbOk) && !(c.liquid && !cell(x, y + 1, z).liquid && cell(x, y - 1, z).liquid)) return NaN; fy = y; } else if (b.h < 1) return NaN; else fy = y + b.h - 1;
    } else if (c.h < 1 && !c.low) fy = y + c.h; else return NaN;
    for (let k = y + 1, top = Math.ceil(fy + tall) - 1; k <= top; k++) if (!open(cell(x, k, z))) return NaN;
    return fy;
  }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // A* from the creature's cell toward a goal. Returns { nodes: [{x,y,z,fy}], partial }.
  function findPath(e, goal, range, budget = 900) {
    const tall = e.height, b = e.ai;
    doorsOk = !!b.cfg.doors; climbOk = !!b.cfg.climb;
    let sx = Math.floor(e.pos.x), sy = Math.floor(e.pos.y + 0.01), sz = Math.floor(e.pos.z);
    let sfy = stand(sx, sy, sz, tall);
    if (Number.isNaN(sfy)) { for (const dy of [1, -1, -2, -3]) { sfy = stand(sx, sy + dy, sz, tall); if (!Number.isNaN(sfy)) { sy += dy; break; } } }
    if (Number.isNaN(sfy)) return undefined;
    const gx = Math.floor(goal.x), gy = Math.floor(goal.y + 0.01), gz = Math.floor(goal.z);
    const key = (x, y, z) => (((x - sx + 512) & 1023) * 1024 + ((z - sz + 512) & 1023)) * 512 + ((y - sy + 256) & 511);
    const h = (x, y, z) => Math.hypot(x - gx, (y - gy) * 1.2, z - gz);
    const open_ = [], g = new Map(), from = new Map(), node = new Map();
    const push = (n) => { open_.push(n); let i = open_.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open_[p].f <= n.f) break; open_[i] = open_[p]; i = p; } open_[i] = n; };
    const pop = () => { const top = open_[0], last = open_.pop(); if (open_.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= open_.length) break; if (c + 1 < open_.length && open_[c + 1].f < open_[c].f) c++; if (open_[c].f >= last.f) break; open_[i] = open_[c]; i = c; } open_[i] = last; } return top; };
    const start = { x: sx, y: sy, z: sz, fy: sfy, k: key(sx, sy, sz), g: 0, f: h(sx, sy, sz) };
    g.set(start.k, 0); node.set(start.k, start); push(start);
    let best = start, bestH = start.f, seen = 0, done;
    const r2 = range * range;
    while (open_.length && seen < budget) {
      const cur = pop();
      if (cur.g > (g.get(cur.k) ?? Infinity)) continue;
      seen++;
      const hh = h(cur.x, cur.y, cur.z);
      if (hh < bestH - 1e-6) { bestH = hh; best = cur; }
      if (hh <= (goal.near ?? 0.5)) { done = cur; break; }
      const headUp = open(cell(cur.x, Math.ceil(cur.fy + tall), cur.z)); // room to jump
      const flat = [];
      for (let i = 0; i < 8; i++) {
        const nx = cur.x + NB[i][0], nz = cur.z + NB[i][1];
        if ((nx - sx) ** 2 + (nz - sz) ** 2 > r2) { flat[i] = false; continue; }
        let ny = cur.y, fy = stand(nx, ny, nz, tall), cost = i < 4 ? 1 : 1.414;
        flat[i] = !Number.isNaN(fy) && Math.abs(fy - cur.fy) <= 0.6;
        if (i >= 4) { // corners only on the flat, and not cutting through a block
          if (!flat[i]) continue;
          const a = NB[i][0] > 0 ? 0 : 1, c = NB[i][1] > 0 ? 2 : 3;
          if (!flat[a] || !flat[c]) continue;
        } else if (!flat[i]) {
          if (!Number.isNaN(fy) && fy - cur.fy > 0.6 && fy - cur.fy <= 1.2 && headUp) cost += 1; // a hop up onto a tall floor in the same cell
          else if (!Number.isNaN(fy) && fy < cur.fy) cost += 0.2;
          else {
            fy = NaN;
            if (headUp) { const up = stand(nx, cur.y + 1, nz, tall); if (!Number.isNaN(up) && up - cur.fy <= 1.2) { ny = cur.y + 1; fy = up; cost += up - cur.fy > 0.6 ? 1 : 0.2; } }
            if (Number.isNaN(fy) && open(cell(nx, cur.y, nz)) && open(cell(nx, cur.y + 1, nz))) {
              for (let d = 1; d <= 3; d++) { const dn = stand(nx, cur.y - d, nz, tall); if (!Number.isNaN(dn)) { ny = cur.y - d; fy = dn; cost += 0.5 * d; break; } if (!open(cell(nx, cur.y - d, nz))) break; }
            }
            if (Number.isNaN(fy)) continue;
          }
        }
        const c0 = cell(nx, ny, nz);
        if (c0.liquid) cost += 4; // avoid water
        if (c0.door && !c0.pass) cost += 1;
        const k = key(nx, ny, nz), ng = cur.g + cost;
        if (ng >= (g.get(k) ?? Infinity)) continue;
        g.set(k, ng); from.set(k, cur.k);
        const n = { x: nx, y: ny, z: nz, fy, k, g: ng, f: ng + h(nx, ny, nz) };
        node.set(k, n); push(n);
      }
    }
    const end = done ?? best;
    const nodes = [];
    for (let k = end.k; k !== undefined && k !== start.k; k = from.get(k)) nodes.push(node.get(k));
    nodes.reverse();
    return { nodes, partial: !done, seen, left: bestH };
  }

  // ---------- one creature's brain ----------
  const num = (v, d) => (typeof v === "number" ? v : d);
  function attach(e) {
    if (e.van?.inert || isPlayer(e) || e.typeId === "minecraft:player") { const b = { target: undefined, refresh() {}, teleported() {}, hurt() {}, inert: true }; return b; }
    const b = {
      e, target: undefined, cfg: {}, path: undefined, at: 0, goalKey: "", repathAt: 0, cd: 0, shotCd: 0, strollAt: now() + 40 + Math.random() * 200,
      swingTick: -100, shootTick: -100, stuck: 0, lastX: e.pos.x, lastZ: e.pos.z, hurtBy: undefined, hurtByTick: -1000, scanAt: Math.floor(Math.random() * 10), fall: 0, moving: 0, partial: false, want: undefined,
      refresh() { b.cfg = readCfg(e); },
      teleported() { b.path = undefined; b.repathAt = 0; b.fall = 0; b.lastX = e.pos.x; b.lastZ = e.pos.z; },
      hurt(by) { if (by && by !== e && by.alive && !isCreative(by)) { b.hurtBy = by; b.hurtByTick = now(); } },
    };
    b.cfg = readCfg(e);
    brains.add(b);
    return b;
  }
  const isCreative = (x) => isPlayer(x) && (x.mode === "Creative" || x.mode === "Spectator");
  function readCfg(e) {
    const c = e.comp ?? {};
    const goals = [];
    for (const [k, prioritized] of [["minecraft:behavior.nearest_prioritized_attackable_target", true], ["minecraft:behavior.nearest_attackable_target", false], ["minecraft:behavior.defend_village_target", false]]) {
      const gdef = c[k];
      if (!gdef) continue;
      goals.push({ priority: gdef.priority ?? 5, prioritized, mustSee: !!gdef.must_see, radius: num(gdef.within_radius, 16), types: [].concat(gdef.entity_types ?? []).map((t) => ({ filters: t.filters, max: num(t.max_dist, num(gdef.within_radius, 16)), priority: t.priority ?? 0, mustSee: t.must_see })) });
    }
    goals.sort((a, b2) => a.priority - b2.priority);
    const phys = c["minecraft:physics"], melee = c["minecraft:behavior.melee_attack"] ?? c["minecraft:behavior.stomp_attack"] ?? c["minecraft:behavior.delayed_attack"], ranged = c["minecraft:behavior.ranged_attack"];
    const atk = c["minecraft:attack"]?.damage;
    const walk = c["minecraft:navigation.walk"] ?? c["minecraft:navigation.generic"] ?? c["minecraft:navigation.climb"];
    const flies = !!(c["minecraft:navigation.hover"] ?? c["minecraft:navigation.fly"] ?? c["minecraft:navigation.float"] ?? c["minecraft:can_fly"]);
    return {
      speed: num(c["minecraft:movement"]?.value, e.van?.speed ?? 0),
      nav: !!walk || flies, flies, doors: !!walk?.can_open_doors, climb: !!c["minecraft:can_climb"],
      gravity: phys ? phys.has_gravity !== false : !c["minecraft:collision_box"] || !e.def, collide: phys ? phys.has_collision !== false : true,
      physics: !!phys || !e.def,
      goals, hurtBy: c["minecraft:behavior.hurt_by_target"], melee, ranged, shooter: c["minecraft:shooter"]?.def,
      damage: Array.isArray(atk) ? atk : atk?.range_min !== undefined ? [atk.range_min, atk.range_max] : num(atk, 0),
      stroll: c["minecraft:behavior.random_stroll"], avoid: c["minecraft:behavior.avoid_mob_type"], float: !!c["minecraft:behavior.float"],
      follow: num(c["minecraft:follow_range"]?.value, 16), kb: num(c["minecraft:knockback_resistance"]?.value, 0),
      pushable: c["minecraft:pushable"]?.is_pushable !== false && !!phys && phys.has_collision !== false, fireImmune: !!c["minecraft:fire_immune"],
      fallImmune: [].concat(c["minecraft:damage_sensor"]?.triggers ?? []).some((t) => (t.cause === "fall" || t.cause === "all") && (t.deals_damage === false || t.deals_damage === "no")),
    };
  }

  const dist3 = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
  const validTarget = (e, t) => !!t && t.alive && !t.removed && t !== e && !isCreative(t) && !(t.effectLevel?.("invisibility") > 0 && isPlayer(t));

  function scan(b) {
    const e = b.e, cfg = b.cfg;
    // hurt-by: the one who struck it, while that one lives and is near
    if (cfg.hurtBy && validTarget(e, b.hurtBy) && dist3(e, b.hurtBy) <= Math.max(32, cfg.follow) && now() - b.hurtByTick < 600) {
      const first = cfg.goals[0];
      if (!first || (cfg.hurtBy.priority ?? 1) <= first.priority) { b.target = b.hurtBy; return; }
    }
    for (const gdef of cfg.goals) {
      let best, bestP = Infinity, bestD = Infinity;
      for (const t of entities.values()) {
        if (t === e || !t.alive || t.removed || t.van?.inert || t.projectile || isCreative(t)) continue;
        const d = dist3(e, t);
        for (const ty of gdef.types) {
          if (d > ty.max) continue;
          const p = gdef.prioritized ? ty.priority : 0;
          if (p > bestP || (p === bestP && d >= bestD)) continue;
          if (!testFilter(ty.filters, e, t)) continue;
          if ((ty.mustSee ?? gdef.mustSee) && !canSee(e, t)) continue;
          best = t; bestP = p; bestD = d;
        }
      }
      if (best) { b.target = best; return; }
    }
    if (cfg.hurtBy && validTarget(e, b.hurtBy) && now() - b.hurtByTick < 200) { b.target = b.hurtBy; return; }
    b.target = undefined;
  }

  let searches = 0;
  function pathTo(b, goal, near) {
    const e = b.e, t = now();
    const gk = `${Math.floor(goal.x)},${Math.floor(goal.y)},${Math.floor(goal.z)}`;
    const need = !b.path || (gk !== b.goalKey && t >= b.repathAt - 30) || t >= b.repathAt || b.dirty;
    if (!need || searches >= 10) return;
    searches++;
    const range = Math.max(b.cfg.follow, 24) + 8;
    const res = findPath(e, { x: goal.x, y: goal.y, z: goal.z, near }, range);
    b.dirty = false; b.goalKey = gk;
    b.repathAt = t + 20 + Math.floor(Math.random() * 20);
    if (!res) { b.path = undefined; b.partial = true; return; }
    b.path = res.nodes; b.at = 0; b.partial = res.partial; b.stuck = 0;
    if (res.partial) b.repathAt = t + 30 + Math.floor(Math.random() * 30);
  }

  function speedOf(e, b, mult) {
    let s = (e.moveOverride ?? b.cfg.speed) * mult;
    const slow = e.effectLevel("slowness"), fast = e.effectLevel("speed");
    return Math.max(0, s * (1 + 0.2 * fast) * (1 - 0.15 * slow));
  }

  // walk along the path at this speed; returns true while there is somewhere to go
  function follow(b, mult) {
    const e = b.e;
    if (!b.path || b.at >= b.path.length) return false;
    let n = b.path[b.at];
    const reach = Math.max(0.3, e.width * 0.5);
    while (Math.hypot(n.x + 0.5 - e.pos.x, n.z + 0.5 - e.pos.z) < reach && Math.abs(n.fy - e.pos.y) < 1.1) {
      b.at++;
      if (b.at >= b.path.length) return false;
      n = b.path[b.at];
    }
    const c = cell(n.x, n.y, n.z);
    if (c.door && !c.pass && b.cfg.doors) openDoor(n.x, n.y, n.z);
    const dx = n.x + 0.5 - e.pos.x, dz = n.z + 0.5 - e.pos.z, l = Math.hypot(dx, dz) || 1;
    b.want = { x: dx / l, z: dz / l, mult, up: n.fy - e.pos.y > 0.6 && l < 1.6, node: n };
    return true;
  }
  function openDoor(x, y, z) {
    for (const yy of [y, y + 1, y - 1]) {
      if (!blocks.inside(x, yy, z)) continue;
      const p = permAt(blocks.get(x, yy, z));
      if (p.collision.door && !p.collision.pass) { try { setBlock(x, yy, z, p.typeId, { ...p.states, open_bit: true }); } catch { /* not a door we know */ } }
    }
  }

  function think(b) {
    const e = b.e, cfg = b.cfg, t = now();
    b.want = undefined;
    if (!validTarget(e, b.target)) b.target = undefined;
    if ((t + b.scanAt) % 10 === 0 || (b.target === undefined && b.hurtBy && t - b.hurtByTick < 2)) scan(b);
    if (b.cd > 0) b.cd--;
    if (e.ridingOn) { fight(b, true); return; }
    if (!cfg.nav || !(cfg.speed > 0)) { fight(b, true); return; }
    if (cfg.avoid && flee(b)) return;
    if (b.target && (cfg.melee || cfg.ranged)) { fight(b, false); return; }
    // nothing to fight: stroll now and then
    if (cfg.stroll) {
      if (b.strolling) { if (!follow(b, cfg.stroll.speed_multiplier ?? 1)) { b.strolling = false; b.path = undefined; b.strollAt = t + 60 + Math.random() * 180; } } else if (t >= b.strollAt && searches < 10) {
        const gx = e.pos.x + (Math.random() * 2 - 1) * (cfg.stroll.xz_dist ?? 10), gz = e.pos.z + (Math.random() * 2 - 1) * (cfg.stroll.xz_dist ?? 10);
        let gy;
        for (let dy = 3; dy >= -4; dy--) if (!Number.isNaN(stand(Math.floor(gx), Math.floor(e.pos.y) + dy, Math.floor(gz), e.height))) { gy = Math.floor(e.pos.y) + dy; break; }
        b.strollAt = t + 60 + Math.random() * 180;
        if (gy !== undefined) { b.repathAt = 0; b.path = undefined; pathTo(b, { x: gx, y: gy, z: gz }, 1); if (b.path?.length && !b.partial) { b.strolling = true; b.repathAt = Infinity; } else b.path = undefined; }
      }
    } else if (b.path) b.path = undefined;
  }

  function flee(b) {
    const e = b.e, a = b.cfg.avoid;
    for (const ty of [].concat(a.entity_types ?? [])) {
      for (const o of entities.values()) {
        if (o === e || !o.alive || isCreative(o)) continue;
        const d = dist3(e, o);
        if (d > (ty.max_dist ?? a.max_dist ?? 6) || !testFilter(ty.filters, e, o)) continue;
        const l = Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) || 1;
        pathTo(b, { x: e.pos.x + ((e.pos.x - o.pos.x) / l) * 8, y: e.pos.y, z: e.pos.z + ((e.pos.z - o.pos.z) / l) * 8 }, 1.5);
        follow(b, ty.sprint_speed_multiplier ?? a.sprint_speed_multiplier ?? 1.2);
        return true;
      }
    }
    return false;
  }

  function fight(b, still) {
    const e = b.e, cfg = b.cfg, tg = b.target, t = now();
    if (!tg) return;
    b.strolling = false;
    const dx = tg.pos.x - e.pos.x, dz = tg.pos.z - e.pos.z, dy = tg.pos.y - e.pos.y;
    const d = Math.hypot(dx, dy, dz);
    face(e, tg);
    if (cfg.ranged && cfg.shooter) {
      const r = cfg.ranged, radius = r.attack_radius ?? 10;
      const sees = d <= radius && canSee(e, tg);
      if (sees) {
        if (b.shotCd <= 0) { shoot(b, tg); const lo = (r.attack_interval_min ?? r.attack_interval ?? 1) * 20, hi = (r.attack_interval_max ?? r.attack_interval ?? lo / 20) * 20; b.shotCd = Math.round(lo + Math.random() * Math.max(0, hi - lo)); } else b.shotCd--;
        b.path = undefined;
        return;
      }
      if (b.shotCd > 0) b.shotCd--;
      if (!still && (r.speed_multiplier ?? 1) > 0) { pathTo(b, tg.pos, 1.5); follow(b, r.speed_multiplier ?? 1); }
      return;
    }
    if (!cfg.melee) return;
    const reach2 = (e.width * (cfg.melee.reach_multiplier ?? 2)) ** 2 + tg.width;
    if (d * d <= reach2 || Math.hypot(dx, dz) ** 2 + Math.max(0, Math.abs(dy) - tg.height * 0.5) ** 2 <= reach2) {
      if (b.cd <= 0 && canSee(e, tg)) {
        b.cd = Math.round((cfg.melee.cooldown_time ?? 1) * 20); b.swingTick = t;
        const dmg = Array.isArray(cfg.damage) ? cfg.damage[0] + Math.random() * (cfg.damage[1] - cfg.damage[0]) : cfg.damage;
        fire.hitEntity(e, tg);
        const hit = dmg > 0 && damage(tg, dmg + 3 * e.effectLevel("strength") - 4 * e.effectLevel("weakness"), { cause: "entityAttack", damagingEntity: e });
        if (hit) knock(tg, dx, dz, 0.4);
      }
      if (Math.hypot(dx, dz) < Math.max(0.6, (e.width + tg.width) * 0.5)) return; // close enough: stand and swing
    }
    if (still) return;
    pathTo(b, tg.pos, Math.max(0.9, tg.width * 0.5 + 0.4));
    if (!follow(b, cfg.melee.speed_multiplier ?? 1) && !b.partial && d * d > reach2) {
      // the path is used up but the target is a step away: walk straight at it
      const l = Math.hypot(dx, dz) || 1;
      b.want = { x: dx / l, z: dz / l, mult: cfg.melee.speed_multiplier ?? 1, up: dy > 0.6 && l < 1.6 };
    }
  }
  function face(e, tg) {
    const dx = tg.pos.x - e.pos.x, dz = tg.pos.z - e.pos.z, dy = tg.pos.y + tg.height * 0.6 - (e.pos.y + e.height * 0.85);
    e.headYaw = Math.atan2(-dx, dz) / rad; e.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) / rad;
  }
  function knock(tg, dx, dz, power) {
    const k = power * (1 - (tg.ai?.cfg?.kb ?? 0));
    if (!(k > 0) || !tg.ai?.cfg?.physics) return;
    const l = Math.hypot(dx, dz) || 1;
    tg.vel.x = tg.vel.x / 2 + (dx / l) * k; tg.vel.z = tg.vel.z / 2 + (dz / l) * k;
    if (tg.onGround) tg.vel.y = Math.min(0.4, tg.vel.y / 2 + k);
  }

  // ---------- projectiles ----------
  function shoot(b, tg, type = b.cfg.shooter, powerOver) {
    const e = b.e;
    const def = entityDef(type) ?? {};
    const pj = def["minecraft:projectile"] ?? {};
    const arrow = type === "minecraft:arrow" || !def["minecraft:projectile"];
    const power = powerOver ?? pj.power ?? 1.6, gravity = pj.gravity ?? 0.05;
    const from = { x: e.pos.x, y: e.pos.y + e.height * 0.85 - 0.1, z: e.pos.z };
    const dx = tg.pos.x - from.x, dz = tg.pos.z - from.z, flat = Math.hypot(dx, dz);
    let dy = tg.pos.y + tg.height * 0.5 - from.y;
    if (gravity > 0) dy += flat * 0.2 * (gravity / 0.05) * (1.6 / power) ** 2 * 0.55;
    const l = Math.hypot(dx, dy, dz) || 1;
    const spread = (arrow ? 8 : pj.uncertainty_base ?? 0) * 0.0075;
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.2;
    const v = { x: (dx / l + g() * spread) * power, y: (dy / l + g() * spread) * power, z: (dz / l + g() * spread) * power };
    let p;
    try { p = spawn(type, from); } catch { return; }
    p.vel = v; p.yaw = Math.atan2(-v.x, v.z) / rad;
    const imp = pj.on_hit?.impact_damage;
    p.projectile = { owner: e, gravity, drag: pj.inertia ?? 0.99, born: now(), arrow, damage: imp?.damage, knock: imp?.knockback !== false, effect: pj.on_hit?.mob_effect, stuck: false };
    b.shootTick = now();
    hud.shot?.(e, p);
    return p;
  }
  let entityDef = () => undefined;
  function stepProjectile(p) {
    const pr = p.projectile, t = now();
    if (pr.stuck) { if (t - pr.stuckAt > 100) remove(p); return; }
    if (t - pr.born > 200) { remove(p); return; }
    const v = p.vel, len = Math.hypot(v.x, v.y, v.z);
    if (len < 1e-4) { remove(p); return; }
    const hitB = raycast(p.pos, v, len);
    let reach = hitB ? hitB.t : len, hitE;
    for (const o of entities.values()) {
      if (o === p || o === pr.owner || !o.alive || o.projectile || o.van?.inert || isCreative(o)) continue;
      if (o.ai?.cfg && !o.ai.cfg.collide && !o.families.includes("keep")) continue;
      if (Math.abs(o.pos.x - p.pos.x) > len + 2 || Math.abs(o.pos.z - p.pos.z) > len + 2) continue;
      const tt = segBox(p.pos, v, len, o);
      if (tt !== undefined && tt < reach) { reach = tt; hitE = o; }
    }
    const k = reach / len;
    p.pos.x += v.x * k; p.pos.y += v.y * k; p.pos.z += v.z * k;
    p.yaw = Math.atan2(-v.x, v.z) / rad; p.pitch = -Math.atan2(v.y, Math.hypot(v.x, v.z)) / rad;
    if (hitE) {
      const dmg = pr.arrow ? Math.ceil(len * 2) : Array.isArray(pr.damage) ? pr.damage[0] + Math.random() * (pr.damage[1] - pr.damage[0]) : pr.damage ?? 0;
      fire.projectileHitEntity(p, pr.owner, hitE);
      const did = dmg > 0 && damage(hitE, dmg, { cause: "projectile", damagingEntity: pr.owner, damagingProjectile: p });
      if (did && pr.knock) knock(hitE, v.x, v.z, 0.3);
      if (did && pr.effect?.effect) { try { hitE.addEffect(pr.effect.effect, pr.effect.durationnormal ?? pr.effect.duration ?? 100, { amplifier: pr.effect.amplifier ?? 0 }); } catch { /* no such effect */ } }
      remove(p);
      return;
    }
    if (hitB) { pr.stuck = true; pr.stuckAt = t; fire.projectileHitBlock(p, pr.owner, hitB); if (!pr.arrow) remove(p); return; }
    v.x *= pr.drag; v.y = v.y * pr.drag - pr.gravity; v.z *= pr.drag;
  }
  function segBox(o, v, len, e) {
    const w = e.width / 2 + 0.15, lo = [e.pos.x - w, e.pos.y - 0.1, e.pos.z - w], hi = [e.pos.x + w, e.pos.y + e.height + 0.1, e.pos.z + w];
    const p = [o.x, o.y, o.z], d = [v.x / len, v.y / len, v.z / len];
    let t0 = 0, t1 = len;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (p[i] < lo[i] || p[i] > hi[i]) return undefined; continue; }
      let a = (lo[i] - p[i]) / d[i], b = (hi[i] - p[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return undefined;
    }
    return t0;
  }

  // ---------- bodies ----------
  // does a box (centre x,z; feet y; half width w; height h) hit a block? returns the highest block top it hits, or -Infinity
  function boxHit(x, y, z, w, h) {
    let top = -Infinity;
    const x0 = Math.floor(x - w), x1 = Math.floor(x + w - 1e-9), z0 = Math.floor(z - w), z1 = Math.floor(z + w - 1e-9), y0 = Math.floor(y) - 1, y1 = Math.floor(y + h - 1e-9);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) {
      const c = cell(bx, by, bz);
      if (c.pass || c === OUT) continue;
      const t = by + c.h;
      if (t > y + 1e-9 && by < y + h) top = Math.max(top, t);
    }
    return top;
  }
  function move(b) {
    const e = b.e, cfg = b.cfg, v = e.vel, w = e.width / 2, h = e.height;
    const px = e.pos.x, pz = e.pos.z;
    if (cfg.flies) return fly(b);
    // the will to walk
    if (b.want && e.alive) {
      const s = speedOf(e, b, b.want.mult);
      const a = e.onGround ? 0.98 * s * s : 0.02 * 0.98 * s;
      v.x += b.want.x * a; v.z += b.want.z * a;
      e.yaw = turn(e.yaw, Math.atan2(-b.want.x, b.want.z) / rad, 30);
      if (!b.target) e.headYaw = e.yaw;
      if (b.want.up && e.onGround) v.y = 0.42 + 0.1 * e.effectLevel("jump_boost");
    } else if (b.target) e.yaw = turn(e.yaw, e.headYaw, 20);
    if (!cfg.collide) { e.pos.x += v.x; e.pos.y += v.y; e.pos.z += v.z; v.x *= 0.546; v.z *= 0.546; if (cfg.gravity) v.y = (v.y - 0.08) * 0.98; else v.y *= 0.5; return; }
    // water
    const here = cell(Math.floor(e.pos.x), Math.floor(e.pos.y + 0.4), Math.floor(e.pos.z));
    e.inWater = !!here.liquid;
    if (e.inWater && cfg.float && e.alive) v.y += 0.04 + (v.y < 0 ? 0.03 : 0);
    if (cfg.climb && here.climb) { v.y = b.want ? (b.want.node && b.want.node.fy > e.pos.y + 0.1 ? 0.2 : b.want.node && b.want.node.fy < e.pos.y - 0.1 ? -0.15 : 0) : Math.max(v.y, -0.15); b.fall = 0; }
    // up and down
    let ny = e.pos.y + v.y, ground = false;
    const top = boxHit(e.pos.x, ny, e.pos.z, w, h);
    if (top > -Infinity) {
      if (v.y > 0 && top > e.pos.y + h - 0.01) { ny = e.pos.y; v.y = 0; } // bumped its head
      else if (top <= e.pos.y + 1e-6) { ny = top; ground = true; } // landed
      else { ny = top - e.pos.y <= 1.01 ? top : e.pos.y; ground = true; } // a block appeared in it: stand on top
    }
    if (ground) { if (b.fall > 3.5 && !cfg.fallImmune && e.alive) damage(e, Math.ceil(b.fall - 3), { cause: "fall" }); b.fall = 0; v.y = 0; } else if (v.y < 0) b.fall += e.pos.y - ny;
    e.pos.y = ny; e.onGround = ground;
    // sideways, one axis at a time, stepping up small rises
    let bumped = false;
    for (const ax of ["x", "z"]) {
      const d = v[ax];
      if (Math.abs(d) < 1e-5) continue;
      const nx = ax === "x" ? e.pos.x + d : e.pos.x, nz = ax === "z" ? e.pos.z + d : e.pos.z;
      const top = boxHit(nx, e.pos.y, nz, w, h);
      if (top === -Infinity) { e.pos.x = nx; e.pos.z = nz; continue; }
      const rise = top - e.pos.y;
      if (e.onGround && rise <= 0.6 + 1e-6 && boxHit(nx, top, nz, w, h) === -Infinity) { e.pos.x = nx; e.pos.z = nz; e.pos.y = top; continue; }
      v[ax] = 0; bumped = true;
    }
    if (bumped && b.want && e.onGround && e.alive && b.want.node && b.want.node.fy > e.pos.y + 0.1) v.y = 0.42;
    const f = e.onGround ? 0.546 : 0.91;
    v.x *= f; v.z *= f;
    if (cfg.gravity) v.y = e.inWater ? (v.y - 0.02) * 0.8 : (v.y - 0.08) * 0.98; else v.y = 0;
    if (e.pos.y < blocks.yRange[0] - 8) { damage(e, 1000, { cause: "void" }); if (e.alive) remove(e); }
    b.moving = Math.hypot(e.pos.x - px, e.pos.z - pz);
    // going nowhere on a path: think again
    if (b.want && b.path) { if (b.moving < 0.01) { if (++b.stuck > 30) { b.dirty = true; b.stuck = 0; b.repathAt = 0; } } else b.stuck = 0; }
  }
  function fly(b) {
    const e = b.e, w = e.width / 2, px = e.pos.x, pz = e.pos.z;
    const s = Math.min(0.35, 2.2 * speedOf(e, b, 1) ** 2 + 0.05);
    let gx, gy, gz;
    if (b.target) { gx = b.target.pos.x; gy = b.target.pos.y + (b.cfg.ranged ? 4 : 0.6); gz = b.target.pos.z; } else {
      if (!b.hover || now() > b.hoverAt) { b.hover = { x: e.pos.x + (Math.random() * 2 - 1) * 8, y: e.pos.y + (Math.random() * 2 - 1) * 2, z: e.pos.z + (Math.random() * 2 - 1) * 8 }; b.hoverAt = now() + 80 + Math.random() * 80; }
      gx = b.hover.x; gy = b.hover.y; gz = b.hover.z;
    }
    const dx = gx - e.pos.x, dy = gy - e.pos.y, dz = gz - e.pos.z, l = Math.hypot(dx, dy, dz);
    const stop = b.target && !b.cfg.ranged ? 0.8 : b.target ? 6 : 0.5;
    const v = e.vel;
    if (l > stop) { v.x += (dx / l) * s * 0.3; v.y += (dy / l) * s * 0.3; v.z += (dz / l) * s * 0.3; }
    for (const ax of ["x", "y", "z"]) {
      const n = { x: e.pos.x, y: e.pos.y, z: e.pos.z }; n[ax] += v[ax];
      if (boxHit(n.x, n.y, n.z, w, e.height) === -Infinity && !(ax === "y" && v.y < 0 && boxHit(n.x, n.y, n.z, w, e.height) > -Infinity)) e.pos[ax] = n[ax]; else { if (ax !== "y") v.y += 0.03; v[ax] = 0; }
      v[ax] *= 0.7;
    }
    if (Math.hypot(v.x, v.z) > 0.01) e.yaw = turn(e.yaw, Math.atan2(-v.x, v.z) / rad, 30);
    e.onGround = false; b.moving = Math.hypot(e.pos.x - px, e.pos.z - pz);
  }
  function turn(from, to, max) { let d = ((to - from + 540) % 360) - 180; d = Math.max(-max, Math.min(max, d)); return from + d; }

  function burn(b) {
    const e = b.e;
    if (b.cfg.fireImmune || !e.alive) return;
    const id = idAt(Math.floor(e.pos.x), Math.floor(e.pos.y + 0.1), Math.floor(e.pos.z));
    if (id === "minecraft:fire" || id === "minecraft:soul_fire") damage(e, 1, { cause: "fire" });
    else if (id === "minecraft:lava" || id === "minecraft:flowing_lava") damage(e, 4, { cause: "lava" });
  }

  function tick() {
    const t = now();
    searches = 0;
    // blocks that changed since last tick: paths through them are stale, and blocked creatures should look again
    if (changes.length) {
      const many = changes.length > 40;
      for (const b of brains) {
        if (b.partial || many) { b.repathAt = Math.min(b.repathAt, t + Math.floor(Math.random() * 10)); continue; }
        if (!b.path) continue;
        outer: for (let i = b.at; i < b.path.length; i++) { const n = b.path[i]; for (const c of changes) if (Math.abs(c[0] - n.x) <= 1 && Math.abs(c[2] - n.z) <= 1 && c[1] - n.y >= -2 && c[1] - n.y <= 2) { b.dirty = true; break outer; } }
      }
      changes = [];
    }
    const list = [];
    for (const b of brains) {
      const e = b.e;
      if (e.removed) { brains.delete(b); continue; }
      list.push(b);
      if (e.ridingOn) {
        const m = e.ridingOn, seat = [].concat(m.comp["minecraft:rideable"]?.seats ?? [])[Math.max(0, m.riders.indexOf(e))]?.position ?? [0, m.height * 0.75, 0];
        const yw = m.yaw * rad;
        e.pos.x = m.pos.x + seat[0] * Math.cos(yw) - seat[2] * Math.sin(yw); e.pos.y = m.pos.y + seat[1]; e.pos.z = m.pos.z + seat[0] * Math.sin(yw) + seat[2] * Math.cos(yw);
        e.vel.x = e.vel.y = e.vel.z = 0; if (!b.target) e.yaw = m.yaw;
        if (e.alive) think(b);
        continue;
      }
      if (e.alive) think(b); else b.want = undefined;
      if (b.cfg.physics) move(b);
      if (t % 10 === 0) burn(b);
    }
    // creatures shoulder each other apart
    for (let i = 0; i < list.length; i++) {
      const a = list[i].e;
      if (!list[i].cfg.pushable || !a.alive || a.ridingOn) continue;
      for (let j = i + 1; j < list.length; j++) {
        const c = list[j].e;
        if (!list[j].cfg.pushable || !c.alive || c.ridingOn) continue;
        const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, r = (a.width + c.width) / 2;
        if (Math.abs(dx) >= r || Math.abs(dz) >= r || Math.abs(c.pos.y - a.pos.y) > 1.5) continue;
        const l = Math.hypot(dx, dz);
        const ux = l > 0.01 ? dx / l : Math.random() - 0.5, uz = l > 0.01 ? dz / l : Math.random() - 0.5;
        const k = Math.min(0.05, (r - l) * 0.5 + 0.01);
        a.vel.x -= ux * k; a.vel.z -= uz * k; c.vel.x += ux * k; c.vel.z += uz * k;
      }
    }
    for (const e of entities.values()) if (e.projectile && !e.removed) stepProjectile(e);
  }

  return {
    attach, tick, raycast, testFilter, canSee, findPath, stand,
    blockChanged(x, y, z) { changes.push([x, y, z]); },
    setDefs(fn) { entityDef = fn; },
    shoot: (e, target, type, power) => shoot(e.ai, target, type, power),
    brains,
  };
}
