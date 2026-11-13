import { addTests, assert, assertEqual } from "../core/tests.js";
import { NEWS, leaks, killerName, deathLine } from "./rules.js";
import { aOrAn, withArticle } from "../core/grammar.js";
import { DEFAULTS } from "../core/gamerules.js";

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
    assertEqual(deathLine({ ...sample, kind: "creature", killer: "Grey Axeman" }, ctx), "§7Sam fell to a Grey Axeman near Kingsrest.");
    assertEqual(deathLine({ ...sample, kind: "player", killer: "Ana" }, ctx), "§cSam was slain by Ana near Kingsrest.");
    assert(!leaks(deathLine({ ...sample, kind: "creature", killer: "Hollow Footman" }, ctx)));
    assertEqual(NEWS.enginePlaced({ ...sample, firstFor: undefined }, ctx), null);
  },
  "streaks are cried at milestones and when broken": () => {
    assertEqual(NEWS.siegeStreak({ settlement: "Sam", streak: 4 }, ctx), null);
    assert(NEWS.siegeStreak({ settlement: "Sam", streak: 5 }, ctx).includes("5 siege nights in a row"));
    assert(NEWS.siegeStreak({ settlement: "Sam", streak: 0, lost: 7 }, ctx).includes("after 7 nights"));
    assertEqual(NEWS.siegeStreak({ settlement: "Sam", streak: 0, lost: 0 }, ctx), null);
  },
  "a death is told once, by the Crier, with the game's own death line and command replies off": () => {
    assertEqual(DEFAULTS.showDeathMessages, false);
    assertEqual(DEFAULTS.sendCommandFeedback, false);
    assert(!NEWS.playerFell, "deaths are not a broadcast news event (news/index.js tells each player their own line)");
  },
  "a death line says an Ash Scarab, not a Ash Scarab": () => {
    assertEqual(deathLine({ ...sample, kind: "creature", killer: "Ash Scarab" }, ctx), "§7Sam fell to an Ash Scarab near Kingsrest.");
    assertEqual(deathLine({ ...sample, kind: "creature", killer: "Echo Hound", cause: "projectile" }, ctx), "§7Sam was shot down by an Echo Hound near Kingsrest.");
    assertEqual(deathLine({ ...sample, kind: "boss", killer: "The Ash Seneschal" }, ctx), "§cSam fell to The Ash Seneschal near Kingsrest.");
    assertEqual(deathLine({ ...sample, kind: "creature", killer: "Ulfa, the Bell-Wife" }, ctx), "§7Sam fell to Ulfa, the Bell-Wife near Kingsrest.");
  },
  "deaths with no killer still get one line": () => {
    assertEqual(deathLine({ ...sample, kind: undefined, killer: undefined, cause: "fall" }, ctx), "§7Sam fell from a height near Kingsrest.");
    assertEqual(deathLine({ ...sample, kind: undefined, killer: undefined, cause: "somethingNew" }, ctx), "§7Sam died near Kingsrest.");
  },
  "killed in a settlement: others hear only that they died, the victim hears what did it": () => {
    const d = { ...sample, kind: "creature", killer: "Grey Axeman", home: true };
    assertEqual(deathLine(d, ctx), "§7Sam has died.");
    assertEqual(deathLine(d, ctx, { full: true }), "§7Sam fell to a Grey Axeman near Kingsrest.");
  },
  "a or an": () => {
    for (const [w, a] of [["Ash", "an"], ["Grey", "a"], ["Echo", "an"], ["Inquisitor", "an"], ["Unicorn", "a"], ["Umbral", "an"], ["hour", "an"], ["Hound", "a"], ["One-Eyed", "a"], ["§cAsh", "an"], ["", "a"]])
      assertEqual(aOrAn(w), a, w);
    assertEqual(withArticle("The Pale Huntsman"), "The Pale Huntsman");
    assertEqual(withArticle("Archer"), "an Archer");
  },
});
