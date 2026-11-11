// Wild Dragon Nests: they appear by themselves in the Emberwaste as players explore it, so eggs exist on a
// real world without anyone placing nests by hand. A nest settles on open, fairly level ground out in the
// wild (never on anyone's land), some way off from the player, and the region keeps a handful at a time.
// Each nest is 9x9 blocks of woven branches, bones and straw round a clutch of eggs (shape in nestplan.js),
// sunk one block into the ground. None of it can be broken; players can't craft or place nests.
// A nest that is gone (cleared in Creative) is forgotten, and another one turns up somewhere else later.
//
//   /scriptevent siege:dragons_nests        (creative) lists the wild nests

import { world, system, BlockPermutation } from "@minecraft/server";
import { onTick, isReady, settlementAt, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode, allPlots } from "../plots/claims.js";
import { DRAGON_SETTINGS as S, NEST } from "./data.js";
import { nestPlan, cellKind, seeded, NEST_RADIUS, NEST_HEIGHT, NEST_PIECES, WEAVE, FILL, TWIGS, LINING } from "./nestplan.js";
import { store, save, isBuilder } from "./dragon.js";

export const WILD_NESTS = {
  max: 6, // wild nests in the region at once
  spacing: 160, // no new nest this close to another one
  near: 40, far: 90, // how far from the player a new nest lands
  everyTicks: 600, // how often each player in the region may turn one up (30 seconds)
  chance: 0.35, // ...and the odds it happens on that check
};

// Ground a nest may sit on: the Emberwaste's sand, stone and dry earth. Never water, leaves or snow.
const GROUND = /(sand|sandstone|terracotta|stone|gravel|dirt|coarse_dirt|grass_block|podzol|basalt|blackstone|magma)$/;
export const goodGround = (typeId) => !!typeId && GROUND.test(typeId) && !/(slab|stairs|wall|button|plate|ore)/.test(typeId);

// The region a spot belongs to: that of the nearest Plot Stone (plain maths, so it is testable)
export function regionNear(plots, x, z) {
  let best, bestD = Infinity;
  for (const p of plots) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) [best, bestD] = [p.region, d];
  }
  return best;
}

export const tooClose = (nests, x, z, spacing = WILD_NESTS.spacing) => nests.some((n) => (n.x - x) ** 2 + (n.z - z) ** 2 < spacing * spacing);

// Small things growing on the ground that a nest may flatten
const PLANT = /(short_grass|tall_grass|fern|dead_bush|bush|flower|poppy|dandelion|tulip|daisy|orchid|allium|bluet|cornflower|lily_of_the_valley|snow_layer|sapling|vine)$/;
export const flattens = (typeId) => !!typeId && (PLANT.test(typeId) || NEST_PIECES.includes(typeId));

// The spot round x,z if a nest fits there: every column of the 9x9 is ground, and none is more than two
// blocks below or one above the middle. The clutch goes one block into the ground. Undefined if it won't fit.
export function findSite(dim, x, z) {
  const groundAt = (gx, gz) => {
    let b = dim.getTopmostBlock({ x: gx, z: gz });
    for (let i = 0; b && i < 2 && flattens(b.typeId); i++) b = b.below();
    return b && goodGround(b.typeId) ? b.y : undefined;
  };
  const cy = groundAt(x, z);
  if (cy === undefined) return;
  for (let dx = -NEST_RADIUS; dx <= NEST_RADIUS; dx++) {
    for (let dz = -NEST_RADIUS; dz <= NEST_RADIUS; dz++) {
      if (!cellKind(dx, dz)) continue;
      const y = groundAt(x + dx, z + dz);
      if (y === undefined || y < cy - 2 || y > cy + 1) return;
    }
  }
  return { x, y: cy, z };
}

// Lay a whole nest round centre c (the clutch's block), one column per tick so a Realm never stalls.
// Only ground, plants and old nest pieces are replaced. Dips under it are packed so it never floats.
export function buildNest(dim, c, rand = Math.random) {
  const plan = nestPlan(rand);
  function* job() {
    for (let dx = -NEST_RADIUS; dx <= NEST_RADIUS; dx++) {
      for (let dz = -NEST_RADIUS; dz <= NEST_RADIUS; dz++) {
        const kind = cellKind(dx, dz);
        if (!kind) continue;
        try {
          const at = (dy) => dim.getBlock({ x: c.x + dx, y: c.y + dy, z: c.z + dz });
          for (let dy = 0; dy <= NEST_HEIGHT; dy++) {
            const b = at(dy);
            if (b && !b.isAir && (goodGround(b.typeId) || flattens(b.typeId))) b.setType("minecraft:air");
          }
          for (let dy = -1; dy >= -3; dy--) {
            const b = at(dy);
            if (!b || !(b.isAir || b.isLiquid || flattens(b.typeId))) break;
            b.setType(kind === "inner" || kind === "outer" ? WEAVE : FILL);
          }
          for (const p of plan) {
            if (p.dx !== dx || p.dz !== dz) continue;
            const b = at(p.dy);
            if (b?.isAir) b.setPermutation(BlockPermutation.resolve(p.id, p.states));
          }
        } catch {
          // a column that isn't loaded: the rest of the nest still goes down
        }
        yield;
      }
    }
  }
  system.runJob(job());
}

// The clutch shows eggs, or broken shell after an egg has been taken until the nest lays again
export function setLaid(block, laid) {
  try {
    if (block?.typeId === NEST && block.permutation.getState("hc:laid") !== laid) block.setPermutation(block.permutation.withState("hc:laid", laid));
  } catch {
    // not loaded
  }
}

const wild = () => (store.data.wild ??= []);

function tryNest(player) {
  if (player.dimension.id !== "minecraft:overworld") return;
  const plots = allPlots();
  const here = player.location;
  if (regionNear(plots, here.x, here.z) !== S.homeRegion) return;
  if (wild().length >= WILD_NESTS.max || Math.random() > WILD_NESTS.chance) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = WILD_NESTS.near + Math.random() * (WILD_NESTS.far - WILD_NESTS.near);
  const x = Math.floor(here.x + Math.cos(angle) * dist), z = Math.floor(here.z + Math.sin(angle) * dist);
  if (regionNear(plots, x, z) !== S.homeRegion || tooClose(wild(), x, z)) return;
  let at;
  try {
    at = findSite(player.dimension, x, z);
  } catch {
    return; // not loaded
  }
  if (!at) return;
  const R = NEST_RADIUS;
  if ([[0, 0], [R, R], [R, -R], [-R, R], [-R, -R]].some(([dx, dz]) => settlementAt({ x: x + dx, y: at.y, z: z + dz }))) return; // never on anyone's land
  buildNest(player.dimension, at);
  wild().push({ ...at, full: true });
  save();
}

// Forget nests that are gone, lay fresh eggs in nests whose wait is over, and grow nests from before the
// redesign (a single block) into whole nests. Only where the chunk is loaded.
function tidy(dim) {
  const list = wild();
  const now = world.getAbsoluteTime();
  let changed = false;
  const keep = list.filter((n) => {
    try {
      const b = dim.getBlock(n);
      if (!b) return true; // unloaded: keep it
      if (b.typeId !== NEST) return false;
      if ((store.data.nests[`${n.x},${n.y},${n.z}`] ?? 0) <= now) setLaid(b, true);
      if (!n.full) {
        buildNest(dim, n);
        n.full = changed = true;
      }
      return true;
    } catch {
      return true;
    }
  });
  if (changed || keep.length !== list.length) {
    store.data.wild = keep;
    save();
  }
}

onTick("dragons_wild_nests", WILD_NESTS.everyTicks, () => {
  if (!isReady()) return;
  try {
    if (!mapMode()) return; // no map yet: nests come from the test world
    const dim = world.getDimension("overworld");
    tidy(dim);
    for (const p of world.getPlayers()) tryNest(p);
  } catch (e) {
    console.warn(`[Hollow Crown] wild nests: ${e}`);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:dragons_nests") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isBuilder(player)) return;
  const list = wild();
  player.sendMessage(list.length ? `§6Wild nests (${list.length}):§7 ${list.map((n) => `${n.x} ${n.y} ${n.z}`).join(", ")}` : "§7No wild nests yet. Walk the Emberwaste.");
});

addTests("dragons", {
  "a nest is 9x9 with rounded corners, one clutch and a raised rim": () => {
    for (const seed of [1, 7, 99]) {
      const plan = nestPlan(seeded(seed));
      assert(plan.every((p) => Math.abs(p.dx) <= 4 && Math.abs(p.dz) <= 4 && p.dy >= 0 && p.dy < NEST_HEIGHT), "inside 9x9");
      assert(plan.every((p) => NEST_PIECES.includes(p.id)), "only nest pieces");
      const clutch = plan.filter((p) => p.id === NEST);
      assertEqual(clutch.length, 1);
      assert(clutch[0].dx === 0 && clutch[0].dy === 0 && clutch[0].dz === 0, "clutch in the middle");
      assert(!plan.some((p) => Math.abs(p.dx) === 4 && Math.abs(p.dz) === 4), "corners cut off");
      for (const [dx, dz] of [[4, 0], [0, -4], [-3, -3]]) {
        assert(plan.filter((p) => p.dx === dx && p.dz === dz && p.id === WEAVE).length >= 2, `outer rim at ${dx},${dz} at least two high`);
      }
      assert(plan.filter((p) => p.id === LINING && p.states["hc:v"] === 3).length <= 1, "one skull at most");
      assert(plan.filter((p) => p.id === LINING).length === 20, "the bowl floor");
      assert(!plan.some((p) => p.id === TWIGS && plan.some((q) => q.dx === p.dx && q.dz === p.dz && q.dy === p.dy + 1)), "nothing on top of twigs");
      assert(!plan.some((p) => p.id === FILL), "fill only goes under the nest");
    }
  },
  "wild nests need ground that is fairly level": () => {
    const dim = (height) => ({
      getTopmostBlock: ({ x, z }) => ({ y: height(x, z), typeId: "minecraft:red_sand", below() { return this; } }),
    });
    assert(findSite(dim(() => 64), 0, 0)?.y === 64, "flat ground fits");
    assert(findSite(dim((x) => 64 + (x > 2 ? 1 : 0)), 0, 0), "a small step fits");
    assert(!findSite(dim((x) => 64 + (x > 2 ? 3 : 0)), 0, 0), "a cliff doesn't");
    assert(!findSite({ getTopmostBlock: () => ({ y: 64, typeId: "minecraft:water", below() { return this; } }) }, 0, 0), "not on water");
  },
  "wild nests settle on the right ground": () => {
    assert(goodGround("minecraft:red_sand"), "red sand");
    assert(goodGround("minecraft:sandstone"), "sandstone");
    assert(!goodGround("minecraft:water"), "water");
    assert(!goodGround("minecraft:oak_leaves"), "leaves");
    assert(!goodGround("minecraft:sandstone_slab"), "slab");
  },
  "wild nests stay in their region and apart": () => {
    const plots = [{ x: 0, z: 0, region: "Emberwaste" }, { x: 1000, z: 0, region: "Frostmarch" }];
    assertEqual(regionNear(plots, 100, 50), "Emberwaste");
    assertEqual(regionNear(plots, 900, 0), "Frostmarch");
    assert(tooClose([{ x: 0, z: 0 }], 100, 0), "100 blocks is too close");
    assert(!tooClose([{ x: 0, z: 0 }], 200, 0), "200 blocks is far enough");
  },
});
