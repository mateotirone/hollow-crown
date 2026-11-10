// Deterministic noise for the Hollow's generator. One fixed seed: the land is the same for every
// player and every rebuild. Pure maths, no Minecraft calls.

const SEED = 7741;

export function hash(x, z, salt = 0) {
  let h = (x * 374761393 + z * 668265263 + (SEED + salt) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // 0..1
}
export const smooth = (t) => t * t * (3 - 2 * t);
export function value(x, z, salt) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const fx = smooth(x - x0), fz = smooth(z - z0);
  const a = hash(x0, z0, salt), b = hash(x0 + 1, z0, salt);
  const c = hash(x0, z0 + 1, salt), d = hash(x0 + 1, z0 + 1, salt);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm(x, z, salt = 0) {
  return value(x, z, salt) * 0.55 + value(x * 2.1, z * 2.1, salt + 11) * 0.3 + value(x * 4.3, z * 4.3, salt + 23) * 0.15;
}
