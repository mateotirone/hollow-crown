// The quest tracker's rules: from what a player has done, which story step is theirs now and where it is.
// Pure (no Minecraft), so the self-tests can run it anywhere. index.js gathers the facts and draws the HUD.
//
// The steps follow the story spine (lore/data/spine.js): Sister Wren in Millbrook, your settlement's own mystery,
// your region's boss first, then the other four, Fennick's Field Notes, naming the thin place, the Tuning Fork,
// the Rift, the Carter and the Court, the Seat. After Morvane the tracker goes quiet.
//
// What it points at: towns and places the player has already been told about or been to. Hidden places stay
// hidden, as in the Ledger and the Almanac: the tracker never points at a thin place the player has not named,
// and a boss's ground is reached through its region's town, with a hint for the last stretch.
// Nothing here names the Hollow: the steps beyond the Rift only show to someone who is already there.

import { shardsStatus, listShards } from "../bestiary/shards.js";
import { PLOT_REGION, REGION_BOSS, REGIONAL_BOSSES } from "../lore/data/spine.js";
import { WARDS } from "../plots/config.js";
import { COURT, HEART } from "../undertow/layout.js";
import { firstStep } from "../newplayer/firstnights.js";
import { SETTLEMENT } from "../newplayer/mode_rules.js";

export const KEY = "hcq:"; // hidden titles that start with this feed the HUD tracker (tools/minimap_ui.py)
export const SPOT = { below: "_b", top: "_t", hidden: "_h" }; // where the panel sits: under the minimap, in its place, or not at all
export const OVERWORLD = "minecraft:overworld";
export const UNDERTOW = "siege:undertow";
export const NOTES = ["surv_01", "surv_02", "surv_03", "surv_04", "surv_05", "surv_06"]; // Fennick's six Field Notes (the seventh is his last report)
export const SHARDS_FOR_FORK = 5;

const town = (name) => {
  const w = WARDS.find((x) => x.name === name);
  return { name, x: w.x, z: w.z, dim: OVERWORLD };
};
const at = (name, x, z, dim = OVERWORLD) => ({ name, x, z, dim });
// The person a step sends you to talk to: the tag their NPC carries (story characters: lore/npcs.js; the clock
// keepers: unlocks/reeve.js; Old Sigga: unlocks/huntsman.js). marks.js puts a marker over them and on the minimap.
// Only for people the step already names: a puzzle's answer (the Mirelight changeling) is never marked.
const npc = (id, name) => ({ tag: `siege_lore_npc_${id}`, name });

// Each regional boss: where its puzzle starts (always a town), the hint for the last stretch, and what to do
// with the key once the puzzle hands it over. Keys come from unlocks/ (one file per boss).
export const BOSS_STEPS = {
  reeve: {
    title: "The six clocks of Millbrook", start: town("Millbrook"),
    hint: "Ask the clock keepers which clock stopped first.", npc: { tag: "siege_clock_keeper", name: "a clock keeper" },
    key: "siege:stopped_clock_key", keyTitle: "The well in Millbrook", keyAt: town("Millbrook"),
    keyHint: "Turn the Stopped Clock Key in the crank on the well.",
  },
  huntsman: {
    title: "The hunt on Hallowmere", start: town("Rimehold"),
    hint: "Old Sigga keeps the lodge on the lake east of Rimehold. Go after dark.", npc: { tag: "siege_lodge_warden", name: "Old Sigga" },
    key: "siege:pale_horn", keyTitle: "The Hunter's Cairn", keyAt: at("Hallowmere", 60, -1130),
    keyHint: "Lay the Pale Horn on the Hunter's Cairn after dark.",
  },
  bride: {
    title: "The chapel under Gull Bay", start: town("Gull's Rest"),
    hint: "The bay is north-east of Gull's Rest. Its chapel only shows on a dark moon.",
    key: "siege:drowned_ring", keyTitle: "The drowned altar", keyAt: at("Gull Bay", -690, 130),
    keyHint: "Put the ring back on the chapel's altar.",
  },
  seneschal: {
    title: "The faceless statues", start: town("Sunscar"),
    hint: "South of Sunscar, in the dunes. Turn the statues in the order of the king's life.",
    key: "siege:faceless_seal", keyTitle: "The Faceless Vault", keyAt: at("the vault", 850, 590),
    keyHint: "Press the Faceless Seal into the vault door.",
  },
  mother: {
    title: "The lost days of Mirelight", start: town("Mirelight"),
    hint: "One villager in the lantern square shows all three tells. Name them.",
    key: "siege:mire_effigy", keyTitle: "The Cradle Tree", keyAt: town("Mirelight"),
    keyHint: "Lay the Mire Effigy in the root cradle under the great tree south of Mirelight.",
  },
};

const fell = (flags, boss) => flags.includes(`fell_${boss}`);
export const fallen = (flags) => REGIONAL_BOSSES.filter((b) => fell(flags, b));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

// The home boss is the one your settlement's region points to; without a settlement, Millbrook's.
export function homeBoss(plot) {
  return REGION_BOSS[PLOT_REGION[plot]]?.boss ?? "reeve";
}

// Which boss next: one whose key you are carrying, then your home boss, then the nearest still standing.
export function nextBoss(f) {
  const left = REGIONAL_BOSSES.filter((b) => !fell(f.flags, b));
  if (!left.length) return undefined;
  const keyed = left.find((b) => f.items?.[BOSS_STEPS[b].key]);
  if (keyed) return keyed;
  const home = homeBoss(f.plot);
  if (left.includes(home)) return home;
  const from = f.dim === OVERWORLD && f.pos ? f.pos : town("Kingsrest");
  return left.slice().sort((a, b) => dist2(from, BOSS_STEPS[a].start) - dist2(from, BOSS_STEPS[b].start))[0];
}

// The Choir Shards: one from each regional boss, all five needed for the Tuning Fork (bestiary/shards.js)
export function shardNote(f) {
  const { have, missing } = shardsStatus(f.items);
  const lost = missing.filter((s) => fell(f.flags, s.boss));
  if (lost.length) return `Keep every boss's shard. Not in your pack: ${listShards(lost)} (beat it again for another).`;
  return have.length ? `Keep their shards: ${have.length} of 5.` : "";
}

const bossQuest = (f, boss) => {
  const s = BOSS_STEPS[boss];
  const down = fallen(f.flags).length;
  const tally = down ? `${down} of 5 fallen. ${shardNote(f)}`.trim() : "";
  if (f.items?.[s.key]) return { id: `boss_${boss}_key`, title: s.keyTitle, hint: s.keyHint, target: s.keyAt, note: tally };
  return { id: `boss_${boss}`, title: s.title, hint: s.hint, target: s.start, note: tally, npc: s.npc };
};

const notesQuest = (f) => {
  const have = NOTES.filter((n) => f.got.includes(n)).length;
  if (have >= NOTES.length) {
    return { id: "name_place", title: "Name the thin place", hint: "Shelve Fennick's six Field Notes in your Library, then name the place in its catalog." };
  }
  return { id: "field_notes", title: "Fennick's Field Notes", hint: "His camps are at the thin places. Your Ledger's leads say roughly where.", note: `${have} of 6 found.` };
};

// The source site, once named: { id, name, x, z }
const siteTarget = (site) => (site ? at(site.name, site.x, site.z) : undefined);

// The main step and, sometimes, one side step. Each: { id, title, hint, target?: { name, x, z, dim }, note? }.
// f = {
//   flags, solved, got: lore progress (lore/player.js progressOf)       plot: settlement name or undefined
//   keep: has a Keep Banner raised                                       items: { item id: count } of what matters
//   dim, pos: where the player is                                        site: the named source site { id, name, x, z }
//   rift: the Rift, once open { x, z, name }                             hollow: { cartsong, choir, carter: { x, z } }
//   morvane: Morvane has fallen (world or player)                      farmer: { at?: { x, z }, sold, tag } once you have a settlement
//                                                                       station: your railway station (stationQuest)
//   cob: your starter horse until first ridden { name, at?: { x, z }, dim }
//   act1: { on, step } while Act 1 is this player's story (newplayer/act1.js)
//   board: the step of the Town Board job this player has taken (townhall/board.js boardQuest), if any
//   mode: "story" | "settlement" (newplayer/mode.js)
//   act2: { on, step } while an Act 2 step is this player's story (newplayer/act2.js): shown as the main step
// }
export function questsFor(f) {
  // Act 1 (Mateo 2026-11-14): one line, the step Old Elspeth (or Wren, or your own thought) gave you, and nothing
  // else, so a new player is never handed a list
  if (f.act1?.on && f.dim !== UNDERTOW) return f.act1.step ? [f.act1.step] : [];
  // Settlement Mode (Mateo 2026-11-14): no story steps, ever. Old Elspeth's guide (above) leads the settlement; if it
  // has nothing to say, only the settlement's own steps can show.
  if (f.mode === SETTLEMENT) return settlementQuests(f);
  const out = [];
  // Until the first siege is held, getting ready for it comes first (newplayer/firstnights.js)
  const first = f.dim !== UNDERTOW && !f.morvane ? firstStep(f.first) : undefined;
  if (first) out.push(first);
  const ride = cobQuest(f);
  if (ride) out.push(ride);
  const farm = farmerQuest(f);
  if (farm) out.push(farm);
  const main = (f.act2?.on && f.dim !== UNDERTOW ? f.act2.step : undefined) ?? mainQuest(f);
  if (main) out.push(main);
  // your own railway station: shown until you have stood on its platform, even in the first nights (playtest
  // 2026-11-13: "Where's the train station?"), and the only side step then
  const side = first ? stationQuest(f) : sideQuest(f, main);
  if (side) out.push(side);
  // a Town Board job you took: its step, always shown while you have one (outside the Hollow)
  if (f.board && f.dim !== UNDERTOW) out.push(f.board);
  return out;
}

// Settlement Mode with no guide step: getting ready for the first siege, the cob, the Farmer, the station and the
// banner, never the story
function settlementQuests(f) {
  if (f.dim === UNDERTOW) return [];
  const first = firstStep(f.first);
  const out = [first, cobQuest(f), farmerQuest(f)].filter(Boolean);
  if (!first && !f.keep) out.push({ id: "keep", title: "Raise your banner", hint: "Click your Plot Stone and raise your banner again." });
  const side = stationQuest(f);
  if (side) out.push(side);
  return out.slice(0, 3);
}

// The starter horse (horses/starter.js): shown from the moment the cob is given until it is first ridden
export function cobQuest(f) {
  if (f.dim === UNDERTOW || !f.cob) return undefined;
  const there = f.cob.at && (f.cob.dim ?? OVERWORLD) === f.dim;
  return {
    id: "cob", title: `Ride ${f.cob.name}, your horse`,
    hint: "A slow old cob, but quicker than walking. Lost it? Blow your Horse Whistle and it comes from anywhere.",
    target: there ? at(f.cob.name, f.cob.at.x, f.cob.at.z, f.dim) : undefined,
  };
}

// Your first Regals (Mateo 2026-11-13): sell wheat to the Farmer in your own Hamlet (economy/hamlet.js). Shows from
// the day the settlement is founded until WHEAT_GOAL wheat has been sold to any Farmer.
export const WHEAT_GOAL = 16;
export function farmerQuest(f) {
  if (f.dim === UNDERTOW || f.morvane || !f.farmer || (f.farmer.sold ?? 0) >= WHEAT_GOAL) return undefined;
  const sold = f.farmer.sold ?? 0;
  return {
    id: "farmer", title: `Sell ${WHEAT_GOAL} wheat to the Farmer`,
    hint: "Your first Regals. Your Farmer sells seeds and buys wheat: plant the field by the houses and bring him the harvest.",
    target: f.farmer.at ? at("Your Farmer", f.farmer.at.x, f.farmer.at.z) : undefined,
    note: sold ? `${sold} of ${WHEAT_GOAL} sold.` : "",
    npc: f.farmer.tag ? { tag: f.farmer.tag, name: "your Farmer" } : undefined,
  };
}

function mainQuest(f) {
  if (f.morvane || f.flags.includes("morvane_fallen")) return undefined;
  const inHollow = f.dim === UNDERTOW;
  const h = f.hollow ?? {};
  if (inHollow) {
    if (h.choir) return { id: "seat", title: "The Seat", hint: "South, up the Long Climb. He is waiting there.", target: at("The Seat", HEART.center.x, HEART.center.z, UNDERTOW) };
    if (!h.cartsong) {
      return { id: "carter", title: "Find the Carter", hint: "He drives the ore cart, and knows how the carts get into the Court.",
        target: h.carter ? at("The Carter", h.carter.x, h.carter.z, UNDERTOW) : undefined, npc: npc("carter", "The Carter") };
    }
    return { id: "court", title: "The Drowned Court", hint: "Follow the valley south. The Court will let you in now.", target: at("The Court", COURT.center.x, COURT.center.z, UNDERTOW) };
  }
  const down = fallen(f.flags).length;
  if (down >= 5) {
    if (f.rift) {
      return h.choir
        ? { id: "rift_back", title: "Back through the Rift", hint: "Someone silenced what sang down there. The rest is still to do.", target: at(f.rift.name, f.rift.x, f.rift.z) }
        : { id: "rift", title: "The Rift is open", hint: "Go through.", target: at(f.rift.name, f.rift.x, f.rift.z) };
    }
    if (!f.solved.includes("source")) return notesQuest(f);
    if (!f.items?.["siege:tuning_fork"]) {
      const { have, missing } = shardsStatus(f.items);
      return { id: "fork", title: "Make the Tuning Fork", hint: "One shard from each of the five bosses, with an amethyst shard, at a Siege Workshop.",
        note: missing.length ? `${have.length} of ${SHARDS_FOR_FORK} shards. Still need ${listShards(missing)}.` : "All five shards in your pack." };
    }
    return { id: "strike", title: "Strike the fork", hint: "On the seam in the cave at the place you named.", target: siteTarget(f.site) };
  }
  if (down === 0 && !f.flags.includes("wren_met")) {
    return { id: "wren", title: "Find Sister Wren", hint: "She keeps the chapel in Millbrook, where it is always night.", target: town("Millbrook"), npc: npc("wren", "Sister Wren") };
  }
  if (down === 0 && f.plot && f.mystery && !f.solved.includes(f.mystery.id)) {
    return { id: "mystery", title: f.mystery.name, hint: "Read your settlement's books, then answer it in your Ledger." };
  }
  return bossQuest(f, nextBoss(f));
}

// f.station = { name, x, z, built (the Halt is up), found (you have been there) } for your settlement's station
export function stationQuest(f) {
  const st = f.station;
  if (f.dim === UNDERTOW || !st || st.found) return undefined;
  return {
    id: "station", title: "Find your railway station",
    hint: st.built ? "Your Halt stands where the line passes your land. Click its Station Post to ride and to buy track to the next stop."
      : "A Halt rises where the line passes your land once you are near it. Click its Station Post to ride and buy track.",
    target: at(st.name, st.x, st.z),
  };
}

function sideQuest(f, main) {
  if (f.dim === UNDERTOW) return undefined;
  if (!f.keep && !f.morvane) return { id: "keep", title: "Found your settlement", hint: "Click your Plot Stone and raise your banner before the first siege night." };
  const station = stationQuest(f);
  if (station) return station;
  const down = fallen(f.flags).length;
  if (down >= 3 && down < 5 && !f.solved.includes("source") && main?.id?.startsWith("boss_")) return notesQuest(f);
  return undefined;
}

// ---------- where it is, on the minimap ----------
// The quest pin: the first step with a place in this dimension, the same one the tracker's first heading is for.
export function pinOf(quests, dim) {
  const q = quests.find((x) => x.target && x.target.dim === dim);
  return q ? { x: q.target.x, z: q.target.z, kind: "goal", name: q.target.name } : undefined;
}
// The person to talk to next: the first step that names one (marks.js finds them in the world).
export const talkOf = (quests) => quests.find((x) => x.npc)?.npc;

// ---------- where it is, in words ----------
// Which way to turn, from where a player stands and the way they face (Minecraft yaw: 0 is south, 90 west).
export function pointer(pos, yaw, target) {
  const dx = target.x - pos.x, dz = target.z - pos.z, dist = Math.round(Math.hypot(dx, dz));
  const want = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const turn = ((((want - yaw) % 360) + 540) % 360) - 180; // -180..180, plus = to your right
  const a = Math.abs(turn);
  const way = a <= 30 ? "ahead" : a >= 150 ? "behind you" : a <= 75 ? (turn > 0 ? "ahead right" : "ahead left")
    : a < 120 ? (turn > 0 ? "right" : "left") : (turn > 0 ? "behind right" : "behind left");
  return { dist, way };
}
export const HERE = 24; // blocks: close enough that "you are here" beats a heading

const dimName = (dim) => (dim === UNDERTOW ? "below" : "in the open world");

export function whereLine(q, pos, yaw, dim) {
  const t = q.target;
  if (!t) return "";
  if (t.dim !== dim) return `§8${t.name}, ${dimName(t.dim)}`;
  const { dist, way } = pointer(pos, yaw, t);
  if (dist <= HERE) return `§e${t.name}: §fyou are here`;
  return `§e${t.name}: §f${dist} blocks ${way}`;
}

// The text the HUD shows: each quest as a gold title, a grey hint and, if it has one, where it is.
export function panelText(quests, pos, yaw, dim) {
  const blocks = quests.map((q) => {
    const lines = [`§6${q.title}`];
    if (q.hint) lines.push(`§7${q.hint}`);
    const where = whereLine(q, pos, yaw, dim);
    if (where) lines.push(where);
    if (q.note) lines.push(`§8${q.note}`);
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

// The hidden title: KEY, where the panel sits, then the text. The HUD cuts the first two off.
// The text never holds the key or a spot marker, so the HUD's cutting can't eat part of it.
export function hudString(text, spot = SPOT.below) {
  const clean = String(text ?? "").split(KEY).join("").split("_b").join("").split("_t").join("").split("_h").join("");
  if (!clean.trim()) return KEY + SPOT.hidden + " ";
  return KEY + spot + clean;
}
export function readHud(s) {
  if (!s.startsWith(KEY)) return undefined;
  const rest = s.slice(KEY.length);
  return { spot: rest.slice(0, 2), text: rest.slice(2) };
}
