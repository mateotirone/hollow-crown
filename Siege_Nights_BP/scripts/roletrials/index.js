// The role storylines: trials for the four regional roles, mentor lines at every rank, and the Knight's
// middle (Stand the Wall, the Eleven). Thread "Finish the six role storylines", 2026-11-11.
// Plan: https://claude.ai/artifact/Ra52mNyxfnaP71DpzU3mQH . Words: data.js here, and lore/data/mentors.js.
//
// How a regional role is earned now: meet the mentor, who starts the trial (a lore flag such as kesh_call);
// do the steps; then the old deed (a boss falls near you, or your first dragon hatches). The role is then
// offered at the Tree of Oaths as before. A deed done before the trial is finished is kept, and the mentor
// sends word; the offer comes the moment the last step lands.
//
// Hooks this feature uses (all additive):
//   filter "roleOffer"        (town hall) hold a regional role until its trial is done
//   filter "dragonNestTake"   (dragons)   the Choosing: how you come at a nest
//   filter "treeButtons"      (town hall) the "Role trials" page at the Tree
//   event  "loreSetFlag"      (lore)      tell the mentors what you did
// Listens for: loreFlag, loreTalk, rankUp, siegeEnd, and block placing / entity deaths.
//
// Builder commands (operators):
//   /scriptevent siege:role_mark span_start | span_end    mark the two ends of the Span where you stand
//   /scriptevent siege:role_mark grave                    mark one of Goody Sedge's graves where you stand
//   /scriptevent siege:role_mark list | clear             show or remove every mark
//   /scriptevent siege:role_trial <role> [step]           start a trial, or finish one step of it (testing)
//   /scriptevent siege:role_trial reset                   forget all of your trials
// Saves: player property "hc:role_trials" (JSON, see logic.js blankTrials); world store "siege:role_marks".

import { world, system, ItemStack, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { on, emit, addFilter, onTick, isNight, keepOf, keepCenter, guardCount, countItem, takeItems, title, addTests, assert, assertEqual } from "../siege/api.js";
import { chargeE, worth } from "../economy/api.js";
import { sfx } from "../core/sfx.js";
import { TRIALS, TRIAL_ROLES, TRIAL_RULES as R, MENTORS, DEED_WAITS, STEP_LINES, RANK_LINES, ELEVEN } from "./data.js";
import {
  blankTrials, loadTrials, stepById, nextStep, trialComplete, markStep, markDeed, shouldOffer, gateOffer,
  visitGrave, spanProgress, spanPosition, isWeapon, rankLine, rankFlag, trialPage, nextKnight, roleOfStep,
} from "./logic.js";
import { MENTOR_NPCS } from "../lore/data/mentors.js";
import { NPCS } from "../lore/data/dialogue.js";
import { marks } from "./marks.js";
import "./showcase.js";

const PROP = "hc:role_trials";
const HERO_PROP = "siege:townhall_hero"; // written by the town hall
const DAY = 24000;
const BELL_NAME = "Hroda's Hand-bell";

// ---------- saves ----------
const cache = new Map(); // player id -> trials
function trialsOf(player) {
  let t = cache.get(player.id);
  if (t) return t;
  let saved;
  try {
    const raw = player.getDynamicProperty(PROP);
    if (typeof raw === "string") saved = JSON.parse(raw);
  } catch { /* unreadable: start fresh, never throw */ }
  t = loadTrials(saved);
  cache.set(player.id, t);
  return t;
}
function save(player) {
  try { player.setDynamicProperty(PROP, JSON.stringify(trialsOf(player))); } catch { /* left the game */ }
}
world.afterEvents.playerLeave.subscribe(({ playerId }) => cache.delete(playerId));

function pathOf(player) {
  try {
    const raw = player.getDynamicProperty(HERO_PROP);
    if (typeof raw === "string") return JSON.parse(raw).path ?? "none";
  } catch { /* no hero yet */ }
  return "none";
}

const now = () => world.getAbsoluteTime();
const loreFlag = (player, flag) => emit("loreSetFlag", { player, flag });
const fx = (entity, effect, ticks, amplifier = 0) => { try { entity.addEffect(effect, ticks, { amplifier, showParticles: false }); } catch { /* gone */ } };
const held = (player) => { try { return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId; } catch { return undefined; } };
const days = (ticks) => Math.max(1, Math.ceil(ticks / DAY));

function give(player, item) {
  try {
    const left = player.getComponent("minecraft:inventory")?.container?.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch { /* gone */ }
}

// ---------- the trial itself ----------

function startTrial(player, role) {
  const t = trialsOf(player).roles[role];
  if (!t || t.started) return;
  t.started = true;
  if (t.deed) markDeed(role, t); // the deed was done first; a hatched dragon has already chosen you
  save(player);
  player.sendMessage(`§6Trial begun: ${TRIALS[role].steps.map((s) => s.title).join(", then ")}.§7 The Tree of Oaths keeps track under "Role trials".`);
  for (const id of t.done) loreFlag(player, `trial_${id}`);
  settle(player, role);
}

function complete(player, stepId) {
  const role = roleOfStep(stepId);
  const t = role && trialsOf(player).roles[role];
  if (!t || !markStep(role, t, stepId)) return false;
  save(player);
  loreFlag(player, `trial_${stepId}`);
  if (STEP_LINES[stepId]) player.sendMessage(STEP_LINES[stepId]);
  sfx(player, "random.levelup", { pitch: 0.8, volume: 0.6 });
  const next = nextStep(role, t);
  if (next) system.runTimeout(() => { try { player.onScreenDisplay.setActionBar(`§7Next: §f${next.title}`); } catch { /* gone */ } }, 60);
  settle(player, role);
  return true;
}

// Ready? Tell the mentor, and offer the role if the deed is already done.
function settle(player, role) {
  const t = trialsOf(player).roles[role];
  if (trialComplete(role, t)) loreFlag(player, `trial_${role}_ready`);
  if (shouldOffer(role, t)) {
    t.offered = true;
    save(player);
    emit("offerRole", { player, role });
  }
}

// The town hall asks us before it offers a regional role. This is also how we hear the deed was done.
addFilter("roleOffer", (allowed, { player, role }) => {
  if (!allowed || !TRIALS[role] || !player) return allowed;
  const t = trialsOf(player).roles[role];
  if (!t.deed) {
    const result = markDeed(role, t);
    save(player);
    loreFlag(player, `trial_${role}_deed`);
    if (result === "offer") loreFlag(player, `trial_${role}_ready`);
    if (!gateOffer(role, t)) player.sendMessage(DEED_WAITS[role]);
  }
  if (gateOffer(role, t)) {
    t.offered = true;
    save(player);
    return true;
  }
  return false;
});

// ---------- what the mentors' buttons set ----------
const CALLS = Object.fromEntries(TRIAL_ROLES.map((role) => [TRIALS[role].call, role]));
on("loreFlag", ({ player, flag }) => {
  if (!player) return;
  if (CALLS[flag]) return startTrial(player, CALLS[flag]);
  if (flag === "nell_cup") {
    fx(player, "darkness", R.cupTicks);
    fx(player, "slowness", R.cupTicks, 1);
    fx(player, "nausea", 200);
    sfx(player, "random.drink");
    system.runTimeout(() => { try { sfx(player, "mob.warden.heartbeat", { pitch: 0.7 }); } catch { /* gone */ } }, 40);
    return complete(player, "cup");
  }
  if (flag === "knight_wall_asked") {
    trialsOf(player).wallAsked = true;
    save(player);
  }
});

// ---------- talk steps: checked every time you speak to the mentor ----------
on("loreTalk", ({ player, npc, choice }) => {
  if (!player || choice !== -1) return; // only when the conversation opens
  const roles = trialsOf(player).roles;
  if (npc === "ulla" && roles.forgemaster.started && !roles.forgemaster.done.includes("hearth")) {
    const short = Object.entries(R.hearth).filter(([id, n]) => countItem(player, id) < n);
    if (short.length) return;
    for (const [id, n] of Object.entries(R.hearth)) takeItems(player, id, n);
    const bell = new ItemStack("minecraft:bell", 1);
    bell.nameTag = `§b${BELL_NAME}`;
    try { bell.setLore(["§7Hroda's pattern. Set it down on ice", "§7or snow, at night, and ring it."]); } catch { /* old engine */ }
    give(player, bell);
    sfx(player, "random.anvil_use", { pitch: 0.8 });
    return complete(player, "hearth");
  }
  if (npc === "ottilie" && roles.captain.started) {
    if (!roles.captain.done.includes("articles")) {
      if (chargeE(player, R.debtShare, "holt_debt")) {
        sfx(player, "random.orb", { pitch: 0.7 });
        return complete(player, "articles");
      }
      return player.sendMessage(`§7Your share of Holt's Debt is ${worth(R.debtShare)}.`);
    }
    if (!roles.captain.done.includes("crew")) {
      const crew = guardCount(player.id);
      if (crew >= R.crew) return complete(player, "crew");
      return player.sendMessage(`§7You have ${crew} guard${crew === 1 ? "" : "s"} sworn to your keep. Ottilie wants ${R.crew}.`);
    }
  }
});

// ---------- the Choosing: how you come at a Dragon Nest ----------
addFilter("dragonNestTake", (refused, { player }) => {
  if (refused || !player) return refused;
  const t = trialsOf(player).roles.rider;
  if (!t.started || t.done.includes("choosing")) return refused;
  if (t.burnUntil > now()) return `§7The dragons won't look at you for ${days(t.burnUntil - now())} more day. Come back calmer.`;
  if (isWeapon(held(player)) || player.isSprinting) {
    t.burnUntil = now() + R.burnDays * DAY;
    save(player);
    try { player.setOnFire(5, true); } catch { /* fireproof */ }
    try { player.applyDamage(4, { cause: EntityDamageCause.fire }); } catch { /* gone */ }
    sfx(player, "mob.ghast.scream", { pitch: 0.5, volume: 0.6 });
    sfx(player, "mob.blaze.shoot", { pitch: 0.6 });
    return "§cThe nest's dragon rears up and breathes. You came at it wrong. Kesh did warn you.";
  }
  complete(player, "choosing");
  return refused;
});

// ---------- ringing Hroda's bell on the ice ----------
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (block.typeId !== "minecraft:bell") return;
  const t = trialsOf(player).roles.forgemaster;
  if (!t.started || !t.done.includes("hearth") || t.done.includes("ring")) return;
  let under = "";
  try { under = block.below()?.typeId ?? ""; } catch { /* edge of the world */ }
  if (!isNight() || !/ice|snow/.test(under)) {
    return player.onScreenDisplay.setActionBar("§7Ulla said: on the ice, at night. Pick it up and try again.");
  }
  sfx(block.dimension, "block.bell.hit", block.location, { pitch: 0.7 });
  complete(player, "ring");
  const at = block.location;
  system.runTimeout(() => {
    try { player.runCommand(`scriptevent siege:bestiary_summon huntsman ${at.x + 6} ${at.y} ${at.z + 6}`); } catch (e) { console.warn(`[Role trials] could not raise the Huntsman: ${e}`); }
  }, 60);
});

// ---------- the Span and the graves (places the map builder marks) ----------
const crumbling = new Map(); // "x,y,z" -> tick it comes back

function spanTick(player, t) {
  if (t.done.includes("span")) return;
  const time = now();
  for (const span of marks.data.spans) {
    if (span.dim !== player.dimension.id) continue;
    const at = player.location;
    if (t.washUntil > time) {
      if (Math.hypot(at.x - span.start.x, at.z - span.start.z) <= R.spanReach) player.onScreenDisplay.setActionBar(`§7The Span is closed to you for ${days(t.washUntil - time)} more day${days(t.washUntil - time) === 1 ? "" : "s"}.`);
      continue;
    }
    const ends = [span.start, span.end].map((e) => Math.hypot(at.x - e.x, at.z - e.z) <= R.spanReach && Math.abs(at.y - e.y) < 3);
    const step = spanProgress(t, ends[0] ? 0 : ends[1] ? 1 : -1);
    if (step === "set off") { save(player); player.onScreenDisplay.setActionBar("§7The Span. Don't stop in the middle."); }
    if (step === "across") return complete(player, "span");
    if (t.spanFrom === -1) continue;
    const pos = spanPosition(span.start, span.end, at);
    if (!pos || pos.off > 3) continue;
    if (pos.below > R.spanFall) {
      t.spanFrom = -1;
      t.washUntil = time + R.washoutDays * DAY;
      save(player);
      title(player, "§cWashed out", `§7Try the Span again in ${R.washoutDays} days`);
      sfx(player, "mob.wither.hurt", { pitch: 0.5, volume: 0.4 });
      continue;
    }
    if (pos.off < 1.5 && Math.abs(pos.below) < 2) {
      // stones that crumble under you, and wind up the gorge
      try {
        const under = player.dimension.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y) - 1, z: Math.floor(at.z) });
        if (under?.typeId === "minecraft:cracked_stone_bricks") {
          const key = `${under.x},${under.y},${under.z}`;
          if (!crumbling.has(key)) {
            crumbling.set(key, system.currentTick + 240);
            sfx(player, "dig.gravel", { pitch: 0.6 });
            system.runTimeout(() => { try { if (under.isValid && under.typeId === "minecraft:cracked_stone_bricks") under.setType("minecraft:air"); } catch { /* unloaded */ } }, 20);
            system.runTimeout(() => {
              crumbling.delete(key);
              try { const b = player.dimension.getBlock({ x: under.x, y: under.y, z: under.z }); if (b?.isAir) b.setType("minecraft:cracked_stone_bricks"); } catch { /* unloaded */ }
            }, 240);
          }
        }
      } catch { /* unloaded */ }
      if (Math.random() < 0.08) {
        const dx = span.end.x - span.start.x, dz = span.end.z - span.start.z, len = Math.hypot(dx, dz) || 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        try { player.applyKnockback({ x: (-dz / len) * 0.35 * side, z: (dx / len) * 0.35 * side }, 0.05); } catch { /* can't be pushed */ }
        sfx(player, "elytra.loop", { pitch: 0.6, volume: 0.3 });
      }
    }
  }
}

const GRAVE_GIFTS = [["minecraft:glow_berries", 6], ["minecraft:honey_bottle", 2], ["minecraft:golden_carrot", 3], ["minecraft:spider_eye", 4]];
function graveTick(player, t) {
  if (!t.done.includes("cup") || t.done.includes("graves") || !player.isSneaking) return;
  marks.data.graves.forEach((grave, index) => {
    if (grave.dim !== player.dimension.id || t.graves.includes(index)) return;
    const at = player.location;
    if (Math.hypot(at.x - grave.at.x, at.z - grave.at.z) > R.graveReach || Math.abs(at.y - grave.at.y) > 3) return;
    const count = visitGrave(t, index);
    save(player);
    sfx(player, "dig.grass", { pitch: 0.7 });
    sfx(player, "chime.amethyst_block", { pitch: 0.6, volume: 0.5 });
    player.onScreenDisplay.setActionBar(`§2You kneel and leave her something. (${Math.min(count, R.graves)} of ${R.graves} graves)`);
    if (count >= R.graves) {
      const [id, n] = GRAVE_GIFTS[Math.floor(Math.random() * GRAVE_GIFTS.length)];
      give(player, new ItemStack(id, n));
      player.sendMessage("§2Something is lying on the grave that wasn't there a moment ago. It's for you.");
      complete(player, "graves");
    }
  });
}

onTick("roletrials", 10, () => {
  if (!marks.data.spans.length && !marks.data.graves.length) return;
  for (const player of world.getPlayers()) {
    try {
      const roles = trialsOf(player).roles;
      if (roles.rider.started && marks.data.spans.length) spanTick(player, roles.rider);
      if (roles.witch.started && marks.data.graves.length) graveTick(player, roles.witch);
    } catch (e) {
      console.warn(`[Role trials] ${e}`);
    }
  }
});

// ---------- rank-ups: the mentor answers ----------
on("rankUp", ({ player, path, rank }) => {
  if (!player) return;
  loreFlag(player, rankFlag(path, rank));
  const line = rankLine(path, rank);
  if (!line) return;
  system.runTimeout(() => {
    try {
      player.sendMessage(`§e${line}`);
      sfx(player, path === "marked" ? "mob.allay.idle" : path === "rider" ? "mob.enderdragon.flap" : path === "forgemaster" ? "random.anvil_land" : path === "captain" ? "bucket.fill_water" : path === "witch" ? "mob.witch.ambient" : "note.bell", { volume: 0.5, pitch: 0.9 });
    } catch { /* gone */ }
  }, 60);
});

// ---------- the Knight's middle: Stand the Wall, and the Eleven ----------
function knightJoins(player, t) {
  const knight = nextKnight(t);
  if (!knight) return;
  t.eleven++;
  save(player);
  player.sendMessage(`§6${knight.name} of the Ashen Gate rides in to your keep (${t.eleven} of ${ELEVEN.length}).§7 ${knight.line}`);
  sfx(player, "mob.horse.gallop", { pitch: 0.9 });
  if (t.eleven >= ELEVEN.length) {
    loreFlag(player, "eleven_all");
    title(player, "§6The Eleven", "§7Every knight the Order has left stands with you");
  }
}

on("siegeEnd", ({ outcome, besieged = [] }) => {
  if (outcome !== "won") return;
  const players = world.getAllPlayers();
  for (const player of players) {
    if (pathOf(player) !== "knight") continue;
    const t = trialsOf(player);
    const own = besieged.includes(player.id);
    const helped = !own && besieged.some((owner) => {
      try {
        const keep = keepOf(owner);
        const c = keep && keepCenter(keep);
        return c && player.dimension.id === "minecraft:overworld" && Math.hypot(player.location.x - c.x, player.location.z - c.z) < 96;
      } catch { return false; }
    });
    if (!own && !helped) continue;
    if (!t.knightWall) {
      if (t.wallAsked && (helped || players.length === 1)) {
        t.knightWall = true;
        save(player);
        loreFlag(player, "knight_wall");
        player.sendMessage("§6You stood the wall.§7 Aldous will want to hear of it.");
      }
      continue;
    }
    knightJoins(player, t);
  }
});

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  let boss = false, at, dim;
  try {
    boss = deadEntity.hasTag("siege_boss");
    at = deadEntity.location;
    dim = deadEntity.dimension;
  } catch { return; }
  if (!boss) return;
  for (const player of dim.getPlayers({ location: at, maxDistance: 48 })) {
    if (pathOf(player) === "knight" && trialsOf(player).knightWall) knightJoins(player, trialsOf(player));
  }
});

// ---------- the "Role trials" page at the Tree of Oaths ----------
function trialsMenu(player, back) {
  const t = trialsOf(player);
  const path = pathOf(player);
  const parts = [];
  if (path === "knight") {
    parts.push(`§6The Eleven§r: ${t.knightWall ? `${t.eleven} of ${ELEVEN.length} knights stand with you.` : t.wallAsked ? "Stand on a besieged wall, as Aldous asked." : "Sir Aldous has something to ask you."}`);
  }
  for (const role of TRIAL_ROLES) {
    const r = t.roles[role];
    const mentor = MENTOR_NPCS.find((n) => n.id === TRIALS[role].mentor)?.name ?? MENTORS[role].name;
    if (path === role) parts.push(`§a${titleOf(role)}§r: sworn. ${mentor} still teaches you.`);
    else if (r.started) parts.push(`§f${titleOf(role)}§r (${mentor})\n${trialPage(role, r)}`);
    else if (path === "none") parts.push(`§8${titleOf(role)}§r: not begun. ${mentor}, at ${TRIALS[role].where}.${r.deed ? " §eYou have already done the deed." : ""}`);
  }
  if (!parts.length) parts.push("You hold your role. The other roads are closed to you.");
  new ActionFormData().title("Role trials").body(parts.join("\n\n")).button("Back").show(player).then(() => back?.()).catch(() => {});
}
const titleOf = (role) => ({ rider: "Dragon Rider", forgemaster: "Forgemaster", captain: "Captain", witch: "Witch" })[role] ?? role;

addFilter("treeButtons", (list, { player }) => [...list, { label: "Role trials\n§8mentors and steps", icon: "textures/items/book_writable", open: trialsMenu }]);

// ---------- builder and test commands ----------
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const [what, arg] = event.message.trim().split(/\s+/);
  if (event.id === "siege:role_mark") {
    const here = { x: Math.floor(player.location.x) + 0.5, y: Math.floor(player.location.y), z: Math.floor(player.location.z) + 0.5 };
    const dim = player.dimension.id;
    if (what === "span_start") { marks.data.pending[player.id] = here; marks.save(); return player.sendMessage("§aSpan start marked. Walk to the far end and use span_end."); }
    if (what === "span_end") {
      const start = marks.data.pending[player.id];
      if (!start) return player.sendMessage("§cMark span_start first.");
      marks.data.spans.push({ dim, start, end: here });
      delete marks.data.pending[player.id];
      marks.save();
      return player.sendMessage(`§aSpan marked (${Math.round(Math.hypot(here.x - start.x, here.z - start.z))} blocks). Use cracked stone bricks on it for stones that crumble.`);
    }
    if (what === "grave") { marks.data.graves.push({ dim, at: here }); marks.save(); return player.sendMessage(`§aGrave ${marks.data.graves.length} marked.`); }
    if (what === "clear") { marks.data.spans = []; marks.data.graves = []; marks.save(); return player.sendMessage("§aEvery Span and grave mark removed."); }
    return player.sendMessage(`§7Spans: ${marks.data.spans.map((s) => `${Math.round(s.start.x)},${Math.round(s.start.z)} to ${Math.round(s.end.x)},${Math.round(s.end.z)}`).join("; ") || "none"}\nGraves: ${marks.data.graves.map((g) => `${Math.round(g.at.x)},${Math.round(g.at.z)}`).join("; ") || "none"}`);
  }
  if (event.id === "siege:role_trial") {
    if (what === "reset") { cache.set(player.id, blankTrials()); save(player); return player.sendMessage("§aYour role trials are forgotten."); }
    if (!TRIALS[what]) return player.sendMessage(`§7Roles: ${TRIAL_ROLES.join(", ")}`);
    startTrial(player, what);
    if (arg && stepById(what, arg)?.how !== "deed") complete(player, arg);
    else if (arg) emit("offerRole", { player, role: what });
  }
});

// ---------- self-tests ----------
addTests("roletrials", {
  "every regional role has a trial that ends in its deed, with a mentor who exists": () => {
    for (const role of TRIAL_ROLES) {
      const trial = TRIALS[role];
      assert(trial.steps.length === 3, `${role}: three steps`);
      assertEqual(trial.steps.at(-1).how, "deed");
      assert(trial.steps.slice(0, -1).every((s) => s.how !== "deed"), `${role}: only the last step is the deed`);
      assert(NPCS.some((n) => n.id === trial.mentor), `${role}: mentor ${trial.mentor} has dialogue`);
      assert(DEED_WAITS[role], `${role}: word from the mentor when the deed comes first`);
      for (const s of trial.steps) assert(s.title && s.hint, `${role}/${s.id}: title and hint`);
    }
    const ids = TRIAL_ROLES.flatMap((r) => TRIALS[r].steps.map((s) => s.id));
    assertEqual(new Set(ids).size, ids.length);
  },
  "a mentor's dialogue starts the trial and answers every step": () => {
    for (const role of TRIAL_ROLES) {
      const npc = NPCS.find((n) => n.id === TRIALS[role].mentor);
      const effects = Object.values(npc.nodes).flatMap((n) => n.opts.flatMap((o) => o[2] ?? []));
      assert(effects.includes(`flag:${TRIALS[role].call}`), `${role}: some button starts the trial`);
      const conds = npc.start.flatMap(([c]) => c);
      assert(conds.includes(`path:${role}`) && conds.includes(`flag:trial_${role}_ready`), `${role}: sworn and ready scenes`);
      for (const s of TRIALS[role].steps.slice(0, -1)) {
        assert(conds.includes(s.how === "flag" ? `flag:${s.flag}` : `flag:trial_${s.id}`), `${role}: a scene for after ${s.id}`);
      }
    }
  },
  "the trial: steps, then the deed, then one offer": () => {
    const all = blankTrials();
    const t = all.roles.forgemaster;
    assert(!markStep("forgemaster", t, "hearth"), "nothing counts before the mentor starts the trial");
    t.started = true;
    assert(markStep("forgemaster", t, "hearth"));
    assert(!markStep("forgemaster", t, "hearth"), "once only");
    assert(!gateOffer("forgemaster", t));
    assertEqual(markDeed("forgemaster", t), "wait");
    assert(markStep("forgemaster", t, "ring"));
    assert(trialComplete("forgemaster", t) && shouldOffer("forgemaster", t));
    t.offered = true;
    assert(!shouldOffer("forgemaster", t), "offered once");
    assert(gateOffer("knight", t), "the Ember's roles are not held back");
  },
  "a hatched dragon settles the Choosing": () => {
    const t = blankTrials().roles.rider;
    t.started = true;
    t.done.push("span");
    assertEqual(markDeed("rider", t), "offer");
    assert(t.done.includes("choosing"));
  },
  "the Span: set off from one end, arrive at the other; falling is measured from the line": () => {
    const t = blankTrials().roles.rider;
    assertEqual(spanProgress(t, 0), "set off");
    assertEqual(spanProgress(t, 0), "");
    assertEqual(spanProgress(t, 1), "across");
    const p = spanPosition({ x: 0, y: 70, z: 0 }, { x: 0, y: 70, z: 12 }, { x: 1, y: 64, z: 6 });
    assertEqual(Math.round(p.along * 100), 50);
    assertEqual(p.off, 1);
    assertEqual(p.below, 6);
    assertEqual(spanPosition({ x: 0, y: 70, z: 0 }, { x: 0, y: 70, z: 12 }, { x: 0, y: 70, z: 20 }), undefined);
  },
  "graves count once each": () => {
    const t = blankTrials().roles.witch;
    assertEqual(visitGrave(t, 0), 1);
    assertEqual(visitGrave(t, 0), 1);
    assertEqual(visitGrave(t, 2), 2);
  },
  "weapons the dragons won't abide": () => {
    for (const w of ["minecraft:iron_sword", "minecraft:diamond_axe", "minecraft:bow", "minecraft:crossbow", "minecraft:trident", "minecraft:mace"]) assert(isWeapon(w), w);
    for (const w of ["minecraft:pickaxe", "minecraft:bread", undefined, "minecraft:iron_pickaxe", "minecraft:bowl"]) assert(!isWeapon(w), String(w));
  },
  "every rank of every role has a line from its mentor, and old saves load": () => {
    const RANK_NAMES = {
      knight: ["Man-at-Arms", "Knight", "Banneret", "Knight-Commander"], marked: ["Listener", "Adept", "Veilwalker", "Sorcerer"],
      rider: ["Rider", "Wing-Sworn", "Drake-Captain", "Dragonlord"], forgemaster: ["Journeyman", "Smith", "Master Smith", "Forgemaster"],
      captain: ["Bosun", "Mate", "Captain", "Admiral"], witch: ["Herbwife", "Witch", "Crone", "Fen Mother"],
    };
    for (const [path, ranks] of Object.entries(RANK_NAMES)) for (const rank of ranks) assert(rankLine(path, rank), `${path} ${rank}`);
    assertEqual(Object.keys(RANK_LINES).length, 6);
    assertEqual(rankFlag("marked", "Listener"), "rank_marked_listener");
    assertEqual(rankFlag("knight", "Man-at-Arms"), "rank_knight_man_at_arms");
    const loaded = loadTrials({ roles: { witch: { started: true, done: ["cup"] } }, eleven: 99 });
    assert(loaded.roles.witch.started && loaded.roles.rider.done.length === 0);
    assertEqual(loaded.eleven, ELEVEN.length);
    assertEqual(loadTrials("rubbish").eleven, 1);
  },
  "the Eleven: ten more come after the wall, then no more": () => {
    const t = blankTrials();
    assertEqual(nextKnight(t), undefined);
    t.knightWall = true;
    let n = 0;
    while (nextKnight(t)) { t.eleven++; n++; }
    assertEqual(n, ELEVEN.length - 1);
    assertEqual(new Set(ELEVEN.map((k) => k.name)).size, ELEVEN.length);
  },
});
