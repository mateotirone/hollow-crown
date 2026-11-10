// A saved JSON blob for one feature, kept in its own world dynamic property.
//
//   const horses = moduleStore("siege:horses", () => ({ bloodlines: {} }));
//   horses.data.bloodlines[id] = ...;   // loads on first use (only after the world is ready)
//   horses.save();
//
// Every store is stamped with a version (data._v, starting at 1) so old worlds can be upgraded.
// When you change the SHAPE of saved data (rename or restructure a field), raise the version and
// say how to bring old data forward. Adding a new field with a default needs no version bump.
//
//   const horses = moduleStore("siege:horses", () => ({ lines: {} }), {
//     version: 2,
//     upgrade(data, from) {                      // called once per old world, with the version it was saved at
//       if (from < 2) { data.lines = data.bloodlines ?? {}; delete data.bloodlines; }
//       return data;
//     },
//   });
//
// One dynamic property holds about 32 KB of text. Split big data across several stores.

import { world } from "@minecraft/server";
import { addTests, assert, assertEqual, isTesting } from "./tests.js";

const stores = new Map(); // property -> version, for the self-test report

// Bring saved data up to the current version. Pure, so it can be tested anywhere.
export function migrate(saved, defaults, version, upgrade, property = "store") {
  if (!saved) return { ...defaults(), _v: version };
  let data = saved;
  const from = data._v ?? 1;
  if (from < version) data = upgrade(data, from) ?? data;
  else if (from > version) console.warn(`[Hollow Crown] ${property} was saved by a newer version of the pack (v${from}, this pack reads v${version}).`);
  return { ...defaults(), ...data, _v: Math.max(from, version) };
}

export function moduleStore(property, defaults = () => ({}), { version = 1, upgrade } = {}) {
  if (version > 1 && typeof upgrade !== "function") {
    throw new Error(`moduleStore("${property}") is at version ${version} but has no upgrade(data, from) step for older worlds`);
  }
  if (stores.has(property)) throw new Error(`moduleStore("${property}") is created twice; two files would overwrite each other's saves`);
  stores.set(property, version);
  let data;
  return {
    get data() {
      if (data === undefined) {
        const saved = world.getDynamicProperty(property);
        data = migrate(saved ? JSON.parse(saved) : undefined, defaults, version, upgrade, property);
      }
      return data;
    },
    save() {
      if (data === undefined || isTesting()) return;
      world.setDynamicProperty(property, JSON.stringify(data));
    },
  };
}

export const storeVersions = () => Object.fromEntries(stores);

addTests("core", {
  "a new store starts at the current version": () => {
    assertEqual(migrate(undefined, () => ({ a: 1 }), 3, (d) => d), { a: 1, _v: 3 });
  },
  "old saves without a version count as version 1 and keep their data": () => {
    assertEqual(migrate({ a: 5 }, () => ({ a: 1, b: 2 }), 1), { a: 5, b: 2, _v: 1 });
  },
  "old saves are upgraded once, from the version they were saved at": () => {
    const seen = [];
    const upgrade = (d, from) => { seen.push(from); d.lines = d.bloodlines; delete d.bloodlines; return d; };
    assertEqual(migrate({ bloodlines: { x: 1 } }, () => ({ lines: {} }), 2, upgrade), { lines: { x: 1 }, _v: 2 });
    assertEqual(migrate({ lines: { y: 1 }, _v: 2 }, () => ({ lines: {} }), 2, upgrade), { lines: { y: 1 }, _v: 2 });
    assertEqual(seen, [1]);
  },
  "a version bump without an upgrade step is refused": () => {
    let refused = false;
    try {
      moduleStore("test:no_upgrade", () => ({}), { version: 2 });
    } catch {
      refused = true;
    }
    assert(refused);
  },
});
