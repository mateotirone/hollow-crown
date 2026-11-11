// Act V: The Quiet After. What happens once Morvane has fallen.
// Plan (Claude Doc, "After the Crown Falls"): https://claude.ai/artifact/78C56Bv59qVa1krcbKFBxm
// Built so far: arc 1, the Five Chairs (chairs.js), and the Homecomings (homecomings.js).
// The truce itself (Guest Nights) is the lore feature's (lore/truce.js); this folder only listens to it.

import { addTests, assert, assertEqual } from "../siege/api.js";
import { TEMPERS } from "../undertow/regent.js";
import { HOUSES } from "./data/houses.js";
import { WHEN, ASK, SEEK, ENDING, KEEPSAKE, TWIST } from "./data/homecomings.js";
import { AFTER, HOUSE_IDS, startStandings, seatOf, houseForPretender, afterFall, afterSat, afterSwitch, envoyHouse, freshLine, isThirdNight, makeStranger, strangerStory, fill, nextHomecoming } from "./rules.js";
import "./chairs.js";
import "./homecomings.js";

const POOLS = ["pitch", "backed", "refused", "guest", "unbidden"];
const SINGLE = ["seatGained", "seatLost", "champion"];

addTests("after", {
  "Five Chairs: five houses, each complete, each with a Regent temper": () => {
    assertEqual(HOUSES.length, 5);
    assertEqual(new Set(HOUSE_IDS).size, 5);
    for (const h of HOUSES) {
      assert(TEMPERS[h.temper], `${h.id} temper ${h.temper}`);
      assert(h.name && h.style && h.seat && h.wants && h.table && h.envoys.length >= 3, h.id);
      for (const k of POOLS) assert(h.lines[k]?.length >= 2, `${h.id} ${k}`);
      assert(h.lines.pitch.length >= 4, `${h.id} needs four pitches, it is heard every third night`);
      for (const k of SINGLE) assert(typeof h.lines[k] === "string", `${h.id} ${k}`);
    }
    assertEqual(new Set(HOUSES.map((h) => h.temper)).size, 5, "every house rules differently");
  },
  "Five Chairs: nobody says who Morvane was": () => {
    const text = JSON.stringify(HOUSES) + JSON.stringify({ WHEN, ASK, SEEK, ENDING, KEEPSAKE });
    assert(!/oswin|morvane/i.test(text), "a house or a stranger names him");
  },
  "Five Chairs: the highest standing holds the seat, and a tie keeps the holder": () => {
    assertEqual(seatOf({ bell: 3, salt: 7, lamp: 7, root: 1, tide: 2 }), "salt");
    assertEqual(seatOf({ bell: 3, salt: 7, lamp: 7, root: 1, tide: 2 }, "lamp"), "lamp");
    assertEqual(seatOf({ bell: 3, salt: 7, lamp: 8, root: 1, tide: 2 }, "salt"), "lamp");
    const s = startStandings([0, 0.25, 0.5, 0.75, 0.999]);
    assertEqual(s, { bell: 3, salt: 4, lamp: 5, root: 6, tide: 6 });
  },
  "Five Chairs: a champion never rises for the seat holder or twice running": () => {
    const s = { bell: 2, salt: 9, lamp: 4, root: 0, tide: 6 };
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const h = houseForPretender(s, "salt", "root", i / 100);
      assert(h !== "salt" && h !== "root", `roll ${i} gave ${h}`);
      seen.add(h);
    }
    assertEqual(seen.size, 3, "every other house gets a turn");
  },
  "Five Chairs: falls, long sits and switching move standing within 0-10": () => {
    const s = { bell: 1, salt: 10, lamp: 4, root: 0, tide: 6 };
    assertEqual(afterFall(s, "bell", ["salt", "lamp", "lamp", "bell"]), { bell: 0, salt: 10, lamp: 5, root: 0, tide: 6 });
    assertEqual(afterSat(s, "tide").tide, 9);
    assertEqual(afterSat(s, "salt").salt, 10);
    assertEqual(afterSwitch(s, "lamp", "tide").lamp, 3);
    assertEqual(afterSwitch(s, undefined, "tide"), s);
  },
  "Five Chairs: envoys and lines never repeat back to back": () => {
    let recent = [];
    for (let i = 0; i < 60; i++) {
      const h = envoyHouse(recent, (i * 37 % 100) / 100);
      assert(!recent.slice(-AFTER.envoyMemory).includes(h), `envoy ${i} repeated ${h}`);
      recent = [...recent, h];
    }
    let last;
    for (let i = 0; i < 60; i++) {
      const n = freshLine([1, 2, 3, 4], last, (i * 53 % 100) / 100);
      assert(n !== last && n >= 0 && n < 4, `line ${i}`);
      last = n;
    }
    assert(isThirdNight(3) && isThirdNight(6) && !isThirdNight(4) && !isThirdNight(0));
  },
  "Homecomings: the same seed is the same stranger": () => assertEqual(makeStranger(77), makeStranger(77)),
  "Homecomings: never like the one before, and no name again for a long while": () => {
    const history = { names: [], last: undefined };
    let before;
    for (let seed = 1; seed <= 200; seed++) {
      const s = makeStranger(seed * 13, history);
      assert(!history.names.includes(s.name), `seed ${seed}: ${s.name} came back too soon`);
      if (before) assert(s.when !== before.when && s.ask !== before.ask && s.twist !== before.twist, `seed ${seed} repeats the last`);
      history.names = [...history.names, s.name].slice(-AFTER.nameMemory);
      history.last = { when: s.when, ask: s.ask, twist: s.twist };
      before = s;
    }
  },
  "Homecomings: plenty of different stories, every twist turns up": () => {
    const stories = new Set(), twists = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const s = makeStranger(seed);
      stories.add(`${s.name}|${s.when}|${s.ask}|${s.seek}`);
      twists.add(s.twist);
    }
    assert(stories.size > 280, `only ${stories.size} stories in 300`);
    assertEqual([...twists].sort(), [...TWIST].sort());
  },
  "Homecomings: every line fills in, and every ask is a real item": () => {
    const s = makeStranger(5);
    for (const l of strangerStory(s)) assert(!/[{}]/.test(l), l);
    for (const pool of Object.values(ENDING)) for (const l of pool) assert(!/[{}]/.test(fill(l, s, { settlement: "Wrenfield" })), l);
    for (const a of ASK) assert(a.item.startsWith("minecraft:") && a.n >= 1, a.id);
    for (const pool of ["thanks", "stay", "noItem", "back"]) assert(ENDING[pool].length >= 3, `${pool} needs three wordings`);
    assertEqual(nextHomecoming(10, 0), 15);
    assertEqual(nextHomecoming(10, 0.999), 19);
  },
});
