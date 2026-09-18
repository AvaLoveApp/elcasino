import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Users, Flame, ExternalLink, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { CHAIN, ADDR, readMidgard } from "../lib/chain";
import { fmtInt, short } from "../lib/util";
import { useProfiles } from "../lib/profileCache";
import { tierForBalance } from "../lib/holderTier";
import { TierBadge } from "./TierBadge";

type Holder = {
  address: string;
  balance: number;      // in whole MIDGARD
  excluded: boolean;    // pair / deployer / router don't decay
  share: number;        // % of totalSupply
};

const EXPLORER_TOKEN_HOLDERS = `${CHAIN.explorer}/api/v2/tokens/${ADDR.token}/holders`;

export function HoldersCard({ totalSupply, annualDecayPct }: { totalSupply: number; annualDecayPct: number }) {
  const [rows, setRows] = useState<Holder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [totalHolders, setTotalHolders] = useState<number | null>(null);
  const [pair, setPair] = useState<string>("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(EXPLORER_TOKEN_HOLDERS);
        if (!res.ok) throw new Error("blockscout " + res.status);
        const j: any = await res.json();
        const items: any[] = j.items || [];
        const m = readMidgard();
        // items already have balances in wei (string); addresses in `address.hash`
        const parsed: Holder[] = items.slice(0, 10).map((it) => {
          const addr = it.address?.hash || it.address;
          const bal = Number(formatUnits(it.value ?? "0", 18));
          return { address: addr, balance: bal, excluded: false, share: (bal / totalSupply) * 100 };
        });
        // Which of these are excluded from decay? Query token contract in parallel.
        // Also grab the primary pair so we can flag the LP row explicitly.
        const [excl, pp] = await Promise.all([
          Promise.all(parsed.map((h) => m.isExcluded(h.address).catch(() => false))),
          m.primaryPair().catch(() => ""),
        ]);
        parsed.forEach((h, i) => (h.excluded = !!excl[i]));
        if (live) { setRows(parsed); setPair(String(pp || "")); }
        // total holder count when Blockscout provides it
        if (typeof j.next_page_params?.items_count === "number") setTotalHolders(j.next_page_params.items_count);
      } catch (e: any) {
        if (live) setErr("Could not load holders from Blockscout.");
      }
    })();
    return () => { live = false; };
  }, [totalSupply]);

  const authorAddrs = (rows || []).map((r) => r.address);
  const profiles = useProfiles(authorAddrs);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-blood-400" />
          <h3 className="font-semibold text-sm">Top holders</h3>
        </div>
        <span className="font-mono text-[11px] text-bone-600">yearly decay ≈ balance × {annualDecayPct.toFixed(0)}%</span>
      </div>

      {err && <div className="text-blood-200 text-xs bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-3">{err}</div>}

      {rows === null && !err && <div className="text-center text-bone-400 text-sm py-6">Loading…</div>}

      {rows && (
        <div className="divide-y divide-ink-700/60 -mx-1">
          {rows.map((h, i) => {
            const prof = profiles[h.address.toLowerCase()];
            const name = prof?.displayName || prof?.username || short(h.address);
            const to = prof?.username ? `/u/${prof.username}` : `/a/${h.address}`;
            const decay = h.excluded ? 0 : (h.balance * annualDecayPct) / 100;
            const isLp = !!pair && h.address.toLowerCase() === pair.toLowerCase();
            return (
              <div key={h.address} className="flex items-center gap-3 px-1 py-2.5 text-sm">
                <span className="w-5 text-right font-mono text-xs text-bone-600 tabular-nums">{i + 1}</span>
                <Link to={to} className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{name}</span>
                  {prof?.username && <span className="font-mono text-xs text-blood-400 truncate">@{prof.username}</span>}
                  {!isLp && <TierBadge tier={tierForBalance(h.balance)} />}
                  {isLp ? (
                    <span title="Liquidity pool — burns faster than holders (φ-adaptive), never decays as a holder"
                      className="font-mono text-[10px] uppercase tracking-wider border border-cyan-500/50 text-cyan-300 bg-cyan-900/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                      <Droplets size={9} /> LP
                    </span>
                  ) : h.excluded && (
                    <span title="Excluded from decay (deployer or fee wallet)"
                      className="font-mono text-[10px] uppercase tracking-wider border border-ink-600 text-bone-400 rounded px-1.5 py-0.5">
                      exempt
                    </span>
                  )}
                </Link>
                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold tabular-nums">{fmtInt(h.balance)}</div>
                  <div className="text-[11px] text-bone-600 font-mono">{h.share.toFixed(2)}% supply</div>
                </div>
                <div className="w-28 text-right shrink-0">
                  <div className={`font-mono text-xs tabular-nums ${h.excluded ? "text-bone-600" : "text-blood-400"} inline-flex items-center gap-1`}>
                    <Flame size={11} />
                    {h.excluded ? "—" : `-${fmtInt(decay)}/yr`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-700/60">
          <a href={`${CHAIN.explorer}/token/${ADDR.token}?tab=holders`} target="_blank" rel="noreferrer"
             className="font-mono text-[11px] text-bone-400 hover:text-blood-400 inline-flex items-center gap-1">
            all holders <ExternalLink size={11} />
          </a>
          {totalHolders !== null && (
            <span className="font-mono text-[11px] text-bone-600">{fmtInt(totalHolders)} holders on-chain</span>
          )}
        </div>
      )}
    </div>
  );
}
