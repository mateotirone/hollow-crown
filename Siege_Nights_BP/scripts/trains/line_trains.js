// Line trains in the game: every line with laid track has its own train that runs end to end and back by itself,
// standing 20 seconds at each stop. Anyone may ride it, free. While nobody is near, it runs unseen (a position
// that moves along the line); when a player comes near where it is, the real train appears there and carries on.
// The rules and the driving: line_service.js. The runner asks pilotFor() every tick (index.js setPilot).

import { world, system } from "@minecraft/server";
import { onTick, isReady, moduleStore } from "../siege/api.js";
import { LINE, chainsOf, newService, stepUnseen, indexNear, pilot } from "./line_service.js";
import { ROUTES } from "./routes_data.js";
import { builtRoutes } from "./route_game.js";
import { placeEngine, addCoach, removeTrains, trainById, setPilot } from "./index.js";
import { TRACK, trainLength } from "./data.js";
import { yawOf } from "./track.js";

// services: { [line]: { pos, dir, dwell, trainId?, idle? } }
const store = moduleStore("siege:line_trains", () => ({ services: {} }));
const OVERWORLD = "minecraft:overworld";
const stopName = (id) => ROUTES.stops.find((s) => s.id === id)?.name ?? id;

let chains = [], chainsFor = -1;
function currentChains() {
  const n = Object.keys(builtRoutes()).length;
  if (n !== chainsFor) { chains = chainsOf(ROUTES, builtRoutes()); chainsFor = n; }
  return chains;
}
const chainOf = (line) => currentChains().find((c) => c.line === line);
const half = () => trainLength(LINE.cars.map((kind) => ({ kind }))) / 2;

function playersNear(p, range) {
  return world.getAllPlayers().some((pl) => pl.dimension.id === OVERWORLD && Math.hypot(pl.location.x - p.x, pl.location.z - p.z) <= range);
}

// The runner's question each tick: how should this line train drive?
function pilotFor(train) {
  const svc = store.data.services[train.line], chain = chainOf(train.line);
  if (!svc || !chain || svc.trainId !== train.id) return undefined;
  const headAt = indexNear(chain, svc.headAt ?? svc.pos, train.head.x, train.head.z);
  svc.headAt = headAt;
  const out = pilot(svc, chain, headAt - (svc.facing ?? 1) * half(), train.v);
  // the train was put down facing up the line or down it: turn the line's direction into the train's own
  const dir = out.dir * (svc.facing ?? 1);
  if (out.arrived !== undefined) announce(chain, svc, out.arrived, train);
  return { dir, throttle: out.throttle, limit: out.limit };
}
setPilot(pilotFor);

function announce(chain, svc, k, train) {
  const here = stopName(chain.stops[k]);
  const next = chain.stops[k + svc.dir];
  const text = next ? `§6${chain.line}: ${here}. Next stop ${stopName(next)}.` : `§6${chain.line}: ${here}.`;
  for (const pl of world.getAllPlayers()) {
    if (pl.dimension.id === OVERWORLD && Math.hypot(pl.location.x - train.head.x, pl.location.z - train.head.z) <= 32) pl.onScreenDisplay.setActionBar(text);
  }
}

// Put the real train on the track where the unseen one has got to. false if the ground isn't loaded or there's no track.
function appear(chain, svc) {
  const dim = world.getDimension(OVERWORLD);
  const i = Math.max(0, Math.min(chain.path.length - 1, Math.round(svc.pos)));
  const at = chain.path[i], toward = chain.path[Math.min(chain.path.length - 1, i + 1)], from = chain.path[Math.max(0, i - 1)];
  let block;
  try {
    block = dim.getBlock(at);
  } catch {
    return false;
  }
  if (!block || block.typeId !== TRACK) return false;
  const yaw = yawOf({ x: from.x, z: from.z }, { x: toward.x, z: toward.z });
  const train = placeEngine(dim, at, yaw, 0, undefined, undefined, { line: chain.line }, LINE.cars[0]);
  if (!train) return false;
  for (const kind of LINE.cars.slice(1)) if (kind === "coach") addCoach(train, dim, true);
  // which way did it end up facing: up the line (toward higher path indexes) or down it?
  const ahead = { x: train.head.x + Math.sign(toward.x - from.x), z: train.head.z + Math.sign(toward.z - from.z) };
  const hi = indexNear(chain, i, train.head.x, train.head.z);
  svc.facing = indexNear(chain, hi + 1, ahead.x, ahead.z, 3) >= hi ? 1 : -1;
  svc.headAt = hi;
  svc.trainId = train.id;
  svc.idle = 0;
  return true;
}

function tick() {
  if (!isReady()) return;
  const services = store.data.services, live = currentChains();
  let changed = false;
  for (const line of Object.keys(services)) {
    if (live.some((c) => c.line === line)) continue;
    removeTrains((t) => t.line === line);
    delete services[line];
    changed = true;
  }
  for (const chain of live) {
    const svc = (services[chain.line] ??= newService());
    if (svc.trainId !== undefined) {
      const train = trainById(svc.trainId);
      if (!train) { svc.trainId = undefined; continue; }
      if (playersNear(train.head, LINE.sleep)) { svc.idle = 0; continue; }
      svc.idle = (svc.idle ?? 0) + 20;
      if (svc.idle < LINE.sleepAfter) continue;
      removeTrains((t) => t.id === svc.trainId); // back to running unseen from where it stands
      svc.trainId = undefined;
      svc.headAt = undefined;
      changed = true;
      continue;
    }
    stepUnseen(svc, chain, 20);
    const at = chain.path[Math.max(0, Math.min(chain.path.length - 1, Math.round(svc.pos)))];
    if (playersNear(at, LINE.wake)) {
      try {
        if (appear(chain, svc)) changed = true;
      } catch (e) {
        console.warn(`[Hollow Crown] line train: ${e}`);
      }
    }
  }
  if (changed || world.getAllPlayers().length) store.save();
}
onTick("line_trains", 20, tick);

// A car left behind in ground that wasn't loaded when its train was put away: gone the moment it loads
world.afterEvents.entityLoad?.subscribe(({ entity }) => {
  try {
    if (!entity.typeId.startsWith("siege:train_") || !isReady()) return;
    const id = entity.getDynamicProperty("siege:train");
    if (id !== undefined && !trainById(id)) entity.remove();
  } catch {
    // went away again
  }
});

// /scriptevent siege:trains lines: where every line's train is
export function lineReport() {
  return currentChains().map((c) => {
    const s = store.data.services[c.line];
    if (!s) return `${c.line}: no service yet`;
    const k = c.at.reduce((b, i, n) => (Math.abs(i - s.pos) < Math.abs(c.at[b] - s.pos) ? n : b), 0);
    return `${c.line}: ${s.trainId !== undefined ? "on the track" : "unseen"} near ${stopName(c.stops[k])}, heading ${s.dir > 0 ? stopName(c.stops.at(-1)) : stopName(c.stops[0])}${s.dwell > 0 ? " (standing)" : ""}`;
  });
}
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: p }) => {
  if (id !== "siege:trains" || message.trim() !== "lines" || p?.typeId !== "minecraft:player") return;
  const lines = lineReport();
  p.sendMessage(lines.length ? "§6" + lines.join("\n§6") : "§7No line has track laid yet, so no line trains are running.");
});
