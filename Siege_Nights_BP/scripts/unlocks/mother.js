// Waking the Mother of Changelings, under the Cradle Tree south of Mirelight.
//
//   1. Five villagers stand by the lanterns round the Mirelight square. One of them is not who they say: a shape the
//      Mother raised to fill a hole. The Testimonies teach the tells: wrong hand, faces the wall, fears a bell. Only
//      the shape shows all three. Talk to each, then tell the right one "You're not <name>." The face goes slack and
//      what's left is a doll of sticks and hair: the Mire Effigy. Accuse the wrong one and changelings come for you.
//   2. Lay the effigy in the root cradle in the cave under the Cradle Tree. A lullaby starts with nobody singing it,
//      the roots overhead unwind from the middle out, and she lowers herself down out of them.
//   The effigy stays in the cradle. Once a siege night has passed after she falls, lay your hand in the cradle again.

import { system } from "@minecraft/server";
import { defineSite, column, overworld, say, actionbar, sound, abs, mid, setState, give, inventoryHas, nearby, put, talk, removeNpc, makeApproach } from "./site.js";
import { makeChangeling, villagerLines, accuse, resting, VILLAGERS } from "./puzzles.js";
import { cradlePlan, mirelightPlan, rootCells, inCradle, inGlade, CRADLE, GLADE } from "./plans.js";
import { grantTome } from "../lore/player.js";
import { TOME_IN_UNLOCKS } from "../lore/places.js";
import { BlockPermutation } from "@minecraft/server";

export const EFFIGY = "siege:mire_effigy";
const CHANGELING = "siege:changeling";
const VTAG = "siege_mire_villager";
const wrongAt = new Map();

// ---------- Mirelight: the five villagers ----------
const mire = (site) => makeChangeling(site.seed());
export const mirelightSite = defineSite({
  id: "mirelight",
  name: "Mirelight's lantern square",
  anchor: { x: -60, z: 900 },
  reach: 16,
  *plan(dim, anchor) {
    return yield* mirelightPlan((x, z) => column(dim, x, z), anchor, VILLAGERS);
  },
  afterBuild: (site, dim) => {
    site.data.info.spots.forEach((s, i) => {
      try {
        const b = dim.getBlock(abs(site.data.center, s.sign));
        b?.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: 0 }));
        b?.getComponent("minecraft:sign")?.setText(VILLAGERS[i].house);
      } catch { /* words only */ }
    });
  },
  npcs: (site) => VILLAGERS.map((v, i) => ({ tag: `${VTAG}_${i}`, name: v.name, skin: 40 + i * 2, spot: mid(site.data.center, site.data.info.spots[i].npc) }))
    .filter((_, i) => !(site.data.state.unmasked && i === mire(site).shape)),
  onNpc: Object.fromEntries(VILLAGERS.map((_, i) => [`${VTAG}_${i}`, (site, player) => villager(site, player, i)])),
  answer: (site) => `The changeling is ${VILLAGERS[mire(site).shape].name}${site.data.state.unmasked ? " (unmasked)" : ""}`,
});

async function villager(site, player, i) {
  const v = VILLAGERS[i];
  const lines = villagerLines(mire(site), i);
  const body = `§oYou pass ${v.name} a cup of water from the barrel.§r\n\n${v.name} ${lines[0]}, ${lines[1]}, and ${lines[2]}.\n\n"Lost a day, have I? Everyone in Mirelight's lost a day. What's one more."`;
  const pick = await talk(player, v.name, body, ["Thank you.", `You're not ${v.name}.`]);
  if (pick !== 1) return;
  if (resting(system.currentTick, wrongAt.get(player.id))) return say(player, "§7Nobody in Mirelight will look at you right now.");
  if (accuse(mire(site), i) === "wrong") {
    wrongAt.set(player.id, system.currentTick);
    say(player, `§7${v.name} stares at you, and then past you. "I am, though. I am." Behind you, in the reeds, something small is laughing.`);
    const c = site.data.center;
    for (const dx of [-5, 5]) { try { overworld().spawnEntity(CHANGELING, { x: c.x + dx + 0.5, y: c.y + 1, z: c.z + 0.5 }); } catch { /* unloaded */ } }
    return;
  }
  site.data.state.unmasked = true;
  site.save();
  removeNpc(overworld(), `${VTAG}_${i}`, site.data.center);
  sound("block.bell.hit", player.location, { pitch: 1.8, volume: 0.6 });
  for (const id of TOME_IN_UNLOCKS.mother) grantTome(player, id); // what the shape kept in its stilt house
  if (inventoryHas(player, EFFIGY) || motherSite.data.armed) {
    return say(player, `§7${v.name}'s face goes slack, like a mask with nobody behind it, and then there is nobody there at all.`);
  }
  give(player, EFFIGY);
  say(player, `§a${v.name}'s face goes slack, like a mask with nobody behind it. Then there's nobody there at all, only a doll of sticks and hair lying on the boards.§r You take the Mire Effigy.`);
}

// ---------- the Cradle Tree ----------
export const motherSite = defineSite({
  id: "mother",
  name: "The Cradle Tree",
  boss: "mother",
  key: EFFIGY,
  anchor: { x: -120, z: 1060 }, // south of Mirelight (map/draw_map.py story point 9)
  reach: 32,
  emptyText: "§7A cradle grown out of roots, lined with moss. It's empty, and it's rocking very slightly.",
  *plan(dim, anchor) {
    return yield* cradlePlan((x, z) => column(dim, x, z), anchor);
  },
  blocks: {
    "siege:root_cradle": (site, player, block) => site.socket(player, block, {
      whenOk: true,
      notNow: "",
      first: () => summon(site, true),
      again: () => summon(site, false),
    }),
  },
  inArena: (site, l) => inCradle(site.data.center, l),
  spawnAt: (site) => ({ x: site.data.center.x + 0.5, y: site.data.center.y + CRADLE.floor + CRADLE.h - 2, z: site.data.center.z + 4.5 }),
  onWin: (site) => regrowRoots(site),
  tick: (site) => glade(site),
  tpAt: (site) => { const c = site.data.center; return { x: c.x + 0.5, y: c.y + 2, z: c.z + Math.ceil(CRADLE.r) + CRADLE.ramp + 2.5 }; },
});

// ---------- the Changeling Glade: a wave on the way in ----------
const glade = makeApproach({
  mid: (site) => ({ x: site.data.center.x, z: site.data.center.z + GLADE.dz }), r: GLADE.r + 2,
  inZone: (site, l) => inGlade(site.data.center, l),
  mob: CHANGELING,
  line: "§7The reeds round the glade stop moving all at once. Then they part, low down, in a lot of places.",
  cry: "mob.zombie.say", cryOpts: { pitch: 1.8, volume: 0.6 },
  spots: (site, players, n, now) => Array.from({ length: n }, (_, i) => {
    const c = site.data.center, a = (i / n) * Math.PI * 2 + now;
    return { x: c.x + 0.5 + Math.sin(a) * (GLADE.r - 2), y: c.y + GLADE.floor + 1, z: c.z + GLADE.dz + 0.5 + Math.cos(a) * (GLADE.r - 2) };
  }),
});

const LULLABY = [1, 0.89, 0.79, 0.89, 1, 1, 1, 0.89, 0.89, 0.89, 1, 1.19, 1.19];
function summon(site, first) {
  const d = site.data, c = d.center, dim = overworld();
  const cradle = abs(c, { dx: 0, dy: CRADLE.floor + 1, dz: 0 });
  const toAll = (fn) => { for (const p of nearby(c, 48)) { try { fn(p); } catch { /* gone */ } } };
  const cues = [[0, () => {
    setState(dim, cradle, "siege:laid", 1);
    toAll((p) => actionbar(p, first ? "§7You lay the effigy in the cradle. The cradle starts to rock." : "§7The cradle starts to rock again."));
  }]];
  LULLABY.forEach((pitch, i) => cues.push([15 + i * 8, () => sound("note.flute", cradle, { pitch: pitch * 0.8, volume: 1.5 })]));
  cues.push([30, () => toAll((p) => actionbar(p, "§7Somebody is humming. Nobody is there."))]);
  const roots = rootCells();
  const ceil = CRADLE.floor + CRADLE.h + 1;
  roots.forEach(([dx, dz], k) => {
    if (k % 6 !== 0) return;
    cues.push([50 + Math.floor((k / roots.length) * 70), () => {
      for (let j = k; j < Math.min(k + 6, roots.length); j++) {
        const [x, z] = roots[j];
        try { put(dim, c, { dx: x, dy: ceil - 2, dz: z, block: "minecraft:air" }); } catch { /* unloaded */ }
      }
      sound("dig.grass", abs(c, { dx, dy: ceil - 2, dz }), { pitch: 0.5, volume: 0.8 });
    }]);
  });
  cues.push([130, () => {
    toAll((p) => p.addEffect("darkness", 60, { showParticles: false }));
    toAll((p) => say(p, "§aSomething long-armed lowers itself out of the roots above the cradle, very gently, so as not to wake it."));
  }]);
  site.summon(cues);
}

function regrowRoots(site) {
  const d = site.data, dim = overworld();
  const ceil = CRADLE.floor + CRADLE.h + 1;
  for (const [dx, dz] of rootCells()) { try { put(dim, d.center, { dx, dy: ceil - 2, dz, block: "minecraft:hanging_roots" }); } catch { /* unloaded */ } }
}
