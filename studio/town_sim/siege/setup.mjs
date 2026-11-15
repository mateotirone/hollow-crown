// Sets the table for a siege night in the simulator: a settlement that already stands, as the game would have it
// saved, using the game's own functions (the same ones /scriptevent siege:battle_test uses). Shared by the page and
// the Node self-test.
//
//   const sim = prepare({ mc, G, town });   // keep, wall record, town record, guards, ballistas
//   (town.wait: tick while sim.watchRising(), then sim.garrison(), so the guards find the watchtowers standing)
//   sim.begin({ provoked });                // the War Horn (provoked) or nightfall
//   sim.status()                            // { active, wave, waves, raiders, keep, keepMax, guards, outcome }
//
// town: { owner, name, keep: {x,y,z}, tier 0..3, sieges, wall?: {…the game's wall record…} | null,
//         townRecord?, hall?, plotName?, plotAt?, barracks?: [{x,y,z}], guards: [{ type, armor, post: "wall"|"barracks" }], ballistas: n }

const TIERS = [{ name: "Hamlet", wins: 0, warlords: 0 }, { name: "Town", wins: 3, warlords: 0 }, { name: "City", wins: 6, warlords: 0 }, { name: "Castle", wins: 10, warlords: 2 }];

export function prepare({ mc, G, town, log = () => {} }) {
  const owner = town.owner ?? mc.player.id;
  const state = G.api.getState();
  const dim = mc.world.getDimension("overworld");
  const C = G.constants;
  const outcome = { ended: false };
  let keepFull = 0; // the Keep's health when first seen: the game sets it by the town's size

  // the Keep Banner and the settlement's record
  const k = town.keep;
  const banner = dim.getBlock(k);
  banner.setType(C.KEEP_BANNER);
  try { banner.setPermutation(banner.permutation.withState("siege:color", town.color ?? 14)); } catch { /* an older banner without colours */ }
  const T = TIERS[town.tier ?? 0];
  state.keeps[owner] = { x: k.x, y: k.y, z: k.z, name: town.name ?? mc.player.name, color: town.color ?? 14, wins: T.wins, warlordsSlain: T.warlords, tier: T.name, sieges: town.sieges ?? 0, streak: 0, allies: [] };
  state.guards[owner] = 0;
  G.state.saveState();

  // the map plot, the town and its wall, as saved by the game
  if (town.plotName && G.claims?.registerPlot) { try { G.claims.registerPlot(town.plotName, town.plotAt ?? { x: k.x, y: k.y - 1, z: k.z }); } catch (e) { log(`plot: ${e}`); } }
  if (town.townRecord && G.founding?.allTowns) { G.founding.allTowns()[owner] = town.townRecord; G.founding.saveTowns(); }
  if (town.wall) {
    G.walls.setWallRecord(owner, { best: town.wall.level, ...town.wall });
    try { G.walls.raiseWatch?.(owner); } catch (e) { log(`watchtowers: ${e}`); }
  }
  for (const b of town.barracks ?? []) G.state.trackMachine("minecraft:overworld", b, C.BARRACKS);

  // soldiers: enlisted, dressed and stationed by the game's own code
  const home = town.barracks?.[0] ?? { x: k.x, y: k.y, z: k.z + 3 };
  const guards = [];
  function addGuard(type, armor = 0, post = "wall", n = guards.length) {
    const ring = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2], [3, 1], [-3, 1], [1, 3], [1, -3]];
    const [dx, dz] = ring[n % ring.length];
    const top = dim.getTopmostBlock({ x: home.x + dx, z: home.z + dz });
    const at = { x: home.x + dx + 0.5, y: standNear(home.x + dx, home.y, home.z + dz) ?? (top ? top.y + 1 : home.y), z: home.z + dz + 0.5 };
    const g = dim.spawnEntity(type, at);
    G.guards.enlist(g, owner, home);
    g.setDynamicProperty("siege:barracks", JSON.stringify(home));
    try { G.armoury?.dressForType(g, owner); G.region?.dressRegion(g, owner); } catch (e) { log(`dress: ${e}`); }
    G.guards.equipGuard(g, armor);
    state.guards[owner] = (state.guards[owner] ?? 0) + 1;
    if (post === "wall") { try { const p = G.guardposts.emptyPost(owner); if (p) G.guardposts.station(g, owner, p); } catch (e) { log(`station: ${e}`); } }
    guards.push(g);
    return g;
  }
  function standNear(x, y, z) { for (const dy of [0, 1, -1, 2, -2, 3, -3]) if (!Number.isNaN(mc.ai.stand(x, y + dy, z, 1.9))) return y + dy; return undefined; }

  // ballistas: on free wall posts nearest the gate (a player sets them where they like; this is a fair default)
  const ballistas = [];
  // The garrison takes its posts once the wall's watchtowers stand (town.wait: the caller ticks the game until they
  // do, then calls garrison() itself)
  function garrison() {
    for (const g of town.guards ?? []) { try { addGuard(g.type, g.armor, g.post); } catch (e) { log(`guard ${g.type}: ${e}`); } }
    if (!town.ballistas) return;
    let spots = [];
    try {
      const gate = G.walls.wallRing(owner)?.gate ?? k;
      spots = G.guardposts.sitesFor(owner, true).filter((s) => s.wall).flatMap((s) => s.posts).map((p) => ({ p, y: standNear(p.x, p.from ?? k.y + 6, p.z) ?? topStand(p.x, p.z) }))
        .filter((s) => s.y !== undefined).sort((a, b) => Math.hypot(a.p.x - gate.x, a.p.z - gate.z) - Math.hypot(b.p.x - gate.x, b.p.z - gate.z));
    } catch (e) { log(`ballista spots: ${e}`); }
    const taken = new Set(guards.map((g) => { try { const p = JSON.parse(g.getDynamicProperty("siege:post")); return `${Math.floor(p.x)},${Math.floor(p.z)}`; } catch { return ""; } }));
    spots = spots.filter((s) => !taken.has(`${s.p.x},${s.p.z}`));
    for (let i = 0; i < town.ballistas; i++) {
      const s = spots[i * 2] ?? spots[i];
      const at = s ? { x: s.p.x + 0.5, y: s.y, z: s.p.z + 0.5 } : { x: k.x + 0.5 + (i % 2 ? 3 : -3), y: k.y, z: k.z + 0.5 + (i > 1 ? 3 : -3) };
      try { const e = dim.spawnEntity(C.BALLISTA, at); e.setDynamicProperty("siege:owner", owner); ballistas.push(e); } catch (err) { log(`ballista: ${err}`); }
    }
  }
  function topStand(x, z) { const t = dim.getTopmostBlock({ x, z }); return t ? t.y + 1 : undefined; }
  if (!town.wait) garrison();
  const watchRising = () => { try { const w = G.walls.wallOf?.(owner); return !!w && (G.walls.wallRising?.(owner) || (w.watch ?? []).some((t) => !t.built)); } catch { return false; } };

  G.events.on?.("siegeEnd", (e) => { outcome.ended = true; outcome.result = state.fallen?.includes(owner) || outcome.fell ? "lost" : e.outcome; });
  G.events.on?.("keepFallen", (e) => { if (e.owner === owner) outcome.fell = true; });

  return {
    owner, guards, ballistas, outcome, addGuard, garrison, watchRising,
    begin({ provoked = false } = {}) { G.siege.startSiege(provoked ? owner : undefined); mc.flush(); },
    status() {
      const hearts = dim.getEntities({ type: C.KEEP_HEART });
      const hp = hearts[0]?.getComponent("minecraft:health");
      return {
        active: !!state.active, waves: state.assaultsTotal ?? 0, wave: (state.assaultsTotal ?? 0) - (state.assaultsLeft ?? 0),
        raiders: dim.getEntities({ tags: [C.RAIDER_TAG] }).length, keep: hp ? Math.ceil(hp.currentValue) : undefined, keepMax: hp ? (keepFull = Math.max(keepFull, Math.ceil(hp.currentValue))) : undefined,
        guards: dim.getEntities({ tags: [G.guards.guardTag(owner)] }).length, plan: state.plans?.[owner], ...outcome,
      };
    },
  };
}
