import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type Ctx = {
  open: boolean;
  quoteId: number;                    // 0 = plain compose
  prefill: string;                    // seed text (e.g. sharing a casino room)
  openCompose: (prefill?: string) => void;
  openQuote: (id: number) => void;
  closeCompose: () => void;
};

const C = createContext<Ctx>({
  open: false, quoteId: 0, prefill: "",
  openCompose: () => {}, openQuote: () => {}, closeCompose: () => {},
});
export const useCompose = () => useContext(C);

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [quoteId, setQuoteId] = useState(0);
  const [prefill, setPrefill] = useState("");
  const openCompose = useCallback((p?: string) => { setQuoteId(0); setPrefill(p ?? ""); setOpen(true); }, []);
  const openQuote = useCallback((id: number) => { setQuoteId(id); setPrefill(""); setOpen(true); }, []);
  const closeCompose = useCallback(() => { setOpen(false); setQuoteId(0); setPrefill(""); }, []);
  return (
    <C.Provider value={{ open, quoteId, prefill, openCompose, openQuote, closeCompose }}>
      {children}
    </C.Provider>
  );
}
