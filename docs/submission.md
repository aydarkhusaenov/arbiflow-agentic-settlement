# HackQuest Submission Draft

## Project Title

ArbiFlow Agentic Settlement

## Tagline

Agent-guided escrow, delivery evidence, and negotiated settlement rails for Arbitrum commerce.

## Short Description

ArbiFlow is an Arbitrum Sepolia settlement app for freelancers, merchants, agencies, APIs, and autonomous service agents. A seller creates an invoice, a payer funds it into escrow, and both sides can move through release, refund request, delivery evidence, dispute evidence, timeout refund, counterparty-approved partial settlement, optional provider service bonding, post-settlement agent feedback, and validator attestations. Each invoice can also carry hashed agent identity references, a user mandate hash, a policy hash, an SLA deadline, append-only evidence roots, an x402-style payment requirement hash, an EIP-712 signed payer mandate, scoped EIP-712 action permits, a portable settlement receipt hash, receipt-bound feedback roots, and receipt-bound validation roots. The agent panel reads live contract state and recommends only safe next actions for the connected wallet.

## Problem

Small businesses, freelancers, and AI-powered service providers increasingly sell work outside centralized marketplaces. They need payment assurance, delivery proof, refund handling, and dispute settlement without giving a platform custody over funds. Simple crypto transfers do not solve that: they have no invoice state, no delivery trail, no refund window, and no guided next step for non-expert users.

## Solution

ArbiFlow turns a payment into a transparent on-chain settlement workflow. Funds are held in escrow, delivery and dispute evidence append into separate audit roots, the provider can post an accountability bond, either side can propose a partial split settlement, and only the counterparty can accept that split. A payer can also sign an EIP-712 mandate bound to the exact invoice requirement before funding, so agent-led payment intent is replay-resistant and context-bound. After funding, either counterparty can sign a scoped action permit that lets a bounded executor perform one exact release, refund, evidence, or settlement action. The agent reads the live contract state, wallet role, timing windows, evidence, bond status, and proposal data, then explains the exact wallet-confirmed or signed-permit actions available.

The result is not a generic escrow demo. It is a compact settlement desk for real commercial workflows: encode agent mandate, post provider bond, pay, prove delivery, release, request refund, negotiate a split, accept settlement, emit a receipt, or rely on timeout protection if a counterparty disappears.

## Research-Informed Differentiator

Current agentic payment standards are moving quickly:

- x402 is strong for HTTP-native instant machine payments.
- ERC-8004 focuses on agent identity, reputation, and validation registries.
- AP2 focuses on cryptographic payment mandates and auditable proof of user intent.
- ERC-7715, EIP-7702, and ERC-4337 point toward scoped wallet permissions and account-abstraction execution for agents.

ArbiFlow’s differentiator is the missing commercial settlement layer between these ideas: escrowed agent commerce with x402-style payment requirement hashes, EIP-712 signed payer mandates, scoped action permits, append-only delivery and dispute evidence roots, provider-side service bonds, counterparty-approved split settlement, SLA context, portable receipt hashes, post-settlement feedback roots, and signed validator attestation roots that can later feed reputation/validation systems.

## Why Arbitrum

Arbitrum provides low-cost EVM execution and mature Solidity tooling, which is well suited for frequent payment, evidence, and settlement actions. The buildathon deployment target is Arbitrum Sepolia, with a clear path to Arbitrum One for production.

## Agentic Feature

The agent reads the deployed contract state, connected wallet role, invoice timing, delivery evidence, dispute evidence, refund window, service bond, settlement proposal, mandate hash, authorized payer, payment requirement hash, policy hash, SLA deadline, portable receipt hash, feedback root, and validation root. It recommends whether the wallet can pay, post a provider bond, cancel, attach mandate, sign a scoped action permit, execute a delegated action, release, request a refund, attach evidence, propose a split, cancel a stale split proposal, accept a counterparty proposal, approve a refund, submit post-settlement feedback, submit a validator attestation, or wait for timeout.

The agent is deliberately safe: it does not sign transactions, custody funds, or invent authorization. The smart contract enforces the state machine. The agent makes the workflow understandable and reduces user error.

## Judging Criteria Mapping

Smart contract quality:

- Explicit invoice state machine.
- Reentrancy protection.
- Checks-effects-interactions payout flow.
- OpenZeppelin `SafeERC20`.
- Exact ERC20 receive checks that reject fee-on-transfer underfunding.
- Custom errors.
- Immutable pre-payment agent mandates with future SLA validation.
- EIP-712 signed payment mandates with authorized payer lock and expiry.
- ERC-1271-compatible signature validation path for contract wallets.
- Scoped EIP-712 action permits with executor binding, expiry, valid-after window, per-signer nonce, and exact parameter hashing.
- x402-style payment requirement hash bound to invoice terms.
- Append-only delivery and dispute evidence roots.
- Receipt-bound post-settlement feedback roots.
- Receipt-bound validator attestation roots.
- No admin withdrawal path.
- Counterparty-approved settlement split.
- Proposer cancellation for stale split offers.
- Optional provider service bond with SLA/evidence-based slashing.
- Portable receipt hash over final settlement context.
- Tests for success, failure, timeout, authorization, ETH, ERC20, mandate, signed-mandate, action-permit, evidence-root, dispute, feedback, validator-attestation, receipt, service bond, fee-on-transfer rejection, and split-settlement paths.
- Production dependency audit currently reports no known vulnerabilities.
- Slither static analysis reports no reentrancy findings after hardening; remaining findings are expected timestamp deadline checks and checked ETH transfer calls.

Product-market fit:

- Freelancers, agencies, merchants, AI agents, and clients need escrow-backed invoice settlement.
- Low Arbitrum fees make small commercial workflows practical.
- Delivery evidence plus negotiated settlement maps to real service work better than a simple transfer.
- Hashed mandates and receipts map to AI-agent commerce where spending authorization and accountability matter.
- Provider service bonds give buyers more trust without adding a centralized marketplace.

Innovation and creativity:

- Combines escrow payments, delivery proof, refund windows, and partial compromise settlements.
- Gives both sides an evidence trail instead of letting the last submitted URI overwrite the record.
- Converts final outcomes into reputation-ready feedback without making the escrow contract a centralized reputation authority.
- Converts finalized receipts into validator-ready attestations without letting validators control funds.
- Agent recommendations are based on live contract state, not generic help text.
- Bridges agent mandates, identity references, SLA context, and settlement receipts without requiring an external registry.
- Bridges instant-payment style requirements to escrow settlement instead of pretending HTTP payment is enough for service delivery.
- Adds objective crypto-economic accountability for SLA misses without letting an LLM decide slashing.
- Adds scoped delegated execution for agents without private-key custody or broad wallet approval.
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
