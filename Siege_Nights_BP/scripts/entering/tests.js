import { addTests, assert, assertEqual } from "../siege/api.js";
import { PLACES, placeAt, settlementCard, cardText, ENTERING } from "./data.js";

const town = (name) => PLACES.find((p) => p.name === name);

addTests("entering", {
  "the six towns, the Order's houses and Crownhold all have a card": () => {
    for (const n of ["Kingsrest", "Millbrook", "Rimehold", "Gull's Rest", "Sunscar", "Mirelight", "The Ashen Gate Chapterhouse", "The Ashen Watch", "Crownhold"]) {
      assert(town(n), `${n} has no card`);
    }
    assertEqual(new Set(PLACES.map((p) => p.key)).size, PLACES.length, "place keys are unique");
  },
  "walking in shows the town, walking the edge does not flicker": () => {
    const k = town("Kingsrest");
    assertEqual(placeAt(k.x, k.z)?.key, k.key);
    const edge = k.x + k.r + ENTERING.pad / 2; // just past the edge, inside the pad
    assertEqual(placeAt(edge, k.z, null), null, "not entered from outside the edge");
    assertEqual(placeAt(edge, k.z, k.key)?.key, k.key, "still inside while within the pad");
    assertEqual(placeAt(k.x + k.r + ENTERING.pad + 1, k.z, k.key), null, "gone once past the pad");
  },
  "thin places stay unnamed": () => {
    assert(!PLACES.some((p) => /Barrow|Grotto|Quarry|Witchroot|Frostvein|Drowned|Bellfounders/.test(p.name)));
  },
  "the card reads 'You are entering ...'": () => {
    const t = cardText(town("Sunscar"));
    assertEqual(t.title, "§6Sunscar");
    assert(t.subtitle.startsWith("§7You are entering "), t.subtitle);
    assertEqual(cardText(settlementCard({ mine: true, tier: "Hamlet" })).subtitle, "§7You are home");
    const other = settlementCard({ ownerName: "Ada", tier: "Village", region: "Blackfen" });
    assertEqual(other.name, "Ada's Village");
    assertEqual(cardText(other).subtitle, "§7You are entering Ada's land in Blackfen");
  },
});
