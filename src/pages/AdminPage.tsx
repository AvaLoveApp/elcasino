import { useEffect, useState, useCallback } from "react";
import { formatUnits, parseUnits, ZeroAddress, isAddress } from "ethers";
import { Shield, Coins, PowerOff, Pause, Play, Box, ExternalLink, Layers, PlusCircle, Trash2 } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { readRegistry, readMidgard, readRouter, readProvider, CHAIN, ADDR, FACTORY_ABI } from "../lib/chain";
import { Contract } from "ethers";
import { RWA_PRESETS } from "../lib/rwa";
import { short } from "../lib/util";
import { MarketMakerPanel } from "../components/MarketMakerPanel";
import { AnnouncePanel } from "../components/AnnouncePanel";
import { useAppConfig, saveAppConfig, AppConfig } from "../lib/appConfig";

type Snap = {
  owner: string;
  gateToken: string;
  minHold: bigint;
  paused: boolean;
  modules: { label: string; impl: string }[];
};

export default function AdminPage() {
  const w = useWallet();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = readRegistry();
      const [owner, gateToken, minHold, paused, count] = await Promise.all([
        r.owner(), r.gateToken(), r.minHold(), r.paused(), r.moduleCount(),
      ]);
      const modules: { label: string; impl: string }[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [label, impl] = await r.moduleAt(i);
        modules.push({ label, impl });
      }
      setSnap({ owner, gateToken, minHold, paused, modules });
    } catch {
      setErr("Could not read registry state.");
    }
  }, []);

  useEffect(() => {
    let live = true;
    // Retry until we get a first snapshot — RPC hiccups (upstream CORS bug on
    // Robinhood) shouldn't leave the panel dead.
    async function tryLoad() {
      await load();
      if (!live) return;
      // If snap still null after this call, schedule another attempt.
      setTimeout(() => { if (live) tryLoad(); }, 3000);
    }
    tryLoad();
    return () => { live = false; };
  }, [load]);

  if (!w.address) {
    return (
      <div className="text-center py-24 animate-fade-up">
        <Shield size={40} className="mx-auto text-bone-600" />
        <h1 className="text-2xl font-bold tracking-tight mt-4">Admin</h1>
        <p className="text-bone-400 text-sm mt-1">Connect your wallet to check access.</p>
        <button onClick={w.connect} className="btn-primary mt-6">Connect wallet</button>
      </div>
    );
  }
  if (!snap) return <div className="text-center text-bone-400 py-16">{err || "Loading…"}</div>;

  const isOwner = w.address.toLowerCase() === snap.owner.toLowerCase();
  if (!isOwner) {
    return (
      <div className="text-center py-24 animate-fade-up">
        <PowerOff size={40} className="mx-auto text-blood-500" />
        <h1 className="text-2xl font-bold tracking-tight mt-4">Not authorized</h1>
        <p className="text-bone-400 text-sm mt-1 max-w-sm mx-auto">
          Only the registry owner can access the admin panel. This wallet ({short(w.address)}) isn't the owner.
        </p>
        <p className="font-mono text-xs text-bone-600 mt-4">owner · {short(snap.owner)}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div>
        <div className="flex items-center gap-2 text-blood-400">
          <Shield size={18} /><span className="font-mono text-[10px] uppercase tracking-[0.24em]">Admin</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Registry controls</h1>
        <p className="text-bone-400 text-sm">
          You're the registry owner. Every change is a tx signed from your wallet, applied on-chain immediately.
        </p>
      </div>

      <LaunchConfigPanel />
      <MarketMakerPanel />
      <AnnouncePanel />
      <PausePanel paused={snap.paused} onDone={load} />
      <GatePanel gateToken={snap.gateToken} minHold={snap.minHold} onDone={load} />
      <ModulesPanel modules={snap.modules} onDone={load} />
      <MidgardPairsPanel />
    </div>
  );
}

// -------------------------------------------------------- Launch config -----

/**
 * Owner-editable launch config (stored in Supabase `app_config`, id=1). Set the
 * ELCAS token address, the fee token, the creator fee, and the Pons launchpad
 * link here — every visitor picks them up with no redeploy. ELCAS is a flat
 * platform token launched on Pons; its fees are buyback & burn.
 */
function LaunchConfigPanel() {
  const { config, refresh } = useAppConfig();
  const [form, setForm] = useState<AppConfig>(config);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Re-seed the form when the loaded config arrives/changes.
  useEffect(() => { setForm(config); }, [config]);

  const set = (k: keyof AppConfig, v: string | number) => setForm((f) => ({ ...f, [k]: v as any }));
  const addrBad = (a: string) => a.length > 0 && !isAddress(a);

  async function save() {
    setErr(null); setOk(null);
    if (addrBad(form.elcasToken) || addrBad(form.feeToken)) { setErr("Enter valid token addresses (or leave blank)."); return; }
    setBusy(true);
    try {
      await saveAppConfig({
        ...form,
        elcasToken: form.elcasToken.trim(),
        feeToken: form.feeToken.trim(),
        creatorFeeBps: Math.max(0, Math.round(Number(form.creatorFeeBps) || 0)),
      });
      await refresh();
      setOk("Saved — live across the site.");
    } catch (e: any) {
      setErr(e?.message || "Save failed. Make sure the app_config table exists in Supabase.");
    } finally { setBusy(false); }
  }

  const field = "w-full bg-ink-900/70 border border-ink-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blood-500 font-mono";
  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1 text-blood-400">
        <Coins size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">ELCAS launch config</span>
      </div>
      <p className="text-sm text-bone-400 mb-3">
        ELCAS is a flat platform token launched on <b className="text-bone-200">Pons</b> — fees are <b className="text-emerald-300">buyback &amp; burn</b>.
        Set these once; they show on the Trade, EL-Casino and Flywheel pages instantly, no redeploy.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] text-bone-500 font-mono uppercase tracking-wider">ELCAS token address</span>
          <input value={form.elcasToken} onChange={(e) => set("elcasToken", e.target.value.trim())} placeholder="0x… (leave blank until launched)"
            className={`${field} mt-1 ${addrBad(form.elcasToken) ? "border-blood-500" : ""}`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-bone-500 font-mono uppercase tracking-wider">Fee token address</span>
          <input value={form.feeToken} onChange={(e) => set("feeToken", e.target.value.trim())} placeholder="0x… (token fees come in / to buy back)"
            className={`${field} mt-1 ${addrBad(form.feeToken) ? "border-blood-500" : ""}`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-bone-500 font-mono uppercase tracking-wider">Creator fee (%)</span>
          <input type="number" step="0.1" min="0" value={form.creatorFeeBps / 100}
            onChange={(e) => set("creatorFeeBps", Math.round((parseFloat(e.target.value) || 0) * 100))}
            placeholder="2" className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-bone-500 font-mono uppercase tracking-wider">Pons launchpad link</span>
          <input value={form.ponsLaunchpadUrl} onChange={(e) => set("ponsLaunchpadUrl", e.target.value.trim())} placeholder="https://pons.…"
            className={`${field} mt-1`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-bone-500 font-mono uppercase tracking-wider">Pons logo URL</span>
          <input value={form.ponsLogoUrl} onChange={(e) => set("ponsLogoUrl", e.target.value.trim())} placeholder="https://…/pons-logo.png"
            className={`${field} mt-1`} />
        </label>
      </div>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mt-3">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mt-3">{ok}</div>}
      <button onClick={save} disabled={busy} className="btn-primary mt-3 px-5 py-2.5 disabled:opacity-50">
        {busy ? "Saving…" : "Save launch config"}
      </button>
    </div>
  );
}

// ------------------------------------------------------------ MIDGARD pairs --

/**
 * MIDGARD token pair management. Only the token's `pairManager` (== deployer,
 * same as registry owner initially) can call these — the panel is only shown
 * on AdminPage, which is already owner-gated, but each write still verifies
 * on-chain because pairManager may have been renounced later.
 */
function MidgardPairsPanel() {
  const w = useWallet();
  const [pairMgr, setPairMgr] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string | null>(null);
  const [newPair, setNewPair] = useState("");
  const [isPoolCheck, setIsPoolCheck] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = readMidgard();
      const [pm, pp]: [string, string] = await Promise.all([m.pairManager(), m.primaryPair()]);
      setPairMgr(pm); setPrimary(pp);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Live check whether a pasted pair address is already registered.
  useEffect(() => {
    if (!isAddress(newPair)) { setIsPoolCheck(null); return; }
    readMidgard().isPair(newPair).then((v: boolean) => setIsPoolCheck(v)).catch(() => setIsPoolCheck(null));
  }, [newPair]);

  const iAmManager = !!w.address && !!pairMgr && w.address.toLowerCase() === pairMgr.toLowerCase();
  const renounced = pairMgr === ZeroAddress;

  async function addPair() {
    setErr(null); setOk(null);
    if (!isAddress(newPair)) { setErr("Enter a valid pair address."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.tokenWrite(); if (!c) return;
    setBusy("add");
    try {
      const tx = await c.addPair(newPair);
      await tx.wait();
      setOk("Pair registered.");
      setNewPair("");
      refresh();
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Failed."); }
    finally { setBusy(null); }
  }

  async function renounce() {
    if (!confirm("Renounce the MIDGARD pairManager? This cannot be undone — no new pairs can be registered afterwards.")) return;
    setErr(null); setOk(null);
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.tokenWrite(); if (!c) return;
    setBusy("renounce");
    try {
      const tx = await c.renouncePairManager();
      await tx.wait();
      setOk("Renounced.");
      refresh();
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Failed."); }
    finally { setBusy(null); }
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3 text-blood-400">
        <Layers size={15} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">MIDGARD pairs</span>
        {renounced && (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-emerald-400 border border-emerald-500/40 rounded px-1.5 py-0.5">
            manager renounced
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <div className="text-[11px] text-bone-500 mb-1 font-mono uppercase tracking-wider">primary (auto-LP)</div>
          <a href={primary ? `${CHAIN.explorer}/address/${primary}` : "#"} target="_blank" rel="noreferrer"
            className="font-mono text-xs text-bone-100 hover:text-blood-400 inline-flex items-center gap-1 truncate">
            {primary === ZeroAddress || !primary ? "not set" : primary} {primary && primary !== ZeroAddress && <ExternalLink size={11} />}
          </a>
        </div>
        <div>
          <div className="text-[11px] text-bone-500 mb-1 font-mono uppercase tracking-wider">pair manager</div>
          <span className="font-mono text-xs text-bone-100">{pairMgr === ZeroAddress ? "renounced (0x0)" : pairMgr ? short(pairMgr) : "…"}</span>
        </div>
      </div>

      <p className="text-sm text-bone-400 mb-3">
        Register a Uniswap pair (MIDGARD paired with WETH, NVDA, or another RWA) so the token stops
        decaying its reserves and starts firing the mirror-burn there. Add the WETH pair first —
        that becomes the primary auto-LP target.
      </p>

      <div className="flex gap-2 mb-2">
        <input value={newPair} onChange={(e) => setNewPair(e.target.value.trim())} placeholder="0x…pair"
          className="field font-mono text-xs py-2 flex-1" />
        <button onClick={addPair}
          disabled={!!busy || renounced || !iAmManager || !isAddress(newPair) || isPoolCheck === true}
          className="btn-primary py-2 px-4 text-sm inline-flex items-center gap-1">
          <PlusCircle size={14} /> {busy === "add" ? "…" : isPoolCheck === true ? "Already added" : "Add pair"}
        </button>
      </div>

      {isAddress(newPair) && isPoolCheck === true && (
        <div className="text-[11px] text-emerald-400 font-mono mb-2">This pair is already registered.</div>
      )}

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-2">{ok}</div>}

      {!renounced && iAmManager && (
        <button onClick={renounce} disabled={!!busy}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs font-medium text-bone-400 hover:border-blood-500 hover:text-blood-400 transition">
          <Trash2 size={12} /> {busy === "renounce" ? "…" : "Renounce pair manager"}
        </button>
      )}
      {!iAmManager && !renounced && (
        <div className="text-[11px] text-bone-500 font-mono">read-only — you're not the token's pairManager.</div>
      )}

      {!renounced && iAmManager && (
        <>
          <div className="border-t border-ink-700/60 mt-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">Create + register</span>
              <span className="font-mono text-[10px] text-bone-600">via Uniswap factory</span>
            </div>
            <PairCreator onCreated={refresh} />
          </div>
        </>
      )}
    </div>
  );
}

/** Pick a preset (or paste any ERC-20), createPair(MIDGARD, that), then addPair. */
function PairCreator({ onCreated }: { onCreated: () => void }) {
  const w = useWallet();
  const [quote, setQuote] = useState<string>(ADDR.weth);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null | undefined>(undefined);

  // Live: does a pair already exist for MIDGARD ↔ quote?
  useEffect(() => {
    if (!isAddress(quote)) { setExisting(undefined); return; }
    (async () => {
      try {
        const facAddr: string = await readRouter().factory();
        const fac = new Contract(facAddr, FACTORY_ABI, readProvider);
        const p = await fac.getPair(ADDR.token, quote);
        setExisting(p && p !== ZeroAddress ? p : null);
      } catch { setExisting(undefined); }
    })();
  }, [quote]);

  async function run() {
    setErr(null); setOk(null);
    if (!isAddress(quote)) { setErr("Pick a valid quote token."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    setBusy("create");
    try {
      const facAddr: string = await readRouter().factory();
      let pair = existing;
      if (!pair) {
        const fc = w.factoryWrite(facAddr); if (!fc) return;
        setBusy("create");
        const tx = await fc.createPair(ADDR.token, quote);
        const rc = await tx.wait();
        // Read back the pair.
        const fac = new Contract(facAddr, FACTORY_ABI, readProvider);
        pair = await fac.getPair(ADDR.token, quote);
        void rc;
      }
      if (!pair || pair === ZeroAddress) { setErr("Pair address unresolved after creation."); setBusy(null); return; }
      // Then register with the token.
      setBusy("register");
      const tc = w.tokenWrite(); if (!tc) return;
      const rTx = await tc.addPair(pair);
      await rTx.wait();
      setOk(`Pair ready: ${pair}`);
      setExisting(pair);
      onCreated();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Failed.");
    } finally { setBusy(null); }
  }

  const chips = [
    { key: "weth", label: "WETH", addr: ADDR.weth, color: "#627EEA" },
    ...RWA_PRESETS.filter((p) => p.address && p.key !== "weth" && p.key !== "midgard")
      .map((p) => ({ key: p.key, label: p.label, addr: p.address!, color: p.color })),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map((c) => {
          const selected = c.addr.toLowerCase() === quote.toLowerCase();
          return (
            <button key={c.key} onClick={() => setQuote(c.addr)}
              className={`text-[11px] font-mono rounded-full border px-2.5 py-1 transition ${selected ? "border-blood-500 text-blood-300" : "border-ink-600 text-bone-400 hover:border-blood-500/50"}`}>
              MIDGARD/{c.label}
            </button>
          );
        })}
      </div>

      <input value={quote} onChange={(e) => setQuote(e.target.value.trim())}
        placeholder="quote token address (0x…)" className="field font-mono text-xs py-2 mb-2" />

      {existing && (
        <div className="text-[11px] text-emerald-400 font-mono mb-2">
          Pair exists at {existing.slice(0, 10)}… — will only run addPair()
        </div>
      )}
      {existing === null && (
        <div className="text-[11px] text-bone-500 font-mono mb-2">
          No pair yet → will createPair() then addPair() (two txs)
        </div>
      )}

      {err && <div className="text-blood-200 text-xs mb-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-xs mb-2">{ok}</div>}

      <button onClick={run} disabled={!!busy || !isAddress(quote)} className="btn-primary py-2 px-4 text-sm">
        {busy === "create" ? "Creating pair…" : busy === "register" ? "Registering…" : existing ? "Register existing pair" : "Create + register pair"}
      </button>
      <p className="text-[11px] font-mono text-bone-600 mt-2">
        After the pair is registered, seed liquidity via Uniswap UI. The primary pair burns automatically; extra pairs are just decay-exempt.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------- Pause --
function PausePanel({ paused, onDone }: { paused: boolean; onDone: () => void }) {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function toggle() {
    setErr(null);
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.registryWrite(); if (!c) return;
    setBusy(true);
    try { const tx = await c.setPaused(!paused); await tx.wait(); onDone(); }
    catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Failed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-bone-50 font-semibold">
            {paused ? <Pause size={16} className="text-blood-500" /> : <Play size={16} className="text-emerald-400" />}
            Platform is {paused ? "paused" : "live"}
          </div>
          <p className="text-bone-400 text-sm mt-0.5">
            When paused, feature contracts refuse writes until the owner resumes.
          </p>
          {err && <div className="text-blood-200 text-xs mt-2">{err}</div>}
        </div>
        <button onClick={toggle} disabled={busy}
          className={paused ? "btn-primary" : "btn-ghost"}>
          {busy ? "…" : paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- Gate --
const PRESETS: { label: string; addr: string }[] = [
  { label: "Open (no token gate)", addr: ZeroAddress },
  { label: "MIDGARD", addr: ADDR.token },
];

function GatePanel({ gateToken, minHold, onDone }: { gateToken: string; minHold: bigint; onDone: () => void }) {
  const w = useWallet();
  const [addr, setAddr] = useState(gateToken);
  const [hold, setHold] = useState(formatUnits(minHold, 18));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => { setAddr(gateToken); setHold(formatUnits(minHold, 18)); }, [gateToken, minHold]);

  const dirty = addr.toLowerCase() !== gateToken.toLowerCase() || parseUnits(hold || "0", 18) !== minHold;
  const validAddr = addr === ZeroAddress || isAddress(addr);
  const isOpen = addr === ZeroAddress;

  async function save() {
    setErr(null); setOk(null);
    if (!validAddr) { setErr("Gate token must be a valid address."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.registryWrite(); if (!c) return;
    setBusy(true);
    try {
      const wei = parseUnits(hold || "0", 18);
      const tx = await c.setGateToken(addr, wei);
      await tx.wait();
      setOk("Saved."); onDone();
    } catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2 text-blood-400">
        <Coins size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Access gate</span>
      </div>
      <p className="text-sm text-bone-400 mb-3">
        Members are wallets holding at least <b className="text-bone-200">min hold</b> of the gate token.
        Set gate token to <span className="font-mono">0x0…0</span> or min hold to <span className="font-mono">0</span> to open the platform to everyone.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <div className="text-xs text-bone-400 mb-1">Gate token</div>
          <input value={addr} onChange={(e) => setAddr(e.target.value.trim())}
            placeholder="0x…" className="field font-mono" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESETS.map((p) => (
              <button key={p.addr} onClick={() => setAddr(p.addr)}
                className={`text-[11px] font-mono rounded-full border px-2.5 py-1 transition ${addr.toLowerCase() === p.addr.toLowerCase() ? "border-blood-500 text-blood-300" : "border-ink-600 text-bone-400 hover:border-blood-500/50"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <div className="text-xs text-bone-400 mb-1">Min hold</div>
          <input value={hold} onChange={(e) => setHold(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal" placeholder="0" className="field font-mono" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {["0", "100", "1000", "10000"].map((v) => (
              <button key={v} onClick={() => setHold(v)}
                className="text-[11px] font-mono rounded-full border border-ink-600 text-bone-400 hover:border-blood-500/50 px-2.5 py-1 transition">
                {v}
              </button>
            ))}
          </div>
        </label>
      </div>

      {isOpen && <div className="text-bone-500 text-xs font-mono mb-2">→ platform is currently OPEN to anyone.</div>}
      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-2">{err}</div>}
      {ok && <div className="text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-2">{ok}</div>}

      <button onClick={save} disabled={busy || !dirty || !validAddr} className="btn-primary">
        {busy ? "Confirm in wallet…" : "Save gate"}
      </button>
    </div>
  );
}

// ----------------------------------------------------------------- Modules --
function ModulesPanel({ modules, onDone }: { modules: { label: string; impl: string }[]; onDone: () => void }) {
  const w = useWallet();
  const [editing, setEditing] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(key: string, impl: string) {
    setErr(null);
    if (!isAddress(impl)) { setErr("Enter a valid address."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.registryWrite(); if (!c) return;
    setBusy(true);
    try { const tx = await c.setModule(key, impl); await tx.wait(); setEditing(null); setNewKey(""); setNewAddr(""); onDone(); }
    catch (e: any) { setErr(e?.shortMessage || e?.reason || e?.message || "Failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2 text-blood-400">
        <Box size={15} /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Modules</span>
      </div>
      <p className="text-sm text-bone-400 mb-3">Feature contracts registered by key. Swap the impl to upgrade a module without redeploying the registry.</p>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <div className="divide-y divide-ink-700/60">
        {modules.map((m) => (
          <div key={m.label} className="py-2.5 flex items-center gap-3">
            <span className="font-mono text-xs text-blood-400 w-16 shrink-0">{m.label}</span>
            {editing === m.label ? (
              <>
                <input value={next} onChange={(e) => setNext(e.target.value.trim())} placeholder="0x…"
                  className="field font-mono text-xs py-1.5 flex-1" />
                <button onClick={() => save(m.label, next)} disabled={busy} className="text-emerald-400 text-sm font-medium">Save</button>
                <button onClick={() => setEditing(null)} className="text-bone-400 text-sm">Cancel</button>
              </>
            ) : (
              <>
                <a href={`${CHAIN.explorer}/address/${m.impl}`} target="_blank" rel="noreferrer"
                   className="font-mono text-xs text-bone-200 hover:text-blood-400 inline-flex items-center gap-1 min-w-0 flex-1 truncate">
                  {m.impl} <ExternalLink size={11} />
                </a>
                <button onClick={() => { setEditing(m.label); setNext(m.impl); }} className="text-bone-400 hover:text-bone-100 text-sm">Edit</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-ink-700/60 pt-3">
        <div className="text-xs text-bone-400 mb-2 font-mono">Register a new module</div>
        <div className="flex gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value.trim())} placeholder="KEY (e.g. GROUPS)"
            className="field font-mono text-xs py-2 w-40" />
          <input value={newAddr} onChange={(e) => setNewAddr(e.target.value.trim())} placeholder="0x…"
            className="field font-mono text-xs py-2 flex-1" />
          <button onClick={() => save(newKey, newAddr)} disabled={busy || !newKey || !newAddr}
            className="btn-primary py-2 px-4 text-sm">Add</button>
        </div>
      </div>
    </div>
  );
}
