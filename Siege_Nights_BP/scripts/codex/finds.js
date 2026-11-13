// Where the Codex's finds come from: boss and rival drops, the thin-place charms and the twelve mythical things.
//
// Each find is given once per player (store.data.given[playerId] = [short id]). Boss drops come in on the script
// events the bestiary sends; places are checked every few seconds against where each player stands.

import { system, GameMode } from "@minecraft/server";
import { on, onTick, isNight } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { WARDS, PLOT_PLAN } from "../plots/config.js";
import { plotOf } from "../plots/claims.js";
import { caveSiteOf } from "../plotcaves/index.js";
import { progressOf } from "../lore/player.js";
import { fallenCount } from "../lore/data/spine.js";
import { moonPhase } from "../lore/moondoors.js";
import { dragonOf } from "../dragons/dragon.js";
import { hasBeaten } from "../bestiary/bossCore.js";
import { ITEM, CODEX } from "./rules.js";
import { store, give, short, players, flatDist } from "./state.js";
import { setFindSpots } from "./powers.js";

const givenOf = (pid) => ((store.data.given ??= {})[pid] ??= []);
export const wasGiven = (pid, id) => givenOf(pid).includes(short(id));

// Give a find (once). Returns true if it was given now.
export function grantFind(p, id, line) {
  if (!p || wasGiven(p.id, id)) return false;
  if (!give(p, id, 1)) return false;
  givenOf(p.id).push(short(id));
  store.save();
  sfx(p, "random.levelup");
  p.sendMessage(`§d${line ?? "You found something."}§r\n§6${ITEM[id]?.name ?? id}§7 is yours. Open your Codex to read about it.`);
  return true;
}
export function forgetGiven(pid) {
  if (store.data.given) delete store.data.given[pid];
  store.save();
}

const online = (ids) => players().filter((p) => (ids ?? []).includes(p.id));
const parse = (msg) => { try { return JSON.parse(msg); } catch { return undefined; } };

// ---------- drops ----------
export const OATH_DROP = {
  reeve: ["siege:oathsworn_helmet", "In the Reeve's tower, under the stopped clocks, an old helm with an oath cut into it."],
  huntsman: ["siege:oathsworn_leggings", "The Huntsman's cloak falls away. Under it, a knight's greaves, still bright."],
  bride: ["siege:oathsworn_chestplate", "Under the Bride's veil she wore a breastplate. Somebody's oath is cut into it."],
  seneschal: ["siege:oathsworn_boots", "The Seneschal's boots are still standing at his post after he is gone."],
  mother: ["siege:oathsworn_sword", "Down among the roots lies a sword with the same oath on it as the others."],
};
export const PRETENDER_DROP = ["siege:usurpers_edge", "siege:seers_glass", "siege:claimants_mace"];
export const CHAMPION_DROP = { knight: "siege:lists_gauntlet", sorcerer: "siege:hex_lantern", lord: "siege:lords_signet" };

function bossFell(d) {
  if (!d?.boss) return;
  const ids = [...new Set([...(d.players ?? []), ...(d.killer ? [d.killer] : [])])];
  const drop = OATH_DROP[d.boss];
  if (drop) for (const p of online(ids)) grantFind(p, drop[0], drop[1]);
  if (d.boss === "warlord_king") {
    const wins = (store.data.warlord ??= {});
    for (const id of ids) wins[id] = (wins[id] ?? 0) + 1;
    store.save();
    for (const p of online(ids)) if (wins[p.id] >= 3) grantFind(p, "siege:cairn_helm", "The third time he goes down, the Warlord King's helm comes off and stays off.");
  }
}
function pretenderFell(d) {
  if (!d) return;
  const id = PRETENDER_DROP[Math.abs(Number(d.n) || 0) % PRETENDER_DROP.length];
  for (const p of online([...(d.players ?? []), ...(d.killer ? [d.killer] : [])])) {
    // each claimant carries one of the three; if you have that one, the next you don't have
    const pick = [id, ...PRETENDER_DROP].find((x) => !wasGiven(p.id, x));
    if (pick) grantFind(p, pick, `${d.name ?? "The claimant"} drops what it carried up to the Seat.`);
  }
}
function championFell(d) {
  const id = CHAMPION_DROP[d?.role];
  if (!id || (d.tier ?? 0) < 2) return;
  for (const p of online(d.players)) if (Math.random() < 0.25 || (d.tier ?? 0) >= 3) grantFind(p, id, `${d.name ?? "The rival"} won't need this any more.`);
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id === "siege:boss_defeated") bossFell(parse(e.message));
  else if (e.id === "siege:pretender_fallen") pretenderFell(parse(e.message));
  else if (e.id === "siege:champion_defeated") championFell(parse(e.message));
});
on("regentOverthrown", ({ by } = {}) => {
  const p = players().find((x) => x.id === by);
  if (p) grantFind(p, "siege:regents_seal_ring", "On the regent's hand, a ring with the seal of the ore.");
});
on("loreTalk", ({ player, npc } = {}) => {
  if (npc !== "corvin" || !player) return;
  if (fallenOf(player) >= 3) grantFind(player, "siege:corvins_lodestone", "Corvin's voice, out of the water: \"Take it. It always found what I'd lost.\"");
});

// ---------- places ----------
const fallenOf = (p) => { try { return fallenCount(progressOf(p).flags ?? []); } catch { return 0; } };
const solved = (p, thread) => { try { return (progressOf(p).solved ?? []).includes(thread); } catch { return false; } };
const relic = (name) => PLOT_PLAN.find((n) => n.name === name)?.relic;
const ward = (site) => WARDS.find((w) => w.site === site);
// local mystery solved, or three regional bosses down
const earned = (local) => (p) => solved(p, local) || fallenOf(p) >= 3;

export const CHARM_AT = {
  drowned_chapel: "siege:chapel_clapper", bellfounders_mine: "siege:founders_slag", kings_barrow: "siege:barrow_coin",
  saltglass_grotto: "siege:saltglass_prism", frostvein_hollow: "siege:frostvein_shard", sunken_quarry: "siege:quarry_mark",
  witchroot_caves: "siege:witchroot_knot",
};

// Every place-find: { id, place, at(p) -> {x,z} | undefined, r, ok(p) -> bool, line, charm? }
export const SPOTS = [
  ...Object.entries(CHARM_AT).map(([site, id]) => ({
    id, charm: true, place: ward(site)?.name ?? site, at: () => ward(site), r: 20, ok: () => true,
    line: `Something small is wedged in the rock at ${ward(site)?.name ?? "the cave"}. It's warm.`,
  })),
  { id: "siege:maelis_clapper", place: "the Bellfounders' Mine", at: () => ward("bellfounders_mine"), r: 16, ok: earned("local_frosthelm"),
    line: "Deep in the mine, a clapper as long as your arm. It was cast for a bell nobody could lift." },
  { id: "siege:cairn_axe", place: "the cairn at Wolfcairn", at: () => relic("Wolfcairn"), r: 10, ok: earned("local_wolfcairn"),
    line: "Under the last stone of the cairn: an axe, wrapped in oilcloth, waiting for somebody to come back for it." },
  { id: "siege:holts_debt", place: "the water off the Westwatch", at: () => ({ x: -850, z: 300 }), r: 48, ok: (p) => p.isInWater && fallenOf(p) >= 1,
    line: "In a burned wreck under the water, a boat-hook still hangs where somebody left it." },
  { id: "siege:ysolts_lance", place: "the oldest nest at the Cinder Roost", at: () => ({ x: 882, z: 310 }), r: 24,
    ok: (p) => { const d = dragonOf(p.id); return !!d && d.stage !== "egg"; },
    line: "In the oldest nest at the Roost, a lance as long as a dragon's neck, kept for whoever has raised one." },
  { id: "siege:sedges_thorn", place: "Goody Sedge's graves", at: () => ({ x: 10, z: 988 }), r: 12, ok: () => isNight(),
    line: "At the grave with no name on it, a thorn grows out of the stone. It comes away in your hand." },
  { id: "siege:second_moon_bow", place: "the moon door at Rimehold", at: () => ({ x: -80, z: -1080 }), r: 30,
    ok: () => isNight() && [0, 4].includes(moonPhase()),
    line: "Behind the moon door, a bow strung with something pale. Nobody knows whose it was." },
  { id: "siege:eddas_mercy", place: "under the copyists' house at Dunehold", at: () => relic("Dunehold"), r: 10, ok: (p) => hasBeaten(p, "morvane"),
    line: "The seal under the copyists' house opens now. Inside, a small blade, and a note: \"For mercy, not for war.\"" },
  { id: "siege:hrodas_pick", place: "the deepest door in your own mine",
    at: (p) => { const plot = plotOf(p.id), s = plot && caveSiteOf(plot.name); return s?.door?.length && (s.tier ?? 0) >= 3 ? s.door[0] : undefined; },
    r: 8, ok: () => true, line: "By the sealed door at the bottom of your mine, a bellfounder's pick, left where the digging stopped." },
  { id: "siege:sextons_spade", place: "the churchyard at Bellhollow", at: () => ({ x: 155, z: -100 }), r: 30, ok: (p) => fallenOf(p) >= 3,
    line: "Leaning on the churchyard wall at Bellhollow, a spade nobody has put away in three hundred years." },
  { id: "siege:aldrics_sickle", place: "the old king's lodge at Oakmere", at: () => relic("Oakmere"), r: 10, ok: earned("local_oakmere"),
    line: "In the lodge's second cellar, a gardener's sickle with a crown stamped on the handle." },
  { id: "siege:wennas_line", place: "the loose board at Lanternbog", at: () => relic("Lanternbog"), r: 10, ok: earned("local_lanternbog"),
    line: "Under the loose board, a fishing line wound on a bone spool. It's still wet." },
];

// What a player could still find (for Corvin's Lodestone and the Map of Lost Things): places only
function openSpots(p) {
  const out = [];
  for (const s of SPOTS) {
    if (wasGiven(p.id, s.id)) continue;
    let at;
    try { at = s.at(p); } catch { at = undefined; }
    if (at) out.push({ id: s.id, x: at.x, z: at.z, place: s.place, charm: !!s.charm });
  }
  return out;
}
setFindSpots(openSpots);

function scan() {
  for (const p of players()) {
    try {
      if (p.dimension.id !== "minecraft:overworld" || p.getGameMode() === GameMode.Spectator) continue;
    } catch { continue; }
    for (const s of SPOTS) {
      if (wasGiven(p.id, s.id)) continue;
      let at;
      try { at = s.at(p); } catch { at = undefined; }
      if (!at || flatDist(p.location, at) > s.r) continue;
      let ok = false;
      try { ok = !!s.ok(p); } catch { ok = false; }
      if (ok) grantFind(p, s.id, s.line);
    }
  }
}
onTick("codex:finds", CODEX.scanTicks * 2, scan);

// for the self-tests and the creative tools
export const _test = { bossFell, pretenderFell, givenOf };
