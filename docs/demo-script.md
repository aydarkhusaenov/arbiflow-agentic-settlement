# Judge Demo Script

Use this script for screenshots, judging review, or a live walkthrough.

## Glass-Box On-Chain Demo

After deployment to Arbitrum Sepolia, run:

```bash
pnpm contracts:live-demo:arbitrum-sepolia
```

The script creates one invoice and runs a deterministic agentic settlement loop:

1. create invoice
2. attach signed payment mandate
3. post service bond
4. pay invoice
5. mark delivered
6. release funds
7. submit receipt-bound feedback
8. submit receipt-bound validator attestation

It prints every transaction hash and Arbiscan URL for inclusion in [ONCHAIN.md](ONCHAIN.md).

For the optional Robinhood Chain reserved-prize/RWA path, deploy and seed on
Robinhood Chain Testnet, then run:

```bash
pnpm contracts:live-demo:robinhood-testnet
pnpm contracts:rwa-demo:robinhood-testnet
```

The RWA script creates and funds tokenized TSLA/AMZN invoices when the deploying
wallet has those faucet-token balances. Robinhood explorer links belong in
[ONCHAIN.md](ONCHAIN.md) when that optional track is used.

## Flow 1: Clean Settlement

1. Create an ETH invoice with a recipient, metadata hash, due date, and timeout.
2. Show the generated payment requirement hash.
3. Connect the payer wallet, enter it as authorized payer, and attach a signed mandate with payer agent hash, service agent hash, policy hash, SLA deadline, and mandate expiry.
4. Recipient posts a small service bond.
5. Fund the invoice from the authorized payer wallet.
6. Show the agent panel reading the live `Paid` state, authorized payer, payment requirement hash, mandate hash, SLA, delivery/dispute evidence counts, bond, and receipt hash.
7. Sign a scoped action permit for `Release funds` with the connected wallet as executor.
8. Execute the signed permit and show that the release uses the signer permission, not a broad approval.
9. Show the invoice closing as `Released`, bond returned to provider, and the finalized settlement receipt.
10. Submit a validator attestation for the service agent and show the validation root update.

## Flow 2: Evidence And Dispute

1. Create a second invoice.
2. Attach an agent mandate and SLA context before payment.
3. Recipient posts a service bond.
4. Connect a payer wallet and fund the invoice.
5. Recipient attaches `ipfs://arbiflow-delivery-proof`.
6. Payer requests a refund.
7. Payer attaches dispute evidence.
8. Agent shows refund window, delivery evidence, dispute evidence, timeout, mandate context, bond status, and settlement options.
9. Recipient signs a scoped action permit for `Propose split`, with exact payout amount and memo hash.
10. Execute the permit and show the open partial split, for example `80%` recipient and `20%` payer refund.
11. Show that proposer can cancel stale split offers, then create the final split offer.
12. Payer accepts the settlement.
13. Show final state `Settled`, bond returned, and the receipt hash that can feed reputation later.
14. Submit counterparty feedback and show the feedback root update.
15. Submit a validator attestation against the finalized receipt and show the validation root update.

## Flow 3: Timeout Protection

1. Create an invoice with a short timeout on a local chain.
2. Attach an SLA mandate before payment and have recipient post a small bond.
3. Payer funds the invoice and later requests refund.
4. Before timeout, show that payer refund is blocked.
5. After timeout, show that payer can refund.
6. If no timely delivery evidence exists and the SLA is missed, show provider bond slashed to payer.

## What To Emphasize

- The agent is not generic help text; it reads contract state, wallet role, timing windows, delivery evidence, and settlement proposals.
- It also reads authorized payer, payment requirement hash, mandate hash, policy hash, SLA deadline, and portable receipt hash.
- It reads delivery and dispute evidence chain counts so both sides have an auditable trail.
- It can sign and execute scoped action permits for one exact invoice action with expiry, nonce, executor, and parameter hash.
- After final settlement, it lets counterparties submit receipt-bound feedback for agent reputation.
- After final settlement, it lets independent validators submit receipt-bound attestations for validation registries.
- It reads service bond status and explains whether the bond is active, returned, or slashed.
- There is no admin withdrawal or trusted arbitrator.
- Every fund movement is either direct release, timeout path, refund approval, or counterparty-accepted settlement.
- Arbitrum makes these small settlement actions cheap enough for freelancers, agencies, merchants, and autonomous service agents.
