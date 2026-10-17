# Deployment Details

> Fill in the blanks after deploying from Remix. Do **not** add private keys or seed phrases here.

| Item | Value |
|---|---|
| Contract name | `WarrantyChain` |
| Source file | `contracts/WarrantyChain.sol` |
| Compiler | Solidity `0.8.20`, optimizer off, EVM version `paris` |
| Deployment tool | Remix IDE – *Injected Provider – MetaMask* |
| Network | Ganache (local) |
| RPC URL | `http://127.0.0.1:7545` |
| Chain ID | `1337` |
| Constructor arguments | `_brandName = "Acme Electronics"`, `_maxWarrantyDays = 730` |
| **Contract address** | `0x________________________________________` |
| Deployer / Manufacturer | `0x________________________________________` |
| Deployment tx hash | `0x________________________________________________________________` |
| Block number | `____` |
| Gas used | `____` |
| Date deployed | `____` |

## Test accounts used (public addresses only)

| Role | Address |
|---|---|
| Manufacturer (Ganache account 0) | `0x________________________________________` |
| Retailer (Ganache account 1) | `0x________________________________________` |
| Customer (Ganache account 2) | `0x________________________________________` |

## Transaction evidence

| # | Action | From | Tx hash | Status |
|---|---|---|---|---|
| 1 | Deploy contract | Manufacturer | `0x…` | ✅ Success |
| 2 | `setRetailer(Retailer, true)` | Manufacturer | `0x…` | ✅ Success |
| 3 | `issueWarranty("SN-1001", …)` | Retailer | `0x…` | ✅ Success |
| 4 | `fileClaim("SN-1001", …)` | Customer | `0x…` | ✅ Success |
| 5 | `resolveClaim(1, true)` | Manufacturer | `0x…` | ✅ Success |
| 6 | `transferWarranty("SN-1001", …)` | Customer | `0x…` | ✅ Success |
| 7 | `setRetailer(…)` by Customer | Customer | – (reverted: *Unauthorized: only manufacturer*) | ❌ Failed |
| 8 | `issueWarranty("SN-1001", …)` duplicate | Retailer | – (reverted: *Serial already registered*) | ❌ Failed |
