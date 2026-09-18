import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Flame, Sparkles, TrendingDown, Droplets, Gauge, Zap } from "lucide-react";
import { readMidgard, readPair, ADDR, TOKEN_SYMBOL } from "../lib/chain";
import { fmtInt, fmtPrice } from "../lib/util";
import { EthMark, MidMark } from "./UnitMark";

/**
 * MM-terminal-style "economy engine" panel — a row of live state cards plus a
 * supply-distribution bar for the autonomous differential-decay model.
 */
export type Eco = {
  supply: number; burned: number; reflected: number;
  poolMid: number; poolEth: number; price: number; circulating: number;
  holderAnnual: number; poolAnnual: number; phi: number; feeTotal: number;
};

const CAP = 1_000_000_000; // 1B genesis cap
const SECONDS_PER_YEAR = 31_536_000;
const perSecToAnnualPct = (persec: number) =>
  persec > 0 ? (1 - Math.pow(1 - persec / 1e18, SECONDS_PER_YEAR)) * 100 : 0;

export function EconomyEngine({ eco }: { eco?: Eco }) {
  const [self, setSelf] = useState<Eco | null>(null);
  const e = eco ?? self;

  useEffect(() => {
    if (eco) return; // parent supplies the data — no independent polling
    let live = true;
    const load = async () => {
      try {
        const m = readMidgard();
        const [supply, burned, reflected, phiRaw, rates, incSup, pair, buyF, sellF] = await Promise.all([
          m.totalSupply(), m.totalPoolBurned(), m.totalReflected(), m.currentPhi(),
          m.currentRates(), m.includedSupply(), m.primaryPair(),
          m.feeBuyBps().catch(() => 0n), m.feeSellBps().catch(() => 0n),
        ]);
        let poolMid = 0, poolEth = 0;
        if (pair && pair !== "0x0000000000000000000000000000000000000000") {
          const p = readPair(pair);
          const [r, t0] = await Promise.all([p.getReserves(), p.token0()]);
          const midIs0 = t0.toLowerCase() === ADDR.token.toLowerCase();
          poolMid = Number(formatUnits(midIs0 ? r[0] : r[1], 18));
          poolEth = Number(formatUnits(midIs0 ? r[1] : r[0], 18));
        }
        const supplyN = Number(formatUnits(supply, 18));
        if (!live) return;
        setSelf({
          supply: supplyN,
          burned: Number(formatUnits(burned, 18)),
          reflected: Number(formatUnits(reflected, 18)),
          poolMid, poolEth, price: poolMid ? poolEth / poolMid : 0,
          circulating: Number(formatUnits(incSup, 18)),
          holderAnnual: perSecToAnnualPct(Number(rates[0])),
          poolAnnual: perSecToAnnualPct(Number(rates[1])),
          phi: Number(formatUnits(phiRaw, 18)),
          feeTotal: (Number(buyF) + Number(sellF)) / 100,
        });
      } catch { /* keep last snapshot */ }
    };
    load();
    const h = setInterval(load, 12000);
    return () => { live = false; clearInterval(h); };
  }, [eco]);

  if (!e) return <div className="panel p-4 h-40 skeleton" />;

  const burnedPct = (e.burned / CAP) * 100;
  const poolPct = (e.poolMid / CAP) * 100;
  const circPct = Math.max(0, 100 - burnedPct - poolPct);
  const holderNet = Math.max(0, e.poolAnnual - e.holderAnnual);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card tone="blood" icon={<Flame size={13} />} label="Pool burn"
          value={fmtInt(e.burned)} unit={TOKEN_SYMBOL}
          rows={[["burn rate", `~${e.poolAnnual.toFixed(0)}%/yr`], ["of 1B cap", burnedPct.toFixed(3) + "%"]]} />
        <Card tone="amber" icon={<TrendingDown size={13} />} label="Holder decay"
          value={`~${e.holderAnnual.toFixed(0)}%`} unit="/yr"
          rows={[["holders shrink", "index rebase"], ["net vs pool", `+${holderNet.toFixed(0)}%/yr`]]} />
        <Card tone="emerald" icon={<Sparkles size={13} />} label="Reflection"
          value={fmtInt(e.reflected)} unit={TOKEN_SYMBOL}
          rows={[["paid to holders", "lifetime"], ["swap fee", e.feeTotal.toFixed(0) + "%"]]} />
        <Card tone="cyan" icon={<Gauge size={13} />} label="LP share (φ)"
          value={(e.phi * 100).toFixed(1)} unit="%"
          rows={[["drives the rates", "adaptive"], ["thin → self-heal", "no brick"]]} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card tone="cyan" icon={<Droplets size={13} />} label="Liquidity"
          value={e.poolEth.toFixed(5)} unit="ETH"
          rows={[[`pool ${TOKEN_SYMBOL}`, fmtInt(e.poolMid)], ["price", fmtPrice(e.price) + " ETH"]]} />
        <Card tone="emerald" icon={<Zap size={13} />} label="Holder net"
          value={`+${holderNet.toFixed(0)}`} unit="%/yr"
          rows={[["pool − holder", "before reflection"], ["+ reflection", "from volume"]]} />
        <div className="panel p-4 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-bone-400 font-mono">Supply distribution</span>
            <span className="text-[10px] font-mono text-bone-600">of 1B cap · live</span>
          </div>
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-ink-800 ring-1 ring-ink-700">
            <span className="h-full bg-cyan-500/80" style={{ width: poolPct + "%" }} title="Pool" />
            <span className="h-full bg-blood-500/80" style={{ width: burnedPct + "%" }} title="Burned" />
            <span className="h-full bg-bone-400/40" style={{ width: circPct + "%" }} title="Circulating" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] font-mono">
            <Legend c="bg-cyan-500/80" k="Pool" v={`${poolPct.toFixed(2)}%`} />
            <Legend c="bg-blood-500/80" k="Burned" v={`${burnedPct.toFixed(3)}%`} />
            <Legend c="bg-bone-400/40" k="Circulating" v={`${circPct.toFixed(2)}%`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ tone, icon, label, value, unit, rows }: {
  tone: "blood" | "emerald" | "amber" | "cyan";
  icon: React.ReactNode; label: string; value: string; unit?: string; rows: [string, string][];
}) {
  const accent = tone === "blood" ? "text-blood-400" : tone === "emerald" ? "text-emerald-400"
    : tone === "amber" ? "text-amber-400" : "text-cyan-400";
  const bar = tone === "blood" ? "before:bg-blood-500" : tone === "emerald" ? "before:bg-emerald-500"
    : tone === "amber" ? "before:bg-amber-500" : "before:bg-cyan-500";
  return (
    <div className={`panel p-4 relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${bar}`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono ${accent}`}>{icon}{label}</div>
      <div className="mt-1 font-mono font-semibold text-xl tabular-nums text-bone-50">
        {value}{unit && <span className="text-bone-500 text-sm ml-1 inline-flex items-center gap-1">{unit === "ETH" && <EthMark />}{unit === TOKEN_SYMBOL && <MidMark />}{unit}</span>}
      </div>
      <div className="mt-2 space-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[10.5px] font-mono">
            <span className="text-bone-600">{k}</span>
            <span className="text-bone-300 tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ c, k, v }: { c: string; k: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${c}`} />
      <span className="text-bone-400">{k}</span>
      <span className="text-bone-500 tabular-nums">{v}</span>
    </span>
  );
}
