# Why ArbiFlow

## Problem

Off-platform service work has three recurring failures:

- Buyers need proof that funds will not disappear before delivery.
- Providers need proof that buyers cannot disappear after delivery.
- Agents need a machine-checkable record of what was authorized, delivered, disputed, and settled.

Simple token transfers are not enough. They have no delivery state, no refund timeout, no evidence trail, no partial settlement, no service bond, and no receipt that can feed reputation.

## Why Now

Agentic commerce is moving from chat to wallets, APIs, and autonomous services. x402, AP2, ERC-8004, ERC-1271, account abstraction, and scoped wallet permissions all point in the same direction: agents need bounded authority and verifiable outcomes.

ArbiFlow focuses on the missing layer between "pay this API" and "trust this marketplace": escrowed settlement with mandates, evidence, service bonds, split settlement, and receipt-bound accountability.

## Why Arbitrum

The workflow needs multiple small state transitions: create invoice, attach mandate, fund, attach evidence, request refund, propose split, release, submit feedback, and validate. Arbitrum makes that workflow practical with low fees while keeping standard Solidity tooling and EVM wallet compatibility.

## Why This Is Strong For Judges

- Smart-contract quality: explicit state machine, no admin withdrawal, reentrancy protection, 100% measured production Solidity coverage, Slither medium/high clean.
- Product-market fit: maps directly to freelance, agency, merchant, API, and agent-service settlement.
- Innovation: signed mandates, scoped action permits, service bonds, receipt-bound feedback, validation roots, and x402-style payment requirements in one coherent settlement primitive.
- Real problem solving: turns payment into an enforceable workflow instead of a one-way transfer.

## Claims To Keep Honest

ArbiFlow is not a centralized arbitration court and does not prove the real-world truth of every off-chain file. It proves who authorized a payment, what evidence references were attached, which rules governed release/refund/settlement, where funds moved, and what receipt-bound feedback or validation was submitted.
