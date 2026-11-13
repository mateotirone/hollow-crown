// Waking the Ash Seneschal, in the Faceless Vault in the desert south of Sunscar.
//
//   A sandstone stair in a sunken courtyard among the dunes south of Sunscar goes down to an antechamber. Five statues of one king stand in
//   it with their faces chiselled off, each with a line carved under it about when it was made.
//   1. Turn the statues to face the vault door in the order of the king's life, youngest first. A wrong one and they
//      all grind back, and ash scarabs pour out of the cracks. The fifth opens a niche beside the door: the
//      Faceless Seal.
//   2. Press the seal into the blank seal on the wall by the door. The statues turn, one by one, to look at you.
//      The door grinds open from the top. He is at his desk at the far end of the vault.
//   The seal stays in the wall. Once a siege night has passed after he falls, press it again.

import { system, BlockPermutation } from "@minecraft/server";
import { defineSite, column, overworld, say, actionbar, sound, abs, setState, give, inventoryHas, nearby, put, makeApproach } from "./site.js";
import { makeStatues, statueStep, resting } from "./puzzles.js";
import { vaultPlan, statueAt, signSpot, doorCells, inVault, inAshSand, VAULT, ASH_SAND } from "./plans.js";
import { grantTome } from "../lore/player.js";
import { TOME_IN_UNLOCKS } from "../lore/places.js";

export const SEAL = "siege:faceless_seal";
const SCARAB = "siege:ash_scarab";
const statues = (site) => makeStatues(site.seed());
const wrongAt = new Map();
const facing = (i) => (VAULT.spots[i][0] < 0 ? "east" : "west");

export const seneschalSite = defineSite({
  id: "seneschal",
  name: "The Faceless Vault",
  boss: "seneschal",
  key: SEAL,
  anchor: { x: 850, z: 590 }, // open desert just south of Sunscar (its houses reach z 531), the gate facing the town
  reach: 40,
  emptyText: "§7A round seal set into the wall, worn perfectly smooth. Something is meant to be pressed into it.",
  *plan(dim, anchor) {
    return yield* vaultPlan((x, z) => column(dim, x, z), anchor);
  },
  afterBuild: (site, dim) => {
    const s = statues(site);
    s.words.forEach((text, i) => {
      try {
        const b = dim.getBlock(abs(site.data.center, signSpot(i)));
        b?.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: VAULT.spots[i][0] < 0 ? 12 : 4 }));
        b?.getComponent("minecraft:sign")?.setText(text);
      } catch { /* a sign is only words */ }
    });
  },
  blocks: {
    "siege:faceless_bust": (site, player, block) => turnStatue(site, player, block),
    "siege:vault_seal": (site, player, block) => site.socket(player, block, {
      whenOk: true,
      notNow: "",
      first: () => summon(site, true, player),
      again: () => summon(site, false, player),
    }),
  },
  inArena: (site, l) => inVault(site.data.center, l),
  spawnAt: (site) => ({ x: site.data.center.x + 0.5, y: site.data.center.y + VAULT.floor + 1, z: site.data.center.z - 41.5 }),
  onWin: (site) => turnAway(site),
  tick: (site) => ashSand(site),
  tpAt: (site) => { const c = site.data.center; return { x: c.x + 0.5, y: c.y + 1, z: c.z + 3.5 }; },
  answer: (site) => `Statue order by spot: ${statues(site).spots.map((age, spot) => [age, spot]).sort((a, b) => a[0] - b[0]).map(([, spot]) => spot).join(", ")}`,
});

// ---------- the sand before the stair: ash scarabs ----------
const ashSand = makeApproach({
  mid: (site) => ({ x: site.data.center.x, z: site.data.center.z + ASH_SAND.dz }), r: ASH_SAND.r + 2,
  inZone: (site, l) => inAshSand(site.data.center, l),
  mob: SCARAB, count: { base: 3, per: 2, max: 7 },
  line: "§7The sand in front of the stair shifts under your boots. Then it is not sand. It is ash, and the ash is moving.",
  cry: "random.anvil_use", cryOpts: { pitch: 1.6, volume: 0.5 },
  spots: (site, players, n, now) => Array.from({ length: n }, (_, i) => {
    const c = site.data.center, a = (i / n) * Math.PI * 2 + now;
    return { x: c.x + 0.5 + Math.sin(a) * (ASH_SAND.r - 3), y: c.y + 1, z: c.z + ASH_SAND.dz + 0.5 + Math.cos(a) * (ASH_SAND.r - 3) };
  }),
});

function spotOf(site, block) {
  const c = site.data.center;
  return VAULT.spots.findIndex((_, i) => {
    const a = abs(c, statueAt(i));
    return a.x === block.location.x && a.y === block.location.y && a.z === block.location.z;
  });
}

function setFace(site, i, dir) {
  setState(overworld(), abs(site.data.center, statueAt(i)), "minecraft:cardinal_direction", dir);
}

function turnStatue(site, player, block) {
  const d = site.data;
  const i = spotOf(site, block);
  if (i < 0) return actionbar(player, "§7A statue's head, its face chiselled away.");
  if (d.armed || d.state.solved) return actionbar(player, "§7It won't turn now.");
  if ((d.state.turned ?? []).includes(i)) return actionbar(player, "§7It already faces the door.");
  if (resting(system.currentTick, wrongAt.get(player.id))) return say(player, "§7The statues are still settling. Leave them a while.");
  const done = (d.state.turned ?? []).length;
  const step = statueStep(statues(site), done, i);
  if (step === "wrong") {
    wrongAt.set(player.id, system.currentTick);
    for (const j of d.state.turned ?? []) setFace(site, j, facing(j));
    setFace(site, i, facing(i));
    d.state.turned = [];
    site.save();
    sound("random.anvil_land", block.location, { pitch: 0.4, volume: 1 });
    say(player, "§7Every statue grinds back to face the room. Ash runs out of the cracks in the floor, and the ash is moving.");
    for (const dx of [-1, 1]) { try { overworld().spawnEntity(SCARAB, { x: block.location.x + dx + 0.5, y: block.location.y - 2, z: block.location.z + 0.5 }); } catch { /* unloaded */ } }
    try { overworld().spawnEntity(SCARAB, { x: block.location.x + 0.5, y: block.location.y - 2, z: block.location.z + 1.5 }); } catch { /* unloaded */ }
    return;
  }
  setFace(site, i, "north");
  sound("random.anvil_use", block.location, { pitch: 0.5, volume: 0.6 });
  d.state.turned = [...(d.state.turned ?? []), i];
  site.save();
  if (step === "turn") return actionbar(player, "§7The statue grinds round to face the vault door.");
  d.state.solved = true;
  site.save();
  try { put(overworld(), d.center, { dx: VAULT.niche.dx, dy: VAULT.floor + 2, dz: VAULT.niche.dz, block: "minecraft:air" }); } catch { /* unloaded */ }
  sound("tile.piston.in", abs(d.center, { dx: VAULT.niche.dx, dy: VAULT.floor + 2, dz: VAULT.niche.dz }), { pitch: 0.5, volume: 1 });
  for (const id of TOME_IN_UNLOCKS.seneschal) grantTome(player, id); // papers in the niche under the seal
  if (inventoryHas(player, SEAL)) return say(player, "§7A niche grinds open beside the door. It's empty. You already have what it held.");
  give(player, SEAL);
  say(player, "§6A niche grinds open beside the door. Inside, on a bed of ash: a steward's seal, with no face on it.§r You take the Faceless Seal.");
}

function summon(site, first, player) {
  const d = site.data, c = d.center, dim = overworld();
  const toAll = (fn) => { for (const p of nearby(c, 64)) { try { fn(p); } catch { /* gone */ } } };
  const seal = abs(c, { dx: VAULT.seal.dx, dy: VAULT.floor + 2, dz: VAULT.seal.dz });
  const cues = [[0, () => {
    setState(dim, seal, "siege:sealed", 1);
    sound("random.anvil_land", seal, { pitch: 0.6, volume: 1 });
    toAll((p) => actionbar(p, first ? "§7The seal fits the wall exactly." : "§7You press the seal again."));
  }]];
  // the statues turn, one by one, to look at whoever pressed it
  const who = player?.location ?? { x: c.x, z: c.z - 20 };
  VAULT.spots.forEach(([x, z], i) => {
    cues.push([20 + i * 16, () => {
      const dx = who.x - (c.x + x), dz = who.z - (c.z + z);
      const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "east" : "west") : dz > 0 ? "south" : "north";
      setFace(site, i, dir);
      sound("random.anvil_use", abs(c, statueAt(i)), { pitch: 0.4 + i * 0.05, volume: 0.6 });
    }]);
  });
  cues.push([105, () => toAll((p) => say(p, "§7Every faceless head is turned towards you."))]);
  if (first) {
    doorCells().forEach(([x, y, z], k) => cues.push([120 + k * 4, () => {
      try { put(dim, c, { dx: x, dy: y, dz: z, block: "minecraft:air" }); } catch { /* unloaded */ }
      if (k % 3 === 0) sound("tile.piston.in", abs(c, { dx: x, dy: y, dz: z }), { pitch: 0.4, volume: 2 });
      try { dim.spawnParticle("minecraft:falling_dust_sand_particle", { x: c.x + x + 0.5, y: c.y + y + 0.5, z: c.z + z + 0.5 }); } catch { /* cosmetic */ }
    }]));
  }
  cues.push([first ? 175 : 120, () => toAll((p) => say(p, "§6The vault is open. At the far end, someone is sitting at a desk, writing. He does not look up."))]);
  site.summon(cues);
}

// When he falls, the statues grind round one by one and turn their faces back to the vault door, as they stood for
// whoever solved them: the vault is empty again (boss walkthrough, Mateo 2026-11-13)
function turnAway(site) {
  const c = site.data.center;
  if (!c) return;
  const cues = VAULT.spots.map((_, i) => [40 + i * 16, () => {
    setFace(site, i, "north");
    sound("random.anvil_use", abs(c, statueAt(i)), { pitch: 0.35 + i * 0.05, volume: 0.6 });
  }]);
  cues.push([40 + VAULT.spots.length * 16 + 10, () => {
    for (const p of nearby(c, 64)) { try { say(p, "§7Out in the antechamber, stone grinds on stone. One by one, the faceless statues turn back to face the vault door, as if to see him out."); } catch { /* gone */ } }
  }]);
  for (const [t, fn] of cues) system.runTimeout(() => { try { fn(); } catch { /* unloaded */ } }, t);
}
