# Security Notes

## Contract Controls

- No owner/admin withdrawal function.
- Funds only move through explicit invoice state transitions.
- All state-mutating entry points are protected by `nonReentrant`.
- Final state, bond resolution, receipt hash, and events are prepared before outbound transfers.
- ERC20 transfers use OpenZeppelin `SafeERC20`.
- ERC20 payments and service bonds use exact balance-delta checks, so fee-on-transfer tokens are rejected instead of underfunding escrow.
- Invalid calls use custom errors.
- Partial settlements require a proposal from one counterparty and acceptance by the other.
- Agent mandates are immutable after first attachment and must be attached before payment.
- SLA deadlines must be future timestamps when attached; `0` means no SLA.
- Agent mandates are stored as hashes/references, not raw sensitive prompts or private user instructions.
- Signed mandates use EIP-712 typed data bound to the invoice payment requirement hash.
- Signed mandates can lock funding to an authorized payer and expire before payment.
- Signature verification accepts EOA signatures and ERC-1271 contract-wallet validation.
- Action permits use EIP-712 typed data bound to invoice id, action enum, signer, executor, exact parameter hash, validity window, expiry, and nonce.
- Action permit execution reuses the normal escrow state machine with authorization checked against the signer, not the relayer.
- Action permit nonces are tracked per signer to block replay across invoices and executors.
- Action permits can be bound to one executor or intentionally left open with `address(0)`.
- Payment requirement hashes bind invoice amount, token, recipient, due date, timeout, metadata, chain, and escrow contract.
- Finalized receipt hashes are deterministic summaries and do not custody or redirect funds.
- Delivery evidence stores both a reference hash and the timestamp when it was attached.
- Delivery evidence and payer dispute evidence append into separate rolling roots.
- First delivery timestamp is preserved for SLA checks; later delivery entries cannot erase timely evidence.
- Settlement proposers can cancel their own open proposals before counterparty acceptance.
- Post-settlement feedback is bound to the finalized receipt hash and accumulated in a rolling root.
- Post-settlement validator attestations are bound to the finalized receipt hash and accumulated in a separate rolling root.
- Validator attestations require an EIP-712 validator signature, validator agent hash, attached subject agent hash, expiry, and per-validator nonce.
- Service bonds are optional and resolved only through existing terminal states.

## Authorization

- Unpaid invoices can be cancelled by creator or recipient.
- Paid invoices can be released by payer immediately.
- Recipient can release only after timeout if payer is inactive and no refund was requested.
- Payer can request a refund while invoice is paid.
- Recipient can approve refund immediately after request.
- Payer can claim refund only after refund timeout.
- Recipient can attach delivery evidence while an invoice is paid or refund-requested.
- Payer can attach dispute evidence while an invoice is paid or refund-requested.
- Payer or recipient can propose a partial split settlement while an invoice is paid or refund-requested.
- Settlement proposer can cancel their own open split proposal.
- Only the non-proposing counterparty can accept a settlement proposal.
- After final settlement, payer can review the recipient agent and recipient can review the payer agent.
- After final settlement, any validator can submit a signed attestation for the attached payer or recipient agent.
- Validation attestation relayers cannot spoof validators; the validator address must sign the exact receipt, subject agent, schema, evidence, verdict, score, expiry, and nonce.
- Creator or recipient can attach an agent mandate before payment; the payer accepts those rules by funding the invoice.
- Anyone can submit a signed mandate only if the authorized payer signed the exact EIP-712 mandate for that invoice requirement.
- If a signed mandate has an authorized payer, only that payer can fund the invoice.
- Anyone can execute an action permit only if they match the signed executor binding and the signer approved the exact action parameters.
- A permit relayer cannot gain extra rights; payer/recipient role checks still run against the permit signer.
- Recipient can post a service bond before final invoice closure.
- Recipient timeout release is blocked by an SLA unless delivery evidence was attached by the SLA deadline.
- Service bond is slashed only if refund occurs after SLA, no timely delivery evidence exists, and a payer is present.

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
- agent mandate attachment and authorization
- mandate overwrite rejection
- stale SLA deadline rejection
- post-payment mandate rejection
- x402-style payment requirement hash generation
- EIP-712 signed mandate attachment
- wrong-signer signed mandate rejection
- authorized payer payment lock
- signed mandate expiry before payment
- EIP-712 action permit execution
- action permit replay rejection
- action permit executor binding
- action permit exact parameter binding
- action permit expiry and not-yet-active rejection
- action permit signer-role enforcement
- portable settlement receipt event
- ETH service bond return on release
- ETH service bond slash on missed SLA
- timely delivery evidence preventing service bond slash
- late delivery evidence still allowing service bond slash
- append-only delivery evidence root
- payer dispute evidence root
- empty evidence rejection
- SLA-gated recipient timeout release
- settlement proposal cancellation
- post-settlement feedback root
- feedback role authorization
- feedback score bounds
- receipt-bound validator attestation root
- validator attestation replay rejection
- validator attestation expiry rejection
- validator attestation subject-agent validation
- validator attestation signature parameter binding
- ERC20 service bond return on split settlement
- fee-on-transfer ERC20 invoice rejection
- fee-on-transfer ERC20 service bond rejection

## Automated Checks

- `pnpm test`: contract tests plus production frontend build.
- `pnpm audit --prod`: no known production vulnerabilities.
- `pnpm audit --audit-level high`: no known high-severity vulnerabilities.
- `slither contracts --filter-paths "contracts/contracts/Mock|contracts/test|node_modules"`: no reentrancy findings after payout refactor. Remaining findings are expected use of `block.timestamp` for due dates/timeouts/SLA/expiry checks, a bounded 65-byte ECDSA recovery assembly block, ERC-1271 `staticcall`, and low-level ETH `.call` with checked return value.

## Residual Risks

- ERC20 frontend flow assumes prior token approval for custom ERC20 invoices.
- Metadata is stored as a string reference and is not validated on-chain.
- Settlement memos and delivery evidence are off-chain references; the contract enforces consent and payouts, not truthfulness of external files.
- Evidence roots prove the sequence of submitted references, not the factual truth of the underlying off-chain evidence.
- Feedback roots prove that a counterparty submitted feedback after final settlement; external reputation systems still decide how to weight or moderate that feedback.
- Validation roots prove that a validator signed an attestation about an attached agent and finalized receipt; external validation systems still decide validator trust and scoring semantics.
- Agent mandate hashes are integrity anchors. External systems still need to store or verify the corresponding signed payload.
- The EIP-712 signed mandate binds a payer to the invoice requirement hash, but it does not prove off-chain metadata truthfulness.
- Action permits bound to `address(0)` can be executed by any relayer. This is intentional for open automation, but the frontend defaults to a concrete executor.
- The in-contract EOA verifier supports standard 65-byte secp256k1 signatures. Contract wallets can use ERC-1271 validation.
- Service bond slashing uses objective time/evidence conditions, not subjective quality evaluation.
- No centralized arbitration layer is included by design; compromise settlement is counterparty-approved.
- Full dev-tooling audit still reports one low-severity `elliptic` advisory through Hardhat 2 / ethers v5 internals. The advisory currently has no patched version; it is not part of the production frontend dependency graph.
