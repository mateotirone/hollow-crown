// The singing: the Choir's one note, a low held hum the player hears in five situations.
//   1. Every third night, very faintly, everywhere above. Louder near a thin place or the Gate.
//   2. All the time in the Hollow.
//   3. Close to one of the hidden Returned (the fifth tell: stand next to them and listen).
//   4. Clearer for a Sorcerer, more so the higher their Resonance.
//   5. At full volume during a Slip.
// The sound is "siege.choir.hum" (7 s, faded at both ends; studio/build_lore_sound.py). It is played
// again every 5 seconds so the fades overlap into one unbroken note.
//   /scriptevent siege:hum            hear it now at full volume (testing)
//   /scriptevent siege:hum off | on   a player who finds it unpleasant can turn it off for themselves

import { world, system } from "@minecraft/server";
import { onTick, isNight, SETTINGS, addTests, assert, assertEqual } from "../siege/api.js";
import { getSites, getRift } from "../undertow/source.js";
import { isSlipping } from "../undertow/slips.js";
import { isReturned } from "../bestiary/returned.js";
import { heroOf } from "./player.js";
import { tonightKind, reachStage, LONG, AFTER } from "../reach/api.js";
import { sfx } from "../core/sfx.js";

export const HUM = {
  sound: "siege.choir.hum",
  every: 100, // ticks between plays
  thirdNight: 0.07, // anywhere above, on the Hollow's night
  stolenNight: 0.04, // a night that was not owed: fainter, and wrong
  longNight: 0.12, // the Long Night: it does not stop, day or night
  thinRange: 96, // blocks from a thin place or the Gate at which it starts to swell
  thinPeak: 0.55,
  thinOtherNights: 0.3, // share of the thin-place swell on nights that are not the third
  hollow: 0.3,
  returnedRange: 6,
  returnedPeak: 0.16,
  slip: 1.0,
  deafCap: 0.6, // nobody but a Sorcerer hears it louder than this outside a Slip
  quietBelow: 0.02,
};
const OFF_TAG = "siege_no_hum";
const HOLLOW = "siege:undertow";

// How loud the note is for one player, 0..1. Distances are in blocks (Infinity = none near).
export function humVolume({ slipping, inHollow, thirdNight, stolen, long, after, night, thinDist = Infinity, returnedDist = Infinity, sorcerer, resonance = 0 }) {
  if (slipping) return HUM.slip;
  let v = 0;
  if (inHollow) v = after ? HUM.hollow / 2 : HUM.hollow;
  else if (after) v = 0; // the source is settled: the land above is quiet at last
  else {
    if (long) { v = HUM.longNight; thirdNight = true; }
    else if (thirdNight) v = HUM.thirdNight;
    else if (stolen) v = HUM.stolenNight;
    if (thinDist < HUM.thinRange) {
      const swell = HUM.thinPeak * (1 - thinDist / HUM.thinRange);
      v = Math.max(v, thirdNight ? swell : night ? swell * HUM.thinOtherNights : 0);
    }
    if (returnedDist < HUM.returnedRange) v = Math.max(v, HUM.returnedPeak * (1 - returnedDist / HUM.returnedRange) + 0.04);
  }
  if (sorcerer) return Math.min(1, v * (1.5 + Math.min(100, resonance) / 100));
  return Math.min(HUM.deafCap, v);
}
// A Sorcerer hears it a shade higher and cleaner; everyone else hears it low
export const humPitch = ({ sorcerer, slipping }) => (slipping ? 1 : sorcerer ? 1.06 : 0.94);

// The siege raids feature (scripts/reach) decides which nights are the Hollow's as its reach grows.
// "counted" is the true third night, "stolen" a night that was not owed, "long" the siege that does not end.
export function nightKind() {
  try { return tonightKind(); } catch { return world.getDay() >= 1 && world.getDay() % SETTINGS.siegeEveryNNights === 0 ? "counted" : undefined; }
}
const stageNow = () => { try { return reachStage(); } catch { return 1; } };
export const isThirdNight = () => isNight() && ["counted", "long"].includes(nightKind());

function thinDistance(loc) {
  let best = Infinity;
  try {
    const spots = Object.values(getSites() ?? {});
    const rift = getRift();
    if (rift && Number.isFinite(rift.x)) spots.push(rift);
    for (const s of spots) best = Math.min(best, Math.hypot(s.x - loc.x, s.y - loc.y, s.z - loc.z));
  } catch {}
  return best;
}

function returnedDistance(player) {
  let best = Infinity;
  try {
    for (const v of player.dimension.getEntities({ type: "minecraft:villager_v2", location: player.location, maxDistance: HUM.returnedRange })) {
      if (isReturned(v)) best = Math.min(best, Math.hypot(v.location.x - player.location.x, v.location.z - player.location.z));
    }
  } catch {}
  return best;
}

function tick() {
  const night = isNight(), third = isThirdNight();
  const kind = nightKind(), stage = stageNow();
  const long = stage === LONG || kind === "long", after = stage === AFTER, stolen = night && kind === "stolen";
  for (const player of world.getAllPlayers()) {
    try {
      if (player.hasTag(OFF_TAG)) continue;
      const dim = player.dimension.id;
      const above = dim === "minecraft:overworld";
      if (!above && dim !== HOLLOW) continue;
      const hero = heroOf(player);
      const sorcerer = hero.path === "marked" || hero.path === "sorcerer";
      const slipping = isSlipping(player);
      const volume = humVolume({
        slipping, inHollow: dim === HOLLOW, thirdNight: above && third, stolen: above && stolen, long: above && long, after, night,
        thinDist: above ? thinDistance(player.location) : Infinity,
        returnedDist: above ? returnedDistance(player) : Infinity,
        sorcerer, resonance: hero.resonance ?? 0,
      });
      if (volume < HUM.quietBelow) continue;
      sfx(player, HUM.sound, { volume, pitch: humPitch({ sorcerer, slipping }) });
    } catch { /* left the game */ }
  }
}
onTick("lore_singing", HUM.every, tick);

system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity: player }) => {
  if (id !== "siege:hum" || player?.typeId !== "minecraft:player") return;
  const arg = message.trim();
  if (arg === "off") { player.addTag(OFF_TAG); player.sendMessage("§7You stop your ears. You will not hear the singing. (/scriptevent siege:hum on to hear it again)"); return; }
  if (arg === "on") { player.removeTag(OFF_TAG); player.sendMessage("§7You listen again."); return; }
  sfx(player, HUM.sound, { volume: 1, pitch: 1 });
  player.sendMessage("§7§oOne note, held. It does not stop for breath.");
});

addTests("lore", {
  "the singing: silent on an ordinary day, faint on a third night, loudest in a Slip": () => {
    assertEqual(humVolume({}), 0);
    assertEqual(humVolume({ night: true }), 0);
    const faint = humVolume({ thirdNight: true, night: true });
    assert(faint > 0 && faint < 0.1, "faint");
    assert(humVolume({ thirdNight: true, night: true, thinDist: 10 }) > faint * 4, "swells at a thin place");
    assert(humVolume({ night: true, thinDist: 10 }) > 0, "a thin place hums a little every night");
    assertEqual(humVolume({ thinDist: 10 }), 0);
    assert(humVolume({ inHollow: true }) > faint, "the Hollow sings all the time");
    assertEqual(humVolume({ slipping: true }), 1);
    // as the Hollow's reach grows: fainter on a stolen night, constant in the Long Night, silent once it is settled
    assert(humVolume({ stolen: true, night: true }) > 0 && humVolume({ stolen: true, night: true }) < faint);
    assert(humVolume({ long: true }) > faint, "the Long Night sings by day as well");
    assertEqual(humVolume({ after: true, thirdNight: true, night: true, thinDist: 5, returnedDist: 1 }), 0);
    assert(humVolume({ after: true, inHollow: true }) > 0 && humVolume({ after: true, inHollow: true }) < humVolume({ inHollow: true }));
  },
  "the singing: a Returned hums when you stand close, and a Sorcerer hears all of it better": () => {
    assertEqual(humVolume({ returnedDist: 7 }), 0);
    assert(humVolume({ returnedDist: 1 }) > humVolume({ returnedDist: 5 }), "closer is louder");
    assert(humVolume({ returnedDist: 5 }) >= HUM.quietBelow, "audible at five blocks");
    const plain = humVolume({ thirdNight: true });
    assert(humVolume({ thirdNight: true, sorcerer: true }) > plain);
    assert(humVolume({ thirdNight: true, sorcerer: true, resonance: 100 }) > humVolume({ thirdNight: true, sorcerer: true, resonance: 0 }));
    assert(humVolume({ thirdNight: true, thinDist: 0 }) <= HUM.deafCap);
    assert(humPitch({ sorcerer: true }) > humPitch({}));
  },
});
