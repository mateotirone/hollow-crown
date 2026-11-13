import { addTests, assert } from "../siege/api.js";
import { glideStep, boostStep, settle } from "./flight.js";

const run = (pitch, ticks, v = { x: 0, y: 0, z: 0 }) => {
  const p = pitch * Math.PI / 180, look = { x: 0, y: -Math.sin(p), z: Math.cos(p) };
  let pos = { y: 0, z: 0 };
  for (let i = 0; i < ticks; i++) { v = glideStep(v, look, pitch); pos = { y: pos.y + v.y, z: pos.z + v.z }; }
  return { v, pos };
};

addTests("wings", {
  "a level glide goes far for the height it loses, like an elytra": () => {
    const { pos } = run(5, 400);
    assert(pos.y < 0, "a glide must come down");
    assert(pos.z / -pos.y > 6, `glide ratio ${(pos.z / -pos.y).toFixed(1)} is too steep`);
  },
  "a dive is faster than a glide": () => {
    const dive = Math.hypot(...Object.values(run(70, 80).v)), glide = Math.hypot(...Object.values(run(5, 80).v));
    assert(dive > glide * 1.5, `dive ${dive.toFixed(2)} vs glide ${glide.toFixed(2)}`);
  },
  "pulling up from a dive climbs": () => {
    const fast = run(60, 60).v;
    const { v } = run(-30, 25, fast);
    assert(v.y > 0.1, "after the swoop, pulling up should be climbing");
  },
  "the boost pushes toward where you look and tops out": () => {
    let v = { x: 0, y: 0, z: 0.5 };
    for (let i = 0; i < 20; i++) v = boostStep(v, { x: 0, y: 0, z: 1 });
    assert(v.z > 1.5 && v.z < 1.8, `boost speed ${v.z.toFixed(2)}`);
  },
  "hitting a wall takes the speed out": () => {
    const v = settle({ x: 0, y: 0, z: 1.5 }, { x: 0, y: 0, z: 0.05 });
    assert(v.z < 0.1, "should slow to what actually moved");
    assert(settle({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0.9 }).z === 1, "free flight is left alone");
  },
});
