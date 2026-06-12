# Operator Checklist

This checklist records the reproducible deployment and submission flow for ArbiFlow. It is written for project operation and judging transparency.

Run commands from the repo root:

```bash
cd /home/legat/work/hackaton/Arbitrum-Open-House-London-Online-Buildathon
```

## Current Public Deployment

- Network: Arbitrum Sepolia
- Chain ID: `421614`
- Contract: `InvoiceEscrow`
- Address: `0x7D0893625B9f8F0d5B84531393B84dE5624bAa78`
- Explorer: https://sepolia.arbiscan.io/address/0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
- Deployment tx: https://sepolia.arbiscan.io/tx/0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650
- Public repo: https://github.com/aydarkhusaenov/arbiflow-agentic-settlement

## Required Inputs For Reproduction

- A fresh testnet-only wallet funded with Arbitrum Sepolia ETH.
- Alchemy Arbitrum Sepolia HTTPS RPC URL.
- Optional Arbiscan API key for source verification.
- Optional Robinhood Chain testnet ETH and faucet tokenized-stock assets for the RWA track.

No mainnet wallet, private key, mnemonic, `.env`, or faucet-only secret belongs in GitHub, HackQuest, screenshots, or public demo material.

## Environment

Create the local env file:

```bash
cp .env.example .env
chmod 600 .env
```

Arbitrum Sepolia values:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=0xTESTNET_ONLY_PRIVATE_KEY
ARBISCAN_API_KEY=OPTIONAL_ARBISCAN_API_KEY

NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ESCROW_ADDRESS=0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Optional Robinhood Chain values:

```bash
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
ROBINHOOD_EXPLORER_API_KEY=OPTIONAL_ROBINHOOD_EXPLORER_KEY
NEXT_PUBLIC_CHAIN_ID=46630
```

## Build Gate

```bash
pnpm install
pnpm test
pnpm contracts:coverage
pnpm audit --prod
```

Current verified status:

- `pnpm test`: 74 contract tests plus Next.js production build pass.
- `pnpm contracts:coverage`: 100% statements, branches, functions, and lines on `InvoiceEscrow.sol`.
- `pnpm audit --prod`: no known production vulnerabilities.
- Slither medium/high scan: 0 findings.

## Deploy And Seed

Arbitrum Sepolia:

```bash
pnpm contracts:deploy:arbitrum-sepolia
pnpm contracts:seed:arbitrum-sepolia
pnpm contracts:live-demo:arbitrum-sepolia
```

Optional source verification after setting `ARBISCAN_API_KEY`:

```bash
pnpm --filter @arbiflow/contracts verify:arbitrum-sepolia 0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
```

Optional Robinhood Chain RWA path:

```bash
pnpm contracts:deploy:robinhood-testnet
pnpm contracts:seed:robinhood-testnet
pnpm contracts:live-demo:robinhood-testnet
pnpm contracts:rwa-demo:robinhood-testnet
```

The Robinhood RWA script creates and funds TSLA/AMZN tokenized-stock invoices when the deploying wallet holds the faucet assets.

## Frontend

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

The dashboard reads `NEXT_PUBLIC_ESCROW_ADDRESS`, and also supports entering a contract address at runtime. The activity page is available at:

```text
http://localhost:3000/activity
```

## Optional Hosted App

Vercel deployment is optional.

- Deploy entrypoint: https://vercel.com/new
- Framework: Next.js
- Root directory: `app`
- Build command: `pnpm build`
- Output directory: `.next`

Production environment variables:

```text
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ESCROW_ADDRESS=0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

Optional AI explanation variables:

```text
OPENAI_API_KEY=OPTIONAL_SERVER_SIDE_KEY
OPENAI_MODEL=gpt-4.1-mini
```

## Submission Links

- HackQuest listing: https://www.hackquest.io/hackathons/Arbitrum-Open-House-London-Online-Buildathon
- Direct buildathon page: https://arbitrum-london.hackquest.io/buildathons/Arbitrum-Open-House-London-Online-Buildathon
- Public program dates shown on the listing: May 25-June 14, 2026

Submission package:

- Public GitHub repo URL.
- Arbitrum Sepolia contract address and explorer URL.
- Deployment transaction link.
- On-chain demo proof from `docs/ONCHAIN.md`.
- Source verification status, if Arbiscan verification is completed.
- Hosted app URL, if Vercel or another frontend host is used.
- Screenshots or demo notes required by the final HackQuest form.

Form text:

- Idea: `ArbiFlow: an Arbitrum agentic invoice escrow for AI/service agents with x402 payments, AP2-style mandate proofs, ERC-8004 reputation hooks, TEE validation hashes, service bonds, dispute evidence, and portable settlement receipts.`
- Project URL: `https://github.com/aydarkhusaenov/arbiflow-agentic-settlement`
- Arbitrum One wallet address field: `0x28C06E3fe7ED2D15fb8901Df9D48c895E18Ed590`
