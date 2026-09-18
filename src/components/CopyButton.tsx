import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Tiny copy-to-clipboard control. Shows a check for 1.5s after copying. */
export function CopyButton({ value, title = "Copy", className = "" }: { value: string; title?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {});
  };
  return (
    <button onClick={copy} title={title}
      className={`inline-flex items-center text-bone-500 hover:text-blood-400 transition ${className}`}>
      {ok ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}
