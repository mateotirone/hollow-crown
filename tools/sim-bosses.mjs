// Run from the repo root: node tools/sim-bosses.mjs [boss ...] [--quiet]
// Plays every boss fight from its first line to its death in a fake world: flat ground, one player (or several)
// who hits the boss, kills what it summons and does what each fight asks (rings the bells, breaks the pillars,
// finds the real Mother, knocks the Crown off). It reads the real entity files, so a boss that "cannot be hurt"
// really cannot be here either. It prints what a player would be told, and fails on:
//   - any error a fight swallowed (bossCore runs every callback in a try/catch, so in the game they are silent)
//   - a fight that never ends, a phase or stage that never starts, a boss that dies when it should not
//   - a boss that drops nothing
// Must end with SIM OK. It cannot judge how a fight looks or feels: that is what a playtest is for.
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "Siege_Nights_BP/scripts");
const { makeMock } = await import(pathToFileURL(join(ROOT, "tools/mock-minecraft.mjs")));
const walk = (d, ext) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : []; });
const args = process.argv.slice(2);
const QUIET = args.includes("--quiet");
const ONLY = args.filter((a) => !a.startsWith("--"));
// The same dice every run, so a failure can be played again: --seed=7 picks another set of rolls
{
  let a = (Number(args.find((x) => x.startsWith("--seed="))?.slice(7) ?? 1) * 2654435761) >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ----- what the pack says about each entity -----
const pack = { blocks: new Set(), items: new Set(), entities: new Set() };
const KINDS = {}; // type id -> { health, families, speed, sensor, flies, events }
for (const f of walk(join(ROOT, "Siege_Nights_BP"), ".json")) {
  try {
    const d = JSON.parse(readFileSync(f, "utf8"));
    for (const [k, set] of [["minecraft:block", pack.blocks], ["minecraft:item", pack.items], ["minecraft:entity", pack.entities]]) {
      const id = d[k]?.description?.identifier;
      if (id) set.add(id);
    }
    const e = d["minecraft:entity"];
    if (!e) continue;
    const c = e.components ?? {};
    KINDS[e.description.identifier] = {
      health: c["minecraft:health"]?.max ?? c["minecraft:health"]?.value ?? 20,
      families: c["minecraft:type_family"]?.family ?? [],
      speed: c["minecraft:movement"]?.value ?? 0,
      sensor: [c["minecraft:damage_sensor"]?.triggers ?? []].flat(),
      flies: !!c["minecraft:can_fly"] || !!c["minecraft:navigation.fly"] || !!c["minecraft:navigation.float"],
      rideable: !!c["minecraft:rideable"],
      events: Object.keys(e.events ?? {}),
    };
  } catch { /* not ours to read */ }
}
const VANILLA = { health: 20, families: ["monster", "mob"], speed: 0.25, sensor: [], flies: false, rideable: false, events: [] };
const kindOf = (typeId) => KINDS[typeId] ?? (typeId.startsWith("minecraft:") ? { ...VANILLA, health: typeId.endsWith("ravager") ? 100 : 20 } : undefined);

const mock = makeMock(pack);
globalThis.__mc = mock;
globalThis.__siegeOffline = true;
class BlockVolume { constructor(from, to) { this.from = from; this.to = to; } }
{ const base = mock.lookup; mock.lookup = (n) => (n === "BlockVolume" ? BlockVolume : base(n)); }
const world = mock.lookup("world"), system = mock.lookup("system");
{ const I = mock.lookup("ItemStack").prototype; I.setDynamicProperty = function (k, v) { (this._props ??= {})[k] = v; }; I.getDynamicProperty = function (k) { return this._props?.[k]; }; I.clone = function () { return this; }; I.isStackableWith = () => false; }

// ----- time -----
let now = 0;
Object.defineProperty(system, "currentTick", { get: () => now });
let runId = 0;
const intervals = new Map(), timers = [];
system.runInterval = (fn, ticks = 1) => { intervals.set(++runId, { fn, ticks: Math.max(1, ticks), from: now }); return runId; };
system.runTimeout = (fn, t = 1) => { timers.push({ at: now + Math.max(1, t), fn, id: ++runId }); return runId; };
system.run = (fn) => system.runTimeout(fn, 1);
system.runJob = (gen) => { try { for (const _ of gen) { /* run to the end at once */ } } catch (e) { warned.push(`runJob: ${e}`); } return ++runId; };
system.clearRun = (id) => { intervals.delete(id); const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
system.clearJob = () => {};
system.sendScriptEvent = (id, message) => scriptEvent(id, message);
const warned = [];
{ const BP = mock.lookup("BlockPermutation"); BP.resolve = (id) => ({ type: { id }, getState: () => undefined, withState() { return this; }, matches: (t) => t === id, getAllStates: () => ({}) }); }
const fire = (path, event) => { for (const s of mock.subscriptions) if (s.path === path) { try { s.fn(event); } catch (e) { warned.push(`${path}: ${e?.stack?.split("\n").slice(0, 3).join(" | ") ?? e}`); } } };
function scriptEvent(id, message = "", sourceEntity) { fire("system.afterEvents.scriptEventReceive", { id, message, sourceEntity, sourceType: sourceEntity ? "Entity" : "Server" }); }

// ----- the world: flat ground in every dimension -----
// the top solid block: the overworld at 63; in the Hollow the Court's floor (y 90) in the north and the Seat's (y 120) in the south
const floorTop = (id, x, z) => (id === "siege:undertow" ? (z < 2000 ? 89 : 119) : 63);
const log = [];
let lastBar = "";
const stamp = () => `${String(Math.floor(now / 20)).padStart(4)}s`;
const say = (kind, text) => {
  text = String(text).replace(/§./g, "").replace(/\n/g, " / ");
  if (kind === "bar") { const key = text.replace(/\d+/g, "#"); if (key === lastBar) return; lastBar = key; }
  log.push(`${stamp()}  ${kind.padEnd(5)} ${text}`);
};
const entities = new Set();
const players = [];
const missing = {}; // API a fight asked for that this fake world does not have: each one is checked by hand
let eid = 1;
const dims = new Map();
const flatD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Blocks the add-on itself places (the pocket arenas, the Seat's falling floor) are kept as boxes, newest on top
const fills = new Map(); // dimension id -> [{ a, b, id }]
const blockCache = new Map();
function fillBox(dimId, from, to, typeId) {
  const a = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), z: Math.min(from.z, to.z) }, b = { x: Math.max(from.x, to.x), y: Math.max(from.y, to.y), z: Math.max(from.z, to.z) };
  if (!fills.has(dimId)) fills.set(dimId, []);
  fills.get(dimId).push({ a, b, id: typeId });
  blockCache.clear();
}
function typeAt(dimId, x, y, z) {
  const key = `${dimId}:${x},${y},${z}`;
  let t = blockCache.get(key);
  if (t !== undefined) return t;
  t = y <= floorTop(dimId, x, z) ? "minecraft:stone" : "minecraft:air";
  const list = fills.get(dimId);
  if (list) for (let i = list.length - 1; i >= 0; i--) { const f = list[i]; if (x >= f.a.x && x <= f.b.x && y >= f.a.y && y <= f.b.y && z >= f.a.z && z <= f.b.z) { t = f.id; break; } }
  if (blockCache.size > 400000) blockCache.clear();
  blockCache.set(key, t);
  return t;
}
const idOf = (b) => (typeof b === "string" ? b : b?.type?.id ?? b?.typeId ?? b?.id ?? String(b));
const PASSABLE = /carpet|lantern|torch|pane|_wall$|banner|flower|grass$|sign|rail/;

function makeDim(id) {
  const base = world.getDimension0(id);
  const top = (l) => floorTop(id, l.x, l.z);
  const block = (l) => {
    const loc = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
    const chest = chests.get(`${id}:${loc.x},${loc.y},${loc.z}`);
    const type = chest ? "minecraft:chest" : typeAt(id, loc.x, loc.y, loc.z);
    const air = type === "minecraft:air", liquid = /water|lava/.test(type), solid = !air && !liquid;
    return { location: loc, x: loc.x, y: loc.y, z: loc.z, dimension: dim, isValid: true, typeId: type,
      isAir: air, isLiquid: liquid, isSolid: solid && !PASSABLE.test(type), permutation: { getState: () => undefined, matches: (t) => t === type, type: { id: type } },
      above: (n = 1) => block({ ...loc, y: loc.y + n }), below: (n = 1) => block({ ...loc, y: loc.y - n }), hasTag: () => false, getTags: () => [],
      setType(t) { if (idOf(t) === "minecraft:chest") chests.set(`${id}:${loc.x},${loc.y},${loc.z}`, []); else fillBox(id, loc, loc, idOf(t)); }, setPermutation(pm) { const t = idOf(pm); if (t.includes(":")) fillBox(id, loc, loc, t); },
      getComponent: (c) => (/inventory/.test(c) && chests.has(`${id}:${loc.x},${loc.y},${loc.z}`) ? { container: { size: 27, emptySlotsCount: 27, addItem(s) { say("vault", `${s.amount} x ${s.typeId}`); vaulted.push(s); }, getItem() {}, setItem() {} } } : undefined) };
  };
  const match = (list, q) => list.filter((e) => e.isValid && e.dimension === dim
    && (!q.type || e.typeId === q.type) && (!q.excludeTypes || !q.excludeTypes.includes(e.typeId))
    && (!q.tags || q.tags.every((t) => e.tags.has(t))) && (!q.excludeTags || !q.excludeTags.some((t) => e.tags.has(t)))
    && (!q.families || q.families.every((x) => e.families.includes(x))) && (!q.excludeFamilies || !q.excludeFamilies.some((x) => e.families.includes(x)))
    && (!q.name || e.nameTag === q.name)
    && (!q.location || q.maxDistance === undefined || dist(e.location, q.location) <= q.maxDistance)
    && (!q.location || q.minDistance === undefined || dist(e.location, q.location) >= q.minDistance));
  const dim = Object.assign(base, {
    id, heightRange: { min: -64, max: 320 },
    getBlock: block,
    getTopmostBlock: ({ x, z }) => block({ x, y: top({ x, z }), z }),
    getBlockFromRay: (from, dir, o = {}) => { // walked in small steps: the first block that is not air (water too, if asked)
      const max = o.maxDistance ?? 32;
      for (let d = 0; d <= max; d += 0.25) {
        const b = block({ x: from.x + dir.x * d, y: from.y + dir.y * d, z: from.z + dir.z * d });
        if (b.isAir || (b.isLiquid && !o.includeLiquidBlocks) || (o.includePassableBlocks === false && PASSABLE.test(b.typeId))) continue;
        return { block: b, face: "Up", faceLocation: { x: 0.5, y: 0.5, z: 0.5 } };
      }
      return undefined;
    },
    getBlockBelow: (l) => block({ x: l.x, y: top(l), z: l.z }),
    getEntities: (q = {}) => { const out = match([...entities, ...players], q); return q.closest ? out.sort((a, b) => dist(a.location, q.location) - dist(b.location, q.location)).slice(0, q.closest) : out; },
    getPlayers: (q = {}) => match(players, q),
    getEntitiesAtBlockLocation: () => [],
    spawnEntity: (type, at) => spawn(type, at, dim),
    spawnItem: (s) => { dropped.push(s); say("drop", `${s.amount} x ${s.typeId}`); return {}; },
    setWeather() {},
    fillBlocks: (vol, b) => { const from = vol.from ?? vol.getMin?.(), to = vol.to ?? vol.getMax?.(); if (!from || !to) { missing["fillBlocks with an unknown volume"] = 1; return 0; } fillBox(id, from, to, idOf(b)); return { getCapacity: () => 0 }; },
    setBlockType: (l, t) => fillBox(id, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, idOf(t)),
    setBlockPermutation: (l, t) => { const n = idOf(t); if (n.includes(":")) fillBox(id, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, n); }, containsBlock: () => false, getWeather: () => "Clear",
  });
  return dim;
}
world.getDimension0 = world.getDimension;
world.getDimension = (id) => { const key = id.includes(":") ? id : `minecraft:${id}`; if (!dims.has(key)) dims.set(key, makeDim(key)); return dims.get(key); };
world.getPlayers = (q = {}) => players.filter((p) => p.isValid && (!q.tags || q.tags.every((t) => p.tags.has(t))));
world.getAllPlayers = () => players.filter((p) => p.isValid);
world.getEntity = (id) => [...entities, ...players].find((e) => e.id === id);
world.getDay = () => 7; world.getTimeOfDay = () => 6000; world.getAbsoluteTime = () => 7 * 24000 + 6000;
world.getMoonPhase = () => 0;
world.structureManager = { place() {}, get: () => undefined, getWorldStructureIds: () => [] };
world.gameRules = {};
const chests = new Map(), vaulted = [], dropped = [];

// ----- entities -----
const snake = (s) => String(s).replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const filterOk = (flt, e) => {
  if (!flt) return true;
  if (Array.isArray(flt)) return flt.every((x) => filterOk(x, e));
  if (flt.all_of) return flt.all_of.every((x) => filterOk(x, e));
  if (flt.any_of) return flt.any_of.some((x) => filterOk(x, e));
  if (flt.none_of) return !flt.none_of.some((x) => filterOk(x, e));
  const not = flt.operator === "!=" || flt.operator === "not";
  if (flt.test === "has_tag") return e.tags.has(flt.value) !== not;
  if (flt.test === "is_family") return true; // about the attacker: this player counts as anyone
  return true;
};
// What a hit really does, by the entity's own damage_sensor
function sensed(e, amount, cause) {
  for (const t of e.kind.sensor) {
    if (cause === "selfDestruct") return amount;
    if (t.cause && t.cause !== "all" && t.cause !== snake(cause)) continue;
    if (!filterOk(t.on_damage?.filters, e)) continue;
    if (t.deals_damage === "no" || t.deals_damage === false) return 0;
    return amount * (t.damage_multiplier ?? 1) + (t.damage_modifier ?? 0);
  }
  return amount;
}
class Ent {
  constructor(typeId, at, dim, kind) {
    this.id = `e${eid++}`; this.typeId = typeId; this.location = { x: at.x, y: at.y, z: at.z }; this.dimension = dim; this.isValid = true;
    this.kind = kind; this.families = kind.families; this.nameTag = ""; this.tags = new Set(); this.effects = new Map(); this.props = new Map();
    this.hp = kind.health; this.maxHp = kind.health; this.isOnGround = true; this.isSneaking = false; this.target = undefined;
    this.events = []; this.view = { x: 0, y: 0, z: 1 }; this.rider = undefined; this.ridingOn = undefined;
  }
  get isInWater() { return /water/.test(typeAt(this.dimension.id, Math.floor(this.location.x), Math.floor(this.location.y), Math.floor(this.location.z))); }
  hasTag(t) { return this.tags.has(t); } addTag(t) { this.tags.add(t); return true; } removeTag(t) { return this.tags.delete(t); } getTags() { return [...this.tags]; }
  addEffect(n, ticks, o) { if (!this.isValid) throw new Error("entity gone"); this.effects.set(n, { amplifier: o?.amplifier ?? 0, until: now + ticks, typeId: n }); }
  getEffect(n) { const x = this.effects.get(n); return x && x.until > now ? { amplifier: x.amplifier, duration: x.until - now, typeId: n } : undefined; }
  getEffects() { return [...this.effects.keys()].map((n) => this.getEffect(n)).filter(Boolean); }
  removeEffect(n) { return this.effects.delete(n); }
  getComponent(name) {
    const c = name.replace(/^minecraft:/, ""), self = this;
    if (c === "health") return { get currentValue() { return self.hp; }, get effectiveMax() { return self.maxHp; }, effectiveMin: 0, defaultValue: self.maxHp,
      setCurrentValue(v) { self.hp = Math.max(0, Math.min(self.maxHp, v)); return true; }, resetToMaxValue() { self.hp = self.maxHp; }, resetToDefaultValue() { self.hp = self.maxHp; } };
    if (c === "movement") return { currentValue: this.kind.speed, defaultValue: this.kind.speed, setCurrentValue() {} };
    if (c === "can_fly") return this.kind.flies ? {} : undefined;
    if (c === "riding") return this.ridingOn ? { entityRidingOn: this.ridingOn } : undefined;
    if (c === "rideable") return this.kind.rideable ? { addRider: (r) => { r.ridingOn = self; self.rider = r; return true; }, ejectRider: (r) => { r.ridingOn = undefined; self.rider = undefined; }, ejectRiders() {}, getRiders: () => (self.rider ? [self.rider] : []) } : undefined;
    if (c === "type_family") return { getTypeFamilies: () => this.families, hasTypeFamily: (x) => this.families.includes(x) };
    if (c === "equippable") return { getEquipment: () => undefined, setEquipment() {}, getEquipmentSlot: () => ({ getItem: () => undefined, setItem() {} }) };
    if (c === "inventory") return undefined;
    if (c === "variant" || c === "mark_variant" || c === "skin_id" || c === "scale" || c === "color") return { value: 0 };
    if (c === "tameable" || c === "leashable" || c === "projectile" || c === "is_baby" || c === "item") return undefined;
    missing[`getComponent("${c}") on ${this.typeId}`] = 1;
    return undefined;
  }
  teleport(to, o) { if (!this.isValid) throw new Error("entity gone"); if (![to.x, to.y, to.z].every(Number.isFinite)) throw new Error(`teleport to nowhere: ${JSON.stringify(to)}`); this.location = { x: to.x, y: to.y, z: to.z }; if (o?.dimension) this.dimension = o.dimension; }
  tryTeleport(to, o) { this.teleport(to, o); return true; }
  remove() { this.isValid = false; entities.delete(this); if (this.rider) this.rider.ridingOn = undefined; }
  kill() { this.applyDamage(1e9, { cause: "selfDestruct" }); return true; }
  applyDamage(amount, src = {}) {
    if (!this.isValid || this.hp <= 0) return false;
    let dealt = sensed(this, amount, src.cause ?? "none");
    const res = this.getEffect("resistance");
    if (res && src.cause !== "selfDestruct") dealt *= Math.max(0, 1 - 0.2 * (res.amplifier + 1));
    if (dealt <= 0) return false;
    this.hp = Math.max(0, this.hp - dealt);
    const damageSource = { cause: src.cause ?? "none", damagingEntity: src.damagingEntity, damagingProjectile: src.damagingProjectile };
    fire("world.afterEvents.entityHurt", { hurtEntity: this, damage: dealt, damageSource });
    if (this.hp <= 0 && this.isValid) {
      this.isValid = false; this.died = true; entities.delete(this);
      if (this.rider) this.rider.ridingOn = undefined;
      this.isValid = true; // handlers still read where it fell
      fire("world.afterEvents.entityDie", { deadEntity: this, damageSource });
      this.isValid = false;
    }
    return true;
  }
  triggerEvent(name) { if (!this.kind.events.includes(name)) throw new Error(`${this.typeId} has no event ${name}`); this.events.push(name); }
  setProperty() {} getProperty() { return undefined; }
  getDynamicProperty(k) { return this.props.get(k); } setDynamicProperty(k, v) { if (v === undefined) this.props.delete(k); else this.props.set(k, v); } getDynamicPropertyIds() { return [...this.props.keys()]; }
  getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z }; }
  getViewDirection() { return { ...this.view }; } getRotation() { return { x: 0, y: 0 }; } setRotation() {} getVelocity() { return { x: 0, y: 0, z: 0 }; } clearVelocity() {}
  applyKnockback() {} applyImpulse() {} playAnimation() {} setOnFire() { return true; } extinguishFire() {} runCommand() { return { successCount: 0 }; } lookAt() {}
  getBlockFromViewDirection() { return undefined; } getEntitiesFromViewDirection() { return []; } matches() { return true; }
}
const watched = (e) => new Proxy(e, { get(t, k, r) { if (typeof k === "string" && !(k in t) && !["then", "toJSON", "isSleeping", "isSprinting", "isFlying", "isGliding", "isSwimming", "isClimbing", "isFalling", "isJumping", "scoreboardIdentity", "camera", "inputPermissions", "inputInfo", "level", "selectedSlotIndex", "graphicsMode", "clientSystemInfo"].includes(k)) missing[`${k} on ${t.typeId}`] = 1; return Reflect.get(t, k, r); } });
const spawnLog = {};
function spawn(typeId, at, dim) {
  const kind = kindOf(typeId);
  if (!kind) throw new Error(`no such entity: ${typeId}`);
  if (![at.x, at.y, at.z].every(Number.isFinite)) throw new Error(`spawn at nowhere: ${typeId} ${JSON.stringify(at)}`);
  const e = watched(new Ent(typeId, at, dim, kind));
  entities.add(e);
  spawnLog[typeId] = (spawnLog[typeId] ?? 0) + 1;
  // where things appear matters: in the floor or far above it is a bug a player would see
  if (!kind.flies && !/cog|bolt|gloamwing|raven|crow|dragon|body/.test(typeId)) {
    const here = dim.getBlock(at), ground = [1, 2, 3, 4].some((n) => { const b = dim.getBlock({ x: at.x, y: at.y - n, z: at.z }); return !b.isAir && !b.isLiquid; });
    if (!here.isAir && !PASSABLE.test(here.typeId)) oddSpawns.push(`${typeId} inside ${here.typeId} at ${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`);
    else if (!ground && !PASSABLE.test(here.typeId)) oddSpawns.push(`${typeId} in mid-air or over water at ${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`);
  }
  system.run(() => { if (e.isValid) fire("world.afterEvents.entitySpawn", { entity: e, cause: "Spawned" }); }); // after-events reach scripts once the spawning code has finished tagging it
  return e;
}
const oddSpawns = [];

function addPlayer(name, mode = "Survival") {
  const dim = world.getDimension("overworld");
  const p = new Ent("minecraft:player", { x: 0, y: 64, z: 0 }, dim, { health: 20, families: ["player"], speed: 0.1, sensor: [], flies: false, events: [] });
  p.id = `p${players.length + 1}`; p.name = name; p.mode = mode; p.taken = 0; p.deaths = 0; p.hits = 0; p.mortal = false; p.inv = [];
  p.sendMessage = (t) => { if (p.id === "p1") say("chat", typeof t === "string" ? t : JSON.stringify(t)); };
  p.playSound = () => {}; p.playMusic = () => {}; p.stopMusic = () => {}; p.queueMusic = () => {}; p.spawnParticle = () => {}; p.addExperience = () => 0; p.addLevels = () => 0; p.getTotalXp = () => 0; p.xpEarnedAtCurrentLevel = 0;
  p.getGameMode = () => p.mode; p.setGameMode = (m) => { p.mode = m; }; p.isOp = () => true; p.getSpawnPoint = () => undefined; p.setSpawnPoint = () => {};
  p.onScreenDisplay = { setTitle: (t, o) => { if (p.id === "p1" && !String(t).startsWith("hcm:")) say("TITLE", `${t}${o?.subtitle ? " / " + o.subtitle : ""}`); }, updateSubtitle() {}, setActionBar: (t) => { if (p.id === "p1") say("bar", t); }, setHudVisibility() {}, isForcedHidden: () => false, resetHudElementsVisibility() {}, hideAllExcept() {}, isValid: true };
  p.camera = { setCamera() {}, clear() {}, fade() {}, setFov() {}, isValid: true }; p.inputPermissions = { setPermissionCategory() {}, isPermissionCategoryEnabled: () => true, cameraEnabled: true, movementEnabled: true };
  p.inputInfo = { lastInputModeUsed: "KeyboardAndMouse", getButtonState: () => "Released", getMovementVector: () => ({ x: 0, y: 0 }) };
  const base = p.getComponent.bind(p);
  p.getComponent = (name) => {
    const c = name.replace(/^minecraft:/, "");
    if (c === "inventory") return { container: { size: 36, emptySlotsCount: 36, addItem(s) { p.inv.push(s); if (p.id === "p1") say("loot", `${s.amount} x ${s.typeId}${s.nameTag ? ` "${String(s.nameTag).replace(/§./g, "")}"` : ""}`); }, getItem() {}, setItem() {}, getSlot: () => ({ getItem: () => undefined, setItem() {}, hasItem: () => false }) } };
    if (c === "equippable") return { getEquipment: (slot) => p.gear?.[slot] && { typeId: p.gear[slot] }, setEquipment() {}, getEquipmentSlot: () => ({ getItem: () => undefined, setItem() {} }) };
    return base(name);
  };
  const hurtMe = p.applyDamage.bind(p);
  p.applyDamage = (amount, src = {}) => {
    if (p.mode === "Creative") return false;
    p.taken += amount;
    if (!p.mortal) { p.hits = (p.hits ?? 0) + 1; fire("world.afterEvents.entityHurt", { hurtEntity: p, damage: amount, damageSource: { cause: src.cause, damagingEntity: src.damagingEntity } }); return true; }
    p.hp = Math.max(0, p.hp - amount);
    fire("world.afterEvents.entityHurt", { hurtEntity: p, damage: amount, damageSource: { cause: src.cause, damagingEntity: src.damagingEntity } });
    if (p.hp <= 0) { p.deaths++; fire("world.afterEvents.entityDie", { deadEntity: p, damageSource: { cause: src.cause, damagingEntity: src.damagingEntity } }); p.respawnAt = now + 100; }
    return true;
  };
  p.remove = () => {};
  const w = watched(p);
  players.push(w);
  return w;
}

// ----- load the add-on -----
const mcNames = {};
for (const f of walk(SCRIPTS, ".js")) {
  for (const m of readFileSync(f, "utf8").matchAll(/import\s+\{([^}]*)\}\s+from\s+["'](@minecraft\/[^"']+)["']/g)) {
    (mcNames[m[2]] ??= new Set());
    for (const n of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) mcNames[m[2]].add(n);
  }
}
const names = [...new Set(Object.values(mcNames).flatMap((s) => [...s]))];
const hooks = `export async function resolve(s,c,n){ if(s.startsWith("@minecraft/")) return {url:"mock:"+s, shortCircuit:true}; return n(s,c);}
export async function load(u,c,n){ if(!u.startsWith("mock:")) return n(u,c); const names=${JSON.stringify(names)}; return {format:"module", shortCircuit:true, source:names.map(n=>"export const "+n+" = globalThis.__mc.lookup("+JSON.stringify(n)+");").join("\\n")}; }`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url);
const realWarn = console.warn, realError = console.error;
console.warn = (...a) => warned.push(a.join(" "));
console.error = (...a) => warned.push(a.join(" "));
await import(pathToFileURL(join(SCRIPTS, "main.js")).href);
mock.endEarly();
const core = await import(pathToFileURL(join(SCRIPTS, "bestiary/bossCore.js")).href);
const mv = await import(pathToFileURL(join(SCRIPTS, "bestiary/morvane.js")).href);
const { MOBS } = await import(pathToFileURL(join(SCRIPTS, "bestiary/data.js")).href);
fire("world.afterEvents.worldLoad", {});
fire("world.afterEvents.worldInitialize", {});

// Only the fights tick here: the rest of the add-on (sieges, weather, trains) has its own sims and would only add noise.
const KEEP = /bossTick|pretenderTick|choirTick|champion|flingCog|cog\.teleport|k >= 1/;
const loop = await import(pathToFileURL(join(SCRIPTS, "core/loop.js")).href);
const taskNames = loop.tickTasks().map((t) => t.name);
const wanted = new Set(taskNames.filter((n) => /bestiary|choir|undertow_story|champion|deep/i.test(n) && !/bestiary_(hollow|watcher|seeps?|returned|ravens?)/.test(n)));
{
  // loop.js starts every task in the order it lists them, so the nth interval it made is the nth task
  const made = [...intervals.entries()];
  const firstTask = made.length - taskNames.length;
  made.forEach(([id], i) => { const name = taskNames[i - firstTask]; if (i < firstTask || !wanted.has(name)) intervals.delete(id); });
}
void KEEP;

function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    now++;
    for (const t of timers.splice(0)) { if (t.at <= now) { try { t.fn(); } catch (e) { warned.push(`timeout: ${e}`); } } else timers.push(t); }
    for (const it of [...intervals.values()]) if ((now - it.from) % it.ticks === 0) { try { it.fn(); } catch (e) { warned.push(`interval: ${e}`); } }
    for (const p of players) if (p.mortal && p.hp <= 0 && now >= p.respawnAt) { p.hp = 20; p.dimension = world.getDimension("overworld"); p.location = { x: -900, y: 64, z: -900 }; /* they wake in their own bed, a long way off */ fire("world.afterEvents.playerSpawn", { player: p, initialSpawn: false }); }
  }
}

// ----- the player's hands -----
const me = () => players[0];
function strike(by, target, amount, cause = "entityAttack") {
  if (!target?.isValid) return false;
  if (cause === "projectile") fire("world.afterEvents.projectileHitEntity", { source: by, projectile: {}, dimension: target.dimension, getEntityHit: () => ({ entity: target }) });
  else fire("world.afterEvents.entityHitEntity", { damagingEntity: by, hitEntity: target });
  return target.isValid ? target.applyDamage(amount, { cause, damagingEntity: by }) : false;
}
// Step up beside something: on the nearest footing at its height, so never in a wall or in the water
const footing = (dim, at) => { for (let y = Math.floor(at.y) + 2; y >= Math.floor(at.y) - 6; y--) { const below = dim.getBlock({ x: at.x, y: y - 1, z: at.z }), here = dim.getBlock({ x: at.x, y, z: at.z }); if (!below.isAir && !below.isLiquid && here.isAir) return { x: at.x, y, z: at.z }; } return undefined; };
const standBy = (p, e, d = 2) => {
  for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d], [0, 0]]) { const s = footing(e.dimension, { x: e.location.x + dx, y: e.location.y, z: e.location.z + dz }); if (s) { p.location = s; p.dimension = e.dimension; return; } }
  p.location = { ...e.location }; p.dimension = e.dimension;
};

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); return ok; };

// One fight. `play(f, t)` runs once a second and does what that fight asks; the default is to kill helpers and hit the boss.
function fight(id, { title, at = { x: 200, y: 64, z: 200 }, dimension = "overworld", damage = 12, play, limit = 1500, party = 1, mode = "Survival", start, expect = {}, rank = 0, mustDie = true, setup, probe }) {
  if (ONLY.length && !ONLY.includes(id)) return undefined;
  // a clean table: a boss left standing by the last fight is put down first, so its fight is closed properly
  for (const old of core.activeFights()) { for (const t of [...old.entity.tags]) old.entity.removeTag(t); old.entity.effects.clear(); old.entity.hp = 1; old.entity.isValid = true; entities.add(old.entity); old.entity.applyDamage(1e9, { cause: "selfDestruct" }); }
  check(!core.activeFights().length, `${id}: an earlier fight could not be closed`);
  tick(3);
  for (const e of [...entities]) e.remove();
  players.length = 0; log.length = 0; warned.length = 0; lastBar = ""; vaulted.length = 0; dropped.length = 0; chests.clear(); oddSpawns.length = 0; fills.clear(); blockCache.clear();
  for (const k of Object.keys(spawnLog)) delete spawnLog[k];
  core.bestiaryStore.data.defeated = rank ? { [id]: rank } : {}; core.bestiaryStore.data.lastTemper = {};
  for (let i = 0; i < party; i++) addPlayer(["Mateo", "Ines", "Tobias", "Wren"][i], mode);
  const dim = world.getDimension(dimension);
  for (const p of players) { p.dimension = dim; p.location = { x: at.x + 3, y: at.y, z: at.z }; }
  const startTick = now;
  setup?.(dim, at);
  if (start) start(dim, at); else scriptEvent("siege:bestiary_summon", `${id} ${at.x} ${at.y} ${at.z}`, me());
  tick(5);
  let f = core.fightOf(id);
  if (!check(!!f, `${id}: the fight never started`)) return undefined;
  if (process.env.SIMDEBUG) console.log('DEBUG', id, f.dim.id, f.center, f.entity.location, f.entity.dimension.id, players[0].location, players[0].dimension.id, f.players().length, f.m && { stage: f.m.stage, moving: f.m.moving, atSeat: f.m.atSeat, away: f.m.away, home: f.m.home });
  const boss0 = f.entity, seen = { phases: new Set([0]), stages: new Set(), shieldedHits: 0 };
  let secs = 0, dead = false;
  const sub = { path: "world.afterEvents.entityDie", fn: (ev) => { if (ev.deadEntity === f.entity || ev.deadEntity === boss0) dead = true; } };
  mock.subscriptions.push(sub);
  while (!dead && secs < limit) {
    f = core.fightOf(id) ?? f;
    seen.phases.add(f.phase);
    if (f.m) seen.stages.add(f.m.stage);
    const ctx = { secs, seen, dim, probe, hit: (target = f.entity, amount = damage, cause) => strike(me(), target, amount, cause), all: players };
    let handled = false;
    try { handled = play?.(f, ctx); } catch (e) { problems.push(`${id}: the sim's own player script broke: ${e.stack}`); break; }
    if (!handled) {
      // everyone closes on the boss, kills what walks (not props), then hits the boss
      for (const p of players) if (f.entity.isValid && p.dimension !== f.entity.dimension || flatD(p.location, f.entity.location) > 3) standBy(p, f.entity);
      const walkers = f.adds().filter((e) => !["boss_prop", "projectile", "boss"].includes(MOBS[e.typeId]?.family));
      if (walkers.length) for (const p of players) strike(p, walkers[0], 20);
      else for (const p of players) strike(p, f.entity, damage);
    }
    if (process.env.SIMDEBUG && secs % 20 === 0) console.log('DEBUG', secs, 'hp', f.entity.hp?.toFixed(1), 'phase', f.phase, 'shield', f.shielded(), 'adds', f.adds().map((e) => e.typeId.split(':')[1]).join(','), 'tide', f.data.tide, 'rung', JSON.stringify(f.data.rung), 'lock', f.data.bellLock, f.tick);
    tick(20);
    secs++;
  }
  mock.subscriptions.splice(mock.subscriptions.indexOf(sub), 1);
  tick(40);
  const name = title ?? id;
  const took = Math.round(players[0].taken);
  console.log(`\n=== ${name}: ${dead ? `dead after ${secs}s` : `STILL ALIVE after ${secs}s`}, ${party} player${party > 1 ? "s" : ""} (${mode}), took ${took} damage in ${players[0].hits ?? 0} hits`);
  if (!QUIET) for (const line of log) console.log("  " + line);
  if (mustDie) check(dead, `${name}: the fight did not end in ${limit}s (boss at ${Math.round(f.hp() * 100)}%)`);
  const mine = warned.filter((w) => !/^\[(Sound|Weather|Rails|Trains|Minimap)/.test(w));
  for (const w of [...new Set(mine)]) problems.push(`${name}: swallowed error: ${w}`);
  for (const o of [...new Set(oddSpawns)]) problems.push(`${name}: spawned off the floor: ${o}`);
  if (dead) {
    const got = players[0].inv.map((s) => s.typeId), chest = [...vaulted, ...dropped].map((s) => s.typeId);
    check(got.length > 0, `${name}: the player was handed nothing`);
    for (const want of expect.loot ?? []) check(got.includes(want), `${name}: no ${want} in the player's loot (${got.join(", ")})`);
    for (const want of expect.hoard ?? []) check(chest.includes(want), `${name}: no ${want} in the vault or on the ground (${chest.join(", ")})`);
    check(core.activeFights().every((x) => x.def.id !== id), `${name}: the fight is still running after the boss died`);
    const left = [...entities].filter((e) => e.tags.has(f.addTag));
    check(!left.length, `${name}: ${left.length} helpers left behind after the boss died: ${[...new Set(left.map((e) => e.typeId))].join(", ")}`);
  }
  for (const n of expect.phases ?? []) check(seen.phases.has(n), `${name}: phase ${n} never happened`);
  for (const [type, min] of Object.entries(expect.spawned ?? {})) check((spawnLog[type] ?? 0) >= min, `${name}: expected at least ${min} ${type}, saw ${spawnLog[type] ?? 0}`);
  for (const text of expect.said ?? []) check(log.some((l) => l.includes(text)), `${name}: nobody was told "${text}"`);
  return { f, seen, secs, dead, log: [...log], spawned: { ...spawnLog } };
}

// ----- the fights -----
const props = (f, type) => f.adds(type);
const walkersOf = (f) => f.adds().filter((e) => !["boss_prop", "projectile", "boss"].includes(MOBS[e.typeId]?.family) && e.typeId !== mv.MORVANE.suit && e.typeId !== "siege:choir_singer" && e.typeId !== "siege:mother_echo");

fight("reeve", { title: "The Clockwork Reeve", damage: 3,
  expect: { phases: [1, 2], spawned: { "siege:reeve_cog": 3 }, said: ["Break the three Cogs", "He is open again", "Stand on a lit tile"], loot: ["siege:minute_hand"], hoard: ["siege:choir_shard"] } });

// One blow from full health to nearly dead: he must still split into his Cogs on the way
fight("reeve", { title: "The Clockwork Reeve, one huge blow", damage: 3,
  play: (f, t) => { if (t.secs === 3) { t.hit(f.entity, 250); return true; } return false; },
  expect: { phases: [2], spawned: { "siege:reeve_cog": 3 }, said: ["Break the three Cogs"] } });

fight("huntsman", { title: "The Pale Huntsman", damage: 3,
  play: (f, t) => { const pillars = props(f, "siege:rime_pillar"); if (!pillars.length || walkersOf(f).length) return false; standBy(me(), pillars[0], 1); t.hit(pillars[0], 14); return true; },
  expect: { phases: [1, 2], spawned: { "siege:rimewolf": 2, "siege:rime_pillar": 3 }, said: ["three pillars of ice", "The last pillar breaks", "Break line of sight", "The pack is coming"], loot: ["siege:rimefang_bow"], hoard: ["siege:choir_shard"] } });

// The Bride: ring all three bells every 40 seconds, hit her in between
fight("bride", { title: "The Drowned Bride, bells rung", damage: 3,
  play: (f, t) => {
    if (t.secs % 40 < 37 || walkersOf(f).length) return false;
    const bell = props(f, "siege:chapel_bell")[t.secs % 40 - 37];
    if (bell) { standBy(me(), bell, 1); t.hit(bell, 1); }
    return true;
  },
  expect: { phases: [1, 2], spawned: { "siege:chapel_bell": 3, "minecraft:drowned": 2 }, said: ["Bells ringing: ", "The tide turns", "Tide"], loot: ["siege:widows_veil"], hoard: ["siege:choir_shard"] } });

// ...and nobody rings them: the tide must reach the top and start drowning people
fight("bride", { title: "The Drowned Bride, bells ignored", damage: 2, limit: 200, mustDie: false,
  expect: { said: ["100%"] } });

// The Seneschal: blade until he learns it, then arrows until he learns those
fight("seneschal", { title: "The Ash Seneschal", damage: 4,
  play: (f, t) => { if (f.data.stance !== "melee") return false; standBy(me(), f.entity, 8); t.hit(f.entity, 4, "projectile"); return true; },
  expect: { phases: [1], said: ["learned your blade", "learned your arrows", "answers steel with steel", "answers arrows with arrows", "The sand is giving way"], loot: ["siege:seneschal_greatshield"], hoard: ["siege:choir_shard"] } });

// The Mother: find the real one the first time, burst a copy the second, guess nothing the third
{
  let round = 0, was = false;
  fight("mother", { title: "The Mother of Changelings", damage: 3, limit: 900,
    play: (f, t) => {
      const hiding = !!f.data.masq;
      if (hiding && !was) round++;
      was = hiding;
      if (!hiding) return false;
      const since = 500 - (f.data.masq.until - f.tick);
      if (round % 3 === 1 && since > 100) { standBy(me(), f.entity, 1); t.hit(f.entity, 3); }
      else if (round % 3 === 2 && since > 60 && since < 90) { const copy = props(f, "siege:mother_echo")[0]; if (copy) { standBy(me(), copy, 1); t.hit(copy, 20); } }
      return true;
    },
    expect: { phases: [1, 2], spawned: { "siege:mother_echo": 10, "siege:changeling": 1 }, said: ["Which of us is your mother", "You found her", "Wrong. Wrong. Wrong.", "Look away from her", "Roots are coiling"], loot: ["siege:mire_heart"], hoard: ["siege:choir_shard"] } });
}

// The Warlord King: kill the ogre first
fight("warlord_king", { title: "The Warlord King, ogre first", damage: 3,
  play: (f, t) => { const ogre = f.data.ogre; if (!ogre?.isValid) return false; standBy(me(), ogre, 2); t.hit(ogre, 15); return true; },
  expect: { phases: [1, 2], spawned: { "siege:siege_ogre": 1, "siege:hollow_footman": 3 }, said: ["The ogre falls", "blazing now", "The shard takes aim", "opens like an eye", "JUMP"], loot: ["siege:warlords_brand"] } });
// ...and ignoring the ogre: he must still come down at 66%
fight("warlord_king", { title: "The Warlord King, ogre ignored", damage: 6,
  play: (f, t) => { standBy(me(), f.entity, 2); const foot = f.adds().filter((e) => e.typeId !== "siege:siege_ogre"); if (foot.length) t.hit(foot[0], 30); else t.hit(f.entity, 6); return true; },
  expect: { phases: [1, 2], said: ["leaps down"] } });

fight("bell_wife", { title: "Ulfa Ice-Tongue (the Deep)", damage: 4, dimension: "siege:undertow", at: { x: 300, y: 120, z: 2700 },
  expect: { phases: [1, 2], said: ["Get off the rings", "Step aside", "Some of them answer", "Get close to her"] } });


// ----- the Choir -----
const choirPlay = (f, t) => {
  const singers = f.adds("siege:choir_singer");
  const open = singers.filter((x) => !x.hasTag("siege_boss_shielded"));
  // one in four seconds goes on the Echoes, so waves keep turning over
  const echoes = f.adds().filter((e) => e.hasTag("siege_choir_echo"));
  if (echoes.length && t.secs % 4 === 0) { standBy(me(), echoes[0], 1); t.hit(echoes[0], 200); return true; }
  if ((f.data.stage ?? 0) !== 1 && open.length) { standBy(me(), open[0], 1); t.hit(open[0], 30); return true; }
  if ((f.data.echoUntil ?? 0) > f.tick) return true; // hold your blows
  standBy(me(), f.entity, 2); t.hit(f.entity, 8);
  return true;
};
const COURT_AT = { x: 0.5, y: 90, z: 1600.5 };
fight("choir", { title: "The Choir, in the Court", dimension: "siege:undertow", at: COURT_AT, limit: 900, play: choirPlay,
  start: (dim, at) => { core.startBoss("choir", dim, at); },
  expect: { phases: [1], spawned: { "siege:choir_singer": 7 }, said: ["Singers to silence", "Six voices are silent", "Jump the ring", "Crouch and hold on", "Hold your blows", "The last Singer steps down", "closes to the flames", "The last Singer is feeding it", "Wave 3"] } });
// summoned on open ground somewhere else: it must be the same fight (Mateo: bosses behave the same wherever summoned)
fight("choir", { title: "The Choir, summoned elsewhere", limit: 900, play: choirPlay,
  expect: { phases: [1], spawned: { "siege:choir_singer": 7 }, said: ["Six voices are silent", "The last Singer steps down"] } });

// ----- Morvane -----
const morvanePlay = (f, t) => {
  const m = f.m, s = m.s, p = me();
  t.seen.stages.add(m.stage);
  if (m.moving || m.scene) return true;
  if (t.seen.at !== m.stage) { // where each stage is fought, and whether he and the player are standing on something there
    t.seen.at = m.stage;
    const e = f.entity.location, here = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
    const stands = (ent) => { const d = ent.dimension, l = ent.location; return (d.getBlock(l).isAir || PASSABLE.test(d.getBlock(l).typeId)) && [1, 2].some((n) => !d.getBlock({ x: l.x, y: l.y - n, z: l.z }).isAir); };
    say("sim", `stage ${m.stage + 1} is fought in ${f.dim.id.split(":")[1]} round ${here(f.center)}, radius ${f.radius ?? f.def.radius}; he is at ${here(e)}${stands(f.entity) ? "" : " (NOT on floor)"}, the player at ${here(p.location)}${p.dimension === f.dim && stands(p) ? "" : " (NOT on floor)"}, ${Math.round(Math.hypot(e.x - p.location.x, e.z - p.location.z))} apart`);
    if (!stands(f.entity) && m.stage !== 3) problems.push(`Morvane stage ${m.stage + 1}: he is not standing on floor at ${here(e)}`);
    if (p.dimension !== f.dim || !stands(p)) problems.push(`Morvane stage ${m.stage + 1}: the player was not put on floor (${here(p.location)})`);
  }
  if (t.probe?.(f, t, m, s, p)) return true;
  const walkers = walkersOf(f);
  if (m.stage === 1) { // the Standing Ranks: one wrong suit, then his
    const suits = f.adds(mv.MORVANE.suit);
    if (s.open) { standBy(p, f.entity, 2); t.hit(f.entity, 7); return true; }
    if (!t.seen.wrongSuit) { const wrong = suits.find((x) => x.id !== s.trueId && !s.awake.has(x.id)); if (wrong) { t.seen.wrongSuit = true; standBy(p, wrong, 1); t.hit(wrong, 5); return true; } }
    const his = suits.find((x) => x.id === s.trueId);
    if (his && t.secs % 6 === 0) { standBy(p, his, 1); t.hit(his, 5); }
    return true;
  }
  if (m.stage === 2) { const court = f.adds().filter((e) => e.hasTag("siege_morvane_court")); if (court.length) { standBy(p, court[0], 2); t.hit(court[0], 60); } return true; }
  if (m.stage === 3) { if (walkers.length) t.hit(walkers[0], 30); else if (s.up) { standBy(p, f.entity, 2); t.hit(f.entity, 10); } return true; }
  if (m.stage === 5) return true; // the Fall: nothing to hit
  if (walkers.length && t.secs % 2) { standBy(p, walkers[0], 1); t.hit(walkers[0], 40); return true; }
  standBy(p, f.entity, 2); t.hit(f.entity, m.stage === 6 ? 3 : 4); if (m.stage === 6) { t.hit(f.entity, 3); t.hit(f.entity, 3); }
  return true;
};
const allStages = { said: ["Sit, then", "Jump the ring", "The suits stand up".slice(4), "Empty. And now it is awake", "The suit splits open", "The old court stands against you", "He is up", "He goes under", "This was mine first", "Not here. Not under this sky", "The ledge is going", "The Seat again", "The floor beyond the flames", "Strike the Crown", "The Hollow Crown rings off", "He reaches for the Crown"] };
fight("morvane", { title: "Morvane, summoned on open ground", limit: 1500, play: morvanePlay, expect: allStages });
fight("morvane", { title: "Morvane, on the Seat, arenas not built yet", dimension: "siege:undertow", at: { x: 0.5, y: 120, z: 2400.5 }, limit: 1500, play: morvanePlay,
  start: () => scriptEvent("siege:undertow_arena_ready", "morvane"), expect: allStages });

// The real thing: the pocket arenas built from the add-on's own plans, and the Rift open in the overworld
const pockets = await import(pathToFileURL(join(SCRIPTS, "undertow/pockets.js")).href);
const hollowData = await import(pathToFileURL(join(SCRIPTS, "undertow/data.js")).href);
fight("morvane", { title: "Morvane, on the Seat, real arenas", dimension: "siege:undertow", at: { x: 0.5, y: 120, z: 2400.5 }, limit: 1500, play: morvanePlay,
  setup: () => {
    hollowData.save("hc:undertow_pockets", []);
    pockets.requestPockets();
    for (let i = 0; i < 4000 && !pockets.POCKETS.every((p) => pockets.pocketReady(p.id)); i++) { now += 5; pockets.pocketTick(); }
    check(pockets.POCKETS.every((p) => pockets.pocketReady(p.id)), "the pocket arenas did not finish building");
    hollowData.save("hc:rift", { open: true, x: 500, y: 64, z: 500, facing: "south", site: "kings_barrow" });
  },
  start: () => scriptEvent("siege:undertow_arena_ready", "morvane"), expect: allStages });

// Falling in the river, hitting the bottom of the Fall, and dying: what the fight does with a player who fails
{
  const did = {};
  fight("morvane", { title: "Morvane, real arenas, a player who falls in, falls down and dies", dimension: "siege:undertow", at: { x: 0.5, y: 120, z: 2400.5 }, limit: 2500, play: morvanePlay,
    setup: () => {
      hollowData.save("hc:undertow_pockets", []);
      pockets.requestPockets();
      for (let i = 0; i < 4000 && !pockets.POCKETS.every((q) => pockets.pocketReady(q.id)); i++) { now += 5; pockets.pocketTick(); }
      hollowData.save("hc:rift", { open: true, x: 500, y: 64, z: 500, facing: "south", site: "kings_barrow" });
      me().mortal = true;
    },
    start: () => scriptEvent("siege:undertow_arena_ready", "morvane"),
    probe: (f, t, m, s, p) => {
      p.hp = p.hp > 0 ? 20 : p.hp; // he heals between blows: only the deaths below are meant
      if (p.hp <= 0 || !f.players().includes(p)) return true; // dead, or woken far away and not brought back yet
      const since = (f.tick - m.started) / 20;
      // the Standing Ranks: die four times (second wind, again, again, back to the Seat)
      if (m.stage === 1 && (did.ranks ?? 0) < 4 && since > 4 && !did.back && f.tick > (did.next ?? 0)) { did.ranks = (did.ranks ?? 0) + 1; did.next = f.tick + 300; p.applyDamage(1000, { cause: "entityAttack" }); return true; }
      if (m.stage === 0 && did.ranks >= 4) did.back = true;
      // the River: step off a raft once
      if (m.stage === 3 && !did.river && since > 6) { did.river = true; p.location = { x: 1205.5, y: 100.2, z: 760.5 }; return true; }
      // the Fall: hit the bottom twice
      if (m.stage === 5 && (did.fall ?? 0) < 2 && since > 5 && p.location.y > 150) { did.fall = (did.fall ?? 0) + 1; p.location = { x: p.location.x, y: 73, z: 1400.5 }; return true; }
      return false;
    },
    expect: { said: ["He waits.", "Second wind", "The Standing Ranks begins again. (1 of 2", "The Standing Ranks begins again. (2 of 2", "He sits back down", "The river takes you", "You hit the bottom", "The Fall begins again"] } });
}

// ----- Pretenders: every claim, on each of the three bodies, with every power seen at least once -----
{
  const pr = await import(pathToFileURL(join(SCRIPTS, "bestiary/pretenders.js")).href);
  const powersSeen = new Set();
  const WARN = { lance: "levels its weapon", ground: "The floor under you is going", ring: "It strikes the floor", call: "the Hollow's soldiers answer", pull: "The air pulls toward it", blink: "Turn round", rain: "Shards are falling", mark: "One of you is marked", wall: "A line of fire" };
  const CLAIM_SAYS = { twinned: ["A second one steps out", "The twin is gone"], attended: ["Another follower climbs up"], mirrored: ["Your shot comes back"], unbled: [], hungering: [] };
  let n = 0;
  for (const claim of Object.keys(pr.CLAIMS)) {
    const body = ["blade", "seer", "brute"][n++ % 3];
    let seed = 1;
    while (!(pr.makePretender(seed).claim === claim && pr.makePretender(seed).body === body)) seed++;
    const who = pr.makePretender(seed);
    for (const k of who.kit) powersSeen.add(k);
    fight(`pretender_${body}`, { title: `Pretender (${body}, ${pr.CLAIMS[claim].name}; ${who.kit.join(", ")})`, dimension: "siege:undertow", at: { x: 0.5, y: 120, z: 2400.5 }, damage: 4, limit: 900,
      start: () => { core.bestiaryStore.data.defeated = { morvane: 1 }; scriptEvent("siege:pretender_rise", String(seed), me()); tick(100); },
      play: (f, t) => {
        const twin = f.adds("siege:mirror_knight")[0];
        if (twin) { standBy(me(), twin, 1); t.hit(twin, 20, "magic"); return true; }
        if (claim === "mirrored" && t.secs === 10) { t.hit(f.entity, 4, "projectile"); return true; }
        if (claim === "unbled" && t.secs > 20 && t.secs < 30) { me().location = { x: f.entity.location.x + 15, y: 120, z: f.entity.location.z }; return true; } // back off: it should heal
        return false;
      },
      expect: { phases: [1], said: [who.name, pr.CLAIMS[claim].line, "is put down by Mateo", ...who.kit.map((k) => WARN[k]), ...CLAIM_SAYS[claim]], loot: ["siege:pretender_seal", "siege:choirsteel_ingot"], hoard: ["siege:choirsteel_ingot"] } });
  }
  if (!ONLY.length) check(pr.POWERS.every((k) => powersSeen.has(k)), `Pretenders: these powers were never played: ${pr.POWERS.filter((k) => !powersSeen.has(k)).join(", ")}`);
}

// ----- the same fights the way Mateo playtests them: in Creative, where Minecraft's own mob AI ignores the player -----
for (const [id, title, extra] of [["reeve", "The Clockwork Reeve"], ["huntsman", "The Pale Huntsman"], ["seneschal", "The Ash Seneschal"], ["warlord_king", "The Warlord King"], ["bell_wife", "Ulfa Ice-Tongue", { dimension: "siege:undertow", at: { x: 300, y: 120, z: 2700 } }]]) {
  let moved = 0, last;
  const r = fight(id, { title: `${title}, in Creative`, mode: "Creative", damage: 4, ...extra,
    play: (f, t) => { // stand still 12 blocks off for the first 20 seconds: the boss must come to the player
      if (t.secs === 0) { me().location = { x: f.entity.location.x + 12, y: f.entity.location.y, z: f.entity.location.z }; return true; }
      if (t.secs < 20) { const walker = f.data.ogre?.isValid ? f.data.ogre : f.entity; /* mounted, it is the ogre that walks */ if (last && flatD(last, walker.location) > 0.1) moved++; last = { ...walker.location }; return true; }
      const pillars = f.adds("siege:rime_pillar"); if (pillars.length && !walkersOf(f).length) { standBy(me(), pillars[0], 1); t.hit(pillars[0], 14); return true; }
      const ogre = f.data.ogre; if (ogre?.isValid) { standBy(me(), ogre, 2); t.hit(ogre, 15); return true; }
      return false;
    },
    expect: { said: ["(Creative) That hit you for"] } });
  if (r) check(moved >= 3 || id === "huntsman", `${title}, in Creative: the boss never walked at a Creative player standing 12 blocks away`);
}

// ----- four players, and a boss that has fallen five times already (rank V, two tempers) -----
fight("reeve", { title: "The Clockwork Reeve, four players", party: 4, damage: 3, expect: { phases: [1, 2], spawned: { "siege:reeve_cog": 3 } } });
fight("bride", { title: "The Drowned Bride, four players", party: 4, damage: 3, limit: 900,
  play: (f, t) => { if (t.secs % 30 < 27 || walkersOf(f).length) return false; const bell = props(f, "siege:chapel_bell")[t.secs % 30 - 27]; if (bell) { standBy(players[1], bell, 1); strike(players[1], bell, 1); } return true; },
  expect: { phases: [1, 2], said: ["The tide turns"] } });
fight("morvane", { title: "Morvane, four players, real arenas", party: 4, dimension: "siege:undertow", at: { x: 0.5, y: 120, z: 2400.5 }, limit: 2500, play: morvanePlay,
  setup: () => {
    hollowData.save("hc:undertow_pockets", []);
    pockets.requestPockets();
    for (let i = 0; i < 4000 && !pockets.POCKETS.every((q) => pockets.pocketReady(q.id)); i++) { now += 5; pockets.pocketTick(); }
    hollowData.save("hc:rift", { open: true, x: 500, y: 64, z: 500, facing: "south", site: "kings_barrow" });
  },
  start: () => scriptEvent("siege:undertow_arena_ready", "morvane"), expect: allStages });
for (const id of ["huntsman", "seneschal", "mother"]) {
  fight(id, { title: `${id}, rank V`, rank: 5, damage: 8, limit: 1200,
    play: (f, t) => {
      const pillars = f.adds("siege:rime_pillar"); if (pillars.length && !walkersOf(f).length) { standBy(me(), pillars[0], 1); t.hit(pillars[0], 14); return true; }
      if (f.data.masq) { if (t.secs % 3 === 0) { standBy(me(), f.entity, 1); t.hit(f.entity, 3); } return true; }
      if (f.data.stance === "melee") { standBy(me(), f.entity, 8); t.hit(f.entity, 8, "projectile"); return true; }
      return false;
    },
    expect: { said: ["Rank V", "netherite scrap"], loot: ["minecraft:netherite_scrap", "minecraft:echo_shard"] } });
}

console.warn = realWarn; console.error = realError;
const gaps = Object.keys(missing);
if (gaps.length) console.log("\nAPI this fake world lacks (check by hand):\n  " + gaps.join("\n  "));
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n - ${problems.join("\n - ")}` : "\nSIM OK");
process.exit(problems.length ? 1 : 0);
