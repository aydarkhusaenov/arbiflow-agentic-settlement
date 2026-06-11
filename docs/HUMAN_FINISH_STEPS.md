# Human Finish Steps

This file is the remaining human-only handoff. It does not claim the app is
deployed, verified, submitted, or live yet. Only make those claims after the
commands below succeed and the linked pages load in a browser.

Run commands from the repo root:

```bash
cd /home/legat/work/hackaton/Arbitrum-Open-House-London-Online-Buildathon
```

## 1. Create a Fresh Throwaway Wallet

Use a brand new testnet-only wallet. Do not use a wallet that has ever held
mainnet funds.

Option A: create it in a wallet UI such as:

- MetaMask: https://metamask.io/download/
- Rabby: https://rabby.io/

Option B: generate one locally with the installed `ethers` dependency:

```bash
cd contracts
node -e "const { Wallet } = require('ethers'); const w = Wallet.createRandom(); console.log('address=' + w.address); console.log('privateKey=' + w.privateKey); console.log('mnemonic=' + w.mnemonic.phrase)"
cd ..
```

Save the address and private key somewhere private. The private key goes only in
the local `.env`; never paste it into GitHub, HackQuest, chat, screenshots, or a
public demo.

## 2. Create Alchemy Arbitrum Sepolia RPC

Required because you have Alchemy and do not need QuickNode.

1. Open Alchemy dashboard: https://dashboard.alchemy.com/
2. Create a new app.
3. Select network: **Arbitrum Sepolia**.
4. Copy the HTTPS RPC URL.
5. It should look like:

```text
https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

Use that value for `ARBITRUM_SEPOLIA_RPC_URL`.

## 3. Get Testnet Funds

Primary network: Arbitrum Sepolia.

Request Arbitrum Sepolia ETH for the throwaway wallet. Alchemy is the required
path for you:

- https://www.alchemy.com/faucets/arbitrum-sepolia

Fallbacks only if Alchemy faucet rate-limits you:

- https://arbitrum.faucet.dev/
- If needed, get Ethereum Sepolia ETH and bridge it: https://bridge.arbitrum.io/

Optional for USDC invoice demos:

- Circle test USDC faucet: https://faucet.circle.com/

Optional Robinhood Chain track:

- Robinhood Chain faucet: https://faucet.testnet.chain.robinhood.com/
- Robinhood Chain docs: https://docs.robinhood.com/chain/
- Robinhood Chain testnet explorer: https://explorer.testnet.chain.robinhood.com/

Wait until the wallet balance is visible on the target explorer before deploying:

- https://sepolia.arbiscan.io/

## 4. Set `.env`

Create the local env file:

```bash
cp .env.example .env
chmod 600 .env
```

Fill these values for the Arbitrum Sepolia path. Use your Alchemy URL, not the
public RPC:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=0xYOUR_THROWAWAY_PRIVATE_KEY
ARBISCAN_API_KEY=YOUR_ARBISCAN_API_KEY_IF_VERIFYING_SOURCE

NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ESCROW_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Leave `NEXT_PUBLIC_ESCROW_ADDRESS` blank until deployment prints the deployed
contract address.

Optional Robinhood Chain values if you also deploy there:

```bash
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
ROBINHOOD_EXPLORER_API_KEY=YOUR_ROBINHOOD_EXPLORER_KEY_IF_REQUIRED
NEXT_PUBLIC_CHAIN_ID=46630
NEXT_PUBLIC_ESCROW_ADDRESS=
```

Do not commit `.env`.

## 5. Build and Test Before Live Deployment

Install and run the test/build gate if dependencies are not already current:

```bash
pnpm install
pnpm test
```

Do not deploy if tests or the app build fail.

## 6. Deploy, Seed, and Verify on Arbitrum Sepolia

Deploy:

```bash
pnpm contracts:deploy:arbitrum-sepolia
```

After the command succeeds:

1. Copy the printed `InvoiceEscrow` address.
2. Set it in `.env`:

```bash
NEXT_PUBLIC_ESCROW_ADDRESS=0xDEPLOYED_CONTRACT_ADDRESS
```

3. Open the address on Arbiscan Sepolia:

```text
https://sepolia.arbiscan.io/address/0xDEPLOYED_CONTRACT_ADDRESS
```

Seed demo invoices:

```bash
pnpm contracts:seed:arbitrum-sepolia
```

Verify source after `ARBISCAN_API_KEY` is set:

```bash
pnpm --filter @arbiflow/contracts verify:arbitrum-sepolia 0xDEPLOYED_CONTRACT_ADDRESS
```

Only mark the contract as deployed or verified after the deployment, seed, and
verify commands complete and the explorer pages show the expected contract.

Optional Robinhood Chain deployment:

```bash
pnpm contracts:deploy:robinhood-testnet
pnpm contracts:seed:robinhood-testnet
pnpm --filter @arbiflow/contracts verify:robinhood-testnet 0xDEPLOYED_CONTRACT_ADDRESS
```

Optional Robinhood tokenized-stock RWA demo after claiming faucet stock tokens:

```bash
pnpm contracts:rwa-demo:robinhood-testnet
```

The script creates and funds TSLA/AMZN tokenized-stock invoices only if the
throwaway wallet has those faucet-token balances.

Explorer address:

```text
https://explorer.testnet.chain.robinhood.com/address/0xDEPLOYED_CONTRACT_ADDRESS
```

## 7. Run the Live Demo

Run the on-chain scripted demo only after `.env` has the deployed address:

```bash
pnpm contracts:live-demo:arbitrum-sepolia
```

Optional Robinhood Chain live demo:

```bash
pnpm contracts:live-demo:robinhood-testnet
```

Start the frontend:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

Connect the throwaway wallet on the same network. Confirm the dashboard reads
the deployed contract and seeded invoices. If using Arbitrum Sepolia, the wallet
network must be chain ID `421614`.

Copy only real transaction hashes and explorer URLs from successful commands.

## 8. Update Submission Links and Docs

After deployment and live demo transactions are real, update the submission
materials with actual links. Do not leave placeholder deployment claims.

Files to update manually after the commands succeed:

- `docs/ONCHAIN.md`: deployed address, deployment tx, seed txs, live demo txs,
  verification status, explorer links.
- `docs/deployment.md`: confirm the auto-filled deployment record is accurate.
- `docs/submission.md`: replace `TODO` values with the public repo URL,
  deployed contract URL, live app URL if any, and final demo notes.
- `README.md`: update any final public links if the submission expects them.

Useful final link formats:

```text
Arbitrum Sepolia contract:
https://sepolia.arbiscan.io/address/0xDEPLOYED_CONTRACT_ADDRESS

Arbitrum Sepolia deployment transaction:
https://sepolia.arbiscan.io/tx/0xDEPLOYMENT_TX_HASH

Robinhood Chain contract, if used:
https://explorer.testnet.chain.robinhood.com/address/0xDEPLOYED_CONTRACT_ADDRESS
```

## 9. Create and Push a Public GitHub Repo

Create a public GitHub repo:

- Browser: https://github.com/new
- GitHub CLI docs: https://cli.github.com/

Before committing, check that secrets are not staged:

```bash
git status --short
git diff --cached --name-only
```

Stage only source, docs, examples, and deployment records that are safe to make
public. Do not stage `.env`.

```bash
git add README.md app contracts docs package.json pnpm-lock.yaml pnpm-workspace.yaml .env.example .gitignore
git status --short
git commit -m "Prepare ArbiFlow buildathon submission"
```

If using GitHub CLI:

```bash
gh repo create YOUR_GITHUB_USERNAME/arbiflow --public --source=. --remote=origin --push
```

If creating the repo in the browser:

```bash
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/arbiflow.git
git branch -M main
git push -u origin main
```

Open the public repo URL in a private/incognito browser window before submitting
it to HackQuest.

## 10. Optional Vercel Deploy

Vercel is optional. A public GitHub repo plus local live demo may be enough if
the form does not require a hosted app.

Deploy link:

- https://vercel.com/new

Recommended Vercel settings:

```text
Framework: Next.js
Root Directory: app
Build Command: pnpm build
Output Directory: .next
```

Set production environment variables in Vercel:

```text
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ESCROW_ADDRESS=0xDEPLOYED_CONTRACT_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

Optional only if using the AI explanation endpoint:

```text
OPENAI_API_KEY=YOUR_KEY
OPENAI_MODEL=YOUR_MODEL
```

After deploy, open the Vercel URL, connect the throwaway wallet, and confirm it
reads the live contract before adding the URL to submission materials.

## 11. Register and Submit on HackQuest

HackQuest page:

- https://www.hackquest.io/hackathons/Arbitrum-Open-House-London-Online-Buildathon
- Direct Buildathon page: https://arbitrum-london.hackquest.io/buildathons/Arbitrum-Open-House-London-Online-Buildathon

Public program dates are May 25-June 14, 2026. The HackQuest form can have
stricter registration or submission timestamps; use the HackQuest page as the
source of truth before submitting.

Use the page to register or submit, depending on the current phase. Submit only
after these are ready:

- Public GitHub repo URL.
- Real Arbitrum Sepolia contract address and explorer URL.
- Verification status, if source verification succeeded.
- Live app URL, if Vercel or another hosting service was used.
- Clear note that the deployed network is Arbitrum Sepolia, unless also showing
  an optional Robinhood Chain deployment.
- Any required screenshots, demo notes, or transaction links.

Final honesty check before clicking submit:

- Do not say "deployed" unless an explorer address page exists.
- Do not say "verified" unless the explorer shows verified source or the verify
  command succeeded.
- Do not say "live demo completed" unless the live demo command or manual demo
  transactions completed on the target chain.
- Do not submit private keys, mnemonics, `.env`, or faucet-only wallet secrets.
