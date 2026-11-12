// Switches: where two bought lines share track out of a station and then part, the block where they split holds
// both shapes and one at a time is set. Sneak + click it with an empty hand to throw it. A train coming off a branch
// toward the shared track sets it for itself; a train heading into it takes whichever way it is set.

import { world, system, BlockPermutation } from "@minecraft/server";
import { moduleStore } from "../siege/api.js";
import { shapeOf, switchSetting, hasLink, follow, DX, DZ, KINDS } from "./track.js";
import { TRACK, clearAhead } from "./data.js";

// switches: { "dim|x,y,z": { shapes: [{ kind, dir }, ...], set } }
const store = moduleStore("siege:switches", () => ({ switches: {} }));
const keyOf = (dimId, p) => `${dimId}|${p.x},${p.y},${p.z}`;
export const switchAt = (dimId, p) => store.data.switches[keyOf(dimId, p)];

// Two lines meet at p with different shapes: make (or extend) a switch there. `current` is what the block holds now.
export function addSwitch(dimId, p, current, other) {
  const k = keyOf(dimId, p);
  const sw = store.data.switches[k] ?? { shapes: [current], set: 0 };
  const has = (s) => sw.shapes.some((t) => t.kind === s.kind && t.dir === s.dir);
  if (!has(current)) sw.shapes.push(current);
  if (!has(other)) sw.shapes.push(other);
  if (sw.shapes.length < 2) return undefined;
  store.data.switches[k] = sw;
  store.save();
  return sw;
}

function setTo(dim, p, sw, i) {
  const s = sw.shapes[i];
  const block = dim.getBlock(p);
  if (!block || block.typeId !== TRACK) return false;
  block.setPermutation(BlockPermutation.resolve(TRACK, { "siege:kind": s.kind, "siege:dir": s.dir }));
  sw.set = i;
  store.save();
  return true;
}

// Called by the train runner before a train moves: `c` is the cursor at the end of the train that's leading (its
// `to` is the way it's heading). If the next block is a switch, set it so this train runs through. true if it changed.
export function throwFor(dim, c) {
  const x = c.x + DX[c.to], z = c.z + DZ[c.to];
  for (const y of [c.y, c.y + 1, c.y - 1]) {
    const sw = switchAt(dim.id, { x, y, z });
    if (!sw) continue;
    const want = switchSetting(sw.shapes.map((s) => shapeOf(s.kind, s.dir)), sw.set, (c.to + 4) % 8);
    if (want < 0 || want === sw.set) return false;
    try {
      return setTo(dim, { x, y, z }, sw, want);
    } catch {
      return false;
    }
  }
  return false;
}

// A train has another train ahead on its track (`taken`: the blocks other trains stand on). If a switch it is
// heading into, before that train, has another way on that is clear (a passing loop), set it that way. `lead` is
// the cursor at the leading end, `get` the track reader. true if a switch changed.
export function routeAround(dim, lead, get, taken, reach = 24, clear = 56) {
  let c = { ...lead };
  for (let step = 0; step < reach; step++) {
    const shape = get(c.x, c.y, c.z);
    if (!shape) return false;
    const next = follow(c, shape, c.to, get);
    if (!next) return false;
    const from = (c.to + 4) % 8, pos = { x: next.x, y: next.y, z: next.z };
    if (taken.has(`${pos.x},${pos.y},${pos.z}`)) return false; // reached the other train: nothing to choose
    const sw = switchAt(dim.id, pos);
    if (sw) {
      const shapes = sw.shapes.map((s) => shapeOf(s.kind, s.dir));
      for (let i = 0; i < shapes.length; i++) {
        if (i === sw.set || !hasLink(shapes[i], from)) continue;
        const withIt = (x, y, z) => (x === pos.x && y === pos.y && z === pos.z ? shapes[i] : get(x, y, z));
        const entry = { x: pos.x, y: pos.y, z: pos.z, from, to: shapes[i].links[0] === from ? shapes[i].links[1] : shapes[i].links[0], t: 0 };
        if (clearAhead(entry, clear, withIt, taken) !== Infinity) continue;
        try {
          return setTo(dim, pos, sw, i);
        } catch {
          return false;
        }
      }
    }
    c = { x: next.x, y: next.y, z: next.z, from, to: next.shape.links[0] === from ? next.shape.links[1] : next.shape.links[0], t: 0 };
  }
  return false;
}

const NAMES = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== TRACK || itemStack || !player.isSneaking) return;
  const sw = switchAt(block.dimension.id, block.location);
  if (!sw) return;
  event.cancel = true;
  if (event.isFirstEvent === false) return;
  system.run(() => {
    if (!block.isValid) return;
    const i = (sw.set + 1) % sw.shapes.length;
    if (!setTo(block.dimension, block.location, sw, i)) return;
    const s = shapeOf(sw.shapes[i].kind, sw.shapes[i].dir);
    player.onScreenDisplay.setActionBar(`§6Switch set: ${KINDS[s.kind]}, ${NAMES[s.links[0]]} to ${NAMES[s.links[1]]}`);
  });
});
