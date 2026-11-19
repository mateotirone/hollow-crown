// Draws the pack's own creatures in three.js: the resource pack's client entity files, geometry, textures, render
// controllers, animations and animation controllers, read as they are (build.mjs packs them into look.json).
//
//   const models = createModels(THREE, look);
//   const view = models.create(typeId);          // { group } to add to the scene (1 unit = 1 block)
//   models.update(view, query, dt);              // query: the Molang "query." values for this creature this frame
//
// Bedrock conventions (Blockbench's): model x is flipped, x and y rotations are negated, rotation order ZYX, sizes in
// sixteenths of a block, the model's face looks to -z. Not drawn: items held in the hand (attachables), particles,
// and the three vanilla humanoid animations other than the head following its target.

const D2R = Math.PI / 180;

export function createModels(THREE, look) {
  // ---------- Molang ----------
  const M = { sin: (d) => Math.sin(d * D2R), cos: (d) => Math.cos(d * D2R), abs: Math.abs, min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round, sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp,
    clamp: (v, a, b) => Math.min(Math.max(v, a), b), lerp: (a, b, t) => a + (b - a) * t, mod: (a, b) => a % b, random: (a, b) => a + Math.random() * (b - a), atan2: (y, x) => Math.atan2(y, x) / D2R, pi: Math.PI,
    lerprotate: (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t, trunc: Math.trunc, sign: Math.sign };
  const fns = new Map();
  function mol(src) {
    if (typeof src === "number") return () => src;
    if (typeof src === "boolean") return () => (src ? 1 : 0);
    let f = fns.get(src);
    if (f) return f;
    const js = String(src).replace(/\b[Mm]ath\./g, "M.").replace(/\bquery\./g, "q.").replace(/\bvariable\./g, "v.").replace(/\btemp\.|\bt\./g, "v.").replace(/;\s*$/, "");
    let raw;
    try { raw = new Function("M", "q", "v", `return (${js});`); } catch { raw = () => 0; }
    f = (q, v) => { try { const r = raw(M, q, v); return typeof r === "number" ? (Number.isFinite(r) ? r : 0) : r === true ? 1 : r ? Number(r) || 0 : 0; } catch { return 0; } };
    fns.set(src, f);
    return f;
  }
  const pre = new Map();
  function runPre(lines, q, v) {
    for (const l of lines ?? []) {
      let p = pre.get(l);
      if (!p) { const m = /^\s*(?:variable|v)\.(\w+)\s*=\s*([\s\S]*?);?\s*$/.exec(l); p = m ? [m[1], mol(m[2])] : null; pre.set(l, p); }
      if (p) v[p[0]] = p[1](q, v);
    }
  }

  // ---------- textures ----------
  const texes = new Map();
  function texture(path) {
    let t = texes.get(path);
    if (t) return t;
    t = new THREE.Texture();
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
    const b64 = look.tex[path];
    if (b64 && typeof Image !== "undefined") { const img = new Image(); img.onload = () => { t.image = img; t.needsUpdate = true; }; img.src = `data:image/png;base64,${b64}`; }
    texes.set(path, t);
    return t;
  }

  // ---------- geometry: one mesh per bone, its cubes merged ----------
  const geos = new Map();
  function cubeInto(c, tw, th, pivot, pos, uvs, idx) {
    const inf = c.inflate || 0;
    const [sx, sy, sz] = c.size, [ox, oy, oz] = c.origin;
    const x0 = -(ox + sx) - inf, x1 = -ox + inf, y0 = oy - inf, y1 = oy + sy + inf, z0 = oz - inf, z1 = oz + sz + inf;
    const W = Math.ceil(sx), H = Math.ceil(sy), Dd = Math.ceil(sz);
    const [u, v] = Array.isArray(c.uv) ? c.uv : [0, 0];
    let F = {
      north: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], uvN: [u + Dd, v + Dd, u + Dd + W, v + Dd + H],
      south: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], uvS: [u + 2 * Dd + W, v + Dd, u + 2 * Dd + 2 * W, v + Dd + H],
      east: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], uvE: [u, v + Dd, u + Dd, v + Dd + H],
      west: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], uvW: [u + Dd + W, v + Dd, u + 2 * Dd + W, v + Dd + H],
      up: [[x1, y1, z1], [x0, y1, z1], [x0, y1, z0], [x1, y1, z0]], uvU: [u + Dd, v, u + Dd + W, v + Dd],
      down: [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], uvD: [u + Dd + W, v, u + Dd + 2 * W, v + Dd],
    };
    if (c.uv && !Array.isArray(c.uv)) {
      const pf = (k) => { const e = c.uv[k]; return e ? [e.uv[0], e.uv[1], e.uv[0] + (e.uv_size?.[0] ?? 0), e.uv[1] + (e.uv_size?.[1] ?? 0)] : [0, 0, 0, 0]; };
      F.uvN = pf("north"); F.uvS = pf("south"); F.uvE = pf("east"); F.uvW = pf("west"); F.uvU = pf("up"); F.uvD = pf("down");
    } else if (c.mirror) { const t = F.uvE; F.uvE = F.uvW; F.uvW = t; for (const k of ["uvN", "uvS", "uvE", "uvW", "uvU", "uvD"]) F[k] = [F[k][2], F[k][1], F[k][0], F[k][3]]; }
    let mat;
    if (c.rotation) {
      const p = c.pivot || [0, 0, 0];
      mat = new THREE.Matrix4().makeTranslation(-p[0], p[1], p[2])
        .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-c.rotation[0] * D2R, -c.rotation[1] * D2R, c.rotation[2] * D2R, "ZYX")))
        .multiply(new THREE.Matrix4().makeTranslation(p[0], -p[1], -p[2]));
    }
    const V = new THREE.Vector3();
    for (const [f, k] of [["north", "uvN"], ["south", "uvS"], ["east", "uvE"], ["west", "uvW"], ["up", "uvU"], ["down", "uvD"]]) {
      const q = F[f], r = F[k], b = pos.length / 3;
      if (r[0] === r[2] || r[1] === r[3]) continue;
      for (const p of q) { V.set(p[0], p[1], p[2]); if (mat) V.applyMatrix4(mat); pos.push(V.x - pivot[0], V.y - pivot[1], V.z - pivot[2]); }
      uvs.push(r[0] / tw, r[1] / th, r[2] / tw, r[1] / th, r[2] / tw, r[3] / th, r[0] / tw, r[3] / th);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
  }
  function geometry(id) {
    if (geos.has(id)) return geos.get(id);
    const g = look.geos[id];
    let out;
    if (g) {
      const tw = g.description?.texture_width ?? 64, th = g.description?.texture_height ?? 64;
      out = { bones: (g.bones ?? []).map((b) => {
        const p = b.pivot || [0, 0, 0], pivot = [-p[0], p[1], p[2]];
        const pos = [], uvs = [], idx = [];
        for (const c of b.cubes ?? []) if (c.size && c.origin) cubeInto(c, tw, th, pivot, pos, uvs, idx);
        let geo;
        if (idx.length) { geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); }
        return { name: b.name, parent: b.parent, pivot, rest: b.rotation ?? [0, 0, 0], geo };
      }) };
    }
    geos.set(id, out);
    return out;
  }

  // ---------- render controllers: which model and which texture ----------
  function pickFrom(expr, arrays, table, q, v) {
    const s = String(expr).trim();
    const m = /^[Aa]rray\.(\w+)\[([\s\S]*)\]$/.exec(s);
    if (m) {
      const key = Object.keys(arrays ?? {}).find((k) => k.toLowerCase() === `array.${m[1].toLowerCase()}`);
      const list = arrays?.[key] ?? [];
      if (!list.length) return undefined;
      const i = Math.floor(mol(m[2])(q, v));
      return pickFrom(list[((i % list.length) + list.length) % list.length], arrays, table, q, v);
    }
    return table?.[s.replace(/^\w+\./, "")];
  }
  function layersFor(def, q, v) {
    const out = [];
    for (const rc of def.render_controllers ?? []) {
      const [name, cond] = typeof rc === "string" ? [rc, undefined] : Object.entries(rc)[0];
      if (cond !== undefined && !mol(cond)(q, v)) continue;
      const r = look.renders[name] ?? (name === "controller.render.default" ? { geometry: "Geometry.default", textures: ["Texture.default"] } : undefined);
      if (!r) continue;
      const geo = pickFrom(r.geometry, r.arrays?.geometries, def.geometry, q, v);
      const tex = pickFrom(r.textures?.[0], r.arrays?.textures, def.textures, q, v);
      if (geo && tex) out.push({ geo, tex, vis: r.part_visibility });
    }
    return out;
  }

  // ---------- one creature ----------
  function create(typeId) {
    const def = look.client[typeId];
    const group = new THREE.Group();
    const model = new THREE.Group();
    model.scale.setScalar(1 / 16);
    group.add(model);
    return { typeId, def, group, model, layers: [], key: "", v: {}, anims: new Map(), ctrl: new Map(), tint: new THREE.Color(1, 1, 1), mats: [], drawn: !!def };
  }
  function rebuild(view, layers) {
    for (const l of view.layers) view.model.remove(l.root);
    for (const m of view.mats) m.dispose();
    view.layers = []; view.mats = [];
    for (const L of layers) {
      const g = geometry(L.geo);
      if (!g) continue;
      const mat = new THREE.MeshBasicMaterial({ map: texture(L.tex), alphaTest: 0.5, side: THREE.DoubleSide });
      view.mats.push(mat);
      const root = new THREE.Group(), bones = {};
      for (const b of g.bones) { const o = b.geo ? new THREE.Mesh(b.geo, mat) : new THREE.Group(); o.rotation.order = "ZYX"; o.userData.b = b; bones[b.name] = o; }
      for (const b of g.bones) { const o = bones[b.name], par = b.parent && bones[b.parent]; o.userData.pp = par ? par.userData.b.pivot : [0, 0, 0]; (par || root).add(o); }
      view.model.add(root);
      view.layers.push({ root, bones, vis: L.vis });
    }
  }

  const VANILLA = { "animation.humanoid.look_at_target.default": { loop: true, bones: { head: { rotation: ["query.target_x_rotation", "query.target_y_rotation", 0] } } } };
  const acc = new Map(); // bone name -> { r: [3], p: [3], s: [3] } for the frame
  function chan(val, t, q, v, out, mul) {
    if (val === undefined) return;
    if (typeof val === "number" || typeof val === "string") { const x = mol(val)(q, v); out[0] = mul ? out[0] * x : out[0] + x; out[1] = mul ? out[1] * x : out[1] + x; out[2] = mul ? out[2] * x : out[2] + x; return; }
    let a = val;
    if (!Array.isArray(val)) { // keyframes
      const keys = val.__k ?? (Object.defineProperty(val, "__k", { value: Object.keys(val).map((k) => [Number(k), val[k]]).sort((x, y) => x[0] - y[0]), enumerable: false }), val.__k);
      if (!keys.length) return;
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
      const k0 = keys[i], k1 = keys[Math.min(keys.length - 1, i + 1)];
      const at = (k, side) => { const x = k[1]; return Array.isArray(x) ? x : typeof x === "object" ? x[side] ?? x.post ?? x.pre ?? [0, 0, 0] : [x, x, x]; };
      if (t <= k0[0] || k0 === k1) a = at(k0, "post");
      else { const f = Math.min(1, (t - k0[0]) / (k1[0] - k0[0])), A = at(k0, "post"), B = at(k1, "pre"); a = [0, 1, 2].map((j) => { const x = mol(A[j])(q, v), y = mol(B[j])(q, v); return x + (y - x) * f; }); }
    }
    for (let j = 0; j < 3; j++) { const x = mol(a[j])(q, v); out[j] = mul ? out[j] * x : out[j] + x; }
  }
  function play(view, key, id, q, dt, weight = 1) {
    const a = look.anims[id] ?? VANILLA[id];
    if (!a) return true;
    let st = view.anims.get(key);
    if (!st || st.frame !== view.frame - 1) st = { t: 0 }; // (re)started this frame
    st.frame = view.frame;
    view.anims.set(key, st);
    const len = a.animation_length;
    let t = st.t;
    st.t += dt;
    let done = false;
    if (len !== undefined) { if (a.loop === true) t %= len; else if (t >= len) { t = len; done = true; } }
    q.anim_time = t;
    if (weight <= 0) return done || len === undefined;
    for (const [bone, ch] of Object.entries(a.bones ?? {})) {
      let o = acc.get(bone);
      if (!o) { o = { r: [0, 0, 0], p: [0, 0, 0], s: [1, 1, 1] }; acc.set(bone, o); }
      chan(ch.rotation, t, q, view.v, o.r);
      chan(ch.position, t, q, view.v, o.p);
      chan(ch.scale, t, q, view.v, o.s, true);
    }
    return done || len === undefined;
  }
  function run(view, name, q, dt, weight = 1) {
    const id = view.def.animations?.[name];
    if (!id) return true;
    const c = look.ctrls[id];
    if (!c) return play(view, name, id, q, dt, weight);
    let st = view.ctrl.get(name);
    if (!st) { st = { state: c.initial_state ?? "default", finished: false }; view.ctrl.set(name, st); }
    for (let hop = 0; hop < 3; hop++) {
      const S = c.states?.[st.state];
      q.all_animations_finished = st.finished ? 1 : 0; q.any_animation_finished = q.all_animations_finished;
      const next = (S?.transitions ?? []).map((t) => Object.entries(t)[0]).find(([, cond]) => mol(cond)(q, view.v));
      if (!next || !c.states?.[next[0]]) break;
      st.state = next[0]; st.finished = false; st.entered = view.frame;
    }
    const S = c.states?.[st.state];
    let all = true;
    for (const an of S?.animations ?? []) {
      const [n, w] = typeof an === "string" ? [an, undefined] : Object.entries(an)[0];
      const fin = run(view, n, q, dt, w === undefined ? 1 : mol(w)(q, view.v));
      all = all && fin;
    }
    st.finished = all;
    return true;
  }

  function update(view, q, dt) {
    if (!view.def) return;
    view.frame = (view.frame ?? 0) + 1;
    const v = view.v;
    v.attack_time = q.attack_time ?? 0;
    // the model and texture can change (colours, armour tier, variant)
    const layers = layersFor(view.def, q, v);
    const key = layers.map((l) => `${l.geo}|${l.tex}`).join(";");
    if (key !== view.key) { view.key = key; rebuild(view, layers); }
    runPre(view.def.scripts?.pre_animation, q, v);
    acc.clear();
    for (const an of view.def.scripts?.animate ?? []) {
      const [n, cond] = typeof an === "string" ? [an, undefined] : Object.entries(an)[0];
      if (cond !== undefined && !mol(cond)(q, v)) continue;
      run(view, n, q, dt);
    }
    for (const L of view.layers) {
      for (const [name, o] of Object.entries(L.bones)) {
        const b = o.userData.b, pp = o.userData.pp, a = acc.get(name);
        const r = a?.r, p = a?.p;
        o.rotation.set(-(b.rest[0] + (r?.[0] ?? 0)) * D2R, -(b.rest[1] + (r?.[1] ?? 0)) * D2R, (b.rest[2] + (r?.[2] ?? 0)) * D2R);
        o.position.set(b.pivot[0] - pp[0] - (p?.[0] ?? 0), b.pivot[1] - pp[1] + (p?.[1] ?? 0), b.pivot[2] - pp[2] + (p?.[2] ?? 0));
        if (a) o.scale.set(a.s[0], a.s[1], a.s[2]); else o.scale.set(1, 1, 1);
      }
      for (const pv of L.vis ?? []) for (const [pat, cond] of Object.entries(pv)) {
        const re = new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`), show = !!mol(cond)(q, v);
        for (const [name, o] of Object.entries(L.bones)) if (re.test(name)) o.visible = show;
      }
    }
    for (const m of view.mats) m.color.copy(view.tint);
  }
  function dispose(view) { for (const m of view.mats) m.dispose(); view.mats = []; }

  // queries the pack calls like a function (query.property('x')): the page answers those with functions
  const called = new Set();
  (function scan(o) { if (typeof o === "string") { for (const m of o.matchAll(/\b(?:q|query)\.(\w+)\s*\(/g)) called.add(m[1]); } else if (o && typeof o === "object") for (const [k, x] of Object.entries(o)) { scan(k); scan(x); } })([look.client, look.anims, look.ctrls, look.renders]);
  return { create, update, dispose, has: (typeId) => !!look.client[typeId], texture, called };
}
