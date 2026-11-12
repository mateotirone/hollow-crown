// The story spine (Mateo's pick on a decision card, 2026-11-10 19:30 UTC, relayed by the whole-mod review:
// "Home boss first, then your order": your plot's mystery leads to your region's boss; each boss leaves two
// leads elsewhere; all routes end at the Rift). Pure data, no Minecraft imports.
//
//   WREN_NOTES    a later hand at the end of each plot's first book. Players now land straight on their plot and
//                 never pass through Millbrook, so every first book ends with a reason to go and find Sister Wren.
//   REGION_BOSS   where a plot's solved mystery points: its own region's boss, with the place added to the Ledger
//   BOSS_LEADS    what each of the five regional bosses leaves besides its confession: two leads, in two OTHER regions
//   CONVERGE      once this many of the five are down, every route turns to the Surveyor's Field Notes and the thin place
//   OPEN_AT       once all five are down: how to make the Tuning Fork (the fork only opens the Rift for someone who has seen all five fall)
//
// Reveal layers stay intact: nothing here names the Hollow, the truce, Edda, or who leads.

export const PLOT_REGION = {
  Harrowford: "Aldmere Vale", Oakmere: "Aldmere Vale", Thistledown: "Aldmere Vale", Wrenfield: "Aldmere Vale",
  Frosthelm: "Frostmarch", Wolfcairn: "Frostmarch", Gullcliff: "Saltreach", Tidewatch: "Saltreach",
  Reedmoor: "Blackfen", Lanternbog: "Blackfen", Redmesa: "Emberwaste", Dunehold: "Emberwaste",
};

const NOTE = "(Below the last line, in a newer hand and cheaper ink:)\n\n";
export const WREN_NOTES = {
  Harrowford: "The village upriver is Millbrook. There is a healer there, a Sister Wren, who can tell you which of its six clocks stopped first. I did not have the nerve to ask her. Somebody ought to.",
  Oakmere: "If you hear singing in this wood and it is not wind, do not sit in the cellar about it. Go to Millbrook and ask for Sister Wren. She has a way of looking at people who have heard it. She looked at me.",
  Thistledown: "The frame on the down hums on some nights with no bell in it. I walked to Millbrook, where no bell is ever rung, to ask why. A Sister Wren at the chapel gave me soup and told me to come back when I was ready to hear it. I never went back.",
  Wrenfield: "Wren Water is named for a family, not a bird. The last of them I know of is Sister Wren, who keeps the chapel at Millbrook. If you have questions about who lived in this house, hers is the family that was paid not to answer them.",
  Frosthelm: "A carter who buys our copper says there is a village in the Vale called Millbrook where they have taken down every bell and it is always dark. He says the healer, Sister Wren, asked him what we cast here. He would not tell me what he answered.",
  Wolfcairn: "A woman came up from the Vale to read these stones. Sister Wren, of Millbrook. She said the thing our people heard under the ice is heard in her village too, from the well. She left before the third night and told us to send anyone who asked.",
  Gullcliff: "The grey ships came for something that was never on this coast. A healer who walks the shore road each spring, Sister Wren of Millbrook, says it was under her village the whole time. She does not say it as a boast.",
  Tidewatch: "If one of yours comes back from the sea kinder than they left, do not send for a priest. Send to Millbrook for Sister Wren. She will not cure it. She will tell you how to live in the house.",
  Reedmoor: "The market stopped but the nights did not. Count them yourself. Then walk to Millbrook and ask the healer there, Sister Wren, why her village has only the one night and never gets to the fourth.",
  Lanternbog: "We are not the only house that keeps this kind of list. Sister Wren at Millbrook keeps one, for her own village, and hers is longer. If you ever stand blinking on a plank with no notion how the soup went cold, go and tell her. She will want the hour.",
  Redmesa: "The faces were cut off to an order. I carried one copy of that order as far as Millbrook, in the Vale, where a Sister Wren read it, went white, and asked me how many statues. Ask her what the number meant to her.",
  Dunehold: "We copied the same book forty times a year and were told it was history. One of us wrote to a Sister Wren at Millbrook, whose family is in it, to ask if it was true. Her answer was one line. \"Come and see what time it is here.\"",
};
export const wrenPage = (plot) => (WREN_NOTES[plot] ? NOTE + WREN_NOTES[plot] : undefined);

export const REGION_BOSS = {
  "Aldmere Vale": { boss: "reeve", place: "millbrook_clocktower",
    line: "Your papers all point one way in the end. The reeve of Millbrook stopped six clocks at one minute, on purpose, and has not come down from his tower since. Whatever he knows, he is keeping time over it." },
  Frostmarch: { boss: "huntsman", place: "frozen_lake",
    line: "Your papers all point one way in the end. Something still hunts on the lake at Rimehold, with hounds, in an old knight's cloak. It went under the ice after somebody, a long time ago, and it has been coming back up ever since." },
  Saltreach: { boss: "bride", place: "sunken_chapel",
    line: "Your papers all point one way in the end. Off Gull's Rest a chapel tower shows above the water when the moon is dark, and a woman in a wedding dress is still waiting at its altar. The coast has been told not to look." },
  Emberwaste: { boss: "seneschal", place: "faceless_vault",
    line: "Your papers all point one way in the end. Under Sunscar there is a vault the faceless statues were set to guard, and the steward who gave the order to cut them is still at his post. He has had three hundred years to get the order exactly right." },
  Blackfen: { boss: "mother", place: "cradle_tree",
    line: "Your papers all point one way in the end. Under the fen, something is raising the ones who come back. The lantern keepers called her the Mother, and did not say it loudly." },
};

// Two leads each, never in the boss's own region, and no two bosses send you to the same pair.
export const BOSS_LEADS = {
  reeve: { leads: ["frozen_lake", "lighthouse"],
    scrap: "Wound round the mainspring, two slips in a reeve's neat hand. \"Rimehold: ask who walked out onto the lake at this minute.\" \"Gull's Rest: ask the keeper what hour his lamp was lit.\" He had been meaning to write to them for three hundred years." },
  huntsman: { leads: ["sunken_chapel", "mags_hut"],
    scrap: "In the Huntsman's game bag, a tally stick with two notches left uncut, and beside each a word burned in. BRANNOC. FEN. Whatever he was hunting, he thought two of them had got as far as the sea and the swamp." },
  bride: { leads: ["sunscar", "mirelight"],
    scrap: "Sewn into her hem, a wedding list. Two guests are underlined who never came: a steward from Sunscar, \"detained by the King's business\", and a woman from Mirelight, \"gone a day, sends her love, does not know us\"." },
  seneschal: { leads: ["kings_barrow", "hollowfast"],
    scrap: "On his desk, under the ash, two warrants he never sealed. One is for a mason, to open a tomb at King's Barrow \"and report what is not in it\". The other is for Rimehold, to count the houses standing empty." },
  mother: { leads: ["faceless_vault", "crownhold"],
    scrap: "In the nest, among the things she kept from each of them: a chip of carved stone with half a mouth on it, the red dust of Sunscar still in the cut, and a bell-rope end from Crownhold, burned through." },
};

export const CONVERGE = {
  at: 3, tome: "surv_01", flag: "leads_converge",
  // the seven thin places go into the Ledger as leads (their descriptions say roughly where; none says which)
  leads: ["drowned_chapel", "bellfounders_mine", "kings_barrow", "saltglass_grotto", "frostvein_hollow", "sunken_quarry", "witchroot_caves"],
  line: "Three of them, in three provinces, and every one was guarding the same absence. They were not the cause. They were standing round it.\n§7A surveyor named Fennick once walked every place where the ground is thin and wrote down what he found at each. There are six of his Field Notes. Together they leave one place.\n§8Whatever is behind it will not answer while any of the five still keeps watch.",
};
// Mateo, 2026-11-11: hint at three, open at five. When the fifth falls, say how the door is opened.
export const OPEN_AT = {
  at: 5, flag: "leads_fork",
  line: "The last of the five is down, and the shards they kept ring faintly in your pack, all on the same note.\n§7Bellfounders tuned bronze with a fork. Five shards on an amethyst stem, made at a Workshop, would hold that note. Struck on the right stone, it might be answered. Struck on the wrong one, it goes dull for days.",
};
export const REGIONAL_BOSSES = Object.keys(BOSS_LEADS);
export const fallenCount = (flags) => REGIONAL_BOSSES.filter((b) => flags.includes(`fell_${b}`)).length;
