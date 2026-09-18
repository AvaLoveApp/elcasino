import { supabase } from "./supabase";

/**
 * Web push (VAPID). The client subscribes via the service worker and stores the
 * subscription in Supabase; the `push-fanout` edge function sends a push when a
 * notification row is inserted (so pushes fire ONLY on a real event — likes,
 * replies, follows, tips — never on a poll). Foreground notifications work with
 * no server while a tab is open.
 */
const VAPID = ((import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";
export const pushConfigured = !!VAPID;

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function pushPermission(): NotificationPermission {
  return pushSupported() ? Notification.permission : "denied";
}

function urlB64ToUint8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function swReg(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}

/** Request permission, subscribe, and store the subscription. Returns success. */
export async function enablePush(wallet: string): Promise<boolean> {
  if (!pushSupported() || !pushConfigured || !supabase || !wallet) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await swReg();
  if (!reg) return false; // no SW (dev) → foreground-only
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID) }); }
    catch { return false; }
  }
  const json: any = sub.toJSON();
  await supabase.from("push_subscriptions").upsert({
    endpoint: sub.endpoint, wallet: wallet.toLowerCase(), p256dh: json.keys?.p256dh, auth: json.keys?.auth,
  }).then(() => {}, () => {});
  return true;
}

export async function disablePush(wallet: string): Promise<void> {
  const reg = await swReg();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try { await sub.unsubscribe(); } catch {}
    if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).then(() => {}, () => {});
  }
}

export async function isPushEnabled(): Promise<boolean> {
  const reg = await swReg();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

/** Show a notification now (foreground) — no server needed, only fires on the
 *  actual event, so it's never spammy. Used on realtime notification inserts. */
export function showLocalNotification(title: string, body: string, url = "./#/notifications") {
  if (!pushSupported() || Notification.permission !== "granted") return;
  swReg().then((reg) => {
    const opts: NotificationOptions = { body, icon: "./elcasino_logo.png", badge: "./elcasino_logo.png", data: { url } } as any;
    if (reg) reg.showNotification(title, opts).catch(() => {});
    else { try { new Notification(title, opts); } catch {} }
  });
}
