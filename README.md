# Siege Nights

Found a settlement, build a castle, and hold it against raiders on siege nights. Every player in a world can have their own settlement.

## How it plays

1. **Found your settlement.** Craft a **Keep Banner** at a normal crafting table and place it in the Overworld. It starts as a **Hamlet** covering 32 blocks around it. Each settlement gets its own banner color, and no two players can share a color. Use dye on your banner to change it.
2. **Build your castle.** Craft a **Siege Workshop** (normal crafting table) and place it on your land. Every other Siege Nights item is crafted there, and Siege Nights blocks can only be placed inside your own settlement.
3. **Your land is protected.** Other players can't break, build or dig on your land. To get in they need to come through your gate, or blow a hole with a **Breaching Charge**. While you're offline, nothing on your land can be broken at all.
4. **Survive siege nights.** From day 5, every 3rd night, an army marches on each settlement whose owner is online. Three assaults come 30 seconds apart. From the second siege on, **Battering Rams** (ravagers) smash through walls, and **Sappers** plant a lit Breaching Charge against your wall. Break the charge before its 4-second fuse runs out to defuse it, and kill the rams first! You can't sleep during a siege.
**Menus.** Click your Keep Banner (without dye) for the **Keep menu**: your tier, wins, what's needed for the next tier, when the next siege comes, what attacked you last, your guards and allies. Click a Barracks without coins in hand for the **Barracks menu**: recruit Men-at-Arms or Archers, see every guard with their armor and position, and upgrade their armor. During a siege a **sidebar** shows waves sent, waves left, raiders remaining and each keep's health.

5. **Protect the Keep.** The raiders attack your Keep Banner. Its health shows above it. If it falls, your banner is destroyed and you'll have to found your settlement again. Hold out and kill every raider to win Regals (the world's coin) and XP. If dawn comes first, they retreat.
6. **Spend your winnings.** Bring an unemployed villager to a **Quartermaster's Desk** and they take the job. The Quartermaster sells siege gear, weapons, armor and cosmetics for Regals (1 Gold Regal is 64; sneak + use one to break it into small coins). More stock unlocks as you trade: diamonds (2 Gold Regals) from his second level, and netherite scrap (4 Gold Regals), the netherite upgrade template (6) and diamonds at 12 once he's a veteran. Netherite is meant to be a long-term goal: a full set costs thousands of Regals.
7. **Watch your banner.** Another player can carry off your Keep Banner while you're online, which topples your settlement.
8. **Grow.** Every siege your keep survives is a win. At 3 wins your Hamlet becomes a **Town** (48 blocks, keep has 300 health), at 6 wins a **City** (64 blocks, 400 health), and at 10 wins with 2 warlords slain a **Castle** (80 blocks, 600 health).
9. **Make allies.** Look at a friend and use a **Writ of Alliance** to let them build on your land. Use it again to end the alliance.
10. **Know your borders.** When you're near a settlement's edge, a line of particles in its banner color shows where it is, and you're told when you enter or leave someone's land.
11. **Hire guards.** Build a **Barracks**, bring an unemployed villager to it, and click it with coins in hand (40 Regals) for a **Man-at-Arms** (sneak + click for an **Archer**). Sneak + click a guard to pick them up and place them anywhere on your land. Archers stay exactly where you put them, so set them on your walls. Men-at-Arms wait at the nearest Barracks and charge out when raiders come or someone is Wanted. Anyone who attacks you or your guards, lights a charge or rams your walls on your land is **Wanted** there for 5 minutes, and your guards hunt them. Allies are never targeted. A Hamlet can keep 4 guards, a Town 8 and a City 12. Fallen guards are gone for good, and while you're offline your guards can't be hurt. **Upgrade their armor** by clicking a guard holding the next upgrade: 6 iron ingots for Mail and Nasal Helm, 12 iron ingots for Brigandine and Sallet, 4 diamonds for Half Plate and Bascinet, then 1 netherite ingot for Royal Guard Plate. This is guard-only armor, so your soldiers never look like you, and their banner tabard always shows. Picked-up guards keep their armor.

## Every siege is different

When a siege starts, each settlement gets its own war plan, built from what you've done:

- **Threat:** goes up with every siege you've faced, the villagers on your land, your wins, your ballistas and guards, and your winning streak. Blowing the War Horn to provoke them makes it worse. Bigger threats pay more Regals when you win.
- **Faction:** a **Pillager Warband** (pillagers, vindicators, witches, evokers, battering rams), an **Undead Horde** (zombies, skeletons, husks, strays, wither skeletons, no rams but twice the sappers) or a **Mercenary Host** (a mix). Stronger units only show up in later sieges.
- **Direction:** they attack the side of your settlement with the fewest ballistas and archers.
- **Twists:** from your second siege, there's often a modifier: Pincer Attack (two sides), Iron Shields (tougher), Forced March (faster), Sapper Corps (double sappers), Siege Train (rams from the first assault) or Bloodlust (harder hits).
- **They adapt:** whatever did most of the killing last time (ballistas, arrows, guards or your sword), they bring a counter for it.
- **Warlords:** from your third siege, a named warlord like *Grimbald the Ashen* may lead the final assault, and every 5th siege always has one. They're much tougher and drop 96 Regals and 2 diamonds.

## The Grand Siege

Reach **Castle** and the Warlord King comes for you. Your next siege is the Grand Siege: every faction at once, double threat, attacking from two sides, with the Warlord King himself in the final assault. Kill him and hold your keep until the siege ends to become **Sovereign**: 384 Regals, a netherite ingot, a Totem of Undying, 4 extra guard slots, and your guards fight harder. Lose and he'll be back next siege.

## Wall strength

Siege weapons wear walls down instead of breaking them in one go, and cracks appear as a block gets weaker.

- **Reinforce:** click Castle Stone, a Portcullis or a Castle Gate on your land with an **iron ingot**, then a **diamond**, then **netherite scrap** (one per block, in that order). Each tier shows on the block and makes it much tougher.
- **Repair:** click a cracked block with **stone bricks** to patch it up.

| Tier | Castle Stone takes | Gate takes |
|---|---|---|
| Stone | 6 | 2 |
| Iron | 10 | 4 |
| Diamond | 16 | 7 |
| Netherite | 26 | 12 |

Damage: a raider ram blow does 1 to the block it hits, and a swing of your own Battering Ram does 2. Boulders, sappers and Breaching Charges blast an area: strongest where they hit (6.5, 7 and 10), fading over about 2 blocks and reaching deeper in the direction they travel. Every block's mortar is a little stronger or weaker, so craters come out ragged. Other blocks break after 3. Try it in the Siege Wall Lab (`lab/wall-lab.html`).

## Made at a normal crafting table

| Item | Recipe |
|---|---|
| **Keep Banner** | White wool, gold ingot, white wool / 3 white wool / stick in the middle bottom |
| **Siege Workshop** | Iron ingot on top / stone bricks, crafting table, stone bricks |

## Made at the Siege Workshop

| Item | What it does | Recipe |
|---|---|---|
| **Castle Stone** | Blast-resistant wall block | 8 stone bricks around 1 iron ingot → **16** |
| **Mossy / Cracked Castle Stone** | Weathered variants | Castle Stone + vine / smelt Castle Stone |
| **Battlement** | Crenellated wall top | C C / CCC (Castle Stone) → 4 |
| **Arrow Slit** | Wall with a slit; ballistas shoot through it | C C / C C → 2 |
| **Portcullis** | Click to raise/lower the whole gate | 8 iron bars around 1 iron ingot → 4 |
| **Castle Gate** | Wooden gate, same click-to-open | Planks with iron nuggets (PNP / PPP / PNP) → 4 |
| **Spire Roof** | Pointed tower cap | Cobbled deepslate pyramid → 2 |
| **Timber Frame / Cross Timber** | Plaster and beams for houses | Stick, clay ball, stick → 2 / + stick |
| **Brazier** | Bright fire bowl | Coal / 3 iron nuggets / 1 nugget |
| **Ballista** | A 3D machine that turns to face monsters within 16 blocks and shoots them. Only on your own land. Sneak + click with an empty hand to pack it back up | Planks, crossbow, dispenser, redstone |
| **Breaching Charge** | 4-second fuse, then blasts a 3×3×3 hole, even through Castle Stone | TNT over 3 iron ingots → 2 |
| **Trebuchet** | A big 3D machine, about 6 blocks tall. Stand by it and look where you want to fire, then click it with cobblestone: it swings round, the arm whips over and hurls a boulder (smashes a small crater, 10 s reload). Sneak + click with cobblestone to switch range: 20, 30 or 40 blocks. Sneak + click with an empty hand to pack it up. Can be placed anywhere | Planks, planks, string / planks, cobblestone, planks / planks, _, planks |
| **Battering Ram** | A siege engine you drive. Place it, click it to climb on, steer with WASD, and punch the wall in front to swing the beam (every 2 s). Sneak to get off; break it to pick it back up | Log, log, iron block / planks, _, planks |
| **Barracks** | Recruit and house your guards | Iron sword on top / planks, shield, planks / 3 planks |
| **Writ of Alliance** | Look at a player and use it to ally (or un-ally) them with your settlement | Paper + gold nugget + feather (shapeless) |
| **Quartermaster's Desk** | Workstation for the Quartermaster | Emerald / planks, chest, planks |
| **War Horn** | Calls a siege early (at night, settlement owners only) | Gold, leather, bone diagonal |
| **Castle Guard armor** | Iron-level protection. Cloth takes your banner color. Full set = Resistance in sieges | Iron armor shapes with one leather |
| **Knight's Longsword** | 7 damage | Diagonal: 2 iron ingots and a stick |
| **Warhammer** | 9 damage, slows what it hits | 6 iron ingots over a stick |
| **Halter** | Use on a tamed horse to make it your steed | Leather, string, leather / leather, _, leather / iron nugget |
| **Riding Crop** | Use while riding your steed to gallop | Leather over 2 sticks, diagonal |
| **Horse Whistle** | Calls your horse | 3 bamboo, iron nugget, string |
| **Horseshoes** | Iron: +1 Speed. Diamond: +1 Speed, +1 Jump. Netherite: +2 Speed, +1 Jump, fireproof | 4 iron ingots + nugget / iron shoes + 2 diamonds / diamond shoes + netherite ingot |
| **Saddle kits** | Padded +1, Cavalry +2, Royal +3 Stamina | 3 wool over 2 leather / padded + leather + 4 iron ingots / cavalry + 2 diamonds + 2 gold ingots |
| **Caparison** | Horse cloth in your banner's color | Wool, banner, wool / wool, string, wool |
| **Stables** | Train, breed and stable your horses | 3 hay bales / oak fence, saddle, oak fence / 3 planks |
| **Rail Depot** | Joins your settlement to the rail network | Rail, minecart, rail / planks, iron ingot, planks / 3 planks |

## Quartermaster's stock

- **Siege gear:** Ballista, War Horn, Braziers, arrows, Portcullis, Castle Stone
- **Weapons & armor** (after a few trades): Longsword, Warhammer, enchanted crossbow, Castle Guard armor, shield, diamonds
- **Cosmetics & mounts** (after more trades): Castle Guard Barding (iron horse armor, retextured with a crimson caparison), saddle, Keep Banner, lanterns, bell, spyglass
- **Veteran stock** (after lots of trades): netherite scrap, netherite upgrade template, diamonds at 12

Save up raid winnings for diamonds, then netherite. The resource pack also redraws vanilla chainmail (solid mail with a mantle), iron (chainmail and surcoat), diamond (knight's plate with a plumed great helm) and netherite (dark royal plate with a crown and cape) armor, with real 3D pieces.

## The Hollow Crown map: plots, no elytra, map edge

For the hand-built map (plan: `map/hollow-crown-map.png` and the "Hollow Crown map plan" doc). None of this changes a normal world until the first Plot Stone is placed.

- **Plot Stones.** In Creative, `/give @s siege:plot_stone` and place one in the middle of each plot. It names itself after the nearest planned plot (12 are planned, in `scripts/plots/config.js`); click it in Creative to change which plot it is. It can't be mined or blown up in Survival.
- **Claiming.** Once any Plot Stone exists, a Keep Banner can only be raised on top of a free Plot Stone. Friends share a plot with a Writ of Alliance, or each claim their own. Raising your banner on another plot moves your settlement.
- **Held plots.** If your keep falls or your banner is captured, your plot is held for you for 3 in-game days.
- **Plot Atlas.** Click any Plot Stone, or use the Plot Atlas button on the Keep menu, to see every plot, who holds it and which way it is.
- **No elytra.** Any elytra in a player's inventory crumbles and pays 3 Gold Regals (always on).
- **Map edge.** With plots placed, players can't go more than 1,250 blocks from 0, 0.

Numbers to change: `MAP` in `scripts/plots/config.js`.

### The welcome hall and the test area

Both float high above the map. New players (Survival, no settlement yet) arrive in the **welcome hall**, a stone terrace over Gull Bay. The Waystone in the middle tells the story so far and how starting works. Twelve pedestals stand round the rim, one per plot, each set in the direction its plot really lies. Click a free one to start there: you are set down beside its Plot Stone with a Keep Banner, and the plot is kept for you alone. A taken pedestal goes dark and shows who has it, their level and their settlement's level. You can also start in Kingsrest with no plot and join a friend. Nobody can leave the hall without choosing.

The **test area** is a glass floor in the sky holding the whole showcase (every block, item, machine and each feature's exhibit).

Builder commands (Creative): `/scriptevent siege:welcome build` (or `build here`), `go`, `testarea`, `kingsrest` (sets the Kingsrest arrival spot to where you stand), `release <name>`, `status`. Settings are `WELCOME` in `scripts/plots/config.js`; the story text is `PAGES` in `scripts/plots/welcome.js`.

## Horses and the rail network (The Hollow Crown)

Full design: the "Hollow Crown: Horses and Rail Network" doc. Scripts: `scripts/horses/` and `scripts/rails/` (numbers to change are at the top of each folder's `data.js`). Pack files are generated by `studio/build_horses.py`.

**Horses**

- **Get a steed.** Use a **Halter** on a tamed horse: it becomes your steed and keeps its speed, health, coat, saddle and barding. Or buy a regional foal for 192 Regals at a **Breeder's Post**.
- **Ride to level it.** Riding earns horse XP (double while galloping). Each level gives a training point; levels 5, 10, 15 and 20 give a perk point.
- **Gallop.** Use a **Riding Crop** while riding to gallop until stamina runs out. The bar above your hotbar shows stamina.
- **Stables.** Place a **Stables** on your land and click it: train Speed, Jump, Health and Stamina from 1 to 5, pick perks, breed two horses, stable horses, revive a fallen one (level 2) and perform the Warhorse or Glimstrider rite (level 3). No Stables = 1 horse; levels 1/2/3 = 3/5/8 horses.
- **Gear.** Use Horseshoes, a Saddle Kit or a Caparison on your horse to fit it. Vanilla horse armor and saddles work as usual.
- **Horse Whistle.** Calls your horse from up to 64 blocks (anywhere with the Loyal perk). On a Glimstrider, blowing it while riding is the Veilstep.
- Sneak and click your horse with an empty hand to see its sheet. Only you and your allies can ride it.

**Rails**

- **Station Posts** are placed by the map builder in Creative (`/give @s hc:station_post`), one per platform, within 5 blocks of the track. Name it and pick its region when you place it.
- **Breeder's Posts** are also builder blocks (`/give @s hc:breeder_post`); pick which breed it sells.
- Players build a **Rail Depot** on their own land to join the network.
- **Train Carriage.** A four-seat wagon that rides the normal rails, about 1.5x a minecart's top speed. Stations call one for you, or craft your own at the Siege Workshop (planks, lantern, planks / planks, wool, planks / minecart, iron ingot, minecart) and place it on a rail. Click to board, push forward to go; sneak + click with an empty hand packs yours up.
- Click a station: call a carriage or a minecart, choose a destination (the bar shows direction and distance while you ride), see the network map, or use the horse stalls to send your horse ahead.

**Test world:** `/scriptevent siege:showcase` puts 8 steeds behind you that are already yours (one of each breed, a Knight Warhorse, a Glimstrider and a foal), a Breeder's Post and two Station Posts on a powered line.

**Quick test by hand:** `/give @s siege:halter`, tame a horse and use the Halter on it. `/give @s siege:riding_crop` and ride. `/give @s siege:stables` on your land. For the rites: `/tag @s add siege_path_knight` (or `siege_path_marked`) until you choose a path in the story.

## The High Throne, the Citadel and usurping (The Hollow Crown)

The overworld endgame. Full design in the "Crown, Citadel and Usurpation" doc; names and numbers in `scripts/crown/config.js`. (The Hollow Crown itself is a different prize: it belongs to whoever rules the Hollow, and only a master Sorcerer can wear it.)

- **Beating the Hollow.** When the final boss dies, the game tells everyone in the fight that the Hollow Crown would kill them, and **the Heart of the Hollow** is left lying where the boss fell. Nobody is asked and nobody votes. Leave it and it stays there for whoever comes later. Click it to reach for it: everyone on the server is told who is reaching, and it is theirs after 10 seconds unless they take any damage or step away, so the others can fight for it. Whoever ends up holding it becomes the **Heartbearer** (or picks another title), gets the Heart (it can't be dropped and stays on death), a **Citadel Cornerstone**, and an offer at the Tree of Oaths to walk the Sorcerer's road with a head start.
- **The Citadel.** Place the Cornerstone within 40 blocks of your Keep Banner and click it. The Citadel rises over about 3 minutes: a curtain wall 92 blocks out with 8 towers and a gatehouse facing world spawn, and a Great Keep 25 blocks square and 76 tall with the throne room on its ground floor. Everything inside the Great Keep's square is cleared; the rest of your builds stay. Citadel land reaches 100 blocks and belongs to whoever holds the Heart. Its banner can't be taken.
- **Ruling.** Click the **Throne**: Decree of Siege (128 Regals: a rival's next siege is half again as big and you pick the host), Decree of Peace (64), the Royal Tithe (0 to 30% of everyone else's siege winnings, into the Treasury), withdraw the Treasury, the Annals. Raiders never march on the ruler. The ruler gets 8 extra guards. **The Heart:** use = Kneel (slow and weaken enemies nearby), sneak + use = Rally (buff your Court and guards), look straight up + use = Return to the Throne. Decrees and tithes raise **Unrest**, which hands every rival bonus Claim.
- **The Court.** The ruler's Writ of Alliance allies. They can build in the Citadel and can't challenge the ruler.
- **Earning a Claim (100).** Bind an Oath Shard (+25), win a siege (+5 plus Unrest), slay a warlord (+10). After every siege night an **Oath Shard** falls 150 to 400 blocks from the Citadel; everyone gets a direction. Mine it, then use it. If the ruler or their Court uses one, it shatters instead.
- **The Gauntlet.** With a full Claim, craft a **Gauntlet of Challenge** at the Siege Workshop (5 iron ingots around a gold ingot, leather below) and use it. A new or victorious ruler has 3 siege nights of grace.
- **The Storm.** Comes on the next siege night when both ruler and claimant are online. Break the **Throne Seal** (1000 health, in front of the throne; only the claimant and their allies can hurt it) before dawn. The claimant has 3 lives. Logging out for 2 minutes during the Storm forfeits it. A ruler who dodges a challenge for 7 real days loses the throne; a claimant who misses 3 siege nights loses the challenge.
- **Banishment.** The loser is thrown out of the gate with what they carry, can't enter the ruler's land for 3 siege nights, and is marked [Exile]. The winner takes the Heart and moves in: their old plot is given up, and the Citadel's guards, machines, Treasury and banners become theirs.
- **The Long Road Back.** An exile gets a Keep Banner, a Blood Claim of 40, and five stages (see "The High Throne" on the Keep Banner menu): found a new keep, recruit 2 guards, win a siege, bind a shard, take the throne back.
- **Rival lords (playing alone).** The Rival Lords settled on the map's plots (or three stand-in lords from `crown/config.js` if none has settled) build a Claim every siege night a player holds the throne. When one is strong enough they throw down the Gauntlet and march on the ruler's keep in person with a bigger army: hold the keep and their Claim is broken, lose it and they rule. A ruling lord takes a 20% tithe and decrees sieges, and you unseat them the same way you would a player: earn a Claim, throw the Gauntlet, break the Throne Seal past the lord and their soldiers. Set `npcRivals: false` to turn them off.

Test commands (cheats on): `/scriptevent siege:crown_me` makes you the Heartbearer, `siege:crown_showcase` does that and raises the Citadel in 30 seconds, `siege:crown_offer` lays the Heart at your feet as if the boss had just died there, `siege:crown_claim 100`, `siege:crown_shard`, `siege:crown_gauntlet`, `siege:crown_shardfall`, `siege:crown_grace` (clear the grace period), `siege:crown_usurp` (end a running Storm for the claimant), `siege:crown_status`, `siege:crown_reset`.

## Lore, the Library and the Ledger (The Hollow Crown)

The story is written in **74 Lore Tomes** in 8 collections, scattered over the map. Some of them lie. The whole truth is in `LORE-BIBLE.md` (spoilers).

- **The Old King's Journal.** Every player has it from their first minute: a past king's journal about strange things he never understood. It is an ordinary book and reading it is optional (use it). Lost it? `/scriptevent siege:journal`.
- **The Fourteen Arts.** A child's copybook about the fourteen Sorcerer powers, given by Old Mag in Mirelight to anyone who has taken the Ember. One page per power: where it comes from, hinted and never explained, and what happened to people who could do it. Four powers (Echo Sight, Halfstep, Choir's Call, Veilstep) stay unknown at the Tree of Oaths until you have been somewhere or met someone; the book says where, if you squint. `/scriptevent siege:arts` gives a copy.
- **Lore Tomes.** Use one to read it. Reading to the last page copies its clues into your Ledger. Lighthouse letters are in cipher (carry a **Cipher Wheel**) and Choir hymns are written right to left (carry **Tide Glass**, or be Marked, or stand in the Hollow).
- **Dusty Tomes** are books lying in the world. Click one for your own copy. Every player gets one copy from each, so nobody can strip the map. Bosses drop their own tome to everyone who fought, and some night creatures drop rare ones.
- **Archive Shelf** (Siege Workshop: planks, book, Castle Stone, book, planks → 2). Hold a tome and click a shelf to shelve it: each shelf holds 6 and shows a spine per tome. Click a shelf without a tome for the **catalog**: read anything shelved, see hints for what's missing, take tomes back, and claim rewards. Breaking a shelf spills its tomes.
- **Rewards.** Finishing a collection (and having read it) gives skill points and a secret. The Library also grows at 5, 10, 25, 40, 60 and 74 tomes: the Cipher Wheel turns up at 10 and the Tide Glass at 25.
- **Ledger of Whispers.** Your notebook: 16 mysteries, each filling with clues word for word, plus your leads. With enough clues you answer the mystery. Some answers you have to type. A wrong answer closes that mystery for a day.
- **Name the Thin Place.** Six Surveyor's Field Notes each say one true thing about the cave that hides the Rift. Shelve all six, read them, and name the place in your catalog. Wrong costs 3 days.
- **Characters.** Eight hand-written characters on the built-in NPC, who say different things depending on what you've read, solved and become, and who point you to places. Asking Sister Wren which clock was first triggers the First Slip.

A real book of all of it, with eight old paintings and the journal: `lore-book/The-Unburned-Library.pdf` (spoilers). For a world played alone, `scripts/lore/data/lords.js` holds the voices of twelve Rival Lords, the NPC rulers of the Hollow and extra Rumor Board jobs.

- **The singing.** One low held note: faint on every third night, louder near a thin place, constant in the Hollow, audible beside a hidden Returned, clearer for Sorcerers, and full volume in a Slip. Placeholder sound for now. `/scriptevent siege:hum` to hear it, `siege:hum off` to stop your ears.
- **The hidden Returned.** Four families ask you to find out whether someone they love came back as a copy (Nessa, Jorund, Tilly, Hesper). Not every suspect is one. Place suspects with `/scriptevent siege:lore_case <harl | bram | pip | hesper>`.
- **Who Morvane was.** Three characters each hold a piece, Archivist Pell lays them side by side, the last fight shows it, the journal gains a last page (`/scriptevent siege:journal_last_page` to test) and Brother Cael says it afterwards. Words in `scripts/lore/data/reveal.js`.

- **Twelve settlements, twelve ways in.** Every plot has its own past, three local books (first one on the Library's bottom shelf on arrival, then at Town and City), a local mystery, and three prior leaders whose portraits hang in its Library. `/scriptevent siege:local_lore [plot]`.
- **Portraits and paintings.** Click a picture to read it. Builders: look at a wall and run `/scriptevent siege:portrait <id | plot name | gallery>`. Portraits are placeholders until painted (`studio/art/PORTRAIT-BRIEF.md`).
- **Ravens.** Ravens settle on your wall at dusk before a raid; Sigrun in Rimehold says why. `/scriptevent siege:ravens`.

- **Moon doors.** A door carved with a full moon opens only on the dark moon, and the other way round; it closes at dawn. Builders: look at the door's bottom-left block and run `/scriptevent siege:moon_door full | dark [wide] [tall]` (also `remove`, `list`, `test`).
- **Corvin Hale.** A Sorcerer with Resonance 70+ starts to hear one voice in the singing that is off the note, and it has something rude to say about each art they learn. He can be met in the Hollow: `/scriptevent siege:lore_npc corvin`.

Builder commands: `/scriptevent siege:lore_list [collection]`, `siege:lore_give <tome | collection | all>`, `siege:lore_npc <id | list>`, `siege:lore_mark_place <place>`, `siege:lore_reset`. To bind a Dusty Tome, click it in creative while holding the tome.

## Install

- **Windows / phone / tablet:** open `hollow-crown.mcaddon`. Minecraft imports both packs.
- Create or edit a world, go to **Behavior Packs**, activate **Siege Nights**. The resource pack turns on with it.
- Built for Minecraft 26.30 or newer.

## Quick test (cheats on)

1. `/give @s siege:keep_banner`, place it, then `/give @s siege:workshop`.
2. `/time set 13000`, then use a War Horn (`/give @s siege:war_horn`) to start a siege.
3. `/summon villager` next to a Quartermaster's Desk to see the job change.

## Changing things

`Siege_Nights_BP/scripts/siege/settings.js` is the `SETTINGS` block (siege timing, waves, ram strength, ballista damage and more), and `siege/territory.js` has the `TIERS` list for settlement sizes. The scripts are split into small files by topic; `MODULES.md` explains the layout.

## Mobs and bosses (the bestiary)

Code in `Siege_Nights_BP/scripts/bestiary/` (start with `index.js`), looks and stats in `studio/bestiary/roster.py`. After changing the roster run `python3 studio/bestiary/build.py`, then `node tools/check.mjs`.

- **25 new mobs** in four families: Choir-called raiders (take over sieges from a settlement's 3rd siege, 15% more each siege), Hollow things (walk the night after the first boss falls, and haunt the Hollow), regional beasts (spawn in their biomes), and the Order of the Ashen Gate (placed at outposts; hostile only to Marked players or anyone who attacks them).
- **7 boss fights** with phases, warned attacks and per-player loot: the Clockwork Reeve, Pale Huntsman, Drowned Bride, Ash Seneschal, Mother of Changelings, the reworked Warlord King, and Morvane, the seven stage final fight that drags players between places (`morvane.js`). The Choir uses the same framework (`bossCore.js`).
- **See everything:** `/scriptevent siege:showcase` lines up every mob and boss behind you as labelled statues (they can't move, fight or be hurt).
- **Three kinds of siege troop** (`spawns.js`): Choir raiders (from a keep's 3rd siege), the Grey Host (five soldiers of the army the Hollow swallowed, default from the 6th) and soldiers of the Hollow itself (Veinsworn, Shardcaster, Gatebreaker, default from the 10th). For three sieges before those, one Veinsworn stands at the back and only watches. The raids feature sets the pacing with `setTroopPlan()`.
- **Hidden Returned** (`returned.js`): ordinary villagers that are secretly Returned, caught only by their tells (faces the Hollow when unwatched, tamed wolves growl, a bell sends it walking back and it may take villagers with it).
- **Try a boss:** spawn its egg in creative (the fight starts where it stands), use a boss key (Stopped Clock Key, Pale Horn, Drowned Wedding Ring, Faceless Seal, Mire Effigy), or `/scriptevent siege:bestiary_summon reeve` (ids: reeve, huntsman, bride, seneschal, mother, warlord_king, oswin).
- **Loot:** each player who fought gets the boss's named relic the first time they beat it (materials on repeat kills), plus skill points. A shared vault chest appears where the boss fell.
- **Tweak:** boss numbers are at the top of each fight in `bosses.js`; spawn chances in `SPAWN_SETTINGS` in `spawns.js`; health, damage and speed in `roster.py`.

- **Stone Vigil**: a winged stone mourner. A statue while anyone looks at it (only a pickaxe chips it); it moves when unseen and its touch throws you somewhere nearby in the dark. To keep a placed one for good: `/event entity @e[type=siege:stone_vigil,r=4] siege:place`.
- **Seep sites** (endless, works alone): once the Hollow is awake, a Seep opens near a player now and then. Hollow things climb out and guard it; kill them, then break the Seep. Left alone it widens through three levels and then splits. Settings are at the top of `scripts/bestiary/seeps.js`. Fires `siege:seep_opened` and `siege:seep_closed`.
- **Solo-sized bosses**: every boss is tuned for one player and gets half again as tough per extra player in the arena (up to 10). Alone, the Drowned Bride gives you 18 seconds for her three bells instead of 10.
- **The Hollow's guardians**: under an NPC ruler (or an offline player ruler), mining the Hollow's ore without leave, or attacking the ruler, brings guardians sized to the party.
- **NPC fighters (champions)**: Rival Knight, Rival Sorcerer, Rival Lord and Retainer fight like a player: sword and bow by range, shield cycles (an axe breaks the guard), strafing, potions, a pearl to close the gap, role powers. Five tiers; tougher per extra player nearby. Try one: `/scriptevent siege:champion_summon knight 3 hostile` (roles knight, sorcerer, lord, retainer; stances hostile, realm, calm). Other features spawn them with `spawnChampion` from `scripts/bestiary/champions.js`.
- **Bodies**: our mobs, bosses and NPC fighters fall and lie where they died instead of puffing into smoke. They stay while monsters are still within 24 blocks, then sink into the ground (at least 45 seconds, at most 8 minutes, never more than 48 at once). Ghosts leave nothing. Settings are at the top of `scripts/bestiary/bodies.js`.
- **Gloamwing**: a ray-shaped flyer that only lives in the Hollow. A visitor is left alone for 5 minutes, then one arrives and another joins every 2 minutes (up to 6). Leaving the Hollow calls them off. Each drops a Gloamquill. Settings are at the top of `scripts/bestiary/gloam.js`.
