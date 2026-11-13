// The battle test's layout and armies (pure: no Minecraft). index.js builds and runs it.
//
// Everything is placed relative to the castle's centre C (where you stand), with the gate to the south (+z).
// Positions are { dx, dz }; a building's origin is its front, and it rises the way `f` points (settle/plans.js).

import { WALLS } from "../settle/walldata.js";

export const TEST = {
  castle: "hc_test_castle",      // the stand-in owner of the castle when you attack it
  warband: "hc_test_warband",    // the stand-in owner of the army that attacks you
  castleName: "the Test Castle",
  warbandName: "the Test Warband",
  wallLevel: 10,                 // Crown Wall: towers, gatehouse, portcullis
  gateBearing: 180,              // south
  campOut: 135,                  // the camp's Keep Banner, this far from C through the gate
  vaultTier: "iron",
  purse: 20000,                  // Regals each stand-in starts with (retraining and bounties come out of it)
  musterAttack: 3400,            // ticks between the start and nightfall when you attack (time to ride out)
  musterDefend: 2000,            // ...and when you defend (time to watch the crews set up)
  clearHeight: 28,               // blocks of air cleared above the ground
  buildWaitTicks: 20 * 150,      // give up waiting for the wall and vault after this long
};

// Stand-in owners the test may create and clear
export const TEST_OWNERS = [TEST.castle, TEST.warband];

// Inside the wall (gate south): a working castle town
export const BUILDINGS = [
  { id: "storehouse", dx: 0, dz: -30, f: { x: 0, z: -1 } },
  { id: "inn", dx: -24, dz: -16, f: { x: -1, z: 0 } },
  { id: "library", dx: 24, dz: -16, f: { x: 1, z: 0 } },
  { id: "smithy", dx: -24, dz: 14, f: { x: -1, z: 0 } },
  { id: "stable", dx: 26, dz: 18, f: { x: 1, z: 0 } },
  { id: "well", dx: 0, dz: -12, f: { x: 0, z: -1 } },
  { id: "watchtower", dx: -22, dz: 36, f: { x: 0, z: 1 } },
  { id: "watchtower", dx: 22, dz: 36, f: { x: 0, z: 1 } },
  { id: "market", dx: -9, dz: 34, f: { x: -1, z: 0 } },
];
export const VAULT = { dx: 12, dz: 2, f: { x: 1, z: 0 } };      // the stairs go down east
export const BARRACKS_AT = { dx: -12, dz: 24 };
export const CAMP_BARRACKS = { dx: 5, dz: 0 };                  // from the camp's Keep Banner
export const BALLISTAS = [{ dx: -6, dz: 50 }, { dx: 6, dz: 50 }, { dx: -34, dz: 34 }, { dx: 34, dz: 34 }];

// Who fights. post: "wall" = a post on the wall (bowmen), "barracks" = waits at the Barracks.
// Armour tiers cycle 0..4 down each list, so every look shows up.
export const DEFENDERS = [
  { type: "siege:archer", n: 6, post: "wall" },
  { type: "siege:crossbowman", n: 4, post: "wall" },
  { type: "siege:man_at_arms", n: 4, post: "barracks" },
  { type: "siege:pikeman", n: 3, post: "barracks" },
  { type: "siege:shieldbearer", n: 3, post: "barracks" },
  { type: "siege:knight", n: 2, post: "barracks" },
];
export const ATTACKERS = [
  { type: "siege:knight", n: 2 },
  { type: "siege:man_at_arms", n: 4 },
  { type: "siege:pikeman", n: 3 },
  { type: "siege:shieldbearer", n: 3 },
  { type: "siege:crossbowman", n: 3 },
  { type: "siege:archer", n: 3 },
  { type: "siege:trebuchet_crew", n: 2 },
  { type: "siege:ram_crew", n: 1 },
  { type: "siege:sapper", n: 2 },
];

// One entry per soldier: { type, post?, tier, i }
export function roll(list) {
  const out = [];
  for (const row of list) for (let k = 0; k < row.n; k++) out.push({ type: row.type, post: row.post, tier: out.length % 5, i: out.length });
  return out;
}

// Where soldier i of n stands in a block of ranks, 6 abreast, 2 blocks apart, around (x, z), facing +z/-z
export function rankSpot(center, i, facing = -1) {
  const col = i % 6, row = Math.floor(i / 6);
  return { x: center.x + (col - 2.5) * 2, z: center.z - facing * row * 2 };
}

// The camp: on the line from C through the gate, campOut blocks out
export function campAt(C, gateOutside) {
  const dx = (gateOutside?.x ?? C.x) - C.x, dz = (gateOutside?.z ?? C.z + 1) - C.z, d = Math.hypot(dx, dz) || 1;
  return { x: Math.round(C.x + (dx / d) * TEST.campOut), y: C.y, z: Math.round(C.z + (dz / d) * TEST.campOut) };
}

// The ground the test clears: the castle (inside its outer ring) and the field out to the camp, as boxes
// of at most 100 chunks each (one ticking area each)
export function areas(C, camp) {
  const r = WALLS.radius + WALLS.wobble.out + 2;
  const castle = { x0: C.x - r, z0: C.z - r, x1: C.x + r, z1: C.z + r };
  const field = {
    x0: Math.min(C.x, camp.x) - 40, x1: Math.max(C.x, camp.x) + 40,
    z0: Math.min(camp.z, C.z + r) - (camp.z < C.z ? 40 : 0), z1: Math.max(camp.z, C.z + r) + (camp.z > C.z ? 40 : 0),
  };
  return { castle, field };
}
export const chunksIn = (b) => (Math.floor(b.x1 / 16) - Math.floor(b.x0 / 16) + 1) * (Math.floor(b.z1 / 16) - Math.floor(b.z0 / 16) + 1);

// The 16x16 columns of a box, for clearing one at a time
export function columns(b) {
  const out = [];
  for (let x = b.x0; x <= b.x1; x += 16) for (let z = b.z0; z <= b.z1; z += 16) out.push({ x0: x, z0: z, x1: Math.min(b.x1, x + 15), z1: Math.min(b.z1, z + 15) });
  return out;
}

// What to watch for, by mode (sent in chat when the battle starts)
export const WATCH = {
  attack: [
    "Your soldiers mount up at the camp and ride behind you, two abreast",
    "Within about 40 blocks of their land they get off their horses (Knights stay mounted)",
    "Trebuchet crews walk out about 40 blocks from the wall and unfold their trebuchets",
    "Their gate is barred from the declaration until dawn",
    "Nightfall: the siege bar counts down to dawn on your action bar",
    "Ram crew rams the gate, sappers plant charges away from the gate, trebuchets keep hitting one spot",
    "Shieldbearers cover the crews, crossbowmen and archers hang back and shoot",
    "Their pikemen and shieldbearers brace across the gate and any breach",
    "You are Wanted on their land: their archers and Men-at-Arms come for you",
    "Fallen soldiers retrain at the Barracks after the siege; bounties land in your Regals",
    "Break their vault lock with the Vault Breaker: you win and the vault lies open until dawn",
    "Die (switch to Survival, /kill @s): the assault collapses and they win",
  ],
  defend: [
    "The Test Warband declares war: your gate shuts and stays shut",
    "Their crews walk out and unfold trebuchets while it is still day",
    "Nightfall: your Men-at-Arms leave the Barracks, bowmen hold the wall posts",
    "Your pikemen and shieldbearers brace across the gate, and across the breach once there is one",
    "Their Knights ride at your archers first; their trebuchets, ram and sappers break the wall",
    "Walls crack, chunks fall and leave rubble slopes; the gate can be rammed down",
    "Kill their warlord (the named Knight): the attack collapses and you win",
    "Hold until dawn and you win; die in Survival and you watch as a ghost until it ends",
  ],
  raid: [
    "Blow the War Horn: a Siege Night starts, the Grand Siege of the Warlord King (a Castle's siege)",
    "Three assaults from two sides, ravager rams and sappers from the first wave",
    "The Keep Heart rises; the sidebar shows waves, raiders and keep health",
    "Ballistas fire at raiders; archers man the wall posts; a wingman dragon burns raiders over the keep",
    "The Warlord King leads the last assault; kill him for a warlord kill",
    "Win: Siege Broken title and pay; you can't sleep while it lasts",
  ],
};
