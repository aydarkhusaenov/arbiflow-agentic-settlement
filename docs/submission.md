# HackQuest Submission Draft

## Project Title

ArbiFlow Agentic Settlement

## Tagline

Agent-guided escrow, delivery evidence, and negotiated settlement rails for Arbitrum commerce.

## Short Description

ArbiFlow is an Arbitrum Sepolia settlement app for freelancers, merchants, agencies, APIs, and autonomous service agents. A seller creates an invoice, a payer funds it into escrow, and both sides can move through release, refund request, delivery evidence, timeout refund, and counterparty-approved partial settlement. Each invoice can also carry hashed agent identity references, a user mandate hash, a policy hash, an SLA deadline, and a portable settlement receipt hash. The agent panel reads live contract state and recommends only safe next actions for the connected wallet.

## Problem

Small businesses, freelancers, and AI-powered service providers increasingly sell work outside centralized marketplaces. They need payment assurance, delivery proof, refund handling, and dispute settlement without giving a platform custody over funds. Simple crypto transfers do not solve that: they have no invoice state, no delivery trail, no refund window, and no guided next step for non-expert users.

## Solution

ArbiFlow turns a payment into a transparent on-chain settlement workflow. Funds are held in escrow, delivery evidence can be attached, either side can propose a partial split settlement, and only the counterparty can accept that split. The agent reads the live contract state, wallet role, timing windows, evidence, and proposal data, then explains the exact wallet-confirmed actions available.

The result is not a generic escrow demo. It is a compact settlement desk for real commercial workflows: encode agent mandate, pay, prove delivery, release, request refund, negotiate a split, accept settlement, emit a receipt, or rely on timeout protection if a counterparty disappears.

## Research-Informed Differentiator

Current agentic payment standards are moving quickly:

- x402 is strong for HTTP-native instant machine payments.
- ERC-8004 focuses on agent identity, reputation, and validation registries.
- AP2 focuses on cryptographic payment mandates and auditable proof of user intent.

ArbiFlow’s differentiator is the missing commercial settlement layer between these ideas: escrowed agent commerce with delivery evidence, counterparty-approved split settlement, SLA context, and portable receipt hashes that can later feed reputation/validation systems.

## Why Arbitrum

Arbitrum provides low-cost EVM execution and mature Solidity tooling, which is well suited for frequent payment, evidence, and settlement actions. The buildathon deployment target is Arbitrum Sepolia, with a clear path to Arbitrum One for production.

## Agentic Feature

The agent reads the deployed contract state, connected wallet role, invoice timing, delivery evidence, refund window, settlement proposal, mandate hash, policy hash, SLA deadline, and portable receipt hash. It recommends whether the wallet can pay, cancel, attach mandate, release, request a refund, attach delivery evidence, propose a split, accept a counterparty proposal, approve a refund, or wait for timeout.

The agent is deliberately safe: it does not sign transactions, custody funds, or invent authorization. The smart contract enforces the state machine. The agent makes the workflow understandable and reduces user error.

## Judging Criteria Mapping

Smart contract quality:

- Explicit invoice state machine.
- Reentrancy protection.
- OpenZeppelin `SafeERC20`.
- Custom errors.
- No admin withdrawal path.
- Counterparty-approved settlement split.
- Portable receipt hash over final settlement context.
- Tests for success, failure, timeout, authorization, ETH, ERC20, mandate, receipt, and split-settlement paths.

Product-market fit:

- Freelancers, agencies, merchants, AI agents, and clients need escrow-backed invoice settlement.
- Low Arbitrum fees make small commercial workflows practical.
- Delivery evidence plus negotiated settlement maps to real service work better than a simple transfer.
- Hashed mandates and receipts map to AI-agent commerce where spending authorization and accountability matter.

Innovation and creativity:

- Combines escrow payments, delivery proof, refund windows, and partial compromise settlements.
- Agent recommendations are based on live contract state, not generic help text.
- Bridges agent mandates, identity references, SLA context, and settlement receipts without requiring an external registry.
- No centralized arbitrator is required for negotiated settlement.

Real problem solving:

- Reduces payment uncertainty and manual reconciliation.
- Gives both sides transparent release, refund, evidence, and settlement paths.
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
