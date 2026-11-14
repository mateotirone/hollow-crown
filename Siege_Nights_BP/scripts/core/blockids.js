// Bedrock spellings of block ids the generators write the Java way (town audit 2026-11-14). The game refuses the Java
// name, and a builder that can't resolve a block puts air there: every dark oak and oak wall sign in the plot
// buildings (the window boxes' sides, the shop boards), oak fence gates in the town layouts and oak doors vanished.
// Pure code, loads in Node too.
const RENAMES = {
  "minecraft:oak_wall_sign": "minecraft:wall_sign",
  "minecraft:dark_oak_wall_sign": "minecraft:darkoak_wall_sign",
  "minecraft:oak_sign": "minecraft:standing_sign",
  "minecraft:oak_standing_sign": "minecraft:standing_sign",
  "minecraft:dark_oak_sign": "minecraft:darkoak_standing_sign",
  "minecraft:dark_oak_standing_sign": "minecraft:darkoak_standing_sign",
  "minecraft:oak_fence_gate": "minecraft:fence_gate",
  "minecraft:oak_door": "minecraft:wooden_door",
  "minecraft:oak_trapdoor": "minecraft:trapdoor",
  "minecraft:oak_button": "minecraft:wooden_button",
  "minecraft:oak_pressure_plate": "minecraft:wooden_pressure_plate",
  "minecraft:dirt_path": "minecraft:grass_path",
  "minecraft:chain": "minecraft:iron_chain",
  "minecraft:fence": "minecraft:oak_fence",
};

// [id] plus the Bedrock spelling when it differs (try them in this order)
export function idSpellings(id) {
  const full = id.includes(":") ? id : `minecraft:${id}`;
  const alt = RENAMES[full];
  return alt ? [id, alt] : [id];
}
