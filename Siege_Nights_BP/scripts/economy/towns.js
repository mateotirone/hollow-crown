// Job NPCs in the map's towns, so a mapped world can trade from day one without anyone using a command.
//
// The first time a player comes within reach of a town (plots/config.js WARDS) on a mapped world, that town's
// traders (config.js TOWNS) are placed in a ring round its centre, standing on the ground, except a job the town gives
// an exact spot (`at`: the Moneyer behind the counter of his house on the square, 2026-11-14), and the town's trade
// signs (`signs`) get their words. Each trader is placed once: a map builder can move or /kill them afterwards and
// they stay that way. A job added to a town after its traders were placed (the Moneyers) is placed on its own.
//   /scriptevent siege:economy_towns            list the towns and whether their traders are placed
//   /scriptevent siege:economy_towns reset <town|all>   forget a town, so its traders are placed again (old ones removed)

import { world, system, SignSide } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { moduleStore } from "../core/store.js";
import { WARDS } from "../plots/config.js";
import { mapMode } from "../plots/claims.js";
import { TOWNS, TOWN_RING, JOBS } from "./config.js";
import { spawnJobNpc } from "./shops.js";

const store = moduleStore("siege:economy_towns", () => ({ placed: {}, jobs: {} })); // { placed: { "<town>": day }, jobs: { "<town>": [jobId] } }
const REACH = 48; // blocks from the centre: close enough that the chunks are loaded
const townTag = (name) => `siege_town_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`;

// Where each trader of a town stands: evenly round a ring, the first one facing the way in from the south; a job with
// an exact spot (`at`) stands there instead and keeps out of the ring
export function townSpots(town, centre, ring = TOWN_RING) {
  const round = town.jobs.filter((j) => !town.at?.[j]);
  return [
    ...round.map((jobId, i) => {
      const a = (i / round.length) * Math.PI * 2;
      return { jobId, x: Math.round(centre.x + Math.sin(a) * ring) + 0.5, z: Math.round(centre.z + Math.cos(a) * ring) + 0.5 };
    }),
    ...town.jobs.filter((j) => town.at?.[j]).map((jobId) => ({ jobId, x: town.at[jobId].x + 0.5, z: town.at[jobId].z + 0.5 })),
  ];
}

const centreOf = (town) => WARDS.find((w) => w.name === town.name);

// The jobs a town already has: what was placed, or for a town placed before this was kept, every job but the ones
// with an exact spot (those came later)
const placedJobs = (data, town) => data.jobs?.[town.name] ?? (data.placed[town.name] === undefined ? [] : town.jobs.filter((j) => !town.at?.[j]));

function loaded(dim, x, z) {
  try {
    return !!dim.getTopmostBlock({ x: Math.floor(x), z: Math.floor(z) });
  } catch {
    return false;
  }
}

// Place the town's traders not yet placed. Returns the jobs placed, or undefined when the ground isn't loaded yet.
function placeTown(dim, town, have = []) {
  const centre = centreOf(town);
  if (!centre) return [];
  const todo = townSpots(town, centre).filter((s) => !have.includes(s.jobId));
  const where = [];
  for (const spot of todo) {
    const at = town.at?.[spot.jobId];
    if (at) {
      if (!loaded(dim, at.x, at.z)) return undefined;
      where.push({ spot, loc: { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, yaw: at.yaw });
      continue;
    }
    let top;
    try {
      top = dim.getTopmostBlock({ x: Math.floor(spot.x), z: Math.floor(spot.z) });
    } catch {
      return undefined; // not loaded yet: try again later
    }
    if (!top) return undefined;
    where.push({ spot, loc: { x: spot.x, y: top.location.y + 1, z: spot.z } });
  }
  for (const { spot, loc, yaw } of where) {
    const npc = spawnJobNpc(dim, loc, spot.jobId, town.region);
    if (!npc) continue;
    npc.addTag(townTag(town.name));
    if (yaw !== undefined) {
      try {
        npc.setRotation({ x: 0, y: yaw });
      } catch {
        // facing is optional
      }
    }
  }
  for (const s of town.signs ?? []) {
    try {
      const sign = dim.getBlock({ x: s.x, y: s.y, z: s.z })?.getComponent("minecraft:sign");
      if (!sign) continue;
      sign.setText(s.text, SignSide.Front);
      sign.setText(s.text, SignSide.Back);
      sign.setWaxed(true);
    } catch {
      // a sign moved or gone: the trader still stands
    }
  }
  return [...have, ...todo.map((s) => s.jobId)];
}

onTick("economy_towns", 40, () => {
  if (!mapMode()) return;
  const data = store.data;
  data.jobs ??= {};
  const left = TOWNS.filter((t) => t.jobs.some((j) => !placedJobs(data, t).includes(j)));
  if (!left.length) return;
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    for (const town of left) {
      const c = centreOf(town);
      if (!c || Math.hypot(player.location.x - c.x, player.location.z - c.z) > REACH) continue;
      const jobs = placeTown(player.dimension, town, placedJobs(data, town));
      if (!jobs) continue;
      if (data.placed[town.name] === undefined) data.placed[town.name] = world.getDay();
      data.jobs[town.name] = jobs;
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
      if (data.jobs) delete data.jobs[town.name];
      for (const e of player.dimension.getEntities({ tags: [townTag(town.name)] })) e.remove();
    }
    store.save();
    return player.sendMessage(`§a${towns.map((t) => t.name).join(", ")}: traders will be placed again when someone comes near.`);
  }
  player.sendMessage(TOWNS.map((t) => `§f${t.name} §7(${t.region}): ${t.jobs.map((j) => JOBS[j].name).join(", ")} ${t.jobs.every((j) => placedJobs(data, t).includes(j)) ? "§aplaced" : data.placed[t.name] !== undefined ? "§eplaced, some new" : "§8not yet"}`).join("\n"));
});
