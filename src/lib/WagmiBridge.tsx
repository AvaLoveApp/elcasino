import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { useWallet } from "./wallet";

/**
 * Keeps wagmi's account in sync with the app's existing ethers wallet. When the
 * ethers WalletProvider has an address (user connected via the app's own UI),
 * we auto-connect wagmi's injected connector to the same provider so the ported
 * Avlo casino games — which use wagmi hooks — see the account without a second
 * connect button. Renders nothing.
 */
export function WagmiBridge() {
  const w = useWallet();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    if (w.address && !isConnected) {
      const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
      if (injected) connect({ connector: injected });
    }
  }, [w.address, isConnected, connect, connectors]);

  return null;
}
