// Act 1, "The Counted Nights" (story-and-gameplay pass, Mateo 2026-11-14): from landing on your plot to Sister
// Wren's first mission and the Ember. Days 1-3 teach the settlement, Old Elspeth at your hall's hearth hands out every
// step, nobody warns you a raid is coming until she points out the ravens at dusk on the first siege day, and the
// story begins after that raid. Plan: the "Story and Gameplay Plan" doc, Act 1 (FINAL); words: lore/data/dialogue.js
// "elspeth" and "wren".
//
// Mateo's rules for it: every step comes from someone (Elspeth, Wren, a book or your own thought), so a step whose
// next move is held by a person reads "Talk to <them>"; the minimap always pins where to go; a light pillar stands
// over story places; the tracker shows at most three lines.
//
// Pure (no Minecraft): act1Stage(f) says where a player is, act1Step(stage, f) is the tracker's line for it.
// newplayer/act1.js gathers f, quests/rules.js shows the step, lore/npcs.js picks Elspeth's scene by the stage.

import { firstStep } from "./firstnights.js";

export const DUSK = 12000; // time of day: supper, and the ravens on the wall
export const MIDNIGHT = 18000; // the first raid stops waiting for you
export const ELSPETH_TAG = "siege_lore_npc_elspeth";

// Flags (lore progress) that each talk with Elspeth or Wren leaves behind
export const F = {
  met: "elspeth_met", workshop: "elspeth_workshop", barracks: "elspeth_barracks", wheat: "elspeth_wheat",
  station: "elspeth_station", sundown: "elspeth_sundown", ravens: "elspeth_ravens", raid: "elspeth_raid",
  ember: "elspeth_ember", wrenMet: "wren_met", wrenLead: "wren_lead", aldous: "aldous_met",
};

// Is Act 1 this player's story right now? Not after Sir Aldous, and not for a keep that held sieges before
// Elspeth existed (old worlds keep the story they were on).
export function inAct1(f) {
  if (!f || f.morvane || f.flags.includes(F.aldous)) return false;
  if (f.flags.includes(F.met)) return true;
  return (f.sieges ?? 0) === 0 && !f.lost;
}

// f = { flags, keep (a banner standing), sieges (sieges this keep has seen), lost (the banner fell in the first
//       raid and is not up again yet), chest (founder's chest opened), workshop (opened the Workshop), first (the
//       first-nights facts: barracks, plot, price, guards, ballistas), sold (wheat sold), bread (baked since she
//       asked), station { found }, siegeDay (tonight is this keep's first siege night), time (of day), home (inside
//       your walls), ember: "none" | "fallen" | "held" (picked up or used), aldousHere }
export function act1Stage(f) {
  if (!inAct1(f)) return undefined;
  const has = (flag) => f.flags.includes(flag);
  if (!has(F.met)) return "meet";
  const raided = (f.sieges ?? 0) > 0 || f.lost;
  if (!raided) {
    if (!f.keep) return "banner";
    if (f.siegeDay) {
      if ((f.time ?? 0) < DUSK) return has(F.sundown) ? "home" : "talk_sundown";
      if (!f.home) return "raven";
      return has(F.ravens) ? "defend" : "talk_supper";
    }
    if (!f.chest) return "chest";
    if (!has(F.workshop)) return "talk_workshop";
    if (!f.workshop) return "workshop";
    if (!has(F.barracks)) return "talk_barracks";
    const fs = f.first ?? {};
    if (!fs.barracks && !fs.ballistas) return "barracks";
    if (fs.barracks && !fs.guards && !fs.ballistas) return "guards";
    if (!has(F.wheat)) return "talk_wheat";
    if ((f.sold ?? 0) < WHEAT_GOAL) return "sell";
    if (!f.bread) return "bread";
    if (!has(F.station)) return "talk_station";
    if (f.station && !f.station.found) return "station";
    return "rest";
  }
  if (!has(F.raid)) return f.lost ? "talk_raid_lost" : "talk_raid_won";
  if (!f.keep) return "rebanner";
  if (!has(F.wrenLead)) return "wren";
  if (f.ember === "none" || !f.ember) return "ride_home";
  if (f.ember === "fallen") return "find_ember";
  if (!has(F.ember)) return "ask_ember";
  return f.aldousHere ? "aldous" : "sleep";
}
export const WHEAT_GOAL = 16;

// The stages where Elspeth holds the next step: the tracker says "Talk to Old Elspeth"
export const TALK = new Set(["meet", "talk_workshop", "talk_barracks", "talk_wheat", "talk_station", "talk_sundown", "talk_supper", "talk_raid_won", "talk_raid_lost", "ask_ember"]);
// The stages whose place is a story place: a light pillar stands over it (act1.js)
export const PILLAR = new Set(["wren", "find_ember"]);

// The tracker's line. p = places: { hearth, stone, chest, workshop, farmer, station, keep, millbrook, ember, aldous }
// each { x, z } (or undefined); names the step's person for the "!" marker.
export function act1Step(stage, f = {}, p = {}) {
  if (!stage || stage === "rest") return undefined;
  const at = (name, spot) => (spot ? { name, x: spot.x, z: spot.z, dim: "minecraft:overworld" } : undefined);
  const elspeth = { tag: ELSPETH_TAG, name: "Old Elspeth" };
  const hearth = at("Old Elspeth", p.hearth);
  const talk = (title, hint) => ({ id: `act1_${stage}`, title, hint, target: hearth, npc: elspeth });
  const step = (title, hint, target, extra = {}) => ({ id: `act1_${stage}`, title, hint, target, ...extra });
  switch (stage) {
    case "meet": return talk("Talk to Old Elspeth", "Someone here should know what to do with this place. An old woman sits by the hearth in your hall.");
    case "banner": return step("Raise your banner", "Elspeth said: touch the Plot Stone outside and raise your banner.", at("Plot Stone", p.stone));
    case "chest": return step("Open the founder's chest", "Someone left a chest in your house. See what's in it.", at("Founder's chest", p.chest));
    case "talk_workshop": return talk("Talk to Old Elspeth", "Your banner is up. Tell her.");
    case "workshop": return step("Open your Workshop", "Elspeth said nothing gets built without it. It stands in the Mason's Yard, beside the bench.", at("Workshop", p.workshop));
    case "talk_barracks": return talk("Talk to Old Elspeth", "The Workshop is yours. See what she wants next.");
    case "barracks":
    case "guards": {
      const s = firstStep({ keep: true, ...(f.first ?? {}) }); // the Barracks plot, rising, its block, or the guards
      return s ? { ...s, id: `act1_${stage}`, note: undefined } : undefined;
    }
    case "talk_wheat": return talk("Talk to Old Elspeth", "Your men are hired. Ask her what's next.");
    case "sell": return step(`Sell ${WHEAT_GOAL} wheat to the Farmer`, "Elspeth said the first harvest of a new lord fetches a good price. Cut the field and take him sixteen.",
      at("Your Farmer", p.farmer), { note: f.sold ? `${f.sold} of ${WHEAT_GOAL} sold.` : "", npc: p.farmerTag ? { tag: p.farmerTag, name: "your Farmer" } : undefined });
    case "bread": return step("Bake bread", "Keep the rest of the wheat, as she said. Three wheat at a crafting table makes a loaf.");
    case "talk_station": return talk("Talk to Old Elspeth", "The bread is baked. She'll want to hear it.");
    case "station": return step("Find your railway station", "Elspeth said the rail runs past your land. Ride your cob there: blow the Horse Whistle and it comes from anywhere.", at("Station", p.station));
    case "talk_sundown": return talk("Talk to Old Elspeth", "A new day. She'll have something to say about it.");
    case "home": return step("Be home by sundown", "Elspeth is putting supper on. Be inside your walls before dark.", at("Home", p.keep));
    case "raven": return step("Follow the raven home", "That bird keeps looping back. It wants you home. Blow your Horse Whistle and ride.", at("Home", p.keep));
    case "talk_supper": return talk("Talk to Old Elspeth", "Supper is on. Sit with her by the fire.");
    case "defend": return step("Defend your hall", "Shut your gate. Get on the wall with your men. Don't go out to meet it.", at("Your banner", p.keep));
    case "talk_raid_won": return talk("Talk to Old Elspeth about the raid", "What the heck just attacked you? She said she'd seen this before.");
    case "talk_raid_lost": return talk("Talk to Old Elspeth about the raid", "They pulled your banner down. What were they? She said she'd seen this before.");
    case "rebanner": return step("Raise your banner again", "Elspeth said: banners go back up. Click the Plot Stone and raise it.", at("Plot Stone", p.stone));
    case "wren": return f.flags?.includes(F.wrenMet)
      ? step("Talk to Sister Wren", "Ask her why it is always night in Millbrook.", at("Sister Wren", p.millbrook), { npc: { tag: "siege_lore_npc_wren", name: "Sister Wren" } })
      : step("Ride to Millbrook, find Sister Wren", "Elspeth said she keeps the old books, in the chapel at Millbrook, where it is always night. Take your cob and stay on the road.",
        at("Millbrook", p.millbrook), { npc: { tag: "siege_lore_npc_wren", name: "Sister Wren" } });
    case "ride_home": return step("Ride home", "Wren said: go home, find what was written about your land, and give the knights nothing you haven't read.", at("Home", p.keep));
    case "find_ember": return step("Find what fell", "Something came down by the gate. It's still glowing.", at("The light by the gate", p.ember));
    case "ask_ember": return talk("Ask Old Elspeth about the Ember", "Elspeth will know what this is.");
    case "sleep": return step("Sleep until morning", "Elspeth said a rider comes at first light. Sleep in your bed.", at("Home", p.keep));
    case "aldous": return step("Talk to Sir Aldous", "A knight is waiting at your keep. Hear him out, but give him nothing you haven't read.", at("Sir Aldous", p.aldous ?? p.keep),
      { npc: { tag: "siege_lore_npc_aldous", name: "Sir Aldous" } });
    default: return undefined;
  }
}
