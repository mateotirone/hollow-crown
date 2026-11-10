// Land protection and borders.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.

import { world, system, MolangVariableMap } from "@minecraft/server";
import { CHARGE, COLORS, DYE_RGB, KEEP_BANNER } from "./constants.js";
import { keepFallen } from "./keep.js";
import { saveState, state } from "./state.js";
import { foreignSettlement, settlementAt, tierOf, landRadius } from "./territory.js";
import { isOnline, title } from "./util.js";

// ---------- Borders: see where land begins, and get told when you cross ----------

export const lastLand = new Map(); // player id -> owner id of the land they're standing in

export function borderTick() {
  for (const player of world.getPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const loc = player.location;

    const here = settlementAt(loc) ?? null;
    const before = lastLand.get(player.id) ?? null;
    if (here !== before) {
      lastLand.set(player.id, here);
      if (here) {
        const keep = state.keeps[here];
        const whose = here === player.id ? "your" : `${keep.name}'s`;
        player.onScreenDisplay.setActionBar(`§6Entering ${whose} ${tierOf(keep).name}`);
      } else if (before && state.keeps[before]) {
        player.onScreenDisplay.setActionBar("§7Entering the wilds");
      }
    }

    // Draw the nearby stretch of each border in that settlement's banner color
    for (const keep of Object.values(state.keeps)) {
      const r = landRadius(keep);
      const cx = keep.x + 0.5;
      const cz = keep.z + 0.5;
      const d = Math.hypot(loc.x - cx, loc.z - cz);
      if (Math.abs(d - r) > 10) continue;
      const [cr, cg, cb] = DYE_RGB[COLORS[keep.color ?? 14]];
      const vars = new MolangVariableMap();
      vars.setColorRGB("variable.color", { red: cr / 255, green: cg / 255, blue: cb / 255 });
      const angle = Math.atan2(loc.z - cz, loc.x - cx);
      for (let k = -8; k <= 8; k++) {
        const a = angle + (k * 1.5) / r;
        for (const dy of [0.2, 1.2]) {
          try {
            player.spawnParticle("minecraft:redstone_wire_dust_particle",
              { x: cx + Math.cos(a) * r, y: loc.y + dy, z: cz + Math.sin(a) * r }, vars);
          } catch {
            // particle position not loaded
          }
        }
      }
    }
  }
}

// ---------- Land protection ----------
// Inside someone else's settlement you can't break, build or dig. The only ways in are
// through the gate, a Breaching Charge, or a raid's battering rams. While the owner is
// offline nothing in their settlement can be broken at all.


world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (!state) return;
  const { player, block } = event;
  const owner = foreignSettlement(player, block.location, block.dimension.id);
  if (!owner) return;
  // An enemy can carry off your Keep Banner, but only while you're online to defend it
  if (block.typeId === KEEP_BANNER && isOnline(owner)) return;
  event.cancel = true;
  const name = state.keeps[owner]?.name ?? "another player";
  system.run(() => player.onScreenDisplay.setActionBar(isOnline(owner)
    ? `§cThis is ${name}'s land. Use a Breaching Charge or come in through the gate.`
    : `§c${name} is away. Their settlement can't be touched until they return.`));
});

// Building inside someone else's settlement isn't allowed, except Breaching Charges while they're online
export function placementAllowed(player, block, typeId) {
  const owner = foreignSettlement(player, block.location, block.dimension.id);
  if (!owner) return true;
  return typeId === CHARGE && isOnline(owner);
}

export const placeBefore = world.beforeEvents.playerPlaceBlock;
if (placeBefore) {
  placeBefore.subscribe((event) => {
    if (!state) return;
    const typeId = (event.permutationToPlace ?? event.permutationBeingPlaced)?.type.id;
    if (placementAllowed(event.player, event.block, typeId)) return;
    event.cancel = true;
    const player = event.player;
    system.run(() => player.onScreenDisplay.setActionBar("§cYou can't build on someone else's land."));
  });
}

// Explosions can't damage a settlement whose owner is offline
world.beforeEvents.explosion?.subscribe((event) => {
  if (!state || event.dimension.id !== "minecraft:overworld") return;
  const blocks = event.getImpactedBlocks();
  const safe = blocks.filter((b) => {
    const owner = settlementAt(b.location);
    return !owner || isOnline(owner);
  });
  if (safe.length !== blocks.length) event.setImpactedBlocks(safe);
});

// Taking someone's Keep Banner topples their settlement
world.afterEvents.playerBreakBlock.subscribe((event) => {
  if (!state || event.brokenBlockPermutation.type.id !== KEEP_BANNER) return;
  const loc = event.block.location;
  const owner = Object.keys(state.keeps).find((o) => {
    const k = state.keeps[o];
    return k.x === loc.x && k.y === loc.y && k.z === loc.z;
  });
  if (!owner) return;
  const taker = event.player;
  if (owner === taker.id) return; // checkKeeps handles abandoning your own
  const name = state.keeps[owner].name;
  if (state.active) {
    keepFallen(owner);
  } else {
    delete state.keeps[owner];
    saveState();
  }
  for (const p of world.getPlayers()) {
    if (p.id === owner) title(p, "§4Your Keep Banner was taken!", `§7${taker.name} captured it. Raise a new one.`);
    else p.sendMessage(`§6${taker.name} captured ${name}'s Keep Banner!`);
  }
});
