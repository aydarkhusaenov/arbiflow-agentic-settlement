const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const Escrow = await hre.ethers.getContractFactory("InvoiceEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("InvoiceEscrow deployed");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Address:", address);
  if (hre.network.name === "arbitrumSepolia") {
    console.log("Explorer:", `https://sepolia.arbiscan.io/address/${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
