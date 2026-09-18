import { PrivyProvider, usePrivy, useWallets, useFundWallet, useExportWallet } from "@privy-io/react-auth";
import { ReactNode, useEffect, useRef } from "react";
import { defineChain } from "viem";
import { CHAIN } from "./chain";
import type { SocialKind } from "./reown";

/**
 * Privy — social / email login → self-custodial embedded wallet. Replaces Reown's
 * flaky social flow (the "Authentication successful, go back" that never actually
 * connected). We reuse the shared Avlo Privy app so wallets carry across both
 * platforms. Privy's embedded wallet exposes a standard EIP-1193 provider, which
 * we hand to the existing ethers `WalletProvider` via `setPrivyHandlers` — so the
 * entire app (reads, writes, chain switch) works unchanged. Injected wallets
 * (MetaMask/Rabby/…) still connect directly via EIP-6963; Privy is social-only.
 *
 * Enabled only when VITE_PRIVY_APP_ID is set; otherwise PrivyRoot is a passthrough
 * and the app falls back to the previous Reown social path.
 */
export const PRIVY_APP_ID: string = ((import.meta as any).env?.VITE_PRIVY_APP_ID as string | undefined) || "";
export const privyEnabled = !!PRIVY_APP_ID;

const robinhood = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.currency,
  rpcUrls: { default: { http: [CHAIN.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: CHAIN.explorer } },
});

type Profile = { name?: string; avatar?: string; social?: SocialKind } | null;
type Handlers = { onConnect: (provider: any, profile: Profile) => void; onDisconnect: () => void };

let handlers: Handlers | null = null;
let pending: { provider: any; profile: Profile } | null = null; // connect that fired before handlers registered
export function setPrivyHandlers(h: Handlers) {
  handlers = h;
  if (pending) { const p = pending; pending = null; Promise.resolve().then(() => h.onConnect(p.provider, p.profile)); }
}

// Imperative triggers wired by the bridge, so our own UI can drive Privy.
let _login: (() => void) | null = null;
let _logout: (() => void) | null = null;
let _fund: ((address: string) => void) | null = null;
let _export: ((address: string) => void) | null = null;
export function privyLogin() { _login?.(); }
export function privyLogout() { _logout?.(); }
/** Open Privy's fiat on-ramp (buy ETH with card) for the embedded wallet. */
export function privyFund(address: string) { _fund?.(address); }
/** Open Privy's secure private-key export for the embedded wallet. */
export function privyExport(address: string) { _export?.(address); }
export { robinhood as privyChain };

export function PrivyRoot({ children }: { children: ReactNode }) {
  if (!privyEnabled) return <>{children}</>;
  const origin = typeof location !== "undefined" ? location.origin : "";
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#93E014",
          logo: origin + "/elcasino_logo.png",
          walletChainType: "ethereum-only",
        },
        loginMethods: ["google", "twitter", "email", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        defaultChain: robinhood,
        supportedChains: [robinhood],
      }}
    >
      {children}
      <PrivyBridge />
    </PrivyProvider>
  );
}

/** Bridges Privy auth state → the ethers WalletProvider. Renders nothing. */
function PrivyBridge() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  const { exportWallet } = useExportWallet();
  const last = useRef<string | null>(null);

  useEffect(() => {
    _login = () => login();
    _logout = () => logout();
    _fund = (address: string) => { Promise.resolve(fundWallet({ address, options: { chain: robinhood } } as any)).catch(() => {}); };
    _export = (address: string) => { Promise.resolve(exportWallet({ address } as any)).catch(() => {}); };
  }, [login, logout, fundWallet, exportWallet]);

  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      // Prefer the embedded (Privy) wallet; fall back to any connected wallet.
      const w = wallets.find((x) => x.walletClientType === "privy") || wallets[0];
      if (!w || w.address === last.current) return;
      last.current = w.address;
      w.getEthereumProvider().then((provider: any) => {
        const u = user as any;
        const profile: Profile = {
          name: u?.google?.name || u?.twitter?.name || u?.twitter?.username || u?.email?.address || u?.farcaster?.displayName || undefined,
          avatar: u?.twitter?.profilePictureUrl || u?.farcaster?.pfp || undefined,
          social: u?.google ? "google" : u?.twitter ? "x" : u?.email ? "email" : u?.farcaster ? "farcaster" : "wallet",
        };
        if (handlers) handlers.onConnect(provider, profile);
        else pending = { provider, profile };
      }).catch(() => {});
    } else if (last.current) {
      last.current = null;
      handlers?.onDisconnect();
    }
  }, [ready, authenticated, wallets, user]);

  return null;
}
