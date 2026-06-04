# Judge Demo Script

Use this script for screenshots or a live walkthrough. No personal video is required by this repo.

## Flow 1: Clean Settlement

1. Create an ETH invoice with a recipient, metadata hash, due date, and timeout.
2. Attach an agent mandate with payer agent hash, service agent hash, policy hash, and SLA deadline.
3. Recipient posts a small service bond.
4. Connect a payer wallet and fund the invoice.
5. Show the agent panel reading the live `Paid` state, mandate hash, SLA, bond, and receipt hash.
6. Release funds from payer to recipient.
7. Show the invoice closing as `Released`, bond returned to provider, and the finalized settlement receipt.

## Flow 2: Evidence And Dispute

1. Create and pay a second invoice.
2. Attach an agent mandate and SLA context.
3. Recipient posts a service bond.
4. Recipient attaches `ipfs://arbiflow-delivery-proof`.
5. Payer requests a refund.
6. Agent shows refund window, delivery evidence, timeout, mandate context, bond status, and settlement options.
7. Recipient proposes a partial split, for example `80%` recipient and `20%` payer refund.
8. Payer accepts the settlement.
9. Show final state `Settled`, bond returned, and the receipt hash that can feed reputation later.

## Flow 3: Timeout Protection

1. Create and pay an invoice with a short timeout on a local chain.
2. Payer requests refund.
3. Before timeout, show that payer refund is blocked.
4. After timeout, show that payer can refund.
5. If no delivery evidence exists and the SLA is missed, show provider bond slashed to payer.

## What To Emphasize

- The agent is not generic help text; it reads contract state, wallet role, timing windows, delivery evidence, and settlement proposals.
- It also reads mandate hash, policy hash, SLA deadline, and portable receipt hash.
- It reads service bond status and explains whether the bond is active, returned, or slashed.
- There is no admin withdrawal or trusted arbitrator.
- Every fund movement is either direct release, timeout path, refund approval, or counterparty-accepted settlement.
- Arbitrum makes these small settlement actions cheap enough for freelancers, agencies, merchants, and autonomous service agents.
