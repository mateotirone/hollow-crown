// The Hollow Crown: lore. Lore Tomes, the Library (Archive Shelves), the Ledger of Whispers,
// the mysteries, and the story characters' conversations.
//
//   data/tomes_a.js, tomes_b.js, tomes_c.js   the 74 tomes
//   data/world.js                             collections, rewards, places, thin places, mysteries
//   data/dialogue.js                          what the characters say
//   LORE-BIBLE.md (in siege-nights/)          the whole truth, for the builder only
//
// What this feature announces (listen with on(...) from siege/api.js):
//   skillPoints      { player, amount, source, renown }   rewards (the town hall adds them)
//   loreTomeRead     { player, tome, total }
//   loreShelved      { player, owner, tome, total }
//   loreReward       { player, owner, kind: "col" | "mile", id }
//   loreThreadSolved { player, thread }
//   loreAllSolved    { player }                           every mystery solved (hidden third ending)
//   loreSourceNamed  { player, owner, site }              named the real thin place in a Library
//   loreSourceMisnamed { player, guess }
//   loreFlag         { player, flag }                     e.g. journal_read, true_name, lamp_out, aldous_ally, loremaster
// What it listens for:
//   loreSetFlag      { player, flag }                     another feature sets a story flag (the role trials do)
//   loreTalk         { player, npc, node, choice, next }
//   rivalLordVoices  { lords, tempers }                   names, temperaments and lines for the NPC lords (data/lords.js)
//   slip             { player, id, npc, returnTo, dimension, handled }   a Slip into the Hollow should happen now.
//                    The Undertow feature sets data.handled = true, does the glimpse, then emits slipEnded { player, id }.
// Per-player progress is the player dynamic property "hc:lore_progress" (JSON, see blankProgress).

import { addTests, assert, assertEqual } from "../siege/api.js";
import {
  TOMES, TOME, tomesOf, CLUE_THREADS, surveyLine, sitesMatching, encipher, mirror, pagesFor, normalize,
  answerIsRight, blankProgress, holds, startNode, addClues, libraryRank, THREAD, canAnswer,
  loadSaved, stampSaved, SAVE_VERSION,
} from "./logic.js";
import { COLLECTIONS, PLACES, SITE_IDS, THREADS, MILESTONES } from "./data/world.js";
import { NPCS } from "./data/dialogue.js";
import { JOURNAL, JOURNAL_CLUES } from "./data/journal.js";
import { POWERS, ARTS_BOOK } from "./data/powers.js";
import { CASES, TELLS } from "./data/returned.js";
import { SKILLS, ROLES } from "../townhall/skills.js";
import { ROLE_LORE, ROLE_LINES } from "./data/roles.js";
import { RIVAL_LORDS, LORD_TEMPERS, REGENT_VOICE, RUMOR_PARTS } from "./data/lords.js";
import "./player.js";
import "./reader.js";
import "./library.js";
import "./ledger.js";
import "./journal.js";
import "./voices.js";
import "./reveal.js";
import "./local.js";
import "./portraits.js";
import "./ravens.js";
import "./moondoors.js";
import "./corvin.js";
import "./glimpse.js";
import { PLOT_LORE, LOCAL_TOMES, LOCAL_THREADS } from "./data/plots.js";
import { PLOT_REGION, REGION_BOSS, BOSS_LEADS, REGIONAL_BOSSES, CONVERGE, fallenCount } from "./data/spine.js";
import { PLOT_PLAN } from "../plots/config.js";
import "./cases.js";
import "./singing.js";
import { REVEAL } from "./data/reveal.js";
import { ART_IDS, GATED } from "./arts.js";
import { BOSS_TOMES, MOB_TOMES } from "./caches.js";
import { dialogueProblems, SCRIPT_CLUES } from "./npcs.js";
import "./showcase.js";

addTests("lore", {
  "local lore: every one of the twelve plots has its past, three books and a mystery it can solve": () => {
    assertEqual(Object.keys(PLOT_LORE).sort(), PLOT_PLAN.map((p) => p.name).sort());
    assertEqual(LOCAL_TOMES.length, 36);
    for (const [name, plot] of Object.entries(PLOT_LORE)) {
      assert(plot.was.length > 80 && PLACES[plot.lead], `${name}: past and lead`);
      assertEqual(plot.tomes.length, 3);
      for (const t of plot.tomes) assert(t.pages.length >= 2 && t.pages.every((pg) => pg.length < 900), `${name}: ${t.title}`);
      assert(plot.mystery.accept.length && plot.mystery.clues.length === 3, name);
      // none of them gives the ending away
      for (const t of plot.tomes) assert(!/Morvane|Oswin/.test(t.pages.join(" ")), `${name}: ${t.title} names him`);
    }
    for (const t of LOCAL_THREADS) assert(answerIsRight(t, t.accept[0]) && !answerIsRight(t, "nobody"), t.id);
    assertEqual(new Set(LOCAL_TOMES.map((t) => t.title)).size, 36);
    assertEqual(TOMES.length, 74); // the local books never count toward the Unburned Library
  },
  "the reveal: the scene's line is the journal's own, and nobody names him before the fight": () => {
    assert(JOURNAL.entries.some((e) => e.text.includes(REVEAL.journalLine)), "the line must be word for word from the journal");
    for (const text of [REVEAL.journalLine, REVEAL.lookUp, REVEAL.bells, ...REVEAL.fall]) assert(!/Oswin|Morvane/.test(text), "the scene names nobody");
    assert(/Oswin/.test(REVEAL.lastPage.sign), "the last page is signed");
    // the three pieces and the man who lays them side by side
    const sets = (id) => new Set(NPCS.find((n) => n.id === id).nodes && Object.values(NPCS.find((n) => n.id === id).nodes).flatMap((node) => node.opts.flatMap((o) => o[2] ?? [])));
    assert(sets("cael").has("flag:heard_no_body") && sets("sigrun").has("flag:heard_named") && sets("mag").has("flag:heard_walked_in"));
    const npc = (id) => NPCS.find((n) => n.id === id);
    for (const id of ["sigrun", "mag", "sage"]) for (const [key, node] of Object.entries(npc(id).nodes)) assert(!/was (King )?Oswin|is (King )?Oswin/.test(node.text), `${id}.${key} says it too soon`);
    // only after he has fallen does anyone say it plainly
    assert(npc("cael").start.some(([conds, node]) => node === "plain" && conds.includes("flag:morvane_fallen")));
    assert(/Morvane was King Oswin/.test(npc("cael").nodes.plain.text));
  },
  "the hidden Returned: every case has an asker who can reach every one of its outcomes": () => {
    assertEqual(CASES.length, 4);
    for (const c of CASES) {
      const npc = NPCS.find((n) => n.id === c.asker);
      assert(npc, c.id);
      const set = new Set(Object.values(npc.nodes).flatMap((node) => node.opts.flatMap((o) => o[2] ?? [])).filter((e) => e.startsWith("flag:")).map((e) => e.slice(5)));
      for (const flag of Object.values(c.flags)) assert(set.has(flag), `${c.id}: nothing sets ${flag}`);
      for (const tell of [...c.show, ...(c.askerShows ?? [])]) assert(TELLS[tell], tell);
    }
    assert(CASES.some((c) => !c.returned), "some suspects must be innocent");
  },
  "every Sorcerer power has an origin and a page, and the book keeps the secrets": () => {
    const arcana = SKILLS.filter((s) => s.branch === "arcana").map((s) => s.id);
    assertEqual([...ART_IDS].sort(), [...arcana].sort());
    for (const id of ART_IDS) for (const key of ["tree", "art", "origin", "page", "known"]) assert(POWERS[id][key]?.length > 5, `${id}.${key}`);
    for (const id of Object.keys(GATED)) assert(POWERS[id], id);
    const shown = ARTS_BOOK.cover + ARTS_BOOK.intro + ARTS_BOOK.outro + ART_IDS.map((id) => POWERS[id].page + POWERS[id].known + POWERS[id].tree + POWERS[id].art).join(" ");
    for (const secret of ["Oswin", "Morvane", "Edda", "Hollow", "truce", "Crown"]) assert(!shown.includes(secret), `the book says "${secret}"`);
    for (const id of ART_IDS) if (POWERS[id].lead) assert(PLACES[POWERS[id].lead], id);
  },
  "twelve rival lords with full voices; the Hollow's NPC rulers never use a story name": () => {
    assertEqual(RIVAL_LORDS.length, 12);
    const keys = Object.keys(RIVAL_LORDS[0].lines);
    for (const lord of RIVAL_LORDS) {
      assert(LORD_TEMPERS[lord.temper], lord.id);
      assertEqual(Object.keys(lord.lines), keys, lord.id);
    }
    for (const name of REGENT_VOICE.names) for (const taken of ["Oswin", "Morvane", "Corvin", "Edda", "Aldric", "Maelis", "Vorlund"]) assert(!name.includes(taken), name);
    assert(REGENT_VOICE.lines.thief.length <= 40);
    for (const type of ["bounty", "camp", "rescue", "supply"]) assert(RUMOR_PARTS.reasons[type].length >= 3, type);
  },
  "the starting journal explains nothing: no names, no answers": () => {
    assertEqual(JOURNAL.entries.length, 12);
    const text = JOURNAL.entries.map((e) => e.date + " " + e.text).join(" ");
    for (const secret of ["Oswin", "Aldric", "the Hollow", "Hallowmere", "Hollowmere", "Morvane", "Choir", "3:17", "third night", "Edda", "truce"]) assert(!text.includes(secret), `journal says "${secret}"`);
    for (const clue of JOURNAL_CLUES) assert(CLUE_THREADS[clue], clue);
    assert(answerIsRight(THREAD.old_journal, "King Aldric"));
  },
  "74 tomes with unique ids, three pages or more each": () => {
    assertEqual(TOMES.length, 74);
    assertEqual(new Set(TOMES.map((t) => t.id)).size, 74);
    for (const t of TOMES) assert(t.pages.length >= 3 && t.title && t.author && t.where && t.hint, t.id);
  },
  "every collection has the tomes it says, numbered 1..n": () => {
    for (const col of COLLECTIONS) {
      assertEqual(tomesOf(col.id).map((t) => t.n), Array.from({ length: col.count }, (_, i) => i + 1), col.id);
    }
    assertEqual(COLLECTIONS.reduce((sum, c) => sum + c.count, 0), TOMES.length);
  },
  "every clue a tome gives belongs to a mystery, and every mystery clue can be found": () => {
    const given = new Set([...TOMES, ...LOCAL_TOMES].flatMap((t) => t.clues));
    for (const clue of given) assert(CLUE_THREADS[clue], `clue ${clue} is in no thread`);
    const fromTalk = new Set(NPCS.flatMap((n) => Object.values(n.nodes).flatMap((node) => node.opts.flatMap((o) => o[2] ?? []))).filter((e) => e.startsWith("clue:")).map((e) => e.slice(5)));
    for (const clue of Object.keys(CLUE_THREADS)) assert(given.has(clue) || fromTalk.has(clue) || SCRIPT_CLUES.includes(clue), `nothing gives clue ${clue}`);
    for (const t of THREADS) assert(Object.keys(t.clues).length >= t.need, `${t.id} needs more clues than exist`);
  },
  "every lead and dialogue effect points at something real": () => {
    for (const t of TOMES) for (const lead of t.leads) assert(PLACES[lead], `${t.id} leads to unknown ${lead}`);
    for (const npc of NPCS) for (const node of Object.values(npc.nodes)) for (const [, , effects = []] of node.opts) {
      for (const e of effects) {
        const [kind, value] = [e.slice(0, e.indexOf(":")), e.slice(e.indexOf(":") + 1)];
        if (kind === "tome") assert(TOME[value], `${npc.id}: unknown tome ${value}`);
        if (kind === "lead") assert(PLACES[value], `${npc.id}: unknown place ${value}`);
        if (kind === "clue") assert(CLUE_THREADS[value], `${npc.id}: unknown clue ${value}`);
      }
    }
    assertEqual(dialogueProblems(), []);
  },
  "the six field notes always single out the real thin place": () => {
    for (const real of SITE_IDS) {
      assertEqual(sitesMatching(real, [0, 1, 2, 3, 4, 5]), [real]);
      assert(sitesMatching(real, [0]).length > 1, "one note alone must not be enough");
      for (let n = 0; n < 6; n++) assert(surveyLine(real, n).length > 20);
    }
  },
  "survey pages change with the site; ciphers and mirror writing need the tools": () => {
    const note = TOME.surv_01;
    assert(pagesFor(note, "drowned_chapel")[1].includes("swim"));
    assert(pagesFor(note, "kings_barrow")[1].includes("dry boots"));
    const letter = TOME.lett_01;
    assert(pagesFor(letter, "kings_barrow", {})[0] !== letter.pages[0]);
    assertEqual(pagesFor(letter, "kings_barrow", { cipher: true })[0], letter.pages[0]);
    assertEqual(mirror(mirror("Hallowmere\nabc")), "Hallowmere\nabc");
    assert(encipher("Annet") !== "Annet" && encipher("Annet").length === 5);
  },
  "typed answers forgive case, spaces and punctuation": () => {
    assert(answerIsRight(THREAD.the_name, "  HollowMere. "));
    assert(answerIsRight(THREAD.stopped_clocks, "3:17"));
    assert(answerIsRight(THREAD.saint_ashe, "Princess Edda"));
    assert(!answerIsRight(THREAD.the_name, "Aldmere"));
    assert(answerIsRight(THREAD.missing_king, 4) && !answerIsRight(THREAD.missing_king, 0));
    assertEqual(normalize("3 : 17"), "317");
  },
  "conversations open where the player's progress says": () => {
    const wren = NPCS.find((n) => n.id === "wren");
    const p = blankProgress();
    assertEqual(startNode(wren, p, {}), "first");
    p.flags.push("wren_met");
    assertEqual(startNode(wren, p, {}), "hub");
    p.solved.push("lost_days");
    assertEqual(startNode(wren, p, {}), "after");
    assert(holds("path:marked", p, { path: "marked" }) && !holds("!flag:wren_met", p, {}));
    assertEqual(startNode(NPCS.find((n) => n.id === "sage"), blankProgress(), { shelved: 74 }), "all");
  },
  "the late truths can't be answered from early clues": () => {
    const p = blankProgress();
    addClues(p, ["missing_king_bargain", "third_night_no_bells", "truce_terms", "lost_wrong_hand_king", "truce_broken_order"]);
    assert(!canAnswer(p, THREAD.the_crown), "needs Edda's letter");
    addClues(p, ["truce_broken_edda"]);
    assert(canAnswer(p, THREAD.the_crown));
    addClues(p, ["leader_five_lords", "warlord_is_vorlund", "leader_unknown", "voice_in_rock", "oswin_overthrown"]);
    assert(!canAnswer(p, THREAD.who_leads), "the leader stays unknown until the Litany");
    assert(answerIsRight(THREAD.who_leads, "King Oswin") && answerIsRight(THREAD.the_name, "Hallowmere"));
    for (const t of THREADS) for (const c of t.must ?? []) assert(t.clues[c], `${t.id}: must-clue ${c} is not in the thread`);
  },
  "saved lore data carries a version, and saves from before versions load unchanged": () => {
    const old = JSON.stringify({ read: ["corv_01"], flags: ["wren_met"] });
    assertEqual(loadSaved("progress", old), { read: ["corv_01"], flags: ["wren_met"] });
    const stamped = stampSaved("library", { "1,2,3": ["corv_01"] });
    assertEqual(JSON.parse(stamped)._v, SAVE_VERSION.library);
    assertEqual(loadSaved("library", stamped), { "1,2,3": ["corv_01"] }, "the stamp never shows up as a shelf");
    assertEqual(loadSaved("places", undefined), undefined);
    // a made-up upgrade: version 1 called the field "seen"
    const before = SAVE_VERSION.progress;
    SAVE_VERSION.progress = 2;
    try {
      assertEqual(loadSaved("progress", JSON.stringify({ seen: ["a"] }), [(d) => ({ read: d.seen })]), { read: ["a"] });
      assertEqual(loadSaved("progress", JSON.stringify({ read: ["b"], _v: 2 }), [() => ({ read: ["wrong"] })]), { read: ["b"] }, "current saves are not upgraded again");
    } finally { SAVE_VERSION.progress = before; }
  },
  "story spine: every first book sends you to Wren, every plot mystery to its home boss, every boss to two other regions": () => {
    for (const plan of PLOT_PLAN) assertEqual(PLOT_REGION[plan.name], plan.region, plan.name);
    for (const name of Object.keys(PLOT_LORE)) {
      const first = LOCAL_TOMES.find((t) => t.local === name && t.n === 1);
      assert(/Millbrook/.test(first.pages.at(-1)) && /Sister Wren/.test(first.pages.at(-1)), `${name}: the first book does not end at Wren`);
      assert(first.leads.includes("millbrook"));
      const thread = LOCAL_THREADS.find((t) => t.local === name);
      const home = REGION_BOSS[PLOT_REGION[name]];
      assertEqual(thread.bossLead, home.place);
      assertEqual(PLACES[home.place].region, PLOT_REGION[name], `${name}: the home boss is in another region`);
      assert(thread.solved.endsWith(home.line));
      // first chapter: no local book or answer may name the place below, or who leads it
      assert(!thread.accept.some((a) => /hollow|morvane|oswin/.test(a)), `${name}: the typed answer gives too much away`);
    }
    assertEqual(Object.values(REGION_BOSS).map((r) => r.boss).sort(), [...REGIONAL_BOSSES].sort());
    const pairs = new Set();
    for (const [boss, left] of Object.entries(BOSS_LEADS)) {
      assert(BOSS_TOMES[boss], `${boss} has no confession`);
      assertEqual(left.leads.length, 2, `${boss} must leave two leads, never one`);
      const own = Object.entries(REGION_BOSS).find(([, r]) => r.boss === boss)[0];
      const regions = left.leads.map((id) => PLACES[id].region);
      assert(!regions.includes(own) && regions[0] !== regions[1], `${boss}: leads must be in two other regions`);
      pairs.add([...regions].sort().join("+"));
      assert(!/Hollow|Morvane|Oswin|Edda|truce/i.test(left.scrap), `${boss}: the scrap gives too much away`);
    }
    assertEqual(pairs.size, 5, "no two bosses send you to the same pair of regions");
    for (const region of Object.keys(REGION_BOSS)) {
      assert(Object.values(BOSS_LEADS).some((l) => l.leads.some((id) => PLACES[id].region === region)), `nothing ever leads to ${region}`);
    }
    assert(TOME[CONVERGE.tome]?.col === "survey" && CONVERGE.at >= 2 && CONVERGE.at <= 5);
    assertEqual(fallenCount(["fell_reeve", "fell_bride", "fell_morvane", "wren_met"]), 2);
  },
  "regional roles: each has a past, a reason and a saying, and every origin line names a real skill of that role": () => {
    const branch = { rider: "wing", forgemaster: "forge", captain: "helm", witch: "hex" };
    for (const [role, lore] of Object.entries(ROLE_LORE)) {
      for (const key of ["before", "why", "saying"]) assert(lore[key]?.length > 20, `${role}.${key}`);
      assertEqual(ROLES[role].region, lore.region, role);
      assert(Object.keys(ROLE_LINES).filter((id) => id.startsWith(`${branch[role]}_`)).length >= 4, `${role} has under four origin lines`);
      assert(!/Hollow|Morvane|Oswin|magic/.test(lore.before + lore.why + lore.saying), `${role}: these roles are not the Hollow's`);
    }
    for (const id of Object.keys(ROLE_LINES)) assert(SKILLS.some((s) => s.id === id), `${id} is not a skill`);
  },
  "clues file under their mystery once": () => {
    const p = blankProgress();
    assertEqual(addClues(p, ["minute_317"]), ["The Stopped Clocks"]);
    assertEqual(addClues(p, ["minute_317"]), []);
  },
  "drops and milestones name real tomes": () => {
    for (const list of Object.values(BOSS_TOMES)) for (const id of list) assert(TOME[id], id);
    for (const drop of Object.values(MOB_TOMES)) for (const id of drop.tomes) assert(TOME[id], id);
    assertEqual(libraryRank(26).name, "Library");
    assertEqual(MILESTONES[MILESTONES.length - 1].at, TOMES.length);
  },
});
