import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { Room, RemoteTrack, LocalTrackPublication, Participant } from "livekit-client";
import { useWallet } from "./wallet";
import { loadProfile } from "./midchat";
import {
  LiveRoomRow, LiveMode, getLiveKitToken, endLiveRoom, reportViewers, addUsage, setThumbnail, liveConfigured,
} from "./live";
import { short } from "./util";
import { Maximize2, X, Mic, MicOff, Loader2, Volume2 } from "lucide-react";

type Status = "idle" | "connecting" | "connected" | "error";

export interface LiveParticipant {
  identity: string; name: string; avatar: string | null;
  host: boolean; speaker: boolean; isLocal: boolean; speaking: boolean; micOn: boolean;
}

interface LiveState {
  room: LiveRoomRow | null;
  role: "host" | "viewer";
  status: Status;
  err: string;
  count: number;
  canPublish: boolean;
  camOn: boolean; micOn: boolean; screenOn: boolean;
  needAudio: boolean;
  allowedMinutes: number;
  participants: LiveParticipant[];
}

interface LivePlayerCtx extends LiveState {
  join: (room: LiveRoomRow, role: "host" | "viewer") => Promise<void>;
  leave: () => Promise<void>;
  regrant: () => Promise<void>;
  kick: (identity: string) => void;
  muteRemote: (identity: string) => void;
  toggleCam: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleScreen: () => Promise<void>;
  unlockAudio: () => Promise<void>;
  registerStage: (el: HTMLElement | null) => void;
}

const Ctx = createContext<LivePlayerCtx>(null as any);
export const useLivePlayer = () => useContext(Ctx);

export function LivePlayerProvider({ children }: { children: ReactNode }) {
  const w = useWallet();
  const nav = useNavigate();

  const [st, setSt] = useState<LiveState>({
    room: null, role: "viewer", status: "idle", err: "", count: 1,
    canPublish: false, camOn: false, micOn: false, screenOn: false, needAudio: false, allowedMinutes: 0, participants: [],
  });
  const set = (p: Partial<LiveState>) => setSt((s) => ({ ...s, ...p }));

  const lkRef = useRef<Room | null>(null);
  const roomRef = useRef<LiveRoomRow | null>(null);
  const roleRef = useRef<"host" | "viewer">("viewer");
  const speakingRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<number>(0);      // host stream start (for usage metering)
  const peakRef = useRef<number>(1);
  // Persistent media node — re-parented between the room page's stage and the
  // floating mini-player so playback never drops when you navigate.
  const mediaBox = useRef<HTMLDivElement>(document.createElement("div"));
  const audioBox = useRef<HTMLDivElement>(document.createElement("div"));
  const floatInner = useRef<HTMLDivElement | null>(null);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const joiningRef = useRef(false);

  // One-time: style the media + audio holders.
  useEffect(() => {
    mediaBox.current.className = "absolute inset-0 flex items-center justify-center [&>video]:h-full [&>video]:w-full [&>video]:object-contain";
    audioBox.current.style.display = "none";
    document.body.appendChild(audioBox.current);
  }, []);

  // Re-parent the media node: into the page stage when docked, else the float box.
  useEffect(() => {
    const target = stageEl || floatInner.current;
    if (target && mediaBox.current.parentElement !== target) target.appendChild(mediaBox.current);
  }, [stageEl, st.status]);

  const registerStage = useCallback((el: HTMLElement | null) => setStageEl(el), []);

  const clearVideos = () => { mediaBox.current.querySelectorAll("video").forEach((v) => v.remove()); };

  const join = useCallback(async (room: LiveRoomRow, role: "host" | "viewer") => {
    if (!liveConfigured) { set({ status: "error", err: "Live media isn't configured yet." }); return; }
    if (!w.address || !w.signer) { w.connect(); return; }
    // Already in this room? just make sure we're marked active.
    if (roomRef.current?.id === room.id && lkRef.current) { set({ room, role }); roomRef.current = room; return; }
    if (joiningRef.current) return;
    joiningRef.current = true;
    roomRef.current = room; roleRef.current = role;
    set({ room, role, status: "connecting", err: "", camOn: false, micOn: false, screenOn: false, needAudio: false });
    try {
      const prof = await loadProfile(w.address).catch(() => null);
      const auth = await getLiveKitToken({
        roomId: room.livekit_room, dbRoomId: room.id, role, mode: room.mode, address: w.address,
        signMessage: (m) => w.signer!.signMessage(m),
        displayName: prof?.username || short(w.address), avatar: prof?.avatar_url || null,
      });
      set({ canPublish: auth.canPublish, allowedMinutes: auth.allowedMinutes });

      const { Room, RoomEvent } = await import("livekit-client");
      if (lkRef.current) { try { await lkRef.current.disconnect(); } catch {} lkRef.current = null; }
      const lk = new Room({ adaptiveStream: true, dynacast: true });
      lkRef.current = lk;

      const attach = (track: RemoteTrack) => {
        const el = track.attach();
        if ((track.kind as string) === "video") {
          (el as HTMLVideoElement).playsInline = true; (el as HTMLVideoElement).autoplay = true;
          clearVideos(); mediaBox.current.appendChild(el);
        } else { (el as HTMLAudioElement).autoplay = true; audioBox.current.appendChild(el); }
      };
      const meta = (p: Participant): { av: string | null; ho: boolean; sp: boolean } => {
        try { const m = JSON.parse(p.metadata || "{}"); return { av: m.av ?? null, ho: !!m.ho, sp: !!m.sp }; }
        catch { return { av: null, ho: false, sp: false }; }
      };
      const toP = (p: Participant, isLocal: boolean): LiveParticipant | null => {
        const idn = p.identity || "";
        if (idn.startsWith("obs-")) return null;
        const m = meta(p);
        return {
          identity: idn, name: p.name || short(idn), avatar: m.av,
          host: m.ho || idn === roomRef.current?.host?.toLowerCase(), speaker: m.sp, isLocal,
          speaking: speakingRef.current.has(idn),
          micOn: !!(p as any).isMicrophoneEnabled,
        };
      };
      const refreshRoster = () => {
        const list: LiveParticipant[] = [];
        const local = toP(lk.localParticipant, true); if (local) list.push(local);
        lk.remoteParticipants.forEach((p) => { const r = toP(p, false); if (r) list.push(r); });
        const n = list.length;
        peakRef.current = Math.max(peakRef.current, n);
        set({ count: n, participants: list });
        if (roleRef.current === "host" && roomRef.current) reportViewers(roomRef.current.id, n).catch(() => {});
      };
      lk.on(RoomEvent.TrackSubscribed, (t: RemoteTrack) => { attach(t); refreshRoster(); });
      lk.on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack) => { t.detach().forEach((e) => e.remove()); refreshRoster(); });
      lk.on(RoomEvent.ParticipantConnected, refreshRoster);
      lk.on(RoomEvent.ParticipantDisconnected, refreshRoster);
      lk.on(RoomEvent.TrackMuted, refreshRoster);
      lk.on(RoomEvent.TrackUnmuted, refreshRoster);
      lk.on(RoomEvent.ActiveSpeakersChanged, (spk: Participant[]) => { speakingRef.current = new Set(spk.map((s) => s.identity)); refreshRoster(); });
      // Moderation over the data channel (no server SDK needed): the host sends
      // kick/mute; the targeted client enforces it on itself.
      lk.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          const me = lk.localParticipant.identity;
          if (msg?.to && msg.to !== me) return;
          if (msg?.t === "kick") {
            try { lk.disconnect(); } catch {}
            lkRef.current = null; roomRef.current = null; clearVideos();
            set({ room: null, status: "idle", err: "You were removed by the host." });
          } else if (msg?.t === "mute") { lk.localParticipant.setMicrophoneEnabled(false).catch(() => {}); set({ micOn: false }); }
        } catch {}
      });
      lk.on(RoomEvent.Disconnected, () => set({ status: "idle" }));
      const refreshCount = refreshRoster;
      // Host sees their own camera/screen locally.
      lk.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        const src = pub.source as string;
        if (pub.track && (pub.track.kind as string) === "video" && (src === "camera" || src === "screen_share")) {
          const el = pub.track.attach() as HTMLVideoElement;
          el.muted = true; el.playsInline = true; el.autoplay = true;
          if (src === "camera") el.style.transform = "scaleX(-1)";
          clearVideos(); mediaBox.current.appendChild(el);
        }
      });
      lk.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if ((pub.track?.kind as string) === "video") pub.track?.detach().forEach((e) => e.remove());
      });

      await lk.connect(auth.url, auth.token);
      if (role === "host") { startedAtRef.current = performance.now(); peakRef.current = 1; }
      refreshCount();
      set({ status: "connected" });
      if (!lk.canPlaybackAudio) set({ needAudio: true });
    } catch (e: any) {
      set({ status: "error", err: e?.message || "Could not connect to the stream." });
      roomRef.current = null;
    } finally { joiningRef.current = false; }
  }, [w.address, w.signer]);

  const leave = useCallback(async () => {
    const wasHost = roleRef.current === "host";
    const r = roomRef.current;
    // Meter the host's usage (participant-minutes ≈ elapsed × peak audience).
    if (wasHost && w.address && startedAtRef.current) {
      const mins = (performance.now() - startedAtRef.current) / 60000 * Math.max(peakRef.current, 1);
      addUsage(w.address, mins).catch(() => {});
      startedAtRef.current = 0;
    }
    try { await lkRef.current?.disconnect(); } catch {}
    lkRef.current = null; roomRef.current = null;
    clearVideos(); audioBox.current.querySelectorAll("audio").forEach((a) => a.remove());
    if (wasHost && r) endLiveRoom(r.id).catch(() => {});
    set({ room: null, status: "idle", count: 1, participants: [], camOn: false, micOn: false, screenOn: false, needAudio: false });
  }, [w.address]);

  // Re-mint the token + reconnect (e.g. a viewer just got approved to speak → publish).
  const regrant = useCallback(async () => {
    const r = roomRef.current, role = roleRef.current;
    if (!r) return;
    try { await lkRef.current?.disconnect(); } catch {}
    lkRef.current = null; roomRef.current = null;
    await join(r, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join]);

  const toggleCam = useCallback(async () => {
    const lk = lkRef.current; if (!lk) return;
    const next = !st.camOn;
    try {
      await lk.localParticipant.setCameraEnabled(next); set({ camOn: next });
      if (next && !st.micOn) { try { await lk.localParticipant.setMicrophoneEnabled(true); set({ micOn: true }); } catch {} }
    } catch {}
  }, [st.camOn, st.micOn]);

  const toggleMic = useCallback(async () => {
    const lk = lkRef.current; if (!lk) return;
    try { await lk.localParticipant.setMicrophoneEnabled(!st.micOn); set({ micOn: !st.micOn }); } catch {}
  }, [st.micOn]);

  const toggleScreen = useCallback(async () => {
    const lk = lkRef.current; if (!lk) return;
    try { await lk.localParticipant.setScreenShareEnabled(!st.screenOn, { audio: true }); set({ screenOn: !st.screenOn }); } catch {}
  }, [st.screenOn]);

  const unlockAudio = useCallback(async () => {
    try { await lkRef.current?.startAudio(); set({ needAudio: false }); } catch {}
  }, []);

  // Moderation (host → target) over the reliable data channel.
  const sendMod = (t: "kick" | "mute", identity: string) => {
    const lk = lkRef.current; if (!lk) return;
    try { lk.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ t, to: identity })), { reliable: true }); } catch {}
  };
  const kick = useCallback((identity: string) => sendMod("kick", identity), []);
  const muteRemote = useCallback((identity: string) => sendMod("mute", identity), []);

  // Host: capture a frame from the live video as a preview thumbnail (small JPEG),
  // so the hub / right-rail cards show what's actually on screen.
  useEffect(() => {
    if (st.role !== "host" || st.status !== "connected" || !st.room) return;
    let stop = false;
    const snap = () => {
      const v = mediaBox.current.querySelector("video") as HTMLVideoElement | null;
      if (!v || !v.videoWidth) return;
      try {
        const cv = document.createElement("canvas");
        cv.width = 320; cv.height = Math.max(90, Math.round(320 * v.videoHeight / v.videoWidth));
        const ctx = cv.getContext("2d"); if (!ctx) return;
        ctx.drawImage(v, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL("image/jpeg", 0.4);
        if (!stop && st.room) setThumbnail(st.room.id, url);
      } catch {}
    };
    const t0 = setTimeout(snap, 4000);
    const iv = setInterval(snap, 15000);
    return () => { stop = true; clearTimeout(t0); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.role, st.status, st.room?.id]);

  // Clean up on unmount.
  useEffect(() => () => { try { lkRef.current?.disconnect(); } catch {} }, []);

  const docked = !!stageEl;
  const showFloat = st.status !== "idle" && st.room && !docked;

  return (
    <Ctx.Provider value={{ ...st, join, leave, regrant, kick, muteRemote, toggleCam, toggleMic, toggleScreen, unlockAudio, registerStage }}>
      {children}
      {/* Floating PiP mini-player — drops to bottom-right while you browse the app.
          Sits above the mobile bottom nav (which is ~64px tall) so the little
          screen isn't tucked behind it; back to bottom-4 on lg where there's no nav. */}
      <div hidden={!showFloat}
        className="fixed bottom-[76px] right-3 lg:bottom-4 lg:right-4 z-[70] w-[300px] max-w-[86vw] overflow-hidden rounded-xl border border-blood-500/40 bg-black shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8),0_0_30px_-10px_rgba(147,224,20,0.5)]">
        <div className="relative aspect-video bg-black">
          <div ref={floatInner} className="absolute inset-0" />
          {st.status === "connecting" && (
            <div className="absolute inset-0 grid place-items-center text-bone-300"><Loader2 className="animate-spin" /></div>
          )}
          {st.needAudio && st.status === "connected" && (
            <button onClick={unlockAudio} className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-blood-600 px-3 py-1 text-xs font-bold text-ink-950">
              <Volume2 size={12} /> Tap for sound
            </button>
          )}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-blood-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-ink-950">● Live</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-2 bg-ink-900">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-bone-50">{st.room?.title}</div>
            <div className="truncate text-[10px] font-mono text-bone-500">{st.room?.token_symbol} · {st.count} watching</div>
          </div>
          {st.canPublish && (
            <button onClick={toggleMic} title="Mic" className={`grid h-7 w-7 place-items-center rounded-full ${st.micOn ? "bg-blood-500 text-ink-950" : "bg-ink-700 text-bone-300"}`}>
              {st.micOn ? <Mic size={13} /> : <MicOff size={13} />}
            </button>
          )}
          <button onClick={() => st.room && nav(`/live/${st.room.id}`)} title="Expand" className="grid h-7 w-7 place-items-center rounded-full bg-ink-700 text-bone-200 hover:text-blood-400">
            <Maximize2 size={13} />
          </button>
          <button onClick={leave} title="Leave" className="grid h-7 w-7 place-items-center rounded-full bg-ink-700 text-bone-300 hover:text-danger-400">
            <X size={13} />
          </button>
        </div>
      </div>
    </Ctx.Provider>
  );
}
