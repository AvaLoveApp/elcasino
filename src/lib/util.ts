export function short(addr?: string | null): string {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/**
 * Micro-price notation like DEX Screener: 0.00000000123 -> "0.0₈123".
 * Above 0.01, plain fixed. Above 1, fewer decimals.
 */
export function fmtPrice(n: number, sig = 3): string {
  if (!isFinite(n) || n <= 0) return "0";
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 0.01) return n.toFixed(4);
  const s = n.toExponential(sig - 1);              // e.g. "1.03e-8"
  const [mant, exp] = s.split("e");
  const e = -parseInt(exp, 10);
  if (e <= 0) return n.toFixed(6);
  const digits = mant.replace(".", "");            // "103"
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (e - 1).toString().split("").map((c) => subs[+c]).join("");
  return `0.0${sub}${digits}`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Adaptive token-amount formatting — scales precision to magnitude so small
 * balances stay legible instead of rounding to "0". Fixes pools/min-bets like
 * 0.0029 that a fixed `maximumFractionDigits: 1` would render as "0".
 *   12,345 → "12,345" · 12.5 → "12.5" · 0.0029 → "0.0029" · 1.2e-7 → "0.0₆12"
 */
export function fmtAmount(n: number): string {
  if (!isFinite(n) || n === 0) return "0";
  const neg = n < 0 ? "-" : "";
  const x = Math.abs(n);
  if (x >= 1000) return neg + x.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (x >= 1) return neg + x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (x >= 0.0001) return neg + x.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return neg + fmtPrice(x); // very small → DEX-Screener-style subscript notation
}

/** Resolve ipfs:// URIs to a gateway; pass http(s) and data: through. */
export function resolveURI(uri?: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + uri.slice(7);
  return uri;
}

export function timeAgo(ts: number): string {
  if (!ts) return "";
  const s = Math.max(1, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function joinedDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/** Deterministic bronze-tinted gradient from an address, for avatar fallbacks. */
export function blockyGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffff;
  const a = h % 360;
  const b = (a + 40) % 360;
  return `linear-gradient(135deg, hsl(${a} 45% 32%), hsl(${b} 40% 20%))`;
}
