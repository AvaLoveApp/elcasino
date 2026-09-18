/**
 * Reown AppKit — social / email / WalletConnect login, lazy-loaded from esm.sh so
 * it never weighs on first paint (injected wallets connect without it). Surfaces a
 * plain EIP-1193 provider that the ethers WalletProvider adopts, so one connect
 * covers the whole app. Ported from the Market Maker terminal (same project id).
 *
 * Auth robustness: embedded (Google/X/email) wallets expose their provider a beat
 * AFTER `isConnected` flips. We capture it from BOTH `subscribeProviders` (fires
 * as soon as the socket is ready) and a long polling fallback, so social logins
 * never "connect but do nothing" — the previous 3.2s window was too short and
 * dropped slow OAuth round-trips.
 */

export type SocialKind = "google" | "x" | "github" | "discord" | "apple" | "farcaster" | "email" | "wallet" | null;
type Profile = { name?: string; avatar?: string; social?: SocialKind } | null;
type Handlers = { onConnect: (provider: any, profile: Profile) => void; onDisconnect: () => void };

let started = false;
let appKit: any = null;
let handlers: Handlers | null = null;
let lastAddr: string | null = null;
// Provider captured early via subscribeProviders — the fast path for socials.
let cachedProvider: any = null;

const ROBINHOOD = {
  id: 4663,
  name: "Robinhood Chain",
  caipNetworkId: "eip155:4663",
  chainNamespace: "eip155",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
};

/** Register the callbacks the WalletProvider uses to adopt / drop the provider. */
export function setReownHandlers(h: Handlers) {
  handlers = h;
  // If a social login already completed before the handler was registered
  // (rare race on hot reload), replay it so the app doesn't miss the connect.
  if (cachedProvider && lastAddr) {
    Promise.resolve().then(() => h.onConnect(cachedProvider, lastKnownProfile));
  }
}

/** Whether AppKit has been initialized this session (i.e. a social flow was used). */
export function reownActive() { return !!appKit; }

let lastKnownProfile: Profile = null;

function isEip1193(p: any): boolean {
  return !!p && typeof p.request === "function";
}

/** Pull the active embedded-wallet provider by any means AppKit exposes. */
async function grabProvider(tries = 50): Promise<any> {
  if (isEip1193(cachedProvider)) return cachedProvider;
  for (let i = 0; i < tries; i++) {
    let p: any = null;
    try { p = appKit?.getWalletProvider?.(); } catch {}
    if (isEip1193(p)) { cachedProvider = p; return p; }
    try { p = await appKit?.getProvider?.("eip155"); } catch {}
    if (isEip1193(p)) { cachedProvider = p; return p; }
    if (isEip1193(cachedProvider)) return cachedProvider;
    await new Promise((r) => setTimeout(r, 200));
  }
  return isEip1193(cachedProvider) ? cachedProvider : null;
}

function socialFromInfo(w: any): SocialKind {
  const raw = String(w?.name || w?.type || w?.rdns || "").toLowerCase();
  if (raw.includes("google")) return "google";
  if (raw === "x" || raw.includes("twitter") || raw.includes(" x ")) return "x";
  if (raw.includes("github")) return "github";
  if (raw.includes("discord")) return "discord";
  if (raw.includes("apple")) return "apple";
  if (raw.includes("farcaster")) return "farcaster";
  if (raw.includes("email")) return "email";
  return null;
}

function profileOf(acc: any): Profile {
  try {
    const w = appKit?.getWalletInfo?.();
    const p: Profile = {
      name: acc?.profileName || w?.name || undefined,
      avatar: acc?.profileImage || w?.icon || undefined,
      social: socialFromInfo(w),
    };
    lastKnownProfile = p;
    return p;
  } catch { return lastKnownProfile; }
}

/** Lazy-load + initialize AppKit once. Returns false if the CDN load fails. */
export async function loadReown(): Promise<boolean> {
  if (appKit) return true;
  if (started) {
    for (let i = 0; i < 80 && !appKit; i++) await new Promise((r) => setTimeout(r, 100));
    return !!appKit;
  }
  started = true;
  try {
    // Non-literal specifiers so TypeScript treats these as runtime-only dynamic
    // imports (it can't resolve an https URL) and Vite leaves them untouched.
    const APPKIT_URL = "https://esm.sh/@reown/appkit@1.7.8?bundle-deps";
    const ADAPTER_URL = "https://esm.sh/@reown/appkit-adapter-ethers@1.7.8?deps=@reown/appkit@1.7.8&bundle-deps";
    const { createAppKit } = await import(/* @vite-ignore */ APPKIT_URL);
    const { EthersAdapter } = await import(/* @vite-ignore */ ADAPTER_URL);
    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [ROBINHOOD],
      defaultNetwork: ROBINHOOD,
      projectId: "0299d75f727f4ded571ce094407cf023",
      enableCoinbase: false, // its SDK fails to resolve over esm.sh; other wallets + socials unaffected
      metadata: {
        name: "EL-Casino",
        description: "On-chain finance protocol on Robinhood Chain — the MIDGARD economy, real-yield claims, and an on-chain casino.",
        url: location.origin,
        icons: [location.origin + "/elcasino_logo.png"],
      },
      features: { analytics: false, email: true, socials: ["google", "x", "github", "discord", "apple", "farcaster"], emailShowWallets: true },
      themeMode: "dark",
      // Midgard yellow-green neon — matches the app's `blood` palette (#B4FF2E / #93E014).
      themeVariables: {
        "--w3m-accent": "#93E014",
        "--w3m-color-mix": "#B4FF2E",
        "--w3m-color-mix-strength": 16,
        "--w3m-border-radius-master": "3px",
        "--w3m-font-family": "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      },
    });

    // FAST PATH: capture the embedded-wallet provider the instant it appears.
    try {
      appKit.subscribeProviders?.((state: any) => {
        const p = state?.eip155 || state?.["eip155"];
        if (isEip1193(p)) cachedProvider = p;
      });
    } catch {}

    appKit.subscribeAccount(async (acc: any) => {
      if (acc && acc.isConnected && acc.address) {
        if (acc.address === lastAddr && isEip1193(cachedProvider)) return; // already surfaced
        lastAddr = acc.address;
        const prof = profileOf(acc);
        const prov = await grabProvider();
        if (prov && handlers) handlers.onConnect(prov, prof);
      } else if (acc && !acc.isConnected && lastAddr) {
        lastAddr = null;
        cachedProvider = null;
        handlers?.onDisconnect();
      }
    });
    return true;
  } catch (e) {
    started = false;
    console.warn("Reown AppKit failed to load:", e);
    return false;
  }
}

/**
 * Open the connect modal. Optionally jump straight to a specific social/view so a
 * one-tap "Continue with Google" in our own modal lands on the Google flow.
 */
export async function openReownConnect(view?: "Connect" | "ConnectSocials"): Promise<boolean> {
  const ok = await loadReown();
  if (!ok) return false;
  try { appKit.open(view ? { view } : undefined); }
  catch { appKit.open(); }
  return true;
}

/** Open the account view — deposit / withdraw / on-ramp / export / disconnect. */
export async function openReownAccount(): Promise<boolean> {
  const ok = await loadReown();
  if (ok) { try { appKit.open({ view: "Account" }); } catch { appKit.open(); } }
  return ok;
}

/** Open the on-ramp (buy ETH with card) if available, else the account view. */
export async function openReownOnRamp(): Promise<boolean> {
  const ok = await loadReown();
  if (ok) { try { appKit.open({ view: "OnRampProviders" }); } catch { appKit.open({ view: "Account" }); } }
  return ok;
}

export async function reownDisconnect() {
  try { await appKit?.disconnect(); } catch {}
  cachedProvider = null; lastAddr = null;
}
