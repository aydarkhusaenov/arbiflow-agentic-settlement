# On-Chain Proof

## Deployment

- Network: Arbitrum Sepolia
- Chain ID: `421614`
- Contract: `InvoiceEscrow`
- Address: `0x7D0893625B9f8F0d5B84531393B84dE5624bAa78`
- Deployment transaction: `0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650`
- Explorer: https://sepolia.arbiscan.io/address/0x7D0893625B9f8F0d5B84531393B84dE5624bAa78
- Deployment tx: https://sepolia.arbiscan.io/tx/0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650
- Source verification: pending; `ARBISCAN_API_KEY` was not available in local `.env`.

## Seeded Demo State

The deployed contract has six invoices:

- `#0` Created invoice.
- `#1` Created invoice with AP2/SLA mandate.
- `#2` Paid invoice with delivery evidence.
- `#3` Released invoice with feedback and validator attestation.
- `#4` Refunded invoice.
- `#5` Paid invoice with dispute evidence, open 50/50 settlement proposal, and active provider service bond.

## Demo Transactions

| Step | Transaction | Explorer |
| --- | --- | --- |
| Deploy `InvoiceEscrow` | `0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650` | https://sepolia.arbiscan.io/tx/0xffa157b58222acb34f7217af4ce0917a137a58262b815589b20c3a59cbd5d650 |
| Create `#0` Created invoice | `0x12eb78f7b87d5ba1a533a7d0aaf822b0757fe2f2c19464c3c35f8fbb2038fec3` | https://sepolia.arbiscan.io/tx/0x12eb78f7b87d5ba1a533a7d0aaf822b0757fe2f2c19464c3c35f8fbb2038fec3 |
| Create `#1` AP2/SLA invoice | `0x3ffe1990c65d035221f8ca7657dc1ac396732bada4fec6d5c9bdad94789ebb6b` | https://sepolia.arbiscan.io/tx/0x3ffe1990c65d035221f8ca7657dc1ac396732bada4fec6d5c9bdad94789ebb6b |
| Attach AP2 mandate to `#1` | `0xd324c4447aae87524eaa4bc047576911558fb2a518a4f0ab292a9b8f2b68468a` | https://sepolia.arbiscan.io/tx/0xd324c4447aae87524eaa4bc047576911558fb2a518a4f0ab292a9b8f2b68468a |
| Create `#2` paid/delivery invoice | `0xa5ff47340f6ef8e03b38fc28dd3b1f1b05644817a06f52e6e05db6ae15754624` | https://sepolia.arbiscan.io/tx/0xa5ff47340f6ef8e03b38fc28dd3b1f1b05644817a06f52e6e05db6ae15754624 |
| Pay `#2` | `0xde09eda5eb92d8576f2844e305cb6115ecde8240c9e3a914a9e0baee7b0be073` | https://sepolia.arbiscan.io/tx/0xde09eda5eb92d8576f2844e305cb6115ecde8240c9e3a914a9e0baee7b0be073 |
| Mark delivery for `#2` | `0x6ada8db54cfbf4078489843d57cd0fdd1072f070cc4866b6ddce21331ef4d6ee` | https://sepolia.arbiscan.io/tx/0x6ada8db54cfbf4078489843d57cd0fdd1072f070cc4866b6ddce21331ef4d6ee |
| Create `#3` released/feedback invoice | `0x04108d27cdf4ba63d96348ac7bb97e633f76209dea3f662f9e12f46d1d1bc394` | https://sepolia.arbiscan.io/tx/0x04108d27cdf4ba63d96348ac7bb97e633f76209dea3f662f9e12f46d1d1bc394 |
| Attach AP2 mandate to `#3` | `0xf2432114d298215a148af1faaafc71a43d5a87ca20ac8b4e37e523c6783bc295` | https://sepolia.arbiscan.io/tx/0xf2432114d298215a148af1faaafc71a43d5a87ca20ac8b4e37e523c6783bc295 |
| Pay `#3` | `0x1e8e9b0f9f8603074598380a431477111a0ae68c63bf38108eeef83fbaeecb31` | https://sepolia.arbiscan.io/tx/0x1e8e9b0f9f8603074598380a431477111a0ae68c63bf38108eeef83fbaeecb31 |
| Mark delivery for `#3` | `0xe086994d2ce4f9c59d11a387ce250e9715e98400626b0e3ac23ca8f67d90790a` | https://sepolia.arbiscan.io/tx/0xe086994d2ce4f9c59d11a387ce250e9715e98400626b0e3ac23ca8f67d90790a |
| Release `#3` | `0xe797b4af0f8b41570db2ada7546ed049feddd31b95fa55a07c9dfb9cb3788bed` | https://sepolia.arbiscan.io/tx/0xe797b4af0f8b41570db2ada7546ed049feddd31b95fa55a07c9dfb9cb3788bed |
| Submit feedback for `#3` | `0x4a5ea602b14a3d13f28b4a640804c33d7e96d2f12e2d825c58c85b9b70ad2747` | https://sepolia.arbiscan.io/tx/0x4a5ea602b14a3d13f28b4a640804c33d7e96d2f12e2d825c58c85b9b70ad2747 |
| Submit TEE validator attestation for `#3` | `0x83e060777b4bc7f55e341c7efb7190e6f2e48559b7f60f66ed39a64b5052083e` | https://sepolia.arbiscan.io/tx/0x83e060777b4bc7f55e341c7efb7190e6f2e48559b7f60f66ed39a64b5052083e |
| Create `#4` refunded invoice | `0x53fcdff57d3a58397c8f12ba3362848e82749ad360c83ebff9966167d467d22a` | https://sepolia.arbiscan.io/tx/0x53fcdff57d3a58397c8f12ba3362848e82749ad360c83ebff9966167d467d22a |
| Pay `#4` | `0xd516c50657e7e03727e56f1c93a6084305fbb7d2c46860d221ce9645eb6d6eda` | https://sepolia.arbiscan.io/tx/0xd516c50657e7e03727e56f1c93a6084305fbb7d2c46860d221ce9645eb6d6eda |
| Request refund for `#4` | `0x91506dc9b0e080972c0cc9d403cd1e37bdc139a1f28968c272fe58c81a5d6149` | https://sepolia.arbiscan.io/tx/0x91506dc9b0e080972c0cc9d403cd1e37bdc139a1f28968c272fe58c81a5d6149 |
| Approve refund for `#4` | `0xcd6bd252d4e9d4ac87674a16aed9ae655074b2c2203dc38f95eb7e71e3b08208` | https://sepolia.arbiscan.io/tx/0xcd6bd252d4e9d4ac87674a16aed9ae655074b2c2203dc38f95eb7e71e3b08208 |
| Create `#5` settlement invoice | `0xd04fa05b1225bbb98ee8475cc847f089c16f04723653af1f36f2faa73132ad47` | https://sepolia.arbiscan.io/tx/0xd04fa05b1225bbb98ee8475cc847f089c16f04723653af1f36f2faa73132ad47 |
| Pay `#5` | `0x70c7c4ec5b03bf932b46cf7b33e7a92818c2faabbc7f2b64b46ff0aaa8600128` | https://sepolia.arbiscan.io/tx/0x70c7c4ec5b03bf932b46cf7b33e7a92818c2faabbc7f2b64b46ff0aaa8600128 |
| Mark dispute for `#5` | `0x9661d7ed1062194f9d1c0739b422117c5b15676deeee110424a3b9fdfbb8aabb` | https://sepolia.arbiscan.io/tx/0x9661d7ed1062194f9d1c0739b422117c5b15676deeee110424a3b9fdfbb8aabb |
| Propose 50/50 settlement for `#5` | `0xcafb24469f86f5c509c687290cbb8ee5a79a9d4daebb16dea3e0fa302c6f99c5` | https://sepolia.arbiscan.io/tx/0xcafb24469f86f5c509c687290cbb8ee5a79a9d4daebb16dea3e0fa302c6f99c5 |
| Post service bond on `#5` | `0x3e225b2dd15a8548391c22968a4006eb89c7bcb79f1e2b4e5845a50d1d5534d1` | https://sepolia.arbiscan.io/tx/0x3e225b2dd15a8548391c22968a4006eb89c7bcb79f1e2b4e5845a50d1d5534d1 |

## Optional Robinhood Chain Deployment

- Network: Robinhood Chain Testnet
- Status: not deployed. Code support and scripts are present, but this optional path needs live Robinhood faucet/setup.

## What Judges Should Verify

- The deployed address matches the frontend configuration.
- `invoiceCount` is `6` on Arbitrum Sepolia.
- The seeded invoices cover created, paid, released, refunded, and open negotiated-settlement states.
- AP2 hashes are attached on seeded mandates.
- Service-bond, feedback, and TEE validator-attestation transactions are present.
- No private keys or secrets are present in the repo.
