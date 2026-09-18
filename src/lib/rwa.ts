import { ADDR } from "./chain";

/**
 * Preset targets for the claim card. `address` may be null while we're still
 * waiting on the on-chain deployment for a given RWA — the chip renders
 * disabled so users see "coming soon" instead of pasting a dead address.
 *
 * `logo` is an optional external image URL; when missing we render a colour
 * glyph badge (short label on a brand-tinted gradient).
 */
export type RwaPreset = {
  key: string;
  label: string;
  address: string | null;
  color: string;        // gradient tone for the glyph badge fallback
  short: string;        // 1-3 char glyph text (only shown when no logo)
  logo?: string;        // optional URL
  note?: string;
};

export const RWA_PRESETS: RwaPreset[] = [
  { key: "midgard", label: "MIDGARD", address: ADDR.token,                                     color: "#B01B21", short: "M",  note: "self-claim", logo: "./elcasino_logo.png" },
  { key: "weth",    label: "WETH",    address: ADDR.weth,                                      color: "#627EEA", short: "Ξ",  note: "no swap", logo: "./eth.svg" },
  { key: "nvda",    label: "NVDA",    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",   color: "#76B900", short: "NV", logo: "https://pbs.twimg.com/profile_images/1828904711124078593/SRvCZSfQ_400x400.jpg" },
  { key: "tsla",    label: "TSLA",    address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",   color: "#CC0000", short: "TS", logo: "https://pbs.twimg.com/profile_images/1337607516008501250/6Ggc4S5n_400x400.png" },
  { key: "aapl",    label: "AAPL",    address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",   color: "#A2AAAD", short: "AP", logo: "https://pbs.twimg.com/profile_images/1892248257516224513/SzZdRSkx_400x400.png" },
  { key: "amzn",    label: "AMZN",    address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",   color: "#FF9900", short: "AZ", logo: "https://pbs.twimg.com/profile_images/1912984084516831232/BHv0mcPd_400x400.jpg" },
  { key: "googl",   label: "GOOGL",   address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",   color: "#4285F4", short: "G",  logo: "https://pbs.twimg.com/profile_images/2042749771337564160/AgOFPEL3_400x400.jpg" },
  { key: "msft",    label: "MSFT",    address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",   color: "#00A4EF", short: "MS", logo: "https://pbs.twimg.com/profile_images/1065039184837005313/4JGYZSy1_400x400.jpg" },
  { key: "meta",    label: "META",    address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",   color: "#1877F2", short: "MT", logo: "https://pbs.twimg.com/profile_images/1453818753880190978/HqrrEcrI_400x400.png" },
  { key: "spy",     label: "SPY",     address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",   color: "#0033A0", short: "SP" },
];
