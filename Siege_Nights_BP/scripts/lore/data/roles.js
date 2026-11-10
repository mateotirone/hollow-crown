// Why each region keeps its role (town hall thread's regional roles on the Tree of Oaths; Mateo, 2026-11-10:
// roles come from the world and from choices, and lore goes wherever it can).
// None of these four is the Hollow's. They are what each region already knew how to do before the bells, and kept.
//   before  who held the role first (builder and other writers; may be shown)
//   why     why the region still keeps it
//   saying  what people of the region say about it (player-facing, one line)
// ROLE_LINES are one-line origins for each role's top powers, shown in the Tree like the Sorcerer's are.
// Written by the lore thread; NOT yet read by Mateo.

export const ROLE_LORE = {
  rider: {
    region: "emberwaste",
    before: "Ysolt Cinder, a salt-carrier's daughter who walked into the Saltglass with a dead mule and rode out a year later. She never said what she had promised, only that it was the dragon who set the terms.",
    why: "When the Grey Host came, the Emberwaste was the one province it never held. Nothing that marches in step crosses open sand under dragons. The Waste has kept its riders ever since as other lands keep walls. The dragons will not fly on the third night, and no rider has ever got one to say why.",
    saying: "You don't tame one. You're introduced.",
  },
  forgemaster: {
    region: "frostmarch",
    before: "Hroda Deepforge, bellfounder, who lit the fire under the mountain and swore it would outlast her. Every bell the Grey Host cut down was poured at her fire, and so, three generations after her, was the Founding Bell.",
    why: "The Frostmarch learned in forty nights at Rimehold that walls are only as good as what they are bound with. The Order came north afterwards and took the bell moulds. It could not carry off the fire. A Forgemaster keeps it lit, and is told on the first day that the smiths who came before never made a weapon they were proud of and a bell they were not.",
    saying: "Cold is only a thing that happens to people who stop working.",
  },
  captain: {
    region: "saltreach",
    before: "Merrin Holt of Gull's Rest, who burned forty of Saltreach's own boats in the harbour mouth so the Host's second fleet could not land. The crews agreed to it. The owners were not asked.",
    why: "Saltreach has been paying for those boats ever since. Every captain signs the articles and takes on a share of Holt's Debt along with a crew, which is why a Saltreach captain is obeyed: the crew know exactly what their captain owes, and to whom. The harbour has never once written the debt down as paid.",
    saying: "A captain is somebody the sea has agreed to blame.",
  },
  witch: {
    region: "blackfen",
    before: "Nobody. The fen was doing this before there was an Aldmere to disapprove. The oldest name anyone will give is Goody Sedge, and three villages each show you her grave.",
    why: "The Order burned books in the Blackfen and found there were none to burn. What a witch knows is handed over in a cup, by someone who had it handed to her. The fen keeps its witches because nothing else has ever kept its children alive through a wet summer, and because the Order's men do not like the walk.",
    saying: "It isn't a gift. The fen doesn't give. It lends, at interest.",
  },
};

export const ROLE_LINES = {
  wing_dive: "Ysolt's first lesson: she does not fall with you. You fall, and she decides.",
  wing_brand: "The heat was always hers. You have only stopped flinching from it.",
  wing_heart: "Riders say the second heartbeat starts in the first winter and is never quite in time with your own.",
  wing_wyrmfire: "She has been keeping count of what you kill together. Nobody taught her to.",
  forge_stance: "Stand as the anvil stands. It has been hit more than you ever will be.",
  forge_guardsteel: "Frostmarch steel remembers whose hand quenched it, and stands a little straighter for them.",
  forge_master: "One blow in five is the one Hroda would have let out of the shop.",
  forge_deep: "The fire under the mountain has not gone out in four hundred years. It has started to know its keepers.",
  helm_boarding: "First over the rail. Merrin Holt said the second man only ever follows a back.",
  helm_storm: "Saltreach children are sent out in their first gale, to be introduced.",
  helm_fleet: "They don't fight for you. They fight for the share of the debt you carry so they needn't.",
  helm_tide: "No Saltreach crew has let its captain drown first. It would leave them holding the debt.",
  hex_eye: "Look at them the way the fen looks at a man who has left the path.",
  hex_slip: "There is always a place to stand in a marsh where you are not. Goody Sedge is buried in three of them.",
  hex_contagion: "The fen never takes one of anything.",
  hex_bane: "What the fen is owed, it collects all at once.",
};
