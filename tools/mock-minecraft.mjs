// A fake @minecraft/server for loading the scripts in Node. It knows the pack's own block, item and
// entity ids, has an empty world (no players, no entities, no blocks loaded), and answers anything
// else with a harmless do-nothing object.

export function makeMock(pack) {
  const subscriptions = []; // { path, fn }
  const intervals = []; // { fn, ticks }
  const props = new Map();
  let tick = 0;

  // Anything you call, construct or read from returns another stub
  const stub = (label) => {
    const fn = function () {};
    return new Proxy(fn, {
      get(_, key) {
        if (key === "then") return undefined;
        if (key === Symbol.toPrimitive) return () => 0;
        if (key === Symbol.iterator) return function* () {};
        if (key === "toString") return () => `[stub ${label}]`;
        return stub(`${label}.${String(key)}`);
      },
      apply: () => stub(`${label}()`),
      construct: () => stub(`new ${label}`),
    });
  };

  const signals = (path) => new Proxy({}, {
    get(_, name) {
      return {
        subscribe(fn) {
          subscriptions.push({ path: `${path}.${String(name)}`, fn });
          return fn;
        },
        unsubscribe() {},
      };
    },
  });

  const dimension = (id) => ({
    id,
    getEntities: () => [],
    getPlayers: () => [],
    getBlock: () => undefined,
    getTopmostBlock: () => undefined,
    getBlockFromRay: () => undefined,
    spawnEntity: () => stub("entity"),
    spawnItem: () => stub("item"),
    spawnParticle() {},
    playSound() {},
    runCommand: () => ({ successCount: 0 }),
    createExplosion() {},
  });
  const dims = new Map();

  const world = {
    afterEvents: signals("world.afterEvents"),
    beforeEvents: signals("world.beforeEvents"),
    getDynamicProperty: (k) => props.get(k),
    setDynamicProperty: (k, v) => (v === undefined ? props.delete(k) : props.set(k, v)),
    getDynamicPropertyIds: () => [...props.keys()],
    getPlayers: () => [],
    getAllPlayers: () => [],
    getDimension: (id) => {
      const key = id.includes(":") ? id : `minecraft:${id}`;
      if (!dims.has(key)) dims.set(key, dimension(key));
      return dims.get(key);
    },
    getDay: () => 7,
    getTimeOfDay: () => 6000,
    getAbsoluteTime: () => 6000,
    sendMessage() {},
    scoreboard: {
      getObjective: () => undefined,
      getObjectives: () => [],
      addObjective: () => stub("objective"),
      removeObjective() {},
      setObjectiveAtDisplaySlot() {},
    },
  };

  let runId = 0;
  const system = {
    get currentTick() { return tick; },
    afterEvents: signals("system.afterEvents"),
    beforeEvents: signals("system.beforeEvents"),
    runInterval(fn, ticks = 1) { intervals.push({ fn, ticks }); return ++runId; },
    runTimeout() { return ++runId; },
    run() { return ++runId; },
    runJob() { return ++runId; },
    clearRun() {},
  };

  const typeList = (ids) => ({
    get: (id) => (ids.has(id) || id.startsWith("minecraft:") ? { id } : undefined),
    getAll: () => [...ids].map((id) => ({ id })),
  });

  class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.nameTag = undefined; this._lore = []; }
    getLore() { return this._lore; }
    setLore(l) { this._lore = l ?? []; }
    getComponent() { return undefined; }
  }
  class MolangVariableMap { setColorRGB() {} setFloat() {} setVector3() {} }

  // Bedrock refuses native calls while the scripts are first loading ("early execution"), and one throw there
  // stops the whole pack. check.mjs clears `early` once the import is done.
  const state = { early: true };
  const native = (name, fn) => (...args) => {
    if (state.early) throw new ReferenceError(`Native function [${name}] cannot be used in early execution.`);
    return fn(...args);
  };
  const BlockPermutation = { resolve: native("BlockPermutation::resolve", (id) => stub(`BlockPermutation(${id})`)) };

  const enumOf = (...names) => Object.fromEntries(names.map((n) => [n, n]));
  const known = {
    world,
    system,
    ItemStack,
    MolangVariableMap,
    BlockPermutation,
    BlockTypes: typeList(pack.blocks),
    EntityTypes: typeList(pack.entities),
    ItemTypes: typeList(new Set([...pack.items, ...pack.blocks])),
    EntityDamageCause: new Proxy({}, { get: (_, k) => String(k) }),
    EquipmentSlot: enumOf("Head", "Chest", "Legs", "Feet", "Mainhand", "Offhand"),
    GameMode: enumOf("Survival", "Creative", "Adventure", "Spectator"),
    DisplaySlotId: enumOf("Sidebar", "List", "BelowName"),
    ActionFormData: class { title() { return this; } body() { return this; } button() { return this; } show() { return Promise.resolve({ canceled: true }); } },
    MessageFormData: class { title() { return this; } body() { return this; } button1() { return this; } button2() { return this; } show() { return Promise.resolve({ canceled: true }); } },
    ModalFormData: class { title() { return this; } textField() { return this; } toggle() { return this; } slider() { return this; } dropdown() { return this; } submitButton() { return this; } show() { return Promise.resolve({ canceled: true }); } },
  };

  return {
    endEarly() { state.early = false; },
    lookup: (name) => (name in known ? known[name] : stub(name)),
    subscriptions,
    intervals,
    props,
    advance(n) { tick += n; },
  };
}
