// Act V: The Quiet After. What happens once Morvane has fallen.
// Plan (Claude Doc, "After the Crown Falls"): https://claude.ai/artifact/78C56Bv59qVa1krcbKFBxm
// Built so far: arc 1, the Five Chairs (chairs.js), the Homecomings (homecomings.js), and arc 2, the Deep (deep.js).
// The truce itself (Guest Nights) is the lore feature's (lore/truce.js); this folder only listens to it.

import { addTests, assert, assertEqual } from "../siege/api.js";
import { TEMPERS } from "../undertow/regent.js";
import { HOUSES } from "./data/houses.js";
import { WHEN, ASK, SEEK, ENDING, KEEPSAKE, TWIST } from "./data/homecomings.js";
import { AFTER, HOUSE_IDS, startStandings, seatOf, houseForPretender, afterFall, afterSat, afterSwitch, envoyHouse, freshLine, isThirdNight, makeStranger, strangerStory, fill, nextHomecoming } from "./rules.js";
import { COMPANIES, ULFA, DOOR_OPENS, DOOR_AGAIN } from "./data/deep.js";
import { DEEP_DESIGN } from "./data/deep_design.js";
import { DEEP, toWorld, toLocal, inDeep, inBellRoom, companySpots, companyBodies, SERJEANT, guardBonus, standingCompanies, ulfaMayRise } from "./deep_rules.js";
import "./chairs.js";
import "./homecomings.js";
import "./deep.js";

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
  "Deep: five companies, each with a serjeant, lines for every choice, and no bowman statues": () => {
    assertEqual(COMPANIES.length, 5);
    assertEqual(new Set(COMPANIES.map((c) => c.id)).size, 5);
    for (const c of COMPANIES) {
      assert(c.name && c.serjeant && c.free && c.led && c.rest && c.keepsake && c.held.length >= 2, c.id);
      assert(c.statues.length && c.statues.every((t) => t.startsWith("siege:grey_") && t !== "siege:grey_bowman"), `${c.id} statues`);
      const bodies = companyBodies(c);
      assertEqual(bodies.length, DEEP.companyX.length);
      assertEqual(bodies[SERJEANT], "siege:grey_serjeant");
    }
  },
  "Deep: nobody names him, and no name clashes with Everwake's people": () => {
    const text = JSON.stringify({ COMPANIES, ULFA, DOOR_OPENS, DOOR_AGAIN });
    assert(!/oswin|morvane/i.test(text), "the Deep names him");
    assert(!/ansel|tamsin|hedda|corvin|orrin|wren/i.test(text), "a name Everwake already uses");
  },
  "Deep: spots go to the world and back, and the box knows who is inside": () => {
    const w = toWorld(DEEP.note);
    assertEqual(toLocal(w), DEEP.note);
    assert(inDeep(toWorld(DEEP.arrive)) && inDeep(toWorld(DEEP.arena)) && !inDeep(DEEP.up), "the Vault is not the Deep");
    assert(inBellRoom(toWorld(DEEP.arena)) && !inBellRoom(toWorld(DEEP.note)) && !inBellRoom(toWorld(DEEP.arrive)));
    assert(DEEP.origin.y + DEEP.box.y1 < 40, "the Deep must stay below the Hollow's lowest floor");
  },
  "Deep: leading a company out is worth two guards to whoever led, nobody else": () => {
    assertEqual(guardBonus({ a: 2 }, "a"), 4);
    assertEqual(guardBonus({ a: 2 }, "b"), 0);
    assertEqual(guardBonus(undefined, "a"), 0);
    assertEqual(standingCompanies({ rope: { fate: "led" }, thane: { fate: "rest" } }).map((c) => c.id), ["shield", "fell", "cutters"]);
  },
  "Deep: Ulfa wakes the first time, then not again until the next day, and never twice at once": () => {
    assert(ulfaMayRise({ defeated: 0 }));
    assert(!ulfaMayRise({ defeated: 0, fighting: true }));
    assert(!ulfaMayRise({ defeated: 1, fellOnDay: 9, today: 9 }));
    assert(ulfaMayRise({ defeated: 1, fellOnDay: 9, today: 10 }));
  },
  "Deep: the halls are open where players and the Host stand, with floor under them": () => {
    const solid = new Set();
    for (const [y, z, x0, n] of DEEP_DESIGN.rows) for (let x = x0; x < x0 + n; x++) solid.add(`${x},${y},${z}`);
    const open = (p, dy = 0) => !solid.has(`${p.x},${p.y + dy},${p.z}`);
    const spots = [DEEP.arrive, DEEP.arena, { ...DEEP.note, z: DEEP.note.z - 4 }];
    for (let k = 0; k < COMPANIES.length; k++) spots.push(...companySpots(k));
    for (const p of spots) {
      assert(open(p) && open(p, 1), `blocked at ${JSON.stringify(p)}`);
      assert(!open(p, -1), `nothing under ${JSON.stringify(p)}`);
    }
    assert(!open(DEEP.bell), "the bell that takes you up");
    for (let y = DEEP.seal.y0; y <= DEEP.seal.y1; y++) assert(!open({ x: 0, y, z: DEEP.seal.z }), "the Seal is drawn shut");
    const b = DEEP_DESIGN.box;
    assertEqual([b.x0, b.x1, b.y0, b.y1, b.z0, b.z1], [DEEP.box.x0, DEEP.box.x1, DEEP.box.y0, DEEP.box.y1, DEEP.box.z0, DEEP.box.z1]);
  },
});
