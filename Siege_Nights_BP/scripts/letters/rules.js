// Letters by messenger: pure rules (loads in Node).
//
// Mateo 2026-11-12: a private message to another player is "sending a messenger". It takes a couple of minutes:
// the sender sees a small countdown, "Your message is being delivered", and the other player gets it when
// it reaches zero. The farther apart you are, the longer the ride, within MIN..MAX seconds.

export const LETTERS = {
  minSeconds: 90, // even next door, a letter takes a minute and a half
  maxSeconds: 180, // the far side of the map, or another world entirely, takes three minutes
  blocksPerSecond: 16, // how fast the messenger rides, past the first minute and a half
  maxLength: 240, // characters in one letter
  inFlight: 3, // most letters one player can have on the road at once
};

// How long a letter takes, in seconds. from/to are { x, z } or undefined when either is in another dimension
// or offline (then the full ride).
export function rideSeconds(from, to) {
  if (!from || !to) return LETTERS.maxSeconds;
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  return Math.round(Math.min(LETTERS.maxSeconds, LETTERS.minSeconds + d / LETTERS.blocksPerSecond));
}

export const clock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Tidy what a player typed: no colour codes, no line breaks, trimmed and cut to length
export function cleanText(text) {
  return String(text ?? "").replace(/§./g, "").replace(/\s+/g, " ").trim().slice(0, LETTERS.maxLength);
}

// The sender's countdown line: the letter arriving soonest, plus how many more are on the road
export function countdownLine(mine, now) {
  if (!mine.length) return "";
  const first = mine.reduce((a, b) => (a.due <= b.due ? a : b));
  const more = mine.length - 1;
  return `§7Your message is being delivered §f${clock((first.due - now) / 1000)}${more ? ` §8(+${more} more)` : ""}`;
}

// Letters due by now, for recipients who are here
export const dueNow = (letters, now, online) => letters.filter((l) => l.due <= now && online.has(l.to));
