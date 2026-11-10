// Per-player progress: path, Renown level, skill points, learned skills, Resonance.
// Saved on the player as dynamic property "siege:townhall_hero" so other features can read it.

import { world, system } from "@minecraft/server";
import { levelFromRenown, pointsForLevel, levelTitle, rankOf, LEVEL_UNLOCKS, MAX_LEVEL } from "./skills.js";
import { sfx } from "../core/sfx.js";

export const HERO_PROP = "siege:townhall_hero";

const cache = new Map(); // player id -> hero object (live; saved on change)

export function blankHero() {
  return {
    path: "none", // "none" | "knight" | "marked"
    renown: 0,
    level: 1,
    points: 0, // unspent skill points
    earned: 0, // all skill points ever earned
    skills: {}, // id -> rank
    resonance: 0, // 0-100, Marked only
    spell: "arc_bolt", // the Marked player's selected power
    offers: [], // roles the story has offered this player (see "offerRole")
    firstKills: [], // vanilla mob types killed at least once
    kills: 0,
    siegesHeld: 0,
    ember: "none", // "none" | "fallen" | "taken" | "refused"
    log: [], // last few things that gave points, newest first
  };
}

export function heroOf(player) {
  let hero = cache.get(player.id);
  if (hero) return hero;
  hero = blankHero();
  try {
    const raw = player.getDynamicProperty(HERO_PROP);
    if (typeof raw === "string") Object.assign(hero, JSON.parse(raw));
  } catch (e) {
    console.warn(`[Town Hall] bad hero data for ${player.name}: ${e}`);
  }
  cache.set(player.id, hero);
  return hero;
}

export function saveHero(player) {
  const hero = heroOf(player);
  hero.rank = rankOf(hero.path, hero.skills)?.name ?? null; // handy for other features reading the property
  player.setDynamicProperty(HERO_PROP, JSON.stringify(hero));
}

export const forgetHero = (playerId) => cache.delete(playerId);

export function playerById(id) {
  return world.getPlayers().find((p) => p.id === id);
}

function note(hero, text) {
  hero.log.unshift(text);
  hero.log.length = Math.min(hero.log.length, 8);
}

// Give skill points directly (quests, bosses, lore collections, sieges).
export function grantPoints(player, points, reason = "") {
  if (!player || !(points > 0)) return;
  const hero = heroOf(player);
  hero.points += points;
  hero.earned += points;
  note(hero, `+${points} SP ${reason}`.trim());
  saveHero(player);
  player.sendMessage(`§b+${points} skill point${points === 1 ? "" : "s"}§7${reason ? ` (${reason})` : ""}.`);
  sfx(player, "random.orb", { pitch: 1.4 });
}

// Give Renown (XP). Levels up as needed, each level paying out skill points.
export function grantRenown(player, amount, reason = "", quiet = false) {
  if (!player || !(amount > 0)) return;
  const hero = heroOf(player);
  const before = hero.level;
  hero.renown += Math.round(amount);
  const now = levelFromRenown(hero.renown).level;
  hero.level = now;
  if (now > before) {
    let gained = 0;
    for (let l = before + 1; l <= now; l++) gained += pointsForLevel(l);
    hero.points += gained;
    hero.earned += gained;
    note(hero, `Renown ${now} (+${gained} SP)`);
    saveHero(player);
    const unlock = LEVEL_UNLOCKS[now];
    player.onScreenDisplay.setTitle(`§6Renown ${now}`, {
      subtitle: `§7${levelTitle(now)} · +${gained} skill point${gained === 1 ? "" : "s"}${unlock ? ` · §e${unlock}` : ""}`,
      fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20,
    });
    sfx(player, "random.levelup");
    if (now === MAX_LEVEL) world.sendMessage(`§6${player.name} has become a Legend of the Realm.`);
    return;
  }
  saveHero(player);
  if (!quiet) player.onScreenDisplay.setActionBar(`§e+${Math.round(amount)} Renown§7${reason ? ` · ${reason}` : ""}`);
}

export function setPath(player, path) {
  const hero = heroOf(player);
  hero.path = path;
  saveHero(player);
}

// Accept grants from other features: scriptevent "siege:award_skill_points" with JSON
// { player: id, points, renown?, reason }. Run as a player, "player" can be left out.
export function listenForGrants() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "siege:award_skill_points") return;
    let data = {};
    try {
      data = event.message ? JSON.parse(event.message) : {};
    } catch {
      // "/scriptevent siege:award_skill_points 3" from chat: a bare number
      data = { points: Number(event.message) };
    }
    if (typeof data === "number") data = { points: data };
    const player = data.player ? playerById(String(data.player)) : event.sourceEntity?.typeId === "minecraft:player" ? event.sourceEntity : undefined;
    if (!player) return;
    if (data.points > 0) grantPoints(player, Math.floor(data.points), data.reason ?? "");
    if (data.renown > 0) grantRenown(player, data.renown, data.reason ?? "");
  });
}
