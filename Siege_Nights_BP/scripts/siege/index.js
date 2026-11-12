// Siege Nights: found a settlement with a Keep Banner, build a castle, and hold it against raiders at night.
// Loads every Siege Nights file (each one subscribes its own events) and schedules the repeating work.
// The numbers you might want to tweak are in settings.js; settlement sizes are TIERS in territory.js.

import "./keep.js";
import "./territory.js";
import "./siege.js";
import "./warplan.js";
import "./breachers.js";
import "./walls.js";
import "./collapse.js";
import "./block_clicks.js";
import "./protection.js";
import "./placement.js";
import "./machines.js";
import "./quartermaster.js";
import "./guards.js";
import "./menus.js";
import "./gear.js";
import "./tests.js";
import "./story.js";

import { onTick } from "../core/loop.js";
import { SETTINGS } from "./settings.js";
import { state } from "./state.js";
import { siegeHud, siegeTick } from "./siege.js";
import { guardArmorTick, guardColorTick } from "./gear.js";
import { quartermasterTick } from "./quartermaster.js";
import { guardTick } from "./guards.js";
import { ballistaTick, machineGuardTick } from "./machines.js";
import { borderTick } from "./protection.js";
import { ramTick, sapperTick } from "./breachers.js";

// Same schedule as the original main loop
onTick("siege hud", 20, siegeHud);
onTick("siege", 40, siegeTick);
onTick("guard armor set", 40, guardArmorTick);
onTick("guard armor color", 40, guardColorTick);
onTick("quartermaster", 40, quartermasterTick);
onTick("guards", 40, guardTick);
onTick("ballista", SETTINGS.ballistaReloadTicks, ballistaTick);
onTick("machine protection", 40, machineGuardTick);
onTick("borders", 20, borderTick);
onTick("breachers", 20, () => {
  if (!state.active) return;
  ramTick();
  sapperTick();
});
