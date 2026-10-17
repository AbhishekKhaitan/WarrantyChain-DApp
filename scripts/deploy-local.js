// Optional: deploy to a local Hardhat/Ganache node (npx hardhat run scripts/deploy-local.js --network localhost).
const { ethers } = require("hardhat");

async function main() {
  const wc = await ethers.deployContract("WarrantyChain", ["Acme Electronics", 730]);
  await wc.waitForDeployment();
  console.log("WarrantyChain deployed to:", await wc.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
