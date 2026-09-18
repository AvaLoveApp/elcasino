import { useEffect, useState } from "react";
import { Activity, Users, Flame, Sparkles, Coins, Droplets, ArrowLeftRight } from "lucide-react";
import { loadTokenStats, TokenStats } from "../lib/analytics";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark, MidMark } from "../components/UnitMark";
import { loadTokenMeta, TokenMeta } from "../lib/tokenMeta";
import { EconomyEngine } from "../components/EconomyEngine";
import { TokenCharts } from "../components/TokenCharts";

export default function AnalyticsPage() {
  const [tok, setTok] = useState<TokenStats | null>(null);
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<boolean>(() => {
    try { return localStorage.getItem("midgard.analytics.log") === "1"; }
    catch { return false; }
  });
  const toggleLog = () => setLog((v) => {
    const next = !v;
    try { localStorage.setItem("midgard.analytics.log", next ? "1" : "0"); } catch {}
    return next;
  });

  // Robinhood's RPC drops requests under load (duplicate CORS header). Retry
  // each loader independently so a hiccup on one section doesn't blank the other.
  useEffect(() => {
    let live = true;
    async function tryLoad<T>(fn: () => Promise<T>, setter: (v: T) => void, label: string, tries = 5) {
      for (let i = 0; i < tries && live; i++) {
        try {
          const v = await fn();
          if (live) { setter(v); setErr(null); return; }
        } catch {
          if (i === tries - 1 && live) setErr(`Failed to load ${label}`);
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    }
    (async () => {
      await tryLoad(loadTokenStats, setTok, "token stats");
      loadTokenMeta().then((m) => { if (live) setMeta(m); }).catch(() => {});
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="animate-fade-up">
      <div className="overflow-hidden rounded-xl border border-blood-500/25 bg-ink-950/70 shadow-[0_0_50px_-18px_rgba(147,224,20,0.45)]"
        style={{ backgroundImage: "linear-gradient(rgba(147,224,20,0.025) 1px, transparent 1px)", backgroundSize: "100% 3px" }}>
        {/* Terminal title bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 bg-ink-900/80 px-3 sm:px-4 py-2 font-mono text-[11px]">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-blood-500/80" />
          </span>
          <span className="ml-1 text-bone-500">elcas@chain</span><span className="text-bone-600">:~$</span>
          <span className="mg-neon font-bold">terminal --live</span>
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-400 mg-live-dot" /> streaming
          </span>
          <div className="ml-auto inline-flex text-[10px] uppercase tracking-wider rounded-md border border-ink-600 overflow-hidden">
            <button onClick={toggleLog} className={`px-3 py-1 transition ${!log ? "bg-blood-900/40 text-blood-200" : "text-bone-500 hover:text-bone-200"}`}>linear</button>
            <button onClick={toggleLog} className={`px-3 py-1 transition ${log ? "bg-blood-900/40 text-blood-200" : "text-bone-500 hover:text-bone-200"}`}>log</button>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-5">
          <p className="font-mono text-[11px] text-bone-500">
            <span className="text-blood-400">›</span> every tile & tick derived from on-chain events — no server, no cache.
          </p>
          {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-xl px-4 py-3">{err}</div>}

          <section>
            <SectionTitle icon={<Coins size={14} />} label="ELCAS token" />
            <EconomyEngine />
            <div className="mt-4">
              {tok ? <TokenBlock s={tok} log={log} meta={meta} /> : <Skeleton lines={6} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-blood-400">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
    </div>
  );
}

function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="panel p-4 h-40 skeleton" />
      ))}
    </div>
  );
}

function Tile({ k, v, sub, icon, accent }: { k: string; v: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; accent?: "blood" | "emerald" | "amber" }) {
  const color = accent === "blood" ? "text-blood-400"
    : accent === "emerald" ? "text-emerald-400"
    : accent === "amber" ? "text-amber-400"
    : "text-bone-100";
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bone-400 font-mono">{icon}{k}</div>
      <div className={`font-mono font-semibold text-xl mt-1 tabular-nums ${color}`}>{v}</div>
      {sub && <div className="text-[11px] text-bone-600 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------- TOKEN BLOCK ----------------------------------

function TokenBlock({ s, log, meta }: { s: TokenStats; log: boolean; meta: TokenMeta | null }) {
  return (
    <>
      {/* headline stats — spread edge-to-edge on wide screens (terminal density) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <Tile k="Price" v={fmtPrice(s.price)} sub={<span className="inline-flex items-center gap-0.5"><EthMark />ETH / <MidMark />ELCAS</span>} accent="amber" />
        <Tile k="Liquidity" v={<span className="inline-flex items-center gap-1">{s.poolEth.toFixed(4)} <EthMark />ETH</span>} sub={<span className="inline-flex items-center gap-0.5"><MidMark />{fmtInt(s.poolMid)} ELCAS</span>} icon={<Droplets size={12} />} accent="emerald" />
        <Tile k="Pool burned" v={fmtInt(s.totalBurned)} sub="supply removed" icon={<Flame size={12} />} accent="blood" />
        <Tile k="Reflected" v={fmtInt(s.totalReflected)} sub="paid to holders" icon={<Sparkles size={12} />} accent="emerald" />
        <Tile k="Holders" v={meta?.holders != null ? fmtInt(meta.holders) : "…"} sub="unique wallets" icon={<Users size={12} />} accent="amber" />
        <Tile k="Transfers" v={meta?.transfers != null ? fmtInt(meta.transfers) : "…"} sub="lifetime txs" icon={<ArrowLeftRight size={12} />} />
        <Tile k="Supply" v={fmtInt(s.supply)} sub="deflating live" />
        <Tile k="Pool ELCAS" v={fmtInt(s.poolMid)} sub="primary pair" />
      </div>

      {/* Composite overlay + per-metric charts (shared with the Stats tab) */}
      <TokenCharts s={s} log={log} />
    </>
  );
}
