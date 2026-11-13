// Floating labels over everything that opens a menu when you click it, so players can tell a menu
// block from a decoration. One shared system: register an asset once and every copy of it in the
// world gets a label whenever a player is close.
//
//   import { addMenuLabel } from "../siege/api.js";       // or "../core/labels.js"
//
//   addMenuLabel({ block: "hc:station_post", name: "Station Post", hint: "Click: trains" });
//   addMenuLabel({ entity: "minecraft:npc", tag: "siege_mason", hint: "Click to trade" });
//   addMenuLabel({ entity: "minecraft:npc", match: (e) => e.hasTag("x") && !e.hasTag("y"), hint: "Click to talk" });
//
// Blocks show two lines (gold name, grey hint). Entities show only the hint, floating above the
// name they already carry. Optional fields:
//   lift     how far above the block's bottom (or the entity's feet) the label sits
//   where    (block) => bool, for a block id that only sometimes opens a menu
//   name     on an entity, adds a name line above the hint (for entities with no nameTag of their own)
//   text     (block or entity) => string | undefined: the whole label for this one, when it has news to show
//            (undefined falls back to name and hint)
//
// How it works: every second, around each player in turn, one native getBlocks() call looks for the
// registered block ids within LABEL.range, and one getEntities() call per registered entity type
// looks for the entities. Each hit gets a tiny invisible siege:label entity whose always-shown name
// is the text. A label nobody has been near for a few seconds (or whose block is gone) is removed,
// so the world never fills up with them. Off switch: /scriptevent siege:labels off.

import { world, system, BlockVolume, BlockTypes } from "@minecraft/server";
import { onTick } from "./loop.js";
import { addTests, assert, assertEqual } from "./tests.js";

export const LABEL_ENTITY = "siege:label";

export const LABEL = {
  range: 10, // blocks around a player, sideways
  up: 5, // blocks above a player's feet
  down: 4, // blocks below
  rescanTicks: 20, // each player's surroundings are looked at this often
  keepTicks: 60, // a label not seen again for this long goes away
  blockLift: 1.05, // label height over a block's bottom corner
  entityLift: 2.25, // label height over an entity's feet (above its own name)
  // Bedrock's NPC is taller (2.1) and its name sits higher, so its label goes above that name, one line higher for
  // each extra line of the name (Mateo's photo 2026-11-13: "Click to talk" was printed over "NPC")
  npcLift: 2.6,
  lineLift: 0.27,
  nameColor: "§6",
  hintColor: "§7",
  entityHintColor: "§e",
};

const OFF_KEY = "siege:labels_off";
const blockSpecs = new Map(); // block id -> [spec]
const entitySpecs = new Map(); // entity id -> [spec]
let searchIds; // block ids for the search, worked out on first use

// ---------- registering ----------

export function addMenuLabel(spec) {
  if (!spec || (!spec.block === !spec.entity)) throw new Error("addMenuLabel: give exactly one of block or entity");
  if (spec.block && !spec.name) throw new Error(`addMenuLabel: ${spec.block} needs a name`);
  const s = { ...spec, hint: spec.hint ?? "Click to open" };
  const map = s.block ? blockSpecs : entitySpecs;
  const id = s.block ?? s.entity;
  const list = map.get(id) ?? [];
  // the same registration twice (a file loaded again, a thread registering what the table has) replaces the old one
  const same = list.findIndex((o) => o.tag === s.tag && o.match === s.match && o.where === s.where);
  if (same >= 0) list[same] = s;
  else list.push(s);
  map.set(id, list);
  searchIds = undefined;
  return s;
}

export const labelledBlocks = () => [...blockSpecs.keys()];
// how high an entity's label sits: over its own name, however many lines that name has
export function entityLiftOf(spec, e) {
  if (spec.lift !== undefined) return spec.lift;
  if (e?.typeId !== "minecraft:npc") return LABEL.entityLift;
  const lines = String(e.nameTag ?? "").split("\n").length;
  return LABEL.npcLift + LABEL.lineLift * (lines - 1);
}
export const labelledEntities = () => [...entitySpecs.keys()];

export function labelText(spec, thing) {
  if (spec.text && thing) {
    try {
      const t = spec.text(thing);
      if (typeof t === "string" && t) return t;
    } catch {}
  }
  if (spec.block) return `${LABEL.nameColor}${spec.name}\n${LABEL.hintColor}${spec.hint}`;
  return spec.name ? `${LABEL.nameColor}${spec.name}\n${LABEL.entityHintColor}${spec.hint}` : `${LABEL.entityHintColor}${spec.hint}`;
}

// The first spec that fits this block or entity (tag, match and where are all optional)
export function specFor(specs, thing) {
  for (const s of specs ?? []) {
    try {
      if (s.tag && !thing.hasTag(s.tag)) continue;
      if (s.match && !s.match(thing)) continue;
      if (s.where && !s.where(thing)) continue;
      return s;
    } catch {}
  }
  return undefined;
}

export function scanBox(at, { min, max }) {
  const x = Math.floor(at.x), y = Math.floor(at.y), z = Math.floor(at.z);
  const lo = { x: x - LABEL.range, y: Math.max(min, y - LABEL.down), z: z - LABEL.range };
  const hi = { x: x + LABEL.range, y: Math.min(max - 1, y + LABEL.up), z: z + LABEL.range };
  return lo.y > hi.y ? undefined : { lo, hi };
}

// ---------- the labels in the world ----------

// Only ids the game knows: one unknown id would make the whole block search fail
const blockSearchIds = () => (searchIds ??= labelledBlocks().filter((id) => { try { return !!BlockTypes.get(id); } catch { return false; } }));

const live = new Map(); // key -> { entity, seen }
const lastScan = new Map(); // player id -> tick
let turn = 0;

const isOff = () => world.getDynamicProperty(OFF_KEY) === true;
const valid = (e) => { try { return !!e?.isValid; } catch { return false; } };
const far = (a, b) => Math.abs(a.x - b.x) > 0.2 || Math.abs(a.y - b.y) > 0.2 || Math.abs(a.z - b.z) > 0.2;

function show(dim, key, at, text) {
  let rec = live.get(key);
  if (rec && !valid(rec.entity)) rec = undefined;
  if (!rec) {
    // after a reload the old label may still be standing there: take it over instead of adding a second
    let ent = dim.getEntities({ type: LABEL_ENTITY, location: at, maxDistance: 0.3 })[0];
    ent ??= dim.spawnEntity(LABEL_ENTITY, at);
    rec = { entity: ent };
    live.set(key, rec);
  } else if (far(rec.entity.location, at)) {
    rec.entity.teleport(at);
  }
  if (rec.entity.nameTag !== text) rec.entity.nameTag = text;
  rec.seen = system.currentTick;
}

function scanAround(player) {
  const dim = player.dimension;
  const box = scanBox(player.location, dim.heightRange ?? { min: -64, max: 320 });
  if (box && blockSearchIds().length) {
    let found;
    try {
      found = dim.getBlocks(new BlockVolume(box.lo, box.hi), { includeTypes: blockSearchIds() }, true);
    } catch {}
    for (const loc of found?.getBlockLocationIterator() ?? []) {
      const block = dim.getBlock(loc);
      const spec = block && specFor(blockSpecs.get(block.typeId), block);
      if (!spec) continue;
      const at = { x: loc.x + 0.5, y: loc.y + (spec.lift ?? LABEL.blockLift), z: loc.z + 0.5 };
      show(dim, `b:${dim.id}:${loc.x},${loc.y},${loc.z}`, at, labelText(spec, block));
    }
  }
  for (const [type, specs] of entitySpecs) {
    let near = [];
    try { near = dim.getEntities({ type, location: player.location, maxDistance: LABEL.range }); } catch {}
    for (const e of near) {
      const spec = specFor(specs, e);
      if (!spec) continue;
      const l = e.location;
      show(dim, `e:${e.id}`, { x: l.x, y: l.y + entityLiftOf(spec, e), z: l.z }, labelText(spec, e));
    }
  }
}

function drop(key) {
  const rec = live.get(key);
  live.delete(key);
  try { if (valid(rec?.entity)) rec.entity.remove(); } catch {}
}

export function clearLabels() {
  for (const key of [...live.keys()]) drop(key);
  sweepStrays(true);
}

// Labels left behind by a crash or an old session: any siege:label we aren't keeping
function sweepStrays(all = false) {
  const keep = new Set([...live.values()].map((r) => { try { return r.entity.id; } catch { return undefined; } }));
  const dims = new Map(world.getAllPlayers().map((p) => [p.dimension.id, p.dimension]));
  for (const dim of dims.values()) {
    for (const e of dim.getEntities({ type: LABEL_ENTITY })) if (all || !keep.has(e.id)) try { e.remove(); } catch {}
  }
}

// One player per run, so the work is spread thin: at most one native block search every 2 ticks
onTick("labels", 2, () => {
  if (isOff()) return;
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  turn = (turn + 1) % players.length;
  const p = players[turn];
  const now = system.currentTick;
  if (now - (lastScan.get(p.id) ?? -LABEL.rescanTicks) < LABEL.rescanTicks) return;
  lastScan.set(p.id, now);
  scanAround(p);
});

onTick("labels_sweep", 20, () => {
  const now = system.currentTick;
  for (const [key, rec] of live) if (now - rec.seen > LABEL.keepTicks || !valid(rec.entity)) drop(key);
});
onTick("labels_strays", 200, () => sweepStrays(isOff()));

world.afterEvents.playerLeave.subscribe(({ playerId }) => lastScan.delete(playerId));

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:labels") return;
  const arg = event.message.trim().toLowerCase();
  const who = event.sourceEntity;
  const say = (m) => (who?.sendMessage ? who.sendMessage(m) : world.sendMessage(m));
  if (arg === "off") {
    world.setDynamicProperty(OFF_KEY, true);
    clearLabels();
    say("§7Menu labels are §coff§7. /scriptevent siege:labels on brings them back.");
  } else if (arg === "on") {
    world.setDynamicProperty(OFF_KEY, undefined);
    say("§7Menu labels are §aon§7.");
  } else {
    say(`§7Menu labels: ${isOff() ? "§coff" : "§aon"}§7, ${live.size} showing. Blocks: ${labelledBlocks().join(", ")}. Entities: ${labelledEntities().join(", ")}.`);
  }
});

// ---------- self-tests ----------

addTests("labels", {
  "a block label is a gold name over a grey hint": () => {
    assertEqual(labelText({ block: "x:y", name: "Stables", hint: "Click: your horses" }), "§6Stables\n§7Click: your horses");
  },
  "an NPC's label sits above its whole name": () => {
    const one = entityLiftOf({ hint: "x" }, { typeId: "minecraft:npc", nameTag: "Mason" });
    const two = entityLiftOf({ hint: "x" }, { typeId: "minecraft:npc", nameTag: "Fair-Warden Bess\n§7Great Horse Fair" });
    assert(one > LABEL.entityLift + 0.3, "an NPC label must clear the NPC's own name");
    assert(two > one, "a two-line name pushes the label up");
    assertEqual(entityLiftOf({ hint: "x" }, { typeId: "siege:job_npc", nameTag: "Smith" }), LABEL.entityLift);
  },
  "an entity label is just the hint, unless it asks for a name": () => {
    assertEqual(labelText({ entity: "minecraft:npc", hint: "Click to trade" }), "§eClick to trade");
    assert(labelText({ entity: "minecraft:npc", name: "Ferry", hint: "Click" }).startsWith("§6Ferry\n"));
  },
  "registering needs a name for blocks and exactly one of block or entity": () => {
    let threw = 0;
    for (const bad of [{}, { block: "x:a" }, { block: "x:a", entity: "x:b", name: "A" }]) try { addMenuLabel(bad); } catch { threw++; }
    assertEqual(threw, 3);
  },
  "tag, match and where pick the right spec": () => {
    const thing = (tags) => ({ hasTag: (t) => tags.includes(t) });
    const specs = [{ tag: "a", hint: "A" }, { match: (e) => e.hasTag("b"), hint: "B" }, { hint: "any" }];
    assertEqual(specFor(specs, thing(["a"])).hint, "A");
    assertEqual(specFor(specs, thing(["b"])).hint, "B");
    assertEqual(specFor(specs, thing([])).hint, "any");
    assertEqual(specFor([{ tag: "a" }], thing([])), undefined);
  },
  "the search box stays inside the world's height": () => {
    const b = scanBox({ x: 0.5, y: 318, z: -3.2 }, { min: -64, max: 320 });
    assertEqual(b.hi.y, 319);
    assertEqual(b.lo.x, -LABEL.range);
    assertEqual(b.lo.z, -4 - LABEL.range);
    assertEqual(scanBox({ x: 0, y: -80, z: 0 }, { min: -64, max: 320 }), undefined);
  },
});
