# Research Notes

These notes explain the product direction used for the stronger buildathon submission.

## Signals

- ERC-8004 defines trustless agents through identity, reputation, and validation registries. It explicitly treats payments as orthogonal, which leaves room for a payment/settlement layer.
- x402 focuses on HTTP-native instant on-chain payments for humans and machines.
- Agent Payments Protocol ideas focus on cryptographic mandates and auditable proof of user intent for agent-led purchases.

## Gap

Fast agent payments are useful, but real commerce also needs:

- delivery evidence
- escrowed funds for non-instant service work
- dispute and compromise outcomes
- final settlement receipts
- accountability hooks that can feed agent reputation later

## ArbiFlow Position

ArbiFlow is the settlement layer around agentic payment:

- escrow first, direct release when clean
- delivery evidence when work is delivered
- refund windows when the payer disputes
- partial split settlement when both sides compromise
- mandate/policy/SLA hashes for agent accountability
- portable receipt hash when the invoice closes

## Sources

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Coinbase x402 docs: https://docs.cdp.coinbase.com/x402/welcome
- Agent Payments Protocol overview: https://agentpaymentsprotocol.info/docs/introduction/
