// Town events and settler requests, as plain functions (no game imports, so Node tests them).
// Words and numbers: events_data.js. Game side: events.js.
//
//   townFacts: { tier, counts: { buildingId: n }, settlers, freeBeds, lord }   what a town has right now
//   meets(needs, facts) -> bool                 does the town have what an event or request needs
//   eventsFor(facts) / requestsFor(facts)       the ids that could happen in this town now (the rest are excluded)
//   gap([min, max], rng) -> whole days          the wait before the next one
//   quietDay(day, { siegeTonight, lastSiege })  no new event tonight or the day after a siege
//   buildDone(req, baseline, counts) -> bool    a build request: one more of its buildings stands than when asked
//   fill(text, words) -> text                   {town}, {a}, ... replaced

import { EVENTS, TOWN_EVENTS, REQUESTS } from "./events_data.js";

export function meets(needs = {}, f) {
  if (needs.settlers && (f.settlers ?? 0) < needs.settlers) return false;
  if (needs.freeBeds && (f.freeBeds ?? 0) < needs.freeBeds) return false;
  if (needs.anyOf && !needs.anyOf.some((id) => (f.counts?.[id] ?? 0) > 0)) return false;
  return true;
}

export const eventsFor = (f) => TOWN_EVENTS.filter((e) => (!f.lord || e.lord) && meets(e.needs, f)).map((e) => e.id);

// Requests only come in players' towns. A build request asks for something the town is allowed to raise by now.
export const requestsFor = (f, opensAt = () => 0) => (f.lord ? [] : REQUESTS.filter((r) => (f.tier ?? 0) >= r.from && meets(r.needs, f)
  && (r.type !== "build" || r.ids.some((id) => opensAt(id) <= (f.tier ?? 0)))
  && (r.type !== "bed" || (f.settlers ?? 0) > 0)).map((r) => r.id));

export const gap = ([min, max], rng = Math.random) => min + Math.floor(rng() * (max - min + 1));

export const quietDay = (day, { siegeTonight = false, lastSiege = -99 } = {}) => siegeTonight || day - lastSiege <= EVENTS.quietAfterSiege;

export const buildDone = (req, baseline = {}, counts = {}) => req.ids.reduce((n, id) => n + (counts[id] ?? 0), 0) > req.ids.reduce((n, id) => n + (baseline[id] ?? 0), 0);

export const fill = (text, words = {}) => text.replace(/\{(\w+)\}/g, (m, k) => (words[k] !== undefined ? String(words[k]) : m));

export const eventById = (id) => TOWN_EVENTS.find((e) => e.id === id);
export const requestById = (id) => REQUESTS.find((r) => r.id === id);
