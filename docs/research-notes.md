# Research Notes

These notes explain the product direction used for the stronger buildathon submission.

## Signals

- ERC-8004 defines trustless agents through identity, reputation, and validation registries. It explicitly treats payments as orthogonal, which leaves room for a payment/settlement layer.
- x402 focuses on HTTP-native instant on-chain payments for humans and machines.
- Agent Payments Protocol ideas focus on cryptographic mandates and auditable proof of user intent for agent-led purchases.
- Recent AP2 security research points at prompt injection, replay, and context-binding risks. This pushed ArbiFlow toward deterministic contract rules, hashed mandates, and wallet-confirmed execution instead of LLM-controlled settlement.

## Gap

Fast agent payments are useful, but real commerce also needs:

- delivery evidence
- escrowed funds for non-instant service work
- dispute and compromise outcomes
- final settlement receipts
- accountability hooks that can feed agent reputation later
- provider-side economic accountability when SLA is missed

## ArbiFlow Position

ArbiFlow is the settlement layer around agentic payment:

- escrow first, direct release when clean
- delivery evidence when work is delivered
- refund windows when the payer disputes
- partial split settlement when both sides compromise
- mandate/policy/SLA hashes for agent accountability
- optional provider service bonds that can be slashed only by objective SLA/evidence conditions
- portable receipt hash when the invoice closes

## Sources

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Coinbase x402 docs: https://docs.cdp.coinbase.com/x402/welcome
- Google Cloud AP2 announcement: https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol
- AP2 prompt-injection red-team paper: https://arxiv.org/abs/2601.22569
- AP2 zero-trust runtime verification paper: https://arxiv.org/abs/2602.06345
