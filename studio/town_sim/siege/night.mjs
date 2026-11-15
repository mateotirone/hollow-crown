// One siege night, live, in the Town Builder page: the game bundle (build.mjs) running on engine.mjs over the page's
// own block world, and every creature drawn from the resource pack by models.mjs.
//
//   const night = await createNight({ THREE, parent, world, files, town, opts, ui });
//   night.step(dt, speed);            // advance the game (20 ticks a second at speed 1)
//   night.draw(dt, camera, ctx, w, h); // move the models, draw name tags and health on a 2D canvas
//   night.stop();                     // take everything away and put the town's blocks back as they were
//
// world: the page's blocks, in the page's coordinates (x, z from the Plot Stone):
//   { cx, cz, base, yRange, inside(x,y,z), get(x,y,z), set(x,y,z,index), palette: [[id, states]], add(id, states, like) -> index,
//     puff(x,y,z,[r,g,b]) }
// The game itself runs in the map's real coordinates (the wall's shape and its guard posts depend on them).
import { createEngine } from "./engine.mjs";
import { prepare } from "./setup.mjs";
import { createModels } from "./models.mjs";

export { createEngine, prepare, createModels };

// mulberry32: the night's dice. The same seed plays the same night.
export function dice(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const HUD_CHANNEL = /^hc\w:/; // the add-on drives its own HUD panels (minimap, Regals, quest) through titles spelled like this
const D2R = Math.PI / 180;

export async function createNight({ THREE, parent, world, files, town, opts = {}, ui = {} }) {
  const { cx, cz } = world;
  const rnd = dice(opts.seed ?? 1);
  const seeded = (fn) => { const real = Math.random; Math.random = rnd; try { return fn(); } finally { Math.random = real; } };

  // ---------- the block world, as the game sees it ----------
  const sortStates = (st) => Object.fromEntries(Object.entries(st ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)));
  const pkey = new Map();
  world.palette.forEach((p, i) => { const k = JSON.stringify([p[0], sortStates(p[1])]); if (!pkey.has(k)) pkey.set(k, i); });
  const changed = new Map(); // "x,y,z" -> what stood there before the night
  const blocks = {
    palette: world.palette, yRange: world.yRange,
    inside: (x, y, z) => world.inside(x - cx, y, z - cz),
    get: (x, y, z) => world.get(x - cx, y, z - cz),
    set(x, y, z, i) {
      const px = x - cx, pz = z - cz, k = `${px},${y},${pz}`;
      if (!changed.has(k)) changed.set(k, world.get(px, y, pz));
      world.set(px, y, pz, i);
    },
    // a block in a state the page hasn't drawn yet looks like the nearest state of the same block that it has
    indexFor(id, states) {
      const st = sortStates(states), k = JSON.stringify([id, st]);
      let i = pkey.get(k);
      if (i !== undefined) return i;
      let like = -1, best = -1;
      world.palette.forEach((p, j) => {
        if (p[0] !== id) return;
        const mine = Object.entries(p[1] ?? {});
        const same = mine.filter(([key, v]) => st[key] === v).length, clash = mine.filter(([key, v]) => key in st && st[key] !== v).length;
        const score = same * 2 - clash * 5 + 1;
        if (score > best) { best = score; like = j; }
      });
      if (like < 0) { // a block the town has none of: the one whose name is nearest (spruce_log -> stripped_spruce_log)
        const words = new Set(id.replace(/^\w+:/, "").split("_"));
        world.palette.forEach((p, j) => { const w = p[0].replace(/^\w+:/, "").split("_"), score = w.filter((x) => words.has(x)).length * 2 - w.length * 0.1; if (score >= 1.5 && score > best) { best = score; like = j; } });
      }
      i = world.add(id, st, like);
      pkey.set(k, i);
      return i;
    },
  };

  // ---------- the game ----------
  const hudState = { title: "", subtitle: "", titleAt: -1e9, bar: "", barAt: -1e9 };
  const fx = []; // arrows' trails and the like are not drawn; explosions and broken blocks are
  const hud = {
    title(t, s) { if (HUD_CHANNEL.test(t ?? "")) return; hudState.title = t ?? ""; hudState.subtitle = s ?? ""; hudState.titleAt = performance.now(); ui.title?.(t ?? "", s ?? ""); },
    actionBar(t) { if (HUD_CHANNEL.test(t ?? "")) return; hudState.bar = t; hudState.barAt = performance.now(); ui.actionBar?.(t); },
    chat(t) { ui.chat?.(String(t)); },
    explosion(loc, radius) { const n = Math.min(60, 12 + radius * 8); for (let i = 0; i < n; i++) world.puff(loc.x - cx + (Math.random() - 0.5) * radius * 1.6 - 0.5, loc.y + (Math.random() - 0.3) * radius, loc.z - cz + (Math.random() - 0.5) * radius * 1.6 - 0.5, i % 3 ? [70, 66, 60] : [255, 170, 60]); },
    broke(x, y, z) { world.puff(x - cx, y, z - cz); },
    particle(id, loc) { if (!loc || Math.random() > 0.35) return; const c = /flame|fire|lava|ember|spark/.test(id) ? [255, 160, 50] : /smoke|soot|ash/.test(id) ? [90, 90, 90] : /heart|heal|happy/.test(id) ? [120, 220, 110] : /crit|hit|damage|blood/.test(id) ? [200, 60, 50] : [225, 225, 235]; world.puff(loc.x - cx - 0.5, loc.y - 0.3, loc.z - cz - 0.5, c, 0.45); },
  };
  const errors = [];
  const mc = createEngine({ blocks, data: files.pack, hud, log: (m) => errors.push(String(m)) });
  globalThis.__mc = { lookup: mc.lookup };
  const quiet = console.warn; // the game's own start-up self-tests talk to the console
  let G;
  try {
    console.warn = () => {};
    seeded(() => new Function(files.game)());
    G = globalThis.__game;
    const k = town.keep;
    seeded(() => {
      mc.start({ playerAt: { x: k.x + 0.5, y: k.y, z: k.z + 2.5 }, name: town.owner ?? "You", gameMode: opts.gameMode ?? "Creative", time: 13000 });
      for (let i = 0; i < 60; i++) mc.tick();
    });
  } finally { console.warn = quiet; }
  const sim = seeded(() => prepare({ mc, G, town: { ...town, wait: true }, log: (m) => errors.push(String(m)) }));
  // the wall's watchtowers go up (the game's own build job), then the garrison takes its posts
  seeded(() => { for (let i = 0; i < 2400 && sim.watchRising(); i++) mc.tick(); for (let i = 0; i < 10; i++) mc.tick(); sim.garrison(); for (let i = 0; i < 100; i++) mc.tick(); });
  hudState.titleAt = -1e9; hudState.barAt = -1e9;

  // ---------- the creatures ----------
  const models = createModels(THREE, files.look);
  const root = new THREE.Group(); root.position.y = -world.base; parent.add(root);
  const views = new Map(); // entity id -> what is drawn for it
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const shaftGeo = new THREE.BoxGeometry(0.06, 0.06, 0.9);
  const plain = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const PLAIN = { player: plain(0x3f78c9), skin: plain(0xd9a877), shaft: plain(0xd8d2c0), other: plain(0x9a8f7a), item: plain(0xe0c060) };
  const NIGHT = new THREE.Color(0.62, 0.68, 0.9), HURT = new THREE.Color(1, 0.45, 0.45);
  const isShot = (e) => /arrow|bolt|projectile|snowball|fireball/.test(e.typeId) || !!e.comp?.["minecraft:projectile"];
  function standIn(e) { // a creature the resource pack has no model for (vanilla ones: the player, an arrow, a dropped item)
    const g = new THREE.Group();
    if (isShot(e)) g.add(new THREE.Mesh(shaftGeo, PLAIN.shaft));
    else if (e.typeId === "minecraft:item") { const m = new THREE.Mesh(boxGeo, PLAIN.item); m.scale.setScalar(0.25); g.add(m); }
    else {
      const w = e.width ?? 0.6, h = e.height ?? 1.8, body = new THREE.Mesh(boxGeo, e.typeId === "minecraft:player" ? PLAIN.player : PLAIN.other);
      body.scale.set(w, h * 0.72, w * 0.6); g.add(body);
      const head = new THREE.Mesh(boxGeo, PLAIN.skin); head.scale.set(w * 0.8, h * 0.26, w * 0.8); head.position.y = h * 0.73; g.add(head);
    }
    return g;
  }
  function viewOf(e) {
    let v = views.get(e.id);
    if (v) return v;
    v = { e, x0: e.pos.x, y0: e.pos.y, z0: e.pos.z, yaw0: e.yaw, x1: e.pos.x, y1: e.pos.y, z1: e.pos.z, yaw1: e.yaw, amt: 0, amt0: 0, dist: 0, dist0: 0, model: undefined, group: undefined };
    if (models.has(e.typeId) && !isShot(e)) { v.model = models.create(e.typeId); v.group = v.model.group; } else v.group = standIn(e);
    root.add(v.group);
    views.set(e.id, v);
    return v;
  }
  const wrap = (a) => ((a % 360) + 540) % 360 - 180;
  function afterTick() {
    for (const e of mc.entities.values()) {
      const v = viewOf(e);
      v.x0 = v.x1; v.y0 = v.y1; v.z0 = v.z1; v.yaw0 = v.yaw1; v.amt0 = v.amt; v.dist0 = v.dist;
      v.x1 = e.pos.x; v.y1 = e.pos.y; v.z1 = e.pos.z; v.yaw1 = e.yaw;
      const d = Math.hypot(v.x1 - v.x0, v.z1 - v.z0);
      if (d > 8) { v.x0 = v.x1; v.y0 = v.y1; v.z0 = v.z1; v.yaw0 = v.yaw1; } // teleported: don't slide across the map
      else { v.amt += (Math.min(1, d * 4) - v.amt) * 0.4; v.dist += v.amt; }
    }
  }
  afterTick();

  // the Molang "query." values a creature's animations read
  function queryFor(v, a, dt) {
    const e = v.e, b = e.ai ?? {}, now = mc.now + a;
    const swing = (now - (b.swingTick ?? -100)) / 6, drawn = now - (b.shootTick ?? -100);
    const q = {
      modified_move_speed: v.amt0 + (v.amt - v.amt0) * a, modified_distance_moved: v.dist0 + (v.dist - v.dist0) * a, walk_distance: v.dist0 + (v.dist - v.dist0) * a,
      life_time: (now - e.born) / 20, hurt_time: Math.max(0, 10 - (now - e.hurtTick)), attack_time: swing >= 0 && swing < 1 ? swing : 0,
      has_target: b.target ? 1 : 0, target_x_rotation: e.pitch ?? 0, target_y_rotation: wrap((e.headYaw ?? e.yaw) - e.yaw), is_alive: e.alive ? 1 : 0,
      is_charged: b.cfg?.ranged && b.target && drawn > 8 ? 1 : 0, item_is_charged: 0, is_ignited: 0, is_riding: e.ridingOn ? 1 : 0, is_saddled: 0, is_spectator: 0, has_rider: e.riders?.length ? 1 : 0,
      is_on_ground: e.onGround ? 1 : 0, vertical_speed: e.vel.y * 20, is_sneaking: 0, is_sleeping: 0, is_invisible: 0, is_in_water: e.inWater ? 1 : 0, is_gliding: 0, is_sprinting: 0, blocking: 0,
      is_emoting: 0, is_crawling: 0, is_grazing: 0, is_standing: 0, has_head_gear: 0, main_hand_item_use_duration: 0, main_hand_item_max_duration: 1,
      variant: e.comp?.["minecraft:variant"]?.value ?? 0, mark_variant: e.comp?.["minecraft:mark_variant"]?.value ?? 0, time_of_day: ((mc.time % 24000) + 6000) % 24000 / 24000, moon_phase: 0, delta_time: dt,
      ground_speed: Math.hypot(v.x1 - v.x0, v.z1 - v.z0) * 20, health: e.health, max_health: e.maxHealth, scale: e.scale ?? 1,
    };
    const props = e.properties ?? {};
    const fn = (f, val) => { f.valueOf = () => val; return f; };
    for (const name of models.called) {
      switch (name) {
        case "property": q.property = (n) => props[n] ?? 0; break;
        case "has_property": q.has_property = (n) => (n in props ? 1 : 0); break;
        case "get_equipped_item_name": q[name] = () => ""; break;
        case "position_delta": q[name] = (i) => [v.x1 - v.x0, v.y1 - v.y0, v.z1 - v.z0][i] ?? 0; break;
        case "armor_color_slot": q[name] = () => 1; break;
        default: { const val = typeof q[name] === "number" ? q[name] : 0; q[name] = fn(() => val, val); }
      }
    }
    return q;
  }

  // paths the raiders are walking (a debug overlay)
  const pathLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.9, depthTest: false }));
  pathLines.frustumCulled = false; pathLines.renderOrder = 6; pathLines.visible = false; root.add(pathLines);
  let pathsAt = -1;
  function drawPaths() {
    if (pathsAt === mc.now) return;
    pathsAt = mc.now;
    const pts = [];
    for (const e of mc.entities.values()) {
      const b = e.ai;
      if (!e.alive || !b?.path?.length) continue;
      let px = e.pos.x - cx, py = e.pos.y + 0.3, pz = e.pos.z - cz;
      for (let i = b.at ?? 0; i < b.path.length; i++) { const n = b.path[i], x = n.x + 0.5 - cx, y = (n.fy ?? n.y) + 0.3, z = n.z + 0.5 - cz; pts.push(px, py, pz, x, y, z); px = x; py = y; pz = z; }
    }
    pathLines.geometry.dispose();
    pathLines.geometry = new THREE.BufferGeometry();
    pathLines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }

  // ---------- running ----------
  let acc = 0, stopped = false, endedTold = false, began = false;
  const V = new THREE.Vector3();
  const api = {
    mc, G, sim, errors, views, hudState,
    get changed() { return changed.size; }, changes: changed,
    begin() { if (began) return; began = true; seeded(() => sim.begin({ provoked: !!opts.provoked })); afterTick(); },
    step(dt, speed) {
      if (stopped) return;
      acc += dt * 20 * speed;
      const t0 = performance.now(), real = Math.random;
      Math.random = rnd;
      try { while (acc >= 1) { mc.tick(); afterTick(); acc -= 1; if (performance.now() - t0 > 18) { acc = Math.min(acc, 1); break; } } } finally { Math.random = real; }
      if (sim.outcome.ended && !endedTold) { endedTold = true; ui.ended?.(sim.outcome.result ?? "over"); }
    },
    status: () => sim.status(),
    command(text) {
      const t = text.trim().replace(/^\//, "");
      const m = /^scriptevent\s+(\S+)\s*([\s\S]*)$/.exec(t);
      return seeded(() => (m ? (mc.scriptEvent(m[1], m[2]), "sent") : JSON.stringify(mc.runCommand(t))));
    },
    draw(dt, camera, ctx, w, h, show = {}) {
      const a = Math.min(1, acc), nightTint = show.dark === false ? undefined : NIGHT;
      for (const [id, v] of views) {
        const e = v.e;
        if (e.removed) { root.remove(v.group); if (v.model) models.dispose(v.model); views.delete(id); continue; }
        const g = v.group;
        const x = v.x0 + (v.x1 - v.x0) * a, y = v.y0 + (v.y1 - v.y0) * a, z = v.z0 + (v.z1 - v.z0) * a;
        g.position.set(x - cx, y, z - cz);
        if (v.model) {
          const yaw = v.yaw0 + wrap(v.yaw1 - v.yaw0) * a;
          g.rotation.set(0, Math.PI - yaw * D2R, 0);
          g.scale.setScalar(e.scale ?? 1);
          const hurt = mc.now - e.hurtTick < 8 || !e.alive;
          v.model.tint.setRGB(1, 1, 1); if (nightTint) v.model.tint.multiply(nightTint); if (hurt) v.model.tint.multiply(HURT);
          models.update(v.model, queryFor(v, a, dt), dt);
          if (!v.checked) { v.checked = true; if (!v.model.layers.length) { v.plain = standIn(e); g.add(v.plain); } } // a model the pack borrows from vanilla
          if (!e.alive && e.deathTick >= 0 && !(e.def?.components?.["minecraft:health"]?.max > 150)) g.rotation.z = Math.min(1, (mc.now + a - e.deathTick) / 12) * (Math.PI / 2);
        } else if (isShot(e)) {
          const sp = Math.hypot(e.vel.x, e.vel.y, e.vel.z);
          if (sp > 0.01) { V.set(g.position.x + e.vel.x, g.position.y + e.vel.y, g.position.z + e.vel.z); g.lookAt(V.x, V.y - world.base, V.z); }
        } else g.rotation.set(0, Math.PI - (v.yaw0 + wrap(v.yaw1 - v.yaw0) * a) * D2R, e.alive ? 0 : Math.PI / 2);
      }
      pathLines.visible = !!show.paths;
      if (show.paths) drawPaths();
      // names and health, the way the game floats them over a head
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center"; ctx.font = "600 11px system-ui, sans-serif";
      for (const v of views.values()) {
        const e = v.e;
        if (!e.alive || isShot(e) || e.typeId === "minecraft:item") continue;
        const heart = e.typeId === G.constants.KEEP_HEART;
        const name = heart ? "Keep" : e._name || "";
        const bar = show.health && e.maxHealth > 1 && (e.health < e.maxHealth || heart || show.health === "all");
        if (!name && !bar) continue;
        V.set(v.group.position.x, v.group.position.y - world.base + (e.height ?? 1.8) * (e.scale ?? 1) + 0.45, v.group.position.z).project(camera);
        if (V.z > 1 || V.z < -1 || Math.abs(V.x) > 1.1 || Math.abs(V.y) > 1.1) continue;
        const sx = (V.x + 1) / 2 * w, sy = (1 - V.y) / 2 * h;
        let ty = sy;
        if (bar) {
          if (heart) v.full = Math.max(v.full ?? 0, e.health);
          const bw = heart ? 70 : 34, f = Math.max(0, e.health / (heart ? v.full : e.maxHealth));
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(sx - bw / 2 - 1, ty - 5, bw + 2, 6);
          ctx.fillStyle = f > 0.5 ? "#5fd35f" : f > 0.25 ? "#e8c13a" : "#e2533b"; ctx.fillRect(sx - bw / 2, ty - 4, bw * f, 4);
          if (show.numbers || heart) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 3; const t = heart ? `${Math.ceil(e.health)}` : `${Math.ceil(e.health)}/${Math.round(e.maxHealth)}`; ctx.strokeText(t, sx + bw / 2 + 22, ty + 1); ctx.fillText(t, sx + bw / 2 + 22, ty + 1); }
          ty -= 9;
        }
        if (name && (show.names || heart)) { const label = name.replace(/§./g, "").split("\n")[0]; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.strokeText(label, sx, ty); ctx.fillStyle = "#fff"; ctx.fillText(label, sx, ty); }
      }
    },
    // every creature's place, for the page's own tools (the camera's "follow the fight")
    centreOfFight() { let n = 0, sx = 0, sy = 0, sz = 0; for (const e of mc.entities.values()) if (e.alive && e.tags.has(G.constants.RAIDER_TAG)) { sx += e.pos.x; sy += e.pos.y; sz += e.pos.z; n++; } return n ? [sx / n - cx, sy / n, sz / n - cz, n] : undefined; },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const v of views.values()) { root.remove(v.group); if (v.model) models.dispose(v.model); }
      views.clear(); parent.remove(root); pathLines.geometry.dispose();
      for (const [k, was] of changed) { const [x, y, z] = k.split(",").map(Number); world.set(x, y, z, was); }
      changed.clear();
      if (globalThis.__game === G) delete globalThis.__game;
    },
  };
  return api;
}
