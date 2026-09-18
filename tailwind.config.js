/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Replantus-derived identity: matte-black leather + blood-red embroidery.
        ink: {
          950: "#08080A", 900: "#0B0B0C", 850: "#101012", 800: "#141417",
          700: "#1C1C20", 600: "#26262B", 500: "#3A3A41",
        },
        // Primary accent — yellow-green neon (was blood-red). Kept the "blood"
        // name so all existing utilities flip in one place.
        blood: {
          50: "#F4FDE0", 200: "#DCF7A2", 400: "#B4FF2E", 500: "#93E014",
          600: "#77B80F", 700: "#5C8E0B", 900: "#2A4408",
        },
        // The old blood-red, kept for genuine danger/error/burn semantics.
        danger: {
          50: "#FDF2F2", 200: "#F0A9AB", 400: "#C8353B", 500: "#B01B21",
          600: "#93131A", 700: "#7A1014", 900: "#4A090C",
        },
        bone: { 50: "#FAFAF9", 200: "#E4E4E7", 400: "#A1A1AA", 600: "#71717A" },
        // Casino accents (ported from Avlo) — neon green table felt + orange fee.
        "accent-green": "#00ff88",
        "accent-orange": "#ff6b35",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        gothic: ["'Pirata One'", "'Times New Roman'", "serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        blood: "0 0 0 1px rgba(147,224,20,0.35), 0 8px 30px -8px rgba(147,224,20,0.45)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        leather: "radial-gradient(120% 90% at 50% 0%, #16161A 0%, #0B0B0C 55%, #070708 100%)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .35s cubic-bezier(.16,1,.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};
