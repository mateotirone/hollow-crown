// Wild Dragon Nests: they appear by themselves in the Emberwaste as players explore it, so eggs exist on a
// real world without anyone placing nests by hand. A nest settles on open ground out in the wild (never on
// anyone's land), some way off from the player, and the region keeps a handful at a time.
// A nest that is broken or gone is forgotten, and another one turns up somewhere else later.
//
//   /scriptevent siege:dragons_nests        (creative) lists the wild nests

import { world, system } from "@minecraft/server";
import { onTick, isReady, settlementAt, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode, allPlots } from "../plots/claims.js";
import { DRAGON_SETTINGS as S, NEST } from "./data.js";
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
  let top;
  try {
    top = player.dimension.getTopmostBlock({ x, z });
  } catch {
    return; // not loaded
  }
  if (!top || !goodGround(top.typeId)) return;
  const at = { x, y: top.y + 1, z };
  if (settlementAt(at)) return; // never on anyone's land
  const above = player.dimension.getBlock(at);
  if (!above?.isAir) return;
  above.setType(NEST);
  wild().push(at);
  save();
}

// Forget nests that are gone (only checked where the chunk is loaded)
function tidy(dim) {
  const list = wild();
  const keep = list.filter((n) => {
    try {
      const b = dim.getBlock(n);
      return !b || b.typeId === NEST; // unloaded: keep it
    } catch {
      return true;
    }
  });
  if (keep.length !== list.length) {
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
