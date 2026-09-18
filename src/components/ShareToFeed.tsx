import { useNavigate } from "react-router-dom";
import { Share2 } from "lucide-react";
import { shareToFeed, socialEnabled, type PendingShare } from "../lib/social";

/**
 * "Share to feed" — stages a token/game embed then jumps to the SocialFi terminal
 * (/token), where the composer picks up the pending share. Used from the Trade
 * page (share a token) and casino rooms (share a game).
 */
export function ShareToFeed({ share, label = "Share", className }: {
  share: PendingShare;
  label?: string;
  className?: string;
}) {
  const nav = useNavigate();
  if (!socialEnabled) return null;
  return (
    <button
      onClick={() => { shareToFeed(share); nav("/token"); }}
      className={className ?? "inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border border-blood-500/40 text-blood-300 hover:bg-blood-900/20 transition"}
      title="Share to the EL-Casino feed">
      <Share2 size={11} /> {label}
    </button>
  );
}
