import { useEffect, useState } from "react";
import { Contract, parseUnits, isAddress, formatUnits } from "ethers";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Dices, Search, Lock, AlertTriangle, Recycle } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { sendBroadcast } from "../lib/social";
import { CASINO_GAMES, GameKey, FACTORY_ABI, DEPLOY_FEE_WEI, CASINO_TREASURY, isCasinoUnsafeToken } from "../lib/casino";
import { GameTypeIcon } from "./GameTypeIcon";
import { GAME_ERC20_ABI } from "../lib/casinoGame";
import { readProvider } from "../lib/chain";
import { searchDexTokens, DexToken, fmtUsdShort } from "../lib/dexscreener";

/**
 * Create a new game room. The bet token is picked from DexScreener (by name or
 * contract address); selecting it locks the room name (SYMBOL + game) and the
 * token logo. Mirrors Avlo's createGame(token, logo, name, rtpBP, feeBP,
 * maxWinBP, minBet, maxBetPoolRatio, initialPool) payable(deployFee).
 */
export function CreateGameDialog({ defaultGame, defaultToken, onClose }: { defaultGame?: GameKey; defaultToken?: DexToken | null; onClose: () => void }) {
  const w = useWallet();
  const nav = useNavigate();
  const [gameKey, setGameKey] = useState<GameKey>(defaultGame ?? "roulette");

  // token picker — prefilled when launched from a "Deploy" shelf card.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexToken[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DexToken | null>(defaultToken ?? null);

  // params
  const [rtp, setRtp] = useState("97");
  const [fee, setFee] = useState("2");
  const [maxWin, setMaxWin] = useState("100");
  const [minBet, setMinBet] = useState("1");
  const [maxRatio, setMaxRatio] = useState("10");
  const [initialPool, setInitialPool] = useState("0");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unsafe, setUnsafe] = useState(false); // MIDGARD / launchpad token → can't back a room

  const game = CASINO_GAMES.find((g) => g.key === gameKey)!;
  const autoName = selected ? `${selected.symbol} ${game.label}` : "";
  const token = selected?.address ?? "";
  const logo = selected?.logo ?? "";

  // The team/treasury wallet is exempt from the deploy fee on-chain (the contract
  // never charges it — it's the wallet fees are paid TO). So skip sending value
  // for it; the tx would otherwise overpay ETH that never comes back.
  const isFeeExempt = !!w.address && w.address.toLowerCase() === CASINO_TREASURY;
  const deployFeeWei = isFeeExempt ? 0n : DEPLOY_FEE_WEI;

  // Debounced DexScreener search.
  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchDexTokens(q);
      setResults(r); setSearching(false);
    }, 350);
    return () => { clearTimeout(t); setSearching(false); };
  }, [query, selected]);

  // Flag MIDGARD / launchpad tokens — their decay + reflection engine would strand
  // a room's pooled funds, so they can't back a game.
  useEffect(() => {
    setUnsafe(false);
    if (!token || !isAddress(token)) return;
    let live = true;
    isCasinoUnsafeToken(token).then((u) => { if (live) setUnsafe(u); }).catch(() => {});
    return () => { live = false; };
  }, [token]);

  async function create() {
    setErr(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    if (!w.signer) return;
    if (!isAddress(token)) { setErr("Pick a token from DexScreener first."); return; }
    if (await isCasinoUnsafeToken(token)) {
      setUnsafe(true);
      setErr("This token isn't supported — ELCAS and launchpad tokens decay and would strand the pool's funds.");
      return;
    }

    try {
      const erc = new Contract(token, GAME_ERC20_ABI, readProvider);
      const decimals = Number(await erc.decimals().catch(() => 18));
      const minBetWei = parseUnits(minBet || "0", decimals);
      const poolWei = parseUnits(initialPool || "0", decimals);

      if (poolWei > 0n) {
        setBusy("approving token…");
        const ercW = new Contract(token, GAME_ERC20_ABI, w.signer);
        const allowance: bigint = await ercW.allowance(w.address, game.factory);
        if (allowance < poolWei) await (await ercW.approve(game.factory, poolWei)).wait();
      }

      setBusy("creating room…");
      const factory = new Contract(game.factory, FACTORY_ABI, w.signer);
      const tx = await factory.createGame(
        token, logo.trim(), autoName.trim(),
        BigInt(Math.round(Number(rtp) * 100)),
        BigInt(Math.round(Number(fee) * 100)),
        BigInt(Math.round(Number(maxWin) * 100)),
        minBetWei,
        BigInt(Math.round(Number(maxRatio) * 100)),
        poolWei,
        { value: deployFeeWei },
      );
      const rc = await tx.wait();
      let addr: string | null = null;
      for (const log of rc.logs) {
        try { const parsed = factory.interface.parseLog(log); if (parsed?.name === "GameCreated") { addr = parsed.args.gameAddress; break; } } catch {}
      }
      if (addr) sendBroadcast({ sender: w.address || "", kind: "room", title: `New ${game.label} room`, body: `${autoName} is live 🎲`, image: logo.trim(), url: `./#/casino/room/${gameKey}/${addr}` }).catch(() => {});
      onClose();
      nav(addr ? `/casino/room/${gameKey}/${addr}` : `/casino?g=${gameKey}`);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Create failed.");
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-up">
      <div>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={onClose} className="inline-flex items-center gap-1 btn-ghost py-1.5 px-3 text-xs shrink-0"><ArrowLeft size={14} /> Back</button>
            <Dices size={20} className="text-blood-400" />
            <h1 className="text-2xl font-bold tracking-tight">Create a game room</h1>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* ── Left: game + token ── */}
            <div className="panel p-5 space-y-4">
              <div>
                <Label>Game</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CASINO_GAMES.map((g) => (
                    <button key={g.key} onClick={() => setGameKey(g.key)} title={g.label}
                      className={`rounded-lg border flex flex-col items-center justify-center gap-1 py-2 transition ${gameKey === g.key ? "border-blood-500 bg-blood-900/25" : "border-ink-600 hover:border-blood-500/50"}`}
                      style={{ color: gameKey === g.key ? g.color : undefined }}>
                      <GameTypeIcon type={g.key} size={20} animate={gameKey === g.key} />
                      <span className="text-[8px] font-mono text-bone-400 leading-none">{g.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-bone-500">{game.label} · {game.desc}</div>
              </div>

              <div>
                <Label>Bet token · search DexScreener</Label>
                {selected ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/10 p-3 flex items-center gap-3">
                    {selected.logo ? <img src={selected.logo} alt="" className="h-10 w-10 rounded-full border border-ink-600" /> : <div className="h-10 w-10 rounded-full bg-ink-800 grid place-items-center font-mono text-xs">{selected.symbol.slice(0, 3)}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm flex items-center gap-1.5">{selected.symbol} <span className="text-bone-500 font-normal truncate">{selected.name}</span></div>
                      <div className="font-mono text-[10px] text-bone-500 truncate">{selected.chainId} · liq {fmtUsdShort(selected.liquidityUsd)} · {selected.address.slice(0, 8)}…</div>
                    </div>
                    <button onClick={() => { setSelected(null); setQuery(""); setResults(null); }} className="text-[11px] font-mono text-bone-400 hover:text-blood-400 shrink-0">change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-bone-500" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Token name or 0x contract…"
                      className="w-full bg-ink-900/70 border border-ink-600 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blood-500 font-mono" />
                    {(searching || results) && (
                      <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-ink-600 bg-ink-900 divide-y divide-ink-700/60">
                        {searching && <div className="px-3 py-3 text-xs text-bone-500 font-mono inline-flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> searching…</div>}
                        {!searching && results?.length === 0 && <div className="px-3 py-3 text-xs text-bone-500 font-mono">no tokens found</div>}
                        {!searching && results?.map((t) => (
                          <button key={t.address + t.chainId} onClick={() => setSelected(t)} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-ink-800 text-left">
                            {t.logo ? <img src={t.logo} alt="" className="h-7 w-7 rounded-full" /> : <div className="h-7 w-7 rounded-full bg-ink-800 grid place-items-center font-mono text-[9px]">{t.symbol.slice(0, 3)}</div>}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate">{t.symbol} <span className="text-bone-500 font-normal">{t.name}</span></div>
                              <div className="font-mono text-[9px] text-bone-500">{t.chainId} · liq {fmtUsdShort(t.liquidityUsd)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* locked room name + logo */}
              <div className="grid grid-cols-2 gap-3">
                <LockedField label="Room name" value={autoName || "—"} />
                <div>
                  <Label>Token logo</Label>
                  <div className="rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2 flex items-center gap-2 text-sm">
                    {logo ? <><img src={logo} alt="" className="h-6 w-6 rounded-full" /> <span className="text-emerald-400 inline-flex items-center gap-1 text-[11px] font-mono"><Lock size={10} /> locked</span></> : <span className="text-bone-600 text-[11px] font-mono">from DexScreener</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: params + deploy ── */}
            <div className="panel p-5 space-y-4">
              <div>
                <Label>Room parameters</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="RTP %" value={rtp} onChange={setRtp} num />
                  <Field label="House fee %" value={fee} onChange={setFee} num />
                  <Field label="Max win % of pool" value={maxWin} onChange={setMaxWin} num />
                  <Field label="Max bet % of pool" value={maxRatio} onChange={setMaxRatio} num />
                  <Field label="Min bet" value={minBet} onChange={setMinBet} num />
                  <Field label="Initial pool (you fund)" value={initialPool} onChange={setInitialPool} num />
                </div>
              </div>

              <div className="rounded-xl border border-blood-500/30 bg-blood-900/15 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="font-mono text-xs text-bone-300">
                  <span className="uppercase tracking-wider text-[10px] text-bone-500">Deploy fee</span>
                  <div className="text-lg font-bold text-bone-50">
                    {isFeeExempt ? <span className="text-emerald-400">0 ETH · exempt</span> : `${formatUnits(DEPLOY_FEE_WEI, 18)} ETH`}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-bone-500 text-right">{isFeeExempt ? "team wallet · fee waived" : "paid once, on-chain"}{Number(initialPool) > 0 && <><br />+ {initialPool} {selected?.symbol || "token"} initial pool</>}</div>
              </div>

              <p className="flex items-start gap-1.5 text-[10px] font-mono text-emerald-300/80 -mt-1">
                <Recycle size={12} className="shrink-0 mt-px" />
                The deploy fee and the platform fee taken per bet both fund <span className="text-emerald-300">ELCAS buyback &amp; LP</span>.
              </p>

              {unsafe && (
                <div className="flex items-start gap-2 text-amber-200 text-xs bg-amber-900/20 border border-amber-500/40 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                  <div><span className="font-semibold">Not supported as a bet token.</span> ELCAS and launchpad tokens decay and reflect over time — a room holds the bet token in a pool, so its real balance would drift below what the game owes and payouts could get stuck. Pick a standard token instead.</div>
                </div>
              )}

              {err && <div className="text-blood-200 text-xs bg-blood-900/20 border border-blood-500/40 rounded-lg px-3 py-2">{err}</div>}

              <button onClick={create} disabled={!!busy || !selected || unsafe}
                className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 text-base disabled:opacity-50">
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy || (unsafe ? "Token not supported" : !selected ? "Pick a token first" : w.address ? `Create room · ${isFeeExempt ? "0 ETH · exempt" : `${formatUnits(DEPLOY_FEE_WEI, 18)} ETH`}` : "Connect wallet")}
              </button>
              <p className="font-mono text-[10px] text-bone-600 text-center">
                Deploys a real {game.label} contract on Robinhood. Fully on-chain, instantly playable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-bone-500 font-mono mb-1">{children}</div>;
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="rounded-lg border border-ink-600 bg-ink-900/40 px-3 py-2 text-sm flex items-center gap-1.5 truncate">
        <Lock size={11} className="text-emerald-400 shrink-0" /> <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, num }: { label: string; value: string; onChange: (v: string) => void; num?: boolean }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input value={value}
        onChange={(e) => onChange(num ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        inputMode={num ? "decimal" : undefined}
        className="w-full bg-ink-900/70 border border-ink-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blood-500" />
    </label>
  );
}
