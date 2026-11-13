// "You are entering ..." on screen when a player walks into a town, one of the Order's houses, a story landmark, a
// Wonder or someone's settlement. Shown once on the way in: walking along an edge does not repeat it (see data.js
// placeAt), and the same place waits ENTERING.repeatSeconds before it can show again. The first look after a
// player joins or changes dimension is silent, so it never lands on top of the arrival titles.
// Free plots keep their own action-bar line (plots/claims.js) and the Citadel its own (crown/citadel.js).

import { world, system } from "@minecraft/server";
import { onTick } from "../core/loop.js";
import { isReady, getState, settlementAt, tierOf } from "../siege/api.js";
import { regionAt } from "../minimap/data.js";
import { ENTERING, placeAt, settlementCard, cardText } from "./data.js";
import "./tests.js";

const OVERWORLD = "minecraft:overworld";
const seen = new Map(); // player id -> { key: place key or null, shown: Map(key -> tick last shown) }

function settlementHere(player, loc) {
  const owner = settlementAt(loc);
  if (!owner) return null;
  const keep = getState().keeps?.[owner];
  if (!keep) return null; // extra claimed land with no keep of its own
  const card = settlementCard({ ownerName: keep.name, tier: tierOf(keep).name, mine: owner === player.id, region: regionAt(loc.x, loc.z) });
  return { key: `keep:${owner}`, ...card };
}

onTick("entering", ENTERING.checkTicks, () => {
  if (!isReady()) return;
  const now = system.currentTick;
  const here = new Set();
  for (const player of world.getPlayers()) {
    here.add(player.id);
    let s = seen.get(player.id);
    if (player.dimension.id !== OVERWORLD) { if (s) s.key = undefined; continue; }
    const loc = player.location;
    const place = settlementHere(player, loc) ?? placeAt(loc.x, loc.z, s?.key ?? null);
    const key = place?.key ?? null;
    if (!s) { seen.set(player.id, { key, shown: new Map() }); continue; } // just joined: no card
    if (s.key === undefined) { s.key = key; continue; } // just came back to the overworld: no card
    if (key === s.key) continue;
    s.key = key;
    if (!place) continue; // into the wilds
    const last = s.shown.get(key);
    if (last !== undefined && now - last < ENTERING.repeatSeconds * 20) continue;
    s.shown.set(key, now);
    const { title, subtitle } = cardText(place);
    try { player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 }); } catch { /* left */ }
  }
  for (const id of seen.keys()) if (!here.has(id)) seen.delete(id);
});
