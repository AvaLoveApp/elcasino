// push-fanout — sends a Web Push when a `notifications` row is inserted.
// Wire it to a Supabase Database Webhook (Database → Webhooks) on
// public.notifications INSERT. It reads the recipient's push_subscriptions and
// sends one push each. Pushes therefore fire ONLY on a real event (like / reply
// / follow / tip) — never on a poll — and the `tag` collapses duplicates so they
// don't stack up.
//
// Deploy:
//   supabase functions deploy push-fanout --no-verify-jwt
//   supabase secrets set \
//     VAPID_PUBLIC_KEY=BA78kImgEO_weeCiw1gQROoeLW3oi_nueqURxhPFsRWDSu8LY2HwMUr0OXLivPJMRUKt1oXDEBEXuuLM5cGgVFY \
//     VAPID_PRIVATE_KEY=7_VaLMeLJiqdZGIQBuopBibGBLCcJOQeSHyXY5nfYLU \
//     VAPID_SUBJECT=mailto:you@yourdomain
//   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// Then: Database → Webhooks → new → table public.notifications, event INSERT,
//   type "Supabase Edge Functions" → push-fanout.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@midgard.finance",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

function verbFor(r: any): string {
  switch (r.type) {
    case "like": return "liked your post";
    case "reply": return "replied to you";
    case "follow": return "followed you";
    case "tip": return `tipped you ${r.meta?.amount ?? ""} ${r.meta?.symbol ?? ""}`.trim();
    default: return "new activity";
  }
}

Deno.serve(async (req) => {
  let record: any;
  try { ({ record } = await req.json()); } catch { return new Response("bad body", { status: 200 }); }
  if (!record?.recipient) return new Response("no recipient", { status: 200 });

  const { data: subs } = await supa
    .from("push_subscriptions").select("endpoint,p256dh,auth").eq("wallet", record.recipient);
  if (!subs?.length) return new Response("no subs", { status: 200 });

  const title = record.actor_name || (record.actor || "").slice(0, 8) || "Midgard";
  const payload = JSON.stringify({
    title, body: verbFor(record), url: "./#/notifications",
    tag: `n-${record.type}-${record.actor}`, icon: "./midgard-round.png",
  });

  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (e: any) {
      // Subscription gone → prune it.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }));

  return new Response("ok", { status: 200 });
});
