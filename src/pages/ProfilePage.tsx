import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ExternalLink, Loader2, Pencil, Check, X, Wallet } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { CHAIN } from "../lib/chain";
import { loadProfile, loadProfileByUsername, saveProfile, type Profile } from "../lib/midchat";
import { saveBio, followCounts, isFollowing, toggleFollow, notify } from "../lib/social";
import { Avatar } from "../components/Avatar";
import { UserPosts } from "../components/Feed";
import { TipButton } from "../components/TipButton";
import { CopyButton } from "../components/CopyButton";
import { short } from "../lib/util";

type Props = { self?: boolean; byAddress?: boolean };

/**
 * Profile — Supabase-backed, X-like. Shows the user's avatar, bio and their posts.
 * The owner can edit avatar URL + bio inline (username too, unless it's locked to
 * a social login). Identity is the wallet address.
 */
export default function ProfilePage({ self, byAddress }: Props) {
  const w = useWallet();
  const params = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const uname = !self && !byAddress ? params.username ?? null : null;

  async function load() {
    setLoading(true); setNotFound(false); setEditing(false);
    try {
      let p: Profile | null = null;
      let addr: string | null = null;
      if (self) { addr = w.address ?? null; if (addr) p = await loadProfile(addr); }
      else if (byAddress) { addr = params.address ?? null; if (addr) p = await loadProfile(addr); }
      else if (uname) { p = await loadProfileByUsername(uname); addr = p?.wallet ?? null; }
      setWallet(addr);
      setProfile(p);
      if (!addr && (uname || byAddress)) setNotFound(true);
    } catch { setNotFound(!!(uname || byAddress)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [self, byAddress, params.address, uname, w.address]);

  // Follow counts + my follow state for the resolved wallet.
  useEffect(() => {
    if (!wallet) return;
    followCounts(wallet).then(setCounts).catch(() => {});
    if (w.address && w.address.toLowerCase() !== wallet.toLowerCase()) isFollowing(w.address, wallet).then(setFollowing).catch(() => {});
    else setFollowing(false);
  }, [wallet, w.address]);

  async function onFollow() {
    if (!w.address) { w.connect(); return; }
    if (!wallet) return;
    setFollowBusy(true);
    const next = await toggleFollow(w.address, wallet, following).catch(() => following);
    setFollowing(next);
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + (next ? 1 : -1)) }));
    if (next) notify({ recipient: wallet, actor: w.address, type: "follow", actorName: w.profile?.name, actorAvatar: w.profile?.avatar });
    setFollowBusy(false);
  }

  if (self && !w.address) {
    return (
      <div className="animate-fade-up max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold tracking-tight">Your profile</h1>
        <p className="text-bone-400 text-sm mt-2 mb-6">Connect to set up your profile and post to the feed.</p>
        <button onClick={w.connect} className="btn-primary px-6 py-2.5"><Wallet size={18} /> Connect</button>
      </div>
    );
  }
  if (loading) return <div className="text-center py-20 text-bone-500"><Loader2 className="animate-spin mx-auto" size={20} /></div>;
  if (notFound) return <div className="text-center py-20 text-bone-500">Profile not found.</div>;

  const addr = wallet || "";
  const isMe = !!w.address && !!addr && w.address.toLowerCase() === addr.toLowerCase();
  const name = profile?.username || short(addr);
  const locked = !!profile?.locked;

  if (editing && isMe) {
    return <ProfileEditor addr={addr} initial={profile} locked={locked} onDone={load} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="animate-fade-up">
      {/* Banner */}
      <div className="h-32 sm:h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-blood-900/40 via-ink-800 to-ink-900 relative z-0">
        {profile?.banner && <img src={profile.banner} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
      </div>

      <div className="px-1 relative z-10">
        <div className="flex items-end justify-between -mt-11">
          <div className="relative z-10 rounded-full ring-4 ring-ink-950 bg-ink-950"><Avatar uri={profile?.avatar_url} name={name} size={88} ring={false} /></div>
          {isMe ? (
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm border border-ink-600 mb-2 inline-flex items-center gap-1.5">
              <Pencil size={14} /> Edit profile
            </button>
          ) : (
            <div className="mb-2 flex items-center gap-2">
              <TipButton to={addr} />
              <button onClick={onFollow} disabled={followBusy}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  following ? "border border-ink-600 text-bone-200 hover:border-blood-500 hover:text-blood-300" : "bg-blood-500 text-ink-950 hover:bg-blood-400"}`}>
                {following ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{name}</h1>
            {profile?.social && profile.social !== "wallet" && (
              <span className="font-mono text-[9px] uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1.5 py-0.5">{profile.social}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <a href={`${CHAIN.explorer}/address/${addr}`} target="_blank" rel="noreferrer"
              className="font-mono text-xs text-bone-500 hover:text-blood-400 inline-flex items-center gap-1">{short(addr)} <ExternalLink size={11} /></a>
            <CopyButton value={addr} title="Copy address" />
          </div>
          {profile?.bio && <p className="text-[15px] text-bone-200 mt-3 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-bone-300"><b className="text-bone-50">{counts.following}</b> <span className="text-bone-500">Following</span></span>
            <span className="text-bone-300"><b className="text-bone-50">{counts.followers}</b> <span className="text-bone-500">Followers</span></span>
          </div>
          {!profile && isMe && <p className="text-sm text-bone-500 mt-3">You don't have a profile yet — <button onClick={() => setEditing(true)} className="text-blood-300 hover:underline">set one up</button>.</p>}
        </div>
      </div>

      <div className="border-t border-ink-700/60 mt-5 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-500 mb-3">Posts</div>
        {addr && <UserPosts wallet={addr} />}
      </div>
    </div>
  );
}

// ── Inline editor ────────────────────────────────────────────────────────────
function ProfileEditor({ addr, initial, locked, onDone, onCancel }: {
  addr: string; initial: Profile | null; locked: boolean; onDone: () => void; onCancel: () => void;
}) {
  const [username, setUsername] = useState(initial?.username || "");
  const [avatar, setAvatar] = useState(initial?.avatar_url || "");
  const [banner, setBanner] = useState(initial?.banner || "");
  const [bio, setBio] = useState(initial?.bio || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      await saveProfile({ wallet: addr, username: (username || `user_${addr.slice(2, 8)}`).trim(), avatar_url: avatar.trim() });
      await saveBio(addr, bio, banner);
      onDone();
    } catch (e: any) { setErr(e?.message || "Could not save."); }
    finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-up max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold tracking-tight">Edit profile</h1>
        <button onClick={onCancel} className="text-bone-400 hover:text-blood-400"><X size={18} /></button>
      </div>
      <div className="panel p-4 space-y-3">
        <Field label="Username" hint={locked ? "locked to your social login" : undefined}>
          <input value={username} onChange={(e) => setUsername(e.target.value.slice(0, 32))} disabled={locked}
            className="field w-full disabled:opacity-60" placeholder="username" />
        </Field>
        <Field label="Avatar image URL" hint={locked ? "from your social login" : undefined}>
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} disabled={locked}
            className="field w-full font-mono text-xs disabled:opacity-60" placeholder="https://… or ipfs://…" />
        </Field>
        <Field label="Banner image URL">
          <input value={banner} onChange={(e) => setBanner(e.target.value)} className="field w-full font-mono text-xs" placeholder="https://…" />
        </Field>
        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={3} className="field w-full resize-none" placeholder="Tell the chain about yourself…" />
          <div className="text-right font-mono text-[10px] text-bone-600">{bio.length}/280</div>
        </Field>
        {/* Live preview */}
        <div className="rounded-xl border border-ink-700/60 p-3 flex items-center gap-3">
          <Avatar uri={avatar} name={username || short(addr)} size={44} ring={false} />
          <div className="min-w-0"><div className="font-semibold text-bone-50 truncate">{username || short(addr)}</div><div className="text-xs text-bone-500 truncate">{bio || "no bio yet"}</div></div>
        </div>
        {err && <div className="text-blood-200 text-sm">{err}</div>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
          </button>
          <button onClick={onCancel} className="btn-ghost border border-ink-600 px-4">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-bone-300">{label}</span>{hint && <span className="text-[10px] font-mono text-bone-600">· {hint}</span>}</div>
      {children}
    </label>
  );
}
