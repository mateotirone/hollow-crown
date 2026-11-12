// The puzzles that hand out the other four boss keys. Pure, no Minecraft imports; each world gets its own from a seed.
//
//   hunt       Rimehold: four beast cairns round Hallowmere; the lodge warden's hunting rhyme gives the order.
//   pews       Gull Bay: under which floor stone in the drowned chapel the ring lies (the Lighthouse Letters give the
//              address: third pew from the altar, the stone carved with a gull).
//   statues    Sunscar: five faceless statues of one king; turn them to the vault door in the order of his life.
//   changeling Mirelight: five villagers, one is a shape. Wrong hand, faces the wall, fears a bell.

import { rng } from "./keepers.js";

function shuffle(r, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
export const COOLDOWN_TICKS = 6000; // five minutes after a wrong try
export const resting = (now, last) => last !== undefined && now - last < COOLDOWN_TICKS;

// ================= the hunt =================
export const BEASTS = [
  { id: "hare", name: "the hare", says: ["the one that runs before the hounds", "the white one that hides in plain snow"] },
  { id: "fox", name: "the fox", says: ["the red thief at the henhouse door", "the one that laughs in the dark like a child"] },
  { id: "stag", name: "the stag", says: ["the one that wears a crown of bone", "the king of the wood, that bows to no one"] },
  { id: "wolf", name: "the wolf", says: ["the one that hunts as we hunt", "the grey one that sings to the moon"] },
];
/** { order: [beast index x4], layout: [cairn spot index for each beast], rhyme: [4 lines] } */
export function makeHunt(seed) {
  const r = rng(seed ^ 0x48554e54);
  const order = shuffle(r, [0, 1, 2, 3]);
  const layout = shuffle(r, [0, 1, 2, 3]);
  const lead = ["First wake", "Then", "Then", "And last"];
  const rhyme = order.map((b, i) => `${lead[i]} ${pick(r, BEASTS[b].says)}${i === 3 ? ", and then you'll hear the horn." : "."}`);
  return { order, layout, rhyme };
}
/** Clicking the cairn of beast b with `done` cairns already lit: "lit", "horn" (the fourth), or "wrong". */
export function huntStep(hunt, done, b) {
  if (hunt.order[done] !== b) return "wrong";
  return done === 3 ? "horn" : "lit";
}

// ================= the pews =================
export const CARVINGS = ["gull", "anchor", "fish", "star"];
export const PEW_ROWS = 6; // counted from the altar: row 1 is nearest
/** stones[row-1] = [left carving, right carving]; the ring is under { row: 3, side } (side 0 left, 1 right). */
export function makePews(seed) {
  const r = rng(seed ^ 0x50455753);
  const side = Math.floor(r() * 2);
  const stones = [];
  for (let row = 1; row <= PEW_ROWS; row++) {
    const pair = [pick(r, [1, 2, 3]), pick(r, [1, 2, 3])];
    stones.push(pair);
  }
  stones[2][side] = 0; // the gull at the third pew
  // decoy gulls: one at another row, and the third pew's other stone is never a gull
  const decoyRow = pick(r, [1, 3, 4, 5]); // rows 2, 4, 5 or 6 (index)
  stones[decoyRow][Math.floor(r() * 2)] = 0;
  stones[2][1 - side] = pick(r, [1, 2, 3]);
  return { stones, ring: { row: 3, side } };
}
export const pewAnswer = (pews, row, side) => (row === pews.ring.row && side === pews.ring.side ? "ring" : "wrong");

// ================= the statues =================
export const AGES = [
  ["Here he would not sit still for the sculptor, and the sculptor let him run.", "Here he is small enough to stand on the plinth with room to spare."],
  ["Here is the morning of his crowning, in a cloak that was too big for him.", "Here he has just been crowned, and is trying not to smile."],
  ["Here is the year the bells rang for war.", "Here he wears a soldier's coat over the king's."],
  ["Here he has come home from the long winter at the lake, and sits down slowly.", "Here he is older, and holds the reins of a tired horse."],
  ["Here he is grey, and favours his right hand in all things.", "Here he is old, and the sculptor has carved him laughing anyway."],
];
/** { spots: [age at each of the 5 statue spots], words: [inscription for each spot] } */
export function makeStatues(seed) {
  const r = rng(seed ^ 0x53544154);
  const spots = shuffle(r, [0, 1, 2, 3, 4]);
  return { spots, words: spots.map((age) => pick(r, AGES[age])) };
}
/** Turning the statue at `spot` when `turned` of them already face the door: "turn", "seal" (the fifth) or "wrong". */
export function statueStep(statues, turned, spot) {
  if (statues.spots[spot] !== turned) return "wrong";
  return turned === 4 ? "seal" : "turn";
}

// ================= the changeling =================
export const VILLAGERS = [
  { name: "Nell Reed", house: "Nell Reed's door" },
  { name: "Osk Fenner", house: "the eel-trapper's hut" },
  { name: "Brida Mott", house: "the lantern-maker's" },
  { name: "Tam Cotter", house: "the reed-cutter's" },
  { name: "Wynn Hale", house: "the ferry hut" },
];
export const TELLS = {
  hand: ["takes the cup you hand over in the left hand, though the knife on the belt sits on the right", "takes the cup in the right hand without thinking"],
  wall: ["keeps turning back to the wall while talking, as if someone were standing there", "looks you in the eye the whole time"],
  bell: ["flinches when the wind knocks the little bell on the lantern", "doesn't notice the lantern bell at all"],
};
export const TELL_KINDS = ["hand", "wall", "bell"];
/**
 * { shape: index of the changeling, tells: [{ hand, wall, bell } booleans per villager] }. The shape shows all three
 * tells; everyone else shows one or two, never all three, and at least one villager shows two (so it takes thought).
 */
export function makeChangeling(seed) {
  const r = rng(seed ^ 0x4348474c);
  const shape = Math.floor(r() * 5);
  const tells = [];
  for (let v = 0; v < 5; v++) {
    if (v === shape) { tells.push({ hand: true, wall: true, bell: true }); continue; }
    const n = r() < 0.5 ? 1 : 2;
    const on = shuffle(r, TELL_KINDS).slice(0, n);
    tells.push({ hand: on.includes("hand"), wall: on.includes("wall"), bell: on.includes("bell") });
  }
  if (!tells.some((t, v) => v !== shape && TELL_KINDS.filter((k) => t[k]).length === 2)) {
    const v = (shape + 1) % 5;
    tells[v] = { hand: true, wall: true, bell: false };
  }
  return { shape, tells };
}
export function villagerLines(c, v) {
  const t = c.tells[v];
  return TELL_KINDS.map((k) => TELLS[k][t[k] ? 0 : 1]);
}
export const accuse = (c, v) => (v === c.shape ? "shape" : "wrong");

// ================= the approach fights =================
// Each boss area has a stretch on the way in where its lesser things come for whoever walks through.
export const APPROACH_REST_TICKS = 6000; // five minutes between waves
/** Whether an approach sends a wave now: someone is in it, no fight or scene is running, and it has rested. */
export const approachWave = ({ players, fighting, now, last }) => players > 0 && !fighting && (last === undefined || now - last >= APPROACH_REST_TICKS);
/** How many come: `base` plus `per` for each player there, never more than `max`. */
export const approachCount = (players, { base = 2, per = 2, max = 6 } = {}) => Math.min(max, base + per * players);
export const GLADE_REST_TICKS = APPROACH_REST_TICKS;
export const gladeWave = approachWave;
