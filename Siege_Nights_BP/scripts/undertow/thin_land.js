// Made by map/thinplaces/land.py from the map's own heights. Do not edit by hand: run the tool again.
// floor: the top ground block outside the cave mouth. probes: [x, z, y] columns of the shaped land; the game
// builds on the shaped land only where it finds them (thinplaces.js landOf), so an older world still works.
export const THIN_LAND = {
  kings_barrow: { floor: 70, probes: [[97, 510, 83], [112, 507, 81], [82, 507, 76]] },
  bellfounders_mine: { floor: 80, probes: [[557, -480, 118], [572, -480, 119], [617, -405, 116], [587, -477, 120], [599, -468, 120]] },
  frostvein_hollow: { floor: 145, probes: [[-682, -1140, 188], [-667, -1140, 187], [-640, -1020, 198], [-625, -1140, 189], [-709, -1059, 189]] },
  drowned_chapel: { floor: 64, probes: [[-894, -917, 101], [-885, -836, 64], [-891, -902, 100], [-885, -800, 98], [-870, -803, 98]] },
  witchroot_caves: { floor: 69, probes: [[-246, 876, 84], [-267, 876, 84], [-258, 888, 83], [-273, 834, 70], [-279, 852, 70]] },
  saltglass_grotto: { floor: 94, probes: [[1050, 723, 112], [1062, 732, 109], [1041, 735, 109], [1032, 720, 104], [1008, 747, 94]] },
  sunken_quarry: { floor: 72, probes: [[529, 1172, 72], [529, 1187, 73], [538, 1148, 74], [544, 1187, 81], [526, 1136, 90]] },
};
