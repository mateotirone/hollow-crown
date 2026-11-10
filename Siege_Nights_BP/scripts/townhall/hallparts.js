// Building pieces shared by every regional hall: the Plan they draw into, and walls, roofs, towers,
// domes, round huts and the furniture every hall must have. Pure code, runs in Node too.
//
// Local frame: the Hall Cornerstone sits at (0, 1, 0), right in front of the door.
// +z runs away from the player into the hall, +x is to the player's right, y = 0 is the floor layer
// (one below the cornerstone), so people stand at y = 1.

export class Plan {
  constructor(style) {
    this.style = style;
    this.cells = new Map(); // "x,y,z" -> { x, y, z, role, o }
    this.columns = new Map(); // "x,z" -> { x, z, top, role } foundation to the ground
    this.marks = {}; // named spots: tree, sage, cartography, warroom, throne, vault, hearth
    this.off = { x: 0, y: 0, z: 0 };
  }
  set(x, y, z, role, o) {
    x += this.off.x; y += this.off.y; z += this.off.z;
    this.cells.set(`${x},${y},${z}`, { x, y, z, role, o });
  }
  get(x, y, z) {
    return this.cells.get(`${x + this.off.x},${y + this.off.y},${z + this.off.z}`);
  }
  fill(x0, y0, z0, x1, y1, z1, role, o) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, role, o);
  }
  mark(name, x, y, z) {
    this.marks[name] = { x: x + this.off.x, y: y + this.off.y, z: z + this.off.z };
  }
  column(x, z, role = "foundation", o) {
    const wx = x + this.off.x, wz = z + this.off.z;
    this.columns.set(`${wx},${wz}`, { x: wx, z: wz, top: this.off.y - 1, role, o });
  }
  bounds() {
    const b = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
    for (const c of this.cells.values()) {
      b.x0 = Math.min(b.x0, c.x); b.x1 = Math.max(b.x1, c.x);
      b.y0 = Math.min(b.y0, c.y); b.y1 = Math.max(b.y1, c.y);
      b.z0 = Math.min(b.z0, c.z); b.z1 = Math.max(b.z1, c.z);
    }
    for (const c of this.columns.values()) {
      b.x0 = Math.min(b.x0, c.x); b.x1 = Math.max(b.x1, c.x);
      b.z0 = Math.min(b.z0, c.z); b.z1 = Math.max(b.z1, c.z);
    }
    return b;
  }
}

// ---------- building pieces ----------

export const STAIR = (dir, half) => ({ dir, half });
export const lift = (p) => p.style.lift ?? 0;

// Floor slab plus foundation (solid to the ground, or stilts for lifted styles)
export function floor(p, x0, x1, z0, z1, role = "floor") {
  p.fill(x0, 0, z0, x1, 0, z1, role);
  const stilts = lift(p) > 0;
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      if (!stilts) p.column(x, z, "foundation");
      else if ((x - x0) % 3 === 0 && (z - z0) % 3 === 0 || x === x1 && (z - z0) % 3 === 0 || z === z1 && (x - x0) % 3 === 0 || x === x1 && z === z1) {
        p.column(x, z, "pillar", { axis: "y" });
      }
    }
}

// Hollow rectangle of walls. course(y) picks the role for each height.
export function walls(p, x0, x1, z0, z1, y0, y1, course) {
  for (let y = y0; y <= y1; y++) {
    const role = course(y);
    for (let x = x0; x <= x1; x++) { p.set(x, y, z0, role); p.set(x, y, z1, role); }
    for (let z = z0; z <= z1; z++) { p.set(x0, y, z, role); p.set(x1, y, z, role); }
  }
}

export function clearInside(p, x0, x1, z0, z1, y0, y1) {
  p.fill(x0 + 1, y0, z0 + 1, x1 - 1, y1, z1 - 1, "air");
}

export function posts(p, points, y0, y1) {
  for (const [x, z] of points) p.fill(x, y0, z, x, y1, z, "pillar", { axis: "y" });
}

// Gable roof with the ridge running along z. overhang 1 = eaves stick out one block.
export function gableRoof(p, x0, x1, z0, z1, y, overhang = 1) {
  const pitch = x1 - x0 >= 16 ? 1 : p.style.pitch ?? 1; // steep roofs only on the smaller halls, or they dwarf the towers
  const zs = z0 - overhang, ze = z1 + overhang;
  for (let i = 0; ; i++) {
    const xl = x0 - overhang + i, xr = x1 + overhang - i, yy = y + i * pitch;
    if (xl > xr) break;
    if (xl === xr) {
      for (let z = zs; z <= ze; z++) {
        for (let d = 0; d < pitch; d++) p.set(xl, yy + d, z, "roofBlock");
        p.set(xl, yy + pitch, z, p.style.snow ? "snow" : "roofSlab");
      }
      // gable ends under the ridge
      break;
    }
    for (let z = zs; z <= ze; z++) {
      for (let d = 0; d < pitch - 1; d++) { p.set(xl, yy + d, z, "roofBlock"); p.set(xr, yy + d, z, "roofBlock"); }
      p.set(xl, yy + pitch - 1, z, "roofStair", STAIR("+x"));
      p.set(xr, yy + pitch - 1, z, "roofStair", STAIR("-x"));
    }
    if (xl + 1 === xr && p.style.snow) for (let z = zs; z <= ze; z++) { p.set(xl, yy + pitch, z, "snow"); p.set(xr, yy + pitch, z, "snow"); }
    // fill the triangle of the gable end walls
    for (let x = Math.max(xl + 1, x0); x <= Math.min(xr - 1, x1); x++)
      for (let d = 0; d < pitch; d++) { p.set(x, yy + d, z0, "wallUpper"); p.set(x, yy + d, z1, "wallUpper"); }
    // and keep the space under the roof open
    for (let x = Math.max(xl + 1, x0 + 1); x <= Math.min(xr - 1, x1 - 1); x++)
      for (let d = 0; d < pitch; d++) for (let z = z0 + 1; z < z1; z++) if (!p.get(x, yy + d, z)) p.set(x, yy + d, z, "air");
  }
}

export function flatRoof(p, x0, x1, z0, z1, y) {
  p.fill(x0, y, z0, x1, y, z1, "roofBlock");
  crenels(p, x0, x1, z0, z1, y + 1);
}

export function crenels(p, x0, x1, z0, z1, y) {
  for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) if ((x - x0) % 2 === 0) p.set(x, y, z, "crenel");
  for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) if ((z - z0) % 2 === 0) p.set(x, y, z, "crenel");
}

export function roof(p, x0, x1, z0, z1, y, overhang = 1) {
  if (p.style.roof === "flat") flatRoof(p, x0, x1, z0, z1, y);
  else gableRoof(p, x0, x1, z0, z1, y, overhang);
}

// Pyramid cap for towers
export function spire(p, cx, cz, r, y) {
  for (let i = 0; i <= r + 1; i++) {
    const rr = r + 1 - i, yy = y + i;
    if (rr === 0) { p.set(cx, yy, cz, "spire"); p.set(cx, yy + 1, cz, "spire"); break; }
    for (let x = cx - rr; x <= cx + rr; x++) {
      p.set(x, yy, cz - rr, "roofStair", STAIR("+z"));
      p.set(x, yy, cz + rr, "roofStair", STAIR("-z"));
    }
    for (let z = cz - rr + 1; z <= cz + rr - 1; z++) {
      p.set(cx - rr, yy, z, "roofStair", STAIR("+x"));
      p.set(cx + rr, yy, z, "roofStair", STAIR("-x"));
    }
  }
}

// A square tower centred on (cx, cz). Climb it with the scaffolding inside.
export function tower(p, cx, cz, r, h, cap, doors = []) {
  floor(p, cx - r, cx + r, cz - r, cz + r);
  walls(p, cx - r, cx + r, cz - r, cz + r, 1, h, (y) => (y <= 3 ? "wallLow" : "wall"));
  clearInside(p, cx - r, cx + r, cz - r, cz + r, 1, h - 1);
  p.fill(cx - r + 1, h, cz - r + 1, cx + r - 1, h, cz + r - 1, "floor");
  for (let y = 5; y < h - 1; y += 4) {
    p.set(cx, y, cz - r, "window"); p.set(cx, y, cz + r, "window");
    p.set(cx - r, y, cz, "window"); p.set(cx + r, y, cz, "window");
  }
  const sx = cx + (cx < 0 ? r - 1 : -(r - 1)), sz = cz + (cz < 8 ? r - 1 : -(r - 1));
  p.fill(sx, 1, sz, sx, h, sz, "scaffold");
  p.set(cx, h - 1, cz, "light", { hanging: true });
  for (const [x, z] of doors) p.fill(x, 1, z, x, 2, z, "air");
  if (cap === "spire" && p.style.roof !== "flat") {
    crenels(p, cx - r, cx + r, cz - r, cz + r, h + 1);
    spire(p, cx, cz, r - 1, h + 2);
  } else crenels(p, cx - r, cx + r, cz - r, cz + r, h + 1);
}

export function windowsAlong(p, side, x0, x1, z0, z1, ys, positions) {
  for (const t of positions) for (const y of ys) {
    if (side === "west") p.set(x0, y, t, "window");
    if (side === "east") p.set(x1, y, t, "window");
    if (side === "north") p.set(t, y, z0, "window");
    if (side === "south") p.set(t, y, z1, "window");
  }
}

export function entranceSteps(p) {
  // lifted styles (stilts) climb up to the door from the cornerstone
  const L = lift(p);
  if (!L) return;
  const saved = p.off;
  p.off = { x: 0, y: 0, z: 0 };
  for (let k = 1; k <= L; k++)
    for (let x = -1; x <= 1; x++) {
      p.set(x, k, k, "seat", STAIR("+z"));
      for (let y = 1; y < k; y++) p.set(x, y, k, "foundation");
      p.set(x, k + 1, k, "air"); p.set(x, k + 2, k, "air");
    }
  p.off = saved;
}

export function hangLights(p, spots) {
  for (const [x, y, z] of spots) p.set(x, y, z, "light", { hanging: true });
}

export function mossAndSnow(p, b) {
  // Blackfen: moss carpets on the porch. Nothing heavy, just flavour.
  if (p.style.moss) for (const x of [-2, 2]) if (!p.get(x, 1, 0)) p.set(x, 1, 0, "moss");
}


// ---------- round and stepped pieces ----------

export const inDisk = (dx, dz, r) => dx * dx + dz * dz <= (r + 0.5) * (r + 0.5);
const onRim = (dx, dz, r) => inDisk(dx, dz, r) && !(inDisk(dx + 1, dz, r) && inDisk(dx - 1, dz, r) && inDisk(dx, dz + 1, r) && inDisk(dx, dz - 1, r));

export function disk(p, cx, cz, r, y, role, o) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (inDisk(dx, dz, r)) p.set(cx + dx, y, cz + dz, role, o);
}

// A round wall. course(y) picks the role for each height.
export function ringWall(p, cx, cz, r, y0, y1, course) {
  for (let y = y0; y <= y1; y++) {
    const role = typeof course === "function" ? course(y) : course;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (onRim(dx, dz, r)) p.set(cx + dx, y, cz + dz, role);
  }
}

export function clearDisk(p, cx, cz, r, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (inDisk(dx, dz, r) && !onRim(dx, dz, r)) p.set(cx + dx, y, cz + dz, "air");
}

// Half-sphere shell sitting on y
export function dome(p, cx, cz, r, y, role = "roofBlock") {
  const inside = (dx, dy, dz) => dx * dx + dy * dy + dz * dz <= (r + 0.5) * (r + 0.5);
  for (let dy = 0; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (!inside(dx, dy, dz)) continue;
    const shell = !(inside(dx + 1, dy, dz) && inside(dx - 1, dy, dz) && inside(dx, dy + 1, dz) && inside(dx, dy, dz + 1) && inside(dx, dy, dz - 1));
    p.set(cx + dx, y + dy, cz + dz, shell ? role : "air");
  }
  p.set(cx, y + r + 1, cz, "crenel"); // finial
}

// Cone roof: rings that shrink as they rise. steep = layers per ring.
export function cone(p, cx, cz, r, y, role = "roofBlock", steep = 1) {
  let yy = y;
  for (let rr = r; rr >= 0; rr--) for (let k = 0; k < steep; k++) {
    // each layer is a full band: everything in this ring that the next, smaller ring will not cover from above
    const last = k === steep - 1;
    for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
      if (!inDisk(dx, dz, rr)) continue;
      const covered = rr > 0 && inDisk(dx, dz, rr - 1) && !onRim(dx, dz, rr - 1);
      const band = onRim(dx, dz, rr) || rr <= 1 || (last && !covered);
      if (band) p.set(cx + dx, yy, cz + dz, role);
      else if (!p.get(cx + dx, yy, cz + dz)) p.set(cx + dx, yy, cz + dz, "air");
    }
    yy++;
  }
  p.set(cx, yy, cz, "spire");
  return yy;
}

// Round floor on the ground or on stilts
export function roundFloor(p, cx, cz, r, role = "floor") {
  disk(p, cx, cz, r, 0, role);
  const stilts = lift(p) > 0;
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (!inDisk(dx, dz, r)) continue;
    if (!stilts) p.column(cx + dx, cz + dz, "foundation");
    else if ((onRim(dx, dz, r) && (dx + dz) % 2 === 0) || (dx === 0 && dz === 0)) p.column(cx + dx, cz + dz, "pillar", { axis: "y" });
  }
}

// A round hut or tower: floor, wall, optional cone or dome on top. Returns the roof's top y.
export function roundRoom(p, cx, cz, r, H, o = {}) {
  roundFloor(p, cx, cz, r);
  ringWall(p, cx, cz, r, 1, H, o.course ?? ((y) => (y <= 1 ? "wallLow" : "wall")));
  clearDisk(p, cx, cz, r, 1, H);
  for (const y of o.windowYs ?? [2]) for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) p.set(cx + dx, y, cz + dz, "window");
  for (const [x, z] of o.doors ?? []) p.fill(x, 1, z, x, 2, z, "air");
  if (o.cap === "dome") { dome(p, cx, cz, r, H + 1, o.capRole ?? "roofBlock"); return H + r + 2; }
  if (o.cap === "flat") { disk(p, cx, cz, r, H + 1, "roofBlock"); ringWall(p, cx, cz, r, H + 2, H + 2, "crenel"); return H + 2; }
  return cone(p, cx, cz, r + 1, H + 1, o.capRole ?? "roofBlock", o.steep ?? 1);
}

// Gable roof that can stop early (for a raised upper tier). Ridge along z. Returns where it stopped.
export function gableTo(p, x0, x1, z0, z1, y, o = {}) {
  const pitch = o.pitch ?? 1, overhang = o.overhang ?? 1, stop = o.stopHalf ?? -1;
  const zs = z0 - overhang, ze = z1 + overhang;
  for (let i = 0; ; i++) {
    const xl = x0 - overhang + i, xr = x1 + overhang - i, yy = y + i * pitch;
    if (xr - xl <= stop * 2) {
      p.fill(xl, yy, zs, xr, yy, ze, "roofBlock");
      return { x0: xl, x1: xr, y: yy };
    }
    if (xl >= xr) {
      for (let z = zs; z <= ze; z++) {
        for (let d = 0; d < pitch; d++) p.set(xl, yy + d, z, "roofBlock");
        p.set(xl, yy + pitch, z, p.style.snow ? "snow" : "roofSlab");
      }
      return { x0: xl, x1: xr, y: yy + pitch };
    }
    for (let z = zs; z <= ze; z++) {
      for (let d = 0; d < pitch - 1; d++) { p.set(xl, yy + d, z, "roofBlock"); p.set(xr, yy + d, z, "roofBlock"); }
      p.set(xl, yy + pitch - 1, z, "roofStair", STAIR("+x"));
      p.set(xr, yy + pitch - 1, z, "roofStair", STAIR("-x"));
    }
    for (let x = Math.max(xl + 1, x0); x <= Math.min(xr - 1, x1); x++)
      for (let d = 0; d < pitch; d++) { p.set(x, yy + d, z0, o.gable ?? "wallUpper"); p.set(x, yy + d, z1, o.gable ?? "wallUpper"); }
    for (let x = Math.max(xl + 1, x0 + 1); x <= Math.min(xr - 1, x1 - 1); x++)
      for (let d = 0; d < pitch; d++) for (let z = z0 + 1; z < z1; z++) if (!p.get(x, yy + d, z)) p.set(x, yy + d, z, "air");
  }
}

// Row of pillars with a lintel: a loggia or porch front. Runs along x at depth z.
export function arcade(p, x0, x1, z, H, step = 3) {
  for (let x = x0; x <= x1; x++) {
    const post = (x - x0) % step === 0 || x === x1;
    if (post) p.fill(x, 1, z, x, H - 1, z, "pillar", { axis: "y" });
    else {
      p.fill(x, 1, z, x, H - 2, z, "air");
      const left = (x - x0) % step === 1, right = (x - x0) % step === step - 1;
      p.set(x, H - 1, z, left ? "daisStair" : right ? "daisStair" : "dais", left ? STAIR("-x", "top") : right ? STAIR("+x", "top") : undefined);
    }
    p.set(x, H, z, "dais");
  }
}

// ---------- what every hall must hold ----------
// Furnishes a main room (r = its wall rectangle, H = ceiling height) for a hall tier, and sets the marks the
// rest of the game uses: tree, ledger, hearth, then sage and cartography (tier 2+), warroom (3+), throne (4+).
export function furnish(p, level, r, H, o = {}) {
  const { x0, x1, z0, z1 } = r;
  const D = z1 - z0;
  const treeZ = o.treeZ ?? (level >= 4 ? z0 + Math.round(D * 0.42) : z1 - 3);
  const rug = level >= 5 ? "royal" : "carpet";
  p.fill(-1, 0, treeZ - 1, 1, 0, treeZ + 1, "dais");
  p.set(0, 1, treeZ, "tree");
  p.mark("tree", 0, 1, treeZ);
  for (let z = z0 + 1; z <= treeZ - 2; z++) p.set(0, 1, z, rug);
  if (level >= 2) { p.set(-2, 1, treeZ, "brazier"); p.set(2, 1, treeZ, "brazier"); }

  if (level === 1) {
    const hz = z0 + Math.max(3, Math.round(D * 0.4));
    p.set(0, 0, hz, "foundation"); p.set(0, 1, hz, "hearth"); p.mark("hearth", 0, 1, hz);
    for (const z of [z0 + 2, z0 + 3]) { p.set(x0 + 1, 1, z, "seat", STAIR("-x")); p.set(x1 - 1, 1, z, "seat", STAIR("+x")); }
    p.set(x1 - 1, 1, z1 - 1, "lectern"); p.mark("ledger", x1 - 1, 1, z1 - 1);
    p.set(x0 + 1, 1, z1 - 1, "bookshelf");
  } else {
    p.set(x0 + 1, 0, z0 + 2, "foundation"); p.set(x0 + 1, 1, z0 + 2, "hearth"); p.mark("hearth", x0 + 1, 1, z0 + 2);
    // the Sage's shelves on the left, the Cartographer's Table and Ledger on the right
    p.fill(x0 + 1, 1, treeZ - 2, x0 + 1, 2, treeZ + 2, "bookshelf");
    p.mark("sage", x0 + 2, 1, treeZ);
    p.set(x1 - 1, 1, treeZ, "cartography"); p.mark("cartography", x1 - 1, 1, treeZ);
    p.set(x1 - 1, 1, treeZ - 2, "lectern"); p.mark("ledger", x1 - 1, 1, treeZ - 2);
    // a long table if there is room for one
    const half = Math.floor((x1 - x0) / 2);
    if (half >= 6 && treeZ - z0 >= 9) for (const tx of [-(half - 3), half - 3]) {
      p.fill(tx, 1, z0 + 4, tx, 1, treeZ - 4, "table", { half: "top" });
      for (let z = z0 + 4; z <= treeZ - 4; z++) { p.set(tx - 1, 1, z, "seat", STAIR("-x")); p.set(tx + 1, 1, z, "seat", STAIR("+x")); }
    }
  }
  if (level >= 3 && !o.noWarroom) {
    const wz = z0 + 3;
    p.set(x1 - 1, 1, wz, "cartography"); p.set(x1 - 1, 1, wz - 1, "lectern"); p.set(x1 - 1, 1, wz + 1, "lectern");
    p.mark("warroom", x1 - 2, 1, wz);
  }
  if (level >= 4 && !o.noThrone) throne(p, 0, z1 - 1, level >= 5);
  const lights = [];
  for (let z = z0 + 3; z < z1 - 1; z += 5) lights.push([-2, H, z], [2, H, z]);
  hangLights(p, lights);
  return treeZ;
}

// A throne on a dais against a back wall at z = back (the wall itself is at back + 1)
export function throne(p, cx, back, royal = false) {
  p.fill(cx - 2, 1, back - 2, cx + 2, 1, back, "dais");
  for (let x = cx - 2; x <= cx + 2; x++) p.set(x, 1, back - 3, "daisStair", STAIR("+z"));
  p.set(cx, 2, back, "seat", STAIR("+z"));
  p.set(cx - 1, 2, back, "table", { half: "bottom" }); p.set(cx + 1, 2, back, "table", { half: "bottom" });
  p.set(cx, 2, back - 1, "royal"); p.set(cx, 2, back - 2, "royal");
  p.set(cx - 2, 2, back, royal ? "gilt" : "brazier"); p.set(cx + 2, 2, back, royal ? "gilt" : "brazier");
  p.mark("throne", cx, 2, back);
}

// Cross beams under the roof where furnish() hangs its lanterns
export function tieBeams(p, x0, x1, z0, z1, y) {
  for (let z = z0 + 3; z < z1 - 1; z += 5) p.fill(x0 + 1, y, z, x1 - 1, y, z, "beam", { axis: "x" });
}

// Run a piece of drawing shifted by (dx, dy, dz)
export function shifted(p, dx, dy, dz, fn) {
  const saved = p.off;
  p.off = { x: saved.x + dx, y: saved.y + dy, z: saved.z + dz };
  try { return fn(); } finally { p.off = saved; }
}

// Square box of rooms: floor, walls, cleared inside. The usual start of a rectangular hall.
export function shell(p, x0, x1, z0, z1, H, course) {
  floor(p, x0, x1, z0, z1);
  walls(p, x0, x1, z0, z1, 1, H, course);
  clearInside(p, x0, x1, z0, z1, 1, H);
}
