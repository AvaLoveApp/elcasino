/**
 * Favicon — the Midgard mark set inside a solid brand-green square, so the tab
 * icon pops among a row of other tabs. No animation: a spinning tab icon can only
 * repaint at the browser's own (low, uneven) cadence, which always looks like it
 * stutters, so we render it once and leave it. Kept as one function (same
 * name/import) so the app just calls it at startup.
 */
export function startAnimatedFavicon() {
  try {
    if (typeof document === "undefined") return;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }

    const paint = (img?: HTMLImageElement) => {
      ctx.clearRect(0, 0, size, size);
      // Solid brand-green square (blood-500) — the attention-grabbing frame.
      ctx.fillStyle = "#93E014";
      ctx.fillRect(0, 0, size, size);
      // Logo inset so the green shows as a border around it.
      if (img) { const pad = 8; ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2); }
      try { link!.href = canvas.toDataURL("image/png"); } catch {}
    };

    paint();                        // green square shows immediately
    const img = new Image();
    img.src = "./elcasino_logo.png";
    img.onload = () => paint(img);  // then the mark drops in
  } catch { /* favicon is cosmetic — never break the app */ }
}
