// Copies the compiled ABI into frontend/config.js, keeping the configured address.
const fs = require("fs");
const path = require("path");

const artifact = require("../artifacts/contracts/WarrantyChain.sol/WarrantyChain.json");
const configPath = path.join(__dirname, "..", "frontend", "config.js");

let address = "0x0000000000000000000000000000000000000000";
if (fs.existsSync(configPath)) {
  const m = fs.readFileSync(configPath, "utf8").match(/CONTRACT_ADDRESS:\s*"(0x[0-9a-fA-F]{40})"/);
  if (m) address = m[1];
}

const out = `// Paste the address of your contract deployed from Remix below.
window.WARRANTY_CONFIG = {
  CONTRACT_ADDRESS: "${address}",
  CONTRACT_ABI: ${JSON.stringify(artifact.abi, null, 2)},
};
`;
fs.writeFileSync(configPath, out);
fs.writeFileSync(path.join(__dirname, "..", "contracts", "WarrantyChain.abi.json"), JSON.stringify(artifact.abi, null, 2));
console.log("ABI written to frontend/config.js and contracts/WarrantyChain.abi.json");
