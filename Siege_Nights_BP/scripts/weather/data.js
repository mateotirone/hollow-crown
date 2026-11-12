// Each region's own weather: what it looks and sounds like and when it comes. Words and numbers only,
// no Minecraft, so the self-tests and tools/weather_assets.mjs can read it anywhere.
//
// A region has a few kinds of weather. One spell of one kind blows over a region at a time; between
// spells the region has only Minecraft's own sky. A spell builds up in steps (each step a thicker fog,
// pushed on the player's fog stack under LAYER), holds, then thins out again.
//
// After changing a kind's steps or particle, run   node tools/weather_assets.mjs   to rewrite the
// fog and particle files in the resource pack (the check fails if they are out of date).
//
// Tone (Mateo's rule): uneasy, never horror. Nothing here is sudden or loud.

export const LAYER = "hc_weather"; // the fog stack id these fogs are pushed under

// The regions as the minimap names them (minimap/data.js regionAt). Over open sea it is Saltreach weather.
export const REGION_OF_PLACE = {
  "Aldmere Vale": "Aldmere Vale",
  Frostmarch: "Frostmarch",
  Saltreach: "Saltreach",
  "The Western Sea": "Saltreach",
  Blackfen: "Blackfen",
  Emberwaste: "Emberwaste",
};

// Time windows, in Minecraft time of day (0 = sunrise, 6000 noon, 12000 sunset, 18000 midnight)
export const isNightTime = (t) => t >= 12500 && t < 23500;
export const isDusk = (t) => t >= 11000 && t < 14000;
export const isDawn = (t) => t >= 22500 || t < 2000;

// A fog step: how far you can see. `to` is where the fog is solid; `from` where it starts.
// render: fractions of the player's render distance (light hazes). fixed: blocks (storms look the
// same whatever the render distance, and a Realm keeps that low anyway).
const render = (from, to) => ({ type: "render", from, to });
const fixed = (from, to) => ({ type: "fixed", from, to });

// kinds: id (never renamed: saved worlds remember the last spell by id), region, name (said on screen),
// arrive (the action-bar line when it reaches you), colour (fog), steps (thin to thick),
// particle (what blows past, only outdoors): { id, rate per second at full strength, size, colour,
//   speed (blocks a second the wind carries it), fall, life (seconds), spread (box half-width) },
// sounds: named cues from core/sfx_cues.js, one every `every` seconds [min, max], never the same twice running,
// minutes: how long a spell lasts [min, max] (real minutes),
// weight({ time, raining }): how likely this kind is to start now, 0 = not now,
// wind: the direction it blows from in degrees (0 north, 90 east); a spell picks within `windSpread` of it.
export const KINDS = [
  // ---------- Blackfen: the mist that lives on the water ----------
  {
    id: "fen_mist", region: "Blackfen", name: "Fen mist",
    arrive: "§7Mist is coming up off the water.",
    colour: "#55604f",
    steps: [render(0.05, 0.6), fixed(2, 48), fixed(0, 28)],
    particle: { id: "siege:wx_fen_mist", rate: 6, size: 1.6, colour: [0.62, 0.68, 0.6, 0.18], speed: 0.25, fall: 0, life: 7, spread: 12 },
    sounds: [{ cue: "wx.fen_croak", every: [9, 22] }, { cue: "wx.fen_splash", every: [25, 60] }, { cue: "wx.fen_bell", every: [90, 200] }],
    minutes: [6, 16],
    weight: ({ time, raining }) => (isNightTime(time) || isDusk(time) ? 3 : 1) + (raining ? 3 : 0),
    wind: 0, windSpread: 180,
  },
  {
    id: "marsh_lights", region: "Blackfen", name: "Marsh lights",
    arrive: "§7Small lights are moving out over the fen.",
    colour: "#3f4a44",
    steps: [render(0.05, 0.7), render(0, 0.5)],
    particle: { id: "siege:wx_marsh_light", rate: 1.2, size: 0.12, colour: [0.55, 0.95, 0.7, 0.9], speed: 0.15, fall: -0.02, life: 6, spread: 22, glow: true },
    sounds: [{ cue: "wx.fen_croak", every: [12, 30] }, { cue: "wx.marsh_hum", every: [40, 90] }],
    minutes: [4, 9],
    weight: ({ time }) => (isNightTime(time) ? 2 : 0),
    wind: 0, windSpread: 180,
  },
  // ---------- Saltreach: wind off the sea, and the sea fret ----------
  {
    id: "sea_wind", region: "Saltreach", name: "Sea wind",
    arrive: "§7The wind is coming in hard off the sea.",
    colour: "#8a9ba3",
    steps: [render(0.3, 0.95), render(0.15, 0.75)],
    particle: { id: "siege:wx_sea_spray", rate: 14, size: 0.08, colour: [0.86, 0.92, 0.95, 0.75], speed: 7, fall: 0.6, life: 1.6, spread: 10 },
    sounds: [{ cue: "wx.gust", every: [5, 14] }, { cue: "wx.spray", every: [8, 20] }],
    minutes: [5, 12],
    weight: ({ time, raining }) => (isNightTime(time) ? 2 : 3) + (raining ? 2 : 0),
    wind: 270, windSpread: 45, // from the west, off the Western Sea
  },
  {
    id: "sea_fret", region: "Saltreach", name: "Sea fret",
    arrive: "§7A white fog is rolling in from the sea.",
    colour: "#c3cbcd",
    steps: [render(0.05, 0.6), fixed(4, 52), fixed(0, 26)],
    particle: { id: "siege:wx_sea_fret", rate: 5, size: 1.8, colour: [0.9, 0.93, 0.94, 0.16], speed: 0.8, fall: 0, life: 7, spread: 12 },
    sounds: [{ cue: "wx.buoy_bell", every: [20, 45] }, { cue: "wx.drip", every: [10, 25] }],
    minutes: [5, 12],
    weight: ({ time }) => (isDawn(time) ? 4 : isNightTime(time) ? 1.5 : 0.7),
    wind: 270, windSpread: 30,
  },
  // ---------- Emberwaste: dust and sandstorms ----------
  {
    id: "dust_wind", region: "Emberwaste", name: "Dust wind",
    arrive: "§7The wind is lifting the sand.",
    colour: "#c49460",
    steps: [render(0.2, 0.85), render(0.1, 0.6)],
    particle: { id: "siege:wx_dust", rate: 10, size: 0.07, colour: [0.86, 0.68, 0.45, 0.8], speed: 5, fall: 0.2, life: 2, spread: 10 },
    sounds: [{ cue: "wx.gust", every: [8, 20] }, { cue: "wx.sand_hiss", every: [15, 35] }],
    minutes: [4, 10],
    weight: ({ time }) => (isNightTime(time) ? 1 : 3),
    wind: 90, windSpread: 120,
  },
  {
    id: "sandstorm", region: "Emberwaste", name: "Sandstorm",
    arrive: "§6A sandstorm is coming. Get under a roof.",
    colour: "#a8693a",
    steps: [render(0.1, 0.6), fixed(2, 40), fixed(0, 18)],
    particle: { id: "siege:wx_sand", rate: 40, size: 0.09, colour: [0.78, 0.52, 0.3, 0.9], speed: 11, fall: 0.3, life: 1.4, spread: 10 },
    sounds: [{ cue: "wx.gust", every: [3, 8] }, { cue: "wx.sand_hiss", every: [5, 12] }],
    minutes: [3, 8],
    weight: ({ time, raining }) => (isNightTime(time) ? 0.8 : 1.5) + (raining ? 1.5 : 0), // rain elsewhere is wind here
    wind: 90, windSpread: 90,
  },
  // ---------- Frostmarch: flurries and blizzards ----------
  {
    id: "flurries", region: "Frostmarch", name: "Flurries",
    arrive: "§7Snow is blowing down off the peaks.",
    colour: "#d7dee6",
    steps: [render(0.25, 0.9), render(0.12, 0.65)],
    particle: { id: "siege:wx_flurry", rate: 12, size: 0.07, colour: [1, 1, 1, 0.9], speed: 1.5, fall: 1.2, life: 4, spread: 10 },
    sounds: [{ cue: "wx.cold_wind", every: [12, 28] }],
    minutes: [4, 10],
    weight: () => 3,
    wind: 0, windSpread: 90, // from the north
  },
  {
    id: "blizzard", region: "Frostmarch", name: "Blizzard",
    arrive: "§fA blizzard is coming over the passes. Find shelter.",
    colour: "#e3e9ef",
    steps: [render(0.1, 0.6), fixed(2, 36), fixed(0, 16)],
    particle: { id: "siege:wx_blizzard", rate: 45, size: 0.09, colour: [1, 1, 1, 0.95], speed: 9, fall: 2, life: 1.6, spread: 10 },
    sounds: [{ cue: "wx.howl", every: [6, 14] }, { cue: "wx.cold_wind", every: [4, 10] }],
    minutes: [4, 10],
    weight: ({ raining }) => (raining ? 4 : 1), // the sky's own snow, made worse
    wind: 0, windSpread: 60,
  },
  // ---------- Aldmere Vale: keeps its rain; low mist at first light ----------
  {
    id: "dawn_mist", region: "Aldmere Vale", name: "Morning mist",
    arrive: "§7Mist is lying in the low ground.",
    colour: "#d0d4d2",
    steps: [render(0.15, 0.8), render(0.05, 0.5)],
    particle: { id: "siege:wx_vale_mist", rate: 3, size: 1.4, colour: [0.92, 0.94, 0.93, 0.12], speed: 0.2, fall: 0, life: 7, spread: 12 },
    sounds: [{ cue: "wx.drip", every: [15, 35] }],
    minutes: [3, 7],
    weight: ({ time, raining }) => (isDawn(time) && !raining ? 3 : 0),
    wind: 0, windSpread: 180,
  },
];

export const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));
export const REGIONS = [...new Set(KINDS.map((k) => k.region))];

// How the sky behaves over each region.
export const SKY = {
  checkTicks: 600, // look at each region's sky every 30 seconds
  quiet: [6, 22], // real minutes of plain Minecraft sky between spells [min, max]
  firstQuiet: [2, 8], // after the world first loads with this feature
  stepTicks: 200, // a spell grows or thins by one step every 10 seconds where you stand
  roofCap: 1, // under a roof you get at most this step (the window light still looks grey)
  deep: 8, // this many blocks under the open sky (a cave, a cellar): no weather at all
};

export const fogId = (kind, step) => `siege:wx_${kind}_${step}`; // step from 1
export const fogIds = () => KINDS.flatMap((k) => k.steps.map((_, i) => fogId(k.id, i + 1)));

// ---------- the rules, pure ----------

/** Pick the next kind for a region, or undefined if nothing wants to start now. Never the same kind
 *  twice running when another kind could come. */
export function pickKind(region, ctx, last, random = Math.random) {
  let options = KINDS.filter((k) => k.region === region).map((k) => [k, Math.max(0, k.weight(ctx))]).filter(([, w]) => w > 0);
  if (options.length > 1) options = options.filter(([k]) => k.id !== last);
  const total = options.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return undefined;
  let r = random() * total;
  for (const [k, w] of options) if ((r -= w) < 0) return k;
  return options[options.length - 1][0];
}

export const between = ([a, b], random = Math.random) => a + (b - a) * random();
export const minutes = (m) => Math.round(m * 60 * 20); // real minutes to ticks

/** A new spell for a kind, starting at `clock` (the feature's own tick count). */
export function newSpell(kind, clock, random = Math.random) {
  const length = minutes(between(kind.minutes, random));
  const wind = (kind.wind + (random() * 2 - 1) * kind.windSpread + 360) % 360;
  return { kind: kind.id, from: clock, until: clock + length, wind: Math.round(wind) };
}

/** The step a player should be at for this spell: rises at the start, falls at the end. */
export function fullStep(spell, clock) {
  const kind = KIND[spell?.kind];
  if (!kind || clock >= spell.until) return 0;
  const max = kind.steps.length;
  const into = clock - spell.from, left = spell.until - clock;
  const ramp = SKY.stepTicks * max; // the build-up and the easing each take one step-time per step
  const up = Math.ceil((into + 1) / ramp * max), down = Math.ceil(left / ramp * max);
  return Math.max(1, Math.min(max, up, down));
}

/** Where the player is standing changes how much of it they get. covered: something solid overhead.
 *  depth: blocks between the player's head and the open sky. */
export function stepFor(step, { covered = false, depth = 0 } = {}) {
  if (depth >= SKY.deep) return 0;
  return covered ? Math.min(step, SKY.roofCap) : step;
}

/** Move one step toward the target. A different kind first thins the old one away. */
export function nextShown(shown, target) {
  if (!shown || shown.step === 0) return target.step > 0 ? { kind: target.kind, step: 1 } : { kind: undefined, step: 0 };
  if (shown.kind !== target.kind) return shown.step > 1 ? { kind: shown.kind, step: shown.step - 1 } : { kind: undefined, step: 0 };
  if (shown.step < target.step) return { kind: shown.kind, step: shown.step + 1 };
  if (shown.step > target.step) return target.step === 0 && shown.step === 1 ? { kind: undefined, step: 0 } : { kind: shown.kind, step: shown.step - 1 };
  return shown;
}

/** The wind as a unit vector the particles travel along (blowing FROM `deg`, so moving away from it). */
export function windVector(deg) {
  const r = (deg * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) }; // from north (0) blows toward +z (south)
}
