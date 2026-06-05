# Judge Demo Script

Use this script for screenshots or a live walkthrough. No personal video is required by this repo.

## Flow 1: Clean Settlement

1. Create an ETH invoice with a recipient, metadata hash, due date, and timeout.
2. Show the generated payment requirement hash.
3. Connect the payer wallet, enter it as authorized payer, and attach a signed mandate with payer agent hash, service agent hash, policy hash, SLA deadline, and mandate expiry.
4. Recipient posts a small service bond.
5. Fund the invoice from the authorized payer wallet.
6. Show the agent panel reading the live `Paid` state, authorized payer, payment requirement hash, mandate hash, SLA, bond, and receipt hash.
7. Release funds from payer to recipient.
8. Show the invoice closing as `Released`, bond returned to provider, and the finalized settlement receipt.

## Flow 2: Evidence And Dispute

1. Create a second invoice.
2. Attach an agent mandate and SLA context before payment.
3. Recipient posts a service bond.
4. Connect a payer wallet and fund the invoice.
5. Recipient attaches `ipfs://arbiflow-delivery-proof`.
6. Payer requests a refund.
7. Agent shows refund window, delivery evidence, timeout, mandate context, bond status, and settlement options.
8. Recipient proposes a partial split, for example `80%` recipient and `20%` payer refund.
9. Payer accepts the settlement.
10. Show final state `Settled`, bond returned, and the receipt hash that can feed reputation later.

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
- It reads service bond status and explains whether the bond is active, returned, or slashed.
- There is no admin withdrawal or trusted arbitrator.
- Every fund movement is either direct release, timeout path, refund approval, or counterparty-accepted settlement.
- Arbitrum makes these small settlement actions cheap enough for freelancers, agencies, merchants, and autonomous service agents.
