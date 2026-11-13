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

import { PLOT_REGION, REGION_BOSS, REGIONAL_BOSSES } from "../lore/data/spine.js";
import { WARDS } from "../plots/config.js";
import { COURT, HEART } from "../undertow/layout.js";

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

// Each regional boss: where its puzzle starts (always a town), the hint for the last stretch, and what to do
// with the key once the puzzle hands it over. Keys come from unlocks/ (one file per boss).
export const BOSS_STEPS = {
  reeve: {
    title: "The six clocks of Millbrook", start: town("Millbrook"),
    hint: "Ask the clock keepers which clock stopped first.",
    key: "siege:stopped_clock_key", keyTitle: "The well in Millbrook", keyAt: town("Millbrook"),
    keyHint: "Turn the Stopped Clock Key in the crank on the well.",
  },
  huntsman: {
    title: "The hunt on Hallowmere", start: town("Rimehold"),
    hint: "Old Sigga keeps the lodge on the lake east of Rimehold. Go after dark.",
    key: "siege:pale_horn", keyTitle: "The Hunter's Cairn", keyAt: at("Hallowmere", 60, -1130),
    keyHint: "Lay the Pale Horn on the Hunter's Cairn on a siege night.",
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

const bossQuest = (f, boss) => {
  const s = BOSS_STEPS[boss];
  const down = fallen(f.flags).length;
  const tally = down ? `${down} of 5 fallen.` : "";
  if (f.items?.[s.key]) return { id: `boss_${boss}_key`, title: s.keyTitle, hint: s.keyHint, target: s.keyAt, note: tally };
  return { id: `boss_${boss}`, title: s.title, hint: s.hint, target: s.start, note: tally };
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
//   morvane: Morvane has fallen (world or player)
// }
export function questsFor(f) {
  const out = [];
  const main = mainQuest(f);
  if (main) out.push(main);
  const side = sideQuest(f, main);
  if (side) out.push(side);
  return out;
}

function mainQuest(f) {
  if (f.morvane || f.flags.includes("morvane_fallen")) return undefined;
  const inHollow = f.dim === UNDERTOW;
  const h = f.hollow ?? {};
  if (inHollow) {
    if (h.choir) return { id: "seat", title: "The Seat", hint: "South, up the Long Climb. He is waiting there.", target: at("The Seat", HEART.center.x, HEART.center.z, UNDERTOW) };
    if (!h.cartsong) {
      return { id: "carter", title: "Find the Carter", hint: "He drives the ore cart, and knows how the carts get into the Court.",
        target: h.carter ? at("The Carter", h.carter.x, h.carter.z, UNDERTOW) : undefined };
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
      const shards = Math.min(SHARDS_FOR_FORK, f.items?.["siege:choir_shard"] ?? 0);
      return { id: "fork", title: "Make the Tuning Fork", hint: "Five shards on an amethyst, at a Siege Workshop.", note: `${shards} of 5 shards in your pack.` };
    }
    return { id: "strike", title: "Strike the fork", hint: "On the seam in the cave at the place you named.", target: siteTarget(f.site) };
  }
  if (down === 0 && !f.flags.includes("wren_met")) {
    return { id: "wren", title: "Find Sister Wren", hint: "She keeps the chapel in Millbrook, where it is always night.", target: town("Millbrook") };
  }
  if (down === 0 && f.plot && f.mystery && !f.solved.includes(f.mystery.id)) {
    return { id: "mystery", title: f.mystery.name, hint: "Read your settlement's books, then answer it in your Ledger." };
  }
  return bossQuest(f, nextBoss(f));
}

function sideQuest(f, main) {
  if (f.dim === UNDERTOW) return undefined;
  if (!f.keep && !f.morvane) return { id: "keep", title: "Found your settlement", hint: "Raise your Keep Banner on a Plot Stone before the first siege night." };
  const down = fallen(f.flags).length;
  if (down >= 3 && down < 5 && !f.solved.includes("source") && main?.id?.startsWith("boss_")) return notesQuest(f);
  return undefined;
}

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
