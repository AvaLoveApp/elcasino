import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress } from "ethers";
import {
  Landmark, Wallet, PlusCircle, Trash2, RefreshCw, Users, Check,
  Cloud, CloudOff, ExternalLink, Scale, TrendingDown,
} from "lucide-react";
import { CHAIN, ADDR } from "../lib/chain";
import { short } from "../lib/util";
import { useWallet } from "../lib/wallet";
import {
  loadWallets, addWallet, removeWallet, computeMMStats, loadTopHolders,
  type TreasuryWallet, type MMStats, type HolderRow,
} from "../lib/treasury";

// ── formatters ────────────────────────────────────────────────────────────────
function fmtAmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(3) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtUsd(n: number): string {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 });
}
function fmtEth(n: number): string {
  if (!isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return (n / 1000).toFixed(2) + "K Ξ";
  if (n >= 1) return n.toFixed(3) + " Ξ";
  return n.toFixed(5) + " Ξ";
}
function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(n < 1 ? 3 : n < 10 ? 2 : 1) + "%";
}

export function MarketMakerPanel() {
  const w = useWallet();
  const [wallets, setWallets] = useState<TreasuryWallet[]>([]);
  const [synced, setSynced] = useState(false);
  const [stats, setStats] = useState<MMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refreshStats = useCallback(async (list: TreasuryWallet[]) => {
    try {
      setStats(await computeMMStats(list));
      setErr(null);
    } catch {
      setErr("Could not read on-chain balances. RPC may be rate-limiting — retry.");
    }
  }, []);

  // Initial load: pull the treasury set, then compute stats.
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { rows, synced } = await loadWallets();
      if (!live) return;
      setWallets(rows);
      setSynced(synced);
      await refreshStats(rows);
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, [refreshStats]);

  const onAdd = useCallback(async (address: string, label: string) => {
    const addr = address.toLowerCase();
    const next = [...wallets.filter((x) => x.address !== addr), { address: addr, label }];
    setWallets(next);
    await addWallet({ address: addr, label }, w.address || undefined);
    const { synced } = await loadWallets();
    setSynced(synced);
    refreshStats(next);
  }, [wallets, w.address, refreshStats]);

  const onRemove = useCallback(async (address: string) => {
    const next = wallets.filter((x) => x.address !== address.toLowerCase());
    setWallets(next);
    await removeWallet(address);
    refreshStats(next);
  }, [wallets, refreshStats]);

  const inTreasury = useMemo(
    () => new Set(wallets.map((x) => x.address.toLowerCase())),
    [wallets],
  );

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1 text-blood-400">
        <Landmark size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Market maker · treasury</span>
        <span
          title={synced ? "Synced to Supabase" : "Stored locally on this device (Supabase not reachable / mm_wallets table missing)"}
          className={`ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
            synced ? "text-emerald-400 border-emerald-500/40" : "text-amber-400 border-amber-500/40"
          }`}>
          {synced ? <Cloud size={11} /> : <CloudOff size={11} />} {synced ? "synced" : "local"}
        </span>
        <button
          onClick={() => refreshStats(wallets)}
          className="text-bone-400 hover:text-blood-400 transition"
          title="Refresh on-chain figures">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-sm text-bone-400 mb-4">
        Tag the wallets that are <b className="text-bone-200">ours</b> (deployer bag, MM wallets, cold storage).
        We total how much supply we hold and show the <b className="text-bone-200">free float</b> — the burn-excluded
        supply outside our bag — with its live ETH and USD value, so you know exactly how much sell-side you're making a market for.
      </p>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <StatGrid stats={stats} />
      <ValueBreakdown stats={stats} />
      <TreasuryList
        balances={stats?.balances || wallets.map((x) => ({ ...x, balance: 0, excluded: false, share: 0 }))}
        stats={stats}
        onRemove={onRemove}
      />
      <AddWallet inTreasury={inTreasury} onAdd={onAdd} />
      <HolderPicker inTreasury={inTreasury} onAdd={onAdd} onRemove={onRemove} />
    </div>
  );
}

// ── KPI grid ──────────────────────────────────────────────────────────────────
function StatGrid({ stats }: { stats: MMStats | null }) {
  const cells: { k: string; v: string; sub?: string; tone?: "gain" | "loss" | "brand" }[] = [
    { k: "Total supply", v: stats ? fmtAmt(stats.totalSupply) : "…", sub: "ERC-20 totalSupply" },
    { k: "Supply ex-burn", v: stats ? fmtAmt(stats.effectiveSupply) : "…", sub: stats ? `${fmtAmt(stats.deadHeld)} at burn addrs` : "yanıklar dışı" },
    { k: "We hold", v: stats ? fmtAmt(stats.ourHoldings) : "…", sub: stats ? `across ${stats.balances.length} wallet${stats.balances.length === 1 ? "" : "s"}` : undefined, tone: "brand" },
    { k: "Our share", v: stats ? fmtPct(stats.ourShareOfTotal) : "…", sub: stats ? `${fmtPct(stats.ourShareOfEffective)} of float basis` : "of total supply", tone: "brand" },
    { k: "Free float", v: stats ? fmtAmt(stats.float) : "…", sub: "diluted supply, not ours", tone: "loss" },
    { k: "ELCAS price", v: stats && stats.hasPrice ? fmtUsd(stats.midUsd) : "—", sub: stats && stats.hasPrice ? fmtEth(stats.price) + " / ELCAS" : "no pair priced" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
      {cells.map((c) => (
        <div key={c.k} className="rounded-xl border border-ink-700/70 bg-ink-900/40 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-bone-500">{c.k}</div>
          <div className={`text-lg font-bold tabular-nums mt-0.5 ${
            c.tone === "brand" ? "text-blood-300" : c.tone === "loss" ? "text-amber-300" : "text-bone-50"
          }`}>{c.v}</div>
          {c.sub && <div className="font-mono text-[10px] text-bone-600 mt-0.5 truncate">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── value breakdown (the market-making numbers) ───────────────────────────────
function ValueBreakdown({ stats }: { stats: MMStats | null }) {
  if (!stats) return null;
  const rows = [
    { icon: <Wallet size={14} className="text-blood-400" />, k: "Our bag", amt: stats.ourHoldings, tone: "brand" as const,
      note: "value of the supply we control" },
    { icon: <TrendingDown size={14} className="text-amber-400" />, k: "Free float (sell-side)", amt: stats.float, tone: "loss" as const,
      note: "burn-excluded supply outside our bag" },
    { icon: <Scale size={14} className="text-bone-300" />, k: "Diluted supply", amt: stats.effectiveSupply, tone: "neutral" as const,
      note: "fully-diluted valuation, ex-burn" },
  ];
  return (
    <div className="rounded-xl border border-ink-700/70 overflow-hidden mb-4">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] bg-ink-900/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-bone-500">
        <span>Valuation @ live price</span>
        <span className="text-right">Ξ ETH</span>
        <span className="text-right">$ USD</span>
      </div>
      <div className="divide-y divide-ink-700/60">
        {rows.map((r) => {
          const eth = r.amt * stats.price;
          const usd = eth * stats.ethUsd;
          return (
            <div key={r.k} className="grid grid-cols-[1.4fr_1fr_1fr] items-center px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-bone-100">{r.icon}{r.k}</div>
                <div className="font-mono text-[10px] text-bone-600 mt-0.5 truncate">{fmtAmt(r.amt)} ELCAS · {r.note}</div>
              </div>
              <div className={`text-right font-mono text-sm tabular-nums ${r.tone === "brand" ? "text-blood-300" : r.tone === "loss" ? "text-amber-300" : "text-bone-200"}`}>
                {stats.hasPrice ? fmtEth(eth) : "—"}
              </div>
              <div className={`text-right font-mono text-sm font-bold tabular-nums ${r.tone === "brand" ? "text-blood-300" : r.tone === "loss" ? "text-amber-300" : "text-bone-100"}`}>
                {stats.hasPrice && stats.ethUsd > 0 ? fmtUsd(usd) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-ink-900/40 px-3 py-1.5 font-mono text-[10px] text-bone-600">
        ETH ≈ {stats.ethUsd > 0 ? fmtUsd(stats.ethUsd) : "—"} · updated {new Date(stats.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ── treasury wallet list ──────────────────────────────────────────────────────
function TreasuryList({
  balances, stats, onRemove,
}: {
  balances: { address: string; label: string; balance: number; excluded: boolean; share: number }[];
  stats: MMStats | null;
  onRemove: (a: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Wallet size={13} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">Our wallets</span>
        <span className="font-mono text-[10px] text-bone-600">{balances.length}</span>
      </div>
      {balances.length === 0 ? (
        <div className="text-sm text-bone-500 border border-dashed border-ink-700 rounded-lg px-3 py-4 text-center">
          No treasury wallets yet — add one below or pick from holders.
        </div>
      ) : (
        <div className="divide-y divide-ink-700/60 rounded-xl border border-ink-700/70 overflow-hidden">
          {balances.map((h) => {
            const eth = stats ? h.balance * stats.price : 0;
            const usd = stats ? eth * stats.ethUsd : 0;
            return (
              <div key={h.address} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {h.label
                      ? <span className="text-sm font-semibold text-bone-100 truncate">{h.label}</span>
                      : <span className="text-sm font-mono text-bone-200">{short(h.address)}</span>}
                    {h.excluded && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 border border-emerald-500/40 rounded px-1 py-0.5">
                        no-decay
                      </span>
                    )}
                  </div>
                  <a href={`${CHAIN.explorer}/address/${h.address}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-bone-600 hover:text-blood-400">
                    {short(h.address)} <ExternalLink size={9} />
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm tabular-nums text-bone-100">{fmtAmt(h.balance)}</div>
                  <div className="font-mono text-[10px] text-bone-600 tabular-nums">
                    {fmtPct(h.share)}{stats && stats.hasPrice ? ` · ${stats.ethUsd > 0 ? fmtUsd(usd) : fmtEth(eth)}` : ""}
                  </div>
                </div>
                <button onClick={() => onRemove(h.address)} title="Remove from treasury"
                  className="text-bone-500 hover:text-blood-400 transition shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── add a wallet by address ───────────────────────────────────────────────────
function AddWallet({
  inTreasury, onAdd,
}: {
  inTreasury: Set<string>;
  onAdd: (address: string, label: string) => void;
}) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const valid = isAddress(addr);
  const dup = valid && inTreasury.has(addr.toLowerCase());

  const quick = ["Deployer bag", "MM wallet", "Cold storage"];

  return (
    <div className="border-t border-ink-700/60 pt-3 mb-1">
      <div className="flex items-center gap-2 mb-2">
        <PlusCircle size={13} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">Add a wallet</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x… wallet address"
          className="field font-mono text-xs py-2 flex-1" />
        <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 60))} placeholder="label (optional)"
          className="field text-xs py-2 sm:w-40" />
        <button
          onClick={() => { onAdd(addr, label.trim()); setAddr(""); setLabel(""); }}
          disabled={!valid || dup}
          className="btn-primary py-2 px-4 text-sm whitespace-nowrap">
          {dup ? "Already added" : "Add wallet"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {quick.map((q) => (
          <button key={q} onClick={() => setLabel(q)}
            className="text-[11px] font-mono rounded-full border border-ink-600 text-bone-400 hover:border-blood-500/50 px-2.5 py-1 transition">
            {q}
          </button>
        ))}
      </div>
      {addr && !valid && <div className="text-blood-300 text-[11px] font-mono mt-1.5">Not a valid address.</div>}
    </div>
  );
}

// ── pick from top holders (Blockscout) ────────────────────────────────────────
function HolderPicker({
  inTreasury, onAdd, onRemove,
}: {
  inTreasury: Set<string>;
  onAdd: (address: string, label: string) => void;
  onRemove: (a: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HolderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setRows(await loadTopHolders(25)); }
    catch { setErr("Could not load holders from Blockscout."); }
  }, []);

  useEffect(() => { if (open && rows === null) load(); }, [open, rows, load]);

  return (
    <div className="border-t border-ink-700/60 pt-3">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left group">
        <Users size={13} className="text-blood-400" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400 group-hover:text-bone-200">
          Pick from top holders
        </span>
        <span className="ml-auto font-mono text-[10px] text-bone-600">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="mt-2">
          {err && <div className="text-blood-200 text-xs mb-2">{err}</div>}
          {rows === null && !err && <div className="text-bone-500 text-sm py-3 text-center">Loading holders…</div>}
          {rows && (
            <div className="divide-y divide-ink-700/60 rounded-xl border border-ink-700/70 overflow-hidden max-h-80 overflow-y-auto">
              {rows.map((h, i) => {
                const picked = inTreasury.has(h.address);
                return (
                  <div key={h.address} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-5 text-right font-mono text-[11px] text-bone-600 tabular-nums">{i + 1}</span>
                    <a href={`${CHAIN.explorer}/address/${h.address}`} target="_blank" rel="noreferrer"
                      className="font-mono text-xs text-bone-200 hover:text-blood-400 inline-flex items-center gap-1 flex-1 min-w-0 truncate">
                      {short(h.address)} <ExternalLink size={9} />
                    </a>
                    <span className="font-mono text-[11px] text-bone-400 tabular-nums shrink-0">{fmtAmt(h.balance)}</span>
                    <span className="font-mono text-[10px] text-bone-600 tabular-nums w-14 text-right shrink-0">{fmtPct(h.share)}</span>
                    {picked ? (
                      <button onClick={() => onRemove(h.address)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 text-emerald-400 px-2 py-0.5 text-[11px] font-medium hover:border-blood-500 hover:text-blood-400 transition shrink-0">
                        <Check size={11} /> ours
                      </button>
                    ) : (
                      <button onClick={() => onAdd(h.address, "")}
                        className="inline-flex items-center gap-1 rounded-full border border-ink-600 text-bone-300 px-2 py-0.5 text-[11px] font-medium hover:border-blood-500/60 hover:text-blood-300 transition shrink-0">
                        <PlusCircle size={11} /> add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="font-mono text-[10px] text-bone-600 mt-1.5">
            Token · <a href={`${CHAIN.explorer}/token/${ADDR.token}`} target="_blank" rel="noreferrer" className="hover:text-blood-400">{short(ADDR.token)}</a> on {CHAIN.name}
          </div>
        </div>
      )}
    </div>
  );
}
