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
- `state`: explicit invoice state.
- `metadataHash`: off-chain invoice metadata reference.

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

The agent does not sign transactions, custody funds, or decide authorization. All authorization stays in the smart contract and every state-changing action requires wallet confirmation.

## Arbitrum Fit

Escrow and invoice workflows benefit from low transaction costs. Arbitrum keeps repeated small-business payment actions practical while retaining EVM tooling, Solidity contracts, and familiar wallet UX.
