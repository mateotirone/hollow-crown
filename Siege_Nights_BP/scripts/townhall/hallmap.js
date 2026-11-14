// The Hall Map: a painted map of the realm hanging in every town hall (Mateo, 2026-11-12).
//
// It shows every settlement on the map in its Keep Banner colour, with who holds it (never players themselves),
// every town, and the places someone from this settlement has found. Land nobody from the settlement has walked
// stays under fog. Open it from the hall's Cartographer's Table or the Town Board ("Hall map").
//
// The picture is a 16 x 16 grid of cells over a painted map (resource pack: ui/server_form.json, made by
// studio/build_tree_ui.py; art in textures/ui/hc/map/, made by studio/build_hallmap.py). Each cell is one form
// button; its icon says what the cell shows and its text is the name shown on hover.
// Mystery places from the lore (charted: false) never go on the map: the player has to work those out.

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { allPlots, holderOf, WARDS } from "../plots/api.js";
import { PLACES } from "../lore/data/world.js";
import { loadSaved } from "../lore/logic.js";

// the lore's charted places, as marked on the map by the builder (lore/ledger.js markedPlaces, read only)
const markedPlaces = () => { try { return loadSaved("places", world.getDynamicProperty("hc:lore_places")) ?? {}; } catch { return {}; } };

export const MAP_FLAG = "§h§m";            // the resource pack draws forms whose title carries this as the map
export const GRID = 16;                    // cells per side
export const ORIGIN = -1250, SPAN = 2500;  // world x/z covered by the map (the playable 2,500 x 2,500)
export const CELL = SPAN / GRID;           // blocks per cell (156.25)
const SIGHT = 96;                          // a player charts every cell within this many blocks
const TEX = "textures/ui/hc/map/";

// Towns stand on every map from the start; these few places appear once found. Their names and spots come from
// plots/config.js WARDS (towns and Order houses) and the lore's charted places marked on the map.
const TOWNS = ["Kingsrest", "Millbrook", "Rimehold", "Gull's Rest", "Sunscar", "Mirelight"];
const FINDABLE_WARDS = { Crownhold: "The ruined capital. The Hall of Bells has no bells left hanging.",
  "the Ashen Gate Chapterhouse": "The last house of the Order. Grey banners, cold hearths.",
  "the Ashen Watch": "An Order watchpost on the edge of the waste." };

// ---------- what each settlement knows ----------
// players: { id: { c: "64 hex chars, one bit per cell", f: [place ids found] } }. A settlement knows what its
// owner and allies know, so a new ally brings their travels with them.
const store = api.moduleStore("siege:hallmap", () => ({ players: {} }));

export const cellOf = (x, z) => {
  const cx = Math.floor((x - ORIGIN) / CELL), cz = Math.floor((z - ORIGIN) / CELL);
  return cx < 0 || cz < 0 || cx >= GRID || cz >= GRID ? -1 : cz * GRID + cx;
};
const bitsOf = (hex) => { const b = new Uint8Array(GRID * GRID / 8); for (let i = 0; i < b.length; i++) b[i] = parseInt(hex?.slice(i * 2, i * 2 + 2) || "0", 16) || 0; return b; };
const hexOf = (b) => [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
const has = (b, i) => (b[i >> 3] >> (i & 7)) & 1;

/** Pure: mark the cells a player standing at (x, z) can see. Returns true if anything new was charted. */
export function chart(bits, x, z) {
  let changed = false;
  for (const dx of [-SIGHT, 0, SIGHT]) for (const dz of [-SIGHT, 0, SIGHT]) {
    const i = cellOf(x + dx, z + dz);
    if (i < 0 || has(bits, i)) continue;
    bits[i >> 3] |= 1 << (i & 7); changed = true;
  }
  return changed;
}

// Places a player can find: Crownhold and the Order's houses, plus the lore's charted places once marked.
export function findablePlaces(marked = markedPlaces()) {
  const out = [];
  for (const w of WARDS) if (FINDABLE_WARDS[w.name]) out.push({ id: "w:" + w.name, name: w.name.replace(/^the /, "The "), x: w.x, z: w.z, r: w.r, text: FINDABLE_WARDS[w.name] });
  for (const [id, at] of Object.entries(marked)) {
    const p = PLACES[id];
    if (!p?.charted || TOWNS.includes(p.name) || p.name === "Crownhold" || p.name.includes("Ashen Gate")) continue;
    out.push({ id: "p:" + id, name: p.name, x: at.x, z: at.z, r: 24, text: p.desc });
  }
  return out;
}

/** The settlement a player belongs to: their own, or the one they are an ally of. */
export function settlementOf(playerId, keeps = api.getState().keeps) {
  if (keeps[playerId]) return playerId;
  return Object.keys(keeps).find((o) => keeps[o].allies?.includes(playerId));
}

function knownBy(owner) {
  const keeps = api.getState().keeps;
  const ids = [owner, ...(keeps[owner]?.allies ?? [])];
  const bits = new Uint8Array(GRID * GRID / 8);
  const found = new Set();
  for (const id of ids) {
    const rec = store.data.players[id]; if (!rec) continue;
    const b = bitsOf(rec.c); for (let i = 0; i < bits.length; i++) bits[i] |= b[i];
    for (const f of rec.f ?? []) found.add(f);
  }
  return { bits, found };
}

// Every 2 seconds: chart the land around each player on the overworld and note places they reach.
let places = null, dirty = false;
function travelTick() {
  places ??= findablePlaces();
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const { x, z } = player.location;
    const rec = (store.data.players[player.id] ??= { c: "", f: [] });
    const bits = bitsOf(rec.c);
    if (chart(bits, x, z)) { rec.c = hexOf(bits); dirty = true; }
    for (const p of places) if (!rec.f.includes(p.id) && Math.hypot(x - p.x, z - p.z) <= p.r + 16) {
      rec.f.push(p.id); dirty = true;
      player.onScreenDisplay.setActionBar(`§6${p.name}§7 is on your hall's map now.`);
    }
  }
}
system.runInterval(() => { if (api.isReady()) travelTick(); }, 40);
system.runInterval(() => { if (dirty) { dirty = false; store.save(); } }, 400);
system.runInterval(() => { places = null; }, 6000); // pick up places the builder marks later

// ---------- what the map shows ----------

/** Pure: everything that stands on the map for a settlement.
 *  plots: [{ name, region, x, z, holder?, npc? }]; keeps: state.keeps; returns [{ kind, name, x, z, ... }] */
export function mapItems({ plots, keeps, owner, found, places: findable = [] }) {
  const items = [];
  const onPlot = new Set();
  for (const p of plots) {
    const k = p.holder && keeps[p.holder];
    if (k) onPlot.add(p.holder);
    items.push(k ? { kind: p.holder === owner ? "yours" : "held", name: p.name, x: p.x, z: p.z, color: api.COLORS[k.color] ?? "white", who: k.name, region: p.region }
      : p.npc ? { kind: "npc", name: p.name, x: p.x, z: p.z, who: p.npc.name, region: p.region }
      : { kind: "plot", name: p.name, x: p.x, z: p.z, region: p.region });
  }
  // settlements raised off the planned plots (the showcase world, or a map without Plot Stones)
  for (const [id, k] of Object.entries(keeps)) if (!onPlot.has(id)) items.push({ kind: id === owner ? "yours" : "held", name: `${k.name}'s settlement`, x: k.x, z: k.z, color: api.COLORS[k.color] ?? "white", who: k.name });
  for (const w of WARDS) if (TOWNS.includes(w.name)) items.push({ kind: "town", name: w.name, x: w.x, z: w.z });
  for (const p of findable) if (found.has(p.id)) items.push({ kind: "place", name: p.name, x: p.x, z: p.z, text: p.text });
  return items;
}

const RANK = { yours: 0, held: 1, npc: 2, town: 3, place: 4, plot: 5 };
const iconOf = (it) => ({ yours: "y_" + it.color, held: "b_" + it.color, npc: "npc", town: "town", place: "place", plot: "plot" })[it.kind];

/** Pure: the 256 cells, row by row from the north-west. Each { tex, text, items }. */
export function mapCells(items, bits) {
  const cells = Array.from({ length: GRID * GRID }, (_, i) => ({ items: [], open: !!has(bits, i) }));
  for (const it of items) { const i = cellOf(it.x, it.z); if (i >= 0) cells[i].items.push(it); }
  return cells.map((c) => {
    c.items.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
    const top = c.items[0];
    const tex = TEX + (top ? iconOf(top) + (c.open ? "" : "_f") : c.open ? "clear" : "fog");
    const text = top ? top.name + (c.items.length > 1 ? ` +${c.items.length - 1}` : "") : " ";
    return { tex, text, items: c.items };
  });
}

const describe = (it) => ({
  yours: `§aYour settlement.§7 ${it.region ? it.region + ". " : ""}Its banner is ${it.color.replace("_", " ")}.`,
  held: `§fHeld by ${it.who}.§7 ${it.region ? it.region + ". " : ""}Banner: ${it.color.replace("_", " ")}.`,
  npc: `§cHeld by ${it.who}, a rival lord.§7 ${it.region ?? ""}`,
  plot: `§7Unclaimed plot in ${it.region}. Click its Plot Stone and raise your banner to claim it.`,
  town: "§7A town. Anyone may trade and rest here.",
  place: `§7${it.text ?? "A place your people have found."}`,
})[it.kind];

/** Open the map of a settlement's hall for a player. */
export function hallMap(player, owner) {
  const keeps = api.getState().keeps;
  const keep = keeps[owner]; if (!keep) return;
  const { bits, found } = knownBy(owner);
  places ??= findablePlaces();
  const plots = allPlots().map((p) => ({ ...p, holder: holderOf(p) }));
  const cells = mapCells(mapItems({ plots, keeps, owner, found, places }), bits);
  const charted = cells.filter((c) => !c.tex.endsWith("fog") && !c.tex.endsWith("_f")).length;
  const form = new ActionFormData().title(`${MAP_FLAG}The Realm, as known to ${keep.name}'s hall`)
    .body(`§7${Math.round((charted / cells.length) * 100)}% charted. Tap a mark to read it.`);
  for (const c of cells) form.button(c.text, c.tex); // exactly GRID x GRID buttons: the screen closes with its own X
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const c = cells[r.selection];
    if (!c) return;
    if (!c.items.length) return hallMap(player, owner);
    const body = c.items.map((it) => `§l${it.name}§r\n${describe(it)}`).join("\n\n");
    new ActionFormData().title("Hall Map").body(body).button("Back to the map").button("Close").show(player)
      .then((r2) => { if (r2.selection === 0) hallMap(player, owner); }).catch(() => {});
  }).catch(() => {});
}

// The hall's Cartographer's Table opens the map instead of the vanilla table.
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player } = event;
  if (block.typeId !== "minecraft:cartography_table" || block.dimension.id !== "minecraft:overworld") return;
  if (player.isSneaking) return; // sneak-click still opens the vanilla table
  const owner = api.settlementAt(block.location);
  if (!owner || !hallStands(owner, block.location)) return;
  event.cancel = true;
  if (event.isFirstEvent === false) return;
  system.run(() => hallMap(player, owner));
});

let hallStands = () => false;
/** townhall.js tells the map how to recognise a table inside a standing hall. */
export const setHallCheck = (fn) => { hallStands = fn; };

api.addTests("hall map", {
  "cells cover the map, row by row from the north-west": () => {
    api.assertEqual(cellOf(-1250, -1250), 0);
    api.assertEqual(cellOf(1249, -1250), GRID - 1);
    api.assertEqual(cellOf(-1250, 1249), GRID * (GRID - 1));
    api.assertEqual(cellOf(1250, 0), -1);
  },
  "walking charts the land around you and survives a save": () => {
    const bits = bitsOf("");
    api.assert(chart(bits, 0, 0), "something new");
    api.assert(!chart(bits, 0, 0), "nothing new the second time");
    const back = bitsOf(hexOf(bits));
    api.assert(has(back, cellOf(0, 0)) && has(back, cellOf(90, 90)), "the cell and its neighbours");
    api.assert(!has(back, cellOf(-1000, -1000)), "far land stays fogged");
  },
  "settlements and towns show through fog, places only once found, players never": () => {
    const keeps = { me: { x: -470, z: -300, name: "Ana", color: 11 }, them: { x: 260, z: -480, name: "Bo", color: 14 } };
    const plots = [{ name: "Harrowford", region: "Aldmere Vale", x: -470, z: -300, holder: "me" }, { name: "Oakmere", region: "Aldmere Vale", x: 260, z: -480, holder: "them" },
      { name: "Wolfcairn", region: "Frostmarch", x: 520, z: -1010, npc: { name: "Lord Hask" } }, { name: "Dunehold", region: "Emberwaste", x: 760, z: 860 }];
    const findable = [{ id: "w:Crownhold", name: "Crownhold", x: -235, z: -345 }, { id: "w:the Ashen Watch", name: "The Ashen Watch", x: 480, z: 560 }];
    const items = mapItems({ plots, keeps, owner: "me", found: new Set(["w:Crownhold"]), places: findable });
    const cells = mapCells(items, bitsOf(""));
    const at = (x, z) => cells[cellOf(x, z)];
    api.assertEqual(cells.length, GRID * GRID);
    api.assert(at(-470, -300).tex.endsWith("y_blue_f"), "your banner, ringed, on fog");
    api.assert(at(260, -480).tex.endsWith("b_red_f"), "theirs in its own colour");
    api.assert(at(520, -1010).tex.endsWith("npc_f") && at(760, 860).tex.endsWith("plot_f"), "rival lord and free plot");
    api.assert(at(-150, -150).tex.endsWith("town_f") && at(-150, -150).text === "Kingsrest", "Kingsrest is a town");
    api.assert(at(-235, -345).tex.endsWith("place_f"), "a found place");
    api.assert(at(480, 560).tex.endsWith("/fog"), "an unfound place stays hidden");
    api.assert(!items.some((i) => i.kind === "player"), "no players");
  },
  "mystery places never go on the map": () => {
    const ids = findablePlaces({ bellhollow: { x: 155, z: 0 }, kings_barrow: { x: 120, z: 520 }, deepforge: { x: 10, z: -900 } }).map((p) => p.id);
    api.assert(ids.includes("p:deepforge"), "charted place listed");
    api.assert(!ids.includes("p:bellhollow") && !ids.includes("p:kings_barrow"), "mysteries left off");
  },
});
