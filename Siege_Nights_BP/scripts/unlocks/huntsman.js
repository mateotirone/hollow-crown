// Waking the Pale Huntsman, at Hallowmere north-east of Rimehold.
//
//   1. Old Sigga, the lodge warden on the south shore, knows the old hunting rhyme. It names four beasts in order.
//   2. Four cairns stand on the shore, each topped with a carved beast. After dark, click them in the rhyme's order:
//      each one lights as it wakes. The wrong one puts them all out, and rimewolves answer. The fourth gives the
//      Pale Horn, frozen into the stone under it.
//   3. After dark (any night, Mateo 2026-11-13), take the horn out onto the frozen lake and lay it on the Hunter's Cairn in the middle. It
//      sounds; something answers from far off; hounds; the ice cracks in a ring round you. He rides up out of it.
//   The horn stays on the cairn. Once a siege night has passed after he falls, sound it again after dark.

import { isNight } from "../siege/api.js";
import { defineSite, column, overworld, say, actionbar, sound, ring, abs, mid, setState, put, give, inventoryHas, talk, nearby, makeApproach } from "./site.js";
import { makeHunt, huntStep, resting, BEASTS } from "./puzzles.js";
import { huntPlan, crackCells, inIceEdge, HUNT, ICE_EDGE } from "./plans.js";

export const HORN = "siege:pale_horn";
const WARDEN = "siege_lodge_warden";
const RIMEWOLF = "siege:rimewolf";
const lake = { x: 60, z: -1130 }; // Hallowmere (map/genworld.py LAKES)

const hunt = (site) => makeHunt(site.seed());
const wrongAt = new Map();

export const huntsmanSite = defineSite({
  id: "huntsman",
  name: "The Hunter's Cairn on Hallowmere",
  boss: "huntsman",
  key: HORN,
  anchor: lake,
  reach: 72,
  emptyText: "§7A heap of stones on the ice with a notch worn into the top, the shape of a horn. It is empty.",
  *plan(dim, anchor, seed) {
    return yield* huntPlan((x, z) => column(dim, x, z), anchor, makeHunt(seed));
  },
  npcs: (site) => [{ tag: WARDEN, name: "Old Sigga", skin: "warden_sigga", spot: mid(site.data.center, site.data.info.warden) }],
  onNpc: {
    [WARDEN]: (site, player) => void talk(player, "Old Sigga, the lodge warden",
      "§oShe doesn't get up. The fire's out and she hasn't noticed.§r\n\n\"You want the old rhyme. They all want the rhyme, at the end. He taught it to my grandmother's grandmother, and she taught it to me, and I've never once said it out on the ice.\"\n\n"
      + hunt(site).rhyme.map((l) => `§f${l}§r`).join("\n")
      + "\n\n\"The cairns on the shore. After dark, mind. They don't wake for daylight. And if you get it wrong, don't stand about.\"",
      ["I'll remember it."]),
  },
  blocks: {
    "siege:hunt_cairn": (site, player, block) => clickCairn(site, player, block),
    "siege:hunters_cairn": (site, player, block) => site.socket(player, block, {
      whenOk: isNight(),
      notNow: "§7The ice is quiet. It only listens after dark.",
      first: () => summon(site, true),
      again: () => summon(site, false),
    }),
  },
  inArena: (site, l) => Math.hypot(l.x - (site.data.center.x + 0.5), l.z - (site.data.center.z + 0.5)) <= HUNT.arena && Math.abs(l.y - site.data.center.y) < 6,
  spawnAt: (site) => ({ x: site.data.center.x + 0.5, y: site.data.center.y + 1, z: site.data.center.z + 9.5 }),
  onWin: (site) => refreeze(site),
  tick: (site) => iceEdge(site),
  tpAt: (site) => { const c = site.data.center, w = site.data.info.warden; return { x: c.x + w.dx, y: c.y + w.dy + 1, z: c.z + w.dz - 2 }; },
  answer: (site) => `Rhyme order: ${hunt(site).order.map((b) => BEASTS[b].id).join(", ")}`,
});

// ---------- the ice edge: rimewolves come across the lake after dark ----------
const iceEdge = makeApproach({
  mid: (site) => site.data.center, r: ICE_EDGE.r1 + 2,
  when: () => isNight(),
  inZone: (site, l) => inIceEdge(site.data.center, l),
  mob: RIMEWOLF, count: { base: 1, per: 2, max: 5 },
  line: "§7Out on the ice, something is keeping pace with you. Then there are more of them, and they stop keeping pace.",
  cry: "mob.wolf.howl", cryOpts: { pitch: 0.8, volume: 2 },
  // they come along the ice from either side of whoever is furthest out
  spots: (site, players, n) => Array.from({ length: n }, (_, i) => {
    const c = site.data.center, p = players[i % players.length].location;
    const a = Math.atan2(p.x - c.x, p.z - c.z) + (i % 2 ? 1 : -1) * (0.35 + 0.2 * Math.floor(i / 2));
    const r = (ICE_EDGE.r0 + ICE_EDGE.r1) / 2;
    return { x: c.x + 0.5 + Math.sin(a) * r, y: c.y + 1, z: c.z + 0.5 + Math.cos(a) * r };
  }),
});

function clickCairn(site, player, block) {
  const h = hunt(site);
  const d = site.data;
  const here = (d.info.cairns ?? []).find((c) => abs(d.center, c).x === block.location.x && abs(d.center, c).y === block.location.y && abs(d.center, c).z === block.location.z);
  if (!here) return actionbar(player, `§7A carved stone: ${BEASTS[block.permutation.getState("siege:beast") ?? 0].name}.`);
  if (!isNight()) return actionbar(player, `§7${cap(BEASTS[here.beast].name)}, carved in the stone. It doesn't wake for daylight.`);
  if (resting(Date.now() / 50, wrongAt.get(player.id))) return say(player, "§7The cairns are still cold from the last time. Give them a while.");
  const done = d.state.lit ?? 0;
  if ((d.state.litList ?? []).includes(here.beast)) return actionbar(player, "§7That one is already awake.");
  const step = huntStep(h, done, here.beast);
  if (step === "wrong") {
    wrongAt.set(player.id, Date.now() / 50);
    setAllCairns(site, 0);
    d.state.lit = 0;
    d.state.litList = [];
    site.save();
    say(player, "§7The cairns go dark all at once. Out on the snow, something howls back.");
    sound("mob.wolf.howl", block.location, { pitch: 0.6, volume: 3 });
    const dim = overworld();
    for (const dx of [-4, 4]) { try { dim.spawnEntity(RIMEWOLF, { x: block.location.x + dx + 0.5, y: block.location.y - 1, z: block.location.z + 3.5 }); } catch { /* unloaded */ } }
    return;
  }
  setState(overworld(), block.location, "siege:lit", 1);
  sound("block.bell.hit", block.location, { pitch: 1.6 + done * 0.15, volume: 0.5 });
  d.state.lit = done + 1;
  d.state.litList = [...(d.state.litList ?? []), here.beast];
  site.save();
  if (step === "lit") return actionbar(player, `§b${cap(BEASTS[here.beast].name)} wakes.`);
  // the fourth: the horn, frozen into the stone
  setAllCairns(site, 0);
  d.state.lit = 0;
  d.state.litList = [];
  site.save();
  if (inventoryHas(player, HORN) || d.armed) return say(player, "§7All four burn together for a breath, then go out. Whatever they kept, they've given already.");
  give(player, HORN);
  sound("raid.horn", block.location, { pitch: 1.4, volume: 0.4 });
  say(player, "§bAll four burn together for a breath, then go out. Under the last stone, frozen into the ice, is a pale horn.§r You take the Pale Horn.");
}
const cap = (t) => t[0].toUpperCase() + t.slice(1);

function setAllCairns(site, lit) {
  const d = site.data;
  for (const c of d.info.cairns ?? []) setState(overworld(), abs(d.center, c), "siege:lit", lit);
}

function summon(site, first) {
  const d = site.data;
  const c = d.center;
  const top = { x: c.x + 0.5, y: c.y + 4, z: c.z + 0.5 };
  const dim = overworld();
  const toAll = (fn) => { for (const p of nearby(c, 64)) { try { fn(p); } catch { /* gone */ } } };
  const cues = [];
  cues.push([0, () => {
    setState(dim, abs(c, { dx: 0, dy: 3, dz: 0 }), "siege:horned", 1);
    sound("raid.horn", top, { pitch: 0.7, volume: 6 });
    toAll((p) => actionbar(p, first ? "§7You lay the horn on the cairn. It sounds by itself." : "§7The horn on the cairn sounds again."));
  }]);
  cues.push([50, () => sound("raid.horn", { x: c.x + 60, y: c.y + 10, z: c.z - 60 }, { pitch: 0.45, volume: 4 })]);
  cues.push([70, () => { sound("mob.wolf.howl", top, { pitch: 0.7, volume: 3 }); toAll((p) => actionbar(p, "§7Something answers. Then hounds.")); }]);
  cues.push([90, () => sound("mob.wolf.howl", top, { pitch: 0.55, volume: 3 })]);
  const cells = crackCells();
  cells.forEach(([dx, dz], i) => {
    if (i % 4 !== 0) return;
    cues.push([100 + Math.floor((i / cells.length) * 40), () => {
      for (let k = i; k < Math.min(i + 4, cells.length); k++) { try { put(dim, c, { dx: cells[k][0], dy: 0, dz: cells[k][1], block: "minecraft:water" }); } catch { /* unloaded */ } }
      sound("random.glass", { x: c.x + dx, y: c.y + 1, z: c.z + dz }, { pitch: 0.5, volume: 1 });
    }]);
  });
  cues.push([145, () => {
    toAll((p) => p.addEffect("darkness", 80, { showParticles: false }));
    ring(c, HUNT.crack, c.y + 1.2, "minecraft:snowflake_particle", 48);
    toAll((p) => say(p, "§fThe ice has opened in a ring round you. Something is coming up through it."));
  }]);
  site.summon(cues);
}

function refreeze(site) {
  const d = site.data, dim = overworld();
  for (const [dx, dz] of crackCells()) { try { put(dim, d.center, { dx, dy: 0, dz, block: "minecraft:packed_ice" }); } catch { /* unloaded */ } }
}
