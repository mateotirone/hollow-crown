// The Mason, the Foundation Stone and wall repair charge in the world currency (scripts/economy/).
// One lot (the unit every settle price is written in, once an emerald) is 8 coins.

import { WALLET, fromEmeralds } from "../economy/api.js";
import { setWallet } from "./wallet.js";

setWallet({ ...WALLET, lot: fromEmeralds(1) });
