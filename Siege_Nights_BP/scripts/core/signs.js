// Turning a standing sign so its face looks a given way. Pure.
//   signRot(vx, vz) -> ground_sign_direction 0-15 whose face looks along (vx, vz): 0 south, 4 west, 8 north, 12 east
//   signToward(from, to) -> the rotation for a sign at from ({ x, z }) that faces someone standing at to

export const signRot = (vx, vz) => ((Math.round(Math.atan2(-vx, vz) / (Math.PI / 8)) % 16) + 16) % 16;
export const signToward = (from, to) => signRot(to.x - from.x, to.z - from.z);
