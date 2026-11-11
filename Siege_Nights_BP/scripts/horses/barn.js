// The Stables raises a real stable (Mateo, 2026-11-11): place the Stables block on your land and a barn in
// your region's style rises behind it, running away from you. The block stays at the front door and still
// opens the horse menu. Each Stables upgrade rebuilds the barn bigger over the same spot:
//   level 1   3 stalls and a tack corner        (11 x 9)
//   level 2   5 stalls and a tack corner        (11 x 13)
//   level 3   8 stalls and a tack room behind   (11 x 21)
// Free: the Stables block and its upgrades are the price. It needs room on your own land, clear of ground
// kept for your hall; if there isn't any, the Stables still works as a plain block and says why.
//
// The Breeder's Post (placed by the map builder in Creative) raises a breeder's yard the same way: a fenced
// paddock with an open shelter at the back, the post at the front gate.
//
// Test: /scriptevent siege:barn_build [1-3 | yard] [style]   raise one where you stand (creative)

import { world, system } from "@minecraft/server";
import { onTick, isReady, settlementAt, moduleStore, on, addTests, assert, assertEqual } from "../siege/api.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { STYLES, STYLE_IDS } from "../townhall/styles.js";
import { styleFor } from "../settle/buildings.js";
import { drawBarn, drawBreederYard, BARN_STALLS } from "./barndesign.js";
export { drawBarn, drawBreederYard, BARN_STALLS } from "./barndesign.js";
import { siteProblem, styleOf } from "../settle/plans.js";
import { footprint } from "../settle/rules.js";
import { sfx } from "../core/sfx.js";

const OVERWORLD = "minecraft:overworld";
export const STABLES_BLOCK = "siege:stables";
export const BREEDER_POST_BLOCK = "hc:breeder_post";

// sites: { ownerId: { x, y, z, fx, fz, style, built, pending } }
const store = moduleStore("siege:horses_barns", () => ({ sites: {} }));
const sites = () => store.data.sites;
const jobId = (owner) => `barn:${owner}`;

const plans = new Map();
const planFor = (level, style) => {
  const key = `${level}|${style}`;
  if (!plans.has(key)) plans.set(key, level === "yard" ? drawBreederYard(style) : drawBarn(level, style));
  return plans.get(key);
};

// ---------- raising ----------

const cardinal = (v) => (Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 });
const say = (player, text) => { try { player?.sendMessage(text); } catch { /* left */ } };

function start(owner, site, level) {
  if (buildFor(jobId(owner))) return;
  const plan = planFor(level, site.style);
  site.pending = level;
  store.save();
  startBuild({
    id: jobId(owner), dimensionId: OVERWORLD, origin: { x: site.x, y: site.y, z: site.z }, forward: { x: site.fx, z: site.fz },
    plan, style: styleFor(site.style), perTick: Math.max(4, Math.ceil(plan.cells.size / 400)),
    onDone() {
      site.built = level;
      site.pending = undefined;
      store.save();
      const player = world.getPlayers().find((p) => p.id === owner);
      if (player) { say(player, `§6Your stable is finished: ${BARN_STALLS[level]} stalls.`); sfx(player, "random.levelup", { volume: 0.5 }); }
    },
  });
}

// Why a barn of this level can't stand here, or undefined
function problemFor(owner, site, level) {
  const box = footprint(site, { x: site.fx, z: site.fz }, planFor(level, site.style).bounds());
  return siteProblem(owner, box);
}

export function raiseBarn(owner, level, player) {
  const site = sites()[owner];
  if (!site || (site.built ?? 0) >= level) return;
  const problem = problemFor(owner, site, level);
  if (problem) return say(player, `§7No room for a level ${level} stable here: ${problem} §8The Stables still works as it is.`);
  start(owner, site, level);
  say(player, `§6A stable with ${BARN_STALLS[level]} stalls is rising behind your Stables.`);
}

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady() || block.typeId !== STABLES_BLOCK || block.dimension.id !== OVERWORLD) return;
  const owner = settlementAt(block.location);
  if (!owner) return;
  const old = sites()[owner];
  if (old) {
    let standing = false;
    try { standing = world.getDimension(OVERWORLD).getBlock(old)?.typeId === STABLES_BLOCK; } catch { standing = true; }
    if (standing) return say(player, "§7This settlement already has a stable building. This block works as a second door to it.");
  }
  const f = cardinal(player.getViewDirection());
  const { x, y, z } = block.location;
  sites()[owner] = { x, y, z, fx: f.x, fz: f.z, style: styleOf(owner, block), built: 0 };
  store.save();
  system.runTimeout(() => raiseBarn(owner, getLevel(owner), player), 2); // after the Stables records its level
});

// The map builder sets down a Breeder's Post: its yard rises behind it, away from the builder
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!isReady() || block.typeId !== BREEDER_POST_BLOCK || block.dimension.id !== OVERWORLD) return;
  if (player.getGameMode?.() !== "Creative") return; // horses/index.js takes it back off anyone else
  let style = "vale";
  try { style = styleOf(undefined, block); } catch { /* no map: Vale */ }
  const { x, y, z } = block.location;
  startBuild({ id: `yard:${x},${y},${z}`, dimensionId: OVERWORLD, origin: { x, y, z }, forward: cardinal(player.getViewDirection()),
    plan: planFor("yard", style), style: styleFor(style), perTick: 40 });
  say(player, `§6A breeder's yard (${STYLES[style]?.name ?? style}) is going up behind the post. Sneak-click the post to change its breed.`);
});

let getLevel = () => 1;
export const useStablesLevel = (fn) => { getLevel = fn; };

// An upgrade at the Stables rebuilds the barn bigger
on("stablesUpgraded", ({ owner, level, player }) => raiseBarn(owner, level, player));

// A build cut short by the world closing carries on when it loads again
onTick("horses_barns", 200, () => {
  if (!isReady()) return;
  for (const [owner, site] of Object.entries(sites())) {
    if (site.pending && !buildFor(jobId(owner))) start(owner, site, site.pending);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:barn_build") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const [lv = "3", style = "vale"] = event.message.trim().split(/\s+/);
  const level = lv === "yard" ? "yard" : Math.max(1, Math.min(3, Number(lv) || 3));
  if (!STYLES[style]) return say(player, `§7Styles: ${STYLE_IDS.join(", ")}.`);
  const f = cardinal(player.getViewDirection());
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const plan = planFor(level, style);
  startBuild({ id: `barn:test:${at.x},${at.z}`, dimensionId: player.dimension.id, origin: at, forward: f, plan, style: styleFor(style), perTick: 40 });
  say(player, `§6${level === "yard" ? "Breeder's yard" : `Level ${level} stable`} (${STYLES[style].name}) rising in front of you.`);
});

addTests("horses", {
  "the stable grows with the Stables and keeps odd sizes": () => {
    let last = 0;
    for (const lv of [1, 2, 3]) for (const id of STYLE_IDS) {
      const plan = drawBarn(lv, id);
      for (const c of plan.cells.values()) assert(plan.style.roles[c.role], `level ${lv} (${id}) uses unknown role ${c.role}`);
      const b = plan.bounds();
      assert(b.z0 >= 0 && !plan.get(0, 1, 0), "the barn must rise behind the Stables block");
      assertEqual((b.x1 - b.x0 + 1) % 2, 1, "odd width");
      if (id === "vale") { assert(b.z1 > last, `level ${lv} is longer than the last`); last = b.z1; }
    }
  },
  "the breeder's yard draws in every style behind its post": () => {
    for (const id of STYLE_IDS) {
      const plan = drawBreederYard(id);
      for (const c of plan.cells.values()) assert(plan.style.roles[c.role], `yard (${id}) uses unknown role ${c.role}`);
      assert(plan.bounds().z0 >= 0 && !plan.get(0, 1, 0), "the yard must rise behind the post");
    }
  },
  "every level has as many stalls as the Stables holds": () => {
    for (const lv of [1, 2, 3]) {
      const hay = [...drawBarn(lv, "vale").cells.values()].filter((c) => c.role === "hay").length;
      assertEqual(hay - (lv === 3 ? 2 : 0), BARN_STALLS[lv], `level ${lv} hay racks`);
    }
  },
});
