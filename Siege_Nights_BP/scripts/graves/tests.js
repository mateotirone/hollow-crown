import { addTests, assert, assertEqual } from "../core/tests.js";
import { GRAVE_PARTS, LOCK_MS, facingOf, partsAt, findSpot, mayOpen, waitText, armorSlotOf, killerOf, newGrave } from "./data.js";

addTests("graves", {
  "the build has one headstone, one candle, and an odd footprint": () => {
    assertEqual(GRAVE_PARTS.filter((p) => p[4] === "stone").length, 1);
    assertEqual(GRAVE_PARTS.filter((p) => p[4] === "candle").length, 1);
    const xs = GRAVE_PARTS.map((p) => p[0]), zs = GRAVE_PARTS.map((p) => p[2]);
    assertEqual((Math.max(...xs) - Math.min(...xs) + 1) % 2, 1, "width odd");
    assertEqual((Math.max(...zs) - Math.min(...zs) + 1) % 2, 1, "length odd");
    assert(GRAVE_PARTS.find((p) => p[4] === "stone").slice(0, 3).every((v) => v === 0), "headstone at the origin");
  },
  "the mound always lies in front of the headstone, whichever way it faces": () => {
    for (const [facing, dx, dz] of [["south", 0, 1], ["north", 0, -1], ["east", 1, 0], ["west", -1, 0]]) {
      const parts = partsAt({ x: 10, y: 64, z: 10 }, facing);
      const stone = parts.find((p) => p.role === "stone");
      assertEqual([stone.x, stone.y, stone.z].join(), "10,64,10", facing);
      const mound = parts.filter((p) => p.id.endsWith("moss_carpet"));
      assert(mound.length && mound.every((p) => (p.x - 10) * dx + (p.z - 10) * dz > 0), `${facing}: mound in front`);
    }
  },
  "a grave faces the way the player was looking": () => {
    assertEqual(facingOf(0), "south");
    assertEqual(facingOf(90), "west");
    assertEqual(facingOf(180), "north");
    assertEqual(facingOf(-90), "east");
    assertEqual(facingOf(359), "south");
  },
  "the headstone goes on the nearest free cell with ground under it": () => {
    // flat ground at y = 63 (solid), air above, except the death cell is a wall
    const kind = (x, y, z) => (y <= 63 ? "solid" : x === 0 && z === 0 && y === 64 ? "solid" : "free");
    const spot = findSpot({ x: 0.5, y: 64, z: 0.5 }, kind);
    assertEqual(JSON.stringify(spot), JSON.stringify({ x: 0, y: 65, z: 0 }), "on top of the block they died against");
    // the death cell itself on open ground
    const flat = (x, y, z) => (y <= 63 ? "solid" : "free");
    assertEqual(JSON.stringify(findSpot({ x: 5.2, y: 64, z: -3.7 }, flat)), JSON.stringify({ x: 5, y: 64, z: -4 }));
    // a lake: no ground anywhere near
    assertEqual(findSpot({ x: 0, y: 64, z: 0 }, (x, y) => (y <= 64 ? "liquid" : "free")), undefined);
    // a cell another grave holds is skipped
    const s2 = findSpot({ x: 0, y: 64, z: 0 }, flat, (x, y, z) => x === 0 && z === 0);
    assert(s2 && !(s2.x === 0 && s2.z === 0), "skips a taken cell");
  },
  "a grave is sealed to all but its owner until its time is up; a player kill opens it at once": () => {
    const g = newGrave(1, { owner: "a", name: "A", dim: "minecraft:overworld", at: { x: 0, y: 0, z: 0 }, facing: "south", cells: [], now: 1000 });
    assert(mayOpen(g, "a", 1000), "owner opens at once");
    assert(!mayOpen(g, "b", 1000 + LOCK_MS - 1), "others wait");
    assert(mayOpen(g, "b", 1000 + LOCK_MS), "then anyone");
    const pvp = newGrave(2, { owner: "a", name: "A", dim: "minecraft:overworld", at: { x: 0, y: 0, z: 0 }, facing: "south", cells: [], killer: "B", now: 1000 });
    assert(mayOpen(pvp, "b", 1000), "player kill: open to anyone");
  },
  "only another player counts as a killer": () => {
    assertEqual(killerOf("a", { typeId: "minecraft:player", id: "b" })?.id, "b");
    assertEqual(killerOf("a", { typeId: "minecraft:player", id: "a" }), undefined);
    assertEqual(killerOf("a", { typeId: "minecraft:zombie", id: "z" }), undefined);
    assertEqual(killerOf("a", undefined), undefined);
  },
  "countdowns and armour slots read right": () => {
    assertEqual(waitText(65000), "1 min 05 s");
    assertEqual(waitText(9000), "9 s");
    assertEqual(armorSlotOf("minecraft:iron_helmet"), "Head");
    assertEqual(armorSlotOf("minecraft:diamond_chestplate"), "Chest");
    assertEqual(armorSlotOf("minecraft:leather_leggings"), "Legs");
    assertEqual(armorSlotOf("minecraft:netherite_boots"), "Feet");
    assertEqual(armorSlotOf("minecraft:bread"), undefined);
  },
});
