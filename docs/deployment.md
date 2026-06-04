# Deployment

## Target

- Chain: Arbitrum Sepolia
- Chain ID: `421614`
- RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`
- Contract: `InvoiceEscrow`

## Required User Inputs

- Fresh testnet-only private key with Arbitrum Sepolia ETH.
- Optional Arbiscan API key for source verification.

Do not use a real-money wallet.

## Commands

```bash
cp .env.example .env
pnpm install
pnpm contracts:test
pnpm contracts:deploy:arbitrum-sepolia
```

## Fill After Deploy

- Contract address: `TODO`
- Deployment transaction: `TODO`
- Explorer link: `TODO`
- Verification status: `TODO`

## Optional Source Verification

After setting `ARBISCAN_API_KEY` in `.env`:

```bash
pnpm --filter @arbiflow/contracts verify:arbitrum-sepolia 0xDEPLOYED_CONTRACT_ADDRESS
```

## Frontend Environment

```text
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ESCROW_ADDRESS=TODO
```

## Faucet Links

- Arbitrum Sepolia ETH: https://arbitrum.faucet.dev/
- QuickNode Arbitrum Sepolia faucet: https://faucet.quicknode.com/arbitrum/sepolia
- Circle test USDC faucet: https://faucet.circle.com/
