// The world snapshot (Mateo 2026-11-15): before an update, download the Realm world and run
// tools/world_snapshot.py on it for a full report of everyone and everything in it. Bedrock never saves player
// names in the world, and a player's story step is worked out live, so this file keeps a small roster in the world
// itself: every player who has joined, with their name, Regals, mode, settlement, story steps and when they were
// last seen. It is refreshed when they join and leave and every two minutes while they play, so a download always
// carries it, even for players who are offline.
//
// In game: /siege:snapshot (operators, cheats not needed) or /scriptevent siege:snapshot refreshes the roster at
// once and says in chat what the report will show. Then download the world. How-to: docs/WORLD-SNAPSHOT.md.

import { world, system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { moduleStore } from "../core/store.js";
import { onTick } from "../core/loop.js";
import { BUILD } from "../core/build.js";
import { addTests, assertEqual } from "../core/tests.js";
import { funds } from "../economy/api.js";
import { modeOf } from "../newplayer/mode.js";
import { MODE_NAMES } from "../newplayer/mode_rules.js";
import { keepOf, homeOf, tierOf, isReady } from "../siege/api.js";
import { plotOf } from "../plots/api.js";
import { stepsOf } from "../quests/index.js";

export const ROSTER = "siege:snapshot_roster"; // tools/world_snapshot.py reads it by this name
const roster = moduleStore(ROSTER, () => ({ players: {} }));
const REFRESH = 2400; // ticks between refreshes while playing (two minutes)

const strip = (s) => String(s ?? "").replace(/§./g, "").trim();
const day = () => Math.floor(world.getAbsoluteTime() / 24000) + 1;
const safe = (fn) => { try { return fn(); } catch { return undefined; } };

// The settlement line: "Wrenfield (Town)", or a writ ally's "ally of Wrenfield (Town)". Pure, for the test.
export function settlementLine(plot, tier, ally) {
  if (!plot && !tier) return undefined;
  const line = tier ? `${plot ?? "a settlement"} (${tier})` : plot;
  return ally ? `ally of ${line}` : line;
}

function entryOf(player) {
  const home = safe(() => homeOf(player.id)) ?? player.id;
  const keep = safe(() => (isReady() ? keepOf(home) : undefined));
  const plot = safe(() => plotOf(home)?.name);
  const quests = safe(() => stepsOf(player.id)) ?? [];
  const l = player.location;
  return {
    name: player.name,
    regals: safe(() => funds(player)),
    mode: MODE_NAMES[safe(() => modeOf(player))],
    settlement: settlementLine(plot, keep ? safe(() => tierOf(keep)?.name) : undefined, home !== player.id),
    steps: quests.map((q) => strip(q.title)).filter(Boolean),
    dim: player.dimension.id,
    pos: { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) },
    seen: `day ${day()}, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    build: BUILD,
  };
}

function note(player, online = true) {
  const data = roster.data;
  const old = data.players[player.id] ?? {};
  data.players[player.id] = { ...old, ...entryOf(player), online, firstSeen: old.firstSeen ?? `day ${day()}` };
  roster.save();
}

function noteAll() {
  for (const p of world.getAllPlayers()) { try { note(p); } catch { /* mid-respawn or leaving */ } }
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) system.runTimeout(() => { try { note(player); } catch { /* left again */ } }, 100);
});
world.beforeEvents.playerLeave.subscribe(({ player }) => {
  const id = player.id;
  let entry;
  try { entry = entryOf(player); } catch { /* already half gone */ }
  system.run(() => {
    const data = roster.data;
    data.players[id] = { ...(data.players[id] ?? {}), ...(entry ?? {}), online: false };
    roster.save();
  });
});
onTick("snapshot roster", REFRESH, noteAll);

// What the report will show, in chat
function tell(player) {
  noteAll();
  const all = Object.entries(roster.data.players);
  const lines = [`§6World snapshot§r §7(build ${BUILD}, day ${day()}): ${all.length} player${all.length === 1 ? "" : "s"} on record`];
  for (const [, p] of all.sort((a, b) => (b[1].online ? 1 : 0) - (a[1].online ? 1 : 0))) {
    const step = p.steps?.[0] ? `, on "${p.steps[0]}"` : "";
    lines.push(`§f${p.name}§7${p.online ? "" : ` (last seen ${p.seen})`}: ${p.regals ?? 0} Regals, ${p.settlement ?? "no settlement"}${step}`);
  }
  lines.push("§7Saved. Download the world now for the full report (docs/WORLD-SNAPSHOT.md).");
  player.sendMessage(lines.join("\n"));
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "siege:snapshot") return;
  const player = e.sourceEntity;
  if (player?.typeId === "minecraft:player") tell(player);
});

system.beforeEvents.startup.subscribe((e) => {
  const registry = e.customCommandRegistry;
  if (!registry?.registerCommand) return;
  registry.registerCommand(
    { name: "siege:snapshot", description: "Save everyone's progress for a world snapshot", permissionLevel: CommandPermissionLevel.GameDirectors, cheatsRequired: false },
    (origin) => {
      const player = origin.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Run it as a player." };
      system.run(() => { try { tell(player); } catch { /* left meanwhile */ } });
      return { status: CustomCommandStatus.Success };
    },
  );
});

addTests("snapshot", {
  "the roster names a settlement and its level": () => {
    assertEqual(settlementLine("Wrenfield", "Town", false), "Wrenfield (Town)");
    assertEqual(settlementLine("Wrenfield", "Hamlet", true), "ally of Wrenfield (Hamlet)");
    assertEqual(settlementLine(undefined, undefined, false), undefined);
  },
});
