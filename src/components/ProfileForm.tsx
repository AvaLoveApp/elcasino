import { useEffect, useRef, useState } from "react";
import { useWallet } from "../lib/wallet";
import { readProfile, Profile } from "../lib/chain";
import { resolveURI } from "../lib/util";

type Props = { mode: "claim" | "edit"; initial?: Profile; onDone: () => void };
const USERNAME_RE = /^[A-Za-z0-9_]{3,15}$/;

export function ProfileForm({ mode, initial, onDone }: Props) {
  const w = useWallet();
  const [username, setUsername] = useState(initial?.username ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [avatarURI, setAvatar] = useState(initial?.avatarURI ?? "");
  const [coverURI, setCover] = useState(initial?.coverURI ?? "");
  const [avail, setAvail] = useState<null | boolean>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<any>(null);

  const validUsername = USERNAME_RE.test(username);

  useEffect(() => {
    if (mode !== "claim") return;
    setAvail(null);
    if (!validUsername) return;
    setChecking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { setAvail(Boolean(await readProfile().isUsernameAvailable(username))); }
      catch { setAvail(null); }
      finally { setChecking(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [username, validUsername, mode]);

  async function submit() {
    setErr(null);
    if (mode === "claim" && (!validUsername || avail === false)) { setErr("Pick a valid, available handle first."); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.profileWrite();
    if (!c) { setErr("Connect your wallet first."); return; }
    setBusy(true);
    try {
      const tx = mode === "claim"
        ? await c.createProfile(username, displayName, bio, avatarURI, coverURI)
        : await c.editProfile(displayName, bio, avatarURI, coverURI);
      await tx.wait();
      onDone();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Transaction failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="panel p-5 sm:p-6 animate-fade-up">
      <h2 className="text-xl font-bold tracking-tight mb-1">
        {mode === "claim" ? "Claim your handle" : "Edit profile"}
      </h2>
      <p className="text-bone-400 text-sm mb-5">
        {mode === "claim"
          ? "Your handle is unique and permanent — it lives on-chain forever, one per wallet."
          : "Your handle is permanent and can't be changed. Everything else is yours to edit."}
      </p>

      <div className="rounded-xl overflow-hidden border border-ink-600 mb-5">
        <div className="h-24 bg-ink-800 bg-cover bg-center"
          style={{ backgroundImage: coverURI ? `url(${resolveURI(coverURI)})` : undefined }} />
        <div className="px-4 pb-3 -mt-8">
          <div className="w-16 h-16 rounded-full ring-4 ring-ink-850 bg-gradient-to-br from-blood-700 to-ink-800 bg-cover bg-center"
            style={{ backgroundImage: avatarURI ? `url(${resolveURI(avatarURI)})` : undefined }} />
        </div>
      </div>

      <div className="space-y-4">
        {mode === "claim" && (
          <Field label="Handle" hint="3–15 chars · letters, numbers, underscore">
            <div className="flex items-center rounded-xl border border-ink-600 bg-ink-900/70 overflow-hidden focus-within:border-blood-500 transition">
              <span className="pl-3 pr-1 font-mono text-blood-400">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="satoshi" autoCapitalize="none" spellCheck={false}
                className="flex-1 bg-transparent py-2.5 pr-3 outline-none font-mono text-sm" />
              <span className="pr-3 text-xs font-mono">
                {!username ? "" :
                 !validUsername ? <span className="text-blood-400">invalid</span> :
                 checking ? <span className="text-bone-600">…</span> :
                 avail === true ? <span className="text-emerald-400">available</span> :
                 avail === false ? <span className="text-blood-400">taken</span> : ""}
              </span>
            </div>
          </Field>
        )}

        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64}
            placeholder="Satoshi Nakamoto" className="field" />
        </Field>

        <Field label="Bio">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280}
            placeholder="A few words about you." className="field resize-none" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Avatar URL" hint="https:// or ipfs://">
            <input value={avatarURI} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…/avatar.png" className="field font-mono" />
          </Field>
          <Field label="Cover URL" hint="https:// or ipfs://">
            <input value={coverURI} onChange={(e) => setCover(e.target.value)} placeholder="https://…/cover.png" className="field font-mono" />
          </Field>
        </div>
      </div>

      {err && <div className="text-blood-200 text-sm bg-blood-900/20 border border-blood-500/40 rounded-xl px-3 py-2 mt-4">{err}</div>}

      <div className="flex gap-2 mt-5">
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? "Confirm in wallet…" : mode === "claim" ? "Mint profile" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button onClick={onDone} disabled={busy} className="btn-ghost">Cancel</button>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-[11px] font-mono text-bone-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
