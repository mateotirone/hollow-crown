// Made by map/thinplaces/land.py from the map's own heights. Do not edit by hand: run the tool again.
// floor: the top ground block outside the cave mouth. probes: [x, z, y] columns of the shaped land; the game
// builds on the shaped land only where it finds them (thinplaces.js landOf), so an older world still works.
export const THIN_LAND = {
  kings_barrow: { floor: 70, probes: [[95, 510, 83], [105, 508, 83], [85, 506, 78], [115, 508, 80], [101, 518, 79]] },
  bellfounders_mine: { floor: 80, probes: [[556, -480, 118], [566, -480, 119], [576, -480, 119], [586, -478, 120], [598, -472, 120]] },
  frostvein_hollow: { floor: 145, probes: [[-639, -1020, 198], [-681, -1140, 188], [-667, -1140, 187], [-625, -1140, 189], [-691, -1136, 189]] },
  drowned_chapel: { floor: 64, probes: [[-896, -918, 101], [-886, -920, 101], [-904, -912, 99], [-894, -908, 100], [-884, -838, 64]] },
  witchroot_caves: { floor: 69, probes: [[-245, 876, 84], [-255, 884, 84], [-245, 886, 83], [-269, 880, 84], [-259, 872, 83]] },
  saltglass_grotto: { floor: 94, probes: [[1048, 724, 112], [1050, 734, 111], [1058, 724, 109], [1038, 718, 107], [1040, 732, 109]] },
  sunken_quarry: { floor: 72, probes: [[530, 1172, 72], [530, 1182, 72], [542, 1146, 74], [542, 1174, 74], [538, 1188, 78]] },
};
