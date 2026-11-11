// The role storylines (thread "Finish the six role storylines", 2026-11-11; Mateo kept all six roles and
// said the Dragon Rider path should loosely follow Fourth Wing, with our own names and people).
// Plan: https://claude.ai/artifact/Ra52mNyxfnaP71DpzU3mQH . Pure data, no Minecraft imports.
//
//   TRIALS       the four regional roles: mentor, the lore flag that starts the trial, and its steps.
//                The last step of each is the deed the town hall already knew (a boss or a hatching).
//                The role is offered once every step before it is done; a deed done early waits.
//   MENTORS      who speaks for each of the six roles (their words live in lore/data/dialogue.js)
//   RANK_LINES   what the mentor says when you rise to each rank (rank names from townhall/skills.js RANKS)
//   ELEVEN       the last eleven knights of the Ashen Gate, who come to a Knight one by one
//   TRIAL_RULES  numbers

export const TRIAL_RULES = {
  washoutDays: 3, // fall off the Span and the Roost won't let you try again for this long
  burnDays: 1, // walk at a nest like a fool and the dragons won't look at you until tomorrow
  debtShare: 4, // a share of Holt's Debt, in the old emerald unit (paid in Regals)
  crew: 3, // guards in your keep before Ottilie counts them a crew
  hearth: { "minecraft:iron_ingot": 16, "minecraft:coal": 16 }, // what Ulla wants hauled before she lights the side-hearth
  graves: 3, // Goody Sedge has three graves
  cupTicks: 2400, // the fen's first payment: darkness and slowness for about two minutes
  graveReach: 3, // blocks from a grave marker
  spanReach: 2.5, // blocks from either end of the Span
  spanFall: 4, // blocks below the Span's line that count as falling off
};

export const MENTORS = {
  knight: { npc: "aldous", name: "Sir Aldous Vane" },
  marked: { npc: "mag", name: "Old Mag" },
  rider: { npc: "kesh", name: "Kesh Cinder" },
  forgemaster: { npc: "ulla", name: "Ulla Deepforge" },
  captain: { npc: "ottilie", name: "Harbourmistress Holt" },
  witch: { npc: "nell", name: "Nell Sedge" },
};

// how: "talk"  checked whenever you speak to the mentor (items handed over, coins paid, guards counted)
//      "flag"  done when a lore flag is set (a dialogue button)
//      "place" done at a spot the map builder marked (the Span, the graves)
//      "act"   done by something you do in the world (the nest, the bell)
//      "deed"  the old deed: a boss falls near you, or your first dragon hatches
export const TRIALS = {
  rider: {
    mentor: "kesh",
    call: "kesh_call",
    where: "the Cinder Roost, in the cliff above Sunscar",
    steps: [
      { id: "span", how: "place", marker: "span", title: "Cross the Span", hint: "Walk the Span over the Saltglass gorge, from one end to the other, without falling." },
      { id: "choosing", how: "act", title: "The Choosing", hint: "Walk into the nesting field and take an egg. Empty hands, slow feet. The dragons are watching how you come." },
      { id: "hatch", how: "deed", title: "The Hatching", hint: "Set the egg on your Roost and stay with it. When it hatches, it has chosen you." },
    ],
  },
  forgemaster: {
    mentor: "ulla",
    call: "ulla_call",
    where: "the Deepforge, under the mountain above Rimehold",
    steps: [
      { id: "hearth", how: "talk", title: "Light the side-hearth", hint: "Haul 16 iron ingots and 16 coal to Ulla. She lights nothing for people who arrive empty-handed." },
      { id: "ring", how: "act", title: "Ring it on the ice", hint: "Set Hroda's Hand-bell down on ice or snow, at night, and ring it. Something on the lake still answers bells." },
      { id: "huntsman", how: "deed", title: "Bring down the Pale Huntsman", hint: "What comes up through the ice has to go back down." },
    ],
  },
  captain: {
    mentor: "ottilie",
    call: "ottilie_call",
    where: "the harbour office at Gull's Rest",
    steps: [
      { id: "articles", how: "talk", title: "Sign the articles", hint: "Pay your share of Holt's Debt to the harbourmistress, and your name goes in the book." },
      { id: "crew", how: "talk", title: "Raise a crew", hint: "Have three guards sworn to your keep, then tell Ottilie. A captain without a crew is a passenger." },
      { id: "bride", how: "deed", title: "Lay the Drowned Bride to rest", hint: "Take your crew to the sunken chapel. She has been waiting long enough." },
    ],
  },
  witch: {
    mentor: "nell",
    call: "nell_call",
    where: "a raft-house in the reeds past Mirelight",
    steps: [
      { id: "cup", how: "flag", flag: "nell_cup", title: "Drink the cup", hint: "Drink what Nell hands you. Don't ask." },
      { id: "graves", how: "place", marker: "grave", title: "Three graves", hint: "Find Goody Sedge's three graves. Kneel at each (sneak) and leave her something." },
      { id: "mother", how: "deed", title: "End the Mother of Changelings", hint: "The fen has been owed this one a long time." },
    ],
  },
};

export const TRIAL_ROLES = Object.keys(TRIALS);

// What the mentor sends when the deed is done before the rest of the trial.
export const DEED_WAITS = {
  rider: "§c\"It hatched for you. Good. That's the dragon's half. Come and do yours at the Roost.\"§7 (Kesh Cinder, the Cinder Roost above Sunscar)",
  forgemaster: "§b\"So he's down. Hroda would have wanted to see the hand that did it. Come to the forge.\"§7 (Ulla Deepforge, the Deepforge above Rimehold)",
  captain: "§3\"You laid her down without signing anything. Brave, or ignorant. Come and sign.\"§7 (Harbourmistress Holt, Gull's Rest)",
  witch: "§2\"The fen noticed what you did to her. It wants to meet you properly. Come for tea.\"§7 (Nell Sedge, past Mirelight)",
};

// What the mentor says as each step lands (chat, from the mentor).
export const STEP_LINES = {
  span: "§c\"You're across. Most of them look down. You looked at the gate. Now the nests.\"§7 (Kesh)",
  choosing: "§c\"It let you take it. Don't thank it. Get it somewhere warm.\"§7 (Kesh)",
  hearth: "§b\"Hm. Sixteen and sixteen. The side-hearth's lit. Take this: Hroda's pattern, first pour in thirty years.\"§7 (Ulla hands you a hand-bell)",
  ring: "§b\"You heard that? That was him hearing you. Don't run.\"§7 (Ulla's voice, in your head, from a long way off)",
  articles: "§3\"Your name's in the book. Below mine. Don't make me read it out at a funeral.\"§7 (Ottilie)",
  crew: "§3\"Three hands. It's a crew if you say it loudly enough. The Bride is at the sunken chapel.\"§7 (Ottilie)",
  cup: "§2\"There. That's the first payment. The fen will tell you when it wants the next.\"§7 (Nell)",
  graves: "§2\"Three graves, and one of them gave you something back. She likes you. That's rare, and worse.\"§7 (Nell)",
};

// Spoken when a rank is reached. Rank 0 is the oath itself, so only ranks 1 to 4.
export const RANK_LINES = {
  knight: {
    "Man-at-Arms": "\"They gave me a horse when I made Man-at-Arms. You'll get paperwork. I'm told it's an honour.\" (Aldous)",
    Knight: "\"Knight. I remember thinking it would feel like something. It feels like being trusted with more people's lives. Sit down, I'll pour.\" (Aldous)",
    Banneret: "\"Men will follow your banner now who've never met you. Make sure they'd still follow it if they had.\" (Aldous)",
    "Knight-Commander": "\"Knight-Commander. There were four of those when the Order was eleven hundred. Now there's you. What will you do with us?\" (Aldous)",
  },
  marked: {
    Listener: "\"Listener. Now you'll hear it in the kettle and the rain and the wind under doors. Don't answer it. Come and see me.\" (Mag)",
    Adept: "\"Adept. You went loud, didn't you? I felt it from here, like a draught. Come and sit, before you do it again.\" (Mag)",
    Veilwalker: "\"There's a pool in that place where an old friend of mine still talks. If you're walking there now, go and listen to him.\" (Mag)",
    Sorcerer: "\"Sorcerer. Three hundred years I've waited to say that to somebody who wasn't him. I find I don't like it as much as I thought.\" (Mag)",
  },
  rider: {
    Rider: "\"Rider. Your name's off the cadet board. It's not on the other board yet. Keep it that way.\" (Kesh)",
    "Wing-Sworn": "\"Wing-Sworn. She's started talking back, hasn't she? Mine did, about now. Listen to her more than you listen to me.\" (Kesh)",
    "Drake-Captain": "\"Drake-Captain. Then you're owed the truth about the third night, and I'm the only one at the Roost who'll give it you. Come up.\" (Kesh)",
    Dragonlord: "\"Dragonlord. Ysolt was the first. You're the first since me that I'd let say it out loud.\" (Kesh)",
  },
  forgemaster: {
    Journeyman: "\"Journeyman. You can sweep the forge now without asking. That's a joke. Mostly.\" (Ulla)",
    Smith: "\"Smith. Your steel's started remembering your hand. Don't make anything it'll be ashamed of.\" (Ulla)",
    "Master Smith": "\"Master Smith. Then it's time you knew where Hroda's moulds went. Somebody took them, and they wore grey.\" (Ulla)",
    Forgemaster: "\"Forgemaster. The fire knows your name now. I'll be honest: I'm jealous, and I'm glad.\" (Ulla)",
  },
  captain: {
    Bosun: "\"Bosun. The crew have stopped calling you 'the new one' when you're out of earshot. That's how you know.\" (Ottilie)",
    Mate: "\"Mate. You've a bigger share of the debt now. Don't look like that, it's how we know you're worth it.\" (Ottilie)",
    Captain: "\"Captain. Come and read the Debt Book properly, all of it. There are names in there you need to see.\" (Ottilie)",
    Admiral: "\"Admiral. Merrin Holt never had that word. She had forty boats and a match. You have more.\" (Ottilie)",
  },
  witch: {
    Herbwife: "\"Herbwife. Nobody calls it that any more but me. You can tell them I said so.\" (Nell)",
    Witch: "\"Witch. Now the fen's eye opens for you. You'll see who in the village is standing a little wrong. Be kind about it.\" (Nell)",
    Crone: "\"Crone. You're not old, I know. It's about what you've been lent, not how long you've had it. Come to the old water.\" (Nell)",
    "Fen Mother": "\"Fen Mother. Goody Sedge has a fourth grave now, and it's got your name on it, kept warm. That's a compliment.\" (Nell)",
  },
};

// The last eleven knights of the Ashen Gate (Aldous: "We were eleven hundred once. We are eleven now.").
// Aldous is one of them, so ten come to you; he is the eleventh, already there.
// After you Stand the Wall, one comes to you each time you hold or help hold a siege, or fell a boss.
export const ELEVEN = [
  { name: "Sir Aldous Vane", line: "already at your side" },
  { name: "Dame Orla Penhallow", line: "\"Aldous says you stood on somebody else's wall. That's the first thing in the Rule I ever believed.\"" },
  { name: "Sir Benedict Rooke", line: "\"I've burned eleven reports in my life. I kept copies of all of them. Want to read?\"" },
  { name: "Sir Tam Hollis", line: "\"I'm only here because my brother isn't. Don't make me regret it.\"" },
  { name: "Dame Isaura Venn", line: "\"The Grandmaster told me to watch you. I'm watching you. From here, with a sword out, facing the same way.\"" },
  { name: "Sir Gethin Marrow", line: "\"Thirty years on the Gate and the knocking never once sounded like bandits to me.\"" },
  { name: "Sir Cuthbert Ames", line: "\"I'm old, I'm slow and I know every road in Aldmere. Two of those are useful.\"" },
  { name: "Dame Wynne Corrigan", line: "\"Saint Ashe never wept, they say. I do. Often. I find it doesn't slow my arm.\"" },
  { name: "Sir Piran Lusk", line: "\"I was going to leave the Order. Then I heard what you were doing with it.\"" },
  { name: "Sir Osric Thale", line: "\"My grandfather guarded the Burned Archive door. He told me never to ask. I'm asking.\"" },
  { name: "Dame Hesketh Moor", line: "\"Last of us. That's eleven. If we're going to be wrong, let's be wrong together, in a straight line.\"" },
];
