// What a settler says, as a plain function (no game imports, so Node tests it). Lines are in config.js.
//   lineFor(s, { night, day, temper, wary }) -> the line, with {town} still in it
//   temper: the Rival Lord's temper when the settler lives in a lord's town; wary: the town changed hands lately

import { SETTLER_LINES } from "./config.js";

export function lineFor(s, { night = false, day = 0, temper, wary = false } = {}) {
  if (s.idle) return SETTLER_LINES.idle;
  const turn = (list) => list[(s.n + day) % list.length];
  if (night) return turn(SETTLER_LINES.night);
  if (wary) return turn(SETTLER_LINES.wary);
  if (temper) {
    const own = SETTLER_LINES.lord[temper] ?? SETTLER_LINES.lord.steady;
    return (s.n + day) % 3 === 0 ? turn(SETTLER_LINES.day) : turn(own); // mostly the lord's way, now and then their own
  }
  return turn(SETTLER_LINES.day);
}
