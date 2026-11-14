// Story characters and Dusty Tomes the generated map needs, put there by script so the story can be played on a
// fresh map without a single /scriptevent (thread "Check the storyline can be played through", 2026-11-12).
//
// Characters (all on Bedrock's built-in NPC entity, answered by npcs.js):
//   in the towns   Elias in the Gull's Rest lighthouse, Ottilie in its harbour office, Tilly on its lowest street;
//                  Sigrun in the Rimehold longhouse nearest Hallowmere, Jorund in the net sheds; Isolde in the Sunscar
//                  warden's office; Nessa in the Millbrook bakery; Hesper in the last house in Mirelight before the
//                  lanterns stop. Spots: story_spots_data.js (tools/story_spots.py: the indoor ones from the baked
//                  towns, the rest street cells past the townsfolk's own). The Returned cases' suspects (Harl, Bram,
//                  Pip, Odo) stand in the street near their askers, as ordinary villagers the mobs feature knows
//                  (bestiary/returned.js). Sister Wren is in Millbrook's chapel (opening/millbrook.js).
//   Archivist Pell moves into every town hall at Town tier (the hall's "sage" mark) and follows the hall when it grows.
//   Sir Aldous rides to your keep the morning after your first siege win and stays the day; after that he is at the
//                  Ashen Gate chapterhouse, beside Brother Cael.
//   The Voice in the Water (Corvin) is in the still water by the Wound landing, in the Hollow.
// A character who goes missing is stood there again when someone comes near, except Hesper and the four suspects:
// they leave for good when their case is solved, so they are placed once.
//
// Dusty Tomes: each tome whose page names a place gets a Dusty Tome there (TOME_PLACES), next to the place's Ledger
// mark (the landmark's doorstep, a thin place's mouth) or on its town street. Each is placed once; a player who breaks
// one has broken it for everyone. A few tomes are found another way: in the boss unlocks (the vault niche, the gull
// stone, the changeling), or at a Knight's rank (TOME_BY_RANK). Two late ones stay shut until the story allows
// (TOME_GATES), because they say too much too early.
//
// Builder commands (creative / operators):
//   /scriptevent siege:story_places          what is placed, what is still waiting for someone to come near
//   /scriptevent siege:story_places tp <id>  go to a character's or tome's spot

import { world, system, GameMode } from "@minecraft/server";
import { on, addFilter, onTick, moduleStore, keepOf, keepCenter, addTests, assert, assertEqual } from "../siege/api.js";
import { mapMode } from "../plots/api.js";
import { spawnNpc } from "./npcs.js";
import { placeCache } from "./caches.js";
import { markedPlaces } from "./ledger.js";
import { TOME } from "./logic.js";
import { NPCS } from "./data/dialogue.js";
import { CASES } from "./data/returned.js";
import { fallenCount } from "./data/spine.js";
import { progressOf, grantTome } from "./player.js";
import { markReturned } from "../bestiary/returned.js";
import { halls } from "../townhall/townhall.js";
import { SITES as HOLLOW_SITES } from "../undertow/roads.js";
import { UNDERTOW_ID } from "../undertow/layout.js";
import { STORY_PEOPLE, TOWN_TOME_SPOTS } from "./story_spots_data.js";
import { DESIGNS } from "../landmarks/designs_data.js";

const OVERWORLD = "minecraft:overworld";
const NEAR = 48; // someone must be this close before a spot is filled (so its ground is loaded and built)
const store = moduleStore("hc:story_places", () => ({ v: 1, once: {}, tomes: {}, visits: {} }));
const npcTag = (id) => `siege_lore_npc_${id}`;
const NPC_IDS = new Set(NPCS.map((n) => n.id));

// ---------- what goes where (pure data) ----------

// The four Returned suspects: villager name, case id, whether they are a copy
export const SUSPECTS = Object.fromEntries(
  CASES.filter((c) => c.suspect && c.asker !== c.id).map((c) => [c.id, { name: c.suspect, quest: c.id, returned: c.returned }]),
);
SUSPECTS.odo = { name: "Odo Lowe", quest: "hesper", returned: false }; // Hesper's husband: the asker is the copy, not him
const ONCE = new Set(["hesper", ...Object.keys(SUSPECTS)]);

// Dusty Tomes at a Ledger place: tome id -> place id (lore/data/world.js PLACES; landmarks and thin places mark them).
// They lie round the place's mark. A tome whose page names a spot inside a landmark (a cradle, a cell, a fallen bell)
// is laid there by the landmark's own design instead (map/structures, design "tomes"; landmarks/index.js), never here.
export const TOME_PLACES = {
  chron_08: "kings_barrow", chron_12: "kings_barrow", seal_10: "kings_barrow",
  scri_02: "bellfounders_mine",
};
// Tomes the landmark designs lay where their pages say (Crownhold's nursery and bedchamber, the gatehouse chest and
// the great fallen bell; the chapterhouse; Corvin's Tower; the border watchtower; Bellhollow's shrine and the seal
// chamber under it; the Bay road milestone)
export const DESIGN_TOMES = [...new Set(Object.values(DESIGNS).flatMap((d) => (d.tomes ?? []).map((t) => t[3])))];
// Found in the boss unlocks (unlocks/seneschal.js, bride.js, mother.js grant these)
export const TOME_IN_UNLOCKS = {
  seneschal: ["chron_11", "corv_05"],
  bride: ["lett_06", "lett_08", "corv_06"],
  mother: ["corv_07"],
};
// Given at a rank: path -> rank name -> tomes ("Knights get a key at Knight rank")
export const TOME_BY_RANK = { knight: { Knight: ["seal_02", "seal_12"] } };
// Late tomes: the book is there, but it will not open for you yet
export const TOME_GATES = {
  corv_09: { open: (p) => fallenCount(p.flags) >= 3, shut: "§7The pages are sealed with old wax and the King's mark. They will not part for you yet." },
  corv_10: { open: (p) => p.leads.includes("burned_archive"), shut: "§7Too charred to lift. Somebody who knows this archive would know how to handle it." },
};
// Every tome this file accounts for, one way or another
export const PLACED_TOMES = [
  ...Object.keys(TOWN_TOME_SPOTS), ...Object.keys(TOME_PLACES), ...DESIGN_TOMES,
  ...Object.values(TOME_IN_UNLOCKS).flat(), ...Object.values(TOME_BY_RANK).flatMap((r) => Object.values(r).flat()),
];

// ---------- finding a spot to stand on or lie on ----------

const isOpen = (b) => !!b && (b.isAir || /snow_layer|short_grass|tall_grass|fern|flower/.test(b.typeId));
const firm = (b) => !!b && !b.isAir && !b.isLiquid && !isOpen(b); // slabs and paths count: streets are paved with them
const OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];

// A cell near `at` (x, z, and roughly the y to stand at) with firm ground under it and room above. undefined if the
// ground is not loaded, or nothing near fits.
function standAt(dim, at, height = 2, skip = 0) {
  let n = 0;
  for (const [dx, dz] of OFFSETS) {
    for (const dy of [0, 1, -1, 2, -2]) {
      const x = Math.floor(at.x) + dx, y = Math.floor(at.y) + dy, z = Math.floor(at.z) + dz;
      let below, here, above;
      try {
        below = dim.getBlock({ x, y: y - 1, z });
        here = dim.getBlock({ x, y, z });
        above = height > 1 ? dim.getBlock({ x, y: y + 1, z }) : here;
      } catch { return undefined; }
      if (!below || !here || !above) return undefined; // not loaded
      if (firm(below) && isOpen(here) && isOpen(above) && n++ >= skip) return { x, y, z };
    }
  }
  return undefined;
}

const someoneNear = (dimId, at, r = NEAR) => world.getAllPlayers().some((p) => p.dimension.id === dimId && Math.hypot(p.location.x - at.x, p.location.z - at.z) <= r);
function present(dim, tag, at, r = 32) {
  try { return dim.getEntities({ tags: [tag], location: at, maxDistance: r }); } catch { return undefined; }
}

function stand(dim, id, spot, extraTag) {
  const at = standAt(dim, spot);
  if (!at) return undefined;
  const loc = { x: at.x + 0.5, y: at.y, z: at.z + 0.5 };
  if (SUSPECTS[id]) {
    const s = SUSPECTS[id];
    // vanilla villager on purpose: the suspects may be Returned, and a Returned must pass for any villager
    const villager = dim.spawnEntity("minecraft:villager_v2", loc);
    villager.nameTag = s.name;
    villager.addTag(`hc_story_${id}`);
    if (s.returned) markReturned(villager, { name: s.name, quest: s.quest });
    return villager;
  }
  const npc = spawnNpc(dim, loc, id);
  if (extraTag) npc.addTag(extraTag);
  return npc;
}

// ---------- the town characters ----------

function townPeople() {
  const dim = world.getDimension(OVERWORLD);
  for (const [id, { at }] of Object.entries(STORY_PEOPLE)) {
    const spot = { x: at[0], y: at[1] + 1, z: at[2] };
    if (!someoneNear(OVERWORLD, spot)) continue;
    if (ONCE.has(id) && store.data.once[id]) continue;
    const tag = SUSPECTS[id] ? `hc_story_${id}` : npcTag(id);
    const there = present(dim, tag, spot);
    if (!there) continue; // not loaded
    if (there.length) {
      if (ONCE.has(id) && !store.data.once[id]) { store.data.once[id] = true; store.save(); }
      continue;
    }
    try {
      if (stand(dim, id, spot) && ONCE.has(id)) { store.data.once[id] = true; store.save(); }
    } catch { /* not loaded after all */ }
  }
}

// ---------- Archivist Pell, in every town hall from Town tier ----------

export const PELL_FROM = 2; // hall level 2 = Stone Hall = Town
export function pellSpot(marks) {
  if (marks?.sage) return marks.sage;
  if (marks?.tree) return { x: marks.tree.x + 2, y: marks.tree.y, z: marks.tree.z };
  return undefined;
}

function pellInHalls() {
  const dim = world.getDimension(OVERWORLD);
  for (const [owner, hall] of Object.entries(halls() ?? {})) {
    const spot = hall && !hall.lost && !hall.building && (hall.level ?? 0) >= PELL_FROM ? pellSpot(hall.marks) : undefined;
    if (!spot || !someoneNear(OVERWORLD, spot)) continue;
    const mine = `hc_pell_${owner}`;
    const there = present(dim, mine, spot, 96);
    if (!there) continue;
    for (const extra of there.slice(1)) { try { extra.remove(); } catch { /* gone */ } }
    if (there[0]) {
      const l = there[0].location;
      if (Math.hypot(l.x - spot.x, l.z - spot.z) > 4) { // the hall grew round him: walk him to his new corner
        const at = standAt(dim, spot);
        if (at) try { there[0].teleport({ x: at.x + 0.5, y: at.y, z: at.z + 0.5 }); } catch { /* not loaded */ }
      }
      continue;
    }
    try { stand(dim, "sage", spot, mine); } catch { /* not loaded */ }
  }
}

// ---------- Sir Aldous: the morning after your first win, then the chapterhouse ----------

const VISIT_TICKS = 24000; // he stays one day at your keep
const CHAPTERHOUSE_REACH = 64;

on("siegeReward", ({ player }) => {
  if (!player || !mapMode() || store.data.visits[player.id]) return;
  if (progressOf(player).flags.includes("aldous_met")) return;
  const keep = keepOf(player.id);
  if (!keep) return;
  store.data.visits[player.id] = { due: true, at: keepCenter(keep), until: 0 };
  store.save();
});

function aldous() {
  const dim = world.getDimension(OVERWORLD);
  const now = world.getAbsoluteTime();
  for (const [owner, v] of Object.entries(store.data.visits)) {
    if (v.done) continue;
    const tag = `hc_aldous_visit_${owner}`;
    const spot = { x: v.at.x + 4, y: v.at.y, z: v.at.z + 4 };
    if (v.until && now > v.until) { // the day is over: he rides on to the chapterhouse
      const there = present(dim, tag, spot, 64);
      if (!there) continue;
      for (const e of there) { try { e.remove(); } catch { /* gone */ } }
      v.done = true;
      store.save();
      continue;
    }
    if (v.until || !someoneNear(OVERWORLD, spot)) continue;
    if (world.getTimeOfDay() > 12000) continue; // he rides in by day
    try {
      if (stand(dim, "aldous", spot, tag)) {
        v.until = now + VISIT_TICKS;
        store.save();
        const p = world.getAllPlayers().find((x) => x.id === owner);
        p?.sendMessage("§7A rider in Order grey has come up to your keep, and is waiting by the door with his helmet under his arm.");
      }
    } catch { /* not loaded */ }
  }
  // the chapterhouse: Aldous stands beside Brother Cael, once the chapterhouse is built and Cael is in it
  const ch = markedPlaces().ashen_chapterhouse;
  if (!ch || !someoneNear(OVERWORLD, ch, CHAPTERHOUSE_REACH)) return;
  const cael = present(dim, npcTag("cael"), ch, CHAPTERHOUSE_REACH);
  if (!cael?.length) return;
  const resident = present(dim, "hc_aldous_home", ch, CHAPTERHOUSE_REACH);
  if (!resident || resident.length) return;
  const c = cael[0].location;
  try { stand(dim, "aldous", { x: c.x - 3, y: c.y, z: c.z }, "hc_aldous_home"); } catch { /* not loaded */ }
}

// ---------- the Voice in the Water, by the Wound landing ----------

function corvin() {
  const dock = HOLLOW_SITES.find((s) => s.id === "wound_dock");
  if (!dock || !someoneNear(UNDERTOW_ID, dock)) return;
  let dim;
  try { dim = world.getDimension(UNDERTOW_ID); } catch { return; }
  const there = present(dim, npcTag("corvin"), dock, 48);
  if (!there || there.length) return;
  // still water within a few blocks of the dock, else the dock's edge
  let spot;
  for (let r = 3; r <= 12 && !spot; r++) {
    for (let a = 0; a < 16 && !spot; a++) {
      const x = Math.round(dock.x + Math.cos((a / 16) * 2 * Math.PI) * r), z = Math.round(dock.z + Math.sin((a / 16) * 2 * Math.PI) * r);
      try {
        const top = dim.getTopmostBlock({ x, z });
        if (top?.typeId === "minecraft:water") spot = { x: x + 0.5, y: top.location.y, z: z + 0.5 }; // up to the neck
      } catch { return; }
    }
  }
  try {
    if (!firm(dim.getBlock({ x: dock.x, y: dock.y, z: dock.z }))) return; // the landing is not built yet
    const npc = spot ? spawnNpc(dim, spot, "corvin") : stand(dim, "corvin", { x: dock.x + 3, y: dock.y + 1, z: dock.z + 3 });
    npc?.addEffect("invisibility", 20000000, { showParticles: false });
  } catch { /* not loaded */ }
}

// ---------- Dusty Tomes ----------

function tomeSpot(id) {
  if (TOWN_TOME_SPOTS[id]) { const [x, y, z] = TOWN_TOME_SPOTS[id]; return { x, y: y + 1, z }; }
  const place = TOME_PLACES[id] && markedPlaces()[TOME_PLACES[id]];
  return place ? { x: place.x, y: place.y, z: place.z } : undefined;
}

function tomes() {
  const dim = world.getDimension(OVERWORLD);
  for (const id of [...Object.keys(TOWN_TOME_SPOTS), ...Object.keys(TOME_PLACES)]) {
    if (store.data.tomes[id]) continue;
    const spot = tomeSpot(id);
    if (!spot || !someoneNear(OVERWORLD, spot, 40)) continue;
    // books that share a place go round its mark, one per cell (the mark itself is left for walking through)
    const at = standAt(dim, spot, 1, TOME_PLACES[id] ? 1 : 0);
    if (!at) continue;
    try {
      placeCache(dim.getBlock(at), id);
      store.data.tomes[id] = `${at.x},${at.y},${at.z}`;
      store.save();
    } catch { /* not loaded */ }
  }
}

addFilter("tomeCacheOpen", (open, { player, id }) => {
  const gate = TOME_GATES[id];
  if (!open || !gate || player.getGameMode() === GameMode.Creative) return open;
  if (gate.open(progressOf(player))) return true;
  player.onScreenDisplay.setActionBar(gate.shut);
  return false;
});

on("rankUp", ({ player, path, rank }) => {
  for (const id of TOME_BY_RANK[path]?.[rank] ?? []) grantTome(player, id);
});

// ---------- the loop ----------

onTick("story places", 40, () => {
  if (!mapMode() || !world.getAllPlayers().length) return;
  for (const step of [townPeople, pellInHalls, aldous, corvin, tomes]) {
    try { step(); } catch (e) { console.warn(`[Lore] story places (${step.name}): ${e}`); }
  }
});

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:story_places" || player?.typeId !== "minecraft:player") return;
  const [cmd, arg] = message.trim().split(/\s+/);
  if (cmd === "tp" && arg) {
    const at = STORY_PEOPLE[arg]?.at ? { x: STORY_PEOPLE[arg].at[0], y: STORY_PEOPLE[arg].at[1] + 1, z: STORY_PEOPLE[arg].at[2] } : tomeSpot(arg);
    if (!at) return player.sendMessage(`§c${arg}: no spot known yet (a place's tomes wait for its landmark to be built).`);
    return player.teleport({ x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 }, { dimension: world.getDimension(OVERWORLD) });
  }
  const people = Object.entries(STORY_PEOPLE).map(([k, v]) => `${k} (${v.town})${ONCE.has(k) && store.data.once[k] ? " placed" : ""}`).join(", ");
  const placed = Object.keys(store.data.tomes);
  const waiting = [...Object.keys(TOWN_TOME_SPOTS), ...Object.keys(TOME_PLACES)].filter((t) => !store.data.tomes[t]);
  player.sendMessage(`§6Town characters§r ${people}\n§6Dusty Tomes placed§r ${placed.length}: ${placed.join(" ") || "none"}\n§6Waiting§r ${waiting.join(" ") || "none"}\n§7Pell: every hall from Town tier. Aldous: ${Object.keys(store.data.visits).length} keep visit(s), and the chapterhouse.`);
});

addTests("lore", {
  "every story character placed by script has a conversation": () => {
    for (const id of Object.keys(STORY_PEOPLE)) assert(NPC_IDS.has(id) || SUSPECTS[id], `${id} is neither a story character nor a suspect`);
    for (const id of ["sage", "aldous", "corvin"]) assert(NPC_IDS.has(id), id);
    for (const c of CASES) assert(STORY_PEOPLE[c.asker], `${c.asker} (asker of ${c.id}) has no town spot`);
  },
  "every NPC the story needs has a way onto the map": () => {
    // wren: opening/millbrook.js; carter: undertow/story.js; mag, cael, kesh, ulla, nell: landmark designs
    const elsewhere = ["wren", "carter", "mag", "cael", "kesh", "ulla", "nell", "sage", "aldous", "corvin"];
    for (const n of NPCS) assert(elsewhere.includes(n.id) || STORY_PEOPLE[n.id], `${n.id} is never placed`);
  },
  "placed tomes are real and none is placed twice": () => {
    for (const id of PLACED_TOMES) assert(TOME[id], `${id} is not a tome`);
    assertEqual(new Set(PLACED_TOMES).size, PLACED_TOMES.length, "a tome is placed twice");
    for (const id of Object.keys(TOME_GATES)) assert(PLACED_TOMES.includes(id), `${id} is gated but never placed`);
  },
  "the Lighthouse Letters can all be found": () => {
    for (let n = 1; n <= 8; n++) assert(PLACED_TOMES.includes(`lett_0${n}`), `lett_0${n}`);
  },
  "late tomes stay shut until the story allows": () => {
    const p = { flags: [], leads: [] };
    assert(!TOME_GATES.corv_09.open(p) && !TOME_GATES.corv_10.open(p));
    assert(TOME_GATES.corv_09.open({ ...p, flags: ["fell_reeve", "fell_bride", "fell_mother"] }));
    assert(TOME_GATES.corv_10.open({ ...p, leads: ["burned_archive"] }));
  },
  "Pell takes the hall's sage mark, else stands by the Tree": () => {
    assertEqual(pellSpot({ sage: { x: 1, y: 2, z: 3 } }), { x: 1, y: 2, z: 3 });
    assertEqual(pellSpot({ tree: { x: 1, y: 2, z: 3 } }), { x: 3, y: 2, z: 3 });
    assertEqual(pellSpot({}), undefined);
  },
});
