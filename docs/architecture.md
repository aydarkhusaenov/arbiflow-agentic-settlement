# Architecture

## Overview

ArbiFlow is a two-part application:

- `InvoiceEscrow`: a Solidity escrow state machine deployed on Arbitrum Sepolia.
- `app`: a Next.js wallet UI that reads contract state, executes wallet-confirmed actions, and renders deterministic agent recommendations.

## Contract State Machine

```text
Created
  | payInvoice
  v
Paid
  | release by payer
  | release by recipient after timeout
  v
Released

Paid
  | requestRefund by payer
  v
RefundRequested
  | refund by recipient
  | refund by payer after timeout
  v
Refunded

Paid or RefundRequested
  | proposeSettlement by payer or recipient
  | acceptSettlement by counterparty
  v
Settled

Created, Paid, or RefundRequested
  | attachAgentMandate by creator, recipient, or payer
  v
AgentContext attached

Created, Paid, or RefundRequested
  | postServiceBond by recipient
  v
Provider bond locked

Created
  | cancelUnpaid by creator or recipient
  v
Cancelled
```

## Invoice Fields

- `creator`: wallet that created the invoice.
- `payer`: wallet that funded the invoice.
- `recipient`: wallet that receives released funds.
- `token`: `address(0)` for ETH, ERC20 address for token invoices.
- `amount`: amount locked in escrow.
- `dueAt`: deadline for initial payment.
- `paidAt`: timestamp when escrow was funded.
- `timeout`: waiting period for recipient timeout release or payer timeout refund.
- `refundRequestedAt`: timestamp when refund flow opened.
- `settlementProposedAt`: timestamp when a compromise split was proposed.
- `state`: explicit invoice state.
- `metadataHash`: off-chain invoice metadata reference.
- `deliveryHash`: off-chain delivery/evidence reference.
- `settlementMemoHash`: off-chain settlement reasoning reference.
- `settlementProposedBy`: payer or recipient that proposed the split.
- `settlementRecipientAmount`: amount paid to recipient if counterparty accepts settlement.
- `serviceBondAmount`: active provider bond locked in the invoice token.
- `resolvedBondAmount`: bond amount resolved at final settlement.
- `resolvedBondRecipient`: account that received the resolved bond.
- `serviceBondSlashed`: whether the bond was paid to payer after a missed SLA.

## Agent Context

Each invoice can carry a lightweight agent accountability layer:

- `payerAgentHash`: hash of payer agent identity reference, wallet policy, or ERC-8004-style agent pointer.
- `recipientAgentHash`: hash of service agent identity reference.
- `mandateHash`: hash of a signed user mandate or payment instruction.
- `policyHash`: hash of agent risk controls, release conditions, or tool policy.
- `slaDeadline`: service-level deadline used by the agent panel.
- `attachedBy`: account that attached the context.

This keeps the contract independent from any one registry while creating a deterministic bridge to agent identity, reputation, and signed mandate systems.

## Service Bond

The recipient can post an optional service bond in the invoice token. The bond is separate from the payer escrow and creates provider-side accountability:

- successful release: bond returns to recipient
- accepted split settlement: bond returns to recipient
- unpaid cancellation: bond returns to recipient
- refund after missed SLA with no delivery evidence: bond is slashed to payer
- refund before SLA or with delivery evidence: bond returns to recipient

This creates a dual-deposit-like pattern without requiring a centralized arbitrator. The contract still does not judge delivery quality; it enforces an objective SLA/evidence condition.

## Agent Layer

The agent is deterministic by default. It reads:

- connected account
- invoice state
- payer/recipient/creator roles
- due date
- timeout windows
- token type

It then produces:

- current state headline
- allowed wallet actions
- disabled action reasons
- settlement timing notes
- delivery evidence status
- split settlement recommendations and counterparty acceptance guidance

The agent does not sign transactions, custody funds, or decide authorization. All authorization stays in the smart contract and every state-changing action requires wallet confirmation.

## Settlement Design

ArbiFlow deliberately avoids an admin arbitrator. If delivery is disputed, payer or recipient can propose a split settlement. The proposal stores the recipient payout, payer refund, proposer, timestamp, and memo hash. Only the counterparty can accept the proposal. This gives the product a practical dispute-resolution path while preserving user custody and contract-enforced consent.

## Portable Receipt

`settlementReceiptHash(invoiceId)` returns a deterministic hash over:

- chain and contract address
- invoice parties, token, amount, and final state
- metadata, delivery evidence, and settlement memo
- split-settlement payout
- resolved service bond amount, recipient, and slashing status
- agent hashes, mandate hash, policy hash, and SLA deadline

When an invoice closes through release, refund, cancellation, or settlement, the contract emits `SettlementReceiptFinalized`. This creates a compact receipt that can be indexed now and later attached to reputation systems or validator flows.

## Arbitrum Fit

Escrow and invoice workflows benefit from low transaction costs. Arbitrum keeps repeated small-business payment actions practical while retaining EVM tooling, Solidity contracts, and familiar wallet UX.
