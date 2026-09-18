import { CHAIN } from "./chain";

/**
 * LI.FI swap integration for Robinhood Chain (chainId 4663). The casino tokens'
 * liquidity lives on Uniswap v4 / v3 / KyberSwap etc. — venues a plain V2 router
 * can't reach — so we route swaps through LI.FI's aggregator, which returns both
 * a quote and a ready-to-send transactionRequest. Same-chain only (Robinhood ↔
 * Robinhood): ETH ↔ token.
 *
 * Docs: https://docs.li.fi/  API: https://li.quest/v1
 */

const LIFI_API = "https://li.quest/v1";
// LI.FI's canonical "native asset" sentinel (ETH on Robinhood Chain).
export const LIFI_NATIVE = "0x0000000000000000000000000000000000000000";
// A throwaway address used purely to fetch a display quote before the user
// connects — LI.FI requires a fromAddress even for an estimate.
const QUOTE_PLACEHOLDER = "0x000000000000000000000000000000000000dEaD";

export type LifiQuote = {
  toAmount: bigint;        // expected output, in the to-token's smallest unit
  toAmountMin: bigint;     // minimum output after slippage
  toAmountRaw: string;
  fromAmountUsd?: number;
  toAmountUsd?: number;
  gasUsd?: number;
  tool: string;            // which underlying DEX LI.FI picked (e.g. "kyberswap")
  approvalAddress: string; // spender to approve for ERC-20 sells
  tx: {
    to: string;
    data: string;
    value?: string;
    from?: string;
    chainId?: number;
    gasLimit?: string;
    gasPrice?: string;
  };
};

/**
 * Fetch a LI.FI quote for a same-chain Robinhood swap.
 * @param fromToken  token address, or LIFI_NATIVE for ETH
 * @param toToken    token address, or LIFI_NATIVE for ETH
 * @param fromAmount input amount in the from-token's smallest unit (string/bigint)
 * @param fromAddress the user's wallet (or omit for a display-only estimate)
 * @param slippage   fraction, e.g. 0.01 for 1%
 */
export async function lifiQuote(opts: {
  fromToken: string;
  toToken: string;
  fromAmount: bigint | string;
  fromAddress?: string;
  slippage?: number;
}): Promise<LifiQuote> {
  const chainId = CHAIN.id;
  const params = new URLSearchParams({
    fromChain: String(chainId),
    toChain: String(chainId),
    fromToken: opts.fromToken,
    toToken: opts.toToken,
    fromAmount: String(opts.fromAmount),
    fromAddress: opts.fromAddress || QUOTE_PLACEHOLDER,
    slippage: String(opts.slippage ?? 0.01),
  });
  const res = await fetch(`${LIFI_API}/quote?${params.toString()}`);
  if (!res.ok) {
    let msg = `LI.FI quote failed (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const j: any = await res.json();
  const est = j.estimate || {};
  const tx = j.transactionRequest || {};
  const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
  return {
    toAmount: BigInt(est.toAmount ?? "0"),
    toAmountMin: BigInt(est.toAmountMin ?? est.toAmount ?? "0"),
    toAmountRaw: String(est.toAmount ?? "0"),
    fromAmountUsd: num(est.fromAmountUSD),
    toAmountUsd: num(est.toAmountUSD),
    gasUsd: num(est.gasCosts?.[0]?.amountUSD),
    tool: String(j.tool ?? j.toolDetails?.name ?? "LI.FI"),
    approvalAddress: String(est.approvalAddress ?? tx.to ?? ""),
    tx: {
      to: String(tx.to ?? ""),
      data: String(tx.data ?? ""),
      value: tx.value != null ? String(tx.value) : undefined,
      from: tx.from != null ? String(tx.from) : undefined,
      chainId: tx.chainId != null ? Number(tx.chainId) : chainId,
      gasLimit: tx.gasLimit != null ? String(tx.gasLimit) : undefined,
      gasPrice: tx.gasPrice != null ? String(tx.gasPrice) : undefined,
    },
  };
}

/** Rough price impact (%) from LI.FI's USD figures, clamped at 0. */
export function lifiImpactPct(q: LifiQuote): number | null {
  if (!q.fromAmountUsd || !q.toAmountUsd || q.fromAmountUsd <= 0) return null;
  return Math.max(0, (1 - q.toAmountUsd / q.fromAmountUsd) * 100);
}
