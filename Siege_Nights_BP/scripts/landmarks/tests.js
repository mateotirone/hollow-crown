import { addTests, assert, assertEqual } from "../core/tests.js";
import { DESIGNS } from "./designs_data.js";
import { SPOTS } from "./spots_data.js";
import { LANDMARKS } from "./sites.js";
import { planPiece, seekSpot, cellsOf, AIR, KEEP_TOP } from "./plan.js";
import { PLOT_PLAN } from "../plots/config.js";
import { PLACES } from "../lore/data/world.js";
import { NPCS } from "../lore/data/dialogue.js";
import { TOME } from "../lore/logic.js";

const idsOf = (piece) => (piece.turns ? (piece.face ? [piece.face] : ["n", "e", "s", "w"]).map((f) => `${piece.d}@${f}`) : [piece.d]);

addTests("landmarks", {
  "every plot has its landmark, and every piece has its design": () => {
    assertEqual(new Set(LANDMARKS.filter((s) => s.plot).map((s) => s.plot)).size, PLOT_PLAN.length);
    assertEqual(new Set(LANDMARKS.map((s) => s.id)).size, LANDMARKS.length, "site ids are unique");
    for (const s of LANDMARKS) for (const p of s.pieces) for (const id of idsOf(p)) assert(DESIGNS[id], `${s.id}: no design ${id}`);
  },
  "every seeking piece has a spot from the map, close to its anchor": () => {
    for (const s of LANDMARKS) {
      s.pieces.forEach((p, k) => {
        if (!p.seek) return;
        const spot = SPOTS[s.id]?.[k];
        assert(spot && "nesw".includes(spot.face), `${s.id} piece ${k} has no spot`);
        assert(Math.hypot(spot.x - s.x, spot.z - s.z) <= (p.seek.max ?? 60) + 2, `${s.id} piece ${k} strays too far`);
      });
    }
  },
  "tomes laid in designs are real tomes, each laid once, each on something solid": () => {
    const seen = new Set();
    for (const [id, d] of Object.entries(DESIGNS)) {
      if (!d.tomes?.length) continue;
      const solid = new Set();
      for (const [y, z, x0, n, pi] of d.rows) if (d.palette[pi][0] !== "minecraft:air") for (let x = x0; x < x0 + n; x++) solid.add(`${x},${y},${z}`);
      for (const [x, y, z, t] of d.tomes) {
        assert(TOME[t], `${id}: no tome ${t}`);
        assert(!seen.has(t) || id.includes("@"), `${t} laid twice`);
        seen.add(t);
        assert(solid.has(`${x},${y - 1},${z}`), `${id}: ${t} at ${x},${y},${z} has nothing under it`);
      }
    }
    assert(seen.has("chron_09") && seen.has("corv_08") && seen.has("seal_09"), "the story rooms' tomes are laid");
  },
  "story sites point the Ledger at real places, and their people are real lore characters": () => {
    for (const s of LANDMARKS) if (s.place) assert(PLACES[s.place], `${s.id}: no place ${s.place}`);
    for (const [id, d] of Object.entries(DESIGNS)) for (const n of d.npcs ?? []) assert(NPCS.some((c) => c.id === n[3]), `${id}: no npc ${n[3]}`);
  },
  "palettes are Bedrock ids with states, rows point into them": () => {
    for (const [id, d] of Object.entries(DESIGNS)) {
      assert(d.palette.every(([n, st]) => n.startsWith("minecraft:") && typeof st === "object"), id);
      assert(d.rows.every((r) => r.length === 5 && r[4] >= 0 && r[4] < d.palette.length && r[3] > 0), id);
      assert(["rigid", "drape", "carve"].includes(d.mode), `${id} mode`);
    }
  },
  "on flat ground a rigid design stands whole at the ground height, clear of trees": () => {
    for (const [id, d] of Object.entries(DESIGNS)) {
      if (d.mode !== "rigid") continue;
      const { ops, G } = planPiece(d, 100, 200, () => 70);
      assertEqual(G, 70, id);
      const placed = new Map(ops.filter((o) => o[3] !== AIR).map((o) => [`${o[0]},${o[1]},${o[2]}`, o[3]]));
      for (const [x, y, z, i] of cellsOf(d)) assertEqual(placed.get(`${100 + x},${70 + y},${200 + z}`), i, `${id} ${x},${y},${z}`);
      assert(ops.every((o) => Math.abs(o[0] - 100) <= 44 && Math.abs(o[2] - 200) <= 44), `${id} reaches too far`);
    }
  },
  "a rigid design on a slope is filled under and cut into, never floating": () => {
    const d = DESIGNS.wolfcairn_cairn;
    const slope = (x) => 70 + Math.floor(x / 2);
    const { ops, G } = planPiece(d, 0, 0, (x) => slope(x));
    // under the cairn on the low side, the fill reaches up to the design
    const fill = ops.filter((o) => o[0] === -5 && o[2] === 0 && o[1] < G && o[3] !== AIR);
    assert(fill.length >= G - slope(-5) - 1, `fill under the low side: ${fill.length}`);
    // on the high side the ground above G is cut away (inside the box)
    assert(ops.some((o) => o[0] === 6 && o[3] === AIR && o[1] > G), "the high side is cut back");
    assert(ops.some((o) => o[3] === KEEP_TOP), "graded ground keeps its own top block");
  },
  "a draped design follows the ground column by column": () => {
    const d = DESIGNS.reedmoor_ring;
    const h = (x, z) => 60 + ((x + z) & 3);
    const { ops } = planPiece(d, 0, 0, h);
    for (const [x, y, z, i] of cellsOf(d)) {
      if (y !== 0) continue;
      assert(ops.some((o) => o[0] === x && o[2] === z && o[1] === h(x, z) && o[3] === i), `${x},${z}`);
    }
  },
  "posts walking into the water stand on the bed and show above the surface": () => {
    const d = DESIGNS["tidewatch_posts@n"];
    const h = (x, z) => (z < 0 ? 55 : 64), w = (x, z) => (z < 0 ? 62 : undefined);
    const { ops } = planPiece(d, 0, 0, h, w);
    const far = cellsOf(d).filter((c) => c[2] < -20 && d.palette[c[3]][0].includes("log"));
    assert(far.length, "has posts in the sea");
    const [x, , z] = far[0];
    const col = ops.filter((o) => o[0] === x && o[2] === z).map((o) => o[1]);
    assert(Math.min(...col) <= 56 && Math.max(...col) >= 63, `post runs ${Math.min(...col)}..${Math.max(...col)}`);
  },
  "a seeking piece finds the shore and faces the water": () => {
    const h = (x) => (x > 30 ? 50 : 70), w = (x) => (x > 30 ? 62 : undefined);
    const s = seekSpot({ x: 0, z: 0 }, { kind: "water", bearing: 90, spread: 30, max: 80 }, h, w);
    assert(s && s.face === "e" && s.x >= 28 && s.x <= 30, JSON.stringify(s));
    const e = seekSpot({ x: 0, z: 0 }, { kind: "edge", bearing: 270, spread: 20, max: 80 }, (x) => (x < -40 ? 60 : 90));
    assert(e && e.face === "w" && e.x <= -36 && e.x >= -41, JSON.stringify(e));
  },
});
