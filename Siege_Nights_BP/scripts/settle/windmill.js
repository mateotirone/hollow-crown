// The settlement windmill (Mateo, 2026-11-15: "fix the windmill system and also rebuild each region's windmill").
//
// Every settlement layout has one windmill site (towns_data.js fixture "windmill", found by
// map/structures/windmill_sites.py beside the Town field, or on the nearest open ground of the Town band where the
// field has no room). When the town lays out that tier (founding.js emits settleFixture), the mill rises in the
// town's region style (windmill_data.js, the building skill's `windmill` part from map/structures/windmill_skill.py):
// a round tower with its sails behind it (or to one side where only that fits), a mill inside on every floor, lit.
// Its walk to the path is paved 3 wide (every door path paved to the door). Towns that reached the tier before the
// windmill existed get theirs on the next check (every 10 s while the owner is online).
//
// The design's frame: the door's front step at (0, 1, 0), +z into the mill (the plot buildings' frame).
//
// What other features can use:
//   windmillOf(owner) -> { origin, forward, region, sails, built } | undefined
//   on("windmillBuilt", ({ owner }))
// Test: /scriptevent siege:windmill [info | raise]

import { world, system } from "@minecraft/server";
import { on, emit, onTick, isReady, moduleStore } from "../siege/api.js";
import { startBuild, buildFor } from "../townhall/build.js";
import { townOf, layoutOf, allTowns } from "./founding.js";
import { windmillRegion, windmillFixture, windmillPlan, windmillSpot } from "./windmill_rules.js";

const OVERWORLD = "minecraft:overworld";
const PER_TICK = 40; // blocks a rising windmill places per tick
const store = moduleStore("siege:windmill", () => ({ towns: {} })); // owner -> { built, origin, forward, region, sails }

export const windmillOf = (owner) => store.data.towns[owner];

// Raise the town's windmill if its tier is laid out and it isn't up (or rising) yet
export function raiseWindmill(owner, { force = false } = {}) {
  const town = townOf(owner);
  const layout = town && layoutOf(town);
  const f = layout && windmillFixture(layout);
  if (!f) return false;
  if (!force && !town.laid?.[f.tier]) return false;
  const mine = store.data.towns[owner];
  if (!force && (mine?.built || buildFor(`windmill:${owner}`))) return false;
  const { origin, forward, walk } = windmillSpot(town, f);
  const region = windmillRegion(town.style);
  const plan = windmillPlan(region, f.sails ?? "back", walk);
  store.data.towns[owner] = { built: false, origin, forward, region, sails: f.sails ?? "back" };
  store.save();
  startBuild({
    id: `windmill:${owner}`, dimensionId: OVERWORLD, origin, forward, plan, style: plan.style, perTick: PER_TICK, anyOrigin: true,
    onDone: () => {
      const m = store.data.towns[owner];
      if (m) { m.built = true; store.save(); }
      emit("windmillBuilt", { owner });
    },
  });
  return true;
}

// founding.js hands the fixture over when the tier it opens with is laid out
on("settleFixture", ({ owner, kind }) => {
  if (kind !== "windmill") return;
  system.runTimeout(() => { try { raiseWindmill(owner); } catch (e) { console.warn(`[Hollow Crown] windmill: ${e}`); } }, 20);
});

// Towns that reached the tier before windmills were raised (or whose build was cut off by a restart)
onTick("windmill", 200, () => {
  if (!isReady()) return;
  for (const p of world.getPlayers()) {
    const town = allTowns()[p.id];
    if (!town) continue;
    try { raiseWindmill(p.id); } catch (e) { console.warn(`[Hollow Crown] windmill tick: ${e}`); }
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:windmill") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || !isReady()) return;
  const cmd = event.message.trim() || "info";
  if (cmd === "raise") {
    const ok = raiseWindmill(player.id, { force: true });
    return player.sendMessage(ok ? "§7Windmill: rising." : "§7Windmill: this town's layout has no windmill site.");
  }
  const m = windmillOf(player.id);
  const town = townOf(player.id);
  const f = town && windmillFixture(layoutOf(town));
  player.sendMessage(m ? `§7Windmill (${m.region}, sails ${m.sails}) ${m.built ? "standing" : "rising"} at ${m.origin.x} ${m.origin.y} ${m.origin.z}.`
    : f ? `§7Windmill: opens with tier ${f.tier} at ${town.x + f.x} ${town.z + f.z}.` : "§7No windmill site.");
});
