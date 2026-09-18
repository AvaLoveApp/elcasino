import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { bookmarksAddress, readBookmarks } from "../lib/chain";

/**
 * On-chain bookmark toggle for a post. Optimistic UI; falls back on tx error.
 * Renders nothing when the Bookmarks module isn't deployed yet, so PostCard
 * doesn't need to know whether the feature is live.
 */
export function BookmarkButton({ postId }: { postId: number }) {
  const w = useWallet();
  const [addr, setAddr] = useState<string | null | undefined>(undefined);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { bookmarksAddress().then(setAddr); }, []);
  useEffect(() => {
    if (!addr || !w.address) { setSaved(null); return; }
    readBookmarks(addr).isBookmarked(w.address, postId)
      .then((v: boolean) => setSaved(v))
      .catch(() => setSaved(null));
  }, [addr, w.address, postId]);

  if (!addr) return null;

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    if (!w.address) { w.connect(); return; }
    if (!w.chainOk) { await w.switchChain(); return; }
    const c = w.bookmarksWrite(addr!);
    if (!c) return;
    setBusy(true);
    const was = !!saved;
    setSaved(!was);
    try {
      const tx = was ? await c.unbookmark(postId) : await c.bookmark(postId);
      await tx.wait();
    } catch { setSaved(was); }
    finally { setBusy(false); }
  }

  return (
    <button onClick={toggle} disabled={busy} title={saved ? "Unbookmark" : "Bookmark"}
      className={`group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition hover:bg-ink-800 ${saved ? "text-blood-400" : "hover:text-bone-50"}`}>
      <Bookmark size={17} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
