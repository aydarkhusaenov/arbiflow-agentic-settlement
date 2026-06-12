# Deployment

## Targets

- Primary chain: Arbitrum Sepolia
- Primary chain ID: `421614`
- Primary RPC: Alchemy Arbitrum Sepolia HTTPS endpoint
  (`https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY`)
- Primary explorer: `https://sepolia.arbiscan.io`
- Optional reserved-prize chain: Robinhood Chain Testnet
- Robinhood chain ID: `46630`
- Robinhood RPC: `https://rpc.testnet.chain.robinhood.com`
- Robinhood explorer: `https://explorer.testnet.chain.robinhood.com`
- Contract: `InvoiceEscrow`

## Required Inputs

- Fresh testnet-only private key funded with Arbitrum Sepolia ETH.
- Alchemy Arbitrum Sepolia app HTTPS RPC URL.
- Optional: same fresh key funded with Robinhood Chain testnet ETH for the reserved-prize deployment.
- Optional Arbiscan API key for source verification.

Do not use a real-money wallet.

## One-Command Deploy

From the repo root:

```bash
cp .env.example .env        # then set Alchemy RPC, PRIVATE_KEY, and optional ARBISCAN_API_KEY
pnpm install
pnpm contracts:test
pnpm contracts:deploy:arbitrum-sepolia
```

Optional Robinhood Chain deployment:

```bash
pnpm contracts:deploy:robinhood-testnet
```

`deploy.js` checks the deployer balance, deploys `InvoiceEscrow`, and automatically:

- writes a machine-readable record to `contracts/deployments/<network>.json`,
- updates the **Live Deployment Record** section below (address, tx, block, explorer links),
- prints the exact `NEXT_PUBLIC_ESCROW_ADDRESS` line and the verify command.

## Populate Demo Data (optional but recommended)

After deploy, seed the contract so the dashboard is populated for judges:

```bash
pnpm contracts:seed:arbitrum-sepolia
# optional reserved-prize target
pnpm contracts:seed:robinhood-testnet
```

Optional Robinhood tokenized-stock RWA demo after claiming faucet stock tokens:

```bash
pnpm contracts:rwa-demo:robinhood-testnet
```

The RWA script checks the deployer wallet's TSLA/AMZN faucet-token balances,
creates tokenized-stock invoices, approves the escrow, and funds them. It skips a
stock if the wallet has no faucet balance.

The seed reads the address from `contracts/deployments/arbitrumSepolia.json` (or
`NEXT_PUBLIC_ESCROW_ADDRESS`). With a single funded key it creates invoices spanning
Created, Paid (with delivery evidence), Released (with agent feedback), and Refunded,
plus an open negotiated-settlement proposal. Override the amount with
`SEED_AMOUNT_ETH` (default `0.0002`).

## Zero-Setup Local Demo (no key, no testnet ETH)

```bash
pnpm contracts:demo          # deploy + seed an in-process chain, full lifecycle
# or, to explore in the UI against a persistent local chain:
pnpm --filter @arbiflow/contracts exec hardhat node   # terminal 1
pnpm contracts:demo:node                               # terminal 2
pnpm dev                                                # connect wallet to Hardhat (31337)
```

## Optional Source Verification

After setting `ARBISCAN_API_KEY` in `.env`:

```bash
pnpm --filter @arbiflow/contracts verify:arbitrum-sepolia 0xDEPLOYED_CONTRACT_ADDRESS
# optional, if the Robinhood explorer API accepts verification from Hardhat:
pnpm --filter @arbiflow/contracts verify:robinhood-testnet 0xDEPLOYED_CONTRACT_ADDRESS
```

## Frontend Environment

```text
NEXT_PUBLIC_CHAIN_ID=421614  # or 46630 for Robinhood Chain Testnet
NEXT_PUBLIC_ESCROW_ADDRESS=<address from the record below>
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

The dashboard also has an address field, so the deployed address can be entered at
runtime without rebuilding.
The USDC address above is Circle test USDC on Arbitrum Sepolia and powers the
dashboard's one-click USDC invoice preset.
On Robinhood Chain Testnet, the dashboard also includes tokenized-stock presets
from Robinhood's faucet token list:

- TSLA: `0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E`
- AMZN: `0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02`

For production USDC funding, use Circle CCTP to bring native USDC to Arbitrum
before creating or paying stablecoin invoices. For this buildathon demo, the
Circle faucet is enough.

## Live Deployment Record

<!-- DEPLOYMENT:BEGIN -->

- Status: **Deployed**
- Network: `arbitrumSepolia` (chainId `421614`)
- Contract address: `0x7D0893625B9f8F0d5B84531393B84dE5624bAa78`
- Deployment transaction: `0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650`
- Block number: `276251714`
- Deployer: `0x28C06E3fe7ED2D15fb8901Df9D48c895E18Ed590`
- Explorer (address): https://sepolia.arbiscan.io/address/0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
- Explorer (tx): https://sepolia.arbiscan.io/tx/0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650
- Recorded at: 2026-06-11T22:49:06.000Z
- Note: deployment was broadcast as a raw signed transaction and recorded on Arbitrum Sepolia.

<!-- DEPLOYMENT:END -->

## Faucet Links

- Alchemy Arbitrum Sepolia ETH faucet: https://www.alchemy.com/faucets/arbitrum-sepolia
- Arbitrum Sepolia ETH fallback: https://arbitrum.faucet.dev/
- Robinhood Chain faucet: https://faucet.testnet.chain.robinhood.com/
- Robinhood Chain docs: https://docs.robinhood.com/chain/
- Circle test USDC faucet: https://faucet.circle.com/
- Circle CCTP: https://www.circle.com/cross-chain-transfer-protocol
