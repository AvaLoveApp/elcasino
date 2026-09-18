import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./lib/wallet";
import { PrivyRoot } from "./lib/privy";
import { LivePlayerProvider } from "./lib/livePlayer";
import { ComposeProvider } from "./lib/compose";
import { AppConfigProvider } from "./lib/appConfig";
import { wagmiConfig } from "./lib/wagmi";
import { WagmiBridge } from "./lib/WagmiBridge";
import App from "./App";
import { startAnimatedFavicon } from "./lib/animatedFavicon";
import "./index.css";

startAnimatedFavicon();

// wagmi + react-query power the ported Avlo casino games; the rest of the app
// keeps using the existing ethers-based WalletProvider. Both read the same
// injected wallet, so a single connect covers everything.
const queryClient = new QueryClient();

// PWA: register the service worker in production so Midgard installs to the home
// screen and repeat loads are instant. Dev is skipped to avoid stale-asset caching.
if ((import.meta as any).env?.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <PrivyRoot>
            <WalletProvider>
              <ComposeProvider>
                <WagmiBridge />
                <LivePlayerProvider>
                  <AppConfigProvider>
                    <App />
                  </AppConfigProvider>
                </LivePlayerProvider>
                <Toaster position="bottom-right" toastOptions={{
                  style: { background: "#1a1a1a", color: "#e5e0d8", border: "1px solid #3a2f2f", fontFamily: "monospace", fontSize: "13px" },
                }} />
              </ComposeProvider>
            </WalletProvider>
          </PrivyRoot>
        </HashRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
