// Job NPCs in the map's towns, so a mapped world can trade from day one without anyone using a command.
//
// The first time a player comes within reach of a town (plots/config.js WARDS) on a mapped world, that town's
// traders (config.js TOWNS) are placed in a ring round its centre, standing on the ground. Each town is placed once:
// a map builder can move or /kill them afterwards and they stay that way.
//   /scriptevent siege:economy_towns            list the towns and whether their traders are placed
//   /scriptevent siege:economy_towns reset <town|all>   forget a town, so its traders are placed again (old ones removed)

import { world, system } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { TOWNS, TOWN_RING, JOBS } from "./config.js";
import { spawnJobNpc } from "./shops.js";

const store = moduleStore("siege:economy_towns", () => ({ placed: {} })); // { placed: { "<town>": day } }
const REACH = 48; // blocks from the centre: close enough that the chunks are loaded
const townTag = (name) => `siege_town_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`;

// Where each trader of a town stands: evenly round a ring, the first one facing the way in from the south
export function townSpots(town, centre, ring = TOWN_RING) {
  return town.jobs.map((jobId, i) => {
    const a = (i / town.jobs.length) * Math.PI * 2;
    return { jobId, x: Math.round(centre.x + Math.sin(a) * ring) + 0.5, z: Math.round(centre.z + Math.cos(a) * ring) + 0.5 };
  });
}

const centreOf = (town) => WARDS.find((w) => w.name === town.name);

function placeTown(dim, town) {
  const centre = centreOf(town);
  if (!centre) return 0;
  let n = 0;
  for (const spot of townSpots(town, centre)) {
    let top;
    try {
      top = dim.getTopmostBlock({ x: Math.floor(spot.x), z: Math.floor(spot.z) });
    } catch {
      return -1; // not loaded yet: try again later
    }
    if (!top) return -1;
    const npc = spawnJobNpc(dim, { x: spot.x, y: top.location.y + 1, z: spot.z }, spot.jobId, town.region);
    if (npc) {
      npc.addTag(townTag(town.name));
      n++;
    }
  }
  return n;
}

onTick("economy_towns", 40, () => {
  if (!mapMode()) return;
  const data = store.data;
  const left = TOWNS.filter((t) => data.placed[t.name] === undefined);
  if (!left.length) return;
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    for (const town of left) {
      const c = centreOf(town);
      if (!c || Math.hypot(player.location.x - c.x, player.location.z - c.z) > REACH) continue;
      if (placeTown(player.dimension, town) < 0) continue;
      data.placed[town.name] = world.getDay();
      store.save();
      console.warn(`[Hollow Crown] economy: traders placed in ${town.name}`);
      return; // one town per pass is plenty
    }
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:economy_towns") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const data = store.data;
  const [verb, ...rest] = event.message.trim().split(/\s+/);
  if (verb === "reset") {
    const named = rest.join(" ").toLowerCase();
    const towns = named === "all" ? TOWNS : TOWNS.filter((t) => t.name.toLowerCase() === named);
    if (!towns.length) return player.sendMessage(`§cWhich town? One of: ${TOWNS.map((t) => t.name).join(", ")}, or all.`);
    for (const town of towns) {
      delete data.placed[town.name];
      for (const e of player.dimension.getEntities({ tags: [townTag(town.name)] })) e.remove();
    }
    store.save();
    return player.sendMessage(`§a${towns.map((t) => t.name).join(", ")}: traders will be placed again when someone comes near.`);
  }
  player.sendMessage(TOWNS.map((t) => `§f${t.name} §7(${t.region}): ${t.jobs.map((j) => JOBS[j].name).join(", ")} ${data.placed[t.name] !== undefined ? "§aplaced" : "§8not yet"}`).join("\n"));
});
