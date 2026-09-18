import { formatUnits, ZeroAddress } from "ethers";
import { supabase } from "./supabase";
import { readMidgard, readPair, ADDR, CHAIN } from "./chain";
import { dexPricesUsd } from "./dexscreener";

/**
 * Market-Maker treasury data layer.
 *
 * The registry owner tags a set of wallets as "ours" (deployer bag, MM wallets,
 * cold storage). We persist that set in Supabase (`mm_wallets`) so it follows the
 * owner across devices, and mirror it into localStorage so the panel still works
 * offline / before the table exists. Reads are cheap on-chain balance lookups.
 *
 * From that set we derive the numbers a market maker actually needs:
 *   • how much supply we hold, and in which wallets
 *   • our share of total supply
 *   • the burn-excluded ("effective") supply and the free float outside our bag
 *   • the ETH and USD value of that float — i.e. the real sell-side we market-make
 */

export type TreasuryWallet = { address: string; label: string };

const LS_KEY = "mm.treasury.wallets.v1";

// Tokens sitting at these addresses are burned-in-spirit but usually still count
// in totalSupply(), so we subtract them to get the burn-excluded supply.
export const BURN_ADDRS = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dEaD",
];

// ── persistence ─────────────────────────────────────────────────────────────

function loadLocal(): TreasuryWallet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r) => r && typeof r.address === "string")
      .map((r) => ({ address: String(r.address).toLowerCase(), label: String(r.label || "") }));
  } catch {
    return [];
  }
}

function saveLocal(rows: TreasuryWallet[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

/** Load the treasury set. `synced` is true when it came from Supabase. */
export async function loadWallets(): Promise<{ rows: TreasuryWallet[]; synced: boolean }> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("mm_wallets")
        .select("address,label,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows: TreasuryWallet[] = (data || []).map((r: any) => ({
        address: String(r.address).toLowerCase(),
        label: String(r.label || ""),
      }));
      saveLocal(rows); // keep the offline mirror fresh
      return { rows, synced: true };
    } catch {
      /* table missing or offline → fall back to local */
    }
  }
  return { rows: loadLocal(), synced: false };
}

/** Add / update a treasury wallet. Returns whether it reached Supabase. */
export async function addWallet(w: TreasuryWallet, by?: string): Promise<boolean> {
  const address = w.address.toLowerCase();
  const label = (w.label || "").slice(0, 60);
  const rows = loadLocal().filter((r) => r.address !== address);
  rows.push({ address, label });
  saveLocal(rows);
  if (supabase) {
    try {
      const { error } = await supabase
        .from("mm_wallets")
        .upsert({ address, label, added_by: by ? by.toLowerCase() : null });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Remove a treasury wallet from both stores. */
export async function removeWallet(address: string): Promise<void> {
  const addr = address.toLowerCase();
  saveLocal(loadLocal().filter((r) => r.address !== addr));
  if (supabase) {
    try {
      await supabase.from("mm_wallets").delete().eq("address", addr);
    } catch {
      /* non-fatal */
    }
  }
}

// ── stats ───────────────────────────────────────────────────────────────────

export type WalletBalance = {
  address: string;
  label: string;
  balance: number; // whole MIDGARD
  excluded: boolean; // excluded from decay (pair/deployer/router)
  share: number; // % of total supply
};

export type MMStats = {
  price: number; // ETH per MIDGARD (from primary pair reserves)
  ethUsd: number; // USD per ETH (DexScreener WETH)
  midUsd: number; // USD per MIDGARD (price × ethUsd)
  hasPrice: boolean;

  totalSupply: number;
  contractBurned: number; // totalBurned() — already removed from supply
  deadHeld: number; // sitting at 0x0 / 0xdead, still counted in totalSupply
  effectiveSupply: number; // totalSupply − deadHeld  ("yanıklar dışı")

  ourHoldings: number; // Σ treasury balances
  ourShareOfTotal: number; // %
  ourShareOfEffective: number; // %
  float: number; // effectiveSupply − ourHoldings (diluted supply outside our bag)

  balances: WalletBalance[];
  fetchedAt: number;
};

/** Read every number the MM dashboard shows in one coalesced batch. */
export async function computeMMStats(wallets: TreasuryWallet[]): Promise<MMStats> {
  const m = readMidgard();

  const [supply, burned, pair, deadBals, treasuryBals] = await Promise.all([
    m.totalSupply(),
    m.totalBurned().catch(() => 0n),
    m.primaryPair().catch(() => ZeroAddress),
    Promise.all(BURN_ADDRS.map((a) => m.balanceOf(a).catch(() => 0n))),
    Promise.all(
      wallets.map(async (w) => {
        const [b, ex] = await Promise.all([
          m.balanceOf(w.address).catch(() => 0n),
          m.isExcluded(w.address).catch(() => false),
        ]);
        return { w, balance: Number(formatUnits(b, 18)), excluded: !!ex };
      }),
    ),
  ]);

  // Price in ETH from the primary pair reserves.
  let price = 0;
  if (pair && pair !== ZeroAddress) {
    try {
      const p = readPair(pair);
      const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
      const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
      const poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
      const poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
      price = poolMid ? poolEth / poolMid : 0;
    } catch {
      /* leave price at 0 */
    }
  }

  // ETH → USD from DexScreener's WETH pair.
  let ethUsd = 0;
  try {
    const pm = await dexPricesUsd([ADDR.weth]);
    ethUsd = pm.get(ADDR.weth.toLowerCase()) ?? 0;
  } catch {
    /* leave at 0 → USD columns render "—" */
  }

  const totalSupply = Number(formatUnits(supply, 18));
  const contractBurned = Number(formatUnits(burned, 18));
  const deadHeld = deadBals.reduce((s, b) => s + Number(formatUnits(b, 18)), 0);
  const effectiveSupply = Math.max(0, totalSupply - deadHeld);

  const balances: WalletBalance[] = treasuryBals
    .map((x) => ({
      address: x.w.address,
      label: x.w.label,
      balance: x.balance,
      excluded: x.excluded,
      share: totalSupply ? (x.balance / totalSupply) * 100 : 0,
    }))
    .sort((a, b) => b.balance - a.balance);

  const ourHoldings = balances.reduce((s, x) => s + x.balance, 0);
  const float = Math.max(0, effectiveSupply - ourHoldings);

  return {
    price,
    ethUsd,
    midUsd: price * ethUsd,
    hasPrice: price > 0,
    totalSupply,
    contractBurned,
    deadHeld,
    effectiveSupply,
    ourHoldings,
    ourShareOfTotal: totalSupply ? (ourHoldings / totalSupply) * 100 : 0,
    ourShareOfEffective: effectiveSupply ? (ourHoldings / effectiveSupply) * 100 : 0,
    float,
    balances,
    fetchedAt: Date.now(),
  };
}

// ── top holders (Blockscout) ─────────────────────────────────────────────────

export type HolderRow = { address: string; balance: number; share: number };

/** Top holders from Blockscout, for the "pick from holders" selector. */
export async function loadTopHolders(limit = 25): Promise<HolderRow[]> {
  const res = await fetch(`${CHAIN.explorer}/api/v2/tokens/${ADDR.token}/holders`);
  if (!res.ok) throw new Error("blockscout " + res.status);
  const j: any = await res.json();
  const items: any[] = j.items || [];
  const m = readMidgard();
  const totalSupply = Number(formatUnits(await m.totalSupply(), 18));
  return items.slice(0, limit).map((it) => {
    const balance = Number(formatUnits(it.value ?? "0", 18));
    return {
      address: String(it.address?.hash || it.address || "").toLowerCase(),
      balance,
      share: totalSupply ? (balance / totalSupply) * 100 : 0,
    };
  });
}
