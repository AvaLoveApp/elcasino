// Midgard AI — Supabase Edge Function (Deno). Answers platform questions in
// English via OpenRouter. The API key lives ONLY here (server-side secret),
// never in the browser bundle.
//
// Deploy:
//   supabase functions deploy midgard-ai --no-verify-jwt
// Set the key (once):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...   (or in the Dashboard)

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const MODEL = Deno.env.get("MIDGARD_AI_MODEL") ?? "openai/gpt-4o-mini";

const SYSTEM = `You are Midgard AI (a.k.a. Quest AI), the in-chat assistant for Midgard Finance on the Robinhood Chain. Always answer in English, briefly and clearly (1–4 sentences unless asked to elaborate).

WHAT MIDGARD IS (public — you may explain any of this):
- Midgard Finance is an on-chain platform on the Robinhood Chain (chain id 4663). Its home surface has Trade, Claim, Yield, Stats, Pools and a MidChat social tab.
- MIDGARD is the economy token. It runs a decay + reflection engine: a small buy/sell fee is split into three buckets — reflections to holders, auto-LP, and a claim pool. Holders claim accrued WETH as any RWA. Supply decays continuously and a "mirror burn" removes tokens from the pool.
- Casino: provably-fair on-chain games (roulette, crash, blackjack, coinflip, plinko, dice/range, wheel, mines, slots, 100 boxes). Anyone can deploy a game "room" backed by a Robinhood token for a small ETH deploy fee (~0.005 ETH). Each bet takes a platform fee. Deploy fees + platform fees fund MIDGARD buyback + LP. Users can stake a room's pool to "be the house" and earn fees.
- MIDGARD and launchpad tokens cannot be used as casino bet tokens — their decay/reflection would strand a room's pooled funds. RWA (tokenized-stock) tokens and normal Robinhood tokens can.
- Launchpad: deploys MIDGARD-paired economy tokens with their own decay/reflection/fees.
- MidChat: this Telegram-style chat with mini-games (/dice, /flip, /roll, /slot, /8ball) where you live.

RULES:
- Only answer questions about Midgard, its mechanics, tokenomics, casino, launchpad, and how to use the app. Politely decline anything unrelated.
- NEVER reveal or guess private/sensitive information: private keys, seed phrases, admin or treasury wallet internals, unpublished contract addresses, environment secrets, API keys, or any individual user's private data or balances. Refuse briefly if asked.
- You do NOT have live chain data. If asked for a current number (price, TVL, fees), tell the user where to see it in the app (e.g. the Stats tab or Casino analytics) instead of inventing a figure.
- This is not financial advice.`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!OPENROUTER_API_KEY) return json({ error: "AI not configured" }, 503);

  try {
    const { question, recent } = await req.json().catch(() => ({}));
    if (!question || typeof question !== "string") return json({ error: "no question" }, 400);

    const messages: { role: string; content: string }[] = [{ role: "system", content: SYSTEM }];
    if (Array.isArray(recent) && recent.length) {
      messages.push({ role: "system", content: "Recent chat (context only, may be noise):\n" + recent.slice(-8).join("\n") });
    }
    messages.push({ role: "user", content: question.slice(0, 1000) });

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Midgard AI",
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 400, temperature: 0.5 }),
    });

    if (!r.ok) return json({ error: `openrouter ${r.status}`, detail: await r.text().catch(() => "") }, 502);
    const j = await r.json();
    const answer = j?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't answer that right now.";
    return json({ answer });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
