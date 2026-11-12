import { addTests, assert, assertEqual } from "../core/tests.js";
import { LETTERS, rideSeconds, clock, cleanText, countdownLine, dueNow } from "./rules.js";

addTests("letters", {
  "a letter takes a couple of minutes, longer far away": () => {
    assertEqual(rideSeconds({ x: 0, z: 0 }, { x: 0, z: 0 }), LETTERS.minSeconds);
    assert(rideSeconds({ x: 0, z: 0 }, { x: 800, z: 0 }) > LETTERS.minSeconds);
    assertEqual(rideSeconds({ x: 0, z: 0 }, { x: 99999, z: 0 }), LETTERS.maxSeconds);
    assertEqual(rideSeconds(undefined, { x: 0, z: 0 }), LETTERS.maxSeconds);
  },
  "the countdown reads like a clock": () => {
    assertEqual(clock(102), "1:42");
    assertEqual(clock(0.2), "0:01");
    assertEqual(clock(-5), "0:00");
    const line = countdownLine([{ due: 60000 }, { due: 30000 }], 0);
    assert(line.includes("Your message is being delivered") && line.includes("0:30") && line.includes("+1 more"), line);
    assertEqual(countdownLine([], 0), "");
  },
  "letters are cleaned and only handed to someone here": () => {
    assertEqual(cleanText("  §cHi\n\nthere  "), "Hi there");
    assertEqual(cleanText("x".repeat(500)).length, LETTERS.maxLength);
    const letters = [{ to: "a", due: 5 }, { to: "b", due: 5 }, { to: "a", due: 50 }];
    assertEqual(dueNow(letters, 10, new Set(["a"])).length, 1);
  },
});
