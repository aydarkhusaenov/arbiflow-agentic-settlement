# Comparison

| Capability | ArbiFlow | Raw x402/API payment | Request-style invoicing | Centralized marketplace |
| --- | --- | --- | --- | --- |
| Non-custodial escrow | Yes | No | Limited / payment-focused | No |
| Signed payment mandate | Yes | Usually payment-only | No agent mandate layer | Platform terms |
| Scoped agent action permits | Yes | No | No | Platform automation |
| Delivery evidence trail | Yes, append-only roots | No | Metadata/audit trail | Platform records |
| Payer dispute evidence | Yes, separate root | No | Limited | Platform records |
| Timeout refund path | Yes | No | No | Platform policy |
| Counterparty split settlement | Yes | No | No | Platform mediation |
| Provider service bond | Yes | No | No | Platform trust score |
| Smart-wallet signatures | ERC-1271 | Depends | Depends | Platform account |
| Pending payout fallback | Yes | No | Depends | Platform custody |
| Receipt-bound feedback | Yes | No | No | Platform review |
| Receipt-bound validation | Yes | No | No | Platform review |
| Admin withdrawal path | No | N/A | Depends | Yes |
| Arbitrum-native low-cost workflow | Yes | Payment only | Depends | No |

## Differentiation

ArbiFlow is strongest where a simple invoice or instant API payment is insufficient: real service delivery with possible delay, evidence, refunds, compromise settlement, and post-settlement agent accountability.

It is deliberately narrower than a centralized marketplace. It does not own identity, discovery, messaging, or arbitration. It provides the settlement primitive those systems can use.
