# WarrantyChain – Blockchain-Based Transferable Product Warranties

A decentralized application (DApp) built with **Solidity**, **Ethereum**, **Ethers.js** and **MetaMask** that replaces paper warranty cards with tamper-proof, verifiable and transferable warranty records on the blockchain.

---

## 1. Problem statement

Product warranties today are managed with paper cards, printed bills or a manufacturer's private database. This causes real problems:

| Problem | Impact |
|---|---|
| Warranty cards and bills get lost or damaged | Customer loses service rights they paid for |
| Fake warranty cards / forged bills | Manufacturers pay for fraudulent claims |
| Second-hand buyers can't verify warranty status | Lower resale value, buyers get cheated |
| Warranty can't move with the product when it is resold | New owner gets no protection |
| Claim history is hidden | Repeated or duplicate claims can't be detected |

**WarrantyChain** solves this by recording every warranty on the Ethereum blockchain:

- Only **authorised retailers** (approved by the manufacturer) can issue warranties, so fake warranties can't be created.
- **Anyone** can verify a warranty using the product's serial number – no login needed.
- The **holder** can **transfer** the warranty to a new owner when reselling the product.
- The holder can **file service claims**; the **manufacturer** approves or rejects them, and the full claim history is public.
- The manufacturer can **void** warranties for counterfeit or fraudulent products.

### Roles

| Role | Who | Can do |
|---|---|---|
| Manufacturer | Account that deploys the contract | Authorise/revoke retailers, resolve claims, void warranties, also issue warranties |
| Retailer | Address authorised by the manufacturer | Issue warranties to buyers |
| Holder (customer) | Buyer who received the warranty | Transfer warranty, file claims |
| Anyone | Any visitor | Verify warranty, view claim history |

---

## 2. Repository structure

```
WarrantyChain-DApp/
├── contracts/
│   ├── WarrantyChain.sol          # Smart contract
│   └── WarrantyChain.abi.json     # Compiled ABI
├── frontend/
│   ├── index.html                 # User interface
│   ├── style.css                  # Styling
│   ├── app.js                     # MetaMask + Ethers.js logic
│   └── config.js                  # Contract address + ABI (edit address after deploying)
├── test/
│   ├── WarrantyChain.test.js      # Automated test suite (27 tests, Hardhat)
│   ├── remix/WarrantyChain_test.sol  # Solidity unit tests for Remix "Solidity Unit Testing" plugin
│   └── test-results.txt           # Output of the automated test run
├── scripts/                       # ABI export + optional local deploy script
├── screenshots/                   # Evidence screenshots (see section 8)
├── DEPLOYMENT.md                  # Deployment details (network, address, tx hash)
└── README.md
```

---

## 3. Smart contract overview (`contracts/WarrantyChain.sol`)

| Element | Details |
|---|---|
| **Constructor** | `constructor(string _brandName, uint256 _maxWarrantyDays)` – sets the manufacturer (`msg.sender`), brand name and the maximum warranty period; validates both inputs. |
| **State variables** | `manufacturer`, `brandName`, `maxWarrantyDays`, `totalWarranties`, `totalClaims`, `authorizedRetailers` mapping, warranty / claim mappings, `MAX_OPEN_CLAIMS` constant |
| **Structs / enum** | `Warranty`, `Claim`, `ClaimStatus { Pending, Approved, Rejected }` |
| **Modifiers** | `onlyManufacturer`, `onlyRetailer`, `warrantyExists` |
| **Write functions** | `setRetailer`, `issueWarranty`, `transferWarranty`, `fileClaim`, `resolveClaim`, `voidWarranty` |
| **Read functions** | `getWarranty`, `isWarrantyValid`, `getClaim`, `getClaimIds`, `getWarrantiesOf`, public getters |
| **Events** | `RetailerUpdated`, `WarrantyIssued`, `WarrantyTransferred`, `WarrantyVoided`, `ClaimFiled`, `ClaimResolved` |

**Validation rules (enforced with `require`)**

- Serial number 4–32 characters and unique; product model not empty
- Buyer / new holder must not be the zero address; retailer cannot issue to itself
- Duration must be 1 … `maxWarrantyDays`
- Claims and transfers only while the warranty is valid (not expired, not voided)
- Claim description 5–200 characters; only one pending claim per product; no transfer while a claim is open
- Claim must exist and still be pending to be resolved; a warranty can be voided only once, with a reason

---

## 4. Prerequisites

- [Google Chrome / Brave / Edge](https://www.google.com/chrome/) with the [MetaMask extension](https://metamask.io/download/)
- [Ganache](https://archive.trufflesuite.com/ganache/) (GUI) **or** an Ethereum test network such as Sepolia (with test ETH from a faucet)
- [Remix IDE](https://remix.ethereum.org)
- Any static web server to open the frontend, e.g. VS Code **Live Server** extension, or Python: `python -m http.server`
- *(Optional)* Node.js 18+ to run the automated test suite

---

## 5. Compile & deploy with Remix IDE

### 5.1 Start Ganache
1. Open Ganache → **Quickstart (Ethereum)**.
2. Note the RPC server (`HTTP://127.0.0.1:7545`) and network/chain ID (`1337`).
3. You will use three Ganache accounts: **Account 0 = Manufacturer**, **Account 1 = Retailer**, **Account 2 = Customer**.

### 5.2 Add Ganache to MetaMask
1. MetaMask → network selector → **Add network → Add a network manually**:
   - Network name: `Ganache`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337`
   - Currency symbol: `ETH`
2. In Ganache click the 🔑 key icon next to Accounts 0, 1 and 2, copy each private key and import it in MetaMask (**Add account → Import account**). Rename them *Manufacturer*, *Retailer*, *Customer*.
   > ⚠️ Ganache keys are for local testing only. **Never** commit private keys or seed phrases to GitHub.

### 5.3 Compile
1. Open [remix.ethereum.org](https://remix.ethereum.org) and create `WarrantyChain.sol`; paste the contract from `contracts/WarrantyChain.sol`.
2. **Solidity Compiler** tab → compiler `0.8.20` (or any 0.8.20+).
3. Expand **Advanced Configurations** → **EVM Version: `paris`** (Ganache does not support newer opcodes such as `PUSH0`).
4. Click **Compile WarrantyChain.sol** → green tick. 📸 *Screenshot 1*.
5. Click **ABI** (copy icon) if you want to verify it matches `contracts/WarrantyChain.abi.json`.

### 5.4 Deploy
1. **Deploy & Run Transactions** tab → Environment: **Injected Provider – MetaMask**. Select the *Manufacturer* account in MetaMask (on the Ganache network).
2. Next to **Deploy**, enter constructor arguments: `"Acme Electronics", 730`
3. Click **Deploy** → confirm in MetaMask. 📸 *Screenshot 2* (Remix terminal showing the deployment tx + Ganache Transactions tab).
4. Copy the deployed contract address from **Deployed Contracts** and fill it into `DEPLOYMENT.md` and section 7 below.

> Using Sepolia instead? Switch MetaMask to Sepolia, get test ETH from a faucet, and deploy the same way (EVM version can stay default). Record the Etherscan link in `DEPLOYMENT.md`.

### 5.5 Run the Remix unit tests (optional but recommended)
1. In Remix, activate the **Solidity Unit Testing** plugin.
2. Create `tests/WarrantyChain_test.sol` with the content of `test/remix/WarrantyChain_test.sol` and change the second import to point at your contract inside the Remix workspace, e.g. `import "../contracts/WarrantyChain.sol";` if the contract is in the `contracts` folder.
3. Select the file and click **Run** → 13 tests pass. 📸 *Screenshot*.

---

## 6. Run the frontend & connect MetaMask

1. Open `frontend/config.js` and replace `CONTRACT_ADDRESS` with your deployed address:
   ```js
   CONTRACT_ADDRESS: "0xYourDeployedContractAddress",
   ```
   (The ABI is already filled in. If you change the contract, re-copy the ABI from Remix.)
2. Serve the `frontend` folder over HTTP (MetaMask does not inject into `file://` pages by default):
   ```bash
   cd frontend
   python -m http.server 8080
   ```
   then open <http://localhost:8080>. (Or right-click `index.html` → *Open with Live Server* in VS Code.)
3. Click **Connect MetaMask** → approve the connection. The header shows the network, your account and your **role** (Manufacturer / Retailer / Customer). 📸 *Screenshot 3*.
4. The **Contract overview** card loads data straight from the blockchain (brand, manufacturer, max days, counts).

### Interacting with the DApp (demo flow)

| Step | MetaMask account | Action in UI |
|---|---|---|
| 1 | Manufacturer | **Manage retailers** → paste Retailer address → **Authorize** |
| 2 | Retailer | **Issue warranty** → Serial `SN-1001`, model `Acme X200 Laptop`, buyer = Customer address, 365 days → confirm in MetaMask 📸 *Screenshot 4* |
| 3 | Anyone | **Verify a warranty** → `SN-1001` → shows ✔ VALID, holder, expiry, claim history 📸 *Screenshot 6* |
| 4 | Customer | **My warranties** → **Load** → shows `SN-1001` |
| 5 | Customer | **File a service claim** → `SN-1001`, "Screen flickers after boot" |
| 6 | Manufacturer | **Resolve claim** → ID `1` → **Approve** |
| 7 | Customer | **Transfer warranty** → `SN-1001` to another address |
| 8 | Customer (any non-owner) | Try **Authorize** a retailer → rejected: *Unauthorized: only manufacturer* 📸 *Screenshot 5* |

Switching accounts in MetaMask reloads the page automatically. Every transaction (hash, block, gas, or the revert reason) appears in the **Transaction log** card.

---

## 7. Deployment details

| Item | Value |
|---|---|
| Network | Ganache (local) – Chain ID 1337 *(or Sepolia – 11155111)* |
| RPC URL | http://127.0.0.1:7545 |
| Contract address | `0x________________________________________` ← **fill in after deploying** |
| Deployer (Manufacturer) | `0x________________________________________` |
| Constructor args | `"Acme Electronics", 730` |
| Compiler | Solidity 0.8.20, EVM version `paris` |

Full details (tx hash, block number, gas used) are in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 8. Test cases & observed results

Tests were executed in three ways:
1. **Automated** – 27 Hardhat/Mocha tests (`npm install` then `npm test`). Output in [`test/test-results.txt`](test/test-results.txt): **27 passing**.
2. **Remix Solidity Unit Testing** – `test/remix/WarrantyChain_test.sol`: **13 passing**.
3. **Manual through the UI with MetaMask on Ganache** – the table below.

### 8.1 Valid inputs

| ID | Account | Input | Expected | Observed |
|---|---|---|---|---|
| V1 | Manufacturer | Deploy with `"Acme Electronics", 730` | Deployed; brand / manufacturer / max days set | ✅ Pass |
| V2 | Manufacturer | `setRetailer(Retailer, true)` | `RetailerUpdated` event, retailer authorised | ✅ Pass |
| V3 | Retailer | `issueWarranty("SN-1001","Acme X200 Laptop",Customer,365)` | Tx confirmed, warranty stored, expiry = purchase + 365 days | ✅ Pass |
| V4 | Customer | `transferWarranty("SN-1001", NewOwner)` | Holder changes, transferCount = 1 | ✅ Pass |
| V5 | Customer → Manufacturer | `fileClaim("SN-1001","Screen flickers")` → `resolveClaim(1,true)` | Claim #1 created then Approved | ✅ Pass |
| V6 | Manufacturer | `voidWarranty("SN-1001","Counterfeit unit")` | `isWarrantyValid` → false | ✅ Pass |
| V7 | Anyone | Verify `SN-1001` in UI | Warranty details + claim history displayed | ✅ Pass |
| V8 | – | Warranty after expiry date (time travel in test) | `isWarrantyValid` → false | ✅ Pass |

### 8.2 Invalid inputs

| ID | Input | Expected revert message | Observed |
|---|---|---|---|
| I1 | Deploy with brand `""` | `Brand name required` | ✅ Reverted |
| I2 | Deploy with max days `0` or `4000` | `Max warranty must be 1-3650 days` | ✅ Reverted |
| I3 | Issue `SN-1001` again | `Serial already registered` | ✅ Reverted |
| I4 | Serial `SN1` (3 chars) / 33 chars | `Serial must be 4-32 characters` | ✅ Reverted |
| I5 | Empty product model | `Product model required` | ✅ Reverted |
| I6 | Buyer `0x000…000` / buyer = retailer | `Invalid buyer address` / `Retailer cannot be the buyer` | ✅ Reverted |
| I7 | Duration `0` or `9999` days | `Duration exceeds allowed range` | ✅ Reverted |
| I8 | Verify unknown serial `SN-9999` | `Warranty not found` | ✅ Reverted (shown in UI) |
| I9 | Claim description `"bad"` | `Issue must be 5-200 characters` | ✅ Reverted |
| I10 | Second claim while one pending / transfer with open claim | `A claim is already pending` / `Resolve open claim before transfer` | ✅ Reverted |
| I11 | Claim on expired warranty | `Warranty expired or voided` | ✅ Reverted |
| I12 | Claim on voided warranty / void twice | `Warranty expired or voided` / `Warranty already voided` | ✅ Reverted |
| I13 | Resolve claim ID 5 (doesn't exist) / resolve twice | `Claim not found` / `Claim already resolved` | ✅ Reverted |
| I14 | Transfer to zero address / to self | `Invalid new holder address` / `Already the holder` | ✅ Reverted |
| I15 | Buyer field `not-an-address` in UI | Blocked in frontend before sending | ✅ Error shown in log |

### 8.3 Unauthorised access

| ID | Caller | Action | Expected revert message | Observed |
|---|---|---|---|---|
| U1 | Customer (not retailer) | `issueWarranty` | `Unauthorized: not an authorized retailer` | ✅ Reverted |
| U2 | Revoked retailer | `issueWarranty` | `Unauthorized: not an authorized retailer` | ✅ Reverted |
| U3 | Retailer / Customer | `setRetailer` | `Unauthorized: only manufacturer` | ✅ Reverted |
| U4 | Stranger | `transferWarranty` of someone else's warranty | `Unauthorized: only the warranty holder` | ✅ Reverted |
| U5 | Previous holder after transfer | `fileClaim` | `Unauthorized: only the warranty holder` | ✅ Reverted |
| U6 | Customer / Retailer | `resolveClaim`, `voidWarranty` | `Unauthorized: only manufacturer` | ✅ Reverted |

### Running the automated tests
```bash
npm install
npm test
```

---

## 9. Screenshots

All screenshots are in the [`screenshots/`](screenshots) folder.

| # | Evidence | File |
|---|---|---|
| 1 | Smart contract compilation in Remix | ![](screenshots/01-compile.png) |
| 2 | Smart contract deployment (Remix + Ganache) | ![](screenshots/02-deploy.png) |
| 3 | MetaMask wallet connection | ![](screenshots/03-metamask-connect.png) |
| 4 | Successful transaction (issue warranty) | ![](screenshots/04-success-tx.png) |
| 5 | Failed transaction (unauthorised / invalid input) | ![](screenshots/05-failed-tx.png) |
| 6 | Blockchain data displayed in the UI | ![](screenshots/06-ui-data.png) |
| 7 | Remix unit test results | ![](screenshots/07-remix-tests.png) |
| 8 | Ganache transactions list | ![](screenshots/08-ganache-txs.png) |

---

## 10. Technologies

Solidity 0.8.20 · Ethereum (Ganache / Sepolia) · Remix IDE · MetaMask · Ethers.js v6 · HTML5 / CSS3 / JavaScript · Hardhat + Mocha/Chai (automated tests)

## 11. Security notes

- No private keys, seed phrases or passwords are stored in this repository.
- All access control and input validation is enforced on-chain in the smart contract; the frontend only adds convenience checks (e.g. address format).
