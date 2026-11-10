// Omens you can see and hear. Each hour line of a siege evening (rules.js HOUR_LINES) has an act here that
// happens in the world around a player who is inside a settlement: animals turn, flames lean, doors shut.
// The line still shows, as the backup. Everything is cosmetic and wrapped, so a failed act costs nothing.
//
// Sounds are vanilla for now and all live in SOUNDS, so the sounds thread can swap in its own.

import { system } from "@minecraft/server";

export const SOUNDS = {
  bell: ["block.bell.hit", { volume: 0.25, pitch: 0.5 }], // far off
  hum: ["siege.choir.hum", { volume: 0.5, pitch: 0.9 }],
  creak: ["open.wooden_door", { volume: 0.7, pitch: 0.45 }],
  shut: ["close.wooden_door", { volume: 0.8, pitch: 0.8 }],
  tick: ["note.hat", { volume: 0.35, pitch: 0.6 }],
  voice: ["mob.villager.haggle", { volume: 0.6, pitch: 1 }],
  whine: ["mob.wolf.whine", { volume: 0.8, pitch: 1 }],
  arrows: ["armor.equip_chain", { volume: 0.4, pitch: 1.4 }],
  cellar: ["ambient.cave", { volume: 0.5, pitch: 0.7 }],
  water: ["bucket.fill_water", { volume: 0.2, pitch: 1.6 }],
  small: ["mob.rabbit.hurt", { volume: 0.5, pitch: 1.3 }],
  gutter: ["random.fizz", { volume: 0.25, pitch: 0.6 }],
};

const PETS = ["minecraft:wolf", "minecraft:cat", "minecraft:ocelot", "minecraft:fox"];
const LIVESTOCK = ["minecraft:cow", "minecraft:sheep", "minecraft:pig", "minecraft:chicken", "minecraft:horse", "minecraft:donkey",
  "minecraft:mule", "minecraft:goat", "minecraft:llama", "minecraft:mooshroom", "minecraft:camel", "minecraft:rabbit"];
const GUARDS = ["siege:archer", "siege:man_at_arms", "minecraft:iron_golem"];
const RANGE = 24; // how far from the player an omen reaches
const SCAN = { across: 7, up: 4, most: 12 }; // blocks searched for flames, water and doors, and how many are used

const sound = (player, key, at) => {
  try { player.playSound(SOUNDS[key][0], at ? { ...SOUNDS[key][1], location: at } : SOUNDS[key][1]); } catch { /* cosmetic */ }
};
const later = (ticks, fn) => system.runTimeout(() => { try { fn(); } catch { /* the player left, or the place unloaded */ } }, ticks);
const near = (player, types) => {
  try { return player.dimension.getEntities({ location: player.location, maxDistance: RANGE }).filter((e) => types.includes(e.typeId)); } catch { return []; }
};
const particle = (player, id, at) => { try { player.dimension.spawnParticle(id, at); } catch { /* not loaded */ } };
const isFlame = (id) => /torch|lantern|campfire|candle/.test(id);
const isDoor = (id) => id.endsWith("_door");

// Blocks around the player that match, nearest layers first, at most SCAN.most of them
function blocksNear(player, match) {
  const found = [];
  const { x, y, z } = player.location;
  for (let dy = -2; dy <= SCAN.up && found.length < SCAN.most; dy++) {
    for (let dx = -SCAN.across; dx <= SCAN.across && found.length < SCAN.most; dx++) {
      for (let dz = -SCAN.across; dz <= SCAN.across && found.length < SCAN.most; dz++) {
        try {
          const block = player.dimension.getBlock({ x: Math.floor(x) + dx, y: Math.floor(y) + dy, z: Math.floor(z) + dz });
          if (block && match(block.typeId, block)) found.push(block);
        } catch { /* outside the world or not loaded */ }
      }
    }
  }
  return found;
}

// Turn a creature to look at a spot and hold it there for a few seconds
function face(entity, spot, ticks = 160) {
  try {
    entity.teleport(entity.location, { facingLocation: { x: spot.x, y: entity.location.y + 1, z: spot.z } });
    entity.addEffect("slowness", ticks, { amplifier: 6, showParticles: false });
  } catch { /* gone */ }
}

// ctx: { wall: a point at the wall the omens point to tonight, away: unit vector from that wall toward the keep }
export const ACTS = {
  pets_hide(player, { away }) {
    for (const pet of near(player, PETS)) {
      try {
        pet.applyImpulse({ x: away.x * 0.9, y: 0.25, z: away.z * 0.9 });
        pet.addEffect("slowness", 200, { amplifier: 3, showParticles: false });
      } catch { /* gone */ }
    }
    sound(player, "whine");
  },
  stillness(player) {
    try { player.runCommand("stopsound @s"); } catch { /* cosmetic */ }
    later(40, () => player.runCommand("stopsound @s"));
  },
  humming(player, { wall }) { sound(player, "hum", wall); },
  torches_lean(player, { away }) {
    const flames = blocksNear(player, isFlame);
    for (let step = 0; step < 6; step++) {
      later(step * 8, () => {
        for (const b of flames) {
          for (let k = 1; k <= 3; k++) particle(player, "minecraft:basic_flame_particle", { x: b.x + 0.5 + away.x * 0.22 * k, y: b.y + 0.75 + 0.05 * k, z: b.z + 0.5 + away.z * 0.22 * k });
        }
      });
    }
  },
  far_bell(player, { wall }) { sound(player, "bell", wall); },
  animals_face(player, { wall }) { for (const beast of near(player, LIVESTOCK)) face(beast, wall); },
  gate_creak(player, { wall }) { sound(player, "creak", wall); },
  ticking(player, { wall }) { for (let beat = 0; beat < 8; beat++) later(beat * 20, () => sound(player, "tick", wall)); },
  voices(player) {
    const folk = near(player, ["minecraft:villager_v2", "minecraft:villager", "minecraft:npc"]).slice(0, 3);
    for (let i = 0; i < 3; i++) later(i * 3, () => sound(player, "voice", folk[i]?.location));
  },
  water_trembles(player) {
    const water = blocksNear(player, (id) => id === "minecraft:water" || id.includes("cauldron"));
    for (let step = 0; step < 5; step++) {
      later(step * 10, () => { for (const b of water) particle(player, "minecraft:water_splash_particle_manual", { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 }); });
    }
    if (water.length) sound(player, "water", water[0].location);
  },
  arrows(player) { for (let i = 0; i < 4; i++) later(i * 7, () => sound(player, "arrows")); },
  cellar(player) {
    sound(player, "cellar");
    const { x, y, z } = player.location;
    for (let i = 0; i < 14; i++) particle(player, "minecraft:mycelium_dust_particle", { x: x + (Math.random() - 0.5) * 8, y: y + 0.2, z: z + (Math.random() - 0.5) * 8 });
  },
  doors_shut(player) {
    const doors = blocksNear(player, (id, b) => {
      try { return isDoor(id) && b.permutation.getState("open_bit") === true && b.permutation.getState("upper_block_bit") !== true; } catch { return false; }
    });
    for (const door of doors) {
      try { door.setPermutation(door.permutation.withState("open_bit", false)); } catch { /* somebody else's door */ }
    }
    if (doors.length) for (let i = 0; i < Math.min(3, doors.length); i++) later(i * 2, () => sound(player, "shut", doors[i].location));
    else sound(player, "shut");
  },
  guards_quiet(player, { wall }) { for (const guard of near(player, GUARDS)) face(guard, wall, 200); },
  small_thing(player, { wall, away }) {
    const from = { x: player.location.x + (wall.x - player.location.x) * 0.25, y: player.location.y, z: player.location.z + (wall.z - player.location.z) * 0.25 };
    const top = player.dimension.getTopmostBlock?.({ x: Math.floor(from.x), z: Math.floor(from.z) });
    const thing = player.dimension.spawnEntity("minecraft:rabbit", { x: from.x, y: (top?.location.y ?? from.y) + 1, z: from.z });
    thing.addTag("siege_omen");
    thing.addEffect("speed", 200, { amplifier: 3, showParticles: false });
    sound(player, "small", from);
    for (let hop = 0; hop < 6; hop++) later(hop * 10, () => thing.applyImpulse({ x: away.x * 0.7, y: 0.3, z: away.z * 0.7 }));
    later(140, () => thing.remove());
  },
  light_changes(player) {
    try { player.addEffect("darkness", 50, { showParticles: false }); } catch { /* cosmetic */ }
  },
  torches_gutter(player) {
    const flames = blocksNear(player, isFlame);
    for (const b of flames) {
      for (let k = 0; k < 3; k++) particle(player, "minecraft:basic_smoke_particle", { x: b.x + 0.5, y: b.y + 0.8 + 0.15 * k, z: b.z + 0.5 });
    }
    if (flames.length) sound(player, "gutter", flames[0].location);
  },
};

// Play one omen around one player. `keep` is the centre of the settlement they stand in, `side` tonight's wall (an angle).
export function performOmen(id, player, keep, side) {
  const act = ACTS[id];
  if (!act || !keep) return false;
  const dir = { x: Math.cos(side), z: Math.sin(side) };
  const ctx = { wall: { x: keep.x + dir.x * 40, y: player.location.y, z: keep.z + dir.z * 40 }, away: { x: -dir.x, z: -dir.z } };
  try { act(player, ctx); } catch { /* an omen never breaks the evening */ }
  return true;
}
