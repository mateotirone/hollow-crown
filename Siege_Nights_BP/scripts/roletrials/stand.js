// The Stand: each role's top rank has one stage of the Morvane fight where it matters (plan, "Roles in the
// Morvane fight"). The fight itself is bestiary/morvane.js; it announces each stage with the script event
// siege:morvane_stage {"stage","key","x","y","z","dimension"}, and we listen. Nothing here can stop the fight
// being won without these roles: each just makes its stage easier.
//
// Alone (one player in the fight), a role nobody there holds is filled by the mentor's student: the same help,
// announced by name (Mateo's rule: a stand-in for every player role). Not for the Sorcerer: no one stands in
// for the only person who can lift the Crown.

import { world, system, EntityDamageCause } from "@minecraft/server";
import { guardTag, onTick, addTests, assert, assertEqual } from "../siege/api.js";
import { sfx } from "../core/sfx.js";
import { RANKS, rankOf } from "../townhall/skills.js";
import { ELEVEN } from "./data.js";

const HERO_PROP = "siege:townhall_hero";
const MORVANE = "siege:oswin_the_last";
const SUIT = "siege:oswin_reflection";
const REACH = 64; // players this close to the stage's centre are in the fight

// stage number (1-7) -> the role that matters there, and the student who stands in when you are alone
export const STAGE_EDGES = {
  2: { role: "forgemaster", student: "Ulla's apprentice, Hrafn", what: "rings a new bell-tongue, and the Standing Ranks break step" },
  3: { role: "knight", student: "Dame Orla Penhallow", what: "and the knights of the Gate hold the wall with you" },
  4: { role: "captain", student: "Ottilie's bosun, Jory Holt", what: "and the forty row you down the river" },
  5: { role: "rider", student: "Senna Vey, Kesh's last cadet", what: "burns what climbs out of the Rift from the air" },
  6: { role: "witch", student: "Nell's niece, Rue", what: "and the fen lends you a moment to fall in" },
  7: { role: "marked", student: undefined, what: "can lift the fallen Crown and stop the song" },
};

function heroOf(player) {
  try {
    const raw = player.getDynamicProperty(HERO_PROP);
    if (typeof raw === "string") return JSON.parse(raw);
  } catch { /* no hero */ }
  return {};
}

// Does this player hold the top rank of this role? (Sorcerer for "marked")
export function atTop(hero, role) {
  const path = hero?.path === "sorcerer" ? "marked" : hero?.path;
  if (path !== role || !RANKS[role]) return false;
  return rankOf(role, hero.skills ?? {})?.name === RANKS[role].at(-1).name;
}

// Who answers for a stage: "player" names the player, "student" when alone with no one holding the role, else undefined.
export function answerFor(stage, heroes) {
  const edge = STAGE_EDGES[stage];
  if (!edge) return undefined;
  const holder = heroes.find((h) => atTop(h.hero, edge.role));
  if (holder) return { by: "player", name: holder.name };
  if (heroes.length === 1 && edge.student) return { by: "student", name: edge.student };
  return undefined;
}

let current = { stage: 0, at: undefined, dim: undefined, allies: [], heroes: [] };
const fx = (entity, effect, ticks, amplifier = 0) => { try { entity.addEffect(effect, ticks, { amplifier, showParticles: false }); } catch { /* gone */ } };

function inFight() {
  if (!current.at) return [];
  try {
    return world.getDimension(current.dim).getPlayers({ location: current.at, maxDistance: REACH });
  } catch { return []; }
}

function dismissAllies() {
  for (const ally of current.allies) { try { ally.remove(); } catch { /* already gone */ } }
  current.allies = [];
}

function say(players, text) { for (const p of players) { try { p.sendMessage(text); } catch { /* gone */ } } }

function onStage(stage, at, dimId) {
  dismissAllies();
  current = { stage, at, dim: dimId, allies: [], heroes: [] };
  const players = inFight();
  current.heroes = players.map((p) => ({ id: p.id, name: p.name, hero: heroOf(p), player: p }));
  const answer = answerFor(stage, current.heroes);
  if (!answer) return;
  const edge = STAGE_EDGES[stage];
  say(players, `§6${answer.name}§7 ${edge.what}.`);
  const dim = world.getDimension(dimId);
  if (stage === 2) {
    system.runTimeout(() => {
      sfx(dim, "sig.bell_tongue", at);
      try {
        for (const suit of dim.getEntities({ type: SUIT, location: at, maxDistance: 48 })) { fx(suit, "slowness", 120, 3); fx(suit, "weakness", 120, 1); }
      } catch { /* unloaded */ }
    }, 60);
  } else if (stage === 3) {
    const owner = answer.by === "player" ? current.heroes.find((h) => h.name === answer.name)?.id : players[0]?.id;
    const count = answer.by === "player" ? Math.min(4, Math.max(1, Math.floor(trialsEleven(owner) / 3))) : 2;
    ELEVEN.slice(1, 1 + count).forEach((knight, i) => {
      try {
        const angle = (i / count) * Math.PI * 2;
        const ally = dim.spawnEntity("siege:man_at_arms", { x: at.x + Math.cos(angle) * 4, y: at.y, z: at.z + Math.sin(angle) * 4 });
        ally.nameTag = knight.name;
        if (owner) ally.addTag(guardTag(owner));
        ally.addTag("siege_stand_ally");
        current.allies.push(ally);
      } catch (e) { console.warn(`[Role trials] stage 3 knight: ${e}`); }
    });
  } else if (stage === 4) {
    sfx(dim, "sig.forty_row", at);
    for (const p of players) { fx(p, "resistance", 3000, 0); fx(p, "water_breathing", 3000, 0); fx(p, "speed", 3000, 0); }
  } else if (stage === 6) {
    sfx(dim, "sig.fen_debt", at);
    for (const p of players) fx(p, "slow_falling", 160, 0);
  }
}

// The Eleven a knight has gathered (saved by index.js)
function trialsEleven(id) {
  try {
    const p = world.getPlayers().find((x) => x.id === id);
    const raw = p?.getDynamicProperty("hc:role_trials");
    return typeof raw === "string" ? JSON.parse(raw).eleven ?? 1 : 1;
  } catch { return 1; }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:morvane_stage") return;
  try {
    const m = JSON.parse(event.message);
    onStage(Number(m.stage), { x: Number(m.x), y: Number(m.y), z: Number(m.z) }, m.dimension ?? "minecraft:overworld");
  } catch (e) {
    console.warn(`[Role trials] morvane stage: ${e}`);
  }
});

// The Morvane entity dies or vanishes: the fight is over, send the knights home
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  try { if (deadEntity.typeId === MORVANE) { dismissAllies(); current.stage = 0; } } catch { /* gone */ }
});

// Stage 5: a Dragonlord on the wing (or Senna, alone) burns him every few seconds
// Stage 7: a Sorcerer's blows land harder, because the song stops while they hold the Crown's attention
let tick5 = 0;
onTick("roletrials_stand", 160, () => {
  if (current.stage !== 5) return;
  tick5++;
  const answer = answerFor(5, current.heroes);
  if (!answer) return;
  const every = answer.by === "player" ? 1 : 2;
  if (tick5 % every) return;
  const players = inFight();
  const flying = answer.by === "student" || players.some((p) => {
    try { return atTop(heroOf(p), "rider") && /dragon/.test(p.getComponent("minecraft:riding")?.entityRidingOn?.typeId ?? ""); } catch { return false; }
  });
  if (!flying) return;
  try {
    const dim = world.getDimension(current.dim);
    const boss = dim.getEntities({ type: MORVANE, location: current.at, maxDistance: 96 })[0];
    if (!boss) return;
    boss.applyDamage(8, { cause: EntityDamageCause.fire });
    dim.spawnParticle("minecraft:basic_flame_particle", { x: boss.location.x, y: boss.location.y + 2, z: boss.location.z });
    sfx(dim, "mob.blaze.shoot", boss.location, { pitch: 0.6 });
  } catch { /* unloaded */ }
});

let echoing = false;
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  if (echoing || current.stage !== 7) return;
  try {
    if (hurtEntity.typeId !== MORVANE) return;
    const by = damageSource.damagingEntity;
    if (by?.typeId !== "minecraft:player" || !atTop(heroOf(by), "marked")) return;
    echoing = true;
    hurtEntity.applyDamage(Math.max(1, Math.round(damage * 0.25)), { cause: EntityDamageCause.magic });
  } catch { /* gone */ } finally {
    echoing = false;
  }
});

addTests("roletrials", {
  "the Stand: every role but one has a stage, and alone a student answers": () => {
    const roles = Object.values(STAGE_EDGES).map((e) => e.role).sort();
    assertEqual(roles, ["captain", "forgemaster", "knight", "marked", "rider", "witch"]);
    const plain = [{ name: "Ada", hero: { path: "none", skills: {} } }];
    assertEqual(answerFor(2, plain).by, "student");
    assertEqual(answerFor(7, plain), undefined, "nobody stands in for the Sorcerer");
    assertEqual(answerFor(2, [...plain, { name: "Bo", hero: { path: "none", skills: {} } }]), undefined, "with friends, no students");
    assertEqual(answerFor(1, plain), undefined);
    assert(!atTop({ path: "forgemaster", skills: {} }, "forgemaster"), "an apprentice is not at the top");
  },
});
