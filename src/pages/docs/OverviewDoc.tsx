import { Link } from "react-router-dom";
import { PaperFrame, Section, Lead, P, Bullets, Callout, Pills, StepCard, StatGrid, TocItem } from "../../components/paper/PaperKit";
import { CHAIN, TOKEN_SYMBOL } from "../../lib/chain";

const toc: TocItem[] = [
  { id: "what", label: "What is Midgard" },
  { id: "economy", label: `The ${TOKEN_SYMBOL} economy` },
  { id: "engine", label: "The engine" },
  { id: "casino", label: "The on-chain casino" },
  { id: "chain", label: "Built on Robinhood" },
  { id: "safe", label: "Why it's safe" },
  { id: "start", label: "Get started" },
];

/** Flow: swap fee → reflection; and differential decay → pool burns faster → price↑. */
function EngineFlow() {
  return (
    <svg viewBox="0 0 640 190" className="w-full h-auto" fill="none">
      <rect x="18" y="30" width="120" height="34" rx="8" fill="#12161d" stroke="#34d399" strokeWidth="1.4" />
      <text x="78" y="51" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="monospace">swap fee</text>
      <path d="M138 47 C 230 47, 230 47, 300 47" stroke="#34d399" strokeWidth="1.6" opacity="0.7" />
      <rect x="300" y="30" width="170" height="34" rx="8" fill="#12161d" stroke="#34d399" strokeWidth="1.4" />
      <text x="312" y="45" fill="#fff" fontSize="11" fontWeight="700" fontFamily="monospace">Reflection</text>
      <text x="312" y="58" fill="#6b7f96" fontSize="8" fontFamily="monospace">100% → holders grow</text>

      <rect x="18" y="120" width="120" height="34" rx="8" fill="#12161d" stroke="#b4ff2e" strokeWidth="1.4" />
      <text x="78" y="141" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="monospace">decay</text>
      <path d="M138 137 C 210 137, 210 137, 300 137" stroke="#fbbf24" strokeWidth="1.6" opacity="0.7" />
      <rect x="300" y="120" width="170" height="34" rx="8" fill="#12161d" stroke="#fbbf24" strokeWidth="1.4" />
      <text x="312" y="135" fill="#fff" fontSize="11" fontWeight="700" fontFamily="monospace">Holders slow · pool fast</text>
      <text x="312" y="148" fill="#6b7f96" fontSize="8" fontFamily="monospace">φ-adaptive differential</text>
      <path d="M470 137 C 520 137, 520 100, 560 100" stroke="#B01B21" strokeWidth="1.6" opacity="0.7" />
      <rect x="500" y="83" width="130" height="34" rx="8" fill="#12161d" stroke="#B01B21" strokeWidth="1.4" />
      <text x="512" y="98" fill="#fff" fontSize="11" fontWeight="700" fontFamily="monospace">Price ↑</text>
      <text x="512" y="111" fill="#6b7f96" fontSize="8" fontFamily="monospace">pool {TOKEN_SYMBOL} burned</text>
    </svg>
  );
}

export default function OverviewDoc() {
  const hero = (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mg-live-dot" /> Litepaper · v1
      </div>
      <h1 className="text-[30px] sm:text-[42px] font-black leading-[1.08] tracking-tight text-bone-50">EL-Casino</h1>
      <p className="mt-2 text-[17px] sm:text-[19px] font-semibold text-blood-400">A self-sustaining on-chain economy.</p>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone-400">
        One deflationary token and a permissionless casino — living entirely
        on {CHAIN.name}. No backend, no custody, no off-chain trust. Every number on this platform is read straight
        from a contract.
      </p>
    </div>
  );

  return (
    <PaperFrame toc={toc} hero={hero}>
      <Section id="what" title="What is Midgard">
        <Lead>
          EL-Casino is an on-chain casino. It is built around <b className="text-bone-100">{TOKEN_SYMBOL}</b> —
          a token whose supply is designed to shrink while its pool burns even faster — and the on-chain casino
          that runs on top of it.
        </Lead>
        <P>
          Everything is contracts-as-database: there is no server storing balances, bets, or leaderboards. The frontend
          reads the chain directly and shows it back to you live. If this website disappeared tomorrow, every token,
          pool, game, and stake would keep working from any other interface.
        </P>
        <Pills items={["No mint", "No pause", "No blacklist", "Immutable parameters"]} />
      </Section>

      <Section id="economy" title={`The ${TOKEN_SYMBOL} economy`}>
        <P>
          Most tokens are static: a fixed supply that just sits there. {TOKEN_SYMBOL} is <b className="text-bone-100">elastic</b>.
          Holder balances slowly decay, but the trading pool's {TOKEN_SYMBOL} is burned <b className="text-bone-100">faster</b> —
          so with the same ETH backing fewer tokens, the price rises without minting a single wei of ETH. Every swap fee
          is reflected straight to holders on top of that.
        </P>
        <StatGrid stats={[
          { k: "Supply", v: "Deflationary", sub: "holders + pool burn" },
          { k: "Liquidity", v: "Self-healing", sub: "burn can't brick it" },
          { k: "Holders", v: "Rewarded", sub: "reflection + price gain" },
          { k: "Trust", v: "Minimized", sub: "no admin over funds" },
        ]} />
        <P>
          The result is an economy where simply holding and trading tightens the token over time. The full mechanics,
          with an animated explainer and a live simulator, live on the <Link to="/tokenomics" className="text-blood-400 hover:underline">Tokenomics</Link> page.
        </P>
      </Section>

      <Section id="engine" title="The engine">
        <P>Two forces, both fully autonomous — reflection from every fee, and a φ-adaptive differential decay:</P>
        <EngineFlow />
        <div className="my-5 space-y-3">
          <StepCard n="1" color="#34d399" title="Reflection" desc="100% of every swap fee (2% buy / 2% sell) lifts a global index, so every holder's balance grows in place — no claim, no transaction. The pool and excluded wallets get none, so it never drops price." />
          <StepCard n="2" color="#fbbf24" title="Differential decay" desc="Holders decay slowly; the primary pool burns faster. The gap lifts real price — a holder's net value grows at roughly (pool rate − holder rate)." />
          <StepCard n="3" color="#67c7f0" title="φ-adaptive" desc="Rates track φ = the pool's share of the float. Thick pool → burn faster; thin pool → holders decay faster so the pool's share regrows. It self-balances." />
          <StepCard n="4" color="#b4ff2e" title="Brick-safe" desc="The pool burn is a percentage of the reserve, realized on transfers + a permissionless poke(). It can never remove more than exists, so the pool can thin but never empty." />
        </div>
        <Callout variant="green" title="No ETH is minted">
          Price rises because the pool's {TOKEN_SYMBOL} side is burned and re-synced — the same ETH now backs fewer tokens.
          It's honest arithmetic. Realizable ETH equals ETH ever deposited, so a sustained sell-off still costs holders —
          only real new buyers fund gains.
        </Callout>
      </Section>

      <Section id="casino" title="The on-chain casino">
        <P>
          Anyone can spin up a provably-fair game room on any token — roulette, crash, blackjack, mines, plinko and
          more — using a commit-reveal scheme so neither the player nor the house can predict or tamper with an
          outcome. You can also stake into a room's pool and <b className="text-bone-100">become the house</b>, earning
          a share of every bet's edge.
        </P>
        <P>Full details are in the <b className="text-bone-100">Casino</b> documentation tab.</P>
      </Section>

      <Section id="chain" title="Built on Robinhood Chain">
        <P>
          Midgard runs on {CHAIN.name} (chain {CHAIN.id}), a fast, low-fee EVM network. Blocks confirm quickly enough
          that casino reveals feel instant and the token's per-second decay is visible live on the home page.
        </P>
        <Callout variant="blue">
          The app reads the chain through a same-origin RPC proxy, so it stays fast and CORS-safe. All writes go
          through your own wallet — the app never holds your keys or your funds.
        </Callout>
      </Section>

      <Section id="safe" title="Why it's safe">
        <Bullets items={[
          "No mint function, no pause switch, no blacklist, no mutable tax — every economic parameter is fixed at deploy as an immutable.",
          "No privileged withdraw path, and the contract holds no ETH at all — not even the deployer can move user funds.",
          "The pool burn is a percentage of the reserve, so it can never over-burn or brick the pool.",
          `The ${TOKEN_SYMBOL} token has a full line-by-line security review — see the Token Audit tab.`,
          "Casino outcomes use commit-reveal, so results are fixed before they are known to anyone.",
        ]} />
      </Section>

      <Section id="start" title="Get started">
        <div className="my-5 space-y-3">
          <StepCard n="1" color="#b4ff2e" title="Connect your wallet" desc={`Switch to ${CHAIN.name} — the app will prompt you.`} />
          <StepCard n="2" color="#fbbf24" title={`Get ${TOKEN_SYMBOL}`} desc="Buy on the Trade tab; watch supply decay and the pool burn live." />
          <StepCard n="3" color="#34d399" title="Earn" desc="Just hold — reflection grows your balance from every trade, and the pool burn lifts price. Or stake a casino pool to become the house." />
          <StepCard n="4" color="#67c7f0" title="Build" desc="Launch your own economy token, or open a game room on any token." />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/token" className="btn-primary px-5 py-3 text-sm">Open {TOKEN_SYMBOL} →</Link>
          <Link to="/tokenomics" className="btn-ghost px-5 py-3 text-sm">Read the tokenomics</Link>
        </div>
      </Section>
    </PaperFrame>
  );
}
