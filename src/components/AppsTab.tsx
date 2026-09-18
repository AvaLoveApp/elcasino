import { useNavigate } from "react-router-dom";
import { Dices, Rocket, Radio, ArrowRight, ArrowLeftRight, Sparkles, Gift, Coins, Users, Video } from "lucide-react";

/**
 * Apps tab — the platform's satellite products (Live + Casino + Launchpad)
 * surfaced right from the token page so users reach them in one hop. Cards stack
 * as full-width banners, each carrying its own neon logo mark so the "Apps"
 * section reads at a glance. No token price/liquidity here — this is a launcher.
 */
export function AppsTab() {
  const nav = useNavigate();
  return (
    <div className="space-y-4">
      <div className="panel p-5 bg-gradient-to-br from-blood-900/15 to-transparent border-blood-500/20">
        <div className="flex items-center gap-2 text-blood-300 mb-1">
          <Sparkles size={15} />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]">EL-Casino Apps</span>
        </div>
        <h2 className="text-lg font-bold tracking-tight">Everything built on the ELCAS economy</h2>
        <p className="text-bone-400 text-sm mt-1">Go live, play the on-chain casino, or launch your own decaying token — one hop from here.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <AppCard
          onClick={() => nav("/live")}
          logo={<AppLogo tone="rose"><Radio size={24} /></AppLogo>}
          title="Live"
          desc="Token owners broadcast Twitch-style — audio or video. Watch the top-100 LP creators and tip in their token."
          tags={[{ icon: <Video size={11} />, t: "Audio · Video" }, { icon: <Users size={11} />, t: "Top-100 owners" }]}
          cta="Watch live"
        />
        <AppCard
          onClick={() => nav("/casino")}
          logo={<AppLogo tone="emerald"><Dices size={26} /></AppLogo>}
          title="Casino"
          desc="Provably-fair on-chain games — dice, mines, crash, roulette, plinko & more. Stake, play, earn."
          tags={[{ icon: <Dices size={11} />, t: "6+ games" }, { icon: <Coins size={11} />, t: "Real stakes" }]}
          cta="Enter casino"
        />
        <AppCard
          onClick={() => nav("/trade")}
          logo={<AppLogo tone="blood"><ArrowLeftRight size={24} /></AppLogo>}
          title="Trade"
          desc="A fomo-style trading terminal — ELCAS and every casino token, with a themed chart, live trades, holders and one-tap Buy/Sell."
          tags={[{ icon: <ArrowLeftRight size={11} />, t: "Buy / Sell" }, { icon: <Gift size={11} />, t: "Real yield" }]}
          cta="Open trade"
        />
      </div>
    </div>
  );
}

function AppCard({ onClick, logo, title, desc, tags, cta }: {
  onClick: () => void; logo: React.ReactNode; title: string; desc: string;
  tags: { icon: React.ReactNode; t: string }[]; cta: string;
}) {
  return (
    <button onClick={onClick}
      className="panel group w-full text-left p-5 transition hover:border-blood-500/50 hover:shadow-[0_0_30px_-12px_rgba(147,224,20,0.55)]">
      <div className="flex items-center gap-4">
        {logo}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-bone-50">{title}</div>
          <p className="text-[13px] text-bone-400 leading-relaxed mt-1 max-w-2xl">{desc}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-bone-300 bg-ink-800 border border-ink-600 rounded-full px-2 py-1">
                {tag.icon} {tag.t}
              </span>
            ))}
          </div>
        </div>
        {/* Desktop CTA — sits on the right of the wide banner. */}
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full border border-blood-500/40 bg-blood-500/10 px-4 py-2 text-sm font-semibold text-blood-300 transition group-hover:translate-x-0.5 group-hover:bg-blood-500/20 sm:inline-flex">
          {cta} <ArrowRight size={15} />
        </span>
      </div>
      {/* Mobile CTA — under the content on narrow screens. */}
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blood-400 sm:hidden">
        {cta} <ArrowRight size={15} />
      </span>
    </button>
  );
}

function AppLogo({ tone, children }: { tone: "emerald" | "blood" | "rose"; children: React.ReactNode }) {
  const map = {
    emerald: "text-emerald-300 bg-emerald-500/12 border-emerald-500/40 shadow-[0_0_20px_-6px_rgba(16,185,129,0.7)]",
    blood: "text-blood-300 bg-blood-500/12 border-blood-500/40 shadow-[0_0_20px_-6px_rgba(147,224,20,0.7)]",
    rose: "text-rose-300 bg-rose-500/12 border-rose-500/40 shadow-[0_0_20px_-6px_rgba(244,63,94,0.7)]",
  };
  return <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${map[tone]}`}>{children}</span>;
}
