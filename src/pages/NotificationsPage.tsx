import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, HandCoins, Bell, Wallet, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { loadNotifications, markAllRead, subscribeNotifications, loadBroadcasts, subscribeBroadcasts, type Notification, type Broadcast } from "../lib/social";
import { Megaphone } from "lucide-react";
import { pushSupported, pushConfigured, enablePush, disablePush, isPushEnabled } from "../lib/push";
import { Avatar } from "../components/Avatar";
import { short, timeAgo } from "../lib/util";

/** Notifications — likes, replies, follows and tips on the connected wallet. */
export default function NotificationsPage() {
  const w = useWallet();
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [casts, setCasts] = useState<Broadcast[]>([]);

  // Broadcasts are for everyone — load them regardless of connection.
  useEffect(() => {
    loadBroadcasts(8).then(setCasts).catch(() => {});
    const un = subscribeBroadcasts((b) => setCasts((c) => [b, ...c].slice(0, 8)));
    return () => un();
  }, []);

  useEffect(() => {
    if (!w.address) { setRows([]); return; }
    let live = true;
    loadNotifications(w.address).then((r) => { if (live) setRows(r); }).catch(() => setRows([]));
    markAllRead(w.address).catch(() => {});
    const un = subscribeNotifications(w.address, (n) => setRows((cur) => (cur ? [n, ...cur] : [n])));
    return () => { live = false; un(); };
  }, [w.address]);

  if (!w.address) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Notifications</h1>
        <Broadcasts casts={casts} />
        <div className="panel p-8 text-center">
          <Bell size={32} className="mx-auto text-bone-600" />
          <p className="text-bone-400 text-sm mt-2 mb-4">Connect to see who's engaging with you.</p>
          <button onClick={w.connect} className="btn-primary px-6 py-2.5"><Wallet size={18} /> Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <PushToggle wallet={w.address} />
      </div>
      <Broadcasts casts={casts} />
      {rows === null && <div className="panel p-10 text-center text-bone-500"><Loader2 className="animate-spin mx-auto" size={20} /></div>}
      {rows && rows.length === 0 && (
        <div className="panel p-10 text-center text-bone-500 text-sm">Nothing yet — likes, replies, follows and tips will show up here.</div>
      )}
      <div className="space-y-2">
        {rows?.map((n) => <Row key={n.id} n={n} />)}
      </div>
    </div>
  );
}

function Broadcasts({ casts }: { casts: Broadcast[] }) {
  if (!casts.length) return null;
  return (
    <div className="space-y-2 mb-4">
      {casts.map((b) => (
        <a key={b.id} href={b.url || "./#/notifications"} className="panel p-3 flex items-start gap-3 border-blood-500/30 bg-blood-900/[0.06] hover:border-blood-500/60 transition">
          {b.image
            ? <img src={b.image} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-ink-600 shrink-0" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "./elcasino_logo.png"; }} />
            : <span className="grid h-10 w-10 place-items-center rounded-lg bg-blood-500/20 text-blood-300 shrink-0"><Megaphone size={18} /></span>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-blood-300 border border-blood-500/40 rounded px-1 py-0.5">{b.kind === "launch" ? "launch" : b.kind === "room" ? "casino" : "announcement"}</span>
              <span className="font-mono text-[10px] text-bone-600">{timeAgo(Math.floor(new Date(b.created_at).getTime() / 1000))}</span>
            </div>
            <div className="text-sm font-bold text-bone-50 mt-0.5">{b.title}</div>
            {b.body && <div className="text-[13px] text-bone-300">{b.body}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}

function PushToggle({ wallet }: { wallet: string }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { isPushEnabled().then(setOn).catch(() => {}); }, []);
  if (!pushSupported() || !pushConfigured) return null;
  async function toggle() {
    setBusy(true);
    try {
      if (on) { await disablePush(wallet); setOn(false); }
      else { const ok = await enablePush(wallet); setOn(ok); }
    } finally { setBusy(false); }
  }
  return (
    <button onClick={toggle} disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        on ? "border border-emerald-500/50 text-emerald-300 bg-emerald-900/15" : "border border-ink-600 text-bone-300 hover:border-blood-500 hover:text-blood-300"}`}>
      <Bell size={13} /> {busy ? "…" : on ? "Push on" : "Enable push"}
    </button>
  );
}

function Row({ n }: { n: Notification }) {
  const name = n.actor_name || short(n.actor);
  const icon = n.type === "like" ? <Heart size={15} className="text-blood-400" fill="currentColor" />
    : n.type === "reply" ? <MessageCircle size={15} className="text-blue-400" />
    : n.type === "follow" ? <UserPlus size={15} className="text-emerald-400" />
    : <HandCoins size={15} className="text-amber-400" />;
  const verb = n.type === "like" ? "liked your post"
    : n.type === "reply" ? `replied: ${n.meta?.text || ""}`
    : n.type === "follow" ? "followed you"
    : `tipped you ${n.meta?.amount ?? ""} ${n.meta?.symbol ?? ""}`;
  return (
    <Link to={`/a/${n.actor}`} className={`panel p-3 flex items-center gap-3 hover:border-blood-500/50 transition ${n.read ? "" : "border-blood-500/30 bg-blood-900/[0.06]"}`}>
      <span className="shrink-0">{icon}</span>
      <Avatar uri={n.actor_avatar} name={name} size={36} ring={false} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-bone-100">
          <span className="font-semibold text-bone-50">{name}</span> <span className="text-bone-400">{verb}</span>
        </div>
        <div className="font-mono text-[10px] text-bone-600">{timeAgo(Math.floor(new Date(n.created_at).getTime() / 1000))}</div>
      </div>
    </Link>
  );
}
