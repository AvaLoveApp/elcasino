import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Robinhood's public RPC intermittently returns a duplicated
// `Access-Control-Allow-Origin: *,*` header that browsers reject, which breaks
// direct browser reads. We route reads through a SAME-ORIGIN `/rpc` path so the
// browser never does a CORS check:
//   • dev  → this Vite proxy forwards /rpc → the RPC host
//   • prod → Netlify rewrites /rpc → the RPC host (netlify.toml + public/_redirects)
const RPC_HOST = "https://rpc.mainnet.chain.robinhood.com";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5273,
    host: true,
    proxy: {
      "/rpc": { target: RPC_HOST, changeOrigin: true, secure: true, rewrite: () => "/" },
    },
  },
  base: "./",
});
