# ArbiFlow Agentic Settlement

Agent-assisted invoice escrow, delivery evidence, and payment settlement for Arbitrum.

ArbiFlow lets a merchant, freelancer, or autonomous service agent create an on-chain invoice, lets a payer fund it into escrow, and guides both sides through release, refund request, delivery evidence, timeout refund, and negotiated partial settlement paths. The agent panel reads the live contract state and only recommends actions that match the contract state machine.

## Hackathon Fit

- Event: Arbitrum Open House London: Online Buildathon
- Chain target: Arbitrum Sepolia
- Optional reserved-prize target: Robinhood Chain Testnet
- Prize fit: Overall prize and Best Agentic Project
- Core contract: `InvoiceEscrow`
- Agent model: deterministic, state-aware, wallet-confirmed actions with optional room for LLM-generated explanations

The official HackQuest page states that projects must be deployed on an Arbitrum chain to qualify. Arbitrum Sepolia is used to keep the expected deployment cost at `0 USD`.

## Repository Structure

```text
contracts/   Solidity contract, Hardhat tests, Arbitrum Sepolia deploy script
app/         Next.js TypeScript frontend with wagmi and viem
docs/        Architecture, deployment notes, security notes, submission draft
```

## Quick Start

```bash
pnpm install
pnpm contracts:test     # 74 passing, 100% coverage on the production contract
pnpm build              # Next.js production build
```

## See It Working In 30 Seconds (no wallet, no key, no testnet ETH)

```bash
pnpm contracts:demo
```

This deploys `InvoiceEscrow` to an in-process chain and seeds six invoices spanning
every lifecycle state — Created, Created+agent-mandate+SLA, Paid+delivery-evidence,
Released+agent-feedback, Refunded, and an accepted negotiated split Settlement. To
explore the same data in the UI, run a persistent local chain and point the app at it:

```bash
pnpm --filter @arbiflow/contracts exec hardhat node   # terminal 1
pnpm contracts:demo:node                               # terminal 2 (deploy + seed)
pnpm dev                                                # connect wallet to Hardhat (chainId 31337)
```

After an Arbitrum Sepolia deployment, run the glass-box live demo:

```bash
pnpm contracts:live-demo:arbitrum-sepolia
```

It prints each transaction hash and Arbiscan URL for create, mandate, bond, pay, delivery, release, feedback, and validation. The frontend also includes `/activity` for live counters and recent contract logs, `/.well-known/agent.json` for agent discovery, `/api/mcp` for MCP-style tools, `/api/agent/explain` and `/api/agent/simulate` for agent reasoning, and `/api/receipt/:invoiceId` for structured settlement receipts.

## What Makes It Strong

- Trust-minimized escrow for real commercial invoices.
- On-chain delivery evidence for off-chain work handoff.
- Append-only delivery and dispute evidence roots for two-sided audit trails.
- Counterparty-approved partial settlements for disputes without a centralized arbitrator.
- AP2-style intent, cart, payment, and prompt-playback mandate hashes.
- Hashed agent mandates, policy hashes, SLA deadline, and portable settlement receipt hashes.
- Post-settlement agent feedback roots for ERC-8004-style reputation pipelines.
- Receipt-bound validator attestation roots with TEE attestation hash support for ERC-8004-style validation pipelines.
- EIP-712 signed payer mandates that bind authorization to the exact invoice payment requirement.
- EIP-712 action permits that let a payer or recipient delegate one exact invoice action to a bounded executor with expiry, nonce, and exact parameter hash.
- HTTP `402` payment requirements for API/agent facilitators, with x402 exact-scheme metadata and EIP-3009 `receiveWithAuthorization` escrow funding for compatible ERC20s.
- Arbitrum Sepolia USDC preset in the dashboard, backed by Circle test USDC config.
- Cross-invoice agent reputation summaries updated from receipt-bound feedback and validator attestations.
- Structured receipt, MCP-style, agent explain, and agent simulate APIs for autonomous agents.
- Optional provider service bonds that return on clean settlement and can be slashed for missed SLA without timely delivery evidence.
- Timeout paths for inactive counterparties.
- ETH and ERC20 support.
- Agent panel that reads live contract state, wallet role, timing windows, evidence, and settlement proposals.
- Contract tests for success, failure, authorization, signed mandates, scoped action permits, EIP-3009 funding, evidence roots, dispute evidence, feedback roots, validator attestation roots, reputation aggregates, timeout, service bond, fee-on-transfer rejection, split-settlement paths, and protocol solvency across active escrows, bonds, and credited payouts.

## Local Contract Workflow

```bash
pnpm --filter @arbiflow/contracts compile
pnpm --filter @arbiflow/contracts test
```

## Arbitrum Sepolia Deployment

Current live deployment:

- Contract: `InvoiceEscrow`
- Address: `0x7D0893625B9f8F0d5B84531393B84dE5624bAa78`
- Explorer: https://sepolia.arbiscan.io/address/0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
- Deployment tx: https://sepolia.arbiscan.io/tx/0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650
- On-chain proof: `docs/ONCHAIN.md`

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

```text
PRIVATE_KEY=0x...
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Use a fresh testnet-only wallet. Do not use a wallet containing real funds.

Deploy:

```bash
pnpm contracts:deploy:arbitrum-sepolia
# optional reserved-prize target
pnpm contracts:deploy:robinhood-testnet
pnpm contracts:rwa-demo:robinhood-testnet
```

After deployment, put the deployed address into `.env`:

```text
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
```

Then build or run the frontend:

```bash
pnpm dev
```

## Frontend

```bash
pnpm --filter @arbiflow/app dev
```

Open `http://localhost:3000`, connect a wallet on Arbitrum Sepolia, and paste the deployed contract address if it is not already set through `NEXT_PUBLIC_ESCROW_ADDRESS`.

Open `http://localhost:3000/activity` for live invoice counters, finalized-state counts, and recent event links.

## Submission Assets

- Deployment doc: [docs/deployment.md](docs/deployment.md)
- Architecture doc: [docs/architecture.md](docs/architecture.md)
- Security notes: [docs/security.md](docs/security.md)
- HackQuest draft: [docs/submission.md](docs/submission.md)
- 60-second pitch: [docs/PITCH.md](docs/PITCH.md)
- Problem validation: [docs/WHY.md](docs/WHY.md)
- Competitive comparison: [docs/COMPARISON.md](docs/COMPARISON.md)
- On-chain proof checklist: [docs/ONCHAIN.md](docs/ONCHAIN.md)
- Human-only finish checklist: [docs/HUMAN_FINISH_STEPS.md](docs/HUMAN_FINISH_STEPS.md)
- Judge demo script: [docs/demo-script.md](docs/demo-script.md)
- Research notes: [docs/research-notes.md](docs/research-notes.md)

## No-Video Constraint

No mandatory video requirement was visible in the scraped public HackQuest page. If the final form unexpectedly requires a video URL, stop and ask before producing any video-related material.
