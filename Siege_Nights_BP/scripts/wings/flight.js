// Everwake Wings: the flight maths, kept pure so it can be tested off-line.
// It is the elytra's glide (Mateo: "function like an elytra"), one tick at a time, in blocks per tick.

const R = Math.PI / 180;

/** One tick of gliding. v = current velocity, look = unit view vector, pitch = degrees (+ looks down). */
export function glideStep(v, look, pitch) {
  const p = pitch * R;
  const hLook = Math.hypot(look.x, look.z), hVel = Math.hypot(v.x, v.z);
  const lift = Math.cos(p) ** 2;
  let { x, y, z } = v;
  y += -0.08 + lift * 0.06;                                   // gravity, eased by spread wings
  if (y < 0 && hLook > 0) {                                   // falling turns into forward speed
    const k = y * -0.1 * lift;
    y += k; x += (look.x / hLook) * k; z += (look.z / hLook) * k;
  }
  if (p < 0 && hLook > 0) {                                   // looking up trades speed for height
    const k = hVel * -Math.sin(p) * 0.04;
    y += k * 3.2; x -= (look.x / hLook) * k; z -= (look.z / hLook) * k;
  }
  if (hLook > 0) {                                            // steer toward where you look
    x += ((look.x / hLook) * hVel - x) * 0.1;
    z += ((look.z / hLook) * hVel - z) * 0.1;
  }
  return { x: x * 0.99, y: y * 0.98, z: z * 0.99 };
}

/** One tick of the silent boost (the elytra rocket's push, without the rocket). */
export function boostStep(v, look) {
  return { x: v.x + look.x * 0.1 + (look.x * 1.5 - v.x) * 0.5,
           y: v.y + look.y * 0.1 + (look.y * 1.5 - v.y) * 0.5,
           z: v.z + look.z * 0.1 + (look.z * 1.5 - v.z) * 0.5 };
}

/** If the player moved much less than we pushed them (a wall, a roof), slow our own velocity to match. */
export function settle(v, moved) {
  const want = Math.hypot(v.x, v.y, v.z), got = Math.hypot(moved.x, moved.y, moved.z);
  if (want < 0.2 || got > want * 0.5) return v;
  const k = got / want;
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

export const BOOST_TICKS = 20;   // a rocket's worth of push, about a second
export const STATE = { off: 0, folded: 1, glide: 2, boost: 3, landing: 4 };   // the siege:wings property the animations read
