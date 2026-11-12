import { addTests, assert, assertEqual } from "../core/tests.js";
import { NEWS, leaks, killerName } from "./rules.js";

const ctx = { where: (dim) => (dim === "minecraft:overworld" ? "near Kingsrest" : "somewhere no map shows"), nameOf: () => "Sam" };
const player = { id: "p1", name: "Sam", location: { x: 0, y: 64, z: 0 } };
const sample = { player, owner: "p1", ownerName: "Sam", name: "The Pale Huntsman", first: true, handled: true, level: 3,
  dim: "minecraft:overworld", x: 0, z: 0, players: ["Sam", "Ana"], plot: { name: "Thornfield" }, station: { name: "Kingsrest Station" },
  lord: { name: "Lord Aldric", plot: "Thornfield" }, winner: { name: "Lord Aldric" }, loser: { name: "Lady Wren" },
  settlement: "Sam", streak: 10, firstFor: "Sam", itemName: "gold ingots", count: 32, price: 600, normal: 300, by: "Ana", victim: "Sam", killer: "The Pale Huntsman", kind: "boss" };

addTests("world news", {
  "every event has a line, and none names what is hidden": () => {
    for (const [event, words] of Object.entries(NEWS)) {
      const line = words(sample, ctx);
      assert(typeof line === "string" && line.length > 10, `${event} says something`);
      assert(!leaks(line), `${event} leaks: ${line}`);
    }
  },
  "hidden bosses are never named": () => {
    const line = NEWS.bossFightStarted({ ...sample, name: "The Hollow Choir", dim: "siege:undertow" }, ctx);
    assert(!leaks(line) && line.includes("no map"), line);
    assertEqual(NEWS.bossFightReset({ ...sample, name: "Oswin the Last" }, ctx), null);
  },
  "quiet when there is nothing new": () => {
    assertEqual(NEWS.keepFounded({ ...sample, moved: true }, ctx), null);
    assertEqual(NEWS.joined({ ...sample, first: false }, ctx), null);
    assertEqual(NEWS.wallUpgrade({ ...sample, handled: false }, ctx), null);
  },
  "no news of attacks on players' settlements (that is the Messenger's job)": () => {
    for (const event of ["settlementAttacked", "baseAttacked", "lordRaid", "keepFallen", "assaultSpawned", "vaultDrilled", "vaultBreached"]) assert(!NEWS[event], event);
  },
  "deaths name the killer, a first train only once": () => {
    assertEqual(killerName("§cThe Pale Huntsman §7(Rank II)", "siege:pale_huntsman"), "The Pale Huntsman");
    assertEqual(killerName("", "siege:grey_axeman"), "Grey Axeman");
    assertEqual(NEWS.playerFell({ ...sample, kind: "creature", killer: "Grey Axeman" }, ctx), "§7Sam fell to a Grey Axeman near Kingsrest.");
    assertEqual(NEWS.playerFell({ ...sample, kind: "player", killer: "Ana" }, ctx), "§cSam was slain by Ana near Kingsrest.");
    assert(!leaks(NEWS.playerFell({ ...sample, kind: "creature", killer: "Hollow Footman" }, ctx)));
    assertEqual(NEWS.enginePlaced({ ...sample, firstFor: undefined }, ctx), null);
  },
  "streaks are cried at milestones and when broken": () => {
    assertEqual(NEWS.siegeStreak({ settlement: "Sam", streak: 4 }, ctx), null);
    assert(NEWS.siegeStreak({ settlement: "Sam", streak: 5 }, ctx).includes("5 siege nights in a row"));
    assert(NEWS.siegeStreak({ settlement: "Sam", streak: 0, lost: 7 }, ctx).includes("after 7 nights"));
    assertEqual(NEWS.siegeStreak({ settlement: "Sam", streak: 0, lost: 0 }, ctx), null);
  },
});
