// Line trains: the trains that run each laid line on their own, end to end and back, calling at every stop.
// This file is the pure part (no Minecraft imports, so it loads in Node tests): which way a line's train runs,
// where it is while nobody is near enough to see it, and how it drives when it is really there.
//
// chain: { line, stops: [stop ids in order], path: [{ x, y, z }, ...], at: [index into path of each stop] }
// service: { pos (index along path of the middle of the train), dir (1 or -1 along path), dwell (ticks left) }

export const LINE = {
  cruise: 0.8, // blocks a tick (16 a second): half an engine's top speed
  dwell: 400, // ticks it stands at each stop (20 seconds)
  cars: ["engine", "coach", "coach"],
  wake: 48, // a player this near to where it would be: the real train appears
  sleep: 80, // nobody this near for `sleepAfter` ticks: it is put away and runs unseen again
  sleepAfter: 200,
  brake: 0.04, // must match TRAIN.brake
  stuckTicks: 40, // standing this long short of a stop it can't quite reach (end of the track) counts as arrived
};

// The laid stretches of each line, joined into the longest unbroken run: [chain, ...]
export function chainsOf(data, built) {
  const byLine = new Map();
  for (const seg of data.segments) if (built[seg.id]) (byLine.get(seg.line ?? "line") ?? byLine.set(seg.line ?? "line", []).get(seg.line ?? "line")).push(seg);
  const out = [];
  for (const [line, segs] of byLine) {
    const ends = new Set(segs.flatMap((s) => [s.from, s.to]));
    let best;
    for (const start of ends) {
      const used = new Set(), stops = [start], legs = [];
      for (let at = start; ;) {
        const seg = segs.find((s) => !used.has(s.id) && (s.from === at || s.to === at));
        if (!seg) break;
        used.add(seg.id);
        legs.push({ seg, forward: seg.from === at });
        at = seg.from === at ? seg.to : seg.from;
        stops.push(at);
      }
      if (!best || legs.length > best.legs.length) best = { stops, legs };
    }
    if (!best?.legs.length) continue;
    const path = [], at = [0];
    for (const { seg, forward } of best.legs) {
      const blocks = forward ? seg.blocks : [...seg.blocks].reverse();
      for (const [x, y, z] of blocks) {
        const last = path[path.length - 1];
        if (!last || last.x !== x || last.y !== y || last.z !== z) path.push({ x, y, z });
      }
      at.push(path.length - 1);
    }
    out.push({ line, stops: best.stops, path, at });
  }
  return out;
}

// The next stop along the way from `pos`: its number in chain.stops, or -1 at the end of the line
export function nextStop(chain, pos, dir) {
  if (dir > 0) return chain.at.findIndex((i) => i > pos + 1);
  for (let k = chain.at.length - 1; k >= 0; k--) if (chain.at[k] < pos - 1) return k;
  return -1;
}

// A fresh service: standing at the first stop
export const newService = () => ({ pos: 0, dir: 1, dwell: LINE.dwell });

// Move an unseen train on by `dt` ticks
export function stepUnseen(svc, chain, dt) {
  if (svc.dwell > 0) { svc.dwell = Math.max(0, svc.dwell - dt); return svc; }
  let k = nextStop(chain, svc.pos, svc.dir);
  if (k < 0) { svc.dir = -svc.dir; k = nextStop(chain, svc.pos, svc.dir); }
  if (k < 0) return svc;
  const target = chain.at[k], move = LINE.cruise * dt;
  if (Math.abs(target - svc.pos) <= move) {
    svc.pos = target;
    svc.dwell = LINE.dwell;
    if (k === 0 || k === chain.at.length - 1) svc.dir = k === 0 ? 1 : -1;
  } else svc.pos += svc.dir * move;
  return svc;
}

// Which path index (x, z) is nearest to, looking `reach` either side of a guess
export function indexNear(chain, guess, x, z, reach = 48) {
  const g = Math.max(0, Math.min(chain.path.length - 1, Math.round(guess)));
  let best = g, bestD = Infinity;
  for (let i = Math.max(0, g - reach); i <= Math.min(chain.path.length - 1, g + reach); i++) {
    const d = Math.abs(chain.path[i].x - x) + Math.abs(chain.path[i].z - z);
    if (d < bestD) { best = i; bestD = d; }
  }
  return best;
}

// One tick of driving the real train. `pos` is where its middle is (path index), `v` how fast it is going (blocks a
// tick, either way). Changes svc (dwell, dir, stuck) and returns { dir, throttle (1 go, 0 hold), limit, arrived }:
// arrived is the stop number the tick it gets there.
export function pilot(svc, chain, pos, v) {
  svc.pos = pos;
  if (svc.dwell > 0) { svc.dwell--; svc.stuck = 0; return { dir: svc.dir, throttle: 0, limit: 0 }; }
  let k = nextStop(chain, pos, svc.dir);
  if (k < 0) { svc.dir = -svc.dir; k = nextStop(chain, pos, svc.dir); }
  if (k < 0) return { dir: svc.dir, throttle: 0, limit: 0 };
  const d = (chain.at[k] - pos) * svc.dir;
  svc.stuck = Math.abs(v) < 0.01 ? (svc.stuck ?? 0) + 1 : 0;
  if (svc.stuck > LINE.stuckTicks * 5) { svc.dir = -svc.dir; svc.stuck = 0; return { dir: svc.dir, throttle: 0, limit: 0 }; } // the track ends short of the stop (still being laid): turn back
  if (d <= 1.5 || (d <= 16 && svc.stuck > LINE.stuckTicks)) {
    svc.dwell = LINE.dwell;
    svc.stuck = 0;
    if (k === 0 || k === chain.at.length - 1) svc.dir = k === 0 ? 1 : -1;
    return { dir: svc.dir, throttle: 0, limit: 0, arrived: k };
  }
  return { dir: svc.dir, throttle: 1, limit: Math.min(LINE.cruise, Math.sqrt(2 * LINE.brake * Math.max(0, d - 1)) * 0.9 + 0.03) };
}
