import { ReactNode, createContext, useContext, useState } from "react";
import { MessageSquare, SlidersHorizontal, ArrowLeftRight } from "lucide-react";

/**
 * Lets a game host the room chat AND a token↔ETH swap as tabs INSIDE its own
 * right-hand controls column (beside the wheel) — not as a separate rail or on
 * top of the game. The room provides the chat + swap nodes via ChatSlotProvider;
 * each game wraps its controls column in <ControlsTabs>. With nothing in context
 * (game shown standalone) it renders the controls unchanged.
 */
type Slots = { chat?: ReactNode; swap?: ReactNode };
export const ChatSlotContext = createContext<Slots>({});

export function ChatSlotProvider({ chat, swap, children }: { chat?: ReactNode; swap?: ReactNode; children: ReactNode }) {
  return <ChatSlotContext.Provider value={{ chat, swap }}>{children}</ChatSlotContext.Provider>;
}

type TabKey = "bet" | "chat" | "swap";

export function ControlsTabs({ children }: { children: ReactNode }) {
  const { chat, swap } = useContext(ChatSlotContext);
  const [tab, setTab] = useState<TabKey>("bet");
  if (!chat && !swap) return <div className="space-y-3">{children}</div>;

  const tabs: { key: TabKey; label: string; icon: ReactNode }[] = [
    { key: "bet", label: "Bet", icon: <SlidersHorizontal size={12} /> },
    ...(chat ? [{ key: "chat" as const, label: "Chat", icon: <MessageSquare size={12} /> }] : []),
    ...(swap ? [{ key: "swap" as const, label: "Swap", icon: <ArrowLeftRight size={12} /> }] : []),
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : "bet";

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-ink-900/70 border border-ink-700/70 p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition ${
              active === t.key ? "bg-ink-600 text-bone-50 shadow-sm" : "text-bone-400 hover:text-bone-100"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div hidden={active !== "bet"} className="space-y-3">{children}</div>
      {chat && <div hidden={active !== "chat"}>{chat}</div>}
      {swap && <div hidden={active !== "swap"}>{swap}</div>}
    </div>
  );
}
