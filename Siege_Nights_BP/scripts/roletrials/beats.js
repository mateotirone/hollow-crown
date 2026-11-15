// Story spines for the Captain, the Witch and the Reeve, told in short beats like the Rider's cadets (roost.js).
//   Captain, loosely after Master and Commander: one long chase. The Sallow Lantern, last hull of the grey army's
//     second fleet, still sails off Saltreach on third nights. Holt sends word of every sighting while your trial
//     runs, your three hands get names, and the chase ends over the sunken chapel: the Lantern took the Bride on
//     her wedding day and set her back at the altar to shut the channel. Lay her down and the Lantern goes under.
//   Witch, loosely after Uprooted: Nell takes one apprentice a generation and doesn't take volunteers. The one
//     before you, Hester Wick, went into the reeds and came back wrong. End the Mother of Changelings and Hester
//     walks home right.
//   Reeve (the Vale, Mateo's pick 2026-11-15): Millbrook's office has stood empty since Anselm Tock stopped the clocks.
//     Edith Lammas, whose family have kept the seal in a drawer, fills the Reeve's barn with your first tithe and sets
//     you a quarrel to judge. End Tock's minute and the office is yours. Later (rank Reeve) she shows you his last
//     page: an order to hold the minute, under a seal somebody scraped off. He didn't choose it.
// Own names only. Words in lore/data/mentors.js for the scenes; these are the beats between them.

import { world, system } from "@minecraft/server";
import { on, addTests, assert, assertEqual } from "../siege/api.js";
import { trialsOf, save } from "./saves.js";

export const ROLE_BEATS = {
  trial_articles: "§8Holt's bosun walks you down the quay: Jory Holt, her nephew, who talks too much. \"Two more and you've a crew. Ask for Agnes Tarr, she can splice a line in the dark. And Wat Pellow. He can't do anything, but he's lucky.\"",
  trial_crew: "§8Jory, Agnes and Wat sign under your name. That night a fisherman puts in white-faced: a ship with no lights went past the Gull's Rest light, close enough to touch, and nobody aboard was steering. §3Holt:§8 \"The Sallow Lantern. Well. Now you've something to chase.\"",
  trial_captain_deed: "§8As the Bride lies down, the water over the sunken chapel heaves. Out past the tower a ship with no lights leans over and goes under, slowly, like someone sitting down after a long day. Wat Pellow is sick over the side. Agnes says nothing for an hour.",
  trial_cup: "§8On your way out, a girl on the Mirelight jetty is facing the wall of the smithy, very still. §2Nell, behind you:§8 \"Hester Wick. She was mine, before you. She went into the reeds after a lamb and came back a week later, and the lamb didn't. Don't stare. She knows.\"",
  trial_graves: "§2Nell:§8 \"I'll tell you why I didn't ask. Nobody chooses this. I watched you a whole season before I let you on the plank. I watched Hester too, and I was wrong about her, and the fen kept the difference.\"",
  trial_tithe: "§8Edith Lammas unlocks the Reeve's barn with a key the size of a trowel. Mice, cobwebs, and on the wall a painted tally of every harvest up to three hundred years ago, when it stops mid-stroke. She chalks yours in under it.",
  trial_moot: "§8Word of your judgement goes round Millbrook before you've left the square. A woman you've never met nods at you as if you'd always been there. In the dark, somebody has set the boundary stone straight.",
  trial_reeve_deed: "§8In Millbrook the six clocks are ticking. People stand in the square with their faces up, watching the hands move, and a child asks what the noise is. §aEdith Lammas,§8 at her window, holding a seal on a ribbon: \"Well. It's loose. Come and take it.\"",
  trial_witch_deed: "§8Next morning Hester Wick walks up the Mirelight jetty with the lamb under her arm, soaked to the waist, crying, and turns to face the right way. §2Nell, very quietly:§8 \"Oh. Oh, there you are.\"",
};

// What Holt hears after each siege night while you chase: one per siege night, then the trail goes quiet.
export const SIGHTINGS = [
  "§3Holt sends word:§7 the Sallow Lantern was seen off the Saltglass at moonrise, running east with no wind. Jory says he heard singing.",
  "§3Holt sends word:§7 a crabber found a lantern-hook in his pots, grey iron, the old fleet's mark. Agnes wants to rig a false light on the point and see what comes. Holt says no. Agnes is doing it anyway.",
  "§3Holt sends word:§7 Agnes's false light drew her in close. Two of the Gull's boats got a rope on her and the rope came back cut, cleanly, by nobody. Wat swears he saw the Bride's veil at her bow.",
  "§3Holt sends word:§7 every sighting this season sits in a ring round the sunken chapel. She isn't running. She's guarding something.",
];
export const sightingFor = (n) => SIGHTINGS[Math.min(n, SIGHTINGS.length - 1)];

on("loreFlag", ({ player, flag }) => {
  const beat = ROLE_BEATS[flag];
  if (!beat || !player) return;
  system.runTimeout(() => { try { player.sendMessage(beat); } catch { /* gone */ } }, 100);
});

// The chase: a sighting after each siege night, for anyone with a crew and the Bride still waiting
on("siegeEnd", () => {
  for (const player of world.getAllPlayers()) {
    try {
      const c = trialsOf(player).roles.captain;
      if (!c?.started || c.deed || !c.done.includes("crew")) continue;
      const n = c.sightings ?? 0;
      c.sightings = n + 1;
      save(player);
      system.runTimeout(() => { try { player.sendMessage(sightingFor(n)); } catch { /* gone */ } }, 200);
    } catch { /* not ready */ }
  }
});

addTests("roletrials", {
  "Captain, Witch and Reeve beats follow their trials, and the chase narrows": () => {
    for (const flag of ["trial_articles", "trial_crew", "trial_captain_deed", "trial_cup", "trial_graves", "trial_witch_deed", "trial_tithe", "trial_moot", "trial_reeve_deed"]) assert(ROLE_BEATS[flag], flag);
    assert(sightingFor(0).includes("Saltglass"));
    assertEqual(sightingFor(99), SIGHTINGS.at(-1), "the last sighting repeats once the trail closes in");
  },
});
