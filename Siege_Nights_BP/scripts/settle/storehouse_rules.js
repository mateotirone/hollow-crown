// The Storehouse's numbers and pure helpers (storehouse.js, storecrates.js). Loads in Node for the tests.

export const STORE = {
  levels: 4,            // Hamlet, Town, City, Castle
  fixture: "storehouse", // the starter village's ground for it (town generator fixture kind)
  ground: 15,           // the fixture's square (x and z), plus the row in front for the door step
  plotSizes: ["ML", "L"], // where it goes in a layout with no Storehouse ground, best first
  maxDeep: 15,          // never on a plot deeper than this (the Barracks' deep Large, 15 x 17)
  crateEvery: 60,       // ticks between looks at the station Goods Crates
  crateSlots: 27,       // a barrel
};

export const levelFor = (tier) => Math.max(1, Math.min(STORE.levels, (tier ?? 0) + 1));
export const storeId = (level) => `storehouse_${level}`;
export const levelOf = (id) => {
  const m = /^storehouse_(\d)$/.exec(id ?? "");
  return m ? Number(m[1]) : 0;
};

// The chests of one design (storehouse_data.js entry) in a fixed order: bottom row first, then front to back,
// then left to right. Chest k of one level and chest k of the next hold the same stock across a rebuild.
export function chestOrder(d) {
  const chest = new Set(d.palette.map(([id], i) => (id === "minecraft:chest" ? i : -1)).filter((i) => i >= 0)); // one entry per facing
  const out = [];
  for (const [y, z, x0, n, pi] of d.rows) {
    if (!chest.has(pi)) continue;
    for (let x = x0; x < x0 + n; x++) out.push([x, y, z]);
  }
  return out.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
}

// The slot box for the fixture: its front-middle cell, the door facing `out`; the ground runs back from it,
// with the row in front for the step (a design's bounds always take in its z = 0 row)
export function fixtureBox(f, out) {
  const h = (STORE.ground - 1) / 2, back = STORE.ground - 1;
  if (out.z) return { x0: f.x - h, x1: f.x + h, z0: out.z > 0 ? f.z - back : f.z - 1, z1: out.z > 0 ? f.z + 1 : f.z + back };
  return { z0: f.z - h, z1: f.z + h, x0: out.x > 0 ? f.x - back : f.x - 1, x1: out.x > 0 ? f.x + 1 : f.x + back };
}

// A free plot for a layout with no Storehouse ground: open now, long Medium before Large, nearest the square,
// never the deep Large the Barracks needs
export function pickStoreSlot(slots, taken, tier, fits = () => true) {
  const deep = (s) => Math.max(s.box.x1 - s.box.x0, s.box.z1 - s.box.z0) + 1 > STORE.maxDeep;
  const free = slots.filter((s) => s.tier <= tier && STORE.plotSizes.includes(s.size) && !taken.has(s.id)
    && !(s.tags ?? []).includes("library") && !deep(s) && fits(s));
  const mid = (s) => Math.hypot((s.box.x0 + s.box.x1) / 2, (s.box.z0 + s.box.z1) / 2);
  return free.sort((a, b) => STORE.plotSizes.indexOf(a.size) - STORE.plotSizes.indexOf(b.size) || mid(a) - mid(b))[0];
}

// The spot for a station's Goods Crate beside its post: away from the track first, then along the platform,
// then toward the track. open(x, y, z) says whether a world cell is free with floor under it.
export function crateSpot(post, forward, open) {
  const R = { x: -forward.z, z: forward.x };
  const tries = [forward, R, { x: -R.x, z: -R.z }, { x: -forward.x, z: -forward.z }];
  for (const d of tries) {
    const at = { x: post.x + d.x, y: post.y, z: post.z + d.z };
    if (open(at)) return at;
  }
  return undefined;
}
