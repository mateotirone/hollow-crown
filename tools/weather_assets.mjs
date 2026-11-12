#!/usr/bin/env node
// Writes the resource pack files for each region's weather from Siege_Nights_BP/scripts/weather/data.js:
//   Siege_Nights_RP/fogs/wx_<kind>_<step>.json          one fog per step of each kind
//   Siege_Nights_RP/particles/wx_<name>.particle.json   what blows past (dust, spray, snow, mist, lights)
//
//   node tools/weather_assets.mjs           rewrite them
//   node tools/weather_assets.mjs --check   only say whether they are up to date (tools/check.mjs runs this)

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RP = join(ROOT, "Siege_Nights_RP");
const { KINDS, fogId } = await import(pathToFileURL(join(ROOT, "Siege_Nights_BP/scripts/weather/data.js")).href);

const files = new Map(); // path -> text

const distance = ({ type, from, to }, colour) => ({
  fog_start: from,
  fog_end: to,
  fog_color: colour,
  render_distance_type: type,
});

for (const kind of KINDS) {
  kind.steps.forEach((step, i) => {
    const id = fogId(kind.id, i + 1);
    files.set(join(RP, "fogs", `${id.split(":")[1]}.json`), {
      format_version: "1.16.100",
      "minecraft:fog_settings": {
        description: { identifier: id },
        // water is left out on purpose: it falls through to whatever fog is under this one (the Blackfen's black water)
        distance: { air: distance(step, kind.colour), weather: distance(step, kind.colour) },
      },
    });
  });
}

const particles = new Map(KINDS.map((k) => [k.particle.id, k.particle]));
for (const [id, p] of particles) {
  const puff = p.size >= 0.5; // a drifting bank of mist rather than a speck
  const down = p.speed > 0 ? -(p.fall / p.speed).toFixed(3) : -1;
  const drift = (p.speed * p.life) / 2; // start upwind, so things blow across the player rather than away
  files.set(join(RP, "particles", `${id.split(":")[1]}.particle.json`), {
    format_version: "1.10.0",
    particle_effect: {
      description: {
        identifier: id,
        basic_render_parameters: { material: p.glow ? "particles_add" : "particles_blend", texture: "textures/particle/particles" },
      },
      components: {
        // the script spawns one of these a second around each player out in the weather, with
        // variable.wind_x / wind_z (where the wind blows to) and variable.density (0 to 1, the step)
        "minecraft:emitter_rate_steady": { spawn_rate: `${p.rate} * variable.density`, max_particles: Math.ceil(p.rate * p.life) + 10 },
        "minecraft:emitter_lifetime_once": { active_time: 1 },
        "minecraft:emitter_shape_box": {
          offset: [`-variable.wind_x * ${drift.toFixed(2)}`, puff ? 0.5 : 3, `-variable.wind_z * ${drift.toFixed(2)}`],
          half_dimensions: [p.spread, puff ? 1.5 : 4, p.spread],
          direction: ["variable.wind_x", down, "variable.wind_z"],
        },
        "minecraft:particle_lifetime_expression": { max_lifetime: `${p.life} * math.random(0.7, 1.1)` },
        "minecraft:particle_initial_speed": `${p.speed} * math.random(0.75, 1.25)`,
        "minecraft:particle_motion_dynamic": {
          linear_acceleration: puff || p.glow ? [0, p.glow ? 0.02 : 0, 0] : ["math.sin(variable.particle_age * 200) * 0.6", 0, "math.cos(variable.particle_age * 170) * 0.6"],
          linear_drag_coefficient: 0,
        },
        "minecraft:particle_appearance_billboard": {
          size: puff
            ? [`${p.size} * (0.6 + variable.particle_age / variable.particle_lifetime * 0.8)`, `${p.size} * (0.6 + variable.particle_age / variable.particle_lifetime * 0.8)`]
            : [p.size, p.size],
          facing_camera_mode: "rotate_xyz",
          uv: { texture_width: 128, texture_height: 128, uv: puff ? [0, 0] : [32, 0], uv_size: [8, 8] },
        },
        "minecraft:particle_appearance_tinting": {
          // fade in and out, so nothing pops
          color: [p.colour[0], p.colour[1], p.colour[2], `${p.colour[3]} * math.clamp(math.min(variable.particle_age * 2, (variable.particle_lifetime - variable.particle_age) * 2), 0, 1)`],
        },
      },
    },
  });
}

// Files from kinds that no longer exist
const stale = [
  ...readdirSync(join(RP, "fogs")).filter((f) => f.startsWith("wx_")).map((f) => join(RP, "fogs", f)),
  ...readdirSync(join(RP, "particles")).filter((f) => f.startsWith("wx_")).map((f) => join(RP, "particles", f)),
].filter((f) => !files.has(f));

const check = process.argv.includes("--check");
let wrong = stale.length;
for (const [path, json] of files) {
  const text = JSON.stringify(json, null, 2) + "\n";
  const same = existsSync(path) && readFileSync(path, "utf8") === text;
  if (same) continue;
  wrong++;
  if (!check) writeFileSync(path, text);
}
if (!check) for (const f of stale) unlinkSync(f);
if (check) {
  if (wrong) { console.log(`weather assets: ${wrong} file(s) out of date, run node tools/weather_assets.mjs`); process.exit(1); }
  console.log("weather assets: up to date");
} else console.log(`weather assets: ${files.size} files, ${wrong} written, ${stale.length} removed`);
