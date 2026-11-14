// Who's online: one screen listing every player in the world, their role and rank, where they are,
// and whether the Hollow's ruler and the High Throne's ruler are here right now.
// (The Hollow's ruler can only be robbed or besieged while online, so this matters.)
//
// Open it from the Town Hall menu, the keep menu, or anywhere with  /scriptevent siege:who
// Other features can add a line under a player's name: listen for "rosterNotes", sent each time the
// screen opens, and call  notes.add(playerId, "text").

import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as api from "../siege/api.js";
import { heroOf } from "./hero.js";
import { ROLES, rankOf } from "./skills.js";
import { hallOf } from "./townhall.js";
import { HALL_TIERS } from "./halls.js";

// who rules what, remembered from the events the Hollow and Crown features send
const store = api.moduleStore("siege:roster", () => ({ warden: null, crown: null, known: {} }));
api.on("wardenChanged", ({ warden, name }) => { const s = store.data; s.warden = warden ? { id: warden, name } : null; store.save(); });
api.on("crowned", ({ ruler, name, title }) => { const s = store.data; s.crown = ruler ? { id: ruler, name, title } : null; store.save(); });
api.on("stormEnd", ({ winner, usurped }) => { if (!usurped) return; const s = store.data; const p = world.getAllPlayers().find((x) => x.id === winner); s.crown = p ? { id: p.id, name: p.name, title: "Sovereign" } : null; store.save(); });

const PLACES = { "minecraft:overworld": "the overworld", "minecraft:nether": "the Nether", "minecraft:the_end": "the End", "siege:undertow": "the Hollow" };

// Pure: turn plain facts into the screen's text. people = [{ id, name, role, rank, level, place, notes }]
export function rosterText(people, rulers = {}) {
  const lines = [];
  const here = (r) => r && people.some((p) => p.id === r.id);
  if (rulers.warden) lines.push(here(rulers.warden) ? `§5The Hollow's ruler, ${rulers.warden.name}, is §aonline§5.` : `§5The Hollow's ruler, ${rulers.warden.name}, is §7away§5.`);
  if (rulers.crown) lines.push(here(rulers.crown) ? `§6${rulers.crown.title} ${rulers.crown.name} is §aonline§6.` : `§6${rulers.crown.title} ${rulers.crown.name} is §7away§6.`);
  lines.push("", `§f${people.length} online`);
  for (const p of [...people].sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name))) {
    const tags = [];
    if (rulers.warden?.id === p.id) tags.push("§5rules the Hollow");
    if (rulers.crown?.id === p.id) tags.push("§6holds the High Throne");
    lines.push(`§a● §f${p.name}§7  ${p.rank ?? p.role ?? "Commoner"}, Renown ${p.level ?? 1}`);
    if (p.settlement) lines.push(`   §7${p.settlement}${p.hall ? ", " + p.hall : ""}`);
    lines.push(`   §8in ${p.place}${tags.length ? "§8, " + tags.join("§8, ") : ""}`);
    for (const n of p.notes ?? []) lines.push(`   §8${n}`);
  }
  return lines.join("\n");
}

// A player's settlement level and hall, in words
function townOf(id) {
  const keep = api.keepOf(id);
  if (!keep) return {};
  const tier = keep.tier ?? api.tierOf(keep)?.name ?? "Hamlet";
  const hall = hallOf(id)?.level;
  return { settlement: `${keep.name ? keep.name + ", " : ""}${tier}`, tier, hall: hall ? HALL_TIERS[hall].name : undefined };
}

// Everyone's levels are remembered, so they can be shown while the player is away (signs, the welcome area...).
//   const q = { playerId }; emit("levelsQuery", q);  ->  q.name, q.level (Renown 1-50), q.role, q.rank,
//   q.settlement ("Ravenhold, Town"), q.tier, q.hall, q.online, and q.handled = true if the player is known.
function remember() {
  const known = store.data.known;
  let changed = false;
  for (const player of world.getAllPlayers()) {
    const { id, notes, place, ...row } = facts(player, new Map());
    const text = JSON.stringify(row);
    if (JSON.stringify(known[id]) !== text) { known[id] = JSON.parse(text); changed = true; }
  }
  if (changed) store.save();
}
api.onTick("roster", 200, remember);
api.on("levelsQuery", (q) => {
  const row = store.data.known[q.playerId];
  if (!row) return;
  Object.assign(q, row, { online: world.getAllPlayers().some((p) => p.id === q.playerId), handled: true });
});

function facts(player, notes) {
  const hero = heroOf(player);
  const role = ROLES[hero.path];
  return {
    id: player.id, name: player.name, level: hero.level ?? 1,
    role: role?.name, rank: role ? rankOf(hero.path, hero.skills ?? {})?.name : undefined,
    place: PLACES[player.dimension.id] ?? "somewhere strange",
    ...townOf(player.id),
    notes: notes.get(player.id),
  };
}

export function rosterMenu(player) {
  const notes = new Map();
  api.emit("rosterNotes", { add: (id, text) => notes.set(id, [...(notes.get(id) ?? []), String(text)]) });
  const people = world.getAllPlayers().map((p) => facts(p, notes));
  new ActionFormData().title("Who's online").body(rosterText(people, store.data)).button("Refresh").button("Close")
    .show(player).then((r) => { if (!r.canceled && r.selection === 0) rosterMenu(player); }).catch(() => {});
}

export const rulers = () => store.data;

// A quiet line for everyone when the Hollow's ruler arrives or leaves
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || !api.isReady()) return;
  if (store.data.warden?.id === player.id) for (const p of world.getAllPlayers()) if (p.id !== player.id) p.sendMessage("§5The Hollow's ruler walks the world again.");
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  if (!api.isReady() || store.data.warden?.id !== playerId) return;
  world.sendMessage("§5The Hollow's ruler has gone. Their realm cannot be robbed or besieged until they return.");
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "siege:who" && event.sourceEntity?.typeId === "minecraft:player" && api.isReady()) rosterMenu(event.sourceEntity);
});

api.addTests("roster", {
  "the roster names who is online and who rules": () => {
    const text = rosterText([{ id: "a", name: "Ada", rank: "Adept", level: 12, place: "the Hollow" }, { id: "b", name: "Bo", level: 3, place: "the overworld" }], { warden: { id: "a", name: "Ada" }, crown: { id: "z", name: "Zed", title: "Sovereign" } });
    api.assert(text.includes("Ada, is §aonline"), "ruler online");
    api.assert(text.includes("Sovereign Zed is §7away"), "sovereign away");
    api.assert(text.includes("2 online") && text.includes("Commoner") && text.includes("rules the Hollow"), "rows");
    api.assert(text.indexOf("Ada§7") < text.indexOf("Bo§7"), "highest Renown first");
    api.assert(!/Hollow/.test(rosterText([], {})), "nothing names the Hollow while no one rules it");
  },
});
