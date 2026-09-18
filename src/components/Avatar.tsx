import { resolveURI } from "../lib/util";

export function Avatar({ uri, name, size = 96, ring = true }: {
  uri?: string; name: string; size?: number; ring?: boolean;
}) {
  const src = resolveURI(uri);
  const ringCls = ring ? "ring-4 ring-ink-900" : "ring-1 ring-ink-600";
  if (src) {
    return (
      <img src={src} alt={name} style={{ width: size, height: size }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        className={`shrink-0 rounded-full object-cover bg-ink-800 ${ringCls}`} />
    );
  }
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`shrink-0 rounded-full flex items-center justify-center font-gothic text-bone-50
                  bg-gradient-to-br from-blood-700 to-ink-800 ${ringCls}`}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}
