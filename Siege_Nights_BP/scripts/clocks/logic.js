// Living clocks, the pure part (no Minecraft): what minute a clock shows, and how the story's stops, steps and
// backward runs turn one clock state into another. The game runs the same sum on every clock, on the client, from
// its own time of day (Siege_Nights_RP/entity/clock.entity.json, written by studio/art/build_clocks.py):
//
//   shown = base + rate x (minutes since t0), wrapped to the day; minutes count from midnight (0..1439)
//   habit 1 (Harrowford's chapel clock): stops at 3:17 every night until the warden winds it at six in the evening
//   habit 2 (the Hollow): shows the time backwards
//
// A clock state is { base, t0, rate, strain, habit }. base and t0 are whole minutes (they are int properties).

export const STYLES = ["vale", "frost", "salt", "ember", "fen", "hollow", "royal"]; // siege:style 0..6
export const STYLE_OF_REGION = { vale: 0, frostmarch: 1, saltreach: 2, emberwaste: 3, blackfen: 4, hollow: 5, royal: 6 };
export const HABITS = { true: 0, harrowford: 1, backwards: 2 };
export const SIZES = [1, 3, 5, 7]; // the clock mount's siege:size states
export const DAY = 1440;
export const MIN_317 = 197; // 3:17, the truce minute
export const WOUND_AT = 1080; // 18:00, when Harrowford's warden winds the chapel clock

const wrap = (m) => ((m % DAY) + DAY) % DAY;

/** The game's time of day in ticks (0 = 6:00) -> minutes from midnight, with the fraction. */
export const minuteOfTicks = (ticks) => wrap(((ticks + 6000) % 24000) * 0.06);
/** "3:17" or "15:05" -> 197 or 905; a number passes through. */
export function parseTime(t) {
  if (typeof t === "number") return wrap(Math.round(t));
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  if (!m) return undefined;
  const h = Number(m[1]), mm = Number(m[2]);
  return h < 24 && mm < 60 ? h * 60 + mm : undefined;
}
export const fmt = (m) => { const v = Math.floor(wrap(m)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`; };

export const LIVE = Object.freeze({ base: 0, t0: 0, rate: 1, strain: false, habit: 0 });

/** The minute a clock in state `s` shows at minute `now` of the day (the client's sum, kept identical). */
export function shown(s, now) {
  let m = s.base + s.rate * wrap(now - s.t0);
  if (s.habit === 2) m = DAY - m;
  m = wrap(m);
  if (s.habit === 1 && m >= MIN_317 && m < WOUND_AT) m = MIN_317;
  return m;
}

/** A clock's own state before the story touches it: it runs with the time, in its habit. */
export const natural = (habit = 0) => ({ ...LIVE, habit });

/**
 * Apply one story change made at minute T (a whole minute) to a clock state.
 *   { kind: "hold", minute, strain }  stop on that minute (strain: the minute hand keeps trying for the next)
 *   { kind: "rate", rate }            carry on from what it shows at T at this rate: 0 stops it where it is,
 *                                     -1 runs it backwards, 1 forwards again from there, 40 races
 *   { kind: "step", by }              jump `by` minutes from what it shows at T (-1: one tick back), same rate
 */
export function transform(s, change, T) {
  const at = Math.round(shown(s, T));
  switch (change.kind) {
    case "hold": return { base: wrap(parseTime(change.minute) ?? MIN_317), t0: T, rate: 0, strain: !!change.strain, habit: 0 };
    case "rate": return { base: at, t0: T, rate: Math.max(-720, Math.min(720, Number(change.rate) || 0)), strain: false, habit: 0 };
    case "step": return { base: wrap(at + (Math.round(change.by) || 0)), t0: T, rate: s.habit === 2 ? -s.rate : s.rate, strain: false, habit: 0 };
    default: return s;
  }
}

/** Does a change cover a clock at (x, z) in dimension dim? Changes with no `near` cover every clock. */
export function covers(change, x, z, dim) {
  if (change.dim && dim && change.dim !== dim) return false;
  if (!change.near) return true;
  return Math.hypot(x - change.near.x, z - change.near.z) <= (change.r ?? 64);
}

/**
 * The state a clock should have: its natural habit, then a feature's rule (Millbrook's held minute), then every story
 * change that covers it, oldest first. rule(spot) returns a state or undefined.
 */
export function resolve(spot, { rules = [], changes = [] } = {}) {
  let s = natural(spot.habit ?? 0);
  for (const rule of rules) {
    const r = rule(spot);
    if (r) { s = { ...LIVE, ...r }; break; }
  }
  for (const c of changes) if (covers(c, spot.x, spot.z, spot.dim)) s = transform(s, c, c.T);
  return s;
}

/** The entity properties for a state (only what the client reads). */
export function props(s) {
  return {
    "siege:base": Math.round(wrap(s.base)),
    "siege:t0": Math.round(wrap(s.t0)),
    "siege:rate": Math.max(-720, Math.min(720, s.rate)),
    "siege:habit": s.habit ?? 0,
    "siege:strain": !!s.strain,
  };
}

export const YAW = { south: 0, west: 90, north: 180, east: -90 }; // the way a clock looks -> the entity's yaw
export const spotKey = (x, y, z) => `${x},${y},${z}`;
