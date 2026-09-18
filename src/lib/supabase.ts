import { createClient, SupabaseClient } from "@supabase/supabase-js";

// MidChat backend. Both values are FRONTEND-SAFE (the anon key is public by
// design — Row Level Security guards the data). Put the real values in
// .env.local (git-ignored) as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const anon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = !!(url && anon);

// Null until configured, so the app never crashes when the keys are missing —
// MidChat renders a friendly "being set up" state instead.
export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anon!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
