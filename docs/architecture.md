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
  | cancelSettlementProposal by proposer
  | acceptSettlement by counterparty
  v
Settled

Created
  | attachAgentMandate by creator or recipient
  | attachSignedAgentMandate with payer EIP-712 signature
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
- `deliveryMarkedAt`: timestamp when delivery evidence was attached.
- `deliveryEvidenceCount`: number of delivery evidence entries appended.
- `disputeMarkedAt`: timestamp when payer first attached dispute evidence.
- `disputeEvidenceCount`: number of dispute evidence entries appended.
- `deliveryEvidenceRoot`: rolling hash root over all delivery evidence entries.
- `disputeEvidenceRoot`: rolling hash root over all dispute evidence entries.
- `state`: explicit invoice state.
- `metadataHash`: off-chain invoice metadata reference.
- `deliveryHash`: first off-chain delivery/evidence reference.
- `disputeHash`: first off-chain dispute/evidence reference.
- `settlementMemoHash`: off-chain settlement reasoning reference.
- `settlementProposedBy`: payer or recipient that proposed the split.
- `settlementRecipientAmount`: amount paid to recipient if counterparty accepts settlement.

## Agent Context

Each invoice can carry a lightweight agent accountability layer:

- `payerAgentHash`: hash of payer agent identity reference, wallet policy, or ERC-8004-style agent pointer.
- `recipientAgentHash`: hash of service agent identity reference.
- `mandateHash`: hash of a signed user mandate or payment instruction.
- `policyHash`: hash of agent risk controls, release conditions, or tool policy.
- `slaDeadline`: service-level deadline used by the agent panel.
- `attachedBy`: account that attached the context.
- `authorizedPayer`: optional payer address recovered from an EIP-712 signed mandate.
- `mandateExpiresAt`: optional expiry for the signed payer mandate.

This keeps the contract independent from any one registry while creating a deterministic bridge to agent identity, reputation, and signed mandate systems.

Mandates are immutable after first attachment and must be attached before payment. A non-zero SLA deadline must be in the future, which prevents a payer from adding stale rules after funds or provider bond are already at risk.

Signed mandates use an EIP-712 `PaymentMandate` over:

- invoice id
- authorized payer
- `paymentRequirementHash(invoiceId)`
- payer and recipient agent hashes
- mandate hash
- policy hash
- SLA deadline
- mandate expiry

The signature verifier supports normal EOA signatures and ERC-1271 contract-wallet validation. If an authorized payer is set, only that payer can fund the invoice and the mandate must still be unexpired.

## Payment Requirement

`paymentRequirementHash(invoiceId)` is an x402-style escrow quote hash over:

- chain id and escrow contract
- invoice id
- recipient
- token
- amount
- due date
- timeout
- metadata hash

This gives HTTP/API agents and facilitators a compact requirement to compare before asking a wallet to sign or fund escrow. It is not a direct payment receipt; it is the pre-funding quote that the signed mandate binds to.

## Bond Context

Bond accounting is exposed through `getBondContext(invoiceId)`:

- `activeAmount`: active provider bond locked in the invoice token.
- `resolvedAmount`: bond amount resolved at final settlement.
- `resolvedRecipient`: account that received the resolved bond.
- `slashed`: whether the bond was paid to payer after a missed SLA.

## Service Bond

The recipient can post an optional service bond in the invoice token. The bond is separate from the payer escrow and creates provider-side accountability:

- successful release: bond returns to recipient
- accepted split settlement: bond returns to recipient
- unpaid cancellation: bond returns to recipient
- refund after missed SLA with no timely delivery evidence: bond is slashed to payer
- refund before SLA or with timely delivery evidence: bond returns to recipient

This creates a dual-deposit-like pattern without requiring a centralized arbitrator. The contract still does not judge delivery quality; it enforces an objective SLA/evidence condition.

## Evidence Ledger

ArbiFlow keeps first evidence references for quick UI scanning and rolling roots for auditability:

- recipient delivery entries update `deliveryEvidenceRoot`
- payer dispute entries update `disputeEvidenceRoot`
- first delivery timestamp remains fixed for SLA logic
- later evidence appends do not erase earlier evidence
- final receipts include both evidence roots and counts

This gives both sides an append-only trail without putting large files on-chain. IPFS, HTTPS, Arweave, or private evidence vault references can all be represented as hashes/URIs.

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

The proposer can cancel their own open split proposal. This prevents stale compromise offers from remaining accept-able after off-chain negotiation changes.

## Portable Receipt

`settlementReceiptHash(invoiceId)` returns a deterministic hash over:

- chain and contract address
- invoice parties, token, amount, and final state
- metadata, delivery evidence, and settlement memo
- delivery evidence timestamp
- delivery and dispute evidence counts and rolling roots
- split-settlement payout
- resolved service bond amount, recipient, and slashing status
- agent hashes, mandate hash, policy hash, and SLA deadline
- authorized payer and signed mandate expiry

When an invoice closes through release, refund, cancellation, or settlement, the contract emits `SettlementReceiptFinalized`. This creates a compact receipt that can be indexed now and later attached to reputation systems or validator flows.

## Arbitrum Fit

Escrow and invoice workflows benefit from low transaction costs. Arbitrum keeps repeated small-business payment actions practical while retaining EVM tooling, Solidity contracts, and familiar wallet UX.
