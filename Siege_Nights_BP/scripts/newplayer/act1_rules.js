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
import { SETTLEMENT } from "./mode_rules.js";

export const DUSK = 12000; // time of day: supper, and the ravens on the wall
export const MIDNIGHT = 18000; // the first raid stops waiting for you
export const ELSPETH_TAG = "siege_lore_npc_elspeth";

// Flags (lore progress) that each talk with Elspeth or Wren leaves behind
export const F = {
  met: "elspeth_met", workshop: "elspeth_workshop", barracks: "elspeth_barracks", wheat: "elspeth_wheat",
  station: "elspeth_station", sundown: "elspeth_sundown", ravens: "elspeth_ravens", raid: "elspeth_raid",
  ember: "elspeth_ember", wrenMet: "wren_met", wrenLead: "wren_lead", aldous: "aldous_met", mine: "elspeth_mine",
};

// Settlement Mode (mode_rules.js): the same guide with no story. After the raid Elspeth leads the settlement from
// Hamlet to Castle; a talk with her opens each tier's step ("talk_grow_<tier>" leaves the flag growFlag(tier)).
export const growFlag = (tier) => `elspeth_grow_${tier}`;
export const NEXT_TIER = ["Town", "City", "Castle"];

// Is Act 1 this player's story right now? Not after Sir Aldous, and not for a keep that held sieges before
// Elspeth existed (old worlds keep the story they were on). In Settlement Mode her guide is always on: it is the
// whole of what leads the player, from landing to Castle.
export function inAct1(f) {
  if (f?.mode === SETTLEMENT) return true;
  if (!f || f.morvane || f.flags.includes(F.aldous)) return false;
  if (f.flags.includes(F.met)) return true;
  return (f.sieges ?? 0) === 0 && !f.lost;
}

// f = { flags, keep (a banner standing), sieges (sieges this keep has seen), lost (the banner fell in the first
//       raid and is not up again yet), chest (founder's chest opened), workshop (opened the Workshop), first (the
//       first-nights facts: barracks, plot, price, guards, ballistas), sold (wheat sold), bread (baked since she
//       asked), station { found }, siegeDay (tonight is this keep's first siege night), time (of day), home (inside
//       your walls), ember: "none" | "fallen" | "held" (picked up or used), aldousHere,
//       mine (found the mine shaft), ore (brought back coal and iron), smelted (has smelted iron),
//       wall (the settlement has a wall), mended (the wall was mended or found whole after the raid),
//       mode: "story" | "settlement", and in Settlement Mode grow: { tier, wins, winsNeed, warlords, warlordsNeed,
//       build: [names still to raise for this tier's charter] } }
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
    return mineStage(f) ?? "rest";
  }
  if (!has(F.raid)) return f.lost ? "talk_raid_lost" : "talk_raid_won";
  if (!f.keep) return "rebanner";
  if (f.mode === SETTLEMENT) return settleStage(f);
  if (f.wall && !f.mended && !has(F.wrenLead)) return "mend";
  if (!has(F.wrenLead)) return mineStage(f) ?? "wren"; // a mine left unfinished on day 2 comes before the long ride
  if (f.ember === "none" || !f.ember) return "ride_home";
  if (f.ember === "fallen") return "find_ember";
  if (!has(F.ember)) return "ask_ember";
  return f.aldousHere ? "aldous" : "sleep";
}
export const WHEAT_GOAL = 16;

// Settlement Mode after the raid: mend the wall, finish the mine if it was left, then grow tier by tier. Each
// tier opens with a talk at the hearth, so every step still comes from Elspeth.
function settleStage(f) {
  const tier = Math.max(0, Math.min(3, f.grow?.tier ?? 0));
  if (f.wall && !f.mended && tier === 0 && !f.flags.includes(growFlag(0))) return "mend";
  const mine = mineStage(f);
  if (mine) return mine;
  if (!f.flags.includes(growFlag(tier))) return `talk_grow_${tier}`;
  return tier >= 3 ? "rest" : "grow";
}

// Day 2's mine: Elspeth tells you of the old shaft, you find it, bring back coal and iron, and smelt the iron
function mineStage(f) {
  if (!f.flags.includes(F.mine)) return "talk_mine";
  if (!f.mine) return "mine";
  if (!f.ore) return "ore";
  if (!f.smelted) return "smelt";
  return undefined;
}

// The stages where Elspeth holds the next step: the tracker says "Talk to Old Elspeth"
export const TALK = new Set(["talk_grow_0", "talk_grow_1", "talk_grow_2", "talk_grow_3", "meet", "talk_workshop", "talk_barracks", "talk_wheat", "talk_station", "talk_mine", "talk_sundown", "talk_supper", "talk_raid_won", "talk_raid_lost", "ask_ember"]);
// The stages whose place is a story place: a light pillar stands over it (act1.js)
export const PILLAR = new Set(["wren", "find_ember"]);

// The tracker's line. p = places: { hearth, stone, chest, workshop, farmer, station, keep, millbrook, ember, aldous,
// mine (the pithead), furnace (the founder's house), mason }
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
    case "talk_mine": return talk("Talk to Old Elspeth", "You've found the station. She'll want to hear about it.");
    case "mine": return step("Find the old mine shaft", "Elspeth said there's an old shaft past your wall, with a wheel over it.", at("Mine shaft", p.mine));
    case "ore": return step("Bring back coal and iron", "Take the pickaxe from the founder's chest down the shaft. Coal is black-flecked stone; iron is speckled tan.", at("Mine shaft", p.mine),
      { note: [f.haveCoal ? "Coal: yes" : "Coal: not yet", f.haveIron ? "Iron: yes" : "Iron: not yet"].join(". ") + "." });
    case "smelt": return step("Smelt your iron at the furnace", "Elspeth said there's a furnace in your house. Iron in the top, coal underneath.", at("Furnace", p.furnace));
    case "mend": return step("Mend the wall", "Elspeth said: see to your wall before you go. The Mason in the yard will mend it, for a price.", at("The Mason", p.mason));
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
    // ---- Settlement Mode (after the raid)
    case "talk_grow_0": return talk("Talk to Old Elspeth", "The wall's whole. She said she'd tell you how a hall becomes a Town.");
    case "talk_grow_1": return talk("Talk to Old Elspeth", "Your Hamlet is a Town now. She'll want to hear it.");
    case "talk_grow_2": return talk("Talk to Old Elspeth", "Your Town is a City now. She'll want to hear it.");
    case "talk_grow_3": return talk("Talk to Old Elspeth", "Your City is a Castle now. Tell her.");
    case "grow": return growStep(f);
    case "aldous": return step("Talk to Sir Aldous about the Ember", "A knight is waiting at your keep. Hear him out, but give him nothing you haven't read.", at("Sir Aldous", p.aldous ?? p.keep),
      { npc: { tag: "siege_lore_npc_aldous", name: "Sir Aldous" } });
    default: return undefined;
  }
}

// Settlement Mode's growing step: the next tier, the siege nights still to hold, and what the charter still wants.
// g = f.grow { tier, wins, winsNeed, warlords, warlordsNeed, build: [names] }
export function growStep(f = {}) {
  const g = f.grow ?? {};
  const tier = Math.max(0, Math.min(2, g.tier ?? 0));
  const next = NEXT_TIER[tier];
  const notes = [`Siege nights held: ${Math.min(g.wins ?? 0, g.winsNeed ?? 0)} of ${g.winsNeed ?? 0}.`];
  if (g.warlordsNeed) notes.push(`Warlords slain: ${Math.min(g.warlords ?? 0, g.warlordsNeed)} of ${g.warlordsNeed}.`);
  const build = g.build ?? [];
  notes.push(build.length ? `Still to raise: ${build.join(", ")}.` : "Every building the charter asks for stands.");
  const hint = build.length
    ? "Elspeth said: hold your siege nights, and raise what the charter asks on your Plot Markers. Your Plan Book lists it."
    : "Elspeth said: hold your siege nights. The ravens on the wall tell you when one is coming.";
  return { id: "act1_grow", title: `Grow to a ${next}`, hint, note: notes.join(" ") };
}
