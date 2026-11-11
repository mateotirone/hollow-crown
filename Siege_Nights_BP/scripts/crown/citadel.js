// The Citadel: raising it from the Cornerstone, its land, its border, and who sits in it.

import { world, system, ItemStack, BlockPermutation, BlockVolume, MolangVariableMap, GameMode } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import {
  isReady, getState, saveState, keepOf, keepBlock, overworld, title, onTick, on,
  addLandClaim, addFoundingCheck, addKeepHealthHook, addGuardLimitHook,
  guardTag, GUARD_TYPES, BALLISTA, TREBUCHET, KEEP_BANNER, COLORS, DYE_RGB,
} from "../siege/api.js";
import { CROWN, IDS } from "./config.js";
import { citadelPlan, colorJobs, gateToward, thronePlace, outsideGate, GATE_NAMES, KEEP_HALF } from "./layout.js";
import { crown, saveCrown, ruler, isRuler, rulerLabel, announce, giveItem, surfaceY, seat, citadelName } from "./state.js";
import { cleanCitadelName } from "./rules.js";
import { sfx } from "../core/sfx.js";

export const citadel = () => crown().citadel;
export const inCitadel = (loc) => {
  const c = citadel();
  return !!c && Math.hypot(loc.x - c.x, loc.z - c.z) <= CROWN.citadelRadius;
};

// ---------- Land and limits ----------

// Citadel land reaches further than any settlement, and belongs to whoever wears the Crown
addLandClaim((location) => {
  const r = ruler();
  return r && inCitadel(location) && keepOf(r.id) ? r.id : undefined;
});

addFoundingCheck((player) => (isRuler(player.id) && citadel()
  ? `§cYour seat is ${citadelName()}. The throne does not move house.` : undefined));

// While a rival lord rules, nobody settles on their doorstep
addFoundingCheck((player, block) => {
  const r = ruler();
  const s = r?.npc && seat();
  if (!s) return undefined;
  const reach = citadel() ? CROWN.citadelRadius : CROWN.npcLand;
  return Math.hypot(block.location.x - s.x, block.location.z - s.z) <= reach
    ? `§cThis is ${rulerLabel()}'s ground now. Take the throne back before you raise a banner here.` : undefined;
});

addKeepHealthHook((owner, hp) => (isRuler(owner) && citadel() ? Math.max(hp, CROWN.citadelKeepHealth) : hp));
addGuardLimitHook((owner, limit) => (isRuler(owner) ? limit + CROWN.royalGuardBonus : limit));

// ---------- Blocks ----------

// The rest of the Castle Stone family, at the Citadel's armor where the block has that state
function dressedStone(id) {
  try { return BlockPermutation.resolve(id, { "siege:armor": 3, "siege:cracks": 0 }); } catch { return id; }
}

let palette;
function blockFor(name, c) {
  palette ??= {
    stone: BlockPermutation.resolve("siege:castle_stone", { "siege:armor": 3, "siege:cracks": 0 }),
    smooth: dressedStone("siege:castle_smooth"), band: dressedStone("siege:castle_bricks"), plinth: dressedStone("siege:castle_cobbled"),
    port: BlockPermutation.resolve("siege:portcullis", { "siege:armor": 3, "siege:open": false }),
    battlement: "siege:battlement", slit: "siege:arrow_slit", spire: "siege:spire_roof", brazier: "siege:brazier",
    throne: IDS.throne, air: "minecraft:air", tile: "minecraft:deepslate_tiles", floor: "minecraft:polished_deepslate",
    quartz: "minecraft:quartz_block", gold: "minecraft:gold_block",
  };
  if (name === "wool") return `minecraft:${COLORS[c.color ?? 14]}_wool`;
  if (name === "carpet") return `minecraft:${COLORS[c.color ?? 14]}_carpet`;
  if (name === "ladder") return BlockPermutation.resolve("minecraft:ladder", { facing_direction: [5, 3, 4, 2][c.gate] });
  return palette[name];
}

const SOFT = /leaves|short_grass|tall_grass|fern|flower|snow_layer|vine|sapling|bush|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily/;

let plan; // the job list for the current Citadel (worked out again after a reload: it is always the same)
function jobsFor(c) {
  const key = `${c.x},${c.z},${c.kx},${c.kz},${c.gate}`;
  if (plan?.key !== key) plan = { key, jobs: citadelPlan({ banner: { x: c.x, z: c.z }, keep: { x: c.kx, z: c.kz }, gate: c.gate }) };
  return plan.jobs;
}

// Carries out one job. False means that land isn't loaded right now: try again later.
function build(job, c) {
  const dim = overworld();
  const base = job.base === "keep" ? c.ky : c.y;
  try {
    if (job.k === "found") {
      for (let y = base - 1; y > base - 24; y--) {
        const block = dim.getBlock({ x: job.x, y, z: job.z });
        if (!block) return false;
        if (!block.isAir && !block.isLiquid && !SOFT.test(block.typeId)) break;
        block.setPermutation(blockFor("stone", c));
      }
      return true;
    }
    dim.fillBlocks(new BlockVolume({ x: job.x, y: base + job.y1, z: job.z }, { x: job.x, y: base + job.y2, z: job.z }), blockFor(job.block, c));
    return true;
  } catch {
    return false;
  }
}

// ---------- The Cornerstone: choosing where the Great Keep stands ----------

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, player } = event;
  if (!isReady() || block.typeId !== IDS.cornerstone) return;
  const c = crown();
  const keep = keepOf(player.id);
  let problem;
  if (!isRuler(player.id)) problem = `§cOnly the bearer of ${CROWN.relic} can lay the Citadel's Cornerstone.`;
  else if (c.citadel) problem = `§c${citadelName()} already stands.`;
  else if (!keep) problem = "§cRaise a Keep Banner first. The Citadel grows around it.";
  else if (Math.hypot(block.location.x - keep.x, block.location.z - keep.z) > CROWN.keepMaxFromBanner) problem = `§cToo far out. Lay it within ${CROWN.keepMaxFromBanner} blocks of your Keep Banner.`;
  else if (block.location.y + 80 > block.dimension.heightRange.max) problem = "§cToo high up. The Great Keep is 76 blocks tall.";
  if (problem) {
    block.setType("minecraft:air");
    if (player.getGameMode() !== GameMode.Creative) giveItem(player, new ItemStack(IDS.cornerstone, 1));
    return player.sendMessage(problem);
  }
  if (c.cornerstone) { // moved: take the old one away
    try { overworld().getBlock(c.cornerstone)?.setType("minecraft:air"); } catch { /* not loaded */ }
  }
  c.cornerstone = { ...block.location };
  saveCrown();
  const gate = gateToward(keep, world.getDefaultSpawnLocation());
  player.sendMessage(`§6The Great Keep will stand here, 25 blocks square around this stone, and everything inside that square will be cleared. The gatehouse will face ${GATE_NAMES[gate]}. §7Break the stone to move it, or click it to raise ${citadelName()}.`);
});

function outlineTick() {
  const c = crown();
  if (!c.cornerstone || c.citadel) return;
  const dim = overworld();
  let block;
  try { block = dim.getBlock(c.cornerstone); } catch { return; }
  if (block && block.typeId !== IDS.cornerstone) { // broken: back in the ruler's hands
    c.cornerstone = null;
    return saveCrown();
  }
  const vars = new MolangVariableMap();
  vars.setColorRGB("variable.color", { red: 1, green: 0.8, blue: 0.2 });
  const { x, y, z } = c.cornerstone;
  for (let t = -KEEP_HALF; t <= KEEP_HALF; t += 2) {
    for (const [dx, dz] of [[t, -KEEP_HALF], [t, KEEP_HALF + 1], [-KEEP_HALF, t], [KEEP_HALF + 1, t]]) {
      for (const dy of [0.3, 6, 12]) {
        try { dim.spawnParticle("minecraft:redstone_wire_dust_particle", { x: x + dx, y: y + dy, z: z + dz }, vars); } catch { /* not loaded */ }
      }
    }
  }
}

export function clickCornerstone(block, player) {
  const c = crown();
  if (!isRuler(player.id)) return player.onScreenDisplay.setActionBar("§7The Citadel's Cornerstone. Only the ruler can raise it.");
  const keep = keepOf(player.id);
  if (!keep || c.citadel) return;
  // One screen: name it, and confirm. Closing the screen (X) means "not yet".
  new ModalFormData()
    .title("Raise your Citadel?")
    .textField(`The Citadel will rise here over about 3 minutes.\n\nThe Great Keep (25 by 25, 76 tall) replaces everything in the outlined square. The curtain wall rises 92 blocks out from your Keep Banner, outside your old land.\n\nThis can't be undone.\n\n§6Name your Citadel§r (everyone will see it; leave it empty for ${CROWN.citadelName}):`, CROWN.citadelName)
    .submitButton("Raise it")
    .show(player).then((r) => {
      if (r.canceled || crown().citadel || !isRuler(player.id)) return;
      crown().citadelName = cleanCitadelName(r.formValues?.[0]);
      raiseCitadel(player, block.location);
    }).catch(() => {});
}

function tickingAreas(c, on) {
  const dim = overworld();
  const r = CROWN.wallRadius + 10;
  const corners = [[-r, -r, 0, 0], [0, -r, r, 0], [-r, 0, 0, r], [0, 0, r, r]];
  corners.forEach(([x1, z1, x2, z2], i) => {
    try {
      dim.runCommand(on
        ? `tickingarea add ${c.x + x1} 0 ${c.z + z1} ${c.x + x2} 0 ${c.z + z2} siege_citadel_${i}`
        : `tickingarea remove siege_citadel_${i}`);
    } catch { /* the world has no room for more ticking areas: the build waits for players to walk the walls */ }
  });
}

export function raiseCitadel(player, stone, { fast = false } = {}) {
  const c = crown();
  const keep = keepOf(player.id);
  c.citadel = {
    x: keep.x, y: keep.y, z: keep.z, kx: stone.x, ky: stone.y, kz: stone.z,
    gate: gateToward(keep, world.getDefaultSpawnLocation()), color: keep.color ?? 14,
    built: false, next: 0, retry: [],
  };
  if (fast) c.citadel.fast = true; // test worlds: up in about 30 seconds
  c.cornerstone = null;
  saveCrown();
  tickingAreas(c.citadel, true);
  announce(`§6The ground shakes. ${citadelName()} is rising around ${rulerLabel()}'s keep!`, "mob.wither.spawn");
  title(player, `§6${citadelName()}`, "§7The Citadel rises");
}

function buildTick() {
  const c = citadel();
  if (!c || c.built) return;
  const jobs = jobsFor(c);
  const perRun = Math.max(4, Math.ceil(jobs.length / (CROWN.buildTicks / 2))) * (c.fast ? 6 : 1);
  if (c.next < jobs.length) {
    const end = Math.min(jobs.length, c.next + perRun);
    for (; c.next < end; c.next++) if (!build(jobs[c.next], c)) c.retry.push(c.next);
    if (c.next % (perRun * 100) < perRun) {
      saveCrown(); // every 10 seconds
      const pct = Math.floor((c.next / jobs.length) * 100);
      for (const p of overworld().getPlayers({ location: { x: c.x, y: c.y, z: c.z }, maxDistance: 160 })) {
        p.onScreenDisplay.setActionBar(`§6${citadelName()} rises: ${pct}%`);
        sfx(p, "dig.stone", { volume: 0.6, pitch: 0.6 });
      }
    }
    return;
  }
  // main pass done: go back for anything whose land wasn't loaded
  if (c.retry.length && system.currentTick % 40 < 2) {
    const batch = c.retry.splice(0, 400);
    for (const i of batch) if (!build(jobs[i], c)) c.retry.push(i);
    saveCrown();
  }
  if (!c.retry.length) {
    c.built = true;
    delete c.next;
    saveCrown();
    tickingAreas(c, false);
    announce(`§6${citadelName()} stands. All roads now lead to ${rulerLabel()}.`, "ui.toast.challenge_complete");
  }
}

// Repaint the hangings and carpet in the new ruler's color
export function recolor(color) {
  const c = citadel();
  if (!c) return;
  c.color = color;
  c.repaint = true;
  saveCrown();
}

function repaintTick() {
  const c = citadel();
  if (!c?.repaint || !c.built) return;
  let all = true;
  for (const job of colorJobs(jobsFor(c))) all = build(job, c) && all;
  if (all) {
    delete c.repaint;
    saveCrown();
  }
}

// ---------- Places ----------

export function throneSpots() {
  const c = citadel();
  if (!c) return undefined;
  const t = thronePlace({ x: c.kx, z: c.kz }, c.gate);
  const lift = (s) => ({ x: s.x + 0.5, y: c.ky + s.y, z: s.z + 0.5 });
  return { throne: lift(t.throne), seal: lift(t.seal), door: lift(t.door) };
}

// Just outside the gate (or just beyond the land, if there's no Citadel yet)
export function exilePoint(from) {
  const c = citadel();
  let spot;
  if (c) spot = outsideGate(c, c.gate);
  else spot = { x: from.x + CROWN.citadelRadius + 8, z: from.z };
  const y = surfaceY(spot.x, spot.z);
  return { x: spot.x + 0.5, y: (y ?? from.y) + 1, z: spot.z + 0.5 };
}

// ---------- Protection: the Citadel's banner and throne can't be carried off ----------

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (!isReady()) return;
  const c = citadel();
  if (!c) return;
  const { block, player } = event;
  const l = block.location;
  const banner = block.typeId === KEEP_BANNER && l.x === c.x && l.y === c.y && l.z === c.z;
  const throne = block.typeId === IDS.throne && inCitadel(l) && player.getGameMode() !== GameMode.Creative;
  if (!banner && !throne) return;
  event.cancel = true;
  system.run(() => player.onScreenDisplay.setActionBar(banner
    ? `§c${citadelName()} can't be toppled by taking its banner. Earn a Claim and throw down the Gauntlet.`
    : "§cThe throne does not move."));
});

world.beforeEvents.explosion?.subscribe((event) => {
  if (!isReady() || !citadel() || event.dimension.id !== "minecraft:overworld") return;
  const blocks = event.getImpactedBlocks();
  const safe = blocks.filter((b) => b.typeId !== IDS.throne);
  if (safe.length !== blocks.length) event.setImpactedBlocks(safe);
});

// ---------- Border ----------

const inside = new Map(); // player id -> were they on Citadel land last time we looked

function borderTick() {
  const c = citadel();
  if (!c) return;
  const r = CROWN.citadelRadius;
  const [cr, cg, cb] = DYE_RGB[COLORS[c.color ?? 14]];
  const vars = new MolangVariableMap();
  vars.setColorRGB("variable.color", { red: cr / 255, green: cg / 255, blue: cb / 255 });
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const loc = player.location;
    const d = Math.hypot(loc.x - c.x - 0.5, loc.z - c.z - 0.5);
    const now = d <= r;
    if (now !== (inside.get(player.id) ?? false)) {
      inside.set(player.id, now);
      if (now) player.onScreenDisplay.setActionBar(ruler() ? `§6Entering ${citadelName()}, seat of ${rulerLabel()}` : `§7Entering ${citadelName()}. Its throne stands empty.`);
    }
    if (Math.abs(d - r) > 10) continue;
    const angle = Math.atan2(loc.z - c.z - 0.5, loc.x - c.x - 0.5);
    for (let k = -8; k <= 8; k++) {
      const a = angle + (k * 1.5) / r;
      for (const dy of [0.2, 1.2, 2.2]) {
        try {
          player.spawnParticle("minecraft:redstone_wire_dust_particle", { x: c.x + 0.5 + Math.cos(a) * r, y: loc.y + dy, z: c.z + 0.5 + Math.sin(a) * r }, vars);
        } catch { /* not loaded */ }
      }
    }
  }
}

// ---------- Moving in: the seat changes hands ----------
// `to` becomes the holder of the keep at `spot` (the Citadel's banner, or the old ruler's keep if the
// Citadel was never raised). Their old settlement is given up, and the Royal Guard changes sides.

export function moveIn(to, spot) {
  const st = getState();
  const c = crown();
  const holder = Object.keys(st.keeps).find((o) => st.keeps[o].x === spot.x && st.keeps[o].y === spot.y && st.keeps[o].z === spot.z);
  if (holder === to.id) return;
  const mine = st.keeps[to.id];
  const color = mine?.color ?? st.keeps[holder]?.color ?? 14;
  const allies = (mine?.allies ?? []).filter((id) => id !== holder);

  if (mine) { // give up the old plot: the banner falls, the guards there are paid off
    try { if (keepBlock(mine)) overworld().runCommand(`setblock ${mine.x} ${mine.y} ${mine.z} air destroy`); } catch { /* not loaded */ }
    c.treasury += (st.guards[to.id] ?? 0) * CROWN.guardCost;
    c.strays.push({ id: to.id, x: mine.x, z: mine.z });
    c.strays = c.strays.slice(-6);
  }
  const taken = c.npcKeep && c.npcKeep.x === spot.x && c.npcKeep.z === spot.z ? c.npcKeep : undefined; // won back from a lord
  const base = holder ? st.keeps[holder] : taken ?? { x: spot.x, y: spot.y, z: spot.z, wins: 10, warlordsSlain: 2, tier: "Castle" };
  if (holder) {
    delete st.keeps[holder];
    c.formerRulers = [...c.formerRulers.filter((id) => id !== holder), holder];
  }
  c.formerRulers = c.formerRulers.filter((id) => id !== to.id);
  st.keeps[to.id] = { ...base, name: to.name, color, allies };
  st.guards[to.id] = holder ? st.guards[holder] ?? 0 : 0;
  if (holder) delete st.guards[holder];
  saveState();

  try {
    const block = overworld().getBlock(spot);
    if (block) block.setPermutation(BlockPermutation.resolve(KEEP_BANNER, { "siege:color": color }));
  } catch { /* not loaded: the banner keeps its old color until someone visits */ }
  recolor(color);
  saveCrown();
}

// Guards and machines on Citadel land answer to the Crown, whoever wears it
function loyaltyTick() {
  const c = crown();
  const r = ruler();
  const dim = overworld();
  if (c.strays.length) {
    for (const stray of c.strays) {
      for (const type of Object.keys(GUARD_TYPES)) {
        for (const guard of dim.getEntities({ type, tags: [guardTag(stray.id)], location: { x: stray.x, y: 64, z: stray.z }, maxDistance: 400 })) {
          if (Math.hypot(guard.location.x - stray.x, guard.location.z - stray.z) <= 90) guard.remove();
        }
      }
    }
  }
  const spot = citadel() ?? (r && keepOf(r.id));
  if (!r || r.npc || !spot || !c.formerRulers.length) return; // a lord brings their own soldiers
  const near = { location: { x: spot.x, y: spot.y, z: spot.z }, maxDistance: CROWN.citadelRadius + 60 };
  const color = keepOf(r.id)?.color ?? 14;
  for (const old of c.formerRulers) {
    for (const type of Object.keys(GUARD_TYPES)) {
      for (const guard of dim.getEntities({ type, tags: [guardTag(old)], ...near })) {
        if (Math.hypot(guard.location.x - spot.x, guard.location.z - spot.z) > CROWN.citadelRadius) continue;
        guard.removeTag(guardTag(old));
        guard.addTag(guardTag(r.id));
        guard.triggerEvent(`siege:color_${color}`);
      }
    }
    for (const type of [BALLISTA, TREBUCHET]) {
      for (const machine of dim.getEntities({ type, ...near })) {
        if (machine.getDynamicProperty("siege:owner") === old) machine.setDynamicProperty("siege:owner", r.id);
      }
    }
  }
}

// Someone who settles again keeps their new guards
on("keepFounded", ({ player }) => {
  const c = crown();
  if (!c.strays.some((s) => s.id === player.id)) return;
  c.strays = c.strays.filter((s) => s.id !== player.id);
  saveCrown();
});

onTick("crown citadel build", 2, buildTick);
onTick("crown citadel border", 20, () => { borderTick(); outlineTick(); });
onTick("crown citadel loyalty", 100, () => { loyaltyTick(); repaintTick(); });
