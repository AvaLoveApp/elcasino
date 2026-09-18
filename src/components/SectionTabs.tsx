import { NavLink } from "react-router-dom";
import { ArrowLeftRight, Zap, LayoutGrid, BarChart3 } from "lucide-react";

/**
 * Tab bar for the token hub — Trade / Yield / Apps / Analytics. Each is a real
 * route; this renders them as an in-page segmented control (with icons) so the
 * four surfaces read as one connected section, per the design.
 */
const TABS = [
  { to: "/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/yield", label: "Yield", icon: Zap },
  { to: "/apps", label: "Apps", icon: LayoutGrid },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function SectionTabs() {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-ink-800/80 border border-ink-700/70 p-1 mb-4">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink key={t.to} to={t.to} end
            className={({ isActive }) =>
              `flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive ? "bg-ink-600 text-bone-50 shadow-sm" : "text-bone-400 hover:text-bone-100 hover:bg-ink-700/50"
              }`}>
            {({ isActive }) => (<><Icon size={15} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-blood-400" : ""} />{t.label}</>)}
          </NavLink>
        );
      })}
    </div>
  );
}
