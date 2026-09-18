/**
 * Quote-post encoding: we don't want to change the deployed Posts contract, so
 * quoted references live inside the post's text field as an opt-in header the
 * frontend hides. First line `>>Q:<id>` marks a quote; the rest is the user's
 * own text. Backwards-compatible: any client that doesn't know about it just
 * sees the header as plain text on the first line.
 */

const RE = /^>>Q:(\d+)\r?\n?/;

/** Prepend the header when composing a quote. */
export function encodeQuote(text: string, quoteId: number): string {
  return `>>Q:${quoteId}\n${text}`;
}

/** Split a stored post into (visibleText, quoteId?). */
export function decodeQuote(text: string): { text: string; quoteId?: number } {
  const m = RE.exec(text);
  if (!m) return { text };
  return { text: text.slice(m[0].length), quoteId: Number(m[1]) };
}
