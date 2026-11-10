// The Hollow's air: small particle effects given off by what grows there, so the place moves.
// (Mateo, 2026-11-10: "we need all of that", about the textures thread's seven particle effects.)
//
// Twice a second, for each player in the Hollow, a few random spots near them are looked at. If the
// block there is one that glows, sheds or drips, it gives off its particle. Nothing is stored and
// nothing is changed in the world, so this can be switched off without leaving anything behind.
// The effects themselves are the textures thread's (particles/*.json in the resource pack).

import { world } from "@minecraft/server";
import { onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { heightAt } from "../undertow/terrain.js";

export const AIR = {
  everyTicks: 10,
  groundSpots: 6, // spots on the ground looked at per player each pass
  airSpots: 5, // spots in the air around the player (giant caps, hanging moss, tree cores)
  reach: 12, // blocks from the player
  motes: 1, // drifting motes per pass, wherever the player is
};

// block -> [particle, chance per look, how far above the block's base it appears]
export const GIVES_OFF = {
  "siege:veilcap": ["siege:veil_spore", 0.5, 0.7],
  "siege:veilcap_cap": ["siege:veil_spore", 0.7, -0.2], // spores fall from under the cap
  "siege:glimbulb": ["siege:hollow_mote", 0.3, 0.8],
  "siege:hollowwood_core": ["siege:hollow_mote", 0.4, 0.5],
  "siege:undertow_moss": ["siege:hollow_mote", 0.04, 1.3],
  "siege:veilmoss_strands": ["siege:moss_drip", 0.3, 0.1],
  "siege:glint_cluster": ["siege:glint", 0.6, 0.6],
  "minecraft:amethyst_cluster": ["siege:glint", 0.25, 0.5],
  "siege:choir_ore": ["siege:glint", 0.3, 0.5],
  "siege:veinstone": ["siege:vein_spark", 0.06, 1.05],
  "siege:cracked_veinstone_bricks": ["siege:vein_spark", 0.15, 1.05],
  "siege:pale_ash": ["siege:pale_ash", 0.12, 1.1],
};

// What a block gives off on this look, or undefined. roll is 0..1. Pure.
export function particleFor(typeId, roll) {
  const g = GIVES_OFF[typeId];
  return g && roll < g[1] ? { id: g[0], dy: g[2] } : undefined;
}

const rnd = (n) => (Math.random() * 2 - 1) * n;

function look(dim, x, y, z) {
  let block;
  try { block = dim.getBlock({ x, y, z }); } catch { return; } // not loaded
  const p = block && particleFor(block.typeId, Math.random());
  if (!p) return;
  try { dim.spawnParticle(p.id, { x: x + 0.5 + rnd(0.3), y: y + p.dy, z: z + 0.5 + rnd(0.3) }); } catch { /* effect missing or spot unloaded */ }
}

let on = true;
export function setHollowAir(value) { on = !!value; }

onTick("hollowfolk:air", AIR.everyTicks, () => {
  if (!on) return;
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== UNDERTOW_ID) continue;
    const dim = player.dimension, l = player.location;
    for (let i = 0; i < AIR.groundSpots; i++) {
      const x = Math.floor(l.x + rnd(AIR.reach)), z = Math.floor(l.z + rnd(AIR.reach));
      const y = heightAt(x, z);
      if (y === null || y === undefined || Math.abs(y - l.y) > 16) continue;
      look(dim, x, y + 1, z); // a plant or crystal standing on the ground
      look(dim, x, y, z); // or the ground itself
    }
    for (let i = 0; i < AIR.airSpots; i++) look(dim, Math.floor(l.x + rnd(8)), Math.floor(l.y + 1 + rnd(6)), Math.floor(l.z + rnd(8)));
    for (let i = 0; i < AIR.motes; i++) {
      try { dim.spawnParticle("siege:hollow_mote", { x: l.x + rnd(7), y: l.y + 1 + Math.random() * 4, z: l.z + rnd(7) }); } catch { /* effect missing */ }
    }
  }
});

addTests("hollow air", {
  "every block that gives something off names one of the seven effects, with a sane chance": () => {
    const known = ["siege:hollow_mote", "siege:vein_spark", "siege:glint", "siege:pale_ash", "siege:veil_spore", "siege:moss_drip"];
    for (const [block, [id, chance]] of Object.entries(GIVES_OFF)) {
      assert(known.includes(id), `${block} gives off an unknown effect ${id}`);
      assert(chance > 0 && chance <= 1, `${block} has chance ${chance}`);
    }
  },
  "plain rock gives off nothing, and the common ground only rarely": () => {
    assertEqual(particleFor("minecraft:basalt", 0), undefined);
    assertEqual(particleFor("siege:veinstone", 0.5), undefined);
    assertEqual(particleFor("siege:veinstone", 0.01).id, "siege:vein_spark");
  },
});
