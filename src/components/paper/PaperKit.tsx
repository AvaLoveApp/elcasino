import {
  Children, ReactNode, ReactElement, isValidElement,
  useEffect, useMemo, useRef, useState,
} from "react";

/**
 * PaperKit — Midgard-themed building blocks for long-form documentation
 * (litepaper-style). Scroll layout with a sticky contents rail, scroll-spy
 * highlighting, and reveal-on-scroll. Matches the platform's ink/blood/bone
 * terminal theme. No i18n, no external deps — pure Tailwind + our tokens.
 */

export interface TocItem { id: string; label: string; depth?: number }

/* Reveal-on-scroll: adds `.pk-in` once the node enters the viewport. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { el.classList.add("pk-in"); obs.unobserve(el); } }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export function PaperFrame({ toc, hero, children }: { toc: TocItem[]; hero: ReactNode; children: ReactNode }) {
  const [active, setActive] = useState<string>(toc[0]?.id ?? "");
  const sections = useMemo(() => Children.toArray(children).filter(isValidElement) as ReactElement[], [children]);

  useEffect(() => {
    const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  return (
    <div className="animate-fade-up">
      {/* Hero band */}
      <div className="panel p-6 sm:p-8 bg-gradient-to-br from-blood-900/15 via-ink-900/40 to-transparent mb-6">{hero}</div>

      <div className="flex gap-8">
        {/* Sticky contents rail (lg+) */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-hide">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-bone-500">Contents</div>
            <ul className="space-y-0.5 border-l border-ink-700/70 pl-3">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`}
                    onClick={(e) => {
                      // HashRouter owns the URL hash — a plain `#id` jump would
                      // clobber the route (→ "Not found"). Scroll in JS instead
                      // and leave the router hash (e.g. #/audit) untouched.
                      e.preventDefault();
                      const el = document.getElementById(t.id);
                      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setActive(t.id); }
                    }}
                    className={`block rounded-md py-1.5 pr-2 text-[12.5px] leading-snug transition-colors ${t.depth ? "pl-3 text-[11.5px]" : "pl-0"} ${active === t.id ? "text-blood-400 font-semibold" : "text-bone-500 hover:text-bone-100"}`}>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 flex-1 max-w-3xl">{sections}</article>
      </div>
    </div>
  );
}

export function Section({ id, n, title, eyebrow, children }: { id: string; n?: string; title: string; eyebrow?: string; children: ReactNode }) {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} id={id} className="scroll-mt-4 mb-12 pk-reveal">
      {eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-400/70">{eyebrow}</div>}
      <h2 className="mb-5 flex items-baseline gap-3 border-b border-ink-700/70 pb-3 text-xl sm:text-2xl font-black tracking-tight text-bone-50">
        {n && <span className="text-[15px] font-mono text-blood-400/80">{n}</span>}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return <h3 id={id} className="scroll-mt-4 mt-8 mb-3 text-[16px] sm:text-[17px] font-bold text-bone-100">{children}</h3>;
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`mb-4 text-[14.5px] leading-[1.75] text-bone-300 ${className || ""}`}>{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-[16px] leading-[1.7] text-bone-200">{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-bone-300">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blood-500" /><span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ variant = "green", title, children }: { variant?: "green" | "blood" | "blue" | "amber"; title?: string; children: ReactNode }) {
  const c = {
    green: { bd: "rgba(16,185,129,0.28)", bg: "rgba(16,185,129,0.05)", tx: "#34d399" },
    blood: { bd: "rgba(205,32,42,0.30)", bg: "rgba(205,32,42,0.06)", tx: "#b4ff2e" },
    blue: { bd: "rgba(56,189,248,0.26)", bg: "rgba(56,189,248,0.05)", tx: "#67c7f0" },
    amber: { bd: "rgba(245,158,11,0.28)", bg: "rgba(245,158,11,0.05)", tx: "#fbbf24" },
  }[variant];
  return (
    <div className="my-5 rounded-xl p-4" style={{ border: `1px solid ${c.bd}`, background: c.bg }}>
      {title && <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider" style={{ color: c.tx }}>{title}</div>}
      <div className="text-[13.5px] leading-relaxed text-bone-200">{children}</div>
    </div>
  );
}

export function Figure({ caption, children }: { caption?: string; children: ReactNode }) {
  const ref = useReveal<HTMLElement>();
  return (
    <figure ref={ref} className="my-7 pk-reveal">
      <div className="overflow-x-auto rounded-xl border border-ink-700/70 bg-ink-900/60 p-4 scrollbar-hide">
        <div className="mx-auto min-w-[300px]">{children}</div>
      </div>
      {caption && <figcaption className="mt-2.5 text-center text-[12px] text-bone-500 font-mono">{caption}</figcaption>}
    </figure>
  );
}

export function StatGrid({ stats }: { stats: { k: string; v: string; sub?: string }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s, i) => (
        <div key={i} className="rounded-xl border border-ink-700/70 bg-ink-900/50 p-4 text-center">
          <div className="text-[22px] font-black text-blood-400 tabular-nums">{s.v}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-bone-400">{s.k}</div>
          {s.sub && <div className="mt-0.5 text-[10px] text-bone-600">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-ink-700/70 scrollbar-hide">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-ink-850/70">
            {head.map((h, i) => (
              <th key={i} className="border-b border-ink-700 px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-bone-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-bone-50/[0.02]">
              {r.map((c, j) => <td key={j} className="border-b border-ink-800 px-3.5 py-2.5 align-top text-bone-300">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Code({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-950/70">
      {title && <div className="border-b border-ink-800 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-bone-500">{title}</div>}
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-emerald-200/90 scrollbar-hide"><code className="font-mono">{children}</code></pre>
    </div>
  );
}

export function StepCard({ n, title, desc, color }: { n: string; title: string; desc: string; color: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-ink-700/70 bg-ink-900/50 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-black" style={{ background: `${color}22`, color }}>{n}</div>
      <div>
        <div className="mb-1 text-[15px] font-bold text-bone-100">{title}</div>
        {desc && <div className="text-[13.5px] leading-relaxed text-bone-400">{desc}</div>}
      </div>
    </div>
  );
}

export function Pills({ items }: { items: string[] }) {
  return (
    <div className="my-5 flex flex-wrap gap-2">
      {items.map((p, i) => (
        <span key={i} className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.05] px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-300">{p}</span>
      ))}
    </div>
  );
}
