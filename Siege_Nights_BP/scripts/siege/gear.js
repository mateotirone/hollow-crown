// Player gear: weapons, the Castle Guard armor set bonus, and armor cloth color.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, EquipmentSlot, GameMode } from "@minecraft/server";
import { COLORS, DYE_RGB, GUARD_SET, WEAPONS } from "./constants.js";
import { state } from "./state.js";
import { sfx } from "../core/sfx.js";

// ---------- Weapons: durability, and the warhammer staggers what it hits ----------

world.afterEvents.entityHitEntity.subscribe((event) => {
  const player = event.damagingEntity;
  if (player.typeId !== "minecraft:player") return;
  const gear = player.getComponent("minecraft:equippable");
  const weapon = gear?.getEquipment(EquipmentSlot.Mainhand);
  if (!weapon || !WEAPONS.includes(weapon.typeId)) return;

  if (weapon.typeId === "siege:warhammer") {
    try {
      event.hitEntity.addEffect("slowness", 40, { amplifier: 1 });
    } catch {
      // target already gone
    }
  }

  if (player.getGameMode() === GameMode.Creative) return;
  const durability = weapon.getComponent("minecraft:durability");
  if (!durability) return;
  if (durability.damage + 1 >= durability.maxDurability) {
    gear.setEquipment(EquipmentSlot.Mainhand, undefined);
    sfx(player, "random.break");
  } else {
    durability.damage += 1;
    gear.setEquipment(EquipmentSlot.Mainhand, weapon);
  }
});

// ---------- Castle Guard armor: full set bonus during sieges ----------


export function guardArmorTick() {
  if (!state.active) return;
  for (const player of world.getPlayers()) {
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) continue;
    const fullSet = Object.entries(GUARD_SET).every(([slot, id]) => gear.getEquipment(slot)?.typeId === id);
    if (fullSet) player.addEffect("resistance", 60, { amplifier: 0, showParticles: false });
  }
}

export function guardColorTick() {
  for (const player of world.getPlayers()) {
    const keep = state.keeps[player.id];
    if (!keep) continue;
    const [r, g, b] = DYE_RGB[COLORS[keep.color ?? 14]];
    const want = { red: r / 255, green: g / 255, blue: b / 255 };
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) continue;
    for (const [slot, id] of Object.entries(GUARD_SET)) {
      const item = gear.getEquipment(slot);
      if (item?.typeId !== id) continue;
      try {
        const dye = item.getComponent("minecraft:dyeable");
        const c = dye?.color;
        if (!dye || (c && Math.abs(c.red - want.red) < 0.01 && Math.abs(c.green - want.green) < 0.01 && Math.abs(c.blue - want.blue) < 0.01)) continue;
        dye.color = want;
        gear.setEquipment(slot, item);
      } catch {
        // dye colors not supported on this version; armor stays crimson
      }
    }
  }
}
