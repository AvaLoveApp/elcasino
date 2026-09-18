import { Bookmark } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { SavedPosts } from "../components/Feed";

/** Your saved posts — gas-free, per-wallet, backed by Supabase. */
export default function BookmarksPage() {
  const w = useWallet();
  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Bookmark size={18} className="text-blood-400" />
        <h1 className="text-xl font-bold tracking-tight">Bookmarks</h1>
      </div>
      {w.address
        ? <SavedPosts wallet={w.address} />
        : (
          <div className="panel p-8 text-center text-bone-400 text-sm">
            Connect your wallet to see your saved posts.
            <div className="mt-3"><button onClick={w.connect} className="btn-primary py-2 px-4 text-sm">Connect</button></div>
          </div>
        )}
    </div>
  );
}
