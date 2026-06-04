# HackQuest Submission Draft

## Project Title

ArbiFlow Agentic Escrow

## Tagline

Agent-assisted invoice escrow and payment settlement deployed on Arbitrum.

## Short Description

ArbiFlow is an Arbitrum Sepolia escrow app for freelancers, merchants, and clients. A merchant creates an invoice, a payer funds it into escrow, and both sides can move through release, refund request, timeout refund, and cancellation flows. The agent panel reads live contract state and recommends only safe next actions for the connected wallet.

## Problem

Small businesses and freelancers need payment assurance without relying on centralized marketplaces or manual reconciliation. Simple crypto transfers do not provide structured invoice state, refund handling, or clear next steps for non-expert users.

## Solution

ArbiFlow turns a payment into a transparent on-chain invoice state machine. Funds are held in escrow, state transitions are explicit, and the frontend agent explains available wallet-confirmed actions. This makes payment settlement easier to verify and cheaper to run on Arbitrum.

## Why Arbitrum

Arbitrum provides low-cost EVM execution and mature Solidity tooling, which is well suited for frequent payment and escrow actions. The buildathon deployment target is Arbitrum Sepolia, with a clear path to Arbitrum One for production.

## Agentic Feature

The agent reads the deployed contract state, the connected wallet role, invoice timing, and current state. It recommends whether the wallet can pay, cancel, release, request a refund, approve a refund, or wait for timeout. It never bypasses wallet confirmation and never overrides contract authorization.

## Judging Criteria Mapping

Smart contract quality:

- Explicit invoice state machine.
- Reentrancy protection.
- OpenZeppelin `SafeERC20`.
- Custom errors.
- No admin withdrawal path.
- Tests for success and failure paths.

Product-market fit:

- Freelancers, agencies, merchants, and clients need escrow-backed invoice settlement.
- Low Arbitrum fees make smaller invoice workflows practical.

Innovation and creativity:

- Combines escrow payments with state-aware agent UX.
- Agent recommendations are based on live contract state, not generic help text.

Real problem solving:

- Reduces payment uncertainty.
- Gives both sides transparent release/refund paths.
- Keeps custody and authorization in the smart contract.

## Links To Fill

- GitHub repo: `TODO`
- Deployed frontend: `TODO`
- Arbitrum Sepolia contract address: `TODO`
- Explorer link: `TODO`
- Architecture docs: `TODO`
- README: `TODO`

## Deployment Details

- Chain: Arbitrum Sepolia
- Chain ID: `421614`
- Contract: `InvoiceEscrow`
- Address: `TODO`
- Deployment tx: `TODO`
- Verification: `TODO`

## No-Video Note

The scraped public HackQuest page did not show a mandatory video requirement. If the final HackQuest form has an optional video field, leave it blank. If it is mandatory, ask before making any video.
