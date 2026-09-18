-- ============================================================================
-- MidChat schema — run this once in Supabase → SQL Editor.
-- Tables: profiles (per-wallet name + avatar URL) and messages (chat/game/ai).
-- Includes RLS, realtime, and a TTL cleanup function.
-- ============================================================================

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  wallet     text primary key,
  username   text not null default '',
  avatar_url text not null default '',
  social     text not null default '',      -- 'google' | 'x' | 'email' | 'wallet' | ''
  locked     boolean not null default false, -- true for social logins (name/username come from the social account)
  updated_at timestamptz not null default now()
);

-- Migration for existing installs (safe to re-run):
alter table public.profiles add column if not exists social text not null default '';
alter table public.profiles add column if not exists locked boolean not null default false;

-- ── Messages ────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  wallet     text not null,
  username   text not null default '',
  avatar_url text not null default '',
  text       text not null,
  kind       text not null default 'chat',   -- 'chat' | 'game' | 'ai'
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Casual social layer: identity is the connected wallet address. Reads are
-- public; the anon key may write. (Harden later with signed messages if needed.)
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_write  on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_write  on public.profiles for insert with check (true);
create policy profiles_update on public.profiles for update using (true) with check (true);

drop policy if exists messages_read   on public.messages;
drop policy if exists messages_insert on public.messages;
create policy messages_read   on public.messages for select using (true);
create policy messages_insert on public.messages for insert
  with check (char_length(text) between 1 and 500 and kind in ('chat','game','ai'));
-- No client update/delete — cleanup runs server-side (below).

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ── Midgard Live (token-owner broadcasts) ──────────────────────────────────
create table if not exists public.live_rooms (
  id            uuid primary key default gen_random_uuid(),
  host          text not null,                 -- host wallet (lowercased)
  host_name     text,
  host_avatar   text,
  token_addr    text not null,                 -- streamer's launchpad token
  token_symbol  text not null default '',
  token_logo    text,
  mode          text not null default 'video', -- 'video' | 'audio'
  title         text not null default '',
  status        text not null default 'live',  -- 'live' | 'ended'
  livekit_room  text not null,
  peak_viewers  int  not null default 1,
  viewers       int  not null default 1,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index if not exists live_rooms_status_idx on public.live_rooms (status, viewers desc);

create table if not exists public.live_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.live_rooms(id) on delete cascade,
  wallet     text not null,
  name       text,
  avatar     text,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists live_messages_room_idx on public.live_messages (room_id, created_at);

alter table public.live_rooms    enable row level security;
alter table public.live_messages enable row level security;
drop policy if exists live_rooms_read   on public.live_rooms;
drop policy if exists live_rooms_write   on public.live_rooms;
drop policy if exists live_rooms_update  on public.live_rooms;
create policy live_rooms_read   on public.live_rooms   for select using (true);
create policy live_rooms_write  on public.live_rooms   for insert with check (true);
create policy live_rooms_update on public.live_rooms   for update using (true) with check (true);
drop policy if exists live_msg_read   on public.live_messages;
drop policy if exists live_msg_insert on public.live_messages;
create policy live_msg_read   on public.live_messages for select using (true);
create policy live_msg_insert on public.live_messages for insert with check (char_length(body) between 1 and 500);

-- Speaker requests (audio rooms): viewers request the mic, host approves.
create table if not exists public.live_speakers (
  room_id     uuid not null references public.live_rooms(id) on delete cascade,
  wallet      text not null,
  name        text,
  avatar      text,
  status      text not null default 'requested', -- 'requested' | 'approved' | 'removed'
  requested_at timestamptz not null default now(),
  primary key (room_id, wallet)
);

-- Per-room bans (host/moderation).
create table if not exists public.live_room_bans (
  room_id   uuid not null references public.live_rooms(id) on delete cascade,
  wallet    text not null,
  by_wallet text,
  created_at timestamptz not null default now(),
  primary key (room_id, wallet)
);

-- Cumulative monthly LiveKit usage per host (participant-minutes), keyed yyyymm.
create table if not exists public.live_usage (
  wallet   text not null,
  ym       text not null,           -- e.g. '202609'
  minutes  numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (wallet, ym)
);

-- Atomic usage add (called by the host client as the stream burns minutes).
create or replace function public.live_add_usage(p_wallet text, p_minutes numeric) returns void
language sql security definer as $$
  insert into public.live_usage (wallet, ym, minutes, updated_at)
  values (lower(p_wallet), to_char(now(),'YYYYMM'), greatest(0,p_minutes), now())
  on conflict (wallet, ym) do update set minutes = public.live_usage.minutes + greatest(0,excluded.minutes), updated_at = now();
$$;

alter table public.live_speakers   enable row level security;
alter table public.live_room_bans  enable row level security;
alter table public.live_usage       enable row level security;
drop policy if exists live_spk_read   on public.live_speakers;
drop policy if exists live_spk_write  on public.live_speakers;
create policy live_spk_read  on public.live_speakers for select using (true);
create policy live_spk_write on public.live_speakers for all using (true) with check (true);
drop policy if exists live_ban_read  on public.live_room_bans;
drop policy if exists live_ban_write on public.live_room_bans;
create policy live_ban_read  on public.live_room_bans for select using (true);
create policy live_ban_write on public.live_room_bans for all using (true) with check (true);
drop policy if exists live_usage_read on public.live_usage;
create policy live_usage_read on public.live_usage for select using (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_rooms') then
    alter publication supabase_realtime add table public.live_rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_messages') then
    alter publication supabase_realtime add table public.live_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_speakers') then
    alter publication supabase_realtime add table public.live_speakers;
  end if;
end $$;

-- ── SocialFi: profiles bio/banner + posts feed ──────────────────────────────
-- X-like posts backed by Supabase (identity = connected wallet). Posts can embed
-- a token or a casino game as a rich card (kind + meta jsonb).
alter table public.profiles add column if not exists bio    text not null default '';
alter table public.profiles add column if not exists banner text not null default '';

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  wallet     text not null,                    -- author (lowercased)
  username   text not null default '',
  avatar_url text not null default '',
  text       text not null default '',
  kind       text not null default 'post',      -- 'post' | 'token' | 'game' | 'reply'
  meta       jsonb,                             -- embed payload (token addr/symbol/logo, game key/address, …)
  reply_to   uuid references public.posts(id) on delete cascade,
  like_count int not null default 0,
  reply_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_wallet_idx    on public.posts (wallet, created_at desc);
create index if not exists posts_reply_idx     on public.posts (reply_to, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  wallet  text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, wallet)
);

-- Keep like_count / reply_count in sync via triggers.
create or replace function public.post_like_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then update public.posts set like_count = like_count + 1 where id = new.post_id; return new;
  elsif (tg_op = 'DELETE') then update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id; return old;
  end if; return null;
end $$;
drop trigger if exists post_like_count_t on public.post_likes;
create trigger post_like_count_t after insert or delete on public.post_likes for each row execute function public.post_like_count();

create or replace function public.post_reply_count() returns trigger language plpgsql as $$
begin
  if (new.reply_to is not null) then update public.posts set reply_count = reply_count + 1 where id = new.reply_to; end if;
  return new;
end $$;
drop trigger if exists post_reply_count_t on public.posts;
create trigger post_reply_count_t after insert on public.posts for each row execute function public.post_reply_count();

-- Cap each wallet to its 25 most recent top-level posts (older ones + their
-- replies cascade-delete) so the table can't bloat — per user's request.
create or replace function public.posts_cap() returns trigger language plpgsql as $$
begin
  if (new.reply_to is null) then
    delete from public.posts
    where wallet = new.wallet and reply_to is null
      and id not in (
        select id from public.posts where wallet = new.wallet and reply_to is null
        order by created_at desc limit 25
      );
  end if;
  return new;
end $$;
drop trigger if exists posts_cap_t on public.posts;
create trigger posts_cap_t after insert on public.posts for each row execute function public.posts_cap();

alter table public.posts      enable row level security;
alter table public.post_likes enable row level security;
drop policy if exists posts_read   on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_read   on public.posts   for select using (true);
create policy posts_insert on public.posts   for insert with check (char_length(text) <= 2000 and kind in ('post','token','game','reply'));
create policy posts_delete on public.posts   for delete using (true); -- casual layer; harden with signed msgs later
drop policy if exists likes_read   on public.post_likes;
drop policy if exists likes_write  on public.post_likes;
create policy likes_read  on public.post_likes for select using (true);
create policy likes_write on public.post_likes for all using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- ── Live bet feed (casino activity ticker, avalove-style) ────────────────────
create table if not exists public.bets (
  id         uuid primary key default gen_random_uuid(),
  wallet     text not null,
  name       text not null default '',
  avatar     text not null default '',
  game       text not null default '',      -- game label (roulette, crash, …)
  game_key   text not null default '',
  address    text not null default '',      -- room address (for deep-link)
  symbol     text not null default '',      -- bet token symbol
  amount     numeric not null default 0,
  won        boolean,                        -- null = just placed (no result yet)
  payout     numeric,
  created_at timestamptz not null default now()
);
create index if not exists bets_created_idx on public.bets (created_at desc);

create or replace function public.bets_cap() returns trigger language plpgsql as $$
begin
  delete from public.bets where id not in (select id from public.bets order by created_at desc limit 150);
  return new;
end $$;
drop trigger if exists bets_cap_t on public.bets;
create trigger bets_cap_t after insert on public.bets for each row execute function public.bets_cap();

alter table public.bets enable row level security;
drop policy if exists bets_read on public.bets;
drop policy if exists bets_write on public.bets;
create policy bets_read  on public.bets for select using (true);
create policy bets_write on public.bets for insert with check (amount >= 0);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bets') then
    alter publication supabase_realtime add table public.bets;
  end if;
end $$;

-- ── Broadcasts (platform-wide announcements → push to everyone) ──────────────
create table if not exists public.broadcasts (
  id         uuid primary key default gen_random_uuid(),
  sender     text not null default '',
  title      text not null default '',
  body       text not null default '',
  image      text not null default '',
  url        text not null default './#/notifications',
  kind       text not null default 'admin',   -- 'admin' | 'launch' | 'room'
  created_at timestamptz not null default now()
);
create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);

create or replace function public.broadcasts_cap() returns trigger language plpgsql as $$
begin
  delete from public.broadcasts where id not in (select id from public.broadcasts order by created_at desc limit 100);
  return new;
end $$;
drop trigger if exists broadcasts_cap_t on public.broadcasts;
create trigger broadcasts_cap_t after insert on public.broadcasts for each row execute function public.broadcasts_cap();

alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_read on public.broadcasts;
drop policy if exists broadcasts_write on public.broadcasts;
create policy broadcasts_read  on public.broadcasts for select using (true);
create policy broadcasts_write on public.broadcasts for insert with check (char_length(title) <= 120 and char_length(body) <= 500);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='broadcasts') then
    alter publication supabase_realtime add table public.broadcasts;
  end if;
end $$;

-- ── Web push subscriptions (VAPID) ───────────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  wallet     text not null,             -- owner (lowercased)
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_wallet_idx on public.push_subscriptions (wallet);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_all on public.push_subscriptions;
create policy push_subs_all on public.push_subscriptions for all using (true) with check (true);

-- ── SocialFi: notifications ──────────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient    text not null,               -- wallet to notify (lowercased)
  actor        text not null,               -- who triggered it
  actor_name   text not null default '',
  actor_avatar text not null default '',
  type         text not null,               -- 'like' | 'reply' | 'follow' | 'tip'
  post_id      uuid,
  meta         jsonb,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient, created_at desc);

-- Keep each recipient's newest 60 notifications.
create or replace function public.notifications_cap() returns trigger language plpgsql as $$
begin
  delete from public.notifications
  where recipient = new.recipient
    and id not in (select id from public.notifications where recipient = new.recipient order by created_at desc limit 60);
  return new;
end $$;
drop trigger if exists notifications_cap_t on public.notifications;
create trigger notifications_cap_t after insert on public.notifications for each row execute function public.notifications_cap();

alter table public.notifications enable row level security;
drop policy if exists notifications_read   on public.notifications;
drop policy if exists notifications_write  on public.notifications;
drop policy if exists notifications_update on public.notifications;
create policy notifications_read   on public.notifications for select using (true);
create policy notifications_write  on public.notifications for insert with check (true);
create policy notifications_update on public.notifications for update using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ── SocialFi: follows ────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower   text not null,   -- wallet doing the following (lowercased)
  following  text not null,   -- wallet being followed (lowercased)
  created_at timestamptz not null default now(),
  primary key (follower, following)
);
create index if not exists follows_following_idx on public.follows (following);
create index if not exists follows_follower_idx  on public.follows (follower);

alter table public.follows enable row level security;
drop policy if exists follows_read  on public.follows;
drop policy if exists follows_write on public.follows;
create policy follows_read  on public.follows for select using (true);
create policy follows_write on public.follows for all using (true) with check (true);

-- ── SocialFi: bookmarks (gas-free, per-wallet saved posts) ───────────────────
create table if not exists public.bookmarks (
  wallet     text not null,             -- who saved it (lowercased)
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wallet, post_id)
);
create index if not exists bookmarks_wallet_idx on public.bookmarks (wallet, created_at desc);

alter table public.bookmarks enable row level security;
drop policy if exists bookmarks_read  on public.bookmarks;
drop policy if exists bookmarks_write on public.bookmarks;
create policy bookmarks_read  on public.bookmarks for select using (true);
create policy bookmarks_write on public.bookmarks for all using (true) with check (true);

-- ── Market-Maker treasury wallets (admin tool) ──────────────────────────────
-- The registry owner tags the wallets that are "ours" (deployer bag, MM wallets,
-- cold storage). The MM dashboard sums their balances to derive our share of
-- supply and the free float. This is owner-only config; the app already gates the
-- Admin page to the on-chain registry owner. RLS here is left permissive to match
-- the rest of this project (anon key writes) — harden with signed messages or a
-- server-side check if the treasury set should be private.
create table if not exists public.mm_wallets (
  address    text primary key,               -- lowercased wallet address
  label      text not null default '',        -- human label (e.g. "Deployer bag")
  added_by   text,                            -- owner wallet that added it
  created_at timestamptz not null default now()
);

alter table public.mm_wallets enable row level security;
drop policy if exists mm_wallets_read   on public.mm_wallets;
drop policy if exists mm_wallets_write  on public.mm_wallets;
drop policy if exists mm_wallets_update on public.mm_wallets;
drop policy if exists mm_wallets_delete on public.mm_wallets;
create policy mm_wallets_read   on public.mm_wallets for select using (true);
create policy mm_wallets_write  on public.mm_wallets for insert with check (true);
create policy mm_wallets_update on public.mm_wallets for update using (true) with check (true);
create policy mm_wallets_delete on public.mm_wallets for delete using (true);

-- ── App config (admin-editable, single row id=1) ────────────────────────────
-- Lets the owner set the ELCAS token / fee token / creator fee / Pons launchpad
-- link from the in-app Admin panel and have every visitor pick it up — no
-- redeploy. Casual layer (permissive RLS); the edit UI is gated on the on-chain
-- registry owner in the client.
create table if not exists public.app_config (
  id                  int primary key default 1,
  elcas_token         text not null default '',
  fee_token           text not null default '',
  creator_fee_bps     int  not null default 200,   -- 200 = 2%
  pons_launchpad_url  text not null default '',
  pons_logo_url       text not null default '',
  updated_at          timestamptz not null default now(),
  constraint app_config_singleton check (id = 1)
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;

alter table public.app_config enable row level security;
drop policy if exists app_config_read   on public.app_config;
drop policy if exists app_config_write  on public.app_config;
drop policy if exists app_config_update on public.app_config;
create policy app_config_read   on public.app_config for select using (true);
create policy app_config_write  on public.app_config for insert with check (true);
create policy app_config_update on public.app_config for update using (true) with check (true);

-- ── TTL cleanup ─────────────────────────────────────────────────────────────
-- Keep the most recent 200 messages and drop anything older than 24h.
create or replace function public.midchat_cleanup() returns void
language sql security definer as $$
  delete from public.messages
  where created_at < now() - interval '24 hours'
     or id in (select id from public.messages order by created_at desc offset 200);
$$;

-- Schedule every 10 minutes with pg_cron. Enable the extension first:
--   Dashboard → Database → Extensions → enable "pg_cron".
-- Then run:
--   select cron.schedule('midchat_cleanup', '*/10 * * * *', $$ select public.midchat_cleanup(); $$);
