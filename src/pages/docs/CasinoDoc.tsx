import { Link } from "react-router-dom";
import { PaperFrame, Section, Lead, P, Bullets, Callout, Figure, StepCard, DataTable, StatGrid, TocItem } from "../../components/paper/PaperKit";
import { CASINO_GAMES } from "../../lib/casino";

const toc: TocItem[] = [
  { id: "what", label: "The casino, on-chain" },
  { id: "fair", label: "Provable fairness" },
  { id: "flow", label: "How a bet settles" },
  { id: "games", label: "Game library" },
  { id: "params", label: "Room parameters" },
  { id: "house", label: "Become the house" },
  { id: "safe", label: "Safety & limits" },
];

/* commit → block → reveal illustration. */
function BetFlow() {
  return (
    <svg viewBox="0 0 640 150" className="w-full h-auto" fill="none">
      {[
        { x: 40, c: "#b4ff2e", n: "1", t: "commit", s: "bet locked" },
        { x: 250, c: "#fbbf24", n: "2", t: "block", s: "hash fixed" },
        { x: 460, c: "#34d399", n: "3", t: "reveal", s: "you get paid" },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y="35" width="140" height="80" rx="12" fill="#12161d" stroke={s.c} strokeWidth="1.5" />
          <circle cx={s.x + 28} cy="63" r="15" fill={s.c} opacity="0.18" />
          <text x={s.x + 28} y="69" textAnchor="middle" fill={s.c} fontSize="16" fontWeight="800" fontFamily="monospace">{s.n}</text>
          <text x={s.x + 52} y="60" fill="#fff" fontSize="11" fontWeight="700" fontFamily="monospace">{s.t}</text>
          <text x={s.x + 52} y="78" fill="#6b7f96" fontSize="8.5" fontFamily="monospace">{s.s}</text>
          {i < 2 && <path d={`M${s.x + 140} 75 L${s.x + 210} 75`} stroke={s.c} strokeWidth="1.6" markerEnd="url(#cah)" />}
        </g>
      ))}
      <defs><marker id="cah" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#6b7f96" /></marker></defs>
    </svg>
  );
}

export default function CasinoDoc() {
  const hero = (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blood-500" /> Casino · documentation
      </div>
      <h1 className="text-[30px] sm:text-[42px] font-black leading-[1.08] tracking-tight text-bone-50">EL-Casino</h1>
      <p className="mt-2 text-[17px] sm:text-[19px] font-semibold text-blood-400">Provably-fair games on any token. No server, no house account.</p>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone-400">
        A permissionless casino where anyone can open a game room, and anyone can stake into a pool to become the
        house. Every bet, pool and payout lives in a contract you can verify.
      </p>
    </div>
  );

  return (
    <PaperFrame toc={toc} hero={hero}>
      <Section id="what" title="The casino, on-chain">
        <Lead>
          The casino is a set of on-chain game factories. Each factory deploys independent, self-contained game
          rooms; each room holds its own token pool, tracks its own bets, and pays out directly to players.
        </Lead>
        <P>
          There is no central house account and no backend RNG. A room's pool is funded by its creator and by house-side
          stakers; wins are paid from that pool, losses feed it, and the small edge is shared with whoever staked.
        </P>
        <StatGrid stats={[
          { k: "Game types", v: String(CASINO_GAMES.length), sub: "and growing" },
          { k: "Tokens", v: "Any", sub: "open a room on your token" },
          { k: "RNG", v: "Commit-reveal", sub: "no oracle needed" },
          { k: "Custody", v: "None", sub: "pool is a contract" },
        ]} />
      </Section>

      <Section id="fair" title="Provable fairness">
        <P>
          Games use a <b className="text-bone-100">commit-reveal</b> scheme. When you place a bet, the outcome is bound
          to a value that is fixed on-chain before it can be known — so neither you nor the room owner can see the
          result in advance, and nobody can re-roll it after the fact.
        </P>
        <Bullets items={[
          "The outcome is derived from data committed at bet time and revealed a block later — it cannot be predicted at commit, and cannot be changed at reveal.",
          "The room owner cannot pick winners or losers; the settlement logic is fixed in the contract.",
          "Every wager, payout and pool change is an on-chain event you can read back independently.",
          "Because settlement is deterministic given the revealed data, anyone can re-check that a payout was correct.",
        ]} />
        <Callout variant="green" title="Fixed before it's known">
          The heart of provable fairness: the result exists, on-chain, before anyone can observe it. That's what makes
          the game trustless rather than merely trusted.
        </Callout>
      </Section>

      <Section id="flow" title="How a bet settles">
        <P>A round is two steps from your wallet — a commit, then a reveal — with a block in between:</P>
        <Figure caption="commit → block → reveal">
          <BetFlow />
        </Figure>
        <div className="my-5 space-y-3">
          <StepCard n="1" color="#b4ff2e" title="Commit" desc="You send your bet. Your stake is locked into the room's pool and the round's seed is committed on-chain." />
          <StepCard n="2" color="#fbbf24" title="Block" desc="One block passes. The value that determines your result is now fixed and public — but it wasn't known when you committed." />
          <StepCard n="3" color="#34d399" title="Reveal" desc="You send the reveal; the contract computes the outcome and pays any winnings straight to your wallet." />
        </div>
        <Callout variant="blue" title="Fast reveals">
          Robinhood Chain confirms quickly, so the reveal lands almost immediately. The EL-Casino client sends the reveal
          with an explicit gas limit so your wallet doesn't stall on a slow pre-flight simulation — no more stuck
          "revealing…" screens.
        </Callout>
      </Section>

      <Section id="games" title="Game library">
        <P>Each game type is its own audited factory. Pick a game, then a room, then play:</P>
        <div className="my-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {CASINO_GAMES.map((g) => (
            <div key={g.key} className="rounded-xl border border-ink-700/70 bg-ink-900/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{g.glyph}</span>
                <span className="text-[14px] font-bold" style={{ color: g.color }}>{g.label}</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-bone-500">{g.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="params" title="Room parameters">
        <P>
          When you open a room you set its economics. These are fixed on the room and shown to every player, so the
          terms of the house are transparent up front:
        </P>
        <DataTable
          head={["Parameter", "What it controls"]}
          rows={[
            ["Token", "The asset the room is played and paid in — any ERC-20."],
            ["RTP", "Return-to-player: the fraction of wagers paid back on average. The remainder is the house edge."],
            ["Fee", "A small cut of each bet routed to the room's fee accounting on top of the edge."],
            ["Max win", "The largest single payout, as a fraction of the pool — caps tail risk for stakers."],
            ["Min bet", "The smallest allowed wager."],
            ["Max bet / pool", "Ceiling on a bet relative to pool size, so one bet can never over-expose the house."],
            ["Initial pool", "The starting liquidity the creator seeds so the room can pay out from block one."],
          ]}
        />
        <Callout variant="amber" title="The edge is honest">
          RTP and fee are on-chain constants. A room advertising, say, 98% RTP really does pay 98% on average — you can
          verify it from the room's own wager and payout totals in its analytics.
        </Callout>
      </Section>

      <Section id="house" title="Become the house">
        <Lead>Don't want to bet? Take the other side. Stake into a room's pool and earn the edge instead of paying it.</Lead>
        <P>
          Every room has an <b className="text-bone-100">Earn</b> tab. When you stake, you receive pool shares
          proportional to your deposit. As players lose more than they win over time, the pool grows — and your shares
          are worth more. You also accrue a share of collected fees, claimable on demand.
        </P>
        <div className="my-5 space-y-3">
          <StepCard n="1" color="#a855f7" title="Stake" desc="Deposit the room's token into its pool from the Earn tab and receive shares." />
          <StepCard n="2" color="#fbbf24" title="Earn the edge" desc="The house edge and fees accrue to the pool; your shares represent a growing slice of it." />
          <StepCard n="3" color="#34d399" title="Claim & exit" desc="Claim pending fees any time, and redeem your shares back to tokens when you choose." />
        </div>
        <Callout variant="blood" title="Risk cuts both ways">
          Being the house is not free money — a hot streak of player wins shrinks the pool and your stake with it. The
          per-room max-win and max-bet caps bound that risk, but they don't remove it. Stake what you can afford to
          expose. Track it all under the casino's <b className="text-bone-100">Your positions</b> view.
        </Callout>
      </Section>

      <Section id="safe" title="Safety & limits">
        <Bullets items={[
          "Pools are contracts — no operator can withdraw player or staker funds outside the game logic.",
          "Max-win and max-bet-to-pool ratios cap the damage any single bet can do to the house.",
          "Outcomes are commit-reveal, so they can't be front-run, predicted, or re-rolled.",
          "Room parameters (RTP, fee, caps) are fixed and publicly readable — no silent changes.",
          "Everything is denominated in the room's own token; there is no cross-room contagion.",
        ]} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/casino" className="btn-primary px-5 py-3 text-sm">Enter the casino →</Link>
          <Link to="/casino?view=analytics" className="btn-ghost px-5 py-3 text-sm">See live analytics</Link>
        </div>
      </Section>
    </PaperFrame>
  );
}
