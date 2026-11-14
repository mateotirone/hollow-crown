import { addTests, assert, assertEqual } from "../core/tests.js";
import { EATING, fastHeal } from "./data.js";

addTests("eating", {
  "a full bar with saturation heals half a heart for 1.5 saturation": () => {
    assertEqual(fastHeal({ hunger: 20, saturation: 12, health: 10, max: 20 }), { heal: 1, cost: 1.5 });
  },
  "no fast healing on a bar that isn't full, with no saturation, at full health or when dead": () => {
    assertEqual(fastHeal({ hunger: 19, saturation: 12, health: 10, max: 20 }), null);
    assertEqual(fastHeal({ hunger: 20, saturation: 0, health: 10, max: 20 }), null);
    assertEqual(fastHeal({ hunger: 20, saturation: 12, health: 20, max: 20 }), null);
    assertEqual(fastHeal({ hunger: 20, saturation: 12, health: 0, max: 20 }), null);
  },
  "the last scrap of saturation heals its share and never overfills": () => {
    const last = fastHeal({ hunger: 20, saturation: 0.75, health: 10, max: 20 });
    assertEqual(last, { heal: 0.5, cost: 0.75 });
    assertEqual(fastHeal({ hunger: 20, saturation: 12, health: 19.5, max: 20 }).heal, 0.5);
  },
  "a steak on a full bar is worth about four hearts in four seconds": () => {
    let s = { hunger: 20, saturation: 12.8, health: 4, max: 20 }, ticks = 0;
    for (let step; (step = fastHeal(s)); ticks += EATING.every) s = { ...s, saturation: s.saturation - step.cost, health: s.health + step.heal };
    assert(s.health - 4 > 8 && s.health - 4 < 9, `healed ${s.health - 4}`);
    assert(ticks <= 100, `took ${ticks} ticks`);
  },
});
