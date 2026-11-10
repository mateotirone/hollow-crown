// The Source: where the Undertow's roots break into our world. One of 7 candidate cave shrines,
// picked at random the first time the world loads and never shown to anyone. The Rift tears
// open at the same spot, so finding the Source is finding the way in.
//
// The lore thread's clue tomes read the same pick ("hc:source_site") and the same site ids.
//
// Map builder: at each shrine, stand facing the cave wall, look at the wall block at floor
// level, and run  /scriptevent hc:mark_source_site <id>   (creative). A seam appears there.
// The crack that opens later is 14 tall and up to 7 wide, and eats 4 blocks into the wall,
// so leave that much solid rock behind and around the seam.

import { world, system, GameMode, EquipmentSlot } from "@minecraft/server";
import { load, save, loadPlain, savePlain, say, FACING } from "./data.js";
import { planSeam, placeCells, tearOpen, standPoint, SEAM } from "./rift.js";
import { TEXT } from "./layout.js";
import { sfx } from "../core/sfx.js";

export const SOURCE_SITE_IDS = [
  "drowned_chapel",
  "bellfounders_mine",
  "kings_barrow",
  "saltglass_grotto",
  "frostvein_hollow",
  "sunken_quarry",
  "witchroot_caves",
];
export const SITE_NAMES = {
  drowned_chapel: "The Drowned Chapel",
  bellfounders_mine: "The Bellfounder's Mine",
  kings_barrow: "The King's Barrow",
  saltglass_grotto: "The Saltglass Grotto",
  frostvein_hollow: "The Frostvein Hollow",
  sunken_quarry: "The Sunken Quarry",
  witchroot_caves: "The Witchroot Caves",
};

const K_SITE = "hc:source_site"; // the secret pick (shared with the lore thread)
const K_SITES = "hc:source_sites"; // { id: { x, y, z, facing } } where Mateo marked each shrine
const K_RIFT = "hc:rift"; // { open, site, x, y, z, facing } once the Rift is open
const K_SIGNS = "hc:source_signs"; // { sculk: n } slow creep counter

export const FORK = "siege:tuning_fork";
const OVERWORLD = "minecraft:overworld";

export function getSourceSite() {
  let id = loadPlain(K_SITE); // saved as the plain site id, not JSON
  if (typeof id !== "string" || !SOURCE_SITE_IDS.includes(id)) {
    id = SOURCE_SITE_IDS[Math.floor(Math.random() * SOURCE_SITE_IDS.length)];
    savePlain(K_SITE, id);
  }
  return id;
}
export const getSites = () => load(K_SITES, {});
export const getRift = () => load(K_RIFT, null);

function facingFromFace(face) {
  const f = String(face).toLowerCase();
  return FACING[f] ? f : undefined;
}

// /scriptevent hc:mark_source_site <id>
export function markSite(player, id) {
  if (!SOURCE_SITE_IDS.includes(id)) {
    say(player, `§cUnknown site "${id}". Use one of: ${SOURCE_SITE_IDS.join(", ")}`);
    return;
  }
  const hit = player.getBlockFromViewDirection({ maxDistance: 8 });
  const facing = hit && facingFromFace(hit.face);
  if (!hit || !facing || player.dimension.id !== OVERWORLD) {
    say(player, "§cLook straight at the cave wall (the block at floor level, from the side), within 8 blocks, in the Overworld.");
    return;
  }
  const b = hit.block.location;
  const sites = getSites();
  sites[id] = { x: b.x, y: b.y, z: b.z, facing };
  save(K_SITES, sites);
  placeCells(player.dimension, planSeam(b));
  const left = SOURCE_SITE_IDS.filter((s) => !sites[s]);
  say(player, `§d${SITE_NAMES[id]} recorded at ${b.x} ${b.y} ${b.z}, crack faces ${facing}.` + (left.length ? ` Still to mark: ${left.join(", ")}` : " All 7 sites are marked."));
}

function siteOfSeam(loc) {
  const sites = getSites();
  for (const [id, s] of Object.entries(sites)) {
    if (s.x === loc.x && s.z === loc.z && loc.y >= s.y && loc.y < s.y + 4) return id;
  }
  return undefined;
}

export function openRift(by) {
  const id = getSourceSite();
  const site = getSites()[id];
  if (!site) return { ok: false, why: `the picked site has not been marked yet` };
  const rift = getRift();
  if (rift?.open) return { ok: false, why: "the Rift is already open" };
  save(K_RIFT, { open: true, site: id, x: site.x, y: site.y, z: site.z, facing: site.facing, by: by?.name, day: world.getDay?.() });
  tearOpen(world.getDimension(OVERWORLD), site, site.facing, () => {
    world.sendMessage(TEXT.riftOpened);
    for (const p of world.getAllPlayers()) {
      try { sfx(p, "mob.warden.roar", { volume: 0.6, pitch: 0.5 }); } catch {}
    }
    try { system.sendScriptEvent("siege:undertow_rift_opened", JSON.stringify({ site: id, by: by?.name })); } catch {}
  });
  return { ok: true };
}

export function riftExit() {
  const r = getRift();
  return r ? standPoint(r, r.facing) : undefined;
}

// Striking a seam with the Tuning Fork.
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== SEAM || e.itemStack?.typeId !== FORK || !e.isFirstEvent) return;
  const player = e.player, loc = e.block.location;
  system.run(() => strike(player, loc));
});

function useUpFork(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (item?.typeId === FORK) eq.setEquipment(EquipmentSlot.Mainhand, undefined);
}

function strike(player, loc) {
  const site = siteOfSeam(loc);
  if (!site) {
    say(player, "§7The fork hums faintly and fades. This crack leads nowhere.");
    return;
  }
  const at = { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 };
  const real = site === getSourceSite();
  if (getRift()?.open) {
    say(player, real ? "§5The Rift is already open." : "§7Silence. Whatever lived here is long gone.");
    return;
  }
  useUpFork(player);
  if (!real) {
    try {
      sfx(player.dimension, "random.anvil_land", at, { volume: 1, pitch: 0.5 });
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", at);
    } catch {}
    say(player, "§7The fork rings against dead stone and shatters. Nothing answers here.");
    try { system.sendScriptEvent("siege:undertow_fork_failed", JSON.stringify({ site, player: player.name })); } catch {}
    return;
  }
  try { sfx(player.dimension, "block.bell.resonate", at, { volume: 2, pitch: 0.5 }); } catch {}
  say(player, "§dThe fork sings. Something on the other side of the stone sings back.");
  openRift(player);
}

// Signs at the real site: on siege nights a low bell tolls from the seam and violet motes drift
// out of it, and over the weeks sculk creeps across the rock around it. Decoys stay dead.
export function sourceSignsTick(isNight) {
  const id = getSourceSite();
  const site = getSites()[id];
  if (!site || getRift()?.open) return;
  const dim = world.getDimension(OVERWORLD);
  const at = { x: site.x + 0.5, y: site.y + 1.5, z: site.z + 0.5 };
  const near = world.getAllPlayers().some((p) => p.dimension.id === OVERWORLD && dist2(p.location, at) < 32 * 32);
  if (!near) return;
  try {
    if (isNight) sfx(dim, "block.bell.hit", at, { volume: 1.2, pitch: 0.35 });
    dim.spawnParticle("minecraft:portal_reverse_particle", at);
  } catch {}
  const signs = load(K_SIGNS, { sculk: 0 });
  if (signs.sculk < 40 && Math.random() < 0.15) {
    const [fx, fz] = FACING[site.facing];
    const x = site.x + fx + Math.round((Math.random() - 0.5) * 8);
    const z = site.z + fz + Math.round((Math.random() - 0.5) * 8);
    for (let y = site.y + 3; y >= site.y - 3; y--) {
      try {
        const b = dim.getBlock({ x, y, z }), above = dim.getBlock({ x, y: y + 1, z });
        if (b && above && !b.isAir && !b.isLiquid && above.isAir && b.typeId !== SEAM && !b.typeId.startsWith("siege:")) {
          b.setType("minecraft:sculk");
          signs.sculk++;
          save(K_SIGNS, signs);
          break;
        }
      } catch {
        break;
      }
    }
  }
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
