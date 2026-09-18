import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Eye, Play } from "lucide-react";
import { fetchLiveRooms, subscribeLiveRooms, type LiveRoomRow } from "../lib/live";

/**
 * Pinned live broadcast at the top of the MIDGARD feed. When a token owner is
 * streaming, their room is surfaced here as a big auto-refreshing preview (the
 * host captures a real frame every ~15s → `thumbnail`), LIVE badge + viewer count,
 * tapping opens the full player. (True inline autoplay for every visitor would
 * burn the shared LiveKit minute pool, so we preview + one-tap into the room.)
 */
export function LivePinned() {
  const [room, setRoom] = useState<LiveRoomRow | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => fetchLiveRooms("live").then((r) => { if (live) setRoom(r[0] ?? null); }).catch(() => {});
    load();
    const un = subscribeLiveRooms(load);
    const t = setInterval(load, 15000);
    return () => { live = false; un(); clearInterval(t); };
  }, []);

  if (!room) return null;
  return (
    <Link to={`/live/${room.id}`} className="block panel p-0 overflow-hidden relative group">
      <div className="relative aspect-[16/6] sm:aspect-[16/5] bg-gradient-to-br from-ink-800 to-ink-950">
        {room.thumbnail
          ? <img src={room.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-[1.02]" />
          : room.token_logo
            ? <img src={room.token_logo} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />
            : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />

        {/* LIVE + viewers */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-blood-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
          <Radio size={12} className="animate-pulse" /> LIVE
        </span>
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ink-950/70 backdrop-blur px-2.5 py-1 text-[11px] font-mono text-bone-100">
          <Eye size={12} /> {room.viewers}
        </span>

        {/* center play affordance */}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-blood-500/90 text-ink-950 shadow-blood transition group-hover:scale-110">
            <Play size={24} fill="currentColor" />
          </span>
        </span>

        {/* host + title */}
        <div className="absolute bottom-0 inset-x-0 p-3 flex items-center gap-2.5">
          {room.host_avatar
            ? <img src={room.host_avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-ink-600" />
            : <span className="grid h-9 w-9 place-items-center rounded-full bg-blood-500/25 text-blood-300"><Radio size={16} /></span>}
          <div className="min-w-0">
            <div className="text-sm font-bold text-bone-50 truncate drop-shadow">{room.title || `${room.token_symbol} live`}</div>
            <div className="font-mono text-[11px] text-bone-300 truncate">
              {room.host_name || "host"} · <span className="text-blood-300">${room.token_symbol}</span> · {room.mode}
            </div>
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-blood-500 px-3 py-1.5 text-xs font-bold text-ink-950">
            Watch
          </span>
        </div>
      </div>
    </Link>
  );
}
