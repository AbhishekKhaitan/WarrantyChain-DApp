require("@nomicfoundation/hardhat-toolbox");

/** Local compile/test only. Deployment for the assignment is done in Remix IDE. */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: { sources: "./contracts", tests: "./test" },
};
