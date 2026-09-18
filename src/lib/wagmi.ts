import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";
import { RPC_READ_URL } from "./chain";

/**
 * wagmi config for the ported Avlo casino games. Robinhood chain only — the
 * games we integrate are the 10 commit-reveal factories deployed there.
 *
 * We use the browser's injected wallet (same one the rest of Midgard Social
 * uses via ethers), so a user connects once and both stacks see the account.
 */
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

export const wagmiConfig = createConfig({
  chains: [robinhood],
  connectors: [injected()],
  transports: {
    // Route wagmi/viem reads through the SAME same-origin /rpc proxy the rest of
    // the app uses (CORS-safe), with JSON-RPC batching + multicall aggregation so
    // many eth_calls collapse into few round-trips instead of one each.
    [robinhood.id]: http(RPC_READ_URL, {
      batch: { wait: 200 },
    }),
  },
  // Slow the block/account watch loop (default ~4s) — the casino/trade data has
  // its own paced pollers, so wagmi doesn't need to hammer the RPC every tick.
  pollingInterval: 12_000,
  // The app manages connection UX itself; wagmi just needs the account + chain.
  multiInjectedProviderDiscovery: true,
});

export const ROBINHOOD_CHAIN_ID = 4663;
