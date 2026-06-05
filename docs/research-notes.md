# Research Notes

These notes explain the product direction used for the stronger buildathon submission.

## Signals

- ERC-8004 defines trustless agents through identity, reputation, and validation registries. It explicitly treats payments as orthogonal, which leaves room for a payment/settlement layer.
- x402 focuses on HTTP-native instant on-chain payments for humans and machines.
- Agent Payments Protocol ideas focus on cryptographic mandates and auditable proof of user intent for agent-led purchases.
- Recent AP2 security research points at prompt injection, replay, and context-binding risks. This pushed ArbiFlow toward deterministic contract rules, hashed mandates, and wallet-confirmed execution instead of LLM-controlled settlement.
- Forum/community discussion around x402-style flows highlights a practical gap after payment: settlement can be instant, but resource delivery, retries, and recourse still need an application layer.

## Gap

Fast agent payments are useful, but real commerce also needs:

- delivery evidence
- payer dispute evidence
- append-only evidence roots
- escrowed funds for non-instant service work
- dispute and compromise outcomes
- final settlement receipts
- accountability hooks that can feed agent reputation later
- provider-side economic accountability when SLA is missed

## ArbiFlow Position

ArbiFlow is the settlement layer around agentic payment:

- escrow first, direct release when clean
- delivery evidence when work is delivered
- payer dispute evidence when work is challenged
- rolling evidence roots so later evidence cannot erase earlier submissions
- refund windows when the payer disputes
- partial split settlement when both sides compromise
- mandate/policy/SLA hashes for agent accountability
- optional provider service bonds that can be slashed only by objective SLA/evidence conditions
- x402-style payment requirement hashes that agents can compare before funding escrow
- EIP-712 signed payer mandates bound to those payment requirements
- portable receipt hash when the invoice closes

## Security Research Applied

- Solidity security guidance pushed the contract toward narrow state transitions, reentrancy guards, and checks-effects-interactions around payout paths.
- OpenZeppelin `SafeERC20` is used for ERC20 compatibility, but ArbiFlow adds exact balance-delta checks so fee-on-transfer tokens cannot silently underfund invoice escrow or service bonds.
- Slither was used as a static-analysis pass. Its reentrancy findings were addressed by settling state, bond context, receipt hashes, and events before outbound transfers.
- Dependency audit results drove the frontend upgrade to patched Next.js and targeted pnpm overrides for vulnerable transitive packages.
- EIP-712 and ERC-1271 research drove signed mandates that bind payer approval to the exact invoice requirement and support contract-wallet signers.
- Real dispute workflows pushed the design from mutable single evidence strings to append-only delivery and dispute roots included in final receipts.

## Sources

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Coinbase x402 docs: https://docs.cdp.coinbase.com/x402/welcome
- Google Cloud AP2 announcement: https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol
- AP2 prompt-injection red-team paper: https://arxiv.org/abs/2601.22569
- AP2 zero-trust runtime verification paper: https://arxiv.org/abs/2602.06345
- EIP-712 typed structured data: https://eips.ethereum.org/EIPS/eip-712
- ERC-1271 contract signatures: https://eips.ethereum.org/EIPS/eip-1271
- Solidity security considerations: https://docs.soliditylang.org/en/latest/security-considerations.html
- OpenZeppelin Contracts security utilities: https://docs.openzeppelin.com/contracts/5.x/api/security
- OpenZeppelin SafeERC20: https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20
- Slither detector documentation: https://github.com/crytic/slither/wiki/Detector-Documentation
