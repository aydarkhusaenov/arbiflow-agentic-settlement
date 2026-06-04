# Security Notes

## Contract Controls

- No owner/admin withdrawal function.
- Funds only move through explicit invoice state transitions.
- ETH and ERC20 transfers are protected by `nonReentrant`.
- State changes happen before outbound transfers.
- ERC20 transfers use OpenZeppelin `SafeERC20`.
- Invalid calls use custom errors.
- Partial settlements require a proposal from one counterparty and acceptance by the other.

## Authorization

- Unpaid invoices can be cancelled by creator or recipient.
- Paid invoices can be released by payer immediately.
- Recipient can release only after timeout if payer is inactive and no refund was requested.
- Payer can request a refund while invoice is paid.
- Recipient can approve refund immediately after request.
- Payer can claim refund only after refund timeout.
- Recipient can attach delivery evidence while an invoice is paid or refund-requested.
- Payer or recipient can propose a partial split settlement while an invoice is paid or refund-requested.
- Only the non-proposing counterparty can accept a settlement proposal.

## Test Coverage

Tests cover:

- invoice creation
- invalid invoice inputs
- unpaid cancellation authorization
- ETH exact payment
- wrong ETH amount rejection
- double payment rejection
- due-date payment rejection
- release path
- wrong caller and double release rejection
- recipient timeout release
- refund request
- recipient-approved refund
- refund-before-timeout rejection
- payer timeout refund
- ERC20 pay and release path
- ETH value rejection on ERC20 invoice
- delivery evidence authorization
- delivery evidence after refund request
- negotiated ETH split settlement
- proposer cannot accept their own settlement
- invalid settlement state, caller, and amount
- negotiated ERC20 split settlement

## Residual Risks

- ERC20 frontend flow assumes prior token approval for custom ERC20 invoices.
- Metadata is stored as a string reference and is not validated on-chain.
- Settlement memos and delivery evidence are off-chain references; the contract enforces consent and payouts, not truthfulness of external files.
- No centralized arbitration layer is included by design; compromise settlement is counterparty-approved.
