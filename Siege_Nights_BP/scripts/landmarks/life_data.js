// The people of the places that have a life of their own (landmarks/life.js), and the five things each one says.
// Same writing rules as the townsfolk (townsfolk/data.js): hand-written, plain speech, nothing the street doesn't
// know (townsfolk/rules.js NEVER_SAID, checked by a self-test). `skin` is 0-7 of the region's painted outfits.

export const FOLK_OF = {
  // The Cinder Roost (map/structures/landmarks_story.py cinder_roost, its "life" spots folk:0..7)
  cinder_roost: { region: "emberwaste", people: [
    { name: "Marshal Ide Varrow", trade: "Flight Instructor", skin: 4, lines: [
      "Knees in, heels down, and stop talking to it. It knows what you want before you do. That's the problem.",
      "Twice round the ring on the ground before you go up. Twice. I don't care whose child you are.",
      "Kesh taught me. I teach them. One day one of them will teach somebody, and I'll be a name on the wall.",
      "A dragon that won't come down isn't being difficult. It's telling you the wind is wrong. Listen.",
      "Sand in the ring, not stone. You'll fall. Everybody falls. Better to fall on sand.",
    ] },
    { name: "Tamsin Reed", trade: "Cadet", skin: 1, lines: [
      "That's Ember up there with my sister on her. Next week it's my turn. I've been sick twice already just thinking about it.",
      "They make you muck out the stables for a month before they let you near a saddle. I smell like a chimney.",
      "The Marshal says I grip too hard. I say the ground is very far away.",
      "Have you seen the Span? You walk it alone, no rope. I'm not thinking about the Span.",
      "The fledglings bite. Not hard. Hard enough.",
    ] },
    { name: "Bren Askew", trade: "Cadet", skin: 2, lines: [
      "I'm from Sunscar. Everyone down there looks up at this place. Now I'm up here looking down. It's smaller than I thought.",
      "Wyverns are the fastest. Drakes are the toughest. Mine is neither. Mine is lazy.",
      "If you hear somebody screaming over the mesa, that's just training. Probably.",
      "We read the names on the gate every morning. Out loud. All of them.",
      "My dragon ate my boots. The left one. Only the left one. I don't know what it's trying to say.",
    ] },
    { name: "Old Hessa", trade: "Stablehand", skin: 6, lines: [
      "Don't stand behind the Drake. Don't stand in front of it either. Stand somewhere else.",
      "Forty years mucking out dragons. I've never flown. Never wanted to. Somebody has to keep the floor clean.",
      "Wild ones come down to the deck when it's hot. They like the warm stone. We leave them be.",
      "That one by the gate sleeps all day. Fine by me. A sleeping dragon doesn't eat my hay.",
      "The roof's for landing, the arches are for walking in, and the hay is not a bed. Tell the cadets.",
    ] },
    { name: "Corran Thale", trade: "Rider", skin: 0, lines: [
      "Best view in the Emberwaste, up here on the deck. You can see the Sunscar roofs and three days of sand.",
      "We fly the long patrol at dusk. Down the cliffs, round the dunes, back before the third bell.",
      "My wyvern's faster than anything in the sky. She knows it, too. Insufferable.",
      "Land soft, they told me. I landed on the library. They told me again.",
      "If you want to learn, see the Marshal at the ring. If you want to fly, see Kesh by the wall. Not the same thing.",
    ] },
    { name: "Scholar Imre Dask", trade: "Librarian", skin: 5, lines: [
      "Every dragon that ever came out of this school is written down in the library. Name, rider, colour, temper.",
      "Glass Wyrms stay up the longest. Frail, though. The books say feed them shells. The books say a lot of things.",
      "Quiet in the cloister, please. The cadets have their exams.",
      "There's a whole shelf on how to fall off a dragon. It's the most read shelf in the place.",
      "The well is older than the school. Somebody dug down through all that rock for water, and found it.",
    ] },
    { name: "Gatewarden Sef", trade: "Guard", skin: 3, lines: [
      "Up the stair from Sunscar, are you? Catch your breath. Everybody stops on the second landing.",
      "Gate's open in the day. At night it's open too, but I ask your name.",
      "Wild dragons don't come through the gate. They come over the wall. Mind your head.",
      "The rookery's the tall one. The dome's the school. The noisy one's the stables.",
      "You want Kesh. Everyone wants Kesh. North end, by the wall with the names.",
    ] },
    { name: "Lio Marren", trade: "Rookery Keeper", skin: 7, lines: [
      "The rookery's where the eggs were kept, once. Now it's mostly pigeons and me.",
      "Count the dragons over the mesa at dusk. Some nights four. Some nights five. Nobody owns the fifth.",
      "Wild dragons nest out in the open sand. They come here to look at us, I think. Like we look at them.",
      "Top of the tower you can feel the whole mesa hum when the wind's from the south.",
      "Don't feed the wild ones. They remember you. That sounds nice until it isn't.",
    ] },
  ] },
};
