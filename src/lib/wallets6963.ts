import { useEffect, useState } from "react";

/**
 * EIP-6963 wallet discovery — lists every injected wallet the browser exposes
 * (MetaMask, Rabby, Phantom, Coinbase, OKX, …) WITH its real name + icon, instead
 * of the single ambiguous `window.ethereum` "browser wallet". Each entry carries
 * its own EIP-1193 `provider`, so the user picks the exact wallet and we connect
 * that one specifically.
 */
export type Eip6963Wallet = {
  uuid: string;
  name: string;
  icon: string;   // data: URI, safe to render directly
  rdns: string;
  provider: any;  // EIP-1193
};

const store = new Map<string, Eip6963Wallet>();
const subs = new Set<() => void>();
let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", (e: any) => {
    const info = e?.detail?.info;
    const provider = e?.detail?.provider;
    if (!info?.uuid || !provider) return;
    store.set(info.uuid, { uuid: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider });
    subs.forEach((f) => f());
  });
  // Ask any already-loaded wallets to (re)announce.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Live list of discovered injected wallets, sorted by name. */
export function useInjectedWallets(): Eip6963Wallet[] {
  const [list, setList] = useState<Eip6963Wallet[]>(() =>
    [...store.values()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  useEffect(() => {
    start();
    const f = () => setList([...store.values()].sort((a, b) => a.name.localeCompare(b.name)));
    subs.add(f);
    f();
    // Re-request in case this mounts before wallets announced.
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => { subs.delete(f); };
  }, []);
  return list;
}

/** One-shot snapshot (non-React callers). */
export function listInjectedWallets(): Eip6963Wallet[] {
  start();
  return [...store.values()].sort((a, b) => a.name.localeCompare(b.name));
}
