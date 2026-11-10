import { addTests, assert, assertEqual } from "../siege/api.js";
import { LOOKS } from "./data.js";
import { looksFor, reservedFor } from "./index.js";

addTests("looks", {
  "every look has its own number, id and name": () => {
    assert(LOOKS.length > 0, "the pack has no looks");
    assertEqual(new Set(LOOKS.map((l) => l.n)).size, LOOKS.length);
    assertEqual(new Set(LOOKS.map((l) => l.id)).size, LOOKS.length);
    assert(LOOKS.every((l) => Number.isInteger(l.n) && l.n >= 1 && l.n <= 64 && l.name), "a look is outside 1 to 64 or unnamed");
  },
  "a reserved look is only offered to its player": () => {
    const looks = [{ n: 1, id: "a", name: "A" }, { n: 2, id: "b", name: "B", player: "Dana" }];
    assertEqual(looksFor("Someone", looks).map((l) => l.id).join(), "a");
    assertEqual(looksFor("dana ", looks).map((l) => l.id).join(), "b,a");
    assertEqual(reservedFor("DANA", looks)?.id, "b");
    assertEqual(reservedFor("Someone", looks), undefined);
  },
});
