// Every number you might want to tweak.
// Split from the original main.js; the code is unchanged apart from the event/hook calls.


export const SETTINGS = {
  firstSiegeDay: 5, // no sieges before this day, so a new world has time to prepare
  siegeEveryNNights: 3, // after that, a siege comes every 3rd night (set to 1 for every night)
  assaultsPerSiege: 3, // each siege night has this many attack waves
  ticksBetweenAssaults: 600, // 20 ticks = 1 second, so 600 = 30 seconds
  spawnDistance: 24, // how far from your keep (or you) the raiders appear (blocks)
  marchRange: 10, // raiders farther than this from the keep keep marching toward it
  ballistaRange: 16, // how far a ballista can shoot (blocks)
  ballistaDamage: 5, // 5 = two and a half hearts
  ballistaReloadTicks: 30, // time between shots
  trebuchetReloadTicks: 200, // 10 seconds between trebuchet shots
  chargeFuseTicks: 80, // Breaching Charge fuse (4 seconds)
  gateMaxSize: 64, // max gate blocks that open together
  breachersFromSiege: 2, // battering rams and sappers join from a settlement's 2nd siege on
  ramSwingTicks: 40, // your own Battering Ram can swing every 2 seconds
};
