import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Loader2, Users, MessageSquare, Coins, Dices } from "lucide-react";
import { searchPosts, searchProfiles, type Post, type ProfileHit } from "../lib/social";
import { loadRobinhoodTokens, type DexToken } from "../lib/dexscreener";
import { Avatar } from "../components/Avatar";
import { PostMedia } from "../components/PostMedia";
import { Rich } from "../lib/emoji";
import { short, timeAgo } from "../lib/util";

type Results = { people: ProfileHit[]; tokens: DexToken[]; posts: Post[] };

/** Platform-wide search — people, tokens/games, and posts (all Supabase / cached). */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [res, setRes] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useRef<any>(null);

  useEffect(() => {
    const term = q.trim();
    if (t.current) clearTimeout(t.current);
    if (!term) { setRes(null); return; }
    setBusy(true);
    t.current = setTimeout(async () => {
      const lc = term.toLowerCase();
      const [people, posts, allTokens] = await Promise.all([
        searchProfiles(term).catch(() => [] as ProfileHit[]),
        searchPosts(term).catch(() => [] as Post[]),
        loadRobinhoodTokens().catch(() => [] as DexToken[]),
      ]);
      const tokens = allTokens.filter((tk) =>
        tk.symbol?.toLowerCase().includes(lc) || tk.name?.toLowerCase().includes(lc) || tk.address?.toLowerCase().includes(lc)
      ).slice(0, 12);
      setRes({ people, tokens, posts });
      setBusy(false);
      setParams(term ? { q: term } : {}, { replace: true });
    }, 300);
    return () => { if (t.current) clearTimeout(t.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const empty = res && res.people.length === 0 && res.tokens.length === 0 && res.posts.length === 0 && !busy;

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="relative mb-4">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, tokens, games, posts…"
          className="w-full bg-ink-900/70 border border-ink-600 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blood-500 placeholder:text-bone-600" />
        {busy && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-bone-500" />}
      </div>

      {!q.trim() && <div className="panel p-8 text-center text-bone-500 text-sm">Search across the whole platform — people, tokens, casino games, and posts.</div>}
      {empty && <div className="panel p-8 text-center text-bone-500 text-sm">Nothing matches “{q.trim()}”.</div>}

      {res && (
        <div className="space-y-5">
          {/* People */}
          {res.people.length > 0 && (
            <Section icon={<Users size={13} />} label="People">
              <div className="panel p-1.5 divide-y divide-ink-700/50">
                {res.people.map((p) => (
                  <Link key={p.wallet} to={`/a/${p.wallet}`} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-ink-800/60 transition">
                    <Avatar uri={p.avatar_url} name={p.username || short(p.wallet)} size={38} ring={false} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-bone-50 truncate">{p.username || short(p.wallet)}</div>
                      {p.bio ? <div className="text-[12px] text-bone-500 truncate">{p.bio}</div> : <div className="font-mono text-[11px] text-bone-600">{short(p.wallet)}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Tokens & games */}
          {res.tokens.length > 0 && (
            <Section icon={<Coins size={13} />} label="Tokens & games">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {res.tokens.map((tk) => (
                  <Link key={tk.address} to="/casino" className="panel p-3 flex items-center gap-3 hover:border-blood-500/40 transition">
                    {tk.logo ? <img src={tk.logo} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <span className="grid h-9 w-9 place-items-center rounded-full bg-blood-500/20 text-blood-300"><Coins size={16} /></span>}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-bone-50 truncate">${tk.symbol}</div>
                      <div className="font-mono text-[10px] text-bone-500 truncate">{tk.name || short(tk.address)}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 shrink-0"><Dices size={11} /> Play</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Posts */}
          {res.posts.length > 0 && (
            <Section icon={<MessageSquare size={13} />} label="Posts">
              <div className="space-y-3">
                {res.posts.map((p) => (
                  <Link key={p.id} to={`/a/${p.wallet}`} className="panel p-3.5 block hover:border-blood-500/40 transition">
                    <div className="flex gap-3">
                      <Avatar uri={p.avatar_url} name={p.username || short(p.wallet)} size={36} ring={false} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-semibold text-bone-50 truncate">{p.username || short(p.wallet)}</span>
                          <span className="font-mono text-[11px] text-bone-600">{short(p.wallet)}</span>
                          <span className="text-bone-600">·</span>
                          <span className="font-mono text-[11px] text-bone-600">{timeAgo(Math.floor(new Date(p.created_at).getTime() / 1000))}</span>
                        </div>
                        {p.text && <Rich text={p.text} className="text-[15px] text-bone-100 mt-0.5 whitespace-pre-wrap break-words block" />}
                        {typeof (p.meta as any)?.media === "string" && <PostMedia uri={(p.meta as any).media} compact />}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-bone-400 font-mono text-[10px] uppercase tracking-[0.2em]">{icon}{label}</div>
      {children}
    </div>
  );
}
