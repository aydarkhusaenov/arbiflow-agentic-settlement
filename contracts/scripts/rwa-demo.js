const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DAY = 24 * 60 * 60;
const STOCKS = [
  { symbol: "TSLA", address: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E" },
  { symbol: "AMZN", address: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02" }
];
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

function resolveAddress() {
  if (process.env.ESCROW_ADDRESS) return process.env.ESCROW_ADDRESS;
  if (process.env.NEXT_PUBLIC_ESCROW_ADDRESS) return process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
  const artifact = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (fs.existsSync(artifact)) return JSON.parse(fs.readFileSync(artifact, "utf8")).address;
  return null;
}

function explorerBase() {
  if (hre.network.name === "robinhoodTestnet") return "https://explorer.testnet.chain.robinhood.com";
  if (hre.network.name === "arbitrumSepolia") return "https://sepolia.arbiscan.io";
  return "";
}

async function decimalsOf(token) {
  try {
    return await token.decimals();
  } catch {
    return 18n;
  }
}

async function main() {
  const address = resolveAddress();
  if (!address) {
    throw new Error("No escrow address. Deploy first or set ESCROW_ADDRESS/NEXT_PUBLIC_ESCROW_ADDRESS.");
  }

  const [actor] = await hre.ethers.getSigners();
  const escrow = await hre.ethers.getContractAt("InvoiceEscrow", address, actor);
  const base = explorerBase();
  const now = (await hre.ethers.provider.getBlock("latest")).timestamp;

  console.log(`ArbiFlow RWA demo on ${hre.network.name}`);
  console.log(`Contract: ${address}${base ? ` (${base}/address/${address})` : ""}`);
  console.log(`Actor:    ${actor.address}`);

  for (const stock of STOCKS) {
    const token = new hre.ethers.Contract(stock.address, ERC20_ABI, actor);
    const balance = await token.balanceOf(actor.address);
    if (balance === 0n) {
      console.log(`\n${stock.symbol}: no faucet token balance; skipping. Claim from Robinhood faucet first.`);
      continue;
    }

    const decimals = await decimalsOf(token);
    const targetAmount = hre.ethers.parseUnits(process.env.RWA_AMOUNT || "1", Number(decimals));
    const amount = balance < targetAmount ? balance : targetAmount;
    const allowance = await token.allowance(actor.address, address);
    if (allowance < amount) {
      const approveTx = await token.approve(address, amount);
      await approveTx.wait();
      console.log(`${stock.symbol} approve: ${approveTx.hash}${base ? ` (${base}/tx/${approveTx.hash})` : ""}`);
    }

    const createTx = await escrow.createInvoice(
      actor.address,
      stock.address,
      amount,
      `ipfs://arbiflow/rwa/${stock.symbol.toLowerCase()}-tokenized-stock-invoice`,
      now + 7 * DAY,
      DAY
    );
    const createReceipt = await createTx.wait();
    const created = createReceipt.logs
      .map((log) => {
        try {
          return escrow.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "InvoiceCreated");
    const invoiceId = created.args.invoiceId;
    console.log(`${stock.symbol} create invoice #${invoiceId}: ${createTx.hash}${base ? ` (${base}/tx/${createTx.hash})` : ""}`);

    const payTx = await escrow.payInvoice(invoiceId);
    await payTx.wait();
    console.log(`${stock.symbol} fund escrow: ${payTx.hash}${base ? ` (${base}/tx/${payTx.hash})` : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
