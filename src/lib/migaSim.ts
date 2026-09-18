/**
 * Shared EL-Casino ($ELCAS) economy model — a faithful JS port of the
 * on-chain differential-decay mechanics. Used by BOTH the interactive
 * EconomySimulator and the compact "year-end estimate" badges, so the badge
 * always equals the simulator's default (current-state) projection.
 */
export type MigaRow = { m: number; price: number; poolMid: number; holder: number; cumBurn: number };

function smoothstep(x: number, lo: number, hi: number) {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

export type SimOpts = {
  lpPct: number;    // φ, 0..1
  hbase: number;    // holder decay base, fraction/yr
  target: number;   // target spread, fraction/yr
  heal: number;     // self-heal magnitude, fraction/yr
  fee: number;      // total swap fee, fraction
  volumeX: number;  // annual swap volume as a multiple of the pool
  months: number;
  shockPct: number; // shock buy at shockMonth, fraction of pool
  shockMonth: number;
};

export function simulateMiga(o: SimOpts): MigaRow[] {
  const phiFloor = 0.08, phiHi = 0.35;
  let R = Math.max(0.001, o.lpPct), H = Math.max(0.001, 1 - o.lpPct), E = 1;
  const price0 = E / R;
  let cumBurn = 0, holder = 1;
  const rows: MigaRow[] = [{ m: 0, price: 1, poolMid: R, holder: 1, cumBurn: 0 }];
  const perMonthVol = o.volumeX / 12;
  for (let m = 1; m <= o.months; m++) {
    const phi = R / (R + H);
    const s = smoothstep(phi, phiFloor, phiHi);
    const spread = -o.heal + (o.target + o.heal) * s;
    const hRaw = o.hbase * (1 - phi);
    let hRate: number, pRate: number;
    if (spread >= 0) { hRate = hRaw; pRate = hRaw + spread; } else { hRate = hRaw + (-spread); pRate = hRaw; }
    const hMo = 1 - Math.pow(1 - hRate, 1 / 12), pMo = 1 - Math.pow(1 - pRate, 1 / 12);
    const burn = R * pMo; R -= burn; cumBurn += burn;
    H *= (1 - hMo); holder *= (1 - hMo);
    let vol = E * perMonthVol; if (m === o.shockMonth) vol += E * o.shockPct;
    const buy = vol * 0.52, sell = vol * 0.48;
    if (buy > 0) { const dR = R * buy / (E + buy); R -= dR; E += buy; const f = dR * o.fee; H += dR - f; }
    if (sell > 0 && E > 0) { const price = E / R; const mi = Math.min(sell / price, H * 0.5); const f = mi * o.fee; const ma = mi - f; const eo = E * ma / (R + ma); R += ma; E -= eo; H -= mi; }
    rows.push({ m, price: (E / R) / price0, poolMid: R / Math.max(rows[0].poolMid, 1e-9), holder, cumBurn });
  }
  return rows;
}

export type YearEnd = { priceX: number; holderValueX: number; holderTokenPct: number; poolMidPct: number; netPct: number };

/**
 * Neutral-scenario year-end projection from the LIVE on-chain state. Same inputs
 * the simulator defaults to (φ, current holder/pool rates, fee, 12× volume), so
 * this equals the simulator's default output and updates as the economy changes.
 * All annual inputs are PERCENTAGES (e.g. holderAnnual = 21).
 */
export function projectYearEnd(phi: number, holderAnnualPct: number, poolAnnualPct: number, feeTotalPct: number, volumeX = 12): YearEnd {
  const spread = Math.max(0, poolAnnualPct - holderAnnualPct);
  const rows = simulateMiga({
    lpPct: Math.max(0.01, Math.min(0.99, phi)),
    hbase: holderAnnualPct / 100,
    target: spread / 100,
    heal: 0.15,
    fee: (feeTotalPct || 4) / 100,
    volumeX,
    months: 12,
    shockPct: 0,
    shockMonth: 6,
  });
  const last = rows[rows.length - 1];
  const holderValueX = last.holder * last.price;
  return {
    priceX: last.price,
    holderValueX,
    holderTokenPct: last.holder * 100,
    poolMidPct: last.poolMid * 100,
    netPct: (holderValueX - 1) * 100,
  };
}
