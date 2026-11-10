// Wall repair. After a siege the masons can mend the settlement wall: every block of the wall that
// was knocked out is put back and every cracked block is made whole, for a price that follows the
// damage. (A single cracked block can still be patched by hand with stone bricks, as always.)
//
// Anyone can start it by event, so the town hall's "Settlement wall" menu and the Mason both use it:
//   emit("wallRepair", { owner, player })   surveys the wall, shows the price, charges, mends. Sets q.handled.
//   repairWall(owner, { fix, onDone })      the job itself: counts (fix false) or mends (fix true), no charge
// Test: /scriptevent siege:wall_repair        survey and offer (as the Mason does)
//       /scriptevent siege:wall_repair free   mend at once, no charge
//       /scriptevent siege:wall_repair break  knock some holes and cracks into your wall to test with

import { world, system } from "@minecraft/server";
import { MessageFormData } from "@minecraft/server-ui";
import { isReady, getState, onTick, on, emit, damageMap, saveDamage, hitWall } from "../siege/api.js";
import { WALLS, WALL_LEVELS, wallColumns, columnKinds, repairCost } from "./walldata.js";
import { wallOf, wallRising, palette } from "./walls.js";
import { purse, charge, coins } from "./wallet.js";

const OVERWORLD = "minecraft:overworld";
const jobs = new Map(); // owner -> { cells, index, fix, missing, cracked, P, onDone, waited }

function permFor(P, w, kind) {
  if (kind === "tooth") return P.tooth;
  if (kind === "light") return P.light;
  if (kind === "gate") return P.gate(w.gateDir);
  if (kind === "port") return P.port(w.gateDir);
  return P.kinds[kind];
}

// Start counting (fix false) or mending (fix true) a wall. onDone({ missing, cracked }) when finished.
export function repairWall(owner, { fix = false, onDone } = {}) {
  const w = wallOf(owner);
  if (!w || !w.level || !w.ground) return "There is no wall here to mend.";
  if (wallRising(owner)) return "The wall is still rising.";
  if (jobs.has(owner)) return "The masons are already at work on the wall.";
  const L = WALL_LEVELS[w.level];
  const cells = [];
  for (const col of wallColumns({ center: w, radius: w.radius, level: w.level, gateAngle: w.gate, smooth: w.ground })) {
    for (const [y, kind] of columnKinds(L, col)) cells.push([col.x, y, col.z, kind]);
  }
  jobs.set(owner, { cells, index: 0, fix, missing: 0, cracked: 0, P: palette(w.style, L), onDone, waited: 0 });
  return true;
}

function step(owner, job) {
  const w = wallOf(owner);
  if (!w) return jobs.delete(owner);
  const dim = world.getDimension(OVERWORLD);
  const map = damageMap();
  let changed = false;
  for (let budget = WALLS.repair.perTick; budget > 0 && job.index < job.cells.length; budget--) {
    const [x, y, z, kind] = job.cells[job.index];
    const block = dim.getBlock({ x, y, z });
    if (!block) {
      // that stretch is not loaded. Wait a little for someone to come near, then leave it out.
      if (++job.waited < 100) break;
      job.skipped = (job.skipped ?? 0) + 1;
      job.index++;
      continue;
    }
    const want = permFor(job.P, w, kind);
    const key = `${x},${y},${z}`;
    if (want && block.typeId !== want.type.id) {
      job.missing++;
      if (job.fix) { block.setPermutation(want); if (map[key]) { delete map[key]; changed = true; } }
    } else if (map[key]) {
      job.cracked++;
      if (job.fix) {
        delete map[key];
        changed = true;
        try {
          if (block.permutation.getState("siege:cracks")) block.setPermutation(block.permutation.withState("siege:cracks", 0)); // armor a player added stays
        } catch {
          // this block shows no cracks
        }
      }
    }
    job.index++;
  }
  if (changed) saveDamage();
  if (job.index < job.cells.length) return;
  jobs.delete(owner);
  const result = { missing: job.missing, cracked: job.cracked, skipped: job.skipped ?? 0 };
  if (job.fix) emit("wallRepaired", { owner, ...result });
  job.onDone?.(result);
}

onTick("settle_wall_repair", 1, () => {
  if (!isReady()) return;
  for (const [owner, job] of jobs) {
    try {
      step(owner, job);
    } catch (e) {
      jobs.delete(owner);
      console.warn(`[Hollow Crown] wall repair ${owner}: ${e}`);
    }
  }
});

const farNote = (r) => (r.skipped ? ` §7(${r.skipped} blocks were too far away to reach. Walk the wall and ask again.)` : "");

// The whole errand: survey, name the price, take it, mend.
export function offerRepair(player, owner = player.id, { free = false } = {}) {
  if (getState().active) return player.sendMessage("§7The masons won't climb the wall during a siege. Patch cracks by hand with stone bricks until dawn.");
  const started = repairWall(owner, {
    onDone: async (found) => {
      if (!player.isValid) return;
      const price = free ? 0 : repairCost(found);
      if (found.missing + found.cracked === 0) return player.sendMessage(`§aYour wall is whole. Nothing to mend.${farNote(found)}`);
      if (!free) {
        const res = await new MessageFormData().title("Mend the wall")
          .body(`The masons walked your ${WALL_LEVELS[wallOf(owner)?.level]?.name ?? "wall"}.\n\n§f${found.missing}§r blocks knocked out\n§f${found.cracked}§r blocks cracked\n\nMending all of it costs §6${coins(price)}§r. You carry ${coins(purse(player))}.`)
          .button1("Not now").button2("Mend it").show(player);
        if (res.canceled || res.selection !== 1 || !player.isValid) return;
        if (getState().active) return player.sendMessage("§7Too late: the siege has begun.");
        if (!charge(player, price)) return player.sendMessage(`§7Mason: §fMending that is ${coins(price)}.`);
      }
      const go = repairWall(owner, {
        fix: true,
        onDone: (done) => {
          if (!player.isValid) return;
          player.sendMessage(`§aYour wall is mended: ${done.missing} blocks set back, ${done.cracked} made whole.${farNote(done)}`);
          player.playSound("random.anvil_use");
        },
      });
      if (go !== true) player.sendMessage(`§c${go}`);
    },
  });
  if (started !== true) return player.sendMessage(`§c${started}`);
  player.sendMessage("§7The masons are walking your wall...");
}

on("wallRepair", (q) => {
  if (!q.player) return;
  offerRepair(q.player, q.owner ?? q.player.id);
  q.handled = true;
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:wall_repair") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const arg = event.message.trim();
  if (arg === "break") {
    // rough the wall up near the player so there is something to mend
    const dim = player.dimension, at = player.location;
    let hits = 0;
    for (let i = 0; i < 400 && hits < 40; i++) {
      const block = dim.getBlock({ x: Math.floor(at.x + (Math.random() - 0.5) * 16), y: Math.floor(at.y + Math.random() * 8), z: Math.floor(at.z + (Math.random() - 0.5) * 16) });
      if (!block || block.isAir || !wallOf(player.id)) continue;
      const w = wallOf(player.id);
      if (Math.abs(Math.hypot(block.location.x - w.x, block.location.z - w.z) - (w.radius - 1)) > 4) continue;
      hitWall(block, Math.random() < 0.5 ? 3 : 99);
      hits++;
    }
    return player.sendMessage(hits ? `§7Hit ${hits} wall blocks near you.` : "§cStand next to your wall first.");
  }
  offerRepair(player, player.id, { free: arg === "free" });
});
