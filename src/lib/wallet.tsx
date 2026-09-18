import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { BrowserProvider, JsonRpcSigner, Contract } from "ethers";
import { CHAIN, ADDR, PROFILE_ABI, POSTS_ABI, FOLLOW_ABI, BOOKMARKS_ABI, MESSAGES_ABI, MIDGARD_ABI, ROUTER_ABI, REGISTRY_ABI, FACTORY_ABI } from "./chain";
import { setReownHandlers, openReownConnect, openReownAccount, openReownOnRamp, reownDisconnect, SocialKind } from "./reown";
import { setPrivyHandlers, privyLogin, privyLogout, privyFund, privyEnabled } from "./privy";
import { provisionSocialProfile } from "./midchat";
import { ConnectModal } from "../components/ConnectModal";
import { AccountModal } from "../components/AccountModal";

type SocialProfile = { name?: string; avatar?: string; social?: SocialKind } | null;

type WalletState = {
  address: string | null;
  signer: JsonRpcSigner | null;
  chainOk: boolean;
  connecting: boolean;
  isSocial: boolean;             // connected via Reown email/social (embedded wallet)
  profile: SocialProfile;        // display name / avatar for social logins
  connectOpen: boolean;          // our branded connect modal is showing
  connect: () => void;           // opens the branded connect modal (used everywhere)
  openConnect: () => void;
  closeConnect: () => void;
  connectInjected: () => Promise<void>;  // browser wallet (MetaMask, etc.)
  connectWith: (provider: any) => Promise<void>; // a specific EIP-6963 wallet
  connectSocial: () => Promise<void>;    // Privy (or Reown) email / Google / X / …
  openAccount: () => Promise<void>;   // deposit / withdraw / on-ramp / export (social)
  openOnRamp: () => Promise<void>;    // buy ETH with card
  disconnect: () => void;
  switchChain: () => Promise<void>;
  profileWrite: () => Contract | null;
  postsWrite: (addr: string) => Contract | null;
  followWrite: (addr: string) => Contract | null;
  tokenWrite: () => Contract | null;
  routerWrite: () => Contract | null;
  registryWrite: () => Contract | null;
  bookmarksWrite: (addr: string) => Contract | null;
  messagesWrite: (addr: string) => Contract | null;
  factoryWrite: (addr: string) => Contract | null;
};

const Ctx = createContext<WalletState>(null as any);
export const useWallet = () => useContext(Ctx);

function injectedEth(): any {
  return (window as any).ethereum ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSocial, setIsSocial] = useState(false);
  const [profile, setProfile] = useState<SocialProfile>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // The active EIP-1193 provider — the injected wallet by default, or the Reown
  // embedded/social provider once a social login completes. All reads/writes and
  // event listeners bind to whichever is active.
  const provRef = useRef<any>(null);

  const refresh = useCallback(async (): Promise<string | null> => {
    const provider = provRef.current || injectedEth();
    if (!provider) return null;
    const bp = new BrowserProvider(provider);
    const accts: string[] = await provider.request({ method: "eth_accounts" });
    if (!accts.length) {
      setAddress(null);
      setSigner(null);
      return null;
    }
    const net = await bp.getNetwork();
    setChainOk(Number(net.chainId) === CHAIN.id);
    const s = await bp.getSigner();
    setSigner(s);
    const a = await s.getAddress();
    setAddress(a);
    return a;
  }, []);

  const openConnect = useCallback(() => setConnectOpen(true), []);
  const closeConnect = useCallback(() => setConnectOpen(false), []);
  // Every legacy call site uses `connect()` — now it pops our branded modal that
  // offers browser-wallet + social in one compact, on-brand surface.
  const connect = useCallback(() => setConnectOpen(true), []);

  const connectInjected = useCallback(async () => {
    const provider = injectedEth();
    if (!provider) {
      // No injected wallet — fall back to the social / WalletConnect modal.
      await openReownConnect();
      return;
    }
    provRef.current = provider;
    setIsSocial(false); setProfile(null);
    setConnecting(true);
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await refresh();
      setConnectOpen(false);
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  // Connect a SPECIFIC injected wallet (chosen from the EIP-6963 list), so the
  // user picks Rabby vs MetaMask vs Phantom by its real name + logo.
  const connectWith = useCallback(async (provider: any) => {
    if (!provider) return connectInjected();
    provRef.current = provider;
    setIsSocial(false); setProfile(null);
    setConnecting(true);
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await refresh();
      setConnectOpen(false);
    } finally {
      setConnecting(false);
    }
  }, [refresh, connectInjected]);

  const connectSocial = useCallback(async () => {
    setConnecting(true);
    try {
      // Prefer Privy for social (reliable embedded wallet); fall back to Reown.
      if (privyEnabled) { privyLogin(); setConnectOpen(false); return; }
      const ok = await openReownConnect();
      if (!ok) alert("Could not load the social login (network). Try an injected wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  // Our own account panel (deposit / withdraw / buy / export). Reown's account
  // modal is only used as a fallback for a Reown-embedded session (legacy).
  const openAccount = useCallback(async () => {
    if (privyEnabled || provRef.current) { setAccountOpen(true); return; }
    await openReownAccount();
  }, []);
  const openOnRamp = useCallback(async () => {
    if (privyEnabled && isSocial && address) { privyFund(address); return; }
    if (provRef.current) { setAccountOpen(true); return; }
    await openReownOnRamp();
  }, [isSocial, address]);

  // Adopt / drop a social-surfaced embedded wallet (Privy or Reown) when a social
  // flow connects. Both surface a plain EIP-1193 provider, so one handler serves both.
  useEffect(() => {
    const adopt = {
      onConnect: (rp: any, prof: SocialProfile) => {
        provRef.current = rp;
        setIsSocial(true);
        setProfile(prof);
        setConnectOpen(false);
        // These providers emit the same events; rebind listeners to it.
        try {
          rp.on?.("accountsChanged", () => refresh());
          rp.on?.("chainChanged", () => refresh());
        } catch {}
        // Once we know the embedded-wallet address, auto-provision the Supabase
        // identity (stable user_id = wallet) with the social name/avatar locked.
        refresh().then((addr) => {
          if (addr) provisionSocialProfile(addr, prof?.name, prof?.avatar, prof?.social ?? null).catch(() => {});
        }).catch(() => {});
      },
      onDisconnect: () => {
        provRef.current = injectedEth();
        setIsSocial(false); setProfile(null);
        setAddress(null); setSigner(null);
      },
    };
    setReownHandlers(adopt);
    setPrivyHandlers(adopt);
  }, [refresh]);

  const switchChain = useCallback(async () => {
    const provider = provRef.current || injectedEth();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN.hexId }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CHAIN.hexId,
            chainName: CHAIN.name,
            rpcUrls: [CHAIN.rpc],
            nativeCurrency: CHAIN.currency,
            blockExplorerUrls: [CHAIN.explorer],
          }],
        });
      }
    }
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    if (isSocial) {
      if (privyEnabled) privyLogout(); else reownDisconnect();
      provRef.current = injectedEth(); setIsSocial(false); setProfile(null);
    }
  }, [isSocial]);

  const profileWrite = useCallback(() => {
    if (!signer) return null;
    return new Contract(ADDR.profile, PROFILE_ABI, signer);
  }, [signer]);

  const postsWrite = useCallback((addr: string) => {
    if (!signer || !addr) return null;
    return new Contract(addr, POSTS_ABI, signer);
  }, [signer]);

  const followWrite = useCallback((addr: string) => {
    if (!signer || !addr) return null;
    return new Contract(addr, FOLLOW_ABI, signer);
  }, [signer]);

  const tokenWrite = useCallback(() => {
    if (!signer) return null;
    return new Contract(ADDR.token, MIDGARD_ABI, signer);
  }, [signer]);

  const routerWrite = useCallback(() => {
    if (!signer) return null;
    return new Contract(ADDR.router, ROUTER_ABI, signer);
  }, [signer]);

  const registryWrite = useCallback(() => {
    if (!signer) return null;
    return new Contract(ADDR.registry, REGISTRY_ABI, signer);
  }, [signer]);

  const bookmarksWrite = useCallback((addr: string) => {
    if (!signer || !addr) return null;
    return new Contract(addr, BOOKMARKS_ABI, signer);
  }, [signer]);

  const messagesWrite = useCallback((addr: string) => {
    if (!signer || !addr) return null;
    return new Contract(addr, MESSAGES_ABI, signer);
  }, [signer]);

  const factoryWrite = useCallback((addr: string) => {
    if (!signer || !addr) return null;
    return new Contract(addr, FACTORY_ABI, signer);
  }, [signer]);

  useEffect(() => {
    const provider = injectedEth();
    if (!provider) return;
    if (!provRef.current) provRef.current = provider;
    refresh();
    const onAccounts = () => refresh();
    const onChain = () => refresh();
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ address, signer, chainOk, connecting, isSocial, profile, connectOpen, connect, openConnect, closeConnect, connectInjected, connectWith, connectSocial, openAccount, openOnRamp, disconnect, switchChain, profileWrite, postsWrite, followWrite, tokenWrite, routerWrite, registryWrite, bookmarksWrite, messagesWrite, factoryWrite }}>
      {children}
      <ConnectModal
        open={connectOpen}
        connecting={connecting}
        onClose={closeConnect}
        onInjected={connectInjected}
        onWallet={connectWith}
        onSocial={connectSocial}
      />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </Ctx.Provider>
  );
}
