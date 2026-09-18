import { useEffect, useRef } from "react";

/**
 * Runs `fn` on an interval, skipping ticks while the tab is hidden — a hidden
 * tab has no viewer, so polling it is pure RPC noise. Fires once immediately
 * when the tab becomes visible so stale data catches up right away.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    let stopped = false;
    const run = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try { cb.current(); } catch { /* swallow so the interval keeps going */ }
    };
    run();
    const h = setInterval(run, intervalMs);
    const onVis = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(h);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
}
