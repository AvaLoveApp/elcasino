import twemoji from "@twemoji/api";

// Consistent, platform-independent emoji: every device renders the SAME glyphs
// instead of Apple/Google/Windows defaults. This is the seam for a bespoke
// Midgard emoji set later — swap the image `base` below for our own assets and
// nothing else changes.
const BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Linkify #hashtag, @handle, and bare http(s):// URLs in already-escaped text.
// Runs BEFORE twemoji so emoji parsing still sees the anchor tag's inner text.
const RX = /(https?:\/\/[^\s<]+)|(^|[\s(])@([a-zA-Z0-9_]{1,32})\b|(^|[\s(])#([a-zA-Z0-9_]{1,64})\b/g;

function linkify(escaped: string): string {
  return escaped.replace(RX, (m, url, pre1, handle, pre2, tag) => {
    if (url) {
      // Trim trailing punctuation from URLs so ")" or "." don't get swallowed.
      const trail = url.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const clean = trail ? url.slice(0, -trail.length) : url;
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer" class="text-blood-400 hover:underline">${clean}</a>${trail}`;
    }
    if (handle) {
      return `${pre1}<a href="#/u/${handle}" class="text-blood-400 hover:underline">@${handle}</a>`;
    }
    if (tag) {
      return `${pre2}<a href="#/search?q=%23${tag}" class="text-blood-400 hover:underline">#${tag}</a>`;
    }
    return m;
  });
}

/** Render user text with emoji swapped for consistent inline images. */
export function Rich({ text, className }: { text: string; className?: string }) {
  const linked = linkify(escapeHtml(text));
  const html = twemoji.parse(linked, { folder: "svg", ext: ".svg", base: BASE });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
