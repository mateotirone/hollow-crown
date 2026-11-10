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
//   loreTalk         { player, npc, node, choice, next }
//   slip             { player, id, npc, returnTo, dimension, handled }   a Slip into the Hollow should happen now.
//                    The Undertow feature sets data.handled = true, does the glimpse, then emits slipEnded { player, id }.
// Per-player progress is the player dynamic property "hc:lore_progress" (JSON, see blankProgress).

import { addTests, assert, assertEqual } from "../siege/api.js";
import {
  TOMES, TOME, tomesOf, CLUE_THREADS, surveyLine, sitesMatching, encipher, mirror, pagesFor, normalize,
  answerIsRight, blankProgress, holds, startNode, addClues, libraryRank, THREAD, canAnswer,
} from "./logic.js";
import { COLLECTIONS, PLACES, SITE_IDS, THREADS, MILESTONES } from "./data/world.js";
import { NPCS } from "./data/dialogue.js";
import { JOURNAL, JOURNAL_CLUES } from "./data/journal.js";
import "./player.js";
import "./reader.js";
import "./library.js";
import "./ledger.js";
import "./journal.js";
import { BOSS_TOMES, MOB_TOMES } from "./caches.js";
import { dialogueProblems, SCRIPT_CLUES } from "./npcs.js";
import "./showcase.js";

addTests("lore", {
  "the starting journal explains nothing: no names, no answers": () => {
    assertEqual(JOURNAL.entries.length, 12);
    const text = JOURNAL.entries.map((e) => e.date + " " + e.text).join(" ");
    for (const secret of ["Oswin", "Aldric", "the Hollow", "Hollowmere", "Choir", "3:17", "third night", "Edda", "truce"]) assert(!text.includes(secret), `journal says "${secret}"`);
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
    const given = new Set(TOMES.flatMap((t) => t.clues));
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
    assert(answerIsRight(THREAD.who_leads, "King Oswin") && answerIsRight(THREAD.the_name, "Hollowmere"));
    for (const t of THREADS) for (const c of t.must ?? []) assert(t.clues[c], `${t.id}: must-clue ${c} is not in the thread`);
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
