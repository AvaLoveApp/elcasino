/* Midgard Finance service worker — offline app shell + fast repeat loads.
 * Never caches chain reads (/rpc) or cross-origin requests (RPC, CDNs, esm.sh).
 * HTML is network-first (so new deploys show up); hashed assets are
 * stale-while-revalidate (immutable, safe to serve from cache instantly). */
const CACHE = "elcasino-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./elcasino_logo.png", "./elcasino_logo.png", "./elcasino_logo.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== location.origin) return;     // RPC, CDNs, esm.sh, fonts — untouched
  if (url.pathname.startsWith("/rpc")) return;     // never cache on-chain reads

  // Navigations / HTML: network-first, fall back to the cached shell offline.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Static assets (content-hashed): serve cache instantly, refresh in background.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || network;
    })
  );
});

/* ── Web push (VAPID) ─────────────────────────────────────────────────────── */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { try { d = { body: e.data.text() }; } catch {} }
  const title = d.title || "Midgard";
  const opts = {
    body: d.body || "",
    icon: d.icon || "./elcasino_logo.png",
    badge: "./elcasino_logo.png",
    tag: d.tag,           // same tag collapses duplicates so pushes don't stack up
    renotify: false,
    data: { url: d.url || "./#/notifications" },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./#/notifications";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { c.focus(); try { c.navigate(url); } catch {} return; } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
