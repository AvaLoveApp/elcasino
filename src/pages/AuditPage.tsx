import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, CheckCircle2, AlertTriangle, Info, FileCode2, ExternalLink, Lock, Flame, Sparkles, Gauge, TrendingDown, PieChart, ArrowRight, BookOpen, Dices } from "lucide-react";
import { CHAIN, ADDR } from "../lib/chain";
import { CopyButton } from "../components/CopyButton";
import { short } from "../lib/util";
import OverviewDoc from "./docs/OverviewDoc";
import CasinoDoc from "./docs/CasinoDoc";

type DocTab = "overview" | "casino" | "audit";
// Only the Casino documentation is surfaced — the Overview litepaper and the
// token audit report are hidden until the ELCAS token launches.
const DOC_TABS: { key: DocTab; label: string; icon: any }[] = [
  { key: "casino", label: "Casino", icon: Dices },
];

/** Documentation & audit hub — a litepaper for the whole platform
 *  (Overview, Casino) plus the ELCAS token security review. */
export default function AuditPage() {
  const [tab, setTab] = useState<DocTab>("casino");
  const pick = (t: DocTab) => { setTab(t); try { localStorage.setItem("midgard.docs.tab", t); } catch {} window.scrollTo({ top: 0 }); };
  return (
    <div className="animate-fade-up">
      {/* Doc tab bar — full-width gray segmented, scrolls on mobile. */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-ink-950/95 backdrop-blur mb-4">
        <div className="flex flex-wrap gap-1 rounded-xl bg-ink-800/70 border border-ink-700/70 p-1">
          {DOC_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => pick(t.key)}
                className={`flex-1 min-w-[92px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "bg-ink-600 text-bone-50 shadow-sm" : "text-bone-400 hover:text-bone-100 hover:bg-ink-700/50"}`}>
                <Icon size={15} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-blood-400" : ""} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && <OverviewDoc />}
      {tab === "casino" && <CasinoDoc />}
      {tab === "audit" && <TokenAuditReport />}
    </div>
  );
}

type Sev = "critical" | "high" | "medium" | "low" | "info";
const SEV_META: Record<Sev, { label: string; cls: string; dot: string }> = {
  critical: { label: "Critical", cls: "text-red-300 border-red-500/50 bg-red-900/20", dot: "bg-red-500" },
  high: { label: "High", cls: "text-orange-300 border-orange-500/50 bg-orange-900/20", dot: "bg-orange-500" },
  medium: { label: "Medium", cls: "text-amber-300 border-amber-500/50 bg-amber-900/20", dot: "bg-amber-500" },
  low: { label: "Low", cls: "text-cyan-300 border-cyan-500/50 bg-cyan-900/20", dot: "bg-cyan-500" },
  info: { label: "Info", cls: "text-bone-300 border-ink-500 bg-ink-800/40", dot: "bg-bone-500" },
};

const COUNTS: { sev: Sev; n: number }[] = [
  { sev: "critical", n: 0 }, { sev: "high", n: 0 }, { sev: "medium", n: 0 }, { sev: "low", n: 2 }, { sev: "info", n: 3 },
];

const MECHANICS = [
  { icon: <TrendingDown size={16} />, title: "Differential decay", body: "Holder balances shrink via a per-second rebase index at rate h(φ); the primary pool's ELCAS is burned at a faster rate p(φ) = h + spread(φ). With the pool's ETH unchanged and less ELCAS backing it, price rises. Holder net value grows at roughly (p − h). Excluded accounts (deployer, contract) never decay." },
  { icon: <Flame size={16} />, title: "Pool burn — brick-safe", body: "The pool burn is a PERCENTAGE of the current reserve, capped at `maxBurnBps` per realization, so it can only ever remove a fraction of what exists — the reserve can never hit zero. Realized on p2p transfers + the permissionless `poke()` (never mid-swap, to respect the pair's sync lock)." },
  { icon: <Sparkles size={16} />, title: "Reflection", body: "100% of every swap fee lifts the rebase index so all holders' balances grow in place — no claim, no transaction. The pool and excluded accounts are excluded, so reflection never dilutes the pool or drops price. When there are zero included units the fee burns instead, conserving supply." },
  { icon: <Gauge size={16} />, title: "φ-adaptive self-heal", body: "All rates track φ = the pool's share of the float. Thick pool → burn faster (bigger holder gain). Thin pool → spread reverses (holders decay faster than the pool) so the pool's share regrows. The economy oscillates around a healthy depth instead of draining." },
];

type Finding = {
  id: string; sev: Sev; title: string; where: string;
  detail: string; impact: string; rec: string; status: string;
};

const FINDINGS: Finding[] = [
  {
    id: "L-01", sev: "low", title: "Pool burn is realized on transfers/poke, not on buys",
    where: "_realizePoolBurn() · poke()",
    detail: "The pool burn changes a Uniswap reserve, which can't be `sync()`'d safely mid-swap (a buy locks the pair; a sell would absorb the input). So it's realized only on p2p transfers and the permissionless `poke()`. After a long idle period the first buy can revert on the k-invariant until a sell/transfer/poke re-syncs.",
    impact: "No funds at risk — worst case a buy reverts and self-heals on the next transfer or poke. On an actively-traded token it's invisible; the frontend/anyone can poke cheaply.",
    rec: "Keep rates moderate (they are) and poke periodically. Accepted trade-off of a keeper-less, autonomous design.",
    status: "Acknowledged — by-design trade-off",
  },
  {
    id: "L-02", sev: "low", title: "units↔raw conversion can leave sub-wei dust",
    where: "_debit() · _credit()",
    detail: "Included holders are stored in units (balance = units × index); excluded accounts in raw tokens. Cross-tier transfers convert with floor division, which can leave a few wei of supply drift over many transfers.",
    impact: "Negligible — bounded to a handful of wei; never affects price, decay or reflection materially. Standard for rebase/units accounting.",
    rec: "No action needed; conversions round down conservatively so supply can only drift by dust, never inflate meaningfully.",
    status: "Informational — dust only",
  },
  {
    id: "I-01", sev: "info", title: "No ETH custody — contract never holds ETH",
    where: "(no receive/payable)",
    detail: "Unlike the previous design, MidgardFinance holds and handles no ETH at all — there is no claim pool, no auto-LP, no swaps from the contract. It cannot receive ETH (no payable receive).",
    impact: "None. Removes an entire class of locked-ETH / rescue-path concerns.",
    rec: "None — noted as a simplification win.",
    status: "By-design (trust-minimized)",
  },
  {
    id: "I-02", sev: "info", title: "Fee-on-transfer requires FoT-aware routing",
    where: "_transfer()",
    detail: "Swap fees are taken on transfer, so integrations must use the `...SupportingFeeOnTransferTokens` router functions; a plain swap would revert on the K-invariant.",
    impact: "None on funds. Purely an integration requirement — the EL-Casino UI already uses the correct router methods.",
    rec: "Document for third-party integrators.",
    status: "Informational",
  },
  {
    id: "I-03", sev: "info", title: "Reflection burns when there are no included holders",
    where: "_reflect()",
    detail: "If every holder exits to pools/excluded accounts (`includedSupply == 0`), a swap fee has no one to reflect to and is burned (removed from supply) instead.",
    impact: "None — supply is conserved (the fee simply deflates). A transient edge case only relevant with zero public float.",
    rec: "No action needed.",
    status: "Informational — edge case",
  },
];

const ASSURANCES = [
  "No mint, no pause, no blacklist, no mutable tax — every economic parameter is an immutable constructor argument.",
  "The pool burn is a percentage of the reserve, capped per realization — it can never remove more than exists, so the pool cannot be bricked.",
  "Reflection excludes the pool and excluded accounts, so it never dilutes the pool reserve or pushes price down.",
  "Rates are a pure function of φ (pool share of float): thick pool burns faster, thin pool self-heals — no keeper, no manual tuning.",
  "The contract holds and handles no ETH — no claim pool, no auto-LP, no swaps — removing an entire class of custody/rescue risk.",
  "`addPair` migrates a pair that already holds ELCAS (added-liquidity-first) into raw balance, so marking it excluded can never strand or brick the pool.",
  "The only privileged role, `pairManager`, can add pairs and renounce itself — it cannot touch balances, rates or user funds. Verified on Sourcify.",
];

function TokenAuditReport() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero */}
      <div className="panel p-6 bg-gradient-to-br from-emerald-900/15 to-transparent border-emerald-500/25">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="h-12 w-12 rounded-2xl bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
            <ShieldCheck size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-400">$ELCAS · security review</div>
            <h1 className="text-2xl font-bold tracking-tight">ELCAS Token Audit</h1>
            <p className="text-bone-400 text-sm mt-1 max-w-2xl leading-relaxed">
              A static security review of the on-chain EL-Casino ($ELCAS) token — the differential decay,
              brick-safe pool burn, reflection and φ-adaptive engine — with every intentional mechanic verified as designed.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 font-mono text-[11px] text-bone-500">
              <span className="inline-flex items-center gap-1.5"><FileCode2 size={12} /> MidgardFinance.sol · self-contained</span>
              <span>Solidity 0.8.26</span>
              <span>{CHAIN.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-[11px]">
              <a href={`${CHAIN.explorer}/token/${ADDR.token}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-bone-400 hover:text-emerald-300">
                {short(ADDR.token)} <ExternalLink size={11} />
              </a>
              <CopyButton value={ADDR.token} title="Copy ELCAS address" />
            </div>
          </div>
        </div>
      </div>

      {/* Verdict + severity summary */}
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
        <div className="panel p-5">
          <div className="flex items-center gap-2 text-emerald-300 mb-2">
            <CheckCircle2 size={16} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Verdict</span>
          </div>
          <p className="text-sm text-bone-200 leading-relaxed">
            <b className="text-bone-50">No critical, high or medium-severity issues.</b> The token is trust-minimized
            (immutable parameters, no mint/pause/blacklist) and its dividend and rebase accounting are sound. The
            findings are one by-design MEV trade-off, one deploy-time hardening note, and minor informational items —
            none of which put user funds at risk.
          </p>
        </div>
        <div className="panel p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400 mb-3">Findings by severity</div>
          <div className="space-y-1.5">
            {COUNTS.map(({ sev, n }) => {
              const m = SEV_META[sev];
              return (
                <div key={sev} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  <span className="text-bone-300">{m.label}</span>
                  <span className={`ml-auto font-mono tabular-nums ${n > 0 ? "text-bone-50" : "text-bone-600"}`}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mechanics verified */}
      <section>
        <SectionTitle label="Design mechanics — reviewed & intended" />
        <p className="text-bone-500 text-xs mb-3 max-w-2xl">
          ELCAS's aggressive mechanics are deliberate economic design, not bugs. Each was traced through the code and
          confirmed to work as specified — they are documented here as verified features, not findings.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {MECHANICS.map((m) => (
            <div key={m.title} className="panel p-4">
              <div className="flex items-center gap-2 text-emerald-300 mb-1.5">
                {m.icon}
                <span className="font-semibold text-sm text-bone-50">{m.title}</span>
                <CheckCircle2 size={14} className="ml-auto text-emerald-400" />
              </div>
              <p className="text-[12.5px] text-bone-400 leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Findings */}
      <section>
        <SectionTitle label="Findings" />
        <div className="space-y-3">
          {FINDINGS.map((f) => {
            const m = SEV_META[f.sev];
            return (
              <div key={f.id} className="panel p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${m.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
                  </span>
                  <span className="font-mono text-[11px] text-bone-600">{f.id}</span>
                  <span className="font-semibold text-sm text-bone-50">{f.title}</span>
                </div>
                <div className="font-mono text-[10px] text-bone-500 mt-1.5">{f.where}</div>
                <p className="text-[13px] text-bone-300 mt-2 leading-relaxed">{f.detail}</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <Field icon={<AlertTriangle size={11} />} k="Impact" v={f.impact} />
                  <Field icon={<Info size={11} />} k="Recommendation" v={f.rec} />
                </div>
                <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-300">
                  <CheckCircle2 size={12} /> {f.status}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security properties verified */}
      <section>
        <SectionTitle label="Security properties verified" />
        <div className="panel p-5">
          <ul className="space-y-2.5">
            {ASSURANCES.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-bone-300 leading-relaxed">
                <Lock size={13} className="text-emerald-400 shrink-0 mt-0.5" /> {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Methodology + disclaimer */}
      <section>
        <SectionTitle label="Scope & methodology" />
        <div className="panel p-5 text-[12.5px] text-bone-400 leading-relaxed space-y-2">
          <p><b className="text-bone-200">Scope:</b> the full <span className="font-mono">MidgardFinance.sol</span> token contract as deployed at {short(ADDR.token)} on {CHAIN.name}. Router, pair and WETH interfaces are treated as trusted UniswapV2 infrastructure.</p>
          <p><b className="text-bone-200">Method:</b> line-by-line manual review of accounting (elastic units/index, units↔raw tiers), control flow (fee dispatch, φ-adaptive rates, pool burn + sync realization), re-entrancy surfaces, arithmetic safety (Solidity 0.8 checked math + `_rpow`), and trust/privilege boundaries.</p>
          <p className="text-bone-500"><b className="text-bone-400">Disclaimer:</b> this is an internal engineering security review of the source, not a substitute for a formal third-party audit or a guarantee against all risk. Interacting with any on-chain protocol carries risk; do your own research.</p>
        </div>
      </section>

      {/* Tokenomics CTA */}
      <Link to="/tokenomics"
        className="panel p-5 flex items-center gap-4 hover:border-blood-500/50 transition group bg-gradient-to-br from-blood-900/15 to-transparent">
        <span className="h-11 w-11 rounded-2xl bg-blood-900/40 border border-blood-500/40 flex items-center justify-center text-blood-300 shrink-0 group-hover:scale-110 transition">
          <PieChart size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-bone-50">Now see how the economy works</div>
          <div className="text-bone-400 text-sm">Animated tokenomics + a live simulator — differential decay, the pool burn and why price rises without minting ETH.</div>
        </div>
        <ArrowRight size={18} className="text-blood-400 shrink-0 group-hover:translate-x-1 transition" />
      </Link>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-bone-400">{label}</span>
      <div className="h-px flex-1 bg-ink-700/70" />
    </div>
  );
}

function Field({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-lg bg-ink-900/50 border border-ink-700/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-bone-500 mb-1">{icon}{k}</div>
      <p className="text-[12px] text-bone-300 leading-relaxed">{v}</p>
    </div>
  );
}
