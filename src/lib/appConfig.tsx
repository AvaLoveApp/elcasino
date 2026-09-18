import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Admin-editable, site-wide config (single row id=1 in Supabase `app_config`).
 * Lets the owner set the launch details from the in-app Admin panel — the ELCAS
 * token address, the fee token, the creator fee, and the Pons launchpad link —
 * and every visitor picks them up with no redeploy. Falls back to defaults (and
 * a localStorage cache) so the app works before the row/table exists.
 */
export type AppConfig = {
  elcasToken: string;        // ELCAS platform token address ("" until launched)
  feeToken: string;          // token fees are collected in / bought back ("" = ETH/native)
  creatorFeeBps: number;     // creator fee in basis points (200 = 2%)
  ponsLaunchpadUrl: string;  // Pons launchpad link for the ELCAS launch
  ponsLogoUrl: string;       // Pons logo image URL
};

export const DEFAULT_CONFIG: AppConfig = {
  elcasToken: "",
  feeToken: "",
  creatorFeeBps: 200,
  ponsLaunchpadUrl: "",
  ponsLogoUrl: "",
};

const LS_KEY = "elcas.appconfig";

function fromRow(r: any): AppConfig {
  return {
    elcasToken: (r?.elcas_token ?? "").trim(),
    feeToken: (r?.fee_token ?? "").trim(),
    creatorFeeBps: Number(r?.creator_fee_bps ?? DEFAULT_CONFIG.creatorFeeBps) || 0,
    ponsLaunchpadUrl: (r?.pons_launchpad_url ?? "").trim(),
    ponsLogoUrl: (r?.pons_logo_url ?? "").trim(),
  };
}
function toRow(c: AppConfig) {
  return {
    id: 1,
    elcas_token: c.elcasToken.trim(),
    fee_token: c.feeToken.trim(),
    creator_fee_bps: Math.max(0, Math.round(c.creatorFeeBps)),
    pons_launchpad_url: c.ponsLaunchpadUrl.trim(),
    pons_logo_url: c.ponsLogoUrl.trim(),
    updated_at: new Date().toISOString(),
  };
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (!supabase) return DEFAULT_CONFIG;
  const { data, error } = await supabase.from("app_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return DEFAULT_CONFIG;
  return fromRow(data);
}

export async function saveAppConfig(c: AppConfig): Promise<void> {
  if (!supabase) throw new Error("Config backend not configured.");
  const { error } = await supabase.from("app_config").upsert(toRow(c)).eq("id", 1);
  if (error) throw error;
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch {}
}

type Ctx = { config: AppConfig; loading: boolean; refresh: () => Promise<void> };
const AppConfigCtx = createContext<Ctx>({ config: DEFAULT_CONFIG, loading: true, refresh: async () => {} });

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => {
    try { const s = localStorage.getItem(LS_KEY); if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }; } catch {}
    return DEFAULT_CONFIG;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const c = await loadAppConfig();
      setConfig(c);
      try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <AppConfigCtx.Provider value={{ config, loading, refresh }}>{children}</AppConfigCtx.Provider>;
}

export function useAppConfig(): Ctx {
  return useContext(AppConfigCtx);
}

// Convenience helpers.
export const hasElcasToken = (c: AppConfig) => /^0x[a-fA-F0-9]{40}$/.test(c.elcasToken);
export const creatorFeePct = (c: AppConfig) => (c.creatorFeeBps / 100);
