// push-broadcast — sends a Web Push to EVERY subscriber when a `broadcasts` row
// is inserted (admin announcement, new launch, new casino room). Wired via a pg
// trigger (pg_net) → this function. Supports an image.
//
// Deploy:  supabase functions deploy push-broadcast --no-verify-jwt --project-ref <ref>
// Secrets: reuses VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@midgard.finance",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  let record: any;
  try { ({ record } = await req.json()); } catch { return new Response("bad body", { status: 200 }); }
  if (!record?.title && !record?.body) return new Response("empty", { status: 200 });

  const payload = JSON.stringify({
    title: record.title || "Midgard",
    body: record.body || "",
    url: record.url || "./#/notifications",
    icon: record.image || "./midgard-round.png",
    image: record.image || undefined,
    tag: `bc-${record.id || Date.now()}`,
  });

  // Page through all subscriptions so a big audience still gets delivered.
  let from = 0; const page = 1000; let sent = 0;
  while (true) {
    const { data: subs } = await supa.from("push_subscriptions").select("endpoint,p256dh,auth").range(from, from + page - 1);
    if (!subs?.length) break;
    await Promise.all(subs.map(async (s: any) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
    }));
    if (subs.length < page) break;
    from += page;
  }
  return new Response(`sent ${sent}`, { status: 200 });
});
