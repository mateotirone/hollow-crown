// Where the Span and Goody Sedge's graves are (world store "siege:role_marks").
// spans: [{ dim, start, end, showcase?, site? }]   graves: [{ dim, at, showcase?, site? }]   pending: player id -> a Span start
// They come from the landmarks that hold them (the Cinder Roost's Span, Goody Sedge's graves near Mirelight): the
// landmark builder sends "landmarkRoleMarks" once a site is built. A builder can still mark more by hand
// (/scriptevent siege:role_mark). A grave keeps its place in the list, because trials remember graves by index.
import { moduleStore, on, addTests, assert, assertEqual } from "../siege/api.js";

export const marks = moduleStore("siege:role_marks", () => ({ spans: [], graves: [], pending: {} }));

const close = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 3 && Math.abs(a.y - b.y) < 4;

// Fold a built landmark's marks into the saved ones. Pure on `data`; returns true if anything changed.
export function takeSiteMarks(data, { site, dim, marks: list }) {
  let changed = false;
  const start = list.find((m) => m.kind === "span_start"), end = list.find((m) => m.kind === "span_end");
  if (start && end) {
    const old = data.spans.find((s) => s.site === site);
    if (old) {
      if (!close(old.start, start.at) || !close(old.end, end.at)) { Object.assign(old, { dim, start: start.at, end: end.at }); changed = true; }
    } else if (!data.spans.some((s) => s.dim === dim && close(s.start, start.at) && close(s.end, end.at))) {
      data.spans.push({ dim, start: start.at, end: end.at, site });
      changed = true;
    }
  }
  const graves = list.filter((m) => m.kind === "grave");
  const mine = data.graves.filter((g) => g.site === site);
  graves.forEach((g, i) => {
    if (mine[i]) {
      if (!close(mine[i].at, g.at)) { mine[i].at = g.at; mine[i].dim = dim; changed = true; }
    } else if (!data.graves.some((x) => x.dim === dim && close(x.at, g.at))) {
      data.graves.push({ dim, at: g.at, site });
      changed = true;
    }
  });
  return changed;
}

on("landmarkRoleMarks", (event) => {
  if (takeSiteMarks(marks.data, event)) marks.save();
});

addTests("roletrials", {
  "a landmark's Span and graves are kept once, and graves keep their places": () => {
    const data = { spans: [], graves: [{ dim: "o", at: { x: 500, y: 60, z: 500 } }], pending: {} };
    const at = (x) => ({ x, y: 64, z: 0 });
    const ev = { site: "g#0", dim: "o", marks: [{ kind: "grave", at: at(0) }, { kind: "grave", at: at(4) }, { kind: "grave", at: at(8) }, { kind: "span_start", at: at(20) }, { kind: "span_end", at: at(36) }] };
    assert(takeSiteMarks(data, ev));
    assertEqual(data.graves.length, 4);
    assertEqual(data.spans.length, 1);
    assert(!takeSiteMarks(data, ev), "built again in the same place changes nothing");
    const moved = { ...ev, marks: ev.marks.map((m) => ({ ...m, at: { ...m.at, z: 10 } })) };
    assert(takeSiteMarks(data, moved));
    assertEqual(data.graves.length, 4, "a moved site moves its graves, it does not add more");
    assertEqual(data.graves[1].at.z, 10);
    assertEqual(data.spans.length, 1);
  },
});
