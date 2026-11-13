#!/usr/bin/env node
// Wall-hung blocks in the baked world files (map/*-blocks.json) must have something to hang on.
// An item frame, ladder, button or wall sign whose wall is missing pops off and drops as an item the first time a
// block next to it changes (Mateo's playtest 2026-11-13: the arena's weapon-rack frames fell onto the barrels).
//   node tools/hung-check.mjs          prints one line per problem, exit 1 if any
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAP = join(ROOT, "map");
// facing_direction (the way it faces) -> the block behind it
const BEHIND = { 2: [0, 0, 1], 3: [0, 0, -1], 4: [1, 0, 0], 5: [-1, 0, 0] };
// what can't hold anything on its side
const SOFT = /(^|:)air$|vine|ladder|lantern|button|sign|frame|torch|carpet|glass_pane|iron_bars|fence|chain|trapdoor|door|slab|stairs|_wall$|structure_void|flower|grass$|fern|bush|sapling|candle|banner|rail|snow_layer/;
const HUNG = /(^|:)(glow_)?frame$|(^|:)ladder$|_button$|wall_sign$/;

const out = [];
for (const f of readdirSync(MAP).filter((f) => f.endsWith("-blocks.json")).sort()) {
  const d = JSON.parse(readFileSync(join(MAP, f), "utf8"));
  const at = new Map();
  for (const [x, y, z, i] of d.blocks) at.set(`${x},${y},${z}`, d.palette[i]);
  const bad = new Map();
  for (const [k, e] of at) {
    if (!HUNG.test(e.name)) continue;
    const off = BEHIND[e.states?.facing_direction];
    const [x, y, z] = k.split(",").map(Number);
    const w = off && at.get(`${x + off[0]},${y + off[1]},${z + off[2]}`);
    // leaves hold a wall sign (Mateo's window boxes: leaves boxed in by signs)
    const ok = w && (!SOFT.test(w.name) || (/wall_sign$/.test(e.name) && /leaves/.test(w.name)));
    if (!ok) {
      const key = `${e.name.replace("minecraft:", "")} facing ${e.states?.facing_direction} on ${w ? w.name.replace("minecraft:", "") : "nothing"}`;
      if (!bad.has(key)) bad.set(key, { n: 0, at: k });
      bad.get(key).n++;
    }
  }
  for (const [key, { n, at: k }] of bad) out.push(`map/${f}: ${n} x ${key}, e.g. at ${k}`);
}
for (const l of out) console.log(l);
process.exit(out.length ? 1 : 0);
