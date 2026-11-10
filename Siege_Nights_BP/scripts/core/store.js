// A saved JSON blob for one feature, kept in its own world dynamic property.
//
//   const horses = moduleStore("siege:horses", () => ({ bloodlines: {} }));
//   horses.data.bloodlines[id] = ...;   // loads on first use (only after the world is ready)
//   horses.save();
//
// One dynamic property holds about 32 KB of text. Split big data across several stores.

import { world } from "@minecraft/server";
import { isTesting } from "./tests.js";

export function moduleStore(property, defaults = () => ({})) {
  let data;
  return {
    get data() {
      if (data === undefined) {
        const saved = world.getDynamicProperty(property);
        data = saved ? { ...defaults(), ...JSON.parse(saved) } : defaults();
      }
      return data;
    },
    save() {
      if (data === undefined || isTesting()) return;
      world.setDynamicProperty(property, JSON.stringify(data));
    },
  };
}
