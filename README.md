# ArbiFlow Agentic Escrow

Agent-assisted invoice escrow and payment settlement for Arbitrum.

ArbiFlow lets a merchant or freelancer create an on-chain invoice, lets a payer fund it into escrow, and guides both sides through release, refund request, timeout refund, and cancellation paths. The agent panel reads the live contract state and only recommends actions that match the contract state machine.

## Hackathon Fit

- Event: Arbitrum Open House London: Online Buildathon
- Chain target: Arbitrum Sepolia
- Prize fit: Overall prize and Best Agentic Project
- Core contract: `InvoiceEscrow`
- Agent model: deterministic, state-aware, wallet-confirmed actions

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
pnpm contracts:test
pnpm build
```

## Local Contract Workflow

```bash
pnpm --filter @arbiflow/contracts compile
pnpm --filter @arbiflow/contracts test
```

## Arbitrum Sepolia Deployment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

```text
PRIVATE_KEY=0x...
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_CHAIN_ID=421614
```

Use a fresh testnet-only wallet. Do not use a wallet containing real funds.

Deploy:

```bash
pnpm contracts:deploy:arbitrum-sepolia
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

## Submission Assets

- Deployment doc: [docs/deployment.md](docs/deployment.md)
- Architecture doc: [docs/architecture.md](docs/architecture.md)
- Security notes: [docs/security.md](docs/security.md)
- HackQuest draft: [docs/submission.md](docs/submission.md)

## No-Video Constraint

No mandatory video requirement was visible in the scraped public HackQuest page. If the final form unexpectedly requires a video URL, stop and ask before producing any video-related material.
