import { resolveURI } from "../lib/util";

/**
 * Render a post's media URL as the right thing: image, native video, or an
 * embedded YouTube/Vimeo player. The Posts contract only stores a URL string,
 * so we sniff the extension/host and pick the right element client-side.
 */

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i;
const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    }
  } catch {}
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("vimeo.com")) {
      const seg = u.pathname.split("/").filter(Boolean)[0];
      return /^\d+$/.test(seg) ? seg : null;
    }
  } catch {}
  return null;
}

export function PostMedia({ uri, compact }: { uri: string; compact?: boolean }) {
  const src = resolveURI(uri);
  if (!src) return null;
  const maxH = compact ? "max-h-[220px]" : "max-h-[520px]";
  const iframeH = compact ? 220 : 360;

  const yt = youtubeId(src);
  if (yt) {
    return (
      <div className="mt-2.5 rounded-xl overflow-hidden border border-ink-600 bg-ink-950 aspect-video"
        onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title="YouTube video" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ height: iframeH }}
          className="w-full h-full border-0" />
      </div>
    );
  }
  const vi = vimeoId(src);
  if (vi) {
    return (
      <div className="mt-2.5 rounded-xl overflow-hidden border border-ink-600 bg-ink-950 aspect-video"
        onClick={(e) => e.stopPropagation()}>
        <iframe src={`https://player.vimeo.com/video/${vi}`}
          title="Vimeo video" loading="lazy" allow="autoplay; picture-in-picture"
          allowFullScreen style={{ height: iframeH }}
          className="w-full h-full border-0" />
      </div>
    );
  }
  if (VIDEO_RE.test(src)) {
    return (
      <div className="mt-2.5 rounded-xl overflow-hidden border border-ink-600 max-w-full bg-ink-950"
        onClick={(e) => e.stopPropagation()}>
        <video src={src} controls preload="metadata"
          className={`w-full ${maxH}`}
          onError={(e) => { (e.currentTarget as HTMLVideoElement).parentElement!.style.display = "none"; }} />
      </div>
    );
  }
  // Default: treat as image. If host actually returns non-image, onError hides.
  return (
    <div className="mt-2.5 rounded-xl overflow-hidden border border-ink-600 max-w-full">
      <img src={src} alt="" className={`w-full ${maxH} object-cover`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }} />
    </div>
  );
}
