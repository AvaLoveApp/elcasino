import { useEffect, useState } from "react";
import { formatUnits, Contract } from "ethers";
import { Wallet, ExternalLink } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readProvider, readRouter, ADDR, ERC20_ABI, CHAIN } from "../lib/chain";
import { RWA_PRESETS } from "../lib/rwa";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark } from "./UnitMark";

/**
 * Live "your bag" panel for the connected wallet. For every preset RWA with an
 * address, reads balanceOf(wallet) and (if the balance is non-zero) quotes it
 * to ETH through the UniV2 router — so users see what they hold in one glance
 * with a live dollar-adjacent number.
 */
type Row = {
  key: string;
  label: string;
  address: string;
  logo?: string;
  color: string;
  short: string;
  decimals: number;
  balance: bigint;
  ethValue: number;   // 0 when we can't quote (no path or empty pair)
};

export function RwaHoldings() {
  const w = useWallet();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totalEth, setTotalEth] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!w.address) { setRows(null); return; }
    let live = true;
    async function poll() {
      try {
        const targets = RWA_PRESETS.filter((p) => p.address);
        const router = readRouter();
        const results = await Promise.all(targets.map(async (p) => {
          const c = new Contract(p.address!, ERC20_ABI, readProvider);
          const [bal, dec] = await Promise.all([
            c.balanceOf(w.address!).catch(() => 0n),
            c.decimals().catch(() => 18),
          ]);
          let ethValue = 0;
          if (bal > 0n) {
            if (p.address!.toLowerCase() === ADDR.weth.toLowerCase()) {
              ethValue = Number(formatUnits(bal, Number(dec)));
            } else {
              try {
                const amounts: bigint[] = await router.getAmountsOut(bal, [p.address!, ADDR.weth]);
                ethValue = Number(formatUnits(amounts[amounts.length - 1], 18));
              } catch { /* no pair or shallow — skip */ }
            }
          }
          return {
            key: p.key, label: p.label, address: p.address!, logo: p.logo, color: p.color, short: p.short,
            decimals: Number(dec), balance: bal, ethValue,
          } as Row;
        }));
        if (!live) return;
        const held = results.filter((r) => r.balance > 0n);
        held.sort((a, b) => b.ethValue - a.ethValue);
        setRows(held);
        setTotalEth(held.reduce((s, r) => s + r.ethValue, 0));
        setErr(null);
      } catch { if (live) setErr("Could not read your bag."); }
    }
    poll();
    const h = setInterval(poll, 20_000);
    return () => { live = false; clearInterval(h); };
  }, [w.address]);

  if (!w.address) return null;

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3 text-blood-400">
        <Wallet size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Your bag</span>
        <span className="ml-auto font-mono text-[11px] text-bone-500">
          total ≈ <span className="text-bone-200 inline-flex items-center gap-0.5">{fmtPrice(totalEth)} <EthMark />ETH</span>
        </span>
      </div>

      {err && <div className="text-blood-200 text-xs mb-2">{err}</div>}

      {rows === null && <div className="text-center text-bone-500 text-sm py-4">Loading…</div>}

      {rows && rows.length === 0 && (
        <div className="text-center text-bone-500 text-sm py-4">
          Empty. Claim WETH → RWA above, or buy any listed asset.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="divide-y divide-ink-700/60">
          {rows.map((r) => {
            const amount = Number(formatUnits(r.balance, r.decimals));
            return (
              <a key={r.key} href={`${CHAIN.explorer}/token/${r.address}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 py-2.5 hover:bg-ink-850/40 -mx-1 px-1 rounded transition">
                <span className="relative h-8 w-8 rounded-full overflow-hidden ring-1 ring-ink-600 shrink-0"
                  style={{ background: `linear-gradient(140deg, ${r.color}, rgba(0,0,0,0.5))` }}>
                  {r.logo && (
                    <img src={r.logo} alt={r.label} className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                  {!r.logo && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-bone-50">{r.short}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{r.label}</div>
                  <div className="font-mono text-[11px] text-bone-500 truncate">{amount < 0.001 ? amount.toFixed(6) : fmtInt(amount)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm tabular-nums">{fmtPrice(r.ethValue)}</div>
                  <div className="font-mono text-[10px] text-bone-500 inline-flex items-center gap-0.5"><EthMark />ETH</div>
                </div>
                <ExternalLink size={11} className="text-bone-600" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
