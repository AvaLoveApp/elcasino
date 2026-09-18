import { Link } from "react-router-dom";
import { PaperFrame, Section, Lead, P, Bullets, Callout, Figure, StepCard, DataTable, StatGrid, Code, Pills, H3, TocItem } from "../../components/paper/PaperKit";
import { CASINO_GAMES } from "../../lib/casino";
import { CHAIN, ADDR, TOKEN_SYMBOL } from "../../lib/chain";
import { CopyButton } from "../../components/CopyButton";
import { short } from "../../lib/util";

const toc: TocItem[] = [
  { id: "abstract", label: "Abstract" },
  { id: "intro", label: "1 · Introduction" },
  { id: "arch", label: "2 · System Architecture" },
  { id: "rng", label: "3 · Commit–Reveal Randomness" },
  { id: "indep", label: "4 · Independence of Outcomes" },
  { id: "outcomes", label: "5 · Per-Game Outcomes" },
  { id: "solvency", label: "6 · Payout & Solvency" },
  { id: "staking", label: "7 · Staking & Fees" },
  { id: "sequencer", label: "8 · The Sequencer Assumption" },
  { id: "security", label: "9 · Security Model" },
  { id: "economics", label: "10 · Protocol Economics" },
  { id: "data", label: "11 · Verifiable Data" },
  { id: "trust", label: "12 · Trust & Governance" },
  { id: "conclusion", label: "13 · Conclusion" },
];

/** A centered formula block — monospace, optionally numbered. */
function Eq({ children, n }: { children: React.ReactNode; n?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-950/70 px-4 py-3.5">
      <code className="flex-1 font-mono text-[13px] sm:text-[13.5px] leading-relaxed text-emerald-200/90 overflow-x-auto scrollbar-hide">{children}</code>
      {n && <span className="shrink-0 font-mono text-[11px] text-bone-600">({n})</span>}
    </div>
  );
}

/* commit → mine → reveal timeline. */
function CommitReveal() {
  return (
    <svg viewBox="0 0 660 160" className="w-full h-auto" fill="none">
      {[
        { x: 24, c: "#b4ff2e", n: "commit", s: "bet locked · hash does not exist", b: "block N" },
        { x: 246, c: "#fbbf24", n: "mine", s: "blockhash(N) now fixed", b: "block N+1" },
        { x: 468, c: "#34d399", n: "reveal", s: "anyone settles · verifiable", b: "block N+2" },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y="40" width="168" height="78" rx="12" fill="#12161d" stroke={s.c} strokeWidth="1.5" />
          <text x={s.x + 16} y="68" fill={s.c} fontSize="13" fontWeight="800" fontFamily="monospace">{s.n}</text>
          <text x={s.x + 16} y="88" fill="#c7d0da" fontSize="9" fontFamily="monospace">{s.b}</text>
          <text x={s.x + 16} y="104" fill="#6b7f96" fontSize="8" fontFamily="monospace">{s.s}</text>
          {i < 2 && <path d={`M${s.x + 168} 79 L${s.x + 246} 79`} stroke="#6b7f96" strokeWidth="1.6" markerEnd="url(#wpa)" />}
        </g>
      ))}
      <text x="330" y="146" textAnchor="middle" fill="#6b7f96" fontSize="9.5" fontFamily="monospace">unpredictable window — the seeding hash does not exist at commit time</text>
      <defs><marker id="wpa" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#6b7f96" /></marker></defs>
    </svg>
  );
}

/* factory → isolated games topology. */
function Isolation() {
  return (
    <svg viewBox="0 0 660 200" className="w-full h-auto" fill="none">
      <rect x="250" y="12" width="160" height="46" rx="10" fill="#1a1010" stroke="#cd202a" strokeWidth="1.5" />
      <text x="330" y="34" textAnchor="middle" fill="#f7b7bb" fontSize="12" fontWeight="800" fontFamily="monospace">Factory</text>
      <text x="330" y="49" textAnchor="middle" fill="#6b7f96" fontSize="8.5" fontFamily="monospace">createGame() · registry</text>
      {[40, 250, 460].map((x, i) => (
        <g key={i}>
          <path d={`M330 58 L${x + 85} 112`} stroke="#33404f" strokeWidth="1.3" markerEnd="url(#wpa2)" />
          <rect x={x} y="112" width="170" height="76" rx="10" fill="#12161d" stroke="#2a3542" strokeWidth="1.3" />
          <text x={x + 14} y="136" fill="#34d399" fontSize="11" fontWeight="700" fontFamily="monospace">Game {String.fromCharCode(65 + i)}</text>
          <text x={x + 14} y="153" fill="#6b7f96" fontSize="8.5" fontFamily="monospace">own pool · own config</text>
          <text x={x + 14} y="167" fill="#6b7f96" fontSize="8.5" fontFamily="monospace">own stakers · own owner</text>
          <text x={x + 14} y="181" fill="#4b5a6b" fontSize="8" fontFamily="monospace">isolated · no shared state</text>
        </g>
      ))}
      <defs><marker id="wpa2" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6 z" fill="#33404f" /></marker></defs>
    </svg>
  );
}

const ADDRESSES: [string, string][] = [
  [`${TOKEN_SYMBOL} token`, ADDR.token],
  ["On-chain registry", ADDR.registry],
  ...CASINO_GAMES.map((g) => [`${g.label} factory`, g.factory] as [string, string]),
];

export default function WhitepaperDoc() {
  const hero = (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Technical Whitepaper · v1.0 · 2026
      </div>
      <h1 className="text-[30px] sm:text-[44px] font-black leading-[1.06] tracking-tight text-bone-50">EL-Casino</h1>
      <p className="mt-2 text-[17px] sm:text-[20px] font-semibold text-blood-400">A permissionless, provably-fair on-chain casino</p>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-bone-400">
        Verifiable randomness without oracles. Isolated, community-funded liquidity. A single factory-and-game
        architecture running natively on the {CHAIN.name}. This paper specifies the architecture, the randomness
        construction and its cryptographic justification, the payout and solvency mathematics, the staking model,
        the security model, and an honest treatment of the L2 sequencer trust assumption.
      </p>
      <div className="mt-6">
        <StatGrid stats={[
          { k: "Games", v: String(CASINO_GAMES.length), sub: "commit-reveal" },
          { k: "Oracles in casino", v: "0", sub: "on-chain entropy" },
          { k: "Custody", v: "None", sub: "non-custodial" },
          { k: "Chain", v: String(CHAIN.id), sub: CHAIN.name },
        ]} />
      </div>
    </div>
  );

  return (
    <PaperFrame toc={toc} hero={hero}>
      <Section id="abstract" title="Abstract">
        <Lead>
          EL-Casino is a fully on-chain casino in which anyone can deploy a game backed by any ERC-20 token,
          configure its economics, and open it to players — with no central operator, no off-chain server, and no
          custodial risk.
        </Lead>
        <P>
          Outcomes are produced by an on-chain commit-reveal scheme seeded from a future block hash and expanded
          through SHA-256, giving provable fairness without an external randomness oracle. Each game is an isolated
          contract with its own liquidity pool, its own configuration, and its own owner. Liquidity providers stake
          into a pool and earn a pro-rata share of every fee via a Synthetix-style reward-per-share accumulator.
          The platform token, <b className="text-bone-100">${TOKEN_SYMBOL}</b>, captures protocol activity through a
          transparent buyback-and-burn flywheel. This paper specifies the full system and treats honestly the one
          material trust assumption of the {CHAIN.name}: its centralised sequencer.
        </P>
      </Section>

      <Section id="intro" title="1 · Introduction" eyebrow="Motivation">
        <P>
          On-chain gambling has historically depended on one of two compromises: a trusted operator who can be shut
          down, censor, or misreport results; or an external randomness oracle that adds cost, latency, and a new
          trust dependency. EL-Casino removes both. There is no server that holds funds or decides outcomes, and
          there is no paid oracle in the settlement path of a casino game.
        </P>
        <P>
          The protocol is permissionless in the deepest sense: deployment, liquidity provision, betting, revealing,
          and fee claiming are all open functions. A creator does not ask permission to launch a game; a player does
          not create an account; a liquidity provider does not sign an agreement. Everything that matters is enforced
          by contract code and verifiable on a public block explorer.
        </P>
        <Callout variant="green" title="Design principles">
          <ul className="space-y-1.5">
            <li><b className="text-bone-100">Verifiability</b> — every outcome can be independently recomputed from public chain data.</li>
            <li><b className="text-bone-100">Isolation</b> — a failure or drain in one game cannot touch another.</li>
            <li><b className="text-bone-100">Solvency-by-construction</b> — a game can never accept a bet it cannot pay.</li>
            <li><b className="text-bone-100">No privileged outcome control</b> — owners tune parameters within hard-coded bounds, never results.</li>
          </ul>
        </Callout>
      </Section>

      <Section id="arch" title="2 · System Architecture" eyebrow="Factory & instances">
        <P>
          The protocol follows a factory-and-instance pattern. For each game type there is a <b className="text-bone-100">Factory</b>
          contract whose sole job is to deploy and register isolated <b className="text-bone-100">Game</b> instances. The
          factory collects an optional deploy fee, routes an initial pool into the new game within the same
          transaction, and records the deployment in an on-chain registry. It never holds player funds and has no
          ability to move a game's pool.
        </P>
        <Figure caption="Factory-and-game topology — each game is a sealed box">
          <Isolation />
        </Figure>
        <P>
          Each Game instance is fully self-contained: it owns its ERC-20 token binding, its liquidity pool, its
          configuration (RTP, fees, limits), its staker set, and its owner. There are no cross-game dependencies and
          no shared pool. This isolation is the protocol's primary blast-radius control — a bug, a drain, or a
          malicious owner in one game is contained entirely within that contract.
        </P>
        <H3>On-chain registry</H3>
        <P>
          The factory maintains an <code className="font-mono text-emerald-200/90">isGame</code> mapping and an
          enumerable list of deployed games. Because only <code className="font-mono text-emerald-200/90">createGame()</code>
          can set <code className="font-mono text-emerald-200/90">isGame[addr] = true</code>, front-ends and indexers can
          trust the registry as ground truth — a game cannot be retroactively injected.
        </P>
        <Callout variant="blue" title="Isolation guarantees">
          <ul className="space-y-1.5">
            <li>Each game holds only the tokens of its own pool; the factory holds none.</li>
            <li><code className="font-mono">poolBalance</code> is explicit state, never inferred from <code className="font-mono">balanceOf</code> — donation attacks are neutralised.</li>
            <li>No delegatecall and no upgradeable proxy in the game path — the deployed bytecode is the final logic.</li>
          </ul>
        </Callout>
      </Section>

      <Section id="rng" title="3 · Commit–Reveal Randomness" eyebrow="The core primitive">
        <P>
          All casino games share one randomness primitive: a two-phase commit-reveal keyed to a future block hash.
          In the commit phase, a player locks a bet and the contract records
          <code className="font-mono text-emerald-200/90"> commitBlock = block.number</code>. The outcome depends on the
          hash of a block that does not yet exist, so at the moment of betting no party — not the player, not a
          bystander, not the sequencer — can compute the result.
        </P>
        <Figure caption="commit → mine → reveal. The seeding hash does not exist at commit time.">
          <CommitReveal />
        </Figure>
        <P>
          In the reveal phase, after at least one further block, anyone may call reveal. The contract reads the
          now-fixed block hash and expands it into a per-bet seed with SHA-256. Because the block hash is fixed the
          instant the block is mined, the outcome is immutable regardless of who reveals or when — the reveal merely
          settles a result that is already determined.
        </P>
        <Eq n="1">seed = SHA‑256( blockhash(commitBlock) ‖ player ‖ amount ‖ betId )</Eq>
        <P>
          SHA-256 is used deliberately instead of the EVM-native <code className="font-mono text-emerald-200/90">keccak256</code>,
          so that seed derivation is cryptographically independent from any hashing the EVM performs internally. The
          bet identifier <code className="font-mono text-emerald-200/90">betId</code> is a strictly increasing counter that
          guarantees every seed input is globally unique, even for identical bets from the same address in the same
          block.
        </P>
        <H3>The 256-block window and snapshotting</H3>
        <P>
          The EVM only exposes <code className="font-mono text-emerald-200/90">blockhash()</code> for the most recent 256
          blocks. To make reveals robust, any party can call <code className="font-mono text-emerald-200/90">snapshotBlockHash()</code>
          to cache the commit block's hash on-chain before it expires, and reveal auto-snapshots when it runs inside
          the window. This converts a hard 256-block deadline into an effectively unlimited claim window for any bet
          that is snapshotted in time.
        </P>
        <P>
          If a bet is never snapshotted and 256 blocks pass, its hash is gone and only
          <code className="font-mono text-emerald-200/90"> forfeitBet()</code> is available. Forfeit settles the bet as a loss
          with zero payout; the staked tokens remain in the pool. This makes stalling strictly unprofitable — a
          player can never wait out an unfavourable outcome and then reveal a favourable one.
        </P>
        <Code title="Reveal guard (simplified)">{`require(block.number > bet.commitBlock + revealExtraBlocks, "wait");
bytes32 h = blockhash(bet.commitBlock);      // or cached snapshot
require(h != bytes32(0), "snapshot first");   // >256 blocks -> forfeit
bytes32 seed = sha256(abi.encodePacked(h, player, amount, betId));`}</Code>
      </Section>

      <Section id="indep" title="4 · Cryptographic Independence of Outcomes" eyebrow="Why one seed is enough">
        <P>
          A natural objection to a single block-hash entropy source is that all same-block bets derive from one value.
          This does not create correlated or predictable outcomes. The construction is a domain-separated pseudorandom
          expansion: distinct inputs to SHA-256 produce outputs that are computationally indistinguishable from
          independent samples.
        </P>
        <Eq n="2">seedᵢ = SHA‑256( H ‖ … ‖ betIdᵢ )  ⇒  {"{ seedᵢ }"} indistinguishable from i.i.d.</Eq>
        <P>
          This is the same principle underpinning HKDF (RFC 5869), NIST SP 800-108 counter-mode KDFs, and the TLS 1.3
          key schedule — one entropy source expanded into many independent-looking values via a distinct label or
          counter. Here <code className="font-mono text-emerald-200/90">betId</code> is that counter. For two bets to be
          correlated, an adversary would need to find a relationship between
          <code className="font-mono text-emerald-200/90"> SHA256(… ‖ betId=N)</code> and
          <code className="font-mono text-emerald-200/90"> SHA256(… ‖ betId=N+1)</code>, which is a break of SHA-256.
        </P>
        <Callout variant="amber" title="Stated honestly">
          The block hash is public after mining, so this is a commitment scheme with deferred public randomness, not a
          secret-key PRF. Security rests on <b className="text-bone-100">temporal unpredictability</b>: at commit time the
          entropy does not yet exist, and after determination the bet cannot be changed. Post-reveal determinism is a
          feature — it is exactly what makes every outcome independently verifiable, the same model the Ethereum
          Foundation relies on for RANDAO.
        </Callout>
      </Section>

      <Section id="outcomes" title="5 · Per-Game Outcome Functions" eyebrow="Seed → result">
        <P>
          Every game maps the same seed to its own outcome space with a pure, deterministic function. Because the
          mapping is public code, any observer can recompute a result from the seed and verify the payout. Below are
          the canonical derivations for three archetypes; the remaining games follow the same pattern with
          game-specific tables.
        </P>
        <H3>Roulette</H3>
        <P>
          The wheel result is the seed modulo 37 (European single-zero). Payouts are the standard multiples: 36× a
          straight number, 2× on the even-money bets, 3× on dozens and columns. In a multi-bet, all positions share
          one spin result, exactly matching physical roulette.
        </P>
        <Eq n="3">result = seed mod 37 · payout = multiple × amount × RTP⁄10⁴</Eq>
        <H3>Crash</H3>
        <P>
          The crash point is drawn from an inverse distribution, giving P(crash ≥ M) ≈ 1/M and a pre-house-edge
          expected value of 1.0×. A player wins if their target multiplier is below the crash point; the RTP factor
          then applies the house edge.
        </P>
        <Eq n="4">cp = 10⁶ ⁄ ( (seed mod 10⁴) + 1 ),   P(crash ≥ M) ≈ 1 ⁄ M</Eq>
        <H3>Slots</H3>
        <P>
          Three reels are derived from the seed with per-reel domain separation, so the reels are mutually
          independent. The paytable ranges from 2× for a low pair to 100× for triple sevens, and the pool solvency
          check always uses the 100× jackpot as the worst case.
        </P>
        <Eq n="5">reelₖ = SHA‑256( seed ‖ k ) mod 10,   k ∈ {"{0,1,2}"}</Eq>
        <DataTable
          head={["Game", "Outcome space", "Worst-case payout"]}
          rows={[
            ["Roulette", "seed mod 37", "36× (straight)"],
            ["Crash", "10⁶ / (seed mod 10⁴ + 1)", "config maxMultiplier"],
            ["Slots", "3 independent reels", "100× (triple 7s)"],
            ["Coinflip / Wheel / Plinko", "seed mod n → table", "per-table max"],
            ["Mines / Boxes / Range", "seed → shuffled positions", "per-config max"],
          ]}
        />
      </Section>

      <Section id="solvency" title="6 · Pool, Payout & Solvency Mathematics" eyebrow="The house is the pool">
        <P>
          The pool-backed model means the house is the liquidity pool, and the protocol's central invariant is that a
          game can never promise more than it can pay. Before a bet is locked, the contract computes the maximum
          possible payout for that bet and rejects it unless every solvency and limit condition holds simultaneously.
        </P>
        <Eq n="6">① amount ≥ minBet   ② amount ≤ maxBetPoolRatio × pool⁄10⁴   ③ maxPayout ≤ maxWinBps × pool⁄10⁴   ④ poolBalance ≥ payout</Eq>
        <P>
          RTP (return to player) is expressed in basis points and applied to winning payouts, so the house edge is
          1 − RTP. <code className="font-mono text-emerald-200/90">maxBetPoolRatio</code> caps a single bet as a fraction of
          the pool, and <code className="font-mono text-emerald-200/90">maxWinBasisPoints</code> caps the worst-case payout
          as a fraction of the pool — together they bound both variance and the reward of any block-hash manipulation
          attempt.
        </P>
        <P>
          For multi-position bets the contract validates the sum of all positions and the worst case in which every
          position wins simultaneously, and it caps the number of positions per call. This prevents a player from
          splitting one oversized bet into many small ones to bypass the per-bet limits.
        </P>
        <StatGrid stats={[
          { k: "Max fee", v: "25%", sub: "hard cap" },
          { k: "RTP range", v: "0–100%", sub: "basis points" },
          { k: "Multi-bet", v: "≤10", sub: "positions/call" },
          { k: "Accounting", v: "Explicit", sub: "poolBalance state" },
        ]} />
      </Section>

      <Section id="staking" title="7 · Liquidity Staking & Fee Distribution" eyebrow="Be the house">
        <P>
          Anyone can stake tokens into a game's pool to become a liquidity provider. Stakers collectively are the
          counterparty to players: when players lose, the pool grows and stakers gain; when players win, the pool
          shrinks and stakers bear the loss. In addition, every bet pays a fee that is distributed to stakers.
        </P>
        <P>
          Fee distribution uses the battle-tested Synthetix reward-per-share accumulator. Each fee increments a global
          accumulator scaled by <code className="font-mono text-emerald-200/90">1e18</code>; each staker's paid-snapshot
          ensures they only earn fees generated after they staked. This makes accounting O(1) per action and immune to
          retroactive-reward gaming.
        </P>
        <Eq n="7">rewardPerShare += fee × 10¹⁸⁄totalShares   ·   earned = shares × (rewardPerShare − paid)⁄10¹⁸   ·   shares = amount × totalShares⁄poolBalance</Eq>
        <P>
          Share minting rounds down, which favours existing stakers and blocks rounding-profit attacks. Unstaking
          returns a proportional slice of the current pool, so a staker's realised return reflects the pool's net
          performance since they entered. All staking functions carry an
          <code className="font-mono text-emerald-200/90"> updateRewards</code> modifier that snapshots pending rewards
          before any state change.
        </P>
        <Callout variant="blood" title="Risk cuts both ways">
          Being the house is not free money — a hot streak of player wins shrinks the pool and your stake with it. The
          per-game max-win and max-bet caps bound that risk, but they do not remove it. Stake only what you can afford
          to expose.
        </Callout>
      </Section>

      <Section id="sequencer" title="8 · The Robinhood Chain & the Sequencer Assumption" eyebrow="Stated plainly">
        <P>
          EL-Casino runs natively on the {CHAIN.name} (chain {CHAIN.id}), an EVM L2 whose blocks are produced by a
          centralised sequencer. This is the one materially different trust assumption in the protocol and we state it
          plainly: the operator that orders and produces blocks also determines the block hashes that seed
          commit-reveal randomness. We do not hide this behind marketing — we bound it, disclose it, and price it into
          the protocol's hard limits.
        </P>
        <Callout variant="green" title="How the sequencer risk is bounded">
          <ul className="space-y-1.5">
            <li><b className="text-bone-100">Payout caps.</b> <code className="font-mono">maxWinBasisPoints</code> strictly bounds the maximum reward from any manipulated outcome — influence over a block hash is never worth more than a capped fraction of one pool.</li>
            <li><b className="text-bone-100">Extra reveal block.</b> Games wait one extra block before reveal (<code className="font-mono">revealExtraBlocks = 1</code>), widening the gap between commit and the settling hash and reducing any ability to correlate an ordered bet with a chosen hash.</li>
            <li><b className="text-bone-100">Commit-before-hash.</b> The commit locks the bet irrevocably before the seeding hash exists; the sequencer cannot insert or re-order a bet after seeing the hash, only choose among hashes — a far weaker capability the payout cap already prices in.</li>
            <li><b className="text-bone-100">Permissionless reveal.</b> Commit and reveal are separate transactions and reveal is open to anyone, so the sequencer cannot profit by withholding a user's reveal.</li>
          </ul>
        </Callout>
        <H3>The block-number quirk</H3>
        <P>
          The {CHAIN.name} exposes a subtle engineering hazard: the EVM
          <code className="font-mono text-emerald-200/90"> block.number</code> opcode is decoupled from the RPC
          <code className="font-mono text-emerald-200/90"> eth_blockNumber</code> value, and the two clocks do not advance
          in lockstep. Contracts record and gate on the opcode value, while wallets and libraries report the RPC value.
          A naïve block-age calculation therefore goes badly negative and breaks reveal timing. EL-Casino reads the
          true opcode value through a state-override <code className="font-mono text-emerald-200/90">eth_call</code> so that
          all block-age logic operates in a single, correct clock. This is a chain-integration detail, not a contract
          vulnerability.
        </P>
        <Code title="Reading the true opcode block.number">{`// EVM opcode NUMBER != RPC eth_blockNumber on ${CHAIN.name} (${CHAIN.id}).
// Read the opcode via an eth_call state-override so block-age math is correct:
//   runtime = 0x4360005260206000f3  (NUMBER; PUSH1 0; MSTORE; PUSH1 32; PUSH1 0; RETURN)
const trueBlock = await client.call({ to: probe, stateOverride: [...] });`}</Code>
        <Callout variant="amber" title="Investor disclosure">
          Users and liquidity providers should understand that every game carries this sequencer trust assumption. It
          is a deliberate, disclosed trade-off of building on a fast L2 — not a hidden one — and it is bounded by the
          same hard payout caps that protect every pool.
        </Callout>
      </Section>

      <Section id="security" title="9 · Security Model" eyebrow="Defence in depth">
        <P>
          The protocol is built on defence-in-depth: independent safety layers so that no single failure is
          catastrophic. Every state-changing external function is protected by a reentrancy guard, every token movement
          uses OpenZeppelin SafeERC20, and Solidity 0.8's checked arithmetic removes overflow and underflow classes
          entirely.
        </P>
        <DataTable
          head={["Attack vector", "Mitigation"]}
          rows={[
            ["Double-reveal / replay", "A settled flag makes any bet settle exactly once; duplicate reveals revert."],
            ["Cross-player / cross-block mixing", "Multi-reveal requires all bets share one player and one commit block."],
            ["Reveal front-running", "Anyone may reveal, but payout is hard-bound to the original bettor; a front-runner only pays gas."],
            ["Stale-bet manipulation", "After 256 unsnapshotted blocks only forfeit (forced loss) is possible; waiting is never profitable."],
            ["Pool drain", "Worst-case payout, bet caps, win caps and a live solvency check are enforced before locking a bet."],
          ]}
        />
        <H3>Owner trust model</H3>
        <P>
          Each game has an owner who can tune configuration within hard bounds (maximum 25% fee, RTP within 0–100%),
          pause new bets, and emergency-withdraw only their own stake. Owners cannot alter outcomes, cannot touch other
          stakers' funds, and cannot trap pending bets — reveal, unstake, claim and forfeit remain callable even while
          paused. Players and LPs choose which games to join knowing the owner address.
        </P>
        <Callout variant="blue" title="Standards coverage">
          The contracts are checked against the OWASP Smart Contract Top 10 — reentrancy (guarded), arithmetic (0.8
          checked), unchecked returns (SafeERC20), access control (owner-bounded), front-running (commit-reveal),
          denial-of-service (bounded loops and pagination), randomness (commit-reveal + SHA-256), flash loans
          (cross-block commit-reveal), and tx.origin (never used). An internal security review accompanies this paper;
          the architecture is prepared for formal third-party audit — minimal trust surface, no upgradeable proxies in
          the game path, and full event coverage for every state change.
        </Callout>
      </Section>

      <Section id="economics" title={`10 · Protocol Economics — $${TOKEN_SYMBOL}`} eyebrow="The flywheel">
        <P>
          Value in the protocol flows along three rails. A per-bet fee is split between the game's liquidity stakers
          and the protocol treasury; a creator earns a share of activity on the game they launched; and, where a deploy
          fee applies, a one-time cost routes to the treasury at deployment. All splits are enforced on-chain and
          visible in events.
        </P>
        <P>
          <b className="text-bone-100">${TOKEN_SYMBOL}</b> is a flat, fixed-supply platform token — no rebase, no decay.
          Protocol fees gathered by the collector are used to <b className="text-bone-100">buy back ${TOKEN_SYMBOL} and
          burn it</b>, permanently removing it from circulation. This is the flywheel: casino activity generates fees,
          fees buy back ${TOKEN_SYMBOL}, and the buyback is burned — aligning long-term holders with total protocol
          activity. Because every fee, split and payout emits an indexed event, the entire economy is measurable from
          chain data alone.
        </P>
        <Figure caption="The ELCAS flywheel — casino fees buy back and burn the token">
          <svg viewBox="0 0 640 120" className="w-full h-auto" fill="none">
            {[
              { x: 20, c: "#34d399", t: "casino fees ($)" },
              { x: 190, c: "#fbbf24", t: `buy back $${TOKEN_SYMBOL}` },
              { x: 360, c: "#cd202a", t: `burn $${TOKEN_SYMBOL}` },
              { x: 520, c: "#b4ff2e", t: "supply ↓ · value ↑" },
            ].map((s, i) => (
              <g key={i}>
                <rect x={s.x} y="40" width="120" height="44" rx="10" fill="#12161d" stroke={s.c} strokeWidth="1.4" />
                <text x={s.x + 60} y="66" textAnchor="middle" fill={s.c} fontSize="11" fontWeight="700" fontFamily="monospace">{s.t}</text>
                {i < 3 && <path d={`M${s.x + 120} 62 L${s.x + 170} 62`} stroke="#6b7f96" strokeWidth="1.5" markerEnd="url(#wpf)" />}
              </g>
            ))}
            <defs><marker id="wpf" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#6b7f96" /></marker></defs>
          </svg>
        </Figure>
        <Pills items={["Fixed supply", "Buyback & burn", "No decay", "On-chain fee rails", "Live flywheel analytics"]} />
      </Section>

      <Section id="data" title="11 · Traction & Verifiable Data" eyebrow="Don't trust — verify">
        <P>
          The protocol is measured, not marketed. Every bet, fee split, stake, launch and burn emits an indexed
          on-chain event, so the entire economy can be reconstructed by anyone from public chain data — no privileged
          dashboard and no self-reported figure. The core contracts below are the anchor for any due-diligence; all are
          verifiable on the {CHAIN.name} explorer.
        </P>
        <div className="my-5 overflow-x-auto rounded-xl border border-ink-700/70 scrollbar-hide">
          <table className="w-full min-w-[420px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-ink-850/70">
                <th className="border-b border-ink-700 px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-bone-400">Contract</th>
                <th className="border-b border-ink-700 px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-bone-400">Address ({CHAIN.name} · {CHAIN.id})</th>
              </tr>
            </thead>
            <tbody>
              {ADDRESSES.map(([label, addr]) => (
                <tr key={label} className="hover:bg-bone-50/[0.02]">
                  <td className="border-b border-ink-800 px-3.5 py-2.5 align-top text-bone-300 whitespace-nowrap">{label}</td>
                  <td className="border-b border-ink-800 px-3.5 py-2.5 align-top">
                    <span className="inline-flex items-center gap-2 font-mono text-[11.5px]">
                      <a href={`${CHAIN.explorer}/address/${addr}`} target="_blank" rel="noreferrer" className="text-bone-400 hover:text-emerald-300">{short(addr)}</a>
                      <CopyButton value={addr} title={`Copy ${label} address`} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout variant="green" title="Code is the disclosure">
          Because the settlement path holds no admin keys over outcomes or user funds, these addresses are sufficient
          for a full independent audit of what the protocol can and cannot do. See total value locked and live markets
          on public trackers, and the full activity history on the built-in analytics surface.
        </Callout>
      </Section>

      <Section id="trust" title="12 · Trust Model & Governance" eyebrow="Minimise, don't govern">
        <P>
          The protocol minimises trust rather than relying on governance. Core game logic is immutable once deployed —
          there is no upgrade path that could change the rules under a live pool. What remains configurable is bounded
          by contract-enforced limits, so the space of owner actions is small and its worst case is provable.
        </P>
        <P>
          This yields a clear separation of concerns: code guarantees fairness and solvency; owners tune commercial
          parameters within safe bounds; and the market decides which games earn liquidity and volume. Nothing in the
          settlement path depends on a promise, a company, or the continued operation of any server.
        </P>
      </Section>

      <Section id="conclusion" title="13 · Conclusion">
        <P>
          EL-Casino demonstrates that a casino can be simultaneously permissionless, provably fair, and
          solvent-by-construction without any oracle in the settlement path or any custodian of funds. Commit-reveal
          randomness delivers verifiable outcomes; isolated pools contain risk; a Synthetix-style staking economy
          aligns creators, liquidity providers and players; and the ${TOKEN_SYMBOL} buyback-and-burn flywheel ties the
          token to real protocol activity.
        </P>
        <P>
          The design is honest about its one material trust assumption — the {CHAIN.name}'s centralised sequencer — and
          bounds it with hard payout caps, an extra reveal block, and permissionless settlement. The result is an
          economy whose fairness anyone can verify and whose risks anyone can read directly from the chain.
        </P>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/casino" className="btn-primary px-5 py-3 text-sm">Enter the casino →</Link>
          <Link to="/casino?view=analytics" className="btn-ghost px-5 py-3 text-sm">See live analytics</Link>
        </div>
      </Section>
    </PaperFrame>
  );
}
