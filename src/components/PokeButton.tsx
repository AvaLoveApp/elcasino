import { useState } from "react";
import { Zap, Check, Loader2 } from "lucide-react";
import { useWallet } from "../lib/wallet";

/**
 * Permissionless "poke" — realizes the accrued pool burn on ELCAS (the pool burn
 * can't sync mid-swap, so anyone can poke to catch price up to the burn). Gas is
 * a normal tx; holder decay + reflection accrue without it.
 */
export function PokeButton({ compact, onPoked }: { compact?: boolean; onPoked?: () => void }) {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function poke() {
    setErr(null);
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const t = w.tokenWrite();
    if (!t) { setErr("Connect wallet"); return; }
    setBusy(true);
    try {
      const tx = await t.poke();
      await tx.wait();
      setOk(true); onPoked?.();
      setTimeout(() => setOk(false), 2500);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Poke failed.");
      setTimeout(() => setErr(null), 4000);
    } finally { setBusy(false); }
  }

  const label = busy ? "Poking…" : ok ? "Poked" : "Poke";
  return (
    <button onClick={poke} disabled={busy} title="Realize the accrued pool burn (permissionless) — price catches up"
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold transition disabled:opacity-50 ${
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${ok ? "border-emerald-500/50 text-emerald-300 bg-emerald-900/20" : err ? "border-blood-500/50 text-blood-300 bg-blood-900/20" : "border-blood-500/40 text-blood-300 hover:bg-blood-900/20"}`}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : ok ? <Check size={12} /> : <Zap size={12} />}
      {err ? "Retry" : label}
    </button>
  );
}
