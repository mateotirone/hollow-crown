// Waking the Drowned Bride, in the Chapel of Saint Brannoc under Gull Bay.
//
//   The chapel lies on the sea floor with only its tower above the water. On a night when the moon is dark the sea
//   draws back from it (the Lighthouse Letters and the Ledger's "Wrong Moon" say so): the nave drains and you can
//   climb down the tower ladder and walk it. At dawn the sea comes back in (once nobody is inside).
//   1. The Letters give the address: "third pew from the drowned altar, under the floor stone carved with a gull."
//      Lift the right stone and her wedding ring is under it. Lift a wrong one and the drowned climb out.
//   2. Lay the ring on the altar (on a dark-moon night, with the chapel dry). Drowned bells ring under the sea, the
//      pews fill with shapes, and she stands up at the altar.
//   The ring stays on the altar. Once a siege night has passed after she falls, it can be laid again on a dark moon.

import { system } from "@minecraft/server";
import { isNight } from "../siege/api.js";
import { moonPhase } from "../lore/moondoors.js";
import { defineSite, column, overworld, say, actionbar, sound, abs, setState, give, inventoryHas, nearby, put, makeApproach } from "./site.js";
import { makePews, pewAnswer, resting, CARVINGS, PEW_ROWS } from "./puzzles.js";
import { chapelPlan, chapelInterior, pewStone, inChapel, inDrownedWater, CHAPEL, DROWNED_WATER } from "./plans.js";
import { grantTome } from "../lore/player.js";
import { TOME_IN_UNLOCKS } from "../lore/places.js";

export const RING = "siege:drowned_ring";
const DROWNED = "siege:brine_lurker"; // the drowned of Brannoc wear our own body, never vanilla's
const DARK = 4;
export const darkMoon = () => isNight() && moonPhase() === DARK;
const pews = (site) => makePews(site.seed());
const wrongAt = new Map();

export const brideSite = defineSite({
  id: "bride",
  name: "The Chapel of Saint Brannoc",
  boss: "bride",
  key: RING,
  anchor: { x: -690, z: 130 }, // Gull Bay (map/draw_map.py story point 7)
  reach: 24,
  emptyText: "§7A drowned altar. There is a ring-shaped mark worn into the stone, and nothing in it.",
  *plan(dim, anchor, seed) {
    return yield* chapelPlan((x, z) => column(dim, x, z), anchor, makePews(seed));
  },
  blocks: {
    "siege:carved_floor": (site, player, block) => liftStone(site, player, block),
    "siege:drowned_altar": (site, player, block) => site.socket(player, block, {
      whenOk: !!site.data.state.dry,
      notNow: "§7The sea is too heavy on the altar. Come back on a night when the moon is dark and the sea draws back.",
      first: () => summon(site, true),
      again: () => summon(site, false),
    }),
  },
  inArena: (site, l) => inChapel(site.data.center, l),
  spawnAt: (site) => ({ x: site.data.center.x + CHAPEL.altar.dx - 1.5, y: site.data.center.y + 1, z: site.data.center.z + 0.5 }),
  tick: (site) => { tide(site); drownedWater(site); },
  tpAt: (site) => { const c = site.data.center; return { x: c.x - 11.5, y: c.y + site.data.info.surfaceDy + 5, z: c.z + 0.5 }; },
  command: (site, cmd, player) => {
    if (cmd !== "dry") return false;
    site.forceDry = system.currentTick + 6000;
    say(player, "§7The sea will draw back from the chapel for five minutes.");
    return true;
  },
  answer: (site) => `The ring is under the ${pews(site).ring.side ? "right" : "left"} stone (facing the altar) at pew 3. Dark moon now: ${darkMoon()}, chapel dry: ${!!site.data.state.dry}`,
});

// ---------- the water round the chapel: the drowned of Brannoc ----------
const drownedWater = makeApproach({
  mid: (site) => site.data.center, r: DROWNED_WATER.r + 2,
  inZone: (site, l) => inDrownedWater(site.data.center, l, site.data.info.surfaceDy ?? 12),
  mob: DROWNED, count: { base: 2, per: 1, max: 5 },
  line: "§7Below you the village is still there, roofs and all. On one of the roofs, something lets go and starts to swim up.",
  cry: "bucket.empty_water", cryOpts: { pitch: 0.4, volume: 2 },
  // they rise from the street below whoever is in the water
  spots: (site, players, n, now) => Array.from({ length: n }, (_, i) => {
    const c = site.data.center, p = players[i % players.length].location, a = (i / n) * Math.PI * 2 + now;
    return { x: p.x + Math.sin(a) * 6, y: Math.max(c.y + 2, p.y - 4), z: p.z + Math.cos(a) * 6 };
  }),
});

// ---------- the tide ----------
let tideBusy = false;
let tideCheck = 0;
function tide(site) {
  if (tideBusy || ++tideCheck % 10 !== 0) return; // every 5 seconds
  const d = site.data;
  const want = darkMoon() || (site.forceDry ?? 0) > system.currentTick;
  const dry = !!d.state.dry;
  if (want === dry) return;
  const c = d.center;
  if (!nearby(c, 64).length) return;
  if (!want && (d.fighting || d.pending || site.scene)) return; // never flood a fight
  if (!want && playersInside(site)) return; // wait until nobody is in the nave
  setWater(site, want ? "minecraft:air" : "minecraft:water", () => {
    d.state.dry = want;
    site.save();
    sound(want ? "bucket.fill_water" : "bucket.empty_water", { x: c.x + 0.5, y: c.y + d.info.surfaceDy, z: c.z + 0.5 }, { pitch: 0.4, volume: 4 });
    for (const p of nearby(c, 48)) actionbar(p, want ? "§bThe sea draws back from the chapel." : "§7The sea comes back over the chapel.");
  });
}
function playersInside(site) {
  return nearby(site.data.center, 32).some((p) => inChapel(site.data.center, p.location));
}
function setWater(site, block, done) {
  tideBusy = true;
  const d = site.data, dim = overworld();
  const cells = chapelInterior(d.info.surfaceDy);
  if (block === "minecraft:air") cells.sort((a, b) => b[1] - a[1]); // drain from the top
  else cells.sort((a, b) => a[1] - b[1]); // fill from the floor
  system.runJob((function* () {
    let n = 0;
    for (const [dx, dy, dz] of cells) {
      try { put(dim, d.center, { dx, dy, dz, block }); } catch { /* unloaded */ }
      if (++n % 96 === 0) yield;
    }
    tideBusy = false;
    done();
  })());
}

// ---------- the stones ----------
function liftStone(site, player, block) {
  const d = site.data;
  const p = pews(site);
  let found;
  for (let row = 1; row <= PEW_ROWS && !found; row++) for (const side of [0, 1]) {
    const at = abs(d.center, pewStone(row, side));
    if (at.x === block.location.x && at.y === block.location.y && at.z === block.location.z) found = { row, side };
  }
  const carving = CARVINGS[block.permutation.getState("siege:carving") ?? 0];
  if (!found) return actionbar(player, `§7A floor stone carved with a ${carving}.`);
  if (!d.state.dry) return actionbar(player, `§7A floor stone carved with a ${carving}. It won't move with the sea on top of it.`);
  if (block.permutation.getState("siege:lifted")) return actionbar(player, "§7You've already lifted that one.");
  if (resting(system.currentTick, wrongAt.get(player.id))) return say(player, "§7Your hands are still shaking. Leave the stones a while.");
  const answer = pewAnswer(p, found.row, found.side);
  setState(overworld(), block.location, "siege:lifted", 1);
  if (answer === "wrong") {
    wrongAt.set(player.id, system.currentTick);
    say(player, `§7Under the ${carving} there is only black water. Something in it takes hold of the edge and pulls itself up.`);
    sound("bucket.empty_water", block.location, { pitch: 0.5, volume: 2 });
    for (const dz of [-2, 2]) { try { overworld().spawnEntity(DROWNED, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + dz + 0.5 }); } catch { /* unloaded */ } }
    return;
  }
  for (const id of TOME_IN_UNLOCKS.bride) grantTome(player, id); // the Letters were right: more of them are under here
  if (inventoryHas(player, RING) || d.armed) return say(player, "§7Under the gull there's a hollow in the stone, the size of a ring, and nothing in it now.");
  give(player, RING);
  sound("random.orb", block.location, { pitch: 0.6, volume: 1 });
  say(player, "§bUnder the gull, wrapped in a strip of lace gone grey, is a wedding ring.§r You take the Drowned Wedding Ring.");
}

// ---------- the summon ----------
function summon(site, first) {
  const d = site.data, c = d.center, dim = overworld();
  const altar = { x: c.x + CHAPEL.altar.dx + 0.5, y: c.y + 2, z: c.z + 0.5 };
  const toAll = (fn) => { for (const p of nearby(c, 48)) { try { fn(p); } catch { /* gone */ } } };
  const cues = [[0, () => {
    setState(dim, abs(c, CHAPEL.altar), "siege:ringed", 1);
    sound("random.orb", altar, { pitch: 0.5, volume: 1 });
    toAll((p) => actionbar(p, first ? "§7You lay the ring on the altar." : "§7You lay your hand on the ring again."));
  }]];
  for (let i = 0; i < 3; i++) cues.push([25 + i * 30, () => sound("block.bell.hit", { x: c.x, y: c.y + d.info.surfaceDy + 6, z: c.z }, { pitch: 0.35 + i * 0.03, volume: 4 })]);
  cues.push([40, () => toAll((p) => actionbar(p, "§7Bells, somewhere under the sea."))]);
  for (let row = 1; row <= PEW_ROWS; row++) {
    cues.push([60 + row * 8, () => {
      for (const z of [-3, 3]) { try { dim.spawnParticle("minecraft:soul_particle", { x: c.x + CHAPEL.pewX(row) + 0.5, y: c.y + 1.8, z: c.z + z + 0.5 }); } catch { /* unloaded */ } }
    }]);
  }
  cues.push([115, () => toAll((p) => say(p, "§7Every pew is full. Nobody turns round."))]);
  cues.push([140, () => {
    toAll((p) => p.addEffect("darkness", 60, { showParticles: false }));
    toAll((p) => say(p, "§bAt the altar, someone in a wedding dress stands up."));
  }]);
  site.summon(cues);
}
