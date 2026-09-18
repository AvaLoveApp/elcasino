import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Wallet as WalletIcon, LogOut, Coins, Shield, ShieldCheck, Menu, X, Dices, PieChart, Rocket, HelpCircle, Radio, MoreHorizontal, ChevronDown, Compass, ArrowLeftRight, Zap, LayoutGrid, Bell, Bookmark, Recycle, FileText, ExternalLink } from "lucide-react";
import { SOCIALS, TelegramIcon, XIcon } from "./lib/socials";
import { formatUnits } from "ethers";
import { useWallet } from "./lib/wallet";
import { short, fmtInt } from "./lib/util";
import { CHAIN, readRegistry, readMidgard } from "./lib/chain";
import { loadProfile } from "./lib/midchat";
import { countUnread, subscribeNotifications, subscribeBroadcasts } from "./lib/social";
import { showLocalNotification } from "./lib/push";
import { Logo, Wordmark } from "./components/Logo";
import { MidMark } from "./components/UnitMark";
import TokenPage from "./pages/TokenPage"; // eager — the home/default route
import RightRail from "./components/RightRail";
import { AppPrompts } from "./components/AppPrompts";
import { Footer } from "./components/Footer";
import { lazy, Suspense, useEffect, useState } from "react";

// Route-level code splitting: everything but the landing page loads on demand,
// so first paint pulls a small bundle and heavy pages (analytics event scans,
// casino games, launchpad) only download their code when actually visited.
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CasinoPage = lazy(() => import("./pages/CasinoPage"));
const CasinoRoomPage = lazy(() => import("./pages/CasinoRoomPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const FlywheelPage = lazy(() => import("./pages/FlywheelPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const TokenomicsPage = lazy(() => import("./pages/TokenomicsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const LivePage = lazy(() => import("./pages/LivePage"));
const LiveRoomPage = lazy(() => import("./pages/LiveRoomPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BookmarksPage = lazy(() => import("./pages/BookmarksPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-bone-500">
      <span className="mg-logo-rings h-14 w-14">
        <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
        <img src="./elcasino_logo.png" alt="" className="h-10 w-10 rounded-full object-cover opacity-80" draggable={false} />
      </span>
    </div>
  );
}

type NavDef = { to: string; label: string; icon: typeof Coins; img?: string; ownerOnly?: boolean };

// Finance protocol — no social surfaces. Just the MIDGARD economy, its analytics,
// the on-chain casino, and the user's wallet/portfolio.
const NAV_MAIN: NavDef[] = [
  { to: "/casino", label: "EL-Casino", icon: Dices, img: "./elcasino_logo.png" }, // brand logo — the default surface users land on
  { to: "/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/flywheel", label: "Flywheel", icon: Recycle },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
];
// Secondary destinations, tucked behind a "More" disclosure in the sidebar.
const NAV_MORE: NavDef[] = [
  { to: "/faq", label: "FAQ", icon: HelpCircle },
  { to: "/audit", label: "Audit", icon: ShieldCheck },
  { to: "/legal/terms", label: "Legal", icon: FileText },
];
const NAV_ADMIN: NavDef = { to: "/admin", label: "Admin", icon: Shield, ownerOnly: true };

/** Watch whether the connected wallet owns the registry (admin panel gate). */
function useIsOwner(): boolean {
  const w = useWallet();
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    if (!w.address) { setIsOwner(false); return; }
    readRegistry().owner().then((o: string) => {
      setIsOwner(o.toLowerCase() === w.address!.toLowerCase());
    }).catch(() => setIsOwner(false));
  }, [w.address]);
  return isOwner;
}

function NavRow({ item, badge = 0 }: { item: NavDef; badge?: number }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end
      className={({ isActive }) =>
        `flex items-center gap-4 rounded-full px-4 py-3 transition hover:bg-ink-800 ${
          isActive ? "text-bone-50 font-semibold bg-ink-850/60" : "text-bone-200"
        }`}>
      {({ isActive }) => (
        <>
          <span className="relative">
            {item.img
              ? <img src={item.img} alt="" className={`h-7 w-7 rounded-md object-cover ring-1 transition ${isActive ? "ring-blood-500/70" : "ring-ink-600"}`} draggable={false} />
              : <Icon size={24} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-blood-500" : ""} />}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-blood-500 text-ink-950 text-[9px] font-bold leading-none">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </span>
          {item.label === "EL-Casino"
            ? <Wordmark className="text-[19px]" />
            : <span className="text-[17px]">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

/** External link row for the sidebar (socials), styled like NavRow. */
function NavExternal({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center gap-4 rounded-full px-4 py-3 text-bone-200 transition hover:bg-ink-800">
      <span className="relative grid place-items-center w-6 text-bone-300">{icon}</span>
      <span className="text-[17px]">{label}</span>
      <ExternalLink size={13} className="ml-auto text-bone-600" />
    </a>
  );
}

/** Sidebar nav — primary items, then a collapsible "More" group (FAQ · Audit ·
 *  Tokenomics), then the owner-only Admin link. Shared by the desktop rail and
 *  the mobile drawer, each keeping its own open/closed state. */
function NavSection({ isOwner }: { isOwner: boolean }) {
  const location = useLocation();
  const moreActive = NAV_MORE.some((n) => location.pathname.startsWith(n.to));
  const [open, setOpen] = useState(moreActive);
  useEffect(() => { if (moreActive) setOpen(true); }, [moreActive]);
  return (
    <>
      {NAV_MAIN.map((n) => <NavRow key={n.label} item={n} />)}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`flex w-full items-center gap-4 rounded-full px-4 py-3 transition hover:bg-ink-800 ${moreActive ? "text-bone-50 font-semibold bg-ink-850/60" : "text-bone-200"}`}>
        <MoreHorizontal size={24} strokeWidth={moreActive ? 2.4 : 1.8} className={moreActive ? "text-blood-500" : ""} />
        <span className="text-[17px]">More</span>
        <ChevronDown size={18} className={`ml-auto text-bone-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-5 space-y-0.5 border-l border-ink-700/70 pl-2">
          {NAV_MORE.map((n) => <NavRow key={n.label} item={n} />)}
        </div>
      )}
      {isOwner && <NavRow item={NAV_ADMIN} />}
      {/* Socials — always visible, below the More group */}
      <NavExternal href={SOCIALS.telegram} label="Telegram" icon={<TelegramIcon size={22} />} />
      <NavExternal href={SOCIALS.x} label="X / Twitter" icon={<XIcon size={19} />} />
    </>
  );
}

/** The connected user's profile (name + avatar) — from the Privy social login
 *  first, then the Supabase profile. Drives the sidebar account card. */
function useMyProfile() {
  const w = useWallet();
  const [p, setP] = useState<{ name?: string; avatar?: string } | null>(null);
  useEffect(() => {
    if (!w.address) { setP(null); return; }
    if (w.profile?.name || w.profile?.avatar) setP({ name: w.profile.name, avatar: w.profile.avatar });
    let live = true;
    loadProfile(w.address).then((pr) => {
      if (live && pr) setP((cur) => ({ name: cur?.name || pr.username, avatar: cur?.avatar || pr.avatar_url }));
    }).catch(() => {});
    return () => { live = false; };
  }, [w.address, w.profile]);
  return p;
}

/** Live MIDGARD balance shown under the wallet address. */
function useMidgardBalance() {
  const w = useWallet();
  const [bal, setBal] = useState<string | null>(null);
  useEffect(() => {
    if (!w.address) { setBal(null); return; }
    let live = true;
    const load = () => readMidgard().balanceOf(w.address!).then((b: bigint) => {
      if (!live) return;
      setBal(fmtInt(Number(formatUnits(b, 18))));
    }).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => { live = false; clearInterval(t); };
  }, [w.address]);
  return bal;
}

function AccountCard() {
  const w = useWallet();
  const nav = useNavigate();
  const bal = useMidgardBalance();
  const prof = useMyProfile();
  if (!w.address) {
    return (
      <button onClick={w.openConnect} disabled={w.connecting} className="btn-primary !rounded-xl w-full">
        <WalletIcon size={18} /> {w.connecting ? "Connecting…" : "Connect"}
      </button>
    );
  }
  if (!w.chainOk) {
    return (
      <button onClick={w.switchChain} className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-blood-500/50 bg-blood-900/20 px-4 py-2.5 text-sm font-medium text-blood-200 hover:bg-blood-900/40 transition">
        Switch to {CHAIN.name}
      </button>
    );
  }
  return (
    <div className="panel flex items-center gap-3 px-3 py-3">
      {/* Connected → the user's own profile (avatar + name), tap to open /me. Neon ring kept. */}
      <button onClick={() => nav("/me")} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <span className="mg-logo-rings h-14 w-14 shrink-0">
          <span className="mg-ring mg-ring-red" />
          <span className="mg-ring mg-ring-green" />
          <img src={prof?.avatar || "./elcasino_logo.png"} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-ink-600"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "./elcasino_logo.png"; }} draggable={false} />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="font-semibold text-sm truncate text-bone-50">{prof?.name || short(w.address)}</div>
          <div className="font-mono text-[11px] text-bone-400 truncate mt-0.5">
            {bal !== null ? <><Sparkle /> {bal} <MidMark />ELCAS</> : short(w.address)}
          </div>
          <div className="font-mono text-[10px] text-blood-400 truncate">view profile →</div>
        </div>
      </button>
      <button onClick={() => nav("/wallet")} title="Wallet" className="text-bone-400 hover:text-blood-400 transition shrink-0">
        <WalletIcon size={16} />
      </button>
      <button onClick={w.disconnect} title="Disconnect" className="text-bone-400 hover:text-blood-500 transition shrink-0">
        <LogOut size={16} />
      </button>
    </div>
  );
}

function Sparkle() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-blood-500 mr-1 align-middle" />;
}

/** Brand action button — jumps to the live analytics terminal. A solid brand
 *  pill (same fill as the Connect button) with dark text, so it reads as a clear
 *  primary CTA rather than a loud glowing card. */
function BrandButton() {
  const nav = useNavigate();
  return (
    <button onClick={() => nav("/casino?view=analytics")} title="ELCAS Terminal · live casino analytics"
      className="!mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-ink-850 border border-blood-500/40 py-3.5 text-[15px] font-extrabold tracking-tight text-bone-50 shadow-blood transition hover:bg-ink-800 hover:border-blood-500/70">
      <img src="./elcasino_logo.png" alt=""
        className="h-7 w-7 rounded-md object-cover ring-1 ring-blood-500/30" draggable={false} />
      Terminal
    </button>
  );
}

export default function App() {
  const isOwner = useIsOwner();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  // Casino runs as a full-bleed exchange surface — drop the right rail so the
  // game/earn/analytics views get the whole platform width.
  const isCasino = location.pathname.startsWith("/casino");
  // A live ROOM (/live/:id) is IMMERSIVE (no left nav / bottom nav — Kick-style).
  const isLiveRoom = /^\/live\/[^/]+/.test(location.pathname);
  // The Live directory (/live) runs full-width with no right rail — a proper
  // browse-streams surface like the Terminal, not a narrow feed column.
  const isLiveList = location.pathname === "/live" || location.pathname === "/live/";
  // The Terminal (analytics) runs full-width edge-to-edge like a trading terminal.
  const isTerminal = location.pathname.startsWith("/analytics");
  // The Trade page is a fomo-style 3-pane trading terminal — full width, no rail.
  const isTrade = location.pathname === "/trade" || location.pathname === "/trade/";
  const isImmersive = isLiveRoom;                 // hides the whole app chrome
  const fullBleed = isCasino || isLiveRoom;        // drops right rail + footer
  const noRail = fullBleed || isTerminal || isLiveList || isTrade;
  const tightPad = isTerminal || isLiveList || isTrade;       // edge-to-edge padding
  useEffect(() => { setDrawer(false); }, [location.pathname]);
  return (
    <div className="min-h-dvh">
      {/* Full-bleed shell — the app fills 100% of the viewport width on every
          surface (no centered max-w cap); left nav + right rail flank a fluid
          center column. */}
      <div className="mx-auto flex min-h-dvh max-w-none">
        {/* Left nav (lg+) — hidden entirely on immersive surfaces (live room) */}
        {!isImmersive && (
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto p-4 lg:flex xl:w-72">
          <div className="space-y-0.5">
            <div className="mb-4 px-2 pt-1"><Logo /></div>
            <NavSection isOwner={isOwner} />
            <BrandButton />
          </div>
          <div className="pb-2"><AccountCard /></div>
        </aside>
        )}

        {/* Center column */}
        <div className={`flex-1 min-w-0 lg:min-h-dvh ${isImmersive ? "" : "border-x border-ink-700/70"}`}>
          {/* Mobile top bar — hidden on immersive surfaces */}
          {!isImmersive && (
          <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-ink-700 bg-ink-900/80 px-4 h-16 backdrop-blur-xl">
            <button onClick={() => setDrawer(true)}
              className="flex items-center gap-2 -ml-1 p-1 rounded-full text-bone-100 hover:text-blood-500 transition active:scale-95"
              aria-label="Open menu">
              <Menu size={26} strokeWidth={2.2} />
              <span className="mg-logo-rings h-14 w-14">
                <span className="mg-ring mg-ring-red" />
                <span className="mg-ring mg-ring-green" />
                <img src="./elcasino_logo.png" alt=""
                  className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600 shadow-blood" draggable={false} />
              </span>
            </button>
            <div className="leading-none select-none">
              <Wordmark className="text-[26px]" />
            </div>
          </header>
          )}
          <main className={isImmersive ? "min-h-dvh" : tightPad ? "px-3 sm:px-4 py-4 pb-28 lg:pb-4" : "px-4 sm:px-6 py-6 pb-28 lg:pb-10"}>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                {/* Home removed — Trade is the default surface. */}
                <Route path="/" element={<CasinoPage />} />
                <Route path="/token" element={<TokenPage section="trade" />} />
                <Route path="/trade" element={<TokenPage section="trade" />} />
                <Route path="/flywheel" element={<FlywheelPage />} />
                <Route path="/yield" element={<TokenPage section="yield" />} />
                <Route path="/apps" element={<TokenPage section="apps" />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/casino" element={<CasinoPage />} />
                <Route path="/casino/room/:gameKey/:address" element={<CasinoRoomPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/tokenomics" element={<TokenomicsPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/legal" element={<LegalPage />} />
                <Route path="/legal/:section" element={<LegalPage />} />
                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/a/:address" element={<ProfilePage byAddress />} />
                <Route path="/me" element={<ProfilePage self />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:peer" element={<MessagesPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<div className="text-bone-400 py-24 text-center">Not found.</div>} />
              </Routes>
            </Suspense>
            {!noRail && <Footer />}
          </main>
        </div>

        {/* Right rail (xl+) — hidden on full-bleed + terminal surfaces */}
        {!noRail && (
          <aside className="sticky top-0 hidden h-dvh w-96 shrink-0 overflow-y-auto p-4 xl:block">
            <RightRail />
          </aside>
        )}
      </div>

      {/* Mobile bottom nav — the primary finance destinations (hidden on immersive) */}
      <nav className={`${isImmersive ? "hidden" : "lg:hidden"} fixed bottom-0 inset-x-0 z-20 grid grid-cols-3 border-t border-ink-700 bg-ink-900/90 backdrop-blur-xl`}>
        {[
          { to: "/trade", label: "Trade", icon: ArrowLeftRight, img: "./elcasino_logo.png" },
          { to: "/casino", label: "Casino", icon: Dices },
          { to: "/wallet", label: "Wallet", icon: WalletIcon },
        ].map((n) => {
          const Icon = n.icon;
          return (
            <NavLink key={n.to} to={n.to} end
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 ${isActive ? "text-blood-500" : "text-bone-400"}`}>
              {n.img
                ? <img src={n.img} alt="" className="h-5 w-5 rounded object-cover" draggable={false} />
                : <Icon size={20} />}
              <span className="text-[10px]">{n.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Mobile drawer */}
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} isOwner={isOwner} />

      {/* Install / enable-notifications nudges */}
      {!isImmersive && <AppPrompts />}
    </div>
  );
}

function MobileDrawer({ open, onClose, isOwner }: { open: boolean; onClose: () => void; isOwner: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <>
      <div onClick={onClose}
        className={`lg:hidden fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-ink-900 border-r border-ink-700 shadow-2xl transform transition-transform ${open ? "translate-x-0" : "-translate-x-full"} overflow-y-auto flex flex-col`}
        aria-hidden={!open}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <Logo />
          <button onClick={onClose} className="p-2 -mr-2 rounded-full text-bone-400 hover:text-blood-500 hover:bg-ink-800" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <div className="px-3 mt-2 space-y-0.5">
          <NavSection isOwner={isOwner} />
          <BrandButton />
        </div>
        <div className="mt-auto p-3">
          <AccountCard />
        </div>
      </aside>
    </>
  );
}
