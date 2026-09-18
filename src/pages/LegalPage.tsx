import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { FileText, Shield, HeartPulse, AlertTriangle } from "lucide-react";
import { SOCIALS } from "../lib/socials";

/**
 * Corporate legal hub — Terms of Service, Privacy Policy, Responsible Gaming and
 * a Risk Disclaimer, tabbed. EL-Casino is a non-custodial, on-chain protocol:
 * no accounts, no custody of funds, provably-fair games settled by contracts.
 */

const UPDATED = "September 2026";
const SUPPORT = SOCIALS.telegram;

type Sec = { key: string; label: string; icon: any; title: string; body: React.ReactNode };

const P = ({ children }: { children: React.ReactNode }) => <p className="text-[13.5px] leading-relaxed text-bone-300">{children}</p>;
const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-base font-bold text-bone-50 mt-5 mb-1.5">{children}</h3>;
const LI = ({ children }: { children: React.ReactNode }) => <li className="text-[13.5px] leading-relaxed text-bone-300">{children}</li>;

const SECTIONS: Sec[] = [
  {
    key: "terms", label: "Terms of Service", icon: FileText, title: "Terms of Service",
    body: (
      <div className="space-y-2">
        <P>Welcome to EL-Casino ("EL-Casino", "the Protocol", "we"). EL-Casino is a decentralized, non-custodial suite of smart contracts deployed on Robinhood Chain, together with this website that provides a convenience interface to those contracts. By accessing or using the interface you agree to these Terms.</P>
        <H>1. Nature of the service</H>
        <P>EL-Casino is software. All games, pools, swaps and payouts are executed by autonomous smart contracts on a public blockchain. We do not operate a bank, exchange, or custodial casino, we never take custody of your assets, and we cannot access, freeze, reverse, or recover funds in your self-custodial wallet.</P>
        <H>2. Eligibility</H>
        <P>You must be at least 18 years old (or the age of majority in your jurisdiction, whichever is higher) and legally permitted to use blockchain-based games of chance where you live. You are solely responsible for determining whether your use is lawful in your jurisdiction.</P>
        <H>3. Restricted jurisdictions</H>
        <P>The interface is not offered to, and may not be used by, persons in jurisdictions where online gaming or the use of this software is prohibited. You must not use a VPN or other means to circumvent these restrictions.</P>
        <H>4. No custody, your keys</H>
        <ul className="list-disc pl-5 space-y-1">
          <LI>You connect your own wallet and sign every transaction yourself.</LI>
          <LI>You are responsible for your private keys, seed phrases and wallet security.</LI>
          <LI>Transactions on the blockchain are final and irreversible.</LI>
        </ul>
        <H>5. Fees</H>
        <P>Deploying a game room and each bet may incur protocol fees, disclosed in the interface before you act. Network gas fees are separate and paid to the chain. Fees may fund ELCAS buyback &amp; burn.</P>
        <H>6. No warranty</H>
        <P>The interface and contracts are provided "as is" and "as available", without warranties of any kind. Smart contracts may contain bugs. You use them at your own risk.</P>
        <H>7. Limitation of liability</H>
        <P>To the maximum extent permitted by law, EL-Casino and its contributors are not liable for any losses, including lost funds, lost profits, or damages arising from your use of the software, price volatility, contract exploits, or third-party services (RPC providers, DEX aggregators, wallets).</P>
        <H>8. Changes</H>
        <P>We may update these Terms; the current version governs your use. Continued use after changes constitutes acceptance.</P>
        <P>Questions? Reach us on <a href={SUPPORT} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Telegram</a>.</P>
      </div>
    ),
  },
  {
    key: "privacy", label: "Privacy Policy", icon: Shield, title: "Privacy Policy",
    body: (
      <div className="space-y-2">
        <P>EL-Casino is designed to be privacy-preserving. We do not run traditional accounts and collect as little as possible.</P>
        <H>1. What we do not collect</H>
        <ul className="list-disc pl-5 space-y-1">
          <LI>No name, email, phone, ID or KYC to browse or play.</LI>
          <LI>No custody of funds and no access to your private keys.</LI>
        </ul>
        <H>2. Information involved</H>
        <ul className="list-disc pl-5 space-y-1">
          <LI><b className="text-bone-100">On-chain data</b> — your wallet address and transactions are public on the blockchain by design; we do not control this.</LI>
          <LI><b className="text-bone-100">Optional profile</b> — if you set a chat display name or avatar, it is stored to power the social features.</LI>
          <LI><b className="text-bone-100">Technical data</b> — standard logs (e.g. IP, browser) may be processed by our hosting, RPC and infrastructure providers to deliver the site and prevent abuse.</LI>
        </ul>
        <H>3. Third-party services</H>
        <P>The interface talks to independent services — blockchain RPC endpoints, DEX aggregators (e.g. LI.FI), market-data (e.g. DexScreener), wallet providers and, for optional social login, an embedded-wallet provider. Their handling of data is governed by their own policies.</P>
        <H>4. Cookies / storage</H>
        <P>We use local browser storage for preferences (e.g. selected tab, theme). We do not sell personal data.</P>
        <H>5. Your choices</H>
        <P>You can use the app with a fresh wallet, decline optional social login, and clear local storage at any time.</P>
        <P>Privacy questions: <a href={SUPPORT} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Telegram</a>.</P>
      </div>
    ),
  },
  {
    key: "responsible", label: "Responsible Gaming", icon: HeartPulse, title: "Responsible Gaming",
    body: (
      <div className="space-y-2">
        <P>Games on EL-Casino are for entertainment. The house edge means that, over time, the odds favor the pool — you should never wager more than you can afford to lose.</P>
        <H>Play safely</H>
        <ul className="list-disc pl-5 space-y-1">
          <LI>Set a budget before you play and stick to it.</LI>
          <LI>Gambling is not a way to make money or recover losses.</LI>
          <LI>Take breaks; never play under stress or the influence of substances.</LI>
          <LI>Only participate if you are 18+ and it is legal where you live.</LI>
        </ul>
        <H>Self-control</H>
        <P>Because EL-Casino is non-custodial, the strongest control is in your wallet: only fund what you intend to play, and step away when it stops being fun.</P>
        <H>Need help?</H>
        <P>If gambling stops feeling like a choice, please seek support. Organizations such as <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">BeGambleAware</a> and <a href="https://www.gamblersanonymous.org" target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Gamblers Anonymous</a> offer free, confidential help.</P>
      </div>
    ),
  },
  {
    key: "disclaimer", label: "Risk Disclaimer", icon: AlertTriangle, title: "Risk Disclaimer",
    body: (
      <div className="space-y-2">
        <P>Using EL-Casino involves significant risk. Nothing here is financial, investment, legal or tax advice.</P>
        <H>Key risks</H>
        <ul className="list-disc pl-5 space-y-1">
          <LI><b className="text-bone-100">Loss of funds</b> — games of chance can and do result in losses; blockchain transactions are irreversible.</LI>
          <LI><b className="text-bone-100">Volatility</b> — token prices can move sharply; the value of pools and winnings can fall.</LI>
          <LI><b className="text-bone-100">Smart-contract risk</b> — code may contain bugs or be exploited despite audits.</LI>
          <LI><b className="text-bone-100">Third-party risk</b> — RPCs, aggregators and wallets are outside our control.</LI>
          <LI><b className="text-bone-100">Regulatory risk</b> — rules on crypto and online gaming vary and can change.</LI>
        </ul>
        <H>The ELCAS token</H>
        <P>ELCAS is a utility token for the EL-Casino platform. It is not an investment, security, or a promise of profit. Any references to fees, buyback or burn describe protocol mechanics, not a guarantee of value. Do your own research.</P>
        <P>By using the interface you acknowledge and accept these risks.</P>
      </div>
    ),
  },
];

export default function LegalPage() {
  const { section } = useParams();
  const active = SECTIONS.find((s) => s.key === section);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [section]);
  if (!section) return <Navigate to="/legal/terms" replace />;
  if (!active) return <Navigate to="/legal/terms" replace />;

  return (
    <div className="animate-fade-up max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="mg-logo-rings h-10 w-10 shrink-0">
          <span className="mg-ring mg-ring-red" /><span className="mg-ring mg-ring-green" />
          <img src="./elcasino_logo.png" alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-ink-600" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Legal &amp; Policies</h1>
          <p className="text-bone-500 text-xs font-mono">EL-Casino · non-custodial on-chain protocol · last updated {UPDATED}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-ink-800/70 border border-ink-700/70 p-1">
        {SECTIONS.map((s) => {
          const on = s.key === active.key;
          const Icon = s.icon;
          return (
            <Link key={s.key} to={`/legal/${s.key}`}
              className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${on ? "bg-ink-600 text-bone-50 shadow-sm" : "text-bone-400 hover:text-bone-100 hover:bg-ink-700/50"}`}>
              <Icon size={14} className={on ? "text-blood-400" : ""} /> {s.label}
            </Link>
          );
        })}
      </div>

      {/* Body */}
      <div className="panel p-5 sm:p-7">
        <div className="flex items-center gap-2 mb-4 text-blood-400">
          <active.icon size={16} />
          <h2 className="text-lg font-bold text-bone-50">{active.title}</h2>
        </div>
        {active.body}
        <div className="mt-6 pt-4 border-t border-ink-700/60 text-[11px] font-mono text-bone-600">
          This summary is provided for convenience and does not constitute legal advice. Use of EL-Casino is at your own risk. 18+ only.
        </div>
      </div>
    </div>
  );
}
