// Wonders: six great buildings, one fixed site each on the map, outside every town. A City's ruler claims a
// free one from its keeper and pays for it in six stages; the crew raises each stage block by block while
// someone is near. Once all six stand, the holder (and the holder's allies) get its effect, and so does every settlement in its region. Rival Lords race for
// them too. A wonder can be taken from its holder by challenge: cut down its defenders within ten minutes.
// Numbers and words: data.js. Rules: rules.js. Buildings: designs_data.js (map/structures/export_wonders.py).
//
// Saved: moduleStore "siege:wonders" = { w: { id: { holder, holderName, paid, built, origin?, forward?, lordStart?, restUntil? } }, lastDay }
// Events: emit("wonderClaimed" | "wonderRaised" | "wonderTaken", { id, holder, player? })
// Filters used: "chargeAmount", "payAmount" (economy/coins.js), "settlerArrivals" (settle/settlers.js), keep health.
// Test: /scriptevent siege:wonders list | tp <id> | claim <id> | stage <id> | finish <id> | lord <id> | challenge <id> | reset <id>

import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { isReady, onTick, on, emit, moduleStore, addFilter, isAlly, addKeepHealthHook, getState } from "../siege/api.js";
import { applyFilter } from "../core/events.js";
import { charge, coins, JOBS, regionAt } from "../economy/api.js";
import { startBuild, buildFor, clearBoxFor } from "../townhall/build.js";
import { wonderPlan } from "./plans.js";
import { groundTop } from "../settle/ground.js";
import { frameFor, toWorld } from "../townhall/halls.js";
import { BlockPermutation } from "@minecraft/server";
import { settlementTier } from "../settle/founding.js";
import { mapMode } from "../plots/api.js";
import { rivalLords, rivalById, lordFullName } from "../rivals/index.js";
import { WONDER_DESIGNS } from "./designs_data.js";
import { WONDER, WONDERS, WONDER_BY_ID, WONDER_LINES } from "./data.js";
import {
  forwardOf, stageBlocks, perTickFor, claimProblem, payProblem, standing, rising, heldBy, adjustCharge, adjustPay,
  extraArrivals, keepBonus, lordDue, challengeProblem, defendersFor, inGuard, reachOf, guardOf, levelOf, gradeTarget,
} from "./rules.js";
import "./tests.js";
import { insideActions } from "./inside.js";
import { dressNpc, addNpcLook } from "../core/npc_skins.js";

const OVERWORLD = "minecraft:overworld";
const NPC_TYPE = "minecraft:npc";
const KEEPER = "siege_wonder_keeper";
const DEFENDER = "siege_wonder_defender";
const store = moduleStore("siege:wonders", () => ({ w: {}, lastDay: -1 }));
const save = () => store.save();
const challenges = new Map(); // id -> { by, until, spawned }

const stateOf = (id) => (store.data.w[id] ??= { holder: null, holderName: null, paid: 0, built: 0 });
const isLordKey = (k) => String(k).startsWith("npc:");
const playerById = (id) => world.getPlayers().find((p) => p.id === id);
const fill = (text, words) => text.replace(/\{(\w+)\}/g, (m, k) => words[k] ?? m);
const everyone = (text) => { for (const p of world.getPlayers()) p.sendMessage(text); };
const near = (site, range) => world.getPlayers().filter((p) => p.dimension.id === OVERWORLD && Math.hypot(p.location.x - site.x, p.location.z - site.z) <= range);
const stageCost = (n) => WONDER.stageCost[Math.min(WONDER.stageCost.length, Math.max(1, n)) - 1];
const allyOf = (holder, id) => !isLordKey(holder) && isAlly(holder, id);
// the region a player's settlement stands in (their own keep, or the keep they are an ally of)
function homeRegion(id) {
  const keeps = getState().keeps ?? {};
  const own = keeps[id] ? id : Object.keys(keeps).find((o) => keeps[o].allies?.includes(id));
  return own ? regionAt(keeps[own]) : undefined;
}
const heldFor = (id) => heldBy(store.data.w, id, allyOf, homeRegion(id));

// Who holds a wonder, for other modules (the Codex's forges): { playerId, lordId, name, standing } or null if free
export function wonderHolder(id) {
  const s = store.data.w[id];
  if (!s?.holder) return null;
  const lord = isLordKey(s.holder);
  return { playerId: lord ? null : s.holder, lordId: lord ? String(s.holder).slice(4) : null, name: s.holderName ?? null, standing: standing(s) };
}
export { heldFor, stateOf, near };

// Where the keeper waits: in front of the wonder, a few blocks out
export function keeperSpot(w) {
  const d = WONDER_DESIGNS[w.id];
  const out = -d.box.z0 + 3;
  const f = forwardOf(w.face);
  return { x: w.site.x - f.x * out, z: w.site.z - f.z * out };
}

// ---------- building ----------

const jobId = (id) => `wonder:${id}`;

// The wonder's rectangle on the ground, in world blocks (its design box turned to face its way)
function siteRect(w) {
  const b = WONDER_DESIGNS[w.id].box, frame = frameFor(forwardOf(w.face));
  const xs = [], zs = [];
  for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) {
    const p = toWorld(frame, { x: w.site.x, y: 1, z: w.site.z }, x, 0, z);
    xs.push(p.x); zs.push(p.z);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

// The first time: pick the level. On land, the median ground under the wonder, graded flat under it and eased back
// into the land round it before stage 1 (gradeStep). In the fen (ground "water"), on the water's surface, no grading.
function chooseOrigin(w, s, dim) {
  const r = siteRect(w);
  s.forward = forwardOf(w.face);
  if (w.ground === "water") {
    const top = dim.getTopmostBlock({ x: w.site.x, z: w.site.z });
    if (!top) return false;
    s.origin = { x: w.site.x, y: top.location.y + 1, z: w.site.z };
    return true;
  }
  const hs = [];
  for (let x = r.x0; x <= r.x1; x += 3) for (let z = r.z0; z <= r.z1; z += 3) {
    const h = groundTop(dim, x, z);
    if (h === undefined) return false; // not all loaded yet
    hs.push(h);
  }
  const G = levelOf(hs);
  if (G === undefined) return false;
  s.origin = { x: w.site.x, y: G + 1, z: w.site.z };
  s.grade = { ...r, G, i: 0 };
  return true;
}

const WET = /water|lava/;
const PLANT = /(_log|_wood|leaves|vine|grass$|short_grass|tall_grass|fern|flower|bush|sapling|snow_layer|mushroom)/;
// Grade one column: cut it down or fill it up to its target, keeping its own top block (grass, sand, snow...) on top
function gradeColumn(dim, x, z, out, G) {
  const r = groundTop(dim, x, z);
  if (r === undefined) return false;
  const topBlock = dim.getBlock({ x, y: r, z });
  if (!topBlock) return false;
  const above = dim.getBlock({ x, y: r + 1, z });
  if (above && WET.test(above.typeId) && out > 0) return true; // never grade the sea or a pond round it
  const t = gradeTarget(G, r, out);
  const top = topBlock.permutation;
  const under = dim.getBlock({ x, y: r - 1, z })?.permutation ?? top;
  if (t > r) {
    for (let y = r; y < t; y++) dim.getBlock({ x, y, z })?.setPermutation(under);
    dim.getBlock({ x, y: t, z })?.setPermutation(top);
  } else if (t < r) {
    for (let y = t + 1; y <= r; y++) dim.getBlock({ x, y, z })?.setPermutation(AIR());
    dim.getBlock({ x, y: t, z })?.setPermutation(top);
  }
  if (t !== r) for (let y = Math.max(t, r) + 1; y <= Math.max(t, r) + 14; y++) { // trees and plants on cut ground go too
    const b = dim.getBlock({ x, y, z });
    if (!b || b.typeId === "minecraft:air") break;
    if (PLANT.test(b.typeId)) b.setPermutation(AIR());
  }
  return true;
}
let airPerm;
const AIR = () => (airPerm ??= BlockPermutation.resolve("minecraft:air"));

function gradeStep(w, s) {
  const g = s.grade, E = WONDER.ease, dim = world.getDimension(OVERWORLD);
  const W = g.x1 - g.x0 + 1 + 2 * E, D = g.z1 - g.z0 + 1 + 2 * E;
  for (let n = 0; n < WONDER.gradePerTick && g.i < W * D; n++) {
    const x = g.x0 - E + (g.i % W), z = g.z0 - E + Math.floor(g.i / W);
    const out = Math.max(g.x0 - x, x - g.x1, g.z0 - z, z - g.z1, 0);
    if (!gradeColumn(dim, x, z, out, g.G)) return; // not loaded: carry on next tick
    g.i++;
  }
  if (g.i >= W * D) { delete s.grade; save(); }
}

function startStage(w) {
  const s = stateOf(w.id);
  const stage = s.built + 1;
  const dim = world.getDimension(OVERWORLD);
  const plan = wonderPlan(w.id, stage);
  let clearBox;
  if (!s.origin) {
    if (!chooseOrigin(w, s, dim)) return false; // not loaded yet
    save();
  }
  if (s.grade) return false; // the ground is still being graded (wonders_grade)
  if (stage === 1) clearBox = clearBoxFor(wonderPlan(w.id, 0), s.origin, s.forward, 1); // trees and humps inside go first
  startBuild({
    id: jobId(w.id), dimensionId: OVERWORLD, origin: s.origin, forward: s.forward, plan, style: plan.wonderStyle, clearBox,
    perTick: perTickFor(stageBlocks(WONDER_DESIGNS[w.id], stage)),
    onDone: () => stageDone(w, stage),
  });
  return true;
}

function stageDone(w, stage) {
  const s = stateOf(w.id);
  if (stage !== s.built + 1) return; // reset while it was building
  s.built = stage;
  save();
  for (const p of near(w.site, WONDER.buildRange)) p.onScreenDisplay.setActionBar(`§6${w.name}: stage ${stage} of ${WONDER.stages} stands`);
  if (stage < WONDER.stages) return;
  everyone(`§6${fill(WONDER_LINES.raised, { holder: s.holderName ?? "Someone", name: w.name })} §7${w.says}`);
  emit("wonderRaised", { id: w.id, holder: s.holder });
}

onTick("wonders_build", 40, () => {
  if (!mapMode()) return;
  for (const w of WONDERS) {
    const s = store.data.w[w.id];
    if (!s || s.built >= s.paid || buildFor(jobId(w.id))) continue;
    if (!near(w.site, WONDER.buildRange).length) continue; // its chunks aren't loaded: the crew waits
    try { startStage(w); } catch (e) { console.warn(`[Wonders] ${w.id}: ${e}`); }
  }
});

onTick("wonders_grade", 2, () => {
  if (!mapMode()) return;
  for (const w of WONDERS) {
    const s = store.data.w[w.id];
    if (!s?.grade || !near(w.site, WONDER.buildRange).length) continue;
    try { gradeStep(w, s); } catch (e) { console.warn(`[Wonders] grading ${w.id}: ${e}`); }
  }
});

// ---------- claiming and paying ----------

const risingFor = (key) => WONDERS.some((w) => store.data.w[w.id]?.holder === key && rising(store.data.w[w.id]));

function claim(w, key, name, player) {
  const s = stateOf(w.id);
  s.holder = key;
  s.holderName = name;
  s.paid = Math.max(s.paid, Math.min(WONDER.stages, s.built + 1));
  delete s.lordStart;
  if (isLordKey(key)) s.lordStart = world.getDay() - (s.built ? (s.built) * WONDER.lordDaysPerStage : 0);
  save();
  emit("wonderClaimed", { id: w.id, holder: key, player });
}

function tryClaim(player, w) {
  const s = stateOf(w.id);
  const problem = claimProblem({ tier: settlementTier(player.id), rising: risingFor(player.id) });
  if (problem) return player.sendMessage(`§7${w.keeper}: §f${WONDER_LINES[problem]}`);
  const price = stageCost(s.built + 1);
  if (!charge(player, price, "wonder")) return player.sendMessage(`§7${w.keeper}: §fThe first work costs ${coins(price)}.`);
  claim(w, player.id, player.name, player);
  player.sendMessage(`§6The ${w.name} is yours to raise. §7The crew starts on stage ${s.built + 1} now.`);
  everyone(`§7${player.name} has claimed the ${w.name}.`);
}

function tryPay(player, w) {
  const s = stateOf(w.id);
  const problem = payProblem(s, { tier: settlementTier(player.id) });
  if (problem) return player.sendMessage(`§7${w.keeper}: §f${WONDER_LINES[problem]}`);
  const price = stageCost(s.paid + 1);
  if (!charge(player, price, "wonder")) return player.sendMessage(`§7${w.keeper}: §fStage ${s.paid + 1} costs ${coins(price)}.`);
  s.paid++;
  save();
  player.sendMessage(`§6Stage ${s.paid} of the ${w.name} is paid for. §7The crew is at work.`);
}

// ---------- the keeper ----------

function statusText(w) {
  const s = stateOf(w.id);
  const ch = challenges.get(w.id);
  const lines = [`§7${w.blurb}`, "", `§fOnce finished: §a${w.says}`, ""];
  if (!s.holder) lines.push(s.built ? `§fNo one holds it. ${s.built} of ${WONDER.stages} stages stand.` : `§f${WONDER_LINES.free}`);
  else lines.push(`§fHeld by §6${s.holderName}§f. ${s.built} of ${WONDER.stages} stages stand${s.paid > s.built ? `, stage ${s.built + 1} rising` : ""}.`);
  if (ch) lines.push(`§c${playerById(ch.by)?.name ?? "Someone"} is challenging for it.`);
  return lines.join("\n");
}

function keeperMenu(player, w) {
  const s = stateOf(w.id);
  const mine = s.holder === player.id;
  const actions = [];
  const form = new ActionFormData().title(w.name).body(statusText(w));
  if (!s.holder) actions.push([`Claim it (${coins(stageCost(s.built + 1))})`, () => tryClaim(player, w)]);
  if (mine && s.paid < WONDER.stages) actions.push([`Pay for stage ${s.paid + 1} (${coins(stageCost(s.paid + 1))})`, () => tryPay(player, w)]);
  if (s.holder && !mine && !challenges.has(w.id)) actions.push(["Challenge for it", () => tryChallenge(player, w)]);
  actions.push(...insideActions(player, w)); // what happens inside (inside.js): travellers, racing, the forge
  for (const [label] of actions) form.button(label);
  form.button("Close");
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    actions[res.selection]?.[1]();
  }).catch(() => {});
}

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target } = event;
  if (target.typeId !== NPC_TYPE || !target.hasTag(KEEPER)) return;
  if (player.isSneaking && player.getGameMode() === GameMode.Creative) return; // builder: normal NPC editor
  event.cancel = true;
  const id = target.getTags().find((t) => t.startsWith(`${KEEPER}_`))?.slice(KEEPER.length + 1);
  const w = WONDER_BY_ID[id];
  if (w) system.run(() => keeperMenu(player, w));
});

addNpcLook((e) => {
  const t = e.getTags().find((x) => x.startsWith(`${KEEPER}_`));
  return t ? `keeper_${t.slice(KEEPER.length + 1)}` : undefined;
});

onTick("wonders_keepers", 100, () => {
  if (!mapMode()) return;
  const dim = world.getDimension(OVERWORLD);
  for (const w of WONDERS) {
    if (!near(w.site, WONDER.keeperRange).length) continue;
    const spot = keeperSpot(w);
    try {
      if (dim.getEntities({ type: NPC_TYPE, tags: [`${KEEPER}_${w.id}`], location: { x: spot.x, y: 64, z: spot.z }, maxDistance: 96 }).length) continue;
      const top = groundTop(dim, spot.x, spot.z);
      if (top === undefined) continue;
      const e = dim.spawnEntity(NPC_TYPE, { x: spot.x + 0.5, y: top + 1, z: spot.z + 0.5 });
      e.addTag(KEEPER);
      e.addTag(`${KEEPER}_${w.id}`);
      e.nameTag = `${w.keeper}\n§7${w.name}`;
      try { e.getComponent("minecraft:npc").name = w.keeper; } catch { /* older versions */ }
      dressNpc(e, `keeper_${w.id}`);
    } catch {
      // not loaded here yet
    }
  }
});

// ---------- challenges ----------

function spawnDefenders(w, s) {
  const dim = world.getDimension(OVERWORLD);
  const lord = isLordKey(s.holder) ? rivalById(String(s.holder).slice(4)) : undefined;
  const count = defendersFor(s.built);
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const ring = reachOf(WONDER_DESIGNS[w.id]) + 4; // out on the open ground round it, never on a roof
    const x = w.site.x + Math.round(Math.cos(a) * ring), z = w.site.z + Math.round(Math.sin(a) * ring);
    const top = groundTop(dim, x, z);
    if (top === undefined) continue;
    const at = { x: x + 0.5, y: top + 1, z: z + 0.5 };
    const tags = [DEFENDER, `${DEFENDER}_${w.id}`];
    const name = i === 0 ? `Warden of the ${w.name}` : `${w.name} Guard`;
    let soldier;
    try {
      soldier = applyFilter("rivalSoldier", undefined, { dim, at, role: i === 0 ? "knight" : "retainer", tier: Math.min(4, 1 + Math.floor(s.built / 2)), name, tags, lord });
    } catch {
      soldier = undefined;
    }
    if (!soldier) {
      try {
        const e = dim.spawnEntity(i % 3 === 0 ? "siege:hollow_footman" : "siege:shieldwall_brute", at); // our own raiders if champions are missing
        for (const t of tags) e.addTag(t);
        e.nameTag = name;
      } catch {
        continue;
      }
    }
    spawned++;
  }
  return spawned;
}

function tryChallenge(player, w) {
  const s = stateOf(w.id);
  const problem = challengeProblem(s, { by: player.id, tier: settlementTier(player.id), day: world.getDay(), holderHere: !!playerById(s.holder), ally: allyOf(s.holder, player.id) });
  const why = {
    nothingToTake: "There's nothing here to take yet.", yours: "It's already yours, or your ally's.", needCity: WONDER_LINES.needCity,
    resting: "Its guards are fresh from the last fight. Come back in a day or two.", holderAway: `${s.holderName} isn't in the realm. A wonder can only be challenged while its holder is here.`,
  };
  if (problem) return player.sendMessage(`§7${w.keeper}: §f${why[problem]}`);
  if (challenges.has(w.id)) return;
  const spawned = spawnDefenders(w, s);
  if (!spawned) return player.sendMessage("§7Come closer before you call out its guards.");
  challenges.set(w.id, { by: player.id, until: system.currentTick + WONDER.challengeMinutes * 1200, spawned });
  player.onScreenDisplay.setTitle(`§4${w.name}`, { subtitle: `§7Cut down all ${spawned} of its guards in ${WONDER.challengeMinutes} minutes`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
  everyone(`§6${fill(WONDER_LINES.challenge, { player: player.name, name: w.name })}`);
  playerById(s.holder)?.sendMessage(`§c${player.name} is fighting for your ${w.name} at ${w.site.x}, ${w.site.z}.`);
}

function endChallenge(w, won) {
  const ch = challenges.get(w.id);
  challenges.delete(w.id);
  const s = stateOf(w.id);
  const player = playerById(ch?.by);
  const dim = world.getDimension(OVERWORLD);
  for (const e of dim.getEntities({ tags: [`${DEFENDER}_${w.id}`] })) try { e.remove(); } catch { /* gone */ }
  s.restUntil = world.getDay() + WONDER.challengeRestDays;
  if (won && player) {
    claim(w, player.id, player.name, player);
    s.paid = s.built; // a half-built wonder: the new holder pays for what's next
    save();
    everyone(`§6${fill(WONDER_LINES.taken, { holder: player.name, name: w.name })}`);
    emit("wonderTaken", { id: w.id, holder: player.id, player });
  } else {
    save();
    everyone(`§7${fill(WONDER_LINES.defended, { player: player?.name ?? "The challenger", name: w.name })}`);
  }
}

onTick("wonders_challenges", 20, () => {
  if (!challenges.size) return;
  const dim = world.getDimension(OVERWORLD);
  for (const [id, ch] of [...challenges]) {
    const w = WONDER_BY_ID[id];
    const player = playerById(ch.by);
    const here = player && player.dimension.id === OVERWORLD && Math.hypot(player.location.x - w.site.x, player.location.z - w.site.z) <= WONDER.challengeRange;
    let left;
    try { left = dim.getEntities({ tags: [`${DEFENDER}_${id}`] }).length; } catch { left = ch.spawned; }
    if (left === 0 && here) endChallenge(w, true);
    else if (!here || system.currentTick > ch.until) endChallenge(w, false);
    else player.onScreenDisplay.setActionBar(`§c${w.name}: ${left} guard${left === 1 ? "" : "s"} left, ${Math.ceil((ch.until - system.currentTick) / 1200)} min`);
  }
});

// ---------- Rival Lords race for them ----------

function lordDay(day) {
  const lords = rivalLords();
  for (const w of WONDERS) {
    const s = stateOf(w.id);
    if (!isLordKey(s.holder)) continue;
    const lord = rivalById(String(s.holder).slice(4));
    if (!lord) { s.holder = null; s.holderName = null; s.paid = s.built; delete s.lordStart; continue; } // the lord is gone: it stands free
    s.paid = Math.max(s.paid, lordDue(s.lordStart ?? day, day));
  }
  if (day >= WONDER.lordFromDay && Math.random() < WONDER.lordChance) {
    const free = WONDERS.filter((w) => !stateOf(w.id).holder && !standing(stateOf(w.id)));
    const keen = lords.filter((l) => (l.tier ?? 0) >= WONDER.minTier && !risingFor(`npc:${l.id}`));
    const lord = keen[Math.floor(Math.random() * keen.length)];
    if (lord && free.length) {
      const w = free.sort((a, b) => Math.hypot(a.site.x - lord.x, a.site.z - lord.z) - Math.hypot(b.site.x - lord.x, b.site.z - lord.z))[0];
      claim(w, `npc:${lord.id}`, lordFullName(lord));
      everyone(`§6${fill(WONDER_LINES.lordClaim, { lord: lordFullName(lord), name: w.name })}`);
    }
  }
  save();
}

onTick("wonders_day", 200, () => {
  if (!isReady() || !mapMode()) return;
  const day = world.getDay();
  if (day === store.data.lastDay) return;
  store.data.lastDay = day;
  lordDay(day);
});

// Beat a lord and take their town: their wonder comes with it
on("rivalFallen", ({ lord, player }) => {
  for (const w of WONDERS) {
    const s = stateOf(w.id);
    if (s.holder !== `npc:${lord?.id}`) continue;
    if (player) {
      claim(w, player.id, player.name, player);
      s.paid = s.built;
      everyone(`§6${fill(WONDER_LINES.taken, { holder: player.name, name: w.name })}`);
      emit("wonderTaken", { id: w.id, holder: player.id, player });
    } else {
      s.holder = null; s.holderName = null; s.paid = s.built;
    }
  }
  save();
});

// ---------- what a finished wonder gives ----------

function note(player, text) {
  system.run(() => { try { player.onScreenDisplay.setActionBar(text); } catch { /* left */ } });
}

addFilter("chargeAmount", (amount, { player, reason }) => {
  if (!player?.id) return undefined;
  const held = heldFor(player.id);
  if (!held.length) return undefined;
  const less = adjustCharge(amount, reason, held);
  if (less < amount) note(player, `§a${held.map((k) => WONDER_BY_ID[k].name).join(", ")}: ${coins(amount - less)} off`);
  return less;
});

addFilter("payAmount", (amount, { player, reason }) => {
  if (!player?.id) return undefined;
  const held = heldFor(player.id);
  if (!held.length) return undefined;
  const more = adjustPay(amount, !!JOBS[reason], held);
  if (more > amount) note(player, `§a${held.map((k) => WONDER_BY_ID[k].name).join(", ")}: ${coins(more - amount)} more`);
  return more;
});

addFilter("settlerArrivals", (n, { owner }) => n + extraArrivals(heldFor(owner)));
addKeepHealthHook((owner, hp) => keepBonus(hp, heldFor(owner)));

// ---------- nobody digs up a wonder's ground ----------

const GUARD = Object.fromEntries(WONDERS.map((w) => [w.id, guardOf(w, WONDER_DESIGNS[w.id])]));
const guarded = (loc) => WONDERS.find((w) => inGuard(w.site, loc, GUARD[w.id]));

function guard(event, block, player) {
  if (!mapMode() || block.dimension.id !== OVERWORLD || player.getGameMode() === GameMode.Creative) return;
  const w = guarded(block.location);
  if (!w) return;
  event.cancel = true;
  system.run(() => player.onScreenDisplay.setActionBar(`§7The ${w.name}'s ground is guarded. Nothing here can be broken or built.`));
}

world.beforeEvents.playerBreakBlock.subscribe((event) => guard(event, event.block, event.player));
world.beforeEvents.playerPlaceBlock?.subscribe((event) => guard(event, event.block, event.player));
world.beforeEvents.explosion?.subscribe((event) => {
  if (!mapMode() || event.dimension.id !== OVERWORLD) return;
  const blocks = event.getImpactedBlocks();
  const safe = blocks.filter((b) => !guarded(b.location));
  if (safe.length !== blocks.length) event.setImpactedBlocks(safe);
});

// ---------- test command ----------

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "siege:wonders") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const [cmd = "list", arg] = event.message.trim().split(/\s+/);
  const w = WONDER_BY_ID[arg] ?? WONDERS.find((x) => x.id.startsWith(arg ?? "\u0000"));
  if (cmd === "list") {
    for (const x of WONDERS) {
      const s = stateOf(x.id);
      player.sendMessage(`§6${x.id}§7 at ${x.site.x}, ${x.site.z}: ${s.holderName ?? "free"}, ${s.built}/${s.paid}/${WONDER.stages} built/paid${challenges.has(x.id) ? ", challenged" : ""}`);
    }
    return;
  }
  if (!w) return player.sendMessage(`§7Wonder ids: ${WONDERS.map((x) => x.id).join(", ")}`);
  const s = stateOf(w.id);
  if (cmd === "tp") {
    const k = keeperSpot(w);
    player.addEffect("slow_falling", 300);
    player.teleport({ x: k.x + 0.5, y: 200, z: k.z + 0.5 }, { dimension: world.getDimension(OVERWORLD) });
    return player.sendMessage(`§7Falling to the keeper of the ${w.name}.`);
  }
  if (cmd === "claim") { claim(w, player.id, player.name, player); return player.sendMessage(`§6${w.name} is yours; stage ${s.paid} paid. Stay close while it rises.`); }
  if (cmd === "stage") { s.paid = Math.min(WONDER.stages, s.paid + 1); save(); return player.sendMessage(`§7${w.name}: ${s.paid} stages paid.`); }
  if (cmd === "finish") { s.paid = WONDER.stages; save(); return player.sendMessage(`§7${w.name}: every stage paid; the crew catches up while you're near.`); }
  if (cmd === "lord") {
    const lord = rivalLords().sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0];
    if (!lord) return player.sendMessage("§7No Rival Lords. /scriptevent siege:rivals few");
    claim(w, `npc:${lord.id}`, lordFullName(lord));
    return player.sendMessage(`§7${lordFullName(lord)} now holds the ${w.name}.`);
  }
  if (cmd === "challenge") {
    if (!s.holder) { claim(w, "npc:test", "a test lord"); s.built = Math.max(1, s.built); s.paid = Math.max(s.paid, s.built); save(); }
    s.restUntil = -1;
    return tryChallenge(player, w);
  }
  if (cmd === "reset") {
    store.data.w[w.id] = { holder: null, holderName: null, paid: 0, built: 0 };
    challenges.delete(w.id);
    save();
    return player.sendMessage(`§7${w.name} reset (the blocks already standing stay; the next build clears its ground first).`);
  }
});
