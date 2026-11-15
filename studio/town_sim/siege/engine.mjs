// A small Minecraft for the siege simulator: enough of @minecraft/server (2.x) for the add-on's own scripts to run
// unchanged in a browser or in Node, on a real block world with real creatures.
//
//   const mc = createEngine({ blocks, data });      // blocks: the block world (see below); data: the pack's own JSON
//   globalThis.__mc = { lookup: mc.lookup };         // the game bundle takes every @minecraft/* name from here
//   await import(gameBundle);  mc.start();           // load main.js, then end "early execution" and greet the player
//   mc.tick();                                       // one game tick (20 a second): timers, events, creatures, physics
//
// What is the game's and what is ours:
//   - Everything the scripts decide (who comes, when, where, wall damage, collapse, rams, sappers, ballistas, guards'
//     posts and leashes, win and loss, rewards) is the add-on's code, run as it is.
//   - What Minecraft itself does is done here, from the pack's own entity files (entities/*.json): health, speed,
//     attack, families, target filters, melee and ranged goals, damage sensors, events and component groups, and from
//     the pack's block files (collision boxes, states). The walking, path-finding, hit timing and arrow flight are
//     ours, written to Minecraft's published rules (ai.mjs says which numbers).
//
// The block world is handed in:
//   blocks.inside(x, y, z) -> bool                loaded here?
//   blocks.get(x, y, z) -> palette index          (0 = air)
//   blocks.set(x, y, z, index)
//   blocks.palette -> [[id, states], ...]         may grow: blocks.indexFor(id, states) -> index (adds one if needed)

import { createAi } from "./ai.mjs";

const AIR = "minecraft:air";
const fullId = (id) => (typeof id === "string" ? (id.includes(":") ? id : `minecraft:${id}`) : id?.id ?? id?.typeId ?? String(id));
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export function createEngine({ blocks, data, log = () => {}, hud = {} }) {
  const commands = new Map(); // custom slash commands the scripts register
  const diag = { missing: new Map(), errors: [] }; // names the scripts asked for that we don't have (for the README)
  const miss = (what) => diag.missing.set(what, (diag.missing.get(what) ?? 0) + 1);

  // ---------- harmless stand-ins for anything we don't model ----------
  const stub = (label) => {
    const fn = function () {};
    return new Proxy(fn, {
      get(_, key) {
        if (key === "then") return undefined;
        if (key === Symbol.toPrimitive) return () => 0;
        if (key === Symbol.iterator) return function* () {};
        if (key === "toString") return () => `[stub ${label}]`;
        if (key === "toJSON") return () => null;
        return stub(`${label}.${String(key)}`);
      },
      apply: () => stub(`${label}()`),
      construct: () => stub(`new ${label}`),
    });
  };
  // A real object first; anything it lacks answers with a do-nothing function (and is counted)
  const loose = (obj, label) => new Proxy(obj, {
    get(t, k, r) {
      if (k in t) return Reflect.get(t, k, r);
      if (typeof k === "symbol" || k === "then" || k === "toJSON") return undefined;
      miss(`${label}.${k}`);
      return () => undefined;
    },
  });

  // ---------- time ----------
  let tick = 0;
  let worldTime = 13000; // ticks since day 0 dawn; a day is 24000
  let early = true;
  const state = { paused: false };

  // ---------- events ----------
  const afterQueue = [];
  function makeSignal(path, deferred) {
    const subs = [];
    const sig = {
      subscribe(fn, options) { subs.push({ fn, options }); return fn; },
      unsubscribe(fn) { const i = subs.findIndex((s) => s.fn === fn); if (i >= 0) subs.splice(i, 1); },
      fire(ev, match) {
        for (const s of [...subs]) {
          if (match && s.options && !match(s.options)) continue;
          if (deferred) afterQueue.push(() => call(s.fn, ev, path));
          else call(s.fn, ev, path);
        }
      },
      count: () => subs.length,
    };
    return sig;
  }
  function call(fn, arg, label) {
    try { return fn(arg); } catch (e) { diag.errors.push(`${label}: ${e?.stack?.split("\n").slice(0, 3).join(" | ") ?? e}`); if (diag.errors.length > 200) diag.errors.shift(); }
  }
  let flushing = false;
  function flush() {
    if (flushing) return;
    flushing = true;
    try { for (let n = 0; afterQueue.length && n < 20000; n++) afterQueue.shift()(); } finally { flushing = false; }
  }
  const signalSet = (path, deferred) => {
    const made = new Map();
    return new Proxy({}, { get(_, name) { if (typeof name === "symbol") return undefined; if (!made.has(name)) made.set(name, makeSignal(`${path}.${name}`, deferred)); return made.get(name); } });
  };
  const worldAfter = signalSet("world.afterEvents", true), worldBefore = signalSet("world.beforeEvents", false);
  const systemAfter = signalSet("system.afterEvents", true), systemBefore = signalSet("system.beforeEvents", false);
  const entityMatch = (e) => (o) => (!o.entityTypes || o.entityTypes.includes(e.typeId)) && (!o.entities || o.entities.some((x) => x.id === e.id));

  // ---------- timers ----------
  let runId = 0;
  const timers = new Map(); // id -> { fn, at, every }
  const jobs = new Map(); // id -> generator
  const system = {
    get currentTick() { return tick; },
    afterEvents: systemAfter, beforeEvents: systemBefore,
    run(fn) { timers.set(++runId, { fn, at: tick + 1 }); return runId; },
    runTimeout(fn, t = 1) { timers.set(++runId, { fn, at: tick + Math.max(1, Math.round(t) || 1) }); return runId; },
    runInterval(fn, t = 1) { const every = Math.max(1, Math.round(t) || 1); timers.set(++runId, { fn, at: tick + every, every }); return runId; },
    runJob(gen) { jobs.set(++runId, gen); return runId; },
    clearRun(id) { timers.delete(id); jobs.delete(id); },
    clearJob(id) { jobs.delete(id); },
    waitTicks(n) { return new Promise((res) => system.runTimeout(res, n)); },
    sendScriptEvent(id, message) { systemAfter.scriptEventReceive.fire({ id, message, sourceType: "Server" }); },
    serverSystemInfo: { memoryTier: 4 },
    isEditorWorld: false,
  };

  // ---------- blocks ----------
  const BLOCKS = data.blocks ?? {}; // custom blocks: { id: { states: { name: [values] }, col, perms: [[cond, col]] } }
  const VANILLA = data.vanilla ?? { blocks: {}, properties: {} }; // map/structures/bedrock_states.json
  const condCache = new Map();
  function condFn(src) {
    if (!condCache.has(src)) {
      let f;
      try {
        const js = src.replace(/\b(?:q|query)\.block_state\(\s*'([^']+)'\s*\)/g, (_, k) => `S(${JSON.stringify(k)})`).replace(/(?<![=!<>])==(?!=)/g, "===").replace(/!=(?!=)/g, "!==");
        f = new Function("S", `return !!(${js});`);
      } catch { f = () => false; }
      condCache.set(src, f);
    }
    return condCache.get(src);
  }
  const permCache = new Map();
  const permKey = (id, states) => `${id}|${Object.keys(states).sort().map((k) => `${k}=${states[k]}`).join(",")}`;
  class BlockPermutation {
    constructor(id, states) {
      this.typeId = id; this.type = { id }; this.states = states; // only the states that were named (the page's palette is keyed the same way)
      this._idx = undefined; this._col = undefined;
    }
    static resolve(id, states = {}) {
      if (early) throw new ReferenceError("Native function [BlockPermutation::resolve] cannot be used in early execution.");
      id = fullId(id);
      const def = BLOCKS[id];
      if (!def) {
        if (!id.startsWith("minecraft:")) throw new Error(`Failed to resolve block "${id}"`);
        const props = VANILLA.blocks[id.slice(10)];
        if (!props) throw new Error(`Failed to resolve block "${id}"`);
        for (const [k, v] of Object.entries(states)) {
          if (!props.includes(k)) throw new Error(`Failed to resolve block "${id}" with properties ${JSON.stringify(states)}`);
          const allowed = VANILLA.properties[k]?.values;
          if (allowed && !allowed.includes(v)) throw new Error(`Failed to resolve block "${id}" with properties ${JSON.stringify(states)}`);
        }
      } else {
        for (const [k, v] of Object.entries(states)) {
          const allowed = def.states?.[k];
          if (!allowed || !allowed.includes(v)) throw new Error(`Failed to resolve block "${id}" with properties ${JSON.stringify(states)}`);
        }
      }
      return intern(id, states);
    }
    getState(name) {
      if (name in this.states) return this.states[name];
      const def = BLOCKS[this.typeId];
      if (def) return def.states?.[name]?.[0];
      const props = VANILLA.blocks[this.typeId.slice(10)];
      return props?.includes(name) ? VANILLA.properties[name]?.values?.[0] : undefined;
    }
    getAllStates() {
      const out = {};
      const def = BLOCKS[this.typeId];
      if (def) for (const [k, v] of Object.entries(def.states ?? {})) out[k] = v[0];
      else for (const k of VANILLA.blocks[this.typeId.slice(10)] ?? []) out[k] = VANILLA.properties[k]?.values?.[0];
      return { ...out, ...this.states };
    }
    withState(name, value) { return intern(this.typeId, { ...this.states, [name]: value }); }
    matches(id, states) { return fullId(id) === this.typeId && (!states || Object.entries(states).every(([k, v]) => this.getState(k) === v)); }
    hasTag() { return false; }
    getTags() { return []; }
    getItemStack(amount = 1) { return new ItemStack(this.typeId, amount); }
    canBeDestroyedByLiquidSpread() { return false; }
    canContainLiquid() { return false; }
    isLiquidBlocking() { return true; }
    // how creatures meet this block: { pass, h (0..1.5 standing height), climb, liquid, door }
    get collision() { return (this._col ??= collisionOf(this)); }
    get index() { return (this._idx ??= blocks.indexFor(this.typeId, this.states)); }
  }
  function intern(id, states) {
    const k = permKey(id, states);
    let p = permCache.get(k);
    if (!p) { p = new BlockPermutation(id, states); permCache.set(k, p); }
    return p;
  }
  const byIndex = [];
  function permAt(idx) { return (byIndex[idx] ??= (() => { const [id, st] = blocks.palette[idx]; const p = intern(id, st ?? {}); p._idx ??= idx; return p; })()); }
  const PASS = /^minecraft:(air|.*(?:_sapling|_flower|torch|_sign|_banner|_carpet|_button|_pressure_plate|rail|_tulip|_orchid|_roots|_fungus|_sprouts|_vines?|_bush|_coral_fan|_candle)|short_grass|tall_grass|tallgrass|fern|large_fern|deadbush|dead_bush|dandelion|poppy|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|blue_orchid|sunflower|lilac|rose_bush|peony|red_flower|yellow_flower|double_plant|brown_mushroom|red_mushroom|vine|ladder|lever|tripwire|tripwire_hook|redstone_wire|fire|soul_fire|snow_layer|wheat|carrots|potatoes|beetroot|sweet_berry_bush|reeds|sugar_cane|web|lantern|soul_lantern|flower_pot|frame|glow_frame|light_block.*|structure_void|moss_carpet|pale_moss_carpet|leaf_litter|wildflowers|pink_petals|bamboo_sapling|kelp|seagrass|scaffolding|string|end_rod|chain|iron_chain|lightning_rod|water|flowing_water|lava|flowing_lava|bubble_column)$/;
  function collisionOf(perm) {
    const id = perm.typeId;
    const def = BLOCKS[id];
    if (def) {
      let col = def.col;
      for (const [cond, c] of def.perms ?? []) if (condFn(cond)((k) => perm.getState(k))) col = c;
      if (col === false) return { pass: true, h: 0 };
      if (col && typeof col === "object") {
        const top = (col.origin[1] + col.size[1]) / 16, thin = col.size[0] <= 8 && col.size[2] <= 8 && col.size[1] <= 12;
        if (top <= 0.26) return { pass: true, h: 0 };
        return { pass: false, h: Math.min(1.5, top), low: thin };
      }
      return { pass: false, h: 1 };
    }
    if (/water|lava|bubble_column/.test(id)) return { pass: true, h: 0, liquid: true };
    if (id === "minecraft:ladder" || /vine/.test(id) || id === "minecraft:scaffolding") return { pass: true, h: 0, climb: true };
    if (PASS.test(id)) return { pass: true, h: 0 };
    if (/_door$/.test(id) && !/trapdoor/.test(id)) return perm.getState("open_bit") ? { pass: true, h: 0, door: true } : { pass: false, h: 1, door: true };
    if (/trapdoor$/.test(id)) return perm.getState("open_bit") ? { pass: true, h: 0 } : perm.getState("upside_down_bit") ? { pass: false, h: 1 } : { pass: true, h: 0 };
    if (/fence_gate$/.test(id)) return perm.getState("open_bit") ? { pass: true, h: 0 } : { pass: false, h: 1.5 };
    if (/(_fence|_wall)$/.test(id) || /^minecraft:(fence|cobblestone_wall)$/.test(id)) return { pass: false, h: 1.5 };
    if (/_slab$/.test(id) && !/double/.test(id)) return perm.getState("minecraft:vertical_half") === "top" ? { pass: false, h: 1 } : { pass: false, h: 0.5 };
    if (/_stairs$/.test(id)) return { pass: false, h: 1, stair: !perm.getState("upside_down_bit") };
    if (id === "minecraft:grass_path" || id === "minecraft:dirt_path" || id === "minecraft:farmland") return { pass: false, h: 1 };
    if (/^minecraft:(bed|.*_bed)$/.test(id)) return { pass: false, h: 0.5625 };
    return { pass: false, h: 1 };
  }

  const dims = new Map();
  class Block {
    constructor(dim, x, y, z) { this.dimension = dim; this.x = x; this.y = y; this.z = z; }
    get location() { return { x: this.x, y: this.y, z: this.z }; }
    get permutation() { return permAt(blocks.get(this.x, this.y, this.z)); }
    get typeId() { return this.permutation.typeId; }
    get type() { return { id: this.typeId }; }
    get isAir() { return this.typeId === AIR; }
    get isLiquid() { return !!this.permutation.collision.liquid; }
    get isSolid() { const c = this.permutation.collision; return !c.pass && c.h >= 1; }
    get isValid() { return blocks.inside(this.x, this.y, this.z); }
    get isWaterlogged() { return false; }
    get localizationKey() { return `tile.${this.typeId}.name`; }
    setType(id) { this.setPermutation(BlockPermutation.resolve(fullId(id))); }
    setPermutation(perm) { setBlockAt(this.dimension, this.x, this.y, this.z, perm); }
    setWaterlogged() {}
    trySetPermutation(perm) { this.setPermutation(perm); return true; }
    offset(o) { return this.dimension.getBlock({ x: this.x + o.x, y: this.y + o.y, z: this.z + o.z }); }
    above(n = 1) { return this.offset({ x: 0, y: n, z: 0 }); }
    below(n = 1) { return this.offset({ x: 0, y: -n, z: 0 }); }
    north(n = 1) { return this.offset({ x: 0, y: 0, z: -n }); }
    south(n = 1) { return this.offset({ x: 0, y: 0, z: n }); }
    east(n = 1) { return this.offset({ x: n, y: 0, z: 0 }); }
    west(n = 1) { return this.offset({ x: -n, y: 0, z: 0 }); }
    center() { return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 }; }
    bottomCenter() { return { x: this.x + 0.5, y: this.y, z: this.z + 0.5 }; }
    matches(id, states) { return this.permutation.matches(id, states); }
    hasTag() { return false; }
    getTags() { return []; }
    getComponent(id) { return blockComponent(this, fullId(id)); }
    getItemStack(amount = 1) { return new ItemStack(this.typeId, amount); }
    getRedstonePower() { return 0; }
    canPlace() { return true; }
    canBeDestroyedByLiquidSpread() { return false; }
    canContainLiquid() { return false; }
    isLiquidBlocking() { return true; }
    getMapColor() { return { red: 0.5, green: 0.5, blue: 0.5, alpha: 1 }; }
    getLightLevel() { return 15; }
    getSkyLightLevel() { return 15; }
  }
  const containers = new Map(); // "x,y,z" -> Container (chests and the like)
  function blockComponent(block, id) {
    if (id === "minecraft:inventory" && /chest|barrel|hopper|shulker|dispenser|dropper|crate/.test(block.typeId)) {
      const k = `${block.x},${block.y},${block.z}`;
      if (!containers.has(k)) containers.set(k, new Container(27));
      return { container: containers.get(k), typeId: id, block, isValid: true };
    }
    if (id === "minecraft:sign") return { getText: () => "", setText() {}, getRawText: () => undefined, setTextDyeColor() {}, setWaxed() {}, isWaxed: false, typeId: id };
    return undefined;
  }
  function setBlockAt(dim, x, y, z, perm) {
    if (early) throw new ReferenceError("Native function [Block::setPermutation] cannot be used in early execution.");
    if (!blocks.inside(x, y, z)) throw new Error("LocationInUnloadedChunkError");
    const idx = perm.index;
    if (blocks.get(x, y, z) === idx) return false;
    blocks.set(x, y, z, idx);
    ai.blockChanged(x, y, z);
    if (perm.typeId === "minecraft:fire") fires.set(`${x},${y},${z}`, tick + 200 + Math.floor(Math.random() * 200));
    return true;
  }
  const fires = new Map(); // fire burns out by itself (it does not spread here)

  // ---------- items ----------
  const ITEMS = data.items ?? {}; // { id: { armor: points, slot, damage } }
  class ItemStack {
    constructor(typeId, amount = 1) {
      this.typeId = fullId(typeId); this.type = { id: this.typeId }; this.amount = amount; this.nameTag = undefined; this._lore = []; this._props = new Map();
      this.keepOnDeath = false; this.lockMode = "none"; this.maxAmount = 64; this.isStackable = true;
    }
    get localizationKey() { return `item.${this.typeId}.name`; }
    getLore() { return [...this._lore]; }
    setLore(l) { this._lore = l ? [...l] : []; }
    getRawLore() { return this._lore.map((t) => ({ text: t })); }
    getComponent(id) {
      id = fullId(id);
      if (id === "minecraft:durability") return { damage: 0, maxDurability: 250, getDamageChance: () => 0, getDamageChanceRange: () => ({ min: 0, max: 0 }), typeId: id };
      if (id === "minecraft:enchantable") return { getEnchantments: () => [], getEnchantment: () => undefined, hasEnchantment: () => false, addEnchantment() {}, addEnchantments() {}, removeEnchantment() {}, removeAllEnchantments() {}, canAddEnchantment: () => false, slots: [], typeId: id };
      return undefined;
    }
    getComponents() { return []; }
    hasComponent() { return false; }
    hasTag() { return false; }
    getTags() { return []; }
    clone() { const c = new ItemStack(this.typeId, this.amount); c.nameTag = this.nameTag; c._lore = [...this._lore]; c._props = new Map(this._props); return c; }
    isStackableWith(o) { return !!o && o.typeId === this.typeId && o.nameTag === this.nameTag; }
    matches(id) { return fullId(id) === this.typeId; }
    getDynamicProperty(k) { return this._props.get(k); }
    setDynamicProperty(k, v) { v === undefined ? this._props.delete(k) : this._props.set(k, v); }
    getDynamicPropertyIds() { return [...this._props.keys()]; }
    clearDynamicProperties() { this._props.clear(); }
    setCanDestroy() {} setCanPlaceOn() {} getCanDestroy() { return []; } getCanPlaceOn() { return []; }
  }
  class Container {
    constructor(size) { this.size = size; this.slots = new Array(size).fill(undefined); this.isValid = true; }
    get emptySlotsCount() { return this.slots.filter((s) => !s).length; }
    getItem(i) { return this.slots[i]?.clone(); }
    setItem(i, item) { this.slots[i] = item ? item.clone() : undefined; }
    getSlot(i) { const c = this; return { getItem: () => c.getItem(i), setItem: (it) => c.setItem(i, it), get typeId() { return c.slots[i]?.typeId; }, get amount() { return c.slots[i]?.amount ?? 0; }, set amount(v) { if (c.slots[i]) c.slots[i].amount = v; }, hasItem: () => !!c.slots[i], isValid: true, get nameTag() { return c.slots[i]?.nameTag; }, getLore: () => c.slots[i]?.getLore() ?? [], setLore: (l) => c.slots[i]?.setLore(l), getDynamicProperty: (k) => c.slots[i]?.getDynamicProperty(k), setDynamicProperty: (k, v) => c.slots[i]?.setDynamicProperty(k, v) }; }
    addItem(item) {
      let left = item.amount;
      for (let i = 0; i < this.size && left > 0; i++) { const s = this.slots[i]; if (s && s.isStackableWith(item) && s.amount < 64) { const n = Math.min(left, 64 - s.amount); s.amount += n; left -= n; } }
      for (let i = 0; i < this.size && left > 0; i++) if (!this.slots[i]) { const c = item.clone(); c.amount = Math.min(64, left); this.slots[i] = c; left -= c.amount; }
      if (left > 0) { const c = item.clone(); c.amount = left; return c; }
      return undefined;
    }
    clearAll() { this.slots.fill(undefined); }
    contains(item) { return this.slots.some((s) => s?.typeId === item.typeId); }
    find(item) { const i = this.slots.findIndex((s) => s?.typeId === item.typeId); return i < 0 ? undefined : i; }
    findLast(item) { for (let i = this.size - 1; i >= 0; i--) if (this.slots[i]?.typeId === item.typeId) return i; return undefined; }
    firstEmptySlot() { const i = this.slots.findIndex((s) => !s); return i < 0 ? undefined : i; }
    firstItem() { const i = this.slots.findIndex((s) => !!s); return i < 0 ? undefined : i; }
    moveItem(from, to, other) { const it = this.slots[from]; this.slots[from] = undefined; other.slots[to] = it; }
    swapItems(a, b, other) { const t = this.slots[a]; this.slots[a] = other.slots[b]; other.slots[b] = t; }
    transferItem(from, other) { const it = this.slots[from]; if (!it) return undefined; this.slots[from] = undefined; return other.addItem(it); }
  }

  // ---------- entities ----------
  const ENTITIES = data.entities ?? {}; // id -> the pack's "minecraft:entity" object
  const VANILLA_ENTITIES = {
    "minecraft:player": { families: ["player"], health: 20, width: 0.6, height: 1.8 },
    "minecraft:villager_v2": { families: ["villager", "peasant", "unskilled", "mob"], health: 20, width: 0.6, height: 1.9, speed: 0.5 },
    "minecraft:item": { families: [], health: 5, width: 0.25, height: 0.25, inert: true },
    "minecraft:xp_orb": { families: [], health: 5, width: 0.25, height: 0.25, inert: true },
    "minecraft:arrow": { families: ["arrow"], health: 1, width: 0.25, height: 0.25, inert: true },
    "minecraft:lightning_bolt": { families: ["lightning"], health: 1, width: 0, height: 0, inert: true, fleeting: 10 },
    "minecraft:iron_golem": { families: ["irongolem", "mob"], health: 100, width: 1.4, height: 2.9 },
    "minecraft:horse": { families: ["horse", "mob"], health: 22, width: 1.4, height: 1.6 },
  };
  const allEntities = new Map(); // id -> Entity
  let nextEntityId = 1;
  const EFFECT_IDS = (id) => fullId(id).replace(/^minecraft:/, "");
  const eqSlot = (s) => String(s).toLowerCase();

  class Entity {
    constructor(typeId, dim, loc) {
      this.id = String(-4294967296 - nextEntityId++); // Bedrock ids look like this
      this.typeId = typeId; this.dimension = dim;
      this.def = ENTITIES[typeId];
      this.van = VANILLA_ENTITIES[typeId];
      this.pos = { x: loc.x, y: loc.y, z: loc.z }; this.vel = { x: 0, y: 0, z: 0 };
      this.yaw = 0; this.pitch = 0; this.headYaw = 0;
      this.tags = new Set(); this.props = new Map(); this.effects = new Map();
      this.groups = []; this.properties = {};
      this.alive = true; this.removed = false; this.deathTick = -1;
      this._name = ""; this.born = tick; this.onGround = false; this.hurtTick = -100; this.lastHurtBy = undefined;
      this.anims = []; this.equipment = {}; this.riders = []; this.ridingOn = undefined;
      this.comp = {};
      for (const [k, v] of Object.entries(this.def?.description?.properties ?? {})) this.properties[k] = v.default;
      this.rebuild();
      const h = this.comp["minecraft:health"];
      this.maxHealth = h?.max ?? h?.value ?? this.van?.health ?? 20;
      this.health = h?.value ?? this.maxHealth;
      this.ai = ai.attach(this);
    }
    // the components in force: the base ones, then every added component group in the order it was added
    rebuild() {
      const c = { ...(this.def?.components ?? {}) };
      for (const g of this.groups) Object.assign(c, this.def?.component_groups?.[g] ?? {});
      this.comp = c;
      const box = c["minecraft:collision_box"], scale = c["minecraft:scale"]?.value ?? 1;
      this.width = (box?.width ?? this.van?.width ?? 0.6) * (box ? 1 : 1); this.height = box?.height ?? this.van?.height ?? 1.8; this.scale = scale;
      this.families = c["minecraft:type_family"]?.family ?? this.van?.families ?? [];
      this.ai?.refresh();
    }
    get isValid() { return !this.removed; }
    get location() { return { x: this.pos.x, y: this.pos.y, z: this.pos.z }; }
    get nameTag() { return this._name; }
    set nameTag(v) { this._name = v ?? ""; }
    get localizationKey() { return `entity.${this.typeId}.name`; }
    get isOnGround() { return this.onGround; }
    get isInWater() { return !!this.inWater; }
    get isSneaking() { return !!this._sneak; }
    set isSneaking(v) { this._sneak = !!v; }
    get isSleeping() { return false; }
    get isSwimming() { return false; }
    get isClimbing() { return false; }
    get isFalling() { return !this.onGround && this.vel.y < 0; }
    get isSprinting() { return false; }
    get fallDistance() { return 0; }
    get target() { const t = this.ai?.target; return t && t.alive && !t.removed ? t.api : undefined; }
    get scoreboardIdentity() { return undefined; }
    getTags() { return [...this.tags]; }
    hasTag(t) { return this.tags.has(t); }
    addTag(t) { if (this.tags.has(t)) return false; this.tags.add(t); return true; }
    removeTag(t) { return this.tags.delete(t); }
    getDynamicProperty(k) { return this.props.get(k); }
    setDynamicProperty(k, v) { v === undefined ? this.props.delete(k) : this.props.set(k, v); }
    setDynamicProperties(o) { for (const [k, v] of Object.entries(o)) this.setDynamicProperty(k, v); }
    getDynamicPropertyIds() { return [...this.props.keys()]; }
    getDynamicPropertyTotalByteCount() { return 0; }
    clearDynamicProperties() { this.props.clear(); }
    getProperty(k) { return this.properties[k]; }
    setProperty(k, v) { this.properties[k] = v; }
    resetProperty(k) { this.properties[k] = this.def?.description?.properties?.[k]?.default; return this.properties[k]; }
    getRotation() { return { x: this.pitch, y: this.yaw }; }
    setRotation(r) { this.pitch = r.x ?? 0; this.yaw = r.y ?? 0; this.headYaw = this.yaw; }
    getViewDirection() { const y = (this.yaw * Math.PI) / 180, p = (this.pitch * Math.PI) / 180; return { x: -Math.sin(y) * Math.cos(p), y: -Math.sin(p), z: Math.cos(y) * Math.cos(p) }; }
    getHeadLocation() { return { x: this.pos.x, y: this.pos.y + this.height * 0.85, z: this.pos.z }; }
    getVelocity() { return { ...this.vel }; }
    clearVelocity() { this.vel = { x: 0, y: 0, z: 0 }; }
    applyImpulse(v) { this.vel.x += v.x ?? 0; this.vel.y += v.y ?? 0; this.vel.z += v.z ?? 0; }
    applyKnockback(a, b, c, d) {
      // 2.x: applyKnockback({ x, z }, verticalStrength); 1.x: (dirX, dirZ, horizontal, vertical)
      if (typeof a === "object") { this.vel.x += a.x ?? 0; this.vel.z += a.z ?? 0; this.vel.y += b ?? 0; } else { const l = Math.hypot(a, b) || 1; this.vel.x += (a / l) * c; this.vel.z += (b / l) * c; this.vel.y += d ?? 0; }
    }
    teleport(loc, opts = {}) {
      this.pos = { x: loc.x, y: loc.y, z: loc.z };
      if (!opts.keepVelocity) this.vel = { x: 0, y: 0, z: 0 };
      if (opts.rotation) this.setRotation(opts.rotation);
      if (opts.facingLocation) this.lookAt(opts.facingLocation);
      if (opts.dimension) this.dimension = opts.dimension;
      this.ai?.teleported();
    }
    tryTeleport(loc, opts) { this.teleport(loc, opts); return true; }
    lookAt(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dy = p.y - (this.pos.y + this.height * 0.85); this.yaw = (Math.atan2(-dx, dz) * 180) / Math.PI; this.headYaw = this.yaw; this.pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI; }
    kill() { if (!this.alive) return false; this.health = 0; die(this, { cause: "selfDestruct" }); return true; }
    remove() { removeEntity(this); }
    applyDamage(amount, source = {}) { return damage(this, amount, source); }
    addEffect(type, duration, opts = {}) {
      const id = EFFECT_IDS(type);
      const amp = opts.amplifier ?? 0;
      if (id === "instant_health") { heal(this, 4 * 2 ** amp); return { typeId: id }; }
      if (id === "instant_damage") { damage(this, 6 * 2 ** amp, { cause: "magic" }); return { typeId: id }; }
      const old = this.effects.get(id);
      if (old && old.amplifier > amp && old.until > tick) return old.view;
      if (id === "health_boost") { const before = this.effectiveMax; this.effects.set(id, { amplifier: amp, until: tick + duration }); if (this.health > this.effectiveMax) this.health = this.effectiveMax; void before; } else this.effects.set(id, { amplifier: amp, until: tick + duration });
      const e = this.effects.get(id);
      e.view = { typeId: id, displayName: id, amplifier: amp, get duration() { return Math.max(0, e.until - tick); }, isValid: true };
      worldAfter.effectAdd.fire({ entity: this.api, effect: e.view }, entityMatch(this));
      return e.view;
    }
    removeEffect(type) { const id = EFFECT_IDS(type); const had = this.effects.delete(id); if (id === "health_boost" && this.health > this.effectiveMax) this.health = this.effectiveMax; return had; }
    getEffect(type) { const e = this.effects.get(EFFECT_IDS(type)); return e && e.until > tick ? e.view : undefined; }
    getEffects() { return [...this.effects.values()].filter((e) => e.until > tick).map((e) => e.view); }
    effectLevel(id) { const e = this.effects.get(id); return e && e.until > tick ? e.amplifier + 1 : 0; }
    get effectiveMax() { return this.maxHealth + 4 * this.effectLevel("health_boost"); }
    triggerEvent(name) {
      const ev = this.def?.events?.[name];
      if (!ev) { if (this.def) throw new Error(`Entity ${this.typeId} has no event ${name}`); return; }
      runEvent(this, ev);
      worldAfter.dataDrivenEntityTrigger.fire({ entity: this.api, eventId: name, getModifiers: () => [] }, entityMatch(this));
    }
    getComponent(id) { return entityComponent(this, fullId(id)); }
    hasComponent(id) { return !!this.getComponent(id); }
    getComponents() { return ["minecraft:health", "minecraft:movement", "minecraft:variant", "minecraft:type_family"].map((c) => this.getComponent(c)).filter(Boolean); }
    matches(q = {}) { return matchQuery(this, q); }
    runCommand(cmd) { return runCommand(this.dimension, cmd, this); }
    runCommandAsync(cmd) { return Promise.resolve(this.runCommand(cmd)); }
    playAnimation(name, opts = {}) { this.anims.push({ name, tick, ...opts }); if (this.anims.length > 6) this.anims.shift(); }
    extinguishFire() { return false; }
    setOnFire() { return false; }
    getBlockFromViewDirection(opts) { const hit = this.dimension.getBlockFromRay(this.getHeadLocation(), this.getViewDirection(), opts); return hit; }
    getEntitiesFromViewDirection() { return []; }
    getAllBlocksStandingOn() { const b = this.dimension.getBlock({ x: Math.floor(this.pos.x), y: Math.floor(this.pos.y - 0.2), z: Math.floor(this.pos.z) }); return b ? [b] : []; }
    getBlockStandingOn() { return this.getAllBlocksStandingOn()[0]; }
    getAABB() { const w = this.width / 2; return { center: { x: this.pos.x, y: this.pos.y + this.height / 2, z: this.pos.z }, extent: { x: w, y: this.height / 2, z: w } }; }
  }

  class Player extends Entity {
    constructor(dim, loc, name) {
      super("minecraft:player", dim, loc);
      this.id = "sim_player"; this.name = name; this._name = name;
      this.mode = "Creative"; this.inv = new Container(36); this.selectedSlotIndex = 0; this.level = 0; this.xp = 0;
      this.isOp = () => true; this.commandPermissionLevel = 2; this.playerPermissionLevel = 2;
      this.screen = { title: undefined, subtitle: undefined, actionBar: undefined, titleTick: -999, barTick: -999 };
      const self = this;
      this.onScreenDisplay = loose({
        setTitle(text, o = {}) { self.screen.title = rawText(text); self.screen.subtitle = o?.subtitle !== undefined ? rawText(o.subtitle) : undefined; self.screen.titleTick = tick; self.screen.titleStay = (o?.fadeInDuration ?? 10) + (o?.stayDuration ?? 70) + (o?.fadeOutDuration ?? 20); hud.title?.(self.screen.title, self.screen.subtitle); },
        updateSubtitle(text) { self.screen.subtitle = rawText(text); hud.title?.(self.screen.title, self.screen.subtitle); },
        setActionBar(text) { self.screen.actionBar = rawText(text); self.screen.barTick = tick; hud.actionBar?.(self.screen.actionBar); },
        isValid: true, isForcedHidden: () => false, getHiddenHudElements: () => [], setHudVisibility() {}, hideAllExcept() {}, resetHudElementsVisibility() {},
      }, "onScreenDisplay");
      this.camera = loose({ setCamera() {}, clear() {}, fade() {}, setFov() {}, isValid: true }, "camera");
      this.inputPermissions = loose({ cameraEnabled: true, movementEnabled: true, setPermissionCategory() {}, isPermissionCategoryEnabled: () => true }, "inputPermissions");
      this.inputInfo = loose({ lastInputModeUsed: "KeyboardAndMouse", touchOnlyAffectsHotbar: false, getButtonState: () => "Released", getMovementVector: () => ({ x: 0, y: 0 }) }, "inputInfo");
      this.clientSystemInfo = { maxRenderDistance: 16, memoryTier: 4, platformType: "Desktop" };
      this.graphicsMode = "Fancy";
      this.spawnPoint = undefined;
    }
    sendMessage(m) { hud.chat?.(rawText(m)); }
    playSound(id, o) { hud.sound?.(id, o?.location ?? this.location, o); }
    playMusic() {} stopMusic() {} queueMusic() {}
    getGameMode() { return this.mode; }
    setGameMode(m) { this.mode = typeof m === "string" ? m[0].toUpperCase() + m.slice(1) : m; }
    getSpawnPoint() { return this.spawnPoint; }
    setSpawnPoint(p) { this.spawnPoint = p; }
    addExperience(n) { this.xp += n; return this.xp; }
    addLevels(n) { this.level += n; return this.level; }
    resetLevel() { this.level = 0; this.xp = 0; }
    getTotalXp() { return this.xp; }
    get xpEarnedAtCurrentLevel() { return 0; }
    get totalXpNeededForNextLevel() { return 7; }
    getItemCooldown() { return 0; }
    startItemCooldown() {}
    spawnParticle(id, loc) { hud.particle?.(id, loc); }
    eatItem() {} postClientMessage() {}
    get isFlying() { return false; } get isGliding() { return false; } get isJumping() { return false; } get isEmoting() { return false; }
    get isSleeping() { return false; }
  }

  const rawText = (m) => {
    if (m === undefined || m === null) return "";
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map(rawText).join("");
    if (m.rawtext) return m.rawtext.map(rawText).join("");
    if (m.text !== undefined) return String(m.text);
    if (m.translate) return data.lang?.[m.translate] ?? m.translate;
    return String(m);
  };

  function entityComponent(e, id) {
    switch (id) {
      case "minecraft:health": return { typeId: id, entity: e.api, isValid: true,
        get currentValue() { return e.health; }, get effectiveMax() { return e.effectiveMax; }, get effectiveMin() { return 0; }, get defaultValue() { return e.maxHealth; },
        setCurrentValue(v) { const old = e.health; e.health = clamp(v, 0, e.effectiveMax); if (e.health !== old) worldAfter.entityHealthChanged.fire({ entity: e.api, oldValue: old, newValue: e.health }, entityMatch(e)); if (e.health <= 0 && e.alive) die(e, { cause: "none" }); return true; },
        resetToMaxValue() { this.setCurrentValue(e.effectiveMax); }, resetToMinValue() { this.setCurrentValue(0); }, resetToDefaultValue() { this.setCurrentValue(e.maxHealth); } };
      case "minecraft:movement": { const base = e.comp["minecraft:movement"]?.value ?? e.van?.speed ?? 0.1; return { typeId: id, entity: e.api, isValid: true, get currentValue() { return e.moveOverride ?? base; }, defaultValue: base, effectiveMax: 1024, effectiveMin: 0, setCurrentValue(v) { e.moveOverride = v; return true; }, resetToDefaultValue() { e.moveOverride = undefined; } }; }
      case "minecraft:variant": { const v = e.comp["minecraft:variant"]; return v ? { typeId: id, value: v.value, isValid: true } : undefined; }
      case "minecraft:mark_variant": { const v = e.comp["minecraft:mark_variant"]; return v ? { typeId: id, value: v.value, isValid: true } : undefined; }
      case "minecraft:scale": { const v = e.comp["minecraft:scale"]; return v ? { typeId: id, value: v.value, isValid: true } : undefined; }
      case "minecraft:type_family": return { typeId: id, isValid: true, getTypeFamilies: () => [...e.families], hasTypeFamily: (f) => e.families.includes(f) };
      case "minecraft:inventory": return e instanceof Player ? { typeId: id, isValid: true, container: e.inv, inventorySize: 36, containerType: "inventory" } : undefined;
      case "minecraft:equippable": return { typeId: id, isValid: true,
        getEquipment: (slot) => e.equipment[eqSlot(slot)]?.clone(), setEquipment(slot, item) { e.equipment[eqSlot(slot)] = item?.clone(); return true; },
        getEquipmentSlot(slot) { return { getItem: () => e.equipment[eqSlot(slot)]?.clone(), setItem: (it) => { e.equipment[eqSlot(slot)] = it?.clone(); }, get typeId() { return e.equipment[eqSlot(slot)]?.typeId; }, hasItem: () => !!e.equipment[eqSlot(slot)], isValid: true }; },
        totalArmor: armorOf(e), totalToughness: 0 };
      case "minecraft:riding": return e.ridingOn ? { typeId: id, isValid: true, entityRidingOn: e.ridingOn.api } : undefined;
      case "minecraft:rideable": { const r = e.comp["minecraft:rideable"]; return r ? { typeId: id, isValid: true, seatCount: r.seat_count ?? 1, getRiders: () => e.riders.filter((x) => !x.removed).map((x) => x.api), addRider(rider) { mount(unwrap(rider), e); return true; }, ejectRider(rider) { dismount(unwrap(rider)); }, ejectRiders() { for (const x of [...e.riders]) dismount(x); }, getFamilyTypes: () => r.family_types ?? [], getSeats: () => [] } : undefined; }
      case "minecraft:item": return e.item ? { typeId: id, isValid: true, itemStack: e.item } : undefined;
      case "minecraft:is_baby": return undefined;
      case "minecraft:tameable": case "minecraft:tamemount": case "minecraft:leashable": case "minecraft:projectile": case "minecraft:npc": case "minecraft:skin_id": case "minecraft:color": case "minecraft:is_tamed": case "minecraft:onfire": case "minecraft:exhaustion": case "minecraft:hunger": case "minecraft:saturation": case "minecraft:breathable": case "minecraft:cursor_inventory":
        if (id === "minecraft:hunger" || id === "minecraft:saturation" || id === "minecraft:exhaustion") return e instanceof Player ? { typeId: id, isValid: true, currentValue: 20, defaultValue: 20, effectiveMax: 20, effectiveMin: 0, setCurrentValue: () => true, resetToMaxValue() {}, resetToDefaultValue() {} } : undefined;
        return undefined;
      default: return e.comp[id] ? { typeId: id, isValid: true, ...(typeof e.comp[id] === "object" ? e.comp[id] : {}) } : undefined;
    }
  }
  const unwrap = (api) => api?.__e ?? api;
  function mount(rider, mountE) { if (!rider || rider.ridingOn === mountE) return; dismount(rider); rider.ridingOn = mountE; mountE.riders.push(rider); }
  function dismount(rider) { const m = rider?.ridingOn; if (!m) return; m.riders = m.riders.filter((x) => x !== rider); rider.ridingOn = undefined; rider.pos.y = m.pos.y; }
  function armorOf(e) { let a = 0; for (const it of Object.values(e.equipment)) a += ITEMS[it?.typeId]?.armor ?? 0; return a; }

  function runEvent(e, ev) {
    if (ev.filters && !ai.testFilter(ev.filters, e, undefined)) return;
    if (ev.sequence) for (const s of ev.sequence) runEvent(e, s);
    if (ev.randomize) { const total = ev.randomize.reduce((a, r) => a + (r.weight ?? 1), 0); let roll = Math.random() * total; for (const r of ev.randomize) { roll -= r.weight ?? 1; if (roll <= 0) { runEvent(e, r); break; } } }
    let changed = false;
    for (const g of ev.remove?.component_groups ?? []) { const i = e.groups.indexOf(g); if (i >= 0) { e.groups.splice(i, 1); changed = true; } }
    for (const g of ev.add?.component_groups ?? []) { const i = e.groups.indexOf(g); if (i >= 0) e.groups.splice(i, 1); e.groups.push(g); changed = true; }
    for (const [k, v] of Object.entries(ev.set_property ?? {})) e.properties[k] = v;
    if (changed) e.rebuild();
    if (ev.trigger) { const t = typeof ev.trigger === "string" ? ev.trigger : ev.trigger.event; const next = e.def?.events?.[t]; if (next) runEvent(e, next); }
    for (const c of [].concat(ev.queue_command?.command ?? [])) system.run(() => { try { runCommand(e.dimension, c, e); } catch { /* a command we don't model */ } });
  }

  function spawn(dim, type, loc, opts = {}) {
    if (early) throw new ReferenceError("Native function [Dimension::spawnEntity] cannot be used in early execution.");
    let id = fullId(type), event;
    const m = /^([^<]+)<([^>]*)>$/.exec(id);
    if (m) { id = m[1]; event = m[2]; }
    if (!ENTITIES[id] && !id.startsWith("minecraft:")) throw new Error(`Unknown entity type ${id}`);
    if (!blocks.inside(Math.floor(loc.x), Math.floor(loc.y), Math.floor(loc.z))) throw new Error("LocationInUnloadedChunkError");
    const e = new Entity(id, dim, loc);
    e.api = loose(e, "Entity"); e.__e = e;
    allEntities.set(e.id, e);
    if (opts.initialRotation !== undefined) e.yaw = e.headYaw = opts.initialRotation;
    if (event ?? opts.spawnEvent) { try { e.triggerEvent(event ?? opts.spawnEvent); } catch { /* no such event */ } }
    else if (e.def?.events?.["minecraft:entity_spawned"]) runEvent(e, e.def.events["minecraft:entity_spawned"]);
    if (e.van?.fleeting) system.runTimeout(() => removeEntity(e), e.van.fleeting);
    worldAfter.entitySpawn.fire({ entity: e.api, cause: "Spawned" }, entityMatch(e));
    hud.spawned?.(e);
    return e.api;
  }
  function removeEntity(e) {
    if (e.removed) return;
    worldBefore.entityRemove.fire({ removedEntity: e.api }, entityMatch(e));
    e.removed = true; e.alive = false;
    for (const r of [...e.riders]) dismount(r);
    dismount(e);
    allEntities.delete(e.id);
    worldAfter.entityRemove.fire({ removedEntityId: e.id, typeId: e.typeId }, (o) => !o.entityTypes || o.entityTypes.includes(e.typeId));
    hud.removed?.(e);
  }
  function heal(e, n) { if (!e.alive) return; const old = e.health; e.health = Math.min(e.effectiveMax, e.health + n); if (e.health !== old) worldAfter.entityHealthChanged.fire({ entity: e.api, oldValue: old, newValue: e.health }, entityMatch(e)); }

  // One blow. Minecraft's order: damage sensors, the script's "before" say, resistance and armour, then health.
  function damage(e, amount, source = {}) {
    if (!e.alive || e.removed || !(amount > 0)) return false;
    const cause = String(source.cause ?? "none");
    const by = unwrap(source.damagingEntity), proj = unwrap(source.damagingProjectile);
    if (e instanceof Player && (e.mode === "Creative" || e.mode === "Spectator")) return false;
    let mult = 1;
    for (const t of [].concat(e.comp["minecraft:damage_sensor"]?.triggers ?? [])) {
      if (t.cause && t.cause !== "all" && t.cause !== cause && !(t.cause === "entity_attack" && cause === "entityAttack") && !(t.cause === "fire_tick" && cause === "fireTick")) continue;
      if (t.on_damage?.filters && !ai.testFilter(t.on_damage.filters, e, by)) continue;
      if (t.deals_damage === false || t.deals_damage === "no") return false;
      mult *= t.damage_multiplier ?? 1; amount += t.damage_modifier ?? 0;
    }
    amount *= mult;
    const src = { cause, damagingEntity: by?.api, damagingProjectile: proj?.api };
    const before = { hurtEntity: e.api, damage: amount, damageSource: src, cancel: false };
    worldBefore.entityHurt.fire(before, entityMatch(e));
    if (before.cancel) return false;
    amount = before.damage;
    const physical = cause === "entityAttack" || cause === "projectile" || cause === "entityExplosion" || cause === "blockExplosion" || cause === "contact";
    const res = e.effectLevel("resistance");
    if (res >= 5) return false;
    if (cause !== "void" && cause !== "selfDestruct") amount *= 1 - 0.2 * res;
    if (physical) amount *= 1 - Math.min(20, armorOf(e)) * 0.04;
    if (!(amount > 0)) return false;
    // ten ticks of grace after a blow: only a harder one gets through, and only its extra
    if (tick - e.hurtTick < 10 && cause !== "selfDestruct") { if (amount <= e.lastDamage) return false; const extra = amount - e.lastDamage; e.lastDamage = amount; amount = extra; } else { e.lastDamage = amount; e.hurtTick = tick; }
    const old = e.health;
    e.health = Math.max(0, e.health - amount);
    if (by) { e.lastHurtBy = by; e.lastHurtByTick = tick; }
    e.ai?.hurt(by);
    hud.hurt?.(e, amount, cause);
    worldAfter.entityHurt.fire({ hurtEntity: e.api, damage: amount, damageSource: src }, entityMatch(e));
    worldAfter.entityHealthChanged.fire({ entity: e.api, oldValue: old, newValue: e.health }, entityMatch(e));
    if (e.health <= 0) die(e, src);
    return true;
  }
  function die(e, src) {
    if (!e.alive) return;
    e.alive = false; e.deathTick = tick; e.health = 0;
    for (const r of [...e.riders]) dismount(r);
    dismount(e);
    hud.died?.(e, src);
    worldAfter.entityDie.fire({ deadEntity: e.api, damageSource: { cause: src?.cause ?? "none", damagingEntity: src?.damagingEntity, damagingProjectile: src?.damagingProjectile } }, entityMatch(e));
    if (e instanceof Player) { system.runTimeout(() => respawn(e), 40); return; }
    system.runTimeout(() => removeEntity(e), 20); // it lies there for a second
  }
  function respawn(p) {
    p.alive = true; p.health = p.maxHealth; p.effects.clear();
    const at = p.spawnPoint ?? player0Spawn;
    p.pos = { x: at.x, y: at.y, z: at.z }; p.vel = { x: 0, y: 0, z: 0 };
    worldAfter.playerSpawn.fire({ player: p.api, initialSpawn: false });
  }

  function matchQuery(e, q) {
    if (q.type !== undefined && e.typeId !== fullId(q.type)) return false;
    if (q.excludeTypes?.some((t) => fullId(t) === e.typeId)) return false;
    if (q.families && !q.families.every((f) => e.families.includes(f))) return false;
    if (q.excludeFamilies?.some((f) => e.families.includes(f))) return false;
    if (q.tags && !q.tags.every((t) => e.tags.has(t))) return false;
    if (q.excludeTags?.some((t) => e.tags.has(t))) return false;
    if (q.name !== undefined && (e instanceof Player ? e.name : e._name) !== q.name) return false;
    if (q.excludeNames?.includes(e._name)) return false;
    if (q.gameMode !== undefined && !(e instanceof Player && e.mode.toLowerCase() === String(q.gameMode).toLowerCase())) return false;
    if (q.excludeGameModes && e instanceof Player && q.excludeGameModes.some((m) => String(m).toLowerCase() === e.mode.toLowerCase())) return false;
    if (q.location) {
      const d = Math.hypot(e.pos.x - q.location.x, e.pos.y - q.location.y, e.pos.z - q.location.z);
      if (q.maxDistance !== undefined && d > q.maxDistance) return false;
      if (q.minDistance !== undefined && d < q.minDistance) return false;
      if (q.volume) { const v = q.volume, dx = e.pos.x - q.location.x, dy = e.pos.y - q.location.y, dz = e.pos.z - q.location.z; if (dx < Math.min(0, v.x) || dx > Math.max(0, v.x) || dy < Math.min(0, v.y) || dy > Math.max(0, v.y) || dz < Math.min(0, v.z) || dz > Math.max(0, v.z)) return false; }
    }
    if (q.propertyOptions) for (const o of q.propertyOptions) { const v = e.properties[o.propertyId]; const want = o.value; if (want !== undefined && typeof want !== "object" ? (v === want) === !!o.exclude : false) return false; }
    return true;
  }
  function query(list, q = {}) {
    let out = [];
    for (const e of list) if (e.alive && !e.removed && matchQuery(e, q)) out.push(e);
    if (q.location && (q.closest !== undefined || q.farthest !== undefined)) {
      const d = (e) => (e.pos.x - q.location.x) ** 2 + (e.pos.y - q.location.y) ** 2 + (e.pos.z - q.location.z) ** 2;
      out.sort((a, b) => d(a) - d(b));
      if (q.farthest !== undefined) out = out.reverse().slice(0, q.farthest); else out = out.slice(0, q.closest);
    }
    return out.map((e) => e.api);
  }

  // ---------- commands (the few the scripts run) ----------
  const num = (tok, base) => (tok.startsWith("~") ? base + (parseFloat(tok.slice(1)) || 0) : parseFloat(tok));
  function parseStates(src) { // ["siege:open"=true,"a"=1]
    const out = {};
    for (const m of src.matchAll(/"([^"]+)"\s*[=:]\s*("([^"]*)"|[^,\]]+)/g)) { const v = m[3] ?? m[2].trim(); out[m[1]] = m[3] !== undefined ? m[3] : v === "true" ? true : v === "false" ? false : Number(v); }
    return out;
  }
  function selectorTargets(sel, dim, self) {
    if (sel === "@s") return self ? [self] : [];
    const m = /^@([aepr])(?:\[(.*)\])?$/.exec(sel);
    if (!m) { const p = player0 && (player0.name === sel.replace(/"/g, "")) ? [player0] : []; return p; }
    const args = Object.fromEntries((m[2] ?? "").split(",").filter(Boolean).map((kv) => { const i = kv.indexOf("="); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; }));
    const origin = { x: args.x !== undefined ? num(args.x, self?.pos.x ?? 0) : self?.pos.x ?? 0, y: args.y !== undefined ? num(args.y, self?.pos.y ?? 0) : self?.pos.y ?? 0, z: args.z !== undefined ? num(args.z, self?.pos.z ?? 0) : self?.pos.z ?? 0 };
    let list = [...allEntities.values()].filter((e) => e.alive && e.dimension === dim);
    if (m[1] === "a" || m[1] === "p" || m[1] === "r") list = list.filter((e) => e instanceof Player);
    if (args.type) list = list.filter((e) => (args.type.startsWith("!") ? e.typeId !== fullId(args.type.slice(1)) : e.typeId === fullId(args.type)));
    if (args.tag) list = list.filter((e) => (args.tag.startsWith("!") ? !e.tags.has(args.tag.slice(1)) : e.tags.has(args.tag)));
    if (args.family) list = list.filter((e) => e.families.includes(args.family));
    if (args.r !== undefined) list = list.filter((e) => Math.hypot(e.pos.x - origin.x, e.pos.y - origin.y, e.pos.z - origin.z) <= parseFloat(args.r));
    if (args.name) list = list.filter((e) => e._name === args.name.replace(/"/g, ""));
    if (m[1] === "p" || args.c === "1") { list.sort((a, b) => Math.hypot(a.pos.x - origin.x, a.pos.z - origin.z) - Math.hypot(b.pos.x - origin.x, b.pos.z - origin.z)); list = list.slice(0, 1); }
    return list;
  }
  function runCommand(dim, cmd, self) {
    if (early) throw new ReferenceError("Native function [Dimension::runCommand] cannot be used in early execution.");
    cmd = cmd.trim().replace(/^\//, "");
    const t = cmd.match(/"[^"]*"|\[[^\]]*\]|@\w(?:\[[^\]]*\])?|\S+/g) ?? [];
    const base = self?.pos ?? { x: 0, y: 0, z: 0 };
    const ok = { successCount: 1 }, no = { successCount: 0 };
    switch (t[0]) {
      case "setblock": {
        const x = Math.floor(num(t[1], base.x)), y = Math.floor(num(t[2], base.y)), z = Math.floor(num(t[3], base.z));
        let rest = t.slice(5), states = {};
        if (rest[0]?.startsWith("[")) { states = parseStates(rest[0]); rest = rest.slice(1); }
        const mode = rest[0];
        const b = dim.getBlock({ x, y, z });
        if (!b) return no;
        if (mode === "keep" && !b.isAir) return no;
        const was = b.typeId;
        b.setPermutation(BlockPermutation.resolve(t[4], states));
        if (mode === "destroy" && was !== AIR) hud.broke?.(x, y, z, was);
        return ok;
      }
      case "fill": {
        const a = [1, 2, 3].map((i) => Math.floor(num(t[i], [base.x, base.y, base.z][i - 1]))), c = [4, 5, 6].map((i) => Math.floor(num(t[i], [base.x, base.y, base.z][i - 4])));
        let rest = t.slice(8), states = {};
        if (rest[0]?.startsWith("[")) { states = parseStates(rest[0]); rest = rest.slice(1); }
        const perm = BlockPermutation.resolve(t[7], states);
        const replace = rest[0] === "replace" ? fullId(rest[1]) : undefined, keep = rest[0] === "keep";
        let n = 0;
        for (let x = Math.min(a[0], c[0]); x <= Math.max(a[0], c[0]); x++) for (let y = Math.min(a[1], c[1]); y <= Math.max(a[1], c[1]); y++) for (let z = Math.min(a[2], c[2]); z <= Math.max(a[2], c[2]); z++) {
          if (!blocks.inside(x, y, z)) continue;
          const cur = permAt(blocks.get(x, y, z));
          if (replace && cur.typeId !== replace) continue;
          if (keep && cur.typeId !== AIR) continue;
          if (setBlockAt(dim, x, y, z, perm)) n++;
        }
        return { successCount: n };
      }
      case "playanimation": { const list = selectorTargets(t[1], dim, self); for (const e of list) e.playAnimation(t[2]); return { successCount: list.length }; }
      case "replaceitem": { // replaceitem entity @s slot.armor.head 0 <item>
        if (t[1] !== "entity") return no;
        const slot = { "slot.armor.head": "head", "slot.armor.chest": "chest", "slot.armor.legs": "legs", "slot.armor.feet": "feet", "slot.weapon.mainhand": "mainhand", "slot.weapon.offhand": "offhand" }[t[3]];
        const list = selectorTargets(t[2], dim, self);
        if (slot) for (const e of list) e.equipment[slot] = t[5] && fullId(t[5]) !== AIR ? new ItemStack(t[5], Number(t[6]) || 1) : undefined;
        return { successCount: list.length };
      }
      case "event": { const list = selectorTargets(t[2], dim, self); for (const e of list) { try { e.triggerEvent(t[3]); } catch { /* no such event */ } } return { successCount: list.length }; }
      case "tag": { const list = selectorTargets(t[1], dim, self); for (const e of list) (t[2] === "add" ? e.tags.add(t[3]) : e.tags.delete(t[3])); return { successCount: list.length }; }
      case "kill": { const list = selectorTargets(t[1] ?? "@s", dim, self).filter((e) => !(e instanceof Player)); for (const e of list) e.kill(); return { successCount: list.length }; }
      case "effect": { const list = selectorTargets(t[1], dim, self); for (const e of list) { if (t[2] === "clear") e.effects.clear(); else e.addEffect(t[2], (Number(t[3]) || 30) * 20, { amplifier: Number(t[4]) || 0 }); } return { successCount: list.length }; }
      case "tp": case "teleport": { const list = selectorTargets(t[1], dim, self); if (t.length >= 5) for (const e of list) e.teleport({ x: num(t[2], e.pos.x), y: num(t[3], e.pos.y), z: num(t[4], e.pos.z) }); return { successCount: list.length }; }
      case "ride": { // ride <riders> start_riding <mount> | stop_riding
        const riders = selectorTargets(t[1], dim, self);
        if (t[2] === "stop_riding") { for (const r of riders) dismount(r); return { successCount: riders.length }; }
        if (t[2] === "start_riding") { const m = selectorTargets(t[3], dim, self)[0]; if (!m) return no; for (const r of riders) mount(r, m); return { successCount: riders.length }; }
        return no;
      }
      case "summon": { try { spawn(dim, t[1], { x: num(t[2] ?? "~", base.x), y: num(t[3] ?? "~", base.y), z: num(t[4] ?? "~", base.z) }); return ok; } catch { return no; } }
      case "time": { if (t[1] === "set") { const v = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 }[t[2]] ?? Number(t[2]); if (Number.isFinite(v)) worldTime = Math.floor(worldTime / 24000) * 24000 + v; } else if (t[1] === "add") worldTime += Number(t[2]) || 0; return ok; }
      case "scriptevent": { systemAfter.scriptEventReceive.fire({ id: t[1], message: t.slice(2).join(" "), sourceType: "Entity", sourceEntity: self?.api ?? player0?.api, initiator: undefined, sourceBlock: undefined }); return ok; }
      case "particle": hud.particle?.(t[1], { x: num(t[2] ?? "~", base.x), y: num(t[3] ?? "~", base.y), z: num(t[4] ?? "~", base.z) }); return ok;
      case "playsound": hud.sound?.(t[1], base); return ok;
      case "title": case "titleraw": case "tellraw": case "say": case "tell": case "msg": case "tickingarea": case "gamerule": case "camera": case "camerashake": case "fog": case "weather": case "stopsound": case "music": case "scoreboard": case "inputpermission": case "hud": case "spawnpoint": case "setworldspawn": case "clear": case "give": case "xp": case "ability": case "gamemode": case "difficulty": case "structure": case "dialogue": case "execute": case "function": case "daylock": case "alwaysday": case "mobevent": case "damage": case "clone": case "loot": case "enchant":
        return ok;
      default: miss(`command ${t[0]}`); return no;
    }
  }

  // ---------- dimensions ----------
  function makeDimension(id) {
    const dim = {
      id, heightRange: { min: -64, max: 320 }, localizationKey: id,
      getBlock(loc) {
        const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
        if (id !== "minecraft:overworld" || !blocks.inside(x, y, z)) return undefined;
        return new Block(dim, x, y, z);
      },
      getBlockBelow(loc, opts) { for (let y = Math.floor(loc.y) - 1; y >= Math.floor(loc.y) - (opts?.maxDistance ?? 64); y--) { const b = dim.getBlock({ x: loc.x, y, z: loc.z }); if (!b) return undefined; if (!b.isAir && (opts?.includePassableBlocks || !b.permutation.collision.pass)) return b; } return undefined; },
      getBlockAbove(loc, opts) { for (let y = Math.floor(loc.y) + 1; y <= Math.floor(loc.y) + (opts?.maxDistance ?? 64); y++) { const b = dim.getBlock({ x: loc.x, y, z: loc.z }); if (!b) return undefined; if (!b.isAir && (opts?.includePassableBlocks || !b.permutation.collision.pass)) return b; } return undefined; },
      getTopmostBlock(xz, minHeight) {
        const x = Math.floor(xz.x), z = Math.floor(xz.z);
        if (id !== "minecraft:overworld") return undefined;
        const [lo, hi] = blocks.yRange;
        if (!blocks.inside(x, lo, z)) return undefined;
        for (let y = hi; y >= Math.max(lo, minHeight ?? lo); y--) if (blocks.get(x, y, z) !== 0) return new Block(dim, x, y, z);
        return undefined;
      },
      getBlockFromRay(origin, dir, opts = {}) {
        if (id !== "minecraft:overworld") return undefined;
        const hit = ai.raycast(origin, dir, opts.maxDistance ?? 64, { passable: !!opts.includePassableBlocks, liquid: !!opts.includeLiquidBlocks });
        return hit ? { block: new Block(dim, hit.x, hit.y, hit.z), face: hit.face, faceLocation: { x: 0.5, y: 0.5, z: 0.5 } } : undefined;
      },
      getBlocks: () => ({ getBlockLocationIterator: function* () {}, getCapacity: () => 0 }),
      containsBlock: () => false,
      setBlockType(loc, type) { dim.getBlock(loc)?.setType(type); },
      setBlockPermutation(loc, perm) { dim.getBlock(loc)?.setPermutation(perm); },
      fillBlocks(volume, block, opts = {}) {
        const perm = typeof block === "string" ? BlockPermutation.resolve(block) : block instanceof BlockPermutation ? block : BlockPermutation.resolve(fullId(block));
        const a = volume.from ?? volume.getMin?.() ?? volume.min, b = volume.to ?? volume.getMax?.() ?? volume.max;
        let n = 0;
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++) {
          if (!blocks.inside(x, y, z)) continue;
          if (opts.blockFilter && !blockFilterOk(opts.blockFilter, permAt(blocks.get(x, y, z)))) continue;
          if (setBlockAt(dim, x, y, z, perm)) n++;
        }
        return { getCapacity: () => n, getBlockLocationIterator: function* () {} };
      },
      getEntities(q) { return id === "minecraft:overworld" ? query(allEntities.values(), q) : []; },
      getPlayers(q) { return id === "minecraft:overworld" ? query(players, q) : []; },
      getEntitiesAtBlockLocation(loc) { return query(allEntities.values(), {}).filter((e) => Math.floor(e.location.x) === loc.x && Math.floor(e.location.y) === loc.y && Math.floor(e.location.z) === loc.z); },
      getEntitiesFromRay() { return []; },
      spawnEntity(type, loc, opts) { if (id !== "minecraft:overworld") throw new Error("LocationInUnloadedChunkError"); return spawn(dim, type, loc, opts); },
      spawnItem(item, loc) { const e = spawn(dim, "minecraft:item", loc); e.__e.item = item; system.runTimeout(() => removeEntity(e.__e), 600); hud.item?.(item, loc); return e; },
      spawnParticle(pid, loc, vars) { hud.particle?.(pid, loc, vars); },
      playSound(sid, loc, o) { hud.sound?.(sid, loc, o); },
      runCommand(cmd) { return runCommand(dim, cmd); },
      runCommandAsync(cmd) { return Promise.resolve(runCommand(dim, cmd)); },
      createExplosion(loc, radius, opts = {}) {
        hud.explosion?.(loc, radius);
        // creatures in the blast are hurt (the scripts always pass breaksBlocks: false and do the wall damage themselves)
        for (const e of allEntities.values()) {
          if (!e.alive || e.van?.inert) continue;
          const d = Math.hypot(e.pos.x - loc.x, e.pos.y + e.height / 2 - loc.y, e.pos.z - loc.z);
          if (d > radius * 2) continue;
          const k = 1 - d / (radius * 2);
          damage(e, Math.floor((k * k + k) * 3.5 * radius + 1), { cause: opts.source ? "entityExplosion" : "blockExplosion", damagingEntity: opts.source });
          if (e.alive && (e.comp["minecraft:knockback_resistance"]?.value ?? 0) < 1) { const l = Math.hypot(e.pos.x - loc.x, e.pos.z - loc.z) || 1; e.vel.x += ((e.pos.x - loc.x) / l) * k; e.vel.z += ((e.pos.z - loc.z) / l) * k; e.vel.y += 0.3 * k; }
        }
        return true;
      },
      getWeather: () => "Clear", setWeather() {},
      findClosestBiome: () => undefined, getBiome: () => ({ id: "minecraft:plains" }),
      placeFeature: () => false, placeFeatureRule: () => false,
      getLightLevel: () => 15, getSkyLightLevel: () => 15,
      isChunkLoaded: (loc) => blocks.inside(Math.floor(loc.x), blocks.yRange[0], Math.floor(loc.z)),
    };
    dim.typeId = id;
    return loose(dim, "Dimension");
  }
  function blockFilterOk(f, perm) {
    if (f.includeTypes && !f.includeTypes.map(fullId).includes(perm.typeId)) return false;
    if (f.excludeTypes?.map(fullId).includes(perm.typeId)) return false;
    if (f.includePermutations && !f.includePermutations.includes(perm)) return false;
    return true;
  }
  const getDimension = (id) => { const key = fullId(id); if (!dims.has(key)) dims.set(key, makeDimension(key)); return dims.get(key); };

  // ---------- scoreboard (the siege sidebar is one) ----------
  const objectives = new Map();
  const display = {};
  function makeObjective(id, displayName) {
    const scores = new Map();
    const part = (p) => (typeof p === "string" ? p : p?.displayName ?? p?.name ?? p?.id ?? String(p));
    return { id, displayName, isValid: true, scores,
      getParticipants: () => [...scores.keys()].map((n) => ({ displayName: n, id: n, type: "FakePlayer", isValid: true })),
      getScores: () => [...scores].map(([n, score]) => ({ participant: { displayName: n }, score })),
      getScore: (p) => scores.get(part(p)), hasParticipant: (p) => scores.has(part(p)),
      setScore: (p, v) => { scores.set(part(p), v); }, addScore: (p, v) => { const n = (scores.get(part(p)) ?? 0) + v; scores.set(part(p), n); return n; },
      removeParticipant: (p) => scores.delete(part(p)) };
  }
  const scoreboard = {
    getObjective: (id) => objectives.get(id),
    getObjectives: () => [...objectives.values()],
    addObjective(id, displayName) { if (objectives.has(id)) throw new Error("objective exists"); const o = makeObjective(id, displayName ?? id); objectives.set(id, o); return o; },
    removeObjective(o) { const id = typeof o === "string" ? o : o.id; for (const k of Object.keys(display)) if (display[k]?.id === id) delete display[k]; return objectives.delete(id); },
    setObjectiveAtDisplaySlot(slot, opts) { const old = display[slot]; display[slot] = opts.objective; return old; },
    getObjectiveAtDisplaySlot: (slot) => (display[slot] ? { objective: display[slot] } : undefined),
    clearObjectiveAtDisplaySlot(slot) { const o = display[slot]; delete display[slot]; return o; },
    getParticipants: () => [],
  };

  // ---------- world ----------
  const props = new Map();
  const players = [];
  let player0, player0Spawn = { x: 0, y: 0, z: 0 };
  const gameRules = new Proxy({}, { get: (t, k) => t[k] ?? false, set: (t, k, v) => { t[k] = v; return true; } });
  const world = loose({
    afterEvents: worldAfter, beforeEvents: worldBefore, scoreboard, gameRules,
    getDynamicProperty: (k) => props.get(k),
    setDynamicProperty(k, v) { if (early) throw new ReferenceError("Native function [World::setDynamicProperty] cannot be used in early execution."); v === undefined ? props.delete(k) : props.set(k, v); },
    setDynamicProperties(o) { for (const [k, v] of Object.entries(o)) world.setDynamicProperty(k, v); },
    getDynamicPropertyIds: () => [...props.keys()],
    getDynamicPropertyTotalByteCount: () => 0,
    clearDynamicProperties: () => props.clear(),
    getPlayers: (q) => query(players, q),
    getAllPlayers: () => query(players, {}),
    getEntity: (id) => { const e = allEntities.get(id); return e && !e.removed ? e.api : undefined; },
    getDimension(id) { if (early) throw new ReferenceError("Native function [World::getDimension] cannot be used in early execution."); return getDimension(id); },
    getDay: () => Math.floor(worldTime / 24000),
    getTimeOfDay: () => ((worldTime % 24000) + 24000) % 24000,
    setTimeOfDay(t) { const v = typeof t === "number" ? t : 0; worldTime = Math.floor(worldTime / 24000) * 24000 + v; },
    getAbsoluteTime: () => worldTime,
    setAbsoluteTime(t) { worldTime = t; },
    getMoonPhase: () => Math.floor(worldTime / 24000) % 8,
    sendMessage(m) { hud.chat?.(rawText(m)); },
    playSound(id, loc, o) { hud.sound?.(id, loc, o); },
    playMusic() {}, stopMusic() {}, queueMusic() {},
    getDefaultSpawnLocation: () => ({ ...player0Spawn }), setDefaultSpawnLocation(l) { player0Spawn = { ...l }; },
    getDifficulty: () => "Normal", setDifficulty() {},
    isHardcore: false, seed: "0",
    getAimAssist: () => stub("aimAssist"), getLootTableManager: () => stub("lootTableManager"), getPackSettings: () => ({}),
    broadcastClientMessage() {},
    structureManager: stub("structureManager"),
    tickingAreaManager: loose({ createTickingArea: () => Promise.resolve({}), removeTickingArea() {}, removeAllTickingAreas() {}, getTickingArea: () => undefined, getAllTickingAreas: () => [], hasTickingArea: () => false, hasCapacity: () => true, chunkCount: 0, maxChunkCount: 300 }, "tickingAreaManager"),
  }, "world");

  // ---------- forms: the page may show them; by default the player is "busy" ----------
  const formClass = (kind) => class {
    constructor() { this.kind = kind; this.parts = []; this._title = ""; this._body = ""; }
    title(t) { this._title = rawText(t); return this; }
    body(t) { this._body = rawText(t); return this; }
    button(t, icon) { this.parts.push({ type: "button", text: rawText(t), icon }); return this; }
    button1(t) { this.parts[0] = { type: "button", text: rawText(t) }; return this; }
    button2(t) { this.parts[1] = { type: "button", text: rawText(t) }; return this; }
    label(t) { this.parts.push({ type: "label", text: rawText(t) }); return this; }
    header(t) { this.parts.push({ type: "header", text: rawText(t) }); return this; }
    divider() { this.parts.push({ type: "divider" }); return this; }
    textField(l, p, o) { this.parts.push({ type: "text", text: rawText(l), placeholder: rawText(p), def: o?.defaultValue ?? (typeof o === "string" ? o : "") }); return this; }
    toggle(l, o) { this.parts.push({ type: "toggle", text: rawText(l), def: o?.defaultValue ?? !!o }); return this; }
    slider(l, min, max, o) { this.parts.push({ type: "slider", text: rawText(l), min, max, def: o?.defaultValue ?? min }); return this; }
    dropdown(l, items, o) { this.parts.push({ type: "dropdown", text: rawText(l), items: items.map(rawText), def: o?.defaultValueIndex ?? 0 }); return this; }
    submitButton(t) { this._submit = rawText(t); return this; }
    show(player) {
      const ask = hud.form?.(this, player);
      return Promise.resolve(ask ?? { canceled: true, cancelationReason: "UserBusy" });
    }
  };

  // ---------- the names the scripts import ----------
  const enumOf = (...names) => Object.fromEntries(names.map((n) => [n, n]));
  const typeList = (ids, vanillaOk) => ({ get: (id) => (ids.has(fullId(id)) || (vanillaOk && fullId(id).startsWith("minecraft:")) ? { id: fullId(id) } : undefined), getAll: () => [...ids].map((id) => ({ id })) });
  class MolangVariableMap { setColorRGB() {} setColorRGBA() {} setFloat() {} setVector3() {} setSpeedAndDirection() {} }
  const known = {
    world, system, ItemStack, BlockPermutation, MolangVariableMap, Player, Entity, Block, Container,
    BlockTypes: typeList(new Set(Object.keys(BLOCKS)), true),
    EntityTypes: typeList(new Set(Object.keys(ENTITIES)), true),
    ItemTypes: typeList(new Set([...(data.itemIds ?? []), ...Object.keys(BLOCKS)]), true),
    EffectTypes: { get: (id) => ({ getName: () => EFFECT_IDS(id) }), getAll: () => [] },
    EnchantmentTypes: { get: () => undefined, getAll: () => [] },
    EntityDamageCause: new Proxy({}, { get: (_, k) => String(k) }),
    EquipmentSlot: enumOf("Head", "Chest", "Legs", "Feet", "Mainhand", "Offhand", "Body"),
    GameMode: enumOf("Survival", "Creative", "Adventure", "Spectator"),
    DisplaySlotId: enumOf("Sidebar", "List", "BelowName"),
    ObjectiveSortOrder: { Ascending: 0, Descending: 1 },
    Direction: enumOf("Down", "Up", "North", "South", "East", "West"),
    WeatherType: enumOf("Clear", "Rain", "Thunder"),
    TimeOfDay: { Day: 1000, Noon: 6000, Sunset: 12000, Night: 13000, Midnight: 18000, Sunrise: 23000 },
    EasingType: new Proxy({}, { get: (_, k) => String(k) }),
    InputPermissionCategory: new Proxy({}, { get: (_, k) => String(k) }),
    HudElement: new Proxy({}, { get: (_, k) => String(k) }),
    HudVisibility: { Hide: 0, Reset: 1 },
    StructureSaveMode: enumOf("Memory", "World"), StructureAnimationMode: enumOf("None", "Layers", "Blocks"), StructureRotation: enumOf("None", "Rotate90", "Rotate180", "Rotate270"), StructureMirrorAxis: enumOf("None", "X", "Z", "XZ"),
    ScriptEventSource: enumOf("Block", "Entity", "NPCDialogue", "Server"),
    CommandPermissionLevel: { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 },
    CustomCommandParamType: new Proxy({}, { get: (_, k) => String(k) }),
    CustomCommandStatus: { Success: 0, Failure: 1 },
    CustomCommandSource: new Proxy({}, { get: (_, k) => String(k) }),
    PlayerPermissionLevel: { Visitor: 0, Member: 1, Operator: 2, Custom: 3 },
    LiquidType: enumOf("Water"), Difficulty: enumOf("Peaceful", "Easy", "Normal", "Hard"),
    ButtonState: enumOf("Pressed", "Released"), InputButton: enumOf("Jump", "Sneak"), InputMode: enumOf("Gamepad", "KeyboardAndMouse", "MotionController", "Touch"),
    SignSide: enumOf("Front", "Back"), DyeColor: new Proxy({}, { get: (_, k) => String(k) }),
    EntityInitializationCause: enumOf("Born", "Event", "Loaded", "Spawned", "Transformed"),
    EntityComponentTypes: new Proxy({}, { get: (_, k) => `minecraft:${String(k).replace(/[A-Z]/g, (c, i) => (i ? "_" : "") + c.toLowerCase())}` }),
    BlockVolume: class { constructor(from, to) { this.from = from; this.to = to; } getMin() { return { x: Math.min(this.from.x, this.to.x), y: Math.min(this.from.y, this.to.y), z: Math.min(this.from.z, this.to.z) }; } getMax() { return { x: Math.max(this.from.x, this.to.x), y: Math.max(this.from.y, this.to.y), z: Math.max(this.from.z, this.to.z) }; } getCapacity() { const a = this.getMin(), b = this.getMax(); return (b.x - a.x + 1) * (b.y - a.y + 1) * (b.z - a.z + 1); } },
    ActionFormData: formClass("action"), MessageFormData: formClass("message"), ModalFormData: formClass("modal"),
    FormCancelationReason: enumOf("UserBusy", "UserClosed"), FormRejectReason: enumOf("MalformedResponse", "PlayerQuit", "ServerShutdown"),
    uiManager: { closeAllForms() {} },
  };
  const lookup = (name) => (name in known ? known[name] : (miss(`import ${name}`), stub(name)));

  // ---------- AI, movement and physics ----------
  const ai = createAi({
    blocks, permAt, entities: allEntities, isPlayer: (e) => e instanceof Player,
    damage, heal, spawn: (type, loc) => spawn(getDimension("overworld"), type, loc).__e, remove: removeEntity,
    setBlock: (x, y, z, id, states) => setBlockAt(getDimension("overworld"), x, y, z, intern(id, states ?? {})),
    fire: { hitEntity: (a, b) => worldAfter.entityHitEntity.fire({ damagingEntity: a.api, hitEntity: b.api }, entityMatch(a)), projectileHitEntity: (p, by, hit) => worldAfter.projectileHitEntity.fire({ projectile: p.api, source: by?.api, dimension: getDimension("overworld"), location: p.location, hitVector: { ...p.vel }, getEntityHit: () => ({ entity: hit.api }) }), projectileHitBlock: (p, by, at) => worldAfter.projectileHitBlock.fire({ projectile: p.api, source: by?.api, dimension: getDimension("overworld"), location: p.location, hitVector: { ...p.vel }, getBlockHit: () => ({ block: getDimension("overworld").getBlock(at), face: "Up", faceLocation: { x: 0.5, y: 0.5, z: 0.5 } }) }) },
    now: () => tick, hud,
  });
  ai.setDefs((id) => ENTITIES[fullId(id)]?.components);

  // ---------- the tick ----------
  function tickOnce() {
    tick++; worldTime++;
    // timers due this tick, in the order they were made
    for (const [id, t] of [...timers]) {
      if (t.at > tick || !timers.has(id)) continue;
      if (t.every) t.at = tick + t.every; else timers.delete(id);
      call(t.fn, undefined, "timer");
      flush();
    }
    // jobs: each gets a little work a tick, like the game's watchdog-friendly runJob
    const t0 = now();
    for (const [id, gen] of [...jobs]) {
      let steps = 0;
      try {
        for (;;) { const r = gen.next(); if (r.done) { jobs.delete(id); break; } if (++steps >= 400 || now() - t0 > 4) break; }
      } catch (e) { jobs.delete(id); diag.errors.push(`job: ${e?.stack?.split("\n").slice(0, 3).join(" | ") ?? e}`); }
      flush();
    }
    for (const e of allEntities.values()) {
      if (e.removed) continue;
      for (const [id, ef] of e.effects) {
        if (ef.until <= tick) { e.effects.delete(id); if (id === "health_boost" && e.health > e.effectiveMax) e.health = e.effectiveMax; continue; }
        if (id === "regeneration" && e.alive && tick % Math.max(1, 50 >> ef.amplifier) === 0) heal(e, 1);
        if (id === "poison" && e.alive && e.health > 1 && tick % Math.max(1, 25 >> ef.amplifier) === 0) damage(e, 1, { cause: "magic" });
        if (id === "wither" && e.alive && tick % Math.max(1, 40 >> ef.amplifier) === 0) damage(e, 1, { cause: "wither" });
      }
    }
    ai.tick();
    flush();
    if (fires.size && tick % 20 === 0) for (const [k, until] of fires) {
      if (until > tick) continue;
      fires.delete(k);
      const [x, y, z] = k.split(",").map(Number);
      if (blocks.inside(x, y, z) && permAt(blocks.get(x, y, z)).typeId === "minecraft:fire") setBlockAt(getDimension("overworld"), x, y, z, intern(AIR, {}));
    }
  }
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  return {
    lookup, world, system, diag, ai,
    BlockPermutation, ItemStack, permAt, intern,
    get now() { return tick; },
    get time() { return worldTime; },
    set time(v) { worldTime = v; },
    get player() { return player0; },
    entities: allEntities,
    scoreboard: { objectives, display },
    // Call once the game bundle has loaded: ends "early execution", fires startup and world load, puts the player in
    start({ playerAt, name = "You", gameMode = "Creative", time = 13000 } = {}) {
      early = false; worldTime = time;
      const registry = loose({ blockComponentRegistry: { registerCustomComponent() {} }, itemComponentRegistry: { registerCustomComponent() {} }, customCommandRegistry: { registerCommand(def, fn) { commands.set(def.name, { def, fn }); }, registerEnum() {} }, dimensionRegistry: { registerCustomDimension() {} } }, "startup");
      systemBefore.startup.fire(registry);
      worldBefore.worldInitialize.fire(registry);
      worldAfter.worldLoad.fire({}); worldAfter.worldInitialize.fire({});
      flush();
      const dim = getDimension("overworld");
      player0Spawn = { ...playerAt };
      const p = new Player(dim, playerAt, name);
      p.api = loose(p, "Player"); p.__e = p; p.mode = gameMode;
      player0 = p; players.push(p); allEntities.set(p.id, p);
      worldAfter.playerJoin.fire({ playerId: p.id, playerName: p.name });
      worldAfter.playerSpawn.fire({ player: p.api, initialSpawn: true });
      flush();
      return p.api;
    },
    tick: tickOnce,
    flush,
    spawn: (type, loc, opts) => spawn(getDimension("overworld"), type, loc, opts),
    runCommand: (cmd) => { const r = runCommand(getDimension("overworld"), cmd, player0); flush(); return r; },
    // /scriptevent from the page's console
    scriptEvent(id, message = "") { systemAfter.scriptEventReceive.fire({ id, message, sourceType: "Entity", sourceEntity: player0?.api }); flush(); },
    commands,
    rawText,
  };
}
