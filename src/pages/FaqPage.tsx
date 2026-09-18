import { HelpCircle } from "lucide-react";
import { Faq } from "../components/Faq";

/** Standalone FAQ page — reached from its own nav button (left bar / mobile). */
export default function FaqPage() {
  return (
    <div className="animate-fade-up max-w-4xl mx-auto space-y-4">
      <div>
        <div className="flex items-center gap-2 text-blood-400">
          <HelpCircle size={16} /><span className="font-mono text-[10px] uppercase tracking-[0.24em]">Help · everything explained</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">FAQ</h1>
        <p className="text-bone-400 text-sm">How MIDGARD, the casino, and trading work — and why. Tap any question.</p>
      </div>
      <Faq />
    </div>
  );
}
