// Siege nights for the town simulator, played by the game's own siege code (siege/siege.js startSiege and
// spawnAssault, siege/warplan.js planSiege and buyArmy, the reach feature's wave counts and shares, the bestiary's
// creature swaps, the settlement wall's spawn distance). The fake Minecraft gets one player standing on the Plot
// Stone, a Keep Banner there, the town's wall record, and ballistas where a preset puts them. Every creature the
// game spawns is written down with where it appeared. Math.random is seeded, so the page shows the same night
// every time for the same choices.
//
// runSieges(ctx) -> { presets, nights: { "<siege>|<tier>|<preset>": night } }
//   night = { faction, budget, modifiers: [{ name, note }], warlord, grand, counterNote, sides: [angle],
//             waves: [[{ type, name, kind, x, z }]] }   (x, z relative to the Plot Stone)

const OWNER = "sim_player";

export const PRESETS = [
  { id: "none", label: "No defences", guards: 0, ballistas: [] },
  { id: "some", label: "Half the guards, 2 ballistas at the gate", guards: 0.5, ballistas: ["gate", "gate"] },
  { id: "full", label: "Every guard, a ballista on each side", guards: 1, ballistas: ["gate", "left", "back", "right"] },
];

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Anything the code reads off a fake object it doesn't know answers with a harmless function
const loose = (base) => new Proxy(base, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === "then") return undefined;
    return loose(function () { return undefined; });
  },
  apply: () => undefined,
});

export async function runSieges({ imp, mock, CX, CZ, BASE, gateAngle, radii, homes, wallLevels, outline, siegeCount = 12 }) {
  const world = mock.lookup("world");
  const S = await imp("siege/state.js"); // `state` is a live binding, set by loadState
  S.loadState();
  const state = S.state;
  const { startSiege, spawnAssault, assaultsTotal } = await imp("siege/siege.js");
  const { FACTIONS, MODIFIERS } = await imp("siege/warplan.js");
  const { TIERS } = await imp("siege/territory.js");
  const { GUARD_LIMIT } = await imp("siege/guards.js");
  const { KEEP_BANNER, BALLISTA, RAM_TAG, SAPPER_TAG, WARLORD_TAG, KING_TAG } = await imp("siege/constants.js");
  const { setWallRecord } = await imp("settle/walls.js");

  const keepAt = { x: CX, y: BASE + 1, z: CZ };
  const player = loose({
    id: OWNER, name: "You", location: { ...keepAt }, isValid: true,
    dimension: world.getDimension("overworld"),
    sendMessage() {}, playSound() {}, getTags: () => [], hasTag: () => false,
    onScreenDisplay: loose({ setTitle() {}, setActionBar() {}, updateSubtitle() {} }),
  });
  world.getPlayers = () => [player];
  world.getAllPlayers = () => [player];

  const ow = world.getDimension("overworld");
  let spawned = [], ballistas = [], villagers = [];
  ow.getBlock = (at) => (at && Math.floor(at.x) === keepAt.x && Math.floor(at.y) === keepAt.y && Math.floor(at.z) === keepAt.z
    ? loose({ typeId: KEEP_BANNER, location: { ...keepAt }, permutation: loose({}) }) : undefined);
  ow.getEntities = (q = {}) => (q.type === BALLISTA ? ballistas : q.type === "minecraft:villager_v2" ? villagers : []);
  ow.getPlayers = () => [player];
  ow.spawnEntity = (type, at) => {
    const e = { type, x: at.x, z: at.z, tags: [], name: undefined };
    spawned.push(e);
    return loose({
      typeId: type, location: { ...at }, isValid: true,
      addTag(t) { e.tags.push(t); return true; }, getTags: () => e.tags, hasTag: (t) => e.tags.includes(t),
      set nameTag(n) { e.name = n; }, get nameTag() { return e.name; },
      addEffect() {}, remove() {}, teleport() {}, triggerEvent() {}, setProperty() {}, getComponent: () => undefined,
    });
  };

  // where a preset's ballistas stand: on the wall line, at the gate, to its left, behind and to its right
  const sideAngle = { gate: gateAngle, left: gateAngle + Math.PI / 2, back: gateAngle + Math.PI, right: gateAngle - Math.PI / 2 };
  const nights = {};
  const realRandom = Math.random;
  try {
    for (let tier = 0; tier < 4; tier++) {
      const r = radii[tier];
      for (const preset of PRESETS) {
        for (let n = 1; n <= siegeCount; n++) {
          Math.random = seeded(n * 1000 + tier * 100 + PRESETS.indexOf(preset));
          state.active = false;
          state.keeps = {
            [OWNER]: { ...keepAt, name: "Your town", sieges: n - 1, wins: Math.max(TIERS[tier].wins, 0), warlordsSlain: tier === 3 ? 2 : 0, streak: 0, tier: TIERS[tier].name },
          };
          state.guards = { [OWNER]: Math.round((GUARD_LIMIT[TIERS[tier].name] ?? 4) * preset.guards) };
          state.plans = {}; state.kills = {};
          setWallRecord(OWNER, { level: wallLevels[tier], radius: r, cx: CX, cz: CZ, y: BASE, ...(outline ? { radii: outline.radii, radiiAt: outline.radiiAt } : {}) });
          ballistas = preset.ballistas.map((s, i) => loose({ typeId: BALLISTA, location: { x: CX + Math.cos(sideAngle[s] + i * 0.15) * (r - 3), y: BASE + 1, z: CZ + Math.sin(sideAngle[s] + i * 0.15) * (r - 3) } }));
          villagers = Array.from({ length: homes[tier] }, () => loose({ typeId: "minecraft:villager_v2" }));
          spawned = [];
          startSiege(undefined);
          const plan = state.plans[OWNER];
          const waves = [];
          const total = assaultsTotal();
          for (let w = 0; w < total && w < 8; w++) {
            spawned = [];
            spawnAssault();
            waves.push(spawned.filter((e) => e.type !== "siege:keep_heart").map((e) => ({
              type: e.type, name: e.name?.replace(/§./g, "") ?? null,
              kind: e.tags.includes(KING_TAG) || e.tags.includes(WARLORD_TAG) ? "warlord" : e.tags.includes(RAM_TAG) ? "ram" : e.tags.includes(SAPPER_TAG) ? "sapper" : "raider",
              x: Math.round(e.x - CX), z: Math.round(e.z - CZ),
            })));
          }
          state.active = false;
          nights[`${n}|${tier}|${preset.id}`] = plan && {
            faction: FACTIONS[plan.faction]?.name ?? plan.faction, budget: plan.budget, grand: !!plan.grand, warlord: plan.warlord ?? null,
            counterNote: plan.counterNote ?? null, sides: plan.sides,
            modifiers: (plan.modifiers ?? []).map((m) => ({ name: MODIFIERS[m]?.name ?? m, note: MODIFIERS[m]?.note ?? "" })),
            waves,
          };
        }
      }
    }
  } finally {
    Math.random = realRandom;
  }
  return { presets: PRESETS.map(({ id, label }) => ({ id, label })), nights };
}
