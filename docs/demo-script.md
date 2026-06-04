# Judge Demo Script

Use this script for screenshots or a live walkthrough. No personal video is required by this repo.

## Flow 1: Clean Settlement

1. Create an ETH invoice with a recipient, metadata hash, due date, and timeout.
2. Connect a payer wallet and fund the invoice.
3. Show the agent panel reading the live `Paid` state.
4. Release funds from payer to recipient.
5. Show the invoice closing as `Released`.

## Flow 2: Evidence And Dispute

1. Create and pay a second invoice.
2. Recipient attaches `ipfs://arbiflow-delivery-proof`.
3. Payer requests a refund.
4. Agent shows refund window, delivery evidence, timeout, and settlement options.
5. Recipient proposes a partial split, for example `80%` recipient and `20%` payer refund.
6. Payer accepts the settlement.
7. Show final state `Settled`.

## Flow 3: Timeout Protection

1. Create and pay an invoice with a short timeout on a local chain.
2. Payer requests refund.
3. Before timeout, show that payer refund is blocked.
4. After timeout, show that payer can refund.

## What To Emphasize

- The agent is not generic help text; it reads contract state, wallet role, timing windows, delivery evidence, and settlement proposals.
- There is no admin withdrawal or trusted arbitrator.
- Every fund movement is either direct release, timeout path, refund approval, or counterparty-accepted settlement.
- Arbitrum makes these small settlement actions cheap enough for freelancers, agencies, merchants, and autonomous service agents.
